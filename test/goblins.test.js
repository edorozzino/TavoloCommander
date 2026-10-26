// Carte del mazzo iniziale "Goblin di Krenko". Testo verificato su Scryfall; ogni test cita l'abilità che verifica.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo, addMana, attackWith, castCard, resolveAll, tokensOf, named, passAll } = require('./helpers');

const R = (n) => Array(n).fill('Mountain');
const main = (opts) => { const g = commanderGame(opts); advanceTo(g, 'main1'); return g; };
const on = (g, pid, name, opts) => g.setup.putOnBattlefield(pid, name, opts);
const goblinToken = (g, pid) => g.setup.createToken(pid, 'Goblin');
const act = (g, pid, object, extra = {}) => g.perform(pid, { type: 'activate', object, ...extra });

// ---------- Creature ----------
test('Siege-Gang Commander: entrando crea tre Goblin; {1}{R}, sacrifica un Goblin: 2 danni', () => {
  const g = main();
  castCard(g, 'A', 'Siege-Gang Commander', R(5));
  resolveAll(g);
  assert.equal(tokensOf(g, 'A').length, 3);
  const sgc = named(g, 'A', 'battlefield', 'Siege-Gang Commander')[0].id;
  addMana(g, 'A', R(2));
  act(g, 'A', sgc, { sacrifice: [tokensOf(g, 'A')[0].id], targets: [{ player: 'B' }] });
  resolveAll(g);
  assert.equal(g.player('B').life, 38);
  assert.equal(tokensOf(g, 'A').length, 2);
});

test('Skirk Prospector: sacrificare un Goblin aggiunge {R} senza usare la Pila', () => {
  const g = main();
  const skirk = on(g, 'A', 'Skirk Prospector');
  const tok = goblinToken(g, 'A');
  g.perform('A', { type: 'activateMana', object: skirk, sacrifice: [tok] });
  assert.equal(g.player('A').pool.R, 1);
  assert.equal(tokensOf(g, 'A').length, 0);
  assert.equal(g.stack.length, 0);
});

test('Skirk Prospector: senza sacrificare un Goblin non produce mana', () => {
  const g = main();
  const skirk = on(g, 'A', 'Skirk Prospector');
  assert.throws(() => g.perform('A', { type: 'activateMana', object: skirk }), (e) => e.code === 'MISSING_COST');
});

test('Goblin Matron: entrando cerca un Goblin nel grimorio e lo mette in mano', () => {
  const g = main();
  const guide = g.setup.putInLibrary('A', 'Goblin Guide');
  castCard(g, 'A', 'Goblin Matron', R(3));
  passAll(g); // si risolve la Matron, l'innesco va sulla Pila
  passAll(g); // si risolve l'innesco: scelta della carta
  assert.equal(g.decision.type, 'search');
  assert.ok(g.decision.options.includes(guide));
  g.perform('A', { type: 'search', object: guide });
  assert.equal(named(g, 'A', 'hand', 'Goblin Guide').length, 1);
});

test('Goblin Warchief: le magie Goblin costano {1} in meno e i Goblin hanno Rapidità', () => {
  const g = main();
  on(g, 'A', 'Goblin Warchief');
  castCard(g, 'A', 'Goblin Instigator', R(1));
  resolveAll(g);
  const inst = named(g, 'A', 'battlefield', 'Goblin Instigator')[0];
  assert.equal(g.isSick(inst), false);
});

test('Goblin Chieftain: gli altri tuoi Goblin prendono +1/+1 e Rapidità; quelli avversari no', () => {
  const g = main();
  const chief = on(g, 'A', 'Goblin Chieftain');
  const mine = goblinToken(g, 'A');
  const theirs = goblinToken(g, 'B');
  assert.deepEqual([g.power(g.object(mine)), g.toughness(g.object(mine))], [2, 2]);
  assert.equal(g.hasKw(g.object(mine), 'Haste'), true);
  assert.equal(g.power(g.object(theirs)), 1);
  assert.equal(g.power(g.object(chief)), 2);
});

