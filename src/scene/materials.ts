import * as THREE from 'three';
import type { ProceduralTextureSet } from './textures';

export interface SceneMaterials {
  // Tiger materials
  tigerFur: THREE.MeshStandardMaterial;
  tigerHeadFur: THREE.MeshStandardMaterial;
  tigerTailFur: THREE.MeshStandardMaterial;
  tigerCream: THREE.MeshStandardMaterial;
  tigerDarkStripe: THREE.MeshStandardMaterial;
  tigerNose: THREE.MeshPhysicalMaterial;
  tigerEarInner: THREE.MeshStandardMaterial;
  tigerEyeAmber: THREE.MeshPhysicalMaterial;
  tigerPupil: THREE.MeshStandardMaterial;
  tigerWhisker: THREE.MeshStandardMaterial;
  tigerPad: THREE.MeshStandardMaterial;
  scarf: THREE.MeshStandardMaterial;

  // Bicycle materials
  bikeFrame: THREE.MeshPhysicalMaterial;
  bikeChrome: THREE.MeshStandardMaterial;
  bikeTire: THREE.MeshStandardMaterial;
  bikeLeather: THREE.MeshStandardMaterial;
  bikeBrass: THREE.MeshStandardMaterial;
  bikeDarkMetal: THREE.MeshStandardMaterial;
  bikeHeadlampLens: THREE.MeshStandardMaterial;
  bikeTailReflector: THREE.MeshStandardMaterial;
  wicker: THREE.MeshStandardMaterial;
  picnicBlanket: THREE.MeshStandardMaterial;
  appleRed: THREE.MeshPhysicalMaterial;

  // World materials
  road: THREE.MeshStandardMaterial;
  curb: THREE.MeshStandardMaterial;
  grass: THREE.MeshStandardMaterial;
  treeTrunk: THREE.MeshStandardMaterial;
  pineFoliage: THREE.MeshStandardMaterial;
  blossomFoliage: THREE.MeshStandardMaterial;
  rock: THREE.MeshStandardMaterial;
  woodFence: THREE.MeshStandardMaterial;
  cloud: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  petal: THREE.MeshStandardMaterial;

  dispose: () => void;
}

