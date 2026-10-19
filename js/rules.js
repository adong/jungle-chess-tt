/* TT Jungle Chess: the rules, the CPU and your brother's hint. No Three.js and no page in here: the same file runs
   the game and the headless checks (js/check.js, tools/check.js).

   The board is 7 columns by 9 rows. Square i = row * 7 + col, row 0 at the top (orange's end), row 8 at the bottom
   (blue's end). Blue is side 0 (Teddy's colour), orange is side 1 (Tommy's colour).
   A square holds 0 (empty) or a piece: side * 8 + rank, rank 1 (rat) .. 8 (elephant). Each side has one of each
   animal, so the number is also the piece's name (id = value - 1, 0..15).

   The classic rules:
     - one square up, down, left or right; you can't go into your own den
     - capture an enemy of equal or lower rank; the rat beats the elephant, the elephant can't beat the rat
     - only the rat swims. A rat in the water can't be caught from land and can't catch anyone on land from the water;
       it can catch the other rat in the water
     - the lion and the tiger jump straight over a river (along a row or a column), unless a rat is in the water there
     - an enemy standing in one of YOUR traps has rank 0: any of your pieces can catch it
     - walk into the enemy den and win; catch all the enemy pieces, or leave them no move, and win too
     - LIMIT moves in all with no winner is a draw, so every game ends */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const JC = (root.JC = root.JC || {});

  const COLS = 7, ROWS = 9, N = COLS * ROWS;
  const BLUE = 0, ORANGE = 1;
  const RAT = 1, CAT = 2, DOG = 3, WOLF = 4, LEOPARD = 5, TIGER = 6, LION = 7, ELEPHANT = 8;
  const NAMES = ['', 'RAT', 'CAT', 'DOG', 'WOLF', 'LEOPARD', 'TIGER', 'LION', 'ELEPHANT'];
  const EMOJI = ['', '🐭', '🐱', '🐶', '🐺', '🐆', '🐯', '🦁', '🐘'];
  const LIMIT = 240; // moves in all (120 each) with no winner: a draw

  // How the CPU levels play (js/check.js measures them: node tools/check.js rates)
  const EASY = { den: 0.6, capture: 0.45, careful: 0.35, forward: 0.3 }; // chances: take an open den, a capture, dodge a bonk, head for your den
  const NORMAL = { depth: 2, noise: 6 };                                    // look-ahead (its move and your answer, then any swaps) and a little randomness
  const HINT = { depth: 4 };                                                // your brother looks further ahead than Bolt

  const idx = (c, r) => r * COLS + c;
  const colOf = (i) => i % COLS;
  const rowOf = (i) => (i / COLS) | 0;
  const sideOf = (v) => (v > 8 ? 1 : 0);
  const rankOf = (v) => (v > 8 ? v - 8 : v);
  const piece = (side, rank) => side * 8 + rank;

  const DEN = [idx(3, 8), idx(3, 0)]; // DEN[side]: blue's den at the bottom, orange's at the top
  const TRAPS = [[idx(2, 8), idx(4, 8), idx(3, 7)], [idx(2, 0), idx(4, 0), idx(3, 1)]];
  const water = new Uint8Array(N);
  for (let r = 3; r <= 5; r++) for (const c of [1, 2, 4, 5]) water[idx(c, r)] = 1;
  const trapOwner = new Int8Array(N).fill(-1);
  TRAPS.forEach((list, s) => list.forEach((i) => (trapOwner[i] = s)));

  // the standard start: orange at the top, blue the same turned round
  const START = [[LION, 0, 0], [TIGER, 6, 0], [DOG, 1, 1], [CAT, 5, 1], [RAT, 0, 2], [LEOPARD, 2, 2], [WOLF, 4, 2], [ELEPHANT, 6, 2]];

  // neighbours, and the lion and tiger's jumps over the rivers: { to, over: [water squares] }
  const adj = [], jumps = [];
  for (let i = 0; i < N; i++) {
    const c = colOf(i), r = rowOf(i);
    adj[i] = [];
    jumps[i] = [];
    for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      const n = idx(nc, nr);
      adj[i].push(n);
      if (water[i] || !water[n]) continue;
      const over = [];
      let jc = nc, jr = nr;
      while (jc >= 0 && jc < COLS && jr >= 0 && jr < ROWS && water[idx(jc, jr)]) {
        over.push(idx(jc, jr));
        jc += dc;
        jr += dr;
      }
      if (jc >= 0 && jc < COLS && jr >= 0 && jr < ROWS) jumps[i].push({ to: idx(jc, jr), over });
    }
  }
  const isAdj = (a, b) => adj[a].includes(b);

  // A test can switch one rule off to prove the checks notice (js/check.js --sabotage).
  let bug = null;
  const setBug = (b) => (bug = b || null);

  // ---------------------------------------------------------------- the rules

  // Can the piece on `from` catch the enemy on `to`? (Both squares are filled, different sides.)
  function canCapture(b, from, to) {
    const a = b[from], d = b[to];
    const ra = rankOf(a), rd = rankOf(d), sa = sideOf(a);
    if (water[from] && !water[to] && bug !== 'ratwater') return false; // no catching on land straight out of the water
    if (!water[from] && water[to]) return false;                     // a rat in the water is safe from land
    if (trapOwner[to] === sa && bug !== 'notrap') return true;       // an enemy in your trap has rank 0
    if (trapOwner[to] === 1 - sa && bug === 'owntrap') return true;
    if (ra === RAT && rd === ELEPHANT) return true;
    if (ra === ELEPHANT && rd === RAT && bug !== 'elephantrat') return false;
    return ra >= rd;
  }

  // Can the piece on `from` (side s, rank) go to `to`? Steps only check the square; jumps check the river first.
  function canEnter(b, from, to, s, rank) {
    if (to === DEN[s] && bug !== 'ownden') return false;
    if (water[to] && rank !== RAT) return false;
    const t = b[to];
    if (!t) return true;
    if (sideOf(t) === s) return false;
    return canCapture(b, from, to);
  }

  const jumpClear = (b, j) => bug === 'nojumpblock' || j.over.every((w) => !b[w]);

  // Every legal move for side s, as numbers from * 64 + to.
  function gen(b, s, out = []) {
    out.length = 0;
    for (let i = 0; i < N; i++) {
      const v = b[i];
      if (!v || sideOf(v) !== s) continue;
      const rank = rankOf(v);
      for (const n of adj[i]) if (canEnter(b, i, n, s, rank)) out.push(i * 64 + n);
      if (rank === LION || rank === TIGER) {
        for (const j of jumps[i]) if (jumpClear(b, j) && canEnter(b, i, j.to, s, rank)) out.push(i * 64 + j.to);
      }
    }
    return out;
  }

  function newGame(starter = BLUE) {
    const b = new Int8Array(N);
    for (const [rank, c, r] of START) {
      b[idx(c, r)] = piece(ORANGE, rank);
      b[idx(COLS - 1 - c, ROWS - 1 - r)] = piece(BLUE, rank);
    }
    return { b, turn: starter, starter, ply: 0, over: false, winner: -1, reason: '', last: null, naps: [], limit: LIMIT };
  }

  function clone(st) {
    return { b: st.b.slice(), turn: st.turn, starter: st.starter, ply: st.ply, over: st.over, winner: st.winner, reason: st.reason, last: st.last && { ...st.last }, lastBy: st.lastBy && st.lastBy.slice(), naps: st.naps.slice(), limit: st.limit };
  }

  const count = (b, s) => {
    let n = 0;
    for (let i = 0; i < N; i++) if (b[i] && sideOf(b[i]) === s) n++;
    return n;
  };

  const legalFrom = (st, from) => (st.over ? [] : gen(st.b, st.turn).filter((m) => m >> 6 === from).map((m) => m & 63));
  const isLegal = (st, from, to) => !st.over && gen(st.b, st.turn).includes(from * 64 + to);

  // What a move would be, for the highlights: step, swim, jump, capture, into the enemy trap, into the enemy den.
  function describe(b, from, to) {
    const v = b[from], s = sideOf(v), t = b[to];
    return {
      from, to, jump: !isAdj(from, to), capture: t ? t - 1 : -1, swim: !!water[to] && !water[from], water: !!water[to],
      trap: trapOwner[to] === 1 - s, den: to === DEN[1 - s],
    };
  }

  // Play move (from, to) for the side to move. Returns what happened (for the animations), or null if illegal.
  function play(st, from, to) {
    if (!isLegal(st, from, to)) return null;
    const ev = describe(st.b, from, to);
    const v = st.b[from], s = sideOf(v);
    ev.id = v - 1;
    ev.side = s;
    ev.rank = rankOf(v);
    st.b[to] = v;
    st.b[from] = 0;
    if (ev.capture >= 0) st.naps.push(ev.capture);
    st.ply++;
    st.last = { from, to };
    st.lastBy = st.lastBy ? st.lastBy.slice() : [null, null];
    st.lastBy[s] = { from, to };
    st.turn = 1 - s;
    if (ev.den) end(st, s, 'den');
    else if (!count(st.b, 1 - s)) end(st, s, 'all');
    else if (!gen(st.b, 1 - s).length) end(st, s, 'stuck');
    else if (st.ply >= st.limit && bug !== 'nolimit') end(st, -1, 'limit');
    ev.over = st.over;
    ev.winner = st.winner;
    ev.reason = st.reason;
    return ev;
  }
  function end(st, winner, reason) {
    st.over = true;
    st.winner = winner;
    st.reason = reason;
  }

  // The enemy pieces side s could catch right now, as { at, by } (squares), biggest first.
  function threats(b, s) {
    const out = [];
    for (const m of gen(b, s)) {
      const to = m & 63;
      if (b[to]) out.push({ at: to, by: m >> 6, rank: rankOf(b[to]) });
    }
    return out.sort((a, c) => c.rank - a.rank);
  }

  // ---------------------------------------------------------------- the CPU

  const VAL = [0, 330, 200, 240, 300, 420, 650, 720, 800];
  const ADV = [0, 5, 3, 3, 4, 5, 6, 6, 5]; // how much each animal likes getting closer to the enemy den
  const WIN = 1000000;

  // How good the board is for side s (no look-ahead).
  function evaluate(b, s) {
    let score = 0;
    for (let i = 0; i < N; i++) {
      const v = b[i];
      if (!v) continue;
      const p = sideOf(v), rank = rankOf(v), den = DEN[1 - p];
      const d = Math.abs(colOf(i) - colOf(den)) + Math.abs(rowOf(i) - rowOf(den));
      let x = VAL[rank] + (14 - d) * ADV[rank];
      if (trapOwner[i] === 1 - p) x += 40; // knocking on the den's door
      if (d <= 2) x += 25;
      if (water[i]) x += 12;              // a swimming rat is safe and blocks jumps
      score += p === s ? x : -x;
    }
    return score;
  }

  // the order to try moves in: den entries, then the biggest captures, then the rest
  function order(b, moves, s) {
    const key = (m) => {
      const to = m & 63;
      if (to === DEN[1 - s]) return 100;
      return b[to] ? 10 + rankOf(b[to]) * 2 - rankOf(b[m >> 6]) * 0.1 : 0;
    };
    return moves.sort((a, c) => key(c) - key(a));
  }

  let nodes = 0;
  // captures (and den entries) only, so the search doesn't stop in the middle of a swap
  function quiet(b, s, alpha, beta, ply, qd) {
    nodes++;
    const stand = evaluate(b, s);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qd <= 0) return stand;
    const moves = gen(b, s, []);
    if (!moves.length) return -WIN + ply;
    order(b, moves, s);
    for (const m of moves) {
      const from = m >> 6, to = m & 63;
      if (to === DEN[1 - s]) return WIN - ply;
      const cap = b[to];
      if (!cap) continue;
      const v = b[from];
      b[to] = v;
      b[from] = 0;
      const score = count(b, 1 - s) ? -quiet(b, 1 - s, -beta, -alpha, ply + 1, qd - 1) : WIN - ply;
      b[from] = v;
      b[to] = cap;
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function negamax(b, s, depth, alpha, beta, ply) {
    if (depth <= 0) return quiet(b, s, alpha, beta, ply, 4);
    nodes++;
    const moves = gen(b, s, []);
    if (!moves.length) return -WIN + ply; // no move: you lose
    order(b, moves, s);
    let best = -Infinity;
    for (const m of moves) {
      const from = m >> 6, to = m & 63;
      let score;
      if (to === DEN[1 - s]) score = WIN - ply;
      else {
        const v = b[from], cap = b[to];
        b[to] = v;
        b[from] = 0;
        score = cap && !count(b, 1 - s) ? WIN - ply : -negamax(b, 1 - s, depth - 1, -beta, -alpha, ply + 1);
        b[from] = v;
        b[to] = cap;
      }
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }

  // Score every move for the side to move with a `depth` look-ahead. Returns [{ m, score }], best first.
  function rank(st, depth, rnd = Math.random) {
    const b = st.b.slice(), s = st.turn;
    const moves = order(b, gen(b, s, []), s);
    const out = [];
    let alpha = -Infinity;
    for (const m of moves) {
      const from = m >> 6, to = m & 63;
      let score;
      if (to === DEN[1 - s]) score = WIN;
      else {
        const v = b[from], cap = b[to];
        b[to] = v;
        b[from] = 0;
        // a full window for the top few, then a narrow one (it's only for picking among near-best moves)
        const lo = out.length < 3 ? -Infinity : alpha - 60;
        score = cap && !count(b, 1 - s) ? WIN : -negamax(b, 1 - s, depth - 1, -Infinity, -lo, 1);
        b[from] = v;
        b[to] = cap;
      }
      // don't just walk back to where it came from (it makes CPU games go round in circles)
      if (st.lastBy && st.lastBy[s] && st.lastBy[s].to === from && st.lastBy[s].from === to) score -= 18;
      out.push({ m, score });
      if (score > alpha) alpha = score;
    }
    for (const o of out) o.key = o.score + (Math.abs(o.score) < WIN / 2 ? (rnd() - 0.5) * 2 * NORMAL.noise : 0);
    return out.sort((a, c) => c.key - a.key);
  }

  // The CPU's move for the side to move: { from, to }.
  function cpuMove(st, level = 'normal', rnd = Math.random) {
    const s = st.turn, b = st.b;
    const moves = gen(b, s, []);
    if (!moves.length) return null;
    const pickOne = (list) => list[Math.floor(rnd() * list.length)];
    let m;
    if (level === 'random' || (level === 'normal' && bug === 'blind')) m = pickOne(moves);
    else if (level === 'easy') m = easyMove(st, moves, rnd);
    else {
      nodes = 0;
      m = rank(st, NORMAL.depth, rnd)[0].m;
    }
    return { from: m >> 6, to: m & 63 };
  }

  // 🐣 EASY: mostly wanders about. Takes an open den 6 times in 10, takes a capture a bit under half the time
  // (any capture, not the best one), only sometimes notices that a square is about to get it bonked, and now and then
  // heads for your den (so a game against a wandering kid still ends).
  function easyMove(st, moves, rnd) {
    const s = st.turn, b = st.b;
    const pickOne = (list) => list[Math.floor(rnd() * list.length)];
    const den = moves.filter((m) => (m & 63) === DEN[1 - s]);
    if (den.length && rnd() < EASY.den) return den[0];
    const caps = moves.filter((m) => b[m & 63]);
    if (caps.length && rnd() < EASY.capture) return pickOne(caps);
    let pool = moves;
    if (rnd() < EASY.careful) {
      const safe = moves.filter((m) => !unsafe(b, m, s));
      if (safe.length) pool = safe;
    }
    if (rnd() < EASY.forward) {
      const den = DEN[1 - s];
      const dist = (i) => Math.abs(colOf(i) - colOf(den)) + Math.abs(rowOf(i) - rowOf(den));
      const fwd = pool.filter((m) => dist(m & 63) < dist(m >> 6));
      if (fwd.length) return pickOne(fwd);
    }
    return pickOne(pool);
  }

  // Would this move leave the moved piece where the other side can catch it?
  function unsafe(b, m, s) {
    const from = m >> 6, to = m & 63, v = b[from], cap = b[to];
    b[to] = v;
    b[from] = 0;
    const hit = gen(b, 1 - s, []).some((x) => (x & 63) === to);
    b[from] = v;
    b[to] = cap;
    return hit;
  }

  // ---------------------------------------------------------------- your brother's hint

  // The move your brother points at for side `st.turn`, and what kind of tip it is:
  //   win     it wins now (into the den, or the last capture)
  //   den     stops the other side walking into your den next move
  //   danger  one of your animals can be caught next move, and this saves it
  //   bonk    a good capture
  //   move    just a good move
  // Returns { from, to, kind, rank (the animal moving), target (the animal caught, or the one in danger) }.
  function hint(st, rnd = Math.random) {
    if (st.over) return null;
    const s = st.turn, b = st.b;
    const list = rank(st, HINT.depth, rnd);
    if (!list.length) return null;
    // take the best, without the noise
    list.sort((a, c) => c.score - a.score);
    const m = list[0].m, from = m >> 6, to = m & 63;
    const out = { from, to, rank: rankOf(b[from]), kind: 'move', target: 0 };
    const cap = b[to];
    if (to === DEN[1 - s] || (cap && count(b, 1 - s) === 1)) {
      out.kind = 'win';
      if (cap) out.target = rankOf(cap);
    }
    else {
      // what the other side threatens now
      const foeDen = gen(b, 1 - s).some((x) => (x & 63) === DEN[s]);
      const danger = threats(b, 1 - s);
      const after = b.slice();
      after[to] = after[from];
      after[from] = 0;
      const stillDen = gen(after, 1 - s).some((x) => (x & 63) === DEN[s]);
      if (foeDen && !stillDen) out.kind = 'den';
      else if (cap) {
        out.kind = 'bonk';
        out.target = rankOf(cap);
      } else if (danger.length) {
        // is the animal it moves the one in danger (or does the move protect the biggest one)?
        const saved = danger.find((d) => d.at === from) || (threats(after, 1 - s).every((d) => d.rank < danger[0].rank) ? danger[0] : null);
        if (saved) {
          out.kind = 'danger';
          out.target = saved.rank;
          out.danger = saved.at;
        }
      }
    }
    return out;
  }

  JC.rules = {
    COLS, ROWS, N, BLUE, ORANGE, RAT, CAT, DOG, WOLF, LEOPARD, TIGER, LION, ELEPHANT, NAMES, EMOJI, LIMIT, EASY, NORMAL, HINT,
    DEN, TRAPS, water, trapOwner, adj, jumps, idx, colOf, rowOf, sideOf, rankOf, piece,
    newGame, clone, gen, legalFrom, isLegal, describe, play, canCapture, threats, count, evaluate, cpuMove, rank, hint, unsafe,
    setBug, get bug() { return bug; }, get nodes() { return nodes; },
  };
})();
