// CR 305: giocare terre
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo } = require('./helpers');

test('nella fase principale si gioca una terra dalla mano', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  const land = g.zone('A', 'hand')[0];
  g.perform('A', { type: 'playLand', object: land.id });
  assert.deepEqual(g.zone('A', 'battlefield').map((o) => o.name), ['Forest']);
  assert.equal(g.zone('A', 'hand').length, 7);
});

test('giocare una terra non usa la Pila e il giocatore mantiene la priorità (CR 305.1)', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  g.perform('A', { type: 'playLand', object: g.zone('A', 'hand')[0].id });
  assert.equal(g.stack.length, 0);
  assert.equal(g.priority, 'A');
});

test('si può giocare una sola terra per turno (CR 305.2)', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  const [a, b] = g.zone('A', 'hand');
  g.perform('A', { type: 'playLand', object: a.id });
  assert.throws(() => g.perform('A', { type: 'playLand', object: b.id }), (e) => e.code === 'LAND_ALREADY_PLAYED');
});

test('la terra si gioca solo in una fase principale (CR 305.3)', () => {
  const g = commanderGame();
  assert.equal(g.step, 'upkeep');
  assert.throws(() => g.perform('A', { type: 'playLand', object: g.zone('A', 'hand')[0].id }), (e) => e.code === 'SORCERY_TIMING');
});

test('nel turno di un altro giocatore non si giocano terre', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  g.perform('A', { type: 'pass' });
  assert.throws(() => g.perform('B', { type: 'playLand', object: g.zone('B', 'hand')[0].id }), (e) => e.code === 'SORCERY_TIMING');
});

test('il conteggio delle terre giocate riparte al turno successivo', () => {
  const g = commanderGame({ players: 2 });
  advanceTo(g, 'main1');
  g.perform('A', { type: 'playLand', object: g.zone('A', 'hand')[0].id });
  advanceTo(g, 'main1', 3);
  g.perform('A', { type: 'playLand', object: g.zone('A', 'hand')[0].id });
  assert.equal(g.zone('A', 'battlefield').length, 2);
});

test('ogni terra base produce il mana del suo colore (CR 305.6)', () => {
  const g = commanderGame();
  for (const [land, color] of [['Plains', 'W'], ['Island', 'U'], ['Swamp', 'B'], ['Mountain', 'R'], ['Forest', 'G']]) {
    g.perform('A', { type: 'activateMana', object: g.setup.putOnBattlefield('A', land) });
    assert.equal(g.player('A').pool[color], 1, land);
  }
});
