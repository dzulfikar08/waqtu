//
//  CalendarManager.swift
//  waqtu
//
//  Creates and manages daily prayer block events in the user's calendar.
//  Events are regenerated at midnight (prayer times change daily).
//

import Foundation
import EventKit

/// Tag used in event notes to identify events created by Waqtu. Do not change.
private let waqtuEventTag = "Created by Waqtu"

final class CalendarManager {
    /// Shared event store. Multiple EKEventStore instances can corrupt authorization state on macOS 14+.
    private static let sharedEventStore = EKEventStore()
    private var eventStore: EKEventStore { Self.sharedEventStore }

    // MARK: - Permission

    /// Request full access to events (macOS 14+). Call before creating events.
    func requestAccess() async throws {
        try await eventStore.requestFullAccessToEvents()
    }

    /// Returns whether the app has full access to events.
    var hasAccess: Bool {
        if #available(macOS 14.0, *) {
            return EKEventStore.authorizationStatus(for: .event) == .fullAccess
        } else {
            return EKEventStore.authorizationStatus(for: .event) == .authorized
        }
    }

    // MARK: - Calendars

    /// All writable event calendars (local + subscribed).
    func availableCalendars() -> [EKCalendar] {
        eventStore.calendars(for: .event).filter { $0.allowsContentModifications }
    }

    /// Writable calendars grouped by source (e.g. Exchange, iCloud, Google). Ordered: Exchange first, then by source title.
    func calendarsGroupedBySource() -> [(source: EKSource, calendars: [EKCalendar])] {
        let calendars = availableCalendars()
        let bySource = Dictionary(grouping: calendars, by: { $0.source })
        func order(_ source: EKSource) -> Int {
            switch source.sourceType {
            case .exchange: return 0
            case .calDAV: return 1
            case .local: return 2
            case .subscribed: return 3
            default: return 4
            }
        }
        return bySource.keys.compactMap { key -> (source: EKSource, calendars: [EKCalendar])? in
            guard let source = key else { return nil }
            let list = (bySource[source] ?? []).sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
            return (source: source, calendars: list)
        }.sorted { order($0.source) < order($1.source) }
    }

    /// Calendar to use for prayer events. Explicit identifier wins; otherwise prefer Microsoft Exchange, then default.
    func targetCalendar(identifier: String?) -> EKCalendar? {
        let calendars = availableCalendars()
        if let id = identifier, !id.isEmpty,
           let match = calendars.first(where: { $0.calendarIdentifier == id }) {
            return match
        }
        // Prefer first writable calendar on an Exchange account (syncs to Outlook/Teams)
        if let exchange = calendars.first(where: { $0.source.sourceType == .exchange }) {
            return exchange
        }
        return eventStore.defaultCalendarForNewEvents ?? calendars.first
    }

    // MARK: - Create Event

    /// Creates a single prayer block event. Marked as busy and optionally with 5 min alert.
    /// - Parameter preBufferMinutes: Start the block this many minutes before the actual prayer time (for wudu/preparation).
    func createPrayerEvent(
        prayerName: String,
        startDate: Date,
        durationMinutes: Int,
        calendar: EKCalendar,
        addReminder: Bool,
        preBufferMinutes: Int = 0
    ) throws {
        let event = EKEvent(eventStore: eventStore)
        event.title = "Prayer – \(prayerName)"
        event.startDate = startDate.addingTimeInterval(TimeInterval(-preBufferMinutes * 60))
        event.endDate = startDate.addingTimeInterval(TimeInterval(durationMinutes * 60))
        event.calendar = calendar
        event.notes = waqtuEventTag
        event.isAllDay = false
        event.availability = .busy

        if addReminder {
            let alarm = EKAlarm(relativeOffset: -5 * 60) // 5 minutes before
            event.addAlarm(alarm)
        }

        try eventStore.save(event, span: .thisEvent)
    }

    // MARK: - Delete Waqtu Events

    /// Deletes all Waqtu-created events in the given day (calendar-agnostic).
    func deleteWaqtuEvents(for date: Date) throws {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else { return }

        let predicate = eventStore.predicateForEvents(withStart: startOfDay, end: endOfDay, calendars: nil)
        let events = eventStore.events(matching: predicate)

        for event in events where event.notes?.contains(waqtuEventTag) == true {
            try eventStore.remove(event, span: .thisEvent)
        }
    }

    /// Deletes all Waqtu-created events in the store (all time). Use when user disables feature.
    func deleteAllWaqtuEvents() throws {
        let start = calendarDate(yearsAgo: 1)
        let end = calendarDate(yearsAhead: 2)
        let predicate = eventStore.predicateForEvents(withStart: start, end: end, calendars: nil)
        let events = eventStore.events(matching: predicate)

        for event in events where event.notes?.contains(waqtuEventTag) == true {
            try eventStore.remove(event, span: .thisEvent)
        }
    }

    private func calendarDate(yearsAgo: Int) -> Date {
        Calendar.current.date(byAdding: .year, value: -yearsAgo, to: Date()) ?? Date()
    }

    private func calendarDate(yearsAhead: Int) -> Date {
        Calendar.current.date(byAdding: .year, value: yearsAhead, to: Date()) ?? Date()
    }

    // MARK: - Regenerate Day

    /// Deletes Waqtu events for the given day and creates fresh ones from prayer times.
    /// Call at midnight or when user enables the feature.
    func regeneratePrayerEvents(
        for date: Date,
        prayers: [PrayerTime],
        durationMinutes: Int,
        calendar: EKCalendar,
        addReminder: Bool,
        preBufferMinutes: Int = 0
    ) throws {
        try deleteWaqtuEvents(for: date)
        for prayer in prayers {
            try createPrayerEvent(
                prayerName: prayer.name.displayName,
                startDate: prayer.time,
                durationMinutes: durationMinutes,
                calendar: calendar,
                addReminder: addReminder,
                preBufferMinutes: preBufferMinutes
            )
        }
    }
}
