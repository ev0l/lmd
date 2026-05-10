import AppKit
import WebKit

class Bridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    var onReady: (() -> Void)?
    var onSave: ((String) -> Void)?

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else { return }

        switch type {
        case "ready":
            onReady?()
        case "save":
            if let content = body["content"] as? String {
                onSave?(content)
            }
        case "openLink":
            if let urlString = body["url"] as? String,
               let url = URL(string: urlString) {
                NSWorkspace.shared.open(url)
            }
        default:
            break
        }
    }

    func load(content: String) {
        guard let data = try? JSONEncoder().encode(content),
              let json = String(data: data, encoding: .utf8) else { return }
        webView?.evaluateJavaScript("window.lmd && window.lmd.load(\(json))", completionHandler: nil)
    }
}
