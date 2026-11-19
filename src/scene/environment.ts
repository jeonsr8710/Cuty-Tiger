import * as THREE from 'three';
import type { SceneMaterials } from './materials';
import type { ProceduralTextureSet } from './textures';

export interface EnvironmentRig {
  root: THREE.Group;
  skyMaterial: THREE.ShaderMaterial;
  sunDisc: THREE.Mesh;
  update: (delta: number, travelSpeed: number, lateralOffset: number, time: number) => void;
  setSkyColors: (top: THREE.Color, horizon: THREE.Color, bottom: THREE.Color, sunPos: THREE.Vector3) => void;
  dispose: () => void;
}

const LOOP_SPAN = 140; // Road & prop recycling loop length in meters
const HALF_SPAN = LOOP_SPAN * 0.5;

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface PropSlot {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotY: number;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export function createEnvironment(
  materials: SceneMaterials,
  textures: ProceduralTextureSet,
): EnvironmentRig {
  const root = new THREE.Group();
  const rand = seededRand(202611);

  // --- GRADIENT SKY DOME (procedural shader, zero external skybox assets) ---
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTopColor: { value: new THREE.Color('#3b82c4') },
      uHorizonColor: { value: new THREE.Color('#dbeeff') },
      uBottomColor: { value: new THREE.Color('#88a878') },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uTopColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uBottomColor;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y;
        vec3 col = h >= 0.0
          ? mix(uHorizonColor, uTopColor, pow(clamp(h, 0.0, 1.0), 0.58))
          : mix(uHorizonColor, uBottomColor, clamp(-h * 4.0, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(180, 28, 18), skyMaterial);
  root.add(skyDome);

  // Glowing Sun / Moon Disc in sky
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff5cf, fog: false });
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(6.5, 20, 16), sunMat);
  sunDisc.position.set(42, 46, 95);
  root.add(sunDisc);

  // --- EXTENDED MEADOW TERRAIN & SUNLIT PARK BIKE ROAD (No boxed walls!) ---
  const meadowGeo = new THREE.PlaneGeometry(240, 240, 1, 1);
  meadowGeo.rotateX(-Math.PI / 2);
  const meadow = new THREE.Mesh(meadowGeo, materials.grass);
  meadow.position.y = -0.025;
  meadow.receiveShadow = true;
  root.add(meadow);

  // Park cycling path sitting cleanly at y = 0.0 (offset >= 0.02 above meadow to prevent Z-fighting)
  const roadWidth = 4.6;
  const roadGeo = new THREE.PlaneGeometry(roadWidth, 180);
  roadGeo.rotateX(-Math.PI / 2);
  const road = new THREE.Mesh(roadGeo, materials.road);
  road.position.y = 0.0;
  road.receiveShadow = true;
  root.add(road);

  // Stone border curbs flanking the bike lane
  const curbGeo = new THREE.BoxGeometry(0.24, 0.08, 180);
  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(curbGeo, materials.curb);
    curb.position.set(side * (roadWidth * 0.5 + 0.12), 0.02, 0);
    curb.receiveShadow = true;
    curb.castShadow = true;
    root.add(curb);
  }

  // Distant rolling foothills ring around the horizon for natural open-world perimeter
  const hillCount = 16;
  const hillGeo = new THREE.ConeGeometry(28, 18, 7);
  const hillMat = new THREE.MeshStandardMaterial({
    color: 0x5c7d59,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
  });
  const hills = new THREE.InstancedMesh(hillGeo, hillMat, hillCount);
  for (let i = 0; i < hillCount; i++) {
    const angle = (i / hillCount) * Math.PI * 2 + 0.12;
    const dist = 82 + (i % 3) * 14;
    _dummy.position.set(Math.cos(angle) * dist, 6 + (i % 2) * 3, Math.sin(angle) * dist);
    _dummy.rotation.set(0, rand() * Math.PI, 0);
    _dummy.scale.set(1.2 + rand() * 0.9, 0.75 + rand() * 0.85, 1.1 + rand() * 0.8);
    _dummy.updateMatrix();
    hills.setMatrixAt(i, _dummy.matrix);
    _color.setHSL(0.32 + (rand() - 0.5) * 0.05, 0.24, 0.4 + rand() * 0.08);
    hills.setColorAt(i, _color);
  }
  hills.instanceMatrix.needsUpdate = true;
  if (hills.instanceColor) hills.instanceColor.needsUpdate = true;
  hills.computeBoundingSphere();
  root.add(hills);

  // --- SCROLLING INSTANCED ROADSIDE TREES (PINE + SPRING BLOSSOM TREES) ---
  // Composite multi-tier trees using InstancedMesh for crisp silhouettes & high FPS
  const pineCount = 46;
  const pineSlots: PropSlot[] = [];
  for (let i = 0; i < pineCount; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const x = side * (4.4 + rand() * 24);
    const z = -HALF_SPAN + (i / pineCount) * LOOP_SPAN + (rand() - 0.5) * 2.5;
    const s = 0.85 + rand() * 0.45; // ±15%+ organic scale variation
    pineSlots.push({ x, y: -0.02, z, scaleX: s, scaleY: s * (0.92 + rand() * 0.26), scaleZ: s, rotY: rand() * Math.PI * 2 });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.24, 1.6, 8);
  trunkGeo.translate(0, 0.8, 0);
  const pineCone1Geo = new THREE.ConeGeometry(1.15, 2.2, 8);
  pineCone1Geo.translate(0, 2.3, 0);
  const pineCone2Geo = new THREE.ConeGeometry(0.88, 1.9, 8);
  pineCone2Geo.translate(0, 3.45, 0);
  const pineCone3Geo = new THREE.ConeGeometry(0.56, 1.45, 8);
  pineCone3Geo.translate(0, 4.45, 0);

  const pineTrunks = new THREE.InstancedMesh(trunkGeo, materials.treeTrunk, pineCount);
  const pineTier1 = new THREE.InstancedMesh(pineCone1Geo, materials.pineFoliage, pineCount);
  const pineTier2 = new THREE.InstancedMesh(pineCone2Geo, materials.pineFoliage, pineCount);
  const pineTier3 = new THREE.InstancedMesh(pineCone3Geo, materials.pineFoliage, pineCount);

  for (const im of [pineTrunks, pineTier1, pineTier2, pineTier3]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false; // Moves dynamically along Z loop
    root.add(im);
  }

  for (let i = 0; i < pineCount; i++) {
    _color.setHSL(0.35 + (rand() - 0.5) * 0.06, 0.42 + rand() * 0.12, 0.26 + rand() * 0.1);
    pineTier1.setColorAt(i, _color);
    _color.offsetHSL(0.008, 0.02, 0.04);
    pineTier2.setColorAt(i, _color);
    _color.offsetHSL(0.008, 0.02, 0.04);
    pineTier3.setColorAt(i, _color);
  }
  pineTier1.instanceColor!.needsUpdate = true;
  pineTier2.instanceColor!.needsUpdate = true;
  pineTier3.instanceColor!.needsUpdate = true;

  // Blossom / Park Broadleaf Trees closer to the bike lane for warm visual contrast
  const blossomCount = 24;
  const blossomSlots: PropSlot[] = [];
  for (let i = 0; i < blossomCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (3.9 + rand() * 8.5);
    const z = -HALF_SPAN + ((i + 0.5) / blossomCount) * LOOP_SPAN + (rand() - 0.5) * 3.0;
    const s = 0.85 + rand() * 0.32;
    blossomSlots.push({ x, y: -0.02, z, scaleX: s, scaleY: s, scaleZ: s, rotY: rand() * Math.PI * 2 });
  }

  const bTrunkGeo = new THREE.CylinderGeometry(0.11, 0.19, 1.85, 8);
  bTrunkGeo.translate(0, 0.925, 0);
  const bCanopy1Geo = new THREE.DodecahedronGeometry(1.12, 1);
  bCanopy1Geo.translate(0, 2.55, 0);
  const bCanopy2Geo = new THREE.DodecahedronGeometry(0.76, 1);
  bCanopy2Geo.translate(0.62, 2.25, 0.3);
  const bCanopy3Geo = new THREE.DodecahedronGeometry(0.72, 1);
  bCanopy3Geo.translate(-0.55, 2.38, -0.25);

  const bTrunks = new THREE.InstancedMesh(bTrunkGeo, materials.treeTrunk, blossomCount);
  const bCanopy1 = new THREE.InstancedMesh(bCanopy1Geo, materials.blossomFoliage, blossomCount);
  const bCanopy2 = new THREE.InstancedMesh(bCanopy2Geo, materials.blossomFoliage, blossomCount);
  const bCanopy3 = new THREE.InstancedMesh(bCanopy3Geo, materials.blossomFoliage, blossomCount);

  for (const im of [bTrunks, bCanopy1, bCanopy2, bCanopy3]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    root.add(im);
  }

  for (let i = 0; i < blossomCount; i++) {
    // Alternating spring cherry blossom pinks and lush sunlit park greens
    const isBlossom = i % 3 === 0;
    if (isBlossom) {
      _color.setHSL(0.95 + (rand() - 0.5) * 0.03, 0.62, 0.78 + rand() * 0.08);
    } else {
      _color.setHSL(0.27 + (rand() - 0.5) * 0.05, 0.48, 0.42 + rand() * 0.1);
    }
    bCanopy1.setColorAt(i, _color);
    _color.offsetHSL(0, 0, 0.03);
    bCanopy2.setColorAt(i, _color);
    _color.offsetHSL(0, 0, -0.02);
    bCanopy3.setColorAt(i, _color);
  }
  bCanopy1.instanceColor!.needsUpdate = true;
  bCanopy2.instanceColor!.needsUpdate = true;
  bCanopy3.instanceColor!.needsUpdate = true;

  // --- ROADSIDE WOODEN PARK POSTS & BOULDERS ---
  const postCount = 36;
  const postSlots: PropSlot[] = [];
  for (let i = 0; i < postCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -HALF_SPAN + (Math.floor(i / 2) / (postCount / 2)) * LOOP_SPAN;
    postSlots.push({ x: side * 3.1, y: -0.02, z, scaleX: 1, scaleY: 1, scaleZ: 1, rotY: 0 });
  }
  const postGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.88, 8);
  postGeo.translate(0, 0.44, 0);
  const posts = new THREE.InstancedMesh(postGeo, materials.woodFence, postCount);
  posts.castShadow = true;
  posts.receiveShadow = true;
  posts.frustumCulled = false;
  root.add(posts);

  // Roadside rocks
  const rockCount = 26;
  const rockSlots: PropSlot[] = [];
  for (let i = 0; i < rockCount; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const s = 0.45 + rand() * 0.75;
    rockSlots.push({
      x: side * (3.4 + rand() * 14),
      y: -0.04,
      z: -HALF_SPAN + rand() * LOOP_SPAN,
      scaleX: s * (0.9 + rand() * 0.4),
      scaleY: s * (0.55 + rand() * 0.35),
      scaleZ: s * (0.9 + rand() * 0.4),
      rotY: rand() * Math.PI * 2,
    });
  }
  const rockGeo = new THREE.DodecahedronGeometry(0.55, 0);
  rockGeo.translate(0, 0.25, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, materials.rock, rockCount);
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  rocks.frustumCulled = false;
  for (let i = 0; i < rockCount; i++) {
    const l = 0.44 + rand() * 0.16;
    _color.setHSL(0.1, 0.08, l);
    rocks.setColorAt(i, _color);
  }
  rocks.instanceColor!.needsUpdate = true;
  root.add(rocks);

  // --- FLOATING PUFFY CLOUDS IN SKY ---
  const cloudCount = 12;
  const cloudSlots: PropSlot[] = [];
  for (let i = 0; i < cloudCount; i++) {
    cloudSlots.push({
      x: (rand() - 0.5) * 95,
      y: 22 + rand() * 16,
      z: -HALF_SPAN + rand() * LOOP_SPAN,
      scaleX: 2.8 + rand() * 3.2,
      scaleY: 1.2 + rand() * 0.8,
      scaleZ: 1.8 + rand() * 1.8,
      rotY: rand() * Math.PI,
    });
  }
  const cloudGeo = new THREE.IcosahedronGeometry(1.4, 1);
  const clouds = new THREE.InstancedMesh(cloudGeo, materials.cloud, cloudCount);
  clouds.frustumCulled = false;
  root.add(clouds);

  // --- DRIFTING CHERRY BLOSSOM PETALS IN THE BREEZE ---
  const petalCount = 48;
  const petalData = Array.from({ length: petalCount }, () => ({
    x: (rand() - 0.5) * 10,
    y: 0.4 + rand() * 4.5,
    z: (rand() - 0.5) * 28,
    phase: rand() * Math.PI * 2,
    speed: 0.6 + rand() * 0.8,
  }));
  const petalGeo = new THREE.PlaneGeometry(0.075, 0.055);
  const petals = new THREE.InstancedMesh(petalGeo, materials.petal, petalCount);
  petals.frustumCulled = false;
  root.add(petals);

  // --- SOFT CONTACT SHADOW GROUNDING PLANE UNDER THE BICYCLE ---
  const shadowPlaneGeo = new THREE.PlaneGeometry(1.1, 2.35);
  shadowPlaneGeo.rotateX(-Math.PI / 2);
  const contactShadow = new THREE.Mesh(shadowPlaneGeo, materials.contactShadow);
  contactShadow.position.set(0, 0.015, 0); // >= 0.015 above road so zero Z-fighting
  root.add(contactShadow);

  let scrollDistance = 0;

  function syncScrollingGroup(slots: PropSlot[], meshes: THREE.InstancedMesh[], offsetZ: number) {
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      let z = (s.z - offsetZ + HALF_SPAN) % LOOP_SPAN;
      if (z < 0) z += LOOP_SPAN;
      z -= HALF_SPAN;

      _dummy.position.set(s.x, s.y, z);
      _dummy.rotation.set(0, s.rotY, 0);
      _dummy.scale.set(s.scaleX, s.scaleY, s.scaleZ);
      _dummy.updateMatrix();
      for (let m = 0; m < meshes.length; m++) {
        meshes[m].setMatrixAt(i, _dummy.matrix);
      }
    }
    for (let m = 0; m < meshes.length; m++) {
      meshes[m].instanceMatrix.needsUpdate = true;
    }
  }

  // Initial matrix fill
  syncScrollingGroup(pineSlots, [pineTrunks, pineTier1, pineTier2, pineTier3], 0);
  syncScrollingGroup(blossomSlots, [bTrunks, bCanopy1, bCanopy2, bCanopy3], 0);
  syncScrollingGroup(postSlots, [posts], 0);
  syncScrollingGroup(rockSlots, [rocks], 0);
  syncScrollingGroup(cloudSlots, [clouds], 0);

  const update = (delta: number, travelSpeed: number, lateralOffset: number, time: number) => {
    scrollDistance += travelSpeed * delta;

    // Scroll road & grass UVs smoothly backward (-Z) in exact sync with wheel linear travel
    // Road plane length is 180, repeatY is 18 -> 10m per tile (offset so lettering starts right in front of the bike)
    textures.roadMap.offset.y = -((scrollDistance + 2.4) / 10) % 1;
    textures.roadRoughness.offset.y = textures.roadMap.offset.y;
    // Meadow plane length is 240, repeatY is 24 -> 10m per tile
    textures.grassMap.offset.y = -(scrollDistance / 10) % 1;

    // Move roadside props backward as bike rides forward (+Z)
    syncScrollingGroup(pineSlots, [pineTrunks, pineTier1, pineTier2, pineTier3], scrollDistance);
    syncScrollingGroup(blossomSlots, [bTrunks, bCanopy1, bCanopy2, bCanopy3], scrollDistance);
    syncScrollingGroup(postSlots, [posts], scrollDistance);
    syncScrollingGroup(rockSlots, [rocks], scrollDistance);
    syncScrollingGroup(cloudSlots, [clouds], scrollDistance * 0.14);

    // Keep contact shadow centered directly beneath bike's lateral offset
    contactShadow.position.x = lateralOffset;

    // Update fluttering blossom petals drifting past the rider
    for (let i = 0; i < petalCount; i++) {
      const p = petalData[i];
      p.z -= (travelSpeed * 0.95 + 1.1) * delta;
      p.y -= 0.28 * p.speed * delta;
      p.x += Math.sin(time * 1.4 + p.phase) * 0.35 * delta;

      if (p.z < -14 || p.y < 0.08) {
        p.z = 14 + (i % 5) * 1.6;
        p.y = 2.6 + ((i * 0.37) % 2.4);
        p.x = ((i * 1.73) % 9.5) - 4.75;
      }

      _dummy.position.set(p.x, p.y, p.z);
      _dummy.rotation.set(
        time * 1.8 * p.speed + p.phase,
        time * 1.2 + p.phase,
        Math.sin(time * 2 + p.phase) * 0.8,
      );
      _dummy.scale.setScalar(1);
      _dummy.updateMatrix();
      petals.setMatrixAt(i, _dummy.matrix);
    }
    petals.instanceMatrix.needsUpdate = true;
  };

  const setSkyColors = (
    top: THREE.Color,
    horizon: THREE.Color,
    bottom: THREE.Color,
    sunPos: THREE.Vector3,
  ) => {
    skyMaterial.uniforms.uTopColor.value.copy(top);
    skyMaterial.uniforms.uHorizonColor.value.copy(horizon);
    skyMaterial.uniforms.uBottomColor.value.copy(bottom);
    sunDisc.position.copy(sunPos);
  };

  const dispose = () => {
    skyMaterial.dispose();
    sunMat.dispose();
    hillMat.dispose();
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry.dispose();
      }
    });
  };

  return {
    root,
    skyMaterial,
    sunDisc,
    update,
    setSkyColors,
    dispose,
  };
}
