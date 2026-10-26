// CR 500-514 (struttura del turno), 116 (priorità), 103.8 (pescata del primo turno)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, passAll, advanceTo } = require('./helpers');

test('dopo un passaggio la priorità va al giocatore successivo in ordine di turno', () => {
  const g = commanderGame();
  g.perform('A', { type: 'pass' });
  assert.equal(g.priority, 'B');
});

test('agire senza avere la priorità è vietato e spiega il motivo', () => {
  const g = commanderGame();
  assert.throws(() => g.perform('B', { type: 'pass' }), (e) => e.code === 'NO_PRIORITY');
});

test('quando tutti passano con la Pila vuota si va al passo successivo (CR 500.2)', () => {
  const g = commanderGame();
  passAll(g);
  assert.equal(g.step, 'draw');
  assert.equal(g.priority, 'A');
});

test('in multiplayer nessuno salta la pescata del primo turno (CR 103.8c)', () => {
  const g = commanderGame({ players: 4 });
  advanceTo(g, 'draw');
  assert.equal(g.zone('A', 'hand').length, 8);
});

test('in una partita a 2 chi inizia salta la pescata del primo turno (CR 103.8a)', () => {
  const g = commanderGame({ players: 2 });
  advanceTo(g, 'draw');
  assert.equal(g.zone('A', 'hand').length, 7);
});

test('senza attaccanti si saltano dichiarazione dei bloccanti e danno da combattimento (CR 508.8)', () => {
  const g = commanderGame();
  advanceTo(g, 'declareAttackers');
  passAll(g);
  assert.equal(g.step, 'endCombat');
});

test('finito il turno tocca al giocatore successivo, che parte dal mantenimento', () => {
  const g = commanderGame();
  advanceTo(g, 'upkeep', 2);
  assert.equal(g.active, 'B');
  assert.equal(g.priority, 'B');
});

test('nel passo di stap il giocatore attivo stappa i propri permanenti (CR 502.3)', () => {
  const g = commanderGame();
  const land = g.setup.putOnBattlefield('B', 'Forest', { tapped: true });
  const other = g.setup.putOnBattlefield('C', 'Forest', { tapped: true });
  advanceTo(g, 'upkeep', 2);
  assert.equal(g.object(land).tapped, false);
  assert.equal(g.object(other).tapped, true);
});

test('il mana pool si svuota alla fine di ogni passo (CR 500.4)', () => {
  const g = commanderGame();
  const land = g.setup.putOnBattlefield('A', 'Forest');
  g.perform('A', { type: 'activateMana', object: land });
  assert.equal(g.player('A').pool.G, 1);
  passAll(g);
  assert.equal(g.player('A').pool.G, 0);
});
