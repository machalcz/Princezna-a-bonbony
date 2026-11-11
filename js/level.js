/* Data levelů. Souřadnice jsou v blocích (x doprava, y dolů). y plošiny = řádek, na kterém princezna stojí.
   Pravidla průchodnosti (princezna skáče 2 bloky, trampolína 4, mezery max 2 bloky):
   - výškový rozdíl max 1–2 bloky mezi plošinami bez pomoci,
   - větší rozdíl řeší žebřík nebo trampolína (plošina nad ní je o 3 bloky výš než trampolína),
   - za lepivou plošinou (skok jen 1 blok) je mezera max 1 blok.
   Později sem přijde generátor, který vrátí stejnou strukturu. */
(function (G) {
  const BS = G.C.BS;

  const MEADOW = {
    name: 'Horní louka',
    w: 44, h: 40, seed: 11,
    start: { x: 1.5 },
    platforms: [
      ['grass', 0, 37, 44],
      ['stone', 5, 36, 3],
      ['wood', 10, 35, 4],
      ['ice', 16, 34, 5],
      ['belt', 23, 33, 4, +1],
      ['sticky', 29, 33, 3],
      ['tramp', 33, 33, 2],
      ['stone', 35, 30, 4],
      ['stone', 33, 24, 6],
      ['wood', 27, 23, 4],
      ['ice', 21, 22, 4],
      ['belt', 15, 21, 4, -1],
      ['stone', 9, 20, 4],
      ['tramp', 5, 20, 2],
      ['stone', 0, 17, 5],
      ['stone', 3, 11, 6]
    ],
    // [sloupec, horní řádek, spodní řádek] – žebřík je vždy uvnitř obou plošin
    ladders: [[38, 24, 30], [3, 11, 17]],
    portal: { x: 7.4, y: 11 },
    enemies: [
      { type: 'walker', x0: 12, x1: 26, y: 37 },
      { type: 'puffer', x: 36.8, y: 30 },
      { type: 'hopper', x: 35.5, y: 24 },
      { type: 'walker', x0: 9.7, x1: 12.3, y: 20 },
      { type: 'hopper', x: 5, y: 11 }
    ]
  };

  const SOLID_TH = { stone: 0.95 };
  const WALL = { stone: 1 };

  /* Fyzická část levelu (plošiny + žebříky). Používá ji hra i generátor, který s ní ověřuje průchodnost skutečnou fyzikou. */
  function makePhysics(def) {
    const L = {
      pxW: def.w * BS, pxH: def.h * BS, platforms: [], ladders: [],
      start: { x: def.start.x * BS, y: 0 }
    };
    for (const d of def.platforms) {
      const [type, x, y, w, dir] = d;
      const p = {
        type, px: x * BS, py: y * BS, pw: w * BS, n: w,
        solid: type === 'grass' || type === 'stone',
        dir: dir || 0, tilt: 0, bounce: 0
      };
      p.th = type === 'grass' ? (def.h - y) * BS : type === 'stone' ? SOLID_TH.stone * BS : 0;
      if (type === 'wood') p.cx = p.px + p.pw / 2;
      L.platforms.push(p);
    }
    for (const [lx, top, bot] of def.ladders) {
      const l = { x: lx * BS, cx: lx * BS + BS / 2, top: top * BS, bot: bot * BS };
      L.ladders.push(l);
      L.platforms.push({ type: 'ladderTop', px: l.x + 8, py: l.top, pw: BS - 16, solid: false, th: 0, hidden: true, dir: 0, tilt: 0 });
    }
    const g = L.platforms.find(p => p.type === 'grass');
    L.start.y = g.py; L.groundY = g.py;
    return L;
  }

  function build(def) {
    def = def || MEADOW;
    const L = makePhysics(def);
    Object.assign(L, {
      name: def.name, w: def.w, h: def.h, theme: def.theme || 'meadow', need: def.need || G.C.CANDY_NEED, label: def.label || '',
      tod: def.tod || 'day', weather: def.weather || 'clear', lt: 0, scorch: [],
      candies: [], enemies: [], decor: [],
      portal: { x: def.portal.x * BS, y: def.portal.y * BS, open: false }
    });

    /* bonbony */
    for (const p of L.platforms) {
      if (p.hidden || p.type === 'tramp') continue;
      if (p.type === 'grass') {
        for (const bx of (def.groundCandies || [11, 20, 28, 37])) L.candies.push({ x: bx * BS, y: p.py - 0.85 * BS, got: false });
      } else {
        const n = p.n >= 5 ? 3 : p.n >= 3 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const fx = n === 1 ? 0.5 : (i + 1) / (n + 1);
          L.candies.push({ x: p.px + p.pw * fx, y: p.py - 0.85 * BS, got: false });
        }
      }
    }
    for (const p of L.platforms) if (p.type === 'tramp') L.candies.push({ x: p.px + p.pw / 2, y: p.py - 3.3 * BS, got: false });
    // v okolí portálu bonbon nikdy neleží (princezna by při sebrání mohla portál minout nebo ho přeskočit)
    L.candies = L.candies.filter(c => !(Math.abs(c.x - L.portal.x) < 1.6 * BS && Math.abs(c.y - L.portal.y) < 2.2 * BS));
    L.candies.forEach((c, i) => { c.kind = (i * 4) % 15; });   // 15 druhů bonbonů, každý má vlastní zvuk
    L.candyTotal = L.candies.length;

    for (const e of def.enemies) L.enemies.push(G.makeEnemy(e));

    const g = L.platforms.find(p => p.type === 'grass');
    L.start.y = g.py; L.groundY = g.py;

    /* zářící bonbony přivolají pomocníka (jednorožec v zahradě, duch v lese). Výběr je deterministický podle seedu. */
    const helper = L.theme === 'garden' ? 'unicorn' : L.theme === 'forest' ? 'ghost' : (L.enemies.length ? 'dragon' : null);
    if (helper && L.candies.length > 8) {
      const mr = G.mulberry32((((def.seed || 1) * 7) + 3) >>> 0), want = def.diff === 'hard' ? 1 : 2;
      let pool = L.candies.filter(c => c.y < L.groundY - 1.4 * BS);
      if (pool.length < want) pool = L.candies.slice();
      const chosen = [];
      for (let k = 0; k < 40 && chosen.length < want; k++) {
        const c = pool[Math.floor(mr() * pool.length)];
        if (chosen.every(o => Math.abs(o.x - c.x) > 6 * BS)) chosen.push(c);
      }
      chosen.forEach(c => { c.magic = helper; });
    }

    /* stafáž (stromy, keře, kameny, tráva) – deterministicky podle seedu */
    const rnd = G.mulberry32(def.seed || 1);
    const pick = arr => arr[Math.floor(rnd() * arr.length)];
    const add = (k, x, base, sMin, sMax, front) =>
      L.decor.push({ k, x, y: base, s: sMin + rnd() * (sMax - sMin), front: !!front, ph: rnd() * 6.28 });
    const nearPortal = x => Math.abs(x - L.portal.x) < 1.8 * BS;

    // země: shluky stromů, keře, kameny (výběr a poměr podle tématu)
    const TH = (G.Themes && G.Themes[L.theme]) || null;
    const DK = TH ? TH.decor : { tree: ['tree_0', 'tree_1', 'tree_2'], bush: ['bush_0', 'bush_1', 'bush_2', 'bush_3'], rock: ['rock_0', 'rock_1', 'rock_2', 'rock_3'], grass: ['grass_0', 'grass_1', 'grass_2', 'fern_0', 'fern_1'], mush: ['mush_0', 'mush_1'] };
    const WT = TH ? TH.w : { tree: 0.2, bush: 0.3, rock: 0.2, grass: 0.2, mush: 0.1 };
    const c1 = WT.tree, c2 = c1 + WT.bush, c3 = c2 + WT.rock, c4 = c3 + WT.grass;
    let x = 2.2 * BS;
    while (x < L.pxW - BS) {
      const r = rnd();
      const under = L.platforms.some(q => q.type !== 'grass' && !q.hidden && x > q.px - 1.2 * BS && x < q.px + q.pw + 1.2 * BS);
      if (r < c1 && x > 3 * BS && !under) add(pick(DK.tree), x, g.py - 6, 0.5, 0.7, false);
      else if (r < c2) add(pick(DK.bush), x, g.py - 5, 0.28, 0.36, false);
      else if (r < c3) add(pick(DK.rock), x, g.py - 4, 0.26, 0.36, false);
      else if (r < c4) add(pick(DK.grass), x, g.py + 8, 0.26, 0.34, true);
      else add(pick(DK.mush), x, g.py + 8, 0.26, 0.32, true);
      x += (1.4 + rnd() * 2.2) * BS;
    }
    // kamenné plošiny: 1–2 kusy
    for (const p of L.platforms) {
      if (p.type !== 'stone' || p.n < 3) continue;
      const cnt = p.n >= 5 ? 2 : 1;
      for (let i = 0; i < cnt; i++) {
        const dx = p.px + BS * 0.8 + rnd() * (p.pw - BS * 1.6);
        if (nearPortal(dx)) continue;
        const r = rnd();
        if (r < 0.4) add(pick(DK.bush), dx, p.py - 4, 0.24, 0.3, false);
        else if (r < 0.7) add(pick(DK.rock.filter(k => k === 'rock_2' || k === 'rock_3').length ? DK.rock.filter(k => k === 'rock_2' || k === 'rock_3') : DK.rock), dx, p.py - 3, 0.24, 0.3, false);
        else if (r < 0.9) add(pick(DK.grass), dx, p.py + 7, 0.24, 0.3, true);
        else add(pick(DK.mush), dx, p.py + 7, 0.24, 0.3, true);
      }
    }
    /* zahrada: lucerny podél cesty (ve dne zhasnuté, v noci a při svítání svítí) */
    if (L.theme === 'garden') {
      const lr = G.mulberry32((((def.seed || 1) * 13) + 5) >>> 0);
      for (let lx = (5 + lr() * 3) * BS; lx < L.pxW - 3 * BS; lx += (9 + lr() * 5) * BS) {
        if (nearPortal(lx)) continue;
        L.decor.push({ k: 'lamp', x: lx, y: g.py - 2, s: 1, front: false, ph: lr() * 6.28 });
      }
    }
    return L;
  }

  G.Level = { build, makePhysics, MEADOW };
})(window.G);
