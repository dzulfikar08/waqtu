//
//  CirclesAPI.swift
//  waqtu
//
//  Client for `/v1/circles` of services/api, the same routes and bodies as
//  apps/mobile/src/circles/api.ts, authenticated with the account's bearer token. Shapes follow
//  apps/mobile/src/circles/types.ts; people are handles, user ids never appear.
//

import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

struct CirclesConfig: Decodable, Equatable {
    /// Server switch: when true, joining and posting need premium and the app shows the premium gate.
    let requiresPremium: Bool
    let maxTextLength: Int
    let maxAudioSeconds: Int
    let reactions: [String]
    let reportReasons: [String]
}

struct CircleProfile: Decodable, Equatable {
    let handle: String
    let gender: String
    let language: String
    let tzOffsetHours: Int
    let summaryOptIn: Bool
    let suspended: Bool
}

struct CircleInfo: Decodable, Equatable, Identifiable, Hashable {
    enum Status: String, Decodable {
        case active, paused
    }

    let id: String
    /// "public" | "private"
    let kind: String
    let name: String?
    let memberCount: Int
    let ready: Bool
    let full: Bool
    let myStatus: Status
    let joinedAt: Double
    let latestPostAt: Double?
    let inviteCode: String?

    /// Posting and reacting need an active membership; a paused member can still read.
    var canPost: Bool { myStatus == .active }
}

struct PostMedia: Decodable, Equatable {
    let id: String
    let mime: String
    let bytes: Int
    let durationSeconds: Int
}

struct WeeklySummary: Decodable, Equatable {
    let weekEnd: String
    let countedDays: Int
    let fardhOnTime: Int
    let fardhJamaah: Int
    let pages: Int
}

struct CirclePost: Decodable, Equatable, Identifiable {
    let id: String
    /// "text" | "voice" | "summary"
    let kind: String
    let handle: String
    let mine: Bool
    let text: String?
    /// Milliseconds since 1970.
    let createdAt: Double
    let halaqahDayId: String?
    let media: PostMedia?
    let summary: WeeklySummary?
    var reactions: [String: Int]
    var myReaction: String?
}

struct CircleFeed: Decodable, Equatable {
    let posts: [CirclePost]
    let nextBefore: String?
}

struct ReactionResult: Decodable, Equatable {
    let reactions: [String: Int]
    let myReaction: String?
}

struct CircleBlock: Decodable, Equatable {
    let id: String
    let handle: String
    let createdAt: Double
}

enum CircleReportReason: String, CaseIterable {
    case spam, harassment, inappropriate, other
}

/// A failed circles request: `status` is nil when the request never got an answer (offline).
struct CirclesError: Error, Equatable {
    let status: Int?
    let code: String?

    /// Copy key under `circles.errors` (apps/mobile/src/circles/logic.ts errorKey).
    var key: String {
        guard let status else { return "network" }
        switch code {
        case "profile_required": return "profileRequired"
        case "handle_taken": return "handleTaken"
        case "gender_locked": return "genderLocked"
        case "circle_full": return "circleFull"
        case "too_many_private_circles": return "tooManyPrivate"
        case "circle_paused": return "paused"
        case "rate_limited": return "rateLimited"
        case "suspended": return "suspended"
        case "summary_opt_in_required": return "summaryOptIn"
        case "premium_required": return "premiumRequired"
        case "payload_too_large": return "tooLarge"
        case "not_found": return "notFound"
        default: return status == 404 ? "notFound" : status == 413 ? "tooLarge" : "generic"
        }
    }

    var isUnauthorized: Bool { status == 401 }
}

enum CirclesFeedMerge {
    /// Appends an older page, dropping posts already shown (a refresh and a page can overlap).
    static func appendPage(_ shown: [CirclePost], _ page: [CirclePost]) -> [CirclePost] {
        let seen = Set(shown.map(\.id))
        return shown + page.filter { !seen.contains($0.id) }
    }

    /// A fresh first page replaces what is shown but keeps older pages already loaded below it.
    static func refresh(_ shown: [CirclePost], first: [CirclePost]) -> [CirclePost] {
        let fresh = Set(first.map(\.id))
        guard let oldest = first.last else { return first }
        return first + shown.filter { !fresh.contains($0.id) && $0.createdAt <= oldest.createdAt }
    }

