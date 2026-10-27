//
//  DoaView.swift
//  waqtu
//
//  Daily duas by category, with search across every text and favourites
//  (apps/mobile/src/app/(ibadah)/doa). The Arabic, transliteration and translation are shown as
//  stored, with their source; only the list labels have Indonesian names. The list is a column of
//  plain buttons (see IbadahWindowView for why it is not a `List(selection:)`).
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
        IbadahScreen(title: istr("ibadah.doa.title"), controls: AnyView(controls)) {
            HStack(spacing: 0) {
                list
                    .frame(width: 330)
                Rectangle().fill(Color.wqStroke).frame(width: 1)
                detail
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .onAppear {
            if selection == nil { selection = IbadahLibrary.duas.first?.duas.first?.id }
        }
    }

    // MARK: - Search and filter

    private var controls: some View {
        HStack(spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.wqInkMuted)
                    .accessibilityHidden(true)
                TextField(istr("ibadah.doa.searchPlaceholder"), text: $query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13.5))
                    .foregroundStyle(Color.wqInk)
                    .accessibilityLabel(istr("ibadah.doa.search"))
                if !query.isEmpty {
                    Button {
                        query = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(Color.wqInkMuted)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(istr("ibadah.doa.search"))
                }
            }
            .padding(.horizontal, 10)
            .frame(width: 300, height: 34)
            .background(RoundedRectangle(cornerRadius: WQ.controlRadius, style: .continuous).fill(Color.wqSurfaceRaised))
            WQSegmented(
                options: [
                    WQOption(value: Filter.all, title: istr("ibadah.doa.all")),
                    WQOption(
                        value: Filter.favourites,
                        title: model.favourites.isEmpty
                            ? istr("ibadah.doa.favourites")
                            : "\(istr("ibadah.doa.favourites")) (\(model.favourites.count))"),
                ],
                selection: $filter)
                .accessibilityLabel(istr("ibadah.doa.title"))
        }
    }

    // MARK: - List

    @ViewBuilder
    private var list: some View {
        let groups = self.groups
        if groups.isEmpty {
            Text(filter == .favourites && query.trimmingCharacters(in: .whitespaces).isEmpty
                 ? istr("ibadah.doa.noFavourites")
                 : istr("ibadah.doa.noResults"))
                .font(.system(size: 13.5))
                .foregroundStyle(Color.wqInkMuted)
                .multilineTextAlignment(.center)
                .padding(24)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(groups) { group in
                        WQLabel(text: IbadahDoa.categoryName(group.category, english: english))
                            .padding(.horizontal, 10)
                            .padding(.top, 14)
                            .padding(.bottom, 4)
                        ForEach(group.duas) { dua in
                            DuaRow(
                                title: IbadahDoa.duaTitle(dua, english: english),
                                transliteration: dua.transliteration,
                                reference: dua.reference,
                                starred: model.favourites.contains(dua.id),
                                selected: selection == dua.id
                            ) {
                                selection = dua.id
                            }
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 16)
            }
        }
    }

    // MARK: - Detail

    @ViewBuilder
    private var detail: some View {
        if let id = selection, let found = IbadahContent.findDua(id, in: IbadahLibrary.duas) {
            DuaDetailView(model: model, dua: found.dua, category: found.category)
                .id(id)
        } else {
            Text(istr("ibadah.doa.selectHint"))
                .font(.system(size: 13.5))
                .foregroundStyle(Color.wqInkMuted)
                .padding(40)
        }
    }
}

private struct DuaRow: View {
    let title: String
    let transliteration: String
    let reference: String
    let starred: Bool
    let selected: Bool
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(selected ? Color.wqAccent : Color.wqInk)
                        .lineLimit(1)
                    Text(transliteration)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.wqInkMuted)
                        .lineLimit(1)
                    Text(reference)
                        .font(.system(size: 11))
                        .foregroundStyle(Color.wqInkMuted.opacity(0.8))
                        .lineLimit(1)
                }
                Spacer(minLength: 4)
                if starred {
                    Image(systemName: "star.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.wqGold)
                        .accessibilityLabel(istr("ibadah.doa.isFavourite"))
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: WQ.controlRadius, style: .continuous)
                    .fill(selected ? Color.wqAccent.opacity(0.14) : (hovering ? Color.wqInk.opacity(0.06) : Color.clear)))
            .contentShape(RoundedRectangle(cornerRadius: WQ.controlRadius, style: .continuous))
        }
        .buttonStyle(WQPressStyle(scale: 0.98))
        .onHover { hovering = $0 }
        .accessibilityAddTraits(selected ? .isSelected : [])
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
                HStack(alignment: .top, spacing: 12) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(IbadahDoa.duaTitle(dua, english: english))
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(Color.wqInk)
                        WQBadge(text: IbadahDoa.categoryName(category, english: english), tint: .wqAccent)
                    }
                    Spacer(minLength: 8)
                    Button {
                        model.toggleFavourite(dua.id)
                    } label: {
                        Label(starred ? istr("ibadah.doa.unfavourite") : istr("ibadah.doa.favourite"),
                              systemImage: starred ? "star.fill" : "star")
                    }
                    .buttonStyle(WQTintedButtonStyle(tint: starred ? .wqGold : .wqInkMuted))
                }
                Text(dua.arabic)
                    .font(QuranFont.font(size: 32))
                    .foregroundStyle(Color.wqInk)
                    .lineSpacing(11)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .textSelection(.enabled)
                    .wqCard(padding: 20)
                VStack(alignment: .leading, spacing: 16) {
                    section(istr("ibadah.doa.transliteration"), dua.transliteration, color: .wqAccent, weight: .medium)
                    VStack(alignment: .leading, spacing: 4) {
                        section(istr("ibadah.doa.translation"), dua.translation, color: Color.wqInk.opacity(0.85))
                        // The translations in duas.json are in English; say so in the Indonesian UI.
                        if !english {
                            Text(istr("ibadah.doa.translationEn"))
                                .font(.system(size: 11.5))
                                .foregroundStyle(Color.wqInkMuted)
                        }
                    }
                    if let notes = dua.notes {
                        section(istr("ibadah.doa.notes"), notes, color: Color.wqInk.opacity(0.85))
                    }
                    section(istr("ibadah.doa.source"), dua.reference, color: .wqInkMuted, size: 13)
                }
                .padding(.horizontal, 4)
            }
            .padding(.horizontal, 28)
            .padding(.vertical, 20)
            .frame(maxWidth: 760, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func section(
        _ title: String, _ text: String, color: Color, size: CGFloat = 14.5, weight: Font.Weight = .regular
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            WQLabel(text: title)
            Text(text)
                .font(.system(size: size, weight: weight))
                .foregroundStyle(color)
                .lineSpacing(3)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
