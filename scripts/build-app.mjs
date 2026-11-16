// Copies the web game into www/ for the iOS app (Capacitor bundles www/ into
// the app, so the game plays offline). The website itself has no build step
// and doesn't use this; only `npm run ios` does.

import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const out = new URL('../www/', import.meta.url);

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const item of ['src', 'icons', 'favicon.ico', 'manifest.webmanifest']) {
  cpSync(new URL(item, root), new URL(item, out), { recursive: true });
}

// The app never counts visits, so leave the GoatCounter snippet out entirely.
const html = readFileSync(new URL('index.html', root), 'utf8');
const stripped = html.replace(/\s*<!-- GoatCounter analytics[\s\S]*?<\/script>/, '');
if (stripped === html) throw new Error('GoatCounter snippet not found in index.html');
writeFileSync(new URL('index.html', out), stripped);

console.log('web game copied to www/');
