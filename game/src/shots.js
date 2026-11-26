// shots.js — deterministic screenshot setup.
// Reads the page URL query (?shot=start|play|rings|landing&seed=123) and,
// when present, places the aircraft, camera, time of day and HUD state for
// that exact scene so a screenshot render is reproducible.
//   start   — title screen, aircraft parked on the home runway, golden hour
//   play    — mid-flight chase view passing through a ring over the island
//   rings   — low pass over the coastal town
//   landing — final approach, gear down, runway lights ahead
// STAGING-ONLY extension (revision set, winner-study R4/R5/R7): four more
// presets that stage a full proof chain on later campaign legs. They carry
// extra fields the original four do not use — missionIndex, campaignScore,
// score, timeLeft, fuel, wind, and per-aircraft pitch/roll/verticalSpeed —
// which main.js applyShot() applies when present.
//   cover   — FINAL leg (mission 5) on short final to Banda, rings clear,
//             banked campaign score on the HUD, clock well into the leg
//   route   — mission 2 mid-route, one ring banked, next ring dead ahead,
//             volcano island on the horizon (scope / progression)
//   weather — mission 4 storm leg: rain on, storm wind on the HUD, banked
//             into a gust, third ring ahead (second system in action)
//   results — mission 4 delivered: aircraft on the Karang runway with the
//             game's landed/results overlay and its score breakdown
//             (leg 4, not the final leg — the landed overlay only ends
//             legs 1–4; the final leg shows campaign-complete instead)

import { AIRFIELDS, SHOTS, WORLD } from './config.js';

export function readShotQuery() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seedParam = params.get('seed');
  const seed = seedParam ? parseInt(seedParam, 10) : WORLD.seed;
  if (!shot || !['start', 'play', 'rings', 'landing', 'cover', 'route', 'weather', 'results'].includes(shot)) {
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
    case 'cover':
      // FINAL leg (mission 5, Kargo Berat, Karang -> Banda) on short
      // final: 135 m short of the Banda threshold (threshold = centre -
      // forward * L/2 = (-310, 0) for heading 90, L = 620), ~15 m above
      // the strip, gear and flaps down, both rings already banked.
      // Score chain: legs 1-4 banked 630 + 520 + 530 + 730 = 2410, plus
      // this leg's 2 rings (2 x 50) = 2510. Clock: 175 s left of 480.
      return {
        mode: 'flying',
        phase: 'golden',
        missionIndex: 4,
        campaignScore: 2410,
        score: 2510,
        timeLeft: 175,
        fuel: 58,
        wind: { speed: 5.2, direction: 135 },
        aircraft: {
          position: { x: -445, y: 23, z: 0 },
          heading: 90,
          onGround: false,
          throttle: 0.32,
          speed: 33,
          gearDown: true,
          flapsDown: true,
          verticalSpeed: -2.4,
          pitch: -0.04,
        },
        camera: { mode: 'chase', distance: 16, height: 4.5 },
        hud: { visible: true, missionIndex: 4, ringsPassed: 2 },
        messages: ['Ring 2/2 — +50 points.'],
      };
    case 'route':
      // Mission 2 (Obat Pulau, Tanjung -> Pulau Api) mid-route: ring 1
      // banked, ring 2 (85, 170, -915) dead ahead ~200 m on heading 277,
      // ring 3 and the Pulau Api volcano beyond. Score: leg 1 banked
      // 630 + 1 ring (50) = 680. Clock: 190 s left of 300.
      return {
        mode: 'flying',
        phase: 'golden',
        missionIndex: 1,
        campaignScore: 630,
        score: 680,
        timeLeft: 190,
        fuel: 74,
        wind: { speed: 4.6, direction: 135 },
        aircraft: {
          position: { x: 283, y: 165, z: -890 },
          heading: 277,
          onGround: false,
          throttle: 0.75,
          speed: 58,
          gearDown: false,
          flapsDown: false,
          verticalSpeed: 0.4,
          pitch: 0.03,
          roll: -0.1,
        },
        camera: { mode: 'chase', distance: 16, height: 4.5 },
        hud: { visible: true, missionIndex: 1, ringsPassed: 1 },
        messages: ['Ring 1/3 — +50 points.'],
      };
    case 'weather':
      // Mission 4 (Badai Teluk, the storm leg, Teluk -> Karang): rain
      // on (mission definition), storm wind 14 m/s = 27 kt on the HUD,
      // airframe banked 0.22 rad into a gust, ring 3 (36, 168, 1097)
      // ahead ~180 m on heading 96. Score: legs 1-3 banked 1680 + 2
      // rings (100) = 1780. Clock: 270 s left of 420.
      return {
        mode: 'flying',
        phase: 'golden',
        missionIndex: 3,
        campaignScore: 1680,
        score: 1780,
        timeLeft: 270,
        fuel: 66,
        wind: { speed: 14, direction: 135 },
        aircraft: {
          position: { x: -143, y: 165, z: 1078 },
          heading: 96,
          onGround: false,
          throttle: 0.7,
          speed: 55,
          gearDown: false,
          flapsDown: false,
          verticalSpeed: -0.5,
          pitch: 0.02,
          roll: 0.22,
        },
        camera: { mode: 'chase', distance: 16, height: 4.5 },
        hud: { visible: true, missionIndex: 3, ringsPassed: 2 },
        messages: ['Ring 2/4 — +50 points.'],
      };
    case 'results':
      // Mission 4 delivered at Karang: aircraft rolled out on the
      // Karang Point runway (250 m past the threshold: threshold =
      // centre - forward * L/2 = (978, 1347) for heading 160,
      // L = 420), landed overlay up with the leg breakdown in the
      // game's own setLandedText format. Staged on leg 4, NOT the
      // final leg — in real play the landed overlay only ends legs
      // 1–4; finishing leg 5 shows the campaign-complete overlay.
      // Leg: rings 4 x 50 = 200 + Smooth Touchdown 150 + Time Bonus
      // 140 s x 2 = 280 + Fuel Saver 100 (fuel 47 > 40) = 730;
      // score 1680 (legs 1–3 banked) + 730 = 2410. Clock and fuel
      // continue the weather shot of this same leg (270 s left and
      // 66% mid-leg -> 140 s left and 47% at rollout).
      return {
        mode: 'landed',
        phase: 'golden',
        missionIndex: 3,
        campaignScore: 1680,
        score: 2410,
        timeLeft: 140,
        fuel: 47,
        wind: { speed: 14, direction: 135 },
        aircraft: {
          position: { x: 1064, y: 6.2, z: 1112 },
          heading: 160,
          onGround: true,
          throttle: 0,
          speed: 0,
          gearDown: true,
          flapsDown: true,
          verticalSpeed: 0,
        },
        camera: { mode: 'chase', distance: 16, height: 4.5 },
        hud: { visible: true, missionIndex: 3, ringsPassed: 4 },
        landed: {
          title: 'Badai Teluk — Delivered!',
          detail: 'Rings 200 pts. Smooth Touchdown +150  •  Time Bonus +280  •  Fuel Saver +100  Total this leg: 730 pts. Score: 2410.',
        },
        messages: ['Smooth touchdown!'],
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
  // Staging extension: honour a staged attitude when the preset carries
  // one (the original four presets carry neither and stay level).
  state.pitch = preset.aircraft.pitch || 0;
  state.roll = preset.aircraft.roll || 0;
  return state;
}
