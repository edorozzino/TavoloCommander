// Mazzo iniziale "Banchetto di Syr Konrad": combo di sacrifici, nero. 99 carte + il comandante.
// Costruito a partire dal mazzo Syr Konrad salvato nell'editor, tenendo le carte che il motore applica per intero.
module.exports = {
  name: 'Banchetto di Syr Konrad',
  style: 'combo',
  commander: 'Syr Konrad, the Grim',
  cards: [
    { name: 'Swamp', count: 30 },
    ...[
      'Cabal Coffers', 'Castle Locthwain', 'Reliquary Tower', 'Bojuka Bog',
      'Sol Ring', 'Arcane Signet', 'Mind Stone', "Commander's Sphere", 'Thought Vessel', "Wayfarer's Bauble", 'Jet Medallion',
      "Nevinyrral's Disk", 'Phyrexian Arena', 'Dictate of Erebos', 'Grave Pact', 'Bastion of Remembrance',
      'Viscera Seer', 'Carrion Feeder', 'Blood Artist', 'Zulaport Cutthroat', 'Butcher of Malakir', 'Fleshbag Marauder',
      'Plaguecrafter', 'Merciless Executioner', 'Gray Merchant of Asphodel', 'Kokusho, the Evening Star', 'Midnight Reaper',
      'Morbid Opportunist', 'Dreadhound', 'Vengeful Dead', 'Massacre Wurm', 'Ayara, First of Locthwain', 'Blood Pet',
      "Stitcher's Supplier", 'Serrated Scorpion', 'Gravedigger', 'Ravenous Chupacabra', 'Grave Titan', 'Falkenrath Noble',
      'Pitiless Plunderer', 'Vindictive Vampire', 'Cemetery Reaper', 'Typhoid Rats', 'Vampire Nighthawk', 'Burnished Hart',
      'Deadly Dispute', 'Village Rites', 'Culling the Weak', 'Dark Ritual', 'Reanimate', 'Exhume', 'Victimize', 'Living Death',
      'Rise of the Dark Realms', 'Sign in Blood', "Night's Whisper", 'Read the Bones', 'Dark Bargain', 'Damnation',
      "Hero's Downfall", 'Infernal Grasp', 'Go for the Throat', 'Doom Blade', 'Feed the Swarm', 'All Is Dust', 'Bone Splinters',
      'Diabolic Tutor', 'Demonic Tutor', 'Vampiric Tutor',
    ].map((name) => ({ name, count: 1 })),
  ],
};
