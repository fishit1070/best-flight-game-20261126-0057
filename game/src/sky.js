// sky.js — sky dome gradient, sun disc, drifting cloud sprites, and a
// simple day-phase helper. Golden hour by default; night mode for the
// night mission (mission 3, Malam Berbintang).

import { COLOURS } from './config.js';
import { makeRng } from './random.js';

export const DAY_PHASES = {
  golden: { sunElevation: 14, sunAzimuth: 265, top: 0x2b4a7a, horizon: 0xffb36b, fog: 0xf2a56b, ambient: 0.55 },
  noon: { sunElevation: 62, sunAzimuth: 180, top: 0x3a7bd5, horizon: 0xbfe3ff, fog: 0xcfe8f5, ambient: 0.85 },
  night: { sunElevation: -8, sunAzimuth: 250, top: 0x060a18, horizon: 0x1a2340, fog: 0x0d1428, ambient: 0.18 },
};

function makeCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const rng = makeRng(99);
  // Two passes: broad soft puffs, then smaller bright cores on top, so a
  // cloud reads as a white billow instead of a flat grey smudge.
  for (let pass = 0; pass < 2; pass += 1) {
    const puffs = pass === 0 ? 30 : 16;
    for (let i = 0; i < puffs; i += 1) {
      const x = 40 + rng.range(0, 176);
      const y = 45 + rng.range(0, 40);
      const r = pass === 0 ? rng.range(20, 46) : rng.range(9, 20);
      const alpha = pass === 0 ? 0.75 : 0.95;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, `rgba(255, 252, 246, ${alpha})`);
      gradient.addColorStop(1, 'rgba(255, 252, 246, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export function buildSky(scene, seed, phaseName = 'golden') {
  const phase = DAY_PHASES[phaseName] || DAY_PHASES.golden;
  const group = new THREE.Group();
  group.name = 'sky';

  // Sky dome: a big sphere with a vertical gradient shader, back side in.
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColour: { value: new THREE.Color(phase.top) },
      horizonColour: { value: new THREE.Color(phase.horizon) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 topColour;
      uniform vec3 horizonColour;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        float t = clamp(h * 1.6 + 0.12, 0.0, 1.0);
        gl_FragColor = vec4(mix(horizonColour, topColour, t), 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4200, 24, 16), skyMaterial);
  group.add(dome);

  // Sun disc: a warm glowing circle low on the horizon at golden hour.
  const sunAngle = (phase.sunAzimuth * Math.PI) / 180;
  const sunElev = (phase.sunElevation * Math.PI) / 180;
  const sunDirection = new THREE.Vector3(
    Math.sin(sunAngle) * Math.cos(sunElev),
    Math.sin(sunElev),
    -Math.cos(sunAngle) * Math.cos(sunElev),
  );
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(150, 32),
    new THREE.MeshBasicMaterial({ color: COLOURS.sun, fog: false }),
  );
  sun.position.copy(sunDirection).multiplyScalar(3900);
  sun.lookAt(0, 0, 0);
  group.add(sun);
  // Soft halo around the sun.
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(320, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9a4a, transparent: true, opacity: 0.22, fog: false }),
  );
  halo.position.copy(sunDirection).multiplyScalar(3850);
  halo.lookAt(0, 0, 0);
  group.add(halo);

  // Drifting clouds: billboarded sprites from a canvas texture.
  const cloudTexture = makeCloudTexture();
  const rng = makeRng(seed + 31);
  const clouds = [];
  for (let i = 0; i < 42; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: cloudTexture,
      color: 0xfff8ee,
      transparent: true,
      opacity: rng.range(0.45, 0.85),
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    const angle = rng.range(0, Math.PI * 2);
    const radius = rng.range(400, 2600);
    sprite.position.set(
      Math.cos(angle) * radius,
      rng.range(260, 520),
      Math.sin(angle) * radius,
    );
    const scale = rng.range(220, 520);
    sprite.scale.set(scale, scale * 0.45, 1);
    sprite.userData.driftSpeed = rng.range(1.5, 4.5);
    group.add(sprite);
    clouds.push(sprite);
  }

  // Stars for night mode: tiny points high in the dome, hidden by day.
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i += 1) {
    const angle = rng.range(0, Math.PI * 2);
    const elev = rng.range(0.15, 1.4);
    const r = 4000;
    starPositions[i * 3] = Math.cos(angle) * Math.cos(elev) * r;
    starPositions[i * 3 + 1] = Math.sin(elev) * r;
    starPositions[i * 3 + 2] = Math.sin(angle) * Math.cos(elev) * r;
  }
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: 0xffffff, size: 6, sizeAttenuation: false, transparent: true, opacity: 0 }),
  );
  group.add(stars);

  scene.add(group);
  return { group, dome, skyMaterial, sun, halo, clouds, stars, sunDirection, phase };
}

export function setDayPhase(sky, phaseName) {
  const phase = DAY_PHASES[phaseName] || DAY_PHASES.golden;
  sky.phase = phase;
  sky.skyMaterial.uniforms.topColour.value.setHex(phase.top);
  sky.skyMaterial.uniforms.horizonColour.value.setHex(phase.horizon);
  sky.stars.material.opacity = phaseName === 'night' ? 0.9 : 0;
  sky.sun.visible = phase.sunElevation > 0;
  sky.halo.visible = phase.sunElevation > 0;
  return phase;
}

export function updateSky(sky, dt, elapsed) {
  // Clouds drift slowly eastward and wrap around the world edge.
  for (const cloud of sky.clouds) {
    cloud.position.x += cloud.userData.driftSpeed * dt;
    if (cloud.position.x > 2800) cloud.position.x = -2800;
    cloud.material.opacity = 0.45 + 0.2 * Math.sin(elapsed * 0.3 + cloud.position.z * 0.001);
  }
  // Sun halo breathes gently.
  const breathe = 1 + Math.sin(elapsed * 0.4) * 0.04;
  sky.halo.scale.setScalar(breathe);
}
