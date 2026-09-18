import Foundation

/// Sun position for a given Julian day. Mirrors the PrayTimes.org `sunPosition`:
/// declination in degrees, equation of time in hours.
struct SolarPosition: Equatable {
    let declination: Double
    let equationOfTime: Double
}

enum Solar {
    /// Julian date at 0h UT for a calendar date (PrayTimes convention).
    static func julianDate(year: Int, month: Int, day: Int) -> Double {
        var y = year
        var m = month
        if m <= 2 {
            y -= 1
            m += 12
        }
        let a = floor(Double(y) / 100.0)
        let b = 2 - a + floor(a / 4.0)
        return floor(365.25 * (Double(y) + 4716)) + floor(30.6001 * (Double(m) + 1)) + Double(day) + b - 1524.5
    }

    static func position(julianDay: Double) -> SolarPosition {
        let d = julianDay - 2451545.0
        let g = Trig.fixAngle(357.529 + 0.98560028 * d)
        let q = Trig.fixAngle(280.459 + 0.98564736 * d)
        let l = Trig.fixAngle(q + 1.915 * Trig.sin(g) + 0.020 * Trig.sin(2 * g))
        let e = 23.439 - 0.00000036 * d
        let declination = Trig.arcsinDeg(Trig.sin(e) * Trig.sin(l))
        let rightAscension = Trig.arctan2Deg(Trig.cos(e) * Trig.sin(l), Trig.cos(l)) / 15.0
        let equationOfTime = q / 15.0 - Trig.fixHour(rightAscension)
        return SolarPosition(declination: declination, equationOfTime: equationOfTime)
    }
}
