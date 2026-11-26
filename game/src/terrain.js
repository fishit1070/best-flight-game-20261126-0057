// terrain.js — builds the world from a seed: a heightmap island chain
// with a volcanic cone, a runway strip with markings and edge lights at
// each airfield, a small town of lit-window boxes, a lighthouse on a
// point, palm trees, and an animated sea plane. Warm golden-hour style.

import { AIRFIELDS, COLOURS, WORLD } from './config.js';
import { fbmNoise2D, makeRng } from './random.js';

function groundHeightAtFactory(seed) {
  return function groundHeightAt(x, z) {
    // Base rolling hills from fractal noise, shaped into islands by a
    // radial falloff so the archipelago sits in open sea.
    const nx = x / 900;
    const nz = z / 900;
    const hills = fbmNoise2D(nx + 3.7, nz + 8.2, seed, 4);
    const dist = Math.sqrt(x * x + z * z);
    const islandMask = Math.max(0, 1 - dist / 1900);
    let height = hills * 130 * islandMask * islandMask;

    // Volcanic cone near Pulau Api (north-west island).
    const vx = x + 980;
    const vz = z + 1050;
    const vDist = Math.sqrt(vx * vx + vz * vz);
    height += Math.max(0, WORLD.maxTerrainHeight - vDist * 0.55) * 0.9;

    // Flatten the ground under each runway so landings are fair.
    for (const field of AIRFIELDS) {
      const fx = x - field.position.x;
      const fz = z - field.position.z;
      const d = Math.sqrt(fx * fx + fz * fz);
      const radius = field.runwayLength * 0.75;
      if (d < radius) {
        const blend = 0.5 + 0.5 * Math.cos((d / radius) * Math.PI);
        height = height * (1 - blend) + field.elevation * blend;
      }
    }
    if (height < 0.5 && dist > 300) height = 0.4; // beach fringe
    return height;
  };
}

function terrainColour(height, noiseValue) {
  if (height < 2.4) return COLOURS.sand; // thin beach fringe where land meets sea
  if (height > 150) return COLOURS.volcanoRock;
  if (height > 90) return COLOURS.rock;
  if (noiseValue > 0.74) return COLOURS.grassDry;
  return COLOURS.grass;
}

