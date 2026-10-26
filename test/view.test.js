// Vista della partita per ciascun giocatore: informazioni nascoste (CR 400.2) e aiuti per l'interfaccia
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo, addMana, attackWith, passAll } = require('./helpers');
const { buildView } = require('../engine/view');

const names = { A: 'Anna', B: 'Bruno', C: 'Carla', D: 'Dario' };
const view = (g, pid) => buildView(g, pid, { names });
const player = (v, pid) => v.players.find((p) => p.id === pid);

test('ognuno vede la propria mano ma solo il numero di carte delle mani altrui', () => {
  const g = commanderGame();
  const v = view(g, 'A');
  assert.equal(player(v, 'A').hand.length, 7);
  assert.equal(player(v, 'B').hand, null);
  assert.equal(player(v, 'B').handCount, 7);
});

test('nessuno vede le carte del grimorio, solo quante sono', () => {
  const g = commanderGame();
  const v = view(g, 'A');
  assert.equal(player(v, 'A').libraryCount, 92);
  assert.equal(JSON.stringify(v).includes('"library"'), false);
});

test('campo, cimitero, esilio, zona di comando e Pila sono pubblici', () => {
  const g = commanderGame();
  g.setup.putOnBattlefield('B', 'Grizzly Bears');
  g.setup.putInGraveyard('B', 'Shock');
  const v = view(g, 'A');
  assert.deepEqual(player(v, 'B').battlefield.map((o) => o.name), ['Grizzly Bears']);
  assert.deepEqual(player(v, 'B').graveyard.map((o) => o.name), ['Shock']);
  assert.deepEqual(player(v, 'B').command.map((o) => o.name), ['Krenko, Mob Boss']);
});

test('forza, costituzione e keyword sono quelle calcolate dal motore', () => {
  const g = commanderGame();
  g.setup.putOnBattlefield('A', 'Goblin Chieftain');
  const tok = g.setup.createToken('A', 'Goblin');
  const o = player(view(g, 'A'), 'A').battlefield.find((x) => x.id === tok);
  assert.deepEqual([o.power, o.toughness, o.keywords.includes('Haste'), o.isToken], [2, 2, true, true]);
});

test('turno, passo, priorità e nomi dei giocatori', () => {
  const g = commanderGame();
  const v = view(g, 'B');
  assert.deepEqual([v.turn, v.step, v.active, v.priority, v.me], [1, 'upkeep', 'A', 'A', 'B']);
  assert.equal(player(v, 'C').name, 'Carla');
});

test('una decisione in attesa mostra le opzioni solo a chi deve decidere', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  g.setup.putInLibrary('A', 'Goblin Guide');
  const matron = g.setup.putInHand('A', 'Goblin Matron');
  addMana(g, 'A', ['Mountain', 'Mountain', 'Mountain']);
  g.perform('A', { type: 'cast', object: matron });
  passAll(g);
  passAll(g);
  const mine = view(g, 'A').decision;
  const theirs = view(g, 'B').decision;
  assert.equal(mine.type, 'search');
  assert.ok(mine.cards.some((c) => c.name === 'Goblin Guide'));
  assert.deepEqual(theirs, { type: 'search', player: 'A' });
});

test('le carte in mano indicano costo, bersagli legali e modalità', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  const bears = g.setup.putOnBattlefield('B', 'Grizzly Bears');
  g.setup.putInHand('A', 'Lightning Bolt');
  g.setup.putInHand('A', 'Goblin Surprise');
  const hand = player(view(g, 'A'), 'A').hand;
  const bolt = hand.find((o) => o.name === 'Lightning Bolt');
  assert.equal(bolt.cast.cost, '{R}');
  assert.ok(bolt.cast.targets[0].some((t) => t.object === bears));
  assert.ok(bolt.cast.targets[0].some((t) => t.player === 'C'));
  const surprise = hand.find((o) => o.name === 'Goblin Surprise');
  assert.equal(surprise.cast.modes.length, 2);
});

