// swift-tools-version:5.9
import PackageDescription

// Keep the Adhan-Swift pin identical to the app's
// (waqt.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved); CI asserts this.
let package = Package(
    name: "parity",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(url: "https://github.com/batoulapps/Adhan-Swift", exact: "1.4.0"),
    ],
    targets: [
        .executableTarget(
            name: "parity",
            dependencies: [.product(name: "Adhan", package: "Adhan-Swift")]
        ),
    ]
)
