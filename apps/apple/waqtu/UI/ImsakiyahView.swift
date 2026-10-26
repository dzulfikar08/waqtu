//
//  ImsakiyahView.swift
//  waqtu
//
//  The Ramadhan month table (imsak = fajr − 10 min, then the five prayers) for the current or
//  next Ramadhan at the Mac's location, with the calculation method, madhab, corrections and the
//  moon-sighting correction the prayer times use. Twin of the phone's ImsakiyahCard; the numbers
//  come from waqtu-sync/Imsakiyah.swift (tested against @waqtu/core).
//

import SwiftUI
import AppKit

final class ImsakiyahWindow: NSWindow {
    init(viewModel: AppViewModel) {
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 560, height: 680),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        isReleasedWhenClosed = false
        title = String(localized: "Imsakiyah")
        contentView = NSHostingView(rootView: ImsakiyahView(viewModel: viewModel))
        center()
    }
}

struct ImsakiyahView: View {
    let viewModel: AppViewModel

    /// Columns shown, as on the phone (sunrise is left out).
    private static let columns: [Imsakiyah.Prayer] = [.imsak, .fajr, .dhuhr, .asr, .maghrib, .isha]

    var body: some View {
        let today = CivilDate(Date(), in: .current)

        VStack(alignment: .leading, spacing: 10) {
            if let result = viewModel.imsakiyah() {
                let table = result.table
                header(span: result.span, today: today)
                ScrollView {
                    Grid(alignment: .trailing, horizontalSpacing: 12, verticalSpacing: 4) {
                        GridRow {
                            Text("Day").gridColumnAlignment(.leading)
                            Text("Date").gridColumnAlignment(.leading)
                            ForEach(Self.columns) { Text(Self.title($0)) }
                        }
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.waqtuMuted)
                        Divider()
                        ForEach(table.rows) { row in
                            let isToday = row.date == today
                            GridRow {
                                Text(verbatim: "\(row.hijriDay)")
                                Text(Self.dateLabel(row.date))
                                ForEach(Self.columns) { prayer in
                                    Text(verbatim: row.local[prayer] ?? "—")
                                        .foregroundColor(prayer == .imsak || prayer == .maghrib ? .waqtuGold : .waqtuText)
                                }
                            }
                            .font(.system(size: 12, weight: isToday ? .bold : .regular).monospacedDigit())
                            .foregroundColor(.waqtuText)
                            .padding(.vertical, 2)
                            .background(isToday ? Color.waqtuPrimary.opacity(0.18) : Color.clear)
                        }
                    }
                    .padding(.horizontal, 4)
                }
                Text("Imsak is 10 minutes before Fajr. Times use your location, calculation method and corrections from Settings.")
                    .font(.system(size: 10))
                    .foregroundColor(.waqtuMuted)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                Text("Prayer times are not available at this location.")
                    .font(.system(size: 13))
                    .foregroundColor(.waqtuMuted)
            }
        }
        .padding(16)
        .frame(minWidth: 520, minHeight: 420, alignment: .topLeading)
        .background(Color.waqtuBackground)
    }

    private func header(span: Ramadhan.Span, today: CivilDate) -> some View {
        // The year as plain digits: an Int interpolation would be grouped ("1,448H").
        let year = String(span.hijriYear)
        return VStack(alignment: .leading, spacing: 4) {
            Text("Imsakiyah Ramadan \(year)H")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.waqtuText)
            if today >= span.start && today <= span.end {
                Text("Day \(span.start.days(to: today) + 1) of Ramadan \(year)H")
                    .font(.system(size: 12))
                    .foregroundColor(.waqtuGold)
            } else {
                Text("Ramadan \(year)H starts \(Self.dateLabel(span.start, long: true))")
                    .font(.system(size: 12))
                    .foregroundColor(.waqtuGold)
            }
            Text("Eid al-Fitr \(Self.dateLabel(span.eid, long: true))")
                .font(.system(size: 12))
                .foregroundColor(.waqtuMuted)
        }
    }

    private static func title(_ prayer: Imsakiyah.Prayer) -> String {
        switch prayer {
        case .imsak: return String(localized: "Imsak")
        case .fajr: return PrayerName.fajr.displayName
        case .sunrise: return String(localized: "Sunrise")
        case .dhuhr: return PrayerName.dhuhr.displayName
        case .asr: return PrayerName.asr.displayName
        case .maghrib: return PrayerName.maghrib.displayName
        case .isha: return PrayerName.isha.displayName
        }
    }

    /// "12 Mar" (or "Thursday, 12 March 2026") in the app language; civil dates are zone-free.
    private static func dateLabel(_ date: CivilDate, long: Bool = false) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.locale = AppLanguage.locale
        formatter.setLocalizedDateFormatFromTemplate(long ? "EEEEdMMMMyyyy" : "dMMM")
        return formatter.string(from: date.noonUTC)
    }
}
