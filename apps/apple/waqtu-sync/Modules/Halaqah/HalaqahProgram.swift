//
//  HalaqahProgram.swift
//  waqtu
//
//  Halaqah program: one talk per day of Ramadhan, bundled from content/halaqah/<id>/program.json.
//  Mac counterpart of apps/mobile/src/halaqah/program.ts and embed.ts: `HalaqahProgram.parse`
//  validates the JSON the same way (and lists every problem it finds), and the embed helpers build
//  the same privacy-enhanced YouTube embed. Pure; no UI.
//

import Foundation

struct HalaqahBilingual: Equatable {
    let id: String
    let en: String

    /// The Indonesian text unless the app runs in English.
    func text(english: Bool) -> String { english ? en : id }
}

struct HalaqahPhase: Equatable {
    let id: String
    let title: HalaqahBilingual
    /// First and last program day of the phase, inclusive.
    let from: Int
    let to: Int
}

struct HalaqahVideo: Equatable {
    /// 11-character YouTube video id; embedded only, never downloaded.
    let youtubeId: String
    let title: String
    let channelName: String
    let channelUrl: String
    let speaker: String
    let durationMin: Int
    let language: String
}

struct HalaqahDay: Equatable {
    /// 1-based, equals the day of Ramadhan the session is meant for.
    let day: Int
    let phase: String
    let themeId: String
    let title: HalaqahBilingual
    let topic: String
    let video: HalaqahVideo
    let summary: String
    let reflectionPrompt: String
    /// Optional small practice for the day; nil when the day has none.
    let amalan: String?
    let sources: [String]
    /// Madhhab positions on a disputed fiqh point; nil on days without one.
    let madhhabNote: String?
}

struct HalaqahProgramError: Error, Equatable {
    let problems: [String]
}

struct HalaqahProgram: Equatable {
    let id: String
    let title: HalaqahBilingual
    let hijriYear: Int
    let totalDays: Int
    /// Editorial status as written in the content file, e.g. "draft-pending-owner-approval".
    let status: String
    let phases: [HalaqahPhase]
    /// Ordered by `day`, exactly `totalDays` long.
    let days: [HalaqahDay]

    /// The only `status` that may reach users in a release build.
    static let approvedStatus = "approved"

    /// Unapproved content shows in debug builds only (mobile: `__DEV__`).
    static func isReleasable(status: String, dev: Bool) -> Bool {
        status == approvedStatus || dev
    }

    func day(_ day: Int) -> HalaqahDay? {
        guard day >= 1, day <= days.count else { return nil }
        return days[day - 1]
    }

    func phase(of day: HalaqahDay) -> HalaqahPhase? {
        phases.first { $0.id == day.phase }
    }

    /// First program day not yet completed, or nil once all are.
    static func nextUncompletedDay(done: Set<Int>, totalDays: Int) -> Int? {
        guard totalDays >= 1 else { return nil }
        return (1...totalDays).first { !done.contains($0) }
    }

    // MARK: - Parsing

    static let youtubeIdPattern = "^[A-Za-z0-9_-]{11}$"
    private static let channelPattern = "^https://www\\.youtube\\.com/@[\\w.-]+$"
    private static let programIdPattern = "^[a-z0-9][a-z0-9-]{0,63}$"

    static func matches(_ value: String, _ pattern: String) -> Bool {
        value.range(of: pattern, options: .regularExpression) != nil
    }

    /// Validates program JSON and returns the typed program. Throws `HalaqahProgramError` listing
    /// every problem when anything is off.
    static func parse(_ data: Data) throws -> HalaqahProgram {
        guard let json = try? JSONSerialization.jsonObject(with: data) else {
            throw HalaqahProgramError(problems: ["$: not JSON"])
        }
        return try parse(json: json)
    }

