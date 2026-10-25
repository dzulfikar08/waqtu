//
//  MutabaahItems.swift
//  waqtu
//
//  Mutabaah checklist model, a port of apps/mobile/src/mutabaah/items.ts. The `items` setting
//  is stored as the same JSON the phone writes, so both apps read and write it interchangeably.
//

import Foundation

/// Account setting keys (apps/mobile/src/mutabaah/syncKeys.ts).
enum MutabaahSettingKey {
    static let items = "items"
    static let streak = "streak"
}

/// How an item's integer entry value is read: `fardh` bit flags (`FardhFlag`), `check` 0/1, `count` ≥ 0.
enum ItemKind: String, CaseIterable, Equatable {
    case fardh, check, count
}

struct ItemDef: Equatable {
    /// Built-in ids are fixed; custom ids start with `c.`.
    let id: String
    let kind: ItemKind
    /// Only custom items carry a label; built-ins are translated by id.
    let label: String?

    init(id: String, kind: ItemKind, label: String? = nil) {
        self.id = id
        self.kind = kind
        self.label = label
    }
}

/// Tap on a fardh chip.
enum FardhAction: String, CaseIterable {
    case done, ontime, jamaah, qadha
}

enum MutabaahItems {
    static let maxLabel = 40
    static let maxCount = 10_000

    /// Every built-in, in the phone's order.
    static let builtinItems: [ItemDef] = Fardh.allCases.map { ItemDef(id: $0.rawValue, kind: .fardh) } + [
        ItemDef(id: "rawatib", kind: .check),
        ItemDef(id: "dhuha", kind: .check),
        ItemDef(id: "tahajjud", kind: .check),
        ItemDef(id: "tilawah", kind: .count),
        ItemDef(id: "dzikir_pagi", kind: .check),
        ItemDef(id: "dzikir_petang", kind: .check),
        ItemDef(id: "sedekah", kind: .check),
        ItemDef(id: "puasa", kind: .check),
        // Opt-in: not in the default checklist.
        ItemDef(id: "halaqah", kind: .check),
        ItemDef(id: "murojaah", kind: .check),
    ]

    private static let optInIds: Set<String> = ["halaqah", "murojaah"]

    /// What a fresh install shows: every built-in except the opt-in ones.
    static let defaultItems: [ItemDef] = builtinItems.filter { !optInIds.contains($0.id) }

    private static let builtinById: [String: ItemDef] = Dictionary(uniqueKeysWithValues: builtinItems.map { ($0.id, $0) })

    static func isBuiltinId(_ id: String) -> Bool { builtinById[id] != nil }

    /// `^c\.[a-z0-9]{4,32}$`
    static func isCustomId(_ id: String) -> Bool {
        let scalars = Array(id.unicodeScalars)
        guard scalars.count >= 6, scalars.count <= 34, scalars[0] == "c", scalars[1] == "." else { return false }
        return scalars.dropFirst(2).allSatisfy { ("a"..."z").contains($0) || ("0"..."9").contains($0) }
    }

    /// Built-in items the user removed and could add back.
    static func missingBuiltins(_ items: [ItemDef]) -> [ItemDef] {
        let have = Set(items.map(\.id))
        return builtinItems.filter { !have.contains($0.id) }
    }

    /// Stored `items` setting → list. Anything malformed falls back to the default items.
    static func parseItems(_ raw: String?) -> [ItemDef] {
        guard let raw, !raw.isEmpty, case .array(let data)? = MutabaahJSON.parse(raw) else { return defaultItems }
        var seen = Set<String>()
        var items: [ItemDef] = []
        for entry in data {
            guard case .object(let fields) = entry, case .string(let id)? = fields["id"], !seen.contains(id) else { continue }
            if let builtin = builtinById[id] {
                seen.insert(id)
                items.append(builtin)
            } else if isCustomId(id),
                      case .string(let kindRaw)? = fields["kind"], let kind = ItemKind(rawValue: kindRaw), kind != .fardh,
                      case .string(let label)? = fields["label"] {
                let trimmed = jsTrim(label)
                guard !trimmed.isEmpty else { continue }
                seen.insert(id)
                items.append(ItemDef(id: id, kind: kind, label: utf16Prefix(trimmed, maxLabel)))
            }
        }
        return items
    }

    /// Same bytes as the phone's `JSON.stringify`: `id`, `kind`, then `label` when non-empty.
    static func serializeItems(_ items: [ItemDef]) -> String {
        var out = "["
        for (i, item) in items.enumerated() {
            if i > 0 { out += "," }
            out += "{\"id\":" + MutabaahJSON.quote(item.id) + ",\"kind\":" + MutabaahJSON.quote(item.kind.rawValue)
            if let label = item.label, !label.isEmpty { out += ",\"label\":" + MutabaahJSON.quote(label) }
            out += "}"
        }
        return out + "]"
    }

