import SwiftUI
import WidgetKit

// The app writes the schedule here (src/ramadhan/liveCountdown.ts, `syncCountdownWidget`).
private let appGroup = "group.dat.waqtu.ios"
private let scheduleKey = "countdownSchedule"
private let widgetKind = "WaqtuCountdownWidget"

/// One upcoming imsak or maghrib; labels arrive translated in the app's language.
struct CountdownMoment: Decodable {
  /// Epoch milliseconds.
  let at: Double
  let title: String
  let text: String

  var date: Date { Date(timeIntervalSince1970: at / 1000) }
}

struct CountdownEntry: TimelineEntry {
  let date: Date
  /// Nil when the app has not written a schedule yet or every moment has passed.
  let moment: CountdownMoment?
}

/// Follows the app's language rule: English on an English device, Indonesian otherwise.
private func localized(_ id: String, _ en: String) -> String {
  Locale.preferredLanguages.first?.hasPrefix("en") == true ? en : id
}

struct CountdownProvider: TimelineProvider {
  func placeholder(in context: Context) -> CountdownEntry {
    CountdownEntry(
      date: .now,
      moment: CountdownMoment(
        at: (Date.now.timeIntervalSince1970 + 3 * 3600) * 1000,
        title: localized("Menuju berbuka", "Until iftar"),
        text: localized("Maghrib pukul 18:00", "Maghrib at 18:00")
      )
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (CountdownEntry) -> Void) {
    let upcoming = upcomingMoments(after: .now)
    completion(upcoming.first.map { CountdownEntry(date: .now, moment: $0) } ?? placeholder(in: context))
  }

  /// One entry per boundary: each shows the next moment from the previous one onwards, so the
  /// widget moves from imsak to maghrib by itself. Reloads after the last one.
  func getTimeline(in context: Context, completion: @escaping (Timeline<CountdownEntry>) -> Void) {
    let now = Date.now
    let upcoming = Array(upcomingMoments(after: now).prefix(20))
    var entries = [CountdownEntry]()
    var start = now
    for moment in upcoming {
      entries.append(CountdownEntry(date: start, moment: moment))
      start = moment.date
    }
    entries.append(CountdownEntry(date: start, moment: nil))
    completion(Timeline(entries: entries, policy: .atEnd))
  }

  private func upcomingMoments(after now: Date) -> [CountdownMoment] {
    guard let json = UserDefaults(suiteName: appGroup)?.string(forKey: scheduleKey),
      let moments = try? JSONDecoder().decode([CountdownMoment].self, from: Data(json.utf8))
    else { return [] }
    return moments.filter { $0.date > now }.sorted { $0.at < $1.at }
  }
}

struct CountdownWidgetView: View {
  let entry: CountdownEntry

  var body: some View {
    VStack(spacing: 4) {
      if let moment = entry.moment {
        Text(moment.title)
          .font(.caption.bold())
          .foregroundStyle(Color(red: 0.66, green: 0.79, blue: 0.72))
        Text(moment.date, style: .timer)
          .font(.system(size: 28, weight: .bold).monospacedDigit())
          .foregroundStyle(.white)
          .multilineTextAlignment(.center)
          .minimumScaleFactor(0.6)
        Text(moment.text)
          .font(.caption)
          .foregroundStyle(.white)
      } else {
        Text(
          localized(
            "Buka Waqtu untuk memuat waktu imsak dan maghrib.",
            "Open Waqtu to load the imsak and maghrib times."
          )
        )
        .font(.caption)
        .foregroundStyle(.white)
        .multilineTextAlignment(.center)
      }
    }
    .lineLimit(2)
    // #1A2E25, the Live Activity background.
    .containerBackground(for: .widget) { Color(red: 0.102, green: 0.180, blue: 0.145) }
    .widgetURL(URL(string: "waqtu://ramadhan"))
  }
}

struct WaqtuCountdownWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: widgetKind, provider: CountdownProvider()) { entry in
      CountdownWidgetView(entry: entry)
    }
    .configurationDisplayName(localized("Hitung mundur sahur & berbuka", "Sahur & iftar countdown"))
    .description(
      localized("Hitung mundur ke imsak atau maghrib berikutnya.", "Counts down to the next imsak or maghrib.")
    )
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct CountdownWidgetBundle: WidgetBundle {
  var body: some Widget {
    WaqtuCountdownWidget()
  }
}
