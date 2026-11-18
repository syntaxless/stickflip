// Named gap bonuses, like the classic skate games: take off from one place and
// land or grind on another and the jump is worth a bonus, shown as a popup
// ("EURO TO RAIL +500"). A gap counts as a trick in the combo (so it is
// multiplied like one) and can be earned once per attempt of a checkpoint.
//
// Every number lives here, so tuning or renaming a gap is a one-line change.
//   stage:   the stage's id (src/stages/stageN.js)
//   section: the checkpoint (0-based) the coordinates are measured from
//   from:    [x1, x2] the take-off (an ollie or a pop off a rail) must be in,
//            or null for any take-off. Rolling off an edge is not a take-off.
//   to:      [x1, x2] the landing (or the grind's start) must be in
//   on:      'land' (back on a wheel), 'grind' (onto a rail), or 'any'
// All x values are world units from the left edge of that checkpoint's screen
// (they can run negative, back onto the section before).
export const GAPS = [
  // ---- Stage 1
  { id: 'five-stair', stage: 'stage-1', section: 3, name: 'STAIR SET', points: 300, from: [250, 430], to: [584, 960], on: 'land' },
  { id: 'bank-to-rail', stage: 'stage-1', section: 3, name: 'BANK TO HANDRAIL', points: 400, from: [-90, 400], to: [400, 700], on: 'grind' },
  { id: 'pool-jump', stage: 'stage-1', section: 4, name: 'POOL JUMP', points: 300, from: [100, 380], to: [540, 960], on: 'land' },
  { id: 'euro-to-rail', stage: 'stage-1', section: 6, name: 'EURO TO RAIL', points: 500, from: [-250, 40], to: [220, 460], on: 'grind' },
  // ---- Stage 2
  { id: 'trash-hop', stage: 'stage-2', section: 2, name: 'TRASH HOP', points: 250, from: [300, 456], to: [510, 960], on: 'land' },
  { id: 'big-leap', stage: 'stage-2', section: 6, name: 'BIG LEAP', points: 300, from: [200, 600], to: [640, 960], on: 'land' },
  { id: 'bench-to-hydrant', stage: 'stage-2', section: 4, name: 'BENCH TO HYDRANT', points: 350, from: [380, 650], to: [760, 1100], on: 'land' },
  { id: 'stair-set', stage: 'stage-2', section: 5, name: 'STAIR SET', points: 250, from: [140, 410], to: [530, 960], on: 'land' },
  { id: 'handrail', stage: 'stage-2', section: 5, name: 'HANDRAIL', points: 350, from: null, to: [360, 510], on: 'grind' },
  { id: 'kicker-to-rail', stage: 'stage-2', section: 3, name: 'KICKER TO RAIL', points: 450, from: [300, 440], to: [520, 760], on: 'grind' },
  // ---- Stage 3
  { id: 'barrier-to-gap', stage: 'stage-3', section: 2, name: 'BARRIER TO GAP', points: 500, from: [300, 620], to: [780, 960], on: 'land' },
  { id: 'barrel-drop', stage: 'stage-3', section: 5, name: 'BARREL DROP', points: 600, from: [0, 550], to: [850, 960], on: 'land' },
  { id: 'broken-walk', stage: 'stage-3', section: 6, name: 'BROKEN WALK', points: 400, from: [150, 400], to: [640, 960], on: 'land' },
  // ---- Stage 4
  { id: 'sandbox-leap', stage: 'stage-4', section: 2, name: 'SANDBOX LEAP', points: 250, from: [250, 440], to: [710, 960], on: 'land' },
  { id: 'seesaw-launch', stage: 'stage-4', section: 3, name: 'SEESAW LAUNCH', points: 300, from: [400, 680], to: [680, 960], on: 'land' },
  { id: 'monkey-business', stage: 'stage-4', section: 4, name: 'MONKEY BUSINESS', points: 300, from: [340, 740], to: [740, 960], on: 'land' },
  { id: 'ball-pit-leap', stage: 'stage-4', section: 6, name: 'BALL PIT LEAP', points: 400, from: [180, 400], to: [720, 960], on: 'land' },
  // ---- Stage 5
  { id: 'ledge-to-ledge', stage: 'stage-5', section: 0, name: 'LEDGE TO LEDGE', points: 400, from: [280, 430], to: [580, 750], on: 'grind' },
  { id: 'box-clear', stage: 'stage-5', section: 4, name: 'BOX CLEAR', points: 500, from: [200, 520], to: [810, 1100], on: 'land' },
  { id: 'big-set', stage: 'stage-5', section: 5, name: 'BIG SET', points: 500, from: [150, 380], to: [580, 960], on: 'land' },
  { id: 'siren-grind', stage: 'stage-5', section: 6, name: 'SIREN GRIND', points: 400, from: null, to: [474, 558], on: 'grind' },
];
