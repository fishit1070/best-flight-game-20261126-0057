// audio.js — WebAudio synthesizer. No audio files: every sound is built
// from oscillators and filtered noise. Audio starts only after a user
// gesture (the start button), as browsers require. M toggles mute.

let audioContext = null;
let masterGain = null;
let engineOscA = null;
let engineOscB = null;
let engineGain = null;
let engineFilter = null;
let windSource = null;
let windGain = null;
let windFilter = null;
let muted = false;
let started = false;

function makeNoiseBuffer(context, seconds = 2) {
  const length = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export function initAudio() {
  if (started) return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  audioContext = new AudioCtor();
  masterGain = audioContext.createGain();
  masterGain.gain.value = muted ? 0 : 0.9;
  masterGain.connect(audioContext.destination);

  // Engine drone: two detuned sawtooth oscillators through a low-pass filter.
  engineOscA = audioContext.createOscillator();
  engineOscB = audioContext.createOscillator();
  engineOscA.type = 'sawtooth';
  engineOscB.type = 'sawtooth';
  engineOscB.detune.value = 8;
  engineFilter = audioContext.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 420;
  engineFilter.Q.value = 1.2;
  engineGain = audioContext.createGain();
  engineGain.gain.value = 0;
  engineOscA.connect(engineFilter);
  engineOscB.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(masterGain);
  engineOscA.start();
  engineOscB.start();

  // Wind: looped white noise through a band-pass filter.
  windSource = audioContext.createBufferSource();
  windSource.buffer = makeNoiseBuffer(audioContext);
  windSource.loop = true;
  windFilter = audioContext.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 700;
  windFilter.Q.value = 0.6;
  windGain = audioContext.createGain();
  windGain.gain.value = 0;
  windSource.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(masterGain);
  windSource.start();

  started = true;
}

export function resumeAudio() {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

// Called every frame while flying: rpm 0..1, airspeed in m/s.
export function updateEngineSound(rpm, airspeed, throttle) {
  if (!started || !audioContext) return;
  const now = audioContext.currentTime;
  const baseFreq = 55 + rpm * 95;
  engineOscA.frequency.setTargetAtTime(baseFreq, now, 0.08);
  engineOscB.frequency.setTargetAtTime(baseFreq * 1.005, now, 0.08);
  engineFilter.frequency.setTargetAtTime(300 + rpm * 900 + throttle * 300, now, 0.1);
  engineGain.gain.setTargetAtTime(0.05 + rpm * 0.11 + throttle * 0.03, now, 0.1);
  const windLevel = Math.min(0.22, Math.max(0, (airspeed - 15) / 90) * 0.22);
  windGain.gain.setTargetAtTime(windLevel, now, 0.15);
  windFilter.frequency.setTargetAtTime(500 + airspeed * 12, now, 0.15);
}

export function playChime() {
  if (!started || !audioContext) return;
  const now = audioContext.currentTime;
  [880, 1318.5].forEach((freq, index) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, now + index * 0.09);
    gain.gain.exponentialRampToValueAtTime(0.22, now + index * 0.09 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.09 + 0.5);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now + index * 0.09);
    osc.stop(now + index * 0.09 + 0.55);
  });
}

export function playThud(strength = 1) {
  if (!started || !audioContext) return;
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(38, now + 0.18);
  gain.gain.setValueAtTime(0.5 * strength, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.3);
}

export function playClick() {
  if (!started || !audioContext) return;
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = 'square';
  osc.frequency.value = 1200;
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.07);
}

export function playAlarm() {
  if (!started || !audioContext) return;
  const now = audioContext.currentTime;
  [0, 0.22].forEach((offset) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.14, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now + offset);
    osc.stop(now + offset + 0.22);
  });
}

export function setMuted(value) {
  muted = value;
  if (masterGain && audioContext) {
    masterGain.gain.setTargetAtTime(muted ? 0 : 0.9, audioContext.currentTime, 0.05);
  }
}

export function isMuted() {
  return muted;
}

export function isAudioStarted() {
  return started;
}
