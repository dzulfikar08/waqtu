//
//  WaqtuAPI.swift
//  waqtu
//
//  HTTP client for services/api: better-auth sign-in (bearer plugin), /v1/me, /v1/sync and the
//  license link. Authenticates with `Authorization: Bearer <session token>`; the token is the
//  better-auth session cookie value, which the server's bearer plugin accepts.
//

import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

enum WaqtuAPI {
    static let defaultBaseURL = URL(string: "https://api.getwaqtu.com")!

    /// `WAQTU_API_URL` overrides the server for local development.
    static var baseURL: URL {
        if let raw = ProcessInfo.processInfo.environment["WAQTU_API_URL"], let url = URL(string: raw) {
            return url
        }
        return defaultBaseURL
    }

    /// Custom scheme the server redirects the browser sign-in back to; it is a trusted origin there.
    static let callbackScheme = "waqtu"
    static let callbackURL = "waqtu://auth"

    /// No cookie jar: the session lives only in the bearer token we keep in the Keychain.
    static func makeSession() -> URLSession {
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.httpCookieAcceptPolicy = .never
        config.timeoutIntervalForRequest = 30
        return URLSession(configuration: config)
    }
}

struct AccountUser: Codable, Equatable {
    let id: String
    let email: String?
    let name: String?
}

enum WaqtuAPIError: Error, LocalizedError, Equatable {
    case http(status: Int, message: String?)
    case invalidResponse
    case missingToken
    /// The endpoint does not exist on the server (404).
    case notAvailable

    var errorDescription: String? {
        switch self {
        case .http(let status, let message):
            return message ?? "Server error (\(status))."
        case .invalidResponse:
            return "Unexpected response from the server."
        case .missingToken:
            return "The server did not return a session."
        case .notAvailable:
            return "Not available yet."
        }
    }

    var isUnauthorized: Bool {
        if case .http(let status, _) = self { return status == 401 }
        return false
    }
}

/// Pure helpers for the cookie strings better-auth hands back.
enum AuthParsing {
    private static func cookieValue(named suffix: String, in header: String) -> String? {
        let pattern = "(?:^|,\\s*)(?:__Secure-)?[A-Za-z0-9_.-]*\(suffix)=([^;]*)"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(header.startIndex..<header.endIndex, in: header)
        guard let match = regex.firstMatch(in: header, range: range),
              let valueRange = Range(match.range(at: 1), in: header) else { return nil }
        let value = String(header[valueRange]).trimmingCharacters(in: .whitespaces)
        return value.isEmpty ? nil : value
    }

    /// The signed session token inside a `Set-Cookie` header (possibly several cookies joined by
    /// ", "), still percent-encoded as the server sent it; the bearer plugin decodes it.
    static func sessionToken(fromSetCookie header: String) -> String? {
        cookieValue(named: "session_token", in: header)
    }

    /// Value of the `oauth_state` cookie, which the browser needs when the server keeps state in a cookie.
    static func oauthState(fromSetCookie header: String) -> String? {
        cookieValue(named: "oauth_state", in: header)
    }

    /// The `cookie` query item the server appends to the `waqtu://` redirect.
    static func callbackCookie(from url: URL) -> String? {
        URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?.first(where: { $0.name == "cookie" })?.value
    }

    private static let unreserved = CharacterSet(
        charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")

    static func percentEncode(_ s: String) -> String {
        s.addingPercentEncoding(withAllowedCharacters: unreserved) ?? s
    }
}

final class WaqtuAPIClient {
    let baseURL: URL
    private let session: URLSession

    init(baseURL: URL = WaqtuAPI.baseURL, session: URLSession = WaqtuAPI.makeSession()) {
        self.baseURL = baseURL
        self.session = session
    }

    private func url(_ path: String, query: String? = nil) -> URL {
        var s = baseURL.absoluteString
        while s.hasSuffix("/") { s.removeLast() }
        s += path
        if let query { s += "?" + query }
        return URL(string: s) ?? baseURL
    }

    private func perform(
        _ path: String,
        query: String? = nil,
        method: String,
        token: String? = nil,
        body: [String: Any]? = nil,
        extraHeaders: [String: String] = [:]
    ) async throws -> (Data, HTTPURLResponse) {
        var req = URLRequest(url: url(path, query: query))
        req.httpMethod = method
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        for (k, v) in extraHeaders { req.setValue(v, forHTTPHeaderField: k) }
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else { throw WaqtuAPIError.invalidResponse }
        return (data, http)
    }

    private static func errorMessage(_ data: Data) -> String? {
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return (obj["message"] as? String) ?? (obj["error"] as? String)
    }

    private func checked(_ result: (Data, HTTPURLResponse)) throws -> (Data, HTTPURLResponse) {
        let (data, http) = result
        guard (200..<300).contains(http.statusCode) else {
            throw WaqtuAPIError.http(status: http.statusCode, message: Self.errorMessage(data))
        }
        return (data, http)
    }

