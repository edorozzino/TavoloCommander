// CR 704: azioni basate sullo stato; CR 800.4: un giocatore lascia la partita
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo, addMana, passAll } = require('./helpers');

function boltPlayer(g, caster, target) {
  const bolt = g.setup.putInHand(caster, 'Lightning Bolt');
  addMana(g, caster, ['Mountain']);
  g.perform(caster, { type: 'cast', object: bolt, targets: [{ player: target }] });
  passAll(g);
}

test('un giocatore a 0 punti vita perde la partita (CR 704.5a)', () => {
  const g = commanderGame();
  g.setup.setLife('B', 3);
  boltPlayer(g, 'A', 'B');
  assert.equal(g.hasLost('B'), true);
  assert.deepEqual(g.players, ['A', 'C', 'D']);
});

test('chi perde lascia la partita con tutti i suoi oggetti (CR 800.4a)', () => {
  const g = commanderGame();
  g.setup.putOnBattlefield('B', 'Grizzly Bears');
  g.setup.setLife('B', 3);
  boltPlayer(g, 'A', 'B');
  assert.equal([...g.objects.values()].some((o) => o.owner === 'B'), false);
});

test('chi ha perso non riceve più la priorità', () => {
  const g = commanderGame();
  g.setup.setLife('B', 3);
  boltPlayer(g, 'A', 'B');
  g.perform('A', { type: 'pass' });
  assert.equal(g.priority, 'C');
});

test('10 segnalini veleno fanno perdere la partita (CR 704.5c)', () => {
  const g = commanderGame();
  g.setup.setPoison('C', 10);
  g.perform('A', { type: 'pass' });
  assert.equal(g.hasLost('C'), true);
});

test('pescare da un grimorio vuoto fa perdere la partita (CR 704.5b)', () => {
  const g = commanderGame({ players: 3, librarySize: 7 });
  advanceTo(g, 'draw');
  assert.equal(g.hasLost('A'), true);
});

test("l'ultimo giocatore rimasto vince la partita (CR 104.2a)", () => {
  const g = commanderGame({ players: 2 });
  g.setup.setLife('B', 3);
  boltPlayer(g, 'A', 'B');
  assert.equal(g.winner, 'A');
});
