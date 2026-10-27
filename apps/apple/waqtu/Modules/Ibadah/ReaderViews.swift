//
//  ReaderViews.swift
//  waqtu
//
//  The Al-Ma'tsurat and dzikir readers (apps/mobile/src/ibadah/components/Reader.tsx): a session
//  read top to bottom, a counter on every text that counts down with each click, the session's
//  progress, and at the end the offer to tick the matching mutabaah item for today
//  (`dzikir_pagi` / `dzikir_petang`, the same ids as the phone). Progress is kept on this Mac for
//  the rest of the day.
//

import SwiftUI

/// Al-Ma'tsurat, kubro or sughro, morning or evening; opens on the part of the day it is now.
struct MatsuratReaderView: View {
    let model: IbadahModel

    var body: some View {
        let time = model.matsuratTime ?? model.suggestedTime
        ReaderPane(
            model: model,
            sessionID: .matsurat(model.matsuratKind, time),
            header: AnyView(
                HStack(spacing: 16) {
                    TimePicker(
                        selection: Binding(get: { time }, set: { model.matsuratTime = $0 }),
                        suggested: model.suggestedTime,
                        label: istr("ibadah.reader.timeChoice"))
                    Picker(istr("ibadah.reader.kindChoice"), selection: Binding(
                        get: { model.matsuratKind }, set: { model.matsuratKind = $0 })) {
                        Text(istr("ibadah.matsurat.sughro")).tag(MatsuratKind.sughro)
                        Text(istr("ibadah.matsurat.kubro")).tag(MatsuratKind.kubro)
                    }
                    .pickerStyle(.segmented)
                    .frame(maxWidth: 240)
                }))
            .id(ReaderSessionID.matsurat(model.matsuratKind, time))
    }
}

/// Morning or evening dhikr; opens on the part of the day it is now.
struct DzikirReaderView: View {
    let model: IbadahModel

    var body: some View {
        let time = model.dzikirTime ?? model.suggestedTime
        ReaderPane(
            model: model,
            sessionID: .dzikir(time),
            header: AnyView(
                TimePicker(
                    selection: Binding(get: { time }, set: { model.dzikirTime = $0 }),
                    suggested: model.suggestedTime,
                    label: istr("ibadah.reader.timeChoice"))))
            .id(ReaderSessionID.dzikir(time))
    }
}

/// Morning / evening choice; the suggested one is marked "now".
private struct TimePicker: View {
    @Binding var selection: ReaderTime
    let suggested: ReaderTime
    let label: String

    var body: some View {
        Picker(label, selection: $selection) {
            ForEach(ReaderTime.allCases, id: \.self) { time in
                Text(title(time)).tag(time)
            }
        }
        .pickerStyle(.segmented)
        .frame(maxWidth: 280)
    }

    private func title(_ time: ReaderTime) -> String {
        let name = time == .pagi ? istr("ibadah.timeTitle.pagi") : istr("ibadah.timeTitle.petang")
        return time == suggested ? "\(name) · \(istr("ibadah.reader.now"))" : name
    }
}

private struct ReaderPane: View {
    let model: IbadahModel
    let sessionID: ReaderSessionID
    let header: AnyView
    @State private var confirmRestart = false

    private var time: ReaderTime {
        switch sessionID {
        case .matsuratKubroPagi, .matsuratSughroPagi, .dzikirPagi: return .pagi
        case .matsuratKubroPetang, .matsuratSughroPetang, .dzikirPetang: return .petang
        }
    }

    var body: some View {
        if let session = IbadahLibrary.session(sessionID) {
            content(session)
        } else {
            Text(istr("ibadah.reader.missing"))
                .foregroundStyle(.secondary)
                .padding(40)
        }
    }

