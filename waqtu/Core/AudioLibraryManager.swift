import Foundation

// MARK: - Catalog models

enum AudioCategory: String, CaseIterable, Identifiable {
    case murattal, dzikr, sholawat

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .murattal: return "Murattal"
        case .dzikr: return "Dzikr"
        case .sholawat: return "Sholawat"
        }
    }

    var symbolName: String {
        switch self {
        case .murattal: return "book.closed.fill"
        case .dzikr: return "hand.raised.fill"
        case .sholawat: return "sparkles"
        }
    }
}

struct AudioItem: Identifiable, Hashable {
    let id: String
    let title: String
    let subtitle: String
    let category: AudioCategory
    let url: URL
    let attribution: String
}

enum AudioDownloadStatus: Equatable {
    case notStarted
    case downloading
    case downloaded
    case failed(String)
}

// MARK: - Manager

/// Curated Islamic audio catalog + downloader. Files are stored in the app's
/// Application Support container so they survive relaunch and work under sandbox.
/// Catalog is a static array — dead URLs are one-line edits. Murattal entries use
/// the stable quranicaudio.com full-surah pattern (Mishary Alafasy); dzikr use the
/// archive.org Hisnul Muslim collection and sholawat use archive.org. All verified.
@Observable
final class AudioLibraryManager {
    /// Persisted ids of items whose file is on disk.
    private(set) var downloadedIds: Set<String> = []

    /// Live download status per item id (drives the browser UI).
    var status: [String: AudioDownloadStatus] = [:]

    init() {
        let stored = UserDefaults.standard.stringArray(forKey: "audioDownloadedIds") ?? []
        // Drop any persisted id whose file is missing (e.g. container wiped).
        downloadedIds = Set(stored.filter { fileURL(for: $0) != nil })
    }

    // MARK: - Catalog

    static let catalog: [AudioItem] = [
        // --- Murattal (quranicaudio.com — Mishary Alafasy, full surah) ---
        AudioItem(id: "afasy-fatihah", title: "Surah Al-Fatihah", subtitle: "Mishary Alafasy",
                  category: .murattal,
                  url: URL(string: "https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/001.mp3")!,
                  attribution: "quranicaudio.com"),
        AudioItem(id: "afasy-ikhlas", title: "Surah Al-Ikhlas", subtitle: "Mishary Alafasy",
                  category: .murattal,
                  url: URL(string: "https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/112.mp3")!,
                  attribution: "quranicaudio.com"),
        AudioItem(id: "afasy-rahman", title: "Surah Ar-Rahman", subtitle: "Mishary Alafasy",
                  category: .murattal,
                  url: URL(string: "https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/055.mp3")!,
                  attribution: "quranicaudio.com"),
        AudioItem(id: "afasy-yaseen", title: "Surah Ya-Sin", subtitle: "Mishary Alafasy",
                  category: .murattal,
                  url: URL(string: "https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/036.mp3")!,
                  attribution: "quranicaudio.com"),
        AudioItem(id: "afasy-mulk", title: "Surah Al-Mulk", subtitle: "Mishary Alafasy",
                  category: .murattal,
                  url: URL(string: "https://download.quranicaudio.com/quran/mishaari_raashid_al_3afaasee/067.mp3")!,
                  attribution: "quranicaudio.com"),

        // --- Dzikr (archive.org — Hisnul Muslim dua/adhkar collection) ---
        AudioItem(id: "dzikr-hisnul-11", title: "Daily Adhkar", subtitle: "Hisnul Muslim",
                  category: .dzikr,
                  url: URL(string: "https://archive.org/download/HisnulMuslimAudio_201510/n11.mp3")!,
                  attribution: "archive.org — Hisnul Muslim"),
        AudioItem(id: "dzikr-hisnul-166", title: "Short Dhikr", subtitle: "Hisnul Muslim",
                  category: .dzikr,
                  url: URL(string: "https://archive.org/download/HisnulMuslimAudio_201510/n166.mp3")!,
                  attribution: "archive.org — Hisnul Muslim"),

        // --- Sholawat (archive.org) ---
        AudioItem(id: "sholawat-1", title: "Sholawat", subtitle: "Nasheed",
                  category: .sholawat,
                  url: URL(string: "https://archive.org/download/sholawat_202004/Sholawat.mp3")!,
                  attribution: "archive.org")
    ]

    func items(in category: AudioCategory) -> [AudioItem] {
        Self.catalog.filter { $0.category == category }
    }

    /// Resolve a catalog item by id (used by settings to show the selected title).
    static func item(_ id: String) -> AudioItem? {
        catalog.first { $0.id == id }
    }

    // MARK: - Status

    func status(for id: String) -> AudioDownloadStatus {
        if downloadedIds.contains(id) { return .downloaded }
        return status[id] ?? .notStarted
    }

    // MARK: - Storage

    private var storageDir: URL {
        let base = (try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true)) ?? FileManager.default.temporaryDirectory
        let dir = base.appendingPathComponent("waqtu/audio", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    func fileURL(for id: String) -> URL? {
        let f = storageDir.appendingPathComponent("\(id).mp3")
        return FileManager.default.fileExists(atPath: f.path) ? f : nil
    }

    // MARK: - Download / remove

    func download(_ item: AudioItem) {
        guard status(for: item.id) != .downloading else { return }
        status[item.id] = .downloading
        Task { [weak self] in
            await self?.performDownload(item)
        }
    }

    private func performDownload(_ item: AudioItem) async {
        do {
            let (tmp, response) = try await URLSession.shared.download(from: item.url)
            if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                throw URLError(.badServerResponse)
            }
            let dest = storageDir.appendingPathComponent("\(item.id).mp3")
            if FileManager.default.fileExists(atPath: dest.path) {
                try? FileManager.default.removeItem(at: dest)
            }
            try FileManager.default.moveItem(at: tmp, to: dest)
            await MainActor.run {
                self.downloadedIds.insert(item.id)
                self.persistIds()
                self.status[item.id] = .downloaded
            }
        } catch {
            await MainActor.run {
                self.status[item.id] = .failed(error.localizedDescription)
            }
        }
    }

    func remove(_ item: AudioItem) {
        if let f = fileURL(for: item.id) {
            try? FileManager.default.removeItem(at: f)
        }
        downloadedIds.remove(item.id)
        status[item.id] = .notStarted
        persistIds()
    }

    private func persistIds() {
        UserDefaults.standard.set(Array(downloadedIds), forKey: "audioDownloadedIds")
    }
}