    // MARK: - Sign in

    /// Native Sign in with Apple: the server verifies the identity token (audience = app bundle id).
    /// Returns the bearer session token.
    func signInWithApple(idToken: String, nonce: String, givenName: String?, familyName: String?) async throws -> String {
        var tokenBody: [String: Any] = ["token": idToken, "nonce": nonce]
        if givenName != nil || familyName != nil {
            var name: [String: String] = [:]
            if let givenName { name["firstName"] = givenName }
            if let familyName { name["lastName"] = familyName }
            tokenBody["user"] = ["name": name]
        }
        let (data, http) = try checked(try await perform(
            "/api/auth/sign-in/social",
            method: "POST",
            body: ["provider": "apple", "idToken": tokenBody]
        ))
        if let header = http.value(forHTTPHeaderField: "set-auth-token"), !header.isEmpty { return header }
        if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let token = obj["token"] as? String, !token.isEmpty {
            return token
        }
        throw WaqtuAPIError.missingToken
    }

    /// First leg of the browser flow. Returns the URL to open in the web authentication session:
    /// the server's authorization proxy, which sets the OAuth state cookie in that browser and
    /// forwards it to Google.
    func startGoogleSignIn() async throws -> URL {
        let (data, http) = try checked(try await perform(
            "/api/auth/sign-in/social",
            method: "POST",
            body: ["provider": "google", "callbackURL": WaqtuAPI.callbackURL],
            extraHeaders: ["expo-origin": "\(WaqtuAPI.callbackScheme)://"]
        ))
        guard let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let authorizationURL = obj["url"] as? String else { throw WaqtuAPIError.invalidResponse }
        var query = "authorizationURL=" + AuthParsing.percentEncode(authorizationURL)
        if let setCookie = http.value(forHTTPHeaderField: "Set-Cookie"),
           let state = AuthParsing.oauthState(fromSetCookie: setCookie) {
            query += "&oauthState=" + AuthParsing.percentEncode(state)
        }
        return url("/api/auth/expo-authorization-proxy", query: query)
    }

    /// Bearer token out of the `waqtu://auth?cookie=...` redirect that ends the browser flow.
    static func sessionToken(fromCallback callback: URL) throws -> String {
        guard let cookie = AuthParsing.callbackCookie(from: callback),
              let token = AuthParsing.sessionToken(fromSetCookie: cookie) else { throw WaqtuAPIError.missingToken }
        return token
    }

    // MARK: - Account

    func me(token: String) async throws -> AccountUser {
        let (data, _) = try checked(try await perform("/v1/me", method: "GET", token: token))
        guard let user = try? JSONDecoder().decode(AccountUser.self, from: data) else {
            throw WaqtuAPIError.invalidResponse
        }
        return user
    }

    /// Ends the session on the server; the caller forgets the token either way.
    func signOut(token: String) async {
        _ = try? await perform("/api/auth/sign-out", method: "POST", token: token, body: [:])
    }

    /// Links the Polar license key to the signed-in account (`POST /v1/entitlement/link-license`).
    /// Throws `.notAvailable` when the server has no such endpoint.
    func linkLicense(token: String, key: String) async throws -> Bool {
        let (data, http) = try await perform("/v1/entitlement/link-license", method: "POST", token: token, body: ["key": key])
        if http.statusCode == 404 { throw WaqtuAPIError.notAvailable }
        guard (200..<300).contains(http.statusCode) else {
            throw WaqtuAPIError.http(status: http.statusCode, message: Self.errorMessage(data))
        }
        let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        return (obj?["premium"] as? Bool) ?? false
    }
}

struct SyncHTTPError: Error, Equatable {
    let status: Int
}

/// `/v1/sync` of services/api.
struct HTTPSyncTransport: SyncTransport {
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
        s += "/v1/sync"
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

    func pull(since: String, limit: Int) async throws -> SyncPullPage {
        let data = try await send(try request("GET", query: "since=\(AuthParsing.percentEncode(since))&limit=\(limit)"))
        return try JSONDecoder().decode(SyncPullPage.self, from: data)
    }

    private struct PushBody: Encodable {
        let entries: [SyncEntry]
        let settings: [SyncSetting]
    }

    func push(entries: [SyncEntry], settings: [SyncSetting]) async throws {
        let body = try JSONEncoder().encode(PushBody(entries: entries, settings: settings))
        _ = try await send(try request("POST", body: body))
    }
}

/// The signed-in session is no longer valid; the caller should stop syncing until the next sign-in.
func isUnauthorized(_ error: Error) -> Bool {
    if let e = error as? SyncHTTPError { return e.status == 401 }
    if let e = error as? WaqtuAPIError { return e.isUnauthorized }
    return false
}