test('Pashalik Mons: quando muore un tuo Goblin infligge 1 danno a un bersaglio a scelta', () => {
  const g = main();
  on(g, 'A', 'Pashalik Mons');
  const tok = goblinToken(g, 'A');
  castCard(g, 'A', 'Shock', R(1), { targets: [{ object: tok }] });
  passAll(g);
  assert.equal(g.decision.type, 'chooseTarget');
  g.perform('A', { type: 'chooseTarget', target: { player: 'C' } });
  resolveAll(g);
  assert.equal(g.player('C').life, 39);
});

test('Pashalik Mons: {3}{R}, sacrifica un Goblin: crea due Goblin', () => {
  const g = main();
  const mons = on(g, 'A', 'Pashalik Mons');
  const tok = goblinToken(g, 'A');
  addMana(g, 'A', R(4));
  act(g, 'A', mons, { sacrifice: [tok] });
  resolveAll(g); // l'innesco di morte chiede un bersaglio: la scelta predefinita è il primo
  assert.equal(tokensOf(g, 'A').length, 2);
});

test('Goblin Trashmaster: gli altri tuoi Goblin prendono +1/+1; sacrifica un Goblin: distruggi un artefatto', () => {
  const g = main();
  const trash = on(g, 'A', 'Goblin Trashmaster');
  const tok = goblinToken(g, 'A');
  assert.equal(g.power(g.object(tok)), 2);
  assert.equal(g.power(g.object(trash)), 3);
  const ring = on(g, 'B', 'Sol Ring');
  act(g, 'A', trash, { sacrifice: [tok], targets: [{ object: ring }] });
  resolveAll(g);
  assert.equal(named(g, 'B', 'graveyard', 'Sol Ring').length, 1);
});

test('Goblin Instigator e Beetleback Chief: creano uno e due Goblin entrando', () => {
  const g = main();
  castCard(g, 'A', 'Goblin Instigator', R(2));
  resolveAll(g);
  assert.equal(tokensOf(g, 'A').length, 1);
  castCard(g, 'A', 'Beetleback Chief', R(4));
  resolveAll(g);
  assert.equal(tokensOf(g, 'A').length, 3);
});

test('Hobgoblin Bandit Lord: +1/+1 agli altri Goblin; {R},{T}: danni pari ai Goblin entrati in questo turno', () => {
  const g = commanderGame();
  const lord = on(g, 'A', 'Hobgoblin Bandit Lord');
  advanceTo(g, 'main1', 5);
  castCard(g, 'A', 'Beetleback Chief', R(4));
  resolveAll(g);
  assert.equal(g.power(tokensOf(g, 'A')[0]), 2);
  addMana(g, 'A', R(1));
  act(g, 'A', lord, { targets: [{ player: 'B' }] });
  resolveAll(g);
  assert.equal(g.player('B').life, 37);
});

test('Goblin Sharpshooter: non si stappa da solo, si stappa quando muore una creatura; {T}: 1 danno', () => {
  const g = commanderGame();
  const ss = on(g, 'A', 'Goblin Sharpshooter');
  advanceTo(g, 'main1');
  act(g, 'A', ss, { targets: [{ object: goblinToken(g, 'B') }] });
  resolveAll(g); // il token muore: lo Sharpshooter si stappa
  assert.equal(g.object(ss).tapped, false);
  act(g, 'A', ss, { targets: [{ player: 'B' }] });
  resolveAll(g);
  advanceTo(g, 'upkeep', 5);
  assert.equal(g.object(ss).tapped, true);
});

test('Goblin King: tutti gli altri Goblin prendono +1/+1 e Passaterre (Mountain)', () => {
  const g = main();
  on(g, 'A', 'Goblin King');
  const mine = goblinToken(g, 'A');
  const theirs = goblinToken(g, 'B');
  assert.equal(g.power(g.object(mine)), 2);
  assert.equal(g.power(g.object(theirs)), 2);
  const bears = on(g, 'B', 'Grizzly Bears');
  on(g, 'B', 'Mountain');
  g.setup.setControlSince(mine, -1);
  attackWith(g, [[mine, 'B']]);
  advanceTo(g, 'declareBlockers');
  assert.throws(() => g.perform('B', { type: 'declareBlockers', blocks: [{ blocker: bears, attacker: mine }] }), (e) => e.code === 'INVALID_BLOCK');
});

