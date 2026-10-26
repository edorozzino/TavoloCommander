// Mazzo iniziale "Tempesta di Talrand": controllo, blu. 99 carte + il comandante.
module.exports = {
  name: 'Tempesta di Talrand',
  style: 'controllo',
  commander: 'Talrand, Sky Summoner',
  cards: [
    { name: 'Command Tower', count: 1 }, { name: 'Island', count: 34 },
    ...[
      'Sol Ring', 'Arcane Signet', 'Mind Stone', "Commander's Sphere", 'Thought Vessel', 'Sky Diamond', 'Sapphire Medallion',
      'Hedron Archive', "Wayfarer's Bauble", 'Coastal Piracy',
      'Murmuring Mystic', 'Archmage Emeritus', 'Archmage of Runes', 'Mocking Sprite', 'Spectral Sailor', 'Peregrine Drake',
      'Slither Blade', 'Triton Shorestalker', 'Invisible Stalker', 'Fog Bank', 'Consecrated Sphinx', 'Curiosity Crafter',
      'Warden of Evos Isle', 'Silver Myr', 'Palladium Myr', 'Burnished Hart', 'Venser, Shaper Savant', 'Tetsuko Umezawa, Fugitive',
      'Air Elemental', 'Phantom Warrior', "Man-o'-War", 'Sea Gate Oracle', 'Thieving Magpie', 'Mahamoti Djinn',
      'Counterspell', 'Negate', 'Essence Scatter', 'Cancel', 'Swan Song', 'Strix Serenade', "Didn't Say Please", 'Memory Lapse',
      'Unwind', 'Rewind', 'Opt', 'Brainstorm', 'Serum Visions', 'Quick Study', 'Frantic Search', 'Impulse', 'Sleight of Hand',
      'Stock Up', 'Unsummon', 'Snap', 'Boomerang Basics', 'Evacuation', 'Aetherize', 'Pongify', 'Rapid Hybridization',
      'Enter the Enigma', 'Prologue to Phyresis', 'Thought Scour', "Talrand's Invocation", 'Divination',
    ].map((name) => ({ name, count: 1 })),
  ],
};