    /// `m:ss` for a voice note's length.
    static func duration(_ seconds: Int) -> String {
        let total = max(0, seconds)
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

/// Sends one request; injectable so tests can check what goes over the wire.
typealias CirclesSend = (URLRequest) async throws -> (Data, HTTPURLResponse)

final class CirclesClient {
    private let root: String
    private let token: String
    private let send: CirclesSend

    init(baseURL: URL, token: String, send: CirclesSend? = nil) {
        var s = baseURL.absoluteString
        while s.hasSuffix("/") { s.removeLast() }
        root = s + "/v1/circles"
        self.token = token
        if let send {
            self.send = send
        } else {
            let session = WaqtuAPI.makeSession()
            self.send = { request in
                let (data, response) = try await session.data(for: request)
                guard let http = response as? HTTPURLResponse else { throw CirclesError(status: nil, code: nil) }
                return (data, http)
            }
        }
    }

    private static let segmentAllowed = CharacterSet(
        charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()")

    /// `encodeURIComponent` of one path segment or query value.
    static func segment(_ s: String) -> String {
        s.addingPercentEncoding(withAllowedCharacters: segmentAllowed) ?? s
    }

    func request(_ method: String, _ path: String, body: [String: Any]? = nil) throws -> URLRequest {
        guard let url = URL(string: root + path) else { throw CirclesError(status: nil, code: nil) }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
        }
        return req
    }

    private func data(_ method: String, _ path: String, body: [String: Any]? = nil) async throws -> Data {
        let req = try request(method, path, body: body)
        let data: Data
        let http: HTTPURLResponse
        do {
            (data, http) = try await send(req)
        } catch let error as CirclesError {
            throw error
        } catch {
            throw CirclesError(status: nil, code: nil)
        }
        guard (200..<300).contains(http.statusCode) else {
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            throw CirclesError(status: http.statusCode, code: obj?["error"] as? String)
        }
        return data
    }

    private func call<T: Decodable>(_ type: T.Type, _ method: String, _ path: String, body: [String: Any]? = nil) async throws -> T {
        let raw = try await data(method, path, body: body)
        do {
            return try JSONDecoder().decode(T.self, from: raw)
        } catch {
            throw CirclesError(status: 200, code: "invalid_response")
        }
    }

    private struct ProfileBody: Decodable { let profile: CircleProfile? }
    private struct CirclesBody: Decodable { let circles: [CircleInfo] }
    private struct CircleBody: Decodable { let circle: CircleInfo }
    private struct PostBody: Decodable { let post: CirclePost }
    private struct StateBody: Decodable { let status: String }

    func config() async throws -> CirclesConfig {
        try await call(CirclesConfig.self, "GET", "/config")
    }

    func profile() async throws -> CircleProfile? {
        try await call(ProfileBody.self, "GET", "/profile").profile
    }

    func list() async throws -> [CircleInfo] {
        try await call(CirclesBody.self, "GET", "").circles
    }

    func circle(_ id: String) async throws -> CircleInfo {
        try await call(CircleBody.self, "GET", "/\(Self.segment(id))").circle
    }

    func feed(_ id: String, before: String? = nil, limit: Int = 30) async throws -> CircleFeed {
        let query = before.map { "&before=\(Self.segment($0))" } ?? ""
        return try await call(CircleFeed.self, "GET", "/\(Self.segment(id))/feed?limit=\(limit)\(query)")
    }

    func post(_ id: String, text: String) async throws -> CirclePost {
        try await call(PostBody.self, "POST", "/\(Self.segment(id))/posts", body: ["text": text]).post
    }

    func deletePost(_ id: String, postId: String) async throws {
        _ = try await data("DELETE", "/\(Self.segment(id))/posts/\(Self.segment(postId))")
    }

    /// Sets the caller's reaction, or clears it with nil.
    func react(_ id: String, postId: String, emoji: String?) async throws -> ReactionResult {
        let path = "/\(Self.segment(id))/posts/\(Self.segment(postId))/reaction"
        if let emoji { return try await call(ReactionResult.self, "PUT", path, body: ["emoji": emoji]) }
        return try await call(ReactionResult.self, "DELETE", path)
    }

    /// `target` is "post" or "user".
    func report(_ id: String, postId: String, target: String, reason: CircleReportReason) async throws {
        _ = try await data(
            "POST", "/\(Self.segment(id))/posts/\(Self.segment(postId))/report",
            body: ["target": target, "reason": reason.rawValue])
    }

    func block(_ id: String, postId: String) async throws {
        _ = try await data("POST", "/\(Self.segment(id))/posts/\(Self.segment(postId))/block")
    }

    /// Silent for everyone else: only the caller's own membership changes. `change` is pause, resume or leave.
    func changeState(_ id: String, _ change: String) async throws {
        _ = try await call(StateBody.self, "POST", "/\(Self.segment(id))/\(change)")
    }

    /// A voice note's audio; the media route needs the session, so it is fetched with the token.
    func media(_ id: String, mediaId: String) async throws -> Data {
        try await data("GET", "/\(Self.segment(id))/media/\(Self.segment(mediaId))")
    }
}
