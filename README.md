# Stickflip

A tap-to-play stick figure skateboarding game in chunky pixel art. Each stage
is one long strip of obstacles the camera pans along; its levels are named
sections of the strip, and each one is a checkpoint. You get past everything
using nothing but taps, holds and drawn trick shapes. Six stages (the last one
is a race) and a secret Mega Ramp.

## Play and develop

```sh
npm start        # serves the game at http://localhost:8080 (and on your LAN for phones)
npm test         # runs the game-logic tests (Node 18+)
```

Live at **https://stickflip.itschefff.com** (`main`) with a preview of the
`unstable` branch at **https://stickflip.itschefff.com/unstable/**. The preview
has its own orange BETA Home Screen icon and the name "Stickflip Beta", so it can
sit next to the real app.

**Release workflow.** Work lands on `unstable` first, as pull requests that must
pass the tests, and is tried on the preview. When it's good, `unstable` is
released to `main` with a pull request (nothing is released without the
owner's go-ahead). Every push to either branch runs the tests (`ci.yml`); when
they pass, `deploy.yml` rebuilds the one GitHub Pages site from both branches.

No build step and no dependencies for the web game: plain HTML, a `<canvas>`
and ES modules, so any static host can serve the repo as is. The only
dependencies (Capacitor) are for the iOS app. Space, Enter and the up arrow work
as a tap on desktop.

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
then pops up to about 1.25x as high after a 0.7 s hold (`CHARGE_MIN` + `CHARGE_TIME`) (still not enough
air for a backflip on flat ground). A quick tap is a normal
ollie. Tuning: `CHARGE_*` in `src/config.js`. A charged ollie also flies farther (about 240 units
for a plain ollie, about 350 for a full charge), and some obstacles need it:
Stage 4's Sandbox is too wide for a plain ollie, and the Big Drop's one-jump route
needs one.

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


**Speed.** The rider rolls at a steady cruising speed (`ROLL_SPEED`). Holding
down crouches and pushes (faster), holding and dragging forward pushes harder,
holding and dragging back brakes, and the speed drifts back to cruising when you
let go (`SPEED_*`, `HOLD_ACCEL`, `PUSH_ACCEL`, `BRAKE` in `src/config.js`). A
quarter pipe speeds you up 35% for the rest of the run.


## Stages

A stage lays single-screen sections (`src/levels/*.js`) end to end into one
strip (`src/stages/`). Each section's name shows top-left as you reach it
(e.g. 1-3: FIRST RAIL) and is a checkpoint: a bail replays from the start of the
section you bailed in, with the score you'd banked before it, and the bail
screen's RESTART STAGE goes back to the top. A reload carries on from the last
checkpoint. Checkpoints are written stage-section, so 3-6 is the sixth section of
Stage 3.

**Stage select.** Finishing a stage opens the next one (on this device).
Once there's more than one, the end-of-run REPLAY button reads STAGES and
opens the stage list, and the title screen has a STAGES button. Each stage has
its own top 5.

Each stage has its own look: Stages 1 and 2 have a lighter blue sky (#6EB4FF) with
slow parallax clouds and asphalt; Stage 3 a light grey sky with a faint parallax
city and a concrete sidewalk; Stage 4 a bright blue sky and a red rubber-mat
surface; Stage 5 a sunset sky with a dusk skyline. Under the surface every stage
has a thin grass layer, chunky muted-brown dirt and then plain black.

**Stage 1** is a rock, then the six original levels in order, joined by a bank
(a good way past the rail, so you can land first) up to Five Stair's platform
and a drop off the Euro Gap stairs.

1. **First Rock**: a small rock in the road. Roll into it and the board stops
   dead; any ollie clears it.
2. **First Gap**: a 130 px gap of gravel. Ollie just before the edge: too early and
   you come up short, too late and you roll in.
3. **First Rail**: a low rail, 260 px long and 64 px high, too long to ollie.
   Grind it.
4. **Five Stair**: start on a platform with five stairs down and a handrail.
   Ollie or flip the whole set (land on a step and you bail), or grind the
   handrail down.
5. **Bank to Bank**: ride up a bank and ollie off its lip, over a pool of water,
   onto the bank going down the other side. Roll off the lip without an ollie and
   you splash in.
6. **Euro Gap**: a concrete bank that runs right up to the foot of a two-stair going
   up. Ollie off the bank's lip up onto the top: the lower step and the risers are
   bails.
7. **Quarter Pipe**: a long rail in front of a quarter pipe. Grind the rail, ride up
   the quarter pipe and go straight up out of it and straight back down: over a
   second of hang time for tricks (FS AIR, plus any flip you finish before you drop
   back in). Riding down to the bottom of the curve finishes the stage. The rail
   sits close to the Euro Gap's lip so an ollie off the top lands on it (the EURO TO
   RAIL gap bonus); a bail here restarts the rider on the street right after the
   Euro Gap (`starts` in `src/stages/stage1.js`), 0.67 s from the rail.

**Stage 2** (street): Curb (ollie over a long, low curb, or land on it and roll or
grind along the top), Step Up (ollie up three steps onto a ledge, then drop off
its end), Trash Can (a tall can: a well-timed ollie clears it), Kicker Rail (a wooden
kicker, then a flat rail: ollie off the kicker and hold to lock the grind for KICKER TO
RAIL, or clear it with a charged ollie), Bench (a wooden park bench, then a fire hydrant
just past its end: ollie on, roll along the seat and ollie off over the hydrant for BENCH
TO HYDRANT, or grind the seat and pop off the end), Four Stair (a bank up to a long platform, then four stairs
with a handrail: ollie the set for STAIR SET, or ollie onto the rail and grind it down for
HANDRAIL) and, as the finale, a burning Dumpster (a wooden kicker, a gap, then a lidless
dumpster full of bags: you can't ride across it: grind the front edge with a held tap,
or clear it with a charged ollie in a narrow window for BIG LEAP; landing on it any other way bails).

**Stage 3** (construction site): Rock (a tiny rock stops the board dead, so ollie
it), Cone Row (three traffic cones, one ollie clears them), Barrier Gap (a long
jersey barrier you can ollie onto or grind, then a gap right behind it),
Barricade (two sawhorses: two jumps), Scaffold Rail (grind the top pipe), Big Drop
(a concrete platform to roll or jump off, with a traffic barrel at the bottom:
land and ollie the barrel, or take one charged ollie over both) and Big Gap (a
broken slab of sidewalk as the kicker and a 240-unit gap full of rubble). Road signs
stand behind the action as decor.

**Stage 4** (playground, a first pass): Toy Blocks (a pyramid of blocks, one
ollie), Slide (a tall platform and a yellow chute that curves out flat at the bottom: ollie onto it
with your finger held to lock the grind), Sandbox (a wide sand pit: it takes a charged ollie), Seesaw
(grind the plank), Monkey Bars (a higher grind), Block Tower (a stack of three toy blocks: ollie up onto the top) and Ball Pit (a kicker and a 240-unit gap).

**Stage 5** (skate park, the hardest, a first pass): Ledges (two concrete ledges),
Flat Bar, Hubba (a solid concrete wall down stairs, grind its top edge), Curb Cut
(a driveway cut down into the street between two curbs), Fun Box (a long wooden
trapezoid with a rail on top), Big Set (three big concrete steps, no rail) and Cop
Car (a wooden ramp up to a police car: grind its light bar and the car blows up in a cartoon
blast once the grind is over, leaving a smoking wreck; ollie over it and nothing happens).

**Stage 6: Hellride** (a race): a computer-controlled rival skates the same course and
the first across the finish line wins (a win pays 3000 plus 1000 per second ahead, and
the stage's top 5 is for winning runs; losing means racing again from the start). It opens
once Stage 5 is finished. Brimstone Bumps (three bumps and a low block), Cinder Rail (kicker
and a long rail), Lava Moat (a 300-wide lava pit with a rail hung across: ollie on and lock
the grind, or charge a long ollie over it), Imp Hurdles (two basalt blocks), Bone Bar (a flat
bar), Fire Pit (a 200-wide pit with a ring of fire hanging over it), Devil's Stairs (five
stairs and a handrail) and Hellmouth Jump (a kicker and a 320-wide pit: a plain ollie falls short, so
it takes the turbo or a charge, or the arched rail across) and the Finish Straight. Locking
a grind, going through a ring of fire and landing a named gap kick up a turbo (+25% speed, fading
over a few seconds): faster means longer jumps, so it has to be managed (brake with hold and drag
down). The rival rides the same course by the same rules: its inputs are cues in each section file
(`cues`, found by `node scripts/solve-rival.mjs --write`, which rides the real course at every pace
the rubber band can give), its pace is rubber-banded (`RACE` in `src/config.js`: slightly under
yours, quicker when you pull ahead, easing off when you fall behind), and it takes every turbo on
its line, so riding its line cleanly beats it by about half a second and manuals win by a lot. The
race rules are in `src/rival.js` and `Game` (`race`, `lose()`, `finish()`), the pieces in
`src/obstacles/hell.js`. Game Center has no board for it yet (`gameCenter: false`).

**Secret level: Mega Ramp.** Side-scrolling, about three screens wide: drop in from
a high deck and fly off the kicker at a raised, gently curved "rainbow" rail. Ollie
off the kicker to clear the whole rail and land in the long bank that starts right
at its end, or grind over the curve and pop (or roll) off the end into the bank.
Finish with a big air out of a tall quarter pipe; riding back down ends it. Finish
any stage with at least 25,000 points in that run (`SECRET_SCORE` in `src/main.js`,
before the no-bail bonus) and you're taken there; its score counts toward the run
total. A blinking SECRET LEVEL UNLOCKED! banner (SECRET LEVEL AHEAD! on later runs)
leads into it, its HUD says BONUS: MEGA RAMP, and it has its own look: a moon
look: a navy sky with white stars, a pixel Earth and two layers of far mountains, grey cratered rock for the
ground, ramps and quarter pipe, and a riveted rock-plate sign banner.

Bails explain what went wrong: slammed or clipped the rail, landed mid-flip, came
up short, landed on the stairs or a step, rolled off an edge, or hit the quarter
pipe's wall.

## Scoring

Tricks and grinds chain into a combo until you land on the ground, and the combo
is multiplied by the number of tricks.

**Gap bonuses.** Named gaps like the classic skate games: take off from one
place and land (or grind) on another and the jump pops up as, say, EURO TO RAIL
+500, BARREL DROP, SANDBOX LEAP or BROKEN WALK. A gap counts as a trick in the
combo and can be earned once per attempt. Every gap (name, points, where you must
take off and land) is one line in `src/gaps.js`, so renaming or tuning is a
one-line change, and `tests/gaps.test.js` has a script that earns each one.

**Specials.** A gap bonus, or any trick or grind worth `SPECIAL_POINTS` (300, in
`src/config.js`) or more, is a "special": a solid plate (gold for gaps, red for
tricks) pops in, drifts up and dithers away over 1.3 s, with a short rising
square-wave jingle (`specialNotes` in `src/audio.js`; it climbs for bigger bonuses).

**Runs and high scores.** A run takes you through the stages in order. TOTAL in the
corner is the run's score so far; a bail loses what you scored since the last
checkpoint. A run with no bails gets a 2,000 bonus. At the end the total goes on
that stage's top 5 table; a new entry asks for a name of up to 6 letters (tap + and
-, or type them). REPLAY then starts over with a fresh total. The table shows on
the title screen too.

