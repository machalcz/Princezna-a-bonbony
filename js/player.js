/* Princezna: pohyb, skok, kolize s plošinami, žebříky. Pevný krok simulace. */
(function (G) {
  const C = G.C, BS = C.BS;
  const HALF = C.PW / 2;

  const vFor = h => Math.sqrt(2 * C.GRAV * h * BS);   // počáteční rychlost pro výšku v blocích

  /* y povrchu plošiny v dané x-ové souřadnici (houpačka je šikmá) */
  function surfaceY(p, x) {
    if (p.type === 'wood') return p.py + (x - p.cx) * Math.tan(p.tilt);
    return p.py;
  }

  function Player(level) {
    this.reset(level);
  }

  Player.prototype.reset = function (level) {
    this.level = level;
    this.x = level.start.x; this.y = level.start.y;
    this.vx = 0; this.vy = 0;
    this.carry = 0;           // unášení pásem
    this.onGround = false; this.ground = null;
    this.coyote = 0; this.jumpBuf = 0;
    this.jumping = false;
    this.climbing = null;
    this.facing = 1;
    this.lives = C.LIVES; this.invuln = 0; this.stun = 0; this.mount = 0; this.mountT = 0; this.cloak = 0; this.cloakT = 0;
    this.walkPh = 0; this.blinkT = 2.5; this.blinking = 0; this.climbPh = 0;
    this.landT = 0; this.airT = 0; this.trampAir = false; this.inX = 0;
    this.apexY = this.y; this.fear = false; this.crash = null; this.stickyAir = false;
    this.candies = 0;
    this.anim = 0; this.squash = 0;
    this.jumpV = vFor(C.JUMP_H);
  };

  Player.prototype.findLadder = function (wantUp, wantDown) {
    for (const l of this.level.ladders) {
      if (Math.abs(this.x - l.cx) > 38) continue;
      if (wantUp && this.y > l.top + 2 && this.y <= l.bot + 6) return l;
      if (wantDown && this.y >= l.top - 4 && this.y < l.bot - 2) return l;
    }
    return null;
  };

  Player.prototype.jump = function (h) {
    this.vy = -vFor(h);
    this.onGround = false; this.ground = null;
    this.coyote = 0; this.jumpBuf = 0;
    this.jumping = true;
    this.carry = 0;
    this.squash = -0.12;
    this.airT = 0;
    if (G.Audio) G.Audio.jump();
  };

  Player.prototype.step = function (dt, inp) {
    const L = this.level;
    /* pád z velké výšky: po dopadu se princezna složí, posadí a oprášení (lze přerušit pohybem) */
    if (this.crash) {
      this.crash.t += dt;
      const T = this.crash.t, wants = inp.x !== 0 || inp.y !== 0 || inp.jumpPressed;
      if ((T >= 0.65 && wants) || T >= 1.25) this.crash = null;
      else inp = { x: 0, y: 0, jump: false, jumpPressed: false };
    }
    if (this.onGround || this.climbing) this.apexY = this.y; else this.apexY = Math.min(this.apexY, this.y);
    const fearNow = !this.onGround && !this.climbing && this.vy > 0 && (this.y - this.apexY) > C.FEAR_H * BS && !(this.mount > 0);
    if (fearNow && !this.fear && G.Audio) G.Audio.fear();
    this.fear = fearNow;
    if (this.invuln > 0) this.invuln -= dt;
    this.anim += dt;
    if (this.landT > 0) this.landT -= dt;
    this.airT = (this.onGround || this.climbing) ? 0 : this.airT + dt;
    this.inX = inp.x;
    if (this.squash) this.squash += (0 - this.squash) * Math.min(1, dt * 12);

    if (inp.jumpPressed) this.jumpBuf = 0.12;
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.coyote = Math.max(0, this.coyote - dt);

    /* ---------- žebřík ---------- */
    if (!this.climbing && (inp.y !== 0)) {
      const l = this.findLadder(inp.y < 0, inp.y > 0);
      if (l) { this.climbing = l; this.vx = 0; this.vy = 0; this.carry = 0; this.onGround = false; this.ground = null; this.jumping = false; }
    }
    if (this.climbing) {
      const l = this.climbing;
      this.x += (l.cx - this.x) * Math.min(1, dt * 20);
      this.y += inp.y * C.CLIMB * dt;
      this.vx = 0; this.vy = 0;
      if (this.y <= l.top) {                          // nahoře: vystoupit
        this.y = l.top; this.climbing = null; this.onGround = true; this.coyote = 0.1;
        this.ground = L.platforms.find(p => p.type === 'ladderTop' && p.py === l.top);
        return;
      }
      if (this.y >= l.bot) { this.y = l.bot; this.climbing = null; this.onGround = true; this.coyote = 0.1; return; }
      if (inp.jumpPressed) { this.climbing = null; this.vx = inp.x * C.RUN; this.jump(C.JUMP_H * 0.7); }
      return;
    }

    /* ---------- vodorovný pohyb ----------
       Ve vzduchu se princezna ovládá stejně jako na zemi (žádné zrychlení ani klouzání),
       jen led má na zemi kluzkou dynamiku. Po zásahu je krátce bez ovládání (odskok). */
    const g = this.ground, onG = this.onGround;
    const type = onG && g ? g.type : null;
    if (this.stun > 0) this.stun -= dt;
    else {
      let acc = C.GACC, fric = C.GFRIC, runMax = C.RUN;
      if (type === 'ice') { acc = C.ICE_ACC; fric = C.ICE_FRIC; }
      else if (type === 'sticky') { acc = C.STICKY_ACC; runMax = C.STICKY_RUN; }          // sliz: pomalá chůze
      else if (this.stickyAir && !onG) runMax = C.STICKY_AIR;                              // po skoku ze slizu letí pomalu
      if (this.mount > 0 && type !== 'sticky' && type !== 'ice' && !this.stickyAir) runMax *= 1.45;   // na jednorožci běží rychleji
      if (inp.x !== 0) {
        this.facing = inp.x;
        const turning = Math.sign(this.vx) !== inp.x && this.vx !== 0 && type !== 'ice';
        this.vx += inp.x * (turning ? acc + fric : acc) * dt;
        if (Math.abs(this.vx) > runMax) this.vx = Math.sign(this.vx) * Math.max(runMax, Math.abs(this.vx) - fric * dt);
      } else {
        const d = fric * dt;
        this.vx = Math.abs(this.vx) <= d ? 0 : this.vx - Math.sign(this.vx) * d;
      }
    }

    this.carry = (onG && type === 'belt') ? g.dir * C.BELT : 0;
    this.x += (this.vx + this.carry) * dt;
    this.x = Math.max(HALF, Math.min(L.pxW - HALF, this.x));

    // boční kolize s pevnými plošinami (tráva, kámen)
    for (const p of L.platforms) {
      if (!p.solid) continue;
      const top = p.py, bot = p.py + p.th;
      if (this.y <= top + 0.5 || this.y - C.PH >= bot) continue;
      if (this.x + HALF <= p.px || this.x - HALF >= p.px + p.pw) continue;
      const fromLeft = (this.x < p.px + p.pw / 2);
      this.x = fromLeft ? p.px - HALF : p.px + p.pw + HALF;
      this.vx = 0;
    }

    /* ---------- skok ---------- */
    const canJump = this.onGround || this.coyote > 0;
    if (this.jumpBuf > 0 && canJump) {
      const stick = this.ground && this.ground.type === 'sticky';
      this.jump(stick ? C.STICKY_H : C.JUMP_H * (this.mount > 0 ? 1.3 : 1));
      this.jumpV = Math.abs(this.vy);
      this.stickyAir = !!stick;
    }
    // proměnná výška skoku: puštění tlačítka ořízne stoupání
    if (this.jumping && !inp.jump && this.vy < 0) {
      const minV = vFor(C.JUMP_MIN) * (this.jumpV / vFor(C.JUMP_H));
      if (this.vy < -minV) this.vy = -minV;
      this.jumping = false;
    }

    /* ---------- svislý pohyb ---------- */
    this.vy = Math.min(C.MAXFALL * 1.0, this.vy + C.GRAV * dt);
    const prevY = this.y;
    let newY = this.y + this.vy * dt;
    const wasG = this.onGround, g0 = this.ground;
    this.onGround = false; this.ground = null;

    if (this.vy >= 0) {
      let best = null, bestY = Infinity;
      for (const p of L.platforms) {
        if (this.x + HALF * 0.8 <= p.px || this.x - HALF * 0.8 >= p.px + p.pw) continue;
        const sy = surfaceY(p, this.x);
        const tol = wasG ? 14 : 0.5;                    // držení se šikmé/pohyblivé plošiny
        if (prevY <= sy + tol && newY >= sy && sy < bestY) { best = p; bestY = sy; }
      }
      /* houpačka se pohybuje (naklání): kdo na ní stál, zůstane na ní, nosník ho nese s sebou */
      if (wasG && g0 && g0.type === 'wood' && this.x + HALF * 0.8 > g0.px && this.x - HALF * 0.8 < g0.px + g0.pw) { best = g0; bestY = surfaceY(g0, this.x); }
      if (best) {
        const fallD = bestY - this.apexY;
        newY = bestY;
        this.trampAir = false;
        if (this.vy > 300) { this.squash = Math.min(0.2, this.vy / 5000); this.landT = 0.16; if (G.Audio && best.type !== 'tramp') G.Audio.land(this.vy); }
        this.onGround = true; this.ground = best; this.coyote = 0.09; this.jumping = false;
        this.vy = 0; this.stickyAir = false;
        if (best.type === 'sticky' && Math.abs(this.vx) > C.STICKY_RUN) this.vx *= 0.35;      // sliz princeznu při dopadu přilepí
        if (fallD > C.FEAR_H * BS && best.type !== 'tramp' && !(this.mount > 0)) { this.crash = { t: 0 }; this.vx = 0; this.landT = 0; this.squash = 0.2; if (G.Audio) G.Audio.crash(); }
        if (best.type === 'tramp') {
          this.vy = -vFor(C.TRAMP_H); this.onGround = false; this.ground = null; this.coyote = 0;
          this.jumpV = Math.abs(this.vy); this.jumping = false; best.bounce = 1; this.squash = -0.2; this.trampAir = true; this.airT = 0;
          if (G.Audio) G.Audio.tramp();
        }
      }
    } else {
      for (const p of L.platforms) {
        if (!p.solid) continue;
        if (this.x + HALF <= p.px || this.x - HALF >= p.px + p.pw) continue;
        const bot = p.py + p.th;
        if (prevY - C.PH >= bot && newY - C.PH < bot) { newY = bot + C.PH; this.vy = 0; this.jumping = false; }
      }
    }
    this.y = newY;
  };

  Player.prototype.hurt = function (fromX) {
    if (this.invuln > 0 || this.crash || this.mount > 0 || this.cloak > 0) return false;
    this.lives--; this.invuln = C.INVULN; this.stun = 0.25;
    this.vy = -vFor(1.0); this.vx = (this.x < fromX ? -1 : 1) * 260;
    this.onGround = false; this.ground = null; this.climbing = null;
    return true;
  };

  Player.prototype.rect = function () {
    return { x: this.x - HALF * 0.8, y: this.y - C.PH * 0.92, w: C.PW * 0.8, h: C.PH * 0.9 };
  };

  G.Player = Player;
  G.surfaceY = surfaceY;
})(window.G);
