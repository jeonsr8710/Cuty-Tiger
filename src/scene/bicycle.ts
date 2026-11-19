import * as THREE from 'three';
import type { SceneMaterials } from './materials';

export interface BicycleRig {
  root: THREE.Group;
  leanGroup: THREE.Group;
  steerGroup: THREE.Group;
  frontWheel: THREE.Group;
  rearWheel: THREE.Group;
  crankGroup: THREE.Group;
  leftPedalLeveler: THREE.Group;
  rightPedalLeveler: THREE.Group;
  leftPedalAnchor: THREE.Object3D;
  rightPedalAnchor: THREE.Object3D;
  leftGripAnchor: THREE.Object3D;
  rightGripAnchor: THREE.Object3D;
  bellHammer: THREE.Group;
  headlampLight: THREE.SpotLight;
  headlampBeam: THREE.Mesh;
  wheelRadius: number;
  update: (
    wheelAngle: number,
    crankAngle: number,
    steerAngle: number,
    leanAngle: number,
    bellShake: number,
    nightFactor: number,
  ) => void;
  dispose: () => void;
}

const WHEEL_RADIUS = 0.42;
const TIRE_TUBE = 0.042;
const RIM_RADIUS = WHEEL_RADIUS - TIRE_TUBE;
const REAR_AXLE = new THREE.Vector3(0, WHEEL_RADIUS, -0.68);
const FRONT_AXLE = new THREE.Vector3(0, WHEEL_RADIUS, 0.68);
const BB_POS = new THREE.Vector3(0, 0.37, -0.06);
const SEAT_TOP = new THREE.Vector3(0, 0.96, -0.26);
const HEAD_BOT = new THREE.Vector3(0, 0.78, 0.49);
const HEAD_TOP = new THREE.Vector3(0, 1.04, 0.42);
const CRANK_RADIUS = 0.21;

function createTubeBetween(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  radialSegments = 12,
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, radialSegments);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createWheel(materials: SceneMaterials): THREE.Group {
  const wheel = new THREE.Group();

  // Tire (torus lying in YZ plane so it rolls around X axis)
  const tireGeo = new THREE.TorusGeometry(RIM_RADIUS, TIRE_TUBE, 18, 42);
  tireGeo.rotateY(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, materials.bikeTire);
  tire.castShadow = true;
  tire.receiveShadow = true;
  wheel.add(tire);

  // Subtle cream whitewall accent ring on both sides
  const sidewallGeo = new THREE.TorusGeometry(RIM_RADIUS - 0.008, 0.011, 10, 40);
  sidewallGeo.rotateY(Math.PI / 2);
  for (const side of [-1, 1]) {
    const sw = new THREE.Mesh(sidewallGeo, materials.tigerCream);
    sw.position.x = side * 0.032;
    wheel.add(sw);
  }

  // Brushed chrome rim
  const rimGeo = new THREE.TorusGeometry(RIM_RADIUS - 0.03, 0.015, 12, 40);
  rimGeo.rotateY(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, materials.bikeChrome);
  rim.castShadow = true;
  wheel.add(rim);

  // Hub cylinder
  const hubGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.1, 14);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, materials.bikeChrome);
  wheel.add(hub);

  // Brass valve stem
  const valveGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.035, 8);
  const valve = new THREE.Mesh(valveGeo, materials.bikeBrass);
  valve.position.set(0, RIM_RADIUS - 0.055, 0);
  wheel.add(valve);

  // 16 tensioned spokes
  const spokeCount = 16;
  const spokeLen = (RIM_RADIUS - 0.035) * 2;
  const spokeGeo = new THREE.CylinderGeometry(0.0032, 0.0032, spokeLen, 5);
  for (let i = 0; i < spokeCount / 2; i++) {
    const angle = (i / (spokeCount / 2)) * Math.PI;
    const spoke = new THREE.Mesh(spokeGeo, materials.bikeChrome);
    spoke.rotation.x = angle;
    spoke.position.x = (i % 2 === 0 ? 1 : -1) * 0.012;
    wheel.add(spoke);
  }

  return wheel;
}

function createChainringGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const teeth = 28;
  const outerR = 0.112;
  const innerR = 0.098;
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  // Five lightening cutouts inside the chainring
  for (let k = 0; k < 5; k++) {
    const hole = new THREE.Path();
    const ca = (k / 5) * Math.PI * 2;
    hole.absarc(Math.cos(ca) * 0.056, Math.sin(ca) * 0.056, 0.022, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.008,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 2,
  });
  geo.center();
  geo.rotateY(Math.PI / 2);
  return geo;
}

export function createBicycle(materials: SceneMaterials): BicycleRig {
  const root = new THREE.Group();
  const leanGroup = new THREE.Group();
  root.add(leanGroup);

  // --- MAIN DIAMOND FRAME ---
  const frameGroup = new THREE.Group();
  leanGroup.add(frameGroup);

  // Core tubes
  const seatTopTubeNode = new THREE.Vector3(0, 0.91, -0.24);
  const headTopNode = new THREE.Vector3(0, 1.0, 0.43);
  const headBotNode = new THREE.Vector3(0, 0.81, 0.48);

  frameGroup.add(createTubeBetween(BB_POS, SEAT_TOP, 0.022, materials.bikeFrame)); // Seat tube
  frameGroup.add(createTubeBetween(seatTopTubeNode, headTopNode, 0.02, materials.bikeFrame)); // Top tube
  frameGroup.add(createTubeBetween(BB_POS, headBotNode, 0.023, materials.bikeFrame)); // Down tube
  frameGroup.add(createTubeBetween(HEAD_BOT, HEAD_TOP, 0.027, materials.bikeFrame, 14)); // Head tube

  // Brass head-badge emblem on front of head tube
  const badgeGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.008, 12);
  badgeGeo.rotateX(Math.PI / 2 - 0.26);
  const badge = new THREE.Mesh(badgeGeo, materials.bikeBrass);
  badge.position.set(0, 0.91, 0.482);
  frameGroup.add(badge);

  // Rear triangle: left & right seat stays and chain stays
  for (const side of [-1, 1]) {
    const axleSide = new THREE.Vector3(side * 0.068, REAR_AXLE.y, REAR_AXLE.z);
    const bbSide = new THREE.Vector3(side * 0.045, BB_POS.y, BB_POS.z);
    const seatStayTop = new THREE.Vector3(side * 0.02, seatTopTubeNode.y, seatTopTubeNode.z);
    frameGroup.add(createTubeBetween(seatStayTop, axleSide, 0.012, materials.bikeFrame, 10));
    frameGroup.add(createTubeBetween(bbSide, axleSide, 0.013, materials.bikeFrame, 10));
  }

  // Bottom bracket shell
  const bbShellGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.1, 16);
  bbShellGeo.rotateZ(Math.PI / 2);
  const bbShell = new THREE.Mesh(bbShellGeo, materials.bikeFrame);
  bbShell.position.copy(BB_POS);
  bbShell.castShadow = true;
  frameGroup.add(bbShell);

  // --- REAR FENDER & LUGGAGE RACK ---
  const rearFenderGeo = new THREE.TorusGeometry(
    WHEEL_RADIUS + 0.022,
    0.028,
    10,
    28,
    Math.PI * 0.88,
  );
  rearFenderGeo.rotateY(Math.PI / 2);
  const rearFender = new THREE.Mesh(rearFenderGeo, materials.bikeChrome);
  rearFender.position.copy(REAR_AXLE);
  rearFender.rotation.x = -Math.PI * 0.12;
  rearFender.scale.set(0.85, 1, 1);
  rearFender.castShadow = true;
  frameGroup.add(rearFender);

  // Rear rack deck & struts
  const rackY = 0.89;
  for (const side of [-1, 1]) {
    const rFront = new THREE.Vector3(side * 0.085, rackY, -0.34);
    const rBack = new THREE.Vector3(side * 0.085, rackY, -0.96);
    const rAxle = new THREE.Vector3(side * 0.072, REAR_AXLE.y + 0.02, REAR_AXLE.z);
    frameGroup.add(createTubeBetween(rFront, rBack, 0.008, materials.bikeChrome, 8));
    frameGroup.add(createTubeBetween(rBack, rAxle, 0.007, materials.bikeChrome, 8));
    frameGroup.add(
      createTubeBetween(
        rFront,
        new THREE.Vector3(side * 0.025, 0.88, -0.25),
        0.007,
        materials.bikeChrome,
        8,
      ),
    );
  }
  for (let i = 0; i < 4; i++) {
    const z = -0.38 - i * 0.185;
    frameGroup.add(
      createTubeBetween(
        new THREE.Vector3(-0.085, rackY, z),
        new THREE.Vector3(0.085, rackY, z),
        0.007,
        materials.bikeChrome,
        8,
      ),
    );
  }

  // Ruby rear reflector on fender tail
  const reflectorGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.016, 12);
  reflectorGeo.rotateX(Math.PI / 2);
  const reflector = new THREE.Mesh(reflectorGeo, materials.bikeTailReflector);
  reflector.position.set(0, 0.62, -1.08);
  frameGroup.add(reflector);

  // --- SEATPOST & SPRUNG LEATHER SADDLE ---
  const seatPostTop = new THREE.Vector3(0, 1.07, -0.3);
  frameGroup.add(createTubeBetween(SEAT_TOP, seatPostTop, 0.016, materials.bikeChrome, 12));

  const saddleGroup = new THREE.Group();
  saddleGroup.position.set(0, 1.09, -0.3);
  const saddleMainGeo = new THREE.SphereGeometry(0.145, 20, 14);
  saddleMainGeo.scale(1.18, 0.34, 1.35);
  const saddleMain = new THREE.Mesh(saddleMainGeo, materials.bikeLeather);
  saddleMain.position.set(0, 0.015, -0.02);
  saddleMain.castShadow = true;
  saddleGroup.add(saddleMain);

  const saddleNoseGeo = new THREE.CapsuleGeometry(0.042, 0.12, 8, 12);
  saddleNoseGeo.rotateX(Math.PI / 2);
  saddleNoseGeo.scale(1.0, 0.65, 1.0);
  const saddleNose = new THREE.Mesh(saddleNoseGeo, materials.bikeLeather);
  saddleNose.position.set(0, 0.012, 0.12);
  saddleGroup.add(saddleNose);

  // Twin rear chrome saddle coil springs
  for (const side of [-1, 1]) {
    const springGeo = new THREE.CylinderGeometry(0.022, 0.024, 0.065, 10);
    const spring = new THREE.Mesh(springGeo, materials.bikeChrome);
    spring.position.set(side * 0.07, -0.032, -0.1);
    saddleGroup.add(spring);
  }
  frameGroup.add(saddleGroup);

  // --- REAR WHEEL ---
  const rearWheel = createWheel(materials);
  rearWheel.position.copy(REAR_AXLE);
  leanGroup.add(rearWheel);

  // Rear cassette cog
  const rearCogGeo = new THREE.CylinderGeometry(0.046, 0.046, 0.012, 16);
  rearCogGeo.rotateZ(Math.PI / 2);
  const rearCog = new THREE.Mesh(rearCogGeo, materials.bikeChrome);
  rearCog.position.set(-0.046, 0, 0);
  rearWheel.add(rearCog);

  // --- DRIVETRAIN: CHAIN, CHAINRING, CRANKS & LEVELING PEDALS ---
  // Upper and lower chain runs (on rider's right side -X = -0.065)
  const chainX = -0.065;
  frameGroup.add(
    createTubeBetween(
      new THREE.Vector3(chainX, BB_POS.y + 0.095, BB_POS.z),
      new THREE.Vector3(chainX, REAR_AXLE.y + 0.04, REAR_AXLE.z),
      0.007,
      materials.bikeDarkMetal,
      8,
    ),
  );
  frameGroup.add(
    createTubeBetween(
      new THREE.Vector3(chainX, BB_POS.y - 0.095, BB_POS.z),
      new THREE.Vector3(chainX, REAR_AXLE.y - 0.04, REAR_AXLE.z),
      0.007,
      materials.bikeDarkMetal,
      8,
    ),
  );

  const crankGroup = new THREE.Group();
  crankGroup.position.copy(BB_POS);
  leanGroup.add(crankGroup);

  const chainring = new THREE.Mesh(createChainringGeometry(), materials.bikeChrome);
  chainring.position.set(-0.065, 0, 0);
  chainring.castShadow = true;
  crankGroup.add(chainring);

  // Right crank arm (-X) goes UP (+Y at angle 0), Left crank arm (+X) goes DOWN (-Y at angle 0)
  const rightArm = createTubeBetween(
    new THREE.Vector3(-0.088, 0, 0),
    new THREE.Vector3(-0.105, CRANK_RADIUS, 0),
    0.013,
    materials.bikeChrome,
    10,
  );
  crankGroup.add(rightArm);

  const leftArm = createTubeBetween(
    new THREE.Vector3(0.088, 0, 0),
    new THREE.Vector3(0.105, -CRANK_RADIUS, 0),
    0.013,
    materials.bikeChrome,
    10,
  );
  crankGroup.add(leftArm);

  function buildPedal(side: number): { leveler: THREE.Group; anchor: THREE.Object3D } {
    const leveler = new THREE.Group();
    leveler.position.set(side * 0.105, side < 0 ? CRANK_RADIUS : -CRANK_RADIUS, 0);

    const spindleGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.11, 8);
    spindleGeo.rotateZ(Math.PI / 2);
    const spindle = new THREE.Mesh(spindleGeo, materials.bikeChrome);
    spindle.position.x = side * 0.055;
    leveler.add(spindle);

    const padGeo = new THREE.BoxGeometry(0.11, 0.026, 0.088);
    const pad = new THREE.Mesh(padGeo, materials.bikeDarkMetal);
    pad.position.set(side * 0.068, 0, 0);
    pad.castShadow = true;
    leveler.add(pad);

    const anchor = new THREE.Object3D();
    anchor.position.set(side * 0.072, 0.022, 0);
    leveler.add(anchor);

    return { leveler, anchor };
  }

  const rightPedal = buildPedal(-1);
  const leftPedal = buildPedal(1);
  crankGroup.add(rightPedal.leveler);
  crankGroup.add(leftPedal.leveler);

  // --- STEERING ASSEMBLY (FORK, FRONT WHEEL, HANDLEBARS, BELL, HEADLAMP, WICKER BASKET) ---
  // Pivot cleanly around head-tube axis
  const headAxisDir = new THREE.Vector3().subVectors(HEAD_TOP, HEAD_BOT).normalize();
  const steerAxisMount = new THREE.Group();
  steerAxisMount.position.copy(HEAD_BOT);
  steerAxisMount.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), headAxisDir);
  leanGroup.add(steerAxisMount);

  const steerGroup = new THREE.Group();
  steerAxisMount.add(steerGroup);

  // Helper to convert bike-local positions into steerGroup local space
  const invSteerMatrix = new THREE.Matrix4();
  steerAxisMount.updateMatrix();
  invSteerMatrix.copy(steerAxisMount.matrix).invert();
  const toSteerLocal = (v: THREE.Vector3) => v.clone().applyMatrix4(invSteerMatrix);

  const localFrontAxle = toSteerLocal(FRONT_AXLE);
  const localCrown = toSteerLocal(new THREE.Vector3(0, 0.77, 0.5));
  const localStemTop = toSteerLocal(new THREE.Vector3(0, 1.24, 0.38));

  // Fork crown & twin fork blades
  const crownGeo = new THREE.BoxGeometry(0.13, 0.032, 0.046);
  const crown = new THREE.Mesh(crownGeo, materials.bikeChrome);
  crown.position.copy(localCrown);
  steerGroup.add(crown);

  for (const side of [-1, 1]) {
    const forkTop = localCrown.clone().add(new THREE.Vector3(side * 0.052, 0, 0));
    const forkBot = localFrontAxle.clone().add(new THREE.Vector3(side * 0.068, 0, 0));
    steerGroup.add(createTubeBetween(forkTop, forkBot, 0.015, materials.bikeFrame, 10));
  }

  // Front wheel mounted inside steerGroup (compensate for head-tube tilt so wheel stays vertical)
  const frontWheelMount = new THREE.Group();
  frontWheelMount.position.copy(localFrontAxle);
  frontWheelMount.quaternion.copy(steerAxisMount.quaternion).invert();
  steerGroup.add(frontWheelMount);

  const frontWheel = createWheel(materials);
  frontWheelMount.add(frontWheel);

  // Front chrome fender
  const frontFenderGeo = new THREE.TorusGeometry(
    WHEEL_RADIUS + 0.022,
    0.028,
    10,
    24,
    Math.PI * 0.72,
  );
  frontFenderGeo.rotateY(Math.PI / 2);
  const frontFender = new THREE.Mesh(frontFenderGeo, materials.bikeChrome);
  frontFender.rotation.x = Math.PI * 0.08;
  frontFender.scale.set(0.85, 1, 1);
  frontFender.castShadow = true;
  frontWheelMount.add(frontFender);

  // Stem & swept-back cruiser handlebars (built in upright handlebar frame at stem top)
  steerGroup.add(
    createTubeBetween(
      toSteerLocal(HEAD_TOP),
      localStemTop,
      0.016,
      materials.bikeChrome,
      12,
    ),
  );

  const barMount = new THREE.Group();
  barMount.position.copy(localStemTop);
  barMount.quaternion.copy(steerAxisMount.quaternion).invert();
  steerGroup.add(barMount);

  // Swept cruiser handlebar tube using CatmullRomCurve3
  const barCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.37, 0.0, -0.17),
    new THREE.Vector3(-0.29, 0.02, -0.02),
    new THREE.Vector3(-0.12, 0.015, 0.04),
    new THREE.Vector3(0, 0.01, 0.05),
    new THREE.Vector3(0.12, 0.015, 0.04),
    new THREE.Vector3(0.29, 0.02, -0.02),
    new THREE.Vector3(0.37, 0.0, -0.17),
  ]);
  const handlebarGeo = new THREE.TubeGeometry(barCurve, 36, 0.014, 10, false);
  const handlebar = new THREE.Mesh(handlebarGeo, materials.bikeChrome);
  handlebar.castShadow = true;
  barMount.add(handlebar);

  // Leather handlebar grips & anchors for the tiger's front paws
  const leftGripAnchor = new THREE.Object3D();
  const rightGripAnchor = new THREE.Object3D();

  for (const side of [-1, 1]) {
    const gripStart = new THREE.Vector3(side * 0.31, 0.014, -0.055);
    const gripEnd = new THREE.Vector3(side * 0.372, -0.002, -0.175);
    const grip = createTubeBetween(gripStart, gripEnd, 0.021, materials.bikeLeather, 12);
    barMount.add(grip);

    // Chrome bar-end cap
    const capGeo = new THREE.SphereGeometry(0.021, 10, 8);
    const cap = new THREE.Mesh(capGeo, materials.bikeChrome);
    cap.position.copy(gripEnd);
    barMount.add(cap);

    const anchor = side > 0 ? leftGripAnchor : rightGripAnchor;
    anchor.position.copy(gripStart).lerp(gripEnd, 0.52);
    barMount.add(anchor);
  }

  // Brass Bicycle Bell mounted on right side of handlebar
  const bellGroup = new THREE.Group();
  bellGroup.position.set(-0.22, 0.042, 0.025);
  const bellBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.03, 0.016, 16),
    materials.bikeDarkMetal,
  );
  bellGroup.add(bellBase);

  const bellDomeGeo = new THREE.SphereGeometry(0.034, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
  const bellDome = new THREE.Mesh(bellDomeGeo, materials.bikeBrass);
  bellDome.position.y = 0.004;
  bellDome.castShadow = true;
  bellGroup.add(bellDome);

  const bellHammer = new THREE.Group();
  bellHammer.position.set(0.028, 0.005, -0.015);
  const lever = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.008, 0.012),
    materials.bikeChrome,
  );
  lever.position.x = 0.014;
  bellHammer.add(lever);
  bellGroup.add(bellHammer);
  barMount.add(bellGroup);

  // --- VINTAGE WICKER FRONT BASKET WITH PICNIC PROPS ---
  const basketGroup = new THREE.Group();
  basketGroup.position.set(0, -0.17, 0.24);
  barMount.add(basketGroup);

  // Basket tapered box-like woven tub
  const basketWallGeo = new THREE.CylinderGeometry(0.185, 0.145, 0.22, 16, 1, true);
  basketWallGeo.scale(1.18, 1, 0.86);
  const basketWalls = new THREE.Mesh(basketWallGeo, materials.wicker);
  basketWalls.castShadow = true;
  basketWalls.receiveShadow = true;
  basketGroup.add(basketWalls);

  const basketBottomGeo = new THREE.CylinderGeometry(0.142, 0.142, 0.018, 16);
  basketBottomGeo.scale(1.18, 1, 0.86);
  const basketBottom = new THREE.Mesh(basketBottomGeo, materials.wicker);
  basketBottom.position.y = -0.105;
  basketGroup.add(basketBottom);

  // Thick braided rim around top of basket
  const basketRimGeo = new THREE.TorusGeometry(0.186, 0.016, 10, 28);
  basketRimGeo.rotateX(Math.PI / 2);
  basketRimGeo.scale(1.18, 1, 0.86);
  const basketRim = new THREE.Mesh(basketRimGeo, materials.wicker);
  basketRim.position.y = 0.108;
  basketGroup.add(basketRim);

  // Leather mounting straps connecting basket to handlebars
  for (const side of [-1, 1]) {
    const strap = createTubeBetween(
      new THREE.Vector3(side * 0.12, 0.09, -0.13),
      new THREE.Vector3(side * 0.12, 0.18, -0.2),
      0.01,
      materials.bikeLeather,
      8,
    );
    basketGroup.add(strap);
  }

  // Picnic props inside basket: rolled picnic blanket & two glossy red apples!
  const blanketGeo = new THREE.CylinderGeometry(0.056, 0.056, 0.34, 14);
  blanketGeo.rotateZ(Math.PI / 2);
  const blanket = new THREE.Mesh(blanketGeo, materials.picnicBlanket);
  blanket.position.set(0, 0.05, -0.02);
  blanket.rotation.y = 0.12;
  blanket.castShadow = true;
  basketGroup.add(blanket);

  for (const [ax, ay, az] of [
    [-0.08, 0.075, 0.075],
    [0.06, 0.068, 0.085],
  ]) {
    const apple = new THREE.Mesh(new THREE.SphereGeometry(0.048, 14, 12), materials.appleRed);
    apple.scale.set(1, 0.92, 1);
    apple.position.set(ax, ay, az);
    apple.castShadow = true;
    basketGroup.add(apple);
  }

  // --- VINTAGE CHROME HEADLAMP & NIGHT LIGHT BEAM ---
  const lampGroup = new THREE.Group();
  lampGroup.position.set(0, -0.32, 0.25);
  barMount.add(lampGroup);

  const lampBodyGeo = new THREE.CylinderGeometry(0.044, 0.032, 0.095, 16);
  lampBodyGeo.rotateX(Math.PI / 2);
  const lampBody = new THREE.Mesh(lampBodyGeo, materials.bikeChrome);
  lampBody.castShadow = true;
  lampGroup.add(lampBody);

  const lampLensGeo = new THREE.SphereGeometry(0.042, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  lampLensGeo.rotateX(Math.PI / 2);
  const lampLens = new THREE.Mesh(lampLensGeo, materials.bikeHeadlampLens);
  lampLens.position.z = 0.045;
  lampGroup.add(lampLens);

  // Subtle volumetric-look headlamp cone (visible at sunset/night)
  const beamGeo = new THREE.ConeGeometry(0.85, 4.6, 20, 1, true);
  beamGeo.translate(0, -2.3, 0);
  beamGeo.rotateX(-Math.PI / 2 + 0.18);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe8a6,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const headlampBeam = new THREE.Mesh(beamGeo, beamMat);
  headlampBeam.position.set(0, 0, 0.06);
  lampGroup.add(headlampBeam);

  const headlampLight = new THREE.SpotLight(0xffe7ad, 0, 14, Math.PI * 0.24, 0.65, 1.5);
  headlampLight.position.set(0, 0, 0.08);
  const lampTarget = new THREE.Object3D();
  lampTarget.position.set(0, -0.85, 5.2);
  lampGroup.add(lampTarget);
  headlampLight.target = lampTarget;
  lampGroup.add(headlampLight);

  const update = (
    wheelAngle: number,
    crankAngle: number,
    steerAngle: number,
    leanAngle: number,
    bellShake: number,
    nightFactor: number,
  ) => {
    leanGroup.rotation.z = leanAngle;
    steerGroup.rotation.y = steerAngle;

    frontWheel.rotation.x = wheelAngle;
    rearWheel.rotation.x = wheelAngle;

    crankGroup.rotation.x = crankAngle;
    // Counter-rotate pedals so foot platforms remain horizontal
    leftPedal.leveler.rotation.x = -crankAngle;
    rightPedal.leveler.rotation.x = -crankAngle;

    // Vibrate bell hammer & dome subtly when ringing
    if (bellShake > 0.001) {
      bellHammer.rotation.y = Math.sin(bellShake * 55) * 0.45 * bellShake;
      bellDome.rotation.z = Math.sin(bellShake * 70) * 0.06 * bellShake;
    } else {
      bellHammer.rotation.y = 0;
      bellDome.rotation.z = 0;
    }

    // Headlamp brightness scales smoothly for sunset / night
    materials.bikeHeadlampLens.emissiveIntensity = 0.28 + nightFactor * 2.4;
    headlampLight.intensity = nightFactor * 14;
    beamMat.opacity = nightFactor * 0.14;
    headlampBeam.visible = nightFactor > 0.05;
  };

  const dispose = () => {
    beamMat.dispose();
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        (obj as THREE.Mesh).geometry.dispose();
      }
    });
  };

  return {
    root,
    leanGroup,
    steerGroup,
    frontWheel,
    rearWheel,
    crankGroup,
    leftPedalLeveler: leftPedal.leveler,
    rightPedalLeveler: rightPedal.leveler,
    leftPedalAnchor: leftPedal.anchor,
    rightPedalAnchor: rightPedal.anchor,
    leftGripAnchor,
    rightGripAnchor,
    bellHammer,
    headlampLight,
    headlampBeam,
    wheelRadius: WHEEL_RADIUS,
    update,
    dispose,
  };
}
