//
//  CirclesTests.swift
//  waqtuTests
//
//  The Mac circles client sends what apps/mobile/src/circles/api.ts sends to services/api, decodes
//  its responses, maps error codes like logic.ts errorKey and merges feed pages like the phone.
//

import Foundation
import Testing

/// Records requests and answers each with the next canned response.
final class CirclesRecorder: @unchecked Sendable {
    private(set) var requests: [URLRequest] = []
    var responses: [(status: Int, body: String)] = []

    func send(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        requests.append(request)
        let next = responses.isEmpty ? (200, "{}") : responses.removeFirst()
        let http = HTTPURLResponse(url: request.url!, statusCode: next.0, httpVersion: nil, headerFields: nil)!
        return (Data(next.1.utf8), http)
    }

    func client() -> CirclesClient {
        CirclesClient(baseURL: URL(string: "https://api.example.com/")!, token: "tok", send: { try await self.send($0) })
    }

    func body(_ i: Int) -> [String: String]? {
        guard let data = requests[i].httpBody else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: String]
    }
}

struct CirclesClientTests {
    static let postJSON = """
    {"id":"p1","kind":"text","handle":"Sabar_Embun_482","mine":false,"text":"Alhamdulillah","createdAt":1793000000000,
     "halaqahDayId":"ramadhan-1448:3","media":null,"summary":null,"reactions":{"🤲":2},"myReaction":null}
    """