test('Goblin Chainwhirler: Attacco improvviso; entrando 1 danno a ogni avversario e alle loro creature', () => {
  const g = main();
  const mine = goblinToken(g, 'A');
  const theirs = goblinToken(g, 'B');
  castCard(g, 'A', 'Goblin Chainwhirler', R(3));
  resolveAll(g);
  assert.deepEqual(['A', 'B', 'C', 'D'].map((p) => g.player(p).life), [40, 39, 39, 39]);
  assert.equal(g.object(theirs), undefined);
  assert.equal(g.object(mine).zone, 'battlefield');
  assert.equal(g.hasKw(named(g, 'A', 'battlefield', 'Goblin Chainwhirler')[0], 'First strike'), true);
});

test('Fanatical Firebrand: Rapidità; {T}, sacrificalo: 1 danno', () => {
  const g = main();
  const fb = on(g, 'A', 'Fanatical Firebrand', { sick: true });
  act(g, 'A', fb, { sacrifice: [fb], targets: [{ player: 'B' }] });
  resolveAll(g);
  assert.equal(g.player('B').life, 39);
  assert.equal(named(g, 'A', 'graveyard', 'Fanatical Firebrand').length, 1);
});

test('Mogg Fanatic: sacrificalo anche appena entrato: 1 danno', () => {
  const g = main();
  const mf = on(g, 'A', 'Mogg Fanatic', { sick: true });
  act(g, 'A', mf, { sacrifice: [mf], targets: [{ player: 'B' }] });
  resolveAll(g);
  assert.equal(g.player('B').life, 39);
});

test('Goblin Arsonist: quando muore puoi infliggere 1 danno, oppure rinunciare', () => {
  const g = main();
  const ars = on(g, 'A', 'Goblin Arsonist');
  castCard(g, 'A', 'Shock', R(1), { targets: [{ object: ars }] });
  passAll(g);
  assert.equal(g.decision.optional, true);
  g.perform('A', { type: 'chooseTarget', target: null });
  assert.equal(g.stack.length, 0);
  const ars2 = on(g, 'A', 'Goblin Arsonist');
  castCard(g, 'A', 'Shock', R(1), { targets: [{ object: ars2 }] });
  passAll(g);
  g.perform('A', { type: 'chooseTarget', target: { player: 'D' } });
  resolveAll(g);
  assert.equal(g.player('D').life, 39);
});

test('Goblin Fireslinger: {T}: 1 danno a un giocatore, non a una creatura', () => {
  const g = main();
  const fs = on(g, 'A', 'Goblin Fireslinger');
  assert.throws(() => act(g, 'A', fs, { targets: [{ object: goblinToken(g, 'B') }] }), (e) => e.code === 'INVALID_TARGET');
  act(g, 'A', fs, { targets: [{ player: 'B' }] });
  resolveAll(g);
  assert.equal(g.player('B').life, 39);
});

test('Lightning-Rig Crew: {T}: 1 danno a ogni avversario', () => {
  const g = main();
  act(g, 'A', on(g, 'A', 'Lightning-Rig Crew'));
  resolveAll(g);
  assert.deepEqual(['A', 'B', 'C', 'D'].map((p) => g.player(p).life), [40, 39, 39, 39]);
});

test('Wily Goblin: entrando crea un Tesoro, che si sacrifica per un mana di qualsiasi colore', () => {
  const g = main();
  castCard(g, 'A', 'Wily Goblin', R(2));
  resolveAll(g);
  const treasure = tokensOf(g, 'A').find((o) => o.name === 'Treasure');
  assert.ok(treasure);
  g.perform('A', { type: 'activateMana', object: treasure.id, color: 'G', sacrifice: [treasure.id] });
  assert.equal(g.player('A').pool.G, 1);
  assert.equal(g.object(treasure.id), undefined);
});

