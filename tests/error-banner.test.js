import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Runs index.html's inline error handler against a fake window and returns what
// it would show in the red banner.
function banner(event) {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const code = html.match(/<script>\s*(\/\/ If the game fails to start[\s\S]*?)<\/script>/)[1];
  const el = { hidden: true, textContent: '' };
  const listeners = {};
  const sandbox = {
    document: { getElementById: () => el },
    location: { origin: 'https://stickflip.itschefff.com' },
    window: { addEventListener: (type, fn) => (listeners[type] = fn) },
  };
  vm.runInNewContext(code, sandbox);
  listeners.error(event);
  return el.hidden ? null : el.textContent;
}

test('a blocked analytics script (Brave) does not show the error banner', () => {
  assert.equal(banner({ target: { src: 'https://gc.zgo.at/count.js' } }), null);
  assert.equal(banner({ target: { src: 'https://example.com/anything.js' } }), null);
});

test('a script from a lookalike host is not treated as ours', () => {
  assert.equal(banner({ target: { src: 'https://stickflip.itschefff.com.evil.test/x.js' } }), null);
});

test('our own file failing to load still shows the banner', () => {
  const msg = banner({ target: { src: 'https://stickflip.itschefff.com/src-abc123/main.js' } });
  assert.match(msg, /could not load/);
});

test('an error thrown in our own code shows the banner; a foreign one does not', () => {
  const own = { message: 'boom', filename: 'https://stickflip.itschefff.com/src-abc/game.js', error: { stack: '' } };
  assert.match(banner(own), /boom/);
  assert.equal(banner({ message: 'x', filename: 'chrome-extension://abc/inject.js', error: { stack: '' } }), null);
  assert.equal(banner({ message: 'Script error.', filename: '', error: null }), null);
});
