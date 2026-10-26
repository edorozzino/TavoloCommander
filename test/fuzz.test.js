// Partite casuali: nessun crash, invarianti rispettati, azioni rifiutate senza effetti collaterali
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomGame } = require('./simulator');

test('30 partite casuali a 2-4 giocatori rispettano gli invarianti del motore', () => {
  let accepted = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const stats = randomGame(seed, { players: 2 + (seed % 3), maxTurns: 10 });
    accepted += stats.accepted;
  }
  assert.ok(accepted > 400, `troppe poche azioni accettate (${accepted}): il simulatore non sta giocando davvero`);
});
