/**
 * PayNexa Professional Sound Service
 * 
 * Generates clear, calibrated, studio-grade UI audio notifications using Web Audio API synthesis.
 * Engineered for live demonstrations, laptop speaker clarity, and enterprise FinTech operations:
 * - Dynamic Compression & Normalization: Maximum perceived loudness and clarity without clipping.
 * - Harmonic Richness: Overtone blending optimized for laptop and desktop speaker frequency response (400Hz - 3.5kHz).
 * - Zero Latency: 100% synthesized client-side in real-time, no external audio files required.
 * - Anti-Spam & Debounce: Intelligent cooldown protection ensures sounds only play once per event.
 * - Instant Audio Unlocking: Resumes AudioContext on first user interaction (pointerdown, keydown, touch).
 * - Granular Preference Persistence: Saves master toggle, volume level, and individual event categories to localStorage.
 */

export interface SoundSettings {
  enabled: boolean;
  volume: number; // 0.0 to 1.0 (calibrated default 0.85)
  playSuccess: boolean;
  playFailureAlert: boolean;
  playHighRiskAlert: boolean;
  playCriticalAlert: boolean;
  playOfflineVerification: boolean;
  playCustomerCommunication: boolean;
  playReportReady: boolean;
  playSimulateEvent: boolean;
}

const STORAGE_KEY = 'paynexa_sound_settings_v2';

const DEFAULT_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 0.85, // Calibrated for clear laptop speaker delivery
  playSuccess: true,
  playFailureAlert: true,
  playHighRiskAlert: true,
  playCriticalAlert: true,
  playOfflineVerification: true,
  playCustomerCommunication: true,
  playReportReady: true,
  playSimulateEvent: true,
};

class SoundService {
  private audioCtx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private settings: SoundSettings = { ...DEFAULT_SETTINGS };
  private listeners: Set<() => void> = new Set();
  private userInteracted: boolean = false;
  private lastPlayedTimestamps: Record<string, number> = {};

  constructor() {
    this.loadSettings();
    this.setupInteractionListeners();
  }

  private loadSettings(): void {
    try {
      // Support migration from v1 to v2
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('paynexa_sound_settings_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          // Ensure volume is adequately high for demos if previously set too low
          volume: typeof parsed.volume === 'number' ? Math.max(0.6, parsed.volume) : DEFAULT_SETTINGS.volume,
        };
      }
    } catch {
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      this.notifyListeners();
    } catch {
      // Ignore storage errors in restricted sandbox environments
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in sound settings listener:', err);
      }
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSettings(): SoundSettings {
    return { ...this.settings };
  }

  public isEnabled(): boolean {
    return this.settings.enabled;
  }

  public toggleSound(): boolean {
    this.settings.enabled = !this.settings.enabled;
    this.saveSettings();
    if (this.settings.enabled) {
      // Play an audible, crisp confirmation tone when enabled
      this.playSimulateEvent(true);
    }
    return this.settings.enabled;
  }

  public setVolume(volume: number): void {
    this.settings.volume = Math.max(0.05, Math.min(1.0, volume));
    this.saveSettings();
  }

  public updateSettings(partial: Partial<SoundSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.saveSettings();
  }

