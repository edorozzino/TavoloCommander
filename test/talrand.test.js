// Carte del mazzo iniziale "Tempesta di Talrand". Testo verificato su Scryfall.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo, addMana, attackWith, castCard, resolveAll, tokensOf, named, passAll } = require('./helpers');

const U = (n) => Array(n).fill('Island');
const main = (opts) => { const g = commanderGame({ commander: 'Talrand, Sky Summoner', land: 'Island', ...opts }); advanceTo(g, 'main1'); return g; };
const on = (g, pid, name, opts) => g.setup.putOnBattlefield(pid, name, opts);
const act = (g, pid, object, extra = {}) => g.perform(pid, { type: 'activate', object, ...extra });
const hand = (g, pid = 'A') => g.zone(pid, 'hand').length;
const lib = (g, pid = 'A') => g.zone(pid, 'library');
const blockFails = (g, blocker, attacker) => assert.throws(
  () => g.perform('B', { type: 'declareBlockers', blocks: [{ blocker, attacker }] }), (e) => e.code === 'INVALID_BLOCK');

// Nella fase principale di B, B lancia una magia; gli altri passano finché la priorità arriva ad A per rispondere
function opponentCasts(g, name, mana) {
  advanceTo(g, 'main1', 2);
  const spell = g.setup.putInHand('B', name);
  addMana(g, 'B', mana);
  g.perform('B', { type: 'cast', object: spell });
  while (g.priority !== 'A') g.perform(g.priority, { type: 'pass' });
  return g.stack.at(-1).id;
}

// ---------- Comandante e motori di magie ----------
test('Talrand: ogni istantaneo o stregoneria che lanci crea un Drake 2/2 volante; una creatura no', () => {
  const g = main();
  on(g, 'A', 'Talrand, Sky Summoner');
  castCard(g, 'A', 'Quick Study', U(3));
  assert.equal(g.stack.at(-1).isAbility, true); // l'innesco si risolve prima della magia
  resolveAll(g);
  const [drake] = tokensOf(g, 'A');
  assert.equal(drake.name, 'Drake');
  assert.deepEqual([g.power(drake), g.toughness(drake), g.hasKw(drake, 'Flying')], [2, 2, true]);
  castCard(g, 'A', 'Silver Myr', U(2));
  resolveAll(g);
  assert.equal(tokensOf(g, 'A').length, 1);
});

test('Murmuring Mystic: ogni istantaneo o stregoneria crea un Uccello Illusione 1/1 volante', () => {
  const g = main();
  on(g, 'A', 'Murmuring Mystic');
  castCard(g, 'A', 'Opt', U(1));
  resolveAll(g);
  const [bird] = tokensOf(g, 'A');
  assert.deepEqual([bird.name, g.power(bird), g.hasKw(bird, 'Flying')], ['Bird Illusion', 1, true]);
});

test('Archmage Emeritus: magecraft, pesca una carta per ogni istantaneo o stregoneria', () => {
  const g = main();
  on(g, 'A', 'Archmage Emeritus');
  const before = hand(g);
  castCard(g, 'A', 'Divination', U(3));
  resolveAll(g);
  assert.equal(hand(g), before + 3);
});

test('Archmage of Runes: istantanei e stregonerie costano {1} in meno e fanno pescare', () => {
  const g = main();
  on(g, 'A', 'Archmage of Runes');
  const id = g.setup.putInHand('A', 'Quick Study');
  assert.equal(g.costToCast('A', id), '{1}{U}');
  const before = hand(g);
  addMana(g, 'A', U(2));
  g.perform('A', { type: 'cast', object: id });
  resolveAll(g);
  assert.equal(hand(g), before - 1 + 1 + 2);
});

