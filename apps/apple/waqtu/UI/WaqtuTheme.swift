//
//  WaqtuTheme.swift
//  waqtu
//
//  The Mac app's palette and the few shared components the module windows are built from. The menu
//  bar popover is always the deep-green dark surface (`waqtu*` colours, fixed); the windows follow
//  the system appearance, so they use the adaptive `wq*` tokens, which are those same greens and
//  golds on a dark window and a light, paper-like version of them on a light one.
//
//  Accent rules: green marks what is selected or done, gold marks numbers that count (countdowns,
//  remaining recitations, progress). Nothing else is tinted.
//

import AppKit
import SwiftUI

// MARK: - Fixed palette (menu bar popover)

extension Color {
    static let waqtuPrimary = Color(hex: "#4A8B6F")
    static let waqtuLight = Color(hex: "#6BA888")
    static let waqtuDark = Color(hex: "#2D5F4C")
    static let waqtuBackground = Color(hex: "#1A2E25")
    static let waqtuGold = Color(hex: "#D4A574")
    static let waqtuText = Color(hex: "#E8F0ED")
    static let waqtuMuted = Color(hex: "#A8C9B8")
    static let waqtuSecondary = Color(hex: "#6B8FAD")
    static let waqtuSecondaryDark = Color(hex: "#5A7D9A")
}

// MARK: - Adaptive tokens (module windows)

extension Color {
    /// A colour that follows the appearance of the window it is drawn in.
    static func wqAdaptive(light: String, dark: String) -> Color {
        Color(nsColor: NSColor(name: nil) { appearance in
            let isDark = appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
            return NSColor(Color(hex: isDark ? dark : light))
        })
    }

    /// The window floor: the popover's green at night, warm paper by day.
    static let wqCanvas = wqAdaptive(light: "#F3F6F1", dark: "#1A2E25")
    /// Sidebar, one step away from the canvas.
    static let wqSidebar = wqAdaptive(light: "#E8EFE9", dark: "#15261F")
    /// Cards.
    static let wqSurface = wqAdaptive(light: "#FFFFFF", dark: "#213A30")
    /// Controls and wells set into a card.
    static let wqSurfaceRaised = wqAdaptive(light: "#E4ECE6", dark: "#2A463A")
    /// Hairlines.
    static let wqStroke = wqAdaptive(light: "#262D5F4C", dark: "#1AFFFFFF")
    /// Text.
    static let wqInk = wqAdaptive(light: "#14302A", dark: "#E8F0ED")
    static let wqInkMuted = wqAdaptive(light: "#4C695C", dark: "#A8C9B8")
    /// Green for selection and done states (text and icons).
    static let wqAccent = wqAdaptive(light: "#2B6B50", dark: "#6BA888")
    /// Green fills that carry white text.
    static let wqAccentFill = wqAdaptive(light: "#2B6B50", dark: "#3F7F63")
    /// Gold for numbers that count.
    static let wqGold = wqAdaptive(light: "#96601F", dark: "#D4A574")
    /// North on the qibla dial, and nothing else.
    static let wqAlert = wqAdaptive(light: "#B2443A", dark: "#E5766A")
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Shape

enum WQ {
    /// A card holds controls of `control` radius with 16 pt around them.
    static let cardRadius: CGFloat = 16
    static let controlRadius: CGFloat = 10
    static let chipRadius: CGFloat = 8
}

extension View {
    /// The card surface: filled, hairline edge, no shadow (cards sit on the canvas, they do not float).
    func wqCard(padding: CGFloat = 16, fill: Color = .wqSurface) -> some View {
        self
            .padding(padding)
            .background(RoundedRectangle(cornerRadius: WQ.cardRadius, style: .continuous).fill(fill))
            .overlay(RoundedRectangle(cornerRadius: WQ.cardRadius, style: .continuous).strokeBorder(Color.wqStroke, lineWidth: 1))
    }
}

// MARK: - Buttons

/// Pressable surface: scales to 0.96 while pressed (not with Reduce Motion) and brightens on hover.
struct WQPressStyle: ButtonStyle {
    var scale: CGFloat = 0.96

    func makeBody(configuration: Configuration) -> some View {
        PressSurface(configuration: configuration, scale: scale)
    }

    private struct PressSurface: View {
        let configuration: ButtonStyle.Configuration
        let scale: CGFloat
        @Environment(\.accessibilityReduceMotion) private var reduceMotion

        var body: some View {
            configuration.label
                .scaleEffect(configuration.isPressed && !reduceMotion ? scale : 1)
                .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
        }
    }
}

/// A tinted button: tinted fill and text at rest, a stronger tint on hover and press; `prominent` is
/// the one filled call to action of a card.
struct WQTintedButtonStyle: ButtonStyle {
    var tint: Color = .wqAccent
    var prominent = false
    var fillsWidth = false

    func makeBody(configuration: Configuration) -> some View {
        TintedSurface(configuration: configuration, tint: tint, prominent: prominent, fillsWidth: fillsWidth)
    }

    private struct TintedSurface: View {
        let configuration: ButtonStyle.Configuration
        let tint: Color
        let prominent: Bool
        let fillsWidth: Bool
        @Environment(\.isEnabled) private var isEnabled
        @Environment(\.accessibilityReduceMotion) private var reduceMotion
        @State private var hovering = false

