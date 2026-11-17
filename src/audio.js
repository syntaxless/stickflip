// PC-speaker style sound: one square wave, simple beeps and sweeps.
// Browsers only allow audio after a user gesture, so call unlock() from a tap.

let ac = null;
let master = null;
let grindOsc = null;
let muted = false;

export function unlock() {
  try {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.06;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
  } catch {
    ac = null;
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.06;
  return muted;
}

// One square-wave note, optionally sliding to another pitch.
function beep(freq, dur, { to = freq, at = 0 } = {}) {
  if (!ac) return;
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(freq, t);
  if (to !== freq) o.frequency.linearRampToValueAtTime(to, t + dur);
  o.connect(master);
  o.start(t);
  o.stop(t + dur);
}

function setGrind(on) {
  if (!ac) return;
  if (on && !grindOsc) {
    grindOsc = ac.createOscillator();
    grindOsc.type = 'square';
    grindOsc.frequency.value = 95;
    grindOsc.connect(master);
    grindOsc.start();
  } else if (!on && grindOsc) {
    grindOsc.stop();
    grindOsc = null;
  }
}

// The "special" jingle: a quick rising pentatonic run and a sliding top note,
// square waves like everything else here (under half a second). Bigger bonuses
// start higher, up to about a minor third.
const SPECIAL_RUN = [392, 494, 587, 740, 988, 1319];
export function specialNotes(points = 300) {
  const lift = 1 + (Math.min(Math.max(points, 0), 800) / 800) * 0.19;
  const notes = SPECIAL_RUN.map((f, i) => ({ freq: f * lift, dur: 0.045, at: i * 0.045 }));
  const top = SPECIAL_RUN[SPECIAL_RUN.length - 1] * lift;
  notes.push({ freq: top, to: top * 1.33, dur: 0.17, at: SPECIAL_RUN.length * 0.045 });
  return notes;
}

const SOUNDS = {
  special: (e) => specialNotes(e.points).forEach((n) => beep(n.freq, n.dur, { to: n.to ?? n.freq, at: n.at })),
  push: () => beep(220, 0.05),
  pop: () => beep(330, 0.07, { to: 880 }),
  flip: (e) => (e.key === 'left' || e.key === 'right' ? beep(300, 0.12, { to: 900 }) : e.key === 'tap' ? beep(660, 0.04) : beep(760, 0.06, { to: 520 })),
  prime: () => beep(990, 0.03),
  grind: () => beep(1320, 0.03),
  land: () => beep(160, 0.05),
  bank: () => [523, 659, 784].forEach((f, i) => beep(f, 0.05, { at: i * 0.06 })),
  bail: () => beep(440, 0.45, { to: 60 }),
  complete: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => beep(f, 0.08, { at: i * 0.09 })),
};

// Called once per frame with that frame's game events.
export function play(events, game) {
  for (const e of events) SOUNDS[e.type]?.(e);
  setGrind(game.phase === 'playing' && game.sk.mode === 'grind');
}
