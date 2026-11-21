import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { STAGES, SECRET } from '../src/stages/index.js';

// A slappy (ride into a low block with the finger held, the trucks slap up onto it) puts the rider on the
// block's own top surface. In a stage that surface has to be in stage coordinates like the block itself:
// left in section coordinates it threw the rider back to the start of the stage, which looked like a
// respawn instead of a bail or a grind.

const DT = 1 / 60;
const ALL = [...STAGES, SECRET];

for (const st of ALL) {
  test(`${st.name}: every slappy surface sits on its block and is one of the stage's surfaces`, () => {
    const game = new Game(st);
    for (const r of game.solids) {
      if (!r.slappy) continue;
      assert.ok(game.surfaces.includes(r.slappy), `block at x=${r.x}: slappy is not one of the stage's surfaces`);
      assert.ok(r.slappy.x1 >= r.x - 1 && r.slappy.x2 <= r.x + r.w + 1, `block at x=${r.x}: slappy surface is somewhere else (${r.slappy.x1}..${r.slappy.x2})`);
    }
  });
}

test('slappying a low block far along a stage grinds it there (no jump back to the start)', () => {
  let tried = 0;
  for (const st of STAGES) {
    const probe = new Game(st);
    for (const r of probe.solids) {
      if (!r.slappy || r.x < 1000) continue;
      // start on the section the block is in and ride straight at it with the finger held
      const index = probe.sections.reduce((a, sec, i) => (sec.x <= r.x ? i : a), 0);
      const game = new Game(st, null, { index, score: 0 });
      game.rival = null;
      game.tap();
      game.setHold(true);
      let grinded = false;
      for (let i = 0; i < 60 * 12 && game.phase === 'playing'; i++) {
        const before = game.sk.x;
        game.update(DT);
        assert.ok(game.sk.x > before - 5, `${st.name}: the rider jumped back from ${Math.round(before)} to ${Math.round(game.sk.x)}`);
        if (game.sk.mode === 'grind' && game.sk.grind.slappy && game.sk.grind.surface === r.slappy) {
          grinded = true;
          assert.ok(Math.abs(game.sk.x - r.x) < r.w + 60, `${st.name}: slappy put the rider at x=${game.sk.x}, far from the block at ${r.x}`);
          break;
        }
        if (game.sk.x > r.x + r.w + 200) break;
      }
      tried++;
      if (!grinded) continue; // another obstacle came first: the jump check above still held
    }
  }
  assert.ok(tried > 0);
});
