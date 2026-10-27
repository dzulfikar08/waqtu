//
//  MuhasabahView.swift
//  waqtu
//
//  The muhasabah journal (apps/mobile/src/app/(ibadah)/muhasabah): today's reflection, a
//  month calendar of the days written and the 30-day trend of the ratings. The notes stay on this
//  Mac (MuhasabahStore) unless the user turns on "Sync muhasabah to the cloud" in Settings.
//

import SwiftUI

struct MuhasabahView: View {
    let model: IbadahModel

    private struct EditingDay: Identifiable {
        let date: String
        var id: String { date }
    }

    @State private var editing: EditingDay?
    @State private var year: Int
    @State private var month: Int

    init(model: IbadahModel) {
        self.model = model
        let civil = Self.civil(model.today)
        _year = State(initialValue: civil.year)
        _month = State(initialValue: civil.month)
    }

    private static func civil(_ key: String) -> (year: Int, month: Int) {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return (2000, 1) }
        return (parts[0], parts[1])
    }

    var body: some View {
        // Reading the version redraws this after every save or delete (the store is not observable).
        let _ = model.journalVersion
        let today = model.today
        let entry = model.journalEntry(today)
        IbadahScreen(
            title: istr("ibadah.muhasabah.title"),
            subtitle: Self.dayTitle(today),
            trailing: AnyView(
                Button {
                    editing = EditingDay(date: model.today)
                } label: {
                    Label(entry == nil ? istr("ibadah.muhasabah.start") : istr("ibadah.muhasabah.edit"),
                          systemImage: entry == nil ? "square.and.pencil" : "pencil")
                }
                .buttonStyle(WQTintedButtonStyle(prominent: true)))
        ) {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Label(
                        model.cloud.isEnabled ? istr("ibadah.muhasabah.privateCloud") : istr("ibadah.muhasabah.private"),
                        systemImage: model.cloud.isEnabled ? "icloud" : "lock")
                        .font(.system(size: 12.5))
                        .foregroundStyle(Color.wqInkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                    todayCard(entry: entry)
                    ViewThatFits(in: .horizontal) {
                        HStack(alignment: .top, spacing: 20) {
                            calendar(today: today)
                            trends(today: today)
                        }
                        VStack(spacing: 20) {
                            calendar(today: today)
                            trends(today: today)
                        }
                    }
                }
                .padding(.horizontal, 28)
                .padding(.vertical, 20)
                .frame(maxWidth: 860, alignment: .leading)
                .frame(maxWidth: .infinity)
            }
        }
        .sheet(item: $editing) { day in
            MuhasabahEditor(model: model, date: day.date) { editing = nil }
        }
    }

    // MARK: - Today

    private func todayCard(entry: MuhasabahEntry?) -> some View {
        HStack(spacing: 16) {
            WQProgressRing(fraction: entry.map { Muhasabah.completion($0) } ?? 0, complete: (entry.map { Muhasabah.completion($0) } ?? 0) >= 1)
                .frame(width: 46, height: 46)
            VStack(alignment: .leading, spacing: 3) {
                Text(istr("ibadah.muhasabah.today"))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.wqInk)
                if let entry, let average = Muhasabah.averageRating(entry) {
                    Text(istr("ibadah.muhasabah.averageToday \(Self.oneDecimal(average))"))
                        .font(.system(size: 13))
                        .foregroundStyle(Color.wqInkMuted)
                }
            }
            Spacer()
        }
        .wqCard()
    }

    // MARK: - Calendar

    private func calendar(today: String) -> some View {
        let weeks = Muhasabah.monthWeeks(year: year, month: month)
        let weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Text(istr("ibadah.muhasabah.calendar"))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.wqInk)
                Spacer()
                monthButton("chevron.left", label: istr("ibadah.muhasabah.prevMonth")) { shift(-1) }
                Text(Self.monthTitle(year: year, month: month))
                    .font(.system(size: 13, weight: .medium))
                    .monospacedDigit()
                    .foregroundStyle(Color.wqInk)
                    .frame(minWidth: 116)
                monthButton("chevron.right", label: istr("ibadah.muhasabah.nextMonth")) { shift(1) }
            }
            Grid(horizontalSpacing: 6, verticalSpacing: 6) {
                GridRow {
                    ForEach(weekdays, id: \.self) { name in
                        Text(AppLanguage.weekdayInitial(englishShortName: name))
                            .font(.system(size: 11.5, weight: .medium))
                            .foregroundStyle(Color.wqInkMuted)
                            .frame(maxWidth: .infinity)
                    }
                }
                ForEach(0..<weeks.count, id: \.self) { w in
                    GridRow {
                        ForEach(0..<7, id: \.self) { d in
                            if let key = weeks[w][d] {
                                dayCell(key, today: today)
                            } else {
                                Color.clear.frame(height: 34)
                            }
                        }
                    }
                }
            }
        }
        .frame(width: 340, alignment: .leading)
        .wqCard()
    }

    private func monthButton(_ symbol: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.wqInkMuted)
                .frame(width: 28, height: 28)
                .background(RoundedRectangle(cornerRadius: WQ.chipRadius, style: .continuous).fill(Color.wqSurfaceRaised))
                .contentShape(RoundedRectangle(cornerRadius: WQ.chipRadius, style: .continuous))
        }
        .buttonStyle(WQPressStyle())
        .help(label)
        .accessibilityLabel(label)
    }

    private func dayCell(_ key: String, today: String) -> some View {
        let written = model.journalEntry(key) != nil
        let future = key > today
        let number = Int(key.suffix(2)) ?? 0
        return Button {
            editing = EditingDay(date: key)
        } label: {
            Text("\(number)")
                .font(.system(size: 13, weight: written || key == today ? .semibold : .regular))
                .monospacedDigit()
                .frame(maxWidth: .infinity)
                .frame(height: 34)
                .foregroundStyle(written ? Color.white : (future ? Color.wqInkMuted.opacity(0.45) : Color.wqInk))
                .background(Circle().fill(written ? Color.wqAccentFill : Color.clear).padding(1))
                .overlay(Circle().strokeBorder(Color.wqGold, lineWidth: key == today ? 2 : 0).padding(1))
                .contentShape(Circle())
        }
        .buttonStyle(WQPressStyle())
        .disabled(future)
        .accessibilityLabel(written
            ? istr("ibadah.muhasabah.dayLabel \(Self.dayTitle(key))")
            : istr("ibadah.muhasabah.dayEmpty \(Self.dayTitle(key))"))
    }

    private func shift(_ delta: Int) {
        let next = Muhasabah.shiftMonth(year: year, month: month, delta: delta)
        year = next.year
        month = next.month
    }

    // MARK: - Trends

    private func trends(today: String) -> some View {
        let days = 30
        let from = Muhasabah.lastDays(today, days)[0]
        let entries = model.journal.entries(from: from, to: today)
        let trend = Muhasabah.ratingTrend(entries, today: today, days: days)
        let summary = Muhasabah.summarizeTrend(entries, today: today, days: days)
        return VStack(alignment: .leading, spacing: 12) {
            Text(istr("ibadah.muhasabah.trends"))
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.wqInk)
            Text(istr("ibadah.muhasabah.daysWritten \(summary.daysWritten)"))
                .font(.system(size: 13))
                .foregroundStyle(Color.wqInkMuted)
            if let average = summary.average {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text("\(istr("ibadah.muhasabah.average")):")
                        .font(.system(size: 13))
                        .foregroundStyle(Color.wqInkMuted)
                    Text("\(Self.oneDecimal(average)) / 10")
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .monospacedDigit()
                        .foregroundStyle(Color.wqGold)
                }
                if let change = summary.change {
                    Text(Self.changeText(change))
                        .font(.system(size: 13))
                        .foregroundStyle(Color.wqInkMuted)
                }
                chart(trend)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(istr("ibadah.muhasabah.chartLabel"))
                VStack(spacing: 8) {
                    ForEach(MuhasabahAspect.allCases, id: \.self) { aspect in
                        if let value = summary.aspects[aspect] {
                            aspectRow(aspect, value)
                        }
                    }
                }
            } else {
                Text(istr("ibadah.muhasabah.noRatings"))
                    .font(.system(size: 13))
                    .foregroundStyle(Color.wqInkMuted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .wqCard()
    }

    private func aspectRow(_ aspect: MuhasabahAspect, _ value: Double) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(Self.aspectName(aspect))
                    .font(.system(size: 13))
                    .foregroundStyle(Color.wqInk)
                Spacer()
                Text(Self.oneDecimal(value))
                    .font(.system(size: 13, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(Color.wqGold)
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.wqInk.opacity(0.10))
                    Capsule().fill(Color.wqAccent)
                        .frame(width: proxy.size.width * max(0, min(1, value / 10)))
                }
            }
            .frame(height: 5)
        }
    }

    /// The mean rating of each of the last days as a bar, oldest on the left.
    private func chart(_ trend: [MuhasabahTrendDay]) -> some View {
        HStack(alignment: .bottom, spacing: 3) {
            ForEach(trend, id: \.date) { day in
                RoundedRectangle(cornerRadius: 2)
                    .fill(day.average == nil ? Color.wqInk.opacity(0.12) : Color.wqAccent)
                    .frame(height: day.average.map { max(4, CGFloat($0) / 10 * 80) } ?? 4)
                    .frame(maxWidth: .infinity)
            }
        }
        .frame(height: 80, alignment: .bottom)
    }

    // MARK: - Formatting

    static func oneDecimal(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = AppLanguage.locale
        formatter.minimumFractionDigits = 1
        formatter.maximumFractionDigits = 1
        return formatter.string(from: NSNumber(value: value)) ?? String(format: "%.1f", value)
    }

    static func changeText(_ change: Double) -> String {
        if abs(change) < 0.05 { return istr("ibadah.muhasabah.steady") }
        let value = oneDecimal(abs(change))
        return change > 0 ? istr("ibadah.muhasabah.up \(value)") : istr("ibadah.muhasabah.down \(value)")
    }

    static func monthTitle(year: Int, month: Int) -> String {
        guard let date = Calendar(identifier: .gregorian).date(from: DateComponents(year: year, month: month, day: 1)) else {
            return "\(month)/\(year)"
        }
        let formatter = DateFormatter()
        formatter.locale = AppLanguage.locale
        formatter.setLocalizedDateFormatFromTemplate("LLLL yyyy")
        return formatter.string(from: date)
    }

    /// A day key as a long date in the app's language ("Friday, 12 February 2027").
    static func dayTitle(_ key: String) -> String {
        guard let date = FardhMapping.startOfDay(forKey: key) else { return key }
        let formatter = DateFormatter()
        formatter.locale = AppLanguage.locale
        formatter.dateStyle = .full
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    static func aspectName(_ aspect: MuhasabahAspect) -> String {
        switch aspect {
        case .taqwa: return istr("ibadah.muhasabah.aspect.taqwa")
        case .gratitude: return istr("ibadah.muhasabah.aspect.gratitude")
        case .energy: return istr("ibadah.muhasabah.aspect.energy")
        case .willingness: return istr("ibadah.muhasabah.aspect.willingness")
        }
    }
}

