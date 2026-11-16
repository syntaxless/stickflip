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
* There's no take-off marker, and rails never light up: not as a warning, and
  not when a grind is locked.
* Any trick still turning when you land is a bail.

**Hold to grind.** Keep your finger down as you reach a rail and it locks a
grind, no timed tap needed. Drag while holding to pick the grind:

| Hold, then drag...    | Grind       | Base points |
| --------------------- | ----------- | ----------- |
| no drag (or timed tap)| 50-50       | 100         |
| back (left)           | 5-0         | 150         |
| forward (right)       | NOSE GRIND  | 200         |

Grinds also score 1 per px ground. On desktop, hold Space through the rail, with
the left or right arrow held for a 5-0 or nose grind. Grinds live in `GRINDS`
in `src/config.js`.

## Levels

1. **First Gap**: a 130 px gap. Ollie just before the edge: too early and you
   come up short, too late and you roll in. Stars: finish, 150 (any flip), 300
   (a 360 flip).
2. **First Rail**: a low rail, 260 px long and 64 px high, too long to ollie.
   Grind it. Stars: finish, 700 (kickflip + grind), 1400 (kickflip in, grind,
   pop and kickflip out).
3. **Five Stair**: start on a platform with five stairs down and a handrail.
   Ollie or flip the whole set (land on a step and you bail), or grind the
   handrail down. Stars: finish, 600, 1100 (kickflip in, grind, pop and flip out).

* Bails explain what went wrong: slammed or clipped the rail, landed mid-flip,
  came up short, landed on the stairs, or rolled off an edge.

Tricks chain into a combo until you land on the ground, and the combo is
multiplied by the number of tricks.

## Design choices

* **DOS look.** The game draws into a 320×180 framebuffer with a 3-colour
  palette: plain navy sky, black for everything solid
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
src/obstacles/          obstacle builders (rail, gap, stairs), each with surfaces, solids, ground and draw()
src/levels/             one file per level + the ordered LEVELS list
src/render/             pixel framebuffer + font, stick figure, background, HUD, effects
src/audio.js            PC-speaker style beeps
src/update.js           reloads an installed Home Screen app when a newer version is deployed
icons/, favicon.ico      app icons + share image, drawn by scripts/make-icons.mjs (npm run icons)
manifest.webmanifest    Home Screen app settings (full screen, landscape)
tests/game.test.js      plays the levels with scripted taps, swipes and holds
```

### Adding a level

1. Create `src/levels/level2.js` exporting `{ id, name, hint, obstacles, stars }`.
2. Append it to `LEVELS` in `src/levels/index.js`. The "Next level" button
   appears automatically.

### Adding an obstacle type

Write a builder in `src/obstacles/` that returns:

* `surfaces`: top edges `{ x1, x2, y, grindable, landable, passable }`, or a
  sloped edge with `y1`/`y2` instead of `y` (a handrail). `grindable` tops can be
  grinded, `landable` tops (a box or ledge) can be landed on and rolled across,
  `passable` ones (beside the line, like a handrail) are ignored unless you're
  locked into a grind, and anything else is a bail if you come down on it.
* `solids`: rectangles `{ x, y, w, h }` that you slam into from the side.
* `ground` (optional): segments `{ x1, x2, y, landable, bail }` that replace the
  flat ground there: a gap is a segment far below the screen, stairs are a
  raised platform plus non-landable steps.
* `draw(g, fx)`: render it into the pixel framebuffer `g` (world units / 3 =
  pixels). The ground is drawn for you. `fx.time` is the clock. Levels can also set `takeoffHint: { x1, x2 }` to draw a POP marker.

The engine handles everything else. Curved ramps (kickers, quarter pipes)
would need small engine additions.
