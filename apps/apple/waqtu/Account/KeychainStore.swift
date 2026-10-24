//
//  KeychainStore.swift
//  waqtu
//
//  Generic-password Keychain items for the account session (same approach as LicenseManager).
//

import Foundation
import Security

struct KeychainStore {
    let service: String

    init(service: String = "\(Bundle.main.bundleIdentifier ?? "dat.waqtu").account") {
        self.service = service
    }

    private func query(_ account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    func read(_ account: String) -> String? {
        var q = query(account)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func write(_ account: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }
        delete(account)
        var q = query(account)
        q[kSecValueData as String] = data
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(q as CFDictionary, nil)
    }

    func delete(_ account: String) {
        SecItemDelete(query(account) as CFDictionary)
    }
}
