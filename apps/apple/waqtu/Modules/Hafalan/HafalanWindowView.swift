//
//  HafalanWindowView.swift
//  waqtu
//
//  The hafalan window: the Mac's local plan and its half-page parts, and every surah page by page,
//  each opening in the self-test (QuranPassageView).
//

import SwiftUI

struct HafalanWindowView: View {
    @State var model: HafalanModel

    var body: some View {
        NavigationSplitView {
            List(selection: $model.selection) {
                Section(mstr("hafalan.planTitle")) {
                    if let plan = model.plan {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(HafalanModel.targetLabel(plan.target)).font(.headline)
                            Text(mstr("hafalan.planDates \(plan.startDay) \(plan.deadline)"))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .tag(Optional(HafalanModel.Selection.newPlan))
                        ForEach(model.units, id: \.index) { unit in
                            VStack(alignment: .leading, spacing: 1) {
                                Text(HafalanModel.unitLabel(unit))
                                Text(mstr("hafalan.page \(unit.page)"))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .tag(Optional(HafalanModel.Selection.unit(unit.index)))
                        }
                    } else {
                        Label(mstr("hafalan.newPlan"), systemImage: "plus")
                            .tag(Optional(HafalanModel.Selection.newPlan))
                    }
                }
                Section(mstr("hafalan.surahs")) {
                    ForEach(1...Quran.totalSurahs, id: \.self) { surah in
                        Text("\(surah). \(HafalanModel.surahName(surah))")
                            .tag(Optional(HafalanModel.Selection.surah(surah)))
                    }
                }
            }
            .navigationSplitViewColumnWidth(min: 240, ideal: 280)
        } detail: {
            detail
                .id(model.selection)
        }
        .frame(minWidth: 760, minHeight: 520)
    }

    @ViewBuilder
    private var detail: some View {
        switch model.selection {
        case .newPlan:
            HafalanPlanView(model: model)
        case .unit(let index):
            if index < model.units.count {
                let unit = model.units[index]
                QuranPassageView(
                    title: HafalanModel.unitLabel(unit),
                    subtitle: mstr("hafalan.page \(unit.page)"),
                    blocks: QuranBlock.blocks(unit.range, text: model.text))
            }
        case .surah(let surah):
            SurahPagesView(model: model, surah: surah)
        case nil:
            Text(mstr("hafalan.selectHint")).foregroundStyle(.secondary)
        }
    }
}

/// One surah, one mushaf page at a time (a page is short enough for the word-by-word test).
private struct SurahPagesView: View {
    let model: HafalanModel
    let surah: Int
    @State private var page: Int

    init(model: HafalanModel, surah: Int) {
        self.model = model
        self.surah = surah
        _page = State(initialValue: Quran.page(ofIndex: Quran.surahRange(surah).start))
    }

    private var pages: ClosedRange<Int> {
        let range = Quran.surahRange(surah)
        return Quran.page(ofIndex: range.start)...Quran.page(ofIndex: range.end)
    }

    var body: some View {
        let surahRange = Quran.surahRange(surah)
        let pageRange = Quran.pageRange(page)
        let range = AyahRange(start: max(surahRange.start, pageRange.start), end: min(surahRange.end, pageRange.end))
        VStack(spacing: 0) {
            QuranPassageView(
                title: HafalanModel.surahName(surah),
                subtitle: mstr("hafalan.page \(page)"),
                blocks: QuranBlock.blocks(range, text: model.text))
                .id(page)
            Divider()
            HStack {
                Button(mstr("hafalan.prevPage")) { page -= 1 }
                    .disabled(page <= pages.lowerBound)
                Spacer()
                Text(mstr("hafalan.page \(page)")).foregroundStyle(.secondary)
                Spacer()
                Button(mstr("hafalan.nextPage")) { page += 1 }
                    .disabled(page >= pages.upperBound)
            }
            .padding(12)
        }
    }
}

/// The plan: create one, or see and change the current one.
private struct HafalanPlanView: View {
    let model: HafalanModel
    @State private var kind: HafalanTarget.Kind = .juz
    @State private var from = 30
    @State private var to = 30
    @State private var start = Date()
    @State private var days = 30
    @State private var confirmDelete = false

