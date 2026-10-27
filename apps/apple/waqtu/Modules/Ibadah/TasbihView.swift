//
//  TasbihView.swift
//  waqtu
//
//  The tasbih counter (apps/mobile/src/app/(ibadah)/tasbih.tsx): presets (33 · 33 · 34 after the
//  prayer, 100 of one phrase, or a free count), a big counter to click, undo and reset, and an
//  optional link to one of the user's own counters in the mutabaah checklist. The count is kept
//  on this Mac between launches.
//

import SwiftUI

struct TasbihView: View {
    let model: IbadahModel
    @State private var confirmReset = false
    @State private var recorded: String?

    /// Targets the free count can be set to; 0 counts without an end.
    private static let targetSteps = [0, 7, 10, 11, 33, 99, 100, 313, 500, 1000]

    private let english = ModuleLocale.english

    var body: some View {
        // Reading the revision redraws this when the checklist changes (the replica itself is not observable).
        let _ = model.sync.revision
        let state = model.tasbih
        let phases = model.tasbihPhases
        ScrollView {
            if phases.isEmpty {
                Text(istr("ibadah.tasbih.missing"))
                    .foregroundStyle(.secondary)
                    .padding(40)
            } else {
                let at = Tasbih.position(of: state.count, in: phases)
                let phase = phases[min(at.phase, phases.count - 1)]
                VStack(spacing: 20) {
                    presets(state)
                    phraseCard(phase: phase, phases: phases, at: at)
                    counter(at: at, state: state)
                    options(state)
                    mutabaah(state)
                }
                .padding(24)
                .frame(maxWidth: 620)
                .frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: - Presets and phrase

    private func presets(_ state: TasbihState) -> some View {
        VStack(spacing: 6) {
            Picker(istr("ibadah.tasbih.presets"), selection: Binding(
                get: { state.preset }, set: { choose($0) })) {
                ForEach(TasbihPreset.allCases, id: \.self) { preset in
                    Text(presetName(preset)).tag(preset)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            Text(presetHint(state.preset))
                .font(.callout)
                .foregroundStyle(.secondary)
        }
    }

    private func presetName(_ preset: TasbihPreset) -> String {
        switch preset {
        case .afterPrayer: return istr("ibadah.tasbih.preset.afterPrayer")
        case .tahlil: return istr("ibadah.tasbih.preset.tahlil")
        case .istighfar: return istr("ibadah.tasbih.preset.istighfar")
        case .salawat: return istr("ibadah.tasbih.preset.salawat")
        case .custom: return istr("ibadah.tasbih.preset.custom")
        }
    }

    private func presetHint(_ preset: TasbihPreset) -> String {
        switch preset {
        case .afterPrayer: return istr("ibadah.tasbih.presetHint.afterPrayer")
        case .tahlil: return istr("ibadah.tasbih.presetHint.tahlil")
        case .istighfar: return istr("ibadah.tasbih.presetHint.istighfar")
        case .salawat: return istr("ibadah.tasbih.presetHint.salawat")
        case .custom: return istr("ibadah.tasbih.presetHint.custom")
        }
    }

    private func choose(_ preset: TasbihPreset) {
        recorded = nil
        model.tasbihChoose(preset)
    }

    private func phraseCard(phase: TasbihPhase, phases: [TasbihPhase], at: TasbihPosition) -> some View {
        VStack(spacing: 8) {
            if let phrase = phase.phrase {
                Text(phrase.arabic)
                    .font(QuranFont.font(size: 36))
                    .textSelection(.enabled)
                Text(phrase.transliteration)
                    .font(.headline)
                    .foregroundStyle(Color.waqtuPrimary)
                // The phrases' translations are in English, like the phone shows them.
                if english {
                    Text(phrase.translation)
                        .foregroundStyle(.secondary)
                }
            } else {
                Text(istr("ibadah.tasbih.presetHint.custom"))
                    .foregroundStyle(.secondary)
            }
            if phases.count > 1 {
                HStack(spacing: 4) {
                    ForEach(0..<phases.count, id: \.self) { i in
                        Capsule()
                            .fill(i < at.phase || (i == at.phase && at.inPhase == at.target)
                                  ? Color.waqtuPrimary
                                  : (i == at.phase ? Color.waqtuPrimary.opacity(0.35) : Color.secondary.opacity(0.2)))
                            .frame(height: 6)
                    }
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.secondary.opacity(0.07)))
    }

    // MARK: - Counter

    private func counter(at: TasbihPosition, state: TasbihState) -> some View {
        VStack(spacing: 12) {
            Button {
                recorded = nil
                model.tasbihTap()
            } label: {
                VStack(spacing: 4) {
                    Text("\(at.inPhase)")
                        .font(.system(size: 64, weight: .bold, design: .rounded))
                        .monospacedDigit()
                    Text(at.target > 0 ? istr("ibadah.tasbih.of \(at.target)") : istr("ibadah.tasbih.tap"))
                        .foregroundStyle(.secondary)
                    if at.roundComplete {
                        Label(istr("ibadah.tasbih.roundDone"), systemImage: "checkmark.circle.fill")
                            .font(.footnote.weight(.bold))
                            .foregroundStyle(Color.waqtuPrimary)
                    }
                }
                .frame(width: 230, height: 230)
                .background(Circle().fill(Color.waqtuPrimary.opacity(0.14)))
                .overlay(Circle().stroke(Color.waqtuPrimary.opacity(at.roundComplete ? 1 : 0.55), lineWidth: 3))
                .contentShape(Circle())
            }
            .buttonStyle(.plain)
            .keyboardShortcut(.space, modifiers: [])
            .accessibilityLabel(istr("ibadah.tasbih.counterLabel \(at.inPhase)"))
            if at.target > 0 {
                ProgressView(value: Double(at.inPhase), total: Double(at.target))
                    .tint(.waqtuPrimary)
                    .frame(maxWidth: 300)
            }
            Text(totalLine(state: state, at: at))
                .font(.callout)
                .monospacedDigit()
                .foregroundStyle(.secondary)
            HStack(spacing: 12) {
                Button {
                    recorded = nil
                    model.tasbihUndo()
                } label: {
                    Label(istr("ibadah.tasbih.undo"), systemImage: "minus.circle")
                }
                .disabled(state.count == 0)
                Button {
                    confirmReset = true
                } label: {
                    Label(istr("ibadah.tasbih.reset"), systemImage: "arrow.counterclockwise")
                }
                .disabled(state.count == 0)
                .confirmationDialog(
                    istr("ibadah.tasbih.resetTitle"), isPresented: $confirmReset, titleVisibility: .visible
                ) {
                    Button(istr("ibadah.tasbih.confirmReset"), role: .destructive) {
                        recorded = nil
                        model.tasbihReset()
                    }
                    Button(istr("ibadah.tasbih.cancel"), role: .cancel) {}
                } message: {
                    Text(istr("ibadah.tasbih.resetBody"))
                }
            }
            Text(istr("ibadah.tasbih.keepsCount"))
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
    }

    private func totalLine(state: TasbihState, at: TasbihPosition) -> String {
        let total = istr("ibadah.tasbih.total \(state.count)")
        return at.rounds > 0 ? "\(total) · \(istr("ibadah.tasbih.rounds \(at.rounds)"))" : total
    }

    // MARK: - Options

    private func options(_ state: TasbihState) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if state.preset == .custom {
                Picker(istr("ibadah.tasbih.target"), selection: Binding(
                    get: { state.customTarget }, set: { model.tasbihSetTarget($0) })) {
                    ForEach(targetChoices(including: state.customTarget), id: \.self) { value in
                        Text(value == 0 ? istr("ibadah.tasbih.noTarget") : "\(value)").tag(value)
                    }
                }
                .frame(maxWidth: 300)
            }
            Toggle(isOn: Binding(get: { state.feedback }, set: { model.tasbihSetFeedback($0) })) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(istr("ibadah.tasbih.feedback"))
                    Text(istr("ibadah.tasbih.feedbackHint"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// The steps, plus the stored target when it is none of them.
    private func targetChoices(including current: Int) -> [Int] {
        Self.targetSteps.contains(current) ? Self.targetSteps : (Self.targetSteps + [current]).sorted()
    }

    // MARK: - Mutabaah

    private func mutabaah(_ state: TasbihState) -> some View {
        let items = model.sync.items
        let linkable = Tasbih.linkableItems(items)
        let linked = Tasbih.linkedItem(of: state, in: items)
        return VStack(alignment: .leading, spacing: 10) {
            Text(istr("ibadah.tasbih.mutabaah"))
                .font(.headline)
            if linkable.isEmpty {
                Text(istr("ibadah.tasbih.noCounters"))
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                Button(istr("ibadah.tasbih.manage")) {
                    ModuleWindows.openSettings(pane: SettingsView.Pane.mutabaah)
                }
            } else {
                Text(istr("ibadah.tasbih.linkHint"))
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                ForEach(linkable, id: \.id) { item in
                    let selected = linked?.id == item.id
                    Button {
                        recorded = nil
                        model.tasbihLink(selected ? nil : item.id)
                    } label: {
                        HStack {
                            Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(selected ? Color.waqtuPrimary : Color.secondary)
                            Text(MutabaahItemLabel.text(item))
                            Spacer()
                            Text(istr("ibadah.tasbih.todayValue \(model.sync.value(date: model.today, itemId: item.id))"))
                                .foregroundStyle(.secondary)
                                .monospacedDigit()
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                if let linked {
                    Button {
                        if let result = model.tasbihRecord() {
                            recorded = istr("ibadah.tasbih.recorded \(result.count) \(MutabaahItemLabel.text(result.item))")
                        }
                    } label: {
                        Label(istr("ibadah.tasbih.record \(state.count) \(MutabaahItemLabel.text(linked))"),
                              systemImage: "checkmark.circle")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.waqtuPrimary)
                    .disabled(state.count == 0)
                }
                if let recorded {
                    Text(recorded)
                        .font(.callout)
                        .foregroundStyle(Color.waqtuPrimary)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.secondary.opacity(0.07)))
    }
}
