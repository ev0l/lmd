import AppKit

class AppDelegate: NSObject, NSApplicationDelegate {
    let filePath: String
    var windowController: EditorWindowController?

    init(filePath: String) {
        self.filePath = filePath
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        setupMenu()
        windowController = EditorWindowController(filePath: filePath)
        windowController?.showWindow(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func setupMenu() {
        let menuBar = NSMenu()

        let appMenuItem = NSMenuItem()
        menuBar.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu
        appMenu.addItem(withTitle: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        appMenu.addItem(withTitle: "Quit lmd", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let editMenuItem = NSMenuItem()
        menuBar.addItem(editMenuItem)
        let editMenu = NSMenu(title: "Edit")
        editMenuItem.submenu = editMenu
        editMenu.addItem(withTitle: "Undo",       action: Selector(("undo:")),                    keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo",       action: Selector(("redo:")),                    keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Cut",        action: #selector(NSText.cut(_:)),              keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy",       action: #selector(NSText.copy(_:)),             keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste",      action: #selector(NSText.paste(_:)),            keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)),        keyEquivalent: "a")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "Find…",      action: #selector(NSResponder.performTextFinderAction(_:)), keyEquivalent: "f")

        NSApp.mainMenu = menuBar
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}
