//
//  QuranPassageView.swift
//  waqtu
//
//  A passage of the mushaf in Uthmani script, right to left, with the hide-words self-test of
//  apps/mobile/src/hafalan/components/UnitText.tsx: show, hide words, or first letters; clicking a
//  covered word reveals it. Always carries the Tanzil credit and link.
//

import SwiftUI

enum QuranTestMode: String, CaseIterable, Identifiable {
    case show, hide, letters
    var id: String { rawValue }

    var label: String {
        switch self {
        case .show: return mstr("hafalan.modeShow")
        case .hide: return mstr("hafalan.modeHide")
        case .letters: return mstr("hafalan.modeLetters")
        }
    }
}

struct QuranPassageView: View {
    let title: String
    let subtitle: String?
    let blocks: [QuranBlock]
    @State private var mode: QuranTestMode = .show
    @State private var revealed: Set<String> = []
    @State private var fontSize: CGFloat = 28

    private var keys: [String] { QuranBlock.wordKeys(blocks) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.title2.bold())
                    if let subtitle {
                        Text(subtitle).foregroundStyle(.secondary)
                    }
                }

                controls

                VStack(spacing: 14) {
                    ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                        blockView(block)
                    }
                }
                .padding(18)
                .frame(maxWidth: .infinity)
                .background(RoundedRectangle(cornerRadius: 10).fill(Color.secondary.opacity(0.07)))

                QuranCreditView()
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(mstr("hafalan.test")).font(.headline)
                Spacer()
                Picker(mstr("hafalan.test"), selection: $mode) {
                    ForEach(QuranTestMode.allCases) { Text($0.label).tag($0) }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                .frame(maxWidth: 360)
            }
            if mode != .show {
                HStack(spacing: 8) {
                    Button(mstr("hafalan.revealNext")) {
                        if let next = keys.first(where: { !revealed.contains($0) }) { revealed.insert(next) }
                    }
                    .keyboardShortcut(.space, modifiers: [])
                    Button(mstr("hafalan.revealAll")) { revealed = Set(keys) }
                    Button(mstr("hafalan.hideAll")) { revealed = [] }
                    Spacer()
                }
                Text(mstr("hafalan.testHint"))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            HStack(spacing: 6) {
                Image(systemName: "textformat.size.smaller")
                Slider(value: $fontSize, in: 20...44)
                    .frame(maxWidth: 180)
                Image(systemName: "textformat.size.larger")
            }
            .foregroundStyle(.secondary)
        }
    }

    @ViewBuilder
    private func blockView(_ block: QuranBlock) -> some View {
        VStack(spacing: 10) {
            if block.startsSurah, let info = Quran.surahInfo(block.surah) {
                VStack(spacing: 2) {
                    Text(info.arabic)
                        .font(QuranFont.font(size: fontSize))
                        .foregroundStyle(Color.waqtuPrimary)
                    Text(mstr("hafalan.surahLabel \(HafalanModel.surahName(block.surah))"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                Divider()
            }
            if let bismillah = block.bismillah {
                Text(bismillah)
                    .font(QuranFont.font(size: fontSize))
                    .frame(maxWidth: .infinity)
            }
            RightToLeftFlow(spacing: fontSize * 0.3, lineSpacing: fontSize * 0.45) {
                ForEach(block.ayahs, id: \.index) { ayah in
                    ForEach(Array(ayah.words.enumerated()), id: \.offset) { i, word in
                        wordView(word, key: QuranBlock.wordKey(ayahIndex: ayah.index, word: i))
                    }
                    Text("\u{FD3F}\(Quran.arabicDigits(ayah.ayah))\u{FD3E}")
                        .font(QuranFont.font(size: fontSize * 0.85))
                        .foregroundStyle(Color.waqtuPrimary)
                }
            }
        }
    }

    @ViewBuilder
    private func wordView(_ word: String, key: String) -> some View {
        if mode == .show || revealed.contains(key) {
            Text(word).font(QuranFont.font(size: fontSize))
        } else {
            Button {
                revealed.insert(key)
            } label: {
                Text(mode == .letters ? "\(Quran.firstLetters(word))…" : Self.mask(word))
                    .font(QuranFont.font(size: fontSize))
                    .padding(.horizontal, 2)
                    .background(RoundedRectangle(cornerRadius: 4).fill(Color.secondary.opacity(0.25)))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(mstr("hafalan.hiddenWord"))
        }
    }

    /// A covered word keeps roughly its length as blanks, so lines break where they would.
    private static func mask(_ word: String) -> String {
        String(repeating: "\u{00A0}", count: max(2, min(10, Int((Double(word.utf16.count) / 2).rounded()))))
    }
}

/// Tanzil's terms ask that the text's source is named and linked to tanzil.net.
struct QuranCreditView: View {
    var body: some View {
        if let url = URL(string: "https://tanzil.net") {
            Link(mstr("hafalan.credit"), destination: url)
                .font(.caption)
        }
    }
}

/// Lays out words in lines from the right edge, wrapping to the next line like Arabic text.
struct RightToLeftFlow: Layout {
    var spacing: CGFloat
    var lineSpacing: CGFloat

    private func rows(_ sizes: [CGSize], width: CGFloat) -> [[Int]] {
        var rows: [[Int]] = [[]]
        var x: CGFloat = 0
        for (i, size) in sizes.enumerated() {
            if !rows[rows.count - 1].isEmpty, x + size.width > width {
                rows.append([])
                x = 0
            }
            rows[rows.count - 1].append(i)
            x += size.width + spacing
        }
        return rows
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        let width = proposal.width ?? sizes.reduce(0) { $0 + $1.width + spacing }
        let lines = rows(sizes, width: width)
        let height = lines.reduce(0) { total, row in
            total + (row.map { sizes[$0].height }.max() ?? 0)
        } + lineSpacing * CGFloat(max(0, lines.count - 1))
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let sizes = subviews.map { $0.sizeThatFits(.unspecified) }
        var y = bounds.minY
        for row in rows(sizes, width: bounds.width) {
            let height = row.map { sizes[$0].height }.max() ?? 0
            var x = bounds.maxX
            for i in row {
                subviews[i].place(
                    at: CGPoint(x: x, y: y + height / 2),
                    anchor: .trailing,
                    proposal: ProposedViewSize(sizes[i]))
                x -= sizes[i].width + spacing
            }
            y += height + lineSpacing
        }
    }
}
