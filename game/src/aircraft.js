// aircraft.js — builds the low-poly twin-prop courier plane from
// Three.js primitives and updates it each frame from the flight state.
// No loaded models: fuselage, wings, engines, props, lights and gear are
// all boxes, cylinders, cones and spheres.

import { COLOURS } from './config.js';

function makeMaterial(colour, emissive = 0x000000, emissiveIntensity = 1) {
  return new THREE.MeshStandardMaterial({
    color: colour,
    emissive,
    emissiveIntensity,
    roughness: 0.55,
    metalness: 0.35,
  });
}

function box(width, height, depth, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function cylinder(radiusTop, radiusBottom, height, material, x = 0, y = 0, z = 0, segments = 12) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material,
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

export function buildAircraft() {
  const group = new THREE.Group();
  group.name = 'kelana-9';

  const skin = makeMaterial(COLOURS.fuselage);
  const stripe = makeMaterial(COLOURS.fuselageStripe);
  const wingMat = makeMaterial(COLOURS.wing);
  const darkMat = makeMaterial(0x2c3138);
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9fd8e8, emissive: 0x2a4a5a, emissiveIntensity: 0.4,
    roughness: 0.15, metalness: 0.6,
  });

  // Fuselage: main tube, tapered nose, rounded tail cone.
  const fuselage = cylinder(1.05, 0.85, 7.2, skin, 0, 0, 0, 14);
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.02, 14, 10), skin);
  nose.position.set(0, 0, 3.6);
  nose.scale.set(1, 1, 0.9);
  nose.castShadow = true;
  group.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.2, 12), skin);
  tailCone.rotation.x = -Math.PI / 2;
  tailCone.position.set(0, 0.15, -4.5);
  tailCone.castShadow = true;
  group.add(tailCone);

  // Orange cheatline stripe along the fuselage.
  const cheatline = box(0.06, 0.28, 6.4, stripe, -1.0, -0.1, 0.2);
  group.add(cheatline);
  const cheatlineRight = box(0.06, 0.28, 6.4, stripe, 1.0, -0.1, 0.2);
  group.add(cheatlineRight);

  // Cockpit windows and side windows.
  const windshield = box(1.5, 0.55, 0.25, glassMat, 0, 0.55, 3.1);
  windshield.rotation.x = -0.35;
  group.add(windshield);
  for (let i = 0; i < 3; i += 1) {
    group.add(box(0.05, 0.4, 0.7, glassMat, -1.02, 0.25, 1.6 - i * 1.1));
    group.add(box(0.05, 0.4, 0.7, glassMat, 1.02, 0.25, 1.6 - i * 1.1));
  }

  // Main wing (low wing) and tailplane.
  const wing = box(13.5, 0.22, 2.1, wingMat, 0, -0.35, 0.4);
  group.add(wing);
  const wingTipLeft = box(0.5, 0.3, 1.6, stripe, -6.6, -0.35, 0.4);
  const wingTipRight = box(0.5, 0.3, 1.6, stripe, 6.6, -0.35, 0.4);
  group.add(wingTipLeft);
  group.add(wingTipRight);
  const tailplane = box(4.6, 0.16, 1.3, wingMat, 0, 0.35, -4.9);
  group.add(tailplane);
  const fin = box(0.18, 1.9, 1.5, stripe, 0, 1.1, -5.0);
  group.add(fin);

  // Cargo door on the left side, with a handle.
  const cargoDoor = box(0.06, 1.1, 1.4, wingMat, -1.03, -0.05, -0.6);
  group.add(cargoDoor);
  group.add(box(0.08, 0.08, 0.3, darkMat, -1.06, 0.1, -0.6));

  // Two engines under the wings, each with a spinning propeller.
  const propellers = [];
  [-3.1, 3.1].forEach((x) => {
    const nacelle = cylinder(0.55, 0.55, 2.4, skin, x, -0.35, 0.9, 12);
    nacelle.rotation.x = Math.PI / 2;
    group.add(nacelle);
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 10), stripe);
    spinner.rotation.x = Math.PI / 2;
    spinner.position.set(x, -0.35, 2.35);
    spinner.castShadow = true;
    group.add(spinner);
    const prop = new THREE.Group();
    prop.position.set(x, -0.35, 2.15);
    const bladeMat = makeMaterial(0x1c1f24);
    const bladeA = box(0.18, 2.6, 0.08, bladeMat);
    const bladeB = box(2.6, 0.18, 0.08, bladeMat);
    prop.add(bladeA);
    prop.add(bladeB);
    group.add(prop);
    propellers.push(prop);
  });

  // Navigation lights: red left, green right, white tail.
  const navLights = {
    left: new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
    ),
    right: new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x2aff5a }),
    ),
    tail: new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    ),
  };
  navLights.left.position.set(-6.85, -0.35, 0.4);
  navLights.right.position.set(6.85, -0.35, 0.4);
  navLights.tail.position.set(0, 0.4, -5.6);
  group.add(navLights.left, navLights.right, navLights.tail);

  // Landing light under the nose, switched on at night.
  const landingLight = new THREE.SpotLight(0xfff2c0, 0, 120, 0.35, 0.4, 1.2);
  landingLight.position.set(0, -0.6, 3.2);
  landingLight.target.position.set(0, -6, 40);
  group.add(landingLight);
  group.add(landingLight.target);
  const landingLens = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
  );
  landingLens.position.set(0, -0.6, 3.55);
  group.add(landingLens);

  // Landing gear: nose wheel + two mains, on struts that slide up/down.
  const gearGroup = new THREE.Group();
  gearGroup.name = 'landing-gear';
  const wheelMat = makeMaterial(0x14161a);
  const strutMat = makeMaterial(0x8a8f96);
  const gearLegs = [
    { x: 0, z: 2.4, strutH: 1.1 },
    { x: -1.15, z: -0.2, strutH: 1.0 },
    { x: 1.15, z: -0.2, strutH: 1.0 },
  ];
  gearLegs.forEach(({ x, z, strutH }) => {
    const strut = cylinder(0.09, 0.09, strutH, strutMat, x, -1.0 - strutH / 2 + 0.4, z, 8);
    gearGroup.add(strut);
    const wheel = cylinder(0.34, 0.34, 0.22, wheelMat, x, -1.85, z, 12);
    wheel.rotation.z = Math.PI / 2;
    gearGroup.add(wheel);
  });
  group.add(gearGroup);

  return { group, propellers, navLights, landingLight, landingLens, gearGroup };
}

