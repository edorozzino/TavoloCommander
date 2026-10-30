// Effetti manuali (engine/manual.js): il testo che il motore non sa applicare lo applica il giocatore.
const test = require('node:test');
const assert = require('node:assert/strict');
const { defFromScryfall } = require('../engine/generated');
const { buildView } = require('../engine/view');
const { botMove } = require('../engine/bot');
const { commanderGame, advanceTo, passAll } = require('./helpers');

const info = (name, type, manaCost, oracle, extra = {}) => ({ name, type, manaCost, oracle, power: null, toughness: null, colorIdentity: [], ...extra });
const CARDS = Object.fromEntries([
  info('Dark Ritual', 'Instant', '{B}', 'Add {B}{B}{B}.'),
  info('Elvish Visionary', 'Creature — Elf Shaman', '{1}{G}', 'When this creature enters, draw a card.', { power: '1', toughness: '1' }),
  info('Viscera Seer', 'Creature — Vampire Wizard', '{B}', 'Sacrifice a creature: Scry 1.', { power: '1', toughness: '1' }),
].map((i) => [i.name, defFromScryfall(i)]));

function game() {
  const g = commanderGame({ players: 2, land: 'Swamp', commander: 'Syr Konrad, the Grim', cards: CARDS });
  advanceTo(g, 'main1');
  return g;
}
const manual = (g, pid, op, extra = {}) => g.perform(pid, { type: 'manual', op, ...extra });

test('una magia con effetto manuale apre la decisione quando si risolve, e Fatto la conclude', () => {
  const g = game();
  g.setup.putOnBattlefield('A', 'Swamp');
  const id = g.setup.putInHand('A', 'Dark Ritual');
  g.perform('A', { type: 'cast', object: id, autoPay: true });
  passAll(g);
  assert.equal(g.decision.type, 'manual');
  assert.equal(g.decision.text, 'Add {B}{B}{B}.');
  assert.equal(buildView(g, 'A').decision.source, 'Dark Ritual');
  manual(g, 'A', 'mana', { color: 'B', amount: 3 });
  assert.equal(g.decision.type, 'manual'); // si possono dare più comandi prima di Fatto
  manual(g, 'A', 'done');
  assert.equal(g.decision, null);
  assert.equal(g.player('A').pool.B, 3);
  assert.equal(g.stack.length, 0);
  assert.equal(g.zone('A', 'graveyard').at(-1).name, 'Dark Ritual');
  assert.equal(g.priority, 'A');
});

test('l\'innesco di entrata di una carta ricavata chiede l\'effetto manuale', () => {
  const g = game();
  g.setup.putOnBattlefield('A', 'Elvish Visionary');
  for (let i = 0; i < 5 && !g.decision; i++) g.perform(g.priority, { type: 'pass' }); // l'innesco va sulla Pila e si risolve
  assert.equal(g.decision?.type, 'manual');
  const hand = g.zone('A', 'hand').length;
  manual(g, 'A', 'draw', { player: 'A', amount: 1 });
  manual(g, 'A', 'done');
  assert.equal(g.zone('A', 'hand').length, hand + 1);
});

