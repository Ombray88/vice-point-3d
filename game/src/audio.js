/**
 * audio.js — Procedural WebAudio system for Vice Point 3D
 */

export function createAudio() {
  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let sirenGain = null;
  let engineGain = null;
  let sfxGain = null;

  let muted = false;
  let paused = false;

  let currentStationIndex = 0;
  let trackTime = 0;
  let currentTrackIndex = 0;

  const stationDefs = [
    {
      name: "WAVE 88.1 · Neon Drive",
      tracks: ["Midnight Cruising", "Cyber Highway", "Neon Sunset"]
    },
    {
      name: "VICE FM · Funk Line",
      tracks: ["Downtown Groove", "Funkytown Bounce", "Midnight Strut"]
    },
    {
      name: "OCEAN 99.5 · Sunset Chill",
      tracks: ["Ocean Breeze", "Golden Horizon", "Palm Tree Dreams"]
    }
  ];

  // Engine state
  let targetEnginePitch = 60;
  let currentEnginePitch = 60;
  let engineOsc = null;
  let engineFilter = null;

  // Siren state
  let wantedLevel = 0;
  let sirenOsc1 = null;
  let sirenOsc2 = null;
  let sirenTime = 0;
  let sirenActive = false;

  // Sequencer state
  let seqTimer = 0;
  let stepIndex = 0;
  const stepInterval = 0.15; // ~100 BPM 16-step pattern

  function initContext() {
    if (ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      ctx = new AudioCtx();

      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 0.5;
      masterGain.connect(ctx.destination);

      musicGain = ctx.createGain();
      musicGain.gain.value = 0.35;
      musicGain.connect(masterGain);

      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.15;
      sirenGain.connect(masterGain);

      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineGain.connect(masterGain);

      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.4;
      sfxGain.connect(masterGain);

      // Setup engine oscillator
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 300;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineOsc.start();
    } catch (e) {
      console.error('Audio init error:', e);
    }
  }

  function resume() {
    if (!ctx) {
      initContext();
    }
    if (ctx && ctx.state === 'suspended' && !paused) {
      ctx.resume().catch(() => {});
    }
  }

  function setMuted(m) {
    muted = !!m;
    if (masterGain && ctx) {
      masterGain.gain.setValueAtTime(muted ? 0 : 0.5, ctx.currentTime);
    }
  }

  function isMuted() {
    return muted;
  }

  function setPaused(p) {
    paused = !!p;
    if (!ctx) return;
    try {
      if (paused && ctx.state === 'running') {
        ctx.suspend();
      } else if (!paused && ctx.state === 'suspended' && !muted) {
        ctx.resume();
      }
    } catch (e) {}
  }

  function setSpeed(speed, maxSpeed) {
    if (!ctx || paused) {
      if (engineGain) engineGain.gain.value = 0;
      return;
    }
    const absSpeed = Math.abs(speed);
    if (absSpeed > 5) {
      targetEnginePitch = 50 + (absSpeed / (maxSpeed || 520)) * 250;
      if (engineGain) engineGain.gain.setValueAtTime(0.2, ctx.currentTime);
      if (engineOsc && engineFilter) {
        currentEnginePitch += (targetEnginePitch - currentEnginePitch) * 0.1;
        engineOsc.frequency.setValueAtTime(currentEnginePitch, ctx.currentTime);
        engineFilter.frequency.setValueAtTime(200 + currentEnginePitch * 1.5, ctx.currentTime);
      }
    } else {
      if (engineGain) engineGain.gain.setValueAtTime(0, ctx.currentTime);
    }
  }

  function setWanted(wanted) {
    wantedLevel = wanted;
    if (!ctx || paused) {
      stopSiren();
      return;
    }
    if (wantedLevel > 0) {
      startSiren();
    } else {
      stopSiren();
    }
  }

  function startSiren() {
    if (sirenActive || !ctx) return;
    try {
      sirenOsc1 = ctx.createOscillator();
      sirenOsc2 = ctx.createOscillator();
      sirenOsc1.type = 'sine';
      sirenOsc2.type = 'sine';
      sirenOsc1.connect(sirenGain);
      sirenOsc2.connect(sirenGain);
      sirenOsc1.start();
      sirenOsc2.start();
      sirenActive = true;
    } catch (e) {}
  }

  function stopSiren() {
    if (!sirenActive) return;
    try {
      if (sirenOsc1) { sirenOsc1.stop(); sirenOsc1.disconnect(); sirenOsc1 = null; }
      if (sirenOsc2) { sirenOsc2.stop(); sirenOsc2.disconnect(); sirenOsc2 = null; }
    } catch (e) {}
    sirenActive = false;
  }

  function updateSiren(dt) {
    if (!sirenActive || !ctx || paused || wantedLevel <= 0) return;
    sirenTime += dt * (2 + wantedLevel * 0.5);
    const freq = 600 + Math.sin(sirenTime * 8) * 300;
    const freq2 = 630 + Math.cos(sirenTime * 8) * 300;
    try {
      if (sirenOsc1) sirenOsc1.frequency.setValueAtTime(freq, ctx.currentTime);
      if (sirenOsc2) sirenOsc2.frequency.setValueAtTime(freq2, ctx.currentTime);
    } catch (e) {}
  }

  function setStation(index) {
    currentStationIndex = (index + stationDefs.length) % stationDefs.length;
    trackTime = 0;
    currentTrackIndex = 0;
    return currentStation();
  }

  function stations() {
    return stationDefs.map(s => ({ name: s.name, track: s.tracks[0] }));
  }

  function currentStation() {
    const s = stationDefs[currentStationIndex];
    const track = s.tracks[currentTrackIndex];
    return {
      name: s.name,
      track: track,
      index: currentStationIndex,
      toString() {
        return `${this.name} — ${this.track}`;
      }
    };
  }

  function playNote(freq, type = 'sine', duration = 0.2, vol = 0.2) {
    if (!ctx || paused || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }

  function tick(dt) {
    if (!ctx || paused) return;
    updateSiren(dt);

    trackTime += dt;
    if (trackTime >= 30) {
      trackTime = 0;
      const s = stationDefs[currentStationIndex];
      currentTrackIndex = (currentTrackIndex + 1) % s.tracks.length;
    }

    seqTimer += dt;
    if (seqTimer >= stepInterval) {
      seqTimer -= stepInterval;
      stepIndex = (stepIndex + 1) % 16;
      playStep(currentStationIndex, stepIndex);
    }
  }

  function playStep(stationIdx, step) {
    const scales = [
      [220, 261.63, 329.63, 392, 440, 523.25, 659.25],
      [146.83, 164.81, 174.61, 220, 261.63, 293.66, 349.23],
      [130.81, 164.81, 196, 246.94, 261.63, 329.63, 392]
    ];

    const scale = scales[stationIdx];
    if (stationIdx === 0) {
      if (step % 2 === 0) {
        const note = scale[step % scale.length];
        playNote(note, 'sawtooth', 0.15, 0.15);
      }
      if (step === 0 || step === 8) {
        playNote(scale[0] / 2, 'triangle', 0.4, 0.25);
      }
    } else if (stationIdx === 1) {
      if (step === 0 || step === 3 || step === 6 || step === 10 || step === 14) {
        const note = scale[(step * 2) % scale.length];
        playNote(note, 'sawtooth', 0.12, 0.22);
      }
      if (step % 4 === 2) {
        playNote(scale[5] * 1.5, 'square', 0.08, 0.1);
      }
    } else {
      if (step % 4 === 0) {
        const note = scale[(step / 4) % scale.length];
        playNote(note, 'sine', 0.6, 0.2);
        playNote(note * 1.5, 'sine', 0.5, 0.1);
      }
    }
  }

  function complete() {
    if (!ctx || paused || muted) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.1);
      osc.frequency.setValueAtTime(659.25, now + 0.2);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {}
  }

  function crash() {
    if (!ctx || paused || muted) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      osc.connect(gain);
      gain.connect(sfxGain);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  }

  return {
    resume,
    setSpeed,
    setWanted,
    setStation,
    stations,
    currentStation,
    setMuted,
    isMuted,
    setPaused,
    tick,
    complete,
    crash
  };
}