**Shared high scores (Supabase).** With `SCOREBOARD` in `src/config.js` filled in (a
Supabase project URL and its public anon key), each stage's top 5 is shared by
everyone, in one `scores` table with a `stage` column (`stage-1` ... `stage-5`;
scores from before stages count as Stage 1). To set it up: create a Supabase
project, open SQL Editor, paste all of `supabase/scores.sql` and run it (it is safe
to run more than once), then put the project URL and anon key in `SCOREBOARD`. Row
level security lets the anon key only read scores and add new ones; the database
checks the name (1-6 letters or spaces), the stage and the score (1-100000), and
posting is rate limited (3 a minute per address, 30 overall). If the shared table
can't be reached the game falls back to the on-device table, and scores are always
kept on the device too. Only the live site and the iOS app post to the shared table:
the /unstable/ preview, test play and local copies keep their own device tables.

## Testing a level

On the /unstable/ preview or a local copy (`npm start`) there is a **TEST** button
at the top of the screen: it opens a grid that jumps to any checkpoint of any
stage, or the Mega Ramp. You can also use the URL: `?level=N` starts Stage 1 at its
Nth checkpoint (1-7), `?level=S-N` starts stage S at checkpoint N (`?level=3-6`: Big
Drop), and `?level=secret` is the Mega Ramp, e.g.
`https://stickflip.itschefff.com/unstable/?level=3-6`. The HUD then says TEST, every
stage is open, and test play keeps its own saves and on-device high scores, so it
never touches your real progress or the shared table. None of this exists on the
live site or in the iOS app.

