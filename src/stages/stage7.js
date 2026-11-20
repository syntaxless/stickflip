import { stage } from './compose.js';
import drifts from '../levels/frost-drifts.js';
import sled from '../levels/frost-sled.js';
import pond from '../levels/frost-pond.js';
import hurdles from '../levels/frost-hurdles.js';
import slalom from '../levels/frost-slalom.js';
import cabin from '../levels/frost-cabin.js';
import crevasse from '../levels/frost-crevasse.js';

// Stage 7: FROSTBITE, a frozen mountain pass. Snow on the ground, a pale winter sky with snow-capped
// mountains and falling snow. Snowdrifts and a snowman, a sled kicker and rail, a frozen pond with an
// ice floe, ice hurdles, a slalom of ski gates, a log cabin roof and a crevasse at the summit. Every
// obstacle has a safe line and a riskier one. Opens when Stage 6 is finished, like every other stage.
export default stage({
  id: 'stage-7',
  name: 'Frostbite',
  sections: [drifts, sled, pond, hurdles, slalom, cabin, crevasse],
  starts: { 2: 10 }, // 7-3 spawns further back: more run-up to the pond
  camTop: 100,
  palette: 'frost',
  frost: true, // the sky and the ground
  snowSkate: true, // a snow skate: no wheels or trucks, same tricks (the board is only drawn differently)
  gameCenter: false, // no Game Center board yet: create stickflip.stage7 in App Store Connect, then drop this
});
