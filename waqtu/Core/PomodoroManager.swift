import Foundation
import UserNotifications
import AppKit

// MARK: - Pomodoro phase

enum PomodoroPhase: String {
    case idle, focus, shortBreak, longBreak

    var displayName: String {
        switch self {
        case .idle: return "Pomodoro"
        case .focus: return "Focus"
        case .shortBreak: return "Break"
        case .longBreak: return "Long Break"
        }
    }

    var symbolName: String {
        switch self {
        case .idle: return "timer"
        case .focus: return "brain.head.profile"
        case .shortBreak: return "leaf"
        case .longBreak: return "cup.and.saucer"
        }
    }
}

// MARK: - Manager

/// Islamic-flavoured Pomodoro timer. State machine driven by the shared 1 Hz tick
/// in `AppViewModel.setupTimer`. Surfaces focus/break reminders (niyyah, dua, dhikr,
/// short surah) and optionally clamps focus blocks to end before the next adhan.
@Observable
final class PomodoroManager {
    private let settings: AppSettings
    private let audioLibrary: AudioLibraryManager

    var phase: PomodoroPhase = .idle
    var remainingSeconds: Int = 0
    var totalSeconds: Int = 0
    var cyclesCompleted: Int = 0
    var isPaused: Bool = false

    /// Set when a focus block was shortened to fit before salah; fuels the caption.
    var clampedBeforePrayer: String? = nil

    private var breakSound: NSSound?

    init(settings: AppSettings, audioLibrary: AudioLibraryManager) {
        self.settings = settings
        self.audioLibrary = audioLibrary
    }

    // MARK: - Derived state for UI

    var isRunning: Bool { phase != .idle }

    var cycleTarget: Int { settings.cyclesBeforeLongBreak }

    var progress: Double {
        guard totalSeconds > 0 else { return 0 }
        return 1 - Double(max(0, remainingSeconds)) / Double(totalSeconds)
    }

    var timeText: String {
        let safe = max(0, remainingSeconds)
        return String(format: "%02d:%02d", safe / 60, safe % 60)
    }

    // MARK: - Actions

    func start(nextPrayer: PrayerTime?) {
        beginFocus(nextPrayer: nextPrayer)
    }

    func pause() {
        guard phase != .idle else { return }
        isPaused = true
        breakSound?.pause()
    }

    func resume() {
        isPaused = false
        breakSound?.resume()
    }

    func reset() {
        phase = .idle
        remainingSeconds = 0
        totalSeconds = 0
        isPaused = false
        clampedBeforePrayer = nil
        stopBreakAudio()
    }

    /// Jump to the next phase immediately.
    func skip(nextPrayer: PrayerTime?) {
        completeCurrentPhase(nextPrayer: nextPrayer)
    }

    // MARK: - Tick (called once per second from AppViewModel)

    func tick(now: Date, nextPrayer: PrayerTime?) {
        guard phase != .idle, !isPaused else { return }
        remainingSeconds -= 1
        if remainingSeconds <= 0 {
            completeCurrentPhase(nextPrayer: nextPrayer)
        }
    }

    // MARK: - Phase transitions

    private func beginFocus(nextPrayer: PrayerTime?) {
        stopBreakAudio()
        var duration = settings.focusMinutes * 60
        clampedBeforePrayer = nil

        if settings.salahAligned, let np = nextPrayer {
            let buffer = max(60, settings.calendarPreBufferMinutes * 60)
            let available = Int(np.time.timeIntervalSinceNow) - buffer
            if available < 300 {
                // Too close to salah — don't start; nudge the user to wait.
                phase = .idle
                fireReminder(
                    title: "\(np.name.displayName) soon",
                    body: "Only a few minutes until \(np.name.displayName). Focus after salah."
                )
                return
            }
            if duration > available {
                duration = available
                clampedBeforePrayer = np.name.displayName
            }
        }

        phase = .focus
        totalSeconds = duration
        remainingSeconds = duration
        isPaused = false

        if settings.intentionDua {
            fireReminder(
                title: "Niyyah — بِسْمِ اللَّهِ",
                body: "Begin with intention. Dedicate this focus to Allah."
            )
        }
    }

