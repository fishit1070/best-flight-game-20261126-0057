// physics.js — arcade flight model for the twin-prop courier.
// State is plain data; stepFlight advances it by dt seconds and returns
// events (landed, crashed, stalled, ring checks are done by missions.js).

import { AIRCRAFT, DAMAGE, FUEL, WEATHER, WORLD } from './config.js';
import { gustCurve } from './random.js';

export function createFlightState(airfield) {
  const headingRad = (airfield.heading * Math.PI) / 180;
  return {
    position: { x: airfield.position.x, y: airfield.elevation + 2.2, z: airfield.position.z },
    velocity: { x: 0, y: 0, z: 0 },
    heading: headingRad,       // radians, 0 = north (-z), grows clockwise
    pitch: 0,                  // radians, positive = nose up
    roll: 0,                   // radians, positive = bank right
    speed: 0,                  // m/s along the nose
    verticalSpeed: 0,
    throttle: 0,               // 0..1
    rpm: 0,
    gearDown: true,
    flapsDown: false,
    airbrake: false,
    onGround: true,
    stalled: false,
    stallWarning: false,
    fuel: FUEL.capacity,
    damage: 0,
    wind: { speed: WEATHER.baseWindSpeed, direction: WEATHER.baseWindDirection },
    gust: 0,
    time: 0,
  };
}

export function headingDegrees(state) {
  return ((state.heading * 180) / Math.PI + 360) % 360;
}

