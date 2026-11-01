//
//  MuhasabahCloud.swift
//  waqtu
//
//  The opt-in cloud copy of the muhasabah journal (services/api `/v1/muhasabah`, the Mac side of
//  apps/mobile/src/ibadah/cloud.ts). The journal is local to the Mac until the user turns on
//  "Sync muhasabah to the cloud"; only then does anything here talk to the server. A day is one
//  whole-entry last-write-wins record; a deleted day travels as an entry-less tombstone.
//  Main-thread use only.
//

import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

/// The answers of one day as `/v1/muhasabah` carries them: an absent key is an unanswered question.
struct MuhasabahWireEntry: Codable, Equatable {
    var feelings: String?
    var newAction: String?
    var taqwa: Int?
    var gratitude: Int?
    var energy: Int?
    var willingness: Int?
    var continueTomorrow: String?
}

extension MuhasabahWireEntry {
    /// The server refuses text over 16000 UTF-16 units; the journal's own cap is 4000 characters,
    /// which only an extreme run of multi-unit characters can exceed.
    static let maxServerText = 16000

    init(_ entry: MuhasabahEntry) {
        feelings = Self.serverText(entry.feelings)
        newAction = Self.serverText(entry.newAction)
        taqwa = Muhasabah.cleanRating(entry.taqwa)
        gratitude = Muhasabah.cleanRating(entry.gratitude)
        energy = Muhasabah.cleanRating(entry.energy)
        willingness = Muhasabah.cleanRating(entry.willingness)
        continueTomorrow = Self.serverText(entry.continueTomorrow)
    }

    private static func serverText(_ value: String?) -> String? {
        guard var text = Muhasabah.cleanText(value) else { return nil }
        while text.utf16.count > maxServerText { text.removeLast() }
        return text
    }

    /// The journal entry of `date` holding these answers.
    func entry(date: String) -> MuhasabahEntry {
        var out = MuhasabahEntry(date: date)
        out.feelings = feelings
        out.newAction = newAction
        out.taqwa = taqwa
        out.gratitude = gratitude
        out.energy = energy
        out.willingness = willingness
        out.continueTomorrow = continueTomorrow
        return out
    }
}

/// One day on the wire. `entry == nil` deletes the day and is sent as an explicit `null`: the server
/// requires the key.
struct MuhasabahWire: Codable, Equatable {
    var date: String
    /// Epoch milliseconds of the last edit.
    var updatedAt: Int64
    var entry: MuhasabahWireEntry?

    enum CodingKeys: String, CodingKey {
        case date, updatedAt, entry
    }

    init(date: String, updatedAt: Int64, entry: MuhasabahWireEntry?) {
        self.date = date
        self.updatedAt = updatedAt
        self.entry = entry
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        date = try container.decode(String.self, forKey: .date)
        updatedAt = try container.decode(Int64.self, forKey: .updatedAt)
        entry = try container.decodeIfPresent(MuhasabahWireEntry.self, forKey: .entry)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(date, forKey: .date)
        try container.encode(updatedAt, forKey: .updatedAt)
        try container.encode(entry, forKey: .entry)
    }
}

struct MuhasabahPullPage: Decodable, Equatable {
    var entries: [MuhasabahWire]
    var cursor: String
    var hasMore: Bool
}

enum MuhasabahLimits {
    /// Server caps per request (services/api/src/muhasabah.ts).
    static let push = 20
    static let pull = 100
}

protocol MuhasabahTransport {
    func pull(since: String, limit: Int) async throws -> MuhasabahPullPage
    func push(_ entries: [MuhasabahWire]) async throws
}

/// Which account the cloud copy is turned on for on this Mac, and the pull cursor of that copy.
/// Turning it on is per account: another account signing in finds it off. A file of its own, apart
/// from the journal and the sync replica.
final class MuhasabahCloudPrefs {
    private struct State: Codable, Equatable {
        var userId: String?
        var cursor: String = "0"
    }

    private var state: State
    private let fileURL: URL?

    /// `fileURL == nil` keeps everything in memory (tests).
    init(fileURL: URL?) {
        self.fileURL = fileURL
        if let fileURL, let data = try? Data(contentsOf: fileURL),
           let decoded = try? JSONDecoder().decode(State.self, from: data) {
            state = decoded
        } else {
            state = State()
        }
    }

