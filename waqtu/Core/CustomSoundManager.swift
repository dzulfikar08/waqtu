//
//  CustomSoundManager.swift
//  waqtu
//
//  Manages custom notification sounds for prayer reminders.
//  Users can choose from built-in sounds or import custom audio files.
//

import Foundation
import AppKit

@Observable
final class CustomSoundManager {
    private let defaults = UserDefaults.standard
    private let soundKey = "selectedNotificationSound"

    /// Available built-in sounds.
    enum BuiltInSound: String, CaseIterable {
        case `default` = "Default"
        case adhan = "Adhan"
        case gentleChime = "Gentle Chime"
        case softBell = "Soft Bell"
        case natureBirds = "Birds"
        case silence = "Silent"

        var fileName: String? {
            switch self {
            case .default: return nil // use system default
            case .adhan: return "azan1"
            case .gentleChime, .softBell, .natureBirds, .silence: return nil // uses system sounds
            }
        }

        var description: String {
            switch self {
            case .default: return "System default notification sound"
            case .adhan: return "Short Adhan call"
            case .gentleChime: return "Soft chime — office-friendly"
            case .softBell: return "Gentle bell — discreet"
            case .natureBirds: return "Birds chirping — calming"
            case .silence: return "No sound — vibration/text only"
            }
        }
    }

    /// Currently selected sound.
    var selectedSound: BuiltInSound {
        get {
            if let raw = defaults.string(forKey: soundKey),
               let sound = BuiltInSound(rawValue: raw) {
                return sound
            }
            return .default
        }
        set {
            defaults.set(newValue.rawValue, forKey: soundKey)
        }
    }

    /// Sound file to use for prayer reminders (exported for use in UNNotificationSound).
    var notificationSound: String? {
        selectedSound.fileName
    }

    /// Whether sound is enabled (silent = disabled but notification still appears).
    var isSoundEnabled: Bool {
        selectedSound != .silence
    }

    /// Names for UI selection.
    static var allSounds: [(sound: BuiltInSound, name: String, description: String)] {
        BuiltInSound.allCases.map { ($0, $0.rawValue, $0.description) }
    }
}