test('Reckless Lackey: Attacco improvviso, Rapidità; {2}{R}, sacrificalo: pesca e crea un Tesoro', () => {
  const g = main();
  const lackey = on(g, 'A', 'Reckless Lackey');
  assert.ok(g.hasKw(g.object(lackey), 'First strike') && g.hasKw(g.object(lackey), 'Haste'));
  const hand = g.zone('A', 'hand').length;
  addMana(g, 'A', R(3));
  act(g, 'A', lackey, { sacrifice: [lackey] });
  resolveAll(g);
  assert.equal(g.zone('A', 'hand').length, hand + 1);
  assert.equal(tokensOf(g, 'A').filter((o) => o.name === 'Treasure').length, 1);
});

test('Goblin Wardriver: Grido di battaglia, le altre creature attaccanti prendono +1/+0', () => {
  const g = commanderGame();
  attackWith(g, [[on(g, 'A', 'Goblin Wardriver'), 'B'], [on(g, 'A', 'Grizzly Bears'), 'B']]);
  advanceTo(g, 'endCombat');
  assert.equal(g.player('B').life, 35);
});

test('Boneclub Berserker: +2/+0 per ogni altro Goblin che controlli', () => {
  const g = main();
  const bb = on(g, 'A', 'Boneclub Berserker');
  goblinToken(g, 'A');
  goblinToken(g, 'A');
  goblinToken(g, 'B');
  assert.deepEqual([g.power(g.object(bb)), g.toughness(g.object(bb))], [6, 4]);
});

test('Reckless One: Rapidità; forza e costituzione pari ai Goblin sul campo', () => {
  const g = main();
  const ro = on(g, 'A', 'Reckless One');
  goblinToken(g, 'B');
  assert.deepEqual([g.power(g.object(ro)), g.toughness(g.object(ro))], [2, 2]);
  assert.equal(g.hasKw(g.object(ro), 'Haste'), true);
});

test('Battle Squadron: Volare; forza e costituzione pari alle creature che controlli', () => {
  const g = main();
  const bs = on(g, 'A', 'Battle Squadron');
  on(g, 'A', 'Grizzly Bears');
  on(g, 'B', 'Grizzly Bears');
  assert.deepEqual([g.power(g.object(bs)), g.toughness(g.object(bs))], [2, 2]);
  assert.equal(g.hasKw(g.object(bs), 'Flying'), true);
});

test('Underfoot Underdogs: entrando crea un Goblin; {1},{T}: una tua creatura con forza 2 o meno non può essere bloccata', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  castCard(g, 'A', 'Underfoot Underdogs', R(3));
  resolveAll(g);
  assert.equal(tokensOf(g, 'A').length, 1);
  const dogs = named(g, 'A', 'battlefield', 'Underfoot Underdogs')[0].id;
  g.setup.setControlSince(dogs, -1);
  const bears = on(g, 'A', 'Grizzly Bears');
  addMana(g, 'A', R(1));
  act(g, 'A', dogs, { targets: [{ object: bears }] });
  resolveAll(g);
  const wall = on(g, 'B', 'Wall of Wood');
  attackWith(g, [[bears, 'B']]);
  advanceTo(g, 'declareBlockers');
  assert.throws(() => g.perform('B', { type: 'declareBlockers', blocks: [{ blocker: wall, attacker: bears }] }), (e) => e.code === 'INVALID_BLOCK');
});

test('Goblin Tunneler: {T}: una creatura con forza 2 o meno non può essere bloccata; non una più grossa', () => {
  const g = main();
  const tun = on(g, 'A', 'Goblin Tunneler');
  const big = on(g, 'A', 'Colossal Dreadmaw');
  assert.throws(() => act(g, 'A', tun, { targets: [{ object: big }] }), (e) => e.code === 'INVALID_TARGET');
  const bears = on(g, 'A', 'Grizzly Bears');
  act(g, 'A', tun, { targets: [{ object: bears }] });
  resolveAll(g);
  assert.equal(g.cantBeBlocked(g.object(bears)), true);
});

