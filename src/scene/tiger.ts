import * as THREE from 'three';
import type { SceneMaterials } from './materials';

export interface TigerRig {
  root: THREE.Group;
  headGroup: THREE.Group;
  update: (
    time: number,
    speed: number,
    crankAngle: number,
    steerAngle: number,
    bellExcitement: number,
    leftPedalLocal: THREE.Vector3,
    rightPedalLocal: THREE.Vector3,
    leftGripLocal: THREE.Vector3,
    rightGripLocal: THREE.Vector3,
  ) => void;
  dispose: () => void;
}

interface TwoBoneLimb {
  upper: THREE.Group;
  lower: THREE.Group;
  paw: THREE.Group;
  hipOffset: THREE.Vector3;
  upperLen: number;
  lowerLen: number;
  bendDir: THREE.Vector3;
}

// Reusable scratch vectors (zero GC in render loop)
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();
const _vD = new THREE.Vector3();
const _vE = new THREE.Vector3();
const _yDown = new THREE.Vector3(0, -1, 0);
const _quatTmp = new THREE.Quaternion();

/**
 * Analytic 2-bone Inverse Kinematics solver.
 * Places `upper` at `origin`, bends the joint toward `poleDir`, and reaches `target`.
 */
function solveTwoBoneIK(
  limb: TwoBoneLimb,
  origin: THREE.Vector3,
  target: THREE.Vector3,
  poleDir: THREE.Vector3,
) {
  const L1 = limb.upperLen;
  const L2 = limb.lowerLen;

  _vA.subVectors(target, origin);
  let dist = _vA.length();
  const minDist = Math.abs(L1 - L2) + 0.03;
  const maxDist = L1 + L2 - 0.012;
  dist = THREE.MathUtils.clamp(dist, minDist, maxDist);

  // Unit vector from origin to target
  _vB.copy(_vA).normalize();

  // Compute bend plane normal perpendicular to both target direction and pole direction
  _vC.copy(poleDir).addScaledVector(_vB, -poleDir.dot(_vB));
  if (_vC.lengthSq() < 1e-6) {
    _vC.set(0, 0, 1);
  } else {
    _vC.normalize();
  }

  // Law of cosines for shoulder/hip angle
  const cosAngle = THREE.MathUtils.clamp(
    (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist),
    -1,
    1,
  );
  const sinAngle = Math.sqrt(Math.max(0, 1 - cosAngle * cosAngle));

  // Joint (knee/elbow) position in parent space
  _vD
    .copy(origin)
    .addScaledVector(_vB, L1 * cosAngle)
    .addScaledVector(_vC, L1 * sinAngle);

  // Orient upper segment from origin -> joint
  limb.upper.position.copy(origin);
  _vE.subVectors(_vD, origin).normalize();
  _quatTmp.setFromUnitVectors(_yDown, _vE);
  limb.upper.quaternion.copy(_quatTmp);

  // Orient lower segment from joint -> target
  limb.lower.position.copy(_vD);
  _vE.subVectors(target, _vD).normalize();
  _quatTmp.setFromUnitVectors(_yDown, _vE);
  limb.lower.quaternion.copy(_quatTmp);

  // Place paw at exact target
  limb.paw.position.copy(target);
}

function createPawMesh(
  materials: SceneMaterials,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
  isHindFoot: boolean,
): THREE.Group {
  const paw = new THREE.Group();

  const mainGeo = new THREE.SphereGeometry(0.072, 14, 12);
  mainGeo.scale(scaleX, scaleY, scaleZ);
  const main = new THREE.Mesh(mainGeo, materials.tigerCream);
  main.position.set(0, isHindFoot ? 0.035 : 0.0, isHindFoot ? 0.03 : 0.0);
  main.castShadow = true;
  paw.add(main);

  // Three cute feline toes at front of paw
  const toeGeo = new THREE.SphereGeometry(0.026, 10, 8);
  for (let i = -1; i <= 1; i++) {
    const toe = new THREE.Mesh(toeGeo, materials.tigerCream);
    toe.position.set(
      i * 0.034 * scaleX,
      isHindFoot ? 0.025 : -0.012,
      (isHindFoot ? 0.088 : 0.045) + (i === 0 ? 0.012 : 0),
    );
    toe.scale.set(0.9, 0.78, 1.15);
    paw.add(toe);
  }

  // Dark paw pad underneath
  const padGeo = new THREE.SphereGeometry(0.045, 10, 8);
  padGeo.scale(scaleX * 0.85, 0.35, scaleZ * 0.85);
  const pad = new THREE.Mesh(padGeo, materials.tigerPad);
  pad.position.set(0, isHindFoot ? 0.008 : -0.028, isHindFoot ? 0.025 : 0);
  paw.add(pad);

  return paw;
}

