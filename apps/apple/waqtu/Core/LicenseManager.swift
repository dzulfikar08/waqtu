//
//  LicenseManager.swift
//  waqtu
//
//  Two licensing backends selected at compile time:
//   - MAS build (Mac App Store): StoreKit 2 non-consumable IAP.
//   - Direct-distribution build: Polar.sh license key (activate/validate).
//

import Foundation
import Security

enum LicenseError: Error {
    case message(String)
}

#if MAS
import StoreKit

/// Mac App Store licensing via StoreKit 2 non-consumable in-app purchase.
/// Entitlement is owned by the App Store; nothing is persisted locally.
/// Non-isolated to stay call-site compatible with the direct-distribution backend;
/// the observable `isLicensed` is only mutated on the main actor.
@Observable
final class LicenseManager: @unchecked Sendable {
    /// App Store Connect product identifier for the lifetime unlock.
    static let lifetimeProductID = "dat.waqtu.lifetime"

    private(set) var isLicensed: Bool = false
    private var transactionListener: Task<Void, Never>?

    init(bundleIdentifier: String = Bundle.main.bundleIdentifier ?? "dat.waqtu") {
        transactionListener = listenForTransactions()
        Task { await refreshEntitlement() }
    }

    deinit { transactionListener?.cancel() }

    /// Presents the App Store purchase sheet for lifetime access.
    func purchase() async -> Result<Void, LicenseError> {
        do {
            let products = try await Product.products(for: [Self.lifetimeProductID])
            guard let product = products.first else {
                return .failure(.message("Purchase unavailable right now."))
            }
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                let transaction = try checkVerified(verification)
                await refreshEntitlement()
                await transaction.finish()
                return .success(())
            case .userCancelled:
                return .failure(.message("Purchase cancelled."))
            case .pending:
                return .failure(.message("Purchase pending approval."))
            @unknown default:
                return .failure(.message("Unknown purchase result."))
            }
        } catch {
            return .failure(.message(error.localizedDescription))
        }
    }

    /// Restores prior purchases (signed in with the same Apple ID). Also called on launch.
    func restore() async {
        try? await AppStore.sync()
        await refreshEntitlement()
    }

    /// Mirrors the Polar backend's launch-time validation entry point.
    func validate() async {
        await refreshEntitlement()
    }

    private func refreshEntitlement() async {
        for await result in Transaction.currentEntitlements {
            if let transaction = try? checkVerified(result),
               transaction.productID == Self.lifetimeProductID {
                await markLicensed(true)
                return
            }
        }
        await markLicensed(false)
    }

    private func listenForTransactions() -> Task<Void, Never> {
        Task.detached { [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                if let transaction = try? self.checkVerified(result),
                   transaction.productID == Self.lifetimeProductID {
                    await self.markLicensed(true)
                    await transaction.finish()
                }
            }
        }
    }

    @MainActor
    private func markLicensed(_ value: Bool) { isLicensed = value }

    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value):
            return value
        case .unverified:
            throw LicenseError.message("StoreKit transaction verification failed.")
        }
    }
}
#else
/// Direct-distribution licensing via Polar.sh (license key activate/validate).
/// Excluded from the Mac App Store build (App Store requires In-App Purchase).
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
#endif
