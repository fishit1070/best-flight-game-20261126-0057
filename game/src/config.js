// config.js — all tuning constants for KELANA-9 in one place.
// Nothing here reads the network or touches the DOM; it is pure data.

export const WORLD = {
  seed: 20261126,
  size: 4200,            // world is size x size metres, centred on origin
  seaLevel: 0,
  maxTerrainHeight: 260, // volcanic cone peak
  fogNear: 1500,
  fogFar: 4600,
  gravity: 9.81,
};

export const COLOURS = {
  skyTop: 0x2b4a7a,
  skyHorizon: 0xffb36b,
  sun: 0xffd27a,
  sea: 0x1d5f6e,
  seaDeep: 0x123f52,
  sand: 0xdfc493,
  grass: 0x5d8a4a,
  grassDry: 0x8f9455,
  rock: 0x6b5a52,
  volcanoRock: 0x4a3f3a,
  runway: 0x3a3f46,
  runwayMarking: 0xf5f2e8,
  townRoof: 0xb3543a,
  townWall: 0xe8dcc0,
  windowLit: 0xffc46b,
  fuselage: 0xe8e2d4,
  fuselageStripe: 0xd94f30,
  wing: 0xd8d2c2,
  accentAmber: '#ffb347',
  accentCyan: '#7fe3ff',
  hudText: '#ffe9c4',
  hudDim: '#b8a88a',
  danger: '#ff5a4a',
  ok: '#7dff9a',
};

// Five named airfields. Positions are metres (x east, z south), y is ground height.
// heading is the runway direction in degrees (0 = north, 90 = east).
export const AIRFIELDS = [
  {
    id: 'banda',
    name: 'Banda Field',
    label: 'Home Base',
    position: { x: 0, z: 0 },
    heading: 90,
    runwayLength: 620,
    runwayWidth: 34,
    elevation: 8,
  },
  {
    id: 'tanjung',
    name: 'Tanjung Strip',
    label: 'Coastal Strip',
    position: { x: 1150, z: -780 },
    heading: 140,
    runwayLength: 480,
    runwayWidth: 26,
    elevation: 6,
  },
  {
    id: 'api',
    name: 'Pulau Api',
    label: 'Volcano Field',
    position: { x: -980, z: -1050 },
    heading: 20,
    runwayLength: 520,
    runwayWidth: 28,
    elevation: 42,
  },
  {
    id: 'teluk',
    name: 'Teluk Dalam',
    label: 'Bay Field',
    position: { x: -1250, z: 900 },
    heading: 70,
    runwayLength: 560,
    runwayWidth: 30,
    elevation: 5,
  },
  {
    id: 'karang',
    name: 'Karang Point',
    label: 'Reef Point',
    position: { x: 1050, z: 1150 },
    heading: 160,
    runwayLength: 420,
    runwayWidth: 24,
    elevation: 4,
  },
];

export const AIRCRAFT = {
  cruiseSpeed: 62,        // m/s
  maxSpeed: 88,
  minFlyingSpeed: 26,     // below this the wing stops lifting
  stallSpeed: 24,
  takeoffSpeed: 30,
  accelRate: 9,           // m/s^2 at full throttle
  dragCoefficient: 0.012,
  pitchRate: 0.85,        // rad/s at full deflection
  rollRate: 1.9,
  yawFromBank: 0.55,      // turn rate factor from bank angle
  maxBank: 1.05,          // rad, about 60 degrees
  maxPitch: 0.55,
  climbRate: 7.5,
  flapLiftBonus: 1.25,
  flapDrag: 0.35,
  gearDrag: 0.18,
  airbrakeDrag: 0.9,
  propMaxRpm: 2400,
};

export const FUEL = {
  capacity: 100,          // percent
  burnPerSecondCruise: 0.055,
  burnPerSecondFull: 0.11,
  lowWarning: 25,         // percent — HUD turns amber
  criticalWarning: 10,    // percent — HUD turns red
};

export const DAMAGE = {
  maxDamage: 100,
  hardTouchdownVs: 4.5,   // m/s vertical speed where damage starts
  crashVs: 8.0,           // m/s vertical speed = crash
  gearUpLandingDamage: 60,
  waterCrashDamage: 100,
  terrainCrashDamage: 100,
  gustDamageThreshold: 0, // gusts alone never damage the airframe
};

export const WEATHER = {
  baseWindSpeed: 4,
  baseWindDirection: 135, // degrees, from the south-east
  gustStrength: 2.5,
  gustPeriod: 7,          // seconds between gust peaks
  stormGustStrength: 11,
  stormWindSpeed: 14,
  rainIntensityStorm: 0.8,
};