export function createSceneMaterials(textures: ProceduralTextureSet): SceneMaterials {
  // Tiger PBR materials (soft matte fur vs glossy nose/eyes)
  const tigerFur = new THREE.MeshStandardMaterial({
    map: textures.tigerFurMap,
    bumpMap: textures.tigerFurBump,
    bumpScale: 0.015,
    roughness: 0.84,
    metalness: 0.0,
  });

  const tigerHeadFur = new THREE.MeshStandardMaterial({
    map: textures.tigerHeadMap,
    bumpMap: textures.tigerFurBump,
    bumpScale: 0.012,
    roughness: 0.82,
    metalness: 0.0,
  });

  const tigerTailFur = new THREE.MeshStandardMaterial({
    map: textures.tigerTailMap,
    bumpMap: textures.tigerFurBump,
    bumpScale: 0.012,
    roughness: 0.85,
    metalness: 0.0,
  });

  const tigerCream = new THREE.MeshStandardMaterial({
    color: 0xf7e7cf,
    bumpMap: textures.tigerFurBump,
    bumpScale: 0.008,
    roughness: 0.88,
    metalness: 0.0,
  });

  const tigerDarkStripe = new THREE.MeshStandardMaterial({
    color: 0x1b1512,
    roughness: 0.86,
    metalness: 0.0,
  });

  const tigerNose = new THREE.MeshPhysicalMaterial({
    color: 0x2a1b19,
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.85,
    clearcoatRoughness: 0.16,
  });

  const tigerEarInner = new THREE.MeshStandardMaterial({
    color: 0xe6a199,
    roughness: 0.82,
    metalness: 0.0,
  });

  const tigerEyeAmber = new THREE.MeshPhysicalMaterial({
    color: 0xf0a623,
    emissive: 0x3b2200,
    emissiveIntensity: 0.2,
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });

  const tigerPupil = new THREE.MeshStandardMaterial({
    color: 0x0b0a0a,
    roughness: 0.08,
    metalness: 0.0,
  });

  const tigerWhisker = new THREE.MeshStandardMaterial({
    color: 0xfefaf3,
    roughness: 0.45,
    metalness: 0.0,
  });

  const tigerPad = new THREE.MeshStandardMaterial({
    color: 0x3a2a27,
    roughness: 0.72,
    metalness: 0.0,
  });

  const scarf = new THREE.MeshStandardMaterial({
    map: textures.scarfMap,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  // Vintage Touring Bicycle materials (contrasting glossy enamel, brushed chrome, matte rubber, warm leather)
  const bikeFrame = new THREE.MeshPhysicalMaterial({
    color: 0x186357, // Deep British-racing / forest teal enamel
    metalness: 0.58,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });

  const bikeChrome = new THREE.MeshStandardMaterial({
    color: 0xe4e8ec,
    metalness: 0.94,
    roughness: 0.15,
  });

  const bikeTire = new THREE.MeshStandardMaterial({
    color: 0x222528,
    roughness: 0.9,
    metalness: 0.04,
  });

  const bikeLeather = new THREE.MeshStandardMaterial({
    color: 0x7a411f,
    roughness: 0.54,
    metalness: 0.05,
  });

  const bikeBrass = new THREE.MeshStandardMaterial({
    color: 0xd9a845,
    metalness: 0.9,
    roughness: 0.2,
  });

  const bikeDarkMetal = new THREE.MeshStandardMaterial({
    color: 0x2f343a,
    metalness: 0.78,
    roughness: 0.36,
  });

  const bikeHeadlampLens = new THREE.MeshStandardMaterial({
    color: 0xfff5d6,
    emissive: 0xffd27d,
    emissiveIntensity: 0.35,
    roughness: 0.14,
    metalness: 0.1,
  });

  const bikeTailReflector = new THREE.MeshStandardMaterial({
    color: 0xd62828,
    emissive: 0x991111,
    emissiveIntensity: 0.45,
    roughness: 0.2,
    metalness: 0.15,
  });

  const wicker = new THREE.MeshStandardMaterial({
    map: textures.wickerMap,
    roughness: 0.86,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const picnicBlanket = new THREE.MeshStandardMaterial({
    color: 0xd94f3d,
    roughness: 0.88,
    metalness: 0.0,
  });

  const appleRed = new THREE.MeshPhysicalMaterial({
    color: 0xc92a2a,
    roughness: 0.25,
    metalness: 0.0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
  });

  // World & Environment materials
  const road = new THREE.MeshStandardMaterial({
    map: textures.roadMap,
    roughnessMap: textures.roadRoughness,
    roughness: 0.92,
    metalness: 0.02,
  });

  const curb = new THREE.MeshStandardMaterial({
    color: 0xbcb8ad,
    roughness: 0.86,
    metalness: 0.0,
  });

  const grass = new THREE.MeshStandardMaterial({
    map: textures.grassMap,
    roughness: 0.94,
    metalness: 0.0,
  });

  const treeTrunk = new THREE.MeshStandardMaterial({
    color: 0x5c422c,
    roughness: 0.92,
    metalness: 0.0,
  });

  const pineFoliage = new THREE.MeshStandardMaterial({
    color: 0xffffff, // Tinted per instance via InstancedMesh.setColorAt
    roughness: 0.84,
    metalness: 0.0,
  });

  const blossomFoliage = new THREE.MeshStandardMaterial({
    color: 0xffffff, // Tinted per instance
    roughness: 0.8,
    metalness: 0.0,
  });

  const rock = new THREE.MeshStandardMaterial({
    color: 0xffffff, // Tinted per instance
    roughness: 0.88,
    metalness: 0.04,
  });

  const woodFence = new THREE.MeshStandardMaterial({
    color: 0x8a6443,
    roughness: 0.86,
    metalness: 0.0,
  });

  const cloud = new THREE.MeshStandardMaterial({
    color: 0xfffaf2,
    roughness: 0.95,
    metalness: 0.0,
  });

  const contactShadow = new THREE.MeshBasicMaterial({
    map: textures.contactShadowMap,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });

  const petal = new THREE.MeshStandardMaterial({
    color: 0xffd1dc,
    roughness: 0.7,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  const allMaterials: THREE.Material[] = [
    tigerFur,
    tigerHeadFur,
    tigerTailFur,
    tigerCream,
    tigerDarkStripe,
    tigerNose,
    tigerEarInner,
    tigerEyeAmber,
    tigerPupil,
    tigerWhisker,
    tigerPad,
    scarf,
    bikeFrame,
    bikeChrome,
    bikeTire,
    bikeLeather,
    bikeBrass,
    bikeDarkMetal,
    bikeHeadlampLens,
    bikeTailReflector,
    wicker,
    picnicBlanket,
    appleRed,
    road,
    curb,
    grass,
    treeTrunk,
    pineFoliage,
    blossomFoliage,
    rock,
    woodFence,
    cloud,
    contactShadow,
    petal,
  ];

  return {
    tigerFur,
    tigerHeadFur,
    tigerTailFur,
    tigerCream,
    tigerDarkStripe,
    tigerNose,
    tigerEarInner,
    tigerEyeAmber,
    tigerPupil,
    tigerWhisker,
    tigerPad,
    scarf,
    bikeFrame,
    bikeChrome,
    bikeTire,
    bikeLeather,
    bikeBrass,
    bikeDarkMetal,
    bikeHeadlampLens,
    bikeTailReflector,
    wicker,
    picnicBlanket,
    appleRed,
    road,
    curb,
    grass,
    treeTrunk,
    pineFoliage,
    blossomFoliage,
    rock,
    woodFence,
    cloud,
    contactShadow,
    petal,
    dispose: () => {
      for (const m of allMaterials) {
        m.dispose();
      }
    },
  };
}