In test mode each stroke is drawn on screen (cyan while the finger is down, yellow
after) with what it was read as, the template shape it matched and how far off it
was (0 is exact; around 0.15 or more is a rough match).

`npm test` plays every checkpoint with scripted taps, holds and charges
(`tests/stage.test.js`, `tests/game.test.js`), checks the gap bonuses
(`tests/gaps.test.js`), the trick shapes (`tests/gesture.test.js`) and the
leaderboard (`tests/leaderboard.test.js`).

## Design choices

* **Chunky pixel-art look.** The game draws into a 320x180 framebuffer: black
  outlines, grey shaded bodies with a silver lit panel and white glints, our own
  drawings, no anti-aliasing (Bresenham lines and a built-in 5x7 bitmap font). Text
  and HUD are red (a darker red on light skies). The frame is scaled up by a whole
  number of device pixels for even pixels. Palettes per stage are in
  `src/render/pixel.js`.
* **Sound** is PC-speaker style square-wave beeps (press M to mute on desktop); no
  sound synthesis beyond that.
* **Fixed world.** Physics runs in 960x540 world units (3 units per pixel). Landscape
  is the intended orientation, and portrait shows a hint to rotate.
* **Fixed 120 Hz physics step** so jump heights and timing windows are identical on
  60 Hz and 120 Hz phones.
