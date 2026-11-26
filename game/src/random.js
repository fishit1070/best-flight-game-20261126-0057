// random.js — seeded random numbers and value noise.
// The same seed always produces the same sequence, so the same seed
// builds the same islands, towns, palm placement and weather pattern.

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(probability) {
      return next() < probability;
    },
  };
}

// Smooth 2D value noise: a deterministic hash of integer grid points,
// bilinearly interpolated with a smoothstep curve.
function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

export function valueNoise2D(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const ux = smoothstep(fx);
  const uz = smoothstep(fz);
  const top = a + (b - a) * ux;
  const bottom = c + (d - c) * ux;
  return top + (bottom - top) * uz;
}

// Fractal (multi-octave) value noise, normalised to roughly 0..1.
export function fbmNoise2D(x, z, seed, octaves = 4) {
  let total = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let normaliser = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise2D(x * frequency, z * frequency, seed + octave * 101) * amplitude;
    normaliser += amplitude;
    amplitude *= 0.5;
    frequency *= 2.1;
  }
  return total / normaliser;
}

// A slow, deterministic gust curve: -1..1, driven only by time and seed.
export function gustCurve(timeSeconds, seed) {
  const slow = Math.sin(timeSeconds * 0.35 + seed * 0.01) * 0.6;
  const fast = Math.sin(timeSeconds * 1.13 + seed * 0.037) * 0.4;
  return slow + fast;
}
