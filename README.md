# Stickflip

A tap-to-play stick figure skateboarding game. Each stage is one long strip
of obstacles the camera pans along; its levels are named sections of the
strip, and each one is a checkpoint. You get past everything using nothing
but taps, holds and drawn trick shapes.

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

## Stages

A stage lays single-screen sections (`src/levels/levelN.js`) end to end into
one strip (`src/stages/`). Each section's name shows top-left as you reach it
(1-3: FIVE STAIR) and is a checkpoint: a bail replays from the start of the
section you bailed in, with the score you'd banked before it, and the bail
screen's RESTART STAGE goes back to the top. A reload carries on from the
last checkpoint.

**Stage select.** Finishing a stage opens the next one (on this device).
Once there's more than one, the end-of-run REPLAY button reads STAGES and
opens the stage list, and the title screen has a STAGES button. Each stage
has its own top 5 (a `stage` column in the shared table; Stage 1 keeps the
scores from before stages).

**Stage 2** (street): Curb (ollie over a long, low curb, or land on it and
roll or grind along the top), Step Up (ollie up three steps onto a ledge,
then drop off its end), Trash Can (a tall can: a well-timed ollie clears it)
and Ring of Fire (a kicker, a gap, and a burning ring to fly through: feet
below it or head above it is a bail; clean through is a RING OF FIRE trick).

**Stage 3** (construction site): Rock (a tiny rock stops the board dead, so
ollie it), Cone Row (three traffic cones, one ollie clears them), Barrier Gap
(a jersey barrier you can ollie onto or grind, then a gap right behind it),
Barricade (a sawhorse across the street), Scaffold Rail, Big Set (six stairs with a
handrail) and Big Gap (a tall kicker and a 240-unit gap). Road signs stand
behind the action as decor.

The ground is a thin strip of a stack of chunky pixel layers: asphalt (a concrete sidewalk in Stage 3), thin grass, muted dirt with a few stones, then black, and the rider is 10%
faster than the first release (ROLL_SPEED 330).

**Stage 4** (playground, rough first pass): Toy Blocks (a pyramid of blocks,
one ollie), Slide (ride up and down it), Sandbox (a gap), Seesaw (grind the
plank), Monkey Bars (a higher grind), Block Tower (ollie up five block steps)
and Ball Pit (a kicker and a 240-unit gap). Bright blue sky, red rubber-mat
surface, swing sets behind.

**Stage 5** (skate park, the hardest, rough first pass): Ledges (two concrete
ledges), Flat Bar, Hubba (a solid concrete wall down stairs, grind its top
edge), Curb Cut (a driveway entrance between two curbs), Fun Box (a wooden
trapezoid with a rail on top), Big Set (three big steps with a handrail) and
Cop Car (a wooden ramp up to a police car: grind its light bar). Sunset sky
with a dusk skyline.

**Stage 1** is a rock, then the six original levels in order, joined by a bank
(a good way past the rail, so you can land first) up to Five
Stair's platform and a drop off the Euro Gap stairs. The Quarter Pipe is the
finale: ride back out to the left to finish.

1. **First Rock**: a small rock in the road. Roll into it and the board stops
   dead; any ollie clears it.
2. **First Gap**: a 130 px gap. Ollie just before the edge: too early and you
   come up short, too late and you roll in. Stars: finish, 150 (any flip), 300
   (a 360 flip).
3. **First Rail**: a low rail, 260 px long and 64 px high, too long to ollie.
   Grind it. Stars: finish, 700 (kickflip + grind), 1400 (kickflip in, grind,
   pop and kickflip out).
4. **Five Stair**: start on a platform with five stairs down and a handrail.
   Ollie or flip the whole set (land on a step and you bail), or grind the
   handrail down. Stars: finish, 600, 1100 (kickflip in, grind, pop and flip out).
5. **Bank to Bank**: ride up a bank and ollie off its lip, over a pool of water, onto the
   bank going down the other side. Rolling up a bank adds to your pop; roll off
   the lip without an ollie and you splash in. Stars: finish, 200, 450.
6. **Euro Gap**: a bank that runs right up to the foot of a two-stair going up.
   Ollie off the bank's lip up onto the top: the lower step and the risers are
   bails.
   Stars: finish, 150, 300.
7. **Quarter Pipe**: a long rail in front of a quarter pipe. Grind the rail,
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
pipe. Rails take an `arc` option for the curve. Finish Stage 1 with at least
5,000 points in that run (`SECRET_SCORE` in `src/main.js`, before the no-bail
bonus) and you're taken there; its score counts toward the run total. A
blinking SECRET LEVEL UNLOCKED! banner (SECRET LEVEL AHEAD! on later runs)
leads into it, its HUD says BONUS: MEGA RAMP, and it has
its own palette from the 16 named HTML colours (purple sky, yellow text).