    /// `random` yields a base-36 token; injected so tests are deterministic. `kind` must not be `.fardh`.
    static func addCustomItem(_ items: [ItemDef], label: String, kind: ItemKind, random: () -> String) -> [ItemDef] {
        let trimmed = utf16Prefix(jsTrim(label), maxLabel)
        guard !trimmed.isEmpty, kind != .fardh else { return items }
        var id = "c.\(random())"
        while items.contains(where: { $0.id == id }) { id = "c.\(random())" }
        return items + [ItemDef(id: id, kind: kind, label: trimmed)]
    }

    static func addBuiltinItem(_ items: [ItemDef], id: String) -> [ItemDef] {
        guard let builtin = builtinById[id], !items.contains(where: { $0.id == id }) else { return items }
        return items + [builtin]
    }

    static func removeItem(_ items: [ItemDef], id: String) -> [ItemDef] {
        items.filter { $0.id != id }
    }

    /// Whether an item counts as done for a streak or a summary.
    static func isDone(_ kind: ItemKind, _ value: Int) -> Bool {
        kind == .fardh ? value & FardhFlag.done != 0 : value > 0
    }

    /// Next flags after a tap. Done means on time; qadha replaces on time; each chip toggles;
    /// unmarking done clears everything.
    static func toggleFardh(_ value: Int, _ action: FardhAction) -> Int {
        let done = value & FardhFlag.done != 0
        switch action {
        case .done:
            return done ? 0 : FardhFlag.done | FardhFlag.onTime
        case .ontime:
            if !done { return FardhFlag.done | FardhFlag.onTime }
            let toggled = value & FardhFlag.onTime != 0 ? value & ~FardhFlag.onTime : value | FardhFlag.onTime
            return toggled & ~FardhFlag.qadha
        case .jamaah:
            if !done { return FardhFlag.done | FardhFlag.onTime | FardhFlag.jamaah }
            return value ^ FardhFlag.jamaah
        case .qadha:
            if value & FardhFlag.qadha != 0 { return value & ~FardhFlag.qadha }
            return (value | FardhFlag.done | FardhFlag.qadha) & ~FardhFlag.onTime
        }
    }

    /// Notification action "Sudah sholat": done, and on time when still inside the prayer's window.
    static func markedFromNotification(_ value: Int, onTime: Bool) -> Int {
        if value & FardhFlag.done != 0 { return value }
        return onTime ? FardhFlag.done | FardhFlag.onTime : FardhFlag.done
    }

    static func clampCount(_ n: Double) -> Int {
        guard !n.isNaN else { return 0 }
        return Int(max(0, min(Double(maxCount), n.rounded(.towardZero))))
    }

    static func clampCount(_ n: Int) -> Int { max(0, min(maxCount, n)) }

    /// JS `String.prototype.trim`: whitespace, line terminators and U+FEFF.
    static func jsTrim(_ s: String) -> String {
        let scalars = s.unicodeScalars
        // ECMAScript WhiteSpace (TAB VT FF SP NBSP ZWNBSP, category Zs) and LineTerminator (LF CR LS PS).
        let isSpace: (Unicode.Scalar) -> Bool = {
            switch $0 {
            case "\t", "\u{0B}", "\u{0C}", " ", "\u{A0}", "\u{FEFF}", "\n", "\r", "\u{2028}", "\u{2029}": return true
            default: return $0.properties.generalCategory == .spaceSeparator
            }
        }
        guard let start = scalars.firstIndex(where: { !isSpace($0) }),
              let end = scalars.lastIndex(where: { !isSpace($0) }) else { return "" }
        return String(scalars[start...end])
    }

    /// JS `slice(0, n)`: the first `n` UTF-16 code units. A pair cut in half keeps its lead half
    /// as U+FFFD (Swift strings cannot hold a lone surrogate; JS would keep it).
    static func utf16Prefix(_ s: String, _ n: Int) -> String {
        let units = s.utf16
        guard units.count > n else { return s }
        return String(decoding: Array(units.prefix(n)), as: UTF16.self)
    }
}

/// Minimal JSON reader/writer matching `JSON.parse` / `JSON.stringify` for the settings blobs.
enum MutabaahJSON {
    indirect enum Value: Equatable {
        case null
        case bool(Bool)
        case number(Double)
        case string(String)
        case array([Value])
        case object([String: Value])
    }

    /// `JSON.stringify(string)`.
    static func quote(_ s: String) -> String {
        var out = "\""
        for scalar in s.unicodeScalars {
            switch scalar {
            case "\"": out += "\\\""
            case "\\": out += "\\\\"
            case "\u{08}": out += "\\b"
            case "\u{0C}": out += "\\f"
            case "\n": out += "\\n"
            case "\r": out += "\\r"
            case "\t": out += "\\t"
            default:
                if scalar.value < 0x20 {
                    let hex = String(scalar.value, radix: 16)
                    out += "\\u" + String(repeating: "0", count: 4 - hex.count) + hex
                } else {
                    out.unicodeScalars.append(scalar)
                }
            }
        }
        return out + "\""
    }

