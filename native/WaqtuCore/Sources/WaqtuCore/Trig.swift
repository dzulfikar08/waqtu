import Foundation

/// Degree-based trigonometry. All astronomy in this package works in degrees,
/// mirroring the PrayTimes.org formulation the macOS app uses.
enum Trig {
    static func sin(_ degrees: Double) -> Double { Foundation.sin(degrees * .pi / 180) }
    static func cos(_ degrees: Double) -> Double { Foundation.cos(degrees * .pi / 180) }
    static func tan(_ degrees: Double) -> Double { Foundation.tan(degrees * .pi / 180) }

    static func arcsinDeg(_ x: Double) -> Double { Foundation.asin(x) * 180 / .pi }
    static func arccosDeg(_ x: Double) -> Double { Foundation.acos(x) * 180 / .pi }
    static func arctan2Deg(_ y: Double, _ x: Double) -> Double { Foundation.atan2(y, x) * 180 / .pi }
    static func arccotDeg(_ x: Double) -> Double { Foundation.atan(1 / x) * 180 / .pi }

    static func fixAngle(_ a: Double) -> Double { fix(a, 360) }
    static func fixHour(_ a: Double) -> Double { fix(a, 24) }

    static func fix(_ a: Double, _ b: Double) -> Double {
        let r = a - b * Foundation.floor(a / b)
        return r < 0 ? r + b : r
    }
}
