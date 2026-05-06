//
//  GoogleCalendarManager.swift
//  waqtu
//
//  Google Calendar integration via OAuth 2.0.
//  Uses ASWebAuthenticationSession for sign-in and creates prayer events
//  on the user's primary Google Calendar.
//

import Foundation
import AuthenticationServices
import EventKit

/// Google OAuth configuration.
/// To enable: register at https://console.cloud.google.com, create OAuth 2.0 Client ID
/// for macOS, and set the redirect URI to your custom scheme.
struct GoogleOAuthConfig {
    // Replace with your own credentials from Google Cloud Console
    static let clientId = ""  // Set via GOOGLE_CLIENT_ID env or hardcode
    static let redirectURI = "dat.waqtu:/oauth2callback"
    static let authURL = "https://accounts.google.com/o/oauth2/v2/auth"
    static let tokenURL = "https://oauth2.googleapis.com/token"
    static let calendarScope = "https://www.googleapis.com/auth/calendar.events"

    static let keychainService = "dat.waqtu.google-oauth"
    static let accessTokenAccount = "googleAccessToken"
    static let refreshTokenAccount = "googleRefreshToken"
    static let tokenExpiryAccount = "googleTokenExpiry"
}

@Observable
final class GoogleCalendarManager: NSObject {
    private let defaults = UserDefaults.standard

    private(set) var isSignedIn: Bool = false
    private(set) var isLoading: Bool = false
    private(set) var lastError: String?

    override init() {
        super.init()
        isSignedIn = hasValidToken()
    }

    // MARK: - OAuth Sign-In

    /// Start Google OAuth sign-in flow. Opens browser for user consent.
    func signIn() async throws {
        guard !GoogleOAuthConfig.clientId.isEmpty else {
            throw GoogleCalendarError.notConfigured
        }

        isLoading = true
        defer { isLoading = false }

        let code = try await requestAuthCode()
        let tokens = try await exchangeCodeForTokens(code)
        saveTokens(accessToken: tokens.access, refreshToken: tokens.refresh, expiresIn: tokens.expiresIn)
        isSignedIn = true
        lastError = nil
    }

    /// Sign out and clear stored tokens.
    func signOut() {
        deleteTokens()
        isSignedIn = false
        lastError = nil
    }

    // MARK: - Calendar Operations

