//
//  DoaView.swift
//  waqtu
//
//  Daily duas by category, with search across every text and favourites
//  (apps/mobile/src/app/(ibadah)/doa). The Arabic, transliteration and translation are shown as
//  stored, with their source; only the list labels have Indonesian names.
//

import SwiftUI

struct DoaView: View {
    let model: IbadahModel

    private enum Filter: Hashable {
        case all, favourites
    }

    @State private var query = ""
    @State private var filter: Filter = .all
    @State private var selection: String?

    private let english = ModuleLocale.english

    private var groups: [DuaGroup] {
        let found = IbadahDoa.search(IbadahLibrary.duas, query: query, english: english)
        guard filter == .favourites else { return found }
        let favourites = model.favourites
        var starredGroups: [DuaGroup] = []
        for group in found {
            let starred = group.duas.filter { favourites.contains($0.id) }
            if !starred.isEmpty { starredGroups.append(DuaGroup(category: group.category, duas: starred)) }
        }
        return starredGroups
    }

    var body: some View {
        HSplitView {
            list
                .frame(minWidth: 300, idealWidth: 340, maxWidth: 460)
            detail
                .frame(minWidth: 360, maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    // MARK: - List

    private var list: some View {
        let groups = self.groups
        return VStack(spacing: 10) {
            TextField(istr("ibadah.doa.searchPlaceholder"), text: $query)
                .textFieldStyle(.roundedBorder)
                .accessibilityLabel(istr("ibadah.doa.search"))
            Picker(istr("ibadah.doa.title"), selection: $filter) {
                Text(istr("ibadah.doa.all")).tag(Filter.all)
                Text(model.favourites.isEmpty
                     ? istr("ibadah.doa.favourites")
                     : "\(istr("ibadah.doa.favourites")) (\(model.favourites.count))")
                    .tag(Filter.favourites)
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            if groups.isEmpty {
                Spacer()
                Text(filter == .favourites && query.trimmingCharacters(in: .whitespaces).isEmpty
                     ? istr("ibadah.doa.noFavourites")
                     : istr("ibadah.doa.noResults"))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding()
                Spacer()
            } else {
                List(selection: $selection) {
                    ForEach(groups) { group in
                        Section(IbadahDoa.categoryName(group.category, english: english)) {
                            ForEach(group.duas) { dua in
                                row(dua).tag(Optional(dua.id))
                            }
                        }
                    }
                }
            }
        }
        .padding(12)
    }

    private func row(_ dua: Dua) -> some View {
        let starred = model.favourites.contains(dua.id)
        return HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(IbadahDoa.duaTitle(dua, english: english))
                    .fontWeight(.semibold)
                Text(dua.transliteration)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                Text(dua.reference)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            Spacer(minLength: 4)
            if starred {
                Image(systemName: "star.fill")
                    .foregroundStyle(Color.waqtuGold)
                    .accessibilityLabel(istr("ibadah.doa.isFavourite"))
            }
        }
        .padding(.vertical, 2)
    }

    // MARK: - Detail

    @ViewBuilder
    private var detail: some View {
        if let id = selection, let found = IbadahContent.findDua(id, in: IbadahLibrary.duas) {
            DuaDetailView(model: model, dua: found.dua, category: found.category)
                .id(id)
        } else {
            Text(istr("ibadah.doa.selectHint"))
                .foregroundStyle(.secondary)
                .padding(40)
        }
    }
}

private struct DuaDetailView: View {
    let model: IbadahModel
    let dua: Dua
    let category: DuaCategory
    private let english = ModuleLocale.english

    var body: some View {
        let starred = model.favourites.contains(dua.id)
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(IbadahDoa.duaTitle(dua, english: english))
                        .font(.title2.bold())
                    Text(IbadahDoa.categoryName(category, english: english))
                        .foregroundStyle(.secondary)
                }
                Text(dua.arabic)
                    .font(QuranFont.font(size: 32))
                    .lineSpacing(16)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .textSelection(.enabled)
                    .padding(16)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Color.secondary.opacity(0.07)))
                section(istr("ibadah.doa.transliteration"), dua.transliteration)
                VStack(alignment: .leading, spacing: 4) {
                    section(istr("ibadah.doa.translation"), dua.translation)
                    // The translations in duas.json are in English; say so in the Indonesian UI.
                    if !english {
                        Text(istr("ibadah.doa.translationEn"))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                if let notes = dua.notes {
                    section(istr("ibadah.doa.notes"), notes)
                }
                section(istr("ibadah.doa.source"), dua.reference)
                Button {
                    model.toggleFavourite(dua.id)
                } label: {
                    Label(starred ? istr("ibadah.doa.unfavourite") : istr("ibadah.doa.favourite"),
                          systemImage: starred ? "star.fill" : "star")
                }
                .buttonStyle(.bordered)
                .tint(.waqtuPrimary)
            }
            .padding(24)
            .frame(maxWidth: 760, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func section(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)
            Text(text)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
