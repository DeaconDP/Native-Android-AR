// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NativeAr",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "NativeAr",
            targets: ["NativeArPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/warrenm/GLTFKit2.git", from: "0.5.4")
    ],
    targets: [
        .target(
            name: "NativeArPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "GLTFKit2", package: "GLTFKit2")
            ],
            path: "ios/Sources/NativeArPlugin")
    ]
)
