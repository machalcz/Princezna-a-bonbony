/* Nepřátelé: walker (chodí), hopper (skáče 1–2 bloky), puffer (nafukuje se na 2 bloky). */
(function (G) {
  const C = G.C, BS = C.BS;

  G.makeEnemy = function (d) {
    const e = { type: d.type, t: Math.random() * 3, dir: 1, vy: 0, jy: 0, facing: 1 };
    if (d.type === 'walker') {
      e.x0 = d.x0 * BS; e.x1 = d.x1 * BS; e.x = (e.x0 + e.x1) / 2; e.y = d.y * BS;
      e.speed = 62; e.w = 62; e.h = 44;
    } else if (d.type === 'hopper') {
      e.x = d.x * BS; e.y = d.y * BS;
      e.w = 50; e.h = 52; e.wait = 0.6 + Math.random(); e.air = false; e.land = 0;
    } else if (d.type === 'puffer') {
      e.x = d.x * BS; e.y = d.y * BS; e.size = 0; e.phase = 'small'; e.timer = 1.5 + Math.random();
      e.w = 50; e.h = 50;
    }
    return e;
  };

  G.updateEnemy = function (e, dt) {
    e.t += dt;
    if (e.type === 'walker') {
      e.x += e.dir * e.speed * dt;
      if (e.x > e.x1) { e.x = e.x1; e.dir = -1; }
      if (e.x < e.x0) { e.x = e.x0; e.dir = 1; }
      e.facing = e.dir;
      e.frame = Math.floor(e.t * 8) % 4;
    } else if (e.type === 'hopper') {
      /* skáče jen na místě, 1 až 2 bloky */
      if (e.land > 0) e.land -= dt;
      if (!e.air) {
        e.wait -= dt; e.frame = e.land > 0 ? 3 : 0;
        if (e.wait <= 0) {
          const h = 1.15 + Math.random() * 0.9;
          e.vy = -Math.sqrt(2 * C.GRAV * h * BS);
          e.air = true; e.jy = 0;
        }
      } else {
        e.vy += C.GRAV * dt; e.jy += e.vy * dt;
        e.frame = e.vy < -200 ? 1 : 2;
        if (e.jy >= 0) { e.jy = 0; e.air = false; e.wait = 0.5 + Math.random() * 0.9; e.land = 0.15; e.frame = 3; }
      }
    } else if (e.type === 'puffer') {
      e.timer -= dt;
      if (e.phase === 'small') { e.size = Math.max(0, e.size - dt * 2); if (e.timer <= 0) { e.phase = 'grow'; e.timer = 0.6; } }
      else if (e.phase === 'grow') { e.size = Math.min(1, e.size + dt / 0.6); if (e.timer <= 0) { e.phase = 'big'; e.timer = 2.0; } }
      else if (e.phase === 'big') { e.size = 1; if (e.timer <= 0) { e.phase = 'shrink'; e.timer = 0.6; } }
      else if (e.phase === 'shrink') { e.size = Math.max(0, e.size - dt / 0.6); if (e.timer <= 0) { e.phase = 'small'; e.timer = 2.0; } }
    }
  };

  /* Nepřátelský hitbox (trochu menší než sprite, aby byl zásah férový). */
  G.enemyRect = function (e) {
    if (e.type === 'puffer') {
      const h = 64 + 64 * e.size, w = h * 0.92;
      return { x: e.x - w / 2 + 4, y: e.y - h + 6, w: w - 8, h: h - 8 };
    }
    return { x: e.x - e.w / 2 + 4, y: e.y + e.jy - e.h, w: e.w - 8, h: e.h - 6 };
  };
})(window.G);