test('Goblin Motivator: {T}: una creatura ottiene Rapidità fino a fine turno', () => {
  const g = main();
  const bears = on(g, 'A', 'Grizzly Bears', { sick: true });
  act(g, 'A', on(g, 'A', 'Goblin Motivator'), { targets: [{ object: bears }] });
  resolveAll(g);
  assert.equal(g.isSick(g.object(bears)), false);
  advanceTo(g, 'upkeep', 2);
  assert.equal(g.hasKw(g.object(bears), 'Haste'), false);
});

test('Goblin Lookout: {T}, sacrifica un Goblin: le creature Goblin prendono +2/+0 fino a fine turno', () => {
  const g = main();
  const lookout = on(g, 'A', 'Goblin Lookout');
  const fodder = goblinToken(g, 'A');
  const theirs = goblinToken(g, 'B');
  act(g, 'A', lookout, { sacrifice: [fodder] });
  resolveAll(g);
  assert.equal(g.power(g.object(lookout)), 3);
  assert.equal(g.power(g.object(theirs)), 3);
});

test('Goblin Sledder: sacrifica un Goblin: una creatura prende +1/+1 fino a fine turno', () => {
  const g = main();
  const sledder = on(g, 'A', 'Goblin Sledder');
  const bears = on(g, 'A', 'Grizzly Bears');
  act(g, 'A', sledder, { sacrifice: [sledder], targets: [{ object: bears }] });
  resolveAll(g);
  assert.deepEqual([g.power(g.object(bears)), g.toughness(g.object(bears))], [3, 3]);
});

test('Volley Veteran: entrando infligge a una creatura avversaria danni pari ai tuoi Goblin', () => {
  const g = main();
  goblinToken(g, 'A');
  goblinToken(g, 'A');
  const spider = on(g, 'B', 'Giant Spider');
  castCard(g, 'A', 'Volley Veteran', R(4));
  passAll(g);
  g.perform('A', { type: 'chooseTarget', target: { object: spider } });
  resolveAll(g);
  assert.equal(g.object(spider).damage, 3);
});

test('Rummaging Goblin: {T}, scarta una carta: pesca una carta', () => {
  const g = main();
  const rg = on(g, 'A', 'Rummaging Goblin');
  const hand = g.zone('A', 'hand');
  act(g, 'A', rg, { discard: [hand[0].id] });
  resolveAll(g);
  assert.equal(g.zone('A', 'hand').length, hand.length);
  assert.equal(g.zone('A', 'graveyard').length, 1);
});

test('Foundry Street Denizen: +1/+0 quando entra un\'altra tua creatura rossa, non una verde', () => {
  const g = main();
  const fsd = on(g, 'A', 'Foundry Street Denizen');
  castCard(g, 'A', 'Grizzly Bears', ['Forest', 'Forest']);
  resolveAll(g);
  assert.equal(g.power(g.object(fsd)), 1);
  castCard(g, 'A', 'Goblin Guide', R(1));
  resolveAll(g);
  assert.equal(g.power(g.object(fsd)), 2);
});

test('Magic Pot: quando muore crea un Tesoro; {2},{T}: esilia una carta da un cimitero', () => {
  const g = main();
  const pot = on(g, 'A', 'Magic Pot');
  const card = g.setup.putInGraveyard('B', 'Grizzly Bears');
  addMana(g, 'A', R(2));
  act(g, 'A', pot, { targets: [{ object: card }] });
  resolveAll(g);
  assert.equal(named(g, 'B', 'exile', 'Grizzly Bears').length, 1);
  castCard(g, 'A', 'Flame Slash', R(1), { targets: [{ object: pot }] }); // Magic Pot è 1/4: servono 4 danni
  resolveAll(g);
  assert.equal(tokensOf(g, 'A').filter((o) => o.name === 'Treasure').length, 1);
});

test('Goblin Guide: quando attacca, se la prima carta del difensore è una terra, va nella sua mano', () => {
  const g = commanderGame();
  const hand = g.zone('B', 'hand').length;
  attackWith(g, [[on(g, 'A', 'Goblin Guide', { sick: true }), 'B']]);
  resolveAll(g);
  assert.equal(g.zone('B', 'hand').length, hand + 1);
});

