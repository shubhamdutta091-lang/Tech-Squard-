/**
 * MOON VR: "THE LAST SIGNAL" - Procedural Web Audio Engine
 * Self-contained procedural synthesis using Web Audio API.
 * No external audio files required.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isInitialized = false;

    // Master gains
    this.masterGain = null;
    this.sfxGain = null;
    this.ambienceGain = null;
    this.voiceGain = null;

    // Continuous sound nodes
    this.heartbeatTimer = null;
    this.heartbeatBpm = 72;
    this.breathingTimer = null;
    this.isBreathing = false;
    this.rocketRumbleNode = null;
    this.rocketGain = null;
    this.alarmLoopOsc = null;
    this.alarmGain = null;
    this.reentryGain = null;
    this.reentryNode = null;
    this.hissGain = null;
    this.hissNode = null;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Master bus
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Sub buses
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.ambienceGain = this.ctx.createGain();
      this.ambienceGain.gain.setValueAtTime(0.65, this.ctx.currentTime);
      this.ambienceGain.connect(this.masterGain);

      this.voiceGain = this.ctx.createGain();
      this.voiceGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.voiceGain.connect(this.masterGain);

      this.isInitialized = true;
      this.startBreathing();
      this.startHeartbeat(72);
      console.log("[AudioEngine] Web Audio context initialized successfully.");
    } catch (e) {
      console.warn("[AudioEngine] Could not initialize Web Audio:", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // --- PROCEDURAL HEARTBEAT (Stress-responsive) ---
  startHeartbeat(bpm = 72) {
    this.heartbeatBpm = Math.max(50, Math.min(170, bpm));
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    const playDoubleThump = () => {
      if (!this.ctx || this.isMuted) return;
      const t = this.ctx.currentTime;

      // Lub (first sound)
      this.triggerThump(t, 65, 0.09, 0.45);
      // Dub (second sound, slightly delayed and higher pitch)
      this.triggerThump(t + 0.12, 85, 0.07, 0.35);
    };

    const intervalMs = (60 / this.heartbeatBpm) * 1000;
    this.heartbeatTimer = setInterval(playDoubleThump, intervalMs);
    playDoubleThump();
  }

  setHeartbeatBpm(bpm) {
    this.heartbeatBpm = Math.max(50, Math.min(170, bpm));
    this.startHeartbeat(this.heartbeatBpm);
  }

  triggerThump(time, freq, decay, volume) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(25, time + decay);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(110, time);

    gain.gain.setValueAtTime(volume * 0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambienceGain);

    osc.start(time);
    osc.stop(time + decay + 0.05);
  }

  // --- PROCEDURAL SUIT BREATHING (Inhale / Exhale) ---
  startBreathing() {
    if (this.isBreathing || !this.ctx) return;
    this.isBreathing = true;

    let isInhale = true;
    const breatheCycle = () => {
      if (!this.isBreathing || !this.ctx) return;
      const t = this.ctx.currentTime;
      const duration = isInhale ? 2.4 : 2.8;

      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.4;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 3.5;

      const gain = this.ctx.createGain();

      if (isInhale) {
        filter.frequency.setValueAtTime(320, t);
        filter.frequency.exponentialRampToValueAtTime(650, t + duration * 0.7);
        filter.frequency.exponentialRampToValueAtTime(400, t + duration);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.12, t + duration * 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      } else {
        filter.frequency.setValueAtTime(580, t);
        filter.frequency.exponentialRampToValueAtTime(260, t + duration * 0.9);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.09, t + duration * 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      }

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ambienceGain);

      noise.start(t);
      noise.stop(t + duration);

      isInhale = !isInhale;
      const nextDelay = (duration + (isInhale ? 1.0 : 0.6)) * 1000;
      this.breathingTimer = setTimeout(breatheCycle, nextDelay);
    };

    breatheCycle();
  }

  // --- ROCKET ENGINE RUMBLE (Launch & Thrusters) ---
  startRocketRumble(intensity = 0.8) {
    if (!this.ctx) return;
    if (this.rocketRumbleNode) this.stopRocketRumble();

    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(140, t);

    const subOsc = this.ctx.createOscillator();
    subOsc.type = "sawtooth";
    subOsc.frequency.setValueAtTime(42, t);

    const subFilter = this.ctx.createBiquadFilter();
    subFilter.type = "lowpass";
    subFilter.frequency.setValueAtTime(80, t);

    this.rocketGain = this.ctx.createGain();
    this.rocketGain.gain.setValueAtTime(0.01, t);
    this.rocketGain.gain.linearRampToValueAtTime(intensity, t + 1.2);

    noise.connect(filter);
    filter.connect(this.rocketGain);

    subOsc.connect(subFilter);
    subFilter.connect(this.rocketGain);

    this.rocketGain.connect(this.sfxGain);

    noise.start(t);
    subOsc.start(t);

    this.rocketRumbleNode = { noise, subOsc };
  }

  stopRocketRumble(fadeDuration = 2.0) {
    if (!this.rocketGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.rocketGain.gain.linearRampToValueAtTime(0.001, t + fadeDuration);
    setTimeout(() => {
      if (this.rocketRumbleNode) {
        try {
          this.rocketRumbleNode.noise.stop();
          this.rocketRumbleNode.subOsc.stop();
        } catch (e) {}
        this.rocketRumbleNode = null;
      }
    }, fadeDuration * 1000);
  }

  // --- RE-ENTRY PLASMA ROAR ---
  startReentryRoar() {
    if (!this.ctx) return;
    if (this.reentryNode) return;
    const t = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(450, t);
    filter.Q.value = 1.8;

    this.reentryGain = this.ctx.createGain();
    this.reentryGain.gain.setValueAtTime(0.01, t);
    this.reentryGain.gain.linearRampToValueAtTime(0.75, t + 2.0);

    noise.connect(filter);
    filter.connect(this.reentryGain);
    this.reentryGain.connect(this.sfxGain);

    noise.start(t);
    this.reentryNode = noise;
  }

  stopReentryRoar() {
    if (!this.reentryGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.reentryGain.gain.linearRampToValueAtTime(0.001, t + 1.5);
    setTimeout(() => {
      if (this.reentryNode) {
        try { this.reentryNode.stop(); } catch (e) {}
        this.reentryNode = null;
      }
    }, 1600);
  }

  // --- PRESSURE LEAK HISS ---
  startPressureLeakHiss() {
    if (!this.ctx || this.hissNode) return;
    const t = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(2400, t);

    this.hissGain = this.ctx.createGain();
    this.hissGain.gain.setValueAtTime(0.01, t);
    this.hissGain.gain.linearRampToValueAtTime(0.4, t + 0.8);

    noise.connect(filter);
    filter.connect(this.hissGain);
    this.hissGain.connect(this.sfxGain);

    noise.start(t);
    this.hissNode = noise;
  }

  stopPressureLeakHiss() {
    if (!this.hissGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.hissGain.gain.linearRampToValueAtTime(0.001, t + 0.5);
    setTimeout(() => {
      if (this.hissNode) {
        try { this.hissNode.stop(); } catch (e) {}
        this.hissNode = null;
      }
    }, 600);
  }

  // --- COCKPIT ALARM KLAXON ---
  startAlarm(type = "warning") {
    if (!this.ctx) return;
    this.stopAlarm();

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === "warning") {
      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(880, t);
      
      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(2.5, t);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(140, t);
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfo.start(t);

      gain.gain.setValueAtTime(0.28, t);
      osc1.connect(gain);
      gain.connect(this.sfxGain);
      osc1.start(t);
      this.alarmLoopOsc = { osc: osc1, lfo, gain };
    } else {
      osc1.type = "square";
      osc1.frequency.setValueAtTime(1200, t);
      gain.gain.setValueAtTime(0.22, t);
      osc1.connect(gain);
      gain.connect(this.sfxGain);
      osc1.start(t);
      this.alarmLoopOsc = { osc: osc1, gain };
    }
  }

  stopAlarm() {
    if (!this.alarmLoopOsc) return;
    try {
      if (this.alarmLoopOsc.osc) this.alarmLoopOsc.osc.stop();
      if (this.alarmLoopOsc.lfo) this.alarmLoopOsc.lfo.stop();
    } catch (e) {}
    this.alarmLoopOsc = null;
  }

  // --- SOUND EFFECTS (Clicks, Clunks, Quindar, Beeps) ---
  playSwitchClick() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(950, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.035);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  playLeverClunk() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.08);

    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playQuindarTone(isIntro = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(isIntro ? 2525 : 2475, t);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(this.voiceGain);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  playImpactThud() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.35);

    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.42);
  }

  playSealPatchSound() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.6);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, t);
    filter.frequency.linearRampToValueAtTime(3200, t + 0.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.6);
  }

  // --- MISSION CONTROL PROCEDURAL RADIO VOICE / TEXT-TO-SPEECH ---
  speakRadioMessage(text, onComplete = null) {
    if (this.isMuted) {
      if (onComplete) onComplete();
      return;
    }

    this.playQuindarTone(true);

    if ("speechSynthesis" in window) {
      setTimeout(() => {
        try {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.rate = 1.05;
          utterance.pitch = 0.95;
          utterance.volume = 1.0;

          const voices = window.speechSynthesis.getVoices();
          const enVoice = voices.find(v => v.lang.startsWith("en") && (v.name.includes("David") || v.name.includes("Google") || v.name.includes("Male") || v.name.includes("Natural")));
          if (enVoice) utterance.voice = enVoice;

          utterance.onend = () => {
            this.playQuindarTone(false);
            if (onComplete) onComplete();
          };
          utterance.onerror = () => {
            this.playQuindarTone(false);
            if (onComplete) onComplete();
          };

          window.speechSynthesis.speak(utterance);
        } catch (e) {
          this.playQuindarTone(false);
          if (onComplete) onComplete();
        }
      }, 260);
    } else {
      setTimeout(() => {
        this.playQuindarTone(false);
        if (onComplete) onComplete();
      }, 1500);
    }
  }

  setAtmosphereSilence() {
    if (this.ambienceGain && this.ctx) {
      this.ambienceGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    }
  }

  restoreNominalAtmosphere() {
    if (this.ambienceGain && this.ctx) {
      this.ambienceGain.gain.setValueAtTime(0.65, this.ctx.currentTime);
    }
  }
}

window.audioEngine = new AudioEngine();
