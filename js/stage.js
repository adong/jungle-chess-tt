/* TT Jungle Chess: the renderer, the jungle and the board.
   The board is a chunky earth tray in a jungle clearing: 51 grass tiles, two rivers (animated water, lily pads), three
   rope-net traps round each den, and each den a grass tile with a little straw hut just behind it. Each animal is a
   round puck in its side's colour (blue for Teddy's side, orange for Tommy's) with a standing badge: the emoji face,
   its rank number in a big yellow bubble, and its name. A beaten animal flies to its side's napping pen and sleeps.
     set(state)            every piece where the state says, straight away (a new game)
     sync(state)           every piece glides to where the state says (undo)
     move(ev, done)        a step, a swim or a river jump; a capture BONKs and sends the beaten animal to its pen
     select(i) / moves(from, list)   the picked-up piece, and dots on the squares it can go to
     last(from, to)        the last move, in soft yellow
     hint(from, to, danger)   your brother's tip: the piece and the square glow, and a ❗ over an animal in danger
     cursor(i), shake(secs), pick(x, y), toScreen(v)
   fit(points, elev, az, margins) aims the camera so world points fill the screen minus margins (in pixels). */
(function () {
  'use strict';
  const T = THREE;
  const JC = (window.JC = window.JC || {});
  const R = JC.rules;
  const { makeCanvas, toTexture, std, rand, pick: pickOne, radialTexture, emojiTexture, FONT, EMOJI_FONT } = Kit.gfx;

  const P = 1.0;                       // one square
  const TILE = 0.94, TILE_H = 0.16, BASE_H = 0.3;
  const TOP = BASE_H + TILE_H;         // height of the grass tops
  const WATER_Y = BASE_H + 0.05;
  const RIM = 0.42;
  const HW = 3.5 * P + RIM, HD = 4.5 * P + RIM; // half the tray: width (x, 7 columns) and depth (z, 9 rows)
  const END = HD + 1.15;               // how far the ends (huts, pens, the boys) are from the middle
  const COL = { 0: '#2f7cf0', 1: '#ff8a1f' };
  const LIGHT = { 0: '#bcd8ff', 1: '#ffd9b0' };
  const PUCK_R = 0.39, PUCK_H = 0.16, BADGE = 0.98, NAP = 0.6;

  let renderer = null, W = 1, H = 1;
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(36, 1, 0.1, 300);
  const camBase = new T.Vector3();
  const pieces = [];   // 16: { id, side, rank, g, puck, badge, at (square or -1), nap (slot or -1), anim }
  const fx = { t: 0, shake: 0, sel: -1, hintFrom: -1, hintTo: -1, danger: -1, hintT: 0, cursor: -1, flip: 1 };
  const waters = [];
  let flyers = null, bursts = null;
  const pens = [null, null];
  const huts = [null, null];

  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    buildJungle();
    buildBoard();
    buildPieces();
    buildMarks();
    resize();
  }
  function useFx(fl, bu) {
    flyers = fl;
    bursts = bu;
  }

  function resize() {
    W = Math.max(1, innerWidth || 1);
    H = Math.max(1, innerHeight || 1);
    if (renderer) renderer.setSize(W, H, false);
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- shapes

  // A rounded rectangle slab, w wide (x) and d deep (z), h tall, centred on the origin, flat on y.
  function slab(w, d, h, r, bevel = 0.04) {
    const s = new T.Shape();
    const x = -w / 2 + bevel, y = -d / 2 + bevel, ww = w - 2 * bevel, dd = d - 2 * bevel, rr = Math.max(0.01, r - bevel);
    s.moveTo(x + rr, y);
    s.lineTo(x + ww - rr, y);
    s.quadraticCurveTo(x + ww, y, x + ww, y + rr);
    s.lineTo(x + ww, y + dd - rr);
    s.quadraticCurveTo(x + ww, y + dd, x + ww - rr, y + dd);
    s.lineTo(x + rr, y + dd);
    s.quadraticCurveTo(x, y + dd, x, y + dd - rr);
    s.lineTo(x, y + rr);
    s.quadraticCurveTo(x, y, x + rr, y);
    const g = new T.ExtrudeGeometry(s, { depth: h - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 5 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -(h - 2 * bevel) / 2, 0);
    return g;
  }

  // ---------------------------------------------------------------- the jungle round the board

  function groundTexture() {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#6cc04a';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,200,0.08)' : 'rgba(20,70,10,0.10)';
      g.fillRect(Math.random() * 256, Math.random() * 256, 2, 5);
    }
    return toTexture(c, true);
  }

  function buildJungle() {
    scene.background = new T.Color('#a8e6ff');
    scene.fog = new T.Fog('#a8e6ff', 30, 70);
    scene.add(new T.HemisphereLight('#ffffff', '#4c7a2c', 0.9));
    const sun = new T.DirectionalLight('#fff1d6', 0.95);
    sun.position.set(-6, 14, 9);
    scene.add(sun);

    const tex = groundTexture();
    tex.repeat.set(26, 26);
    const ground = new T.Mesh(new T.PlaneGeometry(140, 140), std('#ffffff', { map: tex, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    // a sandy clearing under the board
    const sand = new T.Mesh(new T.CircleGeometry(1, 40), std('#e9d29a', { roughness: 1 }));
    sand.rotation.x = -Math.PI / 2;
    sand.scale.set(HW + 4.6, HD + 3.4, 1);
    sand.position.y = 0.01;
    scene.add(sand);

    const leaf = [std('#2f9a3a'), std('#41b04a'), std('#2a8834'), std('#58c25a')];
    const trunkMat = std('#9a6a3a');
    const palm = (x, z, s) => {
      const g = new T.Group();
      let px = 0, py = 0;
      const lean = rand(-0.25, 0.25);
      for (let i = 0; i < 6; i++) {
        const seg = new T.Mesh(new T.CylinderGeometry(0.17 * s, 0.22 * s, 0.62 * s, 7), trunkMat);
        px += lean * 0.12 * s * i;
        seg.position.set(px, py + 0.31 * s, 0);
        seg.rotation.z = -lean * 0.25;
        g.add(seg);
        py += 0.58 * s;
      }
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const fr = new T.Mesh(new T.ConeGeometry(0.32 * s, 2.0 * s, 4), leaf[k % 4]);
        fr.scale.set(1, 1, 0.25);
        fr.position.set(px + Math.cos(a) * 0.8 * s, py - 0.05 * s, Math.sin(a) * 0.8 * s);
        fr.rotation.set(0, -a, 0);
        fr.rotateZ(-1.9);
        g.add(fr);
      }
      for (let k = 0; k < 3; k++) {
        const nut = new T.Mesh(new T.SphereGeometry(0.13 * s, 8, 6), std('#7a4a22'));
        nut.position.set(px + Math.cos(k * 2.1) * 0.18 * s, py - 0.2 * s, Math.sin(k * 2.1) * 0.18 * s);
        g.add(nut);
      }
      g.position.set(x, 0, z);
      scene.add(g);
    };
    const bush = (x, z, s) => {
      for (let i = 0; i < 3; i++) {
        const b = new T.Mesh(new T.SphereGeometry(0.7 * s, 12, 9), leaf[i]);
        b.position.set(x + (i - 1) * 0.6 * s, 0.42 * s + (i === 1 ? 0.25 * s : 0), z + (i % 2) * 0.2);
        b.scale.y = 0.85;
        scene.add(b);
      }
    };
    const fern = (x, z, s) => {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const f = new T.Mesh(new T.ConeGeometry(0.16 * s, 1.1 * s, 3), leaf[(k + 1) % 4]);
        f.scale.set(1, 1, 0.3);
        f.position.set(x + Math.cos(a) * 0.35 * s, 0.35 * s, z + Math.sin(a) * 0.35 * s);
        f.rotation.set(0, -a, 0);
        f.rotateZ(-1.0);
        scene.add(f);
      }
    };
    const rock = (x, z, s) => {
      const r = new T.Mesh(new T.DodecahedronGeometry(0.5 * s, 0), std('#a7a29a', { roughness: 0.9 }));
      r.position.set(x, 0.25 * s, z);
      r.rotation.set(rand(0, 3), rand(0, 3), 0);
      r.scale.y = 0.6;
      scene.add(r);
    };
    // a ring of palms and bushes round the clearing, kept clear of the board, the ends and the camera's way in
    const clear = (x, z) => Math.abs(x) < HW + 3.2 && Math.abs(z) < END + 2.6;
    const spots = [[-9, -9], [9, -9], [-12, 0], [12, 0], [-9, 9], [9, 9], [0, -13], [-5, -12], [5, -12.5], [-13, -6], [13, -6], [-13, 6], [13, 6], [0, 13], [-5, 12.5], [5, 12]];
    spots.forEach(([x, z], k) => palm(x + rand(-0.8, 0.8), z + rand(-0.8, 0.8), rand(1.1, 1.5) * (k % 3 ? 1 : 1.2)));
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2), d = rand(8, 15);
      const x = Math.cos(a) * d * 1.05, z = Math.sin(a) * d;
      if (clear(x, z)) continue;
      (i % 3 === 0 ? fern : bush)(x, z, rand(0.9, 1.5));
    }
    for (let i = 0; i < 9; i++) {
      const a = rand(0, Math.PI * 2), d = rand(7.5, 12);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!clear(x, z)) rock(x, z, rand(0.7, 1.4));
    }
    // flowers
    const petals = ['#ff6f91', '#ffd23f', '#ffffff', '#a77bff', '#ff8a1f'];
    const stem = std('#2f8a2a'), centre = std('#ffcc00');
    for (let i = 0; i < 90; i++) {
      const x = rand(-15, 15), z = rand(-14, 14);
      if (clear(x, z)) continue;
      const f = new T.Group();
      const s = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.35, 5), stem);
      s.position.y = 0.17;
      f.add(s);
      const head = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), std(pickOne(petals)));
      head.position.y = 0.38;
      head.scale.y = 0.6;
      f.add(head);
      const dot = new T.Mesh(new T.SphereGeometry(0.05, 6, 4), centre);
      dot.position.y = 0.43;
      f.add(dot);
      f.position.set(x, 0, z);
      scene.add(f);
    }
  }

  // ---------------------------------------------------------------- the board

  function grassTexture(base, light) {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = base;
    g.fillRect(0, 0, 128, 128);
    const grad = g.createRadialGradient(64, 64, 30, 64, 64, 96);
    grad.addColorStop(0, 'rgba(255,255,255,0.10)');
    grad.addColorStop(1, 'rgba(20,60,10,0.22)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = light;
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const x = rand(14, 114), y = rand(18, 112);
      g.beginPath();
      g.moveTo(x - 4, y + 4);
      g.lineTo(x - 6, y - 4);
      g.moveTo(x, y + 4);
      g.lineTo(x, y - 6);
      g.moveTo(x + 4, y + 4);
      g.lineTo(x + 6, y - 4);
      g.stroke();
    }
    return tileTex(c);
  }
  function trapTexture(side) {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = '#b8864f';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(90,50,20,0.18)' : 'rgba(255,230,180,0.15)';
      g.beginPath();
      g.arc(rand(0, 128), rand(0, 128), rand(1, 4), 0, 7);
      g.fill();
    }
    // a rope net
    g.strokeStyle = '#f6dfa8';
    g.lineWidth = 5;
    for (let k = -128; k < 256; k += 26) {
      g.beginPath();
      g.moveTo(k, 0);
      g.lineTo(k + 128, 128);
      g.moveTo(k + 128, 0);
      g.lineTo(k, 128);
      g.stroke();
    }
    g.strokeStyle = 'rgba(90,50,20,0.5)';
    g.lineWidth = 1.5;
    for (let k = -128; k < 256; k += 26) {
      g.beginPath();
      g.moveTo(k + 2, 0);
      g.lineTo(k + 130, 128);
      g.stroke();
    }
    // the owner's colour round the edge
    g.strokeStyle = COL[side];
    g.lineWidth = 12;
    Kit.gfx.roundRect(g, 6, 6, 116, 116, 18);
    g.stroke();
    return tileTex(c);
  }
  function denTexture(side) {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = '#ffe08a';
    g.fillRect(0, 0, 128, 128);
    const grad = g.createRadialGradient(64, 64, 10, 64, 64, 80);
    grad.addColorStop(0, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,170,0,0.25)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    // a big paw print
    g.fillStyle = COL[side];
    g.globalAlpha = 0.85;
    g.beginPath();
    g.ellipse(64, 76, 22, 18, 0, 0, 7);
    g.fill();
    for (const [x, y] of [[38, 50], [54, 38], [74, 38], [90, 50]]) {
      g.beginPath();
      g.ellipse(x, y, 8, 10, 0, 0, 7);
      g.fill();
    }
    g.globalAlpha = 1;
    g.strokeStyle = COL[side];
    g.lineWidth = 10;
    Kit.gfx.roundRect(g, 5, 5, 118, 118, 18);
    g.stroke();
    return tileTex(c);
  }
  function tileTex(c) {
    const t = toTexture(c);
    t.repeat.set(1 / TILE, 1 / TILE);
    t.offset.set(0.5, 0.5);
    return t;
  }
  function waterTexture() {
    const [c, g] = makeCanvas(128, 128);
    g.fillStyle = '#3cb5f2';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 4;
    g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x = rand(8, 100), y = rand(8, 120);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 7, y - 6, x + 14, y);
      g.quadraticCurveTo(x + 21, y + 6, x + 28, y);
      g.stroke();
    }
    return toTexture(c, true);
  }

  const tiles = [];
  function buildBoard() {
    const board = new T.Group();
    scene.add(board);
    const base = new T.Mesh(slab(HW * 2, HD * 2, BASE_H, 0.5, 0.08), [std('#8a5a32', { roughness: 0.9 }), std('#74491f', { roughness: 0.9 })]);
    base.position.y = BASE_H / 2;
    board.add(base);
    // a grassy lip round the edge
    const lip = new T.Mesh(slab(HW * 2 - 0.08, HD * 2 - 0.08, 0.05, 0.46, 0.02), std('#5aa83c'));
    lip.position.y = BASE_H + 0.01;
    board.add(lip);

    const side = std('#5d9a35', { roughness: 0.9 });
    const tex = {
      a: grassTexture('#93d95c', 'rgba(220,255,170,0.55)'), b: grassTexture('#7fcb4c', 'rgba(200,250,150,0.45)'),
      trap0: trapTexture(0), trap1: trapTexture(1), den0: denTexture(0), den1: denTexture(1),
    };
    const mats = {};
    for (const k in tex) mats[k] = std('#ffffff', { map: tex[k], roughness: 0.8 });
    const geo = slab(TILE, TILE, TILE_H, 0.14, 0.04);
    for (let i = 0; i < R.N; i++) {
      if (R.water[i]) {
        tiles.push(null);
        continue;
      }
      const c = R.colOf(i), r = R.rowOf(i);
      let key = (c + r) % 2 ? 'b' : 'a';
      if (R.trapOwner[i] >= 0) key = 'trap' + R.trapOwner[i];
      if (i === R.DEN[0]) key = 'den0';
      if (i === R.DEN[1]) key = 'den1';
      const m = new T.Mesh(geo, [mats[key], side]);
      m.position.set((c - 3) * P, BASE_H + TILE_H / 2, (r - 4) * P);
      board.add(m);
      tiles.push(m);
    }
    // the rivers: one sheet of water each, lily pads, a darker bed
    for (const cx of [-1.5, 1.5]) {
      const wt = waterTexture();
      wt.repeat.set(2, 3);
      const wmat = new T.MeshStandardMaterial({ color: '#ffffff', map: wt, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 });
      const w = new T.Mesh(new T.PlaneGeometry(2 * P, 3 * P), wmat);
      w.rotation.x = -Math.PI / 2;
      w.position.set(cx * P, WATER_Y, 0);
      board.add(w);
      waters.push(wt);
      const bed = new T.Mesh(new T.PlaneGeometry(2 * P, 3 * P), std('#1d6fa8'));
      bed.rotation.x = -Math.PI / 2;
      bed.position.set(cx * P, BASE_H + 0.005, 0);
      board.add(bed);
      for (let k = 0; k < 3; k++) {
        const pad = new T.Mesh(new T.CircleGeometry(0.16, 12, 0.3, Math.PI * 1.8), std('#4fbf4a'));
        pad.rotation.x = -Math.PI / 2;
        pad.rotation.z = rand(0, 6);
        pad.position.set(cx * P + rand(-0.75, 0.75), WATER_Y + 0.01, rand(-1.3, 1.3));
        board.add(pad);
      }
    }
    // a straw hut behind each den, its door facing the board
    for (const s of [0, 1]) {
      const g = new T.Group();
      const body = new T.Mesh(new T.CylinderGeometry(0.42, 0.46, 0.55, 14), std(LIGHT[s]));
      body.position.y = 0.28;
      g.add(body);
      const roof = new T.Mesh(new T.ConeGeometry(0.62, 0.55, 14), std('#e8b54a', { roughness: 0.9 }));
      roof.position.y = 0.8;
      g.add(roof);
      const door = new T.Mesh(new T.CircleGeometry(0.17, 12, 0, Math.PI), new T.MeshBasicMaterial({ color: '#3a2412' }));
      door.position.set(0, 0.02, -0.465);
      door.rotation.y = Math.PI;
      g.add(door);
      const band = new T.Mesh(new T.TorusGeometry(0.45, 0.04, 6, 20), std(COL[s]));
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.52;
      g.add(band);
      g.position.set(0, 0, s === 0 ? HD + 0.55 : -(HD + 0.55));
      g.rotation.y = s === 0 ? 0 : Math.PI; // the door (on its -z side) faces the board
      scene.add(g);
      huts[s] = g;
    }
    // the napping pens: a straw bed with a little fence and a 💤 sign
    for (const s of [0, 1]) {
      const g = new T.Group();
      const [c, gg] = makeCanvas(128, 64);
      gg.fillStyle = '#f2d27a';
      gg.fillRect(0, 0, 128, 64);
      gg.strokeStyle = 'rgba(170,120,40,0.5)';
      gg.lineWidth = 2;
      for (let i = 0; i < 60; i++) {
        const x = rand(0, 128), y = rand(0, 64), a = rand(0, 3);
        gg.beginPath();
        gg.moveTo(x, y);
        gg.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10);
        gg.stroke();
      }
      const bed = new T.Mesh(slab(2.7, 1.45, 0.1, 0.3, 0.03), [std('#ffffff', { map: toTexture(c), roughness: 1 }), std('#d9a845')]);
      bed.position.y = 0.05;
      g.add(bed);
      const wood = std('#a9743f');
      const postGeo = new T.BoxGeometry(0.09, 0.42, 0.09);
      for (const [x, z] of [[-1.4, -0.78], [1.4, -0.78], [-1.4, 0.78], [1.4, 0.78], [0, 0.78], [-0.7, 0.78], [0.7, 0.78]]) {
        const p = new T.Mesh(postGeo, wood);
        p.position.set(x, 0.21, z);
        g.add(p);
      }
      for (const [w, x, z, ry] of [[2.86, 0, 0.78, 0], [1.6, -1.4, 0, Math.PI / 2], [1.6, 1.4, 0, Math.PI / 2]]) {
        const rail = new T.Mesh(new T.BoxGeometry(w, 0.06, 0.06), wood);
        rail.position.set(x, 0.32, z);
        rail.rotation.y = ry;
        g.add(rail);
      }
      const sign = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture('💤'), transparent: true, depthWrite: false }));
      sign.scale.setScalar(0.55);
      sign.position.set(1.4, 0.75, 0.78);
      g.add(sign);
      g.position.set(0, 0, s === 0 ? END : -END);
      g.rotation.y = s === 0 ? 0 : Math.PI; // the open side (-z) faces the board
      scene.add(g);
      pens[s] = g;
    }
  }

  // Where the huts, pens and boys go: x is mirrored so the boys stand on the far side in a side view.
  function ends(flip) {
    fx.flip = flip ? -1 : 1;
    for (const s of [0, 1]) {
      pens[s].position.x = PEN_X * fx.flip;
    }
    for (const p of pieces) if (p.at < 0 && p.nap >= 0 && !p.anim) placeNap(p);
  }
  const PEN_X = 2.15, CHAR_X = -2.85, BUDDY_X = -1.55;
  // spots for game.js: where each side's boy stands, and where the buddy pops in
  const spotFor = (s) => ({ x: CHAR_X * fx.flip, z: s === 0 ? END - 0.05 : -(END - 0.05) });
  const buddySpot = (s) => ({ x: BUDDY_X * fx.flip, z: s === 0 ? END + 0.35 : -(END + 0.35) });

  // ---------------------------------------------------------------- the animals

  const badgeCache = {};
  function badgeTexture(side, rank, sleepy) {
    const name = Kit.lang ? Kit.lang.t(R.NAMES[rank]) : R.NAMES[rank];
    const key = side + ':' + rank + ':' + name + (sleepy ? 'z' : '');
    if (badgeCache[key]) return badgeCache[key];
    const [c, g] = makeCanvas(256, 256);
    g.beginPath();
    g.arc(128, 128, 112, 0, Math.PI * 2);
    g.fillStyle = sleepy ? '#e9e4f2' : '#fffaf0';
    g.fill();
    g.lineWidth = 18;
    g.strokeStyle = COL[side];
    g.stroke();
    g.lineWidth = 5;
    g.strokeStyle = '#14121f';
    g.beginPath();
    g.arc(128, 128, 122, 0, Math.PI * 2);
    g.stroke();
    g.font = `100px ${EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(R.EMOJI[rank], 112, 116);
    // the name on a ribbon
    g.fillStyle = COL[side];
    Kit.gfx.roundRect(g, 34, 176, 188, 50, 22);
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#14121f';
    g.stroke();
    const fs = 34;
    g.font = `${fs}px ${FONT}`;
    const w = g.measureText(name).width;
    if (w > 168) g.font = `${Math.floor((fs * 168) / w)}px ${FONT}`;
    g.fillStyle = '#ffffff';
    g.fillText(name, 128, 203);
    // the rank, big, in a yellow bubble
    g.beginPath();
    g.arc(198, 60, 54, 0, Math.PI * 2);
    g.fillStyle = '#ffd400';
    g.fill();
    g.lineWidth = 7;
    g.strokeStyle = '#14121f';
    g.stroke();
    g.font = `80px ${FONT}`;
    g.lineWidth = 9;
    g.strokeStyle = '#ffffff';
    g.strokeText(String(rank), 198, 68);
    g.fillStyle = '#14121f';
    g.fillText(String(rank), 198, 68);
    return (badgeCache[key] = toTexture(c));
  }

  let shadowTex = null;
  function buildPieces() {
    shadowTex = radialTexture(64, [[0, 'rgba(20,30,10,0.45)'], [0.7, 'rgba(20,30,10,0.18)'], [1, 'rgba(20,30,10,0)']]);
    const puckGeo = new T.CylinderGeometry(PUCK_R, PUCK_R * 1.04, PUCK_H, 28);
    const capGeo = new T.CylinderGeometry(PUCK_R * 0.82, PUCK_R * 0.82, 0.02, 28);
    for (let id = 0; id < 16; id++) {
      const side = id >= 8 ? 1 : 0, rank = (id % 8) + 1;
      const g = new T.Group();
      const body = new T.Group();
      g.add(body);
      const puck = new T.Mesh(puckGeo, std(COL[side], { roughness: 0.4 }));
      puck.position.y = PUCK_H / 2;
      body.add(puck);
      const cap = new T.Mesh(capGeo, std(LIGHT[side], { roughness: 0.5 }));
      cap.position.y = PUCK_H + 0.01;
      body.add(cap);
      const badge = new T.Sprite(new T.SpriteMaterial({ map: badgeTexture(side, rank), transparent: true }));
      badge.scale.setScalar(BADGE);
      badge.position.y = PUCK_H + BADGE * 0.47;
      badge.renderOrder = 3;
      body.add(badge);
      const shadow = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.scale.setScalar(PUCK_R * 2.6);
      shadow.position.y = 0.012;
      shadow.renderOrder = 1;
      g.add(shadow);
      scene.add(g);
      pieces.push({ id, side, rank, g, body, puck, badge, shadow, at: -1, nap: -1, anim: null, lift: 0, sleepy: false, zT: rand(0, 3) });
    }
  }

  function relabel() {
    for (const p of pieces) {
      p.badge.material.map = badgeTexture(p.side, p.rank, p.sleepy);
      p.badge.material.needsUpdate = true;
    }
  }

  const squareY = (i) => (R.water[i] ? WATER_Y - 0.02 : TOP);
  const cellPos = (i, out = new T.Vector3()) => out.set((R.colOf(i) - 3) * P, squareY(i), (R.rowOf(i) - 4) * P);

  // nap slot k of side s: 4 along the pen, 2 deep
  function napPos(s, k, out = new T.Vector3()) {
    const pen = pens[s];
    const lx = (k % 4 - 1.5) * 0.64, lz = (Math.floor(k / 4) - 0.5) * 0.6;
    const dir = s === 0 ? 1 : -1; // the pen's local x and z turn with it: the first row is nearest the board
    return out.set(pen.position.x + lx * dir, 0.1, pen.position.z + lz * dir);
  }
  function placeNap(p) {
    napPos(p.side, p.nap, p.g.position);
    setSleepy(p, true);
  }
  function setSleepy(p, on) {
    if (p.sleepy === on) return;
    p.sleepy = on;
    p.badge.material.map = badgeTexture(p.side, p.rank, on);
    p.badge.material.needsUpdate = true;
    p.g.scale.setScalar(on ? NAP : 1);
    p.badge.material.rotation = on ? 1.2 * (p.side ? -1 : 1) : 0;
  }

  // the nap slots: the order the animals were caught, each side's own pen
  function napSlots(st) {
    const slot = {}, n = [0, 0];
    for (const id of st.naps) {
      const s = id >= 8 ? 1 : 0;
      slot[id] = n[s]++;
    }
    return slot;
  }

  function set(st) {
    const slot = napSlots(st);
    for (const p of pieces) {
      p.anim = null;
      p.at = -1;
      p.nap = slot[p.id] !== undefined ? slot[p.id] : -1;
      p.g.visible = true;
      p.body.position.set(0, 0, 0);
      p.body.scale.set(1, 1, 1);
    }
    for (let i = 0; i < R.N; i++) if (st.b[i]) pieces[st.b[i] - 1].at = i;
    for (const p of pieces) {
      if (p.at >= 0) {
        setSleepy(p, false);
        cellPos(p.at, p.g.position);
      } else if (p.nap >= 0) placeNap(p);
      else p.g.visible = false;
    }
    fx.sel = -1;
  }

  // Glide every piece to where the state says (undo): out of the pen and back onto the board, too.
  function sync(st) {
    const slot = napSlots(st);
    const at = {};
    for (let i = 0; i < R.N; i++) if (st.b[i]) at[st.b[i] - 1] = i;
    for (const p of pieces) {
      const to = new T.Vector3();
      const onBoard = at[p.id] !== undefined;
      if (onBoard) cellPos(at[p.id], to);
      else napPos(p.side, slot[p.id], to);
      const moved = p.g.position.distanceTo(to) > 0.01 || p.at !== (onBoard ? at[p.id] : -1);
      p.at = onBoard ? at[p.id] : -1;
      p.nap = onBoard ? -1 : slot[p.id];
      if (!moved) continue;
      if (onBoard) setSleepy(p, false);
      p.body.position.set(0, 0, 0);
      p.body.scale.set(1, 1, 1);
      p.anim = { kind: 'glide', t: 0, dur: 0.45, from: p.g.position.clone(), to, arc: 0.8, nap: !onBoard };
    }
    fx.sel = -1;
  }

  // Animate a move from rules.play(): the hop (or swim, or the big river jump), then the BONK.
  function move(ev, done) {
    const p = pieces[ev.id];
    const from = cellPos(ev.from), to = cellPos(ev.to);
    const dur = ev.jump ? 0.62 : 0.3, arc = ev.jump ? 1.7 : 0.38;
    p.anim = { kind: 'hop', t: 0, dur, from, to, arc, ev, done };
    p.at = ev.to;
    fx.sel = -1;
    if (ev.capture >= 0) {
      const q = pieces[ev.capture];
      q.at = -1;
    }
  }

  function bonk(ev) {
    const q = pieces[ev.capture];
    const s = q.side;
    const n = pieces.filter((x) => x.side === s && x.at < 0 && x.nap >= 0).length;
    q.nap = n;
    const to = napPos(s, n);
    q.anim = { kind: 'fly', t: -0.12, dur: 0.85, from: q.g.position.clone(), to, arc: 2.6 };
    const p = cellPos(ev.to);
    if (bursts) bursts.add('BONK!', p.x, TOP + 1.3, p.z, 1.9, '#ffd400', '#e8372c');
    if (flyers) {
      flyers.add('💥', p.x, TOP + 0.6, p.z, 0, 0.6, 1.0, 0.45, 0, 0);
      for (let i = 0; i < 6; i++) flyers.add(i % 2 ? '⭐' : '💫', p.x, TOP + 0.7, p.z, rand(-2, 2), rand(1.5, 3), 0.42, 0.8, rand(-4, 4), 5);
    }
  }

  // ---------------------------------------------------------------- the marks: moves, the last move, the hint

  let selRing = null, cursorRing = null, hintGlow = null, hintRing = null, finger = null, dangerMark = null, ripple = null;
  const dots = [], rings = [], icons = [], arcDots = [], lastMarks = [];
  function flat(geo, mat, order = 5) {
    const m = new T.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = order;
    scene.add(m);
    return m;
  }
  function frameTexture(color, ink) {
    const [c, g] = makeCanvas(128, 128);
    g.strokeStyle = color;
    g.lineWidth = 12;
    Kit.gfx.roundRect(g, 10, 10, 108, 108, 22);
    g.stroke();
    g.strokeStyle = ink;
    g.lineWidth = 4;
    Kit.gfx.roundRect(g, 3, 3, 122, 122, 26);
    g.stroke();
    return toTexture(c);
  }
  function sprite(emoji, size, order = 24) {
    const s = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture(emoji), depthTest: false, transparent: true }));
    s.scale.setScalar(size);
    s.visible = false;
    s.renderOrder = order;
    scene.add(s);
    return s;
  }
  function buildMarks() {
    const dotMat = new T.MeshBasicMaterial({ color: '#4dff88', transparent: true, opacity: 0.95, depthWrite: false });
    const dotEdge = new T.MeshBasicMaterial({ color: '#14121f', transparent: true, opacity: 0.55, depthWrite: false });
    for (let i = 0; i < 10; i++) {
      const d = flat(new T.CircleGeometry(0.21, 24), dotMat.clone(), 7);
      const e = flat(new T.CircleGeometry(0.27, 24), dotEdge, 6);
      dots.push({ d, e });
    }
    const ringMat = new T.MeshBasicMaterial({ color: '#ff3d3d', transparent: true, depthWrite: false });
    for (let i = 0; i < 5; i++) rings.push(flat(new T.RingGeometry(0.36, 0.47, 32), ringMat.clone(), 7));
    for (let i = 0; i < 6; i++) icons.push(sprite('💥', 0.42));
    const arcMat = new T.MeshBasicMaterial({ color: '#ffffff' });
    for (let i = 0; i < 4 * 9; i++) {
      const s = new T.Mesh(new T.SphereGeometry(0.055, 8, 6), arcMat);
      s.visible = false;
      s.renderOrder = 8;
      scene.add(s);
      arcDots.push(s);
    }
    selRing = flat(new T.RingGeometry(0.4, 0.5, 32), new T.MeshBasicMaterial({ color: '#ffd400', transparent: true, depthWrite: false }), 7);
    const lastTex = radialTexture(64, [[0, 'rgba(255,240,120,0.55)'], [0.75, 'rgba(255,220,60,0.4)'], [1, 'rgba(255,220,60,0)']]);
    for (let i = 0; i < 2; i++) lastMarks.push(flat(new T.PlaneGeometry(TILE * 1.05, TILE * 1.05), new T.MeshBasicMaterial({ map: lastTex, transparent: true, depthWrite: false }), 4));
    lastMarks.push(sprite('🐾', 0.38, 9));
    cursorRing = flat(new T.PlaneGeometry(TILE * 1.1, TILE * 1.1), new T.MeshBasicMaterial({ map: frameTexture('#ffd400', '#14121f'), transparent: true, depthWrite: false }), 6);
    const glowTex = radialTexture(128, [[0, 'rgba(255,230,90,1)'], [0.45, 'rgba(255,200,40,0.65)'], [1, 'rgba(255,190,0,0)']]);
    hintGlow = flat(new T.PlaneGeometry(TILE * 1.9, TILE * 1.9), new T.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }), 5);
    hintRing = flat(new T.PlaneGeometry(TILE * 1.7, TILE * 1.7), new T.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }), 5);
    finger = sprite('👇', 0.8, 25);
    dangerMark = sprite('❗', 0.6, 25);
    ripple = flat(new T.RingGeometry(0.3, 0.38, 28), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false }), 6);
  }

  let shown = []; // the moves being shown: [{ to, kind... }]
  function moves(from, list) {
    shown = list || [];
    fx.movesFrom = from;
    fx.movesT = 0;
  }
  function select(i) {
    fx.sel = i;
    if (i < 0) moves(-1, []);
  }
  function last(from, to) {
    fx.lastFrom = from;
    fx.lastTo = to;
  }
  function hint(from, to, danger = -1) {
    fx.hintFrom = from;
    fx.hintTo = to;
    fx.danger = danger;
    fx.hintT = 0;
  }
  function cursor(i) { fx.cursor = i; }
  function shake(secs) { fx.shake = Math.max(fx.shake, secs); }

  // ---------------------------------------------------------------- every frame

  const tmp = new T.Vector3(), tmp2 = new T.Vector3();
  const ease = (u) => 1 - Math.pow(1 - u, 3);
  function update(dt) {
    fx.t += dt;
    for (const wt of waters) {
      wt.offset.x = Math.sin(fx.t * 0.4) * 0.05;
      wt.offset.y = (fx.t * 0.06) % 1;
    }
    for (const p of pieces) updatePiece(p, dt);
    updateMarks(dt);
    // the camera shake (a big bonk)
    if (fx.shake > 0) {
      fx.shake = Math.max(0, fx.shake - dt);
      const amp = fx.shake * 0.25;
      cam.position.set(camBase.x + (Math.random() - 0.5) * amp, camBase.y + (Math.random() - 0.5) * amp, camBase.z + (Math.random() - 0.5) * amp);
      cam.updateMatrixWorld(true);
    } else if (!cam.position.equals(camBase) && camBase.lengthSq()) {
      cam.position.copy(camBase);
      cam.updateMatrixWorld(true);
    }
  }

  function updatePiece(p, dt) {
    const a = p.anim;
    if (a) {
      a.t += dt;
      const u = Math.max(0, Math.min(1, a.t / a.dur));
      if (a.kind === 'hop' || a.kind === 'glide' || a.kind === 'fly') {
        const k = a.kind === 'fly' ? u : ease(u);
        p.g.position.lerpVectors(a.from, a.to, k);
        p.g.position.y += Math.sin(u * Math.PI) * a.arc;
        if (a.kind === 'fly') {
          p.body.rotation.z = u * Math.PI * 4 * (p.side ? -1 : 1);
          if (u > 0.5 && !p.sleepy) setSleepy(p, true);
        }
        if (a.kind === 'hop') {
          const sq = Math.sin(u * Math.PI);
          p.body.scale.set(1 - sq * 0.08, 1 + sq * 0.12, 1 - sq * 0.08);
        }
      }
      if (u >= 1 && a.t >= 0) {
        p.anim = null;
        p.body.rotation.z = 0;
        p.body.scale.set(1, 1, 1);
        p.g.position.copy(a.to);
        if (a.kind === 'fly' || (a.kind === 'glide' && a.nap)) setSleepy(p, true);
        if (a.kind === 'hop') {
          // land: squash, a puff, and the BONK if it caught someone
          p.land = 0;
          if (a.ev && a.ev.capture >= 0) bonk(a.ev);
          if (a.ev && a.ev.swim) splash(a.to);
          if (a.done) a.done(a.ev);
        }
      }
    }
    if (p.land !== undefined && p.land >= 0) {
      p.land += dt;
      const k = p.land / 0.25;
      const sq = Math.sin(Math.min(1, k) * Math.PI) * 0.22 * (1 - Math.min(1, k));
      p.body.scale.set(1 + sq, 1 - sq * 1.4, 1 + sq);
      if (k >= 1) {
        p.land = -1;
        p.body.scale.set(1, 1, 1);
      }
    }
    // the picked-up piece floats and wiggles; a swimming rat bobs; sleeping animals breathe and snore
    const lift = p.at >= 0 && p.at === fx.sel && !p.anim ? 0.28 + Math.sin(fx.t * 6) * 0.05 : 0;
    p.lift += (lift - p.lift) * Math.min(1, dt * 14);
    if (!p.anim) {
      let y = p.lift;
      if (p.at >= 0 && R.water[p.at]) y += Math.sin(fx.t * 2.6 + p.id) * 0.03;
      p.body.position.y = y;
      p.body.rotation.z = p.at === fx.sel && p.at >= 0 ? Math.sin(fx.t * 9) * 0.06 : 0;
    }
    p.shadow.material.opacity = 1 / (1 + p.lift * 2 + (p.anim ? Math.max(0, p.g.position.y - TOP) : 0));
    p.shadow.position.y = -p.g.position.y + (p.at >= 0 ? squareY(p.at) : 0.1) + 0.012;
    if (p.sleepy && !p.anim && p.g.visible && flyers) {
      p.zT -= dt;
      p.badge.position.y = PUCK_H + BADGE * 0.47 + Math.sin(fx.t * 1.6 + p.id) * 0.03;
      if (p.zT <= 0) {
        p.zT = rand(2.2, 4.5);
        const q = p.g.position;
        flyers.add('💤', q.x + 0.15, q.y + 0.6, q.z, rand(0.1, 0.3), 0.45, 0.3, 1.6, 0, 0);
      }
    }
  }

  function splash(at) {
    fx.ripple = 0;
    fx.rippleAt = at.clone();
    if (flyers) for (let i = 0; i < 5; i++) flyers.add('💧', at.x, WATER_Y + 0.2, at.z, rand(-1.2, 1.2), rand(1.5, 2.5), 0.3, 0.6, 0, 6);
  }

  function updateMarks(dt) {
    const t = fx.t;
    // the picked-up piece: a gold ring under it
    selRing.visible = fx.sel >= 0;
    if (fx.sel >= 0) {
      cellPos(fx.sel, tmp);
      selRing.position.set(tmp.x, tmp.y + 0.02, tmp.z);
      selRing.scale.setScalar(1 + Math.sin(t * 6) * 0.05);
    }
    // where it can go: dots, red rings round animals it can catch, dotted arcs over the river, and little signs
    let nd = 0, nr = 0, ni = 0, na = 0;
    fx.movesT = (fx.movesT || 0) + dt;
    const pop = Math.min(1, fx.movesT * 6);
    for (const m of shown) {
      cellPos(m.to, tmp);
      if (m.capture >= 0) {
        const r = rings[nr++];
        if (r) {
          r.visible = true;
          r.position.set(tmp.x, tmp.y + 0.025, tmp.z);
          r.scale.setScalar(pop * (1 + Math.sin(t * 7) * 0.06));
        }
      } else {
        const d = dots[nd++];
        if (d) {
          d.d.visible = d.e.visible = true;
          d.d.position.set(tmp.x, tmp.y + 0.03, tmp.z);
          d.e.position.set(tmp.x, tmp.y + 0.025, tmp.z);
          const s = pop * (1 + Math.sin(t * 5 + m.to) * 0.08);
          d.d.scale.setScalar(s);
          d.e.scale.setScalar(s);
          d.d.material.color.set(m.den ? '#ffd400' : m.water ? '#9ff2ff' : '#4dff88');
        }
      }
      const emo = m.den ? '🏆' : m.capture >= 0 ? '💥' : m.trap ? '⚠️' : null;
      if (emo) {
        const ic = icons[ni++];
        if (ic) {
          if (ic.userData.emo !== emo) {
            ic.material.map = emojiTexture(emo);
            ic.material.needsUpdate = true;
            ic.userData.emo = emo;
          }
          ic.visible = true;
          ic.position.set(tmp.x, tmp.y + (m.capture >= 0 ? 2.0 : 0.55) + Math.abs(Math.sin(t * 4)) * 0.12, tmp.z);
          ic.scale.setScalar((m.capture >= 0 ? 0.6 : 0.48) * pop);
        }
      }
      if (m.jump && fx.movesFrom >= 0) {
        cellPos(fx.movesFrom, tmp2);
        for (let k = 1; k <= 8; k++) {
          const u = k / 9;
          const s = arcDots[na++];
          if (!s) break;
          s.visible = true;
          s.position.lerpVectors(tmp2, tmp, u);
          s.position.y = TOP + Math.sin(u * Math.PI) * 1.5 + 0.1;
          s.scale.setScalar(pop * (0.8 + 0.4 * Math.abs(Math.sin(t * 6 - k * 0.6))));
        }
      }
    }
    for (let i = nd; i < dots.length; i++) dots[i].d.visible = dots[i].e.visible = false;
    for (let i = nr; i < rings.length; i++) rings[i].visible = false;
    for (let i = ni; i < icons.length; i++) icons[i].visible = false;
    for (let i = na; i < arcDots.length; i++) arcDots[i].visible = false;
    // the last move
    const hasLast = fx.lastFrom >= 0 && fx.lastFrom !== undefined;
    lastMarks.forEach((m) => (m.visible = hasLast));
    if (hasLast) {
      cellPos(fx.lastFrom, tmp);
      lastMarks[0].position.set(tmp.x, tmp.y + 0.015, tmp.z);
      lastMarks[2].position.set(tmp.x, tmp.y + 0.2, tmp.z);
      cellPos(fx.lastTo, tmp);
      lastMarks[1].position.set(tmp.x, tmp.y + 0.015, tmp.z);
    }
    // the keyboard cursor
    cursorRing.visible = fx.cursor >= 0;
    if (fx.cursor >= 0) {
      cellPos(fx.cursor, tmp);
      cursorRing.position.set(tmp.x, tmp.y + 0.03, tmp.z);
      cursorRing.scale.setScalar(1 + Math.sin(t * 7) * 0.035);
    }
    // your brother's hint: the piece glows, the square glows with a bouncing 👇, and a ❗ over an animal in danger
    const hf = fx.hintFrom, ht = fx.hintTo;
    hintGlow.visible = finger.visible = ht >= 0;
    hintRing.visible = hf >= 0;
    if (ht >= 0 || hf >= 0) fx.hintT += dt;
    const grow = Math.min(1, fx.hintT * 4);
    if (ht >= 0) {
      cellPos(ht, tmp);
      hintGlow.position.set(tmp.x, tmp.y + 0.012, tmp.z);
      hintGlow.scale.setScalar(grow * (1 + Math.sin(t * 6) * 0.12));
      finger.position.set(tmp.x, tmp.y + 1.25 + Math.abs(Math.sin(t * 5)) * 0.3, tmp.z + 0.1);
    }
    if (hf >= 0) {
      cellPos(hf, tmp);
      hintRing.position.set(tmp.x, tmp.y + 0.014, tmp.z);
      hintRing.scale.setScalar(grow * (1 + Math.sin(t * 6 + 1.5) * 0.12));
    }
    dangerMark.visible = fx.danger >= 0;
    if (fx.danger >= 0) {
      cellPos(fx.danger, tmp);
      dangerMark.position.set(tmp.x - 0.3, tmp.y + 1.35 + Math.abs(Math.sin(t * 7)) * 0.15, tmp.z);
    }
    // a splash ring where a rat went into the water
    ripple.visible = fx.ripple !== undefined && fx.ripple < 0.8;
    if (ripple.visible) {
      fx.ripple += dt;
      ripple.position.set(fx.rippleAt.x, WATER_Y + 0.02, fx.rippleAt.z);
      ripple.scale.setScalar(1 + fx.ripple * 2.2);
      ripple.material.opacity = 1 - fx.ripple / 0.8;
    }
  }

  // ---------------------------------------------------------------- camera

  // Aim the camera down at `elev` radians, from the direction `az` (0: from +z, the bottom of the board), so the
  // world points `pts` fill the screen minus margins { l, r, t, b } in pixels. It fits them in a box of that size in
  // the middle of the picture, then slides the picture (the camera's view offset) over the free part of the screen.
  const right = new T.Vector3(), up = new T.Vector3();
  function fit(pts, elev, az, m) {
    cam.clearViewOffset();
    const dir = new T.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev));
    const center = new T.Vector3();
    pts.forEach((p) => center.add(p));
    center.multiplyScalar(1 / pts.length);
    const hw = Math.max(0.1, (W - m.l - m.r) / W), hh = Math.max(0.1, (H - m.t - m.b) / H);
    const box = { x0: -hw, x1: hw, y0: -hh, y1: hh };
    const place = (d) => {
      cam.position.copy(center).addScaledVector(dir, d);
      cam.up.set(0, 1, 0);
      cam.lookAt(center);
      cam.updateMatrixWorld(true);
    };
    const bounds = () => {
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (const p of pts) {
        tmp.copy(p).project(cam);
        x0 = Math.min(x0, tmp.x);
        x1 = Math.max(x1, tmp.x);
        y0 = Math.min(y0, tmp.y);
        y1 = Math.max(y1, tmp.y);
      }
      return { x0, x1, y0, y1 };
    };
    for (let iter = 0; iter < 4; iter++) {
      let lo = 2, hi = 300;
      for (let i = 0; i < 32; i++) {
        const mid = (lo + hi) / 2;
        place(mid);
        const b = bounds();
        if (b.x0 >= box.x0 && b.x1 <= box.x1 && b.y0 >= box.y0 && b.y1 <= box.y1) hi = mid;
        else lo = mid;
      }
      place(hi);
      const b = bounds();
      const dx = (b.x0 + b.x1) / 2 - (box.x0 + box.x1) / 2;
      const dy = (b.y0 + b.y1) / 2 - (box.y0 + box.y1) / 2;
      const d = cam.position.distanceTo(center);
      const halfH = d * Math.tan((cam.fov * Math.PI) / 360), halfW = halfH * cam.aspect;
      right.setFromMatrixColumn(cam.matrixWorld, 0);
      up.setFromMatrixColumn(cam.matrixWorld, 1);
      center.addScaledVector(right, dx * halfW).addScaledVector(up, dy * halfH);
    }
    const bx = (m.l + W - m.r) / 2, by = (m.t + H - m.b) / 2;
    cam.setViewOffset(W, H, W / 2 - bx, H / 2 - by, W, H);
    cam.updateMatrixWorld(true);
    camBase.copy(cam.position);
    return center;
  }

  // The square under screen point (x, y), or -1. A tap on an animal's badge picks the animal's square.
  const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), -TOP), hit = new T.Vector3();
  function pick(x, y) {
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const live = pieces.filter((p) => p.at >= 0 && p.g.visible && !p.anim);
    const hits = ray.intersectObjects(live.map((p) => p.badge), false);
    // only the round part of the badge counts (the sprite is a square)
    for (const h of hits) {
      const p = live.find((q) => q.badge === h.object);
      if (h.uv && Math.hypot(h.uv.x - 0.5, h.uv.y - 0.5) < 0.47) return p.at;
    }
    if (!ray.ray.intersectPlane(plane, hit)) return -1;
    const c = Math.round(hit.x / P + 3), r = Math.round(hit.z / P + 4);
    if (c < 0 || c >= R.COLS || r < 0 || r >= R.ROWS) return -1;
    if (Math.abs(hit.x - (c - 3) * P) > P * 0.55 || Math.abs(hit.z - (r - 4) * P) > P * 0.55) return -1;
    return R.idx(c, r);
  }

  function toScreen(v, out = { x: 0, y: 0 }) {
    tmp.copy(v).project(cam);
    out.x = ((tmp.x + 1) / 2) * W;
    out.y = ((1 - tmp.y) / 2) * H;
    return out;
  }

  function render() {
    if (renderer) renderer.render(scene, cam);
  }

  JC.stage = {
    init, useFx, resize, render, update, fit, pick, toScreen, cellPos, napPos, set, sync, move, select, moves, last, hint, cursor, shake, ends, relabel,
    spotFor, buddySpot, scene, cam, HW, HD, END, TOP, P, COL,
    busy: () => pieces.some((p) => p.anim),
    piece: (id) => pieces[id],
    get W() { return W; },
    get H() { return H; },
    get renderer() { return renderer; },
    get hintTo() { return fx.hintTo; },
    get hintFrom() { return fx.hintFrom; },
    get selected() { return fx.sel; },
    get shown() { return shown; },
    get flip() { return fx.flip; },
  };
})();