test('Mocking Sprite: Volare; istantanei e stregonerie costano {1} in meno, le creature no', () => {
  const g = main();
  const sprite = on(g, 'A', 'Mocking Sprite');
  assert.equal(g.hasKw(g.object(sprite), 'Flying'), true);
  assert.equal(g.costToCast('A', g.setup.putInHand('A', 'Divination')), '{1}{U}');
  assert.equal(g.costToCast('A', g.setup.putInHand('A', 'Air Elemental')), '{3}{U}{U}');
});

// ---------- Creature ----------
test('Spectral Sailor: Lampo e Volare; {3}{U}: pesca una carta', () => {
  const g = commanderGame();
  const sailor = g.setup.putInHand('B', 'Spectral Sailor');
  g.perform('A', { type: 'pass' });
  addMana(g, 'B', U(1));
  g.perform('B', { type: 'cast', object: sailor });
  passAll(g);
  const s = named(g, 'B', 'battlefield', 'Spectral Sailor')[0];
  assert.equal(g.hasKw(s, 'Flying'), true);
  const before = hand(g, 'B');
  g.perform('A', { type: 'pass' }); // dopo la risoluzione la priorità torna ad A
  addMana(g, 'B', U(4));
  g.perform('B', { type: 'activate', object: s.id });
  resolveAll(g);
  assert.equal(hand(g, 'B'), before + 1);
});

test('Peregrine Drake: Volare; entrando stappa fino a cinque terre', () => {
  const g = main();
  addMana(g, 'A', U(5));
  castCard(g, 'A', 'Peregrine Drake');
  resolveAll(g);
  const islands = named(g, 'A', 'battlefield', 'Island');
  assert.equal(islands.filter((o) => !o.tapped).length, 5);
});

test('Slither Blade, Triton Shorestalker, Phantom Warrior e Invisible Stalker non possono essere bloccate', () => {
  const g = commanderGame();
  const attackers = ['Slither Blade', 'Triton Shorestalker', 'Phantom Warrior', 'Invisible Stalker'].map((n) => on(g, 'A', n));
  const wall = on(g, 'B', 'Wall of Wood');
  attackWith(g, attackers.map((id) => [id, 'B']));
  advanceTo(g, 'declareBlockers');
  for (const a of attackers) blockFails(g, wall, a);
  assert.equal(g.hasKw(g.object(attackers[3]), 'Hexproof'), true);
});

test('Fog Bank: Difensore, Volare; previene tutto il danno da combattimento inflitto a e da essa', () => {
  const g = commanderGame();
  const bears = on(g, 'A', 'Grizzly Bears');
  const fog = on(g, 'B', 'Fog Bank');
  attackWith(g, [[bears, 'B']]);
  advanceTo(g, 'declareBlockers');
  g.perform('B', { type: 'declareBlockers', blocks: [{ blocker: fog, attacker: bears }] });
  advanceTo(g, 'endCombat');
  assert.equal(g.object(fog).damage, 0);
  assert.equal(g.object(bears).damage, 0);
  assert.equal(g.hasKw(g.object(fog), 'Defender') && g.hasKw(g.object(fog), 'Flying'), true);
});

test('Consecrated Sphinx: quando un avversario pesca, puoi pescare due carte', () => {
  const g = commanderGame();
  on(g, 'A', 'Consecrated Sphinx');
  const before = hand(g);
  advanceTo(g, 'draw', 2); // B pesca nella sua acquisizione
  resolveAll(g);
  assert.equal(hand(g), before + 2);
});

test('Curiosity Crafter: quando un tuo token infligge danno da combattimento a un giocatore, pesca', () => {
  const g = commanderGame();
  on(g, 'A', 'Curiosity Crafter');
  const tok = g.setup.createToken('A', 'Drake');
  attackWith(g, [[tok, 'B']]);
  const before = hand(g);
  advanceTo(g, 'endCombat');
  resolveAll(g);
  assert.equal(hand(g), before + 1);
});

