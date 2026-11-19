import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BikeAudioEngine } from './audio';
import { createBicycle, type BicycleRig } from './bicycle';
import { createEnvironment, type EnvironmentRig } from './environment';
import { createSceneMaterials, type SceneMaterials } from './materials';
import { createProceduralTextures, type ProceduralTextureSet } from './textures';
import { createTiger, type TigerRig } from './tiger';
import type { CameraPreset, SceneControlState, SceneTelemetry, TimeOfDay } from './types';

interface LightingPalette {
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  skyBottom: THREE.Color;
  fogColor: THREE.Color;
  fogDensity: number;
  sunPos: THREE.Vector3;
  keyColor: THREE.Color;
  keyIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  rimColor: THREE.Color;
  rimIntensity: number;
  sunDiscColor: THREE.Color;
  cloudColor: THREE.Color;
  nightFactor: number;
  exposure: number;
}

const LIGHTING_PALETTES: Record<TimeOfDay, LightingPalette> = {
  morning: {
    skyTop: new THREE.Color('#3b82c4'),
    skyHorizon: new THREE.Color('#d9eeff'),
    skyBottom: new THREE.Color('#86ab76'),
    fogColor: new THREE.Color('#cfe6f5'),
    fogDensity: 0.0115,
    sunPos: new THREE.Vector3(38, 48, 86),
    keyColor: new THREE.Color('#fff4dc'),
    keyIntensity: 2.35,
    hemiSky: new THREE.Color('#9ad1ff'),
    hemiGround: new THREE.Color('#5a7545'),
    hemiIntensity: 0.95,
    rimColor: new THREE.Color('#b6e0ff'),
    rimIntensity: 0.7,
    sunDiscColor: new THREE.Color('#fff8d9'),
    cloudColor: new THREE.Color('#fffdf9'),
    nightFactor: 0.0,
    exposure: 1.08,
  },
  sunset: {
    skyTop: new THREE.Color('#3c3b6e'),
    skyHorizon: new THREE.Color('#f49b63'),
    skyBottom: new THREE.Color('#664e44'),
    fogColor: new THREE.Color('#e3976b'),
    fogDensity: 0.0125,
    sunPos: new THREE.Vector3(-34, 16, 98),
    keyColor: new THREE.Color('#ffad66'),
    keyIntensity: 2.25,
    hemiSky: new THREE.Color('#f59e72'),
    hemiGround: new THREE.Color('#4a3936'),
    hemiIntensity: 0.85,
    rimColor: new THREE.Color('#ffd08a'),
    rimIntensity: 1.05,
    sunDiscColor: new THREE.Color('#ffcf78'),
    cloudColor: new THREE.Color('#ffd4b2'),
    nightFactor: 0.35,
    exposure: 1.05,
  },
  night: {
    skyTop: new THREE.Color('#0c1428'),
    skyHorizon: new THREE.Color('#1f3154'),
    skyBottom: new THREE.Color('#142030'),
    fogColor: new THREE.Color('#182742'),
    fogDensity: 0.0145,
    sunPos: new THREE.Vector3(34, 44, 90),
    keyColor: new THREE.Color('#9bbdf2'),
    keyIntensity: 1.15,
    hemiSky: new THREE.Color('#3b568a'),
    hemiGround: new THREE.Color('#1b242c'),
    hemiIntensity: 0.62,
    rimColor: new THREE.Color('#7ca8f0'),
    rimIntensity: 0.85,
    sunDiscColor: new THREE.Color('#e6f0ff'),
    cloudColor: new THREE.Color('#384d72'),
    nightFactor: 1.0,
    exposure: 1.02,
  },
};

const CAMERA_PRESETS: Record<CameraPreset, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  side: {
    pos: new THREE.Vector3(3.35, 1.85, 2.05),
    target: new THREE.Vector3(0, 1.05, -0.05),
  },
  front: {
    pos: new THREE.Vector3(-1.85, 1.52, 3.35),
    target: new THREE.Vector3(0, 1.18, 0.05),
  },
  closeup: {
    pos: new THREE.Vector3(1.18, 1.98, 1.68),
    target: new THREE.Vector3(0, 1.62, 0.04),
  },
  scenic: {
    pos: new THREE.Vector3(5.6, 3.1, -3.9),
    target: new THREE.Vector3(0, 1.0, 1.4),
  },
};

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