/// One day's seven questions; saving an empty form deletes the day.
private struct MuhasabahEditor: View {
    let model: IbadahModel
    let date: String
    let onClose: () -> Void
    @State private var draft: MuhasabahEntry
    @State private var confirmDelete = false

    init(model: IbadahModel, date: String, onClose: @escaping () -> Void) {
        self.model = model
        self.date = date
        self.onClose = onClose
        _draft = State(initialValue: model.journalEntry(date) ?? MuhasabahEntry(date: date))
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text(istr("ibadah.muhasabah.entryTitle \(MuhasabahView.dayTitle(date))"))
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(Color.wqInk)
                    ForEach(0..<Muhasabah.questions.count, id: \.self) { index in
                        question(Muhasabah.questions[index])
                    }
                }
                .padding(24)
            }
            Rectangle().fill(Color.wqStroke).frame(height: 1)
            HStack(spacing: 10) {
                if model.journalEntry(date) != nil {
                    Button(istr("ibadah.muhasabah.delete"), role: .destructive) { confirmDelete = true }
                        .buttonStyle(WQTintedButtonStyle(tint: .wqAlert))
                        .confirmationDialog(
                            istr("ibadah.muhasabah.deleteTitle"), isPresented: $confirmDelete, titleVisibility: .visible
                        ) {
                            Button(istr("ibadah.muhasabah.confirmDelete"), role: .destructive) {
                                model.deleteJournal(date)
                                onClose()
                            }
                            Button(istr("ibadah.muhasabah.cancel"), role: .cancel) {}
                        } message: {
                            Text(istr("ibadah.muhasabah.deleteBody"))
                        }
                }
                Spacer()
                Button(istr("ibadah.muhasabah.cancel"), role: .cancel, action: onClose)
                    .keyboardShortcut(.cancelAction)
                    .buttonStyle(WQTintedButtonStyle(tint: .wqInkMuted))
                Button(istr("ibadah.muhasabah.save")) {
                    model.saveJournal(draft)
                    onClose()
                }
                .keyboardShortcut(.defaultAction)
                .buttonStyle(WQTintedButtonStyle(prominent: true))
            }
            .padding(16)
        }
        .background(Color.wqCanvas)
        .frame(minWidth: 520, idealWidth: 560, minHeight: 560, idealHeight: 680)
    }

    @ViewBuilder
    private func question(_ question: MuhasabahQuestion) -> some View {
        switch question {
        case .text(let field):
            VStack(alignment: .leading, spacing: 8) {
                Text(Self.prompt(field))
                    .font(.system(size: 14.5, weight: .semibold))
                    .foregroundStyle(Color.wqInk)
                TextEditor(text: Binding(
                    get: { draft.text(field) ?? "" },
                    set: { draft.set(field, $0) }))
                    .font(.system(size: 14))
                    .foregroundStyle(Color.wqInk)
                    .scrollContentBackground(.hidden)
                    .frame(height: 76)
                    .padding(6)
                    .background(RoundedRectangle(cornerRadius: WQ.controlRadius, style: .continuous).fill(Color.wqSurface))
                    .overlay(RoundedRectangle(cornerRadius: WQ.controlRadius, style: .continuous).strokeBorder(Color.wqStroke, lineWidth: 1))
                    .overlay(alignment: .topLeading) {
                        if (draft.text(field) ?? "").isEmpty {
                            Text(Self.placeholder(field))
                                .font(.system(size: 14))
                                .foregroundStyle(Color.wqInkMuted.opacity(0.7))
                                .padding(.horizontal, 11)
                                .padding(.vertical, 14)
                                .allowsHitTesting(false)
                        }
                    }
            }
        case .rating(let aspect):
            ratingRow(aspect)
        }
    }

    private func ratingRow(_ aspect: MuhasabahAspect) -> some View {
        let value = draft.rating(aspect)
        let emoji = Muhasabah.emoji(aspect)
        return VStack(alignment: .leading, spacing: 8) {
            Text(Self.ratingPrompt(aspect))
                .font(.system(size: 14.5, weight: .semibold))
                .foregroundStyle(Color.wqInk)
            HStack(spacing: 4) {
                ForEach(Muhasabah.ratingMin...Muhasabah.ratingMax, id: \.self) { n in
                    Button {
                        draft.set(aspect, value == n ? nil : n)
                    } label: {
                        Text("\(n)")
                            .font(.system(size: 13, weight: .semibold))
                            .monospacedDigit()
                            .frame(width: 34, height: 30)
                            .foregroundStyle(value == n ? Color.white : Color.wqInk)
                            .background(RoundedRectangle(cornerRadius: WQ.chipRadius, style: .continuous)
                                .fill(value == n ? Color.wqAccentFill : Color.wqSurfaceRaised))
                            .contentShape(RoundedRectangle(cornerRadius: WQ.chipRadius, style: .continuous))
                    }
                    .buttonStyle(WQPressStyle())
                    .accessibilityLabel(istr("ibadah.muhasabah.rate \(MuhasabahView.aspectName(aspect)) \(n)"))
                }
            }
            HStack {
                Text(Self.lowLabel(aspect))
                Spacer()
                if let value {
                    Text(emoji[value - 1])
                        .font(.title2)
                    Button(istr("ibadah.muhasabah.clearRating")) { draft.set(aspect, nil) }
                        .buttonStyle(WQTintedButtonStyle(tint: .wqInkMuted))
                }
                Spacer()
                Text(Self.highLabel(aspect))
            }
            .font(.system(size: 12))
            .foregroundStyle(Color.wqInkMuted)
        }
    }

    private static func prompt(_ field: MuhasabahTextField) -> String {
        switch field {
        case .feelings: return istr("ibadah.muhasabah.question.feelings")
        case .newAction: return istr("ibadah.muhasabah.question.newAction")
        case .continueTomorrow: return istr("ibadah.muhasabah.question.continueTomorrow")
        }
    }

    private static func placeholder(_ field: MuhasabahTextField) -> String {
        switch field {
        case .feelings: return istr("ibadah.muhasabah.placeholder.feelings")
        case .newAction: return istr("ibadah.muhasabah.placeholder.newAction")
        case .continueTomorrow: return istr("ibadah.muhasabah.placeholder.continueTomorrow")
        }
    }

    private static func ratingPrompt(_ aspect: MuhasabahAspect) -> String {
        switch aspect {
        case .taqwa: return istr("ibadah.muhasabah.question.taqwa")
        case .gratitude: return istr("ibadah.muhasabah.question.gratitude")
        case .energy: return istr("ibadah.muhasabah.question.energy")
        case .willingness: return istr("ibadah.muhasabah.question.willingness")
        }
    }

    private static func lowLabel(_ aspect: MuhasabahAspect) -> String {
        switch aspect {
        case .taqwa: return istr("ibadah.muhasabah.low.taqwa")
        case .gratitude: return istr("ibadah.muhasabah.low.gratitude")
        case .energy: return istr("ibadah.muhasabah.low.energy")
        case .willingness: return istr("ibadah.muhasabah.low.willingness")
        }
    }

    private static func highLabel(_ aspect: MuhasabahAspect) -> String {
        switch aspect {
        case .taqwa: return istr("ibadah.muhasabah.high.taqwa")
        case .gratitude: return istr("ibadah.muhasabah.high.gratitude")
        case .energy: return istr("ibadah.muhasabah.high.energy")
        case .willingness: return istr("ibadah.muhasabah.high.willingness")
        }
    }
}
