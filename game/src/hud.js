// hud.js — updates every HUD element each frame from the flight state
// and the mission state. All numbers are live; nothing here is hard-coded
// display text. The artificial horizon is drawn on a small canvas.

import { FUEL } from './config.js';
import { distanceTo } from './physics.js';

let elements = {};
let horizonCtx = null;
let lastMessageCount = 0;

export function initHud() {
  const byId = (id) => document.getElementById(id);
  elements = {
    alt: byId('hud-alt'),
    speed: byId('hud-speed'),
    vspeed: byId('hud-vspeed'),
    heading: byId('hud-heading'),
    compass: byId('hud-compass'),
    throttleBar: byId('hud-throttle-fill'),
    throttleValue: byId('hud-throttle-value'),
    fuelFill: byId('hud-fuel-fill'),
    fuelValue: byId('hud-fuel-value'),
    gear: byId('hud-gear'),
    flaps: byId('hud-flaps'),
    wind: byId('hud-wind'),
    score: byId('hud-score'),
    timer: byId('hud-timer'),
    missionName: byId('mission-name'),
    missionCargo: byId('mission-cargo'),
    missionLeg: byId('mission-leg'),
    missionRing: byId('mission-ring'),
    missionTime: byId('mission-time'),
    feed: byId('message-feed'),
    stall: byId('hud-stall'),
    stateLabel: byId('hud-state'),
  };
  const horizonCanvas = byId('hud-horizon');
  if (horizonCanvas) horizonCtx = horizonCanvas.getContext('2d');
}

function setText(element, text) {
  if (element && element.textContent !== text) element.textContent = text;
}

function formatTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function compassTicks(headingDeg) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(headingDeg / 45) % 8;
  return `${points[index]} ${String(Math.round(headingDeg)).padStart(3, '0')}°`;
}

function drawHorizon(pitch, roll, width = 140, height = 84) {
  if (!horizonCtx) return;
  const ctx = horizonCtx;
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, height / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-roll);
  const pitchPixels = pitch * 70;
  ctx.translate(0, pitchPixels);
  // Sky half and ground half.
  ctx.fillStyle = '#2b6a9a';
  ctx.fillRect(-width, -height, width * 2, height);
  ctx.fillStyle = '#8a5a2a';
  ctx.fillRect(-width, 0, width * 2, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-width, -1, width * 2, 2);
  ctx.restore();
  // Fixed aircraft symbol in the centre.
  ctx.strokeStyle = '#ffe9c4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 22, height / 2);
  ctx.lineTo(width / 2 - 6, height / 2);
  ctx.moveTo(width / 2 + 6, height / 2);
  ctx.lineTo(width / 2 + 22, height / 2);
  ctx.moveTo(width / 2, height / 2 - 4);
  ctx.lineTo(width / 2, height / 2 + 4);
  ctx.stroke();
}