    static func parse(json: Any) throws -> HalaqahProgram {
        let r = Reader()
        guard let root = r.obj(json, "$") else { throw HalaqahProgramError(problems: r.problems) }
        let meta = r.obj(root["program"], "program") ?? [:]
        let id = r.str(meta, "id", "program")
        if !id.isEmpty, !matches(id, programIdPattern) { r.problems.append("program.id: \"\(id)\" is not a slug") }
        let totalDays = r.int(meta, "total_days", "program", 1, 366)
        let phases = readPhases(r, meta, totalDays)
        let days = r.arr(root, "days", "$").enumerated()
            .map { readDay(r, $0.element, $0.offset, phases) }
            .sorted { $0.day < $1.day }

        if days.count != totalDays {
            r.problems.append("days: expected \(totalDays) entries, got \(days.count)")
        }
        for (i, d) in days.enumerated() where d.day != i + 1 {
            r.problems.append("days: expected day \(i + 1), found day \(d.day)")
        }
        var videoIds = Set<String>()
        for d in days {
            if videoIds.contains(d.video.youtubeId) { r.problems.append("days: duplicate video \(d.video.youtubeId)") }
            videoIds.insert(d.video.youtubeId)
        }

        let program = HalaqahProgram(
            id: id,
            title: HalaqahBilingual(id: r.str(meta, "title_id", "program"), en: r.str(meta, "title_en", "program")),
            hijriYear: r.int(meta, "hijri_year", "program", 1, 3000),
            totalDays: totalDays,
            status: r.str(meta, "status", "program"),
            phases: phases,
            days: days
        )
        if !r.problems.isEmpty { throw HalaqahProgramError(problems: r.problems) }
        return program
    }

    private final class Reader {
        var problems: [String] = []

        func obj(_ value: Any?, _ path: String) -> [String: Any]? {
            if let o = value as? [String: Any] { return o }
            problems.append("\(path): expected an object")
            return nil
        }

        func str(_ parent: [String: Any], _ key: String, _ path: String) -> String {
            if let s = parent[key] as? String, !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return s }
            problems.append("\(path).\(key): expected a non-empty string")
            return ""
        }

        func int(_ parent: [String: Any], _ key: String, _ path: String, _ min: Int, _ max: Int) -> Int {
            if let n = Reader.integer(parent[key]), n >= min, n <= max { return n }
            problems.append("\(path).\(key): expected an integer in \(min)..\(max)")
            return min
        }

        func arr(_ parent: [String: Any], _ key: String, _ path: String) -> [Any] {
            if let a = parent[key] as? [Any] { return a }
            problems.append("\(path).\(key): expected an array")
            return []
        }