// Wind vector (world x/z) at this moment, including gusts and storm boost.
export function currentWind(state, storm) {
  const gustStrength = storm ? WEATHER.stormGustStrength : WEATHER.gustStrength;
  const baseSpeed = storm ? WEATHER.stormWindSpeed : WEATHER.baseWindSpeed;
  const gust = gustCurve(state.time, WORLD.seed) * gustStrength;
  const speed = baseSpeed + gust;
  const dirRad = (state.wind.direction * Math.PI) / 180;
  return {
    x: Math.sin(dirRad) * speed,
    z: Math.cos(dirRad) * speed,
    speed,
    gust,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function stepFlight(state, input, dt, groundHeightAt, storm) {
  const events = [];
  state.time += dt;

  // --- Throttle -----------------------------------------------------------
  state.throttle = clamp(state.throttle + input.throttleDelta * 0.55 * dt, 0, 1);
  const targetRpm = state.throttle;
  state.rpm += (targetRpm - state.rpm) * Math.min(1, dt * 1.4);

  // --- Attitude -----------------------------------------------------------
  const pitchAuthority = state.onGround ? 0.25 : 1;
  const targetPitchRate = input.stick.pitch * AIRCRAFT.pitchRate * pitchAuthority;
  state.pitch = clamp(state.pitch + targetPitchRate * dt, -AIRCRAFT.maxPitch, AIRCRAFT.maxPitch);
  // Pitch eases back toward level when the stick is released.
  if (input.stick.pitch === 0 && !state.onGround) {
    state.pitch += (0 - state.pitch) * Math.min(1, dt * 0.35);
  }
  const targetRollRate = input.stick.roll * AIRCRAFT.rollRate;
  state.roll = clamp(state.roll + targetRollRate * dt, -AIRCRAFT.maxBank, AIRCRAFT.maxBank);
  if (input.stick.roll === 0 && !state.onGround) {
    state.roll += (0 - state.roll) * Math.min(1, dt * 0.8);
  }

  // Banked turn: heading changes in proportion to bank angle and speed.
  const turnRate = Math.tan(state.roll) * AIRCRAFT.yawFromBank * clamp(state.speed / 40, 0.2, 1.6);
  state.heading += turnRate * dt;

  // --- Speed, lift and drag ----------------------------------------------
  const flapDrag = state.flapsDown ? AIRCRAFT.flapDrag : 0;
  const gearDrag = state.gearDown && !state.onGround ? AIRCRAFT.gearDrag : 0;
  const brakeDrag = state.airbrake ? AIRCRAFT.airbrakeDrag : 0;
  const heavyFactor = input.heavy ? 0.82 : 1;
  const thrust = state.throttle * AIRCRAFT.accelRate * heavyFactor;
  const drag = AIRCRAFT.dragCoefficient * state.speed * state.speed
    + flapDrag * state.speed * 0.4 + gearDrag * state.speed * 0.3 + brakeDrag * state.speed;
  state.speed = Math.max(0, state.speed + (thrust - drag * 0.12) * dt);

  // Lift: enough speed and the wing holds the plane up; too slow and it sinks.
  const flapLift = state.flapsDown ? AIRCRAFT.flapLiftBonus : 1;
  const flyingSpeed = AIRCRAFT.minFlyingSpeed / flapLift;
  const liftRatio = clamp(state.speed / flyingSpeed, 0, 1.4);
  state.stallWarning = state.speed < AIRCRAFT.stallSpeed + 4 && !state.onGround;
  state.stalled = state.speed < AIRCRAFT.stallSpeed && !state.onGround;

  const noseUpLift = Math.sin(state.pitch) * state.speed;
  const gravitySink = WORLD.gravity * (1 - Math.min(1, liftRatio)) * 0.9;
  let climb = noseUpLift * clamp(liftRatio, 0, 1) - gravitySink;
  // Gentler stall recovery: a stalled wing still drops, but pushing the
  // nose down and adding power recovers lift quickly instead of a flat
  // 6 m/s penalty. Recovery factor 0 = full stall sink, 1 = recovered.
  if (state.stalled) {
    const noseDownHelp = clamp(-state.pitch / AIRCRAFT.maxPitch, 0, 1);
    const powerHelp = clamp(state.throttle, 0, 1);
    const recovery = clamp(noseDownHelp * 0.6 + powerHelp * 0.4, 0, 1);
    climb -= 6 * (1 - recovery * 0.75);
    // Nose-down also trades altitude for airspeed while stalled.
    state.speed = Math.min(AIRCRAFT.maxSpeed, state.speed + noseDownHelp * 4 * dt);
  }
  if (state.onGround) climb = 0;
  state.verticalSpeed = climb;

  // --- Wind gusts push the aircraft sideways and up/down ------------------
  const wind = currentWind(state, storm);
  state.gust = wind.gust;
  const gustSide = Math.sin(state.time * 0.9 + 1.7) * wind.gust * 0.35;

  // --- Integrate position --------------------------------------------------
  const forwardX = Math.sin(state.heading) * Math.cos(state.pitch);
  const forwardZ = -Math.cos(state.heading) * Math.cos(state.pitch);
  const rightX = Math.cos(state.heading);
  const rightZ = Math.sin(state.heading);
  state.position.x += (forwardX * state.speed + wind.x * 0.25 + rightX * gustSide) * dt;
  state.position.z += (forwardZ * state.speed + wind.z * 0.25 + rightZ * gustSide) * dt;
  state.position.y += state.verticalSpeed * dt;

  // Keep the plane inside the world.
  const half = WORLD.size / 2 - 40;
  state.position.x = clamp(state.position.x, -half, half);
  state.position.z = clamp(state.position.z, -half, half);

  // --- Fuel ----------------------------------------------------------------
  const burn = FUEL.burnPerSecondCruise
    + state.throttle * (FUEL.burnPerSecondFull - FUEL.burnPerSecondCruise);
  state.fuel = Math.max(0, state.fuel - burn * dt);
  if (state.fuel <= 0 && state.throttle > 0) {
    state.throttle = 0; // fuel starvation: engine quits
    events.push({ type: 'fuel-empty' });
  }

  // --- Ground / water / terrain -------------------------------------------
  const ground = groundHeightAt(state.position.x, state.position.z);
  const heightAboveGround = state.position.y - ground;

  if (state.onGround) {
    state.position.y = ground + 2.2;
    // Takeoff roll: enough speed and a pull on the stick lifts off.
    if (state.speed > AIRCRAFT.takeoffSpeed && input.stick.pitch > 0.2) {
      state.onGround = false;
      events.push({ type: 'takeoff' });
    }
  } else if (heightAboveGround <= 2.2) {
    // Touching down — landing test is done by the caller via testLanding,
    // but a hard impact here is always a crash.
    state.position.y = ground + 2.2;
    if (state.verticalSpeed < -DAMAGE.crashVs) {
      events.push({ type: 'crash', reason: 'hard-impact', verticalSpeed: state.verticalSpeed });
    } else {
      events.push({
        type: 'touchdown',
        verticalSpeed: state.verticalSpeed,
        gearDown: state.gearDown,
      });
      state.onGround = true;
      state.verticalSpeed = 0;
      state.pitch = 0;
      state.roll = 0;
    }
  }

  // Water: sea level with no land under the plane.
  if (!state.onGround && ground <= WORLD.seaLevel + 0.5 && state.position.y <= WORLD.seaLevel + 1.5) {
    events.push({ type: 'crash', reason: 'ditching', verticalSpeed: state.verticalSpeed });
  }

  return events;
}

// Landing verdict at touchdown. Returns { ok, smooth, damage, message }.
export function testLanding(state, airfield, touchdownVs) {
  const dx = state.position.x - airfield.position.x;
  const dz = state.position.z - airfield.position.z;
  const headingRad = (airfield.heading * Math.PI) / 180;
  // Rotate into runway frame: along = down the runway, across = off centreline.
  const along = dx * Math.sin(headingRad) + dz * -Math.cos(headingRad);
  const across = dx * Math.cos(headingRad) + dz * Math.sin(headingRad);
  const onRunway = Math.abs(along) <= airfield.runwayLength / 2
    && Math.abs(across) <= airfield.runwayWidth / 2 + 6;
  const headingError = Math.abs(((headingDegrees(state) - airfield.heading + 540) % 360) - 180);
  const aligned = headingError < 25 || headingError > 335;
  const gentle = touchdownVs > -DAMAGE.hardTouchdownVs;
  // Crosswind component: wind blowing across the runway pushes the
  // aircraft sideways on final. Above 8 m/s it counts against the landing
  // unless the pilot is crabbed into it (heading error under 12 degrees).
  const windRad = (state.wind.direction * Math.PI) / 180;
  const runwayRad = (airfield.heading * Math.PI) / 180;
  const crosswind = Math.abs(Math.sin(windRad - runwayRad) * state.wind.speed);
  const crosswindLimit = 8;
  const crosswindOk = crosswind <= crosswindLimit || headingError < 12;
  if (!crosswindOk) {
    return { ok: false, smooth: false, damage: 35, crosswind, message: `Crosswind landing — ${crosswind.toFixed(1)} m/s across the runway.` };
  }

  if (!onRunway) {
    return { ok: false, smooth: false, damage: DAMAGE.terrainCrashDamage, message: 'Off the runway — rough ground.' };
  }
  if (!state.gearDown) {
    return { ok: false, smooth: false, damage: DAMAGE.gearUpLandingDamage, message: 'Belly landing — gear was up!' };
  }
  if (!aligned) {
    return { ok: false, smooth: false, damage: 45, message: 'Landed across the runway.' };
  }
  if (!gentle) {
    const damage = Math.round((Math.abs(touchdownVs) - DAMAGE.hardTouchdownVs) * 12);
    return { ok: true, smooth: false, damage, message: 'Hard touchdown — airframe shaken.' };
  }
  const smooth = touchdownVs > -1.5;
  return {
    ok: true,
    smooth,
    damage: 0,
    message: smooth ? 'Smooth touchdown!' : 'Down safe.',
  };
}

// Distance in metres from the aircraft to a point (used for ring checks).
export function distanceTo(state, point) {
  const dx = state.position.x - point.x;
  const dy = state.position.y - point.y;
  const dz = state.position.z - point.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
