import Foundation
import MachO

private func sectionData(segment: String, section: String) -> Data? {
    var size: UInt = 0
    var header = _mh_execute_header
    guard let ptr = getsectiondata(&header, segment, section, &size) else {
        return nil
    }
    return Data(bytes: ptr, count: Int(size))
}

func prepareEditorFiles() -> URL? {
    let dir = FileManager.default.temporaryDirectory.appendingPathComponent("lmd")
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

    guard
        let html = sectionData(segment: "__TEXT", section: "__editor_html"),
        let js   = sectionData(segment: "__TEXT", section: "__editor_js")
    else { return nil }

    let htmlURL = dir.appendingPathComponent("editor.html")
    let jsURL   = dir.appendingPathComponent("editor.bundle.js")

    try? html.write(to: htmlURL)
    try? js.write(to: jsURL)

    return htmlURL
}
