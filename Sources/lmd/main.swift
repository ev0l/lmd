import AppKit

let args = CommandLine.arguments
guard args.count > 1 else {
    fputs("Usage: lmd <filename>\n", stderr)
    exit(1)
}

let rawPath = args[1]
let expandedPath = (rawPath as NSString).expandingTildeInPath
let absolutePath: String
if expandedPath.hasPrefix("/") {
    absolutePath = expandedPath
} else {
    absolutePath = FileManager.default.currentDirectoryPath + "/" + expandedPath
}

if !FileManager.default.fileExists(atPath: absolutePath) {
    FileManager.default.createFile(atPath: absolutePath, contents: Data())
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate(filePath: absolutePath)
app.delegate = delegate
app.run()
