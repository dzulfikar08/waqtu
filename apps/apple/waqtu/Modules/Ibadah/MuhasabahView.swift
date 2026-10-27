//
//  MuhasabahView.swift
//  waqtu
//
//  The private muhasabah journal (apps/mobile/src/app/(ibadah)/muhasabah): today's reflection, a
//  month calendar of the days written and the 30-day trend of the ratings. The notes stay on this
//  Mac (MuhasabahStore): they are not synced and never sent to a server.
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
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Label(istr("ibadah.muhasabah.private"), systemImage: "lock")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                todayCard(entry: entry)
                calendar(today: today)
                trends(today: today)
            }
            .padding(24)
            .frame(maxWidth: 720, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .sheet(item: $editing) { day in
            MuhasabahEditor(model: model, date: day.date) { editing = nil }
        }
    }

    // MARK: - Today

    private func todayCard(entry: MuhasabahEntry?) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(istr("ibadah.muhasabah.today"))
                .font(.headline)
            if let entry, let average = Muhasabah.averageRating(entry) {
                Text(istr("ibadah.muhasabah.averageToday \(Self.oneDecimal(average))"))
                    .foregroundStyle(.secondary)
            }
            if let entry {
                ProgressView(value: Muhasabah.completion(entry))
                    .tint(.waqtuPrimary)
                    .frame(maxWidth: 280)
            }
            Button(entry == nil ? istr("ibadah.muhasabah.start") : istr("ibadah.muhasabah.edit")) {
                editing = EditingDay(date: model.today)
            }
            .buttonStyle(.borderedProminent)
            .tint(.waqtuPrimary)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.secondary.opacity(0.07)))
    }

    // MARK: - Calendar

    private func calendar(today: String) -> some View {
        let weeks = Muhasabah.monthWeeks(year: year, month: month)
        let weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(istr("ibadah.muhasabah.calendar"))
                    .font(.headline)
                Spacer()
                Button {
                    shift(-1)
                } label: {
                    Image(systemName: "chevron.left")
                }
                .help(istr("ibadah.muhasabah.prevMonth"))
                .accessibilityLabel(istr("ibadah.muhasabah.prevMonth"))
                Text(Self.monthTitle(year: year, month: month))
                    .monospacedDigit()
                    .frame(minWidth: 130)
                Button {
                    shift(1)
                } label: {
                    Image(systemName: "chevron.right")
                }
                .help(istr("ibadah.muhasabah.nextMonth"))
                .accessibilityLabel(istr("ibadah.muhasabah.nextMonth"))
            }
            Grid(horizontalSpacing: 6, verticalSpacing: 6) {
                GridRow {
                    ForEach(weekdays, id: \.self) { name in
                        Text(AppLanguage.weekdayInitial(englishShortName: name))
                            .font(.caption)
                            .foregroundStyle(.secondary)
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
            .frame(maxWidth: 420)
        }
    }

    private func dayCell(_ key: String, today: String) -> some View {
        let written = model.journalEntry(key) != nil
        let future = key > today
        let number = Int(key.suffix(2)) ?? 0
        return Button {
            editing = EditingDay(date: key)
        } label: {
            Text("\(number)")
                .monospacedDigit()
                .frame(maxWidth: .infinity)
                .frame(height: 34)
                .foregroundStyle(written ? Color.white : (future ? Color.secondary.opacity(0.5) : Color.primary))
                .background(Circle().fill(written ? Color.waqtuPrimary : Color.clear).padding(1))
                .overlay(Circle().stroke(Color.waqtuPrimary, lineWidth: key == today ? 2 : 0).padding(1))
        }
        .buttonStyle(.plain)
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
        return VStack(alignment: .leading, spacing: 10) {
            Text(istr("ibadah.muhasabah.trends"))
                .font(.headline)
            Text(istr("ibadah.muhasabah.daysWritten \(summary.daysWritten)"))
                .foregroundStyle(.secondary)
            if let average = summary.average {
                Text("\(istr("ibadah.muhasabah.average")): \(Self.oneDecimal(average)) / 10")
                    .font(.title3.weight(.semibold))
                    .monospacedDigit()
                if let change = summary.change {
                    Text(Self.changeText(change))
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                chart(trend)
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(istr("ibadah.muhasabah.chartLabel"))
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(MuhasabahAspect.allCases, id: \.self) { aspect in
                        if let value = summary.aspects[aspect] {
                            HStack {
                                Text(Self.aspectName(aspect))
                                Spacer()
                                Text(Self.oneDecimal(value))
                                    .monospacedDigit()
                                    .foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: 280)
                        }
                    }
                }
            } else {
                Text(istr("ibadah.muhasabah.noRatings"))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.secondary.opacity(0.07)))
    }

    /// The mean rating of each of the last days as a bar, oldest on the left.
    private func chart(_ trend: [MuhasabahTrendDay]) -> some View {
        HStack(alignment: .bottom, spacing: 3) {
            ForEach(trend, id: \.date) { day in
                RoundedRectangle(cornerRadius: 2)
                    .fill(day.average == nil ? Color.secondary.opacity(0.2) : Color.waqtuPrimary)
                    .frame(height: day.average.map { max(4, CGFloat($0) / 10 * 80) } ?? 4)
                    .frame(maxWidth: .infinity)
            }
        }
        .frame(height: 80, alignment: .bottom)
        .frame(maxWidth: 420)
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
                VStack(alignment: .leading, spacing: 18) {
                    Text(istr("ibadah.muhasabah.entryTitle \(MuhasabahView.dayTitle(date))"))
                        .font(.title3.bold())
                    ForEach(0..<Muhasabah.questions.count, id: \.self) { index in
                        question(Muhasabah.questions[index])
                    }
                }
                .padding(24)
            }
            Divider()
            HStack {
                if model.journalEntry(date) != nil {
                    Button(istr("ibadah.muhasabah.delete"), role: .destructive) { confirmDelete = true }
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
                Button(istr("ibadah.muhasabah.save")) {
                    model.saveJournal(draft)
                    onClose()
                }
                .keyboardShortcut(.defaultAction)
                .buttonStyle(.borderedProminent)
                .tint(.waqtuPrimary)
            }
            .padding(16)
        }
        .frame(minWidth: 520, idealWidth: 560, minHeight: 560, idealHeight: 680)
    }

    @ViewBuilder
    private func question(_ question: MuhasabahQuestion) -> some View {
        switch question {
        case .text(let field):
            VStack(alignment: .leading, spacing: 6) {
                Text(Self.prompt(field))
                    .font(.headline)
                TextEditor(text: Binding(
                    get: { draft.text(field) ?? "" },
                    set: { draft.set(field, $0) }))
                    .font(.body)
                    .scrollContentBackground(.hidden)
                    .frame(height: 76)
                    .padding(4)
                    .background(RoundedRectangle(cornerRadius: 6).fill(Color.secondary.opacity(0.08)))
                    .overlay(alignment: .topLeading) {
                        if (draft.text(field) ?? "").isEmpty {
                            Text(Self.placeholder(field))
                                .foregroundStyle(.tertiary)
                                .padding(.horizontal, 9)
                                .padding(.vertical, 12)
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
        return VStack(alignment: .leading, spacing: 6) {
            Text(Self.ratingPrompt(aspect))
                .font(.headline)
            HStack(spacing: 4) {
                ForEach(Muhasabah.ratingMin...Muhasabah.ratingMax, id: \.self) { n in
                    Button {
                        draft.set(aspect, value == n ? nil : n)
                    } label: {
                        Text("\(n)")
                            .monospacedDigit()
                            .frame(width: 34, height: 30)
                            .foregroundStyle(value == n ? Color.white : Color.primary)
                            .background(RoundedRectangle(cornerRadius: 6)
                                .fill(value == n ? Color.waqtuPrimary : Color.secondary.opacity(0.12)))
                    }
                    .buttonStyle(.plain)
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
                        .buttonStyle(.link)
                }
                Spacer()
                Text(Self.highLabel(aspect))
            }
            .font(.caption)
            .foregroundStyle(.secondary)
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