test('con la priorità si possono usare i comandi manuali; Fatto senza effetto in corso è rifiutato', () => {
  const g = game();
  manual(g, 'A', 'life', { player: 'B', amount: -3 });
  assert.equal(g.player('B').life, 37);
  assert.throws(() => manual(g, 'A', 'done'), /Non c'è nessun effetto/);
  assert.throws(() => manual(g, 'B', 'life', { player: 'A', amount: 1 }), /priorità/);
});

test('spostare una creatura nel cimitero la fa morire (innesca Syr Konrad)', () => {
  const g = game();
  g.setup.putOnBattlefield('A', 'Syr Konrad, the Grim');
  const victim = g.setup.putOnBattlefield('B', 'Viscera Seer');
  manual(g, 'A', 'move', { object: victim, to: 'graveyard' });
  assert.equal(g.zone('B', 'graveyard').at(-1).name, 'Viscera Seer');
  assert.equal(g.stack.at(-1).name, 'Syr Konrad, the Grim');
});

test('i segnalini -1/-1 messi a mano possono uccidere la creatura', () => {
  const g = game();
  const id = g.setup.putOnBattlefield('B', 'Elvish Visionary');
  manual(g, 'A', 'counter', { object: id, kind: '-1/-1', amount: 1 });
  assert.equal(g.zone('B', 'battlefield').some((o) => o.name === 'Elvish Visionary'), false);
});

test('non si spostano le carte nella mano di un altro giocatore', () => {
  const g = game();
  const card = g.zone('B', 'hand')[0];
  assert.throws(() => manual(g, 'A', 'move', { object: card.id, to: 'graveyard' }), /tua mano/);
});

test('la ricerca manuale chiede la carta, poi si torna alla priorità', () => {
  const g = game();
  const target = g.setup.putInLibrary('A', 'Dark Ritual');
  manual(g, 'A', 'search', { to: 'hand' });
  assert.equal(g.decision.type, 'search');
  g.perform('A', { type: 'search', objects: [target] });
  assert.equal(g.decision, null);
  assert.equal(g.priority, 'A');
  assert.ok(g.zone('A', 'hand').some((o) => o.name === 'Dark Ritual'));
});

test('la profezia durante un effetto manuale torna all\'effetto in corso', () => {
  const g = game();
  g.setup.putOnBattlefield('A', 'Swamp');
  g.perform('A', { type: 'cast', object: g.setup.putInHand('A', 'Dark Ritual'), autoPay: true });
  passAll(g);
  manual(g, 'A', 'scry', { amount: 2 });
  assert.equal(g.decision.type, 'scry');
  const [x, y] = g.decision.cards;
  g.perform('A', { type: 'scry', top: [x], bottom: [y] });
  assert.equal(g.decision.type, 'manual');
  assert.equal(g.zone('A', 'library').at(-1).id, y);
});

test('l\'abilità attivata ricavata si paga (sacrificio) e poi si applica a mano', () => {
  const g = game();
  const seer = g.setup.putOnBattlefield('A', 'Viscera Seer');
  const fodder = g.setup.putOnBattlefield('A', 'Elvish Visionary');
  const ab = buildView(g, 'A').players[0].battlefield.find((o) => o.id === seer).abilities[0];
  assert.deepEqual(ab.sacrificeOptions.sort(), [seer, fodder].sort());
  g.perform('A', { type: 'activate', object: seer, ability: 0, sacrifice: [fodder] });
  passAll(g);
  assert.equal(g.decision.type, 'manual');
});

test('le pedine create a mano sono creature con forza e costituzione', () => {
  const g = game();
  manual(g, 'A', 'token', { name: 'Zombie', power: 2, toughness: 2, amount: 2 });
  const tokens = g.zone('A', 'battlefield').filter((o) => o.isToken);
  assert.equal(tokens.length, 2);
  assert.equal(g.power(tokens[0]), 2);
});

test('pagare un costo a mano tappa le terre se il pool non basta', () => {
  const g = game();
  g.setup.putOnBattlefield('A', 'Swamp');
  g.setup.putOnBattlefield('A', 'Swamp');
  manual(g, 'A', 'pay', { cost: '{1}{B}' });
  assert.equal(g.zone('A', 'battlefield').filter((o) => o.tapped).length, 2);
  assert.throws(() => manual(g, 'A', 'pay', { cost: '{B}' }), /abbastanza/);
});

test('il bot conclude subito un effetto manuale', () => {
  const g = game();
  g.setup.putOnBattlefield('A', 'Swamp');
  g.perform('A', { type: 'cast', object: g.setup.putInHand('A', 'Dark Ritual'), autoPay: true });
  passAll(g);
  assert.deepEqual(botMove(g, 'A'), { type: 'manual', op: 'done' });
});

test('la vista segnala le carte con testo da applicare a mano', () => {
  const g = game();
  const id = g.setup.putOnBattlefield('A', 'Viscera Seer');
  const v = buildView(g, 'A');
  assert.equal(v.manual, true);
  assert.match(v.players[0].battlefield.find((o) => o.id === id).manual[0], /Scry 1/);
});
