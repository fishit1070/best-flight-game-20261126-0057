// main.js — boots KELANA-9: renderer, scene, camera, lights, terrain,
// sky, aircraft, input, audio, HUD and missions; runs the frame loop with
// a fixed-step update; handles title / flying / paused / landed / crashed
// / campaign-complete states and window resize.

import { AIRFIELDS, CAMERA, MISSIONS, WORLD } from './config.js';
import { makeRng } from './random.js';
import {
  attachButtons, attachInput, endFrame, isHeld, readStick,
  readThrottleInput, wasPressed,
} from './input.js';
import {
  initAudio, isAudioStarted, isMuted, playAlarm, playChime,
  playClick, playThud, resumeAudio, setMuted, updateEngineSound,
} from './audio.js';
import {
  createFlightState, currentWind, distanceTo, headingDegrees,
  stepFlight, testLanding,
} from './physics.js';
import { buildAircraft, updateAircraft } from './aircraft.js';
import { buildTerrain, updateTerrain } from './terrain.js';
import { buildSky, setDayPhase, updateSky } from './sky.js';
import { hideOverlays, initHud, pushMessage, setPausedVisible, showOverlay, updateHud } from './hud.js';
import {
  advanceCampaign, createCampaign, createMissionState,
  findAirfield, missionBrief, resolveLanding, updateMission,
} from './missions.js';
import { applyShotToFlightState, readShotQuery, shotPreset } from './shots.js';

const FIXED_DT = 1 / 60;
const container = document.getElementById('game-container');
const webglErrorBox = document.getElementById('webgl-error');

let renderer = null;
let scene = null;
let camera = null;
let sky = null;
let terrain = null;
let aircraftParts = null;
let ringMeshes = [];
let rain = null;

let campaign = createCampaign();
let mission = createMissionState(campaign);
let flight = createFlightState(mission.from);

let gameState = 'title'; // title | flying | paused | landed | crashed | complete
let cameraMode = 'chase'; // chase | cockpit | tower
let elapsed = 0;
let accumulator = 0;
let lastTime = 0;
let stallAlarmCooldown = 0;
let fuelAlarmCooldown = 0;
let shot = readShotQuery();
let shotApplied = false;
let activeShotPreset = null;
let ringBeacon = null;

function showWebglError(message) {
  if (webglErrorBox) {
    webglErrorBox.textContent = message;
    webglErrorBox.classList.add('is-visible');
  }
}

function buildRenderer() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (error) {
    showWebglError('WebGL could not start on this device — KELANA-9 needs WebGL to fly.');
    return false;
  }
  if (!renderer.getContext()) {
    showWebglError('WebGL context failed — please try a browser with WebGL enabled.');
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  return true;
}

function buildLights(night) {
  const sun = new THREE.DirectionalLight(0xffd9a0, night ? 0.25 : 1.6);
  sun.position.set(-600, 500, -800);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -400;
  sun.shadow.camera.right = 400;
  sun.shadow.camera.top = 400;
  sun.shadow.camera.bottom = -400;
  sun.shadow.camera.far = 3000;
  scene.add(sun);
  const ambient = new THREE.AmbientLight(0xffc890, night ? 0.25 : 0.6);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0x8fb8dd, 0x8a6a3a, night ? 0.2 : 0.5);
  scene.add(hemi);
  return { sun, ambient, hemi };
}

let lights = null;

