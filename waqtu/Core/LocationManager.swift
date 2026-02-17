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
}

extension LocationManager: CLLocationManagerDelegate {
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.first else { return }
        let coords = Coordinates(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude
        )
        coordinates = coords
        locationForGeocoding = location
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
