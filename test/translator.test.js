// Frasi comuni tradotte in effetti veri (engine/generated.js): le carte che le usano non richiedono più effetti a mano
const test = require('node:test');
const assert = require('node:assert/strict');
const { defFromScryfall } = require('../engine/generated');
const { commanderGame, passAll, advanceTo } = require('./helpers');

let n = 0;
const info = (type, manaCost, oracle, extra = {}) => ({ name: `Prova ${++n}`, type, manaCost, oracle, power: '1', toughness: '1', colorIdentity: [], ...extra });
const def = (type, cost, oracle) => defFromScryfall(info(type, cost, oracle));
function play(d) {
  const g = commanderGame({ players: 2, land: 'Swamp', cards: { [d.name]: d } });
  advanceTo(g, 'main1');
  return g;
}
const life = (g, pid) => g.state.get(pid).life;
const hand = (g, pid) => g.zone(pid, 'hand').length;
function cast(g, d) {
  for (let i = 0; i < 6; i++) g.setup.putOnBattlefield('A', 'Swamp');
  g.perform('A', { type: 'cast', object: g.setup.putInHand('A', d.name), autoPay: true });
  passAll(g);
}

test('una magia riconosciuta per intero non ha più testo a mano', () => {
  const d = def('Sorcery', '{2}{B}', 'You draw two cards and you lose 2 life.');
  assert.deepEqual(d.manual, []);
  const g = play(d);
  const before = [hand(g, 'A'), life(g, 'A')];
  cast(g, d);
  assert.deepEqual([hand(g, 'A'), life(g, 'A')], [before[0] + 2, before[1] - 2]);
  assert.equal(g.decision, null);
});

test('due frasi riconosciute si applicano in ordine', () => {
  const d = def('Sorcery', '{1}{B}', 'Each opponent loses 3 life. You gain 3 life.');
  const g = play(d);
  cast(g, d);
  assert.deepEqual([life(g, 'A'), life(g, 'B')], [43, 37]);
});

test('"e guadagni" vale una volta sola, non per ogni avversario', () => {
  const d = def('Sorcery', '{1}{B}', 'Each opponent loses 2 life and you gain 2 life.');
  const g = play(d);
  cast(g, d);
  assert.deepEqual([life(g, 'A'), life(g, 'B')], [42, 38]);
});

test('se una parte del testo non si riconosce, la magia resta tutta a mano', () => {
  const d = def('Sorcery', '{2}{B}{B}', "Destroy all creatures. They can't be regenerated.");
  assert.equal(d.effect[0].kind, 'manual');
  assert.equal(d.manual.length, 1);
  assert.equal(def('Sorcery', '{B}', 'Target player draws two cards.').effect[0].kind, 'manual');
});

test('innesco di entrata tradotto: pesca senza aprire gli effetti a mano', () => {
  const d = def('Creature — Elf', '{1}{B}', 'When this creature enters, draw a card.');
  assert.deepEqual(d.manual, []);
  const g = play(d);
  const before = hand(g, 'A');
  cast(g, d);
  passAll(g);
  assert.equal(hand(g, 'A'), before + 1);
  assert.equal(g.decision, null);
});

test('"you may" chiede conferma prima di applicare', () => {
  const d = def('Creature — Elf', '{1}{B}', 'When this creature enters, you may draw a card.');
  const g = play(d);
  const before = hand(g, 'A');
  cast(g, d);
  passAll(g);
  assert.equal(g.decision.type, 'confirm');
  g.perform('A', { type: 'confirm', yes: false });
  assert.equal(hand(g, 'A'), before);
});

test('innesco alla morte di un\'altra creatura non pedina', () => {
  const d = def('Creature — Human', '{2}{B}', 'Whenever another nontoken creature you control dies, draw a card.');
  const g = play(d);
  g.setup.putOnBattlefield('A', d.name);
  const bears = g.setup.putOnBattlefield('A', 'Grizzly Bears');
  const before = hand(g, 'A');
  g.toGraveyard([g.object(bears)]);
  g.givePriority('A');
  passAll(g);
  assert.equal(hand(g, 'A'), before + 1);
});

test('abilità attivata tradotta: cerca una terra base e la mette sul campo tappata', () => {
  const d = def('Land', '', '{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.');
  assert.deepEqual(d.manual, []);
  const g = play(d);
  const land = g.setup.putOnBattlefield('A', d.name);
  g.perform('A', { type: 'activate', object: land, ability: 0, sacrifice: [land] });
  passAll(g);
  assert.equal(g.decision.type, 'search');
  g.perform('A', { type: 'search', objects: [g.decision.options[0]] });
  const found = g.battlefield().filter((o) => o.controller === 'A' && o.name === 'Swamp');
  assert.equal(found.length, 1);
  assert.equal(found[0].tapped, true);
});

test('ogni giocatore pesca una carta', () => {
  const d = def('Artifact', '{2}', '{2}, {T}: Each player draws a card.');
  const g = play(d);
  for (let i = 0; i < 2; i++) g.setup.putOnBattlefield('A', 'Swamp');
  const rock = g.setup.putOnBattlefield('A', d.name);
  const before = [hand(g, 'A'), hand(g, 'B')];
  g.perform('A', { type: 'activate', object: rock, ability: 0, autoPay: true });
  passAll(g);
  assert.deepEqual([hand(g, 'A'), hand(g, 'B')], [before[0] + 1, before[1] + 1]);
});

test('i numeri si leggono in lettere e in cifre', () => {
  assert.equal(def('Sorcery', '{B}', 'Draw three cards.').effect[0].amount, 3);
  assert.equal(def('Sorcery', '{B}', 'You gain 10 life.').effect[0].amount, 10);
  assert.equal(def('Sorcery', '{B}', 'Scry 2.').effect[0].kind, 'scry');
});