function buildRingMeshes() {
  ringMeshes.forEach((mesh) => scene.remove(mesh));
  ringMeshes = [];
  // Big, hot-orange rings that read from 200 m: a fat bright torus, a
  // pale core stripe and a soft outer halo (children, so they inherit the
  // per-frame pulse/spin). MeshBasicMaterial is unlit, so the colour stays
  // full-bright at golden hour instead of shading away.
  const ringGeometry = new THREE.TorusGeometry(36, 3.0, 14, 56);
  const coreGeometry = new THREE.TorusGeometry(36, 1.1, 8, 56);
  const haloGeometry = new THREE.TorusGeometry(36, 6.5, 8, 48);
  // Face the rings along the leg, not due east: the torus axis (+Z) must
  // point down the departure -> destination direction so an oncoming
  // aircraft sees the full circle instead of an edge-on ellipse.
  const legDx = mission.to.position.x - mission.from.position.x;
  const legDz = mission.to.position.z - mission.from.position.z;
  const legAngle = Math.atan2(legDx, legDz);
  for (const ring of mission.rings) {
    const material = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.98 });
    const mesh = new THREE.Mesh(ringGeometry, material);
    const core = new THREE.Mesh(coreGeometry, new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95 }));
    const halo = new THREE.Mesh(haloGeometry, new THREE.MeshBasicMaterial({ color: 0xff6a00, transparent: true, opacity: 0.10 }));
    mesh.add(core);
    mesh.add(halo);
    mesh.position.set(ring.position.x, ring.position.y, ring.position.z);
    mesh.rotation.y = legAngle;
    scene.add(mesh);
    ringMeshes.push(mesh);
  }

  // Tall vertical beacon of warm light marking the next ring: a wide
  // faint pillar plus a bright narrow core, both rising ~280 m above the
  // ring so the ring ahead reads from far away. It is repositioned every
  // frame by updateRingBeacon() and hidden once the rings are clear.
  if (ringBeacon) {
    scene.remove(ringBeacon);
    ringBeacon = null;
  }
  ringBeacon = new THREE.Group();
  ringBeacon.name = 'ring-beacon';
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(2.0, 3.0, 300, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  pillar.position.y = 120;
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 300, 8, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  core.position.y = 120;
  ringBeacon.add(pillar);
  ringBeacon.add(core);
  ringBeacon.userData.pillar = pillar;
  ringBeacon.userData.core = core;
  scene.add(ringBeacon);
  updateRingBeacon();
}

function updateRingBeacon() {
  if (!ringBeacon) return;
  const next = mission.rings.find((ring) => !ring.passed);
  if (!next) {
    ringBeacon.visible = false;
    return;
  }
  if (shot.shot) {
    // Shot mode: no beacon pillar — it reads as a laser column in stills.
    ringBeacon.visible = false;
    return;
  }
  ringBeacon.visible = true;
  ringBeacon.position.set(next.position.x, next.position.y, next.position.z);
}

function buildRain() {
  const count = 1200;
  const positions = new Float32Array(count * 3);
  const rng = makeRng(777);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = rng.range(-80, 80);
    positions[i * 3 + 1] = rng.range(0, 60);
    positions[i * 3 + 2] = rng.range(-80, 80);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  rain = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: 0xaaccee, size: 0.35, transparent: true, opacity: 0.6,
  }));
  rain.visible = false;
  scene.add(rain);
}

function updateRain(dt) {
  if (!rain || !rain.visible) return;
  rain.position.set(flight.position.x, flight.position.y - 20, flight.position.z);
  const positions = rain.geometry.attributes.position;
  for (let i = 0; i < positions.count; i += 1) {
    let y = positions.getY(i) - dt * 55;
    if (y < 0) y = 60;
    positions.setY(i, y);
  }
  positions.needsUpdate = true;
}

function startMission(index) {
  campaign.missionIndex = index;
  mission = createMissionState(campaign);
  flight = createFlightState(mission.from);
  buildRingMeshes();
  const night = mission.definition.night;
  setDayPhase(sky, night ? 'night' : 'golden');
  scene.fog = new THREE.Fog(night ? 0x0d1428 : 0xf2a56b, WORLD.fogNear, WORLD.fogFar);
  if (lights) {
    lights.sun.intensity = night ? 0.25 : 1.6;
    lights.ambient.intensity = night ? 0.25 : 0.6;
    lights.hemi.intensity = night ? 0.2 : 0.5;
  }
  if (rain) rain.visible = mission.definition.storm;
  gameState = 'flying';
  hideOverlays();
  pushMessage(missionBrief(mission));
  pushMessage(`Depart ${mission.from.name} — land at ${mission.to.name}.`);
}

