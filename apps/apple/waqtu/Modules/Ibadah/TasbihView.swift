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
        IbadahScreen(
            title: istr("ibadah.tasbih.title"),
            subtitle: presetHint(state.preset),
            controls: AnyView(presets(state))
        ) {
            ScrollView {
                if phases.isEmpty {
                    Text(istr("ibadah.tasbih.missing"))
                        .foregroundStyle(Color.wqInkMuted)
                        .padding(40)
                } else {
                    let at = Tasbih.position(of: state.count, in: phases)
                    let phase = phases[min(at.phase, phases.count - 1)]
                    VStack(spacing: 20) {
                        phraseCard(phase: phase, phases: phases, at: at)
                        counter(at: at, state: state)
                        options(state)
                        mutabaah(state)
                    }
                    .padding(.horizontal, 28)
                    .padding(.vertical, 20)
                    .frame(maxWidth: 640)
                    .frame(maxWidth: .infinity)
                }
            }
        }
    }

    // MARK: - Presets and phrase

    private func presets(_ state: TasbihState) -> some View {
        WQSegmented(
            options: TasbihPreset.allCases.map { WQOption(value: $0, title: presetName($0)) },
            selection: Binding(get: { state.preset }, set: { choose($0) }))
            .accessibilityLabel(istr("ibadah.tasbih.presets"))
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
        VStack(spacing: 10) {
            if let phrase = phase.phrase {
                Text(phrase.arabic)
                    .font(QuranFont.font(size: 40))
                    .foregroundStyle(Color.wqInk)
                    .textSelection(.enabled)
                Text(phrase.transliteration)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Color.wqAccent)
                // The phrases' translations are in English, like the phone shows them.
                if english {
                    Text(phrase.translation)
                        .font(.system(size: 14))
                        .foregroundStyle(Color.wqInk.opacity(0.82))
                }
            } else {
                Text(istr("ibadah.tasbih.presetHint.custom"))
                    .font(.system(size: 14))
                    .foregroundStyle(Color.wqInkMuted)
            }
            if phases.count > 1 {
                HStack(spacing: 4) {
                    ForEach(0..<phases.count, id: \.self) { i in
                        Capsule()
                            .fill(i < at.phase || (i == at.phase && at.inPhase == at.target)
                                  ? Color.wqAccent
                                  : (i == at.phase ? Color.wqAccent.opacity(0.4) : Color.wqInk.opacity(0.14)))
                            .frame(height: 5)
                    }
                }
                .padding(.top, 6)
            }
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .wqCard(padding: 22)
    }

    // MARK: - Counter

    private func counter(at: TasbihPosition, state: TasbihState) -> some View {
        VStack(spacing: 14) {
            Button {
                recorded = nil
                model.tasbihTap()
            } label: {
                ZStack {
                    Circle().fill(Color.wqSurface)
                    Circle().strokeBorder(Color.wqStroke, lineWidth: 1)
                    if at.target > 0 {
                        Circle()
                            .stroke(Color.wqInk.opacity(0.10), lineWidth: 8)
                            .padding(10)
                        Circle()
                            .trim(from: 0, to: max(0.001, min(1, Double(at.inPhase) / Double(at.target))))
                            .stroke(Color.wqAccent, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                            .rotationEffect(.degrees(-90))
                            .padding(10)
                            .animation(.easeOut(duration: 0.2), value: at.inPhase)
                    }
                    VStack(spacing: 2) {
                        Text("\(at.inPhase)")
                            .font(.system(size: 72, weight: .bold, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(Color.wqGold)
                            .contentTransition(.numericText())
                        Text(at.target > 0 ? istr("ibadah.tasbih.of \(at.target)") : istr("ibadah.tasbih.tap"))
                            .font(.system(size: 14))
                            .foregroundStyle(Color.wqInkMuted)
                        if at.roundComplete {
                            Label(istr("ibadah.tasbih.roundDone"), systemImage: "checkmark.circle.fill")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(Color.wqAccent)
                                .padding(.top, 2)
                        }
                    }
                }
                .frame(width: 240, height: 240)
                .contentShape(Circle())
            }
            .buttonStyle(WQPressStyle())
            .keyboardShortcut(.space, modifiers: [])
            .accessibilityLabel(istr("ibadah.tasbih.counterLabel \(at.inPhase)"))
            Text(totalLine(state: state, at: at))
                .font(.system(size: 13))
                .monospacedDigit()
                .foregroundStyle(Color.wqInkMuted)
            HStack(spacing: 10) {
                Button {
                    recorded = nil
                    model.tasbihUndo()
                } label: {
                    Label(istr("ibadah.tasbih.undo"), systemImage: "minus.circle")
                }
                .buttonStyle(WQTintedButtonStyle(tint: .wqInkMuted))
                .disabled(state.count == 0)
                Button {
                    confirmReset = true
                } label: {
                    Label(istr("ibadah.tasbih.reset"), systemImage: "arrow.counterclockwise")
                }
                .buttonStyle(WQTintedButtonStyle(tint: .wqInkMuted))
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
                .font(.system(size: 11.5))
                .foregroundStyle(Color.wqInkMuted.opacity(0.8))
        }
        .frame(maxWidth: .infinity)
    }

    private func totalLine(state: TasbihState, at: TasbihPosition) -> String {
        let total = istr("ibadah.tasbih.total \(state.count)")
        return at.rounds > 0 ? "\(total) · \(istr("ibadah.tasbih.rounds \(at.rounds)"))" : total
    }

    // MARK: - Options

    private func options(_ state: TasbihState) -> some View {
        VStack(alignment: .leading, spacing: 14) {
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
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Color.wqInk)
                    Text(istr("ibadah.tasbih.feedbackHint"))
                        .font(.system(size: 12))
                        .foregroundStyle(Color.wqInkMuted)
                }
            }
            .toggleStyle(.switch)
            .tint(Color.wqAccentFill)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .wqCard()
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
        return VStack(alignment: .leading, spacing: 12) {
            Text(istr("ibadah.tasbih.mutabaah"))
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.wqInk)
            if linkable.isEmpty {
                Text(istr("ibadah.tasbih.noCounters"))
                    .font(.system(size: 13))
                    .foregroundStyle(Color.wqInkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                Button(istr("ibadah.tasbih.manage")) {
                    ModuleWindows.openSettings(pane: SettingsView.Pane.mutabaah)
                }
                .buttonStyle(WQTintedButtonStyle())
            } else {
                Text(istr("ibadah.tasbih.linkHint"))
                    .font(.system(size: 13))
                    .foregroundStyle(Color.wqInkMuted)
                    .fixedSize(horizontal: false, vertical: true)
                VStack(spacing: 4) {
                    ForEach(linkable, id: \.id) { item in
                        let selected = linked?.id == item.id
                        Button {
                            recorded = nil
                            model.tasbihLink(selected ? nil : item.id)
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(selected ? Color.wqAccent : Color.wqInkMuted)
                                Text(MutabaahItemLabel.text(item))
                                    .foregroundStyle(Color.wqInk)
                                Spacer()
                                Text(istr("ibadah.tasbih.todayValue \(model.sync.value(date: model.today, itemId: item.id))"))
                                    .foregroundStyle(Color.wqInkMuted)
                                    .monospacedDigit()
                            }
                            .font(.system(size: 13.5))
                            .padding(.horizontal, 12)
                            .frame(minHeight: 38)
                            .background(
                                RoundedRectangle(cornerRadius: WQ.controlRadius, style: .continuous)
                                    .fill(selected ? Color.wqAccent.opacity(0.14) : Color.wqSurfaceRaised.opacity(0.6)))
                            .contentShape(RoundedRectangle(cornerRadius: WQ.controlRadius, style: .continuous))
                        }
                        .buttonStyle(WQPressStyle(scale: 0.98))
                        .accessibilityAddTraits(selected ? .isSelected : [])
                    }
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
                    .buttonStyle(WQTintedButtonStyle(prominent: true))
                    .disabled(state.count == 0)
                }
                if let recorded {
                    Text(recorded)
                        .font(.system(size: 13))
                        .foregroundStyle(Color.wqAccent)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .wqCard()
    }
}
