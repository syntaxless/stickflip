import UIKit
import GameKit
import Capacitor

// The app's own native features, called from src/native.js:
//   haptic({ kind })            a tap on the phone's Taptic Engine
//   submitScore({ score })      posts a run total to the Game Center leaderboard
//   isSignedIn()                whether the player is signed in to Game Center
//   showLeaderboard()           opens the Game Center leaderboard over the game
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

    // Must match the leaderboard ID created in App Store Connect.
    static let leaderboardID = "stickflip.runs"

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
        GKLeaderboard.submitScore(score, context: 0, player: GKLocalPlayer.local,
                                  leaderboardIDs: [StickflipPlugin.leaderboardID]) { error in
            call.resolve(["submitted": error == nil])
        }
    }

    @objc func isSignedIn(_ call: CAPPluginCall) {
        call.resolve(["signedIn": GKLocalPlayer.local.isAuthenticated])
    }

    @objc func showLeaderboard(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard GKLocalPlayer.local.isAuthenticated, let host = self.bridge?.viewController else {
                call.resolve(["shown": false])
                return
            }
            let board = GKGameCenterViewController(leaderboardID: StickflipPlugin.leaderboardID,
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
