//
//  MutabaahChecklistView.swift
//  waqtu
//
//  Menu bar section: the full mutabaah checklist for a chosen day, the Mac twin of the phone's
//  Checklist (apps/mobile/src/components/today/Checklist.tsx). Fardhu are chips (click: prayed on
//  time; right-click: on time / in congregation / made up), check items tick, count items step.
//  Everything is stored in the account replica and syncs with the phone.
//

import SwiftUI

/// Display name of a checklist item: custom items carry their own label, built-ins are translated.
enum MutabaahItemLabel {
    static func text(_ item: ItemDef) -> String {
        if let label = item.label { return label }
        if let fardh = Fardh(rawValue: item.id), let name = PrayerName(rawValue: fardh.logName) {
            return name.displayName
        }
        switch item.id {
        case "rawatib": return String(localized: "Rawatib prayers")
        case "dhuha": return String(localized: "Dhuha prayer")
        case "tahajjud": return String(localized: "Tahajjud prayer")
        case "tilawah": return String(localized: "Qur'an recitation")
        case "dzikir_pagi": return String(localized: "Morning dhikr")
        case "dzikir_petang": return String(localized: "Evening dhikr")
        case "sedekah": return String(localized: "Charity")
        case "puasa": return String(localized: "Voluntary fasting")
        case "halaqah": return String(localized: "Ramadan halaqah")
        case "murojaah": return String(localized: "Hafalan review")
        default: return item.id
        }
    }
}

struct MutabaahChecklistView: View {
    let sync: MutabaahSyncController
    var onManage: () -> Void = {}

    @State private var day = Date()
    @State private var showDatePicker = false

    private var dayKey: String { FardhMapping.dayKey(for: day) }
    private var isToday: Bool { dayKey == FardhMapping.dayKey(for: Date()) }

