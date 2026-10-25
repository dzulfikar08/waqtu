//
//  HalaqahModel.swift
//  waqtu
//
//  The halaqah window's state: the bundled program, today's position in it and the device-local
//  progress. Marking a day done writes the `halaqah` mutabaah entry to the sync replica (like
//  mobile's completeDay) and asks the sync controller to upload it.
//

import Foundation
import Observation

@MainActor
@Observable
final class HalaqahModel {
    let program: HalaqahProgram
    private(set) var progress: [Int: String] = [:]
    private(set) var today = CivilDay(Date())
    var selectedDay: Int?

    @ObservationIgnored private let store: HalaqahStore
    @ObservationIgnored private let sync: MutabaahSyncController

    init(program: HalaqahProgram, store: HalaqahStore, sync: MutabaahSyncController) {
        self.program = program
        self.store = store
        self.sync = sync
        progress = store.progress(programId: program.id)
        selectedDay = position.todayDay
            ?? HalaqahProgram.nextUncompletedDay(done: Set(progress.keys), totalDays: program.totalDays)
            ?? 1
    }

    // MARK: - Bundled program

    /// The program shipped in the app (content/halaqah/ramadhan-1448/program.json, copied as a
    /// bundle resource), parsed once. Nil when it is missing or invalid.
    static let bundled: HalaqahProgram? = {
        guard let url = Bundle.main.url(forResource: "program", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? HalaqahProgram.parse(data)
    }()

    /// Whether the halaqah may be shown in this build: approved content, or any content in a debug build.
    static var isAvailable: Bool {
        guard let program = bundled else { return false }
        return HalaqahProgram.isReleasable(status: program.status, dev: ModuleLocale.isDevBuild)
    }

    // MARK: - State

    var position: HalaqahPosition {
        HalaqahPosition.of(
            today: today, hijriOffset: sync.hijriOffset,
            hijriYear: program.hijriYear, totalDays: program.totalDays)
    }

    var doneDays: Set<Int> { Set(progress.keys) }

    var nextDay: Int? {
        HalaqahProgram.nextUncompletedDay(done: doneDays, totalDays: program.totalDays)
    }

    func refreshToday() {
        let now = CivilDay(Date())
        if now != today { today = now }
        progress = store.progress(programId: program.id)
    }

    func isDone(_ day: Int) -> Bool { progress[day] != nil }

    /// Marks the day done on today's civil day, or undoes it.
    func toggleDone(_ day: Int) {
        refreshToday()
        let now = FardhMapping.millis(Date())
        let changed = isDone(day)
            ? store.uncompleteDay(programId: program.id, day: day, writer: sync.replica, at: now)
            : store.completeDay(programId: program.id, day: day, completedOn: today.key, writer: sync.replica, at: now)
        progress = store.progress(programId: program.id)
        if changed {
            Task { await sync.syncNow(force: true) }
        }
    }

    func reflection(_ day: Int) -> String {
        store.reflection(programId: program.id, day: day)
    }

    func saveReflection(_ day: Int, text: String) {
        store.saveReflection(programId: program.id, day: day, text: text)
    }
}
