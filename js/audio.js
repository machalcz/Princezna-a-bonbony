/* Jednoduché syntetizované zvuky (WebAudio, žádné soubory).
   Safari na iPadu spustí zvuk až po prvním doteku nebo stisku klávesy – proto se kontext odemyká při první interakci.
   Zvuk jde vypnout klávesou M nebo tlačítkem. Pozor: iPad s vypnutým zvonkem (tichý režim) WebAudio ztlumí. */
(function (G) {
  let ctx = null, master = null, muted = false;
  try { muted = localStorage.getItem('pr_muted') === '1'; } catch (e) {}

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.55;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp); comp.connect(ctx.destination);
    }
    return ctx;
  }
  function unlock() {
    const c = ensure(); if (!c) return;
    if (c.state !== 'running') c.resume();
    try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {}
  }
  ['pointerdown', 'touchend', 'mousedown', 'keydown', 'click'].forEach(ev => addEventListener(ev, unlock, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (ctx && document.hidden) ctx.suspend(); else if (ctx) ctx.resume(); });

  function ready() { return ctx && ctx.state === 'running' && !muted; }

  /* jeden tón: o = { type, vol, a (attack), r (release), to (cílová frekvence), vib (hloubka vibrata Hz), lp (lowpass) } */
  function tone(freq, t0, dur, o) {
    o = o || {};
    const t = ctx.currentTime + t0;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    let node = osc;
    if (o.vib) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 14; lg.gain.value = o.vib; lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t); lfo.stop(t + dur + 0.2);
    }
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
    const v = o.vol == null ? 0.25 : o.vol, a = o.a || 0.006, r = o.r || 0.08;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setValueAtTime(v, t + Math.max(a, dur - r));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
    node.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(t0, dur, vol, lpFreq) {
    const t = ctx.currentTime + t0, n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lpFreq || 900;
    const g = ctx.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }

  const PENTA = [0, 2, 4, 7, 9];
  const A = {
    get muted() { return muted; },
    toggle() {
      muted = !muted; try { localStorage.setItem('pr_muted', muted ? '1' : '0'); } catch (e) {}
      if (master) master.gain.value = muted ? 0 : 0.55;
      const b = document.getElementById('bMute'); if (b) b.textContent = muted ? '🔇' : '🔊';
      if (!muted) unlock();
    },
    jump() { if (!ready()) return; tone(330, 0, 0.14, { type: 'triangle', vol: 0.22, to: 700, r: 0.05 }); },
    land(vy) { if (!ready()) return; const v = Math.min(0.3, 0.08 + vy / 6000); tone(150, 0, 0.1, { type: 'sine', vol: v, to: 60, r: 0.06 }); noise(0, 0.05, v * 0.35, 700); },
    tramp() { if (!ready()) return; tone(180, 0, 0.45, { type: 'sine', vol: 0.3, to: 720, vib: 40, r: 0.15 }); tone(360, 0.02, 0.3, { type: 'triangle', vol: 0.12, to: 1000, r: 0.1 }); },
    /* každý druh bonbonu má jiný tón: výška podle druhu, jiný zvuk podle skupiny */
    candy(kind) {
      if (!ready()) return;
      const k = kind | 0, f = 392 * Math.pow(2, (PENTA[k % 5] + 12 * Math.floor(k / 5)) / 12);
      const type = ['triangle', 'sine', 'square'][k % 3];
      tone(f, 0, 0.16, { type, vol: type === 'square' ? 0.09 : 0.22, r: 0.1 });
      tone(f * 1.5, 0.07, 0.2, { type: 'sine', vol: 0.13, r: 0.14 });
    },
    fear() { if (!ready()) return; tone(950, 0, 0.55, { type: 'sine', vol: 0.13, to: 430, vib: 30, r: 0.2 }); },
    crash() {
      if (!ready()) return;
      tone(130, 0, 0.2, { type: 'sine', vol: 0.36, to: 45 }); noise(0, 0.14, 0.3, 500);
      [[330, 0.3], [262, 0.45], [196, 0.6]].forEach(([f, t]) => tone(f, t, 0.17, { type: 'triangle', vol: 0.16, vib: 12 }));
    },
    portal() { if (!ready()) return; [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => tone(f, i * 0.09, 0.22, { type: 'triangle', vol: 0.2, r: 0.14 })); },
    /* nebezpečná melodie: klesající tritonus + bzučivý pilový tón */
    hurt() {
      if (!ready()) return;
      [[466, 0], [330, 0.1], [233, 0.2], [165, 0.3]].forEach(([f, t]) => tone(f, t, 0.12, { type: 'sawtooth', vol: 0.2, lp: 1800, r: 0.04 }));
      noise(0, 0.25, 0.15, 1200);
    },
    /* smutná melodie: pomalá klesající mollová fráze */
    dead() {
      if (!ready()) return;
      [[440, 0, 0.4], [349.2, 0.42, 0.4], [329.6, 0.84, 0.4], [293.7, 1.26, 0.45], [261.6, 1.74, 0.5], [220, 2.3, 1.1]]
        .forEach(([f, t, d], i, arr) => tone(f, t, d, { type: 'triangle', vol: 0.26, r: 0.25, to: i === arr.length - 1 ? 196 : 0 }));
      tone(110, 0, 3.2, { type: 'sine', vol: 0.1, r: 1.2 });
    },
    /* fanfára po dohrání levelu */
    win() {
      if (!ready()) return;
      const br = { type: 'sawtooth', vol: 0.17, lp: 2600, r: 0.05 };
      [[523.25, 0, 0.13], [523.25, 0.16, 0.13], [523.25, 0.32, 0.13], [659.25, 0.48, 0.34], [587.33, 0.86, 0.13], [659.25, 1.02, 0.13], [783.99, 1.18, 0.7]]
        .forEach(([f, t, d]) => tone(f, t, d, br));
      [523.25, 659.25, 783.99, 1046.5].forEach(f => tone(f, 1.18, 1.1, { type: 'triangle', vol: 0.15, r: 0.5 }));
    }
  };
  /* nové zvuky: bouřka, oheň draka, kouzla pomocníků, déšť (smyčka šumu) */
  Object.assign(A, {
    thunder() { if (!ready()) return; noise(0, 1.8, 0.55, 260); noise(0.18, 1.4, 0.35, 140); tone(62, 0, 1.4, { type: 'sine', vol: 0.28, to: 36, r: 0.9 }); },
    fire() { if (!ready()) return; noise(0, 1.3, 0.24, 2800); noise(0.1, 1.0, 0.16, 1300); tone(150, 0, 1.2, { type: 'sawtooth', vol: 0.05, to: 85, lp: 650, r: 0.5 }); },
    roar() { if (!ready()) return; tone(210, 0, 0.7, { type: 'sawtooth', vol: 0.11, to: 95, lp: 700, vib: 22, r: 0.3 }); noise(0, 0.5, 0.1, 500); },
    poof() { if (!ready()) return; noise(0, 0.28, 0.2, 1900); tone(540, 0, 0.2, { type: 'triangle', vol: 0.14, to: 170 }); },
    magic() { if (!ready()) return; [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => tone(f, i * 0.06, 0.28, { type: 'triangle', vol: 0.13, r: 0.16 })); },
    neigh() { if (!ready()) return; tone(620, 0.1, 0.13, { type: 'sawtooth', vol: 0.07, to: 920, lp: 2200, vib: 20 }); tone(900, 0.23, 0.26, { type: 'sawtooth', vol: 0.07, to: 520, lp: 2200, vib: 25 }); },
    boo() { if (!ready()) return; tone(300, 0.1, 0.45, { type: 'sine', vol: 0.14, to: 150, vib: 18, r: 0.22 }); tone(450, 0.15, 0.38, { type: 'triangle', vol: 0.06, to: 220, vib: 14 }); },
    rain(v) {
      if (!ctx || !master) return;
      if (v > 0.02 && !A._rs) {
        const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
        const g = ctx.createGain(); g.gain.value = 0; s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(master); s.start();
        A._rs = s; A._rg = g;
      }
      if (A._rg) A._rg.gain.setTargetAtTime(ctx.state === 'running' ? v * 0.11 : 0, ctx.currentTime, 0.5);
    }
  });
  G.Audio = A;

  addEventListener('keydown', e => { if (e.code === 'KeyM') A.toggle(); });
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.getElementById('bMute');
    if (b) {
      b.textContent = muted ? '🔇' : '🔊';
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); unlock(); A.toggle(); });
    }
  });
})(window.G);
