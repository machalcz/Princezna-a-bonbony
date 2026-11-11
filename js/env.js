/* Prostředí levelu: denní doba (den / noc / svítání), počasí (bouřka, déšť, lístky, mlha) a jejich vývoj v čase.
   Jen logika a čísla 0–1, nic nekreslí. G.Env.cur drží hodnoty pro aktuální snímek. */
(function (G) {
  const C = G.C;
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const E = {
    flash: 0, bolt: null, nextFlash: 9, thunderAt: -1, second: false,
    cur: { n: 0, rain: 0, storm: 0, rainbow: 0, petals: 0, sun: 0, sunRise: 0, warm: 0, fog: 0, fireflies: 0, flash: 0, bolt: null, lamp: 0 }
  };
  E.sm = sm;
  E.reset = function () { E.flash = 0; E.bolt = null; E.nextFlash = 9 + Math.random() * 6; E.thunderAt = -1; E.second = true; };

  E.get = function (L, lt) {
    const tod = L.tod || 'day', w = L.weather || 'clear', th = L.theme;
    const sunRise = tod === 'dawn' ? Math.min(1, lt / 70) : tod === 'day' ? 1 : 0;           // výška slunce 0–1
    const n = tod === 'night' ? 1 : tod === 'dawn' ? Math.max(0, 0.88 * (1 - lt / 75)) : 0;   // „nocovitost“ oblohy
    let rain = 0, storm = 0, rainbow = 0, petals = 0;
    if (w === 'storm') { const cp = lt % 125; storm = sm(4, 12, cp) * (1 - sm(70, 80, cp)); rain = storm; }
    if (w === 'rain') rain = sm(0, 6, lt) * (1 - sm(38, 52, lt));                              // ranní deštík, pak vysvitne slunce
    if (th === 'garden') rainbow = tod === 'day' ? 1 : tod === 'dawn' ? sm(46, 66, lt) : 0;
    if (w === 'petals') petals = 1; else if (th === 'garden' && tod === 'dawn') petals = sm(52, 68, lt);
    const e = E.cur;
    e.n = n; e.rain = rain; e.storm = storm; e.rainbow = rainbow * (1 - storm); e.petals = petals * (1 - rain);
    e.sunRise = sunRise; e.sun = (th === 'forest' ? 0 : sm(0.04, 0.3, sunRise)) * (1 - storm) * (1 - rain * 0.7);
    e.warm = tod === 'dawn' ? Math.sin(Math.PI * Math.min(1, lt / 80)) : 0;
    e.fog = th === 'forest' ? 1 : 0;
    e.fireflies = th === 'garden' ? (n > 0.3 ? n : 0) : th === 'forest' ? 0.55 + 0.45 * n : 0;
    e.flash = E.flash; e.bolt = E.bolt; e.lamp = Math.max(0, Math.min(1, n * 1.3));
    return e;
  };

  /* blesky a hrom: volá se z fyzikálního kroku */
  E.update = function (dt, L, lt) {
    const e = E.get(L, lt);
    if (E.flash > 0) { E.flash = Math.max(0, E.flash - dt * 2.6); if (!E.second && E.flash < 0.5) { E.second = true; E.flash = 0.9; } }
    if (e.storm > 0.6) {
      E.nextFlash -= dt;
      if (E.nextFlash <= 0) {
        E.nextFlash = 6 + Math.random() * 9; E.flash = 1; E.second = false;
        const pts = []; let x = 160 + Math.random() * (C.VW - 320), y = 0;
        while (y < C.VH * 0.5) { pts.push([x, y]); x += (Math.random() - 0.5) * 60; y += 34 + Math.random() * 26; }
        E.bolt = { pts };
        E.thunderAt = lt + 0.4 + Math.random() * 0.9;
      }
    }
    if (E.thunderAt > 0 && lt >= E.thunderAt) { E.thunderAt = -1; if (G.Audio && G.Audio.thunder) G.Audio.thunder(); }
  };

  G.Env = E;
})(window.G);