test('Goblin Guide: se la prima carta non è una terra, resta nel grimorio', () => {
  const g = commanderGame();
  g.setup.putInLibrary('B', 'Grizzly Bears');
  const hand = g.zone('B', 'hand').length;
  attackWith(g, [[on(g, 'A', 'Goblin Guide'), 'B']]);
  resolveAll(g);
  assert.equal(g.zone('B', 'hand').length, hand);
});

test('Krenko, Tin Street Kingpin: quando attacca prende un segnalino +1/+1 e crea Goblin pari alla sua forza', () => {
  const g = commanderGame();
  const k = on(g, 'A', 'Krenko, Tin Street Kingpin');
  attackWith(g, [[k, 'B']]);
  resolveAll(g);
  assert.equal(g.power(g.object(k)), 2);
  assert.equal(tokensOf(g, 'A').length, 2);
});

test('Squee, Goblin Nabob: nel tuo mantenimento puoi riprenderlo dal cimitero in mano', () => {
  const g = commanderGame();
  g.setup.putInGraveyard('A', 'Squee, Goblin Nabob');
  advanceTo(g, 'upkeep', 5);
  resolveAll(g);
  assert.equal(named(g, 'A', 'hand', 'Squee, Goblin Nabob').length, 1);
});

test('Goblin Ringleader: Rapidità; entrando rivela 4 carte, i Goblin in mano e il resto in fondo', () => {
  const g = main();
  g.setup.putInLibrary('A', 'Goblin Guide');
  g.setup.putInLibrary('A', 'Grizzly Bears');
  g.setup.putInLibrary('A', 'Mogg Fanatic');
  castCard(g, 'A', 'Goblin Ringleader', R(4));
  resolveAll(g);
  assert.equal(named(g, 'A', 'hand', 'Goblin Guide').length + named(g, 'A', 'hand', 'Mogg Fanatic').length, 2);
  assert.equal(g.zone('A', 'library').at(-1).name !== 'Goblin Guide', true);
  assert.ok(g.zone('A', 'library').slice(-2).some((o) => o.name === 'Grizzly Bears'));
});

// ---------- Magie ----------
test('Dragon Fodder, Krenko\'s Command, Hordeling Outburst, Goblin Rally: 2, 2, 3 e 4 Goblin', () => {
  const g = main();
  for (const [name, mana] of [['Dragon Fodder', 2], ["Krenko's Command", 2], ['Hordeling Outburst', 3], ['Goblin Rally', 5]]) {
    castCard(g, 'A', name, R(mana));
    resolveAll(g);
  }
  assert.equal(tokensOf(g, 'A').length, 11);
});

test('Brightstone Ritual: aggiunge {R} per ogni Goblin sul campo, di chiunque', () => {
  const g = main();
  goblinToken(g, 'A');
  goblinToken(g, 'B');
  castCard(g, 'A', 'Brightstone Ritual', R(1));
  resolveAll(g);
  assert.equal(g.player('A').pool.R, 2);
});

test('Goblin Grenade: costo aggiuntivo sacrificare un Goblin; 5 danni', () => {
  const g = main();
  const id = g.setup.putInHand('A', 'Goblin Grenade');
  addMana(g, 'A', R(1));
  assert.throws(() => g.perform('A', { type: 'cast', object: id, targets: [{ player: 'B' }] }), (e) => e.code === 'MISSING_COST');
  g.perform('A', { type: 'cast', object: id, targets: [{ player: 'B' }], sacrifice: [goblinToken(g, 'A')] });
  resolveAll(g);
  assert.equal(g.player('B').life, 35);
});

test('Goblin Surprise: scegli +2/+0 alle tue creature oppure due Goblin', () => {
  const g = main();
  const bears = on(g, 'A', 'Grizzly Bears');
  castCard(g, 'A', 'Goblin Surprise', R(3), { mode: 0 });
  resolveAll(g);
  assert.equal(g.power(g.object(bears)), 4);
  castCard(g, 'A', 'Goblin Surprise', R(3), { mode: 1 });
  resolveAll(g);
  assert.equal(tokensOf(g, 'A').length, 2);
});