test('Curiosity Crafter: nessun limite di carte in mano', () => {
  const g = commanderGame();
  on(g, 'A', 'Curiosity Crafter');
  g.setup.putInHand('A', 'Island');
  advanceTo(g, 'upkeep', 2);
  assert.equal(hand(g), 9);
});

test('Warden of Evos Isle: le creature con Volare costano {1} in meno, le altre no', () => {
  const g = main();
  on(g, 'A', 'Warden of Evos Isle');
  assert.equal(g.costToCast('A', g.setup.putInHand('A', 'Air Elemental')), '{2}{U}{U}');
  assert.equal(g.costToCast('A', g.setup.putInHand('A', 'Phantom Warrior')), '{1}{U}{U}');
});

test('Silver Myr produce {U}, Palladium Myr produce {C}{C}', () => {
  const g = main();
  g.perform('A', { type: 'activateMana', object: on(g, 'A', 'Silver Myr') });
  g.perform('A', { type: 'activateMana', object: on(g, 'A', 'Palladium Myr') });
  assert.deepEqual([g.player('A').pool.U, g.player('A').pool.C], [1, 2]);
});

test('Burnished Hart: {3}, sacrificalo: cerca fino a due terre base e mettile sul campo tappate', () => {
  const g = main();
  const hart = on(g, 'A', 'Burnished Hart');
  addMana(g, 'A', U(3));
  act(g, 'A', hart, { sacrifice: [hart] });
  passAll(g);
  assert.equal(g.decision.type, 'search');
  assert.equal(g.decision.max, 2);
  g.perform('A', { type: 'search', objects: g.decision.options.slice(0, 2) });
  const islands = named(g, 'A', 'battlefield', 'Island');
  assert.equal(islands.length, 5);
  assert.equal(islands.filter((o) => o.tapped).length, 5);
});

test('Venser: Lampo; entrando fa tornare in mano una magia o un permanente', () => {
  const g = main();
  const spell = opponentCasts(g, 'Grizzly Bears', ['Forest', 'Forest']);
  castCard(g, 'A', 'Venser, Shaper Savant', U(4));
  passAll(g); // si risolve Venser: il suo innesco chiede il bersaglio
  g.perform('A', { type: 'chooseTarget', target: { object: spell } });
  resolveAll(g);
  assert.equal(named(g, 'B', 'hand', 'Grizzly Bears').length, 1);
  assert.equal(named(g, 'B', 'battlefield', 'Grizzly Bears').length, 0);
});

test('Tetsuko Umezawa: le tue creature con forza o costituzione 1 o meno non possono essere bloccate', () => {
  const g = commanderGame();
  on(g, 'A', 'Tetsuko Umezawa, Fugitive');
  const myr = on(g, 'A', 'Silver Myr');
  const bears = on(g, 'A', 'Grizzly Bears');
  const wall = on(g, 'B', 'Wall of Wood');
  attackWith(g, [[myr, 'B'], [bears, 'B']]);
  advanceTo(g, 'declareBlockers');
  blockFails(g, wall, myr);
  g.perform('B', { type: 'declareBlockers', blocks: [{ blocker: wall, attacker: bears }] });
});

test('Air Elemental e Mahamoti Djinn: creature volanti 4/4 e 5/6', () => {
  const g = main();
  const air = g.object(on(g, 'A', 'Air Elemental'));
  const djinn = g.object(on(g, 'A', 'Mahamoti Djinn'));
  assert.deepEqual([g.power(air), g.toughness(air), g.hasKw(air, 'Flying')], [4, 4, true]);
  assert.deepEqual([g.power(djinn), g.toughness(djinn), g.hasKw(djinn, 'Flying')], [5, 6, true]);
});

test("Man-o'-War: entrando fa tornare in mano una creatura; un token rimandato in mano sparisce", () => {
  const g = main();
  const bears = on(g, 'B', 'Grizzly Bears');
  castCard(g, 'A', "Man-o'-War", U(3));
  passAll(g);
  g.perform('A', { type: 'chooseTarget', target: { object: bears } });
  resolveAll(g);
  assert.equal(named(g, 'B', 'hand', 'Grizzly Bears').length, 1);
});

