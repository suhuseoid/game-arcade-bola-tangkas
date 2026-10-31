// Logika inti Bola Tangkas (7PK / Joker Poker).
// Murni tanpa DOM, supaya bisa dites di Node dan mudah di-port ke Dart/Flutter.
//
// Kartu direpresentasikan sebagai angka:
//   0..51 -> kartu biasa, rank = (c % 13) + 2 (2..14, 14 = As), suit = floor(c / 13)
//   52    -> Joker
(function (root) {
  'use strict';

  const JOKER = 52;
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANK_LABEL = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

  // Urutan kategori dari terendah ke tertinggi.
  const HAND = {
    NONE: 0,
    TWO_PAIR: 1,
    THREE_KIND: 2,
    STRAIGHT: 3,
    FLUSH: 4,
    FULL_HOUSE: 5,
    FOUR_KIND: 6,
    STRAIGHT_FLUSH: 7,
    ROYAL_FLUSH: 8,
    FIVE_KIND: 9,
  };

  const HAND_NAME = {
    0: 'Tidak Ada',
    1: 'Two Pair',
    2: 'Three of a Kind',
    3: 'Straight',
    4: 'Flush',
    5: 'Full House',
    6: 'Four of a Kind',
    7: 'Straight Flush',
    8: 'Royal Flush',
    9: 'Five of a Kind',
  };

  // Pengali kemenangan terhadap total taruhan, per mode. Disetel lewat tools/simulate.js
  // supaya RTP ≈ 84% tanpa TAMBAH dan ≈ 100% bila TAMBAH dipakai dengan jeli.
  const PAYTABLES = {
    joker: { 9: 150, 8: 80, 7: 30, 6: 10, 5: 4, 4: 3, 3: 2, 2: 1, 1: 1 },
    classic: { 8: 500, 7: 100, 6: 30, 5: 6, 4: 4, 3: 3, 2: 2, 1: 1 },
  };
  const PAYTABLE = PAYTABLES.joker;
  const paytableFor = (joker) => (joker ? PAYTABLES.joker : PAYTABLES.classic);

  const rankOf = (c) => (c % 13) + 2;
  const suitOf = (c) => Math.floor(c / 13);

  function cardLabel(c) {
    if (c === JOKER) return 'JOKER';
    const r = rankOf(c);
    return (RANK_LABEL[r] || String(r)) + SUITS[suitOf(c)];
  }

  function newDeck(withJoker) {
    const deck = [];
    for (let i = 0; i < 52; i++) deck.push(i);
    if (withJoker) deck.push(JOKER);
    return deck;
  }

  function shuffle(deck, rng) {
    rng = rng || Math.random;
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = deck[i];
      deck[i] = deck[j];
      deck[j] = t;
    }
    return deck;
  }

  // Menilai 5 kartu yang diberikan sebagai pasangan array rank & suit (tanpa Joker).
  function evalRanks(ranks, suits) {
    const counts = new Array(15).fill(0);
    for (let i = 0; i < 5; i++) counts[ranks[i]]++;

    let pairs = 0, three = false, four = false, five = false, distinct = 0;
    for (let r = 2; r <= 14; r++) {
      const n = counts[r];
      if (n === 0) continue;
      distinct++;
      if (n === 5) five = true;
      else if (n === 4) four = true;
      else if (n === 3) three = true;
      else if (n === 2) pairs++;
    }
    if (five) return HAND.FIVE_KIND;

    const flush = suits.every((s) => s === suits[0]);
    let straight = false, royal = false;
    if (distinct === 5) {
      let min = 15, max = 0;
      for (let i = 0; i < 5; i++) {
        if (ranks[i] < min) min = ranks[i];
        if (ranks[i] > max) max = ranks[i];
      }
      if (max - min === 4) {
        straight = true;
        royal = min === 10;
      } else if (counts[14] && counts[2] && counts[3] && counts[4] && counts[5]) {
        straight = true; // A-2-3-4-5
      }
    }

    if (straight && flush) return royal ? HAND.ROYAL_FLUSH : HAND.STRAIGHT_FLUSH;
    if (four) return HAND.FOUR_KIND;
    if (three && pairs === 1) return HAND.FULL_HOUSE;
    if (flush) return HAND.FLUSH;
    if (straight) return HAND.STRAIGHT;
    if (three) return HAND.THREE_KIND;
    if (pairs === 2) return HAND.TWO_PAIR;
    return HAND.NONE;
  }

  // Menilai tepat 5 kartu; Joker diganti kartu apa pun yang paling menguntungkan.
  function evalFive(cards) {
    const ranks = [], suits = [];
    let jokerAt = -1;
    for (let i = 0; i < 5; i++) {
      if (cards[i] === JOKER) {
        jokerAt = i;
        ranks.push(0);
        suits.push(0);
      } else {
        ranks.push(rankOf(cards[i]));
        suits.push(suitOf(cards[i]));
      }
    }
    if (jokerAt < 0) return evalRanks(ranks, suits);

    let best = HAND.NONE;
    for (let r = 2; r <= 14 && best < HAND.FIVE_KIND; r++) {
      for (let s = 0; s < 4; s++) {
        ranks[jokerAt] = r;
        suits[jokerAt] = s;
        const v = evalRanks(ranks, suits);
        if (v > best) best = v;
      }
    }
    return best;
  }

  // Mencari kombinasi 5 kartu terbaik dari 5..7 kartu.
  // Mengembalikan { hand, indices } dengan indices = posisi kartu pembentuk kombinasi.
  function bestHand(cards) {
    const n = cards.length;
    let best = { hand: HAND.NONE, indices: [] };
    const pick = [0, 0, 0, 0, 0];
    const five = [0, 0, 0, 0, 0];

    (function choose(start, depth) {
      if (depth === 5) {
        for (let i = 0; i < 5; i++) five[i] = cards[pick[i]];
        const h = evalFive(five);
        if (h > best.hand) best = { hand: h, indices: pick.slice() };
        return;
      }
      for (let i = start; i <= n - (5 - depth); i++) {
        pick[depth] = i;
        choose(i + 1, depth + 1);
      }
    })(0, 0);

    if (best.hand === HAND.NONE) best.indices = [];
    else best.indices = trimIndices(cards, best);
    return best;
  }

  // Untuk Two Pair / Three / Four of a Kind, kartu "kicker" tidak ikut disorot.
  function trimIndices(cards, best) {
    if (![HAND.TWO_PAIR, HAND.THREE_KIND, HAND.FOUR_KIND].includes(best.hand)) {
      return best.indices;
    }
    const counts = {};
    for (const i of best.indices) {
      if (cards[i] === JOKER) continue;
      const r = rankOf(cards[i]);
      counts[r] = (counts[r] || 0) + 1;
    }
    return best.indices.filter((i) => cards[i] === JOKER || counts[rankOf(cards[i])] >= 2);
  }

  // ---------------------------------------------------------------------------
  // Mesin status permainan.
  //
  // Alur satu ronde:
  //   IDLE   --deal()-->   RAISE   (5 kartu terbuka, boleh tambah taruhan)
  //   RAISE  --raise()/stand()--> 2 kartu terakhir dibuka, lalu:
  //            menang -> WIN, kalah -> IDLE
  //   WIN    --collect()--> IDLE (kemenangan masuk kredit)
  //   WIN    --double()-->  DOUBLE (tebak Kecil/Besar)
  //   DOUBLE --guess('small'|'big')--> WIN (menang x2) / IDLE (kalah) / DOUBLE (seri)
  // ---------------------------------------------------------------------------
  const STATE = { IDLE: 'IDLE', RAISE: 'RAISE', WIN: 'WIN', DOUBLE: 'DOUBLE' };
  const MIN_BET = 1;
  const MAX_BET = 50;
  const MAX_DOUBLE = 5;

  // Nilai kartu untuk Double: As = 1, J/Q/K = 11/12/13. 7 = seri.
  function doubleValue(c) {
    const r = rankOf(c);
    return r === 14 ? 1 : r;
  }

  function createGame(opts) {
    opts = opts || {};
    const rng = opts.rng || Math.random;

    const g = {
      state: STATE.IDLE,
      credits: opts.credits != null ? opts.credits : 1000,
      bet: opts.bet || 5,
      joker: opts.joker !== false,
      totalBet: 0,
      cards: [],
      result: null,
      win: 0,
      doubleCount: 0,
      doubleCard: null,
      deck: [],
    };

    function draw() {
      return g.deck.pop();
    }

    g.setBet = function (b) {
      if (g.state !== STATE.IDLE) return false;
      g.bet = Math.max(MIN_BET, Math.min(MAX_BET, b));
      return true;
    };

    // Mode Joker hanya bisa diganti di antara ronde.
    g.setJoker = function (on) {
      if (g.state !== STATE.IDLE) return false;
      g.joker = !!on;
      return true;
    };

    g.paytable = () => paytableFor(g.joker);

    g.canDeal = () => g.state === STATE.IDLE && g.credits >= g.bet;
    g.canRaise = () => g.state === STATE.RAISE && g.credits >= g.bet;

    g.deal = function () {
      if (!g.canDeal()) return false;
      g.credits -= g.bet;
      g.totalBet = g.bet;
      g.deck = shuffle(newDeck(g.joker), rng);
      g.cards = [draw(), draw(), draw(), draw(), draw()];
      g.result = null;
      g.win = 0;
      g.doubleCount = 0;
      g.doubleCard = null;
      g.state = STATE.RAISE;
      return true;
    };

    function finish() {
      g.cards.push(draw(), draw());
      g.result = bestHand(g.cards);
      g.win = (g.paytable()[g.result.hand] || 0) * g.totalBet;
      g.state = g.win > 0 ? STATE.WIN : STATE.IDLE;
    }

    // Tambah taruhan sebesar taruhan awal (total jadi 2x) sebelum 2 kartu terakhir dibuka.
    g.raise = function () {
      if (!g.canRaise()) return false;
      g.credits -= g.bet;
      g.totalBet += g.bet;
      finish();
      return true;
    };

    g.stand = function () {
      if (g.state !== STATE.RAISE) return false;
      finish();
      return true;
    };

    g.collect = function () {
      if (g.state !== STATE.WIN) return false;
      g.credits += g.win;
      g.state = STATE.IDLE;
      return true;
    };

    g.canDouble = () => g.state === STATE.WIN && g.doubleCount < MAX_DOUBLE;

    g.double = function () {
      if (!g.canDouble()) return false;
      g.doubleCard = null;
      g.state = STATE.DOUBLE;
      return true;
    };

    // Mengembalikan 'win' | 'lose' | 'tie'.
    g.guess = function (choice) {
      if (g.state !== STATE.DOUBLE) return null;
      g.doubleCard = shuffle(newDeck(false), rng)[0];
      const v = doubleValue(g.doubleCard);
      if (v === 7) return 'tie';
      const isBig = v > 7;
      if ((choice === 'big') === isBig) {
        g.win *= 2;
        g.doubleCount++;
        g.state = STATE.WIN;
        return 'win';
      }
      g.win = 0;
      g.state = STATE.IDLE;
      return 'lose';
    };

    return g;
  }

  const api = {
    JOKER, SUITS, HAND, HAND_NAME, PAYTABLE, PAYTABLES, paytableFor, STATE, MIN_BET, MAX_BET, MAX_DOUBLE,
    rankOf, suitOf, cardLabel, newDeck, shuffle, evalFive, bestHand, doubleValue, createGame,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tangkas = api;
})(typeof window !== 'undefined' ? window : globalThis);
