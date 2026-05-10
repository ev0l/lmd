import Foundation

class FileHandler {
    let path: String
    private var source: DispatchSourceFileSystemObject?
    var onExternalChange: ((String) -> Void)?

    init(path: String) {
        self.path = path
    }

    func read() -> String {
        (try? String(contentsOfFile: path, encoding: .utf8)) ?? ""
    }

    func write(_ content: String) {
        let url = URL(fileURLWithPath: path)
        let tmp = url.deletingLastPathComponent()
            .appendingPathComponent(".lmd-\(UUID().uuidString).tmp")
        guard (try? content.write(to: tmp, atomically: false, encoding: .utf8)) != nil else { return }
        _ = try? FileManager.default.replaceItemAt(url, withItemAt: tmp)
    }

    func startWatching() {
        let fd = open(path, O_EVTONLY)
        guard fd >= 0 else { return }
        source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: fd, eventMask: .write, queue: .main
        )
        source?.setEventHandler { [weak self] in
            guard let self else { return }
            self.onExternalChange?(self.read())
        }
        source?.setCancelHandler { close(fd) }
        source?.resume()
    }

    func stopWatching() {
        source?.cancel()
        source = nil
    }
}
