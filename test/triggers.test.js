// CR 603: abilità innescate
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo, addMana, attackWith, passAll } = require('./helpers');

function cast(g, pid, name, mana, targets) {
  const id = g.setup.putInHand(pid, name);
  addMana(g, pid, mana);
  g.perform(pid, { type: 'cast', object: id, targets });
  return id;
}

test("un'abilità innescata va sulla Pila prima che qualcuno riceva la priorità (CR 603.3)", () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  cast(g, 'A', 'Elvish Visionary', ['Forest', 'Forest']);
  passAll(g); // si risolve la creatura: si innesca l'abilità di entrata
  assert.equal(g.stack.length, 1);
  assert.equal(g.stack[0].isAbility, true);
  assert.equal(g.priority, 'A');
});

test('Elvish Visionary: quando entra, il controllore pesca una carta', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  const before = g.zone('A', 'hand').length; // la Visionary arriva dalla preparazione: la pescata aggiunge una carta
  cast(g, 'A', 'Elvish Visionary', ['Forest', 'Forest']);
  passAll(g);
  passAll(g);
  assert.equal(g.zone('A', 'hand').length, before + 1);
});

test('Phyrexian Arena: nel mantenimento del controllore pesca una carta e perde 1 punto vita', () => {
  const g = commanderGame();
  g.setup.putOnBattlefield('A', 'Phyrexian Arena');
  advanceTo(g, 'upkeep', 5);
  assert.equal(g.stack.length, 1);
  const hand = g.zone('A', 'hand').length;
  passAll(g);
  assert.equal(g.player('A').life, 39);
  assert.equal(g.zone('A', 'hand').length, hand + 1);
});

test('Phyrexian Arena non si innesca nel mantenimento degli avversari', () => {
  const g = commanderGame();
  g.setup.putOnBattlefield('A', 'Phyrexian Arena');
  advanceTo(g, 'upkeep', 2);
  assert.equal(g.stack.length, 0);
});

test('Cruel Celebrant: quando muore una tua creatura, ogni avversario perde 1 e tu guadagni 1', () => {
  const g = commanderGame();
  g.setup.putOnBattlefield('A', 'Cruel Celebrant');
  const bears = g.setup.putOnBattlefield('A', 'Grizzly Bears');
  cast(g, 'A', 'Lightning Bolt', ['Mountain'], [{ object: bears }]);
  passAll(g); // Bolt: muore l'orso, si innesca Celebrant
  passAll(g); // si risolve l'innesco
  assert.deepEqual(['A', 'B', 'C', 'D'].map((p) => g.player(p).life), [41, 39, 39, 39]);
});

test('anche un token che muore innesca le abilità "quando muore"', () => {
  const g = commanderGame();
  g.setup.putOnBattlefield('A', 'Cruel Celebrant');
  const goblin = g.setup.createToken('A', 'Goblin');
  cast(g, 'A', 'Lightning Bolt', ['Mountain'], [{ object: goblin }]);
  passAll(g);
  passAll(g);
  assert.equal(g.player('A').life, 41);
});

test('morti simultanee: Celebrant vede anche la propria morte e quella degli altri (CR 603.10a)', () => {
  const g = commanderGame();
  const celebrant = g.setup.putOnBattlefield('A', 'Cruel Celebrant');
  const bears = g.setup.putOnBattlefield('A', 'Grizzly Bears');
  const [s1, s2] = [g.setup.putOnBattlefield('B', 'Giant Spider'), g.setup.putOnBattlefield('B', 'Giant Spider')];
  attackWith(g, [[celebrant, 'B'], [bears, 'B']]);
  advanceTo(g, 'declareBlockers');
  g.perform('B', { type: 'declareBlockers', blocks: [{ blocker: s1, attacker: celebrant }, { blocker: s2, attacker: bears }] });
  advanceTo(g, 'combatDamage');
  assert.equal(g.stack.length, 2);
  passAll(g);
  passAll(g);
  assert.equal(g.player('A').life, 42);
  assert.equal(g.player('C').life, 38);
});

test('ordine APNAP: gli inneschi del giocatore attivo vanno sulla Pila per primi (CR 603.3b)', () => {
  const g = commanderGame();
  g.setup.putOnBattlefield('A', 'Cruel Celebrant');
  g.setup.putOnBattlefield('B', 'Cruel Celebrant');
  const a = g.setup.putOnBattlefield('A', 'Grizzly Bears');
  const b = g.setup.putOnBattlefield('B', 'Grizzly Bears');
  attackWith(g, [[a, 'B']]);
  advanceTo(g, 'declareBlockers');
  g.perform('B', { type: 'declareBlockers', blocks: [{ blocker: b, attacker: a }] });
  advanceTo(g, 'combatDamage');
  assert.deepEqual(g.stack.map((o) => o.controller), ['A', 'B']);
});
