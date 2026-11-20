import { openGrave } from '../obstacles/index.js';

// Haunted Night, section 3: an open grave, 295 wide, with a coffin lid lying in the middle of it. Two ways
// over: hop to the lid (a plain ollie reaches it, COFFIN HOP) and ollie again off its far end, or charge up
// and fly the whole grave in one jump (GRAVE LEAP). Short of the lid or the far side is a drop.
export default {
  id: 'haunt-grave',
  name: 'Open Grave',
  obstacles: [openGrave({ x: 300, width: 295, floes: [{ x: 90, w: 110 }] })],
};
