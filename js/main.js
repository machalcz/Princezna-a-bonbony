/* Herní smyčka, stavy (menu / hra / pauza / konec), kamera, kolize s nepřáteli. */
(function (G) {
  const C = G.C, BS = C.BS, R = G.Render;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const msgEl = document.getElementById('msg');

  let acc = 0;
  const game = { state: 'loading', level: null, player: null, cam: { x: 0, y: 0 }, t: 0, shake: 0 };
  G.game = game; G._start = def => startLevel(def);

  function resize() {
    const w = innerWidth, h = innerHeight;
    const s = Math.min(w / C.VW, h / C.VH);
    const dev = window.devicePixelRatio || 1, fit = Math.sqrt(5.2e6 / (C.VW * s * C.VH * s));   // plátno max. ~5 Mpx kvůli plynulosti
    const dpr = Math.max(1, Math.min(dev, 3, fit));
    canvas.style.width = C.VW * s + 'px'; canvas.style.height = C.VH * s + 'px';
    canvas.width = Math.round(C.VW * s * dpr); canvas.height = Math.round(C.VH * s * dpr);
    game.scale = s * dpr;
  }
  addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));

  function showMsg(html) { msgEl.innerHTML = html || ''; msgEl.style.display = html ? 'flex' : 'none'; }

  function startLevel(def) {
    game.def = def; game.level = G.Level.build(def);
    game.player = new G.Player(game.level);
    const pl = game.player;
    game.cam.x = pl.x - C.VW / 2; game.cam.y = pl.y - C.VH * 0.62;
    game.titleT = 4.5; acc = 0; G.Env.reset(); game.level.lt = 0; if (G.Audio && G.Audio.rain) G.Audio.rain(0);
    clampCam(); game.state = 'play'; showMsg('');
  }
  /* nový náhodný level: generátor ověří průchodnost simulací, trvá zlomek sekundy až zhruba sekundu */
  function newLevel() {
    if (game.state === 'gen' || game.state === 'loading') return;
    game.state = 'gen';
    showMsg('<div class="card gen"><div class="rib" style="background-image:url(' + UI('ribbon') + ')"><span>Nový level</span></div><img class="crown" src="' + UI('crown') + '" alt=""><div class="body"><p><span class="spin">✨</span></p><p class="hint">Vymýšlím novou cestu k portálu…</p></div></div>');
    setTimeout(() => { startLevel(G.Gen.generate({ avoid: game.def && game.def.theme })); }, 40);
  }
  function retryLevel() { if (game.def && game.state !== 'gen') startLevel(game.def); }

  function clampCam() {
    const L = game.level, c = game.cam;
    c.x = Math.max(0, Math.min(L.pxW - C.VW, c.x));
    c.y = Math.max(0, Math.min(L.pxH - C.VH, c.y));
  }

  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  function updateWorld(dt, inp) {
    const L = game.level, pl = game.player;
    L.lt += dt; G.Env.update(dt, L, L.lt); G.Events.update(L, L.lt, game.cam, dt, pl);
    pl.step(dt, inp);
    // animační fáze (nezávislé na fyzice)
    const sp = Math.abs(pl.vx + (pl.carry || 0));
    const onIce = pl.ground && pl.ground.type === 'ice', onSticky = pl.ground && pl.ground.type === 'sticky';
    let wr = 3.2 + sp / 300 * 4.6;                                  // snímků za sekundu (6 výrazných póz, pomalejší krok)
    if (onIce) wr = inp.x !== 0 ? 6.5 : 0; else if (onSticky) wr *= 0.85;
    if (pl.onGround && (sp > 15 || (onIce && inp.x !== 0))) pl.walkPh = (pl.walkPh + dt * wr) % 6;
    else if (pl.onGround && !(onIce && sp > 15)) pl.walkPh = 0;
    // klouzání po ledu: když princezna jede, ale nepřidává, nebo se otáčí
    const vxT = pl.vx + (pl.carry || 0);
    const slipping = onIce && pl.onGround && Math.abs(vxT) > 40 && (inp.x === 0 || Math.sign(inp.x) !== Math.sign(vxT));
    if (slipping) { pl.slipT = (pl.slipT || 0) + dt; pl.slipHold = 0.15; pl.slipDir = Math.sign(vxT); }
    else if (pl.slipT > 0) { pl.slipHold -= dt; if (pl.slipHold <= 0) { pl.slipT = 0; pl.recT = onIce ? 0.35 : 0; } }
    if (pl.recT > 0) pl.recT -= dt;
    // houpačka: míra "vyvažování" podle toho, jak se nosník pohybuje a jak je nakloněný
    if (pl.ground && pl.ground.type === 'wood') {
      const w = pl.ground, dT = (w.tilt - (pl.lastTilt == null ? w.tilt : pl.lastTilt)) / dt; pl.lastTilt = w.tilt;
      const target = Math.min(1, Math.abs(dT) * 2.2 + Math.abs(w.tilt) * 1.6);
      pl.balAct = (pl.balAct || 0) + (target - (pl.balAct || 0)) * Math.min(1, dt * 6);
    } else { pl.balAct = 0; pl.lastTilt = null; }
    // lezení: fáze animace závisí jen na ušlé vzdálenosti po žebříku (1 póza = 34 px). Když hráč nic nemačká,
    // princezna zůstane v aktuální póze – nic se neresetuje ani neprolíná.
    if (pl.climbing) {
      if (!pl.wasClimbing) pl.climbPh = 1;                       // nalezení na žebřík: klidná póza
      pl.climbPh = ((pl.climbPh - inp.y * C.CLIMB * dt / 34) % 4 + 4) % 4;
    }
    pl.wasClimbing = !!pl.climbing;
    // optická hloubka: doprava mírně dopředu, doleva mírně dozadu, ve stoje na střed
    const dT = (pl.onGround || pl.climbing) ? ((sp > 15 && !pl.climbing) ? Math.sign(pl.vx + (pl.carry || 0) || pl.facing) : 0) : (pl.depth || 0);
    pl.depth = (pl.depth || 0) + (dT - (pl.depth || 0)) * Math.min(1, dt * 5);
    pl.blinkT -= dt;
    if (pl.blinkT <= 0) { pl.blinking = 0.13; pl.blinkT = 2 + Math.random() * 3; }
    if (pl.blinking > 0) pl.blinking -= dt;

    // houpačka: naklání se podle polohy princezny; bez ní se vrací do roviny
    for (const p of L.platforms) {
      if (p.type === 'wood') {
        let target = 0;
        if (pl.ground === p) target = Math.max(-1, Math.min(1, (pl.x - p.cx) / (p.pw / 2))) * 0.30;
        p.tilt += (target - p.tilt) * Math.min(1, dt * 8);
      }
      if (p.bounce > 0) p.bounce = Math.max(0, p.bounce - dt * 4);
    }
    // pád do propasti: dno je tráva, ale pro jistotu
    if (pl.y > L.pxH + 200) { pl.lives = 0; }

    for (const c of L.candies) {
      if (c.got) continue;
      if (Math.hypot(c.x - pl.x, c.y - (pl.y - 30)) < 36) { c.got = true; pl.candies++; if (G.Audio) G.Audio.candy(c.kind); if (c.magic) G.Events.collect(L, pl, c); }
    }
    const wasOpen = L.portal.open;
    L.portal.open = pl.candies >= L.need;
    if (L.portal.open && !wasOpen && G.Audio) G.Audio.portal();

    const pr = pl.rect();
    for (const e of L.enemies) {
      if (!(e.burn && e.burn.t > 0)) G.updateEnemy(e, dt);
      if (!e.burn && overlap(pr, G.enemyRect(e)) && pl.hurt(e.x)) { game.shake = 0.25; if (G.Audio && pl.lives > 0) G.Audio.hurt(); }
    }

    // portál
    const po = L.portal;
    if (po.open && Math.abs(pl.x - po.x) < 36 && Math.abs(pl.y - po.y) < 70) { game.state = 'won'; if (G.Audio) G.Audio.win(); showWin(pl, L); }
    if (pl.lives <= 0 && game.state === 'play') { game.state = 'dead'; if (G.Audio) G.Audio.dead(); showDead(); }

    // kamera: plynule za princeznou, s předstihem ve směru běhu
    const tx = pl.x + pl.facing * 60 - C.VW / 2, ty = pl.y - C.VH * 0.58;
    game.cam.x += (tx - game.cam.x) * Math.min(1, dt * 5);
    game.cam.y += (ty - game.cam.y) * Math.min(1, dt * 6);
    clampCam();
  }

  function render() {
    const L = game.level;
    ctx.setTransform(game.scale, 0, 0, game.scale, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';   // kvalitní zmenšování (princezna i potvory se zmenšují 4–8×)
    if (!L) { ctx.fillStyle = '#123'; ctx.fillRect(0, 0, C.VW, C.VH); return; }
    const cam = game.cam;
    let sx = 0, sy = 0;
    if (game.shake > 0) { sx = (Math.random() - .5) * 8 * game.shake * 4; sy = (Math.random() - .5) * 8 * game.shake * 4; }
    R.drawBackground(ctx, cam, L, game.t);
    ctx.save(); ctx.translate(-Math.round(cam.x) + sx, -Math.round(cam.y) + sy);
    const view = { l: cam.x - 100, r: cam.x + C.VW + 100, t: cam.y - 200, b: cam.y + C.VH + 200 };
    for (const d of L.decor) if (!d.front && d.x > view.l - 200 && d.x < view.r + 200) R.drawDecor(ctx, d, game.t);
    R.drawPortal(ctx, L.portal, game.t, L.need, game.player.candies);
    for (const p of L.platforms) if (p.type !== 'wood' && p.px < view.r && p.px + p.pw > view.l) R.drawPlatform(ctx, p, game.t);
    for (const l of L.ladders) R.drawLadder(ctx, l);
    for (const p of L.platforms) if (p.type === 'wood' && p.px < view.r && p.px + p.pw > view.l) R.drawPlatform(ctx, p, game.t);   // houpačky se sloupem až před rovinou plošin
    L.candies.forEach((c, i) => { if (!c.got) R.drawCandy(ctx, c, game.t, i); });
    for (const sc of L.scorch) R.drawScorch(ctx, sc);
    for (const f of (L.fx || [])) if (f.k === 'uniaway') R.drawFx(ctx, f, game.t);
    for (const e of L.enemies) R.drawEnemyBurning(ctx, e, game.t);
    R.drawPrincess(ctx, game.player, game.t);
    if (game.player.mount > 0) R.drawMount(ctx, game.player, game.t, false);
    for (const f of (L.fx || [])) if (f.k === 'burst') R.drawFx(ctx, f, game.t);   // jednorožec před princeznou: zakryje jí nohy, sedí na hřbetě
    for (const p of L.platforms) if (p.type === 'wood' && p.px < view.r && p.px + p.pw > view.l) R.drawSeesawFront(ctx, p);   // sloup houpačky před princeznou
    for (const d of L.decor) if (d.front && d.x > view.l - 200 && d.x < view.r + 200) R.drawDecor(ctx, d, game.t);
    ctx.restore();
    R.drawOverlay(ctx, L, cam, game.t);
    if (G.Audio && G.Audio.rain) G.Audio.rain(game.state === 'play' ? G.Env.cur.rain : 0);
    R.drawHUD(ctx, game);
  }

  /* pevný krok 120 Hz => stejné chování na 60 i 120 Hz displeji iPadu */
  const STEP = 1 / 120;
  let last = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const now = ts / 1000; let dt = Math.min(0.1, now - last); last = now;
    const inp = G.Input.poll();
    game.t += dt;
    if (game.shake > 0) game.shake -= dt;

    if (game.titleT > 0) game.titleT -= dt;
    if (inp.pressed.newlvl && ['play', 'pause', 'menu', 'won', 'dead'].includes(game.state)) newLevel();
    const portrait = innerHeight > innerWidth * 1.05;
    if (game.state === 'play' && (document.hidden || portrait)) { game.state = 'pause'; showPause(); }
    if (game.state === 'play') {
      if (inp.pressed.pause) { game.state = 'pause'; showPause(); }
      else {
        acc += dt; let first = true;
        while (acc >= STEP) {
          const i2 = first ? inp : Object.assign({}, inp, { jumpPressed: false });
          first = false; updateWorld(STEP, i2); acc -= STEP;
          if (game.state !== 'play') break;
        }
      }
    } else if (game.state === 'pause') {
      if (inp.pressed.pause && !portrait) { game.state = 'play'; showMsg(''); }
    } else if (game.state === 'menu' || game.state === 'won' || game.state === 'dead') {
      if (game.t - (game.lockT || 0) > 0.7) {
        const go = inp.pressed.confirm || inp.pressed.jump;
        if (game.state === 'dead') { if (go) retryLevel(); else if (inp.pressed.alt) newLevel(); }
        else if (game.state === 'won') { if (go) newLevel(); else if (inp.pressed.alt) retryLevel(); }
        else if (go) newLevel();
      }
    }
    render();
  }

  const UI = n => 'assets/ui/' + n + '.webp';
  const stars = n => [0, 1, 2].map(i => '<img class="star" src="' + UI(i < n ? 'star_full' : 'star_empty') + '" alt="">').join('');
  function card(title, body, btns, extra) {
    const bs = [].concat(btns).map(b => (typeof b === 'string' ? { label: b, act: 'main', main: true } : b));
    return '<div class="card"><div class="rib" style="background-image:url(' + UI('ribbon') + ')"><span>' + title + '</span></div>' +
      '<img class="crown" src="' + UI('crown') + '" alt="">' + (extra || '') + '<div class="body">' + body + '</div>' +
      '<div class="btns' + (bs.length > 1 ? ' two' : '') + '">' + bs.map(b => '<div class="play' + (b.main ? ' main' : '') + '" data-act="' + b.act + '" style="background-image:url(' + UI('btn_play') + ')"><span>' + b.label + '</span></div>').join('') + '</div></div>';
  }
  function showMenu() {
    game.state = 'menu'; game.lockT = -100;
    showMsg(card('Princezna a bonbony',
      '<p>Seber dost <b>bonbonů</b>, otevři krystalový portál a doskákej k němu. Každý level je nový a pokaždé jinak složitý.</p>' +
      '<p class="hint"><b>Dotyk:</b> tlačítka na obrazovce<br><b>Klávesnice:</b> ← → nebo A D, ↑ ↓ žebřík, mezerník skok (delší stisk = výš), <b>N</b> nový level, <b>R</b> opakovat<br><b>DualSense:</b> páčka nebo D-pad, ✕ skok, Options pauza, ◯ opakovat<br><b>🎲</b> nahoře vždy vygeneruje nový level · <b>M</b> zvuk</p>',
      { label: 'HRÁT', act: 'new', main: true }));
  }
  function levelTag(L) { return L.name + (L.label ? ' · ' + L.label : ''); }
  function showWin(pl, L) {
    game.lockT = game.t; game.titleT = 0;
    const r = pl.candies / L.candyTotal, n = r >= 0.8 ? 3 : r >= 0.5 ? 2 : 1;
    showMsg(card('Portál!', '<div class="stars">' + stars(n) + '</div><p>Sebráno bonbonů: <b>' + pl.candies + ' / ' + L.candyTotal + '</b></p><p class="hint">' + levelTag(L) + ' · zbylé životy: ' + pl.lives + ' ❤</p>',
      [{ label: 'NOVÝ LEVEL', act: 'new', main: true }, { label: 'OPAKOVAT', act: 'retry' }]));
  }
  function showDead() {
    game.lockT = game.t; game.titleT = 0;
    showMsg(card('Konec hry', '<p>Princezně došly životy.</p><p class="hint">Zkusit stejný level znovu, nebo dostat nový?</p>',
      [{ label: 'OPAKOVAT', act: 'retry', main: true }, { label: 'NOVÝ LEVEL', act: 'new' }]));
  }
  function showPause() {
    showMsg(card('Pauza', '<p class="hint">Esc / Options / ❚❚ pro pokračování</p>',
      [{ label: 'POKRAČOVAT', act: 'resume', main: true }, { label: 'NOVÝ LEVEL', act: 'new' }]));
  }
  // klepnutí na tlačítka na kartě (dotyk i myš)
  msgEl.addEventListener('pointerdown', e => {
    G.Input.touched();
    const el = e.target.closest ? e.target.closest('[data-act]') : null, act = el ? el.dataset.act : null;
    const portraitNow = innerHeight > innerWidth * 1.05;
    if (game.state === 'pause') { if (act === 'new') newLevel(); else if ((act === 'resume' || !act) && !portraitNow) { game.state = 'play'; showMsg(''); } return; }
    if (!['menu', 'won', 'dead'].includes(game.state) || game.t - (game.lockT || 0) < 0.5) return;
    if (act === 'new' || (game.state === 'menu' && !act)) newLevel(); else if (act === 'retry') retryLevel();
  });
  const bNew = document.getElementById('bNew');
  if (bNew) bNew.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); G.Input.touched(); newLevel(); });

  resize();
  R.loadAll().then(() => { showMenu(); requestAnimationFrame(frame); });
})(window.G);
