import UIKit
import GameKit
import Capacitor

// The app's own native features, called from src/native.js:
//   haptic({ kind })            a tap on the phone's Taptic Engine
//   submitScore({ score, leaderboard })  posts a run total to that stage's leaderboard
//   isSignedIn()                whether the player is signed in to Game Center
//   showLeaderboard({ leaderboard })     opens that leaderboard over the game
@objc(StickflipPlugin)
public class StickflipPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "StickflipPlugin"
    public let jsName = "Stickflip"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "haptic", returnType: CAPPluginReturnNone),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isSignedIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise),
    ]

    // One leaderboard per stage ("stickflip.stage1", "stickflip.stage2", ...),
    // named by src/native.js. Each must exist in App Store Connect.
    static let defaultLeaderboardID = "stickflip.stage1"

    private let light = UIImpactFeedbackGenerator(style: .light)
    private let medium = UIImpactFeedbackGenerator(style: .medium)
    private let rigid = UIImpactFeedbackGenerator(style: .rigid)
    private let notice = UINotificationFeedbackGenerator()

    override public func load() {
        DispatchQueue.main.async {
            self.light.prepare()
            self.medium.prepare()
            self.authenticate()
        }
    }

    // Sign in to Game Center quietly at launch. If the player isn't signed in,
    // iOS hands back its sign-in screen, which is shown once.
    private func authenticate() {
        GKLocalPlayer.local.authenticateHandler = { [weak self] signIn, _ in
            if let signIn = signIn {
                self?.bridge?.viewController?.present(signIn, animated: true)
            }
        }
    }

    @objc func haptic(_ call: CAPPluginCall) {
        let kind = call.getString("kind") ?? "light"
        DispatchQueue.main.async {
            switch kind {
            case "medium": self.medium.impactOccurred()
            case "rigid": self.rigid.impactOccurred()
            case "success": self.notice.notificationOccurred(.success)
            case "error": self.notice.notificationOccurred(.error)
            default: self.light.impactOccurred()
            }
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.resolve(["submitted": false])
            return
        }
        let score = call.getInt("score") ?? 0
        let board = call.getString("leaderboard") ?? StickflipPlugin.defaultLeaderboardID
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local,
                                  leaderboardIDs: [board]) { error in
            call.resolve(["submitted": error == nil])
        }
    }

    @objc func isSignedIn(_ call: CAPPluginCall) {
        call.resolve(["signedIn": GKLocalPlayer.local.isAuthenticated])
    }

    @objc func showLeaderboard(_ call: CAPPluginCall) {
        let id = call.getString("leaderboard") ?? StickflipPlugin.defaultLeaderboardID
        DispatchQueue.main.async {
            guard GKLocalPlayer.local.isAuthenticated, let host = self.bridge?.viewController else {
                call.resolve(["shown": false])
                return
            }
            let board = GKGameCenterViewController(leaderboardID: id,
                                                   playerScope: .global, timeScope: .allTime)
            board.gameCenterDelegate = self
            host.present(board, animated: true)
            call.resolve(["shown": true])
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
