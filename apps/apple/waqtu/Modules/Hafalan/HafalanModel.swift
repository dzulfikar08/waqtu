//
//  HafalanModel.swift
//  waqtu
//
//  The hafalan window's state: the bundled Quran text, the Mac's local plan and its units, and what
//  the detail pane shows.
//

import AppKit
import CoreText
import Foundation
import Observation
import SwiftUI

@MainActor
@Observable
final class HafalanModel {
    enum Selection: Hashable {
        case newPlan
        case unit(Int)
        case surah(Int)
    }

    let text: QuranText
    private(set) var plan: HafalanPlan?
    private(set) var units: [HafalanUnit] = []
    var selection: Selection?

    @ObservationIgnored private let store: HafalanPlanStore

    init(text: QuranText, store: HafalanPlanStore) {
        self.text = text
        self.store = store
        load(store.plan)
        selection = plan == nil ? .newPlan : units.isEmpty ? nil : .unit(0)
    }

    /// Tanzil's text bundled byte for byte (content/quran/quran-uthmani-1.1.txt), parsed once.
    static let bundledText: QuranText? = {
        guard let url = Bundle.main.url(forResource: "quran-uthmani-1.1", withExtension: "txt") else { return nil }
        return try? QuranText(contentsOf: url)
    }()

    private func load(_ next: HafalanPlan?) {
        plan = next
        if let range = next?.target.range {
            units = HafalanUnit.build(range, wordCounts: text.wordCounts)
        } else {
            units = []
        }
    }

    func save(_ next: HafalanPlan) -> Bool {
        guard store.save(next) else { return false }
        load(next)
        selection = units.isEmpty ? nil : .unit(0)
        return true
    }

    func deletePlan() {
        store.delete()
        load(nil)
        selection = .newPlan
    }

    func unitCount(for target: HafalanTarget) -> (units: Int, pages: Int)? {
        guard let range = target.range else { return nil }
        let units = HafalanUnit.build(range, wordCounts: text.wordCounts)
        return (units.count, Set(units.map(\.page)).count)
    }

    // MARK: - Labels (apps/mobile/src/hafalan/format.ts, PlanOverview.tsx)

    /// Surah name for the language: the Indonesian transliteration, plus the English meaning in English.
    static func surahName(_ surah: Int) -> String {
        guard let info = Quran.surahInfo(surah) else { return "" }
        return ModuleLocale.english ? "\(info.id) (\(info.en))" : info.id
    }

    /// `An-Naba' 1–16`, or `An-Naba' 40 – An-Nazi'at 5` when the unit crosses a surah.
    static func unitLabel(_ unit: HafalanUnit) -> String {
        let a = Quran.ref(ofIndex: unit.start)
        let b = Quran.ref(ofIndex: unit.end)
        let first = Quran.surahInfo(a.surah)?.id ?? ""
        if a.surah == b.surah {
            return a.ayah == b.ayah ? "\(first) \(a.ayah)" : "\(first) \(a.ayah)–\(b.ayah)"
        }
        return "\(first) \(a.ayah) – \(Quran.surahInfo(b.surah)?.id ?? "") \(b.ayah)"
    }

    static func targetLabel(_ target: HafalanTarget) -> String {
        let single = target.from == target.to
        switch target.kind {
        case .surah:
            let from = Quran.surahInfo(target.from)?.id ?? ""
            let to = Quran.surahInfo(target.to)?.id ?? ""
            return single ? mstr("hafalan.target.surah \(from)") : mstr("hafalan.target.surahRange \(from) \(to)")
        case .juz:
            return single ? mstr("hafalan.target.juz \(target.from)") : mstr("hafalan.target.juzRange \(target.from) \(target.to)")
        case .pages:
            return single ? mstr("hafalan.target.pages \(target.from)") : mstr("hafalan.target.pagesRange \(target.from) \(target.to)")
        }
    }
}

/// Amiri Quran (SIL OFL 1.1, bundled unmodified from apps/mobile/assets/fonts), registered for this
/// process on first use. Falls back to the system font when it is missing.
enum QuranFont {
    private static let name: String? = {
        guard let url = Bundle.main.url(forResource: "AmiriQuran-Regular", withExtension: "ttf") else { return nil }
        guard let descriptors = CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as? [CTFontDescriptor],
              let first = descriptors.first,
              let postScript = CTFontDescriptorCopyAttribute(first, kCTFontNameAttribute) as? String else { return nil }
        if NSFont(name: postScript, size: 12) == nil {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
        return postScript
    }()

    static func font(size: CGFloat) -> Font {
        if let name { return .custom(name, size: size) }
        return .system(size: size)
    }
}