  private setupInteractionListeners(): void {
    if (typeof window === 'undefined') return;

    const unlockAudio = () => {
      this.userInteracted = true;
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('click', unlockAudio);
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('click', unlockAudio, { passive: true });
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }

      if (this.audioCtx && this.audioCtx.state === 'suspended' && this.userInteracted) {
        this.audioCtx.resume().catch(() => {});
      }

      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * Master Output Bus with Dynamics Compressor & Limiting
   * Normalizes acoustic volume across different laptop and desktop speakers.
   */
  private createMasterBus(ctx: AudioContext, gainMultiplier: number = 0.85): GainNode {
    // 1. Dynamics Compressor for rich, punchy, non-clipping audio
    if (!this.compressor || (this.compressor.context !== ctx)) {
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-14, ctx.currentTime);
      this.compressor.knee.setValueAtTime(6, ctx.currentTime);
      this.compressor.ratio.setValueAtTime(5, ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      this.compressor.release.setValueAtTime(0.12, ctx.currentTime);
      this.compressor.connect(ctx.destination);
    }

    // 2. Master Gain scaled by user setting
    const masterGain = ctx.createGain();
    const effectiveGain = Math.max(0.01, this.settings.volume * gainMultiplier);
    masterGain.gain.setValueAtTime(effectiveGain, ctx.currentTime);
    masterGain.connect(this.compressor);

    return masterGain;
  }

  /**
   * Anti-spam debounce check to prevent duplicate sounds within the cooldown window
   */
  private canPlay(soundKey: string, cooldownMs: number = 200): boolean {
    if (!this.settings.enabled) return false;
    const now = Date.now();
    const last = this.lastPlayedTimestamps[soundKey] || 0;
    if (now - last < cooldownMs) {
      return false;
    }
    this.lastPlayedTimestamps[soundKey] = now;
    return true;
  }

  // =========================================================================
  // 1. SUCCESS / RECOVERY COMPLETED (Positive Harmonic Resolution Chime)
  // =========================================================================
  /**
   * Triumphant 4-note ascending major arpeggio with warm harmonic overtone.
   * Played on revenue recovery, successful retry clearance, or confirmed payment.
   */
  public playSuccess(bypassCategoryCheck = false): void {
    if (!bypassCategoryCheck && !this.settings.playSuccess) return;
    if (!this.canPlay('success', 250)) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const bus = this.createMasterBus(ctx, 0.85);

      const notes = [
        { freq: 523.25, time: 0.00, dur: 0.28, vol: 0.75 }, // C5
        { freq: 659.25, time: 0.05, dur: 0.32, vol: 0.80 }, // E5
        { freq: 783.99, time: 0.10, dur: 0.38, vol: 0.90 }, // G5
        { freq: 1046.50, time: 0.16, dur: 0.55, vol: 0.95 }, // C6 (Resolution)
      ];

      notes.forEach((n) => {
        const start = now + n.time;
        
        // Fundamental Tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(n.vol, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + n.dur);

        osc.connect(gain);
        gain.connect(bus);

        osc.start(start);
        osc.stop(start + n.dur + 0.02);

        // Harmonic Shimmer (Octave overtone for acoustic presence)
        const harm = ctx.createOscillator();
        const harmGain = ctx.createGain();
        harm.type = 'sine';
        harm.frequency.setValueAtTime(n.freq * 2, start);

        harmGain.gain.setValueAtTime(0, start);
        harmGain.gain.linearRampToValueAtTime(n.vol * 0.35, start + 0.01);
        harmGain.gain.exponentialRampToValueAtTime(0.001, start + (n.dur * 0.7));

        harm.connect(harmGain);
        harmGain.connect(bus);

        harm.start(start);
        harm.stop(start + n.dur);
      });
    } catch {
      // Fails silently if AudioContext is not ready
    }
  }

  /** Alias for playSuccess */
  public playRecoveryCompleted(bypassCategoryCheck = false): void {
    this.playSuccess(bypassCategoryCheck);
  }

