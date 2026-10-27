//
//  QiblaDirectionTests.swift
//  waqtuTests
//
//  The Mac's qibla bearing and distance are the values of packages/core/src/qibla.ts: the Kaaba
//  constants and the expected bearings and distances are read from core's source and test, so a
//  change on one side only fails here.
//

import Foundation
import Testing

struct QiblaDirectionTests {
    private struct City {
        let name: String
        let lat: Double
        let lon: Double
        let value: Double
    }

    private static func core(_ path: String) throws -> String {
        try #require(String(data: try RepoFiles.data(path), encoding: .utf8))
    }

    /// `{ name: "Jakarta", lat: -6.2088, lon: 106.8456, <field>: 295.1517 }` rows of core's test.
    private static func cities(field: String) throws -> [City] {
        let source = try core("packages/core/test/qibla.test.ts")
        let pattern = #"\{ name: "([^"]+)", lat: (-?[0-9.]+), lon: (-?[0-9.]+), "# + field + #": ([0-9.]+) \}"#
        let regex = try NSRegularExpression(pattern: pattern)
        return try regex.matches(in: source, range: NSRange(source.startIndex..., in: source)).map { match in
            func group(_ i: Int) throws -> String {
                try #require(Range(match.range(at: i), in: source).map { String(source[$0]) })
            }
            return City(
                name: try group(1),
                lat: try #require(Double(try group(2))),
                lon: try #require(Double(try group(3))),
                value: try #require(Double(try group(4))))
        }
    }

    @Test func kaabaIsTheSamePointAsCore() throws {
        let source = try Self.core("packages/core/src/qibla.ts")
        #expect(source.contains("latitude: \(QiblaDirection.kaabaLatitude), longitude: \(QiblaDirection.kaabaLongitude)"))
        #expect(source.contains("2 * 6371.0088 *"))
        #expect(QiblaDirection.earthRadiusKm == 6371.0088)
    }

    @Test func bearingsMatchCoreForEveryCityOfItsTest() throws {
        let cities = try Self.cities(field: "bearing")
        #expect(cities.map(\.name) == ["Jakarta", "London", "New York", "Sydney", "Tokyo", "Madinah"])
        for city in cities {
            let bearing = QiblaDirection.bearing(latitude: city.lat, longitude: city.lon)
            // Core: toBeCloseTo(expected, 3), i.e. within 0.0005°.
            #expect(abs(bearing - city.value) < 0.0005, "\(city.name): \(bearing) vs \(city.value)")
        }
    }

    @Test func distancesMatchCore() throws {
        let cities = try Self.cities(field: "km")
        #expect(cities.map(\.name) == ["Jakarta", "London", "New York"])
        for city in cities {
            let km = QiblaDirection.distanceKm(latitude: city.lat, longitude: city.lon)
            // Core: toBeCloseTo(expected, 0), i.e. within 0.5 km.
            #expect(abs(km - city.value) < 0.5, "\(city.name): \(km) vs \(city.value)")
        }
        #expect(QiblaDirection.distanceKm(latitude: QiblaDirection.kaabaLatitude, longitude: QiblaDirection.kaabaLongitude) < 1e-6)
    }

    @Test func theUsualRoundedFigures() {
        #expect(Int(QiblaDirection.bearing(latitude: -6.2088, longitude: 106.8456).rounded()) == 295)
        #expect(Int(QiblaDirection.bearing(latitude: 51.5074, longitude: -0.1278).rounded()) == 119)
        #expect(Int(QiblaDirection.bearing(latitude: 40.7128, longitude: -74.006).rounded()) == 58)
    }

    @Test func alwaysWithinZeroToThreeSixty() {
        for lat in stride(from: -80.0, through: 80.0, by: 20.0) {
            for lon in stride(from: -180.0, through: 180.0, by: 30.0) {
                let bearing = QiblaDirection.bearing(latitude: lat, longitude: lon)
                #expect(bearing >= 0 && bearing < 360, "\(lat), \(lon): \(bearing)")
            }
        }
    }

    @Test func dueSouthFromNorthOfTheKaabaDueNorthFromSouthOfIt() {
        #expect(abs(QiblaDirection.bearing(latitude: 30, longitude: QiblaDirection.kaabaLongitude) - 180) < 1e-6)
        #expect(abs(QiblaDirection.bearing(latitude: 10, longitude: QiblaDirection.kaabaLongitude)) < 1e-6)
    }

    @Test func turningAndAlignment() {
        #expect(QiblaDirection.normalizeDegrees(-10) == 350)
        #expect(QiblaDirection.normalizeDegrees(360) == 0)
        #expect(QiblaDirection.normalizeDegrees(725) == 5)
        #expect(QiblaDirection.turn(from: 350, to: 10) == 20)
        #expect(QiblaDirection.turn(from: 10, to: 350) == -20)
        #expect(QiblaDirection.turn(from: 0, to: 180) == 180)
        #expect(QiblaDirection.turn(from: 90, to: 90) == 0)
        #expect(QiblaDirection.isAligned(heading: 295, target: 295.15))
        #expect(QiblaDirection.isAligned(heading: 298, target: 295.15))
        #expect(!QiblaDirection.isAligned(heading: 299, target: 295.15))
        #expect(QiblaDirection.isAligned(heading: 358.5, target: 1))
        #expect(!QiblaDirection.isAligned(heading: 355, target: 1))
        #expect(QiblaDirection.isAligned(heading: 100, target: 110, tolerance: 10))
    }
}
