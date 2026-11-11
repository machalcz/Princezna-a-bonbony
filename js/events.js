/* Události ve hře: drak, který sežehne nepřítele, pomocníci z magických bonbonů (jednorožec veze, duch schová)
   a efekty (třpytky, odjezd jednorožce, ohořelé fleky). Logika je tady, kreslí render.js. */
(function (G) {
  const C = G.C, W = C.VW, H = C.VH;
  const E = G.Events = {};

  /* ---------- drak (jen Horní louka): cyklus 70 s, přelet 17 s; poloha je v souřadnicích OBRAZOVKY, kamera ji neovlivní ---------- */
  const D0 = 22, DP = 70, DF = 17;
  const SF = 13;                                               // přivolaný drak: délka přeletu (s)
  function dragonAt(L, lt) {
    if (!L || L.theme !== 'meadow') return null;
    const sm0 = L.ev && L.ev.sum;
    if (sm0) {
      const l = lt - sm0.t0;
      if (l >= 0 && l < SF) {
        const dir = sm0.dir, run = (W + 400) * l / SF, h = 96, x = dir > 0 ? -200 + run : W + 200 - run, y = sm0.y + Math.sin(l * 0.9) * 18;
        return { c: sm0.c, l, dir, x, y, h, mx: x + dir * h * 0.50, my: y + h * 0.07, armed: true, fs: 1.8, near: 3.0, fb: 8.5, air0: 5.0 };
      }
    }
    const d = lt - D0; if (d < 0) return null;
    const c = Math.floor(d / DP), l = d - c * DP; if (l >= DF) return null;
    const rnd = G.mulberry32(c * 131 + 9), dir = c % 2 === 0 ? 1 : -1, run = (W + 400) * l / DF, h = 96;
    const x = dir > 0 ? -200 + run : W + 200 - run, y = 168 + rnd() * 60 + Math.sin(l * 0.9) * 20;
    return { c, l, dir, x, y, h, mx: x + dir * h * 0.50, my: y + h * 0.07, armed: false };
  }
  E.dragon = dragonAt;

  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const envK = ft => Math.min(1, ft / 0.22) * (1 - sm(1.25, 1.7, ft));

  /* drak spálí VŠECHNY potvory v levelu: nejdřív ty nejblíž kameře, vzdálenější s malým zpožděním (plameny se „šíří“) */
  function igniteAll(L, cam) {
    const list = L.enemies.filter(e => !e.burn);
    if (!list.length) return;
    const cx = cam.x + W / 2;
    for (const e of list) e.burn = { t: -Math.min(1.3, Math.abs(e.x - cx) / 1800) };
    L.toast = { t: 0, text: list.length > 1 ? 'Drak spálil všechny potvory!' : 'Drak spálil potvoru!' };
    if (G.Audio) G.Audio.fire();
  }

  E.burst = function (L, x, y, col) { L.fx.push({ k: 'burst', x, y, t: 0, col, seed: Math.random() * 100 }); };

  E.update = function (L, lt, cam, dt, pl) {
    if (!L.fx) L.fx = [];
    const st = L.ev || (L.ev = { c: -1, tgt: null, air: false, fireT: -2, struck: false });

    // hořící nepřátelé: blikají a po chvíli zmizí, zůstane ohořelý flek
    for (let i = L.enemies.length - 1; i >= 0; i--) {
      const e = L.enemies[i];
      if (!e.burn) continue;
      e.burn.t += dt;
      if (e.burn.t > 1.15) {
        L.scorch.push({ x: e.x, y: e.y, t: 0, r: e.type === 'puffer' ? 48 : e.type === 'hopper' ? 34 : 38, seed: Math.random() * 99 });
        L.enemies.splice(i, 1);
        if (G.Audio) G.Audio.poof();
      }
    }
    for (const s of L.scorch) s.t += dt;
    if (L.toast) { L.toast.t += dt; if (L.toast.t > 3.6) L.toast = null; }

    // pomocníci
    if (pl.mount > 0) {
      pl.mount -= dt;
      if (pl.mount <= 0) { pl.mount = 0; pl.invuln = Math.max(pl.invuln, 1.0); L.fx.push({ k: 'uniaway', x: pl.x, y: pl.y, dir: pl.facing || 1, t: 0 }); if (G.Audio) G.Audio.neigh(); }
    }
    if (pl.cloak > 0) {
      pl.cloak -= dt;
      if (pl.cloak <= 0) { pl.cloak = 0; pl.invuln = Math.max(pl.invuln, 0.8); E.burst(L, pl.x, pl.y - 40, 'ghost'); if (G.Audio) G.Audio.poof(); }
    }
    for (let i = L.fx.length - 1; i >= 0; i--) { const f = L.fx[i]; f.t += dt; if (f.t > (f.k === 'uniaway' ? 1.7 : 1.1)) L.fx.splice(i, 1); }

    // drak
    const ds = dragonAt(L, lt);
    if (!ds || !ds.armed) { st.tgt = null; if (st.fireT > -2) st.fireT = -2; return; }          // obyčejný přelet: drak jen proletí, oheň nechrlí
    const sx = e => e.x - cam.x, onScreen = e => { const x = sx(e), y = e.y - cam.y; return x > 70 && x < W - 70 && y > 140 && y < H - 40; };
    if (st.c !== ds.c && ds.l >= ds.fs) {
      st.c = ds.c; st.fireT = -1; st.struck = false; st.air = false; st.airT0 = 0; st.airSnd = false;
      const aim = ds.dir > 0 ? W * 0.60 : W * 0.40;
      const cand = L.enemies.filter(e => !e.burn && onScreen(e)).sort((a, b) => Math.abs(sx(a) - aim) - Math.abs(sx(b) - aim));
      st.tgt = cand[0] || null; if (!st.tgt) { st.air = true; st.airT0 = ds.air0; }
    }
    if (st.c !== ds.c) return;
    const e = st.tgt, toAir = () => { st.tgt = null; st.air = true; st.airT0 = Math.max(ds.l, ds.air0); st.airSnd = false; };
    if (e && !st.air && st.fireT !== -2) {
      if (!L.enemies.includes(e) && !st.struck) toAir();                       // cíl mezitím zmizel: oheň do vzduchu a spálí se zbytek
      else if (st.fireT === -1) {
        if ((Math.abs(sx(e) - ds.mx) < 150 && ds.l > ds.near) || ds.l > ds.fb) {
          if (onScreen(e)) { st.fireT = 0; if (G.Audio) { G.Audio.roar(); G.Audio.fire(); } } else toAir();
        }
      } else if (st.fireT >= 0) {
        st.fireT += dt;
        if (!onScreen(e) && !st.struck) toAir();
        else if (st.fireT >= 1.0 && !st.struck) { igniteAll(L, cam); st.struck = true; }
        if (st.fireT > 1.75) st.fireT = -2;
      }
    }
    if (st.air) {                                                              // žádná potvora na obrazovce: oheň do vzduchu, plameny se přesto rozlétnou po celém levelu
      const a = ds.l - st.airT0;
      if (a >= 0 && !st.airSnd) { st.airSnd = true; if (G.Audio) { G.Audio.roar(); G.Audio.fire(); } }
      if (a >= 1.0 && !st.struck) { igniteAll(L, cam); st.struck = true; }
    }
  };

  /* tryskající oheň: vrací polohu tlamy, cíle a intenzitu 0–1 */
  E.fire = function (L, lt, cam) {
    const ds = dragonAt(L, lt), st = L.ev; if (!ds || !ds.armed || !st || st.c !== ds.c) return null;
    if (st.tgt && st.fireT >= 0) {
      const e = st.tgt;
      return { mx: ds.mx, my: ds.my, tx: e.x - cam.x, ty: e.y - cam.y - 26, k: envK(st.fireT), dir: ds.dir };
    }
    if (st.air && ds.l - st.airT0 >= 0 && ds.l - st.airT0 < 1.8) {
      const k = envK(ds.l - st.airT0);
      return { mx: ds.mx, my: ds.my, tx: ds.mx + ds.dir * 210, ty: ds.my + 80, k, dir: ds.dir };
    }
    return null;
  };

  /* sebrání magického bonbonu */
  E.collect = function (L, pl, c) {
    if (!L.fx) L.fx = [];
    if (c.magic === 'dragon') {                                  // drak přiletí hned, nehledě na pravidelný interval
      const st = L.ev || (L.ev = { c: -1, tgt: null, air: false, fireT: -2, struck: false });
      if (!(st.sum && L.lt - st.sum.t0 < SF)) {
        const n = (st.sumN = (st.sumN || 0) + 1), rr = G.mulberry32(n * 977 + 5);
        st.sum = { t0: L.lt, c: 1000 + n, dir: pl.facing < 0 ? 1 : -1, y: 170 + rr() * 50 };   // přilétá zepředu, od směru, kam princezna míří
        L.toast = { t: 0, text: 'Drak přilétá!' };
      }
      E.burst(L, pl.x, pl.y - 40, 'fire');
      if (G.Audio) { G.Audio.magic(); setTimeout(() => G.Audio && G.Audio.roar(), 260); }
      return;
    }
    if (c.magic === 'unicorn') {
      pl.mount = pl.mountMax = 11; pl.cloak = 0; pl.mountPh = 0; if (pl.climbing) { pl.climbing = null; pl.onGround = false; pl.vy = 0; }   // z žebříku se spadne dolů, na jednorožci se nelze držet
      E.burst(L, pl.x, pl.y - 40, 'rainbow');
      if (G.Audio) { G.Audio.magic(); setTimeout(() => G.Audio && G.Audio.neigh(), 220); }
    } else if (c.magic === 'ghost') {
      pl.cloak = pl.cloakMax = 10; pl.mount = 0;
      E.burst(L, pl.x, pl.y - 40, 'ghost');
      if (G.Audio) { G.Audio.magic(); setTimeout(() => G.Audio && G.Audio.boo(), 220); }
    }
  };
})(window.G);
