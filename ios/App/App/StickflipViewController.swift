import UIKit
import Capacitor

// The game's screen. Same as Capacitor's own, plus:
// - registers the app's own native plugin (haptics + Game Center),
// - keeps the status bar and home indicator out of the way, and asks iOS to
//   let swipes near the screen edges reach the game first (it's all gestures).
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
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
}