test('i propri permanenti elencano le abilità attivabili, con sacrifici e colori possibili', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  const sgc = g.setup.putOnBattlefield('A', 'Siege-Gang Commander');
  const tok = g.setup.createToken('A', 'Goblin');
  const tower = g.setup.putOnBattlefield('A', 'Command Tower');
  const mine = player(view(g, 'A'), 'A').battlefield;
  const ab = mine.find((o) => o.id === sgc).abilities.find((a) => a.kind === 'activated');
  assert.equal(ab.cost, '{1}{R}');
  assert.ok(ab.sacrificeOptions.includes(tok));
  assert.deepEqual(mine.find((o) => o.id === tower).abilities[0].colors, ['R']);
  const theirs = player(view(g, 'B'), 'A').battlefield.find((o) => o.id === sgc);
  assert.equal(theirs.abilities, undefined);
});

test('il combattimento mostra attaccanti, difensori e bloccanti', () => {
  const g = commanderGame();
  const bears = g.setup.putOnBattlefield('A', 'Grizzly Bears');
  attackWith(g, [[bears, 'C']]);
  const v = view(g, 'B');
  assert.deepEqual(v.combat.attackers, [{ id: bears, defender: 'C', blockers: [] }]);
});

test('il vincitore e i giocatori eliminati sono indicati', () => {
  const g = commanderGame({ players: 2 });
  g.setup.setLife('B', 0);
  g.perform('A', { type: 'pass' });
  const v = view(g, 'A');
  assert.equal(v.winner, 'A');
  assert.equal(player(v, 'B').lost, true);
});

test('una creatura passata sotto il controllo di un altro giocatore appare dalla sua parte del tavolo', () => {
  const g = commanderGame();
  const bears = g.setup.putOnBattlefield('B', 'Grizzly Bears');
  g.setup.gainControl(bears, 'A');
  const v = view(g, 'A');
  assert.ok(player(v, 'A').battlefield.some((o) => o.id === bears));
  assert.equal(player(v, 'B').battlefield.length, 0);
  assert.ok(player(v, 'A').battlefield.find((o) => o.id === bears).abilities);
});

test('le carte in mano dicono se si possono giocare adesso, e altrimenti perché', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  g.setup.putOnBattlefield('A', 'Forest');
  g.setup.putOnBattlefield('A', 'Forest');
  g.setup.putInHand('A', 'Grizzly Bears');
  g.setup.putInHand('A', 'Colossal Dreadmaw');
  const hand = player(view(g, 'A'), 'A').hand;
  assert.deepEqual(hand.find((o) => o.name === 'Grizzly Bears').playable, { ok: true });
  const big = hand.find((o) => o.name === 'Colossal Dreadmaw').playable;
  assert.equal(big.ok, false);
  assert.match(big.message, /\{4\}\{G\}\{G\}/);
  assert.equal(hand.find((o) => o.name === 'Forest').playable.ok, true);
});

test('le carte dicono perché non si giocano nel turno di un avversario', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  g.perform('A', { type: 'pass' });
  g.setup.putOnBattlefield('B', 'Forest');
  g.setup.putOnBattlefield('B', 'Forest');
  g.setup.putInHand('B', 'Grizzly Bears');
  const bears = player(view(g, 'B'), 'B').hand.find((o) => o.name === 'Grizzly Bears');
  assert.equal(bears.playable.code, 'SORCERY_TIMING');
});

test('le abilità dei propri permanenti dicono se sono attivabili', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  const krenko = g.setup.putOnBattlefield('A', 'Krenko, Mob Boss', { sick: true });
  const ab = player(view(g, 'A'), 'A').battlefield.find((o) => o.id === krenko).abilities[0];
  assert.equal(ab.playable.code, 'SUMMONING_SICK');
});

test('senza priorità non si calcola nulla: non serve e costerebbe tempo', () => {
  const g = commanderGame();
  g.setup.putInHand('B', 'Grizzly Bears');
  assert.equal(player(view(g, 'B'), 'B').hand.find((o) => o.name === 'Grizzly Bears').playable, undefined);
});
