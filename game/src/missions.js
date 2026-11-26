// missions.js — the campaign: five named cargo missions with different
// goals. Tracks rings passed, legs completed, score, timer, fuel and
// damage, and awards feats. Handles mission complete, campaign complete,
// crash and retry.

import { AIRFIELDS, MISSIONS, SCORING } from './config.js';
import { distanceTo } from './physics.js';

export function findAirfield(id) {
  return AIRFIELDS.find((field) => field.id === id);
}

export function createCampaign() {
  return {
    missionIndex: 0,
    score: 0,
    totalScore: 0,
    feats: [],
    completed: [],
    campaignComplete: false,
  };
}

export function createMissionState(campaign) {
  const definition = MISSIONS[campaign.missionIndex];
  const from = findAirfield(definition.from);
  const to = findAirfield(definition.to);
  return {
    definition,
    from,
    to,
    score: campaign.totalScore,
    ringsPassed: 0,
    rings: buildRingCourse(from, to, definition.rings),
    timeLeft: definition.timeLimit,
    timeUsed: 0,
    status: 'flying', // flying | complete | crashed | failed
    failReason: '',
    featsEarned: [],
    smoothLanding: false,
  };
}

// Rings arc from departure toward destination, spaced along the leg.
export function buildRingCourse(from, to, count) {
  const rings = [];
  for (let i = 0; i < count; i += 1) {
    const t = (i + 1) / (count + 1);
    const x = from.position.x + (to.position.x - from.position.x) * t;
    const z = from.position.z + (to.position.z - from.position.z) * t;
    // Gentle sideways weave so the course is not a straight line.
    const weave = Math.sin(t * Math.PI * 2) * 160;
    rings.push({
      index: i,
      position: { x: x + weave, y: 130 + Math.sin(t * Math.PI) * 40, z: z - weave * 0.5 },
      radius: 36, // matches the visible torus, so the ring you see is the ring you fly
      passed: false,
    });
  }
  return rings;
}

export function nextRingDistance(mission) {
  const next = mission.rings.find((ring) => !ring.passed);
  if (!next) {
    return Math.hypot(
      mission.to.position.x - mission._lastX || 0,
      mission.to.position.z - mission._lastZ || 0,
    );
  }
  return next._distance || 0;
}

// Called every frame while flying: timer, ring checks, fuel/damage watch.
export function updateMission(mission, state, dt, onEvent) {
  if (mission.status !== 'flying') return;
  mission.timeLeft -= dt;
  mission.timeUsed += dt;
  mission._lastX = state.position.x;
  mission._lastZ = state.position.z;

  // Ring checks: fly within the ring radius to pass it.
  const next = mission.rings.find((ring) => !ring.passed);
  if (next) {
    next._distance = distanceTo(state, next.position);
    if (next._distance < next.radius) {
      next.passed = true;
      mission.ringsPassed += 1;
      mission.score += SCORING.ringPoints;
      onEvent({ type: 'ring', ring: next, ringsPassed: mission.ringsPassed, total: mission.definition.rings });
    }
  }

  if (mission.timeLeft <= 0) {
    mission.status = 'failed';
    mission.failReason = 'Out of time — the cargo window closed.';
    onEvent({ type: 'failed', reason: mission.failReason });
  }
  if (state.fuel <= 0 && !state.onGround) {
    mission.status = 'failed';
    mission.failReason = 'Fuel exhausted.';
    onEvent({ type: 'failed', reason: mission.failReason });
  }
}

export function awardFeat(mission, featName) {
  if (!mission.featsEarned.includes(featName)) {
    mission.featsEarned.push(featName);
  }
}

// Called by main.js when the aircraft lands. Returns the scoring breakdown.
export function resolveLanding(mission, campaign, landing) {
  const breakdown = { ringPoints: mission.ringsPassed * SCORING.ringPoints, bonuses: [], total: 0 };
  if (!landing.ok) {
    mission.status = 'crashed';
    mission.failReason = landing.message;
    return { ...breakdown, crashed: true, message: landing.message };
  }
  if (mission.ringsPassed < mission.definition.rings) {
    mission.status = 'failed';
    mission.failReason = `Landed early — ${mission.definition.rings - mission.ringsPassed} ring(s) missed.`;
    return { ...breakdown, crashed: false, message: mission.failReason };
  }
  mission.status = 'complete';
  mission.smoothLanding = landing.smooth;
  let bonus = 0;
  if (landing.smooth) {
    bonus += SCORING.landingSmoothBonus;
    breakdown.bonuses.push({ name: 'Smooth Touchdown', points: SCORING.landingSmoothBonus });
    awardFeat(mission, 'Smooth Touchdown');
  } else {
    bonus += SCORING.landingGoodBonus;
    breakdown.bonuses.push({ name: 'Safe Landing', points: SCORING.landingGoodBonus });
  }
  if (mission.ringsPassed === mission.definition.rings) {
    breakdown.bonuses.push({ name: 'Ring Master', points: 0 });
    awardFeat(mission, 'Ring Master');
  }
  const timeBonus = Math.round(Math.max(0, mission.timeLeft) * SCORING.timeBonusPerSecond);
  if (timeBonus > 0) {
    bonus += timeBonus;
    breakdown.bonuses.push({ name: 'Time Bonus', points: timeBonus });
  }
  // Fuel Saver: land with plenty in the tank.
  if (mission._fuelAtLanding !== undefined && mission._fuelAtLanding > 40) {
    bonus += SCORING.fuelSaverBonus;
    breakdown.bonuses.push({ name: 'Fuel Saver', points: SCORING.fuelSaverBonus });
    awardFeat(mission, 'Fuel Saver');
  }
  // Storm Rider: finish the storm leg with light damage.
  if (mission.definition.storm && mission._damageAtLanding !== undefined && mission._damageAtLanding < 20) {
    bonus += SCORING.stormRiderBonus;
    breakdown.bonuses.push({ name: 'Storm Rider', points: SCORING.stormRiderBonus });
    awardFeat(mission, 'Storm Rider');
  }
  breakdown.total = breakdown.ringPoints + bonus;
  mission.score += bonus;
  campaign.totalScore = mission.score;
  campaign.completed.push(mission.definition.id);
  campaign.feats.push(...mission.featsEarned);
  if (campaign.missionIndex >= MISSIONS.length - 1) {
    campaign.campaignComplete = true;
  }
  return { ...breakdown, crashed: false, message: landing.message };
}

export function advanceCampaign(campaign) {
  if (campaign.missionIndex < MISSIONS.length - 1) {
    campaign.missionIndex += 1;
    return true;
  }
  return false;
}

export function missionBrief(mission) {
  return `${mission.definition.name} — ${mission.definition.brief} Cargo: ${mission.definition.cargo}.`;
}
