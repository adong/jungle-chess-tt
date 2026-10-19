/* TT Jungle Chess: the menu, the game, the HUD, input and the main loop.
   Screens: home (1 or 2 players, who you are, the level, undo on or off), play, game over, pause, and the rules
   ("Who beats who?"). In 1 player you're Teddy (blue) or Tommy (orange) against a CPU friend: 🐣 EASY is Bruno the
   bear (the default for Tommy), 🔥 NORMAL is Bolt the robot (the default for Teddy). Your brother isn't the CPU: he's
   the one you call for help (js/buddy.js). In 2 players Teddy and Tommy take turns on one device.
   The camera looks from your end: from behind your den on a tall screen, from the side (your den on the left) on a
   wide one. You start the first game; after that whoever didn't start last time does. The score keeps running
   until you change who plays.
   window.game is a test hook: see the README. */
(function () {
  'use strict';
  const JC = window.JC;
  const R = JC.rules;
  const ST = JC.stage;
  const S = Kit.sound;
  const { BLUE, ORANGE } = R;
  const $ = (id) => document.getElementById(id);
  const { rand } = Kit.gfx;

  const KEY = 'jungleChessTT.v1';
  const CPU = { easy: 'bruno', normal: 'bolt' };
  const SCALE = 0.9; // the boys beside the board

  const prefs = Object.assign({ players: 1, who: 'teddy', levels: { teddy: 'normal', tommy: 'easy' }, undo: true }, load());
  const G = {
    state: 'boot', players: 1, level: 'easy', sides: null, kid: BLUE, st: null, history: [], wins: [0, 0], draws: 0,
    starter: BLUE, sel: -1, cursor: -1, cpuT: -1, waitT: -1, busy: false, turnId: 0, endT: -1, panelT: -1, held: false,
    last: 0, auto: false, autoLevel: 'normal', demo: null, result: null, setupKey: '', az: 0, wide: true, rulesFrom: null,
  };
  const actors = [JC.makeActor(), JC.makeActor()];
  const badges = [];
  let ui = null, flyers = null, bursts = null, spots = null, art = null;

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch (e) { /* private mode */ }
  }
  const levelFor = (who) => (prefs.levels && prefs.levels[who]) || (who === 'tommy' ? 'easy' : 'normal');

  // ---------------------------------------------------------------- who's at the board

  const nameOf = (id) => Kit.roster.get(id).name;
  // sides[colour]: sides[0] plays blue (Teddy's colour), sides[1] orange (Tommy's)
  function makeSides(players, who, level) {
    if (players === 2) return [{ id: 'teddy', side: BLUE, human: true }, { id: 'tommy', side: ORANGE, human: true }];
    const mine = who === 'tommy' ? ORANGE : BLUE;
    const out = [];
    out[mine] = { id: who, side: mine, human: true };
    out[1 - mine] = { id: CPU[level], side: 1 - mine, human: false };
    return out;
  }
  const current = () => (G.st && G.sides ? G.sides[G.st.turn] : null);
  const kid = () => G.sides[G.kid];

  function setActors() {
    G.sides.forEach((s, k) => {
      const a = actors[k];
      if (!a.entry || a.entry.id !== s.id) a.set(s.id, SCALE);
      s.actor = a;
      a.visible = true;
      setBadge(k);
    });
    JC.buddy.setFor(kid().id);
  }

  // the paw that bobs over the head of whoever's turn it is, in his side's colour
  function badgeTexture(side) {
    const [c, g] = Kit.gfx.makeCanvas(128, 128);
    g.fillStyle = ST.COL[side];
    g.beginPath();
    g.arc(64, 64, 54, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = '#ffffff';
    g.stroke();
    g.lineWidth = 5;
    g.strokeStyle = '#14121f';
    g.beginPath();
    g.arc(64, 64, 60, 0, Math.PI * 2);
    g.stroke();
    g.font = `62px ${Kit.gfx.EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('🐾', 64, 68);
    return Kit.gfx.toTexture(c);
  }
  function setBadge(k) {
    if (badges[k]) return;
    badges[k] = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture(k), depthTest: false, transparent: true }));
    badges[k].renderOrder = 23;
    badges[k].scale.setScalar(0.6);
    ST.scene.add(badges[k]);
  }

  // ---------------------------------------------------------------- layout

  function layout() {
    ST.resize();
    JC.fx.overlay.resize();
    const W = ST.W, H = ST.H;
    if (W < 2 || H < 2) return;
    const wide = W / H >= 1.15;
    const flip = G.kid === ORANGE;
    G.wide = wide;
    // from your end: behind your den when tall, from the side (your den on the left) when wide
    G.az = wide ? (flip ? -Math.PI / 2 : Math.PI / 2) : (flip ? Math.PI : 0);
    ST.ends(flip);
    const f = ST.flip;
    spots = {
      sides: [ST.spotFor(BLUE), ST.spotFor(ORANGE)],
      buddy: ST.buddySpot(G.kid),
      meet: [{ x: -f * (ST.HW + 0.8), z: 0.75 }, { x: -f * (ST.HW + 0.8), z: -0.75 }],
    };
    const V = THREE.Vector3, pts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push(new V(sx * ST.HW, 0, sz * ST.HD), new V(sx * ST.HW, ST.TOP, sz * ST.HD));
    for (const s of [BLUE, ORANGE]) {
      const z = s === BLUE ? ST.END : -ST.END;
      for (const dx of [-1.5, 1.5]) for (const dz of [-0.8, 0.8]) pts.push(new V(f * 2.15 + dx, 0, z + dz), new V(f * 2.15 + dx, 0.6, z + dz));
      const sp = spots.sides[s];
      pts.push(new V(sp.x - 0.6, 0, sp.z), new V(sp.x + 0.6, 0, sp.z), new V(sp.x, 2 * SCALE + 0.75, sp.z));
    }
    if (G.state !== 'home') pts.push(new V(spots.buddy.x, 2.4 * SCALE, spots.buddy.z));
    // the kit's round ? and language buttons sit on the left edge: keep the board and the boys clear of them
    const kitL = 62;
    const m = { l: kitL, r: 14, t: 14, b: 14 };
    if (G.state === 'home') {
      if (wide) m.r = W * 0.54 + 10;
      else {
        m.b = H * 0.6 + 6;
        m.t = 8;
      }
    } else {
      // on a wide screen undo and the rules sit next to pause: the score moves over to make room
      document.documentElement.style.setProperty('--toolsw', wide ? `${ui.tools.offsetWidth + 10}px` : '0px');
      const top = ui.hudtop.getBoundingClientRect();
      m.t = top.bottom + 8;
      const call = ui.callBtn.getBoundingClientRect();
      if (!wide) m.b = Math.max(14, H - call.top + 6);
      else m.r = Math.max(kitL, W - call.left + 6);
    }
    ST.fit(pts, wide ? 0.92 : 1.02, G.az, m);
    // the boys face the camera, turned a little toward the board
    const cp = ST.cam.position;
    G.sides && G.sides.forEach((s, k) => {
      const sp = spots.sides[k];
      const tx = cp.x * 0.75, tz = cp.z * 0.75;
      sp.face = Math.atan2(-(tx - sp.x), -(tz - sp.z));
      s.actor.faceDefault = sp.face;
      if (!JC.highFive.on) s.actor.place(sp.x, 0, sp.z);
    });
    spots.buddy.face = Math.atan2(-(cp.x * 0.75 - spots.buddy.x), -(cp.z * 0.75 - spots.buddy.z));
  }

  // ---------------------------------------------------------------- the game

  function startGame(opts = {}) {
    gesture();
    G.players = opts.players || prefs.players;
    const who = opts.who || prefs.who;
    G.level = opts.level || (G.players === 1 ? levelFor(who) : 'normal');
    Object.assign(prefs, { players: G.players, who });
    if (G.players === 1) prefs.levels = Object.assign({}, prefs.levels, { [who]: G.level });
    if (opts.undo !== undefined) prefs.undo = !!opts.undo;
    save();
    const key = `${G.players}:${who}:${G.level}`;
    if (key !== G.setupKey) {
      G.setupKey = key;
      G.wins = [0, 0];
      G.draws = 0;
      G.starter = null;
    }
    G.sides = makeSides(G.players, who, G.level);
    G.kid = G.players === 1 ? (who === 'tommy' ? ORANGE : BLUE) : BLUE;
    if (G.starter === null) G.starter = G.kid; // you start the first game
    setActors();
    show(ui.home, false);
    show(ui.hud, true);
    show(ui.tools, true);
    show(ui.callBtn, true);
    show(ui.gameOver, false);
    show(ui.rules, false);
    document.body.dataset.screen = 'play';
    G.state = 'play';
    JC.highFive.cancel();
    setupHud();
    layout();
    S.music('title');
    newGame();
  }

  function newGame() {
    G.st = R.newGame(G.starter);
    G.history = [];
    Object.assign(G, { sel: -1, busy: false, cpuT: -1, waitT: -1, endT: -1, panelT: -1, result: null });
    ST.set(G.st);
    ST.last(-1, -1);
    ST.hint(-1, -1, -1);
    ST.select(-1);
    JC.buddy.reset();
    JC.fx.overlay.clear();
    flyers.clear();
    bursts.clear();
    clearToasts();
    G.sides.forEach((s) => {
      s.actor.react('idle');
      s.actor.drop();
    });
    G.state = 'play';
    show(ui.gameOver, false);
    show(ui.pause, false);
    renderScore();
    beginTurn();
  }

  function beginTurn() {
    G.turnId++;
    const s = current();
    if (!s.human) {
      G.cpuT = rand(0.75, 1.15);
      s.actor.act('think', G.cpuT + 0.2, 0, true);
      JC.sfx.think(s.id === 'bolt');
      const p = s.actor.root.position;
      flyers.add('🤔', p.x, 2.5, p.z, 0, 0.3, 0.55, G.cpuT, 0, 0);
    } else if (G.auto) G.cpuT = 0.25;
    updateTurnText();
  }

  const canAct = () => {
    const s = current();
    return G.state === 'play' && s && s.human && !G.auto && !G.busy && G.waitT <= 0 && !G.st.over;
  };

  // A tap (or Enter) on square i, for the kid whose turn it is.
  function onSquare(i) {
    if (!canAct()) return false;
    const st = G.st;
    if (i < 0) {
      if (G.sel >= 0) select(-1);
      return false;
    }
    const v = st.b[i];
    if (G.sel >= 0 && G.sel !== i) {
      if (R.legalFrom(st, G.sel).includes(i)) return doMove(G.sel, i, true);
    }
    if (v && R.sideOf(v) === st.turn) {
      if (G.sel === i) select(-1);
      else select(i);
      return true;
    }
    if (G.sel >= 0) {
      const why = whyNot(st, G.sel, i);
      JC.sfx.nope();
      if (why) toast(why, 'hint');
      select(-1);
      return false;
    }
    if (v) JC.sfx.nope();
    return false;
  }

  function select(i) {
    G.sel = i;
    ST.select(i);
    if (i < 0) return;
    const st = G.st;
    const list = R.legalFrom(st, i).map((to) => R.describe(st.b, i, to));
    ST.moves(i, list);
    JC.sfx.pick(R.rankOf(st.b[i]));
    if (!list.length) toast("THIS ONE CAN'T MOVE!", 'hint');
  }

  // Why the picked-up animal can't go to square `to`: the rule in a few words (or '' if it isn't next door).
  function whyNot(st, from, to) {
    const b = st.b, v = b[from], s = R.sideOf(v), rank = R.rankOf(v), t = b[to];
    const jump = (rank === R.LION || rank === R.TIGER) && R.jumps[from].find((j) => j.to === to);
    if (!R.adj[from].includes(to) && !jump) return '';
    if (jump && jump.over.some((w) => b[w])) return 'A RAT IS IN THE WAY!';
    if (to === R.DEN[s]) return 'NOT YOUR OWN DEN!';
    if (R.water[to] && rank !== R.RAT) return 'ONLY THE RAT CAN SWIM!';
    if (!t) return '';
    if (R.sideOf(t) === s) return '';
    if (R.water[from] && !R.water[to]) return 'CLIMB OUT OF THE WATER FIRST!';
    if (!R.water[from] && R.water[to]) return "HE'S SAFE IN THE WATER!";
    if (rank === R.ELEPHANT && R.rankOf(t) === R.RAT) return "THE ELEPHANT CAN'T BONK THE RAT!";
    return 'TOO BIG TO BONK!';
  }

  function doMove(from, to, human) {
    const st = G.st;
    G.history.push(R.clone(st));
    const ev = R.play(st, from, to);
    if (!ev) {
      G.history.pop();
      if (human) JC.sfx.nope();
      return false;
    }
    G.busy = true;
    G.cpuT = -1;
    select(-1);
    ST.last(from, to);
    if (human) {
      ST.hint(-1, -1, -1);
      JC.buddy.moved();
    }
    if (ev.jump) {
      JC.sfx.jump();
      const p = ST.cellPos(from);
      bursts.add('BOING!', p.x, ST.TOP + 1.2, p.z, 1.4, '#b8f5ff', '#2f7cf0');
    }
    const mover = G.sides[ev.side];
    if (mover.actor.mode !== 'signature') mover.actor.act('give', 0.45, 0, true);
    ST.move(ev, landed);
    updateTurnText();
    return true;
  }

  // The animal landed: the sound, the reactions, then the next turn (or the end).
  function landed(ev) {
    if (G.state === 'home' || !G.sides) return;
    const mover = G.sides[ev.side], other = G.sides[1 - ev.side];
    if (ev.capture >= 0) {
      JC.sfx.bonk();
      const big = (ev.capture % 8) + 1 >= R.TIGER;
      if (big) ST.shake(0.3);
      setTimeout(() => {
        if (G.state === 'play' || G.state === 'ended') {
          mover.actor.react('cheer');
          other.actor.react('oops');
        }
      }, 120);
      setTimeout(() => (G.state === 'play' || G.state === 'ended') && JC.sfx.snore(), 1000);
    } else if (ev.swim) JC.sfx.splash();
    else JC.sfx.step(ev.rank);
    G.busy = false;
    if (G.st.over) G.endT = 0.35;
    else G.waitT = 0.15;
    updateTurnText();
  }

  const WHY = { den: 'INTO THE DEN!', all: 'BONKED THEM ALL!', stuck: 'NO MOVES LEFT!', limit: 'TOO MANY MOVES!' };
  function endGame() {
    const st = G.st, w = st.winner;
    G.result = w;
    if (w >= 0) G.wins[w]++;
    else G.draws++;
    G.starter = 1 - st.starter;
    const win = w >= 0 ? G.sides[w] : null, lose = win ? G.sides[1 - w] : null;
    if (win) {
      win.actor.react('signature');
      setTimeout(() => lose.actor.react('shrug'), 250);
      const at = st.reason === 'den' ? R.DEN[1 - w] : st.last.to;
      const p = ST.cellPos(at);
      bursts.add(st.reason === 'den' ? 'DEN!' : st.reason === 'all' ? 'ALL BONKED!' : 'STUCK!', p.x, ST.TOP + 1.4, p.z, 2.2, '#ffd400', '#e8372c');
      for (let i = 0; i < 10; i++) flyers.add(i % 2 ? '⭐' : '🎉', p.x, ST.TOP + 0.8, p.z, rand(-2.5, 2.5), rand(2, 4), 0.5, 1.2, rand(-3, 3), 5);
      if (win.human) {
        JC.sfx.win();
        const a = ST.toScreen(p);
        JC.fx.overlay.burst(a.x, a.y, 70, ['⭐', '🎉', w === BLUE ? '💙' : '🧡'], 1.2);
        JC.fx.overlay.rain(90);
      } else JC.sfx.lose();
      bumpScore(w === G.kid ? ui.scoreL : ui.scoreR);
    } else {
      JC.sfx.draw();
      G.sides.forEach((s) => s.actor.react('shrug'));
      for (let i = 0; i < 6; i++) flyers.add('🤝', 0, ST.TOP + 1, 0, rand(-2, 2), rand(2, 3.5), 0.6, 1.2, rand(-2, 2), 4);
    }
    G.state = 'ended';
    G.endT = -1;
    G.panelT = 2.6;
    renderScore();
    updateTurnText();
  }

  function showOverPanel() {
    const st = G.st, w = st.winner;
    const win = w >= 0 ? G.sides[w] : null;
    ui.oFace.innerHTML = win ? `<img alt="" class="${w === ORANGE ? 'o' : ''}" src="${art[win.id]}"><span class="big">🏆</span>` : '<span class="big">🤝</span>';
    ui.oTitle.textContent = win ? `${nameOf(win.id)} WINS!` : 'DRAW!';
    ui.oWhy.textContent = WHY[st.reason] || '';
    renderPanelScore(ui.oScore);
    G.state = 'over';
    show(ui.gameOver, true);
    if (win) {
      win.actor.react('over');
      G.sides[1 - w].actor.react('sulk');
      if (win.human) JC.fx.overlay.rain(120);
    }
    updateUndo();
  }

  function renderPanelScore(el) {
    const a = G.sides[G.kid], b = G.sides[1 - G.kid];
    const img = (s) => `<img alt="" class="${s.side === ORANGE ? 'o' : ''}" src="${art[s.id]}">`;
    el.innerHTML = `${img(a)}<span>${G.wins[a.side]}</span><span class="dash">–</span><span>${G.wins[b.side]}</span>${img(b)}`;
  }

  function again() {
    gesture();
    if (G.state === 'over' || G.state === 'ended') newGame();
  }

  function restartGame() {
    if (!['play', 'paused', 'ended', 'over'].includes(G.state)) return;
    if (G.state === 'paused' && G.pausedFrom !== 'play') G.state = G.pausedFrom;
    show(ui.pause, false);
    if (G.state === 'ended' || G.state === 'over') return newGame(); // the result already counted
    newGame();
    toast('🔄', 'hint');
  }

  // ---------------------------------------------------------------- undo

  function canUndo() {
    if (!prefs.undo || !G.st || G.busy || !G.sides) return false;
    if (!['play', 'ended', 'over'].includes(G.state)) return false;
    if (G.players === 2) return G.history.length > 0;
    return G.history.some((h) => h.turn === G.kid);
  }

  // Take back your last move (and the CPU's answer, in 1 player). Works after the game ended too: the result comes off
  // the score again. In 2 players it takes back one move.
  function undo() {
    if (!canUndo()) {
      if (prefs.undo && G.state === 'play') JC.sfx.nope();
      return false;
    }
    if (G.state === 'ended' || G.state === 'over') {
      if (G.result >= 0) G.wins[G.result]--;
      else if (G.result === -1) G.draws--;
      G.starter = 1 - G.starter;
      G.result = null;
      show(ui.gameOver, false);
      JC.fx.overlay.clear();
      G.sides.forEach((s) => s.actor.react('idle'));
    }
    let snap = G.history.pop();
    if (G.players === 1) while (snap.turn !== G.kid) snap = G.history.pop();
    G.st = snap;
    Object.assign(G, { cpuT: -1, waitT: 0.5, endT: -1, panelT: -1, state: 'play' });
    select(-1);
    ST.sync(G.st);
    ST.last(G.st.last ? G.st.last.from : -1, G.st.last ? G.st.last.to : -1);
    ST.hint(-1, -1, -1);
    JC.buddy.moved();
    JC.sfx.undo();
    toast('↩️', 'hint');
    renderScore();
    updateTurnText();
    return true;
  }

  // ---------------------------------------------------------------- home

  function goHome() {
    G.state = 'home';
    document.body.dataset.screen = 'home';
    show(ui.hud, false);
    show(ui.tools, false);
    show(ui.callBtn, false);
    show(ui.gameOver, false);
    show(ui.pause, false);
    show(ui.rules, false);
    show(ui.home, true);
    JC.buddy.reset();
    JC.highFive.cancel();
    ST.hint(-1, -1, -1);
    ST.select(-1);
    ST.cursor(-1);
    clearToasts();
    JC.fx.overlay.clear();
    G.sides = [{ id: 'teddy', side: BLUE, human: false }, { id: 'tommy', side: ORANGE, human: false }];
    G.kid = BLUE;
    G.st = null;
    setActors();
    layout();
    G.sides.forEach((s) => s.actor.react('hello'));
    refreshHome();
    demoStart();
    S.music('title');
  }

  // the board plays itself behind the menu: a slow game between the boys
  function demoStart() {
    G.demo = { st: R.newGame(Math.random() < 0.5 ? BLUE : ORANGE), t: 1.4, end: -1, busy: false };
    ST.set(G.demo.st);
    ST.last(-1, -1);
  }
  function demoUpdate(dt) {
    const d = G.demo;
    if (!d) return;
    if (d.end >= 0) {
      d.end -= dt;
      if (d.end < 0) demoStart();
      return;
    }
    if (d.busy) return;
    d.t -= dt;
    if (d.t > 0) return;
    const st = d.st;
    const m = R.cpuMove(st, Math.random() < 0.7 ? 'easy' : 'normal');
    const ev = m && R.play(st, m.from, m.to);
    if (!ev) return demoStart();
    d.busy = true;
    ST.last(m.from, m.to);
    G.sides[ev.side].actor.act('give', 0.45, 0, true);
    ST.move(ev, () => {
      if (G.state !== 'home' || G.demo !== d) return;
      d.busy = false;
      d.t = 1.0;
      if (ev.capture >= 0) {
        G.sides[ev.side].actor.react('cheer');
        G.sides[1 - ev.side].actor.react('oops');
      }
      if (st.over || st.ply >= 90) {
        d.end = 3.2;
        if (st.winner >= 0) {
          G.sides[st.winner].actor.react('signature');
          G.sides[1 - st.winner].actor.react('shrug');
        }
      }
    });
  }

  function refreshHome() {
    const seg = (el, v) => {
      for (const b of el.children) {
        const on = b.dataset.v === String(v);
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on);
        b.setAttribute('role', 'radio');
      }
    };
    seg(ui.segPlayers, prefs.players);
    seg(ui.segWho, prefs.who);
    seg(ui.segLevel, levelFor(prefs.who));
    seg(ui.segUndo, prefs.undo ? 'on' : 'off');
    ui.segWho.style.display = ui.segLevel.style.display = prefs.players === 1 ? '' : 'none';
    ui.duo.style.display = prefs.players === 2 ? '' : 'none';
  }

  function setPref(k, v) {
    gesture();
    if (k === 'level') prefs.levels = Object.assign({}, prefs.levels, { [prefs.who]: v });
    else if (k === 'undo') prefs.undo = v === 'on' || v === true;
    else prefs[k] = v;
    save();
    refreshHome();
    JC.sfx.kit('click');
    if (k === 'who' && G.state === 'home') {
      const s = G.sides && G.sides.find((x) => x.id === v);
      if (s) s.actor.react('hello');
    }
  }

  // ---------------------------------------------------------------- the rules screen

  function openRules() {
    gesture();
    if (G.state === 'rules') return;
    G.rulesFrom = G.state;
    if (G.state === 'paused') show(ui.pause, false);
    G.state = 'rules';
    show(ui.rules, true);
    ui.rules.querySelector('.panel').scrollTop = 0;
    JC.sfx.kit('click');
  }
  function closeRules() {
    if (G.state !== 'rules') return;
    show(ui.rules, false);
    G.state = G.rulesFrom || 'home';
    if (G.state === 'paused') show(ui.pause, true);
    G.rulesFrom = null;
    JC.sfx.kit('click');
  }

  // ---------------------------------------------------------------- HUD

  function setupHud() {
    const a = G.sides[G.kid], b = G.sides[1 - G.kid];
    ui.faceL.src = art[a.id];
    ui.faceR.src = art[b.id];
    ui.faceL.className = a.side === ORANGE ? 'o' : '';
    ui.faceR.className = b.side === ORANGE ? 'o' : '';
    if (G.players === 1) {
      const bud = JC.buddy.entry;
      ui.callBtn.innerHTML = `<img alt="" src="${art[bud.id]}"><kbd>T</kbd>`;
      const nice = bud.name[0] + bud.name.slice(1).toLowerCase();
      ui.callBtn.title = `Call ${nice} (T)`;
      ui.callBtn.setAttribute('aria-label', `Call ${nice}`);
    } else {
      ui.callBtn.innerHTML = '🙌<kbd>T</kbd>';
      ui.callBtn.title = 'High five! (T)';
      ui.callBtn.setAttribute('aria-label', 'High five!');
    }
    ui.undoBtn.classList.toggle('off', !prefs.undo);
  }

  function renderScore() {
    ui.scoreL.textContent = G.wins[G.kid];
    ui.scoreR.textContent = G.wins[1 - G.kid];
    updateUndo();
  }
  function bumpScore(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }
  function updateUndo() {
    if (!ui) return;
    ui.undoBtn.disabled = !canUndo();
  }

  const cache = {};
  function setText(el, key, v) {
    if (cache[key] !== v) {
      cache[key] = v;
      el.textContent = v;
    }
  }

  function updateTurnText() {
    if (!G.st || !ui) return;
    const s = current();
    const st = G.st;
    let text = '', mine = false;
    if (G.state === 'ended' || G.state === 'over' || st.over) text = st.winner >= 0 ? `${nameOf(G.sides[st.winner].id)} WINS!` : 'DRAW!';
    else if (!s.human) text = `${nameOf(s.id)} IS THINKING…`;
    else if (G.players === 1) {
      text = 'YOUR TURN!';
      mine = true;
    } else {
      text = `${nameOf(s.id)}'S TURN!`;
      mine = true;
    }
    setText(ui.turn, 'turn', text);
    ui.turn.classList.toggle('mine', mine);
    ui.sideL.classList.toggle('now', !st.over && st.turn === G.kid);
    ui.sideR.classList.toggle('now', !st.over && st.turn !== G.kid);
    const left = st.limit - st.ply;
    show(ui.movesLeft, !st.over && left <= 20);
    if (left <= 20) setText(ui.movesLeft, 'left', left === 1 ? '1 MOVE LEFT' : `${left} MOVES LEFT`);
    updateUndo();
  }

  function toast(text, cls) {
    const el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '');
    el.textContent = text;
    ui.toasts.appendChild(el);
    setTimeout(() => el.remove(), /save/.test(cls || '') ? 2850 : 1950);
    while (ui.toasts.children.length > 3) ui.toasts.firstChild.remove();
  }
  function clearToasts() {
    if (ui) ui.toasts.innerHTML = '';
  }

  function show(el, on) {
    el.classList.toggle('hidden', !on);
  }

  // ---------------------------------------------------------------- your brother and the high five

  function call() {
    gesture();
    if (!G.sides || !['play', 'ended', 'over'].includes(G.state)) return 'none';
    if (G.players === 2) return JC.highFive.start();
    return JC.buddy.call();
  }

  const buddyApi = {
    toast: (t, c) => toast(t, c),
    player: () => kid().actor,
    spot: () => spots.buddy,
    scale: () => SCALE,
    turnId: () => G.turnId,
    canHint: () => G.state === 'play' && G.st && !G.st.over && current() === kid() && !G.busy && G.waitT <= 0,
    roundOver: () => G.state !== 'play' || (G.st && G.st.over),
    showHint() {
      const h = R.hint(G.st);
      if (!h) return null;
      ST.hint(h.from, h.to, h.kind === 'danger' ? h.danger : -1);
      return h;
    },
    clearHint: () => ST.hint(-1, -1, -1),
    players: () => [G.sides[0].actor, G.sides[1].actor],
    meet: () => spots.meet,
    homes: () => spots.sides,
    get flyers() { return flyers; },
  };

  // ---------------------------------------------------------------- input

  let audioReady = false;
  function gesture() {
    if (!audioReady) {
      audioReady = true;
      S.init();
      S.music('title');
    } else S.init();
  }

  // the arrow keys move the cursor the way they point on the screen, whichever way the camera looks
  function moveCursor(sx, sy) {
    if (G.state !== 'play') return;
    if (G.cursor < 0) {
      G.cursor = G.sel >= 0 ? G.sel : R.DEN[G.st.turn] + (G.st.turn === BLUE ? -R.COLS : R.COLS);
    } else {
      const az = G.az;
      const dc = Math.round(Math.cos(az) * sx - Math.sin(az) * sy);
      const dr = Math.round(-Math.sin(az) * sx - Math.cos(az) * sy);
      const c = Math.min(R.COLS - 1, Math.max(0, R.colOf(G.cursor) + dc));
      const r = Math.min(R.ROWS - 1, Math.max(0, R.rowOf(G.cursor) + dr));
      G.cursor = R.idx(c, r);
    }
    JC.sfx.tick();
  }

  // 1 – 8: pick up your animal with that number
  function pickRank(n) {
    if (!canAct()) return;
    const v = R.piece(G.st.turn, n);
    const i = G.st.b.indexOf(v);
    if (i < 0) {
      JC.sfx.nope();
      toast(`YOUR ${R.NAMES[n]} IS NAPPING!`, 'hint');
      return;
    }
    G.cursor = i;
    onSquare(i);
  }

  function bindInput() {
    ui.canvas.addEventListener('pointerdown', (e) => {
      gesture();
      if (G.state !== 'play') return;
      const i = ST.pick(e.clientX, e.clientY);
      G.cursor = -1;
      onSquare(i);
    });
    ui.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      let on = false;
      if (canAct()) {
        const i = ST.pick(e.clientX, e.clientY);
        on = i >= 0 && ((G.st.b[i] && R.sideOf(G.st.b[i]) === G.st.turn) || (G.sel >= 0 && R.legalFrom(G.st, G.sel).includes(i)));
      }
      ui.canvas.style.cursor = on ? 'pointer' : '';
    });
    const tap = (el, fn) => el.addEventListener('click', (e) => {
      e.stopPropagation();
      gesture();
      fn();
    });
    tap(ui.goPlay, () => startGame({}));
    tap(ui.goRules, openRules);
    for (const b of ui.segPlayers.children) tap(b, () => setPref('players', +b.dataset.v));
    for (const b of ui.segWho.children) tap(b, () => setPref('who', b.dataset.v));
    for (const b of ui.segLevel.children) tap(b, () => setPref('level', b.dataset.v));
    for (const b of ui.segUndo.children) tap(b, () => setPref('undo', b.dataset.v));
    ui.callBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      call();
    });
    tap(ui.pauseBtn, () => pause(true));
    tap(ui.undoBtn, undo);
    tap(ui.rulesBtn, openRules);
    tap(ui.rulesOk, closeRules);
    tap(ui.pResume, () => pause(false));
    tap(ui.pRestart, restartGame);
    tap(ui.pRules, openRules);
    tap(ui.pHome, goHome);
    tap(ui.oAgain, again);
    tap(ui.oHome, goHome);
    tap(ui.muteBtn, toggleMute);
    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      gesture();
      const k = e.key.toLowerCase();
      const pad = /^Numpad([1-8])$/.exec(e.code);
      const digit = pad ? +pad[1] : /^[1-8]$/.test(e.key) ? +e.key : 0;
      if (k === 'm') return toggleMute();
      if (G.state === 'rules') {
        if (k === 'escape' || k === 'enter' || k === ' ' || k === 'r') closeRules();
        return;
      }
      if (G.state === 'home') {
        if (k === 'enter' || k === ' ') startGame({});
        else if (k === 'r') openRules();
        else if (k === 'arrowleft' || k === 'arrowright') setPref('who', prefs.who === 'teddy' ? 'tommy' : 'teddy');
        else if (k === 'arrowup' || k === 'arrowdown') setPref('players', prefs.players === 1 ? 2 : 1);
        else if (k === 'l') setPref('level', levelFor(prefs.who) === 'easy' ? 'normal' : 'easy');
        else if (k === 'u') setPref('undo', prefs.undo ? 'off' : 'on');
        return;
      }
      if (k === 't') return call();
      if (k === 'r') return openRules();
      if (k === 'u' || k === 'backspace') {
        e.preventDefault();
        return undo();
      }
      if (G.state === 'paused') {
        if (k === 'escape' || k === 'p' || k === 'enter' || k === ' ') pause(false);
        else if (k === 'n') restartGame();
        return;
      }
      if (G.state === 'over' || G.state === 'ended') {
        if ((k === 'enter' || k === ' ') && G.state === 'over') again();
        else if (k === 'escape') goHome();
        else if (k === 'n') again();
        return;
      }
      if (k === 'p') return pause(true);
      if (k === 'escape') {
        if (G.sel >= 0) return select(-1);
        return pause(true);
      }
      if (k === 'n') return restartGame();
      if (G.state !== 'play') return;
      if (digit) pickRank(digit);
      else if (k === 'arrowleft') moveCursor(-1, 0);
      else if (k === 'arrowright') moveCursor(1, 0);
      else if (k === 'arrowup') moveCursor(0, 1);
      else if (k === 'arrowdown') moveCursor(0, -1);
      else if ((k === 'enter' || k === ' ') && G.cursor >= 0) onSquare(G.cursor);
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    });
    addEventListener('resize', layout);
    document.addEventListener('visibilitychange', () => (document.hidden ? S.suspend() : S.resume()));
  }

  function pause(on) {
    if (on && (G.state === 'play' || G.state === 'ended' || G.state === 'over')) {
      G.pausedFrom = G.state;
      G.state = 'paused';
      show(ui.pause, true);
      S.music('pause');
    } else if (!on && G.state === 'paused') {
      G.state = G.pausedFrom || 'play';
      show(ui.pause, false);
      S.music('title');
    }
  }

  function toggleMute() {
    const muted = S.toggleMute();
    ui.muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  // ---------------------------------------------------------------- the loop

  const tmp = new THREE.Vector3();
  function step(dt) {
    dt = Math.min(dt, 0.1);
    // the window can start at 0 x 0 (a hidden tab) and resize without an event reaching us: re-fit when it changes
    if ((innerWidth || 1) !== ST.W || (innerHeight || 1) !== ST.H) layout();
    const running = !['paused', 'boot', 'rules'].includes(G.state);
    if (running) {
      if (G.state === 'home') demoUpdate(dt);
      if (G.state === 'play') {
        if (G.waitT > 0) {
          G.waitT -= dt;
          if (G.waitT <= 0 && !G.st.over && !G.busy) beginTurn();
        } else if (G.cpuT > 0 && !G.busy) {
          G.cpuT -= dt;
          if (G.cpuT <= 0) {
            const s = current();
            const m = R.cpuMove(G.st, s.human ? G.autoLevel : G.level);
            if (m) doMove(m.from, m.to, s.human);
          }
        }
        if (G.endT > 0) {
          G.endT -= dt;
          if (G.endT <= 0) endGame();
        }
      }
      if (G.state === 'ended' && G.panelT > 0) {
        G.panelT -= dt;
        if (G.panelT <= 0) showOverPanel();
      }
      ST.update(dt);
      flyers.update(dt);
      bursts.update(dt);
      if (G.sides) G.sides.forEach((s) => s.actor.update(dt));
      JC.buddy.update(dt);
      JC.highFive.update(dt);
    }
    // the paw over whoever is to move
    const st = G.state === 'home' ? G.demo && G.demo.st : G.st;
    if (G.sides) {
      G.sides.forEach((s, k) => {
        const on = st && !st.over && st.turn === k && G.state !== 'home';
        const bdg = badges[k];
        bdg.visible = !!on;
        if (on) {
          s.actor.root.getWorldPosition(tmp);
          bdg.position.set(tmp.x, 2 * SCALE + 0.45 + Math.abs(Math.sin(performance.now() / 260)) * 0.16, tmp.z);
        }
      });
    }
    ST.cursor(G.state === 'play' ? G.cursor : -1);
    JC.fx.overlay.update(dt);
    ui.callBtn.classList.toggle('here', JC.buddy.on || JC.highFive.on);
    ST.render();
  }

  function frame(now) {
    const dt = G.last ? (now - G.last) / 1000 : 0.016;
    G.last = now;
    if (!G.held) step(dt);
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot

  function boot() {
    ui = {
      canvas: $('game'), home: $('home'), hud: $('hud'), hudtop: document.querySelector('.hudtop'), logo: $('logo'), tools: $('tools'),
      goPlay: $('goPlay'), goRules: $('goRules'), segPlayers: $('segPlayers'), segWho: $('segWho'), segLevel: $('segLevel'), segUndo: $('segUndo'),
      duo: $('duo'), duoA: $('duoA'), duoB: $('duoB'), pauseBtn: $('pauseBtn'), muteBtn: $('muteBtn'), sideL: $('sideL'),
      sideR: $('sideR'), faceL: $('faceL'), faceR: $('faceR'), scoreL: $('scoreL'), scoreR: $('scoreR'), turn: $('turn'),
      movesLeft: $('movesLeft'), undoBtn: $('undoBtn'), rulesBtn: $('rulesBtn'), callBtn: $('callBtn'), toasts: $('toasts'),
      gameOver: $('gameOver'), oFace: $('oFace'), oTitle: $('oTitle'), oWhy: $('oWhy'), oScore: $('oScore'), oAgain: $('oAgain'),
      oHome: $('oHome'), pause: $('pause'), pResume: $('pResume'), pRestart: $('pRestart'), pRules: $('pRules'), pHome: $('pHome'),
      rules: $('rules'), rulesOk: $('rulesOk'),
    };
    // the logo: the first word small on top, the rest big ("TT" / "Jungle Chess"); a one-word name is all big
    const words = window.JC_TITLE.split(' ');
    ui.logo.querySelector('small').textContent = words.length > 1 ? words[0] : '';
    ui.logo.querySelector('big').textContent = words.length > 1 ? words.slice(1).join(' ') : words[0];
    ui.muteBtn.textContent = S.isMuted() ? '🔇' : '🔊';
    ST.init(ui.canvas);
    JC.fx.overlay.init($('fx'));
    flyers = JC.fx.flyers(ST.scene, 70);
    bursts = JC.fx.bursts(ST.scene, 6);
    ST.useFx(flyers, bursts);
    actors.forEach((a) => a.attach(ST.scene, flyers));
    art = Kit.portraits(['teddy', 'tommy', 'bolt', 'bruno'].map((id) => Kit.roster.get(id)), { size: 160 });
    ui.segWho.children[0].querySelector('img').src = art.teddy;
    ui.segWho.children[1].querySelector('img').src = art.tommy;
    ui.segLevel.children[0].querySelector('img').src = art.bruno;
    ui.segLevel.children[1].querySelector('img').src = art.bolt;
    ui.duoA.src = art.teddy;
    ui.duoB.src = art.tommy;
    JC.buddy.init(buddyApi);
    if (Kit.lang) Kit.lang.onChange(() => ST.relabel());
    bindInput();
    goHome();
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- test hook

  const sq = (c, r) => R.idx(c, r);
  window.game = {
    // advance `secs` of game time in 1/60 s steps, rendering once at the end (works while the pane is hidden)
    step(secs = 0.1) {
      const n = Math.max(1, Math.round(secs * 60));
      for (let i = 0; i < n; i++) step(1 / 60);
      return game.info();
    },
    hold(on = true) { G.held = on; },
    // start({ players: 1 | 2, who: 'teddy' | 'tommy', level: 'easy' | 'normal', undo: true | false })
    start(opts = {}) {
      startGame(opts);
      return game.info();
    },
    home: () => goHome(),
    tap: (i) => onSquare(i),                  // tap square i (row * 7 + col) for the kid whose turn it is
    tapAt: (c, r) => onSquare(sq(c, r)),
    move: (from, to) => (canAct() ? doMove(from, to, true) : false),
    key: (k) => dispatchEvent(new KeyboardEvent('keydown', { key: k })),
    call: () => call(),
    undo: () => undo(),
    pause: (on = true) => pause(on),
    rules: (on = true) => (on ? openRules() : closeRules()),
    again: () => again(),
    restart: () => restartGame(),
    // let a test bot play the kid's side too ('normal', 'easy' or 'random')
    auto(on = true, level = 'normal') {
      G.auto = on;
      G.autoLevel = level;
      if (on && G.state === 'play' && current() && current().human && G.cpuT < 0 && G.waitT <= 0 && !G.busy) G.cpuT = 0.25;
    },
    // set up a board (for screenshots and tests): pieces [[side, rank, col, row], ...], turn, and napping animals [id, ...]
    setup(list, turn = G.st.turn, naps = []) {
      const st = R.newGame(turn);
      st.b.fill(0);
      for (const [s, rank, c, r] of list) st.b[sq(c, r)] = R.piece(s, rank);
      st.naps = naps.slice();
      G.st = st;
      G.history = [];
      Object.assign(G, { sel: -1, busy: false, cpuT: -1, waitT: -1, endT: -1, panelT: -1, state: 'play' });
      ST.set(st);
      ST.last(-1, -1);
      beginTurn();
      return game.info();
    },
    check: (opts = {}) => JC.check(Object.assign({ games: 4 }, opts)),
    checkRules: () => JC.checkRules(),
    rates: (n) => JC.rates(n),
    info() {
      const st = G.st;
      return {
        state: G.state, players: G.players, level: G.level, kid: G.kid, az: +G.az.toFixed(2), wide: G.wide,
        sides: G.sides && G.sides.map((s) => ({ id: s.id, side: s.side, human: s.human, pose: s.actor && s.actor.pose })),
        turn: st && st.turn, ply: st && st.ply, over: st && st.over, winner: st && st.winner, reason: st && st.reason,
        pieces: st ? R.count(st.b, BLUE) + R.count(st.b, ORANGE) : 0, naps: st ? st.naps.slice() : [],
        wins: G.wins.slice(), draws: G.draws, sel: G.sel, shown: ST.shown.length, busy: G.busy, history: G.history.length, canUndo: canUndo(),
        buddy: JC.buddy.info(), hint: { from: ST.hintFrom, to: ST.hintTo }, panel: !ui.gameOver.classList.contains('hidden') ? 'over' : null,
        rules: !ui.rules.classList.contains('hidden'), undoOn: prefs.undo,
      };
    },
    get G() { return G; },
    get R() { return R; },
  };

  let booted = false;
  const go = () => {
    if (booted) return;
    booted = true;
    boot();
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go);
  setTimeout(go, 1500);
})();
