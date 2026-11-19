import { useCallback, useEffect, useRef, useState } from 'react';
import { ControlDock } from './components/ControlDock';
import { CanvasVideoRecorder } from './scene/recorder';
import { TigerCycleScene } from './scene/TigerCycleScene';
import type { SceneControlState, SceneTelemetry } from './scene/types';

const INITIAL_STATE: SceneControlState = {
  speed: 1.0,
  paused: false,
  cameraPreset: 'side',
  timeOfDay: 'morning',
  soundEnabled: true,
  autoSway: true,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<TigerCycleScene | null>(null);
  const recorderRef = useRef<CanvasVideoRecorder | null>(null);
  const noticeTimeoutRef = useRef<number | null>(null);

  const [controlState, setControlState] = useState<SceneControlState>(INITIAL_STATE);
  const [telemetry, setTelemetry] = useState<SceneTelemetry>({
    kmh: 18.0,
    cadenceRpm: 55,
    distanceM: 0,
  });
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [bellPulse, setBellPulse] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordNotice, setRecordNotice] = useState<string | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const bellTimeoutRef = useRef<number | null>(null);

  const showNotice = useCallback((message: string) => {
    setRecordNotice(message);
    if (noticeTimeoutRef.current !== null) {
      window.clearTimeout(noticeTimeoutRef.current);
    }
    noticeTimeoutRef.current = window.setTimeout(() => {
      setRecordNotice(null);
    }, 3200);
  }, []);

  const triggerBellFeedback = useCallback(() => {
    setBellPulse(true);
    if (bellTimeoutRef.current !== null) {
      window.clearTimeout(bellTimeoutRef.current);
    }
    bellTimeoutRef.current = window.setTimeout(() => {
      setBellPulse(false);
    }, 240);
  }, []);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const recorder = new CanvasVideoRecorder();
    recorderRef.current = recorder;

    let engine: TigerCycleScene | null = null;
    try {
      engine = new TigerCycleScene(container, INITIAL_STATE, {
        onTelemetry: (t) => setTelemetry(t),
        onContextLostChange: (lost) => {
          setWebglError(lost ? 'WebGL 컨텍스트가 일시 중단되었습니다. 잠시 후 복구됩니다.' : null);
        },
        onBellTriggered: triggerBellFeedback,
      });
      sceneRef.current = engine;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'WebGL 초기화에 실패했습니다.';
      setWebglError(msg);
    }

    return () => {
      if (bellTimeoutRef.current !== null) {
        window.clearTimeout(bellTimeoutRef.current);
      }
      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current);
      }
      recorder.dispose();
      recorderRef.current = null;
      engine?.dispose();
      sceneRef.current = null;
    };
  }, [triggerBellFeedback]);

  // Increment elapsed recording timer once per second while active
  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      return;
    }
    const id = window.setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isRecording]);

  const handleStateChange = useCallback((partial: Partial<SceneControlState>) => {
    setControlState((prev) => {
      const next = { ...prev, ...partial };
      sceneRef.current?.updateState(partial);
      return next;
    });
  }, []);

  const handleRingBell = useCallback(() => {
    sceneRef.current?.ringBell();
  }, []);

  const handleToggleRecord = useCallback(() => {
    const recorder = recorderRef.current;
    const engine = sceneRef.current;
    if (!recorder || !engine) return;

    if (recorder.isRecording()) {
      recorder.stop();
      return;
    }

    recorder.start(engine.getCanvas(), {
      onStart: () => {
        setIsRecording(true);
        setRecordNotice(null);
      },
      onStop: (fileName) => {
        setIsRecording(false);
        showNotice(`영상이 저장되었습니다 (${fileName})`);
      },
      onError: (msg) => {
        setIsRecording(false);
        showNotice(msg);
      },
    });
  }, [showNotice]);

  // Global keyboard shortcuts for Zen mode (H) and Play/Pause (P)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      } else if (e.code === 'KeyP') {
        setControlState((prev) => {
          const paused = !prev.paused;
          sceneRef.current?.updateState({ paused });
          return { ...prev, paused };
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#121619] select-none">
      {/* Isolated WebGL canvas mount — never re-created by React HUD state updates */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        aria-label="자전거 타는 호랑이 3D 인터랙티브 장면"
      />

      {/* Minimal Top-Left Header Overlay (zero occlusion of 3D hero center) */}
      <header className="pointer-events-none fixed top-5 left-5 z-10 max-w-md">
        <h1 className="text-lg font-bold tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)] sm:text-xl">
          호랑이의 자전거 산책
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-medium text-stone-100/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.75)]">
          <span className="font-mono-tabular">{telemetry.kmh.toFixed(1)} km/h</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">{telemetry.cadenceRpm} rpm</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">{telemetry.distanceM} m</span>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span className="hidden text-stone-200/85 sm:inline">
            드래그 회전 · A/D 조향 · 호랑이 클릭 또는 Space 벨
          </span>
        </div>
      </header>

      {/* Brief recording saved / error feedback above bottom dock */}
      {recordNotice && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-28 left-1/2 z-30 -translate-x-1/2 rounded-xl border border-white/15 bg-[#14191e]/95 px-4 py-2 text-xs font-medium text-stone-100 shadow-lg"
        >
          {recordNotice}
        </div>
      )}

      {/* Graceful WebGL fallback overlay */}
      {webglError && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#121619]/92 p-6 text-center">
          <div className="max-w-sm rounded-2xl border border-white/12 bg-[#1a2026] p-6">
            <h2 className="text-base font-semibold text-white">3D 장면을 불러올 수 없습니다</h2>
            <p className="mt-2 text-sm text-stone-300">{webglError}</p>
          </div>
        </div>
      )}

      {/* Collapsible Unified Bottom Control Dock */}
      <ControlDock
        state={controlState}
        collapsed={dockCollapsed}
        bellPulse={bellPulse}
        isRecording={isRecording}
        recordingSeconds={recordingSeconds}
        onToggleCollapse={() => setDockCollapsed((c) => !c)}
        onChangeState={handleStateChange}
        onRingBell={handleRingBell}
        onToggleRecord={handleToggleRecord}
      />
    </main>
  );
}