function createLimbSegment(
  radiusTop: number,
  radiusBot: number,
  length: number,
  material: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();

  // Tapered limb along -Y from 0 to -length
  const shaftGeo = new THREE.CylinderGeometry(radiusTop, radiusBot, length, 14);
  const shaft = new THREE.Mesh(shaftGeo, material);
  shaft.position.y = -length * 0.5;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  // Rounded joint cap at top & bottom for seamless organic articulation
  const topCap = new THREE.Mesh(new THREE.SphereGeometry(radiusTop * 1.02, 12, 10), material);
  topCap.castShadow = true;
  group.add(topCap);

  const botCap = new THREE.Mesh(new THREE.SphereGeometry(radiusBot * 1.02, 12, 10), material);
  botCap.position.y = -length;
  botCap.castShadow = true;
  group.add(botCap);

  return group;
}

export function createTiger(materials: SceneMaterials): TigerRig {
  const root = new THREE.Group();

  // --- PELVIS & TORSO (seated snugly on bicycle saddle around y = 1.10, z = -0.30) ---
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, 1.11, -0.3);
  root.add(pelvisGroup);

  const pelvisMeshGeo = new THREE.SphereGeometry(0.215, 20, 16);
  pelvisMeshGeo.scale(1.06, 0.9, 1.08);
  const pelvisMesh = new THREE.Mesh(pelvisMeshGeo, materials.tigerFur);
  pelvisMesh.castShadow = true;
  pelvisMesh.receiveShadow = true;
  pelvisGroup.add(pelvisMesh);

  // Torso pivots from pelvis, leaned forward in natural relaxed cycling posture
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.08, 0.02);
  torsoPivot.rotation.x = 0.28; // ~16 deg forward lean
  pelvisGroup.add(torsoPivot);

  // Sculpted tiger ribcage & muscular chest
  const torsoGeo = new THREE.CapsuleGeometry(0.21, 0.34, 14, 20);
  torsoGeo.scale(1.04, 1.0, 0.94);
  const torsoMesh = new THREE.Mesh(torsoGeo, materials.tigerFur);
  torsoMesh.position.set(0, 0.24, 0);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torsoPivot.add(torsoMesh);

  // Soft cream belly & chest fur patch
  const bellyGeo = new THREE.SphereGeometry(0.185, 18, 14);
  bellyGeo.scale(0.86, 1.38, 0.65);
  const bellyMesh = new THREE.Mesh(bellyGeo, materials.tigerCream);
  bellyMesh.position.set(0, 0.23, 0.115);
  bellyMesh.castShadow = true;
  torsoPivot.add(bellyMesh);

  // Upper chest mane ruff
  const chestFluffGeo = new THREE.SphereGeometry(0.145, 16, 12);
  chestFluffGeo.scale(1.05, 0.78, 0.72);
  const chestFluff = new THREE.Mesh(chestFluffGeo, materials.tigerCream);
  chestFluff.position.set(0, 0.44, 0.12);
  torsoPivot.add(chestFluff);

  // --- KNITTED STRIPED SCARF AROUND NECK + FLUTTERING TAILS ---
  const scarfCollarGeo = new THREE.TorusGeometry(0.165, 0.052, 12, 24);
  scarfCollarGeo.rotateX(Math.PI / 2);
  const scarfCollar = new THREE.Mesh(scarfCollarGeo, materials.scarf);
  scarfCollar.position.set(0, 0.51, 0.02);
  scarfCollar.castShadow = true;
  torsoPivot.add(scarfCollar);

  // Dynamic fluttering scarf ribbon (segmented chain)
  const scarfSegments: THREE.Group[] = [];
  let scarfParent: THREE.Object3D = torsoPivot;
  const scarfSegLen = 0.12;
  for (let i = 0; i < 6; i++) {
    const segGroup = new THREE.Group();
    if (i === 0) {
      segGroup.position.set(0.08, 0.49, -0.14);
    } else {
      segGroup.position.set(0, 0, -scarfSegLen);
    }
    const width = 0.095 + i * 0.006;
    const ribbonGeo = new THREE.BoxGeometry(width, 0.018, scarfSegLen + 0.015);
    const ribbon = new THREE.Mesh(ribbonGeo, materials.scarf);
    ribbon.position.set(0, 0, -scarfSegLen * 0.5);
    ribbon.castShadow = true;
    segGroup.add(ribbon);

    // Fringe tassels on the last scarf segment
    if (i === 5) {
      for (let t = -2; t <= 2; t++) {
        const tassel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.006, 0.005, 0.05, 6),
          materials.tigerCream,
        );
        tassel.rotation.x = Math.PI / 2;
        tassel.position.set(t * 0.022, 0, -scarfSegLen - 0.02);
        segGroup.add(tassel);
      }
    }

    scarfParent.add(segGroup);
    scarfSegments.push(segGroup);
    scarfParent = segGroup;
  }

  // --- EXPRESSIVE TIGER HEAD ---
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.65, 0.04);
  headGroup.rotation.x = -0.22; // Counter-tilt forward lean so tiger looks ahead down the road
  torsoPivot.add(headGroup);

  // Main cranium
  const skullGeo = new THREE.SphereGeometry(0.225, 24, 20);
  skullGeo.scale(1.06, 0.96, 1.02);
  const skull = new THREE.Mesh(skullGeo, materials.tigerHeadFur);
  skull.castShadow = true;
  skull.receiveShadow = true;
  headGroup.add(skull);

  // Fluffy striped/cream cheek ruffs on both sides of the face (classic iconic tiger silhouette!)
  for (const side of [-1, 1]) {
    const ruffGeo = new THREE.SphereGeometry(0.115, 16, 12);
    ruffGeo.scale(0.95, 0.72, 0.8);
    const ruff = new THREE.Mesh(ruffGeo, materials.tigerCream);
    ruff.position.set(side * 0.185, -0.045, 0.055);
    ruff.rotation.z = side * -0.22;
    ruff.castShadow = true;
    headGroup.add(ruff);

    // Secondary lower cheek tuft
    const ruff2 = new THREE.Mesh(
      new THREE.ConeGeometry(0.068, 0.11, 10),
      materials.tigerCream,
    );
    ruff2.position.set(side * 0.235, -0.075, 0.02);
    ruff2.rotation.z = side * -1.35;
    ruff2.rotation.y = side * -0.25;
    headGroup.add(ruff2);
  }

  // Iconic forehead 王 (King) dark markings embossed slightly on brow
  const browCenter = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.012, 0.095, 6, 8),
    materials.tigerDarkStripe,
  );
  browCenter.position.set(0, 0.115, 0.205);
  browCenter.rotation.x = -0.35;
  headGroup.add(browCenter);

  for (let row = 0; row < 3; row++) {
    const barW = row === 1 ? 0.095 : 0.078;
    const bar = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.01, barW, 5, 8),
      materials.tigerDarkStripe,
    );
    bar.rotation.z = Math.PI / 2;
    const yOff = 0.078 + row * 0.038;
    const zOff = 0.214 - row * 0.015;
    bar.position.set(0, yOff, zOff);
    headGroup.add(bar);
  }

  // Nose bridge
  const bridgeGeo = new THREE.BoxGeometry(0.095, 0.07, 0.12);
  const bridge = new THREE.Mesh(bridgeGeo, materials.tigerFur);
  bridge.position.set(0, 0.01, 0.195);
  bridge.rotation.x = 0.25;
  headGroup.add(bridge);

  // Prominent cream muzzle whisker pads (left & right puffs)
  for (const side of [-1, 1]) {
    const puffGeo = new THREE.SphereGeometry(0.076, 16, 12);
    puffGeo.scale(1.08, 0.88, 1.0);
    const puff = new THREE.Mesh(puffGeo, materials.tigerCream);
    puff.position.set(side * 0.056, -0.058, 0.215);
    puff.castShadow = true;
    headGroup.add(puff);

    // 3 crisp white whiskers per cheek
    for (let w = 0; w < 3; w++) {
      const wCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.09, -0.045 - w * 0.018, 0.235),
        new THREE.Vector3(side * 0.19, -0.042 - w * 0.025, 0.225),
        new THREE.Vector3(side * 0.28, -0.056 - w * 0.032, 0.19),
      ]);
      const whisker = new THREE.Mesh(
        new THREE.TubeGeometry(wCurve, 8, 0.0038, 5, false),
        materials.tigerWhisker,
      );
      headGroup.add(whisker);
    }
  }

  // Glossy dark feline nose
  const noseGeo = new THREE.SphereGeometry(0.044, 14, 12);
  noseGeo.scale(1.25, 0.82, 0.82);
  const nose = new THREE.Mesh(noseGeo, materials.tigerNose);
  nose.position.set(0, -0.018, 0.268);
  headGroup.add(nose);

  // Joyful lower jaw / chin with cheerful open smile
  const jawGroup = new THREE.Group();
  jawGroup.position.set(0, -0.108, 0.195);
  headGroup.add(jawGroup);

  const chinGeo = new THREE.SphereGeometry(0.068, 14, 10);
  chinGeo.scale(1.08, 0.72, 0.95);
  const chin = new THREE.Mesh(chinGeo, materials.tigerCream);
  jawGroup.add(chin);

  // Cute pink tongue peeking inside cheerful smile
  const tongueGeo = new THREE.SphereGeometry(0.038, 12, 8);
  tongueGeo.scale(1.1, 0.45, 1.0);
  const tongue = new THREE.Mesh(tongueGeo, materials.tigerEarInner);
  tongue.position.set(0, 0.026, 0.02);
  jawGroup.add(tongue);

  // Eyes with amber iris, vertical feline pupil, glossy catchlight, and animated eyelids
  const leftEyelid = new THREE.Group();
  const rightEyelid = new THREE.Group();

  for (const side of [-1, 1]) {
    const eyeSocket = new THREE.Group();
    eyeSocket.position.set(side * 0.094, 0.036, 0.196);
    eyeSocket.rotation.y = side * 0.26;
    headGroup.add(eyeSocket);

    // Cream eyebrow highlight spot above eye (real tigers have distinct white brow spots!)
    const browSpot = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 10, 8),
      materials.tigerCream,
    );
    browSpot.scale.set(1.25, 0.62, 0.5);
    browSpot.position.set(0, 0.056, 0.008);
    eyeSocket.add(browSpot);

    // Dark feline eyeliner ring
    const liner = new THREE.Mesh(
      new THREE.SphereGeometry(0.044, 16, 12),
      materials.tigerDarkStripe,
    );
    liner.scale.set(1.06, 1.02, 0.65);
    eyeSocket.add(liner);

    // Glossy amber iris
    const iris = new THREE.Mesh(
      new THREE.SphereGeometry(0.039, 16, 12),
      materials.tigerEyeAmber,
    );
    iris.scale.set(1.02, 0.98, 0.65);
    iris.position.z = 0.008;
    eyeSocket.add(iris);

    // Dark pupil
    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.021, 12, 10),
      materials.tigerPupil,
    );
    pupil.scale.set(0.75, 1.15, 0.55);
    pupil.position.z = 0.026;
    eyeSocket.add(pupil);

    // Crisp white specular glint dot
    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.009, 8, 8),
      materials.tigerWhisker,
    );
    glint.position.set(side * 0.012, 0.014, 0.036);
    eyeSocket.add(glint);

    // Blinking upper eyelid hemisphere
    const lidPivot = side > 0 ? leftEyelid : rightEyelid;
    const lidMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.046, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      materials.tigerFur,
    );
    lidMesh.scale.set(1.08, 1.05, 0.72);
    lidMesh.rotation.x = -Math.PI * 0.5;
    lidPivot.add(lidMesh);
    lidPivot.rotation.x = -0.15; // open
    eyeSocket.add(lidPivot);
  }

  // Rounded Feline Ears (with pink interior and iconic white back-ear spots!)
  const leftEarPivot = new THREE.Group();
  const rightEarPivot = new THREE.Group();

  for (const side of [-1, 1]) {
    const earPivot = side > 0 ? leftEarPivot : rightEarPivot;
    earPivot.position.set(side * 0.165, 0.175, -0.01);
    earPivot.rotation.z = side * -0.42;
    earPivot.rotation.y = side * 0.22;
    headGroup.add(earPivot);

    const outerEar = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 14, 12),
      materials.tigerDarkStripe,
    );
    outerEar.scale.set(0.95, 1.05, 0.55);
    outerEar.castShadow = true;
    earPivot.add(outerEar);

    const innerEar = new THREE.Mesh(
      new THREE.SphereGeometry(0.048, 12, 10),
      materials.tigerEarInner,
    );
    innerEar.scale.set(0.88, 0.96, 0.4);
    innerEar.position.set(0, -0.005, 0.024);
    earPivot.add(innerEar);

    // Authentic tiger white ocelli spot on the back of each dark ear
    const backSpot = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 10, 8),
      materials.tigerCream,
    );
    backSpot.scale.set(0.9, 0.9, 0.35);
    backSpot.position.set(0, 0.005, -0.034);
    earPivot.add(backSpot);
  }

  // --- ARTICULATED STRIPED TAIL (6 chained segments flowing behind saddle) ---
  const tailSegments: THREE.Group[] = [];
  let tailParent: THREE.Object3D = pelvisGroup;
  const tailSegLen = 0.155;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Group();
    if (i === 0) {
      seg.position.set(0, -0.02, -0.19);
    } else {
      seg.position.set(0, 0, -tailSegLen);
    }

    const rTop = 0.044 - i * 0.003;
    const rBot = 0.041 - i * 0.003;
    const cylGeo = new THREE.CylinderGeometry(rBot, rTop, tailSegLen + 0.02, 12);
    cylGeo.rotateX(Math.PI / 2);
    const mat = i % 2 === 0 ? materials.tigerFur : materials.tigerDarkStripe;
    const mesh = new THREE.Mesh(cylGeo, i === 5 ? materials.tigerDarkStripe : mat);
    mesh.position.z = -tailSegLen * 0.5;
    mesh.castShadow = true;
    seg.add(mesh);

    if (i === 5) {
      const tip = new THREE.Mesh(new THREE.SphereGeometry(rBot * 1.15, 10, 8), materials.tigerDarkStripe);
      tip.position.z = -tailSegLen;
      seg.add(tip);
    }

    tailParent.add(seg);
    tailSegments.push(seg);
    tailParent = seg;
  }

  // --- TWO-BONE IK LIMBS (ARMS GRIPPING HANDLEBARS + HIND LEGS PEDALING!) ---
  function createTwoBoneLimb(
    hipOffset: THREE.Vector3,
    upperLen: number,
    lowerLen: number,
    rUpperTop: number,
    rUpperBot: number,
    rLowerBot: number,
    bendDir: THREE.Vector3,
    isHindLeg: boolean,
  ): TwoBoneLimb {
    const upper = createLimbSegment(rUpperTop, rUpperBot, upperLen, materials.tigerFur);
    const lower = createLimbSegment(rUpperBot * 0.94, rLowerBot, lowerLen, materials.tigerFur);
    const paw = createPawMesh(
      materials,
      isHindLeg ? 0.98 : 0.88,
      isHindLeg ? 0.65 : 0.78,
      isHindLeg ? 1.48 : 1.0,
      isHindLeg,
    );

    root.add(upper);
    root.add(lower);
    root.add(paw);

    return { upper, lower, paw, hipOffset, upperLen, lowerLen, bendDir };
  }

  // Hind legs: hip -> knee -> pedal paw (thigh 0.52, shin 0.51 = 1.03 reach)
  const leftLeg = createTwoBoneLimb(
    new THREE.Vector3(0.165, 1.06, -0.27),
    0.52,
    0.51,
    0.095,
    0.072,
    0.052,
    new THREE.Vector3(0.28, 0.08, 1.0).normalize(), // Knees bend forward & slightly outward!
    true,
  );
  const rightLeg = createTwoBoneLimb(
    new THREE.Vector3(-0.165, 1.06, -0.27),
    0.52,
    0.51,
    0.095,
    0.072,
    0.052,
    new THREE.Vector3(-0.28, 0.08, 1.0).normalize(),
    true,
  );

  // Front arms: shoulder -> elbow -> handlebar grip paw (upper 0.30, forearm 0.29)
  const leftArm = createTwoBoneLimb(
    new THREE.Vector3(0.22, 1.54, -0.14),
    0.3,
    0.29,
    0.074,
    0.058,
    0.048,
    new THREE.Vector3(0.55, -0.75, -0.35).normalize(), // Elbows relax slightly out and down
    false,
  );
  const rightArm = createTwoBoneLimb(
    new THREE.Vector3(-0.22, 1.54, -0.14),
    0.3,
    0.29,
    0.074,
    0.058,
    0.048,
    new THREE.Vector3(-0.55, -0.75, -0.35).normalize(),
    false,
  );

  // Shoulder anchor dummies mounted on torsoPivot so arms follow torso breathing/sway naturally
  const leftShoulderAnchor = new THREE.Object3D();
  leftShoulderAnchor.position.set(0.21, 0.42, 0.02);
  torsoPivot.add(leftShoulderAnchor);

  const rightShoulderAnchor = new THREE.Object3D();
  rightShoulderAnchor.position.set(-0.21, 0.42, 0.02);
  torsoPivot.add(rightShoulderAnchor);

  const _hipL = new THREE.Vector3();
  const _hipR = new THREE.Vector3();
  const _shL = new THREE.Vector3();
  const _shR = new THREE.Vector3();
  const _invRoot = new THREE.Matrix4();

  const update = (
    time: number,
    speed: number,
    crankAngle: number,
    steerAngle: number,
    bellExcitement: number,
    leftPedalLocal: THREE.Vector3,
    rightPedalLocal: THREE.Vector3,
    leftGripLocal: THREE.Vector3,
    rightGripLocal: THREE.Vector3,
  ) => {
    const cadenceFactor = Math.min(speed, 2.2);

    // Subtle organic pedaling hip rock & torso bob
    const hipRock = Math.sin(crankAngle) * 0.042 * Math.min(1, cadenceFactor + 0.2);
    const hipBob = Math.abs(Math.sin(crankAngle)) * 0.018 * Math.min(1, cadenceFactor);
    pelvisGroup.position.y = 1.11 + hipBob;
    pelvisGroup.rotation.z = hipRock;

    // Torso counter-sway + breathing + happy bounce when ringing bell
    const breath = Math.sin(time * 2.6) * 0.018;
    torsoPivot.rotation.x = 0.28 + breath - bellExcitement * 0.08;
    torsoPivot.rotation.y = steerAngle * 0.35 + Math.sin(crankAngle) * 0.03 * Math.min(1, cadenceFactor);
    torsoPivot.rotation.z = -hipRock * 0.6;

    // Expressive head look-ahead, cheerful bob, ear twitch & natural blinking
    const lookAround = Math.sin(time * 0.65) * 0.14;
    headGroup.rotation.y = steerAngle * 0.55 + lookAround;
    headGroup.rotation.x =
      -0.22 +
      Math.sin(crankAngle * 2) * 0.025 * Math.min(1, cadenceFactor) -
      bellExcitement * 0.14;
    headGroup.rotation.z = Math.sin(time * 1.1) * 0.05 + steerAngle * 0.15;

    // Joyful jaw grin opens slightly wider when bell rings or cruising fast
    jawGroup.rotation.x = 0.06 + bellExcitement * 0.24 + Math.sin(time * 4.5) * 0.025;

    // Ears perk up attentively when ringing bell or wind increases
    const earTwitch = Math.sin(time * 3.1) * 0.04 + bellExcitement * 0.22;
    leftEarPivot.rotation.z = -0.42 + earTwitch;
    rightEarPivot.rotation.z = 0.42 - earTwitch;

    // Periodic feline blink (~every 3.8 seconds)
    const blinkCycle = time % 3.8;
    const blinkAmount =
      blinkCycle > 3.64 ? Math.sin(((blinkCycle - 3.64) / 0.16) * Math.PI) : 0;
    const lidAngle = -0.18 + blinkAmount * 1.48;
    leftEyelid.rotation.x = lidAngle;
    rightEyelid.rotation.x = lidAngle;

    // Fluttering scarf waves faster with cycling speed
    const windFreq = 4.2 + cadenceFactor * 6.5;
    const windAmp = 0.08 + cadenceFactor * 0.13;
    for (let i = 0; i < scarfSegments.length; i++) {
      const seg = scarfSegments[i];
      const phase = time * windFreq - i * 0.72;
      if (i === 0) {
        seg.rotation.x = -0.35 + cadenceFactor * 0.28 + Math.sin(phase) * windAmp * 0.4;
        seg.rotation.y = 0.18 + Math.cos(phase * 0.7) * windAmp * 0.7;
      } else {
        seg.rotation.x = Math.sin(phase) * windAmp * (0.7 + i * 0.14);
        seg.rotation.y = Math.cos(phase * 0.85) * windAmp * (0.65 + i * 0.12);
      }
    }

    // Rhythmic S-curve striped tail wave
    const tailFreq = 2.4 + cadenceFactor * 2.2;
    for (let i = 0; i < tailSegments.length; i++) {
      const seg = tailSegments[i];
      const phase = time * tailFreq - i * 0.55;
      if (i === 0) {
        seg.rotation.x = 0.28 + Math.sin(phase * 0.5) * 0.06;
        seg.rotation.y = Math.sin(phase) * 0.22;
      } else {
        seg.rotation.x = 0.14 + Math.cos(phase * 0.6) * 0.06;
        seg.rotation.y = Math.sin(phase) * (0.18 + i * 0.03);
      }
    }

    // Compute exact shoulder world->root coordinates so arms remain firmly connected
    root.updateMatrixWorld(true);
    _invRoot.copy(root.matrixWorld).invert();

    leftShoulderAnchor.getWorldPosition(_shL).applyMatrix4(_invRoot);
    rightShoulderAnchor.getWorldPosition(_shR).applyMatrix4(_invRoot);

    _hipL.copy(leftLeg.hipOffset);
    _hipL.y += hipBob + hipRock * 0.14;
    _hipR.copy(rightLeg.hipOffset);
    _hipR.y += hipBob - hipRock * 0.14;

    // Solve 2-bone IK for legs onto moving pedals and arms onto steerable handlebar grips
    solveTwoBoneIK(leftLeg, _hipL, leftPedalLocal, leftLeg.bendDir);
    solveTwoBoneIK(rightLeg, _hipR, rightPedalLocal, rightLeg.bendDir);
    solveTwoBoneIK(leftArm, _shL, leftGripLocal, leftArm.bendDir);
    solveTwoBoneIK(rightArm, _shR, rightGripLocal, rightArm.bendDir);

    // Keep hind paws level on flat pedals
    leftLeg.paw.rotation.set(0.08, 0.05, 0);
    rightLeg.paw.rotation.set(0.08, -0.05, 0);
    // Align front paws with grips
    leftArm.paw.rotation.set(0.25, steerAngle - 0.3, 0);
    rightArm.paw.rotation.set(0.25, steerAngle + 0.3, 0);
  };

  const dispose = () => {
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry.dispose();
      }
    });
  };

  return {
    root,
    headGroup,
    update,
    dispose,
  };
}
