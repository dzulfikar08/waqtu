//
//  IbadahModel.swift
//  waqtu
//
//  The Ibadah window's state (apps/mobile/src/ibadah): the tool shown, today's reader counters,
//  doa favourites, the tasbih count and the muhasabah journal. Device-local state lives in
//  IbadahStore and MuhasabahStore; the only thing that reaches the account is the mutabaah tick
//  of a finished dzikir session (`dzikir_pagi` / `dzikir_petang`) and a tasbih count added to one
//  of the user's own counters, both written through the sync controller like the phone does.
//

import AppKit
import Foundation
import Observation

@MainActor
@Observable
final class IbadahModel {
    enum Tool: String, CaseIterable, Identifiable {
        case qibla, matsurat, dzikir, doa, tasbih, muhasabah

        var id: String { rawValue }

        var title: String {
            switch self {
            case .qibla: return istr("ibadah.qibla.title")
            case .matsurat: return istr("ibadah.matsurat.title")
            case .dzikir: return istr("ibadah.dzikir.title")
            case .doa: return istr("ibadah.doa.title")
            case .tasbih: return istr("ibadah.tasbih.title")
            case .muhasabah: return istr("ibadah.muhasabah.title")
            }
        }

        var systemImage: String {
            switch self {
            case .qibla: return "location.north.circle"
            case .matsurat: return "book"
            case .dzikir: return "sun.and.horizon"
            case .doa: return "heart"
            case .tasbih: return "circle.dotted"
            case .muhasabah: return "square.and.pencil"
            }
        }
    }

    let viewModel: AppViewModel
    var selectedTool: Tool? = .dzikir
    /// Al-Ma'tsurat version and time of day; nil time follows the part of the day.
    var matsuratKind: MatsuratKind = .sughro
    var matsuratTime: ReaderTime?
    var dzikirTime: ReaderTime?

    private(set) var today: String
    private(set) var suggestedTime: ReaderTime = .pagi
    private(set) var counts: [ReaderSessionID: ReaderCounts] = [:]
    private(set) var readerView: ReaderView
    private(set) var favourites: Set<String>
    private(set) var tasbih: TasbihState
    /// Bumped on every journal change, so the views redraw (the store is not observable).
    private(set) var journalVersion = 0

    @ObservationIgnored private let store: IbadahStore
    @ObservationIgnored let journal: MuhasabahStore

    init(viewModel: AppViewModel, store: IbadahStore, journal: MuhasabahStore) {
        self.viewModel = viewModel
        self.store = store
        self.journal = journal
        today = FardhMapping.dayKey(for: Date())
        readerView = ReaderView.parse(store.value(ReaderView.key))
        favourites = IbadahDoa.parseFavourites(store.value(IbadahDoa.favouritesKey))
        tasbih = Tasbih.parse(store.value(Tasbih.key))
        loadProgress()
        refresh()
    }

    var sync: MutabaahSyncController { viewModel.syncController }

    // MARK: - Day

    /// Re-reads the day and the part of the day (window shown, app active).
    func refresh() {
        let now = Date()
        suggestedTime = IbadahReader.suggestTime(marks: dayMarks(), now: now)
        let key = FardhMapping.dayKey(for: now)
        if key != today {
            today = key
            loadProgress()
        }
    }

    /// When each part of the day began today, from the prayer times the menu bar shows.
    private func dayMarks() -> [(period: DayPeriod, at: Date)] {
        viewModel.todayPrayers.map { prayer in
            let period: DayPeriod
            switch prayer.name {
            case .fajr: period = .fajr
            case .dhuhr: period = .dhuhr
            case .asr: period = .asr
            case .maghrib: period = .maghrib
            case .isha: period = .isha
            }
            return (period, prayer.time)
        }
    }

    private func loadProgress() {
        var loaded: [ReaderSessionID: ReaderCounts] = [:]
        for id in ReaderSessionID.allCases {
            loaded[id] = IbadahReader.parseProgress(store.value(IbadahReader.progressKey(id)), today: today)
        }
        counts = loaded
    }

    // MARK: - Reader

    func readerCounts(for id: ReaderSessionID) -> ReaderCounts { counts[id] ?? [:] }

    private func setCounts(_ next: ReaderCounts, for id: ReaderSessionID) {
        counts[id] = next
        store.set(IbadahReader.progressKey(id), IbadahReader.serializeProgress(next, today: today))
    }

