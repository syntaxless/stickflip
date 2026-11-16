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

// A finished run's total goes to Game Center too (if the player is signed in).
export function submitToGameCenter(score) {
  if (NATIVE) call('submitScore', { score: Math.round(score) });
}

// The Game Center button in the corner: shown only on the high-score table,
// so it never covers the game.
let accessPoint = false;
export function showGameCenterButton(visible) {
  if (!NATIVE || visible === accessPoint) return;
  accessPoint = visible;
  call('showAccessPoint', { visible });
}