test('Sea Gate Oracle: guarda le prime due carte, una in mano e l\'altra in fondo', () => {
  const g = main();
  const a = g.setup.putInLibrary('A', 'Opt');
  const b = g.setup.putInLibrary('A', 'Negate');
  castCard(g, 'A', 'Sea Gate Oracle', U(3));
  passAll(g);
  passAll(g);
  assert.equal(g.decision.type, 'chooseCards');
  assert.deepEqual(g.decision.options.sort(), [a, b].sort());
  g.perform('A', { type: 'chooseCards', objects: [a] });
  assert.equal(named(g, 'A', 'hand', 'Opt').length, 1);
  assert.equal(lib(g).at(-1).name, 'Negate');
});

test('Thieving Magpie: quando infligge danno a un avversario, pesca una carta', () => {
  const g = commanderGame();
  const magpie = on(g, 'A', 'Thieving Magpie');
  attackWith(g, [[magpie, 'B']]);
  const before = hand(g);
  advanceTo(g, 'endCombat');
  resolveAll(g);
  assert.equal(hand(g), before + 1);
});

test('Coastal Piracy: quando una tua creatura infligge danno da combattimento a un avversario, puoi pescare', () => {
  const g = commanderGame();
  on(g, 'A', 'Coastal Piracy');
  attackWith(g, [[on(g, 'A', 'Grizzly Bears'), 'B'], [on(g, 'A', 'Slither Blade'), 'C']]);
  const before = hand(g);
  advanceTo(g, 'endCombat');
  resolveAll(g);
  assert.equal(hand(g), before + 2);
});

// ---------- Contromagie ----------
test('Negate neutralizza una magia non creatura, non una creatura', () => {
  const g = main();
  const bears = opponentCasts(g, 'Grizzly Bears', ['Forest', 'Forest']);
  const id = g.setup.putInHand('A', 'Negate');
  addMana(g, 'A', U(2));
  assert.throws(() => g.perform('A', { type: 'cast', object: id, targets: [{ object: bears }] }), (e) => e.code === 'INVALID_TARGET');
});

test('Negate, Essence Scatter e Cancel neutralizzano le magie del tipo giusto', () => {
  const g = main();
  const fodder = opponentCasts(g, 'Divination', U(3));
  castCard(g, 'A', 'Negate', U(2), { targets: [{ object: fodder }] });
  resolveAll(g);
  assert.equal(named(g, 'B', 'graveyard', 'Divination').length, 1);
  const bears = opponentCasts(g, 'Grizzly Bears', ['Forest', 'Forest']);
  castCard(g, 'A', 'Essence Scatter', U(2), { targets: [{ object: bears }] });
  resolveAll(g);
  assert.equal(named(g, 'B', 'graveyard', 'Grizzly Bears').length, 1);
  const djinn = opponentCasts(g, 'Mahamoti Djinn', U(6));
  castCard(g, 'A', 'Cancel', U(3), { targets: [{ object: djinn }] });
  resolveAll(g);
  assert.equal(named(g, 'B', 'graveyard', 'Mahamoti Djinn').length, 1);
});

test('Swan Song neutralizza un istantaneo e il suo controllore crea un Uccello 2/2 volante', () => {
  const g = main();
  const bolt = opponentCasts(g, 'Quick Study', U(3));
  castCard(g, 'A', 'Swan Song', U(1), { targets: [{ object: bolt }] });
  resolveAll(g);
  const [bird] = tokensOf(g, 'B');
  assert.deepEqual([bird.name, g.power(bird), g.hasKw(bird, 'Flying')], ['Bird', 2, true]);
});

