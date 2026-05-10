import AppKit
import WebKit

class EditorWindowController: NSWindowController {
    private var webView: WKWebView!
    private let bridge = Bridge()
    private let fileHandler: FileHandler

    init(filePath: String) {
        self.fileHandler = FileHandler(path: filePath)

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 900, height: 700),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = URL(fileURLWithPath: filePath).lastPathComponent
        window.center()
        window.setFrameAutosaveName("EditorWindow")
        super.init(window: window)

        setupBridge()
        setupWebView()

        fileHandler.onExternalChange = { [weak self] content in
            self?.bridge.load(content: content)
        }
        fileHandler.startWatching()
    }

    required init?(coder: NSCoder) {
        fatalError("not implemented")
    }

    private func setupBridge() {
        bridge.onReady = { [weak self] in
            guard let self else { return }
            self.bridge.load(content: self.fileHandler.read())
        }
        bridge.onSave = { [weak self] content in
            self?.fileHandler.write(content)
        }
    }

    private func setupWebView() {
        let config = WKWebViewConfiguration()
        config.userContentController.add(bridge, name: "bridge")

        webView = WKWebView(frame: .zero, configuration: config)
        if #available(macOS 13.3, *) { webView.isInspectable = true }
        bridge.webView = webView
        window?.contentView = webView

        guard let htmlURL = prepareEditorFiles() else { return }
        let homeDir = URL(fileURLWithPath: NSHomeDirectory())
        webView.loadFileURL(htmlURL, allowingReadAccessTo: homeDir)
    }
}
