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

**Hold for a higher ollie.** On the ground the ollie pops when you lift your
finger (or let go of Space). Hold it and the skater crouches lower and lower,
then pops up to about 1.25x as high after a 0.7 s hold (still not enough
air for a backflip on flat ground). A quick tap is a normal
ollie. Tuning: `CHARGE_*` in `src/config.js`.

**Draw a shape in the air** for other tricks. Every shape starts by pulling
down (like popping the tail), then flicks or hooks back up. "Right" means
forward, the way the skater rides. Shapes are matched loosely, so a quick,
rough version works on a phone.

| Shape (in the air)                                   | Trick            | Points |
| ---------------------------------------------------- | ---------------- | ------ |
| tap                                                  | KICKFLIP         | 150    |
| down, then flick up-right                            | KICKFLIP         | 150    |
| down, then flick up-left                             | HEELFLIP         | 150    |
| down, then hook right and up (a U)                   | POP SHOVE-IT     | 100    |
| down, then hook left and up                          | FS POP SHOVE-IT  | 100    |
| down-left, then a wide arc round to the right        | 360 SHOVE-IT     | 200    |
| down-right, then a wide arc round to the left        | FS 360 SHOVE-IT  | 200    |
| down-left, then straight back up-right (a V)         | VARIAL KICKFLIP  | 250    |
| down-right, then straight back up-left               | VARIAL HEELFLIP  | 250    |
| down-left, a short zig right, then straight up       | HARDFLIP         | 250    |
| down-right, a short zag left, then straight up       | INWARD HEELFLIP  | 250    |
| left, curve down and round, then up-right            | 360 FLIP         | 300    |
| right, curve down and round, then up-left            | LASER FLIP       | 350    |
| right, curve down and round, then straight up        | 360 HARDFLIP     | 400    |
| left, curve down and round, then straight up         | 360 INWARD HEEL  | 400    |
| straight right (forward)                             | FS 360 spin      | 200    |
| straight left (backward)                             | BS 360 spin      | 200    |
| a counter-clockwise circle                           | BACKFLIP         | 1000   |

Every stroke does something: a straight swipe down is a heelflip, up is a
pop shove-it, and down-and-back-up is a kickflip. The time your finger spends
drawing counts toward the trick (up to 60% of it, `DRAW_CREDIT`), so drawing
a shape doesn't eat the air time it needs. You can also start drawing while
riding up the quarter pipe and lift once you're in the air.

**Ollie straight into a trick:** on the ground, hold to charge, then draw the
shape before you lift. The ollie pops as that trick, with the charged height.
A plain tap or a hold and release is still just an ollie.

The backflip turns the rider and board a full 360 backwards and is slow
(0.85 s), so it only fits in big air: the quarter pipe or the secret level.
Land before it comes round and you bail. The circle has to go most of the
way round (about 290 degrees) without cutting through its middle, so none
of the flip shapes set it off.

On desktop, Up is a pop shove-it, Down a heelflip, Left and Right the 360
spins, and B the backflip. The trick list lives in `TRICKS` in
`src/config.js`, and the shapes are `SHAPES` in `src/gesture.js`.

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
4. **Bank to Bank**: ride up a bank and ollie off its lip, over a gap, onto the
   bank going down the other side. Rolling up a bank adds to your pop; roll off
   the lip without an ollie and you drop in. Stars: finish, 200, 450.
5. **Euro Gap**: a bank that runs right up to the foot of a two-stair going up.
   Ollie off the bank's lip up onto the top: the lower step and the risers are
   bails.
   Stars: finish, 150, 300.
6. **Quarter Pipe**: a long rail in front of a quarter pipe. Grind the rail,
   ride up the quarter pipe (it speeds you up by 35%, `QP_SPEED`, for
   the rest of the run, and keeps that pace across the screen up the curve) and go straight up out of it and straight back down, at
   riding speed and without turning: over a second of hang time for tricks
   (FS AIR, plus any flip you finish before you drop back in). Then ride back out fakie to the left, ollieing or grinding the rail
   again on the way. Stars: finish, 700, 1500.

**Secret level: Mega Ramp.** Side-scrolling, about three screens wide: drop
in from a high deck and fly off the kicker at a raised, gently curved
"rainbow" rail. Ollie off the kicker to clear the whole rail and land in the
long bank that starts right at its end, or grind over the curve and pop (or
roll) off the end into the bank. Finish with a big air out of a tall quarter
pipe. Rails take an `arc` option for the curve. It's played after level 6
from your third full run onwards (finished runs are counted on the device), and
its score counts toward the run total.

* Bails explain what went wrong: slammed or clipped the rail, landed mid-flip,
  came up short, landed on the stairs or a step, rolled off an edge, or hit
  the quarter pipe's wall.

Tricks chain into a combo until you land on the ground, and the combo is
multiplied by the number of tricks.

**Runs and high scores.** A run takes you through the levels in order. TOTAL
in the corner adds up the score of each level you've cleared (ride a level
again and your latest clear counts). After the last level, FINISH RUN puts the
total on the top 5 table; a new entry asks for up to 4 initials (tap + and -, or
type them). REPLAY then starts over from level 1 with a fresh total. The table shows on the title screen too.

**Shared high scores.** With `SCOREBOARD` in `src/config.js` filled in (a
Supabase project URL and its public anon key), the top 5 is shared by everyone.
The table is set up by `supabase/scores.sql`: row level security lets the anon
key only read scores and add new ones, the database checks the initials (1-4
letters) and score (1-100000), and posting is rate limited (3 a minute per
address, 30 overall). If the shared table can't be reached, the game falls back
to the on-device table, and scores are always kept on the device too. Local
copies (localhost) only use the device table.

## Testing a level

On the /unstable/ preview or a local copy (`npm start`), add `?level=N` to jump
straight to level N (1-6), or `?level=secret` for the secret level, e.g.
`https://stickflip.itschefff.com/unstable/?level=6`. The HUD then says TEST.
Test play keeps its own saves and on-device high scores, so it never touches
your real progress or the shared table. It does nothing on the live site.

In test mode each stroke is drawn on screen (cyan while the finger is down,
yellow after) with what it was read as, the template shape it matched and how
far off it was (0 is exact; around 0.15 or more is a rough match).

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
src/leaderboard.js      top 5 high scores (on-device, swappable for a shared one)
src/run.js              the run total across levels
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
* `ground` (optional): segments `{ x1, x2, y, landable, bail, wall }` that
  replace the flat ground there: a gap is a segment far below the screen,
  stairs are a raised platform plus non-landable steps. A segment can slope
  (`y1`/`y2` instead of `y`: a bank) or be a quarter pipe curve
  (`qp: { cx, cy, R }`). `bail` names the bail for landing on a non-landable
  segment, `wall` the one for flying into its side.
* `draw(g, fx)`: render it into the pixel framebuffer `g` (world units / 3 =
  pixels). The ground is drawn for you. `fx.time` is the clock. Levels can also set `takeoffHint: { x1, x2 }` to draw a POP marker.

The engine handles everything else. A level can also set `width` (wider than
960 scrolls, with the camera following the skater) and `speed` (rolling speed).