test('Strix Serenade neutralizza una magia creatura o artefatto e il controllore crea un Uccello', () => {
  const g = main();
  const ring = opponentCasts(g, 'Sol Ring', ['Mountain']);
  castCard(g, 'A', 'Strix Serenade', U(1), { targets: [{ object: ring }] });
  resolveAll(g);
  assert.equal(named(g, 'B', 'graveyard', 'Sol Ring').length, 1);
  assert.equal(tokensOf(g, 'B').length, 1);
});

test("Didn't Say Please: neutralizza e il controllore della magia macina tre carte", () => {
  const g = main();
  const spell = opponentCasts(g, 'Divination', U(3));
  castCard(g, 'A', "Didn't Say Please", U(3), { targets: [{ object: spell }] });
  resolveAll(g);
  assert.equal(g.zone('B', 'graveyard').length, 4);
});

test('Memory Lapse: la magia neutralizzata va in cima al grimorio del proprietario', () => {
  const g = main();
  const spell = opponentCasts(g, 'Grizzly Bears', ['Forest', 'Forest']);
  castCard(g, 'A', 'Memory Lapse', U(2), { targets: [{ object: spell }] });
  resolveAll(g);
  assert.equal(lib(g, 'B')[0].name, 'Grizzly Bears');
});

test('Unwind e Rewind: neutralizzano e stappano fino a tre e quattro terre', () => {
  const g = main();
  const s1 = opponentCasts(g, 'Divination', U(3));
  castCard(g, 'A', 'Unwind', U(3), { targets: [{ object: s1 }] });
  resolveAll(g);
  assert.equal(named(g, 'A', 'battlefield', 'Island').filter((o) => !o.tapped).length, 3);
  const g2 = main();
  const s2 = opponentCasts(g2, 'Grizzly Bears', ['Forest', 'Forest']);
  castCard(g2, 'A', 'Rewind', U(4), { targets: [{ object: s2 }] });
  resolveAll(g2);
  assert.equal(named(g2, 'A', 'battlefield', 'Island').filter((o) => !o.tapped).length, 4);
});

// ---------- Pescate e selezione ----------
test('Opt: profetizza 1, poi pesca', () => {
  const g = main();
  const top = g.setup.putInLibrary('A', 'Negate');
  castCard(g, 'A', 'Opt', U(1));
  passAll(g);
  assert.equal(g.decision.type, 'scry');
  g.perform('A', { type: 'scry', top: [], bottom: [top] });
  assert.equal(lib(g).at(-1).name, 'Negate');
  assert.equal(named(g, 'A', 'hand', 'Negate').length, 0);
});

test('Brainstorm: pesca tre carte, poi rimetti due carte della mano in cima', () => {
  const g = main();
  const before = hand(g);
  castCard(g, 'A', 'Brainstorm', U(1));
  passAll(g);
  assert.equal(g.decision.type, 'putBack');
  const [x, y] = g.zone('A', 'hand');
  g.perform('A', { type: 'putBack', objects: [x.id, y.id] });
  assert.equal(hand(g), before + 1);
  assert.deepEqual(lib(g).slice(0, 2).map((o) => o.cardId), [x.cardId, y.cardId]);
});

test('Serum Visions: pesca una carta, poi profetizza 2', () => {
  const g = main();
  const before = hand(g);
  castCard(g, 'A', 'Serum Visions', U(1));
  passAll(g);
  assert.equal(g.decision.cards.length, 2);
  resolveAll(g);
  assert.equal(hand(g), before + 1);
});

test('Quick Study e Divination pescano due carte ciascuna', () => {
  const g = main();
  const before = hand(g);
  castCard(g, 'A', 'Quick Study', U(3));
  resolveAll(g);
  castCard(g, 'A', 'Divination', U(3));
  resolveAll(g);
  assert.equal(hand(g), before + 4);
});

