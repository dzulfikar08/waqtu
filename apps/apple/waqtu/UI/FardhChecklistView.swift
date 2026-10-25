//
//  FardhChecklistView.swift
//  waqtu
//
//  Menu bar section: today's five fardhu from the mutabaah checklist. Tapping a prayer marks it
//  prayed (and syncs it); tapping it again clears it.
//

import SwiftUI

struct FardhChecklistView: View {
    let streakManager: PrayerStreakManager
    let onToggle: (Fardh) -> Void

    private var doneCount: Int {
        Fardh.allCases.filter { isDone($0) }.count
    }

    private func isDone(_ fardh: Fardh) -> Bool {
        switch streakManager.statusFor(prayer: fardh.logName) {
        case .prayed, .late: return true
        case .missed, .none: return false
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Today's prayers")
                    .font(.system(size: 11))
                    .foregroundColor(.waqtuMuted)
                Spacer()
                Text(verbatim: "\(doneCount)/5")
                    .font(.system(size: 11, weight: .semibold))
                    .monospacedDigit()
                    .foregroundColor(doneCount == 5 ? .waqtuPrimary : .waqtuGold)
            }

            HStack(spacing: 6) {
                ForEach(Fardh.allCases, id: \.self) { fardh in
                    FardhChip(
                        fardh: fardh,
                        status: streakManager.statusFor(prayer: fardh.logName),
                        action: { onToggle(fardh) }
                    )
                }
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }
}

private struct FardhChip: View {
    let fardh: Fardh
    let status: PrayerLogEntry.Status?
    let action: () -> Void
    @State private var isHovering = false

    private var done: Bool { status == .prayed || status == .late }

    private var name: String {
        PrayerName(rawValue: fardh.logName)?.displayName ?? fardh.logName
    }

    var body: some View {
        Button(action: action) {
            VStack(spacing: 3) {
                Image(systemName: done ? "checkmark.circle.fill" : (status == .missed ? "xmark.circle" : "circle"))
                    .font(.system(size: 16))
                    .foregroundColor(done ? (status == .late ? .waqtuGold : .waqtuPrimary) : (status == .missed ? .red.opacity(0.7) : .waqtuMuted))
                Text(name)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundColor(done ? .waqtuText : .waqtuMuted)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 6)
            .background(isHovering ? Color.waqtuPrimary.opacity(0.10) : Color.waqtuPrimary.opacity(0.04))
            .cornerRadius(8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { isHovering = $0 }
        .help(done ? String(localized: "Marked as prayed. Click to undo.") : String(localized: "Mark \(name) as prayed"))
        .accessibilityLabel(done ? String(localized: "\(name), prayed") : String(localized: "\(name), not yet prayed"))
    }
}