    private func content(_ session: ReaderSession) -> some View {
        let counts = model.readerCounts(for: session.id)
        let progress = IbadahReader.progress(session, counts)
        return ScrollViewReader { scroll in
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header
                    progressCard(session, progress)
                    ForEach(Array(session.items.enumerated()), id: \.element.key) { index, item in
                        ItemCard(
                            item: item,
                            index: index,
                            left: IbadahReader.remaining(counts, item),
                            view: model.readerView,
                            onTap: {
                                if model.tap(session, index: index) {
                                    scrollToNext(session, from: index, proxy: scroll)
                                }
                            },
                            onReset: { model.reset(session, index: index) })
                            .id(item.key)
                    }
                    if progress.complete {
                        CompleteCard(model: model, time: time)
                    }
                }
                .padding(24)
                .frame(maxWidth: 820)
                .frame(maxWidth: .infinity)
            }
        }
    }

    private func scrollToNext(_ session: ReaderSession, from index: Int, proxy: ScrollViewProxy) {
        let counts = model.readerCounts(for: session.id)
        guard let next = IbadahReader.nextOpenItem(session, counts, from: index), next > index else { return }
        withAnimation { proxy.scrollTo(session.items[next].key, anchor: .top) }
    }

    private func progressCard(_ session: ReaderSession, _ progress: ReaderProgress) -> some View {
        let english = ModuleLocale.english
        let translationNote: String? = (session.translationLang == .en) == english
            ? nil
            : (session.translationLang == .en ? istr("ibadah.reader.translationEn") : istr("ibadah.reader.translationId"))
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(istr("ibadah.reader.progress \(progress.itemsDone) \(progress.itemsTotal)"))
                    .font(.headline)
                Spacer()
                Text("\(Int((progress.fraction * 100).rounded()))%")
                    .font(.headline)
                    .monospacedDigit()
                    .foregroundStyle(Color.waqtuPrimary)
            }
            ProgressView(value: progress.fraction)
                .tint(.waqtuPrimary)
            HStack {
                Text(istr("ibadah.reader.reps \(progress.done) \(progress.total)"))
                    .font(.callout)
                    .monospacedDigit()
                    .foregroundStyle(.secondary)
                Spacer()
                if progress.done > 0 {
                    Button(istr("ibadah.reader.restart")) { confirmRestart = true }
                        .buttonStyle(.link)
                        .confirmationDialog(
                            istr("ibadah.reader.restartTitle"), isPresented: $confirmRestart, titleVisibility: .visible
                        ) {
                            Button(istr("ibadah.reader.confirmRestart"), role: .destructive) { model.restart(session) }
                            Button(istr("ibadah.reader.cancel"), role: .cancel) {}
                        } message: {
                            Text(istr("ibadah.reader.restartBody"))
                        }
                }
            }
            HStack(spacing: 8) {
                Toggle(istr("ibadah.reader.showLatin"), isOn: Binding(
                    get: { model.readerView.latin },
                    set: { value in
                        var next = model.readerView
                        next.latin = value
                        model.setReaderView(next)
                    }))
                Toggle(istr("ibadah.reader.showTranslation"), isOn: Binding(
                    get: { model.readerView.translation },
                    set: { value in
                        var next = model.readerView
                        next.translation = value
                        model.setReaderView(next)
                    }))
            }
            .toggleStyle(.button)
            if let translationNote {
                Text(translationNote)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.secondary.opacity(0.07)))
    }
}

/// One text with its counter: click the counter to count one recitation down.
private struct ItemCard: View {
    let item: ReaderItem
    let index: Int
    let left: Int
    let view: ReaderView
    let onTap: () -> Void
    let onReset: () -> Void

