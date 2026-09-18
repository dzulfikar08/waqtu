// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "WaqtuCore",
    products: [
        .library(name: "WaqtuCore", targets: ["WaqtuCore"])
    ],
    targets: [
        .target(name: "WaqtuCore"),
        .testTarget(name: "WaqtuCoreTests", dependencies: ["WaqtuCore"]),
    ]
)