test('Frantic Search: pesca due carte, scartane due, stappa fino a tre terre', () => {
  const g = main();
  const before = hand(g);
  castCard(g, 'A', 'Frantic Search', U(3));
  passAll(g);
  assert.deepEqual([g.decision.type, g.decision.count], ['discard', 2]);
  g.perform('A', { type: 'discard', objects: g.zone('A', 'hand').slice(0, 2).map((o) => o.id) });
  resolveAll(g);
  assert.equal(hand(g), before);
  assert.equal(named(g, 'A', 'battlefield', 'Island').filter((o) => !o.tapped).length, 3);
});

test('Impulse, Sleight of Hand e Stock Up: scegli tra le prime carte del grimorio', () => {
  const g = main();
  for (const [name, mana, seen, take] of [['Impulse', 2, 4, 1], ['Sleight of Hand', 1, 2, 1], ['Stock Up', 3, 5, 2]]) {
    const before = hand(g);
    castCard(g, 'A', name, U(mana));
    passAll(g);
    assert.deepEqual([g.decision.options.length, g.decision.count], [seen, take], name);
    resolveAll(g);
    assert.equal(hand(g), before + take, name);
  }
});

test('Prologue to Phyresis: ogni avversario prende un segnalino veleno e tu peschi', () => {
  const g = main();
  const before = hand(g);
  castCard(g, 'A', 'Prologue to Phyresis', U(2));
  resolveAll(g);
  assert.deepEqual(['A', 'B', 'C', 'D'].map((p) => g.player(p).poison), [0, 1, 1, 1]);
  assert.equal(hand(g), before + 1);
});

test('Thought Scour: un giocatore macina due carte, poi peschi', () => {
  const g = main();
  castCard(g, 'A', 'Thought Scour', U(1), { targets: [{ player: 'C' }] });
  resolveAll(g);
  assert.equal(g.zone('C', 'graveyard').length, 2);
});

// ---------- Rimbalzi e rimozioni ----------
test('Unsummon e Snap fanno tornare una creatura in mano; Snap stappa due terre', () => {
  const g = main();
  const b1 = on(g, 'B', 'Grizzly Bears');
  castCard(g, 'A', 'Unsummon', U(1), { targets: [{ object: b1 }] });
  resolveAll(g);
  const b2 = on(g, 'B', 'Air Elemental');
  castCard(g, 'A', 'Snap', U(2), { targets: [{ object: b2 }] });
  resolveAll(g);
  assert.equal(g.zone('B', 'hand').filter((o) => ['Grizzly Bears', 'Air Elemental'].includes(o.name)).length, 2);
  assert.equal(named(g, 'A', 'battlefield', 'Island').filter((o) => !o.tapped).length, 2);
});

test('Boomerang Basics: rimanda in mano un permanente non terra; se era tuo peschi', () => {
  const g = main();
  const ring = on(g, 'A', 'Sol Ring');
  const before = hand(g);
  castCard(g, 'A', 'Boomerang Basics', U(1), { targets: [{ object: ring }] });
  resolveAll(g);
  assert.equal(hand(g), before + 2); // il Sol Ring torna in mano e si pesca una carta
  const land = on(g, 'B', 'Island');
  const id = g.setup.putInHand('A', 'Boomerang Basics');
  addMana(g, 'A', U(1));
  assert.throws(() => g.perform('A', { type: 'cast', object: id, targets: [{ object: land }] }), (e) => e.code === 'INVALID_TARGET');
});

test('Evacuation fa tornare in mano tutte le creature; i token spariscono', () => {
  const g = main();
  on(g, 'A', 'Air Elemental');
  on(g, 'B', 'Grizzly Bears');
  g.setup.createToken('C', 'Drake');
  castCard(g, 'A', 'Evacuation', U(5));
  resolveAll(g);
  assert.equal(g.battlefield().filter((o) => o.def.types.includes('Creature')).length, 0);
  assert.equal(named(g, 'B', 'hand', 'Grizzly Bears').length, 1);
});

