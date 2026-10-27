//
//  MutabaahChecklist.swift
//  waqtu
//
//  The full mutabaah checklist on the Mac, stored in the account replica exactly as the phone
//  stores it (apps/mobile/src/mutabaah/items.ts): the item list is the `items` setting (same JSON),
//  and each (day, item) entry is an integer: fardh bit flags, check 0/1, count n. Works signed out
//  too; the rows are uploaded on the first sign-in.
//

import Foundation

enum MutabaahChecklist {
    /// The user's checklist; the default items when the account has none stored.
    static func items(in replica: MutabaahReplica) -> [ItemDef] {
        MutabaahItems.parseItems(replica.settingValue(MutabaahSettingKey.items))
    }

    /// Stores an edited list (add, remove). Returns false when nothing changed.
    @discardableResult
    static func setItems(_ items: [ItemDef], in replica: MutabaahReplica, at: Int64) -> Bool {
        replica.recordLocalSetting(
            key: MutabaahSettingKey.items, value: MutabaahItems.serializeItems(items), at: at)
    }

    /// Recorded value of an item on a day; 0 when nothing is recorded.
    static func value(date: String, itemId: String, in replica: MutabaahReplica) -> Int {
        replica.entryValue(date: date, itemId: itemId) ?? 0
    }

    /// Applies a fardh chip tap (`MutabaahItems.toggleFardh`). Returns the prayer-log edit that keeps
    /// the Mac's prayer log in step, or nil when the value did not change.
    static func applyFardh(
        _ action: FardhAction, fardh: Fardh, date: String, in replica: MutabaahReplica, at: Int64
    ) -> PrayerLogChange? {
        let next = MutabaahItems.toggleFardh(value(date: date, itemId: fardh.rawValue, in: replica), action)
        guard replica.recordLocalEntry(date: date, itemId: fardh.rawValue, value: next, at: at) else { return nil }
        return PrayerLogChange(
            date: date,
            prayer: fardh.logName,
            status: FardhMapping.status(forValue: next),
            at: FardhMapping.date(fromMillis: at))
    }

    /// Ticks or unticks a `check` item.
    @discardableResult
    static func toggleCheck(itemId: String, date: String, in replica: MutabaahReplica, at: Int64) -> Bool {
        let next = value(date: date, itemId: itemId, in: replica) > 0 ? 0 : 1
        return replica.recordLocalEntry(date: date, itemId: itemId, value: next, at: at)
    }

    /// Sets a `check` item ticked or not, whatever it was (the Ibadah readers tick `dzikir_pagi` and
    /// `dzikir_petang` once a session is finished, like the phone's `setEntry(..., 1)`).
    @discardableResult
    static func setCheck(_ on: Bool, itemId: String, date: String, in replica: MutabaahReplica, at: Int64) -> Bool {
        replica.recordLocalEntry(date: date, itemId: itemId, value: on ? 1 : 0, at: at)
    }

    /// Sets a `count` item (pages of tilawah, ...), clamped to 0...`MutabaahItems.maxCount`.
    @discardableResult
    static func setCount(_ count: Int, itemId: String, date: String, in replica: MutabaahReplica, at: Int64) -> Bool {
        replica.recordLocalEntry(date: date, itemId: itemId, value: MutabaahItems.clampCount(count), at: at)
    }

    /// Items done on a day, out of the list (for the "3/12" header).
    static func doneCount(items: [ItemDef], date: String, in replica: MutabaahReplica) -> Int {
        items.filter { MutabaahItems.isDone($0.kind, value(date: date, itemId: $0.id, in: replica)) }.count
    }

    /// A fresh custom-item token: 10 base-36 characters, like the phone's (`c.` + token is the id).
    static func randomToken() -> String {
        let alphabet = Array("abcdefghijklmnopqrstuvwxyz0123456789")
        return String((0..<10).map { _ in alphabet.randomElement()! })
    }
}
