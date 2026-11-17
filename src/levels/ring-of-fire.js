import { bank, gap, ring } from '../obstacles/index.js';
import { WORLD } from '../config.js';

// Stage 2, section 4: a kicker, a gap, and a ring of fire hanging over the
// gap. Ollie off the kicker through the ring. The opening is tight enough to
// need some timing: a tap about 0.2 s wide goes through (about two thirds of
// what the roomier ring allowed), too early puts your feet in the flames, too
// late or a big charge puts your head in them, and rolling off without an
// ollie burns your feet. Through it is a trick.
const G = WORLD.GROUND;

export default {
  id: 'ring-of-fire',
  name: 'Ring of Fire',
  obstacles: [
    bank({ x: 320, run: 100, y1: G, y2: G - 50 }),
    gap({ x: 420, width: 180 }),
    ring({ x: 470, top: 130, bottom: 225 }),
  ],
};
