/* TT Jungle Chess: the headless checks (game.check() in the page, node tools/check.js in a terminal).
     1. every rule, on little boards set up for it: the rat and the elephant both ways, the water rules, the lion and
        tiger jumps (and a rat in the way), traps (yours and theirs), your own den, the den win, catching them all,
        no moves left, the draw limit; plus your brother's hint on a few boards
     2. CPU games: both levels and the test bots against each other. Every move is checked legal, every game must
        end, and 🔥 NORMAL must beat 🐣 EASY most of the time
   check({ sabotage }) switches one rule (or the NORMAL CPU) off first, to prove the check can fail. */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const JC = (root.JC = root.JC || {});
  const R = JC.rules;
  const { BLUE: B, ORANGE: O, RAT, CAT, DOG, WOLF, LEOPARD, TIGER, LION, ELEPHANT, idx } = R;

  // a seeded random, so a run can be repeated
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // a board with just these pieces: [side, rank, col, row]
  function setup(list, turn = B) {
    const st = R.newGame(turn);
    st.b.fill(0);
    for (const [s, rank, c, r] of list) st.b[idx(c, r)] = R.piece(s, rank);
    st.turn = turn;
    return st;
  }
  const can = (st, c0, r0, c1, r1) => R.isLegal(st, idx(c0, r0), idx(c1, r1));

  // ---------------------------------------------------------------- 1. the rules

  function rules() {
    const out = [];
    const t = (name, ok) => out.push({ name, ok: !!ok });

    // the start
    const s0 = R.newGame(B);
    const at = (st, c, r) => st.b[idx(c, r)];
    t('start: 8 pieces each', R.count(s0.b, B) === 8 && R.count(s0.b, O) === 8);
    t('start: standard squares (orange lion top left, tiger top right, elephant (6,2), rat (0,2))',
      at(s0, 0, 0) === R.piece(O, LION) && at(s0, 6, 0) === R.piece(O, TIGER) && at(s0, 6, 2) === R.piece(O, ELEPHANT) && at(s0, 0, 2) === R.piece(O, RAT) &&
      at(s0, 1, 1) === R.piece(O, DOG) && at(s0, 5, 1) === R.piece(O, CAT) && at(s0, 2, 2) === R.piece(O, LEOPARD) && at(s0, 4, 2) === R.piece(O, WOLF));
    t('start: blue is orange turned round (lion bottom right, elephant (0,6), rat (6,6))',
      at(s0, 6, 8) === R.piece(B, LION) && at(s0, 0, 8) === R.piece(B, TIGER) && at(s0, 0, 6) === R.piece(B, ELEPHANT) && at(s0, 6, 6) === R.piece(B, RAT) &&
      at(s0, 5, 7) === R.piece(B, DOG) && at(s0, 1, 7) === R.piece(B, CAT));
    const nB = R.gen(s0.b, B).length, nO = R.gen(s0.b, O).length;
    t(`start: both sides have the same number of moves (${nB})`, nB === nO && nB > 0);
    t('board: 12 water squares in two 2x3 rivers', R.water.reduce((a, v) => a + v, 0) === 12 && R.water[idx(1, 3)] && R.water[idx(5, 5)] && !R.water[idx(3, 4)]);

    // rat and elephant
    t('the rat catches the elephant', can(setup([[B, RAT, 3, 4], [O, ELEPHANT, 3, 3]], B), 3, 4, 3, 3));
    t("the elephant can't catch the rat", !can(setup([[B, RAT, 3, 4], [O, ELEPHANT, 3, 3]], O), 3, 3, 3, 4));
    t('bigger catches smaller (lion takes dog)', can(setup([[B, LION, 3, 4], [O, DOG, 3, 3]], B), 3, 4, 3, 3));
    t('same rank catches same rank (lion takes lion)', can(setup([[B, LION, 3, 4], [O, LION, 3, 3]], B), 3, 4, 3, 3));
    t("smaller can't catch bigger (cat on dog)", !can(setup([[B, CAT, 3, 4], [O, DOG, 3, 3]], B), 3, 4, 3, 3));
    t("can't land on your own piece", !can(setup([[B, LION, 3, 4], [B, DOG, 3, 3], [O, CAT, 0, 0]], B), 3, 4, 3, 3));

    // water
    t('the rat can swim into the river', can(setup([[B, RAT, 0, 4], [O, CAT, 6, 0]], B), 0, 4, 1, 4));
    t('the rat can swim along the river', can(setup([[B, RAT, 1, 4], [O, CAT, 6, 0]], B), 1, 4, 2, 4));
    t('the rat can climb out onto an empty square', can(setup([[B, RAT, 2, 4], [O, CAT, 6, 0]], B), 2, 4, 3, 4));
    t("land animals can't go in the water (dog)", !can(setup([[B, DOG, 3, 4], [O, CAT, 6, 0]], B), 3, 4, 2, 4));
    t("land animals can't go in the water (elephant)", !can(setup([[B, ELEPHANT, 0, 3], [O, CAT, 6, 0]], B), 0, 3, 1, 3));
    t("the rat can't catch the elephant straight out of the water", !can(setup([[B, RAT, 2, 4], [O, ELEPHANT, 3, 4]], B), 2, 4, 3, 4));
    t("a rat in the water can't catch anyone on land (cat)", !can(setup([[B, RAT, 2, 4], [O, CAT, 3, 4]], B), 2, 4, 3, 4));
    t("a rat on land can't catch a rat in the water", !can(setup([[B, RAT, 3, 4], [O, RAT, 2, 4]], B), 3, 4, 2, 4));
    t('a rat in the water catches the other rat in the water', can(setup([[B, RAT, 1, 4], [O, RAT, 2, 4]], B), 1, 4, 2, 4));
    t("a rat in the water can't catch the other rat on the bank", !can(setup([[B, RAT, 2, 4], [O, RAT, 3, 4]], B), 2, 4, 3, 4));
    t("a land animal can't catch a rat in the water (cat next to the river)", !can(setup([[B, CAT, 0, 4], [O, RAT, 1, 4]], B), 0, 4, 1, 4));
    t('a rat that climbed out can catch the elephant on its next move', (() => {
      const st = setup([[B, RAT, 2, 4], [O, ELEPHANT, 3, 3], [O, CAT, 6, 0]], B);
      R.play(st, idx(2, 4), idx(3, 4));
      R.play(st, idx(6, 0), idx(6, 1));
      return R.isLegal(st, idx(3, 4), idx(3, 3));
    })());

    // jumps
    t('the lion jumps over the river (along a column)', can(setup([[B, LION, 1, 6], [O, CAT, 6, 0]], B), 1, 6, 1, 2));
    t('the lion jumps back (column, the other way)', can(setup([[B, LION, 4, 2], [O, CAT, 6, 0]], B), 4, 2, 4, 6));
    t('the tiger jumps over the river (along a row)', can(setup([[B, TIGER, 0, 4], [O, CAT, 6, 0]], B), 0, 4, 3, 4));
    t('the tiger jumps from the middle to the side', can(setup([[B, TIGER, 3, 5], [O, CAT, 6, 0]], B), 3, 5, 6, 5) && can(setup([[B, TIGER, 3, 5], [O, CAT, 6, 0]], B), 3, 5, 0, 5));
    t("a rat of your own in the water blocks the lion's jump", !can(setup([[B, LION, 1, 6], [B, RAT, 1, 4], [O, CAT, 6, 0]], B), 1, 6, 1, 2));
    t("an enemy rat in the water blocks the lion's jump", !can(setup([[B, LION, 1, 6], [O, RAT, 1, 5], [O, CAT, 6, 0]], B), 1, 6, 1, 2));
    t("a rat in the water blocks the tiger's jump", !can(setup([[B, TIGER, 0, 4], [O, RAT, 2, 4], [O, CAT, 6, 0]], B), 0, 4, 3, 4));
    t('a rat in the other column of the river does not block', can(setup([[B, LION, 1, 6], [O, RAT, 2, 4], [O, CAT, 6, 0]], B), 1, 6, 1, 2));
    t('a jump can land on a smaller enemy (tiger takes dog)', can(setup([[B, TIGER, 0, 4], [O, DOG, 3, 4]], B), 0, 4, 3, 4));
    t("a jump can't land on a bigger enemy (tiger onto lion)", !can(setup([[B, TIGER, 0, 4], [O, LION, 3, 4]], B), 0, 4, 3, 4));
    t("a jump can't land on your own piece", !can(setup([[B, TIGER, 0, 4], [B, DOG, 3, 4], [O, CAT, 6, 0]], B), 0, 4, 3, 4));
    t("the elephant can't jump", !can(setup([[B, ELEPHANT, 1, 6], [O, CAT, 6, 0]], B), 1, 6, 1, 2));
    t("the leopard can't jump", !can(setup([[B, LEOPARD, 0, 4], [O, CAT, 6, 0]], B), 0, 4, 3, 4));
    t('the rat swims instead of jumping', !can(setup([[B, RAT, 0, 4], [O, CAT, 6, 0]], B), 0, 4, 3, 4));

    // traps
    t('an enemy in your trap is rank 0: your cat catches their elephant there', can(setup([[B, CAT, 2, 7], [O, ELEPHANT, 3, 7]], B), 2, 7, 3, 7));
    t('...but not on a plain square', !can(setup([[B, CAT, 2, 6], [O, ELEPHANT, 3, 6]], B), 2, 6, 3, 6));
    t('your rat catches their lion in your trap', can(setup([[B, RAT, 1, 8], [O, LION, 2, 8]], B), 1, 8, 2, 8));
    t('the elephant catches a rat standing in his own trap', can(setup([[B, ELEPHANT, 2, 7], [O, RAT, 3, 7]], B), 2, 7, 3, 7));
    t('your own trap keeps your rank (their cat cannot catch your lion there)', !can(setup([[B, LION, 3, 7], [O, CAT, 2, 7]], O), 2, 7, 3, 7));
    t("orange's traps work for orange too", can(setup([[O, RAT, 3, 2], [B, ELEPHANT, 3, 1]], O), 3, 2, 3, 1));

    // dens
    t("you can't go into your own den", !can(setup([[B, DOG, 3, 7], [O, CAT, 6, 0]], B), 3, 7, 3, 8));
    t("orange can't go into its own den", !can(setup([[O, DOG, 3, 1], [B, CAT, 6, 8]], O), 3, 1, 3, 0));
    t('the lion walks into the enemy den', can(setup([[B, LION, 2, 0], [O, CAT, 6, 3]], B), 2, 0, 3, 0));
    t('walking into the enemy den wins', (() => {
      const st = setup([[B, DOG, 3, 1], [O, ELEPHANT, 6, 4]], B);
      const ev = R.play(st, idx(3, 1), idx(3, 0));
      return ev && ev.den && st.over && st.winner === B && st.reason === 'den';
    })());
    t('orange wins in the blue den', (() => {
      const st = setup([[O, RAT, 4, 8], [B, ELEPHANT, 0, 0]], O);
      R.play(st, idx(4, 8), idx(3, 8));
      return st.over && st.winner === O && st.reason === 'den';
    })());
    t('catching the last enemy piece wins', (() => {
      const st = setup([[B, LION, 3, 4], [O, CAT, 3, 3]], B);
      R.play(st, idx(3, 4), idx(3, 3));
      return st.over && st.winner === B && st.reason === 'all';
    })());
    t('no legal move left loses', (() => {
      const st = setup([[O, CAT, 0, 0], [B, LION, 1, 0], [B, TIGER, 0, 1], [B, ELEPHANT, 6, 8]], B);
      R.play(st, idx(6, 8), idx(6, 7));
      return st.over && st.winner === B && st.reason === 'stuck';
    })());
    t(`${R.LIMIT} moves with no winner is a draw`, (() => {
      const st = setup([[B, LION, 3, 4], [O, LION, 0, 0]], B);
      st.ply = R.LIMIT - 1;
      R.play(st, idx(3, 4), idx(3, 5));
      return st.over && st.winner === -1 && st.reason === 'limit';
    })());
    t('an illegal move is refused and changes nothing', (() => {
      const st = R.newGame(B);
      const before = st.b.join();
      return R.play(st, idx(0, 6), idx(1, 6)) !== null && R.play(st, idx(0, 2), idx(1, 2)) && R.play(st, idx(1, 6), idx(1, 5)) === null && st.turn === B && st.b.join() !== before;
    })());
    t("it's the other side's turn after a move", (() => {
      const st = R.newGame(B);
      R.play(st, idx(0, 6), idx(0, 5));
      return st.turn === O && !R.isLegal(st, idx(0, 5), idx(0, 4));
    })());

    // your brother's hint
    const h1 = R.hint(setup([[B, DOG, 3, 1], [O, ELEPHANT, 6, 4]], B));
    t('hint: points at the den when you can win', h1 && h1.kind === 'win' && h1.to === idx(3, 0));
    const h2 = R.hint(setup([[B, LION, 3, 4], [B, RAT, 0, 8], [O, ELEPHANT, 3, 3], [O, RAT, 6, 0]], B));
    t('hint: warns that your lion is in danger, and moves it', h2 && h2.kind === 'danger' && h2.target === LION && h2.from === idx(3, 4));
    const h3 = R.hint(setup([[B, CAT, 2, 7], [B, LION, 6, 6], [O, DOG, 3, 7], [O, ELEPHANT, 0, 0]], B));
    t('hint: guards your den when they can walk in next', h3 && h3.kind === 'den' && h3.to === idx(3, 7));
    const h4 = R.hint(setup([[B, LION, 3, 4], [O, CAT, 3, 3], [O, ELEPHANT, 6, 0], [B, RAT, 0, 8]], B));
    t('hint: bonks the cat when it can', h4 && h4.kind === 'bonk' && h4.target === CAT);
    t('hint: always a legal move', [h1, h2, h3, h4].every(Boolean));

    return out;
  }

  // ---------------------------------------------------------------- 2. CPU games

  // test bots for the kid's side
  function botMove(st, bot, rnd) {
    if (bot === 'easy' || bot === 'normal' || bot === 'random') return R.cpuMove(st, bot, rnd);
    const s = st.turn, b = st.b;
    const moves = R.gen(b, s);
    const pick = (l) => l[Math.floor(rnd() * l.length)];
    let m;
    if (bot === 'kid') {
      // a kid: walks into the den when he sees it (9 in 10), likes bonking (7 in 10), heads for their den half the
      // time, and sometimes looks before he steps
      const den = moves.filter((x) => (x & 63) === R.DEN[1 - s]);
      const caps = moves.filter((x) => b[x & 63]);
      const look = rnd() < 0.4;
      const ok = (x) => !look || !R.unsafe(b, x, s);
      const dist = (i) => Math.abs(R.colOf(i) - 3) + Math.abs(R.rowOf(i) - R.rowOf(R.DEN[1 - s]));
      const fwd = moves.filter((x) => dist(x & 63) < dist(x >> 6) && ok(x));
      const safe = moves.filter(ok);
      if (den.length && rnd() < 0.9) m = den[0];
      else if (caps.length && rnd() < 0.7) m = pick(caps);
      else if (fwd.length && rnd() < 0.5) m = pick(fwd);
      else m = pick(safe.length ? safe : moves);
    } else if (bot === 'smart') {
      // a careful older kid: looks two moves ahead (his move and the answer), but one move in five just plays along
      if (rnd() < 0.2) return R.cpuMove(st, 'easy', rnd);
      m = R.rank(st, 2, rnd)[0].m;
    } else if (bot === 'greedy') {
      // one move ahead: the best capture or the den, else forward, never into a free bonk
      let best = -1e9;
      for (const x of moves) {
        const to = x & 63;
        let sc = rnd() * 5;
        if (to === R.DEN[1 - s]) sc += 1e6;
        if (b[to]) sc += 100 * R.rankOf(b[to]);
        if (R.unsafe(b, x, s)) sc -= 90 * R.rankOf(b[x >> 6]);
        const fr = R.rowOf(x >> 6), tr = R.rowOf(to);
        sc += (s === R.BLUE ? fr - tr : tr - fr) * 8;
        if (sc > best) {
          best = sc;
          m = x;
        }
      }
    }
    return { from: m >> 6, to: m & 63 };
  }

  // One game: a (blue) against b (orange). Returns { winner, plies, reason, illegal }.
  function game(a, b, rnd, starter = B, cap = 2000) {
    const st = R.newGame(starter);
    const who = [a, b];
    while (!st.over && st.ply < cap) {
      const m = botMove(st, who[st.turn], rnd);
      if (!m || !R.play(st, m.from, m.to)) return { winner: -2, plies: st.ply, reason: 'illegal', illegal: true };
    }
    return { winner: st.over ? st.winner : -3, plies: st.ply, reason: st.over ? st.reason : 'never ended', illegal: false };
  }

  // n games between two bots, swapping colours and who starts. Returns tallies from x's point of view.
  function match(x, y, n, rnd) {
    const r = { pair: `${x} vs ${y}`, games: n, xWins: 0, yWins: 0, draws: 0, illegal: 0, unended: 0, longest: 0, reasons: {} };
    for (let i = 0; i < n; i++) {
      const xBlue = i % 2 === 0, starter = (i >> 1) % 2;
      const g = game(xBlue ? x : y, xBlue ? y : x, rnd, starter);
      r.longest = Math.max(r.longest, g.plies);
      r.reasons[g.reason] = (r.reasons[g.reason] || 0) + 1;
      if (g.illegal) r.illegal++;
      else if (g.winner === -3) r.unended++;
      else if (g.winner === -1) r.draws++;
      else if ((g.winner === B) === xBlue) r.xWins++;
      else r.yWins++;
    }
    return r;
  }

  function check(opts = {}) {
    const n = opts.games || 20;
    const rnd = rng(opts.seed || 20261018);
    R.setBug(opts.sabotage || null);
    const t0 = Date.now();
    try {
      const list = rules();
      const failed = list.filter((x) => !x.ok).map((x) => x.name);
      const games = [
        match('normal', 'easy', n * 2, rnd),
        match('easy', 'easy', n, rnd),
        match('random', 'random', n, rnd),
        match('kid', 'easy', n, rnd),
        match('greedy', 'normal', n, rnd),
        match('normal', 'normal', Math.max(2, n >> 2), rnd),
      ];
      const ne = games[0];
      const normalBeatsEasy = ne.xWins / ne.games;
      const allEnded = games.every((g) => !g.unended && g.longest <= R.LIMIT);
      const allLegal = games.every((g) => !g.illegal);
      const ok = !failed.length && allEnded && allLegal && normalBeatsEasy >= 0.75;
      return {
        ok, sabotage: opts.sabotage || null, rules: { passed: list.length - failed.length, of: list.length, failed },
        cpu: { allLegal, allEnded, normalBeatsEasy: +normalBeatsEasy.toFixed(2), need: 0.75, games },
        seconds: +((Date.now() - t0) / 1000).toFixed(1),
      };
    } finally {
      R.setBug(null);
    }
  }

  // Win rates of the kids' test bots against both levels (how EASY was tuned). Not a pass / fail check.
  function rates(n = 200, seed = 7) {
    const rnd = rng(seed);
    const out = {};
    for (const bot of ['random', 'kid', 'greedy', 'smart']) for (const lvl of ['easy', 'normal']) {
      const r = match(bot, lvl, lvl === 'normal' ? Math.max(10, n >> 2) : n, rnd);
      out[`${bot} vs ${lvl}`] = { games: r.games, botWins: +(r.xWins / r.games).toFixed(2), cpuWins: +(r.yWins / r.games).toFixed(2), draws: +(r.draws / r.games).toFixed(2), longest: r.longest };
    }
    return out;
  }

  JC.check = check;
  JC.rates = rates;
  JC.checkRules = rules;
  JC.testGame = game;
  JC.rng = rng;
})();