    private var done: Bool { left == 0 }
    private var title: String { item.title ?? istr("ibadah.reader.item \(index + 1)") }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                Text(istr("ibadah.reader.times \(item.repeatCount)"))
                    .font(.caption.weight(.heavy))
                    .monospacedDigit()
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(Color.waqtuPrimary.opacity(0.18)))
                    .foregroundStyle(Color.waqtuPrimary)
                Text(title)
                    .font(.headline)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if done {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Color.waqtuPrimary)
                        .accessibilityHidden(true)
                }
            }
            if let heading = item.heading {
                VStack(spacing: 4) {
                    arabic(heading.arabic, size: 26)
                        .foregroundStyle(Color.waqtuPrimary)
                    if let translation = heading.translation {
                        Text(translation)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(10)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.waqtuPrimary.opacity(0.08)))
            }
            ForEach(Array(item.lines.enumerated()), id: \.offset) { _, line in
                VStack(alignment: .leading, spacing: 6) {
                    if let label = line.label {
                        Text(label)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    arabic(line.arabic, size: 28)
                    if view.latin, let latin = line.latin {
                        Text(latin)
                            .font(.callout)
                            .foregroundStyle(Color.waqtuPrimary)
                            .textSelection(.enabled)
                    }
                    if view.translation, let translation = line.translation {
                        Text(translation)
                            .foregroundStyle(.secondary)
                            .textSelection(.enabled)
                    }
                }
            }
            if let reference = item.reference {
                Text(istr("ibadah.reader.reference \(reference)"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            counter
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.secondary.opacity(done ? 0.04 : 0.09)))
        .opacity(done ? 0.8 : 1)
    }

    /// Arabic exactly as stored, right to left, with room between lines for the harakat.
    private func arabic(_ text: String, size: CGFloat) -> some View {
        Text(text)
            .font(QuranFont.font(size: size))
            .lineSpacing(size * 0.5)
            .multilineTextAlignment(.trailing)
            .frame(maxWidth: .infinity, alignment: .trailing)
            .textSelection(.enabled)
    }

    private var counter: some View {
        Button(action: onTap) {
            HStack {
                Text(done ? istr("ibadah.reader.itemDone") : istr("ibadah.reader.tapToCount"))
                    .fontWeight(.semibold)
                    .foregroundStyle(done ? Color.secondary : Color.primary)
                Spacer()
                if done {
                    Image(systemName: "checkmark")
                        .foregroundStyle(Color.waqtuPrimary)
                } else {
                    Text("\(left)")
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(Color.waqtuPrimary)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(RoundedRectangle(cornerRadius: 8).fill(Color.waqtuPrimary.opacity(done ? 0.05 : 0.14)))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.waqtuPrimary.opacity(done ? 0.2 : 0.6), lineWidth: 1))
            .contentShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(istr("ibadah.reader.resetItem"), action: onReset)
        }
        .accessibilityLabel(done
            ? istr("ibadah.reader.doneLabel \(title)")
            : istr("ibadah.reader.countLabel \(title) \(left) \(item.repeatCount)"))
    }
}

/// The end of the session: a short close and the mutabaah tick for this morning or evening.
private struct CompleteCard: View {
    let model: IbadahModel
    let time: ReaderTime

    var body: some View {
        // Reading the revision redraws this when the checklist changes (the replica itself is not observable).
        let _ = model.sync.revision
        let itemId = IbadahReader.mutabaahItem(for: time)
        let item = model.checklistItem(for: time)
        let name = MutabaahItemLabel.text(item ?? ItemDef(id: itemId, kind: .check))
        VStack(alignment: .leading, spacing: 10) {
            Label(istr("ibadah.reader.completeTitle"), systemImage: "sparkles")
                .font(.title3.bold())
                .foregroundStyle(Color.waqtuPrimary)
            Text(istr("ibadah.reader.completeBody"))
                .foregroundStyle(.secondary)
            if item == nil {
                Text(istr("ibadah.reader.notInChecklist \(name)"))
                    .font(.callout)
                    .foregroundStyle(.secondary)
                Button(istr("ibadah.reader.manage")) {
                    ModuleWindows.openSettings(pane: SettingsView.Pane.mutabaah)
                }
            } else if model.isTicked(time) {
                Label(istr("ibadah.reader.marked \(name)"), systemImage: "checkmark.circle.fill")
                    .foregroundStyle(Color.waqtuPrimary)
            } else {
                Button {
                    model.tick(time)
                } label: {
                    Label(istr("ibadah.reader.markMutabaah \(name)"), systemImage: "checkmark.circle")
                }
                .buttonStyle(.borderedProminent)
                .tint(.waqtuPrimary)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.waqtuPrimary.opacity(0.1)))
    }
}
