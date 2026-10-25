//
//  QuranText.swift
//  waqtu
//
//  Tanzil's Uthmani Quran text (content/quran/quran-uthmani-1.1.txt, bundled byte for byte with its
//  copyright notice) and the helpers of packages/core/src/quran.ts and quran-text.ts. They only
//  read the text; the stored strings are never changed (the Bismillah is lifted out for display
//  only, ayah markers are drawn next to the text).
//

import Foundation

/// Inclusive range of global ayah indexes.
struct AyahRange: Equatable {
    let start: Int
    let end: Int
}

struct AyahRef: Equatable {
    let surah: Int
    let ayah: Int
}

enum Quran {
    static let totalAyahs = 6236
    static var totalSurahs: Int { QuranMeta.surahs.count }
    static var totalPages: Int { QuranMeta.pageStart.count }
    static var totalJuz: Int { QuranMeta.juzStart.count }

    /// Global 0-based index of the first ayah of each surah.
    static let surahOffset: [Int] = {
        var offsets: [Int] = []
        var total = 0
        for s in QuranMeta.surahs {
            offsets.append(total)
            total += s.ayahs
        }
        return offsets
    }()

    static func surahInfo(_ surah: Int) -> SurahInfo? {
        guard surah >= 1, surah <= totalSurahs else { return nil }
        return QuranMeta.surahs[surah - 1]
    }

    /// Global 0-based index of `surah:ayah`, nil when out of range.
    static func ayahIndex(surah: Int, ayah: Int) -> Int? {
        guard let info = surahInfo(surah), ayah >= 1, ayah <= info.ayahs else { return nil }
        return surahOffset[surah - 1] + ayah - 1
    }

    /// Last element of `starts` that is <= `index` (1-based position).
    private static func position(of index: Int, in starts: [Int]) -> Int {
        var lo = 0
        var hi = starts.count - 1
        while lo < hi {
            let mid = (lo + hi + 1) / 2
            if starts[mid] <= index { lo = mid } else { hi = mid - 1 }
        }
        return lo + 1
    }

    static func ref(ofIndex index: Int) -> AyahRef {
        let surah = position(of: index, in: surahOffset)
        return AyahRef(surah: surah, ayah: index - surahOffset[surah - 1] + 1)
    }

    static func surahRange(_ surah: Int) -> AyahRange {
        let start = surahOffset[surah - 1]
        return AyahRange(start: start, end: start + QuranMeta.surahs[surah - 1].ayahs - 1)
    }

    /// Ayahs that begin on `page` of the Madinah mushaf; an ayah that runs on belongs to the page it starts on.
    static func pageRange(_ page: Int) -> AyahRange {
        let starts = QuranMeta.pageStart
        return AyahRange(start: starts[page - 1], end: page == starts.count ? totalAyahs - 1 : starts[page] - 1)
    }

    static func juzRange(_ juz: Int) -> AyahRange {
        let starts = QuranMeta.juzStart
        return AyahRange(start: starts[juz - 1], end: juz == starts.count ? totalAyahs - 1 : starts[juz] - 1)
    }

    /// Page (1..604) an ayah begins on.
    static func page(ofIndex index: Int) -> Int { position(of: index, in: QuranMeta.pageStart) }

    static func juz(ofIndex index: Int) -> Int { position(of: index, in: QuranMeta.juzStart) }

    // MARK: - Text helpers (quran-text.ts)

    /// Tanzil's text for 1:1 (as scalars, so no editor can reorder its marks), also the prefix it
    /// puts in front of ayah 1 of every surah except 1 and 9.
    static let bismillah = "\u{0628}\u{0650}\u{0633}\u{0652}\u{0645}\u{0650} \u{0671}\u{0644}\u{0644}\u{0651}\u{064E}\u{0647}\u{0650} \u{0671}\u{0644}\u{0631}\u{0651}\u{064E}\u{062D}\u{0652}\u{0645}\u{064E}\u{0670}\u{0646}\u{0650} \u{0671}\u{0644}\u{0631}\u{0651}\u{064E}\u{062D}\u{0650}\u{064A}\u{0645}\u{0650}"

