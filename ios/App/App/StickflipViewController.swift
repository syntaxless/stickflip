import UIKit
import Capacitor

// The game's screen. Same as Capacitor's own, plus:
// - registers the app's own native plugin (haptics + Game Center),
// - keeps the status bar out of the way.
// (Overriding the home-indicator and edge-gesture properties isn't allowed from
// outside UIKit on the current SDK, so those stay at their defaults.)
class StickflipViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(StickflipPlugin())
    }

    override open func viewDidLoad() {
        super.viewDidLoad()
        let navy = UIColor(red: 0, green: 0, blue: 128.0 / 255.0, alpha: 1)
        view.backgroundColor = navy
        webView?.isOpaque = false
        webView?.backgroundColor = navy
        webView?.scrollView.backgroundColor = navy
        webView?.scrollView.bounces = false
    }

    override var prefersStatusBarHidden: Bool { true }
}