        var body: some View {
            let pressed = configuration.isPressed
            configuration.label
                .font(.system(size: 12.5, weight: .semibold))
                .foregroundStyle(prominent ? Color.white : tint)
                .lineLimit(1)
                .padding(.horizontal, 12)
                .frame(minHeight: 32)
                .frame(maxWidth: fillsWidth ? .infinity : nil)
                .background(
                    RoundedRectangle(cornerRadius: WQ.controlRadius, style: .continuous)
                        .fill(prominent
                              ? Color.wqAccentFill.opacity(pressed ? 0.85 : (hovering ? 0.92 : 1))
                              : tint.opacity(pressed ? 0.28 : (hovering ? 0.22 : 0.14)))
                )
                .contentShape(RoundedRectangle(cornerRadius: WQ.controlRadius, style: .continuous))
                .scaleEffect(pressed && !reduceMotion ? 0.96 : 1)
                .opacity(isEnabled ? 1 : 0.45)
                .animation(.easeOut(duration: 0.12), value: pressed)
                .animation(.easeOut(duration: 0.12), value: hovering)
                .onHover { hovering = $0 }
        }
    }
}

// MARK: - Segmented control

struct WQOption<Value: Hashable>: Identifiable {
    let value: Value
    let title: String
    var id: Value { value }
}

/// A segmented control in the app's greens; the selected segment is a filled pill that slides.
struct WQSegmented<Value: Hashable>: View {
    let options: [WQOption<Value>]
    @Binding var selection: Value
    var minSegmentWidth: CGFloat = 0
    @Namespace private var pill
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 2) {
            ForEach(options) { option in
                let selected = option.value == selection
                Button {
                    withAnimation(reduceMotion ? nil : .easeOut(duration: 0.18)) { selection = option.value }
                } label: {
                    Text(option.title)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(selected ? Color.white : Color.wqInkMuted)
                        .lineLimit(1)
                        .padding(.horizontal, 12)
                        .frame(minWidth: minSegmentWidth, minHeight: 28)
                        .background {
                            if selected {
                                RoundedRectangle(cornerRadius: WQ.chipRadius, style: .continuous)
                                    .fill(Color.wqAccentFill)
                                    .matchedGeometryEffect(id: "pill", in: pill)
                            }
                        }
                        .contentShape(RoundedRectangle(cornerRadius: WQ.chipRadius, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
        // 8 pt segments inside 3 pt of padding: an 11 pt outer corner.
        .padding(3)
        .background(RoundedRectangle(cornerRadius: WQ.chipRadius + 3, style: .continuous).fill(Color.wqSurfaceRaised))
    }
}

/// A two-state chip (show Latin, show translation): outlined when off, tinted with a check when on.
struct WQToggleChip: View {
    let title: String
    @Binding var isOn: Bool

    var body: some View {
        Button { isOn.toggle() } label: {
            HStack(spacing: 5) {
                if isOn {
                    Image(systemName: "checkmark").font(.system(size: 10, weight: .bold))
                }
                Text(title).lineLimit(1)
            }
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(isOn ? Color.wqAccent : Color.wqInkMuted)
            .padding(.horizontal, 10)
            .frame(minHeight: 28)
            .background(
                RoundedRectangle(cornerRadius: WQ.chipRadius, style: .continuous)
                    .fill(isOn ? Color.wqAccent.opacity(0.14) : Color.clear))
            .overlay(
                RoundedRectangle(cornerRadius: WQ.chipRadius, style: .continuous)
                    .strokeBorder(isOn ? Color.wqAccent.opacity(0.35) : Color.wqStroke, lineWidth: 1))
            .contentShape(RoundedRectangle(cornerRadius: WQ.chipRadius, style: .continuous))
        }
        .buttonStyle(WQPressStyle())
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }
}

// MARK: - Indicators

/// A ring that fills with `fraction`; a check replaces the fill's end when `complete`.
struct WQProgressRing: View {
    let fraction: Double
    var complete = false
    var lineWidth: CGFloat = 4

    var body: some View {
        ZStack {
            Circle().stroke(Color.wqInk.opacity(0.12), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0.001, min(1, fraction)))
                .stroke(Color.wqAccent, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeOut(duration: 0.3), value: fraction)
            if complete {
                Image(systemName: "checkmark")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.wqAccent)
            }
        }
    }
}

/// A small label capsule: how many times a text is read, a category.
struct WQBadge: View {
    let text: String
    var tint: Color = .wqGold

    var body: some View {
        Text(text)
            .font(.system(size: 11.5, weight: .bold))
            .monospacedDigit()
            .foregroundStyle(tint)
            .padding(.horizontal, 8)
            .frame(minHeight: 22)
            .background(Capsule().fill(tint.opacity(0.15)))
    }
}

// MARK: - Window header

/// Title and subtitle of a window's section, with room on the right. Opaque, so content that scrolls
/// below it never runs under it.
struct WQHeader<Trailing: View>: View {
    let title: String
    var subtitle: String?
    @ViewBuilder let trailing: Trailing

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(Color.wqInk)
                    .lineLimit(1)
                if let subtitle {
                    Text(subtitle)
                        .font(.system(size: 12.5))
                        .foregroundStyle(Color.wqInkMuted)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 12)
            trailing
        }
    }
}

extension WQHeader where Trailing == EmptyView {
    init(title: String, subtitle: String? = nil) {
        self.init(title: title, subtitle: subtitle) { EmptyView() }
    }
}

/// A small heading over a block of text inside a card.
struct WQLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(size: 11.5, weight: .semibold))
            .foregroundStyle(Color.wqInkMuted)
    }
}
