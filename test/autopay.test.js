// Pagamento automatico del costo: il motore sceglie quali fonti di mana tappare
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo } = require('./helpers');

function setup(lands) {
  const g = commanderGame();
  advanceTo(g, 'main1');
  return { g, ids: lands.map((n) => g.setup.putOnBattlefield('A', n)) };
}

test('con il pagamento automatico si tappano le terre necessarie e la magia va sulla Pila', () => {
  const { g, ids } = setup(['Forest', 'Forest', 'Forest']);
  g.perform('A', { type: 'cast', object: g.setup.putInHand('A', 'Grizzly Bears'), autoPay: true });
  assert.equal(g.stack.length, 1);
  assert.equal(ids.filter((id) => g.object(id).tapped).length, 2);
});

test('il colore richiesto viene da una fonte di quel colore, il generico dalle altre', () => {
  const { g, ids } = setup(['Mountain', 'Forest']);
  g.perform('A', { type: 'cast', object: g.setup.putInHand('A', 'Grizzly Bears'), autoPay: true });
  assert.deepEqual(ids.map((id) => g.object(id).tapped), [true, true]);
});

test('le terre di un solo colore si usano prima delle fonti di qualsiasi colore', () => {
  const { g, ids } = setup(['Command Tower', 'Mountain', 'Mountain']);
  g.perform('A', { type: 'cast', object: g.setup.putInHand('A', 'Lightning Bolt'), targets: [{ player: 'B' }], autoPay: true });
  assert.equal(g.object(ids[0]).tapped, false);
});

test('se il mana non basta non si tappa nulla e il motivo è spiegato', () => {
  const { g, ids } = setup(['Forest']);
  const bears = g.setup.putInHand('A', 'Grizzly Bears');
  assert.throws(() => g.perform('A', { type: 'cast', object: bears, autoPay: true }), (e) => e.code === 'NOT_ENOUGH_MANA');
  assert.equal(g.object(ids[0]).tapped, false);
});

test('le terre si usano prima delle creature che producono mana, e le creature appena entrate no', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  const elf = g.setup.putOnBattlefield('A', 'Llanowar Elves');
  const sick = g.setup.putOnBattlefield('A', 'Elvish Mystic', { sick: true });
  const forest = g.setup.putOnBattlefield('A', 'Forest');
  g.perform('A', { type: 'cast', object: g.setup.putInHand('A', 'Giant Growth'), targets: [{ object: elf }], autoPay: true });
  assert.deepEqual([g.object(forest).tapped, g.object(elf).tapped, g.object(sick).tapped], [true, false, false]);
});

test('il mana già nel pool si usa per primo', () => {
  const { g, ids } = setup(['Forest', 'Forest']);
  g.perform('A', { type: 'activateMana', object: ids[0] });
  g.perform('A', { type: 'cast', object: g.setup.putInHand('A', 'Giant Growth'), targets: [{ object: g.setup.putOnBattlefield('A', 'Grizzly Bears') }], autoPay: true });
  assert.equal(g.object(ids[1]).tapped, false);
});

test('anche le abilità attivate possono pagare in automatico, senza tappare la fonte stessa', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  const rod = g.setup.putOnBattlefield('A', 'Rod of Ruin');
  ['Mountain', 'Mountain', 'Mountain'].forEach((n) => g.setup.putOnBattlefield('A', n));
  g.perform('A', { type: 'activate', object: rod, targets: [{ player: 'B' }], autoPay: true });
  assert.equal(g.stack.length, 1);
});
