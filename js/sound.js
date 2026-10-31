// Audio Bola Tangkas: musik chiptune orisinal + efek suara, semuanya disintesis WebAudio.
//
// Jalur (bus):  music ─┐
//                       ├─> master ─> limiter ─> speaker
//               sfx ───┘
// Musik punya dua lapis: dasar (lead, bass, kick/snare) dan "tegang" (arpeggio + hi-hat 16-an)
// yang dinaikkan saat momen menegangkan (setIntensity).
(function (root) {
  'use strict';

  const BPM = 118;
  const STEP = 60 / BPM / 4; // durasi 1/16 not (detik)
  const LOOKAHEAD = 0.12;

  // Akor per birama: [nada dasar bass (MIDI), nada triad].
  const CHORDS = {
    C: [48, [60, 64, 67]], Am: [45, [57, 60, 64]], F: [41, [53, 57, 60]], G: [43, [55, 59, 62]],
    Em: [40, [52, 55, 59]], Dm: [38, [50, 53, 57]],
  };
  const PROG = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G', 'Am', 'Em', 'F', 'C', 'Dm', 'G', 'C', 'G'];

  // Melodi: tiap birama = daftar [nada, panjang dalam 1/8]; null = diam. Total 8 per birama.
  const N = { G4: 67, A4: 69, B4: 71, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79, A5: 81, B5: 83, C6: 84, D6: 86, E6: 88, F6: 89, G6: 91, A6: 93 };
  const MELODY = [
    [['E5', 1], ['G5', 1], ['C6', 2], ['B5', 1], ['C6', 1], ['G5', 2]],
    [['A5', 1], ['C6', 1], ['E6', 2], ['D6', 1], ['C6', 1], ['A5', 2]],
    [['F5', 1], ['A5', 1], ['C6', 2], ['A5', 1], ['C6', 1], ['D6', 2]],
    [['D6', 1], ['C6', 1], ['B5', 1], ['A5', 1], ['G5', 4]],
    [['E5', 1], ['G5', 1], ['C6', 2], ['E6', 2], ['D6', 1], ['C6', 1]],
    [['A5', 2], ['C6', 1], ['E6', 1], ['A6', 2], ['G6', 2]],
    [['F6', 1], ['E6', 1], ['D6', 1], ['C6', 1], ['A5', 2], ['C6', 2]],
    [['B5', 2], ['D6', 2], ['G6', 3], [null, 1]],
    [['C6', 2], ['B5', 1], ['A5', 1], ['E5', 4]],
    [['G5', 2], ['A5', 1], ['B5', 1], ['E5', 4]],
    [['A5', 2], ['C6', 1], ['F6', 1], ['E6', 2], ['C6', 2]],
    [['G5', 2], ['E5', 1], ['G5', 1], ['C6', 4]],
    [['F5', 1], ['A5', 1], ['D6', 2], ['F6', 2], ['E6', 1], ['D6', 1]],
    [['B5', 1], ['D6', 1], ['G6', 2], ['F6', 1], ['E6', 1], ['D6', 2]],
    [['E6', 2], ['C6', 1], ['G5', 1], ['E6', 2], ['D6', 2]],
    [['D6', 1], ['B5', 1], ['G5', 1], ['B5', 1], ['D6', 4]],
  ].map((bar) => {
    // Ubah ke daftar event { step (1/16 dalam birama), midi, len (1/16) }.
    const out = [];
    let pos = 0;
    for (const [name, len] of bar) {
      if (name) out.push({ step: pos * 2, midi: N[name] - 12, len: len * 2 });
      pos += len;
    }
    return out;
  });

  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const dbGain = (db) => Math.pow(10, db / 20);

  let ctx = null, master, musicBus, sfxBus, tenseBus, pulse, noise;
  let musicOn = true, sfxOn = true, playing = false;
  let nextTime = 0, stepIndex = 0, timer = null, intensity = 0;

  function init() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.1;
    limiter.connect(ctx.destination);

    master = ctx.createGain();
    master.gain.value = dbGain(-4);
    master.connect(limiter);

    musicBus = ctx.createGain();
    musicBus.gain.value = musicOn ? dbGain(-10) : 0;
    musicBus.connect(master);

    tenseBus = ctx.createGain();
    tenseBus.gain.value = 0;
    tenseBus.connect(musicBus);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxOn ? dbGain(-3) : 0;
    sfxBus.connect(master);

    // Gelombang pulse 25% ala chip suara konsol lama.
    const n = 32, real = new Float32Array(n), imag = new Float32Array(n);
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    pulse = ctx.createPeriodicWave(real, imag);

    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (musicOn && !playing) startMusic();
  }

  // ---- Instrumen -----------------------------------------------------------
  function note(bus, t, freq, dur, opts) {
    opts = opts || {};
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    if (opts.wave === 'pulse') osc.setPeriodicWave(pulse);
    else osc.type = opts.wave || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t + dur);
    if (opts.vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(freq * 0.012, t + Math.min(dur, 0.35));
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    const vol = opts.vol || 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.setValueAtTime(vol * (opts.sustain || 0.7), t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function drum(bus, t, kind) {
    if (kind === 'kick') {
      note(bus, t, 140, 0.18, { wave: 'sine', slideTo: 40, vol: 0.9, sustain: 0.5 });
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const hat = kind === 'hat';
    f.type = hat ? 'highpass' : 'bandpass';
    f.frequency.value = hat ? 7000 : 1800;
    const dur = hat ? 0.04 : 0.14;
    g.gain.setValueAtTime(hat ? 0.18 : 0.45, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  // ---- Sequencer (jadwal pakai jam audio, bukan frame) --------------------
  function scheduleStep(i, t) {
    const bar = Math.floor(i / 16) % PROG.length;
    const s = i % 16;
    const [root, triad] = CHORDS[PROG[bar]];

    for (const ev of MELODY[bar]) {
      if (ev.step === s) note(musicBus, t, midiHz(ev.midi), ev.len * STEP * 0.95, { wave: 'pulse', vol: 0.22, vibrato: ev.len >= 4 });
    }
    if (s % 2 === 0) {
      const oct = (s / 2) % 2 === 0 ? 0 : 12;
      note(musicBus, t, midiHz(root + oct), STEP * 1.8, { wave: 'triangle', vol: 0.5, sustain: 0.9 });
    }
    if (s % 8 === 0) drum(musicBus, t, 'kick');
    if (s % 8 === 4) drum(musicBus, t, 'snare');
    if (s % 4 === 2) drum(musicBus, t, 'hat');

    // Lapisan "tegang".
    note(tenseBus, t, midiHz(triad[s % 3] + 12), STEP * 0.9, { wave: 'square', vol: 0.07, sustain: 0.4 });
    if (s % 2 === 1) drum(tenseBus, t, 'hat');
  }

  function tick() {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(stepIndex, nextTime);
      nextTime += STEP;
      stepIndex++;
    }
  }

  function startMusic() {
    if (!ctx || playing) return;
    playing = true;
    stepIndex = 0;
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(tick, 25);
  }

  function stopMusic() {
    playing = false;
    clearInterval(timer);
  }

  function ramp(param, value, secs) {
    const t = ctx.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(value, t + secs);
  }

  // Musik mengecil sebentar saat jingle menang.
  function duck(secs) {
    if (!ctx || !musicOn) return;
    const t = ctx.currentTime, full = dbGain(-10);
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(musicBus.gain.value, t);
    musicBus.gain.linearRampToValueAtTime(full * dbGain(-14), t + 0.05);
    musicBus.gain.setValueAtTime(full * dbGain(-14), t + secs);
    musicBus.gain.linearRampToValueAtTime(full, t + secs + 0.6);
  }

  // ---- Efek suara ----------------------------------------------------------
  const vary = () => 0.96 + Math.random() * 0.08;

  function sfx(fn) {
    if (!ctx || !sfxOn) return;
    fn(ctx.currentTime);
  }

  function arp(notes, step, opts) {
    sfx((t) => notes.forEach((m, i) => note(sfxBus, t + i * step, midiHz(m), step * 1.2, opts)));
  }

  const Sound = {
    unlock,
    setMusic(on) {
      musicOn = on;
      if (!init()) return;
      ramp(musicBus.gain, on ? dbGain(-10) : 0, 0.3);
      if (on) { if (ctx.state === 'suspended') ctx.resume(); startMusic(); }
      else setTimeout(() => { if (!musicOn) stopMusic(); }, 400);
    },
    setSfx(on) {
      sfxOn = on;
      if (ctx) ramp(sfxBus.gain, on ? dbGain(-3) : 0, 0.05);
    },
    musicOn: () => musicOn,
    sfxOn: () => sfxOn,
    // 0 = santai, 1 = tegang.
    setIntensity(v) {
      intensity = v;
      if (ctx) ramp(tenseBus.gain, v ? 1 : 0, v ? 0.4 : 1.2);
    },

    click() { sfx((t) => note(sfxBus, t, 1200 * vary(), 0.04, { vol: 0.12 })); },
    deal() { sfx((t) => note(sfxBus, t, 1600 * vary(), 0.05, { wave: 'pulse', slideTo: 800, vol: 0.14 })); },
    flip() { sfx((t) => note(sfxBus, t, 500 * vary(), 0.08, { wave: 'triangle', slideTo: 1400, vol: 0.25 })); },
    coin() { sfx((t) => { note(sfxBus, t, 1976 * vary(), 0.05, { vol: 0.08 }); note(sfxBus, t + 0.05, 2637, 0.12, { vol: 0.08 }); }); },
    lose() { arp([67, 63, 60, 55], 0.13, { wave: 'triangle', vol: 0.35 }); },
    tie() { arp([72, 72], 0.1, { wave: 'pulse', vol: 0.2 }); },
    // tier: 'small' | 'medium' | 'large'
    win(tier) {
      const seqs = {
        small: [[72, 76, 79, 84], 0.08],
        medium: [[72, 76, 79, 84, 79, 84, 88], 0.08],
        large: [[72, 76, 79, 84, 76, 79, 84, 88, 79, 84, 88, 91, 96], 0.075],
      };
      const [notes, step] = seqs[tier] || seqs.small;
      duck(notes.length * step + 0.2);
      arp(notes, step, { wave: 'pulse', vol: 0.25 });
      arp(notes.map((m) => m - 12), step, { wave: 'triangle', vol: 0.3 });
    },
  };

  root.Sound = Sound;
})(window);
