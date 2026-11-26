// shots.js — deterministic screenshot setup.
// Reads the page URL query (?shot=start|play|rings|landing&seed=123) and,
// when present, places the aircraft, camera, time of day and HUD state for
// that exact scene so a screenshot render is reproducible.
//   start   — title screen, aircraft parked on the home runway, golden hour
//   play    — mid-flight chase view passing through a ring over the island
//   rings   — low pass over the coastal town
//   landing — final approach, gear down, runway lights ahead

import { AIRFIELDS, SHOTS, WORLD } from './config.js';

export function readShotQuery() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seedParam = params.get('seed');
  const seed = seedParam ? parseInt(seedParam, 10) : WORLD.seed;
  if (!shot || !['start', 'play', 'rings', 'landing'].includes(shot)) {
    return { shot: null, seed: Number.isFinite(seed) ? seed : WORLD.seed };
  }
  return { shot, seed: Number.isFinite(seed) ? seed : WORLD.seed };
}

// Returns a scene preset for the requested shot, or null for normal play.
export function shotPreset(shotName) {
  const home = AIRFIELDS[0];
  switch (shotName) {
    case 'start':
      return {
        mode: 'title',
        phase: 'golden',
        aircraft: {
          position: { x: home.position.x, y: home.elevation + 2.2, z: home.position.z },
          heading: home.heading,
          onGround: true,
          throttle: 0,
          speed: 0,
        },
        camera: { mode: 'hero', distance: 26, height: 7 },
        hud: { visible: false, missionIndex: 0 },
      };
    case 'play':
      return {
        mode: 'flying',
        phase: 'golden',
        aircraft: {
          position: { x: SHOTS.play.position.x, y: SHOTS.play.position.y, z: SHOTS.play.position.z },
          heading: SHOTS.play.heading,
          onGround: false,
          throttle: 0.75,
          speed: 58,
        },
        camera: { mode: 'chase', distance: 16, height: 4.5 },
        hud: { visible: true, missionIndex: 0, ringsPassed: 0 },
      };
    case 'rings':
      return {
        mode: 'flying',
        phase: 'golden',
        aircraft: {
          position: { x: SHOTS.rings.position.x, y: SHOTS.rings.position.y, z: SHOTS.rings.position.z },
          heading: SHOTS.rings.heading,
          onGround: false,
          throttle: 0.7,
          speed: 55,
        },
        camera: { mode: 'chase', distance: 18, height: 5 },
        hud: { visible: true, missionIndex: 0, ringsPassed: 2 },
      };
    case 'landing':
      return {
        mode: 'flying',
        phase: 'golden',
        aircraft: {
          position: { x: SHOTS.landing.position.x, y: SHOTS.landing.position.y, z: SHOTS.landing.position.z },
          heading: SHOTS.landing.heading,
          onGround: false,
          throttle: 0.35,
          speed: 34,
          gearDown: true,
          flapsDown: true,
        },
        camera: { mode: 'chase', distance: 20, height: 6 },
        hud: { visible: true, missionIndex: 0, ringsPassed: 4 },
      };
    default:
      return null;
  }
}

// Applies a preset to a flight state object (mutates and returns it).
export function applyShotToFlightState(state, preset) {
  if (!preset) return state;
  const headingRad = (preset.aircraft.heading * Math.PI) / 180;
  state.position.x = preset.aircraft.position.x;
  state.position.y = preset.aircraft.position.y;
  state.position.z = preset.aircraft.position.z;
  state.heading = headingRad;
  state.speed = preset.aircraft.speed;
  state.throttle = preset.aircraft.throttle;
  state.rpm = preset.aircraft.throttle;
  state.onGround = preset.aircraft.onGround;
  if (preset.aircraft.gearDown !== undefined) state.gearDown = preset.aircraft.gearDown;
  if (preset.aircraft.flapsDown !== undefined) state.flapsDown = preset.aircraft.flapsDown;
  state.pitch = 0;
  state.roll = 0;
  return state;
}
