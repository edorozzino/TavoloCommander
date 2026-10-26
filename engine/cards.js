// Definizioni delle carte come dati. Ogni carta qui deve avere i suoi test in test/ (lo verifica test/decks.test.js).
// Il testo ufficiale di ogni carta è nel commento sopra la definizione (fonte: Scryfall).

const basic = (name, color) => ({
  name,
  supertypes: ['Basic'],
  types: ['Land'],
  subtypes: [name],
  abilities: [{ kind: 'mana', cost: '{T}', produce: color }],
});

function creature(name, cost, power, toughness, keywords = [], subtypes = [], extra = {}) {
  return { name, types: ['Creature'], subtypes, cost, power, toughness, keywords, ...extra };
}

const goblin = (name, cost, power, toughness, keywords, subtypes, extra) =>
  creature(name, cost, power, toughness, keywords, ['Goblin', ...subtypes], extra);

// Abilità ricorrenti
const tap = (effect, extra = {}) => ({ kind: 'activated', cost: '{T}', effect, ...extra });
const etb = (effect, extra = {}) => ({ kind: 'triggered', when: 'etb', effect, ...extra });
const tokens = (count, token = 'Goblin') => ({ kind: 'createToken', token, count });
const burn = (amount, target = 'any') => ({ kind: 'damage', amount, target });
const sorcery = (name, cost, effect, extra = {}) => ({ name, types: ['Sorcery'], cost, effect, ...extra });
const instant = (name, cost, effect, extra = {}) => ({ name, types: ['Instant'], cost, effect, ...extra });
const anyIdentityMana = { kind: 'mana', cost: '{T}', produce: 'commanderIdentity' };
const draw = (amount) => ({ kind: 'draw', amount });
const onSpell = (effect) => ({ kind: 'triggered', when: 'castSpell', filter: 'instantOrSorcerySpell', effect });
const counter = (target, extra = {}) => ({ kind: 'counter', target, ...extra });
const greenMana = { kind: 'mana', cost: '{T}', produce: 'G' };
const searchLand = (filter, to, max = 1) => ({ kind: 'search', filter, to, max });
const blackMana = { kind: 'mana', cost: '{T}', produce: 'B' };
const pingOpponents = (amount) => ({ kind: 'damage', amount, to: 'eachOpponent' });
const opponentsLose = (amount) => ({ kind: 'loseLife', amount, to: 'eachOpponent' });
const artistDrain = { kind: 'triggered', when: 'dies', filter: 'anyCreature', target: 'player', effect: { kind: 'targetLosesYouGain', amount: 1, target: 'player' } };

