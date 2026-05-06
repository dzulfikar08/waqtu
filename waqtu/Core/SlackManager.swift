//
//  SlackManager.swift
//  waqtu
//
//  Slack status integration: auto-set "Praying" during prayer times.
//  User provides a User OAuth Token with users.profile:write scope.
//

import Foundation
import Security

// MARK: - Manager

@Observable
final class SlackManager {
    private let keychainService = "dat.waqtu.slack"
    private let keychainAccount = "oauth_token"

    var isConnected: Bool { loadToken() != nil }
    var connectedTeam: String? { loadToken() }

    // MARK: - Token Storage (Keychain)

    func storeToken(_ token: String) {
        guard let data = token.data(using: .utf8) else { return }
        deleteToken()

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
            kSecValueData as String: data,
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    func loadToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    func deleteToken() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: keychainAccount,
        ]
        SecItemDelete(query as CFDictionary)
    }

    // MARK: - Status API

    /// Set the user's Slack status. Uses users.profile.set API.
    func setStatus(token: String, text: String, emoji: String, expirationMinutes: Int) async throws {
        var profile: [String: Any] = [
            "status_text": text,
            "status_emoji": emoji,
        ]

        if expirationMinutes > 0 {
            let expiration = Int(Date().timeIntervalSince1970) + (expirationMinutes * 60)
            profile["status_expiration"] = expiration
        }

        let body: [String: Any] = ["profile": profile]
        try await callSlackAPI(token: token, body: body)
    }

    /// Clear the user's Slack status.
    func clearStatus(token: String) async throws {
        let body: [String: Any] = [
            "profile": [
                "status_text": "",
                "status_emoji": "",
            ]
        ]
        try await callSlackAPI(token: token, body: body)
    }

    private func callSlackAPI(token: String, body: [String: Any]) async throws {
        guard let url = URL(string: "https://slack.com/api/users.profile.set") else {
            throw SlackError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: request)

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              json["ok"] as? Bool == true else {
            let error = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String ?? "unknown"
            throw SlackError.apiError(error)
        }
    }
}

// MARK: - Errors

enum SlackError: LocalizedError {
    case invalidURL
    case apiError(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid Slack API URL."
        case .apiError(let msg):
            return "Slack API error: \(msg)"
        }
    }
}
