//
//  MutabaahSyncController.swift
//  waqtu
//
//  Keeps the Mac's prayer log and prayer preferences in step with the signed-in account over
//  /v1/sync. Prayer log edits are recorded in the replica the moment they happen and uploaded
//  shortly after; the account's changes are merged last-write-wins and written back to the log
//  and to the prayer settings. Location is never part of the sync.
//  State is only touched on the main thread; `syncNow` is main-actor.
//

import Foundation
import AppKit

enum SyncStatus: Equatable {
    case idle
    case syncing
    case ok
    case failed
}

/// What a pull changed on this Mac, so the caller can refresh what depends on it.
struct RemoteChanges: Equatable {
    var prayerLog = false
    var prayerSettings = false
}

@Observable
final class MutabaahSyncController {
    private(set) var status: SyncStatus = .idle
    private(set) var lastSyncAt: Date?

    private let account: WaqtuAccount
    private let streakManager: PrayerStreakManager
    private let settings: AppSettings
    let replica: MutabaahReplica
    @ObservationIgnored var onRemoteChanges: ((RemoteChanges) -> Void)?

    @ObservationIgnored private var inFlight = false
    @ObservationIgnored private var pendingRerun = false
    @ObservationIgnored private var lastAttempt: Date?
    @ObservationIgnored private var debounce: Task<Void, Never>?
    @ObservationIgnored private var periodic: Timer?

    /// Foreground syncs closer together than this are skipped.
    private static let minInterval: TimeInterval = 30
    private static let periodicInterval: TimeInterval = 5 * 60

