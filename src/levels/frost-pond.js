import { icePond } from '../obstacles/index.js';

// Frostbite, section 3: a frozen pond, 295 wide, with one ice floe sitting in the middle of it. Two
// ways over: hop to the floe (a plain ollie reaches it, FLOE HOP) and ollie again off its far end, or
// charge up and fly the whole pond in one jump (POND LEAP). Short of the floe or the far bank is a swim.
export default {
  id: 'frost-pond',
  name: 'Frozen Pond',
  obstacles: [icePond({ x: 300, width: 295, floes: [{ x: 90, w: 110 }] })],
};
