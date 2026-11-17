// Extras for the iOS app (ios/, built with Capacitor). On the website every
// call here does nothing, so the web game behaves exactly as before.
//
// The app's own Swift plugin (ios/App/App/StickflipPlugin.swift) provides:
// haptics, and the Game Center leaderboard next to the Supabase one.

const cap = typeof window !== 'undefined' ? window.Capacitor : undefined;

// True inside the iOS app.
export const NATIVE = !!cap?.isNativePlatform?.();

// Capacitor puts each native plugin on window.Capacitor.Plugins before the page loads.
const plugin = NATIVE ? cap.Plugins?.Stickflip : null;
const call = (method, args) => {
  try {
    plugin?.[method](args)?.catch?.(() => {});
  } catch {
    /* the plugin is missing or failed: play on without it */
  }
};

// Which game events get a tap, and how strong.
const HAPTICS = {
  pop: 'light',
  land: 'medium',
  grind: 'rigid',
  bail: 'error',
  complete: 'success',
};

// Called once per frame with that frame's game events.
export function haptics(events) {
  if (!NATIVE) return;
  for (const e of events) if (HAPTICS[e.type]) call('haptic', { kind: HAPTICS[e.type] });
}

// Each stage has its own Game Center leaderboard, like the in-game tables:
// stage id 'stage-1' -> leaderboard 'stickflip.stage1'. The same IDs must be
// created in App Store Connect.
const leaderboardFor = (stageId) => `stickflip.${String(stageId).replace(/[^a-z0-9]/gi, '')}`;

// A finished run's total goes to its stage's Game Center board too (if the
// player is signed in).
export function submitToGameCenter(score, stageId) {
  if (NATIVE) call('submitScore', { score: Math.round(score), leaderboard: leaderboardFor(stageId) });
}

// Whether to offer the GAME CENTER button on the high-score table: only in the
// app, once the player is signed in. Checked again each time the table opens.
let signedIn = false;
export const gameCenterReady = () => signedIn;
export function refreshGameCenter() {
  if (!NATIVE) return;
  try {
    plugin?.isSignedIn?.()?.then((r) => (signedIn = !!r?.signedIn)).catch(() => {});
  } catch {
    /* no plugin: no button */
  }
}
refreshGameCenter();

// Opens that stage's Game Center leaderboard over the game.
export function openGameCenter(stageId) {
  if (NATIVE) call('showLeaderboard', { leaderboard: leaderboardFor(stageId) });
}