function onMissionEvent(event) {
  if (event.type === 'ring') {
    playChime();
    pushMessage(`Ring ${event.ringsPassed}/${event.total} — +50 points.`);
  } else if (event.type === 'failed') {
    gameState = 'crashed';
    showOverlay('overlay-crashed');
    setCrashText(event.reason);
  }
}

function setCrashText(reason) {
  const el = document.getElementById('crash-reason');
  if (el) el.textContent = reason;
}

function setLandedText(breakdown) {
  const title = document.getElementById('landed-title');
  const detail = document.getElementById('landed-detail');
  if (title) title.textContent = campaign.campaignComplete ? 'Campaign Complete!' : `${mission.definition.name} — Delivered!`;
  if (detail) {
    const bonusLines = breakdown.bonuses.map((b) => `${b.name} +${b.points}`).join('  •  ');
    detail.textContent = `Rings ${breakdown.ringPoints} pts. ${bonusLines}  Total this leg: ${breakdown.total} pts. Score: ${mission.score}.`;
  }
}

function handleFlightEvents(events) {
  for (const event of events) {
    if (event.type === 'takeoff') {
      pushMessage('Airborne — gear up when clear of the runway.');
      playThud(0.3);
    } else if (event.type === 'touchdown') {
      playThud(Math.min(1, Math.abs(event.verticalSpeed) / 4));
      mission._fuelAtLanding = flight.fuel;
      mission._damageAtLanding = flight.damage;
      const landing = testLanding(flight, mission.to, event.verticalSpeed);
      flight.damage = Math.min(100, flight.damage + (landing.damage || 0));
      if (landing.ok && mission.ringsPassed >= mission.definition.rings) {
        const breakdown = resolveLanding(mission, campaign, landing);
        gameState = campaign.campaignComplete ? 'complete' : 'landed';
        setLandedText(breakdown);
        showOverlay(campaign.campaignComplete ? 'overlay-complete' : 'overlay-landed');
        pushMessage(landing.message);
      } else if (landing.ok) {
        pushMessage('Landed — but rings were missed. Take off and try again, or retry the mission.');
        flight.onGround = true;
      } else {
        gameState = 'crashed';
        setCrashText(landing.message);
        showOverlay('overlay-crashed');
      }
    } else if (event.type === 'crash') {
      gameState = 'crashed';
      setCrashText(event.reason === 'ditching' ? 'Ditched in the sea.' : 'Crashed — hard impact.');
      showOverlay('overlay-crashed');
    } else if (event.type === 'fuel-empty') {
      pushMessage('Fuel empty — engine out. Glide to the nearest field!');
    }
  }
}

function updateCamera(dt) {
  const heading = flight.heading;
  const forwardX = Math.sin(heading);
  const forwardZ = -Math.cos(heading);
  if (cameraMode === 'chase') {
    const distance = CAMERA.chaseDistance;
    const height = CAMERA.chaseHeight;
    const targetX = flight.position.x - forwardX * distance;
    const targetZ = flight.position.z - forwardZ * distance;
    const targetY = flight.position.y + height;
    camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 6);
    camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 6);
    camera.position.z += (targetZ - camera.position.z) * Math.min(1, dt * 6);
    camera.lookAt(flight.position.x + forwardX * 12, flight.position.y + 1, flight.position.z + forwardZ * 12);
  } else if (cameraMode === 'cockpit') {
    camera.position.set(
      flight.position.x + forwardX * CAMERA.cockpitOffset.z,
      flight.position.y + CAMERA.cockpitOffset.y,
      flight.position.z + forwardZ * CAMERA.cockpitOffset.z,
    );
    camera.lookAt(
      flight.position.x + forwardX * 40,
      flight.position.y + Math.sin(flight.pitch) * 40,
      flight.position.z + forwardZ * 40,
    );
  } else {
    // Tower view: fixed point near the destination runway.
    const tower = mission.to;
    camera.position.set(tower.position.x + 60, tower.elevation + 40, tower.position.z + 60);
    camera.lookAt(flight.position.x, flight.position.y, flight.position.z);
  }
  // Hero camera for the title screen.
  if (gameState === 'title') {
    if (shot.shot === 'start') {
      // Fixed framing for the start screenshot: camera behind and to the
      // north of the parked aircraft, looking east down the runway, so the
      // aircraft sits on the right of the frame (clear of the title card,
      // now docked left) with the runway stretching ahead.
      const fx = Math.sin(flight.heading);
      const fz = -Math.cos(flight.heading);
      const rx = Math.cos(flight.heading);
      const rz = Math.sin(flight.heading);
      camera.position.set(
        flight.position.x - fx * 26 - rx * 16,
        flight.position.y + 7,
        flight.position.z - fz * 26 - rz * 16,
      );
      camera.lookAt(
        flight.position.x + fx * 36,
        flight.position.y + 1,
        flight.position.z + fz * 36,
      );
    } else {
      const orbit = elapsed * 0.08;
      camera.position.set(
        flight.position.x + Math.sin(orbit) * 26,
        flight.position.y + 8,
        flight.position.z + Math.cos(orbit) * 26,
      );
      camera.lookAt(flight.position.x, flight.position.y + 1, flight.position.z);
    }
  }
}

