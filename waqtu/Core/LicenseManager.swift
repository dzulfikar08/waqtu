//
//  LicenseManager.swift
//  waqtu
//
//  Polar license key: activate once per device, validate on launch.
//  Keys stored in Keychain (persists across reinstalls).
//

import Foundation
import Security

enum LicenseError: Error {
    case message(String)
}

@Observable
final class LicenseManager {
    static let licenseAPIBase = "https://waqt-updates.dzulfikar-at.workers.dev"

    private let keychainService: String
    private let licenseKeyAccount = "licenseKey"
    private let activationIdAccount = "activationId"

    private(set) var licenseKey: String?
    private(set) var activationId: String?
    private(set) var isValidated: Bool = false

    init(bundleIdentifier: String = Bundle.main.bundleIdentifier ?? "dat.waqtu") {
        self.keychainService = "\(bundleIdentifier).license"
        loadFromKeychain()
    }

    /// True if we have a stored key + activation_id and last validation succeeded (or we haven't re-validated yet this launch).
    var isLicensed: Bool {
        guard licenseKey != nil else { return false }
        if activationId != nil {
            return isValidated
        }
        return false
    }

    /// Device identifier for Polar activation (stable per install, stored in Keychain).
    var deviceId: String {
        if let existing = readString(account: "deviceId") {
            return existing
        }
        let newId = "\(Bundle.main.bundleIdentifier ?? "waqtu")-\(UUID().uuidString)"
        writeString(account: "deviceId", value: newId)
        return newId
    }

    /// Activate a new license key on this device. Call after user enters key.
    func activate(key: String) async -> Result<Void, LicenseError> {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return .failure(.message("Please enter your license key.")) }

        let url = URL(string: "\(Self.licenseAPIBase)/license/activate")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONEncoder().encode([
            "key": trimmed,
            "device_id": deviceId,
        ])

        guard let (data, res) = try? await URLSession.shared.data(for: req),
              let http = res as? HTTPURLResponse else {
            return .failure(.message("Network error."))
        }

        let decoded = (try? JSONDecoder().decode(ActivateResponse.self, from: data)) ?? ActivateResponse(valid: false, error: "Invalid response", activation_id: nil)
        if decoded.valid, let aid = decoded.activation_id {
            saveToKeychain(key: trimmed, activationId: aid)
            licenseKey = trimmed
            activationId = aid
            isValidated = true
            return .success(())
        }
        let msg = decoded.error ?? (http.statusCode != 200 ? "Activation failed (\(http.statusCode))" : "This license is already in use on another device.")
        return .failure(.message(msg))
    }

    /// Validate existing license (e.g. on launch). Call when we have key + activation_id.
    func validate() async {
        guard let key = licenseKey, let aid = activationId else {
            isValidated = false
            return
        }

        let url = URL(string: "\(Self.licenseAPIBase)/license/validate")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONEncoder().encode([
            "key": key,
            "activation_id": aid,
        ])

        guard let (data, _) = try? await URLSession.shared.data(for: req),
              let decoded = try? JSONDecoder().decode(ValidateResponse.self, from: data) else {
            isValidated = false
            return
        }
        isValidated = decoded.valid
        if !decoded.valid {
            clearStoredLicense()
        }
    }

    /// Remove stored license (e.g. user deactivated on Polar).
    func clearStoredLicense() {
        deleteKeychainItem(account: licenseKeyAccount)
        deleteKeychainItem(account: activationIdAccount)
        licenseKey = nil
        activationId = nil
        isValidated = false
    }

    private func loadFromKeychain() {
        licenseKey = readString(account: licenseKeyAccount)
        activationId = readString(account: activationIdAccount)
        isValidated = (licenseKey != nil && activationId != nil)
    }

    private func saveToKeychain(key: String, activationId: String) {
        writeString(account: licenseKeyAccount, value: key)
        writeString(account: activationIdAccount, value: activationId)
    }

    private func writeString(account: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }
        deleteKeychainItem(account: account)
        addKeychainItem(account: account, value: data)
    }

    private func readString(account: String) -> String? {
        guard let data = readKeychainItem(account: account),
              let s = String(data: data, encoding: .utf8) else { return nil }
        return s
    }

    private func addKeychainItem(account: String, value: Data) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: account,
            kSecValueData as String: value,
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    private func readKeychainItem(account: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
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
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

private struct ActivateResponse: Codable {
    let valid: Bool
    let error: String?
    let activation_id: String?
}

private struct ValidateResponse: Codable {
    let valid: Bool
    let error: String?
}