// Module-scope scratch math helpers (zero GC inside animation loop)
const _invBikeLean = new THREE.Matrix4();
const _leftPedalLocal = new THREE.Vector3();
const _rightPedalLocal = new THREE.Vector3();
const _leftGripLocal = new THREE.Vector3();
const _rightGripLocal = new THREE.Vector3();
const _tmpColorTop = new THREE.Color();
const _tmpColorHorizon = new THREE.Color();
const _tmpColorBottom = new THREE.Color();
const _tmpSunPos = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();

export class TigerCycleScene {
  private container: HTMLElement;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private envRenderTarget: THREE.WebGLRenderTarget;

  private textures: ProceduralTextureSet;
  private materials: SceneMaterials;
  private bicycle: BicycleRig;
  private tiger: TigerRig;
  private environment: EnvironmentRig;
  private audio: BikeAudioEngine;

  // Lights
  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;
  private fog: THREE.FogExp2;

  // State & kinematics
  private state: SceneControlState;
  private clock = new THREE.Clock();
  private elapsedTime = 0;
  private wheelAngle = 0;
  private crankAngle = 0;
  private prevHalfTurn = 0;
  private distanceM = 0;
  private steerAngle = 0;
  private leanAngle = 0;
  private lateralX = 0;
  private bellTimer = 0;
  private nightFactorCurrent = 0;

  // Camera transition
  private cameraTransitionActive = false;
  private targetCamPos = new THREE.Vector3();
  private targetCamLook = new THREE.Vector3();

  // Keyboard steering
  private keysPressed = new Set<string>();
  private raycaster = new THREE.Raycaster();
  private pointerDownPos = { x: 0, y: 0 };

  // Lifecycle
  private frameId = 0;
  private disposed = false;
  private contextLost = false;
  private lastTelemetryAt = 0;
  private onTelemetry?: (telemetry: SceneTelemetry) => void;
  private onContextLostChange?: (lost: boolean) => void;
  private onBellTriggered?: () => void;

