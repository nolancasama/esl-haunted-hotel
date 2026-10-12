/**
 * Procedural Web Audio: no files, no network. Everything here is synthesised:
 * rain, thunder, a quiet music-box lullaby, footsteps, creaks, giggles, captures.
 *
 * Buses: music and ambience duck under Boo's voice and go silent while the
 * microphone listens (classroom speakers bleed into the mic).
 */

type Wave = OscillatorType;

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private musicDuck!: GainNode;
  private ambBus!: GainNode;
  private ambDuck!: GainNode;
  private sfxBus!: GainNode;
  private noise!: AudioBuffer;
  private musicVolume = 0.5;
  private sfxVolume = 0.7;
  private speaking = false;
  private listening = false;
  private rain: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private musicTimer = 0;
  private music: { name: "night" | "victory"; next: number; step: number } | null = null;

  /** Must be called from a user gesture (Start button). */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(ctx.destination);
      this.musicDuck = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.musicDuck).connect(this.master);
      this.ambDuck = ctx.createGain();
      this.ambBus = ctx.createGain();
      this.ambBus.connect(this.ambDuck).connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.noise = this.makeNoise(2.5);
      this.applyVolumes();
      document.addEventListener("visibilitychange", () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend();
        else void this.ctx.resume();
      });
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  setVolumes(music: number, sfx: number) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.32, t, 0.05);
    this.ambBus.gain.setTargetAtTime(this.musicVolume * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume * 0.9, t, 0.05);
    this.applyDuck();
  }

  private applyDuck() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const music = this.listening ? 0 : this.speaking ? 0.28 : 1;
    const amb = this.listening ? 0 : this.speaking ? 0.4 : 1;
    this.musicDuck.gain.setTargetAtTime(music, t, 0.08);
    this.ambDuck.gain.setTargetAtTime(amb, t, 0.08);
  }

  /** Boo is talking: duck background so the English is clear. */
  setSpeaking(on: boolean) {
    this.speaking = on;
    this.applyDuck();
  }

  /** Microphone open: silence background and footsteps. */
  setListening(on: boolean) {
    this.listening = on;
    this.applyDuck();
  }

  get isListening() {
    return this.listening;
  }

  // ------------------------------------------------------------------ helpers

  private env(gain: GainNode, t: number, peak: number, attack: number, decay: number) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private tone(
    freq: number,
    t: number,
    opts: { type?: Wave; peak?: number; attack?: number; decay?: number; to?: number; bus?: AudioNode; detune?: number }
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (opts.detune) osc.detune.value = opts.detune;
    const attack = opts.attack ?? 0.008;
    const decay = opts.decay ?? 0.3;
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + attack + decay);
    this.env(g, t, opts.peak ?? 0.2, attack, decay);
    osc.connect(g).connect(opts.bus ?? this.sfxBus);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  private noiseBurst(
    t: number,
    opts: {
      filter?: BiquadFilterType;
      freq?: number;
      to?: number;
      q?: number;
      peak?: number;
      attack?: number;
      decay?: number;
      bus?: AudioNode;
      rate?: number;
    }
  ) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = opts.rate ?? 1;
    const f = ctx.createBiquadFilter();
    f.type = opts.filter ?? "lowpass";
    f.frequency.setValueAtTime(opts.freq ?? 1200, t);
    f.Q.value = opts.q ?? 0.8;
    const attack = opts.attack ?? 0.01;
    const decay = opts.decay ?? 0.2;
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + attack + decay);
    const g = ctx.createGain();
    this.env(g, t, opts.peak ?? 0.2, attack, decay);
    src.connect(f).connect(g).connect(opts.bus ?? this.sfxBus);
    const offset = Math.random() * 1.5;
    src.start(t, offset, attack + decay + 0.1);
  }

  private get now(): number {
    return this.ctx ? this.ctx.currentTime + 0.01 : 0;
  }

  private ready(): boolean {
    return Boolean(this.ctx && this.ctx.state === "running");
  }

  // --------------------------------------------------------------- one-shots

  play(name: SfxName, opts: { pitch?: number } = {}) {
    if (!this.ready()) return;
    const t = this.now;
    const p = opts.pitch ?? 1;
    switch (name) {
      case "step": {
        if (this.listening) return;
        const k = 0.9 + Math.random() * 0.2;
        this.noiseBurst(t, { filter: "bandpass", freq: 700 * k, q: 1.2, peak: 0.05, attack: 0.004, decay: 0.07 });
        this.tone(95 * k, t, { peak: 0.06, decay: 0.07 });
        break;
      }
      case "creak": {
        const ctx = this.ctx!;
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(170 * p, t);
        osc.frequency.linearRampToValueAtTime(115 * p, t + 0.75);
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 11;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 18;
        lfo.connect(lfoGain).connect(osc.frequency);
        const f = ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 1000;
        f.Q.value = 5;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.09, t + 0.06);
        g.gain.setValueAtTime(0.09, t + 0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
        osc.connect(f).connect(g).connect(this.sfxBus);
        osc.start(t);
        lfo.start(t);
        osc.stop(t + 0.9);
        lfo.stop(t + 0.9);
        break;
      }
      case "lid": {
        this.tone(190, t, { peak: 0.18, decay: 0.09 });
        this.noiseBurst(t, { filter: "bandpass", freq: 500, q: 2, peak: 0.12, decay: 0.12 });
        this.play("creak", { pitch: 1.25 });
        break;
      }
      case "rustle":
        this.noiseBurst(t, { filter: "bandpass", freq: 2600, to: 900, q: 1.5, peak: 0.12, attack: 0.05, decay: 0.35 });
        break;
      case "knock":
        this.tone(170, t, { peak: 0.2, decay: 0.07 });
        this.tone(160, t + 0.13, { peak: 0.18, decay: 0.07 });
        break;
      case "flashlight":
        this.tone(1500, t, { peak: 0.08, decay: 0.03, type: "square" });
        this.noiseBurst(t + 0.02, { filter: "lowpass", freq: 400, peak: 0.05, attack: 0.1, decay: 0.4 });
        break;
      case "poof":
        this.noiseBurst(t, { filter: "lowpass", freq: 1600, to: 300, peak: 0.16, decay: 0.3 });
        this.tone(240, t + 0.05, { to: 150, peak: 0.08, decay: 0.22, type: "triangle" });
        break;
      case "giggle": {
        for (let i = 0; i < 4; i++) {
          const tt = t + i * 0.13;
          const f0 = 760 * p * (1 - i * 0.04);
          this.tone(f0 * 1.25, tt, { to: f0, peak: 0.1, attack: 0.012, decay: 0.09, type: "triangle" });
          this.tone(f0 * 2.5, tt, { to: f0 * 2, peak: 0.025, attack: 0.012, decay: 0.08 });
        }
        break;
      }
      case "pop":
        this.tone(260 * p, t, { to: 950 * p, peak: 0.25, decay: 0.1 });
        this.tone(1760, t + 0.08, { peak: 0.08, decay: 0.6 });
        this.tone(2637, t + 0.08, { peak: 0.04, decay: 0.5 });
        break;
      case "boo":
        // Playful "BOO!" sting when a ghost is found.
        this.tone(330, t, { to: 520, peak: 0.16, attack: 0.04, decay: 0.3, type: "triangle" });
        this.tone(660, t + 0.02, { to: 1040, peak: 0.05, attack: 0.04, decay: 0.28, type: "sine" });
        this.noiseBurst(t, { filter: "bandpass", freq: 900, to: 2400, q: 1, peak: 0.07, attack: 0.05, decay: 0.3 });
        break;
      case "capture": {
        [72, 76, 79, 84, 88].forEach((m, i) => this.tone(midi(m), t + i * 0.07, { peak: 0.13, decay: 0.5, type: "triangle" }));
        for (let i = 0; i < 7; i++) this.tone(2000 + Math.random() * 2200, t + 0.25 + i * 0.07, { peak: 0.03, decay: 0.25 });
        this.noiseBurst(t, { filter: "bandpass", freq: 500, to: 3000, q: 0.8, peak: 0.06, attack: 0.2, decay: 0.5 });
        break;
      }
      case "correct":
        this.tone(midi(79), t, { peak: 0.14, decay: 0.35 });
        this.tone(midi(84), t + 0.12, { peak: 0.14, decay: 0.55 });
        break;
      case "error":
        this.tone(midi(64), t, { peak: 0.07, decay: 0.16, type: "triangle" });
        this.tone(midi(60), t + 0.17, { peak: 0.07, decay: 0.24, type: "triangle" });
        break;
      case "unlock":
        this.tone(1800, t, { peak: 0.1, decay: 0.12 });
        this.tone(2700, t + 0.05, { peak: 0.06, decay: 0.15 });
        this.noiseBurst(t, { filter: "highpass", freq: 3000, peak: 0.06, decay: 0.04 });
        break;
      case "locked":
        for (let i = 0; i < 3; i++) this.noiseBurst(t + i * 0.07, { filter: "bandpass", freq: 1400, q: 3, peak: 0.12, decay: 0.04 });
        break;
      case "slam":
        this.tone(80, t, { to: 38, peak: 0.6, decay: 0.45 });
        this.noiseBurst(t, { filter: "lowpass", freq: 700, to: 120, peak: 0.45, decay: 0.4 });
        for (let i = 1; i < 4; i++) this.noiseBurst(t + 0.12 * i, { filter: "bandpass", freq: 1500, q: 4, peak: 0.05, decay: 0.05 });
        break;
      case "whoosh":
        this.noiseBurst(t, { filter: "bandpass", freq: 400, to: 2600, q: 1.2, peak: 0.16, attack: 0.25, decay: 0.4 });
        break;
      case "sparkle":
        [84, 88, 91, 96].forEach((m, i) => this.tone(midi(m), t + i * 0.06, { peak: 0.05, attack: 0.02, decay: 0.6 }));
        break;
      case "snore":
        this.noiseBurst(t, { filter: "lowpass", freq: 260, peak: 0.16, attack: 0.6, decay: 0.7 });
        this.noiseBurst(t + 1.7, { filter: "lowpass", freq: 220, peak: 0.12, attack: 0.6, decay: 0.8 });
        break;
      case "munch":
        for (let i = 0; i < 4; i++) this.noiseBurst(t + i * 0.13, { filter: "bandpass", freq: 2300, q: 1.5, peak: 0.12, decay: 0.05 });
        break;
      case "rattle":
        for (let i = 0; i < 6; i++) this.noiseBurst(t + i * 0.055, { filter: "bandpass", freq: 1700 + Math.random() * 600, q: 3, peak: 0.1, decay: 0.03 });
        break;
      case "piano":
        [0, 12, 19].forEach((o, i) => this.tone(midi(62 + o), t, { peak: [0.12, 0.04, 0.02][i], decay: 1.2, type: i ? "sine" : "triangle" }));
        break;
      case "chime":
        [0, 0.5, 1.0].forEach((d, i) => {
          this.tone(midi(84 - i * 3), t + d, { peak: 0.08, decay: 1.3 });
          this.tone(midi(84 - i * 3) * 2.01, t + d, { peak: 0.02, decay: 0.9 });
        });
        break;
      case "tick":
        this.tone(1250, t, { peak: 0.05, decay: 0.03 });
        break;
      case "micOn":
        this.tone(880, t, { to: 1320, peak: 0.09, decay: 0.08 });
        break;
      case "micOff":
        this.tone(1100, t, { to: 700, peak: 0.06, decay: 0.08 });
        break;
      case "thunder":
        this.thunder(0.6);
        break;
      case "fanfare":
        [72, 76, 79].forEach((m, i) => this.tone(midi(m), t + i * 0.13, { peak: 0.14, decay: 0.2, type: "triangle" }));
        this.tone(midi(84), t + 0.39, { peak: 0.16, attack: 0.02, decay: 1.1, type: "triangle" });
        this.tone(midi(76), t + 0.39, { peak: 0.08, attack: 0.02, decay: 1.1 });
        this.tone(midi(79), t + 0.39, { peak: 0.08, attack: 0.02, decay: 1.1 });
        break;
      case "birds":
        for (let i = 0; i < 6; i++) {
          const tt = t + i * 0.18 + Math.random() * 0.1;
          this.tone(2600 + Math.random() * 600, tt, { to: 3600, peak: 0.03, decay: 0.08 });
        }
        break;
    }
  }

  /** Distant-to-close thunder. */
  thunder(intensity = 0.6) {
    if (!this.ready()) return;
    const t = this.now;
    this.noiseBurst(t, { filter: "lowpass", freq: 900, to: 90, peak: 0.35 * intensity, attack: 0.04, decay: 2.6, bus: this.ambBus, rate: 0.6 });
    this.noiseBurst(t + 0.25, { filter: "lowpass", freq: 260, to: 60, peak: 0.3 * intensity, attack: 0.3, decay: 2.4, bus: this.ambBus, rate: 0.5 });
  }

  // ------------------------------------------------------------- ambience

  startRain() {
    if (!this.ctx || this.rain) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 6500;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.setTargetAtTime(0.11, ctx.currentTime, 1.2);
    src.connect(hp).connect(lp).connect(gain).connect(this.ambBus);
    src.start();
    this.rain = { src, gain };
  }

  stopRain(seconds = 2) {
    if (!this.ctx || !this.rain) return;
    const { src, gain } = this.rain;
    gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, seconds / 3);
    src.stop(this.ctx.currentTime + seconds + 0.5);
    this.rain = null;
  }

  // ------------------------------------------------------------------ music

  /** Quiet 3/4 music-box lullaby (D minor), or the same tune in major for the ending. */
  startMusic(name: "night" | "victory") {
    if (!this.ctx) return;
    if (this.music?.name === name) return;
    this.stopMusic();
    this.music = { name, next: this.ctx.currentTime + 0.2, step: 0 };
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 60);
  }

  stopMusic() {
    window.clearInterval(this.musicTimer);
    this.music = null;
  }

  private scheduleMusic() {
    const ctx = this.ctx;
    const m = this.music;
    if (!ctx || !m) return;
    const beat = m.name === "night" ? 60 / 92 : 60 / 112;
    while (m.next < ctx.currentTime + 0.3) {
      const bar = Math.floor(m.step / 3) % 8;
      const beatInBar = m.step % 3;
      this.playMusicBeat(m.name, bar, beatInBar, m.next, beat);
      m.step++;
      m.next += beat;
    }
  }

  private playMusicBeat(name: "night" | "victory", bar: number, beatInBar: number, t: number, beat: number) {
    // Melody per bar: [midi, beats] pairs starting on beat 0.
    const MELODY: Array<Array<[number, number]>> = [
      [[62, 1], [65, 1], [69, 1]],
      [[74, 2], [69, 1]],
      [[70, 1], [69, 1], [67, 1]],
      [[69, 3]],
      [[67, 1], [70, 1], [74, 1]],
      [[77, 2], [76, 1]],
      [[76, 1], [73, 1], [69, 1]],
      [[74, 3]]
    ];
    const ROOTS = [38, 38, 43, 45, 43, 38, 45, 38];
    const CHORDS: number[][] = [
      [53, 57],
      [53, 57],
      [55, 58],
      [57, 61],
      [55, 58],
      [53, 57],
      [55, 61],
      [53, 57]
    ];
    const major = name === "victory";
    // Minor -> major: F -> F#, Bb -> B (D major lullaby for the happy ending).
    const fix = (n: number) => (major && (n % 12 === 5 || n % 12 === 10) ? n + 1 : n);
    const bus = this.musicBus;

    let pos = 0;
    for (const [note, len] of MELODY[bar]) {
      if (pos === beatInBar) {
        const f = midi(fix(note) + (major ? 0 : 0));
        const dur = Math.min(1.6, len * beat + 0.6);
        this.tone(f, t, { peak: 0.16, attack: 0.006, decay: dur, bus, detune: Math.random() * 6 - 3 });
        this.tone(f * 2, t, { peak: 0.035, attack: 0.006, decay: dur * 0.6, bus });
        this.tone(f * 3.01, t, { peak: 0.012, attack: 0.006, decay: dur * 0.4, bus });
      }
      pos += len;
    }
    if (beatInBar === 0) {
      this.tone(midi(fix(ROOTS[bar])), t, { type: "triangle", peak: 0.16, attack: 0.02, decay: beat * 2.6, bus });
    } else {
      for (const n of CHORDS[bar]) this.tone(midi(fix(n)), t, { peak: 0.035, attack: 0.01, decay: beat * 0.7, bus });
    }
    if ((bar === 3 || bar === 7) && beatInBar === 2) {
      [86, 90, 93].forEach((n, i) => this.tone(midi(fix(n)), t + i * beat * 0.2, { peak: 0.025, decay: 0.5, bus }));
    }
  }
}

export type SfxName =
  | "step"
  | "creak"
  | "lid"
  | "rustle"
  | "knock"
  | "flashlight"
  | "poof"
  | "giggle"
  | "pop"
  | "boo"
  | "capture"
  | "correct"
  | "error"
  | "unlock"
  | "locked"
  | "slam"
  | "whoosh"
  | "sparkle"
  | "snore"
  | "munch"
  | "rattle"
  | "piano"
  | "chime"
  | "tick"
  | "micOn"
  | "micOff"
  | "thunder"
  | "fanfare"
  | "birds";

export const audio = new AudioEngine();
