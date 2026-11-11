/* Generátor levelů.
   1) vyrobí vrstvy (patra) plošin s různými povrchy, žebříky a trampolínami,
   2) průchodnost ověří SIMULACÍ SE SKUTEČNOU FYZIKOU princezny (G.Player) – ne odhadem,
   3) smaže plošiny, na které se nedá dostat, ověří, že k portálu vedou aspoň dvě různé cesty (podle obtížnosti),
   4) rozmístí potvory a bonbony a vrátí definici levelu ve stejném formátu jako ručně psaný level.
   Stejné semínko = stejný level. */
(function (G) {
  const C = G.C, BS = C.BS, HALF = C.PW / 2, DT = 1 / 120;

  const PRESETS = {
    easy: {
      label: 'Snadný', w: [36, 44], climb: [13, 17], jr: [1, 1, 2, 0], gaps: [1, 1, 2], kw: { jump: 0.58, ladder: 0.28, tramp: 0.14 }, spurs: [2, 3], needAlt: false,
      types: { stone: 0.5, ice: 0.18, belt: 0.14, wood: 0.1, sticky: 0.08 },
      enemies: { walker: [1, 2], hopper: [0, 1], puffer: [0, 0] }, need: [7, 9]
    },
    normal: {
      label: 'Střední', w: [44, 54], climb: [17, 22], jr: [1, 2, 2, 1, 0], gaps: [1, 2, 2, 3], kw: { jump: 0.5, ladder: 0.28, tramp: 0.22 }, spurs: [3, 5], needAlt: true,
      types: { stone: 0.34, ice: 0.2, belt: 0.16, wood: 0.15, sticky: 0.15 },
      enemies: { walker: [2, 3], hopper: [1, 2], puffer: [0, 1] }, need: [10, 12]
    },
    hard: {
      label: 'Těžký', w: [52, 64], climb: [21, 28], jr: [2, 2, 1, 2], gaps: [2, 2, 3], kw: { jump: 0.45, ladder: 0.25, tramp: 0.3 }, spurs: [4, 6], needAlt: true,
      types: { stone: 0.24, ice: 0.2, belt: 0.2, wood: 0.15, sticky: 0.21 },
      enemies: { walker: [3, 4], hopper: [2, 3], puffer: [1, 2] }, need: [11, 13]
    }
  };
  const TYPE_W = { stone: [3, 6], ice: [3, 5], belt: [3, 5], wood: [3, 5], sticky: [2, 4] };

  const rint = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pickFrom = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
  function pickWeighted(rnd, wts) {
    let s = 0; for (const k in wts) s += wts[k];
    let r = rnd() * s; for (const k in wts) { r -= wts[k]; if (r <= 0) return k; }
    return Object.keys(wts)[0];
  }
  function shuffle(rnd, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ====================== simulace skutečnou fyzikou ====================== */
  const IDLE = { x: 0, y: 0, jump: false, jumpPressed: false };
  function tickWorld(phys, pl) {                       // houpačky se naklánějí stejně jako ve hře
    for (const p of phys.platforms) if (p.type === 'wood') {
      let target = 0;
      if (pl.ground === p) target = Math.max(-1, Math.min(1, (pl.x - p.cx) / (p.pw / 2))) * 0.30;
      p.tilt += (target - p.tilt) * Math.min(1, DT * 8);
    }
  }

  function trial(phys, A, B, o) {
    for (const p of phys.platforms) { p.tilt = 0; p.bounce = 0; }
    const pl = new G.Player(phys);
    pl.x = o.x0; pl.y = o.fromTramp ? A.py - 6 : A.py; pl.vx = 0; pl.vy = 0;
    if (!o.fromTramp) {
      for (let i = 0; i < 6; i++) { pl.step(DT, IDLE); tickWorld(phys, pl); }
      if (pl.ground !== A) return false;
    }
    const cB = B.px + B.pw / 2, failY = Math.max(A.py, B.py) + 7 * BS;
    let air = !!o.fromTramp, pressed = false;
    for (let i = 0; i < 480; i++) {
      const inp = { x: 0, y: 0, jump: false, jumpPressed: false };
      if (!air) {
        inp.x = o.s;
        const passed = o.s === 0 || (o.s > 0 ? pl.x >= o.xt : pl.x <= o.xt);
        if (passed && o.jump && !pressed) { inp.jump = true; inp.jumpPressed = true; pressed = true; }
        else if (pressed) inp.jump = true;
      } else {
        const dx = cB - pl.x;
        inp.x = Math.abs(dx) < 10 ? 0 : (dx > 0 ? 1 : -1);
        inp.jump = !!o.jump;
      }
      pl.step(DT, inp); tickWorld(phys, pl);
      if (!air && (pressed || !pl.onGround) && !pl.onGround) air = true;
      if (B.type === 'tramp' ? B.bounce > 0 : (pl.ground === B && pl.onGround)) return true;
      if (A.type === 'tramp' && o.fromTramp && i < 3) continue;
      if (pl.y > failY && pl.vy > 0) return false;
    }
    return false;
  }

  /* kolik různých odrazových míst vede z A na B (stačí 2 = není to na pixel přesně) */
  function edgeScore(phys, A, B) {
    const cA = A.px + A.pw / 2, cB = B.px + B.pw / 2, rise = (A.py - B.py) / BS;
    let ok = 0;
    if (A.type === 'tramp') {
      for (const f of [0.3, 0.5, 0.7]) if (trial(phys, A, B, { fromTramp: true, x0: A.px + A.pw * f })) { if (++ok >= 2) return ok; }
      return ok;
    }
    const cl = x => Math.max(A.px + 4, Math.min(A.px + A.pw - 4, x));
    const cands = [];
    if (A.type !== 'grass') {
      const s = cB >= cA ? 1 : -1, xe = s > 0 ? A.px + A.pw + 6 : A.px - 6;
      for (const off of [0, 14, 30, 56]) {
        const xt = xe - s * off;
        cands.push({ s, xt, x0: cl(xt - s * 120), jump: true });
        if (rise <= 0.3) cands.push({ s, xt, x0: cl(xt - s * 120), jump: false });
      }
    }
    if (B.px < A.px + A.pw && B.px + B.pw > A.px) {
      const l = B.px - 18, r = B.px + B.pw + 18;
      if (l > A.px) { cands.push({ s: 1, xt: l, x0: cl(l - 120), jump: true }); cands.push({ s: 1, xt: l - 30, x0: cl(l - 150), jump: true }); }
      if (r < A.px + A.pw) { cands.push({ s: -1, xt: r, x0: cl(r + 120), jump: true }); cands.push({ s: -1, xt: r + 30, x0: cl(r + 150), jump: true }); }
      cands.push({ s: 0, xt: cl(cB), x0: cl(cB), jump: true });
    }
    for (const c of cands) if (trial(phys, A, B, c)) { if (++ok >= 2) return ok; }
    return ok;
  }

  function maxRiseOf(A) { return A.type === 'tramp' ? 4.3 : A.type === 'sticky' ? 1.15 : 2.2; }
  function candidatePair(A, B) {
    if (A === B || A.hidden || B.hidden) return false;
    const gap = Math.max(B.px - (A.px + A.pw), A.px - (B.px + B.pw), 0) / BS, rise = (A.py - B.py) / BS;
    if (rise > maxRiseOf(A) + 0.01) return false;
    if (gap > (A.type === 'tramp' ? 5.2 : 4.4)) return false;
    return true;
  }

  /* ====================== analýza dosažitelnosti ====================== */
  function analyze(def, hints) {
    const phys = G.Level.makePhysics(def), P = phys.platforms;
    const vis = []; P.forEach((p, i) => { if (!p.hidden) vis.push(i); });
    const nbr = new Map(), cache = new Map();
    const add = (a, b) => { (nbr.get(a) || nbr.set(a, new Set()).get(a)).add(b); };
    for (const l of phys.ladders) {                    // žebříky: obousměrně
      let lo = -1, up = -1;
      vis.forEach(i => { const p = P[i]; if (l.cx > p.px && l.cx < p.px + p.pw) { if (p.py === l.bot) lo = i; if (p.py === l.top) up = i; } });
      if (lo >= 0 && up >= 0) { add(lo, up); add(up, lo); }
    }
    function edge(i, j) {
      const key = i * 1000 + j;
      if (cache.has(key)) return cache.get(key);
      let r = false;
      if (candidatePair(P[i], P[j])) r = edgeScore(phys, P[i], P[j]) >= 2;
      cache.set(key, r); return r;
    }
    function neighbors(i) {
      const out = new Set(nbr.get(i) || []);
      for (const j of vis) if (j !== i && !out.has(j) && candidatePair(P[i], P[j]) && edge(i, j)) out.add(j);
      return out;
    }
    const pIdx = vis.find(i => P[i].py === def.portal.y * BS && def.portal.x * BS > P[i].px && def.portal.x * BS < P[i].px + P[i].pw);
    function bfs(banned) {
      const prev = new Map([[0, -1]]), q = [0];
      while (q.length) {
        const i = q.shift();
        for (const j of neighbors(i)) if (!prev.has(j) && !(banned && banned.has(j))) { prev.set(j, i); q.push(j); }
      }
      return prev;
    }
    const prev = bfs(null);
    const res = { phys, reach: new Set(prev.keys()), portal: pIdx, ok: pIdx != null && prev.has(pIdx), alt: false, pathLen: 0, vis };
    if (res.ok) {
      const path = []; for (let i = pIdx; i !== -1; i = prev.get(i)) path.push(i);
      res.pathLen = path.length;
      const banned = new Set(path.filter(i => i !== 0 && i !== pIdx));
      res.alt = bfs(banned).has(pIdx);
      if (!res.alt && hints) for (const h of hints) { const bn = new Set(h.filter(i => i !== 0 && i !== pIdx)); if (bfs(bn).has(pIdx)) { res.alt = true; break; } }
    }
    return res;
  }

  /* ====================== stavba rozvržení ====================== */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ovl = (a0, a1, b0, b1) => a0 < b1 && a1 > b0;

  function fits(plats, p, ladders) {
    for (const q of plats) {
      if (q.type === 'grass') {
        if (p.type === 'tramp' && p.y === q.y) continue;
        if (q.y - p.y < (p.type === 'stone' ? 2 : 1)) return false;
        continue;
      }
      const xo = ovl(p.x, p.x + p.w, q.x - 0.3, q.x + q.w + 0.3), dy = Math.abs(p.y - q.y);
      if (xo && dy < 2) return false;
      if (!xo && dy === 0 && Math.max(p.x - (q.x + q.w), q.x - (p.x + p.w)) < 0.9) return false;
      // nad trampolínou musí být volno
      if (q.type === 'tramp' && p.y < q.y && q.y - p.y < 4.8 && ovl(p.x, p.x + p.w, q.x - 0.4, q.x + q.w + 0.4)) return false;
      if (p.type === 'tramp' && q.y < p.y && p.y - q.y < 4.8 && ovl(q.x, q.x + q.w, p.x - 0.4, p.x + p.w + 0.4)) return false;
      // sloup houpačky vede od nosníku k zemi
      if (q.type === 'wood' && p.y > q.y && ovl(p.x, p.x + p.w, q.x + q.w / 2 - 0.9, q.x + q.w / 2 + 0.9)) return false;
      if (p.type === 'wood' && q.y > p.y && ovl(q.x, q.x + q.w, p.x + p.w / 2 - 0.9, p.x + p.w / 2 + 0.9)) return false;
    }
    if (ladders) for (const l of ladders) {                               // platforma nesmí protínat žebřík
      if (p.y > l[1] && p.y < l[2] && ovl(p.x, p.x + p.w, l[0] - 0.2, l[0] + 1.2)) return false;
      if (p.type === 'wood' && p.y < l[2] && ovl(l[0], l[0] + 1, p.x + p.w / 2 - 0.9, p.x + p.w / 2 + 0.9)) return false;
    }
    return true;
  }

  function ladderClear(plats, ladders, c, top, bot, A, B) {
    for (const q of plats) {
      if (q === A || q === B || q.type === 'grass') continue;
      if (q.x < c + 1.2 && q.x + q.w > c - 0.2 && q.y > top && q.y < bot) return false;
      if (q.type === 'wood' && q.y < bot && ovl(c, c + 1, q.x + q.w / 2 - 0.9, q.x + q.w / 2 + 0.9)) return false;
    }
    for (const l of ladders) if (Math.abs(l[0] - c) < 1.6 && !(l[2] <= top || l[1] >= bot)) return false;
    return true;
  }
  function ladderCol(rnd, plats, ladders, A, B) {                          // sloupec uvnitř obou platforem (A dole, B nahoře)
    const lo = Math.max(A.x, B.x), hi = Math.min(A.x + A.w, B.x + B.w);
    if (hi - lo < 1.6) return null;
    const cols = []; for (let c = Math.ceil(lo + 0.3); c + 1 <= hi - 0.3; c++) cols.push(c);
    const mid = (lo + hi) / 2 - 0.5;
    cols.sort((x, y) => Math.abs(x - mid) - Math.abs(y - mid) + (rnd() - 0.5));
    for (const c of cols) if (ladderClear(plats, ladders, c, B.y, A.y, A, B)) return c;
    return null;
  }

  /* ověření jedné vazby SKUTEČNOU fyzikou v miniaturním levelu (výsledky se ukládají podle relativní geometrie) */
  function linkOK(ctx, A, B) {
    const gr = A.type === 'grass';
    const key = (gr ? 'G' : A.type + A.w + ':' + A.dir) + '>' + B.type + B.w + ':' + B.dir + '|' + (A.y - B.y) + '|' + (gr ? '' : (B.x - A.x));
    if (ctx.cache.has(key)) return ctx.cache.get(key);
    const GY = 48, bx = 24;
    let plats, r;
    if (gr) {
      plats = [['grass', 0, GY, 80], [B.type, 34, GY - (A.y - B.y), B.w, B.dir]];
      const ph = G.Level.makePhysics({ w: 80, h: GY + 3, start: { x: 1.5 }, ladders: [], platforms: plats });
      r = edgeScore(ph, ph.platforms[0], ph.platforms[1]) >= 2;
    } else {
      const ay = GY - 8;
      plats = [['grass', 0, GY, 80], [A.type, bx, ay, A.w, A.dir], [B.type, bx + (B.x - A.x), ay - (A.y - B.y), B.w, B.dir]];
      const ph = G.Level.makePhysics({ w: 80, h: GY + 3, start: { x: 1.5 }, ladders: [], platforms: plats });
      r = edgeScore(ph, ph.platforms[1], ph.platforms[2]) >= 2;
    }
    ctx.cache.set(key, r); return r;
  }

  function mkType(rnd, pr, maxW) {
    const type = pickWeighted(rnd, pr.types), [a, b] = TYPE_W[type];
    return { type, w: Math.min(rint(rnd, a, b), maxW || 99) };
  }

  /* jedna cesta: začíná na portálové plošině a po vazbách (skok / žebřík / trampolína) klesá až k zemi */
  function buildChain(rnd, pr, plats, ladders, P, G0, w, ctx, biasX) {
    const chain = [P]; let U = P, guard = 0;
    const dirTo = () => { const cx = U.x + U.w / 2; return rnd() < 0.7 ? (biasX >= cx ? 1 : -1) : (rnd() < 0.5 ? 1 : -1); };
    const place = p => { plats.push(p); chain.push(p); };

    function endJump() { return linkOK(ctx, plats[0], U); }
    function endLadder(rem) {
      if (U.w < 2) return false;
      const c = ladderCol(rnd, plats, ladders, plats[0], U); if (c == null) return false;
      ladders.push([c, U.y, G0]); return true;
    }
    function endTramp(rem) {
      for (let k = 0; k < 8; k++) {
        const g = pickFrom(rnd, [0.7, 1.0, 1.4, 1.8]), s = dirTo();
        const T = { type: 'tramp', x: s > 0 ? U.x + U.w + g : U.x - g - 2, y: G0, w: 2, dir: 0 };
        if (T.x < 1 || T.x + 2 > w - 1 || !fits(plats, T, ladders)) continue;
        if (linkOK(ctx, T, U)) { place(T); return true; }
      }
      return false;
    }
    function stepJump(rem) {
      for (let k = 0; k < 12; k++) {
        let r = pickFrom(rnd, pr.jr); if (r > rem - 2) r = Math.max(0, rem - 2);
        const t = mkType(rnd, pr), g = pickFrom(rnd, pr.gaps);
        if (r > maxRiseOf({ type: t.type })) continue;
        let s = dirTo();
        for (let f = 0; f < 2; f++, s = -s) {
          const L = { type: t.type, w: t.w, y: U.y + r, dir: t.type === 'belt' ? (rnd() < 0.5 ? 1 : -1) : 0 };
          L.x = s > 0 ? U.x + U.w + g : U.x - g - L.w;
          if (L.x < 1 || L.x + L.w > w - 1 || !fits(plats, L, ladders)) continue;
          if (!linkOK(ctx, L, U)) continue;
          place(L); U = L; return true;
        }
      }
      return false;
    }
    function stepLadder(rem) {
      for (let k = 0; k < 12; k++) {
        const r = rint(rnd, 3, Math.min(5, rem - 2)); if (r < 3) return false;
        const t = mkType(rnd, pr), L = { type: t.type, w: Math.max(t.w, 3), y: U.y + r, dir: t.type === 'belt' ? (rnd() < 0.5 ? 1 : -1) : 0 };
        L.x = Math.round(U.x - L.w + 2 + rnd() * (U.w + L.w - 4));
        if (L.x < 1 || L.x + L.w > w - 1 || !fits(plats, L, ladders)) continue;
        const c = ladderCol(rnd, plats.concat([L]), ladders, L, U); if (c == null) continue;
        ladders.push([c, U.y, L.y]); place(L); U = L; return true;
      }
      return false;
    }
    function stepTramp(rem) {
      for (let k = 0; k < 14; k++) {
        const r = rint(rnd, 3, 4); if (r > rem - 2) return false;
        const g1 = pickFrom(rnd, [0.7, 1.0, 1.4, 1.8]), sT = dirTo();
        const T = { type: 'tramp', x: sT > 0 ? U.x + U.w + g1 : U.x - g1 - 2, y: U.y + r, w: 2, dir: 0 };
        if (T.x < 1 || T.x + 2 > w - 1 || !fits(plats, T, ladders) || !linkOK(ctx, T, U)) continue;
        const t = mkType(rnd, pr), g2 = pickFrom(rnd, [1, 1, 2]);
        const L = { type: t.type, w: t.w, y: T.y, dir: t.type === 'belt' ? (rnd() < 0.5 ? 1 : -1) : 0 };
        L.x = sT > 0 ? T.x + 2 + g2 : T.x - g2 - L.w;
        if (L.x < 1 || L.x + L.w > w - 1) continue;
        plats.push(T); if (!fits(plats, L, ladders)) { plats.pop(); continue; }
        plats.pop();
        if (!linkOK(ctx, L, T)) continue;
        place(T); place(L); U = L; return true;
      }
      return false;
    }

    while (guard++ < 40) {
      const rem = G0 - U.y;
      const acts = [];
      if (rem <= 2) acts.push(['endJump', 0.7]);
      if (rem >= 3 && rem <= 5) { acts.push(['endLadder', 0.3]); if (rem <= 4) acts.push(['endTramp', 0.25]); }
      if (rem >= 3) { acts.push(['stepJump', pr.kw.jump]); if (rem >= 5) acts.push(['stepLadder', pr.kw.ladder]); if (rem >= 5) acts.push(['stepTramp', pr.kw.tramp]); }
      else if (rem >= 2) acts.push(['stepJump', 0.3]);
      else acts.push(['stepJump', 0.01]);
      let pool = acts.slice(), done = false, moved = false;
      while (pool.length) {
        let tot = 0; for (const a of pool) tot += a[1];
        let r = rnd() * tot, i = 0; for (; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) break; }
        const [name] = pool.splice(Math.min(i, pool.length - 1), 1)[0];
        const fn = { endJump: endJump, endLadder: endLadder, endTramp: endTramp, stepJump: stepJump, stepLadder: stepLadder, stepTramp: stepTramp }[name];
        if (fn(rem)) { moved = true; done = name.startsWith('end'); break; }
      }
      if (!moved) return null;
      if (done) return chain;
    }
    return null;
  }

  /* slepé odbočky s bonbony: vazba vždy z existující plošiny */
  function addSpurs(rnd, pr, plats, ladders, w, ctx, G0, n) {
    let made = 0;
    for (let k = 0; k < n * 14 && made < n; k++) {
      const cand = plats.filter(p => p.type !== 'tramp' && p.type !== 'grass' && p.y > 8);
      if (!cand.length) break;
      const A = pickFrom(rnd, cand), t = mkType(rnd, pr), r = pickFrom(rnd, [0, 1, 1, 2, -1]), g = pickFrom(rnd, pr.gaps);
      if (r > maxRiseOf(A)) continue;
      const s = rnd() < 0.5 ? 1 : -1, B = { type: t.type, w: t.w, y: A.y - r, dir: t.type === 'belt' ? (rnd() < 0.5 ? 1 : -1) : 0 };
      B.x = s > 0 ? A.x + A.w + g : A.x - g - B.w;
      if (B.x < 1 || B.x + B.w > w - 1 || B.y > G0 - 2 || B.y < 8 || !fits(plats, B, ladders)) continue;
      if (!linkOK(ctx, A, B)) continue;
      plats.push(B); made++;
    }
  }

  function layout(rnd, pr) {
    const w = rint(rnd, pr.w[0], pr.w[1]), climb = rint(rnd, pr.climb[0], pr.climb[1]);
    const TOP = 7, G0 = TOP + climb, h = G0 + 3;
    const plats = [{ type: 'grass', x: 0, y: G0, w, dir: 0 }], ladders = [];
    const ctx = { cache: new Map() };
    const pw = rint(rnd, 4, 6), px = clamp(Math.round(w * 0.25 + rnd() * (w * 0.6 - pw)), 3, w - 3 - pw);
    const P = { type: 'stone', x: px, y: TOP, w: pw, dir: 0 };
    plats.push(P);
    const chains = [], nCh = pr.needAlt ? 2 : 1, flip = rnd() < 0.5;
    for (let c = 0; c < nCh; c++) {
      let ch = null;
      for (let tries = 0; tries < 10 && !ch; tries++) {
        const np = plats.length, nl = ladders.length;
        const bias = ((c === 0) !== flip ? 0.2 : 0.8) * w + (rnd() - 0.5) * w * 0.15;
        ch = buildChain(rnd, pr, plats, ladders, P, G0, w, ctx, bias);
        if (!ch) { plats.length = np; ladders.length = nl; }
      }
      if (!ch) return null;
      chains.push(ch);
    }
    addSpurs(rnd, pr, plats, ladders, w, ctx, G0, rint(rnd, pr.spurs[0], pr.spurs[1]));
    const def = { w, h, start: { x: 1.5 }, ladders, platforms: plats.map(p => [p.type, p.x, p.y, p.w, p.dir]), enemies: [] };
    def.portal = { x: P.x + P.w / 2 + (rnd() - 0.5) * Math.max(0, P.w - 3), y: P.y };
    def.hints = chains.map(ch => ch.map(p => plats.indexOf(p)));
    return def;
  }

  /* ====================== potvory ====================== */
  function placeEnemies(def, rnd, pr) {
    const P = def.platforms.map(p => ({ type: p[0], x: p[1], y: p[2], w: p[3] }));
    const gnd = P[0], portal = def.portal, ladders = def.ladders;
    const zones = (pl, rLad, rPor) => {
      const z = [];
      for (const l of ladders) if (l[1] === pl.y || l[2] === pl.y) z.push([l[0] - rLad, l[0] + 1 + rLad]);
      if (pl.y === portal.y) z.push([portal.x - rPor, portal.x + rPor]);
      if (pl.type === 'grass') { z.push([0, 8]); for (const q of P) if (q.type === 'tramp' && q.y === pl.y) z.push([q.x - 1.5, q.x + q.w + 1.5]); }
      return z;
    };
    const freeSegs = (a, b, z) => {
      let segs = [[a, b]];
      for (const [za, zb] of z) { const nx = []; for (const [s0, s1] of segs) { if (zb <= s0 || za >= s1) nx.push([s0, s1]); else { if (za > s0) nx.push([s0, za]); if (zb < s1) nx.push([zb, s1]); } } segs = nx; }
      return segs.sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
    };
    const cnt = k => rint(rnd, pr.enemies[k][0], pr.enemies[k][1]);
    const used = new Map(), enemies = [];
    const take = pl => used.set(pl, (used.get(pl) || 0) + 1);
    const okPl = (pl, kinds, minW) => pl.w >= minW && kinds.includes(pl.type) && (used.get(pl) || 0) < (pl.type === 'grass' ? 3 : 2);

    for (let i = cnt('walker'); i > 0; i--) {
      const cand = shuffle(rnd, P.filter(pl => okPl(pl, ['grass', 'stone', 'ice'], pl.type === 'grass' ? 0 : 4)));
      for (const pl of cand) {
        const a = pl.type === 'grass' ? 8 : pl.x + 0.9, b = pl.type === 'grass' ? pl.w - 3 : pl.x + pl.w - 0.9;
        const seg = freeSegs(a, b, zones(pl, 1.6, 3.2))[0]; if (!seg || seg[1] - seg[0] < 2) continue;
        const len = Math.min(seg[1] - seg[0], pl.type === 'grass' ? 12 : 6), off = rnd() * (seg[1] - seg[0] - len);
        enemies.push({ type: 'walker', x0: +(seg[0] + off).toFixed(2), x1: +(seg[0] + off + len).toFixed(2), y: pl.y }); take(pl); break;
      }
    }
    for (let i = cnt('hopper'); i > 0; i--) {
      const cand = shuffle(rnd, P.filter(pl => okPl(pl, ['grass', 'stone', 'ice'], pl.type === 'grass' ? 0 : 3)));
      for (const pl of cand) {
        const a = pl.type === 'grass' ? 9 : pl.x + 1.2, b = pl.type === 'grass' ? pl.w - 3 : pl.x + pl.w - 1.2;
        const seg = freeSegs(a, b, zones(pl, 1.8, 3.5))[0]; if (!seg || seg[1] - seg[0] < 0.4) continue;
        enemies.push({ type: 'hopper', x: +(seg[0] + rnd() * (seg[1] - seg[0])).toFixed(2), y: pl.y }); take(pl); break;
      }
    }
    for (let i = cnt('puffer'); i > 0; i--) {
      const cand = shuffle(rnd, P.filter(pl => okPl(pl, ['stone', 'ice'], 5)));
      for (const pl of cand) {
        const seg = freeSegs(pl.x + 2, pl.x + pl.w - 2, zones(pl, 2.6, 4.5))[0]; if (!seg || seg[1] - seg[0] < 0.3) continue;
        enemies.push({ type: 'puffer', x: +(seg[0] + rnd() * (seg[1] - seg[0])).toFixed(2), y: pl.y }); take(pl); break;
      }
    }
    return enemies;
  }

  function groundCandies(def, rnd) {
    const P = def.platforms, out = [], trs = P.filter(p => p[0] === 'tramp' && p[2] === P[0][2]);
    for (let x = 6 + rnd() * 2; x < def.w - 3; x += 6 + rnd() * 3) {
      if (trs.some(t => x > t[1] - 1.5 && x < t[1] + t[3] + 1.5)) continue;
      out.push(+x.toFixed(1));
    }
    return out;
  }

  /* ====================== hlavní vstup ====================== */
  function pruneUnreachable(def, an) {
    const keep = new Map(); let n = 0;
    def.platforms.forEach((p, i) => { if (an.reach.has(i)) keep.set(i, n++); });
    const platforms = def.platforms.filter((p, i) => keep.has(i));
    const P = an.phys.platforms;
    const ladders = def.ladders.filter(l => {
      const cx = l[0] * BS + BS / 2;
      const has = row => def.platforms.some((p, i) => keep.has(i) && p[2] === row && cx > p[1] * BS && cx < (p[1] + p[3]) * BS);
      return has(l[2]) && has(l[1]);
    });
    return { platforms, ladders, removed: def.platforms.length - platforms.length };
  }

  const themeOf = seed => pickFrom(G.mulberry32(seed >>> 0), Object.keys(G.Themes));
  function generate(opts) {
    const au = G.Audio; G.Audio = null;                 // simulace nesmí vydávat zvuky
    try { return generate0(opts || {}); } finally { G.Audio = au; }
  }
  function generate0(opts) {
    let seed;
    if (opts.seed != null) seed = opts.seed >>> 0;
    else for (let k = 0; k < 14; k++) { seed = (Math.random() * 4294967295) >>> 0; if (!opts.avoid || themeOf(seed) !== opts.avoid) break; }
    const rnd = G.mulberry32(seed);
    const theme = opts.theme || pickFrom(rnd, Object.keys(G.Themes));
    const tod = opts.tod || pickWeighted(rnd, { day: 0.5, night: 0.3, dawn: 0.2 });
    let weather = opts.weather;
    { const r = rnd();
      if (!weather) weather = theme === 'meadow' ? (tod === 'dawn' ? 'clear' : r < 0.3 ? 'storm' : 'clear')
        : theme === 'garden' ? (tod === 'dawn' ? (r < 0.85 ? 'rain' : 'clear') : tod === 'night' ? 'clear' : (r < 0.7 ? 'petals' : 'clear'))
        : 'fog'; }
    const dk = opts.diff || pickWeighted(rnd, { easy: 0.3, normal: 0.45, hard: 0.25 });
    const pr = PRESETS[dk];
    const stats = { attempts: 0, why: {} };
    const bad = w => { stats.why[w] = (stats.why[w] || 0) + 1; };
    for (let attempt = 1; attempt <= 30; attempt++) {
      stats.attempts = attempt;
      const def = layout(rnd, pr); if (!def) { bad('layout'); continue; }
      const an = analyze(def, def.hints);
      if (!an.ok) { bad('portal'); continue; }
      if (pr.needAlt && !an.alt) { bad('alt'); continue; }
      const pruned = pruneUnreachable(def, an);
      if (pruned.platforms.length < 7) { bad('small'); continue; }
      def.platforms = pruned.platforms; def.ladders = pruned.ladders; delete def.hints;
      def.enemies = placeEnemies(def, rnd, pr);
      def.groundCandies = groundCandies(def, rnd);
      def.theme = theme; def.tod = tod; def.weather = weather; def.seed = (seed ^ (attempt * 2654435761)) >>> 0; def.genSeed = seed;
      def.name = G.Themes[theme].name; def.label = pr.label; def.diff = dk; def.alt = an.alt; def.stats = stats; def.removed = pruned.removed;
      const L = G.Level.build(def);
      def.need = Math.max(6, Math.min(rint(rnd, pr.need[0], pr.need[1]), Math.floor(L.candyTotal * 0.45)));
      return def;
    }
    // záloha: ručně navržený level
    const m = Object.assign({}, G.Level.MEADOW, { theme: theme, tod: tod, weather: weather, label: 'Klasický', diff: 'classic', genSeed: seed, stats, name: G.Themes[theme].name });
    return m;
  }

  G.Gen = { themeOf, generate, analyze, PRESETS, edgeScore };
})(window.G);
