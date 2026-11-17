// The stages, in order. A stage is one long strip with named sections
// (checkpoints); see compose.js. The Mega Ramp is a bonus stage of its own.
import stage1 from './stage1.js';
import { SECRET } from '../levels/index.js';

export const STAGES = [stage1];
export { SECRET };
