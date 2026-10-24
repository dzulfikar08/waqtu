import Adhan
import Foundation

// Emits prayer instants (epoch seconds) from Adhan-Swift for every city in cities.json,
// 365 days of the given year, for the "mwl" and "kemenag" parameter sets.
// Usage: parity <cities.json> <year>  > swift.json
// The "kemenag" parameters MUST mirror packages/core/src/prayer.ts (KEMENAG_IHTIYAT etc.).

struct City: Decodable {
    let id: String
    let latitude: Double
    let longitude: Double
}

func params(_ id: String) -> CalculationParameters {
    switch id {
    case "mwl":
        return CalculationMethod.muslimWorldLeague.params
    default:
        var p = CalculationMethod.other.params
        p.fajrAngle = 20
        p.ishaAngle = 18
        p.rounding = .up
        p.adjustments = PrayerAdjustments(fajr: 2, sunrise: -4, dhuhr: 3, asr: 2, maghrib: 3, isha: 2)
        return p
    }
}

let args = CommandLine.arguments
guard args.count == 3, let year = Int(args[2]) else {
    FileHandle.standardError.write(Data("usage: parity <cities.json> <year>\n".utf8))
    exit(2)
}
let cities = try JSONDecoder().decode([City].self, from: Data(contentsOf: URL(fileURLWithPath: args[1])))

var utc = Calendar(identifier: .gregorian)
utc.timeZone = TimeZone(identifier: "UTC")!
let start = utc.date(from: DateComponents(year: year, month: 1, day: 1))!

var out: [String: Any] = [:]
for city in cities {
    var perMethod: [String: Any] = [:]
    for method in ["mwl", "kemenag"] {
        let p = params(method)
        var days: [[String: Any]] = []
        for i in 0..<365 {
            let d = utc.date(byAdding: .day, value: i, to: start)!
            let c = utc.dateComponents([.year, .month, .day], from: d)
            guard let t = PrayerTimes(
                coordinates: Coordinates(latitude: city.latitude, longitude: city.longitude),
                date: c,
                calculationParameters: p
            ) else {
                days.append(["date": String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!), "error": true])
                continue
            }
            days.append([
                "date": String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!),
                "fajr": Int(t.fajr.timeIntervalSince1970),
                "sunrise": Int(t.sunrise.timeIntervalSince1970),
                "dhuhr": Int(t.dhuhr.timeIntervalSince1970),
                "asr": Int(t.asr.timeIntervalSince1970),
                "maghrib": Int(t.maghrib.timeIntervalSince1970),
                "isha": Int(t.isha.timeIntervalSince1970),
            ])
        }
        perMethod[method] = days
    }
    out[city.id] = perMethod
}
let data = try JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
FileHandle.standardOutput.write(data)
