// Tampilan & interaksi Bola Tangkas. Teks dalam Bahasa Indonesia; istilah kartu tetap Inggris.
(function () {
  'use strict';

  const T = window.Tangkas;
  const S = window.Sound;
  const FX = window.Effects;
  const { STATE, HAND, HAND_NAME } = T;

  const STORE_KEY = 'bolatangkas.v1';
  const REFILL = 1000;

  const $ = (id) => document.getElementById(id);
  const el = {
    paytable: $('paytable'), cards: $('cards'), message: $('message'),
    credits: $('credits'), bet: $('bet'), win: $('win'), controls: $('controls'),
    doublePanel: $('doublePanel'), doubleCard: $('doubleCard'), doubleLevel: $('doubleLevel'),
    modeJoker: $('modeJoker'), modeClassic: $('modeClassic'),
    btnMusic: $('btnMusic'), btnSfx: $('btnSfx'), btnSize: $('btnSize'), btnRules: $('btnRules'), rules: $('rules'),
  };

  // ---- Penyimpanan (opsional; game tetap jalan tanpa localStorage) ---------
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  const saved = load();
  const prefs = {
    music: saved.music !== false,
    sfx: saved.sfx !== false,
    large: !!saved.large,
  };
  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ credits: g.credits, bet: g.bet, joker: g.joker, ...prefs, seenRules: true }));
    } catch (e) { /* abaikan */ }
  }

  const g = T.createGame({
    credits: saved.credits != null ? saved.credits : REFILL,
    bet: saved.bet || 5,
    joker: saved.joker !== false,
  });
  let busy = false;
  let shownCredits = g.credits;
  let shownWin = 0;
  let litHand = 0;

  const sleep = (ms) => new Promise((r) => setTimeout(r, FX.reduceMotion ? Math.min(ms, 60) : ms));
  const fmt = (n) => n.toLocaleString('id-ID');

  // ---- Kartu ---------------------------------------------------------------
  const RANK = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

  function frontHTML(c) {
    if (c === T.JOKER) {
      return '<div class="face front joker"><div class="pip">★</div><div class="label">JOKER</div></div>';
    }
    const r = T.rankOf(c);
    const s = T.SUITS[T.suitOf(c)];
    const red = T.suitOf(c) === 1 || T.suitOf(c) === 2;
    const label = RANK[r] || String(r);
    const isFace = r >= 11 && r <= 13;
    const corner = `<span>${label}</span><small>${s}</small>`;
    return `<div class="face front${red ? ' red' : ''}${isFace ? ' face-card' : ''}">
      <div class="corner">${corner}</div>
      <div class="pip">${isFace ? label : s}</div>
      <div class="corner br">${corner}</div>
    </div>`;
  }

  function cardName(c) {
    if (c === T.JOKER) return 'Joker';
    const r = T.rankOf(c);
    const names = { 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
    const suits = ['Spade', 'Heart', 'Diamond', 'Club'];
    return `${names[r] || r} ${suits[T.suitOf(c)]}`;
  }

  // Menaruh kartu di slot; selalu tertutup dulu, dibuka dengan flip().
  function place(slot, c, animate) {
    slot.className = 'card down';
    slot.innerHTML = `<div class="inner">${frontHTML(c)}<div class="face back"></div></div>`;
    slot.setAttribute('aria-label', 'Kartu tertutup');
    slot.dataset.card = c;
    if (animate) {
      void slot.offsetWidth;
      slot.classList.add('deal');
    }
  }

  function flip(slot) {
    slot.classList.remove('down');
    slot.setAttribute('aria-label', cardName(Number(slot.dataset.card)));
  }

  function clearSlot(slot) {
    slot.className = 'card empty';
    slot.innerHTML = '';
    slot.removeAttribute('aria-label');
  }

  const slots = [];
  for (let i = 0; i < 7; i++) {
    const s = document.createElement('div');
    clearSlot(s);
    el.cards.appendChild(s);
    slots.push(s);
  }
  const doubleSlot = document.createElement('div');
  el.doubleCard.appendChild(doubleSlot);

  // ---- Tabel bayaran -------------------------------------------------------
  // Baris tabel dibangun ulang saat mode berganti (Five of a Kind hanya ada di mode Joker).
  let payRows = {};
  let payMode = null;

  function buildPaytable() {
    el.paytable.innerHTML = '';
    payRows = {};
    const table = g.paytable();
    for (let h = HAND.FIVE_KIND; h >= HAND.TWO_PAIR; h--) {
      if (!table[h]) continue;
      const row = document.createElement('div');
      row.className = 'pay';
      row.innerHTML = `<span>${HAND_NAME[h]}</span><b></b>`;
      el.paytable.appendChild(row);
      payRows[h] = row;
    }
    payMode = g.joker;
  }

  function renderPaytable() {
    if (payMode !== g.joker) buildPaytable();
    const stake = g.state === STATE.IDLE ? g.bet : g.totalBet;
    const table = g.paytable();
    for (const h in payRows) {
      payRows[h].querySelector('b').textContent = fmt(table[h] * stake);
      payRows[h].classList.toggle('lit', Number(h) === litHand);
    }
  }

  function renderMode() {
    const locked = busy || g.state !== STATE.IDLE;
    el.modeJoker.setAttribute('aria-pressed', String(g.joker));
    el.modeClassic.setAttribute('aria-pressed', String(!g.joker));
    el.modeJoker.disabled = el.modeClassic.disabled = locked;
  }

  function setMode(joker) {
    if (busy || g.joker === joker || !g.setJoker(joker)) return;
    S.click();
    litHand = 0;
    slots.forEach(clearSlot);
    el.doublePanel.hidden = true;
    msg(joker ? 'Mode PAKAI JOKER: Joker bisa jadi kartu apa saja' : 'Mode TANPA JOKER: bayaran kombinasi besar lebih tinggi');
    save();
    render();
  }
  el.modeJoker.addEventListener('click', () => setMode(true));
  el.modeClassic.addEventListener('click', () => setMode(false));

  // ---- Pesan, angka & kontrol ----------------------------------------------
  function msg(text, kind) {
    el.message.textContent = text;
    el.message.className = 'message' + (kind ? ' ' + kind : '');
  }

  function renderStats() {
    el.credits.textContent = fmt(shownCredits);
    el.bet.textContent = fmt(g.state === STATE.IDLE ? g.bet : g.totalBet);
    el.win.textContent = fmt(shownWin);
  }

  function button(label, sub, cls, onClick, opts) {
    opts = opts || {};
    const b = document.createElement('button');
    b.className = 'btn ' + (cls || '');
    b.innerHTML = label + (sub ? `<small>${sub}</small>` : '');
    b.disabled = !!opts.disabled;
    if (opts.primary) b.dataset.primary = '1';
    if (opts.key) b.dataset.key = opts.key;
    b.addEventListener('click', () => { if (!busy && !b.disabled) onClick(); });
    return b;
  }

  function renderControls() {
    const c = el.controls;
    c.innerHTML = '';
    if (busy) return;

    if (g.state === STATE.IDLE) {
      if (g.credits < T.MIN_BET) {
        c.append(button('ISI KREDIT', `+${fmt(REFILL)} kredit gratis`, 'gold pulse', refill, { primary: true }));
        return;
      }
      c.append(
        button('−', '', 'small', () => changeBet(-1), { disabled: g.bet <= T.MIN_BET, key: 'down' }),
        button('+', '', 'small', () => changeBet(1), { disabled: g.bet >= Math.min(T.MAX_BET, g.credits), key: 'up' }),
        button('MAKS', 'taruhan', 'cyan', () => setBet(Math.min(T.MAX_BET, g.credits))),
        button('MAIN', `taruhan ${fmt(g.bet)}`, 'primary pulse', deal, { primary: true }),
      );
    } else if (g.state === STATE.RAISE) {
      c.append(
        button('TAMBAH', `+${fmt(g.bet)} → total ${fmt(g.bet * 2)}`, 'gold', () => reveal(true), { disabled: !g.canRaise() }),
        button('BUKA', '2 kartu terakhir', 'primary', () => reveal(false), { primary: true }),
      );
    } else if (g.state === STATE.WIN) {
      c.append(
        button('DOUBLE', g.canDouble() ? `jadi ${fmt(g.win * 2)}?` : 'maksimal', 'cyan', startDouble, { disabled: !g.canDouble() }),
        button('AMBIL', `${fmt(g.win)} kredit`, 'gold pulse', collect, { primary: true }),
      );
    } else if (g.state === STATE.DOUBLE) {
      c.append(
        button('KECIL', 'A – 6', 'cyan', () => guess('small'), { key: 'left' }),
        button('BESAR', '8 – K', 'primary', () => guess('big'), { key: 'right' }),
      );
    }

    const primary = c.querySelector('[data-primary]') || c.querySelector('button:not(:disabled)');
    if (primary && document.activeElement !== el.rules) primary.focus({ preventScroll: true });
  }

  function render() {
    if (g.state === STATE.IDLE && g.credits >= T.MIN_BET && g.bet > g.credits) g.setBet(g.credits);
    renderMode();
    renderPaytable();
    renderStats();
    renderControls();
  }

  // ---- Aksi ----------------------------------------------------------------
  function setBet(b) {
    g.setBet(b);
    S.click();
    save();
    render();
  }

  function changeBet(d) {
    const max = Math.min(T.MAX_BET, g.credits);
    const steps = [1, 2, 3, 5, 10, 20, 30, 50];
    const next = d > 0
      ? steps.find((s) => s > g.bet) || T.MAX_BET
      : steps.filter((s) => s < g.bet).pop() || T.MIN_BET;
    setBet(Math.min(next, max));
  }

  function refill() {
    g.credits += REFILL;
    if (g.bet > g.credits) g.bet = Math.min(5, g.credits);
    S.coin();
    countTo(g.credits, 0, 700);
    msg(`Kredit ditambah ${fmt(REFILL)}. Selamat bermain!`, 'good');
    save();
    render();
  }

  async function deal() {
    if (!g.deal()) return;
    busy = true;
    litHand = 0;
    shownCredits = g.credits;
    shownWin = 0;
    el.doublePanel.hidden = true;
    msg('Membagikan kartu…');
    save();
    render();

    slots.forEach(clearSlot);
    for (let i = 0; i < 5; i++) {
      place(slots[i], g.cards[i], true);
      S.deal();
      await sleep(110);
    }
    await sleep(200);
    for (let i = 0; i < 5; i++) {
      flip(slots[i]);
      S.flip();
      await sleep(90);
    }
    for (let i = 5; i < 7; i++) slots[i].className = 'card empty';

    const now = T.bestHand(g.cards);
    S.setIntensity(1);
    msg(now.hand ? `Sudah ${HAND_NAME[now.hand]}! Tambah taruhan?` : 'Tambah taruhan atau buka kartu?');
    busy = false;
    render();
  }

  function tierOf(hand) {
    if (hand >= HAND.FOUR_KIND) return 'large';
    if (hand >= HAND.STRAIGHT) return 'medium';
    return 'small';
  }

  function cardsCenter() {
    const r = el.cards.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  async function reveal(raise) {
    const ok = raise ? g.raise() : g.stand();
    if (!ok) return;
    busy = true;
    shownCredits = g.credits;
    if (raise) S.coin();
    msg(raise ? `Taruhan jadi ${fmt(g.totalBet)}. Membuka kartu…` : 'Membuka kartu…');
    render();

    // Dua kartu terakhir dibuka pelan-pelan untuk menambah ketegangan.
    for (let i = 5; i < 7; i++) {
      place(slots[i], g.cards[i], true);
      S.deal();
      await sleep(260);
    }
    for (let i = 5; i < 7; i++) {
      await sleep(i === 6 ? 520 : 300);
      flip(slots[i]);
      S.flip();
    }
    await sleep(380);
    S.setIntensity(0);

    const { hand, indices } = g.result;
    if (g.state === STATE.WIN) {
      slots.forEach((s, i) => s.classList.add(indices.includes(i) ? 'hit' : 'dim'));
      litHand = hand;
      shownWin = g.win;
      const tier = tierOf(hand);
      S.win(tier);
      const [x, y] = cardsCenter();
      FX.burst(x, y, { small: 24, medium: 60, large: 140 }[tier], tier === 'small' ? 'confetti' : 'coin');
      if (tier !== 'small') FX.burst(x, y, tier === 'large' ? 80 : 30, 'confetti');
      FX.shake({ small: 0.15, medium: 0.4, large: 0.85 }[tier]);
      msg(`${HAND_NAME[hand].toUpperCase()}! Menang ${fmt(g.win)}`, 'good');
    } else {
      slots.forEach((s) => s.classList.add('dim'));
      S.lose();
      msg('Belum beruntung. Coba lagi!', 'bad');
    }
    save();
    busy = false;
    render();
  }

  // Animasi angka kredit/menang naik-turun seperti mesin.
  function countTo(credits, win, ms) {
    const c0 = shownCredits, w0 = shownWin, t0 = performance.now();
    let lastCoin = 0;
    return new Promise((resolve) => {
      function step(now) {
        const k = Math.min(1, (now - t0) / ms);
        const e = 1 - Math.pow(1 - k, 3);
        shownCredits = Math.round(c0 + (credits - c0) * e);
        shownWin = Math.round(w0 + (win - w0) * e);
        renderStats();
        if (now - lastCoin > 70 && k < 1) { S.coin(); lastCoin = now; }
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  async function collect() {
    const amount = g.win;
    if (!g.collect()) return;
    busy = true;
    litHand = 0;
    msg(`+${fmt(amount)} kredit`, 'good');
    renderControls();
    await countTo(g.credits, 0, Math.min(1600, 400 + amount * 8));
    el.doublePanel.hidden = true;
    save();
    busy = false;
    msg('Pasang taruhan lalu tekan MAIN');
    render();
  }

  function startDouble() {
    if (!g.double()) return;
    S.click();
    S.setIntensity(1);
    el.doublePanel.hidden = false;
    el.doubleLevel.textContent = `${g.doubleCount + 1}/${T.MAX_DOUBLE}`;
    place(doubleSlot, 0, true);
    msg(`Tebak KECIL atau BESAR untuk ${fmt(g.win * 2)}`);
    render();
  }

  async function guess(choice) {
    busy = true;
    renderControls();
    const res = g.guess(choice);
    place(doubleSlot, g.doubleCard, false);
    await sleep(350);
    flip(doubleSlot);
    S.flip();
    await sleep(450);

    const r = doubleSlot.getBoundingClientRect();
    if (res === 'win') {
      shownWin = g.win;
      S.win('medium');
      FX.burst(r.left + r.width / 2, r.top + r.height / 2, 50, 'coin');
      FX.shake(0.3);
      doubleSlot.classList.add('hit');
      msg(`BENAR! Kemenangan jadi ${fmt(g.win)}`, 'good');
      S.setIntensity(0);
    } else if (res === 'tie') {
      S.tie();
      msg('Kartu 7, SERI! Tebak lagi', '');
      await sleep(900);
      place(doubleSlot, 0, true);
    } else {
      shownWin = 0;
      litHand = 0;
      S.lose();
      S.setIntensity(0);
      doubleSlot.classList.add('dim');
      msg('SALAH! Kemenangan hangus', 'bad');
      save();
    }
    busy = false;
    render();
  }

  // ---- Pengaturan ----------------------------------------------------------
  function applyPrefs() {
    el.btnMusic.setAttribute('aria-pressed', String(prefs.music));
    el.btnSfx.setAttribute('aria-pressed', String(prefs.sfx));
    el.btnSize.setAttribute('aria-pressed', String(prefs.large));
    document.documentElement.dataset.size = prefs.large ? 'large' : '';
    S.setSfx(prefs.sfx);
  }

  el.btnMusic.addEventListener('click', () => {
    prefs.music = !prefs.music;
    S.setMusic(prefs.music);
    applyPrefs();
    save();
  });
  el.btnSfx.addEventListener('click', () => {
    prefs.sfx = !prefs.sfx;
    applyPrefs();
    S.click();
    save();
  });
  el.btnSize.addEventListener('click', () => {
    prefs.large = !prefs.large;
    applyPrefs();
    save();
  });
  el.btnRules.addEventListener('click', () => el.rules.showModal());

  // Layar penuh + kunci landscape (didukung Chrome Android; iPhone tidak mendukung API ini).
  const btnFull = $('btnFull');
  const root = document.documentElement;
  if (root.requestFullscreen) {
    btnFull.hidden = false;
    btnFull.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await root.requestFullscreen({ navigationUI: 'hide' });
          if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(() => {});
        }
      } catch (e) { /* browser menolak, abaikan */ }
    });
    document.addEventListener('fullscreenchange', () => {
      btnFull.setAttribute('aria-pressed', String(!!document.fullscreenElement));
    });
  }
  el.rules.addEventListener('close', () => renderControls());

  // Audio browser hanya boleh mulai setelah interaksi pertama.
  let unlocked = false;
  function unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    if (!prefs.music) S.setMusic(false);
    S.unlock();
  }
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // ---- Keyboard ------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (el.rules.open || busy) return;
    const press = (sel) => {
      const b = el.controls.querySelector(sel);
      if (b && !b.disabled) { e.preventDefault(); b.click(); }
    };
    if (e.key === 'Enter' || e.key === ' ') {
      if (document.activeElement && document.activeElement.closest('.controls')) return; // biar tombol fokus yang jalan
      press('[data-primary]');
    }
    else if (e.key === 'ArrowUp') press('[data-key="up"]');
    else if (e.key === 'ArrowDown') press('[data-key="down"]');
    else if (e.key === 'ArrowLeft') press('[data-key="left"]');
    else if (e.key === 'ArrowRight') press('[data-key="right"]');
  });

  applyPrefs();
  render();
  if (!saved.seenRules) {
    save();
    el.rules.showModal();
  }
})();
