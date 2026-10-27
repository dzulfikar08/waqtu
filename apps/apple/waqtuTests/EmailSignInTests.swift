//
//  EmailSignInTests.swift
//  waqtuTests
//
//  Store reviewer email + password sign-in (WaqtuAPIClient.signInWithEmail) against a stubbed
//  server: the request the phone's better-auth client sends, where the session token comes from,
//  and what each failure means to the reviewer.
//

import Foundation
import Testing

/// Answers every request of a session built with `StubURLProtocol.session()` with `reply` and
/// remembers the request. Shared state: only the serialized suite below uses it.
final class StubURLProtocol: URLProtocol {
    struct Reply {
        var status = 200
        var headers: [String: String] = [:]
        var body = Data()
        var error: URLError?
    }

    static var reply = Reply()
    static var lastRequest: URLRequest?
    static var lastBody: Data?

    static func reset(_ reply: Reply) {
        self.reply = reply
        lastRequest = nil
        lastBody = nil
    }

    static func client() -> WaqtuAPIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubURLProtocol.self]
        return WaqtuAPIClient(baseURL: URL(string: "https://api.test")!, session: URLSession(configuration: config))
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.lastRequest = request
        Self.lastBody = Self.body(of: request)
        let reply = Self.reply
        if let error = reply.error {
            client?.urlProtocol(self, didFailWithError: error)
            return
        }
        let response = HTTPURLResponse(url: request.url!, statusCode: reply.status, httpVersion: "HTTP/1.1", headerFields: reply.headers)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: reply.body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    /// URLSession hands the protocol the body as a stream.
    private static func body(of request: URLRequest) -> Data? {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 4096)
        while stream.hasBytesAvailable {
            let count = stream.read(&buffer, maxLength: buffer.count)
            if count <= 0 { break }
            data.append(buffer, count: count)
        }
        return data
    }
}

private func json(_ s: String) -> Data { Data(s.utf8) }

@Suite(.serialized)
struct EmailSignInTests {
    @Test func postsTheCredentialsLikeThePhone() async throws {
        StubURLProtocol.reset(.init(headers: ["set-auth-token": "header.tok"], body: json(#"{"token":"body.tok"}"#)))
        let token = try await StubURLProtocol.client().signInWithEmail(email: "  Review@GetWaqtu.com ", password: " Pass word ")
        #expect(token == "header.tok")

        let request = try #require(StubURLProtocol.lastRequest)
        #expect(request.httpMethod == "POST")
        #expect(request.url?.absoluteString == "https://api.test/api/auth/sign-in/email")
        #expect(request.value(forHTTPHeaderField: "Content-Type") == "application/json")
        #expect(request.value(forHTTPHeaderField: "expo-origin") == "waqtu://")
        #expect(request.value(forHTTPHeaderField: "x-skip-oauth-proxy") == "true")
        #expect(request.value(forHTTPHeaderField: "Authorization") == nil)
        let body = try #require(StubURLProtocol.lastBody)
        let sent = try #require(try JSONSerialization.jsonObject(with: body) as? [String: String])
        #expect(sent == ["email": "review@getwaqtu.com", "password": " Pass word "])
    }

    @Test func tokenFromTheBodyWithoutTheHeader() async throws {
        StubURLProtocol.reset(.init(body: json(#"{"redirect":false,"token":"body.tok","user":{"id":"u1"}}"#)))
        #expect(try await StubURLProtocol.client().signInWithEmail(email: "review@getwaqtu.com", password: "pw") == "body.tok")
    }

    @Test func noTokenIsAFailure() async {
        StubURLProtocol.reset(.init(body: json(#"{"user":{"id":"u1"}}"#)))
        await #expect(throws: EmailSignInProblem.failed) {
            _ = try await StubURLProtocol.client().signInWithEmail(email: "review@getwaqtu.com", password: "pw")
        }
    }

    @Test func emptyFieldsNeverReachTheServer() async {
        StubURLProtocol.reset(.init())
        await #expect(throws: EmailSignInProblem.missing) {
            _ = try await StubURLProtocol.client().signInWithEmail(email: "  ", password: "pw")
        }
        await #expect(throws: EmailSignInProblem.missing) {
            _ = try await StubURLProtocol.client().signInWithEmail(email: "review@getwaqtu.com", password: "")
        }
        #expect(StubURLProtocol.lastRequest == nil)
    }

    @Test func serverErrorsMapToWhatTheReviewerSees() async {
        let cases: [(StubURLProtocol.Reply, EmailSignInProblem)] = [
            (.init(status: 401, body: json(#"{"code":"INVALID_EMAIL_OR_PASSWORD","message":"Invalid email or password"}"#)), .invalid),
            (.init(status: 403, body: json(#"{"code":"EMAIL_NOT_VERIFIED"}"#)), .invalid),
            (.init(status: 400, body: json(#"{"code":"INVALID_EMAIL"}"#)), .invalid),
            (.init(status: 429), .rateLimited),
            (.init(status: 500, body: json(#"{"message":"boom"}"#)), .failed),
            (.init(error: URLError(.notConnectedToInternet)), .failed),
        ]
        for (reply, problem) in cases {
            StubURLProtocol.reset(reply)
            await #expect(throws: problem) {
                _ = try await StubURLProtocol.client().signInWithEmail(email: "review@getwaqtu.com", password: "pw")
            }
        }
    }
}

struct EmailSignInParsingTests {
    @Test func credentialsAreNormalizedLikeThePhone() {
        let c = EmailSignIn.credentials(email: " Review@GetWaqtu.com\n", password: " pw ")
        #expect(c?.email == "review@getwaqtu.com")
        #expect(c?.password == " pw ")
        #expect(EmailSignIn.credentials(email: "review", password: "pw") == nil)
        #expect(EmailSignIn.credentials(email: "review@getwaqtu.com", password: "") == nil)
    }

    @Test func problemFromStatusAndCode() {
        #expect(EmailSignIn.problem(status: 401, code: nil) == .invalid)
        #expect(EmailSignIn.problem(status: 403, code: nil) == .invalid)
        #expect(EmailSignIn.problem(status: 400, code: "INVALID_EMAIL_OR_PASSWORD") == .invalid)
        #expect(EmailSignIn.problem(status: 429, code: "INVALID_EMAIL_OR_PASSWORD") == .rateLimited)
        #expect(EmailSignIn.problem(status: 502, code: nil) == .failed)
    }

    @Test func sessionTokenPrefersTheHeader() throws {
        let body = json(#"{"token":"body.tok"}"#)
        #expect(try AuthParsing.sessionToken(authTokenHeader: "header.tok", body: body) == "header.tok")
        #expect(try AuthParsing.sessionToken(authTokenHeader: "", body: body) == "body.tok")
        #expect(try AuthParsing.sessionToken(authTokenHeader: nil, body: body) == "body.tok")
    }

    @Test func missingTokenIsAnError() {
        #expect(throws: WaqtuAPIError.missingToken) {
            _ = try AuthParsing.sessionToken(authTokenHeader: nil, body: json(#"{"token":""}"#))
        }
        #expect(throws: WaqtuAPIError.missingToken) {
            _ = try AuthParsing.sessionToken(authTokenHeader: nil, body: Data("not json".utf8))
        }
    }
}