    /// One recitation counted on item `index`. True when this tap finished the item.
    @discardableResult
    func tap(_ session: ReaderSession, index: Int) -> Bool {
        guard session.items.indices.contains(index) else { return false }
        let item = session.items[index]
        let before = readerCounts(for: session.id)
        let after = IbadahReader.tap(before, item)
        guard after != before else { return false }
        setCounts(after, for: session.id)
        return IbadahReader.isItemDone(after, item)
    }

    func reset(_ session: ReaderSession, index: Int) {
        guard session.items.indices.contains(index) else { return }
        setCounts(IbadahReader.reset(readerCounts(for: session.id), session.items[index]), for: session.id)
    }

    func restart(_ session: ReaderSession) {
        setCounts([:], for: session.id)
    }

    func setReaderView(_ view: ReaderView) {
        readerView = view
        store.set(ReaderView.key, view.serialized())
    }

    // MARK: - Mutabaah tick of a finished dzikir

    /// The checklist item of a morning or evening session, when it is on the user's checklist.
    func checklistItem(for time: ReaderTime) -> ItemDef? {
        let id = IbadahReader.mutabaahItem(for: time)
        return sync.items.first { $0.id == id }
    }

    func isTicked(_ time: ReaderTime) -> Bool {
        sync.value(date: today, itemId: IbadahReader.mutabaahItem(for: time)) > 0
    }

    /// Ticks today's morning or evening dzikir in the mutabaah checklist; it syncs to the account.
    func tick(_ time: ReaderTime) {
        sync.setCheck(true, itemId: IbadahReader.mutabaahItem(for: time), date: today)
    }

    // MARK: - Doa

    func toggleFavourite(_ id: String) {
        favourites = IbadahDoa.toggleFavourite(favourites, id)
        store.set(IbadahDoa.favouritesKey, IbadahDoa.serializeFavourites(favourites))
    }

    // MARK: - Tasbih

    var tasbihPhases: [TasbihPhase] {
        (try? Tasbih.phases(tasbih.preset, phrases: IbadahLibrary.phrases, customTarget: tasbih.customTarget)) ?? []
    }

    private func setTasbih(_ next: TasbihState) {
        tasbih = next
        store.set(Tasbih.key, Tasbih.serialize(next))
    }

    func tasbihTap() {
        let phases = tasbihPhases
        guard !phases.isEmpty else { return }
        let result = Tasbih.tap(tasbih, phases: phases)
        setTasbih(result.state)
        guard tasbih.feedback else { return }
        // Trackpad haptics: a firmer tick at the end of a part and of a round.
        NSHapticFeedbackManager.defaultPerformer.perform(
            result.event == .tick ? .alignment : .levelChange, performanceTime: .now)
    }

    func tasbihUndo() { setTasbih(Tasbih.undo(tasbih)) }
    func tasbihReset() { setTasbih(Tasbih.reset(tasbih)) }
    func tasbihChoose(_ preset: TasbihPreset) { setTasbih(Tasbih.choosePreset(tasbih, preset)) }
    func tasbihSetTarget(_ target: Int) { setTasbih(Tasbih.setCustomTarget(tasbih, target)) }

    func tasbihSetFeedback(_ on: Bool) {
        var next = tasbih
        next.feedback = on
        setTasbih(next)
    }

    func tasbihLink(_ itemId: String?) {
        var next = tasbih
        next.linkedItem = itemId
        setTasbih(next)
    }

    /// Adds the count to today's value of the linked counter and starts the count again.
    /// Returns the item and the count that was added, nil when there is nothing to add.
    func tasbihRecord() -> (item: ItemDef, count: Int)? {
        guard let item = Tasbih.linkedItem(of: tasbih, in: sync.items), tasbih.count > 0 else { return nil }
        let count = tasbih.count
        let current = sync.value(date: today, itemId: item.id)
        sync.setCount(Tasbih.addedCount(current: current, count: count), itemId: item.id, date: today)
        setTasbih(Tasbih.reset(tasbih))
        return (item, count)
    }

    // MARK: - Muhasabah

    func journalEntry(_ date: String) -> MuhasabahEntry? { journal.entry(date) }

    @discardableResult
    func saveJournal(_ entry: MuhasabahEntry) -> MuhasabahEntry? {
        let kept = journal.save(entry, now: FardhMapping.millis(Date()))
        journalVersion += 1
        return kept
    }

    func deleteJournal(_ date: String) {
        journal.delete(date)
        journalVersion += 1
    }
}