export function buildTerrain(scene, seed) {
  const rng = makeRng(seed);
  const groundHeightAt = groundHeightAtFactory(seed);
  const group = new THREE.Group();
  group.name = 'terrain';

  // --- Heightmap island mesh ---------------------------------------------
  const segments = 120;
  const size = WORLD.size;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colours = new Float32Array(positions.count * 3);
  const colour = new THREE.Color();
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const h = groundHeightAt(x, z);
    positions.setY(i, h);
    const n = fbmNoise2D(x / 300 + 11, z / 300 + 4, seed + 7, 3);
    colour.setHex(terrainColour(h, n));
    // Gentle variation so the ground is not flat-shaded.
    colour.offsetHSL(0, 0, (n - 0.5) * 0.08);
    colours[i * 3] = colour.r;
    colours[i * 3 + 1] = colour.g;
    colours[i * 3 + 2] = colour.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  const terrainMesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }),
  );
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // --- Animated sea plane --------------------------------------------------
  const seaGeometry = new THREE.PlaneGeometry(size * 2.2, size * 2.2, 1, 1);
  seaGeometry.rotateX(-Math.PI / 2);
  const seaMaterial = new THREE.MeshStandardMaterial({
    color: COLOURS.sea, roughness: 0.25, metalness: 0.1,
    transparent: true, opacity: 0.94,
  });
  const sea = new THREE.Mesh(seaGeometry, seaMaterial);
  sea.position.y = WORLD.seaLevel;
  sea.name = 'sea';
  group.add(sea);

  // Sun glitter on the sea: a sparse field of warm points that twinkle
  // and drift slowly, so the water reads alive instead of flat paint.
  const sparkleCount = 420;
  const sparklePositions = new Float32Array(sparkleCount * 3);
  for (let i = 0; i < sparkleCount; i += 1) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(150, 2600);
    sparklePositions[i * 3] = Math.cos(a) * r;
    sparklePositions[i * 3 + 1] = 0.8;
    sparklePositions[i * 3 + 2] = Math.sin(a) * r;
  }
  const sparkleGeometry = new THREE.BufferGeometry();
  sparkleGeometry.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));
  const seaSparkle = new THREE.Points(sparkleGeometry, new THREE.PointsMaterial({
    color: 0xffe9b0, size: 3.5, transparent: true, opacity: 0.55, depthWrite: false,
  }));
  seaSparkle.name = 'sea-sparkle';
  group.add(seaSparkle);

  // --- Runways, markings, edge lights, windsock ---------------------------
  const runwayMat = new THREE.MeshStandardMaterial({ color: COLOURS.runway, roughness: 0.9 });
  const markingMat = new THREE.MeshBasicMaterial({ color: COLOURS.runwayMarking });
  const edgeLights = [];
  for (const field of AIRFIELDS) {
    const fieldGroup = new THREE.Group();
    fieldGroup.position.set(field.position.x, field.elevation + 0.15, field.position.z);
    fieldGroup.rotation.y = ((180 - field.heading) * Math.PI) / 180;
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(field.runwayWidth, 0.3, field.runwayLength),
      runwayMat,
    );
    strip.receiveShadow = true;
    fieldGroup.add(strip);
    // Centreline dashes.
    const dashCount = Math.floor(field.runwayLength / 40);
    for (let i = 0; i < dashCount; i += 1) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 14), markingMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.2, -field.runwayLength / 2 + 20 + i * 40);
      fieldGroup.add(dash);
    }
    // Threshold bars at both ends.
    [-1, 1].forEach((end) => {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(field.runwayWidth - 8, 3), markingMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(0, 0.2, end * (field.runwayLength / 2 - 8));
      fieldGroup.add(bar);
    });
    // Edge lights: small warm spheres, both sides, every 40 m.
    const lightGeo = new THREE.SphereGeometry(0.5, 8, 8);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    for (let d = -field.runwayLength / 2; d <= field.runwayLength / 2; d += 40) {
      [-1, 1].forEach((side) => {
        const light = new THREE.Mesh(lightGeo, lightMat);
        light.position.set(side * (field.runwayWidth / 2 + 2), 0.6, d);
        fieldGroup.add(light);
        edgeLights.push(light);
      });
    }
    // Windsock on a pole beside the runway.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 7, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8d2c2 }),
    );
    pole.position.set(field.runwayWidth / 2 + 8, 3.5, -field.runwayLength / 2 + 20);
    fieldGroup.add(pole);
    const sock = new THREE.Mesh(
      new THREE.ConeGeometry(0.7, 2.6, 8),
      new THREE.MeshStandardMaterial({ color: 0xff7a3a }),
    );
    sock.rotation.z = Math.PI / 2;
    sock.position.set(field.runwayWidth / 2 + 9.4, 6.6, -field.runwayLength / 2 + 20);
    fieldGroup.add(sock);
    group.add(fieldGroup);
  }

  // --- Coastal town near Banda Field ---------------------------------------
  const townGroup = new THREE.Group();
  townGroup.name = 'town';
  const wallMat = new THREE.MeshStandardMaterial({ color: COLOURS.townWall, roughness: 0.9 });
  // Varied warm roof colours across the town instead of one terracotta.
  const roofMats = [0xb3543a, 0xd97a2e, 0x8a5a3a, 0x4a7a6a, 0x9a3a4a].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }),
  );
  const windowMat = new THREE.MeshBasicMaterial({ color: COLOURS.windowLit });
  for (let i = 0; i < 84; i += 1) {
    const w = rng.range(6, 12);
    const d = rng.range(6, 10);
    const h = rng.range(4, 9);
    const house = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    walls.position.y = h / 2;
    walls.castShadow = true;
    house.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 2.6, 4), roofMats[i % roofMats.length]);
    roof.position.y = h + 1.3;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    house.add(roof);
    // Two lit windows facing the street.
    const winA = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3), windowMat);
    winA.position.set(0, h * 0.55, d / 2 + 0.05);
    house.add(winA);
    const winB = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3), windowMat);
    winB.position.set(w / 2 + 0.05, h * 0.55, 0);
    winB.rotation.y = Math.PI / 2;
    house.add(winB);
    const winC = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3), windowMat);
    winC.position.set(-w / 2 - 0.05, h * 0.55, 0);
    winC.rotation.y = -Math.PI / 2;
    house.add(winC);
    const angle = rng.range(0, Math.PI * 2);
    const radius = rng.range(90, 260);
    house.position.set(180 + Math.cos(angle) * radius, 0, 150 + Math.sin(angle) * radius * 0.7);
    house.position.y = groundHeightAt(house.position.x, house.position.z);
    house.rotation.y = rng.range(0, Math.PI * 2);
    townGroup.add(house);
  }
  group.add(townGroup);

  // --- Second hamlet beside Tanjung Strip, under the ring course --------
  const hamletGroup = new THREE.Group();
  hamletGroup.name = 'hamlet';
  for (let i = 0; i < 18; i += 1) {
    const w = rng.range(6, 11);
    const d = rng.range(6, 10);
    const h = rng.range(4, 8);
    const house = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    walls.position.y = h / 2;
    walls.castShadow = true;
    house.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 2.6, 4), roofMats[i % roofMats.length]);
    roof.position.y = h + 1.3;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    house.add(roof);
    const winA = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.3), windowMat);
    winA.position.set(0, h * 0.55, d / 2 + 0.05);
    house.add(winA);
    const angle = rng.range(0, Math.PI * 2);
    const radius = rng.range(30, 150);
    house.position.set(980 + Math.cos(angle) * radius, 0, -620 + Math.sin(angle) * radius);
    house.position.y = groundHeightAt(house.position.x, house.position.z);
    house.rotation.y = rng.range(0, Math.PI * 2);
    hamletGroup.add(house);
  }
  group.add(hamletGroup);

  // --- Dirt roads linking the settlements -------------------------------
  // Flat ribbons of short ground-hugging boxes: town to Banda Field,
  // town to the lighthouse point, hamlet to Tanjung Strip. From the air
  // the settlements read as connected places instead of scattered boxes.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5c, roughness: 1 });
  function buildRoad(points) {
    const road = new THREE.Group();
    for (let i = 0; i < points.length - 1; i += 1) {
      const [x1, z1] = points[i];
      const [x2, z2] = points[i + 1];
      const length = Math.hypot(x2 - x1, z2 - z1);
      const steps = Math.max(1, Math.round(length / 22));
      for (let s = 0; s < steps; s += 1) {
        const mx = x1 + ((x2 - x1) * (s + 0.5)) / steps;
        const mz = z1 + ((z2 - z1) * (s + 0.5)) / steps;
        const seg = new THREE.Mesh(new THREE.BoxGeometry((length / steps) * 1.15, 0.3, 5.5), roadMat);
        seg.position.set(mx, groundHeightAt(mx, mz) + 0.22, mz);
        seg.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
        seg.receiveShadow = true;
        road.add(seg);
      }
    }
    return road;
  }
  group.add(buildRoad([[210, 170], [120, 90], [44, 30]]));
  group.add(buildRoad([[215, 185], [320, 400], [428, 612]]));
  group.add(buildRoad([[975, -615], [1050, -690], [1128, -748]]));

  // --- Lighthouse on the point south-east of Banda -------------------------
  const lighthouse = new THREE.Group();
  lighthouse.name = 'lighthouse';
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 3.2, 22, 12),
    new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.7 }),
  );
  tower.position.y = 11;
  tower.castShadow = true;
  lighthouse.add(tower);
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(2.45, 2.7, 3, 12),
    new THREE.MeshStandardMaterial({ color: 0xd94f30, roughness: 0.7 }),
  );
  band.position.y = 12;
  lighthouse.add(band);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0 }),
  );
  lamp.position.y = 23;
  lighthouse.add(lamp);
  lighthouse.position.set(430, 0, 620);
  lighthouse.position.y = groundHeightAt(430, 620);
  group.add(lighthouse);

  // --- Second, smaller island offshore (north-east) with its own lighthouse
  const islet = new THREE.Group();
  islet.name = 'islet';
  const isletBeach = new THREE.Mesh(
    new THREE.CylinderGeometry(190, 200, 3, 24),
    new THREE.MeshStandardMaterial({ color: COLOURS.sand, roughness: 0.95 }),
  );
  isletBeach.position.y = 0.5;
  islet.add(isletBeach);
  const isletCone = new THREE.Mesh(
    new THREE.ConeGeometry(165, 52, 20),
    new THREE.MeshStandardMaterial({ color: COLOURS.grass, roughness: 0.95 }),
  );
  isletCone.position.y = 26;
  isletCone.castShadow = true;
  islet.add(isletCone);
  const isletTower = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 2.8, 20, 10),
    new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.7 }),
  );
  isletTower.position.y = 62;
  isletTower.castShadow = true;
  islet.add(isletTower);
  const isletBand = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.4, 2.6, 10),
    new THREE.MeshStandardMaterial({ color: 0xd94f30, roughness: 0.7 }),
  );
  isletBand.position.y = 63;
  islet.add(isletBand);
  const secondLamp = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0 }),
  );
  secondLamp.position.y = 73;
  islet.add(secondLamp);
  islet.position.set(1650, 0, -1350);
  group.add(islet);

  // --- Palm trees scattered on the beaches ----------------------------------
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.95 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.9 });
  for (let i = 0; i < 110; i += 1) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 7, 7), trunkMat);
    trunk.position.y = 3.5;
    trunk.rotation.z = rng.range(-0.12, 0.12);
    trunk.castShadow = true;
    palm.add(trunk);
    for (let f = 0; f < 6; f += 1) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.2, 4), frondMat);
      frond.position.y = 7.2;
      frond.rotation.z = 1.1 + rng.range(-0.15, 0.15);
      frond.rotation.y = (f / 6) * Math.PI * 2;
      frond.position.x = Math.cos((f / 6) * Math.PI * 2) * 1.2;
      frond.position.z = Math.sin((f / 6) * Math.PI * 2) * 1.2;
      palm.add(frond);
    }
    const angle = rng.range(0, Math.PI * 2);
    const radius = rng.range(320, 1650);
    const px = Math.cos(angle) * radius;
    const pz = Math.sin(angle) * radius;
    const h = groundHeightAt(px, pz);
    if (h < 1 || h > 60) continue; // palms live on low coastal ground
    palm.position.set(px, h, pz);
    palm.rotation.y = rng.range(0, Math.PI * 2);
    group.add(palm);
  }

  // --- Palm clusters along the coast, near the ring course ----------------
  // Tight groves read from the air where scattered singles do not.
  for (let c = 0; c < 12; c += 1) {
    const cAngle = rng.range(0, Math.PI * 2);
    const cRadius = rng.range(1350, 1750);
    const cx = Math.cos(cAngle) * cRadius;
    const cz = Math.sin(cAngle) * cRadius;
    for (let k = 0; k < 5; k += 1) {
      const px = cx + rng.range(-45, 45);
      const pz = cz + rng.range(-45, 45);
      const h = groundHeightAt(px, pz);
      if (h < 1 || h > 30) continue;
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 7, 7), trunkMat);
      trunk.position.y = 3.5;
      trunk.rotation.z = rng.range(-0.12, 0.12);
      trunk.castShadow = true;
      palm.add(trunk);
      for (let f = 0; f < 6; f += 1) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.2, 4), frondMat);
        frond.position.y = 7.2;
        frond.rotation.z = 1.1 + rng.range(-0.15, 0.15);
        frond.rotation.y = (f / 6) * Math.PI * 2;
        frond.position.x = Math.cos((f / 6) * Math.PI * 2) * 1.2;
        frond.position.z = Math.sin((f / 6) * Math.PI * 2) * 1.2;
        palm.add(frond);
      }
      palm.position.set(px, h, pz);
      palm.rotation.y = rng.range(0, Math.PI * 2);
      group.add(palm);
    }
  }

  // --- Inland trees: instanced trunk + canopy pairs over the lowlands,
  // so the island reads wooded from altitude instead of bare grass.
  {
    const treeCount = 850;
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 3.2, 6);
    trunkGeo.translate(0, 1.6, 0);
    const canopyGeo = new THREE.ConeGeometry(3.4, 8.5, 7);
    canopyGeo.translate(0, 7.2, 0);
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const canopyMesh = new THREE.InstancedMesh(canopyGeo, frondMat, treeCount);
    const dummy = new THREE.Object3D();
    let placedTrees = 0;
    for (let i = 0; i < treeCount * 3 && placedTrees < treeCount; i += 1) {
      const angle = rng.range(0, Math.PI * 2);
      const radius = rng.range(60, 1750);
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius;
      const th = groundHeightAt(tx, tz);
      if (th < 3 || th > 95) continue;
      let clear = true;
      for (const field of AIRFIELDS) {
        const d = Math.hypot(tx - field.position.x, tz - field.position.z);
        if (d < field.runwayLength * 0.85) { clear = false; break; }
      }
      if (!clear) continue;
      dummy.position.set(tx, th - 0.2, tz);
      dummy.rotation.set(0, rng.range(0, Math.PI * 2), 0);
      const sc = rng.range(0.8, 1.7);
      dummy.scale.set(sc, sc * rng.range(0.9, 1.25), sc);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(placedTrees, dummy.matrix);
      canopyMesh.setMatrixAt(placedTrees, dummy.matrix);
      placedTrees += 1;
    }
    trunkMesh.count = placedTrees;
    canopyMesh.count = placedTrees;
    group.add(trunkMesh);
    group.add(canopyMesh);
  }

  // --- Fishing boats: hull, mast and a pale sail, anchored around the
  // offshore islet and in the far roadsteads so the sea reads used.
  const boatHullMats = [0xf5f2e8, 0xd94f30, 0x3a7bd5, 0xffb347].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }),
  );
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.9, side: THREE.DoubleSide });
  function buildBoat(hullMat) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.7, 2.8), hullMat);
    hull.position.y = 0.7;
    boat.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.6, 4), hullMat);
    bow.rotation.z = -Math.PI / 2;
    bow.rotation.y = Math.PI / 4;
    bow.position.set(4.9, 0.7, 0);
    boat.add(bow);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6.5, 6), trunkMat);
    mast.position.y = 3.8;
    boat.add(mast);
    const sail = new THREE.Mesh(new THREE.ConeGeometry(2.3, 5.2, 4), sailMat);
    sail.scale.z = 0.22;
    sail.position.set(0.4, 3.6, 0);
    boat.add(sail);
    return boat;
  }
  const boatSpots = [];
  for (let i = 0; i < 7; i += 1) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(300, 520);
    boatSpots.push([1650 + Math.cos(a) * r, -1350 + Math.sin(a) * r]);
  }
  for (let i = 0; i < 9; i += 1) {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(2200, 2600);
    boatSpots.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  boatSpots.forEach(([bx, bz], i) => {
    const boat = buildBoat(boatHullMats[i % boatHullMats.length]);
    boat.position.set(bx, 0.35, bz);
    boat.rotation.y = rng.range(0, Math.PI * 2);
    group.add(boat);
  });

  scene.add(group);
  return { group, sea, edgeLights, lighthouseLamp: lamp, seaSparkle, secondLamp, groundHeightAt };
}

export function updateTerrain(built, elapsed) {
  // Gentle sea swell: the sea plane bobs and tilts almost imperceptibly.
  built.sea.position.y = WORLD.seaLevel + Math.sin(elapsed * 0.5) * 0.25;
  built.sea.rotation.z = Math.sin(elapsed * 0.22) * 0.004;
  // Lighthouse lamp pulses slowly.
  const pulse = 0.6 + 0.4 * Math.sin(elapsed * 1.4);
  built.lighthouseLamp.material.color.setHex(0xffe9a0);
  built.lighthouseLamp.scale.setScalar(0.9 + pulse * 0.25);
  if (built.secondLamp) {
    built.secondLamp.scale.setScalar(0.9 + (0.6 + 0.4 * Math.sin(elapsed * 1.4 + 2)) * 0.25);
  }
  // Sea glitter twinkles and drifts almost imperceptibly.
  if (built.seaSparkle) {
    built.seaSparkle.material.opacity = 0.4 + 0.25 * Math.sin(elapsed * 1.3);
    built.seaSparkle.rotation.y = elapsed * 0.008;
  }
}