const CARDS = {
  Plains: basic('Plains', 'W'),
  Island: basic('Island', 'U'),
  Swamp: basic('Swamp', 'B'),
  Mountain: basic('Mountain', 'R'),
  Forest: basic('Forest', 'G'),
  // {T}: Add one mana of any color in your commander's color identity.
  'Command Tower': { name: 'Command Tower', types: ['Land'], abilities: [anyIdentityMana] },

  // ---------- Artefatti ----------
  // {T}: Add {C}{C}.
  'Sol Ring': { name: 'Sol Ring', types: ['Artifact'], cost: '{1}', abilities: [{ kind: 'mana', cost: '{T}', produce: 'CC' }] },
  // {T}: Add one mana of any color in your commander's color identity.
  'Arcane Signet': { name: 'Arcane Signet', types: ['Artifact'], cost: '{2}', abilities: [anyIdentityMana] },
  // {T}: Add {C}. / {1}, {T}, Sacrifice this artifact: Draw a card.
  'Mind Stone': {
    name: 'Mind Stone', types: ['Artifact'], cost: '{2}',
    abilities: [{ kind: 'mana', cost: '{T}', produce: 'C' }, { kind: 'activated', cost: '{1}{T}', sacrifice: 'self', effect: { kind: 'draw', amount: 1 } }],
  },
  // This artifact enters tapped. / {T}: Add {R}.
  'Fire Diamond': { name: 'Fire Diamond', types: ['Artifact'], cost: '{2}', entersTapped: true, abilities: [{ kind: 'mana', cost: '{T}', produce: 'R' }] },
  // {T}: Add one mana of any color in your commander's color identity. / Sacrifice this artifact: Draw a card.
  "Commander's Sphere": {
    name: "Commander's Sphere", types: ['Artifact'], cost: '{3}',
    abilities: [anyIdentityMana, { kind: 'activated', cost: '', sacrifice: 'self', effect: { kind: 'draw', amount: 1 } }],
  },
  // You have no maximum hand size. / {T}: Add {C}.
  'Thought Vessel': {
    name: 'Thought Vessel', types: ['Artifact'], cost: '{2}',
    abilities: [{ kind: 'static', noMaxHandSize: true }, { kind: 'mana', cost: '{T}', produce: 'C' }],
  },
  // Red spells you cast cost {1} less to cast.
  'Ruby Medallion': { name: 'Ruby Medallion', types: ['Artifact'], cost: '{2}', abilities: [{ kind: 'static', costReduction: { filter: 'redSpell', amount: 1 } }] },
  // {3}, {T}: Rod of Ruin deals 1 damage to any target.
  'Rod of Ruin': { name: 'Rod of Ruin', types: ['Artifact'], cost: '{4}', abilities: [{ kind: 'activated', cost: '{3}{T}', effect: burn(1) }] },

  // ---------- Incantesimi ----------
  // At the beginning of your upkeep, you draw a card and you lose 1 life.
  'Phyrexian Arena': {
    name: 'Phyrexian Arena', types: ['Enchantment'], cost: '{1}{B}{B}',
    abilities: [{ kind: 'triggered', when: 'upkeep', effect: [{ kind: 'draw', amount: 1 }, { kind: 'loseLife', amount: 1 }] }],
  },
  // Whenever a creature you control enters, this enchantment deals 1 damage to each opponent.
  'Impact Tremors': {
    name: 'Impact Tremors', types: ['Enchantment'], cost: '{1}{R}',
    abilities: [{ kind: 'triggered', when: 'creatureEnters', filter: 'creatureYouControl', effect: { kind: 'damage', amount: 1, to: 'eachOpponent' } }],
  },
  // Sacrifice a creature: This enchantment deals 1 damage to any target.
  'Goblin Bombardment': {
    name: 'Goblin Bombardment', types: ['Enchantment'], cost: '{1}{R}',
    abilities: [{ kind: 'activated', cost: '', sacrifice: 'creature', effect: burn(1) }],
  },

  // ---------- Istantanei e stregonerie ----------
  // Lightning Bolt deals 3 damage to any target.
  'Lightning Bolt': instant('Lightning Bolt', '{R}', burn(3)),
  // Counter target spell.
  Counterspell: instant('Counterspell', '{U}{U}', counter('spell')),
  // Shock deals 2 damage to any target.
  Shock: instant('Shock', '{R}', burn(2)),
  // Lightning Strike deals 3 damage to any target.
  'Lightning Strike': instant('Lightning Strike', '{1}{R}', burn(3)),
  // Searing Spear deals 3 damage to any target.
  'Searing Spear': instant('Searing Spear', '{1}{R}', burn(3)),
  // Volcanic Hammer deals 3 damage to any target.
  'Volcanic Hammer': sorcery('Volcanic Hammer', '{1}{R}', burn(3)),
  // Flame Slash deals 4 damage to target creature.
  'Flame Slash': sorcery('Flame Slash', '{R}', burn(4, 'creature')),
  // As an additional cost to cast this spell, sacrifice a creature. / Fling deals damage equal to the sacrificed creature's power to any target.
  Fling: instant('Fling', '{1}{R}', burn({ count: 'sacrificedPower' }), { additionalCost: { sacrifice: 'creature' } }),
  // This spell costs {1} less to cast for each creature on the battlefield. / Blasphemous Act deals 13 damage to each creature.
  'Blasphemous Act': sorcery('Blasphemous Act', '{8}{R}', { kind: 'damage', amount: 13, to: 'eachCreature' }, { costReductionPer: 'creatureOnBattlefield' }),
  // As an additional cost to cast this spell, discard a card. / Draw two cards.
  'Thrill of Possibility': instant('Thrill of Possibility', '{1}{R}', { kind: 'draw', amount: 2 }, { additionalCost: { discard: 1 } }),
  // As an additional cost to cast this spell, discard a card. / Draw two cards.
  'Tormenting Voice': sorcery('Tormenting Voice', '{1}{R}', { kind: 'draw', amount: 2 }, { additionalCost: { discard: 1 } }),
  // Create two 1/1 red Goblin creature tokens.
  'Dragon Fodder': sorcery('Dragon Fodder', '{1}{R}', tokens(2)),
  // Create two 1/1 red Goblin creature tokens.
  "Krenko's Command": sorcery("Krenko's Command", '{1}{R}', tokens(2)),
  // Create three 1/1 red Goblin creature tokens.
  'Hordeling Outburst': sorcery('Hordeling Outburst', '{1}{R}{R}', tokens(3)),
  // Create four 1/1 red Goblin creature tokens.
  'Goblin Rally': sorcery('Goblin Rally', '{3}{R}{R}', tokens(4)),
  // Add {R} for each Goblin on the battlefield.
  'Brightstone Ritual': instant('Brightstone Ritual', '{R}', { kind: 'addMana', color: 'R', amount: { count: 'goblinsOnBattlefield' } }),
  // As an additional cost to cast this spell, sacrifice a Goblin. / Goblin Grenade deals 5 damage to any target.
  'Goblin Grenade': sorcery('Goblin Grenade', '{R}', burn(5), { additionalCost: { sacrifice: 'goblin' } }),
  // Choose one — • Creatures you control get +2/+0 until end of turn. • Create two 1/1 red Goblin creature tokens.
  'Goblin Surprise': instant('Goblin Surprise', '{2}{R}', null, {
    modeNames: ['Le tue creature prendono +2/+0', 'Crea due Goblin 1/1'],
    modes: [{ kind: 'pumpAll', filter: 'creaturesYouControl', power: 2, toughness: 0 }, tokens(2)],
  }),
  // Goblin War Strike deals damage to target player or planeswalker equal to the number of Goblins you control.
  'Goblin War Strike': sorcery('Goblin War Strike', '{R}', burn({ count: 'goblinsYouControl' }, 'player')),

  // ---------- Creature ----------
  'Grizzly Bears': creature('Grizzly Bears', '{1}{G}', 2, 2, [], ['Bear']),
  'Serra Angel': creature('Serra Angel', '{3}{W}{W}', 4, 4, ['Flying', 'Vigilance'], ['Angel']),
  'Giant Spider': creature('Giant Spider', '{3}{G}', 2, 4, ['Reach'], ['Spider']),
  'Typhoid Rats': creature('Typhoid Rats', '{B}', 1, 1, ['Deathtouch'], ['Rat']),
  'Vampire Nighthawk': creature('Vampire Nighthawk', '{1}{B}{B}', 2, 3, ['Flying', 'Deathtouch', 'Lifelink'], ['Vampire', 'Shaman']),
  'Colossal Dreadmaw': creature('Colossal Dreadmaw', '{4}{G}{G}', 6, 6, ['Trample'], ['Dinosaur']),
  'Wall of Wood': creature('Wall of Wood', '{G}', 0, 3, ['Defender'], ['Wall']),
  'Youthful Knight': creature('Youthful Knight', '{1}{W}', 2, 1, ['First strike'], ['Human', 'Knight']),
  'Fencing Ace': creature('Fencing Ace', '{1}{W}', 1, 1, ['Double strike'], ['Human', 'Soldier']),
  'Darksteel Myr': { ...creature('Darksteel Myr', '{3}', 0, 1, ['Indestructible'], ['Myr']), types: ['Artifact', 'Creature'] },
  'Gladecover Scout': creature('Gladecover Scout', '{G}', 1, 1, ['Hexproof'], ['Elf', 'Scout']),
  'Ambush Viper': creature('Ambush Viper', '{1}{G}', 2, 1, ['Flash', 'Deathtouch'], ['Snake']),
  // When this creature enters, draw a card.
  'Elvish Visionary': creature('Elvish Visionary', '{1}{G}', 1, 1, [], ['Elf', 'Shaman'], { abilities: [etb({ kind: 'draw', amount: 1 })] }),
  // Whenever Cruel Celebrant or another creature or planeswalker you control dies, each opponent loses 1 life and you gain 1 life.
  'Cruel Celebrant': creature('Cruel Celebrant', '{W}{B}', 1, 2, [], ['Vampire'], {
    abilities: [{ kind: 'triggered', when: 'dies', filter: 'creatureYouControl', effect: { kind: 'drain', amount: 1 } }],
  }),

  // ---------- Goblin ----------
  // {T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.
  'Krenko, Mob Boss': goblin('Krenko, Mob Boss', '{2}{R}{R}', 3, 3, [], ['Warrior'], {
    supertypes: ['Legendary'], abilities: [tap(tokens({ count: 'goblinsYouControl' }))],
  }),
  // Whenever Krenko attacks, put a +1/+1 counter on it, then create a number of 1/1 red Goblin creature tokens equal to Krenko's power.
  'Krenko, Tin Street Kingpin': goblin('Krenko, Tin Street Kingpin', '{2}{R}', 1, 2, [], [], {
    supertypes: ['Legendary'],
    abilities: [{ kind: 'triggered', when: 'attacks', effect: [{ kind: 'putCounter', on: 'self', amount: 1 }, tokens({ count: 'selfPower' })] }],
  }),
  // When this creature enters, create three 1/1 red Goblin creature tokens. / {1}{R}, Sacrifice a Goblin: This creature deals 2 damage to any target.
  'Siege-Gang Commander': goblin('Siege-Gang Commander', '{3}{R}{R}', 2, 2, [], [], {
    abilities: [etb(tokens(3)), { kind: 'activated', cost: '{1}{R}', sacrifice: 'goblin', effect: burn(2) }],
  }),
  // Sacrifice a Goblin: Add {R}.
  'Skirk Prospector': goblin('Skirk Prospector', '{R}', 1, 1, [], [], { abilities: [{ kind: 'mana', cost: '', sacrifice: 'goblin', produce: 'R' }] }),
  // When this creature enters, you may search your library for a Goblin card, reveal that card, put it into your hand, then shuffle.
  'Goblin Matron': goblin('Goblin Matron', '{2}{R}', 1, 1, [], [], { abilities: [etb({ kind: 'search', filter: 'goblinCard', to: 'hand' })] }),
  // Goblin spells you cast cost {1} less to cast. / Goblins you control have haste.
  'Goblin Warchief': goblin('Goblin Warchief', '{1}{R}{R}', 2, 2, [], ['Warrior'], {
    abilities: [
      { kind: 'static', costReduction: { filter: 'goblinSpell', amount: 1 } },
      { kind: 'static', anthem: { filter: 'goblinsYouControl', keywords: ['Haste'] } },
    ],
  }),
  // Haste / Other Goblin creatures you control get +1/+1 and have haste.
  'Goblin Chieftain': goblin('Goblin Chieftain', '{1}{R}{R}', 2, 2, ['Haste'], [], {
    abilities: [{ kind: 'static', anthem: { filter: 'otherGoblinsYouControl', power: 1, toughness: 1, keywords: ['Haste'] } }],
  }),
  // Whenever Pashalik Mons or another Goblin you control dies, Pashalik Mons deals 1 damage to any target.
  // {3}{R}, Sacrifice a Goblin: Create two 1/1 red Goblin creature tokens.
  'Pashalik Mons': goblin('Pashalik Mons', '{2}{R}', 2, 2, [], ['Warrior'], {
    supertypes: ['Legendary'],
    abilities: [
      { kind: 'triggered', when: 'dies', filter: 'goblinYouControl', target: 'any', effect: burn(1) },
      { kind: 'activated', cost: '{3}{R}', sacrifice: 'goblin', effect: tokens(2) },
    ],
  }),
  // Other Goblins you control get +1/+1. / Sacrifice a Goblin: Destroy target artifact.
  'Goblin Trashmaster': goblin('Goblin Trashmaster', '{2}{R}{R}', 3, 3, [], ['Warrior'], {
    abilities: [
      { kind: 'static', anthem: { filter: 'otherGoblinsYouControl', power: 1, toughness: 1 } },
      { kind: 'activated', cost: '', sacrifice: 'goblin', effect: { kind: 'destroy', target: 'artifact' } },
    ],
  }),
  // When this creature enters, create a 1/1 red Goblin creature token.
  'Goblin Instigator': goblin('Goblin Instigator', '{1}{R}', 1, 1, [], ['Rogue'], { abilities: [etb(tokens(1))] }),
  // When this creature enters, create two 1/1 red Goblin creature tokens.
  'Beetleback Chief': goblin('Beetleback Chief', '{2}{R}{R}', 2, 2, [], ['Warrior'], { abilities: [etb(tokens(2))] }),
  // Other Goblins you control get +1/+1. / {R}, {T}: This creature deals damage equal to the number of Goblins that entered the battlefield under your control this turn to any target.
  'Hobgoblin Bandit Lord': goblin('Hobgoblin Bandit Lord', '{1}{R}{R}', 2, 3, [], ['Rogue'], {
    abilities: [
      { kind: 'static', anthem: { filter: 'otherGoblinsYouControl', power: 1, toughness: 1 } },
      { kind: 'activated', cost: '{R}{T}', effect: burn({ count: 'goblinsEnteredThisTurn' }) },
    ],
  }),
  // This creature doesn't untap during your untap step. / Whenever a creature dies, untap this creature. / {T}: This creature deals 1 damage to any target.
  'Goblin Sharpshooter': goblin('Goblin Sharpshooter', '{2}{R}', 1, 1, [], [], {
    abilities: [
      { kind: 'static', doesntUntap: true },
      { kind: 'triggered', when: 'dies', filter: 'anyCreature', effect: { kind: 'untapSelf' } },
      tap(burn(1)),
    ],
  }),
  // Other Goblins get +1/+1 and have mountainwalk.
  'Goblin King': goblin('Goblin King', '{1}{R}{R}', 2, 2, [], [], {
    abilities: [{ kind: 'static', anthem: { filter: 'otherGoblins', power: 1, toughness: 1, keywords: ['Mountainwalk'] } }],
  }),
  // First strike / When this creature enters, it deals 1 damage to each opponent and each creature and planeswalker they control.
  'Goblin Chainwhirler': goblin('Goblin Chainwhirler', '{R}{R}{R}', 3, 3, ['First strike'], ['Warrior'], {
    abilities: [etb({ kind: 'damage', amount: 1, to: 'eachOpponentAndTheirCreatures' })],
  }),
  // Haste / {T}, Sacrifice this creature: It deals 1 damage to any target.
  'Fanatical Firebrand': goblin('Fanatical Firebrand', '{R}', 1, 1, ['Haste'], ['Pirate'], {
    abilities: [{ kind: 'activated', cost: '{T}', sacrifice: 'self', effect: burn(1) }],
  }),
  // Sacrifice this creature: It deals 1 damage to any target.
  'Mogg Fanatic': goblin('Mogg Fanatic', '{R}', 1, 1, [], [], { abilities: [{ kind: 'activated', cost: '', sacrifice: 'self', effect: burn(1) }] }),
  // When this creature dies, you may have it deal 1 damage to any target.
  'Goblin Arsonist': goblin('Goblin Arsonist', '{R}', 1, 1, [], ['Shaman'], {
    abilities: [{ kind: 'triggered', when: 'dies', target: 'any', optional: true, effect: burn(1) }],
  }),
  // {T}: This creature deals 1 damage to target player or planeswalker.
  'Goblin Fireslinger': goblin('Goblin Fireslinger', '{R}', 1, 1, [], ['Warrior'], { abilities: [tap(burn(1, 'player'))] }),
  // {T}: This creature deals 1 damage to each opponent. / Whenever you cast a Pirate spell, untap this creature.
  'Lightning-Rig Crew': goblin('Lightning-Rig Crew', '{2}{R}', 0, 5, [], ['Pirate'], {
    abilities: [
      tap({ kind: 'damage', amount: 1, to: 'eachOpponent' }),
      { kind: 'triggered', when: 'castSpell', filter: 'pirateSpell', effect: { kind: 'untapSelf' } },
    ],
  }),
  // When this creature enters, create a Treasure token.
  'Wily Goblin': goblin('Wily Goblin', '{R}{R}', 1, 1, [], ['Pirate'], { abilities: [etb(tokens(1, 'Treasure'))] }),
  // First strike, haste / {2}{R}, Sacrifice this creature: Draw a card and create a Treasure token.
  'Reckless Lackey': goblin('Reckless Lackey', '{R}', 1, 2, ['First strike', 'Haste'], ['Pirate'], {
    abilities: [{ kind: 'activated', cost: '{2}{R}', sacrifice: 'self', effect: [{ kind: 'draw', amount: 1 }, tokens(1, 'Treasure')] }],
  }),
  // Battle cry (Whenever this creature attacks, each other attacking creature gets +1/+0 until end of turn.)
  'Goblin Wardriver': goblin('Goblin Wardriver', '{R}{R}', 2, 2, [], ['Warrior'], {
    abilities: [{ kind: 'triggered', when: 'attacks', effect: { kind: 'pumpAll', filter: 'otherAttackingCreatures', power: 1, toughness: 0 } }],
  }),
  // This creature gets +2/+0 for each other Goblin you control.
  'Boneclub Berserker': goblin('Boneclub Berserker', '{3}{R}', 2, 4, [], ['Berserker'], {
    abilities: [{ kind: 'static', selfBoost: { per: 'otherGoblinsYouControl', power: 2 } }],
  }),
  // Haste / Reckless One's power and toughness are each equal to the number of Goblins on the battlefield.
  'Reckless One': goblin('Reckless One', '{3}{R}', 0, 0, ['Haste'], ['Avatar'], { cda: 'goblinsOnBattlefield' }),
  // Flying / Battle Squadron's power and toughness are each equal to the number of creatures you control.
  'Battle Squadron': goblin('Battle Squadron', '{3}{R}{R}', 0, 0, ['Flying'], [], { cda: 'creaturesYouControl' }),
  // When this creature enters, create a 1/1 red Goblin creature token. / {1}, {T}: Target creature you control with power 2 or less can't be blocked this turn.
  'Underfoot Underdogs': goblin('Underfoot Underdogs', '{2}{R}', 1, 2, [], ['Warrior'], {
    abilities: [etb(tokens(1)), { kind: 'activated', cost: '{1}{T}', effect: { kind: 'cantBeBlocked', target: 'creatureYouControlPower2' } }],
  }),
  // {T}: Target creature with power 2 or less can't be blocked this turn.
  'Goblin Tunneler': goblin('Goblin Tunneler', '{1}{R}', 1, 1, [], ['Rogue'], { abilities: [tap({ kind: 'cantBeBlocked', target: 'creaturePower2' })] }),
  // {T}: Target creature gains haste until end of turn.
  'Goblin Motivator': goblin('Goblin Motivator', '{R}', 1, 1, [], ['Warrior'], {
    abilities: [tap({ kind: 'pump', target: 'creature', power: 0, toughness: 0, keywords: ['Haste'] })],
  }),
  // {T}, Sacrifice a Goblin: Goblin creatures get +2/+0 until end of turn.
  'Goblin Lookout': goblin('Goblin Lookout', '{1}{R}', 1, 2, [], [], {
    abilities: [{ kind: 'activated', cost: '{T}', sacrifice: 'goblin', effect: { kind: 'pumpAll', filter: 'goblinCreatures', power: 2, toughness: 0 } }],
  }),
  // Sacrifice a Goblin: Target creature gets +1/+1 until end of turn.
  'Goblin Sledder': goblin('Goblin Sledder', '{R}', 1, 1, [], [], {
    abilities: [{ kind: 'activated', cost: '', sacrifice: 'goblin', effect: { kind: 'pump', target: 'creature', power: 1, toughness: 1 } }],
  }),
  // When this creature enters, it deals damage to target creature an opponent controls equal to the number of Goblins you control.
  'Volley Veteran': goblin('Volley Veteran', '{3}{R}', 4, 2, [], ['Warrior'], {
    abilities: [etb(burn({ count: 'goblinsYouControl' }, 'opponentCreature'), { target: 'opponentCreature' })],
  }),
  // {T}, Discard a card: Draw a card.
  'Rummaging Goblin': goblin('Rummaging Goblin', '{2}{R}', 1, 1, [], ['Rogue'], {
    abilities: [{ kind: 'activated', cost: '{T}', discard: 1, effect: { kind: 'draw', amount: 1 } }],
  }),
  // Whenever another red creature you control enters, this creature gets +1/+0 until end of turn.
  'Foundry Street Denizen': goblin('Foundry Street Denizen', '{R}', 1, 1, [], ['Warrior'], {
    abilities: [{ kind: 'triggered', when: 'creatureEnters', filter: 'anotherRedCreatureYouControl', effect: { kind: 'pumpSelf', power: 1, toughness: 0 } }],
  }),
  // When this creature dies, create a Treasure token. / {2}, {T}: Exile target card from a graveyard.
  'Magic Pot': {
    ...goblin('Magic Pot', '{3}', 1, 4, [], ['Construct']), types: ['Artifact', 'Creature'],
    abilities: [
      { kind: 'triggered', when: 'dies', effect: tokens(1, 'Treasure') },
      { kind: 'activated', cost: '{2}{T}', effect: { kind: 'exile', target: 'graveyardCard' } },
    ],
  },
  // Haste / Whenever this creature attacks, defending player reveals the top card of their library. If it's a land card, that player puts it into their hand.
  'Goblin Guide': goblin('Goblin Guide', '{R}', 2, 2, ['Haste'], ['Scout'], {
    abilities: [{ kind: 'triggered', when: 'attacks', effect: { kind: 'defenderRevealsTopLand' } }],
  }),
  // Menace
  'Boggart Brute': goblin('Boggart Brute', '{2}{R}', 3, 2, ['Menace'], ['Warrior']),
  // At the beginning of your upkeep, you may return this card from your graveyard to your hand.
  'Squee, Goblin Nabob': goblin('Squee, Goblin Nabob', '{2}{R}', 1, 1, [], [], {
    supertypes: ['Legendary'],
    abilities: [{ kind: 'triggered', when: 'upkeep', from: 'graveyard', effect: { kind: 'returnSelfToHand', optional: true } }],
  }),
  // Haste / When this creature enters, reveal the top four cards of your library. Put all Goblin cards revealed this way into your hand and the rest on the bottom of your library in any order.
  'Goblin Ringleader': goblin('Goblin Ringleader', '{3}{R}', 2, 2, ['Haste'], [], {
    abilities: [etb({ kind: 'revealTop', amount: 4, filter: 'goblinCard' })],
  }),

  // ---------- Mazzo "Tempesta di Talrand" (blu) ----------
  // Whenever you cast an instant or sorcery spell, create a 2/2 blue Drake creature token with flying.
  'Talrand, Sky Summoner': creature('Talrand, Sky Summoner', '{2}{U}{U}', 2, 2, [], ['Merfolk', 'Wizard'], {
    supertypes: ['Legendary'], abilities: [onSpell(tokens(1, 'Drake'))],
  }),
  // Whenever you cast an instant or sorcery spell, create a 1/1 blue Bird Illusion creature token with flying.
  'Murmuring Mystic': creature('Murmuring Mystic', '{3}{U}', 1, 5, [], ['Human', 'Wizard'], { abilities: [onSpell(tokens(1, 'Bird Illusion'))] }),
  // Magecraft — Whenever you cast or copy an instant or sorcery spell, draw a card.
  'Archmage Emeritus': creature('Archmage Emeritus', '{2}{U}{U}', 2, 2, [], ['Human', 'Wizard'], { abilities: [onSpell(draw(1))] }),
  // Instant and sorcery spells you cast cost {1} less to cast. / Whenever you cast an instant or sorcery spell, draw a card.
  'Archmage of Runes': creature('Archmage of Runes', '{3}{U}{U}', 3, 6, [], ['Giant', 'Wizard'], {
    abilities: [{ kind: 'static', costReduction: { filter: 'instantOrSorcerySpell', amount: 1 } }, onSpell(draw(1))],
  }),
  // Flying / Instant and sorcery spells you cast cost {1} less to cast.
  'Mocking Sprite': creature('Mocking Sprite', '{2}{U}', 2, 1, ['Flying'], ['Faerie', 'Rogue'], {
    abilities: [{ kind: 'static', costReduction: { filter: 'instantOrSorcerySpell', amount: 1 } }],
  }),
  // Flash / Flying / {3}{U}: Draw a card.
  'Spectral Sailor': creature('Spectral Sailor', '{U}', 1, 1, ['Flash', 'Flying'], ['Spirit', 'Pirate'], {
    abilities: [{ kind: 'activated', cost: '{3}{U}', effect: draw(1) }],
  }),
  // Flying / When this creature enters, untap up to five lands.
  'Peregrine Drake': creature('Peregrine Drake', '{4}{U}', 2, 3, ['Flying'], ['Drake'], { abilities: [etb({ kind: 'untapLands', amount: 5 })] }),
  // This creature can't be blocked.
  'Slither Blade': creature('Slither Blade', '{U}', 1, 2, ['Unblockable'], ['Snake', 'Rogue']),
  // This creature can't be blocked.
  'Triton Shorestalker': creature('Triton Shorestalker', '{U}', 1, 1, ['Unblockable'], ['Merfolk', 'Rogue']),
  // This creature can't be blocked.
  'Phantom Warrior': creature('Phantom Warrior', '{1}{U}{U}', 2, 2, ['Unblockable'], ['Illusion', 'Warrior']),
  // Hexproof / This creature can't be blocked.
  'Invisible Stalker': creature('Invisible Stalker', '{1}{U}', 1, 1, ['Hexproof', 'Unblockable'], ['Human', 'Rogue']),
  // Defender / Flying / Prevent all combat damage that would be dealt to and dealt by this creature.
  'Fog Bank': creature('Fog Bank', '{1}{U}', 0, 2, ['Defender', 'Flying'], ['Wall'], { abilities: [{ kind: 'static', preventCombatDamage: true }] }),
  // Flying / Whenever an opponent draws a card, you may draw two cards.
  'Consecrated Sphinx': creature('Consecrated Sphinx', '{4}{U}{U}', 4, 6, ['Flying'], ['Sphinx'], {
    abilities: [{ kind: 'triggered', when: 'opponentDraws', effect: { kind: 'may', effect: draw(2) } }],
  }),
  // Flying / You have no maximum hand size. / Whenever a creature token you control deals combat damage to a player, draw a card.
  'Curiosity Crafter': creature('Curiosity Crafter', '{3}{U}', 3, 3, ['Flying'], ['Bird', 'Wizard'], {
    abilities: [
      { kind: 'static', noMaxHandSize: true },
      { kind: 'triggered', when: 'combatDamageToPlayer', filter: 'creatureTokenYouControl', effect: draw(1) },
    ],
  }),
  // Flying / Creature spells with flying you cast cost {1} less to cast.
  'Warden of Evos Isle': creature('Warden of Evos Isle', '{2}{U}', 2, 2, ['Flying'], ['Bird', 'Wizard'], {
    abilities: [{ kind: 'static', costReduction: { filter: 'creatureWithFlyingSpell', amount: 1 } }],
  }),
  // {T}: Add {U}.
  'Silver Myr': { ...creature('Silver Myr', '{2}', 1, 1, [], ['Myr']), types: ['Artifact', 'Creature'], abilities: [{ kind: 'mana', cost: '{T}', produce: 'U' }] },
  // {T}: Add {C}{C}.
  'Palladium Myr': { ...creature('Palladium Myr', '{3}', 2, 2, [], ['Myr']), types: ['Artifact', 'Creature'], abilities: [{ kind: 'mana', cost: '{T}', produce: 'CC' }] },
  // {3}, Sacrifice this creature: Search your library for up to two basic land cards, put them onto the battlefield tapped, then shuffle.
  'Burnished Hart': {
    ...creature('Burnished Hart', '{3}', 2, 2, [], ['Elk']), types: ['Artifact', 'Creature'],
    abilities: [{ kind: 'activated', cost: '{3}', sacrifice: 'self', effect: { kind: 'search', filter: 'basicLand', to: 'battlefieldTapped', max: 2 } }],
  },
  // Flash / When Venser enters, return target spell or permanent to its owner's hand.
  'Venser, Shaper Savant': creature('Venser, Shaper Savant', '{2}{U}{U}', 2, 2, ['Flash'], ['Human', 'Wizard'], {
    supertypes: ['Legendary'], abilities: [etb({ kind: 'bounce', target: 'spellOrPermanent' }, { target: 'spellOrPermanent' })],
  }),
  // Creatures you control with power or toughness 1 or less can't be blocked.
  'Tetsuko Umezawa, Fugitive': creature('Tetsuko Umezawa, Fugitive', '{1}{U}', 1, 3, [], ['Human', 'Rogue'], {
    supertypes: ['Legendary'], abilities: [{ kind: 'static', anthem: { filter: 'creaturesYouControlPowerOrToughness1', keywords: ['Unblockable'] } }],
  }),
  // Flying
  'Air Elemental': creature('Air Elemental', '{3}{U}{U}', 4, 4, ['Flying'], ['Elemental']),
  // Flying
  'Mahamoti Djinn': creature('Mahamoti Djinn', '{4}{U}{U}', 5, 6, ['Flying'], ['Djinn']),
  // When this creature enters, return target creature to its owner's hand.
  "Man-o'-War": creature("Man-o'-War", '{2}{U}', 2, 2, [], ['Jellyfish'], { abilities: [etb({ kind: 'bounce', target: 'creature' }, { target: 'creature' })] }),
  // When this creature enters, look at the top two cards of your library. Put one of them into your hand and the other on the bottom of your library.
  'Sea Gate Oracle': creature('Sea Gate Oracle', '{2}{U}', 1, 3, [], ['Human', 'Wizard'], { abilities: [etb({ kind: 'lookTop', amount: 2, take: 1 })] }),
  // Flying / Whenever this creature deals damage to an opponent, draw a card.
  'Thieving Magpie': creature('Thieving Magpie', '{2}{U}{U}', 1, 3, ['Flying'], ['Bird'], {
    abilities: [{ kind: 'triggered', when: 'combatDamageToPlayer', effect: draw(1) }],
  }),
  // Whenever a creature you control deals combat damage to an opponent, you may draw a card.
  'Coastal Piracy': {
    name: 'Coastal Piracy', types: ['Enchantment'], cost: '{2}{U}{U}',
    abilities: [{ kind: 'triggered', when: 'combatDamageToPlayer', filter: 'creatureYouControl', effect: { kind: 'may', effect: draw(1) } }],
  },
  // This artifact enters tapped. / {T}: Add {U}.
  'Sky Diamond': { name: 'Sky Diamond', types: ['Artifact'], cost: '{2}', entersTapped: true, abilities: [{ kind: 'mana', cost: '{T}', produce: 'U' }] },
  // Blue spells you cast cost {1} less to cast.
  'Sapphire Medallion': { name: 'Sapphire Medallion', types: ['Artifact'], cost: '{2}', abilities: [{ kind: 'static', costReduction: { filter: 'blueSpell', amount: 1 } }] },
  // {T}: Add {C}{C}. / {2}, {T}, Sacrifice this artifact: Draw two cards.
  'Hedron Archive': {
    name: 'Hedron Archive', types: ['Artifact'], cost: '{4}',
    abilities: [{ kind: 'mana', cost: '{T}', produce: 'CC' }, { kind: 'activated', cost: '{2}{T}', sacrifice: 'self', effect: draw(2) }],
  },
  // {2}, {T}, Sacrifice this artifact: Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.
  "Wayfarer's Bauble": {
    name: "Wayfarer's Bauble", types: ['Artifact'], cost: '{1}',
    abilities: [{ kind: 'activated', cost: '{2}{T}', sacrifice: 'self', effect: { kind: 'search', filter: 'basicLand', to: 'battlefieldTapped', max: 1 } }],
  },
  // Counter target noncreature spell.
  Negate: instant('Negate', '{1}{U}', counter('noncreatureSpell')),
  // Counter target creature spell.
  'Essence Scatter': instant('Essence Scatter', '{1}{U}', counter('creatureSpell')),
  // Counter target spell.
  Cancel: instant('Cancel', '{1}{U}{U}', counter('spell')),
  // Counter target enchantment, instant, or sorcery spell. Its controller creates a 2/2 blue Bird creature token with flying.
  'Swan Song': instant('Swan Song', '{U}', counter('enchantmentInstantSorcerySpell', { token: 'Bird' })),
  // Counter target artifact, creature, or planeswalker spell. Its controller creates a 2/2 blue Bird creature token with flying.
  'Strix Serenade': instant('Strix Serenade', '{U}', counter('artifactCreaturePlaneswalkerSpell', { token: 'Bird' })),
  // Counter target spell. Its controller mills three cards.
  "Didn't Say Please": instant("Didn't Say Please", '{1}{U}{U}', counter('spell', { mill: 3 })),
  // Counter target spell. If that spell is countered this way, put it on top of its owner's library instead of into that player's graveyard.
  'Memory Lapse': instant('Memory Lapse', '{1}{U}', counter('spell', { toLibraryTop: true })),
  // Counter target noncreature spell. Untap up to three lands.
  Unwind: instant('Unwind', '{2}{U}', [counter('noncreatureSpell'), { kind: 'untapLands', amount: 3 }]),
  // Counter target spell. Untap up to four lands.
  Rewind: instant('Rewind', '{2}{U}{U}', [counter('spell'), { kind: 'untapLands', amount: 4 }]),
  // Scry 1. / Draw a card.
  Opt: instant('Opt', '{U}', [{ kind: 'scry', amount: 1 }, draw(1)]),
  // Draw three cards, then put two cards from your hand on top of your library in any order.
  Brainstorm: instant('Brainstorm', '{U}', [draw(3), { kind: 'putBack', amount: 2 }]),
  // Draw a card. Scry 2.
  'Serum Visions': sorcery('Serum Visions', '{U}', [draw(1), { kind: 'scry', amount: 2 }]),
  // Draw two cards.
  'Quick Study': instant('Quick Study', '{2}{U}', draw(2)),
  // Draw two cards.
  Divination: sorcery('Divination', '{2}{U}', draw(2)),
  // Draw two cards, then discard two cards. Untap up to three lands.
  'Frantic Search': instant('Frantic Search', '{2}{U}', [draw(2), { kind: 'discard', amount: 2 }, { kind: 'untapLands', amount: 3 }]),
  // Look at the top four cards of your library. Put one of them into your hand and the rest on the bottom of your library in any order.
  Impulse: instant('Impulse', '{1}{U}', { kind: 'lookTop', amount: 4, take: 1 }),
  // Look at the top two cards of your library. Put one of them into your hand and the other on the bottom of your library.
  'Sleight of Hand': sorcery('Sleight of Hand', '{U}', { kind: 'lookTop', amount: 2, take: 1 }),
  // Look at the top five cards of your library. Put two of them into your hand and the rest on the bottom of your library in any order.
  'Stock Up': sorcery('Stock Up', '{2}{U}', { kind: 'lookTop', amount: 5, take: 2 }),
  // Return target creature to its owner's hand.
  Unsummon: instant('Unsummon', '{U}', { kind: 'bounce', target: 'creature' }),
  // Return target creature to its owner's hand. Untap up to two lands.
  Snap: instant('Snap', '{1}{U}', [{ kind: 'bounce', target: 'creature' }, { kind: 'untapLands', amount: 2 }]),
  // Return target nonland permanent to its owner's hand. If you controlled that permanent, draw a card.
  'Boomerang Basics': sorcery('Boomerang Basics', '{U}', { kind: 'bounce', target: 'nonlandPermanent', drawIfYours: true }, { subtypes: ['Lesson'] }),
  // Return all creatures to their owners' hands.
  Evacuation: instant('Evacuation', '{3}{U}{U}', { kind: 'bounceAll', filter: 'creatures' }),
  // Return all attacking creatures to their owner's hand.
  Aetherize: instant('Aetherize', '{3}{U}', { kind: 'bounceAll', filter: 'attackingCreatures' }),
  // Destroy target creature. It can't be regenerated. Its controller creates a 3/3 green Ape creature token.
  Pongify: instant('Pongify', '{U}', { kind: 'destroy', target: 'creature', controllerToken: 'Ape' }),
  // Destroy target creature. It can't be regenerated. That creature's controller creates a 3/3 green Frog Lizard creature token.
  'Rapid Hybridization': instant('Rapid Hybridization', '{U}', { kind: 'destroy', target: 'creature', controllerToken: 'Frog Lizard' }),
  // Target creature can't be blocked this turn. / Draw a card.
  'Enter the Enigma': sorcery('Enter the Enigma', '{U}', [{ kind: 'cantBeBlocked', target: 'creature' }, draw(1)]),
  // Each opponent gets a poison counter. / Draw a card.
  'Prologue to Phyresis': instant('Prologue to Phyresis', '{1}{U}', [{ kind: 'poison', amount: 1, to: 'eachOpponent' }, draw(1)]),
  // Target player mills two cards. / Draw a card.
  'Thought Scour': instant('Thought Scour', '{U}', [{ kind: 'mill', amount: 2, target: 'player' }, draw(1)]),
  // Create two 2/2 blue Drake creature tokens with flying.
  "Talrand's Invocation": sorcery("Talrand's Invocation", '{2}{U}{U}', tokens(2, 'Drake')),

  // ---------- Mazzo "Ruggito di Ghalta" (verde) ----------
  // This spell costs {X} less to cast, where X is the total power of creatures you control. / Trample
  'Ghalta, Primal Hunger': creature('Ghalta, Primal Hunger', '{10}{G}{G}', 12, 12, ['Trample'], ['Elder', 'Dinosaur'], {
    supertypes: ['Legendary'], costReductionPer: 'totalPowerYouControl',
  }),
  // Green spells you cast cost {1} less to cast.
  'Emerald Medallion': { name: 'Emerald Medallion', types: ['Artifact'], cost: '{2}', abilities: [{ kind: 'static', costReduction: { filter: 'greenSpell', amount: 1 } }] },
  // Whenever a creature you control with power 3 or greater enters, draw a card.
  'Elemental Bond': {
    name: 'Elemental Bond', types: ['Enchantment'], cost: '{2}{G}',
    abilities: [{ kind: 'triggered', when: 'creatureEnters', filter: 'creatureYouControlPower3', effect: draw(1) }],
  },
  // Creatures you control have trample.
  'Primal Rage': { name: 'Primal Rage', types: ['Enchantment'], cost: '{1}{G}', abilities: [{ kind: 'static', anthem: { filter: 'creaturesYouControl', keywords: ['Trample'] } }] },
  // {1}{G}, Sacrifice this enchantment: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.
  'Font of Fertility': {
    name: 'Font of Fertility', types: ['Enchantment'], cost: '{G}',
    abilities: [{ kind: 'activated', cost: '{1}{G}', sacrifice: 'self', effect: searchLand('basicLand', 'battlefieldTapped') }],
  },
  // You may play an additional land on each of your turns.
  Exploration: { name: 'Exploration', types: ['Enchantment'], cost: '{G}', abilities: [{ kind: 'static', extraLandPlays: 1 }] },
  // {T}: Add {G}.
  'Llanowar Elves': creature('Llanowar Elves', '{G}', 1, 1, [], ['Elf', 'Druid'], { abilities: [greenMana] }),
  // {T}: Add {G}.
  'Elvish Mystic': creature('Elvish Mystic', '{G}', 1, 1, [], ['Elf', 'Druid'], { abilities: [greenMana] }),
  // {T}: Add {G}.
  'Fyndhorn Elves': creature('Fyndhorn Elves', '{G}', 1, 1, [], ['Elf', 'Druid'], { abilities: [greenMana] }),
  // Flying / {T}: Add one mana of any color.
  'Birds of Paradise': creature('Birds of Paradise', '{G}', 0, 1, ['Flying'], ['Bird'], { abilities: [{ kind: 'mana', cost: '{T}', produce: 'anyColor' }] }),
  // Sacrifice this creature: Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.
  'Sakura-Tribe Elder': creature('Sakura-Tribe Elder', '{1}{G}', 1, 1, [], ['Snake', 'Shaman'], {
    abilities: [{ kind: 'activated', cost: '', sacrifice: 'self', effect: searchLand('basicLand', 'battlefieldTapped') }],
  }),
  // When this creature enters, search your library for a Forest card, put that card onto the battlefield, then shuffle.
  'Wood Elves': creature('Wood Elves', '{2}{G}', 1, 1, [], ['Elf', 'Scout'], { abilities: [etb(searchLand('forestCard', 'battlefield'))] }),
  // When this creature enters, you may search your library for a basic land card, put it onto the battlefield tapped, then shuffle.
  'Farhaven Elf': creature('Farhaven Elf', '{2}{G}', 1, 1, [], ['Elf', 'Druid'], { abilities: [etb(searchLand('basicLand', 'battlefieldTapped'))] }),
  // {T}: Add {G} for each Elf on the battlefield.
  'Priest of Titania': creature('Priest of Titania', '{1}{G}', 1, 1, [], ['Elf', 'Druid'], {
    abilities: [{ kind: 'mana', cost: '{T}', produce: 'G', amount: { count: 'elvesOnBattlefield' } }],
  }),
  // Other Elf creatures you control get +1/+1. / {T}: Add {G} for each Elf you control.
  'Elvish Archdruid': creature('Elvish Archdruid', '{1}{G}{G}', 2, 2, [], ['Elf', 'Druid'], {
    abilities: [
      { kind: 'static', anthem: { filter: 'otherElfCreaturesYouControl', power: 1, toughness: 1 } },
      { kind: 'mana', cost: '{T}', produce: 'G', amount: { count: 'elvesYouControl' } },
    ],
  }),
  // {T}: Add {G}{G}{G}.
  'Llanowar Tribe': creature('Llanowar Tribe', '{G}{G}{G}', 3, 3, [], ['Elf', 'Druid'], { abilities: [{ kind: 'mana', cost: '{T}', produce: 'GGG' }] }),
  // {T}: Add {G} for each creature you control.
  'Circle of Dreams Druid': creature('Circle of Dreams Druid', '{G}{G}{G}', 2, 1, [], ['Elf', 'Druid'], {
    abilities: [{ kind: 'mana', cost: '{T}', produce: 'G', amount: { count: 'creaturesYouControl' } }],
  }),
  // Defender / When this creature enters, draw a card.
  'Wall of Blossoms': creature('Wall of Blossoms', '{1}{G}', 0, 4, ['Defender'], ['Plant', 'Wall'], { abilities: [etb(draw(1))] }),
  // Whenever you cast a creature spell, draw a card.
  'Beast Whisperer': creature('Beast Whisperer', '{2}{G}{G}', 2, 3, [], ['Elf', 'Druid'], {
    abilities: [{ kind: 'triggered', when: 'castSpell', filter: 'creatureSpell', effect: draw(1) }],
  }),
  // Whenever another creature you control with power 3 or greater enters, you may draw a card.
  "Garruk's Packleader": creature("Garruk's Packleader", '{4}{G}', 4, 4, [], ['Beast'], {
    abilities: [{ kind: 'triggered', when: 'creatureEnters', filter: 'anotherCreatureYouControlPower3', effect: { kind: 'may', effect: draw(1) } }],
  }),
  // Trample / Whenever another nontoken creature you control enters, you may draw a card.
  'Soul of the Harvest': creature('Soul of the Harvest', '{4}{G}{G}', 6, 6, ['Trample'], ['Elemental'], {
    abilities: [{ kind: 'triggered', when: 'creatureEnters', filter: 'anotherNontokenCreatureYouControl', effect: { kind: 'may', effect: draw(1) } }],
  }),
  // Trample / Landfall — Whenever a land you control enters, create a 4/4 green Beast creature token.
  'Rampaging Baloths': creature('Rampaging Baloths', '{4}{G}{G}', 6, 6, ['Trample'], ['Beast'], {
    abilities: [{ kind: 'triggered', when: 'landEnters', filter: 'landYouControl', effect: tokens(1, 'Beast 4/4') }],
  }),
  // Haste / When this creature enters, creatures you control gain trample and get +X/+X until end of turn, where X is the number of creatures you control.
  'Craterhoof Behemoth': creature('Craterhoof Behemoth', '{5}{G}{G}{G}', 5, 5, ['Haste'], ['Beast'], {
    abilities: [etb({ kind: 'pumpAll', filter: 'creaturesYouControl', power: { count: 'creaturesYouControl' }, toughness: { count: 'creaturesYouControl' }, keywords: ['Trample'] })],
  }),
  // Vigilance, trample, haste / When this creature enters, other creatures you control get +2/+2 and gain vigilance and trample until end of turn.
  'End-Raze Forerunners': creature('End-Raze Forerunners', '{5}{G}{G}{G}', 7, 7, ['Vigilance', 'Trample', 'Haste'], ['Boar'], {
    abilities: [etb({ kind: 'pumpAll', filter: 'otherCreaturesYouControl', power: 2, toughness: 2, keywords: ['Vigilance', 'Trample'] })],
  }),
  // Flying, deathtouch / When this creature enters, create four 1/1 green Insect creature tokens with flying and deathtouch.
  'Hornet Queen': creature('Hornet Queen', '{4}{G}{G}{G}', 2, 2, ['Flying', 'Deathtouch'], ['Insect'], { abilities: [etb(tokens(4, 'Insect'))] }),
  // Deathtouch / When this creature enters, destroy target artifact, enchantment, or land.
  'Acidic Slime': creature('Acidic Slime', '{3}{G}{G}', 2, 2, ['Deathtouch'], ['Ooze'], {
    abilities: [etb({ kind: 'destroy', target: 'artifactEnchantmentOrLand' }, { target: 'artifactEnchantmentOrLand' })],
  }),
  // When this creature enters, you may destroy target artifact or enchantment.
  'Reclamation Sage': creature('Reclamation Sage', '{2}{G}', 2, 1, [], ['Elf', 'Shaman'], {
    abilities: [etb({ kind: 'destroy', target: 'artifactOrEnchantment' }, { target: 'artifactOrEnchantment', optional: true })],
  }),
  // Trample / Lieutenant — As long as you control your commander, this creature gets +2/+2 and other creatures you control get +2/+2 and have trample.
  'Thunderfoot Baloth': creature('Thunderfoot Baloth', '{4}{G}{G}', 5, 5, ['Trample'], ['Beast'], {
    abilities: [
      { kind: 'static', selfBoost: { flat: true, power: 2, toughness: 2 }, condition: 'controlsCommander' },
      { kind: 'static', anthem: { filter: 'otherCreaturesYouControl', power: 2, toughness: 2, keywords: ['Trample'] }, condition: 'controlsCommander' },
    ],
  }),
  // Whenever this creature or another creature you control enters, you gain life equal to that creature's toughness.
  "Verdant Sun's Avatar": creature("Verdant Sun's Avatar", '{5}{G}{G}', 5, 5, [], ['Dinosaur', 'Avatar'], {
    abilities: [{ kind: 'triggered', when: 'creatureEnters', filter: 'creatureYouControl', effect: { kind: 'gainLife', amount: { count: 'subjectToughness' } } }],
  }),
  // Trample / This creature enters with four +1/+1 counters on it. / Whenever this creature attacks, double the number of +1/+1 counters on each creature you control.
  'Kalonian Hydra': creature('Kalonian Hydra', '{3}{G}{G}', 0, 0, ['Trample'], ['Hydra'], {
    entersWithCounters: 4, abilities: [{ kind: 'triggered', when: 'attacks', effect: { kind: 'doubleCounters' } }],
  }),
  // Flying / Whenever a creature you control deals combat damage to a player, create that many Treasure tokens.
  'Old Gnawbone': creature('Old Gnawbone', '{5}{G}{G}', 7, 7, ['Flying'], ['Dragon'], {
    supertypes: ['Legendary'],
    abilities: [{ kind: 'triggered', when: 'combatDamageToPlayer', filter: 'creatureYouControl', effect: tokens({ count: 'damageDealt' }, 'Treasure') }],
  }),
  // Trample / Other creatures you control have trample. / Whenever another nontoken creature you control enters, put a +1/+1 counter on it. It gains haste until end of turn.
  'Surrak and Goreclaw': creature('Surrak and Goreclaw', '{4}{G}{G}', 6, 5, ['Trample'], ['Human', 'Bear'], {
    supertypes: ['Legendary'],
    abilities: [
      { kind: 'static', anthem: { filter: 'otherCreaturesYouControl', keywords: ['Trample'] } },
      { kind: 'triggered', when: 'creatureEnters', filter: 'anotherNontokenCreatureYouControl',
        effect: [{ kind: 'putCounter', on: 'subject', amount: 1 }, { kind: 'pumpSubject', keywords: ['Haste'] }] },
    ],
  }),
  // Attacking creatures you control have deathtouch. / Whenever a creature you control deals combat damage to a player, draw a card.
  'Ohran Frostfang': creature('Ohran Frostfang', '{3}{G}{G}', 2, 6, [], ['Snake'], {
    supertypes: ['Snow'],
    abilities: [
      { kind: 'static', anthem: { filter: 'attackingCreaturesYouControl', keywords: ['Deathtouch'] } },
      { kind: 'triggered', when: 'combatDamageToPlayer', filter: 'creatureYouControl', effect: draw(1) },
    ],
  }),
  // Trample / When this creature enters, you gain 7 life. / When this creature dies, draw a card.
  'Pelakka Wurm': creature('Pelakka Wurm', '{4}{G}{G}{G}', 7, 7, ['Trample'], ['Wurm'], {
    abilities: [etb({ kind: 'gainLife', amount: 7 }), { kind: 'triggered', when: 'dies', effect: draw(1) }],
  }),
  // When this creature enters, you gain 5 life. / When this creature leaves the battlefield, create a 3/3 green Beast creature token.
  Thragtusk: creature('Thragtusk', '{4}{G}', 5, 3, [], ['Beast'], {
    abilities: [etb({ kind: 'gainLife', amount: 5 }), { kind: 'triggered', when: 'leaves', effect: tokens(1, 'Beast') }],
  }),
  // Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.
  Cultivate: sorcery('Cultivate', '{2}{G}', { kind: 'search', filter: 'basicLand', max: 2, split: ['battlefieldTapped', 'hand'] }),
  // (stesso testo di Cultivate)
  "Kodama's Reach": sorcery("Kodama's Reach", '{2}{G}', { kind: 'search', filter: 'basicLand', max: 2, split: ['battlefieldTapped', 'hand'] }, { subtypes: ['Arcane'] }),
  // Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.
  'Rampant Growth': sorcery('Rampant Growth', '{1}{G}', searchLand('basicLand', 'battlefieldTapped')),
  // Search your library for a Forest card, put that card onto the battlefield, then shuffle.
  "Nature's Lore": sorcery("Nature's Lore", '{1}{G}', searchLand('forestCard', 'battlefield')),
  // Search your library for a Forest card, put it onto the battlefield, then shuffle.
  'Three Visits': sorcery('Three Visits', '{1}{G}', searchLand('forestCard', 'battlefield')),
  // Search your library for up to two basic land cards, put them onto the battlefield tapped, then shuffle.
  'Explosive Vegetation': sorcery('Explosive Vegetation', '{3}{G}', searchLand('basicLand', 'battlefieldTapped', 2)),
  // Search your library for up to two Forest cards, put them onto the battlefield, then shuffle.
  'Skyshroud Claim': sorcery('Skyshroud Claim', '{3}{G}', searchLand('forestCard', 'battlefield', 2)),
  // As an additional cost to cast this spell, sacrifice a land. / Search your library for up to two basic land cards, put them onto the battlefield, then shuffle.
  Harrow: instant('Harrow', '{2}{G}', searchLand('basicLand', 'battlefield', 2), { additionalCost: { sacrifice: 'land' } }),
  // Search your library for up to two Forest cards, put them onto the battlefield tapped, then shuffle.
  "Ranger's Path": sorcery("Ranger's Path", '{3}{G}', searchLand('forestCard', 'battlefieldTapped', 2)),
  // Draw three cards.
  Harmonize: sorcery('Harmonize', '{2}{G}{G}', draw(3)),
  // Choose one — • Draw cards equal to the greatest power among non-Human creatures you control. • Non-Human creatures you control get +3/+3 until end of turn.
  'Return of the Wildspeaker': instant('Return of the Wildspeaker', '{4}{G}', null, {
    modeNames: ['Pesca carte pari alla forza massima dei tuoi non Umani', 'I tuoi non Umani prendono +3/+3'],
    modes: [
      { kind: 'draw', amount: { count: 'greatestPowerNonHumanYouControl' } },
      { kind: 'pumpAll', filter: 'nonHumanCreaturesYouControl', power: 3, toughness: 3 },
    ],
  }),
  // Draw a card for each creature you control. / Ferocious — You gain 4 life for each creature you control with power 4 or greater.
  'Shamanic Revelation': sorcery('Shamanic Revelation', '{3}{G}{G}', [
    { kind: 'draw', amount: { count: 'creaturesYouControl' } },
    { kind: 'gainLife', amount: { count: 'creaturesPower4YouControl', times: 4 } },
  ]),
  // Destroy target permanent. Its controller creates a 3/3 green Beast creature token.
  'Beast Within': instant('Beast Within', '{2}{G}', { kind: 'destroy', target: 'permanent', controllerToken: 'Beast' }),
  // Destroy target artifact or enchantment. Its controller gains 4 life.
  "Nature's Claim": instant("Nature's Claim", '{G}', { kind: 'destroy', target: 'artifactOrEnchantment', controllerGainsLife: 4 }),
  // Choose one — • Destroy target artifact. • Destroy target enchantment. • Exile target card from a graveyard.
  'Return to Nature': instant('Return to Nature', '{1}{G}', null, {
    modeNames: ['Distruggi un artefatto', 'Distruggi un incantesimo', 'Esilia una carta da un cimitero'],
    modes: [{ kind: 'destroy', target: 'artifact' }, { kind: 'destroy', target: 'enchantment' }, { kind: 'exile', target: 'graveyardCard' }],
  }),
  // Target creature you control deals damage equal to its power to target creature or planeswalker you don't control.
  'Bite Down': instant('Bite Down', '{1}{G}', { kind: 'bite', targets: ['creatureYouControl', 'creatureYouDontControl'] }),
  // Target creature gets +3/+3 until end of turn.
  'Giant Growth': instant('Giant Growth', '{G}', { kind: 'pump', target: 'creature', power: 3, toughness: 3 }),
  // Creatures you control get +3/+3 and gain trample until end of turn.
  Overrun: sorcery('Overrun', '{2}{G}{G}{G}', { kind: 'pumpAll', filter: 'creaturesYouControl', power: 3, toughness: 3, keywords: ['Trample'] }),
  // Target creature you control gets +2/+2 and gains hexproof until end of turn.
  'Blossoming Defense': instant('Blossoming Defense', '{G}', { kind: 'pump', target: 'creatureYouControl', power: 2, toughness: 2, keywords: ['Hexproof'] }),
  // Target creature you control gets +3/+3 and gains trample, hexproof, and indestructible until end of turn.
  Overprotect: instant('Overprotect', '{1}{G}', {
    kind: 'pump', target: 'creatureYouControl', power: 3, toughness: 3, keywords: ['Trample', 'Hexproof', 'Indestructible'],
  }),
  // Permanents you control gain hexproof and indestructible until end of turn.
  'Heroic Intervention': instant('Heroic Intervention', '{1}{G}', { kind: 'pumpAll', filter: 'permanentsYouControl', keywords: ['Hexproof', 'Indestructible'] }),
  // Until end of turn, creatures you control gain trample and get +X/+X, where X is the greatest power among creatures you control.
  'Overwhelming Stampede': sorcery('Overwhelming Stampede', '{3}{G}{G}', {
    kind: 'pumpAll', filter: 'creaturesYouControl', power: { count: 'greatestPowerYouControl' }, toughness: { count: 'greatestPowerYouControl' }, keywords: ['Trample'],
  }),

  // ---------- Mazzo "Banchetto di Syr Konrad" (nero) ----------
  // Whenever another creature dies, or a creature card is put into a graveyard from anywhere other than the battlefield,
  // or a creature card leaves your graveyard, Syr Konrad deals 1 damage to each opponent. / {1}{B}: Each player mills a card.
  'Syr Konrad, the Grim': creature('Syr Konrad, the Grim', '{3}{B}{B}', 5, 4, [], ['Human', 'Knight'], {
    supertypes: ['Legendary'],
    abilities: [
      { kind: 'triggered', when: 'dies', filter: 'anotherCreature', effect: pingOpponents(1) },
      { kind: 'triggered', when: 'creatureCardToGraveyard', effect: pingOpponents(1) },
      { kind: 'triggered', when: 'creatureCardLeavesYourGraveyard', effect: pingOpponents(1) },
      { kind: 'activated', cost: '{1}{B}', effect: { kind: 'mill', amount: 1, who: 'eachPlayer' } },
    ],
  }),
  // {2}, {T}: Add {B} for each Swamp you control.
  'Cabal Coffers': { name: 'Cabal Coffers', types: ['Land'], abilities: [{ kind: 'mana', cost: '{2}{T}', produce: 'B', amount: { count: 'swampsYouControl' } }] },
  // This land enters tapped unless you control a Swamp. / {T}: Add {B}. / {1}{B}{B}, {T}: Draw a card, then you lose life equal to the number of cards in your hand.
  'Castle Locthwain': {
    name: 'Castle Locthwain', types: ['Land'], entersTappedUnless: 'controlsSwamp',
    abilities: [blackMana, { kind: 'activated', cost: '{1}{B}{B}{T}', effect: [draw(1), { kind: 'loseLife', amount: { count: 'handSize' } }] }],
  },
  // You have no maximum hand size. / {T}: Add {C}.
  'Reliquary Tower': { name: 'Reliquary Tower', types: ['Land'], abilities: [{ kind: 'static', noMaxHandSize: true }, { kind: 'mana', cost: '{T}', produce: 'C' }] },
  // This land enters tapped. / When this land enters, exile target player's graveyard. / {T}: Add {B}.
  'Bojuka Bog': {
    name: 'Bojuka Bog', types: ['Land'], entersTapped: true,
    abilities: [etb({ kind: 'exileGraveyard', target: 'player' }, { target: 'player' }), blackMana],
  },
  // Black spells you cast cost {1} less to cast.
  'Jet Medallion': { name: 'Jet Medallion', types: ['Artifact'], cost: '{2}', abilities: [{ kind: 'static', costReduction: { filter: 'blackSpell', amount: 1 } }] },
  // This artifact enters tapped. / {1}, {T}: Destroy all artifacts, creatures, and enchantments.
  "Nevinyrral's Disk": {
    name: "Nevinyrral's Disk", types: ['Artifact'], cost: '{4}', entersTapped: true,
    abilities: [{ kind: 'activated', cost: '{1}{T}', effect: { kind: 'destroyAll', filter: 'artifactsCreaturesEnchantments' } }],
  },
  // Flash / Whenever a creature you control dies, each opponent sacrifices a creature of their choice.
  'Dictate of Erebos': {
    name: 'Dictate of Erebos', types: ['Enchantment'], cost: '{3}{B}{B}', keywords: ['Flash'],
    abilities: [{ kind: 'triggered', when: 'dies', filter: 'creatureYouControl', effect: { kind: 'eachSacrifices', who: 'eachOpponent' } }],
  },
  // Whenever a creature you control dies, each other player sacrifices a creature of their choice.
  'Grave Pact': {
    name: 'Grave Pact', types: ['Enchantment'], cost: '{1}{B}{B}{B}',
    abilities: [{ kind: 'triggered', when: 'dies', filter: 'creatureYouControl', effect: { kind: 'eachSacrifices', who: 'eachOpponent' } }],
  },
  // When this enchantment enters, create a 1/1 white Human Soldier creature token. / Whenever a creature you control dies, each opponent loses 1 life and you gain 1 life.
  'Bastion of Remembrance': {
    name: 'Bastion of Remembrance', types: ['Enchantment'], cost: '{2}{B}',
    abilities: [etb(tokens(1, 'Human Soldier')), { kind: 'triggered', when: 'dies', filter: 'creatureYouControl', effect: { kind: 'drain', amount: 1 } }],
  },
  // Sacrifice a creature: Scry 1.
  'Viscera Seer': creature('Viscera Seer', '{B}', 1, 1, [], ['Vampire', 'Wizard'], {
    abilities: [{ kind: 'activated', cost: '', sacrifice: 'creature', effect: { kind: 'scry', amount: 1 } }],
  }),
  // This creature can't block. / Sacrifice a creature: Put a +1/+1 counter on this creature.
  'Carrion Feeder': creature('Carrion Feeder', '{B}', 1, 1, [], ['Zombie'], {
    abilities: [{ kind: 'static', cantBlock: true }, { kind: 'activated', cost: '', sacrifice: 'creature', effect: { kind: 'putCounter', on: 'self', amount: 1 } }],
  }),
  // Whenever this creature or another creature dies, target player loses 1 life and you gain 1 life.
  'Blood Artist': creature('Blood Artist', '{1}{B}', 0, 1, [], ['Vampire'], { abilities: [artistDrain] }),
  // Flying / Whenever this creature or another creature dies, target player loses 1 life and you gain 1 life.
  'Falkenrath Noble': creature('Falkenrath Noble', '{3}{B}', 2, 2, ['Flying'], ['Vampire', 'Noble'], { abilities: [artistDrain] }),
  // Whenever this creature or another creature you control dies, each opponent loses 1 life and you gain 1 life.
  'Zulaport Cutthroat': creature('Zulaport Cutthroat', '{1}{B}', 1, 1, [], ['Human', 'Rogue', 'Ally'], {
    abilities: [{ kind: 'triggered', when: 'dies', filter: 'creatureYouControl', effect: { kind: 'drain', amount: 1 } }],
  }),
  // Flying / Whenever this creature or another creature you control dies, each opponent sacrifices a creature of their choice.
  'Butcher of Malakir': creature('Butcher of Malakir', '{5}{B}{B}', 5, 4, ['Flying'], ['Vampire', 'Warrior'], {
    abilities: [{ kind: 'triggered', when: 'dies', filter: 'creatureYouControl', effect: { kind: 'eachSacrifices', who: 'eachOpponent' } }],
  }),
  // When this creature enters, each player sacrifices a creature of their choice.
  'Fleshbag Marauder': creature('Fleshbag Marauder', '{2}{B}', 3, 1, [], ['Zombie', 'Warrior'], { abilities: [etb({ kind: 'eachSacrifices', who: 'eachPlayer' })] }),
  // When this creature enters, each player sacrifices a creature or planeswalker of their choice. Each player who can't discards a card.
  Plaguecrafter: creature('Plaguecrafter', '{2}{B}', 3, 2, [], ['Human', 'Shaman'], {
    abilities: [etb({ kind: 'eachSacrifices', who: 'eachPlayer', discardIfCant: true })],
  }),
  // When this creature enters, each player sacrifices a creature of their choice.
  'Merciless Executioner': creature('Merciless Executioner', '{2}{B}', 3, 1, [], ['Orc', 'Warrior'], { abilities: [etb({ kind: 'eachSacrifices', who: 'eachPlayer' })] }),
  // When this creature enters, each opponent loses X life, where X is your devotion to black. You gain life equal to the life lost this way.
  'Gray Merchant of Asphodel': creature('Gray Merchant of Asphodel', '{3}{B}{B}', 2, 4, [], ['Zombie'], {
    abilities: [etb({ kind: 'drain', amount: { count: 'devotionBlack' }, gainTotal: true })],
  }),
  // Flying / When Kokusho dies, each opponent loses 5 life. You gain life equal to the life lost this way.
  'Kokusho, the Evening Star': creature('Kokusho, the Evening Star', '{4}{B}{B}', 5, 5, ['Flying'], ['Dragon', 'Spirit'], {
    supertypes: ['Legendary'], abilities: [{ kind: 'triggered', when: 'dies', effect: { kind: 'drain', amount: 5, gainTotal: true } }],
  }),
  // Whenever a nontoken creature you control dies, this creature deals 1 damage to you and you draw a card.
  'Midnight Reaper': creature('Midnight Reaper', '{2}{B}', 3, 2, [], ['Zombie', 'Knight'], {
    abilities: [{ kind: 'triggered', when: 'dies', filter: 'nontokenCreatureYouControl', effect: [{ kind: 'damage', amount: 1, to: 'you' }, draw(1)] }],
  }),
  // Whenever one or more other creatures die, draw a card. This ability triggers only once each turn.
  'Morbid Opportunist': creature('Morbid Opportunist', '{2}{B}', 1, 3, [], ['Human', 'Rogue'], {
    abilities: [{ kind: 'triggered', when: 'dies', filter: 'anotherCreature', oncePerTurn: true, effect: draw(1) }],
  }),
  // When this creature enters, mill three cards. / Whenever a creature dies or a creature card is put into a graveyard from a library, each opponent loses 1 life.
  Dreadhound: creature('Dreadhound', '{4}{B}{B}', 6, 6, [], ['Demon', 'Dog'], {
    abilities: [
      etb({ kind: 'mill', amount: 3, who: 'you' }),
      { kind: 'triggered', when: 'dies', filter: 'anyCreature', effect: opponentsLose(1) },
      { kind: 'triggered', when: 'creatureCardToGraveyard', from: 'library', effect: opponentsLose(1) },
    ],
  }),
  // Whenever this creature or another Zombie dies, each opponent loses 1 life.
  'Vengeful Dead': creature('Vengeful Dead', '{3}{B}', 3, 2, [], ['Zombie'], {
    abilities: [{ kind: 'triggered', when: 'dies', filter: 'selfOrZombie', effect: opponentsLose(1) }],
  }),
  // When this creature enters, creatures your opponents control get -2/-2 until end of turn. / Whenever a creature an opponent controls dies, that player loses 2 life.
  'Massacre Wurm': creature('Massacre Wurm', '{3}{B}{B}{B}', 6, 5, [], ['Phyrexian', 'Wurm'], {
    abilities: [
      etb({ kind: 'pumpAll', filter: 'creaturesOpponentsControl', power: -2, toughness: -2 }),
      { kind: 'triggered', when: 'dies', filter: 'creatureOpponentControls', effect: { kind: 'loseLife', amount: 2, to: 'subjectController' } },
    ],
  }),
  // Whenever Ayara or another black creature you control enters, each opponent loses 1 life and you gain 1 life. / {T}, Sacrifice another black creature: Draw a card.
  'Ayara, First of Locthwain': creature('Ayara, First of Locthwain', '{B}{B}{B}', 2, 3, [], ['Elf', 'Noble'], {
    supertypes: ['Legendary'],
    abilities: [
      { kind: 'triggered', when: 'creatureEnters', filter: 'blackCreatureYouControl', effect: { kind: 'drain', amount: 1 } },
      { kind: 'activated', cost: '{T}', sacrifice: 'anotherBlackCreature', effect: draw(1) },
    ],
  }),
  // Sacrifice this creature: Add {B}.
  'Blood Pet': creature('Blood Pet', '{B}', 1, 1, [], ['Thrull'], { abilities: [{ kind: 'mana', cost: '', sacrifice: 'self', produce: 'B' }] }),
  // When this creature enters or dies, mill three cards.
  "Stitcher's Supplier": creature("Stitcher's Supplier", '{B}', 1, 1, [], ['Zombie'], {
    abilities: [etb({ kind: 'mill', amount: 3, who: 'you' }), { kind: 'triggered', when: 'dies', effect: { kind: 'mill', amount: 3, who: 'you' } }],
  }),
  // When this creature dies, it deals 2 damage to each opponent and you gain 2 life.
  'Serrated Scorpion': creature('Serrated Scorpion', '{B}', 1, 2, [], ['Scorpion'], {
    abilities: [{ kind: 'triggered', when: 'dies', effect: [pingOpponents(2), { kind: 'gainLife', amount: 2 }] }],
  }),
  // When this creature enters, you may return target creature card from your graveyard to your hand.
  Gravedigger: creature('Gravedigger', '{3}{B}', 2, 2, [], ['Zombie'], {
    abilities: [etb({ kind: 'bounce', target: 'creatureCardInYourGraveyard' }, { target: 'creatureCardInYourGraveyard', optional: true })],
  }),
  // When this creature enters, destroy target creature an opponent controls.
  'Ravenous Chupacabra': creature('Ravenous Chupacabra', '{2}{B}{B}', 2, 2, [], ['Beast', 'Horror'], {
    abilities: [etb({ kind: 'destroy', target: 'opponentCreature' }, { target: 'opponentCreature' })],
  }),
  // Deathtouch / Whenever this creature enters or attacks, create two 2/2 black Zombie creature tokens.
  'Grave Titan': creature('Grave Titan', '{4}{B}{B}', 6, 6, ['Deathtouch'], ['Giant'], {
    abilities: [etb(tokens(2, 'Zombie')), { kind: 'triggered', when: 'attacks', effect: tokens(2, 'Zombie') }],
  }),
  // Whenever another creature you control dies, create a Treasure token.
  'Pitiless Plunderer': creature('Pitiless Plunderer', '{3}{B}', 1, 4, [], ['Human', 'Pirate'], {
    abilities: [{ kind: 'triggered', when: 'dies', filter: 'anotherCreatureYouControl', effect: tokens(1, 'Treasure') }],
  }),
  // Whenever another creature you control dies, this creature deals 1 damage to each opponent and you gain 1 life.
  'Vindictive Vampire': creature('Vindictive Vampire', '{3}{B}', 2, 3, [], ['Vampire'], {
    abilities: [{ kind: 'triggered', when: 'dies', filter: 'anotherCreatureYouControl', effect: [pingOpponents(1), { kind: 'gainLife', amount: 1 }] }],
  }),
  // Other Zombie creatures you control get +1/+1. / {2}{B}, {T}: Exile target creature card from a graveyard. Create a 2/2 black Zombie creature token.
  'Cemetery Reaper': creature('Cemetery Reaper', '{1}{B}{B}', 2, 2, [], ['Zombie'], {
    abilities: [
      { kind: 'static', anthem: { filter: 'otherZombieCreaturesYouControl', power: 1, toughness: 1 } },
      { kind: 'activated', cost: '{2}{B}{T}', effect: [{ kind: 'exile', target: 'creatureCardInGraveyard' }, tokens(1, 'Zombie')] },
    ],
  }),
  // As an additional cost to cast this spell, sacrifice an artifact or creature. / Draw two cards and create a Treasure token.
  'Deadly Dispute': instant('Deadly Dispute', '{1}{B}', [draw(2), tokens(1, 'Treasure')], { additionalCost: { sacrifice: 'artifactOrCreature' } }),
  // As an additional cost to cast this spell, sacrifice a creature. / Draw two cards.
  'Village Rites': instant('Village Rites', '{B}', draw(2), { additionalCost: { sacrifice: 'creature' } }),
  // As an additional cost to cast this spell, sacrifice a creature. / Add {B}{B}{B}{B}.
  'Culling the Weak': instant('Culling the Weak', '{B}', { kind: 'addMana', color: 'B', amount: 4 }, { additionalCost: { sacrifice: 'creature' } }),
  // Add {B}{B}{B}.
  'Dark Ritual': instant('Dark Ritual', '{B}', { kind: 'addMana', color: 'B', amount: 3 }),
  // Put target creature card from a graveyard onto the battlefield under your control. You lose life equal to that card's mana value.
  Reanimate: sorcery('Reanimate', '{B}', { kind: 'reanimate', target: 'creatureCardInGraveyard', loseLifeMV: true }),
  // Each player puts a creature card from their graveyard onto the battlefield.
  Exhume: sorcery('Exhume', '{1}{B}', { kind: 'exhume' }),
  // Choose two target creature cards in your graveyard. Sacrifice a creature. If you do, return the chosen cards to the battlefield tapped.
  Victimize: sorcery('Victimize', '{2}{B}', { kind: 'victimize', targets: ['creatureCardInYourGraveyard', 'creatureCardInYourGraveyard'] }),
  // Each player exiles all creature cards from their graveyard, then sacrifices all creatures they control, then puts all cards they exiled this way onto the battlefield.
  'Living Death': sorcery('Living Death', '{3}{B}{B}', { kind: 'livingDeath' }),
  // Put all creature cards from all graveyards onto the battlefield under your control.
  'Rise of the Dark Realms': sorcery('Rise of the Dark Realms', '{7}{B}{B}', { kind: 'riseAll' }),
  // Target player draws two cards and loses 2 life.
  'Sign in Blood': sorcery('Sign in Blood', '{B}{B}', { kind: 'targetDrawsLoses', target: 'player', draw: 2, lose: 2 }),
  // You draw two cards and lose 2 life.
  "Night's Whisper": sorcery("Night's Whisper", '{1}{B}', [draw(2), { kind: 'loseLife', amount: 2 }]),
  // Scry 2, then draw two cards. You lose 2 life.
  'Read the Bones': sorcery('Read the Bones', '{2}{B}', [{ kind: 'scry', amount: 2 }, draw(2), { kind: 'loseLife', amount: 2 }]),
  // Look at the top three cards of your library. Put two of them into your hand and the other into your graveyard. Dark Bargain deals 2 damage to you.
  'Dark Bargain': instant('Dark Bargain', '{3}{B}', [{ kind: 'lookTop', amount: 3, take: 2, rest: 'graveyard' }, { kind: 'damage', amount: 2, to: 'you' }]),
  // Destroy all creatures. They can't be regenerated.
  Damnation: sorcery('Damnation', '{2}{B}{B}', { kind: 'destroyAll', filter: 'creatures' }),
  // Destroy target creature or planeswalker.
  "Hero's Downfall": instant("Hero's Downfall", '{1}{B}{B}', { kind: 'destroy', target: 'creatureOrPlaneswalker' }),
  // Destroy target creature. You lose 2 life.
  'Infernal Grasp': instant('Infernal Grasp', '{1}{B}', [{ kind: 'destroy', target: 'creature' }, { kind: 'loseLife', amount: 2 }]),
  // Destroy target nonartifact creature.
  'Go for the Throat': instant('Go for the Throat', '{1}{B}', { kind: 'destroy', target: 'nonartifactCreature' }),
  // Destroy target nonblack creature.
  'Doom Blade': instant('Doom Blade', '{1}{B}', { kind: 'destroy', target: 'nonblackCreature' }),
  // Destroy target creature or enchantment an opponent controls. You lose life equal to that permanent's mana value.
  'Feed the Swarm': sorcery('Feed the Swarm', '{1}{B}', { kind: 'destroy', target: 'creatureOrEnchantmentOpponentControls', loseLifeMV: true }),
  // Each player sacrifices all permanents they control that are one or more colors.
  'All Is Dust': { ...sorcery('All Is Dust', '{7}', { kind: 'sacrificeAllColored' }), types: ['Kindred', 'Sorcery'], subtypes: ['Eldrazi'] },
  // As an additional cost to cast this spell, sacrifice a creature. / Destroy target creature.
  'Bone Splinters': sorcery('Bone Splinters', '{B}', { kind: 'destroy', target: 'creature' }, { additionalCost: { sacrifice: 'creature' } }),
  // Search your library for a card, put that card into your hand, then shuffle.
  'Diabolic Tutor': sorcery('Diabolic Tutor', '{2}{B}{B}', { kind: 'search', filter: 'anyCard', to: 'hand', max: 1 }),
  // Search your library for a card, put that card into your hand, then shuffle.
  'Demonic Tutor': sorcery('Demonic Tutor', '{1}{B}', { kind: 'search', filter: 'anyCard', to: 'hand', max: 1 }),
  // Search your library for a card, then shuffle and put that card on top. You lose 2 life.
  'Vampiric Tutor': instant('Vampiric Tutor', '{B}', [{ kind: 'search', filter: 'anyCard', to: 'libraryTop', max: 1 }, { kind: 'loseLife', amount: 2 }]),
};

