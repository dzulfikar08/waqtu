//
//  TrialManager.swift
//  waqtu
//
//  Direct-download (Developer ID) build only: 7-day free trial stored in Keychain (persists across
//  app reinstalls). Uses kSecClassGenericPassword; stores firstLaunchDate and trialUsed.
//  The Mac App Store build has no local trial: its free trial is the subscription's introductory
//  offer (MacStoreSubscription).
//

#if !MAS
import Foundation
import Security

/// Manages 7-day free trial state in Keychain so it persists across reinstalls.
@Observable
final class TrialManager {
    static let trialDurationDays: Int = 7

    private let keychainService: String
    private let firstLaunchDateAccount = "firstLaunchDate"
    private let trialUsedAccount = "trialUsed"

    /// First launch date of the trial (set on first run, stored in Keychain).
    private(set) var firstLaunchDate: Date?

    /// Whether the user has already used their trial (e.g. after purchase or explicit mark).
    private(set) var trialUsed: Bool = false

    init(bundleIdentifier: String = Bundle.main.bundleIdentifier ?? "dat.waqtu") {
        self.keychainService = "\(bundleIdentifier).trial"
        loadFromKeychain()
        if firstLaunchDate == nil {
            recordFirstLaunch()
        }
    }

    /// Trial is active if not marked used and within 7 days of first launch.
    var isTrialActive: Bool {
        guard !trialUsed, let start = firstLaunchDate else { return false }
        let end = Calendar.current.date(byAdding: .day, value: Self.trialDurationDays, to: start) ?? start
        return Date() < end
    }

    /// Full access: either trial active or trial was used (e.g. purchased).
    var hasAccess: Bool {
        isTrialActive || trialUsed
    }

    /// Number of calendar days remaining in trial (0 if expired or not active).
    var trialDaysRemaining: Int {
        guard isTrialActive, let start = firstLaunchDate else { return 0 }
        let end = Calendar.current.date(byAdding: .day, value: Self.trialDurationDays, to: start) ?? start
        let remaining = Calendar.current.dateComponents([.day], from: Date(), to: end).day ?? 0
        return max(0, remaining)
    }

    /// Mark trial as used (e.g. after purchase). Persists to Keychain.
    func markTrialUsed() {
        trialUsed = true
        saveTrialUsedToKeychain(true)
    }

    // MARK: - Trial ending soon modal (show once per day when 1 day left)
    private static let trialEndingSoonLastShownKey = "trialEndingSoonLastShownDay"

    /// True when 1 day remaining and we haven’t shown the “Trial ending soon” modal today.
    var shouldShowTrialEndingSoonModal: Bool {
        guard trialDaysRemaining == 1 else { return false }
        let today = Calendar.current.startOfDay(for: Date())
        let lastShown = UserDefaults.standard.object(forKey: Self.trialEndingSoonLastShownKey) as? Date
        guard let last = lastShown else { return true }
        return Calendar.current.isDate(last, inSameDayAs: today) == false
    }

    /// Call when the user dismisses the “Trial ending soon” modal.
    func recordTrialEndingSoonModalShown() {
        UserDefaults.standard.set(Calendar.current.startOfDay(for: Date()), forKey: Self.trialEndingSoonLastShownKey)
    }

    // MARK: - Keychain (kSecClassGenericPassword)

    private func loadFromKeychain() {
        firstLaunchDate = readFirstLaunchDateFromKeychain()
        trialUsed = readTrialUsedFromKeychain()
    }

    private func recordFirstLaunch() {
        let now = Date()
        firstLaunchDate = now
        saveFirstLaunchDateToKeychain(now)
        saveTrialUsedToKeychain(false)
    }

    private func saveFirstLaunchDateToKeychain(_ date: Date) {
        let value = String(date.timeIntervalSince1970)
        guard let data = value.data(using: .utf8) else { return }
        deleteKeychainItem(account: firstLaunchDateAccount)
        addKeychainItem(account: firstLaunchDateAccount, value: data)
    }

    private func readFirstLaunchDateFromKeychain() -> Date? {
        guard let data = readKeychainItem(account: firstLaunchDateAccount),
              let string = String(data: data, encoding: .utf8),
              let interval = TimeInterval(string) else { return nil }
        return Date(timeIntervalSince1970: interval)
    }

    private func saveTrialUsedToKeychain(_ used: Bool) {
        let value = used ? "1" : "0"
        guard let data = value.data(using: .utf8) else { return }
        deleteKeychainItem(account: trialUsedAccount)
        addKeychainItem(account: trialUsedAccount, value: data)
    }

    private func readTrialUsedFromKeychain() -> Bool {
        guard let data = readKeychainItem(account: trialUsedAccount),
              let string = String(data: data, encoding: .utf8) else { return false }
        return string == "1"
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
#endif