test('Goblin War Strike: danni a un giocatore pari ai Goblin che controlli', () => {
  const g = main();
  goblinToken(g, 'A');
  goblinToken(g, 'A');
  castCard(g, 'A', 'Goblin War Strike', R(1), { targets: [{ player: 'B' }] });
  resolveAll(g);
  assert.equal(g.player('B').life, 38);
});

test('Shock 2, Lightning Strike 3, Searing Spear 3 e Volcanic Hammer 3 danni a qualsiasi bersaglio', () => {
  const g = main();
  for (const [name, mana] of [['Shock', 1], ['Lightning Strike', 2], ['Searing Spear', 2], ['Volcanic Hammer', 2]]) {
    castCard(g, 'A', name, R(mana), { targets: [{ player: 'B' }] });
    resolveAll(g);
  }
  assert.equal(g.player('B').life, 29);
});

test('Volcanic Hammer è una stregoneria: non si lancia nel turno di un avversario', () => {
  const g = commanderGame();
  g.perform('A', { type: 'pass' });
  const id = g.setup.putInHand('B', 'Volcanic Hammer');
  addMana(g, 'B', R(2));
  assert.throws(() => g.perform('B', { type: 'cast', object: id, targets: [{ player: 'A' }] }), (e) => e.code === 'SORCERY_TIMING');
});

test('Flame Slash: 4 danni solo a una creatura', () => {
  const g = main();
  const spider = on(g, 'B', 'Giant Spider');
  const id = g.setup.putInHand('A', 'Flame Slash');
  addMana(g, 'A', R(1));
  assert.throws(() => g.perform('A', { type: 'cast', object: id, targets: [{ player: 'B' }] }), (e) => e.code === 'INVALID_TARGET');
  g.perform('A', { type: 'cast', object: id, targets: [{ object: spider }] });
  resolveAll(g);
  assert.equal(named(g, 'B', 'graveyard', 'Giant Spider').length, 1);
});

test('Fling: sacrifica una creatura e infliggi danni pari alla sua forza', () => {
  const g = main();
  on(g, 'A', 'Goblin Chieftain');
  const tok = goblinToken(g, 'A'); // 2/2 grazie al Chieftain
  castCard(g, 'A', 'Fling', R(2), { sacrifice: [tok], targets: [{ player: 'B' }] });
  resolveAll(g);
  assert.equal(g.player('B').life, 38);
});

test('Blasphemous Act: costa {1} in meno per ogni creatura e infligge 13 danni a ogni creatura', () => {
  const g = main();
  for (let i = 0; i < 4; i++) { goblinToken(g, 'A'); goblinToken(g, 'B'); }
  on(g, 'C', 'Darksteel Myr');
  assert.equal(g.costToCast('A', g.setup.putInHand('A', 'Blasphemous Act')), '{R}');
  castCard(g, 'A', 'Blasphemous Act', R(1));
  resolveAll(g);
  assert.equal(g.battlefield().filter((o) => o.def.types.includes('Creature')).map((o) => o.name).join(), 'Darksteel Myr');
});

test('Thrill of Possibility e Tormenting Voice: scarta una carta come costo aggiuntivo e pesca due carte', () => {
  const g = main();
  const hand = g.zone('A', 'hand').length;
  castCard(g, 'A', 'Thrill of Possibility', R(2), { discard: [g.zone('A', 'hand')[0].id] });
  resolveAll(g);
  assert.equal(g.zone('A', 'hand').length, hand + 1);
  const id = g.setup.putInHand('A', 'Tormenting Voice');
  addMana(g, 'A', R(2));
  assert.throws(() => g.perform('A', { type: 'cast', object: id }), (e) => e.code === 'MISSING_COST');
});