* **Tap meaning is decided by prediction.** In the air the game works out where
  you'll touch down. If that's a grindable rail and there isn't time left for a flip,
  the tap primes a grind. Otherwise it's a kickflip.
* **Input on `pointerdown`**, not `click`, for low latency on touch screens. Zoom and
  scroll gestures are blocked on the canvas.
* **Logic and rendering are separate.** `src/game.js` has no DOM code, so all the
  mechanics are covered by `node --test`.

## Code layout

```
index.html              page shell, loads src/main.js
privacy.html            privacy page (linked from the App Store listing)
src/main.js             canvas sizing, input, game loop, saved progress, unlock flow, TEST menu
src/config.js           physics + scoring constants, SCOREBOARD, SPECIAL_POINTS
src/game.js             game logic: skater state machine, collisions, scoring
src/gaps.js             the named gap bonuses
src/gesture.js          trick shape matching
src/obstacles/          obstacle builders (rail, gap, stairs, box...), each with surfaces, solids, ground and draw()
src/levels/             one file per section (a screen of obstacles) + the Mega Ramp
src/stages/             stages: sections laid end to end (compose.js), the ordered STAGES list
src/render/             pixel framebuffer + font, stick figure, backgrounds, HUD, effects, palettes
src/audio.js            PC-speaker style beeps and the special jingle
src/leaderboard.js      top 5 high scores (on-device plus the shared Supabase table)
src/run.js              the run total across stages
src/native.js           iOS app only: haptics and Game Center
src/update.js           reloads an installed Home Screen app when a newer version is deployed
supabase/scores.sql     the shared high-score table, security and rate limits
icons/, favicon.ico     app icons + share image, drawn by scripts/make-icons.mjs (npm run icons)
manifest.webmanifest    Home Screen app settings (full screen, landscape)
ios/, www/              the Capacitor iOS project and its bundled copy of the game
tests/                  node:test suites
```

### Adding a stage

1. Write each section as a one-screen level in `src/levels/` exporting
   `{ id, name, obstacles }` (laid out on a 960-wide screen).
