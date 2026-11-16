import { bank, gap } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Secret level: a mega ramp three screens wide. Drop in from the deck, go fast,
// ollie off the kicker and fly the big gap onto the landing ramp. The camera
// follows the skater (see Renderer). Unlocked by the third full clear of the
// six main levels (see main.js).
const G = WORLD.GROUND;
const KICK = G - 90;

export default {
  id: 'mega-ramp',
  name: 'Mega Ramp',
  hint: 'GO BIG. OLLIE OFF THE KICKER.',
  secret: true,
  width: WORLD.W * 3,
  speed: 750,
  obstacles: [
    bank({ x: -1000, run: 1200, y1: G - 150, y2: G - 150 }),
    bank({ x: 200, run: 250, y1: G - 150, y2: G }),
    bank({ x: 800, run: 150, y1: G, y2: KICK }),
    gap({ x: 950, width: 620 }),
    bank({ x: 1570, run: 700, y1: KICK, y2: G }),
  ],
  stars: [0, 400, 1000],
};