// Five named campaign missions. rings: number of guide rings on the leg.
// night / storm flags change sky, lights and weather for that mission.
export const MISSIONS = [
  {
    id: 1,
    name: 'Surat Kilat',
    subtitle: 'Express Mail Run',
    cargo: 'Mail sacks — 40 kg',
    cargoWeight: 40,
    from: 'banda',
    to: 'tanjung',
    rings: 4,
    timeLimit: 420,
    night: false,
    storm: false,
    heavy: false,
    brief: 'Fly the ring course out of Banda Field and land on Tanjung Strip.',
    reward: 100,
  },
  {
    id: 2,
    name: 'Obat Pulau',
    subtitle: 'Island Medicine — Timed',
    cargo: 'Medicine cool-box — 60 kg',
    cargoWeight: 60,
    from: 'tanjung',
    to: 'api',
    rings: 3,
    timeLimit: 300,
    night: false,
    storm: false,
    heavy: false,
    brief: 'Timed delivery: medicine to Pulau Api before the clinic closes.',
    reward: 150,
  },
  {
    id: 3,
    name: 'Malam Berbintang',
    subtitle: 'Night Landing',
    cargo: 'Lanterns & spare bulbs — 35 kg',
    cargoWeight: 35,
    from: 'api',
    to: 'teluk',
    rings: 3,
    timeLimit: 480,
    night: true,
    storm: false,
    heavy: false,
    brief: 'Night leg to Teluk Dalam. Switch on landing lights and trust the runway lights.',
    reward: 200,
  },
  {
    id: 4,
    name: 'Badai Teluk',
    subtitle: 'Storm Leg',
    cargo: 'Storm supplies — 90 kg',
    cargoWeight: 90,
    from: 'teluk',
    to: 'karang',
    rings: 4,
    timeLimit: 420,
    night: false,
    storm: true,
    heavy: false,
    brief: 'Fly through the storm front to Karang Point. Expect strong gusts and rain.',
    reward: 250,
  },
  {
    id: 5,
    name: 'Kargo Berat',
    subtitle: 'Heavy Cargo — Short Runway',
    cargo: 'Generator — 320 kg',
    cargoWeight: 320,
    from: 'karang',
    to: 'banda',
    rings: 2,
    timeLimit: 480,
    night: false,
    storm: false,
    heavy: true,
    brief: 'Heavy generator home to Banda Field. Short final, gentle touchdown — no room for error.',
    reward: 400,
  },
];

export const SCORING = {
  ringPoints: 50,
  landingSmoothBonus: 150,  // vertical speed under 1.5 m/s
  landingGoodBonus: 80,     // vertical speed under 3 m/s
  timeBonusPerSecond: 2,    // unused seconds under the limit
  fuelSaverBonus: 100,      // land with more than 40% fuel
  stormRiderBonus: 120,     // complete mission 4 with damage under 20
  crashPenalty: 0,
};

export const CAMERA = {
  chaseDistance: 16,
  chaseHeight: 4.5,
  cockpitOffset: { x: 0, y: 1.6, z: 2.5 },
  towerDistance: 60,
  fov: 62,
  near: 0.1,
  far: 6000,
};

export const SHOTS = {
  start: { position: { x: 0, y: 10, z: 0 }, heading: 90 },
  // play: 200 m behind ring 1 on the Banda -> ring 1 line, heading 59, so
  // the next ring sits dead ahead, centred, with ring 2 visible beyond it.
  play: { position: { x: 230, y: 153, z: -77 }, heading: 59 },
  // rings: over the coastal town (houses centred ~180,150), heading 32
  // (north-north-east) so ring 3 (596,168,-421) sits dead ahead and
  // centred ~520 m out, the town fills the ground below, and the sea and
  // beach lie to the right (east) beyond the ring.
  rings: { position: { x: 481, y: 158, z: -255 }, heading: 42 },
  // landing: final approach to Tanjung Strip (mission 1 destination), on
  // the strip's logical/visual centreline at heading 140: 350 m out from
  // the threshold (996, -964) — the runway end the aircraft crosses first
  // flying heading 140 — 45 m above the strip elevation, so the strip
  // with its centreline dashes and edge lights runs straight ahead in the
  // centre of the frame. (terrain.js now rotates each runway group by
  // 180 - heading, so the visible strip lines up with the flight model's
  // forward vector (sin h, -cos h) and the testLanding runway.)
  landing: { position: { x: 887, y: 28, z: -1094 }, heading: 140 },
};