function fixedUpdate(dt) {
  elapsed += dt;

  // Shot mode freeze: with a ?shot= preset active, hold the flight state
  // exactly at the preset (position, heading, speed, throttle) on every
  // frame — no stepFlight, no mission timer, no fuel burn — so the
  // aircraft cannot fly past the scene during a screenshot. Rendering,
  // sky/sea/cloud animation (driven by elapsed in frameLoop), the
  // aircraft visuals and the HUD (from the frozen state) all keep going.
  // Normal play without ?shot= never reaches this branch.
  if (shot.shot && shotApplied && activeShotPreset) {
    applyShotToFlightState(flight, activeShotPreset);
    updateAircraft(aircraftParts, flight, dt, elapsed, mission.definition.night);
    updateHud(flight, mission, cameraMode);
    return;
  }

  // Pause / mute / reset / camera toggles (edge-triggered keys).
  if (wasPressed('pause') && (gameState === 'flying' || gameState === 'paused')) {
    gameState = gameState === 'paused' ? 'flying' : 'paused';
    setPausedVisible(gameState === 'paused');
    playClick();
  }
  if (wasPressed('mute')) {
    setMuted(!isMuted());
    pushMessage(isMuted() ? 'Sound muted (M).' : 'Sound on (M).');
  }
  if (wasPressed('reset') && gameState !== 'title') {
    startMission(campaign.missionIndex);
    pushMessage('Mission reset.');
  }
  if (wasPressed('camera')) {
    cameraMode = cameraMode === 'chase' ? 'cockpit' : cameraMode === 'cockpit' ? 'tower' : 'chase';
    pushMessage(`Camera: ${cameraMode}.`);
    playClick();
  }
  if (wasPressed('gear') && gameState === 'flying') {
    flight.gearDown = !flight.gearDown;
    pushMessage(flight.gearDown ? 'Gear down.' : 'Gear up.');
    playClick();
  }
  if (wasPressed('flaps') && gameState === 'flying') {
    flight.flapsDown = !flight.flapsDown;
    pushMessage(flight.flapsDown ? 'Flaps down.' : 'Flaps up.');
    playClick();
  }

  if (gameState !== 'flying') {
    updateAircraft(aircraftParts, flight, dt, elapsed, mission.definition.night);
    // Keep the HUD live on the title screen too, so the mission card
    // shows the real distance to the next ring instead of its static text.
    updateHud(flight, mission, cameraMode);
    return;
  }

  // Gather input for this step.
  const input = {
    stick: readStick(),
    throttleDelta: readThrottleInput(),
    heavy: mission.definition.heavy,
  };
  flight.airbrake = isHeld('airbrake');
  flight.wind = { speed: currentWind(flight, mission.definition.storm).speed, direction: flight.wind.direction };

  const events = stepFlight(flight, input, dt, terrain.groundHeightAt, mission.definition.storm);
  handleFlightEvents(events);
  updateMission(mission, flight, dt, onMissionEvent);

  // Distance to the next ring (or destination once rings are clear).
  const nextRing = mission.rings.find((ring) => !ring.passed);
  if (nextRing) {
    mission.nextRingDistance = distanceTo(flight, nextRing.position);
  } else {
    mission.nextRingDistance = Math.hypot(
      flight.position.x - mission.to.position.x,
      flight.position.z - mission.to.position.z,
    );
  }

  // Stall alarm, throttled so it does not fire every frame.
  stallAlarmCooldown -= dt;
  if (flight.stalled && stallAlarmCooldown <= 0) {
    playAlarm();
    stallAlarmCooldown = 1.2;
  }
  fuelAlarmCooldown -= dt;
  if (flight.fuel < 10 && fuelAlarmCooldown <= 0) {
    playAlarm();
    fuelAlarmCooldown = 2;
  }

  updateAircraft(aircraftParts, flight, dt, elapsed, mission.definition.night);
  updateEngineSound(flight.rpm, flight.speed, flight.throttle);
  updateHud(flight, mission, cameraMode);
}

