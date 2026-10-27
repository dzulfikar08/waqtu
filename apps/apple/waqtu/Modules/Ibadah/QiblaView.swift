//
//  QiblaView.swift
//  waqtu
//
//  Qibla from this Mac's location (apps/mobile/src/app/(ibadah)/qibla.tsx): bearing and distance
//  to the Kaaba and a dial that shows the direction against north. A Mac has no compass, so the
//  dial does not turn; the figure is for an ordinary compass or a map. The location is the one
//  the prayer times use (detected, or the manual coordinates) and is not stored or sent.
//

import CoreLocation
import SwiftUI

struct QiblaView: View {
    let viewModel: AppViewModel
    @ObservedObject var locationManager: LocationManager
    /// Bumped when the prayer location settings change, so the figures follow them.
    @State private var settingsVersion = 0

    private struct Place {
        let latitude: Double
        let longitude: Double
    }

    /// Where the prayer times are calculated for: the detected fix, else the manual coordinates.
    /// Nil while auto-detect is on and there is no fix yet.
    private var place: Place? {
        _ = settingsVersion
        let settings = viewModel.settings
        if settings.autoDetectLocation {
            guard let fix = locationManager.locationForGeocoding else { return nil }
            return Place(latitude: fix.coordinate.latitude, longitude: fix.coordinate.longitude)
        }
        return Place(latitude: settings.manualLatitude, longitude: settings.manualLongitude)
    }

    var body: some View {
        IbadahScreen(title: istr("ibadah.qibla.title"), subtitle: subtitle) {
            ScrollView {
                Group {
                    if let place {
                        figures(for: place)
                    } else {
                        noLocation
                    }
                }
                .padding(28)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: Notification.Name("prayerTimeSettingsChanged"))) { _ in
            settingsVersion += 1
        }
    }

    /// Where the bearing is measured from.
    private var subtitle: String? {
        guard place != nil else { return nil }
        return viewModel.settings.autoDetectLocation
            ? istr("ibadah.qibla.from \(viewModel.locationDisplay)")
            : istr("ibadah.qibla.fromManual \(viewModel.locationDisplay)")
    }

    @ViewBuilder
    private func figures(for place: Place) -> some View {
        let distance = QiblaDirection.distanceKm(latitude: place.latitude, longitude: place.longitude)
        if distance < QiblaDirection.atKaabaKm {
            Text(istr("ibadah.qibla.atKaaba"))
                .font(.system(size: 17))
                .foregroundStyle(Color.wqInk)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .wqCard(padding: 32)
        } else {
            let bearing = QiblaDirection.bearing(latitude: place.latitude, longitude: place.longitude)
            let rounded = Int(bearing.rounded()) % 360
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 20) {
                    dialCard(bearing: bearing, rounded: rounded)
                    statCards(rounded: rounded, distance: distance)
                        .frame(width: 270)
                }
                VStack(spacing: 20) {
                    dialCard(bearing: bearing, rounded: rounded)
                    statCards(rounded: rounded, distance: distance)
                }
            }
        }
    }

    private func dialCard(bearing: Double, rounded: Int) -> some View {
        QiblaDial(bearing: bearing)
            .frame(width: 330, height: 330)
            .padding(20)
            .frame(maxWidth: .infinity)
            .wqCard(padding: 0)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(istr("ibadah.qibla.dialLabel \(rounded)"))
    }

    private func statCards(rounded: Int, distance: Double) -> some View {
        VStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                WQLabel(text: istr("ibadah.qibla.bearing"))
                Text("\(rounded)°")
                    .font(.system(size: 56, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Color.wqGold)
                    .textSelection(.enabled)
                Text(istr("ibadah.qibla.fromNorth"))
                    .font(.system(size: 13))
                    .foregroundStyle(Color.wqInkMuted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .wqCard(padding: 20)
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: "arrow.triangle.swap")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.wqAccent)
                    .accessibilityHidden(true)
                Text(istr("ibadah.qibla.distance \(Self.kilometres(distance))"))
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Color.wqInk)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .wqCard(padding: 20)
            Label(istr("ibadah.qibla.macTip"), systemImage: "info.circle")
                .font(.system(size: 12.5))
                .foregroundStyle(Color.wqInkMuted)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 4)
        }
    }

    private var noLocation: some View {
        VStack(spacing: 16) {
            Image(systemName: "location.slash.fill")
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Color.wqGold)
                .frame(width: 48, height: 48)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.wqGold.opacity(0.14)))
                .accessibilityHidden(true)
            Text(istr("ibadah.qibla.noLocation"))
                .font(.system(size: 14))
                .foregroundStyle(Color.wqInk)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 10) {
                Button(istr("ibadah.qibla.locate")) { viewModel.refreshLocation() }
                    .buttonStyle(WQTintedButtonStyle(prominent: true))
                Button(istr("ibadah.qibla.openSettings")) {
                    ModuleWindows.openSettings(pane: SettingsView.Pane.location)
                }
                .buttonStyle(WQTintedButtonStyle())
            }
            if locationManager.authorizationStatus == .denied || locationManager.authorizationStatus == .restricted {
                Text(istr("ibadah.qibla.denied"))
                    .font(.system(size: 12.5))
                    .foregroundStyle(Color.wqInkMuted)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: 440)
        .wqCard(padding: 32)
        .padding(.top, 24)
    }

    /// 7,920 km: whole kilometres with the reader's grouping.
    static func kilometres(_ km: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = AppLanguage.locale
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: km.rounded())) ?? String(Int(km.rounded()))
    }
}