// ---------- Artefatti, incantesimi, terre ----------
test("Command Tower e Arcane Signet: un mana di un colore dell'identità del comandante", () => {
  const g = main();
  const tower = on(g, 'A', 'Command Tower');
  assert.throws(() => g.perform('A', { type: 'activateMana', object: tower, color: 'G' }), (e) => e.code === 'INVALID_COLOR');
  g.perform('A', { type: 'activateMana', object: tower, color: 'R' });
  g.perform('A', { type: 'activateMana', object: on(g, 'A', 'Arcane Signet'), color: 'R' });
  assert.equal(g.player('A').pool.R, 2);
});

test("Commander's Sphere: mana dell'identità; sacrificalo: pesca una carta", () => {
  const g = main();
  const sphere = on(g, 'A', "Commander's Sphere");
  g.perform('A', { type: 'activateMana', object: sphere, color: 'R' });
  const hand = g.zone('A', 'hand').length;
  act(g, 'A', sphere, { sacrifice: [sphere] });
  resolveAll(g);
  assert.equal(g.zone('A', 'hand').length, hand + 1);
});

test('Mind Stone: {T}: {C}; {1},{T}, sacrificalo: pesca una carta', () => {
  const g = main();
  const stone = on(g, 'A', 'Mind Stone');
  addMana(g, 'A', R(1));
  const hand = g.zone('A', 'hand').length;
  act(g, 'A', stone, { sacrifice: [stone] });
  resolveAll(g);
  assert.equal(g.zone('A', 'hand').length, hand + 1);
  const stone2 = on(g, 'A', 'Mind Stone');
  g.perform('A', { type: 'activateMana', object: stone2 });
  assert.equal(g.player('A').pool.C, 1);
});

test('Fire Diamond entra tappato e produce {R}', () => {
  const g = main();
  castCard(g, 'A', 'Fire Diamond', R(2));
  resolveAll(g);
  const fd = named(g, 'A', 'battlefield', 'Fire Diamond')[0];
  assert.equal(fd.tapped, true);
});

test('Thought Vessel: nessun limite di carte in mano; {T}: {C}', () => {
  const g = commanderGame();
  const tv = on(g, 'A', 'Thought Vessel');
  g.setup.putInHand('A', 'Mountain');
  g.setup.putInHand('A', 'Mountain');
  advanceTo(g, 'upkeep', 2); // nessuno scarto richiesto a fine turno
  assert.equal(g.zone('A', 'hand').length, 10);
  advanceTo(g, 'main1', 5);
  g.perform('A', { type: 'activateMana', object: tv });
  assert.equal(g.player('A').pool.C, 1);
});

test('Ruby Medallion: le magie rosse costano {1} in meno, le altre no', () => {
  const g = main();
  on(g, 'A', 'Ruby Medallion');
  assert.equal(g.costToCast('A', g.setup.putInHand('A', 'Lightning Strike')), '{R}');
  assert.equal(g.costToCast('A', g.setup.putInHand('A', 'Sol Ring')), '{1}');
});

test('Impact Tremors: ogni creatura che entra sotto il tuo controllo infligge 1 danno a ogni avversario', () => {
  const g = main();
  on(g, 'A', 'Impact Tremors');
  castCard(g, 'A', "Krenko's Command", R(2));
  resolveAll(g);
  assert.deepEqual(['A', 'B'].map((p) => g.player(p).life), [40, 38]);
});

test('Goblin Bombardment: sacrifica una creatura: 1 danno a qualsiasi bersaglio', () => {
  const g = main();
  const bomb = on(g, 'A', 'Goblin Bombardment');
  act(g, 'A', bomb, { sacrifice: [goblinToken(g, 'A')], targets: [{ player: 'B' }] });
  resolveAll(g);
  assert.equal(g.player('B').life, 39);
});

test('Il mazzo Goblin si gioca: Mountain e Command Tower si giocano come terre', () => {
  const g = main();
  const id = g.setup.putInHand('A', 'Command Tower');
  g.perform('A', { type: 'playLand', object: id });
  assert.equal(named(g, 'A', 'battlefield', 'Command Tower').length, 1);
});