    init(
        account: WaqtuAccount,
        streakManager: PrayerStreakManager,
        settings: AppSettings,
        replica: MutabaahReplica = MutabaahReplica(fileURL: MutabaahReplica.defaultFileURL())
    ) {
        self.account = account
        self.streakManager = streakManager
        self.settings = settings
        self.replica = replica

        streakManager.onLocalChange = { [weak self] change in self?.recordLocal(change) }
        account.onSessionChange = { [weak self] in self?.sessionChanged() }

        NotificationCenter.default.addObserver(
            forName: Notification.Name("prayerTimeSettingsChanged"), object: nil, queue: .main
        ) { [weak self] _ in self?.prayerSettingsEdited() }
        NotificationCenter.default.addObserver(
            forName: NSApplication.didBecomeActiveNotification, object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in await self?.syncNow() }
        }
        periodic = Timer.scheduledTimer(withTimeInterval: Self.periodicInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in await self?.syncNow() }
        }

        if account.isSignedIn {
            Task { @MainActor in await self.syncNow(force: true) }
        }
    }

    deinit {
        periodic?.invalidate()
        debounce?.cancel()
    }

    /// Moon-sighting correction the account carries (days); 0 when there is none.
    var hijriOffset: Int {
        SettingsSyncMapping.hijriOffset(from: replica.settingValue("hijriOffset"))
    }

    // MARK: - Local edits

    private func recordLocal(_ change: PrayerLogChange) {
        guard account.isSignedIn else { return }
        if LogSync.record(change, in: replica) { scheduleSync() }
    }

    private func prayerSettingsEdited() {
        guard account.isSignedIn else { return }
        if queueLocalSettings(explicitChange: true) > 0 { scheduleSync() }
    }

    private func sessionChanged() {
        debounce?.cancel()
        if account.isSignedIn {
            Task { @MainActor in await self.syncNow(force: true) }
        } else {
            status = .idle
        }
    }

    private func scheduleSync() {
        debounce?.cancel()
        debounce = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            guard !Task.isCancelled else { return }
            await self?.syncNow(force: true)
        }
    }

    // MARK: - Sync

    /// One sync pass for the signed-in user. Concurrent calls fold into the running pass (which
    /// repeats once if edits arrived meanwhile); `force` skips the minimum interval. Never throws:
    /// failures show as `.failed` and retry on the next trigger.
    @MainActor
    func syncNow(force: Bool = false) async {
        guard account.isSignedIn else { return }
        if inFlight {
            pendingRerun = true
            return
        }
        if !force, let last = lastAttempt, Date().timeIntervalSince(last) < Self.minInterval { return }
        inFlight = true
        repeat {
            pendingRerun = false
            lastAttempt = Date()
            await performSync()
        } while pendingRerun && account.isSignedIn
        inFlight = false
    }

    @MainActor
    private func performSync() async {
        guard let token = account.token, let user = account.user else { return }
        status = .syncing
        do {
            if replica.prepareAccount(userId: user.id) == .replaced {
                // Another account's log must not be uploaded to this one.
                streakManager.resetAll()
                onRemoteChanges?(RemoteChanges(prayerLog: true, prayerSettings: false))
            }
            LogSync.reconcile(log: streakManager.entries, into: replica)

            let transport = HTTPSyncTransport(client: account.api, token: token)
            var changes = RemoteChanges()
            let firstPass = try await runSync(store: replica, transport: transport)
            merge(&changes, firstPass)

            // Preferences the account has no value for yet are seeded from this Mac after the
            // pull, so defaults never overwrite what the server just handed over.
            if queueLocalSettings(explicitChange: false) > 0 || replica.hasDirtyRows {
                let secondPass = try await runSync(store: replica, transport: transport)
                merge(&changes, secondPass)
            }
            if changes != RemoteChanges() { onRemoteChanges?(changes) }
            lastSyncAt = Date()
            status = .ok
        } catch {
            if isUnauthorized(error) {
                status = .idle
                account.sessionExpired()
            } else {
                status = .failed
            }
        }
    }

    /// Writes what a pull brought into the prayer log and the prayer preferences.
    private func merge(_ changes: inout RemoteChanges, _ report: SyncReport) {
        for entry in report.pulledEntries {
            if let change = FardhMapping.change(for: entry) {
                streakManager.applyRemote(change)
                changes.prayerLog = true
            }
        }
        if !report.pulledSettings.isEmpty {
            var prefs = currentPrefs()
            if SettingsSyncMapping.apply(report.pulledSettings, to: &prefs) { write(prefs) }
            // The moon-sighting correction also moves the Ramadhan dates.
            changes.prayerSettings = true
        }
    }

    // MARK: - Prayer preferences

    private func currentPrefs() -> PrayerPrefs {
        PrayerPrefs(
            calculationMethod: settings.calculationMethod,
            madhab: settings.madhab,
            adjustments: [
                "fajr": settings.adjustmentFajr,
                "sunrise": settings.adjustmentSunrise,
                "dhuhr": settings.adjustmentDhuhr,
                "asr": settings.adjustmentAsr,
                "maghrib": settings.adjustmentMaghrib,
                "isha": settings.adjustmentIsha,
            ]
        )
    }

    /// Stores only the preferences that differ, so untouched ones keep their side effects quiet.
    private func write(_ prefs: PrayerPrefs) {
        if settings.calculationMethod != prefs.calculationMethod { settings.calculationMethod = prefs.calculationMethod }
        if settings.madhab != prefs.madhab { settings.madhab = prefs.madhab }
        if settings.adjustmentFajr != prefs.adjustment("fajr") { settings.adjustmentFajr = prefs.adjustment("fajr") }
        if settings.adjustmentSunrise != prefs.adjustment("sunrise") { settings.adjustmentSunrise = prefs.adjustment("sunrise") }
        if settings.adjustmentDhuhr != prefs.adjustment("dhuhr") { settings.adjustmentDhuhr = prefs.adjustment("dhuhr") }
        if settings.adjustmentAsr != prefs.adjustment("asr") { settings.adjustmentAsr = prefs.adjustment("asr") }
        if settings.adjustmentMaghrib != prefs.adjustment("maghrib") { settings.adjustmentMaghrib = prefs.adjustment("maghrib") }
        if settings.adjustmentIsha != prefs.adjustment("isha") { settings.adjustmentIsha = prefs.adjustment("isha") }
    }

    /// Queues the Mac's whitelisted preferences that the replica does not match. Returns the count.
    private func queueLocalSettings(explicitChange: Bool) -> Int {
        let pending = SettingsSyncMapping.pending(
            prefs: currentPrefs(),
            stored: { [replica] key in replica.settingValue(key) },
            explicitChange: explicitChange
        )
        let now = FardhMapping.millis(Date())
        var queued = 0
        for item in pending {
            if replica.recordLocalSetting(key: item.key, value: item.value, at: now) { queued += 1 }
        }
        return queued
    }
}
