# Stickflip

A tap-to-play stick figure skateboarding game. Every level is one obstacle on
one fixed screen with no scrolling. You roll in from the left and get past the
obstacle using nothing but taps.

## Play

```sh
npm start        # serves the game at http://localhost:8080 (and on your LAN for phones)
npm test         # runs the game-logic tests (Node 18+)
```

Live at **https://stickflip.itschefff.com**. Every push to `main` runs the
tests and deploys to GitHub Pages (`.github/workflows/pages.yml`, custom domain in `CNAME`).

Branches: work lands on `unstable` first (via PRs) and is tested there.
When it's good, `unstable` is merged into `main`, which deploys.

No build step and no dependencies. It's plain HTML, a `<canvas>` and ES
modules, so any static host (GitHub Pages, Netlify...) can serve the repo as is.
Space, Enter and the up arrow work as a tap on desktop.

## Controls

One input, **tap**, means whatever makes sense at that moment:

| Skater is...                    | Tap does...                                                           |
| ------------------------------- | --------------------------------------------------------------------- |
| waiting at the start            | roll in                                                               |
| rolling                         | **ollie**                                                             |
| in the air, rail glowing yellow | **lock a grind** (the skater lands on the rail in a 50-50)            |
| in the air, otherwise           | **kickflip** (takes 0.38 s; land mid-flip and you bail)               |
| grinding                        | **pop** off the rail, then tap again in the air for another kickflip  |

A tap pressed during a kickflip is remembered and used the moment the flip
finishes, so mashing doesn't eat inputs.

## Level 1: First Rail

A low rail, 260 px long and 64 px high. An ollie only carries you about
190 px, so you can't clear it. You have to grind it. That makes it a good
first lesson: it teaches both taps (ollie, then grind) in one obstacle.

* A chalk **POP HERE** mark shows the take-off window that lands you on the rail.
* The rail **glows yellow** when a tap would lock a grind, and **green** once it's locked.
* Bails explain what went wrong: slammed the rail (popped too late), clipped the
  rail (didn't tap to grind), or landed mid-flip (flipped too late).

Scoring: kickflip 150, grind 100 + 1 per px ground. Tricks chain into a combo
until you land on the ground, and the combo is multiplied by the number of tricks.
Stars: finish (1), 700 pts (2, any kickflip + grind), 1400 pts (3, kickflip in,
grind, pop and kickflip out).

## Design choices

* **Fixed 960×540 stage** scaled to fit the screen. The background extends to
  fill any extra space instead of showing black bars. Landscape is the intended
  orientation, and portrait shows a hint to rotate.
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
src/render/             stick figure poses, board, background, HUD, effects
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
* `draw(ctx, fx)`: render it. `fx.hint` is `'ready'`, `'primed'` or `null` for grind glow.

The engine handles everything else. Slopes (kickers, quarter pipes) and gaps
would need small engine additions.
