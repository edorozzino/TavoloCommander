// Mazzo iniziale "Goblin di Krenko": aggressivo, rosso. 99 carte + il comandante.
module.exports = {
  name: 'Goblin di Krenko',
  style: 'aggressivo',
  commander: 'Krenko, Mob Boss',
  cards: [
    { name: 'Command Tower', count: 1 }, { name: 'Mountain', count: 33 },
    { name: 'Sol Ring', count: 1 }, { name: 'Arcane Signet', count: 1 }, { name: 'Mind Stone', count: 1 },
    { name: 'Fire Diamond', count: 1 }, { name: "Commander's Sphere", count: 1 }, { name: 'Thought Vessel', count: 1 },
    { name: 'Ruby Medallion', count: 1 }, { name: 'Impact Tremors', count: 1 }, { name: 'Goblin Bombardment', count: 1 },
    ...[
      'Siege-Gang Commander', 'Skirk Prospector', 'Goblin Matron', 'Goblin Warchief', 'Goblin Chieftain', 'Pashalik Mons',
      'Goblin Trashmaster', 'Goblin Instigator', 'Beetleback Chief', 'Hobgoblin Bandit Lord', 'Goblin Sharpshooter',
      'Goblin King', 'Goblin Chainwhirler', 'Fanatical Firebrand', 'Mogg Fanatic', 'Goblin Arsonist', 'Goblin Fireslinger',
      'Lightning-Rig Crew', 'Wily Goblin', 'Reckless Lackey', 'Goblin Wardriver', 'Boneclub Berserker', 'Reckless One',
      'Battle Squadron', 'Underfoot Underdogs', 'Goblin Tunneler', 'Goblin Motivator', 'Goblin Lookout', 'Goblin Sledder',
      'Volley Veteran', 'Rummaging Goblin', 'Foundry Street Denizen', 'Magic Pot', 'Goblin Guide', 'Boggart Brute',
      'Krenko, Tin Street Kingpin', 'Squee, Goblin Nabob', 'Goblin Ringleader',
      'Dragon Fodder', "Krenko's Command", 'Hordeling Outburst', 'Goblin Rally', 'Brightstone Ritual', 'Goblin Grenade',
      'Goblin Surprise', 'Goblin War Strike', 'Lightning Bolt', 'Shock', 'Lightning Strike', 'Searing Spear', 'Flame Slash',
      'Fling', 'Blasphemous Act', 'Volcanic Hammer', 'Thrill of Possibility', 'Tormenting Voice',
    ].map((name) => ({ name, count: 1 })),
  ],
};
