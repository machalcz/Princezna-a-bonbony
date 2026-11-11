/* Sjednocený vstup: dotyk + klávesnice (Magic Keyboard) + gamepad (DualSense).
   Hra nikdy nečte zařízení přímo, jen výsledek G.Input.poll(). */
(function (G) {
  const NAMES = ['left', 'right', 'up', 'down', 'jump', 'confirm', 'pause', 'alt', 'newlvl'];
  const mk = () => ({ left: 0, right: 0, up: 0, down: 0, jump: 0, confirm: 0, pause: 0, alt: 0, newlvl: 0 });
  const kb = mk(), tc = mk(), gp = mk();
  let prev = mk();
  const latch = mk();      // zapamatuje i velmi krátký stisk (kratší než jeden snímek)
  let padConnected = false;
  let device = 'keyboard';

  const KEYS = {
    ArrowLeft: ['left'], KeyA: ['left'],
    ArrowRight: ['right'], KeyD: ['right'],
    ArrowUp: ['up'], KeyW: ['up'],
    ArrowDown: ['down'], KeyS: ['down'],
    Space: ['jump', 'confirm'], KeyZ: ['jump'], KeyX: ['jump'], KeyK: ['jump'],
    Enter: ['confirm'], Escape: ['pause'], KeyP: ['pause'], KeyR: ['alt'], KeyN: ['newlvl']
  };

  function setDevice(d) {
    if (device === d && document.body && document.body.classList.contains('has-touch') === (d === 'touch')) return;
    device = d;
    if (document.body) document.body.classList.toggle('has-touch', d === 'touch');
  }
  /* Dotyková zařízení (iPad, iPhone) začínají s ovládáním na displeji; po prvním stisku klávesy nebo gamepadu se schová,
     po dalším doteku se vrátí. */
  const COARSE = window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches;
  function initDevice() { device = ''; setDevice(COARSE ? 'touch' : 'keyboard'); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDevice); else initDevice();

  function toast(txt) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = txt; t.classList.add('on');
    clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2600);
  }

  addEventListener('keydown', e => {
    const m = KEYS[e.code];
    if (m) { e.preventDefault(); m.forEach(n => { kb[n] = 1; latch[n] = 1; }); setDevice('keyboard'); }
    if (e.code.startsWith('Digit')) G.lastDigit = +e.code.slice(5);
  });
  addEventListener('keyup', e => {
    const m = KEYS[e.code];
    if (m) { e.preventDefault(); m.forEach(n => kb[n] = 0); }
  });
  const releaseAll = () => NAMES.forEach(n => { kb[n] = 0; tc[n] = 0; latch[n] = 0; });
  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

  /* Safari zveřejní gamepad až po prvním stisku tlačítka na ovladači – událost pak přijde a ukážeme potvrzení */
  addEventListener('gamepadconnected', e => { padConnected = true; toast('🎮 Ovladač připojen: ' + String(e.gamepad.id).replace(/\(.*$/, '').trim().slice(0, 28)); });
  addEventListener('gamepaddisconnected', () => { padConnected = false; toast('🎮 Ovladač odpojen'); initDevice(); });

  const DEAD = 0.35;
  function pollPad() {
    NAMES.forEach(n => gp[n] = 0);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let p = null;
    for (const q of pads) if (q && q.connected && q.buttons && q.buttons.length >= 10) { p = q; break; }
    padConnected = !!p;
    if (!p) return;
    const b = i => !!(p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5));
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    // DualSense ve standardním mapování: 0 Kříž, 1 Kolečko, 2 Čtverec, 3 Trojúhelník, 4 L1, 5 R1, 9 Options, 12–15 D-pad
    gp.left = (ax < -DEAD || b(14)) ? 1 : 0;
    gp.right = (ax > DEAD || b(15)) ? 1 : 0;
    gp.up = (ay < -0.5 || b(12)) ? 1 : 0;
    gp.down = (ay > 0.5 || b(13)) ? 1 : 0;
    gp.jump = (b(0) || b(2) || b(4) || b(5)) ? 1 : 0;          // Kříž / Čtverec / L1 / R1
    gp.confirm = (b(0) || b(2) || b(3) || b(9)) ? 1 : 0;          // v nabídkách: Kříž / Čtverec / Trojúhelník / Options
    gp.alt = b(1) ? 1 : 0;                                       // Kolečko = druhá volba (opakovat)
    gp.newlvl = b(8) ? 1 : 0;                                    // Share / Create = nový level
    gp.pause = b(9) ? 1 : 0;                                    // Options
    if (NAMES.some(n => gp[n])) setDevice('gamepad');
  }

  /* ---------- dotykové ovládání ---------- */
  function bindTouch() {
    const holdBtn = (el, name) => {
      if (!el) return;
      const on = e => { e.preventDefault(); el.setPointerCapture(e.pointerId); tc[name] = 1; latch[name] = 1; setDevice('touch'); el.classList.add('down'); };
      const off = e => { tc[name] = 0; el.classList.remove('down'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('lostpointercapture', off);
    };
    holdBtn(document.getElementById('bJump'), 'jump');
    holdBtn(document.getElementById('bUp'), 'up');
    holdBtn(document.getElementById('bDown'), 'down');

    const pauseBtn = document.getElementById('bPause');
    if (pauseBtn) {
      pauseBtn.addEventListener('pointerdown', e => { e.preventDefault(); tc.pause = 1; latch.pause = 1; setDevice('touch'); });
      pauseBtn.addEventListener('pointerup', () => tc.pause = 0);
      pauseBtn.addEventListener('pointercancel', () => tc.pause = 0);
    }

    // D-pad zóna: pozice prstu určuje doleva / doprava (jde přejet prstem)
    const dpad = document.getElementById('dpad');
    if (dpad) {
      const upd = e => {
        const r = dpad.getBoundingClientRect();
        const rel = (e.clientX - r.left) / r.width - 0.5;              // lze sjet prstem i mimo ovladač
        tc.left = rel < -0.08 ? 1 : 0;
        tc.right = rel > 0.08 ? 1 : 0;
        dpad.classList.toggle('l', !!tc.left);
        dpad.classList.toggle('r', !!tc.right);
      };
      const end = () => { tc.left = 0; tc.right = 0; dpad.classList.remove('l', 'r'); };
      dpad.addEventListener('pointerdown', e => { e.preventDefault(); dpad.setPointerCapture(e.pointerId); setDevice('touch'); upd(e); });
      dpad.addEventListener('pointermove', e => { if (dpad.hasPointerCapture(e.pointerId)) upd(e); });
      dpad.addEventListener('pointerup', end);
      dpad.addEventListener('pointercancel', end);
      dpad.addEventListener('lostpointercapture', end);
    }
    document.addEventListener('contextmenu', e => e.preventDefault());
    // Safari: žádné tažení stránky, lupa ani pull-to-refresh během hraní
    document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    document.addEventListener('dblclick', e => e.preventDefault());
    ['gesturestart', 'gesturechange'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindTouch); else bindTouch();

  G.Input = {
    get padConnected() { return padConnected; },
    get device() { return device; },
    touched() { setDevice('touch'); },
    /* Voláno jednou za snímek. Vrací sloučený stav + hrany (pressed). */
    poll() {
      pollPad();
      const cur = mk(), pressed = {};
      NAMES.forEach(n => {
        cur[n] = (kb[n] || tc[n] || gp[n] || latch[n]) ? 1 : 0;
        pressed[n] = cur[n] && !prev[n] ? 1 : 0;
        latch[n] = 0;
      });
      prev = cur;
      return {
        x: cur.right - cur.left,
        y: cur.down - cur.up,      // záporné = nahoru
        jump: !!cur.jump,
        jumpPressed: !!pressed.jump,
        held: cur,
        pressed
      };
    }
  };
})(window.G);