// Per-frame update: attitude, propellers, gear travel, light blink.
export function updateAircraft(parts, state, dt, elapsed, night) {
  const { group, propellers, navLights, landingLight, landingLens, gearGroup } = parts;
  group.position.set(state.position.x, state.position.y, state.position.z);
  // Three.js rotation order: yaw (heading) then pitch then roll.
  group.rotation.order = 'YXZ';
  // The model is built nose-first along local +Z, while the flight model
  // defines forward as (sin h, 0, -cos h). A plain yaw of `heading` maps
  // local +Z to (sin h, 0, +cos h) — the nose points the wrong way in Z
  // (correct only at heading 90, where cos h = 0). Yawing by PI - heading
  // maps +Z to (sin h, 0, -cos h) = forward, and keeps pitch correct
  // (nose rises with +pitch). That yaw mirrors the local X axis, so the
  // roll sign flips too: +roll now banks the (world) right wing down.
  group.rotation.y = Math.PI - state.heading;
  group.rotation.x = -state.pitch;
  group.rotation.z = state.roll;

  const propSpeed = state.rpm * 28 + state.speed * 0.4;
  propellers.forEach((prop) => {
    prop.rotation.z += propSpeed * dt;
  });

  // Gear slides up into the fuselage when retracted.
  const gearTarget = state.gearDown ? 0 : 1.7;
  gearGroup.position.y += (gearTarget - gearGroup.position.y) * Math.min(1, dt * 3);
  gearGroup.visible = gearGroup.position.y < 1.65;

  // Navigation lights blink gently; landing light is on at night or on approach.
  const blink = Math.sin(elapsed * 2.4) > 0 ? 1 : 0.25;
  navLights.tail.material.color.setHex(blink > 0.5 ? 0xffffff : 0x555555);
  const landingOn = night || (state.gearDown && !state.onGround && state.position.y < 220);
  landingLight.intensity = landingOn ? (night ? 60 : 5) : 0;
  landingLens.material.color.setHex(landingOn ? 0xfff2c0 : 0x444033);
}
