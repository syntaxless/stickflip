// Ordered list of levels. To add a level, create levelN.js next to this file
// (one obstacle per level, fixed screen) and append it here.
import level1 from './level1.js';
import level2 from './level2.js';
import level3 from './level3.js';
import level4 from './level4.js';
import level5 from './level5.js';
import level6 from './level6.js';
import secret from './secret.js';

export const LEVELS = [level1, level2, level3, level4, level5, level6];

// Not part of the normal run: unlocked by the third full clear (see main.js).
export const SECRET = secret;
