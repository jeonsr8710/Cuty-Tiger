export type CameraPreset = 'side' | 'front' | 'closeup' | 'scenic';

export type TimeOfDay = 'morning' | 'sunset' | 'night';

export interface SceneControlState {
  speed: number; // 0 to 2.5 (1.0 = normal cruise ~18 km/h)
  paused: boolean;
  cameraPreset: CameraPreset;
  timeOfDay: TimeOfDay;
  soundEnabled: boolean;
  autoSway: boolean;
}

export interface SceneTelemetry {
  kmh: number;
  cadenceRpm: number;
  distanceM: number;
}
