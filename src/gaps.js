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
  { id: 'stair-set', stage: 'stage-2', section: 5, name: 'STAIR SET', points: 250, from: [220, 490], to: [610, 960], on: 'land' },
  { id: 'handrail', stage: 'stage-2', section: 5, name: 'HANDRAIL', points: 350, from: null, to: [440, 590], on: 'grind' },
  { id: 'kicker-to-rail', stage: 'stage-2', section: 3, name: 'KICKER TO RAIL', points: 450, from: [300, 440], to: [520, 760], on: 'grind' },
  // ---- Stage 3
  { id: 'barrier-to-gap', stage: 'stage-3', section: 2, name: 'BARRIER TO GAP', points: 500, from: [300, 620], to: [780, 960], on: 'land' },
  { id: 'barrel-drop', stage: 'stage-3', section: 5, name: 'BARREL DROP', points: 600, from: [0, 550], to: [850, 960], on: 'land' },
  { id: 'broken-walk', stage: 'stage-3', section: 6, name: 'BROKEN WALK', points: 400, from: [150, 400], to: [640, 680], on: 'land' },
  { id: 'gravel-dump', stage: 'stage-3', section: 6, name: 'GRAVEL DUMP', points: 350, from: null, to: [686, 779], on: 'grind' },
  { id: 'truck-leap', stage: 'stage-3', section: 6, name: 'TRUCK LEAP', points: 500, from: [300, 440], to: [779, 1400], on: 'land' },
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
  // ---- Stage 6 (Hellride; each one also kicks the turbo in)
  { id: 'cinder-grind', stage: 'stage-6', section: 1, name: 'CINDER GRIND', points: 450, from: [200, 300], to: [470, 770], on: 'grind' },
  { id: 'lava-grind', stage: 'stage-6', section: 2, name: 'LAVA GRIND', points: 400, from: null, to: [300, 600], on: 'grind' },
  { id: 'fire-pit-leap', stage: 'stage-6', section: 5, name: 'FIRE PIT LEAP', points: 300, from: [100, 330], to: [530, 960], on: 'land' },
  { id: 'devil-stairs', stage: 'stage-6', section: 6, name: 'DEVIL STAIRS', points: 300, from: [300, 420], to: [650, 960], on: 'land' },
  { id: 'hellmouth-grind', stage: 'stage-6', section: 7, name: 'HELLMOUTH GRIND', points: 500, from: [150, 330], to: [400, 640], on: 'grind' },
  { id: 'hellmouth-jump', stage: 'stage-6', section: 7, name: 'HELLMOUTH JUMP', points: 600, from: [150, 330], to: [630, 960], on: 'land' },
  // ---- Stage 7 (Frostbite)
  { id: 'sled-grind', stage: 'stage-7', section: 1, name: 'SLED GRIND', points: 450, from: [200, 330], to: [500, 740], on: 'grind' },
  { id: 'floe-hop', stage: 'stage-7', section: 2, name: 'FLOE HOP', points: 300, from: [140, 300], to: [390, 500], on: 'land' },
  { id: 'pond-leap', stage: 'stage-7', section: 2, name: 'POND LEAP', points: 450, from: [140, 300], to: [595, 960], on: 'land' },
  { id: 'ice-grind', stage: 'stage-7', section: 3, name: 'ICE GRIND', points: 350, from: null, to: [330, 386], on: 'grind' },
  { id: 'slide-grind', stage: 'stage-7', section: 3, name: 'FROZEN SLIDE', points: 400, from: null, to: [700, 764], on: 'grind' },
  { id: 'cabin-grind', stage: 'stage-7', section: 5, name: 'CABIN GRIND', points: 400, from: null, to: [360, 580], on: 'grind' },
  { id: 'cabin-leap', stage: 'stage-7', section: 5, name: 'CABIN LEAP', points: 500, from: [150, 360], to: [580, 960], on: 'land' },
  { id: 'roof-drop', stage: 'stage-7', section: 5, name: 'ROOF DROP', points: 350, from: [360, 580], to: [580, 960], on: 'land' },
  { id: 'ice-bridge', stage: 'stage-7', section: 6, name: 'ICE BRIDGE', points: 500, from: [150, 330], to: [400, 640], on: 'grind' },
  { id: 'crevasse-jump', stage: 'stage-7', section: 6, name: 'CREVASSE JUMP', points: 600, from: [150, 330], to: [630, 960], on: 'land' },
  // ---- Stage 8 (Boardwalk)
  { id: 'board-grind', stage: 'stage-8', section: 1, name: 'BOARD GRIND', points: 450, from: [200, 330], to: [500, 740], on: 'grind' },
  { id: 'rope-grind', stage: 'stage-8', section: 2, name: 'ROPE GRIND', points: 400, from: [100, 300], to: [310, 570], on: 'grind' },
  { id: 'sea-leap', stage: 'stage-8', section: 2, name: 'SEA LEAP', points: 450, from: [140, 300], to: [560, 960], on: 'land' },
  { id: 'cart-grind', stage: 'stage-8', section: 3, name: 'CART GRIND', points: 350, from: null, to: [330, 430], on: 'grind' },
  { id: 'chair-slide', stage: 'stage-8', section: 3, name: 'CHAIR SLIDE', points: 400, from: null, to: [700, 754], on: 'grind' },
  { id: 'tower-grind', stage: 'stage-8', section: 5, name: 'TOWER GRIND', points: 400, from: null, to: [360, 550], on: 'grind' },
  { id: 'tower-leap', stage: 'stage-8', section: 5, name: 'TOWER LEAP', points: 500, from: [150, 360], to: [550, 960], on: 'land' },
  { id: 'tower-drop', stage: 'stage-8', section: 5, name: 'TOWER DROP', points: 350, from: [360, 550], to: [550, 960], on: 'land' },
  { id: 'pier-bridge', stage: 'stage-8', section: 6, name: 'PIER BRIDGE', points: 500, from: [150, 330], to: [400, 640], on: 'grind' },
  { id: 'pier-leap', stage: 'stage-8', section: 6, name: 'PIER LEAP', points: 600, from: [150, 330], to: [630, 960], on: 'land' },
  // ---- Stage 9 (Junkyard; a race, so each one also kicks the turbo in)
  { id: 'scrap-grind', stage: 'stage-9', section: 1, name: 'SCRAP GRIND', points: 450, from: [200, 300], to: [470, 730], on: 'grind' },
  { id: 'sludge-grind', stage: 'stage-9', section: 2, name: 'SLUDGE GRIND', points: 400, from: null, to: [300, 600], on: 'grind' },
  { id: 'pipe-grind', stage: 'stage-9', section: 4, name: 'PIPE GRIND', points: 350, from: null, to: [340, 530], on: 'grind' },
  { id: 'sludge-leap', stage: 'stage-9', section: 5, name: 'SLUDGE LEAP', points: 300, from: [100, 330], to: [530, 960], on: 'land' },
  { id: 'car-grind', stage: 'stage-9', section: 6, name: 'CAR GRIND', points: 400, from: null, to: [360, 580], on: 'grind' },
  { id: 'car-leap', stage: 'stage-9', section: 6, name: 'CAR LEAP', points: 500, from: [150, 360], to: [580, 960], on: 'land' },
  { id: 'magnet-grind', stage: 'stage-9', section: 7, name: 'MAGNET GRIND', points: 500, from: [150, 330], to: [400, 640], on: 'grind' },
  { id: 'magnet-jump', stage: 'stage-9', section: 7, name: 'MAGNET JUMP', points: 600, from: [150, 330], to: [630, 960], on: 'land' },
  // ---- Stage 10 (Haunted Night)
  { id: 'fence-grind', stage: 'stage-10', section: 1, name: 'FENCE GRIND', points: 450, from: [200, 330], to: [500, 740], on: 'grind' },
  { id: 'coffin-hop', stage: 'stage-10', section: 2, name: 'COFFIN HOP', points: 300, from: [140, 300], to: [390, 500], on: 'land' },
  { id: 'grave-leap', stage: 'stage-10', section: 2, name: 'GRAVE LEAP', points: 450, from: [140, 300], to: [595, 960], on: 'land' },
  { id: 'pumpkin-hop', stage: 'stage-10', section: 3, name: 'PUMPKIN HOP', points: 300, from: [150, 330], to: [330, 430], on: 'land' },
  { id: 'gate-grind', stage: 'stage-10', section: 6, name: 'GATE GRIND', points: 500, from: [150, 330], to: [400, 640], on: 'grind' },
  { id: 'mansion-leap', stage: 'stage-10', section: 6, name: 'MANSION LEAP', points: 600, from: [150, 330], to: [630, 960], on: 'land' },
  { id: 'vampire-grind', stage: 'stage-10', section: 5, name: 'VAMPIRE GRIND', points: 500, from: null, to: [360, 570], on: 'grind' },
];