    /// `JSON.parse`, or nil when the text is not valid JSON. Duplicate keys: the last wins.
    /// Lone surrogate escapes decode to U+FFFD.
    static func parse(_ text: String) -> Value? {
        var parser = Parser(units: Array(text.utf16))
        parser.skipSpace()
        guard let value = parser.value() else { return nil }
        parser.skipSpace()
        return parser.index == parser.units.count ? value : nil
    }

    private struct Parser {
        let units: [UInt16]
        var index = 0

        private var current: UInt16? { index < units.count ? units[index] : nil }

        mutating func skipSpace() {
            while let c = current, c == 0x20 || c == 0x09 || c == 0x0A || c == 0x0D { index += 1 }
        }

        private mutating func literal(_ word: String, _ value: Value) -> Value? {
            let w = Array(word.utf16)
            guard index + w.count <= units.count, Array(units[index..<index + w.count]) == w else { return nil }
            index += w.count
            return value
        }

        mutating func value() -> Value? {
            guard let c = current else { return nil }
            switch c {
            case 0x7B: return object()
            case 0x5B: return array()
            case 0x22: return string().map(Value.string)
            case 0x74: return literal("true", .bool(true))
            case 0x66: return literal("false", .bool(false))
            case 0x6E: return literal("null", .null)
            default: return number()
            }
        }

        private mutating func object() -> Value? {
            index += 1
            var fields: [String: Value] = [:]
            skipSpace()
            if current == 0x7D { index += 1; return .object(fields) }
            while true {
                skipSpace()
                guard current == 0x22, let key = string() else { return nil }
                skipSpace()
                guard current == 0x3A else { return nil }
                index += 1
                skipSpace()
                guard let v = value() else { return nil }
                fields[key] = v
                skipSpace()
                if current == 0x2C { index += 1; continue }
                if current == 0x7D { index += 1; return .object(fields) }
                return nil
            }
        }

        private mutating func array() -> Value? {
            index += 1
            var items: [Value] = []
            skipSpace()
            if current == 0x5D { index += 1; return .array(items) }
            while true {
                skipSpace()
                guard let v = value() else { return nil }
                items.append(v)
                skipSpace()
                if current == 0x2C { index += 1; continue }
                if current == 0x5D { index += 1; return .array(items) }
                return nil
            }
        }

        private mutating func hex4() -> UInt16? {
            guard index + 4 <= units.count else { return nil }
            var v: UInt16 = 0
            for u in units[index..<index + 4] {
                let d: UInt16
                switch u {
                case 0x30...0x39: d = u - 0x30
                case 0x41...0x46: d = u - 0x41 + 10
                case 0x61...0x66: d = u - 0x61 + 10
                default: return nil
                }
                v = v << 4 | d
            }
            index += 4
            return v
        }

        private mutating func string() -> String? {
            index += 1
            var out: [UInt16] = []
            while let c = current {
                index += 1
                switch c {
                case 0x22:
                    return String(decoding: out, as: UTF16.self)
                case 0x5C:
                    guard let e = current else { return nil }
                    index += 1
                    switch e {
                    case 0x22, 0x5C, 0x2F: out.append(e)
                    case 0x62: out.append(0x08)
                    case 0x66: out.append(0x0C)
                    case 0x6E: out.append(0x0A)
                    case 0x72: out.append(0x0D)
                    case 0x74: out.append(0x09)
                    case 0x75:
                        guard let u = hex4() else { return nil }
                        out.append(u)
                    default: return nil
                    }
                default:
                    if c < 0x20 { return nil }
                    out.append(c)
                }
            }
            return nil
        }

        private mutating func number() -> Value? {
            let start = index
            if current == 0x2D { index += 1 }
            guard let first = current, (0x30...0x39).contains(first) else { return nil }
            if first == 0x30 {
                index += 1
            } else {
                while let c = current, (0x30...0x39).contains(c) { index += 1 }
            }
            if current == 0x2E {
                index += 1
                guard let c = current, (0x30...0x39).contains(c) else { return nil }
                while let c = current, (0x30...0x39).contains(c) { index += 1 }
            }
            if current == 0x65 || current == 0x45 {
                index += 1
                if current == 0x2B || current == 0x2D { index += 1 }
                guard let c = current, (0x30...0x39).contains(c) else { return nil }
                while let c = current, (0x30...0x39).contains(c) { index += 1 }
            }
            let text = String(decoding: units[start..<index], as: UTF16.self)
            return Double(text).map(Value.number)
        }
    }
}