function frameLoop(now) {
  requestAnimationFrame(frameLoop);
  const delta = Math.min(0.1, (now - lastTime) / 1000 || 0);
  lastTime = now;
  accumulator += delta;
  let steps = 0;
  while (accumulator >= FIXED_DT && steps < 5) {
    fixedUpdate(FIXED_DT);
    accumulator -= FIXED_DT;
    steps += 1;
  }
  if (steps === 5) accumulator = 0;

  // Per-frame visuals (not fixed-step): sky, sea, rings, rain, camera.
  updateSky(sky, delta, elapsed);
  updateTerrain(terrain, elapsed);
  ringMeshes.forEach((mesh, index) => {
    const ring = mission.rings[index];
    if (!ring) return;
    mesh.material.opacity = ring.passed ? 0.25 : 0.9;
    mesh.rotation.z += delta * 0.4;
    const pulse = 1 + Math.sin(elapsed * 2 + index) * 0.03;
    mesh.scale.setScalar(pulse);
  });
  // The beacon follows the next unpassed ring (and hides when none left).
  updateRingBeacon();
  if (ringBeacon) {
    if (ringBeacon.userData.pillar) {
      ringBeacon.userData.pillar.material.opacity = 0.08 + 0.03 * Math.sin(elapsed * 2);
    }
    if (ringBeacon.userData.core) {
      ringBeacon.userData.core.material.opacity = 0.18 + 0.05 * Math.sin(elapsed * 2);
    }
  }
  updateRain(delta);
  updateCamera(delta);
  endFrame();
  renderer.render(scene, camera);
}

function onAction(action) {
  playClick();
  if (action === 'start') {
    initAudio();
    resumeAudio();
    startMission(0);
  } else if (action === 'resume') {
    gameState = 'flying';
    setPausedVisible(false);
  } else if (action === 'retry') {
    startMission(campaign.missionIndex);
  } else if (action === 'next-mission') {
    if (advanceCampaign(campaign)) startMission(campaign.missionIndex);
  } else if (action === 'restart-campaign') {
    campaign = createCampaign();
    startMission(0);
  } else if (action === 'camera') {
    cameraMode = cameraMode === 'chase' ? 'cockpit' : cameraMode === 'cockpit' ? 'tower' : 'chase';
  } else if (action === 'mute') {
    initAudio();
    setMuted(!isMuted());
  } else if (action === 'gear') {
    flight.gearDown = !flight.gearDown;
  } else if (action === 'flaps') {
    flight.flapsDown = !flight.flapsDown;
  }
}

