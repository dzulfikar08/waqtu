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
        ScrollView {
            VStack(spacing: 20) {
                if let place {
                    figures(for: place)
                } else {
                    noLocation
                }
            }
            .padding(28)
            .frame(maxWidth: .infinity)
        }
        .onReceive(NotificationCenter.default.publisher(for: Notification.Name("prayerTimeSettingsChanged"))) { _ in
            settingsVersion += 1
        }
    }

    @ViewBuilder
    private func figures(for place: Place) -> some View {
        let distance = QiblaDirection.distanceKm(latitude: place.latitude, longitude: place.longitude)
        if distance < QiblaDirection.atKaabaKm {
            Text(istr("ibadah.qibla.atKaaba"))
                .font(.title3)
                .multilineTextAlignment(.center)
                .padding(.vertical, 40)
        } else {
            let bearing = QiblaDirection.bearing(latitude: place.latitude, longitude: place.longitude)
            let rounded = Int(bearing.rounded()) % 360
            VStack(spacing: 4) {
                Text(istr("ibadah.qibla.bearing"))
                    .font(.headline)
                    .foregroundStyle(.secondary)
                Text("\(rounded)°")
                    .font(.system(size: 54, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Color.waqtuPrimary)
                    .textSelection(.enabled)
                Text(istr("ibadah.qibla.fromNorth"))
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            QiblaDial(bearing: bearing)
                .frame(width: 320, height: 320)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(istr("ibadah.qibla.dialLabel \(rounded)"))
            VStack(spacing: 4) {
                Text(istr("ibadah.qibla.distance \(Self.kilometres(distance))"))
                    .font(.title3)
                Text(viewModel.settings.autoDetectLocation
                     ? istr("ibadah.qibla.from \(viewModel.locationDisplay)")
                     : istr("ibadah.qibla.fromManual \(viewModel.locationDisplay)"))
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            Text(istr("ibadah.qibla.macTip"))
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 460)
        }
    }

    private var noLocation: some View {
        VStack(spacing: 12) {
            Text(istr("ibadah.qibla.noLocation"))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 12) {
                Button(istr("ibadah.qibla.locate")) { viewModel.refreshLocation() }
                    .buttonStyle(.borderedProminent)
                    .tint(.waqtuPrimary)
                Button(istr("ibadah.qibla.openSettings")) {
                    ModuleWindows.openSettings(pane: SettingsView.Pane.location)
                }
            }
            if locationManager.authorizationStatus == .denied || locationManager.authorizationStatus == .restricted {
                Text(istr("ibadah.qibla.denied"))
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: 440)
        .padding(.vertical, 40)
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
                    .fill(Color.secondary.opacity(0.07))
                Circle()
                    .stroke(Color.secondary.opacity(0.35), lineWidth: 1.5)
                ForEach(0..<72, id: \.self) { i in
                    let major = i % 6 == 0
                    Rectangle()
                        .fill(Color.secondary.opacity(major ? 0.7 : 0.35))
                        .frame(width: major ? 2 : 1, height: major ? 12 : 6)
                        .offset(y: -radius + (major ? 6 : 3) + 1.5)
                        .rotationEffect(.degrees(Double(i) * 5))
                }
                ForEach(cardinals, id: \.key) { cardinal in
                    Text(label(cardinal.key))
                        .font(.system(size: 17, weight: .semibold, design: .rounded))
                        .foregroundStyle(cardinal.key == "N" ? Color.red : Color.secondary)
                        .offset(
                            x: sin(cardinal.angle * .pi / 180) * (radius - 34),
                            y: -cos(cardinal.angle * .pi / 180) * (radius - 34))
                }
                ZStack {
                    Capsule()
                        .fill(Color.waqtuPrimary)
                        .frame(width: 6, height: radius * 0.58)
                        .offset(y: -radius * 0.29)
                    kaaba
                        .offset(y: -radius * 0.58 - 16)
                    Circle()
                        .fill(Color.waqtuPrimary)
                        .frame(width: 14, height: 14)
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