    private var dayTitle: String {
        if isToday { return String(localized: "Today") }
        return day.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).locale(AppLanguage.locale))
    }

    var body: some View {
        // Reading `revision` makes the section redraw after any edit or pull.
        let _ = sync.revision
        let items = sync.items
        let fardhItems = items.filter { $0.kind == .fardh }
        let others = items.filter { $0.kind != .fardh }
        let done = items.filter { MutabaahItems.isDone($0.kind, sync.value(date: dayKey, itemId: $0.id)) }.count

        VStack(alignment: .leading, spacing: 8) {
            header(done: done, total: items.count)

            if items.isEmpty {
                Text("Your checklist is empty. Add practices in Settings.")
                    .font(.system(size: 11))
                    .foregroundColor(.waqtuMuted)
            }

            if !fardhItems.isEmpty {
                HStack(spacing: 6) {
                    ForEach(fardhItems, id: \.id) { item in
                        if let fardh = Fardh(rawValue: item.id) {
                            FardhChip(
                                name: MutabaahItemLabel.text(item),
                                value: sync.value(date: dayKey, itemId: item.id),
                                apply: { sync.applyFardh($0, fardh: fardh, date: dayKey) }
                            )
                        }
                    }
                }
            }

            ForEach(others, id: \.id) { item in
                if item.kind == .count {
                    CountRow(
                        name: MutabaahItemLabel.text(item),
                        value: sync.value(date: dayKey, itemId: item.id),
                        set: { sync.setCount($0, itemId: item.id, date: dayKey) }
                    )
                } else {
                    CheckRow(
                        name: MutabaahItemLabel.text(item),
                        done: sync.value(date: dayKey, itemId: item.id) > 0,
                        toggle: { sync.toggleCheck(itemId: item.id, date: dayKey) }
                    )
                }
            }

            Button(action: onManage) {
                Label("Manage checklist", systemImage: "slider.horizontal.3")
                    .font(.system(size: 11))
                    .foregroundColor(.waqtuPrimary)
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private func header(done: Int, total: Int) -> some View {
        HStack(spacing: 6) {
            Text("Mutabaah")
                .font(.system(size: 11))
                .foregroundColor(.waqtuMuted)
            Spacer()
            Button { shift(-1) } label: {
                Image(systemName: "chevron.left").font(.system(size: 10))
            }
            .buttonStyle(.plain)
            .foregroundColor(.waqtuMuted)
            .help(String(localized: "Previous day"))

            Button { showDatePicker.toggle() } label: {
                Text(dayTitle)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(isToday ? .waqtuText : .waqtuGold)
            }
            .buttonStyle(.plain)
            .help(String(localized: "Choose a day"))
            .popover(isPresented: $showDatePicker) {
                DatePicker("", selection: $day, in: ...Date(), displayedComponents: .date)
                    .datePickerStyle(.graphical)
                    .labelsHidden()
                    .environment(\.locale, AppLanguage.locale)
                    .padding()
            }

            Button { shift(1) } label: {
                Image(systemName: "chevron.right").font(.system(size: 10))
            }
            .buttonStyle(.plain)
            .foregroundColor(isToday ? .waqtuMuted.opacity(0.3) : .waqtuMuted)
            .disabled(isToday)
            .help(String(localized: "Next day"))

            Text(verbatim: "\(done)/\(total)")
                .font(.system(size: 11, weight: .semibold))
                .monospacedDigit()
                .foregroundColor(total > 0 && done == total ? .waqtuPrimary : .waqtuGold)
        }
    }

    private func shift(_ days: Int) {
        guard let next = FardhMapping.gregorian().date(byAdding: .day, value: days, to: day) else { return }
        day = min(next, Date())
    }
}

private struct FardhChip: View {
    let name: String
    let value: Int
    let apply: (FardhAction) -> Void
    @State private var isHovering = false

    private var done: Bool { value & FardhFlag.done != 0 }
    private var onTime: Bool { value & FardhFlag.onTime != 0 }
    private var jamaah: Bool { value & FardhFlag.jamaah != 0 }
    private var qadha: Bool { value & FardhFlag.qadha != 0 }

    var body: some View {
        Button { apply(.done) } label: {
            VStack(spacing: 3) {
                Image(systemName: done ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 16))
                    .foregroundColor(done ? (onTime ? .waqtuPrimary : .waqtuGold) : .waqtuMuted)
                Text(name)
                    .font(.system(size: 9, weight: .medium))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .foregroundColor(done ? .waqtuText : .waqtuMuted)
                HStack(spacing: 2) {
                    if jamaah { Image(systemName: "person.3.fill") }
                    if qadha { Image(systemName: "arrow.uturn.backward") }
                }
                .font(.system(size: 7))
                .foregroundColor(.waqtuGold)
                .frame(height: 8)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 5)
            .background(isHovering ? Color.waqtuPrimary.opacity(0.10) : Color.waqtuPrimary.opacity(0.04))
            .cornerRadius(8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .contextMenu {
            Toggle("On time", isOn: Binding(get: { onTime }, set: { _ in apply(.ontime) }))
            Toggle("In congregation", isOn: Binding(get: { jamaah }, set: { _ in apply(.jamaah) }))
            Toggle("Made up", isOn: Binding(get: { qadha }, set: { _ in apply(.qadha) }))
        }
        .help(done ? String(localized: "Undo \(name). Right-click for on time, in congregation or made up.")
                   : String(localized: "Mark \(name) done. Right-click for on time, in congregation or made up."))
        .accessibilityLabel(done ? String(localized: "Undo \(name)") : String(localized: "Mark \(name) done"))
    }
}

private struct CheckRow: View {
    let name: String
    let done: Bool
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            HStack(spacing: 8) {
                Image(systemName: done ? "checkmark.square.fill" : "square")
                    .font(.system(size: 13))
                    .foregroundColor(done ? .waqtuPrimary : .waqtuMuted)
                Text(name)
                    .font(.system(size: 12))
                    .foregroundColor(done ? .waqtuText : .waqtuMuted)
                    .lineLimit(1)
                Spacer()
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(done ? String(localized: "Undo \(name)") : String(localized: "Mark \(name) done"))
    }
}

private struct CountRow: View {
    let name: String
    let value: Int
    let set: (Int) -> Void

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: value > 0 ? "book.fill" : "book")
                .font(.system(size: 12))
                .foregroundColor(value > 0 ? .waqtuPrimary : .waqtuMuted)
                .frame(width: 14)
            Text(name)
                .font(.system(size: 12))
                .foregroundColor(value > 0 ? .waqtuText : .waqtuMuted)
                .lineLimit(1)
            Spacer()
            Button { set(value - 1) } label: { Image(systemName: "minus.circle") }
                .buttonStyle(.plain)
                .disabled(value <= 0)
                .accessibilityLabel(String(localized: "Decrease \(name)"))
            Text("\(value) pages")
                .font(.system(size: 11, weight: .medium))
                .monospacedDigit()
                .foregroundColor(.waqtuGold)
            Button { set(value + 1) } label: { Image(systemName: "plus.circle") }
                .buttonStyle(.plain)
                .disabled(value >= MutabaahItems.maxCount)
                .accessibilityLabel(String(localized: "Increase \(name)"))
        }
        .font(.system(size: 13))
        .foregroundColor(.waqtuMuted)
    }
}