export function updateHud(state, mission, cameraMode) {
  if (!elements.alt) return;
  const altitude = Math.max(0, Math.round(state.position.y));
  const speedKnots = Math.round(state.speed * 1.944);
  const vspeed = state.verticalSpeed;
  const headingDeg = ((state.heading * 180) / Math.PI + 360) % 360;

  setText(elements.alt, String(altitude));
  setText(elements.speed, String(speedKnots));
  setText(elements.vspeed, `${vspeed >= 0 ? '+' : ''}${vspeed.toFixed(1)}`);
  setText(elements.heading, compassTicks(headingDeg));
  if (elements.compass) {
    elements.compass.style.setProperty('--heading', `${headingDeg}deg`);
  }
  drawHorizon(state.pitch, state.roll);

  // Throttle bar and value.
  const throttlePct = Math.round(state.throttle * 100);
  if (elements.throttleBar) elements.throttleBar.style.width = `${throttlePct}%`;
  setText(elements.throttleValue, `${throttlePct}%`);

  // Fuel gauge with a low-fuel warning state: amber below 25%, red and
  // flashing below 10%, with a LOW FUEL label so it cannot be missed.
  const fuelPct = Math.round(state.fuel);
  if (elements.fuelFill) {
    elements.fuelFill.style.width = `${fuelPct}%`;
    elements.fuelFill.classList.toggle('is-low', state.fuel < FUEL.lowWarning);
  }
  if (elements.fuelValue) {
    elements.fuelValue.classList.toggle('is-low', state.fuel < FUEL.lowWarning);
    elements.fuelValue.classList.toggle('is-critical', state.fuel < FUEL.criticalWarning);
  }
  setText(elements.fuelValue, state.fuel < FUEL.criticalWarning
    ? `${fuelPct}% LOW FUEL`
    : state.fuel < FUEL.lowWarning ? `${fuelPct}% LOW` : `${fuelPct}%`);

  // Gear / flaps indicators.
  setText(elements.gear, state.gearDown ? 'GEAR DOWN' : 'GEAR UP');
  if (elements.gear) elements.gear.classList.toggle('is-warning', !state.gearDown && state.position.y < 200);
  setText(elements.flaps, state.flapsDown ? 'FLAPS DOWN' : 'FLAPS UP');
  if (elements.flaps) elements.flaps.classList.toggle('is-active', state.flapsDown);

  // Wind indicator: direction the wind blows from, and speed in knots.
  const windKnots = Math.round(state.wind.speed * 1.944);
  setText(elements.wind, `WIND ${Math.round(state.wind.direction)}° ${windKnots}kt`);

  // Score, timer and mission card.
  setText(elements.score, String(mission.score));
  setText(elements.timer, formatTime(mission.timeLeft));
  if (elements.timer) elements.timer.classList.toggle('is-danger', mission.timeLeft < 60);
  setText(elements.missionName, `${mission.definition.name} — ${mission.definition.subtitle}`);
  setText(elements.missionCargo, mission.definition.cargo);
  setText(elements.missionLeg, `${mission.definition.from.toUpperCase()} → ${mission.definition.to.toUpperCase()}`);
  const ringsLeft = mission.definition.rings - mission.ringsPassed;
  // Live distance from the aircraft's actual position to the next ring
  // (or to the destination once the rings are clear) — never the cached
  // mission.nextRingDistance, which is only set while flying, so the
  // title screen no longer reads "0 m" for a ring hundreds of metres away.
  const nextRingObj = mission.rings ? mission.rings.find((ring) => !ring.passed) : null;
  const nextRing = nextRingObj
    ? distanceTo(state, nextRingObj.position)
    : Math.hypot(state.position.x - mission.to.position.x, state.position.z - mission.to.position.z);
  setText(elements.missionRing, ringsLeft > 0
    ? `Ring ${mission.ringsPassed + 1}/${mission.definition.rings} — ${Math.round(nextRing)} m`
    : 'Rings clear — land at destination');
  setText(elements.missionTime, `TIME ${formatTime(mission.timeLeft)}`);

  // Stall warning banner.
  if (elements.stall) {
    elements.stall.classList.toggle('is-visible', state.stallWarning || state.stalled);
    setText(elements.stall, state.stalled ? 'STALL — NOSE DOWN, FULL POWER' : 'STALL WARNING — ADD POWER');
  }

  // Camera / state label.
  setText(elements.stateLabel, cameraMode === 'cockpit' ? 'COCKPIT' : 'CHASE');
}

export function pushMessage(text) {
  if (!elements.feed) return;
  const item = document.createElement('div');
  item.className = 'feed-item';
  item.textContent = text;
  elements.feed.prepend(item);
  while (elements.feed.children.length > 5) {
    elements.feed.removeChild(elements.feed.lastChild);
  }
  lastMessageCount += 1;
}

export function showOverlay(id) {
  document.querySelectorAll('.overlay').forEach((overlay) => {
    overlay.classList.toggle('is-visible', overlay.id === id);
  });
  // While the title card is open the flight instruments hide cleanly
  // instead of peeking out from behind the card.
  document.body.classList.toggle('title-open', id === 'overlay-title');
}

export function hideOverlays() {
  document.querySelectorAll('.overlay').forEach((overlay) => {
    overlay.classList.remove('is-visible');
  });
  document.body.classList.remove('title-open');
}

export function setPausedVisible(visible) {
  const overlay = document.getElementById('overlay-paused');
  if (overlay) overlay.classList.toggle('is-visible', visible);
}