    /// Arabic letters (not the combining marks, waqf signs and ayah/sajdah symbols around them).
    static func isLetter(_ scalar: Unicode.Scalar) -> Bool {
        switch scalar.value {
        case 0x0620...0x064A, 0x066E...0x06D3, 0x06D5, 0x06FA...0x06FF: return true
        default: return false
        }
    }

    /// Surah 9 has no Bismillah; in surah 1 it is ayah 1 itself.
    static func hasSeparateBismillah(_ surah: Int) -> Bool { surah != 1 && surah != 9 }

    private static func letters(_ text: String) -> String {
        var out = String.UnicodeScalarView()
        for scalar in text.unicodeScalars where isLetter(scalar) { out.append(scalar) }
        return String(out)
    }

    /// Splits on U+0020 exactly like JavaScript's `split(" ")` (by scalars, not grapheme clusters).
    static func tokens(_ text: String) -> [String] {
        text.components(separatedBy: " ")
    }

    private static let bismillahWords = tokens(bismillah).count
    private static let bismillahLetters = letters(bismillah)

    /// Tanzil stores the Bismillah of a surah in front of its first ayah. For display it becomes a
    /// heading: `bismillah` is that prefix exactly as stored (nil when the ayah has none) and `text`
    /// is what follows it.
    static func splitBismillah(surah: Int, ayah: Int, text: String) -> (bismillah: String?, text: String) {
        guard ayah == 1, hasSeparateBismillah(surah) else { return (nil, text) }
        let parts = tokens(text)
        let head = parts.prefix(bismillahWords).joined(separator: " ")
        guard parts.count > bismillahWords, letters(head) == bismillahLetters else { return (nil, text) }
        return (head, parts.dropFirst(bismillahWords).joined(separator: " "))
    }

    /// Words of an ayah: its space-separated tokens (waqf signs stay attached to the word before).
    static func words(_ text: String) -> [String] {
        tokens(text).filter { !$0.isEmpty }
    }

    private static func clusters(_ word: String) -> [String.UnicodeScalarView] {
        var out: [String.UnicodeScalarView] = []
        for scalar in word.unicodeScalars {
            if isLetter(scalar) || out.isEmpty {
                out.append(String.UnicodeScalarView([scalar]))
            } else {
                out[out.count - 1].append(scalar)
            }
        }
        return out
    }

    /// The beginning of a word as a self-test hint: its first letter with its marks; for a word
    /// that starts with the article (alef wasla + lam) the first letter of the noun is included too.
    static func firstLetters(_ word: String) -> String {
        let parts = clusters(word)
        guard parts.count > 1 else { return word }
        let article = parts[0].first?.value == 0x0671 && parts[1].first?.value == 0x0644 && parts.count > 2
        var out = String.UnicodeScalarView()
        for part in parts.prefix(article ? 3 : 1) { out.append(contentsOf: part) }
        return String(out)
    }

    /// Arabic-Indic digits, as the mushaf prints ayah numbers.
    static func arabicDigits(_ n: Int) -> String {
        String(String(n).unicodeScalars.map { scalar -> Character in
            guard let digit = Int(String(scalar)) else { return Character(scalar) }
            return Character(Unicode.Scalar(0x0660 + UInt32(digit)) ?? scalar)
        })
    }
}

struct QuranTextError: Error, Equatable {
    let message: String
}

/// The whole text, ayah by ayah, exactly as Tanzil ships it.
struct QuranText {
    /// `ayahs[surah - 1][ayah - 1]`.
    let ayahs: [[String]]
    /// Words of each ayah by global index, Bismillah prefix excluded (core's AYAH_WORDS).
    let wordCounts: [Int]