    private var target: HafalanTarget { HafalanTarget(kind: kind, from: from, to: max(from, to)) }

    private var draft: HafalanPlan {
        let startDay = CivilDay(start)
        return HafalanPlan(target: target, startDay: startDay.key, deadline: startDay.adding(days: max(1, days) - 1).key)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                if let plan = model.plan {
                    overview(plan)
                    Divider()
                }
                form
                Text(mstr("hafalan.localNote"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                QuranCreditView()
            }
            .padding(24)
            .frame(maxWidth: 560, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .onAppear {
            guard let plan = model.plan else { return }
            kind = plan.target.kind
            from = plan.target.from
            to = plan.target.to
            days = plan.totalDays
        }
    }

    private func overview(_ plan: HafalanPlan) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(HafalanModel.targetLabel(plan.target)).font(.title2.bold())
            Text(mstr("hafalan.planDates \(plan.startDay) \(plan.deadline)")).foregroundStyle(.secondary)
            let pages = Set(model.units.map(\.page)).count
            Text(mstr("hafalan.preview \(model.units.count) \(pages)"))
            Text(mstr("hafalan.perDay \(plan.perDay(unitCount: model.units.count))"))
            Text(mstr("hafalan.partNote")).font(.caption).foregroundStyle(.secondary)
            Button(mstr("hafalan.deletePlan"), role: .destructive) { confirmDelete = true }
                .confirmationDialog(mstr("hafalan.deleteTitle"), isPresented: $confirmDelete) {
                    Button(mstr("hafalan.confirmDelete"), role: .destructive) { model.deletePlan() }
                    Button(mstr("hafalan.cancel"), role: .cancel) {}
                } message: {
                    Text(mstr("hafalan.deleteBody"))
                }
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(model.plan == nil ? mstr("hafalan.newPlan") : mstr("hafalan.changePlan")).font(.headline)
            Picker(mstr("hafalan.kindLabel"), selection: $kind) {
                Text(mstr("hafalan.kind.surah")).tag(HafalanTarget.Kind.surah)
                Text(mstr("hafalan.kind.juz")).tag(HafalanTarget.Kind.juz)
                Text(mstr("hafalan.kind.pages")).tag(HafalanTarget.Kind.pages)
            }
            .pickerStyle(.segmented)
            .onChange(of: kind) { _, next in
                let defaults: (Int, Int) = next == .surah ? (78, 114) : next == .juz ? (30, 30) : (582, 604)
                from = defaults.0
                to = defaults.1
            }
            Stepper(value: $from, in: 1...maxValue) {
                Text("\(mstr("hafalan.from")): \(rangeLabel(from))")
            }
            Stepper(value: $to, in: from...maxValue) {
                Text("\(mstr("hafalan.toLabel")): \(rangeLabel(max(from, to)))")
            }
            DatePicker(mstr("hafalan.startDay"), selection: $start, displayedComponents: .date)
            Stepper(value: $days, in: 1...3650) {
                Text("\(mstr("hafalan.days")): \(days)")
            }
            if let count = model.unitCount(for: target) {
                Text(mstr("hafalan.preview \(count.units) \(count.pages)"))
                    .foregroundStyle(.secondary)
                Text(mstr("hafalan.perDay \(draft.perDay(unitCount: count.units))"))
                    .foregroundStyle(.secondary)
            } else {
                Text(mstr("hafalan.invalidTarget")).foregroundStyle(.red)
            }
            Button(mstr("hafalan.start")) { _ = model.save(draft) }
                .buttonStyle(.borderedProminent)
                .tint(.waqtuPrimary)
                .disabled(draft.problem != nil)
        }
    }

    private var maxValue: Int {
        switch kind {
        case .surah: return Quran.totalSurahs
        case .juz: return Quran.totalJuz
        case .pages: return Quran.totalPages
        }
    }

    private func rangeLabel(_ n: Int) -> String {
        kind == .surah ? "\(n). \(Quran.surahInfo(n)?.id ?? "")" : "\(n)"
    }
}
