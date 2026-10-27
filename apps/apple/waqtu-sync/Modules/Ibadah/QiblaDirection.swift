//
//  QiblaDirection.swift
//  waqtu
//
//  Qibla bearing and distance to the Kaaba, a port of packages/core/src/qibla.ts (the same
//  great-circle formula as Adhan's `Qibla`, Kaaba at 21.4225°N 39.8262°E). A Mac has no compass,
//  so the Ibadah window draws the bearing against north. Pure; no UI.
//

import Foundation

enum QiblaDirection {
    /// The Kaaba, Masjid al-Haram, Makkah.
    static let kaabaLatitude = 21.4225
    static let kaabaLongitude = 39.8262

    /// Mean Earth radius in kilometres.
    static let earthRadiusKm = 6371.0088

    private static let rad = Double.pi / 180

    /// `degrees` folded into [0, 360).
    static func normalizeDegrees(_ degrees: Double) -> Double {
        let folded = degrees.truncatingRemainder(dividingBy: 360)
        return folded < 0 ? folded + 360 : folded
    }

    /// Initial bearing of the great circle to the Kaaba, in degrees clockwise from true north.
    static func bearing(latitude: Double, longitude: Double) -> Double {
        let phi = latitude * rad
        let phiK = kaabaLatitude * rad
        let dLambda = (kaabaLongitude - longitude) * rad
        let y = sin(dLambda)
        let x = cos(phi) * tan(phiK) - sin(phi) * cos(dLambda)
        return normalizeDegrees(atan2(y, x) / rad)
    }

    /// Great-circle distance to the Kaaba in kilometres.
    static func distanceKm(latitude: Double, longitude: Double) -> Double {
        let phi1 = latitude * rad
        let phi2 = kaabaLatitude * rad
        let dPhi = phi2 - phi1
        let dLambda = (kaabaLongitude - longitude) * rad
        let a = pow(sin(dPhi / 2), 2) + cos(phi1) * cos(phi2) * pow(sin(dLambda / 2), 2)
        return 2 * earthRadiusKm * asin(min(1, a.squareRoot()))
    }

    /// Signed turn from `heading` to `target`, in (-180, 180]: positive turns right (clockwise).
    static func turn(from heading: Double, to target: Double) -> Double {
        let delta = normalizeDegrees(target - heading)
        return delta > 180 ? delta - 360 : delta
    }

    /// Whether facing `heading` is within `tolerance` degrees either side of `target`.
    static func isAligned(heading: Double, target: Double, tolerance: Double = 3) -> Bool {
        abs(turn(from: heading, to: target)) <= tolerance
    }

    /// Closer than this to the Kaaba the bearing means nothing (a few metres).
    static let atKaabaKm = 0.05
}
