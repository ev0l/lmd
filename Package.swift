// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "lmd",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "lmd",
            path: "Sources/lmd",
            exclude: ["Info.plist", "Resources"],
            linkerSettings: [
                .unsafeFlags([
                    "-Xlinker", "-sectcreate",
                    "-Xlinker", "__TEXT",
                    "-Xlinker", "__info_plist",
                    "-Xlinker", "Sources/lmd/Info.plist",
                    "-Xlinker", "-sectcreate",
                    "-Xlinker", "__TEXT",
                    "-Xlinker", "__editor_html",
                    "-Xlinker", "Sources/lmd/Resources/editor.html",
                    "-Xlinker", "-sectcreate",
                    "-Xlinker", "__TEXT",
                    "-Xlinker", "__editor_js",
                    "-Xlinker", "Sources/lmd/Resources/editor.bundle.js",
                ])
            ]
        )
    ]
)
