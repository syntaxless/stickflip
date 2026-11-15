import { WORLD } from '../config.js';

// A flat, low grind rail standing on two posts.
//
// Every obstacle is a plain object with the same shape, so the game logic
// never needs to know which kind it is dealing with:
//   surfaces: top edges the skater can touch from above.
//             { x1, x2, y, grindable, landable, trick }
//             grindable -> a primed skater locks into a grind
//             landable  -> the skater can land and roll on top (boxes, ledges)
//             otherwise touching it from above is a bail
//   solids:   rectangles { x, y, w, h } that cause a slam when hit from the side
//   draw(ctx, fx): renders the obstacle. fx.hint is 'ready' | 'primed' | null
export function rail({ x, length, height, trick = '50-50 GRIND' }) {
  const top = WORLD.GROUND - height;
  const x2 = x + length;
  return {
    type: 'rail',
    surfaces: [{ x1: x, x2, y: top, grindable: true, landable: false, trick }],
    solids: [{ x, y: top, w: length, h: height }],

    draw(ctx, fx = {}) {
      const posts = [x + 22, x2 - 22];
      ctx.save();
      ctx.lineCap = 'round';

      // Glow when a tap right now would lock a grind (or one is locked in).
      if (fx.hint) {
        const pulse = 0.55 + 0.45 * Math.sin((fx.time || 0) * 14);
        ctx.strokeStyle = fx.hint === 'primed' ? 'rgba(80, 200, 120, 0.55)' : `rgba(255, 196, 0, ${0.35 + 0.4 * pulse})`;
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x2, top);
        ctx.stroke();
      }

      // Posts
      ctx.strokeStyle = '#1b1b1f';
      ctx.lineWidth = 6;
      for (const px of posts) {
        ctx.beginPath();
        ctx.moveTo(px, top + 2);
        ctx.lineTo(px, WORLD.GROUND);
        ctx.stroke();
        // base plate
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(px - 9, WORLD.GROUND - 1);
        ctx.lineTo(px + 9, WORLD.GROUND - 1);
        ctx.stroke();
        ctx.lineWidth = 6;
      }

      // Bar
      ctx.strokeStyle = '#1b1b1f';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x2, top);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 4, top - 2);
      ctx.lineTo(x2 - 4, top - 2);
      ctx.stroke();
      ctx.restore();
    },
  };
}
