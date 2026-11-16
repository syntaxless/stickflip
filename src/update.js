// Keeps an installed Home Screen app (and any long-open tab) on the latest
// version. The deploy puts the code in a folder named after the commit
// (src-<sha>/), so the live index.html names the current version. When the app
// opens or comes back to the foreground, fetch index.html past every cache and
// reload if it points at a newer folder than the one running now.
//
// Running locally (npm start) the code lives in plain src/, so this does nothing.

const running = (import.meta.url.match(/\/src-([0-9a-f]+)\//) || [])[1];

export async function checkForUpdate() {
  if (!running || !navigator.onLine) return;
  try {
    const res = await fetch(`${location.pathname}?check=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const latest = ((await res.text()).match(/src-([0-9a-f]+)\/main\.js/) || [])[1];
    if (!latest || latest === running) return;
    // Already tried this version once and still got the old code: don't loop.
    if (new URLSearchParams(location.search).get('v') === latest) return;
    // A new URL can't be served from the old cached page.
    const params = new URLSearchParams(location.search); // keep ?level= etc.
    params.set('v', latest);
    location.replace(`${location.pathname}?${params}`);
  } catch {
    // Offline or blocked: keep playing the version we have.
  }
}

// Check now, and again whenever the app returns to the foreground, unless
// `busy()` says a run is in progress.
export function watchForUpdates(busy = () => false) {
  checkForUpdate();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !busy()) checkForUpdate();
  });
}
