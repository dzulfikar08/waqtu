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
//  The header holds the title, the count of texts read and the controls (morning or evening, kind,
//  Latin and translation switches); the cards scroll below it.
//

import SwiftUI

/// Al-Ma'tsurat, kubro or sughro, morning or evening; opens on the part of the day it is now.
struct MatsuratReaderView: View {
    let model: IbadahModel

    var body: some View {
        let time = model.matsuratTime ?? model.suggestedTime
        let id = ReaderSessionID.matsurat(model.matsuratKind, time)
        ReaderPane(
            model: model,
            sessionID: id,
            title: istr("ibadah.matsurat.title"),
            time: Binding(get: { time }, set: { model.matsuratTime = $0 }),
            kind: Binding(get: { model.matsuratKind }, set: { model.matsuratKind = $0 }))
            .id(id)
    }
}

/// Morning or evening dhikr; opens on the part of the day it is now.
struct DzikirReaderView: View {
    let model: IbadahModel

    var body: some View {
        let time = model.dzikirTime ?? model.suggestedTime
        let id = ReaderSessionID.dzikir(time)
        ReaderPane(
            model: model,
            sessionID: id,
            title: istr("ibadah.dzikir.title"),
            time: Binding(get: { time }, set: { model.dzikirTime = $0 }),
            kind: nil)
            .id(id)
    }
}

private struct ReaderPane: View {
    let model: IbadahModel
    let sessionID: ReaderSessionID
    let title: String
    let time: Binding<ReaderTime>
    let kind: Binding<MatsuratKind>?
    @State private var confirmRestart = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if let session = IbadahLibrary.session(sessionID) {
            content(session)
        } else {
            IbadahScreen(title: title) {
                Text(istr("ibadah.reader.missing"))
                    .foregroundStyle(Color.wqInkMuted)
                    .padding(40)
            }
        }
    }

    private func content(_ session: ReaderSession) -> some View {
        let counts = model.readerCounts(for: session.id)
        let progress = IbadahReader.progress(session, counts)
        return IbadahScreen(
            title: title,
            subtitle: subtitle(session, progress),
            progress: progress.fraction,
            trailing: AnyView(summary(progress)),
            controls: AnyView(controls(session, progress))
        ) {
            ScrollViewReader { scroll in
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        if let note = translationNote(session) {
                            Label(note, systemImage: "info.circle")
                                .font(.system(size: 12))
                                .foregroundStyle(Color.wqInkMuted)
                        }
                        ForEach(Array(session.items.enumerated()), id: \.element.key) { index, item in
                            ItemCard(
                                item: item,
                                index: index,
                                label: IbadahReader.label(for: item, in: session),
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
                            CompleteCard(model: model, time: time.wrappedValue)
                        }
                    }
                    .padding(.horizontal, 28)
                    .padding(.vertical, 20)
                    .frame(maxWidth: 820)
                    .frame(maxWidth: .infinity)
                }
            }
        }
    }

    // MARK: - Header

    private func subtitle(_ session: ReaderSession, _ progress: ReaderProgress) -> String {
        let counted = istr("ibadah.reader.subtitle \(progress.itemsTotal) \(progress.total)")
        guard let kind else { return counted }
        let name = kind.wrappedValue == .sughro ? istr("ibadah.matsurat.sughro") : istr("ibadah.matsurat.kubro")
        return "\(name) · \(counted)"
    }

    /// "5/14" texts read and a ring that fills with the recitations.
    private func summary(_ progress: ReaderProgress) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .trailing, spacing: 1) {
                Text("\(progress.itemsDone)/\(progress.itemsTotal)")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Color.wqGold)
                Text(istr("ibadah.reader.textsDone"))
                    .font(.system(size: 11.5))
                    .foregroundStyle(Color.wqInkMuted)
            }
            WQProgressRing(fraction: progress.fraction, complete: progress.complete)
                .frame(width: 38, height: 38)
        }
        .help(istr("ibadah.reader.reps \(progress.done) \(progress.total)"))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(istr("ibadah.reader.progress \(progress.itemsDone) \(progress.itemsTotal)"))
    }

    private func controls(_ session: ReaderSession, _ progress: ReaderProgress) -> some View {
        HStack(spacing: 10) {
            WQSegmented(
                options: ReaderTime.allCases.map { WQOption(value: $0, title: timeTitle($0)) },
                selection: time)
                .accessibilityLabel(istr("ibadah.reader.timeChoice"))
            if let kind {
                WQSegmented(
                    options: [
                        WQOption(value: MatsuratKind.sughro, title: istr("ibadah.matsurat.sughro")),
                        WQOption(value: MatsuratKind.kubro, title: istr("ibadah.matsurat.kubro")),
                    ],
                    selection: kind)
                    .accessibilityLabel(istr("ibadah.reader.kindChoice"))
            }
            Spacer(minLength: 8)
            WQToggleChip(title: istr("ibadah.reader.showLatin"), isOn: Binding(
                get: { model.readerView.latin },
                set: { value in
                    var next = model.readerView
                    next.latin = value
                    model.setReaderView(next)
                }))
            WQToggleChip(title: istr("ibadah.reader.showTranslation"), isOn: Binding(
                get: { model.readerView.translation },
                set: { value in
                    var next = model.readerView
                    next.translation = value
                    model.setReaderView(next)
                }))
            if progress.done > 0 {
                Button {
                    confirmRestart = true
                } label: {
                    Label(istr("ibadah.reader.restart"), systemImage: "arrow.counterclockwise")
                        .labelStyle(.titleAndIcon)
                }
                .buttonStyle(WQTintedButtonStyle(tint: .wqInkMuted))
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
    }

    private func timeTitle(_ value: ReaderTime) -> String {
        let name = value == .pagi ? istr("ibadah.timeTitle.pagi") : istr("ibadah.timeTitle.petang")
        return value == model.suggestedTime ? "\(name) · \(istr("ibadah.reader.now"))" : name
    }

    private func translationNote(_ session: ReaderSession) -> String? {
        let english = ModuleLocale.english
        if (session.translationLang == .en) == english { return nil }
        return session.translationLang == .en ? istr("ibadah.reader.translationEn") : istr("ibadah.reader.translationId")
    }

    /// After the last recitation of a text: a beat to see it done, then the next open one comes up.
    private func scrollToNext(_ session: ReaderSession, from index: Int, proxy: ScrollViewProxy) {
        let counts = model.readerCounts(for: session.id)
        guard let next = IbadahReader.nextOpenItem(session, counts, from: index), next > index else { return }
        let key = session.items[next].key
        let animated = !reduceMotion
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 350_000_000)
            if animated {
                withAnimation(.easeOut(duration: 0.35)) { proxy.scrollTo(key, anchor: UnitPoint(x: 0.5, y: 0.04)) }
            } else {
                proxy.scrollTo(key, anchor: UnitPoint(x: 0.5, y: 0.04))
            }
        }
    }
}

