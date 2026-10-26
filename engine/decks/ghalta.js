// Mazzo iniziale "Ruggito di Ghalta": rampa, verde. 99 carte + il comandante.
module.exports = {
  name: 'Ruggito di Ghalta',
  style: 'rampa',
  commander: 'Ghalta, Primal Hunger',
  cards: [
    { name: 'Command Tower', count: 1 }, { name: 'Forest', count: 34 },
    ...[
      'Sol Ring', 'Arcane Signet', 'Mind Stone', "Commander's Sphere", 'Thought Vessel', 'Emerald Medallion', "Wayfarer's Bauble",
      'Elemental Bond', 'Primal Rage', 'Font of Fertility', 'Exploration',
      'Llanowar Elves', 'Elvish Mystic', 'Fyndhorn Elves', 'Birds of Paradise', 'Sakura-Tribe Elder', 'Wood Elves', 'Farhaven Elf',
      'Priest of Titania', 'Elvish Archdruid', 'Llanowar Tribe', 'Circle of Dreams Druid', 'Wall of Blossoms', 'Beast Whisperer',
      "Garruk's Packleader", 'Soul of the Harvest', 'Rampaging Baloths', 'Craterhoof Behemoth', 'End-Raze Forerunners', 'Hornet Queen',
      'Acidic Slime', 'Reclamation Sage', 'Thunderfoot Baloth', "Verdant Sun's Avatar", 'Kalonian Hydra', 'Colossal Dreadmaw',
      'Old Gnawbone', 'Surrak and Goreclaw', 'Ohran Frostfang', 'Burnished Hart', 'Pelakka Wurm', 'Thragtusk',
      'Cultivate', "Kodama's Reach", 'Rampant Growth', "Nature's Lore", 'Three Visits', 'Explosive Vegetation', 'Skyshroud Claim',
      'Harrow', "Ranger's Path", 'Harmonize', 'Return of the Wildspeaker', 'Shamanic Revelation', 'Beast Within', "Nature's Claim",
      'Return to Nature', 'Bite Down', 'Giant Growth', 'Overrun', 'Blossoming Defense', 'Overprotect', 'Heroic Intervention',
      'Overwhelming Stampede',
    ].map((name) => ({ name, count: 1 })),
  ],
};