  // =========================================================================
  // 2. PAYMENT FAILURE ALERT (Noticeable, Clean Descending Alert)
  // =========================================================================
  /**
   * Clear 2-stage descending alert (E5 659Hz -> B4 493Hz) with punchy transient.
   * Noticeably louder and distinct for live payment drop-off notifications.
   */
  public playFailureAlert(bypassCategoryCheck = false): void {
    if (!bypassCategoryCheck && !this.settings.playFailureAlert) return;
    if (!this.canPlay('failure', 250)) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const bus = this.createMasterBus(ctx, 0.85);

      // Low-pass filter for clean, non-harsh high end
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.connect(bus);

      // Pulse 1: 659.25 Hz (E5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.85, now + 0.015);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc1.connect(gain1);
      gain1.connect(filter);
      osc1.start(now);
      osc1.stop(now + 0.20);

      // Pulse 2: 493.88 Hz (B4) - with 70ms offset
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(493.88, now + 0.07);
      gain2.gain.setValueAtTime(0, now + 0.07);
      gain2.gain.linearRampToValueAtTime(0.90, now + 0.085);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc2.connect(gain2);
      gain2.connect(filter);
      osc2.start(now + 0.07);
      osc2.stop(now + 0.34);
    } catch {
      // Ignore
    }
  }

  /** Alias for playFailureAlert */
  public playPaymentFailure(bypassCategoryCheck = false): void {
    this.playFailureAlert(bypassCategoryCheck);
  }

  // =========================================================================
  // 3. HIGH RISK / WARNING ALERT (Dual-Pulse Attention Tone)
  // =========================================================================
  /**
   * Dual-pulse attention alert (440Hz -> 698Hz -> 440Hz -> 698Hz).
   * Used for policy violations, fraud risk flags, and escalation warnings.
   */
  public playHighRiskAlert(bypassCategoryCheck = false): void {
    if (!bypassCategoryCheck && !this.settings.playHighRiskAlert && !this.settings.playFailureAlert) return;
    if (!this.canPlay('high_risk', 300)) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const bus = this.createMasterBus(ctx, 0.90);

      const pulses = [
        { freq: 440.00, time: 0.00, dur: 0.12, vol: 0.80 },
        { freq: 698.46, time: 0.08, dur: 0.18, vol: 0.90 },
        { freq: 440.00, time: 0.20, dur: 0.12, vol: 0.75 },
        { freq: 698.46, time: 0.28, dur: 0.26, vol: 0.95 },
      ];

      pulses.forEach((p) => {
        const start = now + p.time;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(p.freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(p.vol, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + p.dur);

        osc.connect(gain);
        gain.connect(bus);

        osc.start(start);
        osc.stop(start + p.dur + 0.01);
      });
    } catch {
      // Ignore
    }
  }

  /** Alias for playHighRiskAlert */
  public playWarning(bypassCategoryCheck = false): void {
    this.playHighRiskAlert(bypassCategoryCheck);
  }

  // =========================================================================
  // 4. CRITICAL REVENUE-AT-RISK / CRITICAL FAILURE ALERT
  // =========================================================================
  /**
   * Resonant multi-harmonic alert chord for high-value critical revenue-at-risk events.
   * High audibility and urgency without grating noise.
   */
  public playCriticalAlert(bypassCategoryCheck = false): void {
    if (!bypassCategoryCheck && !this.settings.playCriticalAlert && !this.settings.playFailureAlert) return;
    if (!this.canPlay('critical_alert', 350)) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const bus = this.createMasterBus(ctx, 0.95);

      // Multi-layer tone: 330Hz (E4) + 659.25Hz (E5) + 987.77Hz (B5)
      const freqs = [330.00, 659.25, 987.77];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        // Lowpass filter for warm bite
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1600, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.55 / (idx + 1), now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(filter);
        filter.connect(bus);

        osc.start(now);
        osc.stop(now + 0.48);
      });
    } catch {
      // Ignore
    }
  }

  /** Alias for playCriticalAlert */
  public playCriticalFailure(bypassCategoryCheck = false): void {
    this.playCriticalAlert(bypassCategoryCheck);
  }

  // =========================================================================
  // 5. OFFLINE VERIFICATION ALERT (Crisp Dual Bell Ping)
  // =========================================================================
  /**
   * Distinct, clear dual chime (F#5 740Hz -> C#6 1108Hz) for offline payment proofs.
   */
  public playOfflineVerification(bypassCategoryCheck = false): void {
    if (!bypassCategoryCheck && !this.settings.playOfflineVerification) return;
    if (!this.canPlay('offline_verification', 250)) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const bus = this.createMasterBus(ctx, 0.85);

      // Tone 1: 739.99 Hz (F#5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(739.99, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.85, now + 0.012);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(bus);
      osc1.start(now);
      osc1.stop(now + 0.24);

      // Tone 2: 1108.73 Hz (C#6) - with 55ms offset
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1108.73, now + 0.055);
      gain2.gain.setValueAtTime(0, now + 0.055);
      gain2.gain.linearRampToValueAtTime(0.90, now + 0.068);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc2.connect(gain2);
      gain2.connect(bus);
      osc2.start(now + 0.055);
      osc2.stop(now + 0.40);
    } catch {
      // Ignore
    }
  }

  // =========================================================================
  // 6. CUSTOMER COMMUNICATION SOUND (Acoustic Message Pop / Bubble Chirp)
  // =========================================================================
  /**
   * Modern acoustic bubble pop (620Hz swiftly rising to 1250Hz with soft bell ring).
   * Friendly, audible, and welcoming for live customer chat & recovery messaging.
   */
  public playCustomerCommunication(bypassCategoryCheck = false): void {
    if (!bypassCategoryCheck && !this.settings.playCustomerCommunication) return;
    if (!this.canPlay('communication', 200)) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const bus = this.createMasterBus(ctx, 0.85);

      // Primary Pop Frequency Sweep (620Hz -> 1250Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(1250, now + 0.06);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.85, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(bus);
      osc.start(now);
      osc.stop(now + 0.18);

      // Harmonic Ping Ring (980Hz with soft ring-out)
      const ringOsc = ctx.createOscillator();
      const ringGain = ctx.createGain();
      ringOsc.type = 'triangle';
      ringOsc.frequency.setValueAtTime(987.77, now + 0.02);

      ringGain.gain.setValueAtTime(0, now + 0.02);
      ringGain.gain.linearRampToValueAtTime(0.35, now + 0.03);
      ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      ringOsc.connect(ringGain);
      ringGain.connect(bus);
      ringOsc.start(now + 0.02);
      ringOsc.stop(now + 0.27);
    } catch {
      // Ignore
    }
  }

  // =========================================================================
  // 7. SIMULATE EVENT SOUND (Crisp Dispatch Blip / Pulse)
  // =========================================================================
  /**
   * Crisp micro-dispatch trigger blip (580Hz -> 1050Hz).
   */
  public playSimulateEvent(bypassCategoryCheck = false): void {
    if (!bypassCategoryCheck && !this.settings.playSimulateEvent) return;
    if (!this.canPlay('simulate_event', 150)) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const bus = this.createMasterBus(ctx, 0.75);

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(1050, now + 0.04);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.75, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(bus);
      osc.start(now);
      osc.stop(now + 0.10);
    } catch {
      // Ignore
    }
  }

  // =========================================================================
  // 8. REPORT READY SOUND (Excel Report Generated / Exported)
  // =========================================================================
  /**
   * Harmonic completion chord (A5 880Hz + E6 1318Hz with shimmer).
   */
  public playReportReady(bypassCategoryCheck = false): void {
    if (!bypassCategoryCheck && !this.settings.playReportReady) return;
    if (!this.canPlay('report_ready', 250)) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const bus = this.createMasterBus(ctx, 0.85);

      const chord = [880.00, 1318.51];
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.65 / (idx + 1), now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(bus);
        osc.start(now);
        osc.stop(now + 0.38);
      });
    } catch {
      // Ignore
    }
  }
}

export const soundService = new SoundService();