function applyShot() {
  if (shotApplied || !shot.shot) return;
  const preset = shotPreset(shot.shot);
  if (!preset) return;
  activeShotPreset = preset;

  // STAGING-ONLY extension: a preset may stage a later campaign leg.
  // Rebuild mission + flight state for that leg and set its environment
  // (night fog/lights, storm rain) exactly as startMission() would, so
  // the frozen shot shows the leg the HUD claims we are on.
  if (preset.missionIndex !== undefined && preset.missionIndex !== campaign.missionIndex) {
    campaign.missionIndex = preset.missionIndex;
    campaign.totalScore = preset.campaignScore || 0;
    mission = createMissionState(campaign);
    flight = createFlightState(mission.from);
    buildRingMeshes();
    const night = mission.definition.night;
    setDayPhase(sky, night ? 'night' : 'golden');
    scene.fog = new THREE.Fog(night ? 0x0d1428 : 0xf2a56b, WORLD.fogNear, WORLD.fogFar);
    if (lights) {
      lights.sun.intensity = night ? 0.25 : 1.6;
      lights.ambient.intensity = night ? 0.25 : 0.6;
      lights.hemi.intensity = night ? 0.2 : 0.5;
    }
    if (rain) rain.visible = mission.definition.storm;
    // Drop the boot welcome line so the staged feed stays clear of the
    // touch buttons, then mirror startMission()'s feed so the card and
    // feed tell one story.
    const feed = document.getElementById('message-feed');
    if (feed) feed.innerHTML = '';
    pushMessage(missionBrief(mission));
    pushMessage(`Depart ${mission.from.name} — land at ${mission.to.name}.`);
  }

  applyShotToFlightState(flight, preset);
  setDayPhase(sky, preset.phase);

  // STAGING-ONLY extension: accumulated campaign state the original
  // presets never needed (score, mission clock, fuel, wind, sink rate).
  // The shot freeze never calls updateMission/stepFlight, so these hold.
  if (preset.score !== undefined) mission.score = preset.score;
  if (preset.timeLeft !== undefined) mission.timeLeft = preset.timeLeft;
  if (preset.fuel !== undefined) flight.fuel = preset.fuel;
  if (preset.wind) flight.wind = { speed: preset.wind.speed, direction: preset.wind.direction };
  if (preset.aircraft.verticalSpeed !== undefined) flight.verticalSpeed = preset.aircraft.verticalSpeed;
  if (preset.messages) preset.messages.forEach((text) => pushMessage(text));

  if (preset.mode === 'title') {
    gameState = 'title';
    showOverlay('overlay-title');
  } else if (preset.mode === 'landed') {
    gameState = 'landed';
    mission.ringsPassed = preset.hud.ringsPassed || 0;
    mission.rings.forEach((ring, index) => {
      ring.passed = index < mission.ringsPassed;
    });
    showOverlay('overlay-landed');
    if (preset.landed) {
      const title = document.getElementById('landed-title');
      const detail = document.getElementById('landed-detail');
      if (title) title.textContent = preset.landed.title;
      if (detail) detail.textContent = preset.landed.detail;
    }
  } else {
    gameState = 'flying';
    hideOverlays();
    mission.ringsPassed = preset.hud.ringsPassed || 0;
    mission.rings.forEach((ring, index) => {
      ring.passed = index < mission.ringsPassed;
    });
  }
  shotApplied = true;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

export function boot() {
  if (!window.THREE) {
    showWebglError('Three.js failed to load — check that vendor/three.min.js is present.');
    return;
  }
  if (!buildRenderer()) return;

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf2a56b, WORLD.fogNear, WORLD.fogFar);
  camera = new THREE.PerspectiveCamera(CAMERA.fov, window.innerWidth / window.innerHeight, CAMERA.near, CAMERA.far);
  camera.position.set(26, 12, 26);

  const seed = shot.seed;
  sky = buildSky(scene, seed, 'golden');
  terrain = buildTerrain(scene, seed);
  lights = buildLights(false);
  aircraftParts = buildAircraft();
  scene.add(aircraftParts.group);
  buildRain();
  buildRingMeshes();

  initHud();
  attachInput();
  attachButtons(document.body, onAction);
  window.addEventListener('resize', onResize);

  // Title screen: aircraft parked on the home runway.
  showOverlay('overlay-title');
  pushMessage('Welcome to KELANA-9 — Archipelago Air Courier.');
  applyShot();

  lastTime = performance.now();
  requestAnimationFrame(frameLoop);
}

document.addEventListener('DOMContentLoaded', boot);
