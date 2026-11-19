import {
  Bell,
  Camera,
  ChevronDown,
  ChevronUp,
  Moon,
  Pause,
  Play,
  Square,
  Sun,
  Sunset,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { CameraPreset, SceneControlState, TimeOfDay } from '../scene/types';

interface ControlDockProps {
  state: SceneControlState;
  collapsed: boolean;
  bellPulse: boolean;
  isRecording: boolean;
  recordingSeconds: number;
  onToggleCollapse: () => void;
  onChangeState: (partial: Partial<SceneControlState>) => void;
  onRingBell: () => void;
  onToggleRecord: () => void;
}

const CAMERA_OPTIONS: { id: CameraPreset; label: string }[] = [
  { id: 'side', label: '측면 추적' },
  { id: 'front', label: '정면 앵글' },
  { id: 'closeup', label: '얼굴 근접' },
  { id: 'scenic', label: '풍경 시점' },
];

const TIME_OPTIONS: { id: TimeOfDay; label: string; Icon: typeof Sun }[] = [
  { id: 'morning', label: '아침', Icon: Sun },
  { id: 'sunset', label: '노을', Icon: Sunset },
  { id: 'night', label: '야간', Icon: Moon },
];

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function ControlDock({
  state,
  collapsed,
  bellPulse,
  isRecording,
  recordingSeconds,
  onToggleCollapse,
  onChangeState,
  onRingBell,
  onToggleRecord,
}: ControlDockProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex flex-col items-center px-3">
      {/* Collapse / Expand Handle (Zen Mode toggle, shortcut H) */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="pointer-events-auto mb-1.5 flex items-center gap-1.5 rounded-t-lg border border-white/12 bg-[#14191e]/92 px-3 py-1 text-xs font-medium text-stone-300 transition-colors hover:bg-[#1e252c] hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400"
        title="컨트롤 패널 토글 (단축키 H)"
      >
        {collapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        <span className="whitespace-nowrap">{collapsed ? '컨트롤 보기' : '컨트롤 숨기기'}</span>
      </button>

      {/* Unified Horizontal Bottom Control Dock (solid rgba surface, no backdrop-filter over WebGL) */}
      <div
        className={`pointer-events-auto w-full max-w-[1040px] rounded-2xl border border-white/12 bg-[#14191e]/92 px-4 py-3 shadow-2xl transition-transform duration-200 ease-out ${
          collapsed ? 'translate-y-[140%] opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}
        aria-hidden={collapsed}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3.5 gap-y-2.5">
          {/* Play / Pause & Speed Slider */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onChangeState({ paused: !state.paused })}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-stone-950 transition-colors hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-amber-300"
              aria-label={state.paused ? '재생' : '일시정지'}
              title={state.paused ? '재생 (P)' : '일시정지 (P)'}
            >
              {state.paused ? <Play className="h-4 w-4 fill-current" /> : <Pause className="h-4 w-4 fill-current" />}
            </button>

            <div className="flex items-center gap-2.5">
              <label
                htmlFor="tiger-speed-slider"
                className="text-xs font-medium text-stone-400 whitespace-nowrap"
              >
                페달 속도
              </label>
              <input
                id="tiger-speed-slider"
                type="range"
                min={0.2}
                max={2.4}
                step={0.05}
                value={state.speed}
                onChange={(e) =>
                  onChangeState({
                    speed: parseFloat(e.target.value),
                    paused: false,
                  })
                }
                className="tiger-slider w-20 sm:w-24"
              />
              <span className="font-mono-tabular w-9 text-right text-xs font-semibold text-stone-200">
                {state.speed.toFixed(1)}x
              </span>
            </div>
          </div>

          <div className="hidden h-5 w-px bg-white/10 xl:block" aria-hidden="true" />

          {/* Camera Presets */}
          <div className="flex items-center gap-1.5">
            <Camera className="hidden h-3.5 w-3.5 shrink-0 text-stone-400 sm:block" aria-hidden="true" />
            <div className="flex items-center gap-1 rounded-lg bg-white/6 p-0.5">
              {CAMERA_OPTIONS.map((opt) => {
                const active = state.cameraPreset === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangeState({ cameraPreset: opt.id })}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 ${
                      active
                        ? 'bg-stone-100 text-stone-950'
                        : 'text-stone-300 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hidden h-5 w-px bg-white/10 xl:block" aria-hidden="true" />

          {/* Time of Day & Bell / Video Record / Audio Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-white/6 p-0.5">
              {TIME_OPTIONS.map(({ id, label, Icon }) => {
                const active = state.timeOfDay === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChangeState({ timeOfDay: id })}
                    className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 ${
                      active
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'text-stone-300 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onRingBell}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-amber-400 ${
                bellPulse
                  ? 'scale-95 border-amber-400 bg-amber-500/25 text-amber-200'
                  : 'border-white/15 bg-white/8 text-stone-100 hover:bg-white/14'
              }`}
              title="자전거 벨 울리기 (Space)"
            >
              <Bell className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>벨 울리기</span>
            </button>

            <button
              type="button"
              onClick={onToggleRecord}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-amber-400 ${
                isRecording
                  ? 'border-red-400/60 bg-red-600 text-white hover:bg-red-500'
                  : 'border-white/15 bg-white/8 text-stone-100 hover:bg-white/14'
              }`}
              aria-pressed={isRecording}
              title={isRecording ? '녹화를 중지하고 영상 파일로 저장' : '캔버스 화면을 영상 파일로 녹화'}
            >
              {isRecording ? (
                <>
                  <Square className="h-3 w-3 shrink-0 fill-current" />
                  <span>녹화 저장</span>
                  <span className="font-mono-tabular text-[11px] opacity-95">
                    {formatDuration(recordingSeconds)}
                  </span>
                </>
              ) : (
                <>
                  <Video className="h-3.5 w-3.5 shrink-0 text-stone-200" />
                  <span>영상 녹화</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onChangeState({ soundEnabled: !state.soundEnabled })}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/6 text-stone-300 transition-colors hover:bg-white/14 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400"
              aria-label={state.soundEnabled ? '소리 끄기' : '소리 켜기'}
              title={state.soundEnabled ? '소리 끄기' : '소리 켜기'}
            >
              {state.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
