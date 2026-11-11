/* Základní konstanty hry. Jednotka světa = 1 blok (BS pixelů). */
window.G = window.G || {};

G.C = {
  BS: 64,            // velikost bloku v logických pixelech
  VW: 1152,          // logická šířka obrazovky
  VH: 648,           // logická výška obrazovky

  GRAV: 2600,        // gravitace px/s^2
  MAXFALL: 1250,     // max rychlost pádu

  RUN: 300,          // max rychlost běhu
  GACC: 3200,        // zrychlení na zemi
  GFRIC: 3600,       // brzdění na zemi
  AACC: 2400,        // zrychlení ve vzduchu
  AFRIC: 1200,       // brzdění ve vzduchu
  ICE_ACC: 420,      // led: pomalé rozjíždění
  ICE_FRIC: 260,     // led: kluzké brzdění
  BELT: 130,         // rychlost pásu

  JUMP_H: 2.15,      // výška plného skoku (v blocích) – spolehlivě přeskočí 2 bloky
  STICKY_H: 1.0,     // výška skoku z lepivé plošiny (běžný skok má 2,15)
  STICKY_RUN: 105,   // nejvyšší rychlost chůze po slizu (běžně 300)
  STICKY_ACC: 1300,  // pomalé rozjíždění na slizu
  STICKY_AIR: 235,   // nejvyšší rychlost ve vzduchu po skoku ze slizu (běžně 300)
  TRAMP_H: 4.15,     // výška odrazu z trampolíny
  JUMP_MIN: 0.6,     // minimální výška skoku při krátkém stisku

  PW: 26,            // šířka hitboxu princezny
  PH: 60,            // výška hitboxu princezny
  CLIMB: 150,        // rychlost lezení po žebříku

  LIVES: 3,
  INVULN: 1.6,       // nezranitelnost po zásahu (s)
  FEAR_H: 4.5,       // pád delší než tolik bloků = strach + hrdý dopad (trampolína má 4,15)
  CANDY_NEED: 10     // bonbony potřebné k otevření portálu
};

G.mulberry32 = function (a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
