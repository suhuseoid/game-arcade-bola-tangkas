// Efek visual: latar synthwave bergerak, partikel kemenangan, dan screen shake.
// Semua efek bersifat sementara dan kembali diam; dimatikan bila pengguna memilih "kurangi gerakan".
(function (root) {
  'use strict';

  const reduceMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = Math.min(root.devicePixelRatio || 1, 2);

  const bg = document.getElementById('bg');
  const fx = document.getElementById('fx');
  const bctx = bg.getContext('2d');
  const fctx = fx.getContext('2d');
  let W = 0, H = 0;

  function resize() {
    W = root.innerWidth;
    H = root.innerHeight;
    for (const c of [bg, fx]) {
      c.width = W * DPR;
      c.height = H * DPR;
      c.style.width = W + 'px';
      c.style.height = H + 'px';
    }
    bctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    stars = Array.from({ length: Math.round((W * H) / 9000) }, () => ({
      x: Math.random() * W, y: Math.random() * H * 0.55, r: Math.random() * 1.3 + 0.3, p: Math.random() * 6.28,
    }));
  }
  let stars = [];

  // ---- Latar synthwave -----------------------------------------------------
  function drawBg(t) {
    const horizon = H * 0.58;
    const sky = bctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#07021a');
    sky.addColorStop(0.6, '#1d0640');
    sky.addColorStop(1, '#4a0b5c');
    bctx.fillStyle = sky;
    bctx.fillRect(0, 0, W, horizon);

    for (const s of stars) {
      bctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.0012 + s.p));
      bctx.fillStyle = '#fff';
      bctx.fillRect(s.x, s.y, s.r, s.r);
    }
    bctx.globalAlpha = 1;

    // Matahari bergaris.
    const r = Math.min(W, H) * 0.22, cx = W / 2, cy = horizon - r * 0.35;
    const sun = bctx.createLinearGradient(0, cy - r, 0, cy + r);
    sun.addColorStop(0, '#ffe66d');
    sun.addColorStop(0.5, '#ff7b54');
    sun.addColorStop(1, '#ff2e97');
    bctx.save();
    bctx.shadowColor = '#ff2e97';
    bctx.shadowBlur = 60;
    bctx.beginPath();
    bctx.arc(cx, cy, r, 0, Math.PI * 2);
    bctx.fillStyle = sun;
    bctx.fill();
    bctx.restore();
    bctx.fillStyle = '#1d0640';
    for (let i = 0; i < 6; i++) {
      const y = cy + r * (0.1 + i * 0.16) + ((t * 0.01) % (r * 0.16));
      bctx.fillRect(cx - r, y, r * 2, 2 + i * 1.4);
    }
    bctx.fillStyle = '#4a0b5c';
    bctx.fillRect(0, horizon - 1, W, H);

    // Lantai grid perspektif.
    const ground = bctx.createLinearGradient(0, horizon, 0, H);
    ground.addColorStop(0, '#12002b');
    ground.addColorStop(1, '#05010f');
    bctx.fillStyle = ground;
    bctx.fillRect(0, horizon, W, H - horizon);
    bctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
    bctx.lineWidth = 1.2;
    bctx.shadowColor = '#00f0ff';
    bctx.shadowBlur = 8;
    bctx.beginPath();
    const lines = 22;
    for (let i = -lines; i <= lines; i++) {
      bctx.moveTo(cx + i * (W / lines) * 0.12, horizon);
      bctx.lineTo(cx + i * (W / lines) * 2.2, H);
    }
    const offset = (t * 0.00035) % 1;
    for (let i = 0; i < 14; i++) {
      const z = (i + offset) / 14;
      const y = horizon + (H - horizon) * z * z;
      bctx.moveTo(0, y);
      bctx.lineTo(W, y);
    }
    bctx.stroke();
    bctx.shadowBlur = 0;

    const glow = bctx.createLinearGradient(0, horizon - 40, 0, horizon + 40);
    glow.addColorStop(0, 'rgba(255,46,151,0)');
    glow.addColorStop(0.5, 'rgba(255,46,151,0.45)');
    glow.addColorStop(1, 'rgba(255,46,151,0)');
    bctx.fillStyle = glow;
    bctx.fillRect(0, horizon - 40, W, 80);
  }

  // ---- Partikel ------------------------------------------------------------
  const parts = [];
  const COLORS = ['#ffd84d', '#ff2e97', '#00f0ff', '#9dff6a', '#ffffff'];

  function burst(x, y, count, kind) {
    if (reduceMotion) count = Math.min(count, 12);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * (kind === 'coin' ? 9 : 7);
      parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 6,
        life: 1,
        decay: 0.008 + Math.random() * 0.01,
        size: kind === 'coin' ? 7 + Math.random() * 5 : 4 + Math.random() * 5,
        rot: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.4,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        kind,
      });
    }
  }

  function sparkle(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      parts.push({ x, y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, life: 1, decay: 0.04, size: 3, rot: 0, vr: 0, color: '#fff7c2', kind: 'spark' });
    }
  }

  function drawParts() {
    fctx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.kind === 'spark' ? 0 : 0.28;
      p.vx *= 0.99;
      p.rot += p.vr;
      p.life -= p.decay;
      if (p.life <= 0 || p.y > H + 40) { parts.splice(i, 1); continue; }
      fctx.save();
      fctx.globalAlpha = Math.min(1, p.life * 1.5);
      fctx.translate(p.x, p.y);
      fctx.rotate(p.rot);
      if (p.kind === 'coin') {
        // Koin emas berputar (lebar menyempit seperti berotasi).
        const w = p.size * Math.abs(Math.cos(p.rot * 2));
        fctx.fillStyle = '#ffcf33';
        fctx.strokeStyle = '#a86b00';
        fctx.lineWidth = 1.5;
        fctx.beginPath();
        fctx.ellipse(0, 0, Math.max(w, 1), p.size, 0, 0, Math.PI * 2);
        fctx.fill();
        fctx.stroke();
      } else {
        fctx.fillStyle = p.color;
        fctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      fctx.restore();
    }
  }

  // ---- Screen shake (trauma meluruh, shake = trauma²) ----------------------
  const machine = document.getElementById('machine');
  let trauma = 0;

  function shake(amount) {
    if (reduceMotion) return;
    trauma = Math.min(1, trauma + amount);
  }

  function applyShake(dt, t) {
    if (trauma <= 0) return;
    trauma = Math.max(0, trauma - 1.4 * dt);
    const s = trauma * trauma;
    const x = 14 * s * Math.sin(t * 0.05);
    const y = 9 * s * Math.sin(t * 0.067);
    const r = 0.8 * s * Math.sin(t * 0.031);
    machine.style.transform = trauma > 0 ? `translate(${x}px, ${y}px) rotate(${r}deg)` : '';
  }

  let last = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    drawBg(reduceMotion ? 0 : t);
    drawParts();
    applyShake(dt, t);
    root.requestAnimationFrame(frame);
  }

  root.addEventListener('resize', resize);
  resize();
  root.requestAnimationFrame(frame);

  root.Effects = { burst, sparkle, shake, reduceMotion };
})(window);
