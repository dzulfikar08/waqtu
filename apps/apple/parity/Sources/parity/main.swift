import Adhan
import Foundation

// Emits prayer instants (epoch seconds) for every city in cities.json, 365 days of the given
// year, for the "mwl" and "kemenag" methods, computed by the app's own
// SharedPrayerCalculator / PrayerMethodParameters (symlinked from apps/apple/shared), so CI
// compares the code the Mac/iOS apps ship against @waqtu/core.
// Usage: parity <cities.json> <year>  > swift.json

struct City: Decodable {
    let id: String
    let latitude: Double
    let longitude: Double
}

/// Harness method id -> app method id (as stored in AppSettings.calculationMethod).
let appMethod = ["mwl": "muslimWorldLeague", "kemenag": "kemenag"]

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
        let id = appMethod[method]!
        var days: [[String: Any]] = []
        for i in 0..<365 {
            let d = utc.date(byAdding: .day, value: i, to: start)!
            let c = utc.dateComponents([.year, .month, .day], from: d)
            guard let t = SharedPrayerCalculator.adhanTimes(
                latitude: city.latitude,
                longitude: city.longitude,
                date: d,
                calendar: utc,
                method: id
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
