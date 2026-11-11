/* Vykreslování: paralaxové pozadí, plošiny s mírným nadhledem, postavy, HUD.
   Plošiny i pozadí jsou zatím procedurální placeholder; později je nahradíme obrázky. */
(function (G) {
  const C = G.C, BS = C.BS;
  const IMG = {};
  const K = 0.5;                                   // měřítko plošin: 128 px/blok ve zdroji -> 64 px/blok ve hře
  const PTYPES = ['ice', 'sticky', 'wood', 'stone', 'grass', 'tramp', 'belt'];
  /* výška (px ve zdroji) od horního okraje obrázku po střed horní plochy, kde stojí princezna */
  const OFF = { ice: 16, sticky: 16, wood: 11, stone: 18, grass: 26, tramp: 20, belt: 16 };
  const FILES = ['princess', 'p_back', 'p_blink', 'dragon_0', 'dragon_1', 'dragon_2'];
  const NW = 6, NC = 4;                              // počet snímků chůze a lezení
  const WEBP = ['scorch_0', 'scorch_1', 'scorch_2', 'uni_stand', 'uni_0', 'uni_1', 'uni_2', 'uni_3', 'uni_4', 'uni_5', 'ghost', 'ghost_blink', 'trunks', 'p_ice_0', 'p_ice_1', 'p_ice_2', 'p_ice_3', 'p_ice_4', 'p_ice_5', 'p_bal_0', 'p_bal_1', 'p_bal_2', 'p_bal_3', 'p_bal_4', 'p_bal_5', 'walker_0', 'walker_1', 'walker_2', 'walker_3', 'walker_4', 'walker_5', 'walker_6', 'walker_7',
    'hopper_0', 'hopper_1', 'hopper_2', 'hopper_3', 'hopper_4', 'hopper_5',
    'puffer_0', 'puffer_1', 'puffer_2', 'puffer_3', 'puffer_4', 'puffer_5', 'puffer_6', 'puffer_7', 'gnd_tile', 'fulcrum', 'fulcrum_top', 'fulcrum_base', 'post', 'portal',
    'ui/heart_full', 'ui/heart_empty', 'ui/panel_wide', 'ui/panel_small', 'ui/star_full', 'ui/star_empty', 'ui/btn_play', 'ui/btn_round', 'ui/crown', 'ui/ribbon',
    'p_jump_0', 'p_jump_1', 'p_jump_2', 'p_jump_3', 'p_fall_0', 'p_fall_1', 'p_fall_2', 'p_fall_3', 'p_fall_4', 'p_fall_5',
    'candy_0', 'candy_1', 'candy_2', 'candy_3', 'candy_4', 'candy_5', 'candy_6', 'candy_7', 'candy_8', 'candy_9', 'candy_10', 'candy_11', 'candy_12', 'candy_13', 'candy_14',
    'decor/tree_0', 'decor/tree_1', 'decor/tree_2', 'decor/bush_0', 'decor/bush_1', 'decor/bush_2', 'decor/bush_3',
    'decor/rock_0', 'decor/rock_1', 'decor/rock_2', 'decor/rock_3', 'decor/grass_0', 'decor/grass_1', 'decor/grass_2',
    'decor/fern_0', 'decor/fern_1', 'decor/mush_0', 'decor/mush_1'];
  for (let i = 0; i < NW; i++) WEBP.push('p_walk_' + i);
  for (let i = 0; i < NC; i++) WEBP.push('p_climb_' + i);
  for (const t of PTYPES) for (let n = 1; n <= 6; n++) WEBP.push('plat/' + t + '_' + n);

  function loadAll() {
    const one = (n, src) => new Promise(res => { const i = new Image(); i.onload = res; i.onerror = res; i.src = src; IMG[n] = i; });
    return Promise.all(FILES.map(n => one(n, 'assets/' + n + '.png'))
      .concat(WEBP.map(n => one(n, 'assets/' + n + '.webp')))
      .concat([one('bg', 'assets/bg.jpg'), one('bg_garden', 'assets/bg_garden.jpg'), one('bg_forest', 'assets/bg_forest.jpg'), one('bg_night', 'assets/bg_night.jpg'), one('bg_garden_night', 'assets/bg_garden_night.jpg'), one('bg_forest_night', 'assets/bg_forest_night.jpg')]));
  }
  const ok = im => im && im.width > 0;


  /* ---------- pozadí ---------- */
  let BGYO = 0, BGSH = 0;                          // svislý posun obrazu pozadí (létající tvorové jsou v souřadnicích pozadí)
  const FLY = { bird: null, dragon: null, uni: null, ghost: null };
  const smo = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  function drawSky(ctx, cam, L, t) {
    const W = C.VW, H = C.VH, th = (G.Themes && G.Themes[L.theme]) || { bg: 'bg', mist: '255,255,255', mistA: 0.26, key: 'meadow' };
    const e = G.Env.get(L, L.lt || 0);
    const bg = IMG[th.bg] && IMG[th.bg].width ? IMG[th.bg] : IMG.bg, bgN = th.bgN && ok(IMG[th.bgN]) ? IMG[th.bgN] : null;
    const prog = Math.max(0, Math.min(1, cam.y / Math.max(1, L.pxH - H)));   // 0 nahoře, 1 dole
    if (bg && bg.width) {
      const sh = H * 1.4, sw = sh * bg.width / bg.height;
      const yOff = -(sh - H) * (1 - prog) * 0.9 - (sh - H) * 0.1 * prog;
      BGYO = yOff; BGSH = sh;
      const xo = cam.x * 0.10;
      let k = Math.floor(xo / sw);
      const tile = (img, al) => {                                 // pozadí se zrcadlí, aby na sebe plynule navazovalo
        ctx.save(); ctx.globalAlpha = al;
        for (let i = k - 1; i <= k + 2; i++) {
          const x = i * sw - xo;
          if (x > W || x + sw < 0) continue;
          ctx.save();
          if (((i % 2) + 2) % 2) { ctx.translate(x + sw, yOff); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, sw + 1, sh); }
          else ctx.drawImage(img, x, yOff, sw + 1, sh);
          ctx.restore();
        }
        ctx.restore();
      };
      tile(bg, 1); if (bgN && e.n > 0.01) tile(bgN, e.n);       // den ↔ noc: plynulé prolnutí
    } else { ctx.fillStyle = '#6fa8e8'; ctx.fillRect(0, 0, W, H); }
    drawStars(ctx, cam, t, e, th);
    drawSun(ctx, cam, e, th);
    drawStormSky(ctx, t, e);
    if (th.key === 'garden' && e.rainbow > 0.02) drawRainbow(ctx, cam, t, e.rainbow);
    // mlha, která pomalu pluje
    for (let i = 0; i < 6; i++) {
      const sp = 0.18 + i * 0.05, x = (((i * 520 - cam.x * sp + t * (5 + i * 2)) % 2200) + 2200) % 2200 - 500;
      const y = H * (0.52 + i * 0.07) - (cam.y - (L.pxH - H)) * sp * 0.4;
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.38);
      const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 270);
      g.addColorStop(0, 'rgba(' + th.mist + ',' + th.mistA * (th.key === 'forest' && L.weather === 'fog' ? 1.35 : 1) + ')'); g.addColorStop(1, 'rgba(' + th.mist + ',0)');
      ctx.fillStyle = g; ctx.fillRect(-272, -272, 544, 544); ctx.restore();
    }
    if (th.key === 'garden') { if (e.n < 0.55 && e.rain < 0.3) drawUnicorn(ctx, cam, t); }
    else if (th.key === 'forest') drawForestLayer(ctx, cam, t, e);
    else drawSkyCreatures(ctx, cam, t, L, e);
  }

  /* hvězdy blikají jen v noci a ve svítání */
  function drawStars(ctx, cam, t, e, th) {
    if (e.n < 0.04 || th.key === 'forest') return;
    const W = C.VW, r = G.mulberry32(77);
    ctx.save(); ctx.fillStyle = '#fff';
    for (let i = 0; i < 48; i++) {
      const bx = r() * W * 1.3, by = r(), sz = 0.7 + r() * 1.3, ph = r() * 6.28;
      const x = (((bx - cam.x * 0.02) % W) + W) % W, y = BGYO + BGSH * (0.02 + by * 0.30);
      if (y < -4 || y > C.VH * 0.62) continue;
      ctx.globalAlpha = e.n * (0.35 + 0.65 * Math.max(0, Math.sin(t * (1.1 + sz * 0.5) + ph)));
      ctx.beginPath(); ctx.arc(x, y, sz, 0, 7); ctx.fill();
    }
    ctx.restore();
  }
  /* slunce vychází ze svítání: rudne u obzoru a nad ránem zlátne */
  function drawSun(ctx, cam, e, th) {
    if (th.key === 'forest' || e.sun < 0.02) return;
    const W = C.VW, hz = BGYO + BGSH * (th.key === 'garden' ? 0.50 : 0.36), top = BGYO + BGSH * 0.15, u = 1 - Math.pow(1 - e.sunRise, 2);
    const x = W * (th.key === 'garden' ? 0.30 : 0.20) - cam.x * 0.03, y = hz + (top - hz) * u, low = 1 - u;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const R = 120 + 90 * u, g = ctx.createRadialGradient(x, y, 4, x, y, R);
    g.addColorStop(0, 'rgba(255,' + Math.round(235 - low * 70) + ',' + Math.round(190 - low * 90) + ',' + (0.30 * e.sun) + ')');
    g.addColorStop(1, 'rgba(255,200,140,0)'); ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    if (e.warm > 0.02) {                                         // červánky podél celého obzoru
      const gw = ctx.createLinearGradient(0, hz - 140, 0, hz + 80);
      gw.addColorStop(0, 'rgba(255,150,90,0)'); gw.addColorStop(0.65, 'rgba(255,140,80,' + (0.30 * e.warm) + ')'); gw.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = gw; ctx.fillRect(0, hz - 140, W, 220);
    }
    ctx.restore();
    ctx.save(); ctx.globalAlpha = Math.min(1, e.sun * (0.55 + 0.4 * low)); ctx.fillStyle = 'rgb(255,' + Math.round(246 - low * 60) + ',' + Math.round(215 - low * 100) + ')';
    ctx.beginPath(); ctx.arc(x, y, 27, 0, 7); ctx.fill(); ctx.restore();
  }
  function drawStormSky(ctx, t, e) {
    if (e.storm < 0.02) return;
    const W = C.VW, H = C.VH, g = ctx.createLinearGradient(0, 0, 0, H * 0.75);
    g.addColorStop(0, 'rgba(22,26,44,' + (0.62 * e.storm) + ')'); g.addColorStop(1, 'rgba(40,46,70,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) {
      const x = (((i * 260 + t * (9 + i * 2)) % (W + 500)) + W + 500) % (W + 500) - 250, y = 50 + (i % 3) * 55;
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.38);
      const c = ctx.createRadialGradient(0, 0, 10, 0, 0, 280); c.addColorStop(0, 'rgba(34,38,58,' + (0.5 * e.storm) + ')'); c.addColorStop(1, 'rgba(34,38,58,0)');
      ctx.fillStyle = c; ctx.fillRect(-282, -282, 564, 564); ctx.restore();
    }
  }


  /* ---------- zámecká zahrada: třpytivá duha + jednorožec v dálce ---------- */
  function sparkle(ctx, x, y, r, a) {
    ctx.globalAlpha = a; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.fill();
    ctx.globalAlpha = 1;
  }
  function drawRainbow(ctx, cam, t, ra) {
    const W = C.VW, xo = cam.x * 0.07, cx = (((1050 - xo) % 2600) + 2600) % 2600 - 700;       // duha se pomalu posouvá a po čase se vrací
    const base = BGYO + BGSH * 0.60, R0 = 330;
    if (cx + R0 + 60 < 0 || cx - R0 - 60 > W) return;
    const cols = ['255,70,90', '255,150,60', '255,225,80', '110,215,110', '70,170,255', '110,110,235', '190,110,230'];
    ctx.save(); ctx.lineCap = 'butt';
    const shim = (0.30 + 0.06 * Math.sin(t * 1.3)) * ra;
    cols.forEach((c, i) => { ctx.strokeStyle = 'rgba(' + c + ',' + shim + ')'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, base, R0 - i * 9.5, Math.PI, 0); ctx.stroke(); });
    // záblesk, který běží po oblouku
    const u = ((t * 0.16) % 1.5) - 0.25, ang = Math.PI + u * Math.PI;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.42 * ra) + ')'; ctx.lineWidth = 18; ctx.beginPath(); ctx.arc(cx, base, R0 - 28, ang - 0.10, ang + 0.10); ctx.stroke();
    // třpytky
    for (let i = 0; i < 30; i++) {
      const a = Math.PI * (0.04 + 0.92 * ((i * 0.618) % 1)), rr = R0 - ((i * 7) % 7) * 9.5 + 2;
      const tw = Math.sin(t * (1.6 + (i % 5) * 0.4) + i * 2.3);
      if (tw > 0.2) sparkle(ctx, cx + Math.cos(Math.PI + a) * rr, base + Math.sin(Math.PI + a) * rr, 3 + tw * 4 + (i % 3), (0.35 + tw * 0.6) * ra);
    }
    ctx.restore();
  }
  function drawUnicorn(ctx, cam, t) {
    const W = C.VW, xo = cam.x * 0.10, d0 = t - 9, per = 67;
    if (d0 < 0) return;
    const c = Math.floor(d0 / per), l = d0 - c * per, dur = 17;
    if (l >= dur) return;
    if (!FLY.uni || FLY.uni.c !== c) FLY.uni = { c, xo };
    const dir = c % 2 === 0 ? 1 : -1, run = (W + 300) * l / dur;
    const x = FLY.uni.xo - xo + (dir > 0 ? -150 + run : W + 150 - run);
    const im = IMG['uni_' + Math.floor(l * 8.6) % 6]; if (!ok(im)) return;
    const h = 80, w = h * im.width / im.height;
    const cyc = (l * 8.6) % 6, gal = Math.sin((cyc / 6) * Math.PI * 2 + 0.6) * 0.5 + 0.5;       // lehké nadskakování v rytmu cvalu
    const y = BGYO + BGSH * 0.566 - gal * 3.5;
    // prach a třpytky od kopyt, zůstávají za ním na louce
    for (let i = 0; i < 10; i++) {
      const k = ((l * 2.2 + i * 0.1) % 1), sx = x - dir * (w * 0.30 + k * 70), sy = BGYO + BGSH * 0.566 - 3 - k * 9 - (i % 3) * 2;
      ctx.globalAlpha = (1 - k) * 0.30; ctx.fillStyle = '#f3e8d0';
      ctx.beginPath(); ctx.arc(sx, sy, 2 + k * 6, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 7; i++) {
      const k = ((l * 2 + i * 0.37) % 1), sx = x - dir * (w * 0.35 + k * 90), sy = y - h * 0.42 - Math.sin(i * 2.1 + t * 3) * 10 + k * 14;
      sparkle(ctx, sx, sy, 2 + (1 - k) * 3.5, (1 - k) * 0.85);
    }
    // stín na trávě
    ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#1c2a10'; ctx.beginPath(); ctx.ellipse(x, BGYO + BGSH * 0.566, w * 0.30, 3.5, 0, 0, 7); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(x, y); if (dir < 0) ctx.scale(-1, 1); ctx.globalAlpha = 0.98;
    ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
  }

  /* ---------- strašidelný les: vrstva kmenů s paralaxou; duch občas vykoukne zpoza kmene ---------- */
  const TRUNK_C = [0.0742, 0.2598, 0.474, 0.6934, 0.8958], TRUNK_W = [0.1016, 0.069, 0.1198, 0.0729, 0.1198];
  function drawForestLayer(ctx, cam, t, e) {
    const W = C.VW, H = C.VH, im = IMG.trunks; if (!ok(im)) return;
    if (!IMG.trunks_n) {                                                     // noční verze kmenů: do modra, jednou předpočítaná
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d');
      g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(28,52,150,.50)'; g.fillRect(0, 0, c.width, c.height);
      IMG.trunks_n = c;
    }
    const s = H / im.height, tw = im.width * s, hT = im.height * s, xo = cam.x * 0.34;
    const prog = Math.max(0, Math.min(1, cam.y / Math.max(1, H * 4))), ty = -20 + Math.min(1, prog * 3) * 20;     // vrstva kmenů vždy sahá až k hornímu okraji obrazu
    const tile0 = Math.floor(xo / tw) - 1;
    const trunkX = (i, k) => { const m = ((i % 2) + 2) % 2; const fc = m ? 1 - TRUNK_C[k] : TRUNK_C[k]; return i * tw - xo + fc * tw; };
    // duch: cyklus 19 s, vykouknutí 8 s
    const per = 19, d0 = t - 7;
    let ghost = null;
    if (d0 >= 0) {
      const c = Math.floor(d0 / per), l = d0 - c * per;
      if (l < 8) {
        if (!FLY.ghost || FLY.ghost.c !== c) {
          const rnd = G.mulberry32(c * 977 + 5), opts = [];
          for (let i = tile0; i <= tile0 + 3; i++) for (let k = 0; k < 5; k++) { const x = trunkX(i, k); if (x > 160 && x < W - 160) opts.push([i, k]); }
          const pick = opts.length ? opts[Math.floor(rnd() * opts.length)] : null;
          FLY.ghost = { c, tile: pick && pick[0], k: pick && pick[1], side: rnd() < 0.5 ? 1 : -1, y: 0.40 + rnd() * 0.2, xo };
        }
        const g = FLY.ghost;
        if (g.tile != null) ghost = { l, g };
      }
    }
    if (ghost && ok(IMG.ghost)) {
      const { l, g } = ghost, u = l / 8, m = ((g.tile % 2) + 2) % 2;
      const p = u < 0.22 ? u / 0.22 : u > 0.74 ? Math.max(0, (1 - u) / 0.26) : 1, e = p * p * (3 - 2 * p);
      const tx = trunkX(g.tile, g.k) + (g.xo - xo) * 0, half = TRUNK_W[g.k] * tw / 2;
      const peek = e * (half + 4) + (u > 0.3 && u < 0.7 ? Math.sin(l * 3.2) * 4 : 0) * e;
      const gh = 92, gw = gh * IMG.ghost.width / IMG.ghost.height;
      const gx = tx + g.side * peek, gy = ty + hT * g.y + Math.sin(t * 1.8) * 5 + Math.sin(t * 3.3) * 2;
      ctx.save(); ctx.globalAlpha = Math.min(1, e * 1.4) * 0.88; ctx.translate(gx, gy); if (g.side > 0) ctx.scale(-1, 1);
      ctx.rotate(g.side * -0.08 * e); ctx.shadowColor = 'rgba(190,200,255,.9)'; ctx.shadowBlur = 18;
      // mrkání (každé ~2,6 s na 0,16 s) a vlání: vodorovné pásy, které se od hlavy k lemu stále víc vlní
      const bp = (t + g.c * 1.3) % 2.6, im = (bp < 0.16 && ok(IMG.ghost_blink)) ? IMG.ghost_blink : IMG.ghost;
      const N = 28, sh = im.height / N, dh = gh / N;
      for (let i = 0; i < N; i++) {
        const f = i / (N - 1), amp = f * f * 7 + 0.5, wob = Math.sin(t * 4.2 - f * 5.5 + g.c) * amp + Math.sin(t * 2.3 - f * 3) * f * 3;
        const wid = 1 + Math.sin(t * 3.1 - f * 4) * 0.035 * f;
        ctx.drawImage(im, 0, i * sh, im.width, sh + 1, -gw * wid / 2 + wob, -gh / 2 + i * dh, gw * wid, dh + 0.8);
      }
      ctx.restore();
    }
    if (e.n > 0.03) {                                                        // měsíc prosvítá mezi stromy: tři jemné paprsky
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) {
        const x0 = W * (0.30 + k * 0.22) - xo * 0.10, w0 = 60 + k * 14, a = e.n * (0.07 + 0.03 * Math.sin(t * 0.7 + k * 2));
        const gg = ctx.createLinearGradient(0, 0, 0, H * 0.9); gg.addColorStop(0, 'rgba(170,205,255,' + a + ')'); gg.addColorStop(1, 'rgba(170,205,255,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + w0, 0); ctx.lineTo(x0 + w0 - 210, H * 0.9); ctx.lineTo(x0 - 210, H * 0.9); ctx.fill();
      }
      ctx.restore();
    }
    const layer = (img, al) => {
      ctx.save(); ctx.globalAlpha = al;
      for (let i = tile0; i <= tile0 + 3; i++) {
        const x = i * tw - xo; if (x > W || x + tw < 0) continue;
        ctx.save();
        if (((i % 2) + 2) % 2) { ctx.translate(x + tw, ty); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, tw + 1, hT); }
        else ctx.drawImage(img, x, ty, tw + 1, hT);
        ctx.restore();
      }
      ctx.restore();
    };
    layer(im, 0.96); if (e.n > 0.02) layer(IMG.trunks_n, 0.96 * e.n);
    const fg = ctx.createLinearGradient(0, H * 0.52, 0, H); fg.addColorStop(0, 'rgba(40,36,100,0)'); fg.addColorStop(1, 'rgba(26,20,70,.55)');   // mlha u země před kmeny
    ctx.fillStyle = fg; ctx.fillRect(0, H * 0.52, W, H * 0.48);
  }

  /* ---------- popředí: oheň draka, déšť, lístky, světlušky, noční tma, blesky (před HUD) ---------- */
  function drawFlame(ctx, f, t) {
    const { mx, my, tx, ty, k, dir } = f; if (k <= 0.02) return;
    const dx = tx - mx, dy = ty - my, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx), L2 = len * Math.min(1, k * 1.6);
    ctx.save(); ctx.translate(mx, my); ctx.rotate(ang); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 38; i++) {
      const u = ((t * 2.3 + i / 38) % 1), x = u * L2, sp = (0.03 + u * 0.15) * len, y = Math.sin(i * 12.9 + t * 14) * sp * 0.6 + Math.sin(t * 9 + i) * sp * 0.2, r = (5 + u * 24) * (0.55 + 0.45 * k);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,' + Math.round(250 - u * 120) + ',' + Math.round(170 - u * 150) + ',' + (0.75 * (1 - u * 0.6) * k) + ')');
      g.addColorStop(0.5, 'rgba(255,' + Math.round(130 - u * 60) + ',30,' + (0.35 * (1 - u) * k) + ')'); g.addColorStop(1, 'rgba(180,40,10,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g2 = ctx.createRadialGradient(tx, ty, 4, tx, ty, 90); g2.addColorStop(0, 'rgba(255,170,60,' + (0.4 * k) + ')'); g2.addColorStop(1, 'rgba(255,120,30,0)'); ctx.fillStyle = g2; ctx.fillRect(tx - 90, ty - 90, 180, 180); ctx.restore();
  }

  function drawOverlay(ctx, L, cam, t) {
    const W = C.VW, H = C.VH, e = G.Env.get(L, L.lt || 0), th = L.theme;
    // ----- oheň draka a hořící nepřítel (souřadnice obrazovky)
    if (th === 'meadow' && G.Events) { const f = G.Events.fire(L, L.lt || 0, cam); if (f) drawFlame(ctx, f, t); }
    // ----- noční ztmavení celé scény (postavy i plošiny trochu zmodrají, ať nesvítí jako ve dne)
    if (e.n > 0.02) {
      ctx.save(); ctx.globalCompositeOperation = 'multiply';
      const tint = th === 'forest' ? [196, 208, 244] : th === 'garden' ? [190, 195, 235] : [175, 190, 238];
      ctx.fillStyle = 'rgb(' + tint.map(c => Math.round(255 - (255 - c) * e.n)).join(',') + ')'; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    if (e.warm > 0.02) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(255,150,90,' + (0.38 * e.warm) + ')'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    // ----- les: tmavé okraje
    if (th === 'forest') {
      const vg = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.95);
      vg.addColorStop(0, 'rgba(10,8,40,0)'); vg.addColorStop(1, 'rgba(10,8,40,' + (0.5 + 0.06 * e.n) + ')'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }
    // ----- světlušky: v lese stále, v zahradě v noci
    if (e.fireflies > 0.02) {
      const cnt = Math.round(14 * e.fireflies + 2);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < cnt; i++) {
        const sp = 0.25 + (i % 3) * 0.18, x = (((i * 211 + t * (7 + i % 5) - cam.x * sp) % (W + 200)) + W + 200) % (W + 200) - 100;
        const y = H * (0.25 + ((i * 0.37) % 1) * 0.6) + Math.sin(t * 0.7 + i) * 20, a = (0.35 + 0.65 * Math.max(0, Math.sin(t * 1.6 + i * 1.9))) * Math.min(1, e.fireflies * 1.3);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 9); g.addColorStop(0, 'rgba(230,255,160,' + a + ')'); g.addColorStop(1, 'rgba(230,255,160,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 9, y - 9, 18, 18);
      }
      ctx.restore();
    }
    // ----- okvětní lístky (zahrada)
    if (e.petals > 0.02) {
      const n = Math.round(30 * e.petals);
      for (let i = 0; i < n; i++) {
        const sp = 0.5 + (i % 4) * 0.25, ph = i * 1.7;
        const x = (((i * 137 + t * (24 + (i % 5) * 7) - cam.x * 0.15) % (W + 160)) + W + 160) % (W + 160) - 80;
        const y = (((i * 83 + t * (26 + (i % 4) * 9)) % (H + 80)) + H + 80) % (H + 80) - 40 + Math.sin(t * 1.4 + ph) * 18;
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * (0.8 + sp) + ph); ctx.scale(1, 0.55 + 0.45 * Math.sin(t * 2 + ph));
        ctx.fillStyle = i % 3 ? 'rgba(255,196,216,.85)' : 'rgba(255,230,238,.85)'; ctx.beginPath(); ctx.ellipse(0, 0, 5.5 * sp, 3.2 * sp, 0, 0, 7); ctx.fill(); ctx.restore();
      }
    }
    // ----- déšť
    if (e.rain > 0.02) {
      const n = Math.round(150 * e.rain), slant = e.storm > 0.05 ? 0.28 : 0.1;
      ctx.save(); ctx.strokeStyle = 'rgba(205,220,255,' + (0.34 + 0.18 * e.storm) + ')'; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const sp = 620 + (i % 7) * 85, x0 = (i * 73.7) % (W + 240) - 120, y = (((i * 131.3 + t * sp) % (H + 90)) + H + 90) % (H + 90) - 45, x = x0 - (y + 45) * slant * 0.35 + t * 0 ;
        ctx.moveTo(x, y); ctx.lineTo(x - slant * 15, y + 16);
      }
      ctx.stroke(); ctx.restore();
    }
    // ----- blesk (záblesk celé obrazovky + klikatý výboj)
    if (e.flash > 0.02) {
      ctx.save(); ctx.fillStyle = 'rgba(225,235,255,' + (0.5 * e.flash) + ')'; ctx.fillRect(0, 0, W, H);
      if (e.bolt) {
        ctx.globalAlpha = Math.min(1, e.flash * 1.4); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        const tr = (w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); e.bolt.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); };
        tr(9, 'rgba(150,170,255,.45)'); tr(3, '#fff');
      }
      ctx.restore();
    }
    // ----- název levelu na začátku se kreslí v HUD
  }

  /* Ptáci a drak žijí v souřadnicích POZADÍ: letí vlastní rychlostí vůči obrazu pozadí, kamera je posouvá
     jen stejně pomalu jako samotné hory (paralaxa 0,10). Pohyb princezny na ně tedy nereaguje. */
  function drawSkyCreatures(ctx, cam, t, L, e) {
    const W = C.VW, xo = cam.x * 0.10;
    // ptáci: cyklus 46 s, přelet 30 s (v noci nelétají)
    const bp = 46, bc = Math.floor(t / bp), bl = t - bc * bp;
    if (!FLY.bird || FLY.bird.c !== bc) FLY.bird = { c: bc, xo };
    if (bl < 30 && e.n < 0.4 && e.storm < 0.3) {
      const rnd = G.mulberry32(bc * 77 + 3), dir = rnd() < 0.5 ? 1 : -1, by = 250 + rnd() * 100;
      const x0 = (dir > 0 ? -150 + bl * 55 : W + 150 - bl * 55), y0 = by + BGYO;
      ctx.strokeStyle = 'rgba(60,72,95,.55)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      for (let i = 0; i < 11; i++) {
        const ox = -dir * (Math.abs(i - 5) * 15 + (i % 2) * 6), oy = Math.abs(i - 5) * 7 + (i % 3) * 3;
        const x = x0 + ox, y = y0 + oy + Math.sin(t * 0.8 + i) * 2, f = Math.sin(t * 6 + i * 1.7) * 3.2;
        ctx.beginPath(); ctx.moveTo(x - 6, y - 2 + f * 0.3); ctx.quadraticCurveTo(x - 3, y - 4 - f, x, y); ctx.quadraticCurveTo(x + 3, y - 4 - f, x + 6, y - 2 + f * 0.3); ctx.stroke();
      }
    }
    // drak: poloha i oheň počítá events.js (cyklus 70 s, přelet 17 s), nezávisle na pohybu kamery
    const ds = G.Events && G.Events.dragon(L, L.lt || 0);
    if (ds) {
      const im = IMG['dragon_' + [0, 1, 2, 1][Math.floor(t * 6) % 4]];
      if (ok(im)) {
        const h = ds.h, w = h * im.width / im.height;
        ctx.save(); ctx.translate(ds.x, ds.y); if (ds.dir < 0) ctx.scale(-1, 1);
        ctx.rotate(Math.cos(ds.l * 0.9) * 0.06); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
      }
    }
  }

  /* ---------- plošiny ---------- */
  function drawPlatform(ctx, p, t) {
    if (p.hidden) return;
    if (p.type === 'grass') return drawGround(ctx, p);
    if (p.type === 'wood') return drawSeesaw(ctx, p);
    const im = IMG['plat/' + p.type + '_' + p.n];
    if (!ok(im)) return;
    const w = p.pw, h = im.height * K, y = p.py - OFF[p.type] * K;
    if (p.type === 'tramp' && p.bounce > 0) {
      const sq = 1 - 0.14 * Math.sin(p.bounce * Math.PI);
      ctx.save(); ctx.translate(p.px, y + h); ctx.scale(1, sq); ctx.drawImage(im, 0, -h, w, h); ctx.restore();
    } else ctx.drawImage(im, p.px, y, w, h);
    if (p.type === 'belt') {
      const off = (t * 40 * p.dir) % 22, m = p.dir > 0 ? 1 : -1;
      ctx.save(); ctx.beginPath(); ctx.rect(p.px + 12, p.py - 7, w - 24, 13); ctx.clip();
      ctx.fillStyle = 'rgba(255,196,96,.5)';
      for (let i = p.px - 22 + off; i < p.px + w + 22; i += 22) { ctx.beginPath(); ctx.moveTo(i, p.py - 5); ctx.lineTo(i + 7 * m, p.py); ctx.lineTo(i, p.py + 5); ctx.lineTo(i + 3 * m, p.py); ctx.fill(); }
      ctx.restore();
    }
  }

  /* travnatá země: dlaždice po celé šířce + tmavá zemina až ke dnu levelu */
  function drawGround(ctx, p) {
    const im = IMG.gnd_tile; if (!ok(im)) { ctx.fillStyle = '#4f7a2a'; ctx.fillRect(p.px, p.py - 10, p.pw, p.th + 10); return; }
    const tw = im.width * K, th = im.height * K, y = p.py - OFF.grass * K;
    const end = p.py + p.th, s0 = y + th * 0.55;
    const g = ctx.createLinearGradient(0, s0, 0, Math.min(end, s0 + 520));
    g.addColorStop(0, '#5a4630'); g.addColorStop(0.35, '#3d2f20'); g.addColorStop(1, '#17110a');
    ctx.fillStyle = g; ctx.fillRect(p.px, s0, p.pw, end - s0 + 4);
    const x0 = Math.max(p.px, G.game.cam.x - tw), x1 = Math.min(p.px + p.pw, G.game.cam.x + C.VW + tw);
    for (let x = p.px + Math.floor((x0 - p.px) / tw) * tw; x < x1; x += tw) ctx.drawImage(im, x, y, tw + 1, th);
  }

  /* houpačka: dřevěný sloup od země až pod nosník (vykreslený před rovinou plošin), držák s mosazným čepem a nosník */
  const WOOD_SQ = 0.62;
  function drawSeesaw(ctx, p) {
    const im = IMG['plat/wood_' + p.n]; if (!ok(im)) return;
    const h = im.height * K * WOOD_SQ, off = OFF.wood * K * WOOD_SQ;
    // držák nad sloupem
    const ft = IMG.fulcrum_top;
    if (ok(ft)) { const fw = 50, fh = fw * ft.height / ft.width; ctx.drawImage(ft, p.cx - fw / 2, p.py + 14, fw, fh); }
    // nosník
    ctx.save(); ctx.translate(p.cx, p.py); ctx.rotate(p.tilt);
    ctx.drawImage(im, -p.pw / 2, -off, p.pw, h);
    ctx.fillStyle = 'rgba(30,22,12,.9)'; ctx.fillRect(-9, -off + 2, 18, h - 4);
    ctx.restore();
  }

  /* sloup houpačky je blíž ke kameře než princezna: kreslí se po ní, takže ho princezna oběhne zezadu */
  function drawSeesawFront(ctx, p) {
    const gy = (G.game.level && G.game.level.groundY) || (p.py + 200);
    const pw = 26, top = p.py + 24, bot = gy + 8;
    const post = IMG.post;
    // sloup
    ctx.save(); ctx.beginPath(); ctx.rect(p.cx - pw / 2, top, pw, bot - top); ctx.clip();
    if (ok(post)) { const th = post.height * pw / post.width; for (let y = top; y < bot; y += th) ctx.drawImage(post, p.cx - pw / 2, y, pw, th + 1); }
    else { ctx.fillStyle = '#5a3d22'; ctx.fillRect(p.cx - pw / 2, top, pw, bot - top); }
    const sh = ctx.createLinearGradient(p.cx - pw / 2, 0, p.cx + pw / 2, 0);   // zakulacení sloupu
    sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(0.3, 'rgba(255,255,255,.08)'); sh.addColorStop(0.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = sh; ctx.fillRect(p.cx - pw / 2, top, pw, bot - top);
    const sd = ctx.createLinearGradient(0, top, 0, top + 60); sd.addColorStop(0, 'rgba(0,0,0,.45)'); sd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sd; ctx.fillRect(p.cx - pw / 2, top, pw, 60);
    ctx.restore();
    // železné pásy na sloupu
    ctx.fillStyle = '#2b2d33'; for (const yy of [top + 46, (top + bot) / 2, bot - 40]) if (yy < bot - 30) { ctx.fillRect(p.cx - pw / 2 - 2, yy, pw + 4, 7); ctx.fillStyle = '#8b8f99'; ctx.fillRect(p.cx - pw / 2 - 2, yy, pw + 4, 1.5); ctx.fillStyle = '#2b2d33'; }
    // patka sloupu
    const fb = IMG.fulcrum_base;
    if (ok(fb)) { const bw = 52, bh = bw * fb.height / fb.width; ctx.drawImage(fb, p.cx - bw / 2, gy + 9 - bh, bw, bh); }
    // mosazný čep v ose houpání (blíž ke kameře než princezna)
    const g = ctx.createRadialGradient(p.cx - 2, p.py - 2, 1, p.cx, p.py + 2, 11);
    g.addColorStop(0, '#fff0b0'); g.addColorStop(0.5, '#d4a53a'); g.addColorStop(1, '#6e4f12');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.cx, p.py + 3, 9, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3a2a0a'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  /* stafáž: stromy, keře, kameny, tráva */
  function drawLamp(ctx, d, t) {
    const e = G.Env.cur, lit = e.lamp, x = d.x, y = d.y, H = 120;
    ctx.save(); ctx.translate(x, y);
    const g = ctx.createLinearGradient(-4, 0, 4, 0); g.addColorStop(0, '#2c2420'); g.addColorStop(0.5, '#6a5a4a'); g.addColorStop(1, '#2a221e');
    ctx.fillStyle = g; ctx.fillRect(-3.5, -H, 7, H); ctx.fillRect(-9, -7, 18, 7); ctx.fillRect(-6, -H + 8, 12, 4);
    ctx.fillStyle = '#3a302a'; ctx.beginPath(); ctx.moveTo(-14, -H - 2); ctx.lineTo(14, -H - 2); ctx.lineTo(8, -H - 14); ctx.lineTo(-8, -H - 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = lit > 0.05 ? 'rgb(255,' + Math.round(210 + 30 * lit) + ',' + Math.round(130 + 40 * lit) + ')' : 'rgba(210,225,235,.55)';
    ctx.fillRect(-9, -H + 12, 18, 28);
    ctx.strokeStyle = '#2a221e'; ctx.lineWidth = 1.6; ctx.strokeRect(-9, -H + 12, 18, 28); ctx.beginPath(); ctx.moveTo(0, -H + 12); ctx.lineTo(0, -H + 40); ctx.stroke();
    if (lit > 0.05) {
      const fl = 0.9 + 0.1 * Math.sin(t * 7 + d.ph);
      ctx.globalCompositeOperation = 'lighter'; const r = 120 * fl, gg = ctx.createRadialGradient(0, -H + 26, 3, 0, -H + 26, r);
      gg.addColorStop(0, 'rgba(255,205,120,' + (0.62 * lit) + ')'); gg.addColorStop(1, 'rgba(255,170,80,0)'); ctx.fillStyle = gg; ctx.fillRect(-r, -H + 26 - r, r * 2, r * 2);
      const g3 = ctx.createRadialGradient(0, -2, 2, 0, -2, 70); g3.addColorStop(0, 'rgba(255,200,120,' + (0.22 * lit) + ')'); g3.addColorStop(1, 'rgba(255,180,90,0)'); ctx.fillStyle = g3; ctx.fillRect(-70, -72, 140, 140);
    }
    ctx.restore();
  }
  function drawDecor(ctx, d, t) {
    if (d.k === 'lamp') return drawLamp(ctx, d, t);
    const im = IMG['decor/' + d.k]; if (!ok(im)) return;
    const w = im.width * d.s, h = im.height * d.s;
    ctx.save(); ctx.translate(d.x, d.y);
    if (d.k.startsWith('tree') || d.k.startsWith('grass') || d.k.startsWith('bush')) ctx.transform(1, 0, Math.sin(t * 0.9 + d.ph) * 0.012, 1, 0, 0);
    ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
  }

  /* ohořelá hromádka po potvoře: uhlíky a popel, žhavé body zpočátku svítí a během ~12 s pohasnou; nad ní chvíli stoupá kouř */
  function drawScorch(ctx, sc) {
    const im = IMG['scorch_' + (Math.floor(sc.seed) % 3)];
    const pop = Math.min(1, sc.t / 0.35), grow = 0.55 + 0.45 * (1 - Math.pow(1 - pop, 3));
    const w = (sc.r * 2.0) * grow, glow = Math.max(0, 1 - sc.t / 12);
    ctx.save(); ctx.translate(sc.x, sc.y + 3);
    ctx.fillStyle = 'rgba(0,0,0,' + 0.28 * pop + ')'; ctx.beginPath(); ctx.ellipse(0, -1, w * 0.52, 5, 0, 0, 7); ctx.fill();   // stín pod hromádkou
    if (ok(im)) {
      const h = w * im.height / im.width;
      ctx.globalAlpha = pop; ctx.drawImage(im, -w / 2, -h + 4, w, h);
      if (glow > 0.02) {                                                             // žhnutí: jemné pulzování a postupné vyhasínání
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';
        const pul = 0.75 + 0.25 * Math.sin(sc.t * 5 + sc.seed), g = ctx.createRadialGradient(0, -h * 0.4, 2, 0, -h * 0.4, w * 0.5);
        g.addColorStop(0, 'rgba(255,120,30,' + (0.34 * glow * pul) + ')'); g.addColorStop(1, 'rgba(255,80,10,0)');
        ctx.fillStyle = g; ctx.fillRect(-w * 0.5, -h * 0.4 - w * 0.5, w, w);
      }
    }
    ctx.restore();
    if (sc.t < 4.5) for (let i = 0; i < 4; i++) {                                    // zbytek kouře
      const u = ((sc.t * 0.45 + i * 0.27) % 1), al = (1 - u) * 0.30 * (1 - sc.t / 4.5);
      ctx.fillStyle = 'rgba(78,72,68,' + al + ')'; ctx.beginPath(); ctx.arc(sc.x + Math.sin(sc.seed + i * 2 + u * 3) * 8, sc.y - 14 - u * 38, 3 + u * 8, 0, 7); ctx.fill();
    }
  }
  /* krátké efekty: jiskry po sebrání magického bonbonu a odchod jednorožce po skončení jízdy */
  function drawFx(ctx, f, t) {
    if (f.k === 'burst') {
      const u = f.t / 1.1, cols = f.col === 'fire' ? ['255,170,60', '255,110,30', '255,230,150'] : f.col === 'rainbow' ? ['255,120,200', '255,220,90', '120,200,255', '190,140,255'] : ['190,215,255', '235,245,255', '160,190,255'];
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 26; i++) {
        const a = i * 2.399 + f.seed, d = (18 + (i % 5) * 9) * (0.3 + u * 1.5) * 1.4, x = f.x + Math.cos(a) * d, y = f.y + Math.sin(a) * d * 0.85 - u * 22, r = (6 - u * 4) * (0.7 + (i % 3) * 0.3);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4), c = cols[i % cols.length];
        g.addColorStop(0, 'rgba(' + c + ',' + (0.9 * (1 - u)) + ')'); g.addColorStop(1, 'rgba(' + c + ',0)');
        ctx.fillStyle = g; ctx.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
      }
      ctx.restore();
    } else if (f.k === 'uniaway') {
      const im = IMG.uni_0 && IMG.uni_0.width ? IMG['uni_' + Math.floor(f.t * 11) % 6] : null; if (!ok(im)) return;
      const u = f.t / 1.7, h = 104, w = h * im.width / im.height, x = f.x + f.dir * (40 + u * 260), y = f.y + 4 - Math.sin(u * Math.PI) * 6;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - Math.max(0, u - 0.45) / 0.55); ctx.translate(x, y); if (f.dir < 0) ctx.scale(-1, 1);
      ctx.drawImage(im, -w * 0.52, -h * 0.97, w, h); ctx.restore();
      for (let q = 0; q < 3; q++) { const k = ((f.t * 2.2 + q * 0.33) % 1); sparkle(ctx, x - f.dir * (20 + k * 50), y - 22 - k * 16 - q * 4, 1.8 + (1 - k) * 2.4, (1 - k) * 0.9 * (1 - u)); }
    }
  }
  function drawLadder(ctx, l) {
    const x1 = l.x + 16, x2 = l.x + BS - 22, top = l.top - 4, h = l.bot - top;
    const wood = (x, w) => { const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#7a4e26'); g.addColorStop(0.5, '#a3703a'); g.addColorStop(1, '#5e3a1a'); ctx.fillStyle = g; ctx.fillRect(x, top, w, h); };
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x1 + 4, top + 3, 6, h); ctx.fillRect(x2 + 4, top + 3, 6, h);
    wood(x1, 7); wood(x2, 7);
    for (let y = l.top + 10; y < l.bot - 4; y += 22) {
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x1, y + 5, x2 - x1 + 7, 3);
      const g = ctx.createLinearGradient(0, y, 0, y + 7); g.addColorStop(0, '#b98048'); g.addColorStop(1, '#7a4e26');
      ctx.fillStyle = g; ctx.fillRect(x1, y, x2 - x1 + 7, 7);
    }
  }

  /* bonbony: obrázky z vaší sady, jemně se pohupují a pootáčejí */
  function drawCandy(ctx, c, t, i) {
    const im = IMG['candy_' + c.kind]; if (!ok(im)) return;
    const bob = Math.sin(t * 2.4 + i * 1.3) * 4.5, rot = Math.sin(t * 1.9 + i * 0.9) * 0.16, pul = 1 + Math.sin(t * 3 + i) * 0.035;
    const k = 38 / Math.max(im.width, im.height), w = im.width * k * pul, h = im.height * k * pul;
    const x = c.x, y = c.y + bob;
    const gl = ctx.createRadialGradient(x, y, 3, x, y, 30);
    gl.addColorStop(0, 'rgba(255,255,255,.38)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, 30, 0, 7); ctx.fill();
    if (c.magic) {                                                                   // magický bonbon: duhová/duchová záře a jiskřičky
      const col = c.magic === 'unicorn' ? [255, 150 + 80 * Math.sin(t * 3), 230] : c.magic === 'dragon' ? [255, 120 + 50 * Math.sin(t * 4), 40] : [170, 215, 255];
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const pg = ctx.createRadialGradient(x, y, 4, x, y, 52 + Math.sin(t * 4) * 6); pg.addColorStop(0, 'rgba(' + col.map(Math.round).join(',') + ',.65)'); pg.addColorStop(1, 'rgba(' + col.map(Math.round).join(',') + ',0)');
      ctx.fillStyle = pg; ctx.fillRect(x - 60, y - 60, 120, 120); ctx.restore();
      for (let q = 0; q < 4; q++) { const a = t * 2.1 + q * 1.57, rr = 30 + Math.sin(t * 3 + q) * 5; sparkle(ctx, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8, 2.5 + Math.sin(t * 5 + q) * 1.2, 0.9); }
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
  }

  let DORMANT = null;
  function dormantPortal() {
    if (DORMANT || !ok(IMG.portal)) return DORMANT;
    const im = IMG.portal, c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(38,48,72,.66)'; g.fillRect(0, 0, c.width, c.height);
    return (DORMANT = c);
  }

  function drawPortal(ctx, po, t, need, have) {
    const im = IMG.portal, open = po.open;
    const h = 176, w = ok(im) ? h * im.width / im.height : 150, x = po.x, y = po.y + 6;
    if (open) {
      const g = ctx.createRadialGradient(x, y - h * 0.5, 10, x, y - h * 0.5, h * 0.9);
      g.addColorStop(0, 'rgba(170,200,255,.55)'); g.addColorStop(1, 'rgba(170,200,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - h, y - h * 1.5, h * 2, h * 2);
    }
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(x, y - 2, w * 0.4, 7, 0, 0, 7); ctx.fill();
    const src = open ? im : (dormantPortal() || im);
    if (src && (src.width || src.naturalWidth)) ctx.drawImage(src, x - w / 2, y - h, w, h);
    if (open) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 6; i++) {
        const a = t * 1.3 + i * 1.05, rr = 18 + (i % 3) * 8;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * rr, y - h * 0.46 + Math.sin(a * 1.3) * (h * 0.28), 1.8, 0, 7); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(have + '/' + need, x, y - h - 8);
    }
  }

  const PK = 68 / 515;     // všechny snímky princezny jsou normalizované na 515 px výšky těla

  /* plynulý přechod mezi snímky: aktuální snímek chvíli drží, pak se prolíná do dalšího */
  function blendDraw(ctx, arr, ph, hold) {
    const n = arr.length, i0 = ((Math.floor(ph) % n) + n) % n, f = ph - Math.floor(ph), a = arr[i0], b = arr[(i0 + 1) % n];
    const one = (im, al) => { if (!im || !(im.width > 0) || al <= 0) return; const w = (im.ow || im.width) * PK, h = (im.oh || im.height) * PK; ctx.globalAlpha = al; ctx.drawImage(im, -w / 2, -h, w, h); };
    if (hold >= 1 || f < hold) { one(a, 1); ctx.globalAlpha = 1; return; }      // ostré přepnutí snímků
    const k = (f - hold) / (1 - hold);                                           // krátké prolnutí na konci snímku
    one(a, 1); one(b, k); ctx.globalAlpha = 1;
  }

  function drawPrincess(ctx, pl, t) {
    if (!ok(IMG.princess)) return;
    if (pl.invuln > 0 && !(pl.mount > 0) && Math.floor(pl.invuln * 14) % 2) return;
    const g = pl.ground, gt = pl.onGround && g ? g.type : null;
    const inX = pl.inX || 0, vxT = pl.vx + (pl.carry || 0), spd = Math.abs(vxT);
    const walk = [], climb = [], jump = [], fall = [];
    for (let i = 0; i < NW; i++) walk.push(IMG['p_walk_' + i]);
    const cl = [0, 1, 2, 3].map(i => IMG['p_climb_' + i]);
    if (!IMG.__cm && cl.every(ok)) {                                   // zrcadlené snímky pro druhou polovinu cyklu (lezení zezadu je symetrické)
      IMG.__cm = cl.map(im => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.ow = im.ow; c.oh = im.oh; const g = c.getContext('2d'); g.translate(im.width, 0); g.scale(-1, 1); g.drawImage(im, 0, 0); return c; });
    }
    // 4 různé pózy: pravá noha nahoře, klid, levá noha nahoře (zrcadlená), klid – žádná póza se neopakuje dvakrát za sebou
    if (IMG.__cm) { climb.push(cl[0], cl[1], IMG.__cm[0], IMG.__cm[1]); }
    for (let i = 0; i < 4; i++) jump.push(IMG['p_jump_' + i]);
    for (let i = 0; i < 6; i++) fall.push(IMG['p_fall_' + i]);
    let flip = pl.facing < 0, still = null, frames = null, ph = 0, bob = 0, tilt = 0, sx = 1, sy = 1, sway = 0, noSquash = false;

    if (pl.crash) {                                                    // složí se, posadí a oprášení
      const T = pl.crash.t;
      still = T < 0.3 ? fall[2] : T < 0.6 ? fall[3] : T < 0.95 ? fall[4] : fall[5];
      if (T >= 0.6 && T < 0.95) tilt = Math.sin(T * 40) * 0.02;
      noSquash = true; flip = pl.facing < 0;
    } else if (pl.fear) {                                              // pád z velké výšky: bojí se
      still = Math.floor(t * 9) % 2 ? fall[0] : fall[1];
      tilt = Math.sin(t * 28) * 0.05; flip = pl.facing < 0; noSquash = true;
    } else if (pl.climbing) {
      frames = climb; ph = pl.climbPh; flip = false;
      bob = 0;
    } else if (!pl.onGround) {
      still = pl.airT < 0.07 ? jump[0] : pl.vy < -60 ? jump[1] : jump[2];
      if (pl.trampAir) { still = pl.vy < -150 ? jump[1] : jump[2]; tilt = Math.sin(t * 9) * 0.04; sy += 0.03; sx += 0.02; }
      else { const s = Math.max(-0.05, Math.min(0.07, -pl.vy / 11000)); sx -= s; sy += s; }
    } else if (pl.landT > 0 && spd < 70) {
      still = jump[3];
      if (gt === 'sticky') { sy -= 0.05; sx += 0.05; }
    } else if (gt === 'wood' && spd < 110) {                            // houpačka: chytá rovnováhu hlavně rukama
      const tl = g.tilt || 0, act = pl.balAct || 0, bal = [];
      for (let i = 0; i < 6; i++) bal.push(IMG['p_bal_' + i]);
      if (act > 0.55) still = bal[Math.floor(t * 7) % 2 ? 3 : 4];
      else if (act > 0.18) still = tl > 0 ? bal[2] : bal[1];
      else still = bal[[0, 1, 0, 2][Math.floor(t * 2.4) % 4]];
      tilt = -tl * 0.35 + Math.sin(t * 5) * 0.02 * (1 + act * 3); flip = false;
    } else if (gt === 'ice' && pl.slipT > 0) {                          // klouže: máchá nohama a rukama, chytá balanc
      const ice = []; for (let i = 0; i < 6; i++) ice.push(IMG['p_ice_' + i]);
      still = ice[Math.floor(pl.slipT * 8.5) % 5]; flip = (pl.slipDir || 1) < 0;
      tilt = Math.sin(t * 22) * 0.02;
    } else if (gt === 'ice' && pl.recT > 0) {                           // chvíli po zastavení: oddechne si
      still = IMG.p_ice_5; flip = (pl.slipDir || 1) < 0;
    } else if (spd > 15 || (gt === 'ice' && inX !== 0)) {
      frames = walk; flip = (inX !== 0 ? inX : (vxT !== 0 ? vxT : pl.facing)) < 0; ph = pl.walkPh;
      bob = Math.abs(Math.sin(ph * Math.PI / 3)) * 2.0;
      if (gt === 'ice') { tilt = Math.sign(inX || vxT) * 0.05 + Math.sin(t * 18) * 0.03; bob *= 0.3; }
      else if (gt === 'sticky') { sy += Math.sin(ph * Math.PI / 2) * 0.04 - 0.04; sx += 0.04; bob *= 0.4; tilt = Math.sin(ph * Math.PI / 3) * 0.03; }
      else if (gt === 'wood') { tilt = -(g.tilt || 0) * 0.5 + Math.sin(t * 9) * 0.05; }
    } else {
      still = pl.blinking > 0 ? IMG.p_blink : IMG.princess; flip = false;
      sway = Math.sin(pl.anim * 1.7) * 0.012; sy += Math.sin(pl.anim * 2.2) * 0.006;
      if (gt === 'sticky') { sy -= 0.04; sx += 0.04; }
    }
    if (!noSquash) { sx += pl.squash; sy -= pl.squash; }
    const dp = pl.depth || 0, ds = 1 + dp * 0.035;
    ctx.save();
    ctx.translate(pl.x + (pl.mount > 0 ? -(pl.facing < 0 ? -16 : 16) : 0), pl.y - bob + 3 + dp * 5 - (pl.mount > 0 ? 54 : 0));
    if (pl.onGround && !pl.climbing && !(pl.mount > 0)) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, bob, 18 * ds, 5 * ds, 0, 0, 7); ctx.fill(); }   // stín jen když stojí na plošině
    ctx.scale(ds, ds); ctx.rotate(tilt); ctx.transform(1, 0, sway, 1, 0, 0); ctx.scale(sx * (flip ? -1 : 1), sy);
    if (pl.cloak > 0) {                                                                // duch: poloprůhledná, třpytí se
      const cl = pl.cloak, fade = cl < 2 ? (Math.floor(cl * 8) % 2 ? 0.28 : 0.6) : 0.55;
      ctx.globalAlpha = fade; ctx.shadowColor = 'rgba(190,210,255,.95)'; ctx.shadowBlur = 16;
    }
    if (frames) blendDraw(ctx, frames, ph, frames === climb ? 1 : 0.78);
    else if (ok(still)) { const w = (still.ow || still.width) * PK, h = (still.oh || still.height) * PK; ctx.drawImage(still, -w / 2, -h, w, h); }
    ctx.restore();
    if (pl.cloak > 0) {                                                                // duha ducha okolo princezny
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let q = 0; q < 6; q++) { const a = t * 2.4 + q * 1.05; sparkle(ctx, pl.x + Math.cos(a) * 22, pl.y - 30 + Math.sin(a * 1.3) * 26, 2.5, 0.8); }
      ctx.restore();
    }
  }

  /* princezna sedí na jednorožci: jednorožec se kreslí PŘED ní, ona je posazená na jeho hřbetě (kreslí se po něm zmenšená) */
  function drawMount(ctx, pl, t, front) {
    if (!(pl.mount > 0)) return;
    const moving = Math.abs(pl.vx + (pl.carry || 0)) > 30 && pl.onGround, air = !pl.onGround;
    pl.mountPh = (pl.mountPh || 0) + (moving ? 0.095 : 0);
    const idx = air ? (pl.vy < -80 ? 0 : pl.vy > 140 ? 4 : 2) : (moving ? Math.floor(pl.mountPh * 3.0) % 6 : -1);
    const im = idx < 0 ? IMG.uni_stand : IMG['uni_' + idx]; if (!ok(im)) return;
    const h = 104, w = h * im.width / im.height, dir = pl.facing < 0 ? -1 : 1;
    const bob = idx < 0 ? Math.sin(t * 2.2) * 1.2 : (air ? 0 : Math.abs(Math.sin(pl.mountPh * 3.2)) * 2.2);
    const warn = pl.mount < 2.2 && Math.floor(pl.mount * 7) % 2;
    ctx.save(); ctx.translate(pl.x, pl.y + 4 - bob); if (dir < 0) ctx.scale(-1, 1);
    if (pl.onGround) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, bob, w * 0.30, 6, 0, 0, 7); ctx.fill(); }
    ctx.globalAlpha = warn ? 0.45 : 1; ctx.drawImage(im, -w * 0.52, -h * (idx < 0 ? 1.0 : 0.97), w, h); ctx.restore();
    if (!front && !(idx < 0 && false)) {
      for (let q = 0; q < 3; q++) { const k = ((t * 1.7 + q * 0.33) % 1); sparkle(ctx, pl.x - dir * (20 + k * 46), pl.y - 22 - k * 16 - q * 4, 1.8 + (1 - k) * 2.6, (1 - k) * 0.9); }
    }
  }
  /* hořící potvora: bliká, tmavne a plameny šlehají nahoru; na konci zmizí (zbude ohořelý flek) */
  function drawEnemyBurning(ctx, e, t) {
    if (!e.burn || e.burn.t <= 0) return drawEnemy(ctx, e);
    const b = e.burn.t, k = Math.min(1, b / 1.15), blink = Math.floor(b * (9 + k * 14)) % 2;
    ctx.save(); ctx.globalAlpha = blink ? 0.35 : 1 - k * 0.45; drawEnemy(ctx, e); ctx.restore();
    const ex = e.x, ey = e.y - 22;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {
      const u = ((b * 2.4 + i / 12) % 1), x = ex + Math.sin(i * 7.3 + b * 9) * 18 * (0.5 + u), y = ey + 18 - u * 62, r = (7 + (1 - u) * 15) * (1 - k * 0.5);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,' + Math.round(240 - u * 130) + ',' + Math.round(150 - u * 120) + ',' + (0.8 * (1 - u * 0.5)) + ')');
      g.addColorStop(0.55, 'rgba(255,110,25,' + (0.4 * (1 - u)) + ')'); g.addColorStop(1, 'rgba(180,40,10,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  }
  function pickFrame(name, i) { return IMG[name + '_' + i]; }
  function drawEnemy(ctx, e) {
    let img, k, y = e.y, sq = 1, sqx = 1;
    if (e.type === 'walker') {
      // chůze: 8 snímků, rychlost podle skutečné rychlosti chůze; pozvolné prolnutí sousedních snímků
      const ph = (e.t * e.speed / 62) % 8, i0 = Math.floor(ph), f = ph - i0;
      img = pickFrame('walker', i0); k = 0.5;
      const nx = pickFrame('walker', (i0 + 1) % 8);
      if (ok(img)) {
        const w = img.width * k, h = img.height * k;
        ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, w * 0.36, 6, 0, 0, 7); ctx.fill();
        ctx.save(); ctx.translate(e.x, y + 4); if (e.facing < 0) ctx.scale(-1, 1);
        ctx.drawImage(img, -w / 2, -h, w, h);
        if (f > 0.7 && ok(nx)) { ctx.globalAlpha = (f - 0.7) / 0.3; ctx.drawImage(nx, -nx.width * k / 2, -nx.height * k, nx.width * k, nx.height * k); ctx.globalAlpha = 1; }
        ctx.restore();
      }
      return;
    }
    if (e.type === 'hopper') {
      k = 0.4; y += e.jy;
      let fi;
      if (!e.air) fi = e.land > 0 ? 5 : e.wait < 0.22 ? 0 : 2;
      else fi = e.vy < -260 ? 1 : e.vy < -70 ? 2 : e.vy < 70 ? 3 : 4;
      img = pickFrame('hopper', fi);
    } else {
      // nafukovač: velikost určuje skutečné nafouknutí; snímky jsou už nakreslené ve správných velikostech
      k = 0.42; const s = e.size; let fi;
      if (e.phase === 'small') fi = (Math.floor(e.t * 1.7) % 6 === 0) ? 1 : 0;
      else if (e.phase === 'grow') fi = s < 0.34 ? 2 : s < 0.67 ? 3 : 4;
      else if (e.phase === 'big') fi = Math.floor(e.t * 4) % 2 ? 5 : 4;
      else fi = s > 0.5 ? 6 : 7;
      img = pickFrame('puffer', fi);
    }
    if (!ok(img)) return;
    const w = img.width * k, h = img.height * k;
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(e.x, e.y + 2, Math.min(w, 110) * 0.38, 6, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(e.x, y + 4);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  function drawHUD(ctx, game) {
    const pl = game.player, L = game.level, pw = IMG['ui/panel_wide'];
    const panel = (x, y, w, h) => { if (ok(pw)) ctx.drawImage(pw, x, y, w, h); else { ctx.fillStyle = 'rgba(60,40,20,.7)'; ctx.fillRect(x, y, w, h); } };
    // životy
    panel(10, 8, 214, 64);
    const hf = IMG['ui/heart_full'], he = IMG['ui/heart_empty'];
    for (let i = 0; i < C.LIVES; i++) {
      const im = i < pl.lives ? hf : he; if (!ok(im)) continue;
      const beat = i < pl.lives ? 1 + Math.sin(game.t * 5 + i) * 0.04 : 1, w = 42 * beat, h = w * im.height / im.width;
      ctx.drawImage(im, 43 + i * 50 - w / 2, 40 - h / 2, w, h);
    }
    // bonbony
    const cx = C.VW / 2 - 118; panel(cx, 8, 236, 64);
    const ci = IMG['candy_1'];
    if (ok(ci)) { const h = 38, w = h * ci.width / ci.height; ctx.drawImage(ci, cx + 40 - w / 2, 40 - h / 2, w, h); }
    ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = 'bold 28px Georgia, "Times New Roman", serif'; ctx.fillStyle = '#5a3417';
    ctx.fillText(pl.candies + ' / ' + L.candyTotal, cx + 72, 38);
    ctx.font = 'bold 12px Georgia, serif'; ctx.fillStyle = pl.candies >= L.need ? '#2a8a3a' : '#8a5a2a';
    ctx.fillText(pl.candies >= L.need ? 'portál otevřen!' : 'portál: ' + L.need, cx + 73, 58);
    ctx.restore();
    // oznámení o dračím ohni
    if (L.toast) {
      const tt = L.toast.t, a = Math.min(1, tt / 0.3, (3.6 - tt) / 0.6);
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 26px Georgia, serif'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(90,25,10,.8)'; ctx.fillStyle = '#ffe9b0';
      ctx.strokeText('🔥 ' + L.toast.text, C.VW / 2, 124 - (1 - Math.min(1, tt / 0.3)) * 10); ctx.fillText('🔥 ' + L.toast.text, C.VW / 2, 124 - (1 - Math.min(1, tt / 0.3)) * 10); ctx.restore();
    }
    // zbývající čas pomocníka (jednorožec / duch)
    const hp = pl.mount > 0 ? [pl.mount / (pl.mountMax || 11), '#ff8fd8', '#ffd36a'] : pl.cloak > 0 ? [pl.cloak / (pl.cloakMax || 10), '#9fc4ff', '#e8f0ff'] : null;
    if (hp) {
      const bw = 200, bx = C.VW / 2 - bw / 2, by = 84;
      ctx.save(); ctx.fillStyle = 'rgba(40,20,50,.55)'; ctx.fillRect(bx - 2, by - 2, bw + 4, 12);
      const gg = ctx.createLinearGradient(bx, 0, bx + bw, 0); gg.addColorStop(0, hp[1]); gg.addColorStop(1, hp[2]);
      ctx.globalAlpha = (hp[0] < 0.2 && Math.floor(game.t * 6) % 2) ? 0.4 : 1; ctx.fillStyle = gg; ctx.fillRect(bx, by, bw * Math.max(0, hp[0]), 8); ctx.restore();
    }
    // název levelu na začátku
    if (game.titleT > 0) {
      const a = Math.max(0, Math.min(1, game.titleT / 0.9, (4.5 - game.titleT) / 0.5));
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 34px Georgia, serif'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(70,20,60,.75)'; ctx.fillStyle = '#fff';
      ctx.strokeText(L.name, C.VW / 2, 128); ctx.fillText(L.name, C.VW / 2, 128);
      ctx.font = 'bold 19px Georgia, serif'; ctx.lineWidth = 4;
      const sub = (L.label ? L.label + ' · ' : '') + 'sbírej ' + L.need + ' bonbonů';
      ctx.strokeText(sub, C.VW / 2, 160); ctx.fillText(sub, C.VW / 2, 160); ctx.restore();
    }
  }

    G.Render = { drawFx, drawEnemyBurning, drawMount, drawScorch, drawOverlay, drawSeesawFront, loadAll, drawDecor, drawBackground: drawSky, drawPlatform, drawLadder, drawCandy, drawPortal, drawPrincess, drawEnemy, drawHUD, IMG };
})(window.G);
