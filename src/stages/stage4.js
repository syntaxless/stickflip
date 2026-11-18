import { stage } from './compose.js';
import toyBlocks from '../levels/toy-blocks.js';
import slide from '../levels/slide.js';
import sandbox from '../levels/sandbox.js';
import seesaw from '../levels/seesaw.js';
import monkeyBars from '../levels/monkey-bars.js';
import blockTower from '../levels/block-tower.js';
import ballPit from '../levels/ball-pit.js';

// Stage 4: a playground. Toy blocks, a slide, a sandbox, a seesaw, monkey bars,
// a block tower and a ball pit to finish. Bright sky, rubber-mat ground.
export default stage({
  id: 'stage-4',
  name: 'Stage 4',
  sections: [toyBlocks, slide, sandbox, seesaw, monkeyBars, blockTower, ballPit],
  starts: { 4: 40 }, // 4-5 spawns further back (more run-up to the monkey bars)
  camTop: 100,
  palette: 'play',
});
