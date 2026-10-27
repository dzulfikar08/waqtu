//
//  MutabaahSyncController.swift
//  waqtu
//
//  Owns the Mac's mutabaah checklist (the replica: every item, the `items` list) and keeps it,
//  the prayer log and the prayer preferences in step with the signed-in account over /v1/sync.
//  Edits are recorded in the replica the moment they happen (signed in or not) and uploaded
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
    /// Checklist entries, the item list or the streak settings (the streak may have moved).
    var checklist = false
}

@Observable
final class MutabaahSyncController {
    private(set) var status: SyncStatus = .idle
    private(set) var lastSyncAt: Date?
    /// Bumped whenever the replica's checklist rows change (local edit or pull); views read it so
    /// they redraw, since the replica itself is not observable.
    private(set) var revision = 0

    private let account: WaqtuAccount
    private let streakManager: PrayerStreakManager
    private let settings: AppSettings
    let replica: MutabaahReplica
    @ObservationIgnored var onRemoteChanges: ((RemoteChanges) -> Void)?
    /// Called after a checklist edit made on this Mac (entries or the item list).
    @ObservationIgnored var onLocalChecklistChange: (() -> Void)?

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

        // The replica is the checklist's store, signed in or not: bring in prayer-log rows it has
        // not seen (logged before this version, or before the first sign-in).
        if LogSync.reconcile(log: streakManager.entries, cleared: streakManager.clearedAt, into: replica) > 0 {
            revision += 1
        }

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
        guard LogSync.record(change, in: replica) else { return }
        revision += 1
        scheduleSync()
    }

    // MARK: - Checklist

    var items: [ItemDef] { MutabaahChecklist.items(in: replica) }

    func value(date: String, itemId: String) -> Int {
        MutabaahChecklist.value(date: date, itemId: itemId, in: replica)
    }

    /// A fardh chip on the checklist; the prayer log follows so the overlay and widgets agree.
    func applyFardh(_ action: FardhAction, fardh: Fardh, date: String) {
        let now = FardhMapping.millis(Date())
        guard let change = MutabaahChecklist.applyFardh(action, fardh: fardh, date: date, in: replica, at: now) else { return }
        streakManager.applyRemote(change)
        localEdit()
    }

    func toggleCheck(itemId: String, date: String) {
        if MutabaahChecklist.toggleCheck(itemId: itemId, date: date, in: replica, at: FardhMapping.millis(Date())) {
            localEdit()
        }
    }

    /// Ticks or unticks a `check` item without toggling it.
    func setCheck(_ on: Bool, itemId: String, date: String) {
        if MutabaahChecklist.setCheck(on, itemId: itemId, date: date, in: replica, at: FardhMapping.millis(Date())) {
            localEdit()
        }
    }

    func setCount(_ count: Int, itemId: String, date: String) {
        if MutabaahChecklist.setCount(count, itemId: itemId, date: date, in: replica, at: FardhMapping.millis(Date())) {
            localEdit()
        }
    }

    func setItems(_ items: [ItemDef]) {
        if MutabaahChecklist.setItems(items, in: replica, at: FardhMapping.millis(Date())) {
            localEdit()
        }
    }

    // MARK: - Streak (same rules and inputs as the phone)

    /// Today's day key on this Mac.
    var today: String { FardhMapping.dayKey(for: Date()) }

    var streak: StreakResult { MutabaahStreakModel.streak(today: today, in: replica) }

    var week: [MutabaahStreakModel.Day] { MutabaahStreakModel.week(today: today, in: replica) }

    var streakConfig: StreakConfig { MutabaahStreakModel.config(in: replica) }

    func setStreakConfig(_ config: StreakConfig) {
        if MutabaahStreakModel.setConfig(config, in: replica, at: FardhMapping.millis(Date())) {
            localEdit()
        }
    }

    /// A pause is running (an open range), as the phone's streak settings decide it.
    var pauseActive: Bool { streakConfig.pauses.contains { $0.to == nil } }

    /// Starts a pause (illness, travel, excuse) from today, or ends the running one: paused days
    /// neither count nor break the streak.
    func togglePause() {
        let config = streakConfig
        setStreakConfig(pauseActive
            ? MutabaahStreak.endPause(config, today: today)
            : MutabaahStreak.startPause(config, today: today))
    }

    private func localEdit() {
        revision += 1
        onLocalChecklistChange?()
        scheduleSync()
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
                revision += 1
                onRemoteChanges?(RemoteChanges(prayerLog: true, prayerSettings: false))
            }
            LogSync.reconcile(log: streakManager.entries, cleared: streakManager.clearedAt, into: replica)
            streakManager.clearHandedOverMarks()

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
        // Launch, foreground and periodic syncs also pick up a subscription bought on the phone.
        await account.refreshEntitlement()
    }

    /// Writes what a pull brought into the prayer log and the prayer preferences.
    private func merge(_ changes: inout RemoteChanges, _ report: SyncReport) {
        let checklistKeys: Set<String> = [MutabaahSettingKey.items, MutabaahSettingKey.streak]
        if !report.pulledEntries.isEmpty || report.pulledSettings.contains(where: { checklistKeys.contains($0.key) }) {
            revision += 1
            changes.checklist = true
        }
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