    /// Parses Tanzil's `surah|ayah|text` file; `#` lines are the copyright notice. Checks that every
    /// ayah is there, in order, with the metadata's counts.
    init(fileContents: String) throws {
        var ayahs: [[String]] = Array(repeating: [], count: Quran.totalSurahs)
        // Split by UTF-16 units: "\r\n" would be one Character and dodge a Character split.
        for line in fileContents.components(separatedBy: "\n") {
            let trimmed = line.hasSuffix("\r") ? String(line.utf16.dropLast()) ?? line : line
            if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }
            let parts = trimmed.split(separator: "|", maxSplits: 2, omittingEmptySubsequences: false)
            guard parts.count == 3, let surah = Int(parts[0]), let ayah = Int(parts[1]),
                  surah >= 1, surah <= Quran.totalSurahs, ayah == ayahs[surah - 1].count + 1 else {
                throw QuranTextError(message: "Unexpected line: \(trimmed.prefix(20))")
            }
            ayahs[surah - 1].append(String(parts[2]))
        }
        for (i, info) in QuranMeta.surahs.enumerated() where ayahs[i].count != info.ayahs {
            throw QuranTextError(message: "Surah \(i + 1) has \(ayahs[i].count) ayahs, expected \(info.ayahs)")
        }
        self.ayahs = ayahs
        var counts: [Int] = []
        counts.reserveCapacity(Quran.totalAyahs)
        for (s, list) in ayahs.enumerated() {
            for (a, text) in list.enumerated() {
                counts.append(Quran.words(Quran.splitBismillah(surah: s + 1, ayah: a + 1, text: text).text).count)
            }
        }
        wordCounts = counts
    }

    init(contentsOf url: URL) throws {
        try self.init(fileContents: try String(contentsOf: url, encoding: .utf8))
    }

    func text(_ index: Int) -> String {
        let ref = Quran.ref(ofIndex: index)
        return ayahs[ref.surah - 1][ref.ayah - 1]
    }
}

struct QuranAyah: Equatable {
    let surah: Int
    let ayah: Int
    /// Global ayah index.
    let index: Int
    let words: [String]
}

/// The part of a passage that lies in one surah (apps/mobile/src/hafalan/text.ts).
struct QuranBlock: Equatable {
    let surah: Int
    /// Begins at ayah 1, so the surah's name heading belongs above it.
    let startsSurah: Bool
    /// The Bismillah heading when the block begins at ayah 1 of a surah that has one before its text.
    var bismillah: String?
    var ayahs: [QuranAyah]

    /// A passage's ayahs grouped by surah, split into words, with the Bismillah lifted out of ayah 1.
    static func blocks(_ range: AyahRange, text: QuranText) -> [QuranBlock] {
        var blocks: [QuranBlock] = []
        guard range.start <= range.end else { return blocks }
        for index in range.start...range.end {
            let ref = Quran.ref(ofIndex: index)
            if blocks.last?.surah != ref.surah {
                blocks.append(QuranBlock(surah: ref.surah, startsSurah: ref.ayah == 1, bismillah: nil, ayahs: []))
            }
            let split = Quran.splitBismillah(surah: ref.surah, ayah: ref.ayah, text: text.text(index))
            if let b = split.bismillah { blocks[blocks.count - 1].bismillah = b }
            blocks[blocks.count - 1].ayahs.append(
                QuranAyah(surah: ref.surah, ayah: ref.ayah, index: index, words: Quran.words(split.text)))
        }
        return blocks
    }

    /// Key of one word in the reveal set of the self-test.
    static func wordKey(ayahIndex: Int, word: Int) -> String { "\(ayahIndex):\(word)" }

    /// Every word's key in reading order.
    static func wordKeys(_ blocks: [QuranBlock]) -> [String] {
        blocks.flatMap { b in b.ayahs.flatMap { a in a.words.indices.map { wordKey(ayahIndex: a.index, word: $0) } } }
    }
}
