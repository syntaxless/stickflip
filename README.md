# Stickflip

A tap-to-play stick figure skateboarding game. Every level is one obstacle on
one fixed screen with no scrolling. You roll in from the left and get past the
obstacle using nothing but taps.

## Play

```sh
npm start        # serves the game at http://localhost:8080 (and on your LAN for phones)
npm test         # runs the game-logic tests (Node 18+)
```

Live at **https://stickflip.itschefff.com** (`main`) with a preview of the
`unstable` branch at **https://stickflip.itschefff.com/unstable/**.

Branches: work lands on `unstable` first (via PRs) and is tested there.
When it's good, `unstable` is merged into `main`. Every push to either branch
runs the tests (`ci.yml`), then rebuilds the site from both (`deploy.yml`).

No build step and no dependencies. It's plain HTML, a `<canvas>` and ES
modules, so any static host (GitHub Pages, Netlify...) can serve the repo as is.
Space, Enter and the up arrow work as a tap on desktop.

## Controls

One input, **tap**, means whatever makes sense at that moment:

| Skater is...                    | Tap does...                                                           |
| ------------------------------- | --------------------------------------------------------------------- |
| waiting at the start            | roll in                                                               |
| rolling                         | **ollie**                                                             |
| in the air, < 0.2 s from a rail | **lock a grind** (the skater lands on the rail in a 50-50)            |
| in the air, otherwise           | **kickflip** (takes 0.38 s; land mid-flip and you bail)               |
| grinding                        | **pop** off the rail, then tap again in the air for another kickflip  |

**Swipe in the air** for other tricks. A swipe anywhere else counts as a tap.

| Swipe (in the air)            | Trick         | Points |
| ----------------------------- | ------------- | ------ |
| tap                           | KICKFLIP      | 150    |
| down                          | HEELFLIP      | 150    |
| up                            | POP SHOVE-IT  | 100    |
| right (forward)               | FS 360 spin   | 200    |
| left (backward)               | BS 360 spin   | 200    |
| down, then right (one stroke) | 360 FLIP      | 300    |
| down, then left (one stroke)  | HARDFLIP      | 250    |

Arrow keys work as swipes on desktop. The trick list lives in `TRICKS` in
`src/config.js`, and gesture reading is in `src/gesture.js`.

**It's meant to be hard**, like the shareware games it's inspired by:
* A grind only locks if you tap in the last 0.2 s before touching the rail.
  Tap any earlier and you get a kickflip, which won't finish in time.
* Input during a trick is ignored. One trick at a time, no mashing.
* There's no take-off marker and no warning flash on the rail. It only turns red
  once a grind is locked.
* Any trick still turning when you land is a bail.

## Level 1: First Rail

A low rail, 260 px long and 64 px high. An ollie only carries you about
225 px, so you can't clear it. You have to grind it. That makes it a good
first lesson: it teaches both taps (ollie, then grind) in one obstacle.

* The rail turns **red** once a grind is locked.
* Bails explain what went wrong: slammed the rail (popped too late), clipped the
  rail (didn't tap to grind), or landed mid-flip (flipped too late).

Scoring: tricks as above, grind 100 + 1 per px ground. Tricks chain into a combo
until you land on the ground, and the combo is multiplied by the number of tricks.
Stars: finish (1), 700 pts (2, any kickflip + grind), 1400 pts (3, kickflip in,
grind, pop and kickflip out).

## Design choices

* **DOS look.** The game draws into a 320×180 framebuffer with a 4-colour
  palette: navy sky, darker navy skyline, black for everything solid
  (ground, rail, board, rider) and red for all text, Bresenham lines and a
  built-in 5×7 bitmap font, so there's no anti-aliasing anywhere. The frame is then
  scaled up by a whole number of device pixels for chunky, even pixels.
  Sound is PC-speaker style square-wave beeps (press M to mute on desktop).

* **Fixed stage, no scrolling.** Physics runs in 960×540 world units (3 units
  per pixel). Landscape is the intended orientation, and portrait shows a hint to rotate.
* **Fixed 120 Hz physics step** so jump heights and timing windows are identical
  on 60 Hz and 120 Hz phones.
* **Tap meaning is decided by prediction.** In the air the game works out where
  you'll touch down. If that's a grindable rail and there isn't time left for a
  flip, the tap primes a grind. Otherwise it's a kickflip. This keeps one-button
  play readable without extra gestures.
* **Input on `pointerdown`**, not `click`, for low latency on touch screens.
  Zoom and scroll gestures are blocked on the canvas.
* **Logic and rendering are separate.** `src/game.js` has no DOM code, so all
  the mechanics are covered by `node --test`.

## Code layout

```
index.html              page shell, loads src/main.js
src/main.js             canvas sizing, input, game loop, saved progress
src/config.js           physics + scoring constants
src/game.js             game logic: skater state machine, collisions, scoring
src/obstacles/          obstacle builders (rail.js), each with surfaces, solids and draw()
src/levels/             one file per level + the ordered LEVELS list
src/render/             pixel framebuffer + font, stick figure, background, HUD, effects
src/audio.js            PC-speaker style beeps
tests/game.test.js      plays level 1 with scripted taps
```

### Adding a level

1. Create `src/levels/level2.js` exporting `{ id, name, hint, obstacles, stars }`.
2. Append it to `LEVELS` in `src/levels/index.js`. The "Next level" button
   appears automatically.

### Adding an obstacle type

Write a builder in `src/obstacles/` that returns:

* `surfaces`: top edges `{ x1, x2, y, grindable, landable, trick }`. `grindable` tops can be
  grinded, `landable` tops (a box or ledge) can be landed on and rolled across,
  and anything else is a bail if you come down on it.
* `solids`: rectangles `{ x, y, w, h }` that you slam into from the side.
* `draw(g, fx)`: render it into the pixel framebuffer `g` (world units / 3 = pixels). `fx.hint` is `'ready'`, `'primed'` or `null`. Levels can also set
  `takeoffHint: { x1, x2 }` to draw a POP marker on the ground, for easier levels.

The engine handles everything else. Slopes (kickers, quarter pipes) and gaps
would need small engine additions.
