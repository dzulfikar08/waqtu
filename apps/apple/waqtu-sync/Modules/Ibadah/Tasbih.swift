//
//  Tasbih.swift
//  waqtu
//
//  The tasbih counter, a port of apps/mobile/src/ibadah/tasbih.ts: presets of phrases with their
//  targets (33 · 33 · 34, 100 of one phrase, or a free count), where a count lands, what a tap
//  reached, and the stored state. Pure; no UI.
//

import Foundation

enum TasbihPreset: String, CaseIterable, Equatable {
    case afterPrayer, tahlil, istighfar, salawat, custom
}

/// One stretch of a preset: a phrase (none for a free count) said `target` times; target 0 counts without end.
struct TasbihPhase: Equatable {
    let phrase: TasbihPhrase?
    let target: Int
}

struct TasbihState: Equatable {
    var preset: TasbihPreset
    /// Taps since the last reset, across rounds.
    var count: Int
    /// Target of the free count; 0 counts without a target.
    var customTarget: Int
    /// Click feedback on every tap (the phone's vibration).
    var feedback: Bool
    /// A custom counter item of the mutabaah checklist the count can be added to.
    var linkedItem: String?

    static let initial = TasbihState(preset: .afterPrayer, count: 0, customTarget: 0, feedback: true, linkedItem: nil)
}

struct TasbihPosition: Equatable {
    let phase: Int
    /// Count within the phase, 0 to its target.
    let inPhase: Int
    let target: Int
    /// Rounds finished before the current one.
    let rounds: Int
    /// The current round has just been finished (the counter shows its full target until the next tap).
    let roundComplete: Bool
}

/// What a tap reached: a plain count, the end of a phase (33 → the next phrase), or the end of a round.
enum TasbihTapEvent: Equatable {
    case tick, phase, round
}

struct TasbihContentError: Error, Equatable {
    let message: String
}

enum Tasbih {
    static let key = "ibadah.tasbih"
    static let maxCount = 1_000_000
    static let maxCustomTarget = 10_000

    private static func phrase(_ all: [TasbihPhrase], _ id: String) throws -> TasbihPhrase {
        guard let found = all.first(where: { $0.id == id }) else {
            throw TasbihContentError(message: "tasbih: missing phrase \(id)")
        }
        return found
    }

    /// The stretches of a preset: 33/33/34 after the prayer, 100 of one phrase, or the free count.
    static func phases(_ preset: TasbihPreset, phrases all: [TasbihPhrase], customTarget: Int) throws -> [TasbihPhase] {
        func of(_ id: String) throws -> TasbihPhase {
            let p = try phrase(all, id)
            return TasbihPhase(phrase: p, target: p.recommendedCount)
        }
        switch preset {
        case .afterPrayer:
            return [try of("subhanallah"), try of("alhamdulillah"), try of("allahu-akbar")]
        case .tahlil, .istighfar, .salawat:
            return [try of(preset.rawValue)]
        case .custom:
            return [TasbihPhase(phrase: nil, target: customTarget)]
        }
    }

    /// Taps in one full round of the phases; 0 when the count has no end.
    static func roundLength(_ phases: [TasbihPhase]) -> Int {
        if phases.contains(where: { $0.target <= 0 }) { return 0 }
        return phases.reduce(0) { $0 + $1.target }
    }

    /// Where `count` taps land: a finished round stays on show (34/34) until the next tap begins the next round.
    static func position(of count: Int, in phases: [TasbihPhase]) -> TasbihPosition {
        let round = roundLength(phases)
        if round == 0 {
            return TasbihPosition(phase: 0, inPhase: count, target: 0, rounds: 0, roundComplete: false)
        }
        let inRound = count == 0 ? 0 : ((count - 1) % round) + 1
        let rounds = count == 0 ? 0 : (count - 1) / round
        var before = 0
        for (i, phase) in phases.enumerated() {
            let end = before + phase.target
            if inRound <= end {
                return TasbihPosition(
                    phase: i, inPhase: inRound - before, target: phase.target,
                    rounds: rounds, roundComplete: inRound == round)
            }
            before = end
        }
        let last = phases.count - 1
        return TasbihPosition(
            phase: last, inPhase: phases[last].target, target: phases[last].target,
            rounds: rounds, roundComplete: true)
    }

    static func tap(_ state: TasbihState, phases: [TasbihPhase]) -> (state: TasbihState, event: TasbihTapEvent) {
        var next = state
        next.count = min(maxCount, state.count + 1)
        let at = position(of: next.count, in: phases)
        if at.roundComplete { return (next, .round) }
        if at.target > 0 && at.inPhase == at.target { return (next, .phase) }
        return (next, .tick)
    }

    static func undo(_ state: TasbihState) -> TasbihState {
        var next = state
        next.count = max(0, state.count - 1)
        return next
    }

    static func reset(_ state: TasbihState) -> TasbihState {
        var next = state
        next.count = 0
        return next
    }

    /// Switching preset starts the count again; the free count keeps its target.
    static func choosePreset(_ state: TasbihState, _ preset: TasbihPreset) -> TasbihState {
        if preset == state.preset { return state }
        var next = state
        next.preset = preset
        next.count = 0
        return next
    }

    static func setCustomTarget(_ state: TasbihState, _ target: Int) -> TasbihState {
        var next = state
        next.customTarget = max(0, min(maxCustomTarget, target))
        return next
    }

    // MARK: - Stored state (this Mac only)

    private static func wholeNumber(_ value: Any?) -> Int? {
        guard let n = value as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID() else { return nil }
        let d = n.doubleValue
        guard d.isFinite, d == d.rounded(), abs(d) < 1e9 else { return nil }
        return n.intValue
    }

    /// Stored state → state; missing or malformed fields take their defaults, so a bad value never loses the rest.
    static func parse(_ raw: String?) -> TasbihState {
        guard let raw, let data = raw.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return .initial }
        var state = TasbihState.initial
        if let name = object["preset"] as? String, let preset = TasbihPreset(rawValue: name) {
            state.preset = preset
        }
        if let count = wholeNumber(object["count"]), count >= 0, count <= maxCount {
            state.count = count
        }
        if let target = wholeNumber(object["customTarget"]), target >= 0, target <= maxCustomTarget {
            state.customTarget = target
        }
        if let flag = object["feedback"] as? NSNumber, CFGetTypeID(flag) == CFBooleanGetTypeID() {
            state.feedback = flag.boolValue
        }
        if let item = object["linkedItem"] as? String, item.count <= 64 {
            state.linkedItem = item
        }
        return state
    }

    static func serialize(_ state: TasbihState) -> String {
        var object: [String: Any] = [
            "preset": state.preset.rawValue,
            "count": state.count,
            "customTarget": state.customTarget,
            "feedback": state.feedback,
        ]
        if let item = state.linkedItem { object["linkedItem"] = item }
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]),
              let string = String(data: data, encoding: .utf8) else { return "{}" }
        return string
    }

    // MARK: - Mutabaah link

    /// Checklist items the count can be added to: the user's own counters (not the built-in pages of tilawah).
    static func linkableItems(_ items: [ItemDef]) -> [ItemDef] {
        items.filter { $0.kind == .count && $0.id.hasPrefix("c.") }
    }

    /// The linked item, if it is still on the checklist and still a counter.
    static func linkedItem(of state: TasbihState, in items: [ItemDef]) -> ItemDef? {
        linkableItems(items).first { $0.id == state.linkedItem }
    }

    /// Today's value of the linked counter after adding the tasbih count.
    static func addedCount(current: Int, count: Int) -> Int {
        MutabaahItems.clampCount(current + count)
    }
}