test('Aetherize fa tornare in mano tutte le creature attaccanti', () => {
  const g = commanderGame();
  const bears = on(g, 'A', 'Grizzly Bears');
  const home = on(g, 'A', 'Air Elemental');
  attackWith(g, [[bears, 'B']]);
  passAll(g);
  advanceTo(g, 'declareBlockers');
  const id = g.setup.putInHand('B', 'Aetherize');
  g.perform('A', { type: 'pass' });
  addMana(g, 'B', U(4));
  g.perform('B', { type: 'cast', object: id });
  resolveAll(g);
  assert.equal(named(g, 'A', 'hand', 'Grizzly Bears').length, 1);
  assert.equal(g.object(home).zone, 'battlefield');
});

test('Pongify e Rapid Hybridization: distruggi una creatura, il suo controllore crea un 3/3', () => {
  const g = main();
  const a = on(g, 'B', 'Mahamoti Djinn');
  castCard(g, 'A', 'Pongify', U(1), { targets: [{ object: a }] });
  resolveAll(g);
  const b = on(g, 'C', 'Air Elemental');
  castCard(g, 'A', 'Rapid Hybridization', U(1), { targets: [{ object: b }] });
  resolveAll(g);
  assert.deepEqual([tokensOf(g, 'B')[0].name, tokensOf(g, 'C')[0].name], ['Ape', 'Frog Lizard']);
  assert.equal(g.power(tokensOf(g, 'B')[0]), 3);
});

test('Enter the Enigma: una creatura non può essere bloccata in questo turno; pesca una carta', () => {
  const g = main();
  const bears = on(g, 'A', 'Grizzly Bears');
  const before = hand(g);
  castCard(g, 'A', 'Enter the Enigma', U(1), { targets: [{ object: bears }] });
  resolveAll(g);
  assert.equal(g.cantBeBlocked(g.object(bears)), true);
  assert.equal(hand(g), before + 1);
});

test("Talrand's Invocation crea due Drake 2/2 volanti", () => {
  const g = main();
  castCard(g, 'A', "Talrand's Invocation", U(4));
  resolveAll(g);
  assert.deepEqual(tokensOf(g, 'A').map((o) => o.name), ['Drake', 'Drake']);
});

// ---------- Artefatti ----------
test('Sky Diamond entra tappato e produce {U}', () => {
  const g = main();
  castCard(g, 'A', 'Sky Diamond', U(2));
  resolveAll(g);
  assert.equal(named(g, 'A', 'battlefield', 'Sky Diamond')[0].tapped, true);
});

test('Sapphire Medallion: le magie blu costano {1} in meno', () => {
  const g = main();
  on(g, 'A', 'Sapphire Medallion');
  assert.equal(g.costToCast('A', g.setup.putInHand('A', 'Air Elemental')), '{2}{U}{U}');
  assert.equal(g.costToCast('A', g.setup.putInHand('A', 'Grizzly Bears')), '{1}{G}');
});

test('Hedron Archive: {T}: {C}{C}; {2},{T}, sacrificalo: pesca due carte', () => {
  const g = main();
  const ha = on(g, 'A', 'Hedron Archive');
  addMana(g, 'A', U(2));
  const before = hand(g);
  act(g, 'A', ha, { sacrifice: [ha] });
  resolveAll(g);
  assert.equal(hand(g), before + 2);
  g.perform('A', { type: 'activateMana', object: on(g, 'A', 'Hedron Archive') });
  assert.equal(g.player('A').pool.C, 2);
});

test("Wayfarer's Bauble: {2},{T}, sacrificalo: una terra base sul campo tappata", () => {
  const g = main();
  const wb = on(g, 'A', "Wayfarer's Bauble");
  addMana(g, 'A', U(2));
  act(g, 'A', wb, { sacrifice: [wb] });
  resolveAll(g);
  const islands = named(g, 'A', 'battlefield', 'Island');
  assert.equal(islands.length, 3);
  assert.equal(islands.filter((o) => o.tapped).length, 3);
});
