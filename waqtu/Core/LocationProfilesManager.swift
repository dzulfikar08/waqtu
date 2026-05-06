//
//  LocationProfilesManager.swift
//  waqtu
//
//  Multiple location profiles: home, office, travel, etc.
//  Each profile stores coordinates + label. User can switch between them.
//

import Foundation
import CoreLocation

struct LocationProfile: Codable, Identifiable, Equatable {
    var id: String { label }
    let label: String
    let latitude: Double
    let longitude: Double
    let timezone: String?      // optional IANA timezone
    let createdAt: Date

    var coordinates: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    static func == (lhs: LocationProfile, rhs: LocationProfile) -> Bool {
        lhs.id == rhs.id
    }
}

@Observable
final class LocationProfilesManager {
    private let defaults = UserDefaults.standard
    private let profilesKey = "locationProfiles"
    private let activeProfileKey = "activeLocationProfile"

    private(set) var profiles: [LocationProfile] = []
    private(set) var activeProfileId: String?

    init() {
        load()
    }

    /// The currently active profile, or nil if auto-detect is used.
    var activeProfile: LocationProfile? {
        guard let id = activeProfileId else { return nil }
        return profiles.first { $0.id == id }
    }

    /// Add a new profile.
    func addProfile(label: String, latitude: Double, longitude: Double, timezone: String? = nil) {
        guard !profiles.contains(where: { $0.label == label }) else { return }
        let profile = LocationProfile(
            label: label,
            latitude: latitude,
            longitude: longitude,
            timezone: timezone,
            createdAt: Date()
        )
        profiles.append(profile)
        save()
    }

    /// Remove a profile by label.
    func removeProfile(_ profile: LocationProfile) {
        if activeProfileId == profile.id {
            activeProfileId = nil
        }
        profiles.removeAll { $0.id == profile.id }
        save()
    }

    /// Set the active profile. Use nil for auto-detect.
    func setActiveProfile(_ profile: LocationProfile?) {
        activeProfileId = profile?.id
        defaults.set(activeProfileId, forKey: activeProfileKey)
    }

    /// Use auto-detect (no manual profile).
    func useAutoDetect() {
        activeProfileId = nil
        defaults.removeObject(forKey: activeProfileKey)
    }

    // MARK: - Presets

    /// Quick-add preset locations.
    static let presets: [(label: String, lat: Double, lon: Double)] = [
        ("Mecca", 21.4225, 39.8262),
        ("Medina", 24.5247, 39.5693),
        ("Kuala Lumpur", 3.1390, 101.6869),
        ("Jakarta", -6.2088, 106.8456),
        ("London", 51.5074, -0.1278),
        ("New York", 40.7128, -74.0060),
        ("Dubai", 25.2048, 55.2708),
        ("Istanbul", 41.0082, 28.9784),
    ]

    // MARK: - Persistence

    private func load() {
        if let data = defaults.data(forKey: profilesKey),
           let decoded = try? JSONDecoder().decode([LocationProfile].self, from: data) {
            profiles = decoded
        }
        activeProfileId = defaults.string(forKey: activeProfileKey)
    }

    private func save() {
        if let data = try? JSONEncoder().encode(profiles) {
            defaults.set(data, forKey: profilesKey)
        }
    }
}