2. Create `src/stages/stageN.js` with `stage({ id, name, sections: [...] })` from
   `compose.js`. Options: `extra` for obstacles that join sections (strip
   coordinates: section i starts at i * 960); `starts: { i: offset }` to spawn a
   replay of section i at its left edge plus `offset` instead of 80; `camTop` (how
   close to the top the rider gets before the camera rises); `palette` (`'site'`,
   `'play'`, `'park'`...), `sidewalk`, `skyline`, `clouds` for the look;
   `endAfterQuarter` to end the stage when the rider has ridden back down a
   quarter pipe; `finishLeft` to end on a ride back to the left; `race: { finishAt }`
   for a race against a rival (see Stage 6), `boost: true` (+ `speedReturn`) for the turbo,
   `hell: true` for Hellride's sky, `gameCenter: false` for a stage with no Game Center board.
3. Append it to `STAGES` in `src/stages/index.js` (stage id `stage-N`, which is also
   the shared leaderboard key and the Game Center leaderboard `stickflip.stageN`).
4. Add timed-ollie clears for each checkpoint to `tests/stage.test.js` and a line per
   gap bonus to `src/gaps.js` (+ a script in `tests/gaps.test.js`).

### Adding an obstacle type

Write a builder in `src/obstacles/` (export it from `index.js`) that returns:

* `surfaces`: top edges `{ x1, x2, y, grindable, landable, passable }`, or a sloped
  edge with `y1`/`y2` instead of `y` (a handrail). `grindable` tops can be ground,
  `landable` tops (a box or ledge) can be landed on and rolled across, `passable`
  ones (beside the line, like a handrail) are ignored unless you're locked into a
  grind, and anything else is a bail if you come down on it.
* `solids`: rectangles `{ x, y, w, h }` that you slam into from the side.
* `ground` (optional): segments `{ x1, x2, y, landable, bail, wall }` that replace
  the flat ground there: a gap is a segment far below the screen, stairs are a
  raised platform plus non-landable steps. A segment can slope (`y1`/`y2` instead of
  `y`: a bank) or be a quarter pipe curve (`qp: { cx, cy, R }`). `bail` names the
  bail for landing on a non-landable segment, `wall` the one for flying into its
  side. `material: 'concrete'` draws it as poured concrete, and `under: true` means
  the piece paints itself over the flat street (a wooden box, a ladder) instead of
  being solid earth.
* `dirt` (optional): `{ x1, x2, kind }` fills a gap with dirt (`kind: 'gravel'` or
  `'rubble'` for other fills).
* `draw(g, fx)`: render it into the pixel framebuffer `g` (world units / 3 = pixels).
  The ground is drawn for you. `fx.time` is the clock.

The engine handles everything else. A level can also set `width` (wider than 960
scrolls, with the camera following the skater) and `speed` (rolling speed).

## iOS app

The `ios/` folder wraps the same game as a native iPhone app with
[Capacitor](https://capacitorjs.com) (bundle id `com.itschefff.stickflip`, free,
age 4+, iOS 17+). The game files are bundled inside the app, so it plays offline.
The website doesn't use any of this.

On a Mac with Xcode:

```sh
npm install
npm run ios        # copies the game into www/ and syncs it into ios/
npm run ios:open   # opens the project in Xcode
```

Run `npm run ios` again after any change to the game (from `main`, for a release)
before building in Xcode. Then choose your paid Apple Developer team in Xcode's
Signing settings, archive and upload to App Store Connect.

What's different in the app:

- Always landscape, full screen, iPhone only.
- Posts to the same Supabase leaderboard as the live site, plus one Game Center
  leaderboard per stage: `stickflip.stage1` through `stickflip.stage5`, opened from a
  GAME CENTER button on the high-score table. Create all five (score type: integer,
  high to low) in App Store Connect with exactly those IDs.
- Haptics on pops, landings, grinds, bails and level clears (`src/native.js` +
  `ios/App/App/StickflipPlugin.swift`).
- No GoatCounter. `scripts/build-app.mjs` strips it from the app's copy.
- The App Store icon and launch screen come from `npm run icons`. No test menu.
