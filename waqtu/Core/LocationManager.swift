import Foundation
import CoreLocation
import Combine
import Adhan

final class LocationManager: NSObject, ObservableObject {
    private let locationManager = CLLocationManager()

    @Published var coordinates: Coordinates?
    /// CLLocation for reverse geocoding (city name). Set when coordinates update.
    @Published var locationForGeocoding: CLLocation?
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined
    /// True while a manual refresh (Locate Me) is in progress.
    @Published var isRefreshing: Bool = false

    override init() {
        super.init()
        setupLocationManager()
    }

    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyKilometer

        // If already authorized (e.g. from previous launch), start updating immediately
        let status: CLAuthorizationStatus
        if #available(macOS 14.0, *) {
            status = locationManager.authorizationStatus
        } else {
            status = CLLocationManager.authorizationStatus()
        }
        #if os(macOS)
        if status == .authorizedAlways {
            startUpdating()
        }
        #else
        if status == .authorizedWhenInUse || status == .authorizedAlways {
            startUpdating()
        }
        #endif
    }

    func requestPermission() {
        locationManager.requestWhenInUseAuthorization()
    }

    func startUpdating() {
        locationManager.startUpdatingLocation()
    }

    func stopUpdating() {
        locationManager.stopUpdatingLocation()
    }

    /// Forces a fresh location update. Use for "Locate Me" button.
    /// Requires authorization. Publishes result via coordinates/locationForGeocoding.
    func refreshLocation() {
        let status: CLAuthorizationStatus
        if #available(macOS 14.0, *) {
            status = locationManager.authorizationStatus
        } else {
            status = CLLocationManager.authorizationStatus()
        }
        #if os(macOS)
        guard status == .authorizedAlways else {
            requestPermission()
            return
        }
        #else
        guard status == .authorizedWhenInUse || status == .authorizedAlways else {
            requestPermission()
            return
        }
        #endif
        isRefreshing = true
        locationManager.requestLocation()
    }
}

extension LocationManager: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.first else { return }
        isRefreshing = false
        let coords = Coordinates(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude
        )
        coordinates = coords
        locationForGeocoding = location
        stopUpdating()
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        isRefreshing = false
        stopUpdating()
    }

    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        authorizationStatus = status

        switch status {
        #if os(macOS)
        case .authorizedAlways:
            startUpdating()
        #else
        case .authorizedWhenInUse, .authorizedAlways:
            startUpdating()
        #endif
        case .denied, .restricted:
            stopUpdating()
        default:
            break
        }
    }
}