        /// A JSON number that is a whole number (booleans excluded).
        static func integer(_ value: Any?) -> Int? {
            guard let n = value as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID() else { return nil }
            let d = n.doubleValue
            guard d.rounded() == d, abs(d) < 1e9 else { return nil }
            return Int(d)
        }
    }

    private static func readPhases(_ r: Reader, _ program: [String: Any], _ totalDays: Int) -> [HalaqahPhase] {
        var phases: [HalaqahPhase] = []
        var seen = Set<String>()
        var expectedFrom = 1
        for (i, raw) in r.arr(program, "phases", "program").enumerated() {
            let path = "program.phases[\(i)]"
            guard let p = r.obj(raw, path) else { continue }
            let id = r.str(p, "id", path)
            if seen.contains(id) { r.problems.append("\(path).id: duplicate phase \"\(id)\"") }
            seen.insert(id)
            let range = r.arr(p, "days", path)
            guard range.count == 2,
                  let from = Reader.integer(range[0]), let to = Reader.integer(range[1]),
                  from >= 1, to >= from, to <= totalDays else {
                r.problems.append("\(path).days: expected [from, to] inside 1..\(totalDays)")
                continue
            }
            if from != expectedFrom {
                r.problems.append("\(path).days: expected to start at day \(expectedFrom), got \(from)")
            }
            expectedFrom = to + 1
            phases.append(HalaqahPhase(
                id: id,
                title: HalaqahBilingual(id: r.str(p, "title_id", path), en: r.str(p, "title_en", path)),
                from: from,
                to: to
            ))
        }
        if !phases.isEmpty, expectedFrom != totalDays + 1 {
            r.problems.append("program.phases: must cover days 1..\(totalDays) without gaps")
        }
        return phases
    }

    private static func readVideo(_ r: Reader, _ raw: Any?, _ path: String) -> HalaqahVideo {
        let v = r.obj(raw, path) ?? [:]
        let youtubeId = r.str(v, "youtube_id", path)
        if !youtubeId.isEmpty, !matches(youtubeId, youtubeIdPattern) {
            r.problems.append("\(path).youtube_id: \"\(youtubeId)\" is not an 11-character YouTube id")
        }
        let channelUrl = r.str(v, "channel_url", path)
        if !channelUrl.isEmpty, !matches(channelUrl, channelPattern) {
            r.problems.append("\(path).channel_url: expected https://www.youtube.com/@handle")
        }
        return HalaqahVideo(
            youtubeId: youtubeId,
            title: r.str(v, "verified_title", path),
            channelName: r.str(v, "channel_name", path),
            channelUrl: channelUrl,
            speaker: r.str(v, "speaker", path),
            durationMin: r.int(v, "duration_min", path, 1, 600),
            language: r.str(v, "language", path)
        )
    }

    private static func nonBlank(_ value: Any?) -> String? {
        guard let s = value as? String, !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        return s
    }

    private static func readDay(_ r: Reader, _ raw: Any, _ index: Int, _ phases: [HalaqahPhase]) -> HalaqahDay {
        let path = "days[\(index)]"
        let d = r.obj(raw, path) ?? [:]
        let day = r.int(d, "day", path, 1, 366)
        let phase = r.str(d, "phase", path)
        let owner = phases.first { $0.id == phase }
        if !phase.isEmpty, owner == nil {
            r.problems.append("\(path).phase: unknown phase \"\(phase)\"")
        } else if let owner, day < owner.from || day > owner.to {
            r.problems.append("\(path).day: \(day) is outside phase \"\(phase)\" (\(owner.from)-\(owner.to))")
        }
        let sources = r.arr(d, "sources", path)
        if !sources.allSatisfy({ nonBlank($0) != nil }) {
            r.problems.append("\(path).sources: expected non-empty strings")
        }
        let note = d["madhhab_note_id"]
        if !(note is NSNull), nonBlank(note) == nil {
            r.problems.append("\(path).madhhab_note_id: expected a non-empty string or null")
        }
        let amalan = d["amalan_id"]
        if let amalan, !(amalan is NSNull), nonBlank(amalan) == nil {
            r.problems.append("\(path).amalan_id: expected a non-empty string, null, or absent")
        }
        return HalaqahDay(
            day: day,
            phase: phase,
            themeId: r.str(d, "theme_id", path),
            title: HalaqahBilingual(id: r.str(d, "title_id", path), en: r.str(d, "title_en", path)),
            topic: r.str(d, "topic", path),
            video: readVideo(r, d["video"], "\(path).video"),
            summary: r.str(d, "summary_id", path),
            reflectionPrompt: r.str(d, "reflection_prompt_id", path),
            amalan: amalan as? String,
            sources: sources.compactMap { $0 as? String },
            madhhabNote: note as? String
        )
    }
}

// MARK: - YouTube embed (apps/mobile/src/halaqah/embed.ts)

enum HalaqahEmbed {
    /// Privacy-enhanced YouTube host: no cookies until the user plays the video.
    static let host = "www.youtube-nocookie.com"
    static let origin = "https://\(host)"

    /// Embed URL for a video. No autoplay; related videos limited to the same channel. Nil for an invalid id.
    static func embedURL(_ youtubeId: String) -> String? {
        guard HalaqahProgram.matches(youtubeId, HalaqahProgram.youtubeIdPattern) else { return nil }
        let encodedOrigin = origin.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-_.!~*'()"))) ?? origin
        return "\(origin)/embed/\(youtubeId)?autoplay=0&rel=0&playsinline=1&modestbranding=1&origin=\(encodedOrigin)"
    }

    /// HTML hosting the embed, loaded with the embed host as base URL so YouTube gets a referrer.
    static func embedHTML(_ youtubeId: String) -> String? {
        guard let src = embedURL(youtubeId) else { return nil }
        return "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style></head><body><iframe src=\"\(src)\" allow=\"accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen\" allowfullscreen referrerpolicy=\"strict-origin-when-cross-origin\"></iframe></body></html>"
    }

    /// Whether the web view may load `url`: the page itself, then only the embed in the top frame.
    /// Sub-frame loads (the player's own frames) are not restricted.
    static func isEmbedNavigation(_ url: String, isTopFrame: Bool = true) -> Bool {
        if !isTopFrame { return true }
        return url == "about:blank" || url == origin || url == "\(origin)/" || url.hasPrefix("\(origin)/embed/")
    }

    /// Plain watch link, offered as a fallback when the embed cannot play.
    static func watchURL(_ youtubeId: String) -> URL? {
        guard HalaqahProgram.matches(youtubeId, HalaqahProgram.youtubeIdPattern) else { return nil }
        return URL(string: "https://www.youtube.com/watch?v=\(youtubeId)")
    }
}
