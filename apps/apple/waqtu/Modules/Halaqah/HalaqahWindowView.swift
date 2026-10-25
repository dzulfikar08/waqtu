//
//  HalaqahWindowView.swift
//  waqtu
//
//  The halaqah window: every program day grouped by week on the left (any day opens, done days
//  carry a check), the chosen day's session on the right (apps/mobile/src/halaqah/components).
//

import AppKit
import SwiftUI

struct HalaqahWindowView: View {
    @State var model: HalaqahModel
    private let english = ModuleLocale.english

    var body: some View {
        NavigationSplitView {
            List(selection: $model.selectedDay) {
                Section {
                    HalaqahStatusView(model: model)
                }
                ForEach(model.program.phases, id: \.id) { phase in
                    Section(phase.title.text(english: english)) {
                        ForEach(model.program.days.filter { $0.day >= phase.from && $0.day <= phase.to }, id: \.day) { day in
                            dayRow(day).tag(Optional(day.day))
                        }
                    }
                }
            }
            .navigationSplitViewColumnWidth(min: 240, ideal: 280)
        } detail: {
            if let number = model.selectedDay, let day = model.program.day(number) {
                HalaqahSessionView(model: model, day: day)
                    .id(day.day)
            } else {
                Text(mstr("halaqah.selectDay"))
                    .foregroundStyle(.secondary)
            }
        }
        .frame(minWidth: 760, minHeight: 520)
        .onAppear { model.refreshToday() }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            model.refreshToday()
        }
    }

    private func dayRow(_ day: HalaqahDay) -> some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(day.day == model.position.todayDay
                     ? "\(mstr("halaqah.dayN \(day.day)")) · \(mstr("halaqah.today"))"
                     : mstr("halaqah.dayN \(day.day)"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(day.title.text(english: english))
                    .lineLimit(2)
            }
            Spacer(minLength: 4)
            if model.isDone(day.day) {
                Image(systemName: "checkmark")
                    .foregroundStyle(Color.waqtuPrimary)
                    .accessibilityLabel(mstr("halaqah.done"))
            }
        }
        .padding(.vertical, 2)
    }
}

/// Where the program stands today, the progress count and a shortcut to the next open day.
private struct HalaqahStatusView: View {
    let model: HalaqahModel

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(model.program.title.text(english: ModuleLocale.english))
                .font(.headline)
            Text(statusText)
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Text(mstr("halaqah.progress \(model.doneDays.count) \(model.program.totalDays)"))
                .font(.callout)
            if let next = model.nextDay {
                Button(model.doneDays.isEmpty && model.position.todayDay == nil
                       ? mstr("halaqah.startEarly")
                       : mstr("halaqah.continueFrom \(next)")) {
                    model.selectedDay = next
                }
                .buttonStyle(.link)
            } else {
                Text(mstr("halaqah.allDone"))
                    .font(.callout)
            }
            Text(mstr("halaqah.catchUp"))
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 4)
    }

    private var statusText: String {
        let year = String(model.program.hijriYear)
        switch model.position {
        case .before(let daysUntil):
            if let daysUntil { return mstr("halaqah.beforeRamadhan \(daysUntil)") }
            return mstr("halaqah.forYear \(year)")
        case .during:
            return mstr("halaqah.openAnyTime")
        case .after:
            return mstr("halaqah.afterRamadhan \(year)")
        }
    }
}

/// One day's session: video, summary, madhhab note, private reflection, optional amalan, sources
/// and the done button.
private struct HalaqahSessionView: View {
    let model: HalaqahModel
    let day: HalaqahDay
    private let english = ModuleLocale.english

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(header)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.waqtuPrimary)
                    Text(day.title.text(english: english))
                        .font(.title2.bold())
                        .textSelection(.enabled)
                }

                YouTubeEmbedView(youtubeId: day.video.youtubeId)
                    .aspectRatio(16 / 9, contentMode: .fit)
                    .frame(maxWidth: 720)
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                VStack(alignment: .leading, spacing: 6) {
                    Text(mstr("halaqah.speakerLine \(day.video.speaker) \(day.video.channelName) \(day.video.durationMin)"))
                        .foregroundStyle(.secondary)
                    Text(mstr("halaqah.videoNote"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let url = HalaqahEmbed.watchURL(day.video.youtubeId) {
                        Link(mstr("halaqah.openYoutube"), destination: url)
                    }
                    if english {
                        Text(mstr("halaqah.contentNote"))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                section(mstr("halaqah.summary"), body: day.summary)
                if let note = day.madhhabNote {
                    section(mstr("halaqah.madhhab"), body: note)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text(mstr("halaqah.reflection")).font(.headline)
                    Text(day.reflectionPrompt)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                    HalaqahReflectionField(model: model, day: day.day)
                    Text(mstr("halaqah.reflectionPrivate"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if let amalan = day.amalan {
                    section(mstr("halaqah.amalan"), body: amalan)
                }

                if !day.sources.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(mstr("halaqah.sources")).font(.headline)
                        ForEach(day.sources, id: \.self) { source in
                            Text(source)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .textSelection(.enabled)
                        }
                    }
                }

                let done = model.isDone(day.day)
                if done {
                    Text(mstr("halaqah.markedDone"))
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.waqtuPrimary)
                }
                Group {
                    if done {
                        Button(mstr("halaqah.undo")) { model.toggleDone(day.day) }
                            .buttonStyle(.bordered)
                    } else {
                        Button(mstr("halaqah.markDone")) { model.toggleDone(day.day) }
                            .buttonStyle(.borderedProminent)
                            .tint(.waqtuPrimary)
                    }
                }
                .controlSize(.large)
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var header: String {
        let dayN = mstr("halaqah.dayN \(day.day)")
        guard let phase = model.program.phase(of: day) else { return dayN }
        return "\(dayN) · \(phase.title.text(english: english))"
    }

    private func section(_ title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.headline)
            Text(body)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.secondary.opacity(0.08)))
        }
    }
}

/// Private reflection; saves shortly after typing stops and when the day closes.
private struct HalaqahReflectionField: View {
    let model: HalaqahModel
    let day: Int
    @State private var text = ""
    @State private var saved = false
    @State private var pendingSave: Task<Void, Never>?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ZStack(alignment: .topLeading) {
                TextEditor(text: $text)
                    .font(.body)
                    .frame(minHeight: 120)
                    .scrollContentBackground(.hidden)
                    .padding(6)
                    .background(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.4)))
                    .accessibilityLabel(mstr("halaqah.reflection"))
                if text.isEmpty {
                    Text(mstr("halaqah.reflectionPlaceholder"))
                        .foregroundStyle(.tertiary)
                        .padding(.horizontal, 11)
                        .padding(.vertical, 6)
                        .allowsHitTesting(false)
                }
            }
            if saved {
                Text(mstr("halaqah.reflectionSaved"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .onAppear { text = model.reflection(day) }
        .onChange(of: text) { _, next in
            if next.count > HalaqahStore.maxReflection {
                text = String(next.prefix(HalaqahStore.maxReflection))
                return
            }
            saved = false
            pendingSave?.cancel()
            pendingSave = Task { @MainActor in
                try? await Task.sleep(nanoseconds: 800_000_000)
                guard !Task.isCancelled else { return }
                save()
            }
        }
        .onDisappear {
            pendingSave?.cancel()
            save()
        }
    }

    private func save() {
        guard text != model.reflection(day) else { return }
        model.saveReflection(day, text: text)
        saved = true
    }
}
