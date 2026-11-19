// 100% procedural Web Audio API sound synthesizer (zero external audio files)

export class BikeAudioEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private lastTickTime = 0;

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Classic twin-strike brass bicycle bell ("따르릉!") */
  public playBell(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const strikeOffsets = [0, 0.13];

    for (const offset of strikeOffsets) {
      const t = now + offset;
      const partials = [
        { freq: 1580, gain: 0.2, decay: 0.72 },
        { freq: 3175, gain: 0.11, decay: 0.5 },
        { freq: 4720, gain: 0.055, decay: 0.28 },
      ];

      for (const p of partials) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(p.freq, t);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(p.gain, t + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + p.decay);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + p.decay + 0.02);
      }
    }
  }

  /** Subtle mechanical chain / freewheel tick synced to pedal revolutions */
  public playPedalClick(): void {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    if (now - this.lastTickTime < 0.09) return;
    this.lastTickTime = now;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.018);

    gain.gain.setValueAtTime(0.018, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.025);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