// MARK: - One text

/// One text with its counter: click the counter to count one recitation down.
private struct ItemCard: View {
    let item: ReaderItem
    let index: Int
    let label: ReaderItemLabel?
    let left: Int
    let view: ReaderView
    let onTap: () -> Void
    let onReset: () -> Void

    private var done: Bool { left == 0 }
    private var title: String { label?.title ?? istr("ibadah.reader.item \(index + 1)") }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            header
            if let heading = item.heading {
                VStack(spacing: 6) {
                    ArabicText(text: heading.arabic, size: 26)
                        .foregroundStyle(Color.wqAccent)
                    if let translation = heading.translation {
                        Text(translation)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.wqInkMuted)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.wqAccent.opacity(0.10)))
            }
            ForEach(Array(item.lines.enumerated()), id: \.offset) { offset, line in
                if offset > 0 {
                    Rectangle().fill(Color.wqStroke).frame(height: 1)
                }
                VStack(alignment: .leading, spacing: 10) {
                    if let label = line.label {
                        WQLabel(text: label)
                    }
                    ArabicText(text: line.arabic, size: 30)
                        .foregroundStyle(Color.wqInk)
                    if view.latin, let latin = line.latin {
                        Text(latin)
                            .font(.system(size: 13.5, weight: .medium))
                            .foregroundStyle(Color.wqAccent)
                            .lineSpacing(3)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    }
                    if view.translation, let translation = line.translation {
                        Text(translation)
                            .font(.system(size: 14.5))
                            .foregroundStyle(Color.wqInk.opacity(0.82))
                            .lineSpacing(3)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .textSelection(.enabled)
                    }
                }
            }
            if let reference = item.reference {
                Label(istr("ibadah.reader.reference \(reference)"), systemImage: "book.closed")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Color.wqInkMuted)
            }
            CounterButton(
                title: title, left: left, total: item.repeatCount,
                onTap: onTap, onReset: onReset)
        }
        .wqCard(padding: 20)
        .opacity(done ? 0.8 : 1)
        .animation(.easeOut(duration: 0.2), value: done)
    }

    private var header: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(done ? Color.wqAccent.opacity(0.18) : Color.wqSurfaceRaised)
                if done {
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.wqAccent)
                } else {
                    Text("\(index + 1)")
                        .font(.system(size: 12, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(Color.wqInkMuted)
                }
            }
            .frame(width: 28, height: 28)
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 1) {
                if let kicker = label?.kicker {
                    Text(kicker)
                        .font(.system(size: 11.5))
                        .foregroundStyle(Color.wqInkMuted)
                        .lineLimit(1)
                }
                Text(title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.wqInk)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            if item.repeatCount > 1 {
                WQBadge(text: istr("ibadah.reader.times \(item.repeatCount)"))
            }
        }
    }
}