* Bails explain what went wrong: slammed or clipped the rail, landed mid-flip,
  came up short, landed on the stairs or a step, rolled off an edge, or hit
  the quarter pipe's wall.

Tricks chain into a combo until you land on the ground, and the combo is
multiplied by the number of tricks.

**Runs and high scores.** A run takes you through the stages in order. TOTAL
in the corner is the run's score so far; a bail loses what you scored since
the last checkpoint. A run with no bails gets a 2,000 bonus. At the end the
total goes on the top 5 table; a new entry asks for a name of up to 6 letters
(tap + and -, or type them). REPLAY then starts over with a fresh total. The table shows on the title screen too.

**Shared high scores.** With `SCOREBOARD` in `src/config.js` filled in (a
Supabase project URL and its public anon key), the top 5 is shared by everyone.
The table is set up by `supabase/scores.sql`: row level security lets the anon
key only read scores and add new ones, the database checks the initials (1-4
letters) and score (1-100000), and posting is rate limited (3 a minute per
address, 30 overall). If the shared table can't be reached, the game falls back
to the on-device table, and scores are always kept on the device too. Only the
live site posts to the shared table: the /unstable/ preview and local copies
(localhost) keep their own device table, apart from the live one.

## Testing a level

On the /unstable/ preview or a local copy (`npm start`), add `?level=N` to start
Stage 1 at its Nth checkpoint (1-7), `?level=S-N` for stage S (`?level=2-4`:
Ring of Fire), or `?level=secret` for the secret level, e.g.
`https://stickflip.itschefff.com/unstable/?level=6`. The HUD then says TEST.
Test play keeps its own saves and on-device high scores, so it never touches
your real progress or the shared table. It does nothing on the live site.

In test mode each stroke is drawn on screen (cyan while the finger is down,
yellow after) with what it was read as, the template shape it matched and how
far off it was (0 is exact; around 0.15 or more is a rough match).

## Design choices

* **DOS look.** The game draws into a 320×180 framebuffer with a 3-colour
  palette: plain bright blue sky (110, 180, 255), black for everything solid
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
src/levels/             one file per section (a screen of obstacles) + the Mega Ramp
src/stages/             stages: sections laid end to end (compose.js), the ordered STAGES list
src/render/             pixel framebuffer + font, stick figure, background, HUD, effects
src/audio.js            PC-speaker style beeps
src/leaderboard.js      top 5 high scores (on-device, swappable for a shared one)
src/run.js              the run total across stages
src/update.js           reloads an installed Home Screen app when a newer version is deployed
icons/, favicon.ico      app icons + share image, drawn by scripts/make-icons.mjs (npm run icons)
manifest.webmanifest    Home Screen app settings (full screen, landscape)
tests/game.test.js      plays the levels with scripted taps, swipes and holds
```

### Adding a stage

1. Write each section as a one-screen level in `src/levels/` exporting
   `{ id, name, obstacles }` (laid out on a 960-wide screen).
2. Create `src/stages/stageN.js` with `stage({ id, name, sections: [...] })`
   from `compose.js`. Use `extra` for obstacles that join sections (in strip
   coordinates: section i starts at i * 960), and `finishLeft` if it ends with
   a ride back to the left.
3. Append it to `STAGES` in `src/stages/index.js`.

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

## iOS app

The `ios/` folder wraps the same game as a native iPhone app with
[Capacitor](https://capacitorjs.com). The game files are bundled inside the
app, so it plays offline. The website doesn't use any of this.

On a Mac with Xcode:

```sh
npm install
npm run ios        # copies the game into www/ and syncs it into ios/
npm run ios:open   # opens the project in Xcode
```

Run `npm run ios` again after any change to the game before building in Xcode.

What's different in the app:

- Always landscape, full screen, iPhone only.
- Posts to the same Supabase leaderboard as the live site, plus one Game
  Center leaderboard per stage (`stickflip.stage1`, `stickflip.stage2`, ...),
  opened from a GAME CENTER button on the high-score table.
- Haptics on pops, landings, grinds, bails and level clears
  (`src/native.js` + `ios/App/App/StickflipPlugin.swift`).
- No GoatCounter. `scripts/build-app.mjs` strips it from the app's copy.
- The App Store icon and launch screen come from `npm run icons`.