// Token che le carte possono creare (CR 111)
const TOKENS = {
  Goblin: { name: 'Goblin', types: ['Creature'], subtypes: ['Goblin'], colors: ['R'], power: 1, toughness: 1 },
  Drake: { name: 'Drake', types: ['Creature'], subtypes: ['Drake'], colors: ['U'], power: 2, toughness: 2, keywords: ['Flying'] },
  Bird: { name: 'Bird', types: ['Creature'], subtypes: ['Bird'], colors: ['U'], power: 2, toughness: 2, keywords: ['Flying'] },
  'Bird Illusion': { name: 'Bird Illusion', types: ['Creature'], subtypes: ['Bird', 'Illusion'], colors: ['U'], power: 1, toughness: 1, keywords: ['Flying'] },
  Ape: { name: 'Ape', types: ['Creature'], subtypes: ['Ape'], colors: ['G'], power: 3, toughness: 3 },
  'Frog Lizard': { name: 'Frog Lizard', types: ['Creature'], subtypes: ['Frog', 'Lizard'], colors: ['G'], power: 3, toughness: 3 },
  Beast: { name: 'Beast', types: ['Creature'], subtypes: ['Beast'], colors: ['G'], power: 3, toughness: 3 },
  'Beast 4/4': { name: 'Beast', types: ['Creature'], subtypes: ['Beast'], colors: ['G'], power: 4, toughness: 4 },
  'Human Soldier': { name: 'Human Soldier', types: ['Creature'], subtypes: ['Human', 'Soldier'], colors: ['W'], power: 1, toughness: 1 },
  Zombie: { name: 'Zombie', types: ['Creature'], subtypes: ['Zombie'], colors: ['B'], power: 2, toughness: 2 },
  Insect: { name: 'Insect', types: ['Creature'], subtypes: ['Insect'], colors: ['G'], power: 1, toughness: 1, keywords: ['Flying', 'Deathtouch'] },
  // Treasure: artifact with "{T}, Sacrifice this token: Add one mana of any color."
  Treasure: {
    name: 'Treasure', types: ['Artifact'], subtypes: ['Treasure'], colors: [],
    abilities: [{ kind: 'mana', cost: '{T}', sacrifice: 'self', produce: 'anyColor' }],
  },
};

function getCard(name) {
  const def = CARDS[name];
  if (!def) throw new Error(`Carta non definita nel motore: ${name}`);
  return def;
}

function getToken(name) {
  const def = TOKENS[name];
  if (!def) throw new Error(`Token non definito nel motore: ${name}`);
  return def;
}

module.exports = { CARDS, TOKENS, getCard, getToken };
