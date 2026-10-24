import SwiftUI

// MARK: - Waqtu Color Palette (iOS/watchOS/WidgetKit)
// macOS app has its own dark palette in MenuBarView.swift

extension Color {
    static let waqtuTeal = Color(red: 0.07, green: 0.53, blue: 0.49)
    static let waqtuSlate = Color(red: 0.42, green: 0.56, blue: 0.69)
    static let waqtuSlateDark = Color(red: 0.35, green: 0.49, blue: 0.60)
    static let waqtuSurface = Color(red: 0.97, green: 0.97, blue: 0.98)
}

// ShapeStyle forwarders for `.foregroundStyle(.waqtuTeal)` usage
extension ShapeStyle where Self == Color {
    static var waqtuTeal: Color { Color.waqtuTeal }
    static var waqtuSlate: Color { Color.waqtuSlate }
    static var waqtuSlateDark: Color { Color.waqtuSlateDark }
    static var waqtuSurface: Color { Color.waqtuSurface }
}