    /// `~/Library/Application Support/<bundle id>/muhasabah-cloud.json`.
    static func defaultFileURL() -> URL? {
        guard let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            return nil
        }
        let id = Bundle.main.bundleIdentifier ?? "dat.waqtu"
        return base.appendingPathComponent(id, isDirectory: true).appendingPathComponent("muhasabah-cloud.json")
    }

    /// The account the cloud copy is on for; nil when it is off.
    var userId: String? { state.userId }

    var cursor: String { state.cursor }

    func isEnabled(for userId: String) -> Bool { state.userId == userId }

    /// Turns it on for `userId` with a fresh cursor, so the whole copy is pulled again.
    func enable(for userId: String) {
        state = State(userId: userId, cursor: "0")
        commit()
    }

    func disable() {
        state = State(userId: nil, cursor: "0")
        commit()
    }

    func setCursor(_ cursor: String) {
        guard state.userId != nil, state.cursor != cursor else { return }
        state.cursor = cursor
        commit()
    }

    private func commit() {
        guard let fileURL else { return }
        do {
            try FileManager.default.createDirectory(
                at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.sortedKeys]
            try encoder.encode(state).write(to: fileURL, options: .atomic)
        } catch {
            // Keep working in memory; the next change tries again.
        }
    }
}

struct MuhasabahSyncReport: Equatable {
    /// Days the cloud copy changed here.
    var pulled = 0
    /// Days uploaded.
    var pushed = 0
}

/// Pull everything since the stored cursor (last write wins per day), then push the days the cloud
/// copy has not seen. `isActive` is asked between requests, so turning the setting off stops a
/// running pass before it writes or uploads anything more.
@MainActor
func runMuhasabahSync(
    store: MuhasabahStore,
    prefs: MuhasabahCloudPrefs,
    transport: MuhasabahTransport,
    isActive: () -> Bool = { true }
) async throws -> MuhasabahSyncReport {
    var report = MuhasabahSyncReport()
    var cursor = prefs.cursor
    while isActive() {
        let page = try await transport.pull(since: cursor, limit: MuhasabahLimits.pull)
        guard isActive() else { return report }
        report.pulled += store.merge(remote: page.entries).count
        prefs.setCursor(page.cursor)
        // A server that claims more but does not advance would loop forever.
        if !page.hasMore || page.cursor == cursor { break }
        cursor = page.cursor
    }

    for chunk in SyncMerge.chunk(store.dirtyWires(), size: MuhasabahLimits.push) {
        guard isActive() else { return report }
        try await transport.push(chunk)
        store.markClean(chunk)
        report.pushed += chunk.count
    }
    return report
}

/// `/v1/muhasabah` of services/api.
struct HTTPMuhasabahTransport: MuhasabahTransport {
    let client: WaqtuAPIClient
    let token: String
    private let session: URLSession

    init(client: WaqtuAPIClient, token: String, session: URLSession = WaqtuAPI.makeSession()) {
        self.client = client
        self.token = token
        self.session = session
    }

    private func request(_ method: String, query: String? = nil, body: Data? = nil) throws -> URLRequest {
        var s = client.baseURL.absoluteString
        while s.hasSuffix("/") { s.removeLast() }
        s += "/v1/muhasabah"
        if let query { s += "?" + query }
        guard let url = URL(string: s) else { throw WaqtuAPIError.invalidResponse }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = body
        }
        return req
    }

    private func send(_ req: URLRequest) async throws -> Data {
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw WaqtuAPIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else { throw SyncHTTPError(status: http.statusCode) }
        return data
    }

    func pull(since: String, limit: Int) async throws -> MuhasabahPullPage {
        let query = "since=\(AuthParsing.percentEncode(since))&limit=\(limit)"
        let data = try await send(try request("GET", query: query))
        return try JSONDecoder().decode(MuhasabahPullPage.self, from: data)
    }

    private struct PushBody: Encodable {
        let entries: [MuhasabahWire]
    }

    func push(_ entries: [MuhasabahWire]) async throws {
        let body = try JSONEncoder().encode(PushBody(entries: entries))
        _ = try await send(try request("POST", body: body))
    }

    /// Deletes the account's whole cloud journal; the entries on this Mac are not touched.
    func deleteCloudCopy() async throws {
        _ = try await send(try request("DELETE"))
    }
}
