/* Témata prostředí: pozadí, mlha, výběr stafáže. Pohádkové prostředí: horská louka (drak), zámecká zahrada (jednorožec, duha),
   strašidelný les (duch za stromy). */
(function (G) {
  G.Themes = {
    meadow: {
      key: 'meadow', name: 'Horní louka', bg: 'bg', bgN: 'bg_night', mist: '255,255,255', mistA: 0.26,
      decor: { tree: ['tree_0', 'tree_1', 'tree_2'], bush: ['bush_0', 'bush_1', 'bush_2', 'bush_3'], rock: ['rock_0', 'rock_1', 'rock_2', 'rock_3'], grass: ['grass_0', 'grass_1', 'grass_2', 'fern_0', 'fern_1'], mush: ['mush_0', 'mush_1'] },
      w: { tree: 0.2, bush: 0.3, rock: 0.2, grass: 0.2, mush: 0.1 }
    },
    garden: {
      key: 'garden', name: 'Zámecká zahrada', bg: 'bg_garden', bgN: 'bg_garden_night', mist: '255,236,250', mistA: 0.16,
      decor: { tree: ['tree_0', 'tree_1'], bush: ['bush_0', 'bush_1', 'bush_2', 'bush_3'], rock: ['rock_2', 'rock_3'], grass: ['grass_0', 'grass_1', 'grass_2'], mush: ['mush_0'] },
      w: { tree: 0.1, bush: 0.5, rock: 0.07, grass: 0.25, mush: 0.08 }
    },
    forest: {
      key: 'forest', name: 'Strašidelný les', bg: 'bg_forest', bgN: 'bg_forest_night', mist: '120,105,210', mistA: 0.24, multiply: 'rgb(150,158,214)',
      decor: { tree: ['tree_0', 'tree_1', 'tree_2'], bush: ['bush_0', 'bush_1'], rock: ['rock_0', 'rock_1', 'rock_2', 'rock_3'], grass: ['fern_0', 'fern_1', 'grass_1'], mush: ['mush_0', 'mush_1'] },
      w: { tree: 0.2, bush: 0.08, rock: 0.22, grass: 0.22, mush: 0.28 }
    }
  };
})(window.G);
