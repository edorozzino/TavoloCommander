// CR 514.1: dimensione massima della mano
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo } = require('./helpers');

test('a fine turno chi ha più di 7 carte in mano ne scarta fino a tenerne 7', () => {
  const g = commanderGame();
  g.setup.putInHand('A', 'Forest');
  advanceTo(g, 'cleanup');
  assert.deepEqual({ type: g.decision.type, player: g.decision.player, count: g.decision.count }, { type: 'discard', player: 'A', count: 2 });
  const [x, y] = g.zone('A', 'hand');
  g.perform('A', { type: 'discard', objects: [x.id, y.id] });
  assert.equal(g.zone('A', 'hand').length, 7);
  assert.equal(g.zone('A', 'graveyard').length, 2);
  assert.equal(g.active, 'B');
});

test('bisogna scartare esattamente il numero di carte richiesto', () => {
  const g = commanderGame();
  advanceTo(g, 'cleanup');
  const [x] = g.zone('A', 'hand');
  assert.throws(() => g.perform('A', { type: 'discard', objects: [x.id, x.id] }), (e) => e.code === 'INVALID_DISCARD');
});
