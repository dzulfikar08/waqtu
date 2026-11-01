//
//  IbadahNavigation.swift
//  waqtu
//
//  Which tool the Ibadah window shows, and which time of day the readers were asked to open on. Plain
//  values, so the sidebar's choices are testable without the app's model. Pure; no UI.
//

import Foundation

/// The six tools of the Ibadah window, in sidebar order.
enum IbadahTool: String, CaseIterable, Identifiable {
    case qibla, matsurat, dzikir, doa, tasbih, muhasabah

    var id: String { rawValue }

    var systemImage: String {
        switch self {
        case .qibla: return "location.north.circle"
        case .matsurat: return "book"
        case .dzikir: return "sun.and.horizon"
        case .doa: return "heart"
        case .tasbih: return "circle.dotted"
        case .muhasabah: return "square.and.pencil"
        }
    }

    /// The filled variant marks the selected tool.
    var selectedImage: String {
        switch self {
        case .qibla: return "location.north.circle.fill"
        case .matsurat: return "book.fill"
        case .dzikir: return "sun.and.horizon.fill"
        case .doa: return "heart.fill"
        case .tasbih: return "circle.dotted"
        case .muhasabah: return "square.and.pencil"
        }
    }
}

struct IbadahNavigation: Equatable {
    var tool: IbadahTool = .dzikir
    /// Nil follows the part of the day.
    var matsuratTime: ReaderTime?
    var dzikirTime: ReaderTime?

    mutating func select(_ tool: IbadahTool) {
        self.tool = tool
    }

    /// The "time for the morning dhikr" shortcut: opens a reader on `time`.
    mutating func openReader(_ tool: IbadahTool, time: ReaderTime) {
        switch tool {
        case .matsurat: matsuratTime = time
        case .dzikir: dzikirTime = time
        default: break
        }
        select(tool)
    }
}
