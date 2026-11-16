// Skateboard sounds, made on the fly with Web Audio (no sound files): the
// wheels rolling, the tail snapping on a pop, the board flicking round, the
// thud of a landing, the scrape of a grind and the clatter of a bail. The
// score jingles stay as PC-speaker beeps.
// Browsers only allow audio after a user gesture, so call unlock() from a tap.

let ac = null;
let master = null; // mute switch
let chip = null; // the square-wave beeps
let sfx = null; // the skateboard
let noise = null; // a second of white noise, shared by every sound
let roll = null; // { gain, filter } looping wheel noise
let grind = null; // { gain, a, b } looping rail scrape
let muted = false;

const CHIP_VOL = 0.06;
const SFX_VOL = 0.5;

export function unlock() {
  try {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ac.destination);
      chip = ac.createGain();
      chip.gain.value = CHIP_VOL;
      chip.connect(master);
      sfx = ac.createGain();
      sfx.gain.value = SFX_VOL;
      sfx.connect(master);
      noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
  } catch {
    ac = null;
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 1;
  return muted;
}

// ------------------------------------------------------------- building blocks

// One square-wave note, optionally sliding to another pitch.
function beep(freq, dur, { to = freq, at = 0 } = {}) {
  if (!ac) return;
  const t = ac.currentTime + at;
  const o = ac.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(freq, t);
  if (to !== freq) o.frequency.linearRampToValueAtTime(to, t + dur);
  o.connect(chip);
  o.start(t);
  o.stop(t + dur);
}

// A gain that jumps to `vol` and dies away over `dur`.
function envelope(vol, dur, at = 0, attack = 0.003) {
  const t = ac.currentTime + at;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(sfx);
  return { g, t };
}

// A burst of filtered noise: snaps, scuffs, whooshes and crashes.
function hiss(dur, { vol = 0.5, type = 'bandpass', freq = 1000, to = freq, q = 1, at = 0, attack } = {}) {
  if (!ac) return;
  const { g, t } = envelope(vol, dur, at, attack);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to !== freq) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const src = ac.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4; // never quite the same twice
  src.connect(f);
  f.connect(g);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

// A low knock: wood and urethane hitting concrete.
function thump(freq, dur, { vol = 0.6, to = freq / 2, at = 0 } = {}) {
  if (!ac) return;
  const { g, t } = envelope(vol, dur, at);
  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  o.connect(g);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// A looping noise source through a filter chain into its own gain (silent until set).
function loop(filters) {
  const src = ac.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const gain = ac.createGain();
  gain.gain.value = 0;
  let node = src;
  for (const f of filters) {
    node.connect(f);
    node = f;
  }
  node.connect(gain);
  gain.connect(sfx);
  src.start();
  return gain;
}

function filter(type, freq, q = 1) {
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

// ---------------------------------------------------------------- the sounds

// Wheels on concrete: a low rumble, louder and brighter the faster you go.
function setRoll(on, speed) {
  if (!ac) return;
  if (!roll) {
    const lp = filter('lowpass', 500, 0.7);
    roll = { filter: lp, gain: loop([filter('highpass', 60), lp]) };
  }
  const t = ac.currentTime;
  const k = Math.max(0, Math.min(1.6, speed));
  roll.gain.gain.setTargetAtTime(on ? 0.22 + 0.18 * k : 0, t, on ? 0.05 : 0.02);
  roll.filter.frequency.setTargetAtTime(300 + 350 * k, t, 0.1);
}

// Steel on steel: two narrow bands of noise with a wobble, for as long as you grind.
function setGrind(on) {
  if (!ac) return;
  if (!grind) {
    const a = filter('bandpass', 2300, 9);
    const b = filter('bandpass', 3700, 12);
    const gain = loop([filter('highpass', 900), a]);
    const gain2 = loop([filter('highpass', 900), b]);
    grind = { gain, gain2, a };
  }
  const t = ac.currentTime;
  const v = on ? 0.9 + Math.random() * 0.4 : 0; // a little rattle frame to frame
  grind.gain.gain.setTargetAtTime(v, t, on ? 0.02 : 0.03);
  grind.gain2.gain.setTargetAtTime(v * 0.6, t, on ? 0.02 : 0.03);
  if (on) grind.a.frequency.setTargetAtTime(2100 + Math.random() * 400, t, 0.03);
}

const SOUNDS = {
  // first kick off
  push: () => {
    hiss(0.18, { vol: 0.35, type: 'lowpass', freq: 1400, to: 400 });
    thump(140, 0.08, { vol: 0.3 });
  },
  // the tail cracking on the ground, then the board leaving it
  pop: () => {
    hiss(0.03, { vol: 0.9, type: 'highpass', freq: 2500, q: 0.7 });
    thump(220, 0.07, { vol: 0.7, to: 90 });
    hiss(0.05, { vol: 0.25, freq: 1800, q: 2, at: 0.035 });
  },
  // the board flicking round under you: a whoosh, longer for the bigger tricks
  flip: (e) => {
    if (e.key === 'circle') return hiss(0.6, { vol: 0.35, freq: 500, to: 1500, q: 0.8, attack: 0.15 });
    const long = /360|treflip|laser|hard|inward|varial|shove360|fs360|bs360/i.test(e.key || '');
    hiss(long ? 0.3 : 0.18, { vol: 0.4, freq: 900, to: 3200, q: 1.5, attack: 0.04 });
  },
  prime: () => {},
  // the trucks catching the rail
  grind: () => {
    thump(1600, 0.12, { vol: 0.25, to: 1300 });
    hiss(0.05, { vol: 0.5, type: 'highpass', freq: 3000 });
  },
  // four wheels and a deck coming down
  land: () => {
    thump(110, 0.16, { vol: 0.9, to: 45 });
    hiss(0.08, { vol: 0.6, type: 'lowpass', freq: 1800, to: 300 });
    hiss(0.03, { vol: 0.3, type: 'highpass', freq: 3500, at: 0.01 });
  },
  bank: () => [523, 659, 784].forEach((f, i) => beep(f, 0.05, { at: i * 0.06 })),
  // body hits the ground, board clatters away
  bail: () => {
    thump(90, 0.35, { vol: 1, to: 35 });
    hiss(0.4, { vol: 0.7, type: 'lowpass', freq: 1500, to: 200 });
    [0.12, 0.22, 0.29, 0.4].forEach((at, i) => hiss(0.04, { vol: 0.45 - i * 0.08, freq: 2400 - i * 300, q: 3, at }));
  },
  complete: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => beep(f, 0.08, { at: i * 0.09 })),
};

// Called once per frame with that frame's game events.
export function play(events, game) {
  for (const e of events) SOUNDS[e.type]?.(e);
  const playing = game.phase === 'playing';
  const mode = game.sk.mode;
  setGrind(playing && mode === 'grind');
  const speed = game.baseSpeed ? game.speed / game.baseSpeed : 1;
  setRoll(playing && (mode === 'roll' || mode === 'ramp'), speed);
}
