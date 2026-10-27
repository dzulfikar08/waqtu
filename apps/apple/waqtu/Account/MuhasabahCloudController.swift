//
//  MuhasabahCloudController.swift
//  waqtu
//
//  Owns the muhasabah journal and the opt-in "Sync muhasabah to the cloud" setting. The journal
//  stays on this Mac; only after the user turns the setting on does it sync with the signed-in
//  account over /v1/muhasabah (so it follows them to the phone), and turning it off stops that at
//  once. The setting belongs to one account on this Mac: another account signing in finds it off.
//  Like the Mac's mutabaah sync it runs for any signed-in account (the trial included); the phone
//  gates the same feature behind Premium. State is only touched on the main thread.
//

import Foundation

@Observable
final class MuhasabahCloudController {
    enum Status: Equatable {
        case idle
        case syncing
        case ok
        case failed
    }

    private(set) var status: Status = .idle
    private(set) var lastSyncAt: Date?
    /// The account the cloud copy is turned on for; nil when it is off. Mirrors the stored setting
    /// so that views redraw when it changes.
    private(set) var enabledUserId: String?
    /// Bumped whenever a pull changed the journal, so open views redraw.
    private(set) var revision = 0

    /// The journal itself, shared by the Ibadah window and the sync.
    let store: MuhasabahStore
    private let prefs: MuhasabahCloudPrefs
    private let account: WaqtuAccount

    @ObservationIgnored private var running: Task<Void, Never>?
    @ObservationIgnored private var pendingRerun = false
    @ObservationIgnored private var debounce: Task<Void, Never>?

    init(
        account: WaqtuAccount,
        store: MuhasabahStore = MuhasabahStore(fileURL: MuhasabahStore.defaultFileURL()),
        prefs: MuhasabahCloudPrefs = MuhasabahCloudPrefs(fileURL: MuhasabahCloudPrefs.defaultFileURL())
    ) {
        self.account = account
        self.store = store
        self.prefs = prefs
        self.enabledUserId = prefs.userId
    }

    deinit {
        debounce?.cancel()
    }

    /// The cloud copy is on for the signed-in account.
    var isEnabled: Bool {
        guard let id = account.user?.id else { return false }
        return enabledUserId == id
    }

    /// Turns the cloud copy on (the whole journal goes up, and what the account already holds
    /// comes down) or off (syncing stops; nothing is deleted anywhere).
    @MainActor
    func setEnabled(_ on: Bool) {
        guard let user = account.user else { return }
        if on {
            guard !prefs.isEnabled(for: user.id) else { return }
            prefs.enable(for: user.id)
            store.markAllDirty()
            enabledUserId = user.id
            Task { @MainActor in await self.syncNow() }
        } else {
            guard prefs.isEnabled(for: user.id) else { return }
            prefs.disable()
            enabledUserId = nil
            debounce?.cancel()
            status = .idle
        }
    }

    /// Deletes the account's cloud journal (every device's copy on the server). The entries on
    /// this Mac stay. Waits for a running pass first, so that it cannot upload the days again.
    /// True when the server confirmed.
    @MainActor
    func deleteCloudCopy() async -> Bool {
        guard let token = account.token else { return false }
        await running?.value
        do {
            try await HTTPMuhasabahTransport(client: account.api, token: token).deleteCloudCopy()
            return true
        } catch {
            if isUnauthorized(error) { account.sessionExpired() }
            return false
        }
    }

    /// The journal changed on this Mac: upload it shortly, when the cloud copy is on.
    @MainActor
    func journalChanged() {
        guard isEnabled else { return }
        debounce?.cancel()
        debounce = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            guard !Task.isCancelled else { return }
            await self?.syncNow()
        }
    }

    /// One pass when the cloud copy is on for the signed-in account. Concurrent calls fold into the
    /// running pass, which repeats once. Never throws: failures show as `.failed` and retry on the
    /// next trigger (the checklist sync's passes, edits, turning the setting on).
    @MainActor
    func syncNow() async {
        guard let user = account.user, prefs.isEnabled(for: user.id) else { return }
        if running != nil {
            pendingRerun = true
            return
        }
        let task = Task { @MainActor [weak self] in
            guard let self else { return }
            repeat {
                self.pendingRerun = false
                await self.performSync()
            } while self.pendingRerun
            self.running = nil
        }
        running = task
        await task.value
    }

    @MainActor
    private func performSync() async {
        guard let token = account.token, let user = account.user, prefs.isEnabled(for: user.id) else { return }
        status = .syncing
        let transport = HTTPMuhasabahTransport(client: account.api, token: token)
        do {
            let report = try await runMuhasabahSync(
                store: store,
                prefs: prefs,
                transport: transport,
                isActive: { [prefs] in prefs.isEnabled(for: user.id) }
            )
            if report.pulled > 0 { revision += 1 }
            if prefs.isEnabled(for: user.id) {
                lastSyncAt = Date()
                status = .ok
            } else {
                status = .idle
            }
        } catch {
            if isUnauthorized(error) {
                status = .idle
                account.sessionExpired()
            } else {
                status = .failed
            }
        }
    }
}