    @Test func decodesServerShapes() async throws {
        let rec = CirclesRecorder()
        rec.responses = [
            (200, #"{"requiresPremium":true,"circleSize":{"min":8,"max":12},"maxTextLength":1000,"maxAudioBytes":2000000,"maxAudioSeconds":180,"audioMimeTypes":["audio/mp4"],"reactions":["🤲","❤️"],"reportReasons":["spam","harassment","inappropriate","other"],"isAdmin":false}"#),
            (200, #"{"profile":{"handle":"Sabar_Embun_482","gender":"ikhwan","language":"id","tzOffsetHours":7,"summaryOptIn":false,"suspended":false}}"#),
            (200, #"{"circles":[{"id":"c1","kind":"public","name":null,"memberCount":9,"ready":true,"full":false,"myStatus":"paused","joinedAt":1790000000000,"latestPostAt":null,"inviteCode":null}]}"#),
            (200, "{\"posts\":[\(Self.postJSON),{\"id\":\"p2\",\"kind\":\"voice\",\"handle\":\"Tenang_Pagi_100\",\"mine\":true,\"text\":null,\"createdAt\":1792000000000,\"halaqahDayId\":null,\"media\":{\"id\":\"m1\",\"mime\":\"audio/mp4\",\"bytes\":12000,\"durationSeconds\":14},\"summary\":null,\"reactions\":{},\"myReaction\":\"❤️\"}],\"nextBefore\":\"cursor-1\"}"),
            (200, #"{"profile":null}"#),
        ]
        let api = rec.client()
        let config = try await api.config()
        #expect(config.requiresPremium && config.maxTextLength == 1000 && config.reactions == ["🤲", "❤️"])
        let profile = try #require(try await api.profile())
        #expect(profile.handle == "Sabar_Embun_482" && profile.tzOffsetHours == 7)
        let circles = try await api.list()
        #expect(circles.count == 1 && circles[0].myStatus == .paused && !circles[0].canPost && circles[0].name == nil)
        let feed = try await api.feed("c1")
        #expect(feed.nextBefore == "cursor-1")
        #expect(feed.posts[0].reactions == ["🤲": 2] && feed.posts[0].halaqahDayId == "ramadhan-1448:3")
        #expect(feed.posts[1].media == PostMedia(id: "m1", mime: "audio/mp4", bytes: 12000, durationSeconds: 14))
        #expect(feed.posts[1].myReaction == "❤️")
        #expect(try await api.profile() == nil)

        #expect(rec.requests.map { $0.url!.absoluteString } == [
            "https://api.example.com/v1/circles/config",
            "https://api.example.com/v1/circles/profile",
            "https://api.example.com/v1/circles",
            "https://api.example.com/v1/circles/c1/feed?limit=30",
            "https://api.example.com/v1/circles/profile",
        ])
        #expect(rec.requests.allSatisfy { $0.value(forHTTPHeaderField: "Authorization") == "Bearer tok" })
    }

    @Test func sendsTheSameRoutesAsThePhone() async throws {
        let rec = CirclesRecorder()
        rec.responses = [
            (200, "{\"post\":\(Self.postJSON)}"),
            (200, #"{"reactions":{"🤲":3},"myReaction":"🤲"}"#),
            (200, #"{"reactions":{"🤲":2},"myReaction":null}"#),
            (200, #"{"ok":true}"#),
            (200, #"{"block":{"id":"b1","handle":"x","createdAt":1}}"#),
            (200, #"{"status":"paused"}"#),
            (200, #"{"status":"left"}"#),
            (200, #"{"ok":true}"#),
            (200, #"{"posts":[],"nextBefore":null}"#),
        ]
        let api = rec.client()
        _ = try await api.post("c1", text: "Bismillah")
        _ = try await api.react("c1", postId: "p1", emoji: "🤲")
        _ = try await api.react("c1", postId: "p1", emoji: nil)
        try await api.report("c1", postId: "p1", target: "user", reason: .harassment)
        try await api.block("c1", postId: "p1")
        try await api.changeState("c1", "pause")
        try await api.changeState("c1", "leave")
        try await api.deletePost("c1", postId: "p1")
        _ = try await api.feed("c1", before: "a b/c")

        let calls = rec.requests.map { "\($0.httpMethod!) \($0.url!.absoluteString.replacingOccurrences(of: "https://api.example.com/v1/circles", with: ""))" }
        #expect(calls == [
            "POST /c1/posts",
            "PUT /c1/posts/p1/reaction",
            "DELETE /c1/posts/p1/reaction",
            "POST /c1/posts/p1/report",
            "POST /c1/posts/p1/block",
            "POST /c1/pause",
            "POST /c1/leave",
            "DELETE /c1/posts/p1",
            "GET /c1/feed?limit=30&before=a%20b%2Fc",
        ])
        #expect(rec.body(0) == ["text": "Bismillah"])
        #expect(rec.body(1) == ["emoji": "🤲"])
        #expect(rec.requests[2].httpBody == nil)
        #expect(rec.body(3) == ["target": "user", "reason": "harassment"])
        #expect(rec.requests[4].httpBody == nil)
        #expect(rec.requests[0].value(forHTTPHeaderField: "Content-Type") == "application/json")
    }

    @Test func errorsCarryTheServerCode() async {
        let rec = CirclesRecorder()
        rec.responses = [(403, #"{"error":"premium_required"}"#), (401, "nope"), (404, "")]
        let api = rec.client()
        await #expect(throws: CirclesError(status: 403, code: "premium_required")) { try await api.list() }
        do {
            _ = try await api.list()
            Issue.record("expected 401")
        } catch let error as CirclesError {
            #expect(error.isUnauthorized && error.code == nil)
        } catch {
            Issue.record("unexpected \(error)")
        }
        await #expect(throws: CirclesError(status: 404, code: nil)) { try await api.config() }
    }

    @Test func errorKeysMatchThePhone() {
        #expect(CirclesError(status: nil, code: nil).key == "network")
        #expect(CirclesError(status: 403, code: "premium_required").key == "premiumRequired")
        #expect(CirclesError(status: 409, code: "circle_paused").key == "paused")
        #expect(CirclesError(status: 429, code: "rate_limited").key == "rateLimited")
        #expect(CirclesError(status: 409, code: "profile_required").key == "profileRequired")
        #expect(CirclesError(status: 404, code: "whatever").key == "notFound")
        #expect(CirclesError(status: 413, code: nil).key == "tooLarge")
        #expect(CirclesError(status: 500, code: nil).key == "generic")
    }
}

struct CirclesFeedMergeTests {
    private func post(_ id: String, _ at: Double) -> CirclePost {
        CirclePost(id: id, kind: "text", handle: "h", mine: false, text: id, createdAt: at,
                   halaqahDayId: nil, media: nil, summary: nil, reactions: [:], myReaction: nil)
    }

    @Test func appendDropsDuplicates() {
        let shown = [post("a", 3), post("b", 2)]
        #expect(CirclesFeedMerge.appendPage(shown, [post("b", 2), post("c", 1)]).map(\.id) == ["a", "b", "c"])
    }

    @Test func refreshKeepsOlderPages() {
        let shown = [post("b", 5), post("c", 4), post("d", 2), post("e", 1)]
        let first = [post("a", 6), post("b", 5), post("c", 4), post("x", 3)]
        #expect(CirclesFeedMerge.refresh(shown, first: first).map(\.id) == ["a", "b", "c", "x", "d", "e"])
        #expect(CirclesFeedMerge.refresh(shown, first: []).isEmpty)
    }

    @Test func durationFormat() {
        #expect(CirclesFeedMerge.duration(14) == "0:14")
        #expect(CirclesFeedMerge.duration(125) == "2:05")
    }
}