/// A fixed dial, north at the top, with the qibla drawn as an arrow ending in the Kaaba.
private struct QiblaDial: View {
    let bearing: Double

    private struct Cardinal {
        let key: String
        let angle: Double
    }

    private let cardinals = [
        Cardinal(key: "N", angle: 0), Cardinal(key: "E", angle: 90),
        Cardinal(key: "S", angle: 180), Cardinal(key: "W", angle: 270),
    ]

    var body: some View {
        GeometryReader { proxy in
            let size = min(proxy.size.width, proxy.size.height)
            let radius = size / 2
            ZStack {
                Circle()
                    .fill(Color.wqSurfaceRaised.opacity(0.55))
                Circle()
                    .strokeBorder(Color.wqInk.opacity(0.22), lineWidth: 1.5)
                Circle()
                    .strokeBorder(Color.wqStroke, lineWidth: 1)
                    .padding(radius * 0.36)
                ForEach(0..<72, id: \.self) { i in
                    let major = i % 6 == 0
                    Rectangle()
                        .fill(Color.wqInk.opacity(major ? 0.55 : 0.22))
                        .frame(width: major ? 2 : 1, height: major ? 12 : 6)
                        .offset(y: -radius + (major ? 6 : 3) + 1.5)
                        .rotationEffect(.degrees(Double(i) * 5))
                }
                ForEach(cardinals, id: \.key) { cardinal in
                    Text(label(cardinal.key))
                        .font(.system(size: 17, weight: .bold, design: .rounded))
                        .foregroundStyle(cardinal.key == "N" ? Color.wqAlert : Color.wqInkMuted)
                        .offset(
                            x: sin(cardinal.angle * .pi / 180) * (radius - 34),
                            y: -cos(cardinal.angle * .pi / 180) * (radius - 34))
                }
                ZStack {
                    Capsule()
                        .fill(Color.wqAccent)
                        .frame(width: 6, height: radius * 0.58)
                        .offset(y: -radius * 0.29)
                    kaaba
                        .offset(y: -radius * 0.58 - 16)
                    Circle()
                        .fill(Color.wqAccent)
                        .frame(width: 14, height: 14)
                    Circle()
                        .fill(Color.wqSurface)
                        .frame(width: 5, height: 5)
                }
                .frame(width: size, height: size)
                .rotationEffect(.degrees(bearing))
            }
            .frame(width: size, height: size)
        }
    }

    private func label(_ key: String) -> String {
        switch key {
        case "N": return istr("ibadah.qibla.north")
        case "E": return istr("ibadah.qibla.east")
        case "S": return istr("ibadah.qibla.south")
        default: return istr("ibadah.qibla.west")
        }
    }

    /// The Kaaba as the black cube with its gold band.
    private var kaaba: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 3)
                .fill(Color.black)
                .frame(width: 26, height: 26)
            Rectangle()
                .fill(Color.waqtuGold)
                .frame(width: 26, height: 4)
                .offset(y: -5)
        }
        .overlay(RoundedRectangle(cornerRadius: 3).stroke(Color.waqtuGold.opacity(0.6), lineWidth: 1))
    }
}