    /// Create a prayer event on the user's primary Google Calendar.
    func createPrayerEvent(
        prayerName: String,
        startDate: Date,
        durationMinutes: Int
    ) async throws {
        let token = try await getValidAccessToken()
        let event = GoogleCalendarEvent(
            summary: "Prayer – \(prayerName)",
            start: GoogleEventDateTime(dateTime: iso8601String(from: startDate)),
            end: GoogleEventDateTime(dateTime: iso8601String(from: startDate.addingTimeInterval(TimeInterval(durationMinutes * 60)))),
            transparency: "opaque",
            reminders: GoogleEventReminders(useDefault: false, overrides: [
                GoogleEventReminder(method: "popup", minutes: 5)
            ])
        )

        let url = URL(string: "https://www.googleapis.com/calendar/v3/calendars/primary/events")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(event)

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw GoogleCalendarError.eventCreationFailed
        }
    }

    /// Delete all Waqtu prayer events from today on Google Calendar.
    func deleteTodayPrayerEvents() async throws {
        let token = try await getValidAccessToken()
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: Date())
        let timeMin = iso8601String(from: startOfDay)

        let urlString = "https://www.googleapis.com/calendar/v3/calendars/primary/events?q=Prayer&timeMin=\(timeMin)"
        guard let url = URL(string: urlString.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? urlString) else {
            throw GoogleCalendarError.eventCreationFailed
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw GoogleCalendarError.eventCreationFailed
        }

        let eventsList = try JSONDecoder().decode(GoogleCalendarEventsList.self, from: data)
        for event in eventsList.items ?? [] {
            try await deleteEvent(eventId: event.id, token: token)
        }
    }

    // MARK: - Private

    private func deleteEvent(eventId: String, token: String) async throws {
        guard let url = URL(string: "https://www.googleapis.com/calendar/v3/calendars/primary/events/\(eventId)") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        _ = try await URLSession.shared.data(for: request)
    }

    private func requestAuthCode() async throws -> String {
        var components = URLComponents(string: GoogleOAuthConfig.authURL)!
        components.queryItems = [
            URLQueryItem(name: "client_id", value: GoogleOAuthConfig.clientId),
            URLQueryItem(name: "redirect_uri", value: GoogleOAuthConfig.redirectURI),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "scope", value: GoogleOAuthConfig.calendarScope),
            URLQueryItem(name: "access_type", value: "offline"),
            URLQueryItem(name: "prompt", value: "consent"),
        ]

        return try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: components.url!,
                callbackURLScheme: "dat.waqtu"
            ) { callbackURL, error in
                if let error = error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let callbackURL = callbackURL,
                      let components = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                      let code = components.queryItems?.first(where: { $0.name == "code" })?.value else {
                    continuation.resume(throwing: GoogleCalendarError.authFailed)
                    return
                }
                continuation.resume(returning: code)
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }
    }

    private func exchangeCodeForTokens(_ code: String) async throws -> (access: String, refresh: String, expiresIn: Int) {
        let url = URL(string: GoogleOAuthConfig.tokenURL)!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        let body = [
            "code": code,
            "client_id": GoogleOAuthConfig.clientId,
            "redirect_uri": GoogleOAuthConfig.redirectURI,
            "grant_type": "authorization_code",
        ]
        request.httpBody = body.map { "\($0.key)=\($0.value)" }.joined(separator: "&").data(using: .utf8)

        let (data, _) = try await URLSession.shared.data(for: request)
        let tokenResponse = try JSONDecoder().decode(GoogleTokenResponse.self, from: data)
        return (tokenResponse.access_token, tokenResponse.refresh_token ?? "", tokenResponse.expires_in)
    }

    private func refreshAccessToken(refreshToken: String) async throws -> String {
        let url = URL(string: GoogleOAuthConfig.tokenURL)!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        let body = [
            "refresh_token": refreshToken,
            "client_id": GoogleOAuthConfig.clientId,
            "grant_type": "refresh_token",
        ]
        request.httpBody = body.map { "\($0.key)=\($0.value)" }.joined(separator: "&").data(using: .utf8)

        let (data, _) = try await URLSession.shared.data(for: request)
        let tokenResponse = try JSONDecoder().decode(GoogleTokenResponse.self, from: data)
        return tokenResponse.access_token
    }

    private func getValidAccessToken() async throws -> String {
        guard let accessToken = readKeychainString(account: GoogleOAuthConfig.accessTokenAccount) else {
            throw GoogleCalendarError.notSignedIn
        }

        // Check expiry
        if let expiryStr = readKeychainString(account: GoogleOAuthConfig.tokenExpiryAccount),
           let expiryInterval = TimeInterval(expiryStr),
           Date().timeIntervalSince1970 < expiryInterval - 60 {
            return accessToken
        }

        // Refresh
        guard let refreshToken = readKeychainString(account: GoogleOAuthConfig.refreshTokenAccount) else {
            throw GoogleCalendarError.tokenExpired
        }

        let newAccessToken = try await refreshAccessToken(refreshToken: refreshToken)
        saveTokens(accessToken: newAccessToken, refreshToken: refreshToken, expiresIn: 3600)
        return newAccessToken
    }

    private func hasValidToken() -> Bool {
        guard let expiryStr = readKeychainString(account: GoogleOAuthConfig.tokenExpiryAccount),
              let expiryInterval = TimeInterval(expiryStr) else { return false }
        return Date().timeIntervalSince1970 < expiryInterval
    }

    private func saveTokens(accessToken: String, refreshToken: String, expiresIn: Int) {
        writeKeychainString(account: GoogleOAuthConfig.accessTokenAccount, value: accessToken)
        writeKeychainString(account: GoogleOAuthConfig.refreshTokenAccount, value: refreshToken)
        let expiry = String(Date().timeIntervalSince1970 + Double(expiresIn))
        writeKeychainString(account: GoogleOAuthConfig.tokenExpiryAccount, value: expiry)
    }

    private func deleteTokens() {
        deleteKeychainItem(account: GoogleOAuthConfig.accessTokenAccount)
        deleteKeychainItem(account: GoogleOAuthConfig.refreshTokenAccount)
        deleteKeychainItem(account: GoogleOAuthConfig.tokenExpiryAccount)
    }

    // MARK: - Keychain Helpers

    private func writeKeychainString(account: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }
        deleteKeychainItem(account: account)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: GoogleOAuthConfig.keychainService,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    private func readKeychainString(account: String) -> String? {
        guard let data = readKeychainItem(account: account),
              let str = String(data: data, encoding: .utf8) else { return nil }
        return str
    }

    private func readKeychainItem(account: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: GoogleOAuthConfig.keychainService,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return data
    }

    private func deleteKeychainItem(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: GoogleOAuthConfig.keychainService,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }

    private func iso8601String(from date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        return formatter.string(from: date)
    }
}

// MARK: - ASWebAuthenticationPresentationContextProviding

extension GoogleCalendarManager: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        NSApp.keyWindow ?? NSApp.windows.first ?? ASPresentationAnchor()
    }
}

// MARK: - Models

struct GoogleTokenResponse: Codable {
    let access_token: String
    let refresh_token: String?
    let expires_in: Int
    let token_type: String
}

struct GoogleCalendarEvent: Codable {
    let summary: String
    let start: GoogleEventDateTime
    let end: GoogleEventDateTime
    let transparency: String
    let reminders: GoogleEventReminders
}

struct GoogleEventDateTime: Codable {
    let dateTime: String
}

struct GoogleEventReminders: Codable {
    let useDefault: Bool
    let overrides: [GoogleEventReminder]
}

struct GoogleEventReminder: Codable {
    let method: String
    let minutes: Int
}

struct GoogleCalendarEventsList: Codable {
    let items: [GoogleCalendarEventItem]?
}

struct GoogleCalendarEventItem: Codable {
    let id: String
}

// MARK: - Errors

enum GoogleCalendarError: Error, LocalizedError {
    case notConfigured
    case notSignedIn
    case authFailed
    case tokenExpired
    case eventCreationFailed

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Google Calendar integration is not configured. Set GOOGLE_CLIENT_ID."
        case .notSignedIn: return "Not signed in to Google Calendar."
        case .authFailed: return "Google authentication failed."
        case .tokenExpired: return "Google access token expired. Please sign in again."
        case .eventCreationFailed: return "Failed to create Google Calendar event."
        }
    }
}
