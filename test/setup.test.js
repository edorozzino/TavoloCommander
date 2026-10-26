// CR 103 (inizio della partita), 903.4-903.7 (regole Commander di partenza)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame } = require('./helpers');

test('ogni giocatore parte con 40 punti vita e nessun segnalino veleno', () => {
  const g = commanderGame();
  for (const p of g.players) {
    assert.equal(g.player(p).life, 40);
    assert.equal(g.player(p).poison, 0);
  }
});

test('il comandante parte nella zona di comando e non nel grimorio', () => {
  const g = commanderGame();
  const a = g.player('A');
  assert.deepEqual(g.zone('A', 'command').map((o) => o.name), ['Krenko, Mob Boss']);
  assert.equal(g.zone('A', 'library').length + a.handSize, 99);
});

test('ogni giocatore pesca 7 carte come mano iniziale', () => {
  const g = commanderGame();
  for (const p of g.players) assert.equal(g.zone(p, 'hand').length, 7);
  assert.equal(g.zone('A', 'library').length, 92);
});

test('lo stesso seme produce lo stesso ordine del grimorio (partite riproducibili)', () => {
  const names = (g) => g.zone('A', 'library').map((o) => o.cardId);
  assert.deepEqual(names(commanderGame({ seed: 7 })), names(commanderGame({ seed: 7 })));
  assert.notDeepEqual(names(commanderGame({ seed: 7 })), names(commanderGame({ seed: 8 })));
});

test('la partita inizia nel mantenimento del primo turno con la priorità al giocatore attivo', () => {
  const g = commanderGame();
  assert.equal(g.turn, 1);
  assert.equal(g.active, 'A');
  assert.equal(g.step, 'upkeep');
  assert.equal(g.priority, 'A');
});

test('servono da 2 a 4 giocatori', () => {
  assert.throws(() => commanderGame({ players: 1 }), /giocatori/);
});