    private func beginBreak() {
        let isLong = cyclesCompleted > 0
            && cyclesCompleted % settings.cyclesBeforeLongBreak == 0
        let duration = (isLong ? settings.longBreakMinutes : settings.breakMinutes) * 60

        phase = isLong ? .longBreak : .shortBreak
        totalSeconds = duration
        remainingSeconds = duration
        isPaused = false
        clampedBeforePrayer = nil

        fireBreakReminder(isLong: isLong)
        playBreakAudio()
    }

    private func completeCurrentPhase(nextPrayer: PrayerTime?) {
        switch phase {
        case .focus:
            cyclesCompleted += 1
            beginBreak()
        case .shortBreak, .longBreak:
            beginFocus(nextPrayer: nextPrayer)
        case .idle:
            break
        }
    }

    // MARK: - Reminder content

    private func fireBreakReminder(isLong: Bool) {
        var title = isLong ? "Long break" : "Break"
        var body: String

        if settings.verseBreak {
            let v = Self.verses[cyclesCompleted % Self.verses.count]
            title = v.name
            body = "\(v.arabic)\n\(v.transliteration)\n\(v.meaning)"
        } else if settings.dhikrBreaks {
            title = "Dhikr"
            body = "سُبْحَانَ اللَّهِ ×٣٣  •  الْحَمْدُ لِلَّهِ ×٣٣  •  اللَّهُ أَكْبَرُ ×٣٤"
        } else if settings.intentionDua {
            title = "Alhamdulillah"
            body = "الْحَمْدُ لِلَّهِ — Praise be to Allah. Rest well."
        } else {
            body = isLong
                ? "Focus session complete. Take a longer break."
                : "Focus session complete. Take a breather."
        }
        fireReminder(title: title, body: body)
    }

    private func fireReminder(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let request = UNNotificationRequest(
            identifier: "waqtu.pomodoro.\(UUID().uuidString)",
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request)
    }

    // MARK: - Break audio (murattal / dzikr, looped)
    private func playBreakAudio() {
        let choice = settings.breakAudio
        guard choice != "none" else { return }

        let resolved: URL?
        if choice == "downloaded", let id = settings.downloadedAudioId {
            resolved = audioLibrary.fileURL(for: id)
        } else {
            let pool = ["murattal", "dzikr", "sholawat"]
            let name = choice == "auto" ? pool[abs(cyclesCompleted) % pool.count] : choice
            resolved = Bundle.main.url(forResource: name, withExtension: "mp3")
        }
        guard let url = resolved else { return }
        let sound = NSSound(contentsOf: url, byReference: false)
        sound?.loops = true
        sound?.play()
        breakSound = sound
    }

    private func stopBreakAudio() {
        breakSound?.stop()
        breakSound = nil
    }

    // MARK: - Quran content (short surahs for verse breaks)

    struct Verse: Sendable {
        let name: String
        let arabic: String
        let transliteration: String
        let meaning: String
    }

    static let verses: [Verse] = [
        Verse(
            name: "Surah Al-Ikhlas",
            arabic: "قُلْ هُوَ اللَّهُ أَحَدٌ • اللَّهُ الصَّمَدُ",
            transliteration: "Qul huwa Allāhu aḥad • Allāhu ṣ-ṣamad",
            meaning: "Say: He is Allah, the One. Allah, the Eternal Refuge."
        ),
        Verse(
            name: "Surah Al-Kawthar",
            arabic: "إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ",
            transliteration: "Innā aʿṭaynāka al-kawthar",
            meaning: "Indeed, We have granted you al-Kawthar."
        ),
        Verse(
            name: "Surah Al-Asr",
            arabic: "وَالْعَصْرِ • إِنَّ الْإِنسَانَ لَفِي خُسْرٍ",
            transliteration: "Wal-ʿaṣr • Inna al-insāna lafī khusr",
            meaning: "By time. Indeed, mankind is in loss."
        ),
        Verse(
            name: "Surah Al-Falaq",
            arabic: "قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ",
            transliteration: "Qul aʿūdhu bi-rabbi al-falaq",
            meaning: "Say: I seek refuge in the Lord of daybreak."
        ),
        Verse(
            name: "Surah An-Nas",
            arabic: "قُلْ أَعُوذُ بِرَبِّ النَّاسِ",
            transliteration: "Qul aʿūdhu bi-rabbi an-nās",
            meaning: "Say: I seek refuge in the Lord of mankind."
        )
    ]
}