  // Bound event listeners
  private resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    initialState: SceneControlState,
    callbacks?: {
      onTelemetry?: (t: SceneTelemetry) => void;
      onContextLostChange?: (lost: boolean) => void;
      onBellTriggered?: () => void;
    },
  ) {
    this.container = container;
    this.state = { ...initialState };
    this.onTelemetry = callbacks?.onTelemetry;
    this.onContextLostChange = callbacks?.onContextLostChange;
    this.onBellTriggered = callbacks?.onBellTriggered;

    this.isSoftwareGl = detectSoftwareWebGL();
    this.audio = new BikeAudioEngine();
    this.audio.setEnabled(initialState.soundEnabled);

    // 1. Renderer setup with modern color pipeline & software-WebGL guard
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = LIGHTING_PALETTES[initialState.timeOfDay].exposure;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // 2. Scene, horizon-matched fog & RoomEnvironment studio IBL
    this.scene = new THREE.Scene();
    const initPalette = LIGHTING_PALETTES[initialState.timeOfDay];
    this.scene.background = initPalette.fogColor.clone();
    this.fog = new THREE.FogExp2(initPalette.fogColor.getHex(), initPalette.fogDensity);
    this.scene.fog = this.fog;

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envRenderTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    this.scene.environmentIntensity = 0.65;
    pmremGenerator.dispose();

    // 3. Camera & OrbitControls
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 260);
    const startPreset = CAMERA_PRESETS[initialState.cameraPreset];
    this.camera.position.copy(startPreset.pos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(startPreset.target);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.35;
    this.controls.maxDistance = 14;
    this.controls.maxPolarAngle = Math.PI * 0.485; // Keep camera above road surface
    this.controls.minPolarAngle = 0.12;
    this.controls.enablePan = false;
    this.controls.addEventListener('start', () => {
      // Cancel scripted camera transition immediately so user always owns orbit controls
      this.cameraTransitionActive = false;
    });
    this.controls.update();

    // 4. Three-point + Hemisphere lighting rig
    this.hemiLight = new THREE.HemisphereLight(
      initPalette.hemiSky,
      initPalette.hemiGround,
      initPalette.hemiIntensity,
    );
    this.hemiLight.position.set(0, 30, 0);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(initPalette.keyColor, initPalette.keyIntensity);
    this.keyLight.position.set(7.5, 11.5, 6.5);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 34;
    this.keyLight.shadow.camera.left = -8;
    this.keyLight.shadow.camera.right = 8;
    this.keyLight.shadow.camera.top = 8;
    this.keyLight.shadow.camera.bottom = -8;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(initPalette.rimColor, initPalette.rimIntensity);
    this.rimLight.position.set(-6.5, 5.5, -7.5);
    this.scene.add(this.rimLight);

    // 5. Procedural textures, PBR materials & composite 3D models
    this.textures = createProceduralTextures(this.renderer);
    this.materials = createSceneMaterials(this.textures);

    this.environment = createEnvironment(this.materials, this.textures);
    this.scene.add(this.environment.root);

    this.bicycle = createBicycle(this.materials);
    this.tiger = createTiger(this.materials);

    // Mount tiger directly inside bicycle.leanGroup so both tilt & steer in lockstep
    this.bicycle.leanGroup.add(this.tiger.root);
    this.scene.add(this.bicycle.root);

    // Apply initial sky & lighting state
    this.nightFactorCurrent = initPalette.nightFactor;
    this.environment.setSkyColors(
      initPalette.skyTop,
      initPalette.skyHorizon,
      initPalette.skyBottom,
      initPalette.sunPos,
    );
    (this.environment.sunDisc.material as THREE.MeshBasicMaterial).color.copy(
      initPalette.sunDiscColor,
    );
    this.materials.cloud.color.copy(initPalette.cloudColor);

    // Sync initial pose once so first frame is pristine
    this.stepSimulation(0.016);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // 6. Listeners (resize, keyboard, click-to-ring-bell, webglcontextlost)
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    // 7. Start animation loop
    this.clock.start();
    this.tick();
  }

  public updateState(partial: Partial<SceneControlState>): void {
    const prevPreset = this.state.cameraPreset;
    this.state = { ...this.state, ...partial };
    this.audio.setEnabled(this.state.soundEnabled);

    if (partial.cameraPreset && partial.cameraPreset !== prevPreset) {
      this.transitionToCameraPreset(partial.cameraPreset);
    }
  }

  public transitionToCameraPreset(preset: CameraPreset): void {
    const cfg = CAMERA_PRESETS[preset];
    this.targetCamPos.copy(cfg.pos);
    this.targetCamLook.copy(cfg.target);
    this.cameraTransitionActive = true;
  }

  public ringBell(): void {
    this.bellTimer = 1.0;
    this.audio.playBell();
    this.onBellTriggered?.();
  }

  public getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  private handleResize(): void {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    if (width <= 0 || height <= 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keysPressed.add(e.code);
    if (e.code === 'Space' || e.code === 'KeyB') {
      e.preventDefault();
      this.ringBell();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysPressed.delete(e.code);
  };

  private handlePointerDown = (e: PointerEvent): void => {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  };

  private handlePointerUp = (e: PointerEvent): void => {
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > 36) return; // Ignore orbit drags

    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(_pointerNdc, this.camera);
    const hits = this.raycaster.intersectObject(this.bicycle.root, true);
    if (hits.length > 0) {
      this.ringBell();
    }
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    this.onContextLostChange?.(true);
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
    this.onContextLostChange?.(false);
    this.clock.getDelta();
  };

  private stepSimulation(delta: number): void {
    const activeSpeed = this.state.paused ? 0 : this.state.speed;
    this.elapsedTime += delta;

    // Physical linear travel speed (at speed=1.0 -> 5.0 m/s = 18.0 km/h)
    const travelMetersPerSec = activeSpeed * 5.0;
    this.distanceM += travelMetersPerSec * delta;

    // Exact wheel rolling kinematics: deltaTheta = distance / wheelRadius
    const wheelOmega = travelMetersPerSec / this.bicycle.wheelRadius;
    this.wheelAngle += wheelOmega * delta;

    // Gear ratio (~2.05:1): crank turns slightly under half as fast as wheel
    const crankOmega = wheelOmega * 0.48;
    this.crankAngle += crankOmega * delta;

    // Subtle mechanical pedal tick on crank half-revolutions
    const currentHalfTurn = Math.floor(this.crankAngle / Math.PI);
    if (currentHalfTurn !== this.prevHalfTurn && activeSpeed > 0.15) {
      this.prevHalfTurn = currentHalfTurn;
      this.audio.playPedalClick();
    }

    // Steering: keyboard (A/D or Left/Right) overrides gentle natural cruising weave
    const steerLeft = this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft');
    const steerRight = this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight');
    let targetSteer = 0;
    if (steerLeft && !steerRight) {
      targetSteer = 0.24;
    } else if (steerRight && !steerLeft) {
      targetSteer = -0.24;
    } else if (this.state.autoSway && activeSpeed > 0.05) {
      targetSteer = Math.sin(this.elapsedTime * 0.72) * 0.085;
    }

    this.steerAngle = THREE.MathUtils.damp(this.steerAngle, targetSteer, 5.5, delta);

    // Gentle bike lean into steer + rhythmic pedaling counter-sway
    const pedalSway = Math.sin(this.crankAngle) * 0.028 * Math.min(activeSpeed, 1.3);
    const targetLean = -this.steerAngle * 0.42 + pedalSway;
    this.leanAngle = THREE.MathUtils.damp(this.leanAngle, targetLean, 6.5, delta);

    // Lateral lane position stays safely inside the 4.6m bike path (±1.25m)
    if (steerLeft || steerRight) {
      this.lateralX = THREE.MathUtils.clamp(
        this.lateralX + this.steerAngle * (1.2 + travelMetersPerSec * 0.55) * delta,
        -1.25,
        1.25,
      );
    } else if (this.state.autoSway) {
      const targetLat = Math.sin(this.elapsedTime * 0.72 - 0.6) * 0.55;
      this.lateralX = THREE.MathUtils.damp(this.lateralX, targetLat, 2.2, delta);
    } else {
      this.lateralX = THREE.MathUtils.damp(this.lateralX, 0, 2.5, delta);
    }

    this.bicycle.root.position.x = this.lateralX;
    // Slight road-micro-bounce proportional to speed
    this.bicycle.root.position.y =
      Math.abs(Math.sin(this.wheelAngle * 2)) * 0.006 * Math.min(activeSpeed, 1.5);

    // Decay bell ringing excitation smoothly
    this.bellTimer = Math.max(0, this.bellTimer - delta * 1.15);

    // Smoothly interpolate Time-of-Day lighting & sky palette
    const targetPal = LIGHTING_PALETTES[this.state.timeOfDay];
    const lightLerp = 1 - Math.exp(-3.4 * delta);

    _tmpColorTop.copy(this.environment.skyMaterial.uniforms.uTopColor.value).lerp(targetPal.skyTop, lightLerp);
    _tmpColorHorizon.copy(this.environment.skyMaterial.uniforms.uHorizonColor.value).lerp(targetPal.skyHorizon, lightLerp);
    _tmpColorBottom.copy(this.environment.skyMaterial.uniforms.uBottomColor.value).lerp(targetPal.skyBottom, lightLerp);
    _tmpSunPos.copy(this.environment.sunDisc.position).lerp(targetPal.sunPos, lightLerp);
    this.environment.setSkyColors(_tmpColorTop, _tmpColorHorizon, _tmpColorBottom, _tmpSunPos);

    (this.environment.sunDisc.material as THREE.MeshBasicMaterial).color.lerp(
      targetPal.sunDiscColor,
      lightLerp,
    );
    this.materials.cloud.color.lerp(targetPal.cloudColor, lightLerp);

    this.fog.color.lerp(targetPal.fogColor, lightLerp);
    this.fog.density = THREE.MathUtils.damp(this.fog.density, targetPal.fogDensity, 3.4, delta);
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.fog.color);
    }

    this.keyLight.color.lerp(targetPal.keyColor, lightLerp);
    this.keyLight.intensity = THREE.MathUtils.damp(
      this.keyLight.intensity,
      targetPal.keyIntensity,
      3.4,
      delta,
    );
    this.hemiLight.color.lerp(targetPal.hemiSky, lightLerp);
    this.hemiLight.groundColor.lerp(targetPal.hemiGround, lightLerp);
    this.hemiLight.intensity = THREE.MathUtils.damp(
      this.hemiLight.intensity,
      targetPal.hemiIntensity,
      3.4,
      delta,
    );
    this.rimLight.color.lerp(targetPal.rimColor, lightLerp);
    this.rimLight.intensity = THREE.MathUtils.damp(
      this.rimLight.intensity,
      targetPal.rimIntensity,
      3.4,
      delta,
    );
    this.renderer.toneMappingExposure = THREE.MathUtils.damp(
      this.renderer.toneMappingExposure,
      targetPal.exposure,
      3.4,
      delta,
    );
    this.nightFactorCurrent = THREE.MathUtils.damp(
      this.nightFactorCurrent,
      targetPal.nightFactor,
      3.4,
      delta,
    );

    // 1. Update bicycle transforms first
    this.bicycle.update(
      this.wheelAngle,
      this.crankAngle,
      this.steerAngle,
      this.leanAngle,
      this.bellTimer,
      this.nightFactorCurrent,
    );

    // 2. Transform exact pedal & handlebar grip world positions into tiger/leanGroup local space for 2-bone IK
    this.bicycle.root.updateMatrixWorld(true);
    _invBikeLean.copy(this.bicycle.leanGroup.matrixWorld).invert();

    this.bicycle.leftPedalAnchor.getWorldPosition(_leftPedalLocal).applyMatrix4(_invBikeLean);
    this.bicycle.rightPedalAnchor.getWorldPosition(_rightPedalLocal).applyMatrix4(_invBikeLean);
    this.bicycle.leftGripAnchor.getWorldPosition(_leftGripLocal).applyMatrix4(_invBikeLean);
    this.bicycle.rightGripAnchor.getWorldPosition(_rightGripLocal).applyMatrix4(_invBikeLean);

    // 3. Update tiger animation & 2-bone IK
    this.tiger.update(
      this.elapsedTime,
      activeSpeed,
      this.crankAngle,
      this.steerAngle,
      this.bellTimer,
      _leftPedalLocal,
      _rightPedalLocal,
      _leftGripLocal,
      _rightGripLocal,
    );

    // 4. Scroll parkway environment
    this.environment.update(delta, travelMetersPerSec, this.lateralX, this.elapsedTime);

    // 5. Smooth camera preset transition (automatically clears on arrival)
    if (this.cameraTransitionActive) {
      const k = 5.2;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.targetCamPos.x, k, delta);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.targetCamPos.y, k, delta);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.targetCamPos.z, k, delta);

      this.controls.target.x = THREE.MathUtils.damp(
        this.controls.target.x,
        this.targetCamLook.x + this.lateralX * 0.45,
        k,
        delta,
      );
      this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, this.targetCamLook.y, k, delta);
      this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, this.targetCamLook.z, k, delta);

      if (this.camera.position.distanceToSquared(this.targetCamPos) < 0.0015) {
        this.cameraTransitionActive = false;
      }
    } else {
      // Gently track bike lateral offset so the tiger stays centered while steering
      this.controls.target.x = THREE.MathUtils.damp(
        this.controls.target.x,
        this.lateralX * 0.65,
        3.2,
        delta,
      );
    }

    this.controls.update();

    // Throttled HUD telemetry callback (~8 Hz)
    if (this.onTelemetry && this.elapsedTime - this.lastTelemetryAt > 0.12) {
      this.lastTelemetryAt = this.elapsedTime;
      this.onTelemetry({
        kmh: Math.round(travelMetersPerSec * 3.6 * 10) / 10,
        cadenceRpm: Math.round((crankOmega / (Math.PI * 2)) * 60),
        distanceM: Math.floor(this.distanceM),
      });
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;

    const rawDelta = this.clock.getDelta();
    const delta = Math.min(rawDelta, 0.08);

    if (!this.contextLost) {
      this.stepSimulation(delta);
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.controls.dispose();
    this.bicycle.dispose();
    this.tiger.dispose();
    this.environment.dispose();
    this.materials.dispose();
    this.textures.dispose();
    this.envRenderTarget.dispose();
    this.audio.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
