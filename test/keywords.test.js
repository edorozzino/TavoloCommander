// CR 702: keyword che non riguardano il combattimento
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, addMana, passAll } = require('./helpers');

test('Lampo: una creatura si lancia nel turno di un avversario (CR 702.8a)', () => {
  const g = commanderGame();
  const viper = g.setup.putInHand('B', 'Ambush Viper');
  g.perform('A', { type: 'pass' });
  addMana(g, 'B', ['Forest', 'Forest']);
  g.perform('B', { type: 'cast', object: viper });
  passAll(g);
  assert.ok(g.zone('B', 'battlefield').some((o) => o.name === 'Ambush Viper'));
});

test('Anti-malocchio: gli avversari non possono bersagliare la creatura (CR 702.11b)', () => {
  const g = commanderGame();
  const scout = g.setup.putOnBattlefield('B', 'Gladecover Scout');
  const bolt = g.setup.putInHand('A', 'Lightning Bolt');
  addMana(g, 'A', ['Mountain']);
  assert.throws(() => g.perform('A', { type: 'cast', object: bolt, targets: [{ object: scout }] }), (e) => e.code === 'INVALID_TARGET');
});

test('Anti-malocchio non impedisce al controllore di bersagliare la propria creatura', () => {
  const g = commanderGame();
  const scout = g.setup.putOnBattlefield('A', 'Gladecover Scout');
  const bolt = g.setup.putInHand('A', 'Lightning Bolt');
  addMana(g, 'A', ['Mountain']);
  g.perform('A', { type: 'cast', object: bolt, targets: [{ object: scout }] });
  passAll(g);
  assert.ok(g.zone('A', 'graveyard').some((o) => o.name === 'Gladecover Scout'));
});
