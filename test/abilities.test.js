// CR 602 (abilità attivate), 111 (token), 113.7a (abilità indipendenti dalla fonte)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo, addMana, passAll } = require('./helpers');

const tokens = (g, pid) => g.zone(pid, 'battlefield').filter((o) => o.isToken);

function krenkoReady() {
  const g = commanderGame();
  advanceTo(g, 'main1');
  const krenko = g.setup.putOnBattlefield('A', 'Krenko, Mob Boss');
  return { g, krenko };
}

test("l'abilità di Krenko crea un Goblin per ogni Goblin che controlli", () => {
  const { g, krenko } = krenkoReady();
  g.perform('A', { type: 'activate', object: krenko });
  passAll(g);
  assert.equal(tokens(g, 'A').length, 1);
  assert.equal(g.object(krenko).tapped, true);
});

test('il numero di Goblin si conta alla risoluzione, token compresi', () => {
  const { g, krenko } = krenkoReady();
  g.setup.createToken('A', 'Goblin');
  g.setup.createToken('A', 'Goblin');
  g.perform('A', { type: 'activate', object: krenko });
  passAll(g);
  assert.equal(tokens(g, 'A').length, 5);
});

test("un'abilità attivata usa la Pila e il giocatore mantiene la priorità (CR 602.2, 117.3c)", () => {
  const { g, krenko } = krenkoReady();
  g.perform('A', { type: 'activate', object: krenko });
  assert.equal(g.stack.length, 1);
  assert.equal(g.stack[0].isAbility, true);
  assert.equal(g.priority, 'A');
});

test("l'abilità si risolve anche se la fonte muore in risposta (CR 113.7a)", () => {
  const { g, krenko } = krenkoReady();
  const bolt = g.setup.putInHand('B', 'Lightning Bolt');
  g.perform('A', { type: 'activate', object: krenko });
  g.perform('A', { type: 'pass' });
  addMana(g, 'B', ['Mountain']);
  g.perform('B', { type: 'cast', object: bolt, targets: [{ object: krenko }] });
  passAll(g); // Bolt uccide Krenko
  passAll(g); // l'abilità si risolve: nessun Goblin rimasto da contare
  assert.equal(g.stack.length, 0);
  assert.equal(tokens(g, 'A').length, 0);
  assert.ok(g.events.some((e) => e.type === 'resolve' && e.ability));
});

test('le abilità con {T} non si usano con la debolezza da evocazione (CR 302.6)', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  const krenko = g.setup.putOnBattlefield('A', 'Krenko, Mob Boss', { sick: true });
  assert.throws(() => g.perform('A', { type: 'activate', object: krenko }), (e) => e.code === 'SUMMONING_SICK');
});

test('un permanente tappato non può pagare {T}', () => {
  const { g, krenko } = krenkoReady();
  g.perform('A', { type: 'activate', object: krenko });
  passAll(g);
  assert.throws(() => g.perform('A', { type: 'activate', object: krenko }), (e) => e.code === 'TAPPED');
});

test("un'abilità con costo in mana richiede il mana (Rod of Ruin)", () => {
  const g = commanderGame();
  const rod = g.setup.putOnBattlefield('A', 'Rod of Ruin');
  assert.throws(() => g.perform('A', { type: 'activate', object: rod, targets: [{ player: 'B' }] }), (e) => e.code === 'NOT_ENOUGH_MANA');
  assert.equal(g.object(rod).tapped, false);
  addMana(g, 'A', ['Mountain', 'Mountain', 'Mountain']);
  g.perform('A', { type: 'activate', object: rod, targets: [{ player: 'B' }] });
  passAll(g);
  assert.equal(g.player('B').life, 39);
});

test("Counterspell non può bersagliare un'abilità: non è una magia", () => {
  const { g, krenko } = krenkoReady();
  const counter = g.setup.putInHand('B', 'Counterspell');
  g.perform('A', { type: 'activate', object: krenko });
  const ability = g.stack[0].id;
  g.perform('A', { type: 'pass' });
  addMana(g, 'B', ['Island', 'Island']);
  assert.throws(() => g.perform('B', { type: 'cast', object: counter, targets: [{ object: ability }] }), (e) => e.code === 'INVALID_TARGET');
});

test('un token è una creatura 1/1 che entra con la debolezza da evocazione', () => {
  const { g, krenko } = krenkoReady();
  g.perform('A', { type: 'activate', object: krenko });
  passAll(g);
  const [goblin] = tokens(g, 'A');
  assert.equal(goblin.name, 'Goblin');
  assert.deepEqual([goblin.def.power, goblin.def.toughness], [1, 1]);
  assert.equal(g.isSick(goblin), true);
});

test('un token che lascia il campo di battaglia smette di esistere (CR 111.7, 704.5d)', () => {
  const g = commanderGame();
  const goblin = g.setup.createToken('B', 'Goblin');
  const bolt = g.setup.putInHand('A', 'Lightning Bolt');
  addMana(g, 'A', ['Mountain']);
  g.perform('A', { type: 'cast', object: bolt, targets: [{ object: goblin }] });
  passAll(g);
  assert.equal(g.zone('B', 'graveyard').length, 0);
  assert.equal([...g.objects.values()].some((o) => o.isToken), false);
});
