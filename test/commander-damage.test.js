// CR 903.10a e 704.6c: danni da comandante
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo, attackWith } = require('./helpers');

// Mette il comandante di pid sul campo, pronto ad attaccare
function commanderReady(g, pid) {
  return g.setup.moveTo(g.zone(pid, 'command')[0].id, 'battlefield', { sick: false });
}

test('21 danni da combattimento dallo stesso comandante fanno perdere la partita', () => {
  const g = commanderGame();
  const krenko = commanderReady(g, 'A');
  g.setup.addCommanderDamage('B', g.object(krenko).cardId, 18);
  attackWith(g, [[krenko, 'B']]);
  advanceTo(g, 'endCombat');
  assert.equal(g.hasLost('B'), true);
});

test('i danni da comandanti diversi non si sommano (20 da uno e 3 da un altro)', () => {
  const g = commanderGame();
  const krenkoA = commanderReady(g, 'A');
  const cardC = g.zone('C', 'command')[0].cardId;
  g.setup.addCommanderDamage('B', g.object(krenkoA).cardId, 20);
  g.setup.addCommanderDamage('B', cardC, 0);
  advanceTo(g, 'upkeep', 3);
  attackWith(g, [[commanderReady(g, 'C'), 'B']]);
  advanceTo(g, 'endCombat');
  assert.equal(g.hasLost('B'), false);
  assert.equal(g.player('B').commanderDamage[cardC], 3);
});

test('i danni da comandante proseguono anche se il comandante cambia zona e torna (stessa carta)', () => {
  const g = commanderGame({ players: 2 });
  let krenko = commanderReady(g, 'A');
  const card = g.object(krenko).cardId;
  attackWith(g, [[krenko, 'B']]);
  advanceTo(g, 'endCombat');
  g.setup.moveTo(krenko, 'command');
  advanceTo(g, 'upkeep', 3);
  krenko = commanderReady(g, 'A');
  attackWith(g, [[krenko, 'B']]);
  advanceTo(g, 'endCombat');
  assert.equal(g.player('B').commanderDamage[card], 6);
});

test('i danni da comandante contano anche se a controllarlo è un altro giocatore', () => {
  const g = commanderGame();
  const krenko = commanderReady(g, 'A');
  const card = g.object(krenko).cardId;
  g.setup.gainControl(krenko, 'C');
  advanceTo(g, 'upkeep', 3);
  attackWith(g, [[krenko, 'B']]);
  advanceTo(g, 'endCombat');
  assert.equal(g.player('B').commanderDamage[card], 3);
});

test('i danni da comandante tolgono anche punti vita', () => {
  const g = commanderGame();
  attackWith(g, [[commanderReady(g, 'A'), 'B']]);
  advanceTo(g, 'endCombat');
  assert.equal(g.player('B').life, 37);
});

test('un comandante con Legame vitale fa guadagnare vita e conta come danno da comandante', () => {
  const g = commanderGame({ commander: 'Vampire Nighthawk' });
  const hawk = commanderReady(g, 'A');
  attackWith(g, [[hawk, 'B']]);
  advanceTo(g, 'endCombat');
  assert.equal(g.player('A').life, 42);
  assert.equal(g.player('B').commanderDamage[g.object(hawk).cardId], 2);
});