/// Arabic exactly as stored, right to left, with room between lines for the harakat.
private struct ArabicText: View {
    let text: String
    let size: CGFloat

    var body: some View {
        Text(text)
            .font(QuranFont.font(size: size))
            .lineSpacing(size * 0.32)
            .multilineTextAlignment(.trailing)
            .frame(maxWidth: .infinity, alignment: .trailing)
            .textSelection(.enabled)
    }
}

/// The counter of a text: a wide button that fills with the recitations done, the number left in
/// gold, a check once it is finished. Right-click resets it.
private struct CounterButton: View {
    let title: String
    let left: Int
    let total: Int
    let onTap: () -> Void
    let onReset: () -> Void
    @State private var hovering = false

    private var done: Bool { left == 0 }
    private var fraction: Double { total > 0 ? Double(total - left) / Double(total) : 0 }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 10) {
                if done {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(Color.wqAccent)
                    Text(istr("ibadah.reader.itemDone"))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.wqAccent)
                } else {
                    Text(istr("ibadah.reader.tapToCount"))
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.wqInk)
                }
                Spacer()
                if !done {
                    Text("\(left)")
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(Color.wqGold)
                        .contentTransition(.numericText(countsDown: true))
                }
            }
            .padding(.horizontal, 18)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background {
                ZStack(alignment: .leading) {
                    Rectangle().fill(done ? Color.wqAccent.opacity(0.10) : Color.wqSurfaceRaised.opacity(hovering ? 1 : 0.85))
                    GeometryReader { proxy in
                        Rectangle()
                            .fill(Color.wqAccent.opacity(0.22))
                            .frame(width: proxy.size.width * fraction)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(done ? Color.wqAccent.opacity(0.35) : Color.wqAccent.opacity(hovering ? 0.55 : 0.35), lineWidth: 1))
            .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(WQPressStyle(scale: 0.98))
        .animation(.easeOut(duration: 0.18), value: left)
        .onHover { hovering = $0 }
        .contextMenu {
            Button(istr("ibadah.reader.resetItem"), action: onReset)
        }
        .accessibilityLabel(done
            ? istr("ibadah.reader.doneLabel \(title)")
            : istr("ibadah.reader.countLabel \(title) \(left) \(total)"))
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
        VStack(alignment: .leading, spacing: 12) {
            Label(istr("ibadah.reader.completeTitle"), systemImage: "checkmark.seal.fill")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.wqAccent)
            Text(istr("ibadah.reader.completeBody"))
                .font(.system(size: 14))
                .foregroundStyle(Color.wqInk.opacity(0.82))
            if item == nil {
                Text(istr("ibadah.reader.notInChecklist \(name)"))
                    .font(.system(size: 13))
                    .foregroundStyle(Color.wqInkMuted)
                Button(istr("ibadah.reader.manage")) {
                    ModuleWindows.openSettings(pane: SettingsView.Pane.mutabaah)
                }
                .buttonStyle(WQTintedButtonStyle())
            } else if model.isTicked(time) {
                Label(istr("ibadah.reader.marked \(name)"), systemImage: "checkmark.circle.fill")
                    .font(.system(size: 13.5, weight: .semibold))
                    .foregroundStyle(Color.wqAccent)
            } else {
                Button {
                    model.tick(time)
                } label: {
                    Label(istr("ibadah.reader.markMutabaah \(name)"), systemImage: "checkmark.circle")
                }
                .buttonStyle(WQTintedButtonStyle(prominent: true))
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: WQ.cardRadius, style: .continuous).fill(Color.wqAccent.opacity(0.12)))
        .overlay(RoundedRectangle(cornerRadius: WQ.cardRadius, style: .continuous).strokeBorder(Color.wqAccent.opacity(0.3), lineWidth: 1))
    }
}
