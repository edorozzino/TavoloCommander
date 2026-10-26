// Verifica di un'azione senza eseguirla: serve all'interfaccia per illuminare le mosse possibili e spiegare quelle vietate
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo, attackWith } = require('./helpers');
const { snapshot } = require('./simulator');

test('una magia lanciabile risulta possibile e la partita resta identica', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  g.setup.putOnBattlefield('A', 'Forest');
  g.setup.putOnBattlefield('A', 'Forest');
  const bears = g.setup.putInHand('A', 'Grizzly Bears');
  const before = snapshot(g);
  assert.deepEqual(g.check('A', { type: 'cast', object: bears, autoPay: true }), { ok: true });
  assert.equal(snapshot(g), before);
});

test('una magia non pagabile risulta vietata con il motivo, senza cambiare nulla', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  const bears = g.setup.putInHand('A', 'Grizzly Bears');
  const before = snapshot(g);
  const r = g.check('A', { type: 'cast', object: bears, autoPay: true });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NOT_ENOUGH_MANA');
  assert.match(r.message, /mana/);
  assert.equal(snapshot(g), before);
});

test('dopo una verifica la partita prosegue normalmente, anche con il generatore casuale', () => {
  const g1 = commanderGame({ seed: 5 });
  const g2 = commanderGame({ seed: 5 });
  advanceTo(g1, 'main1');
  advanceTo(g2, 'main1');
  g1.setup.putOnBattlefield('A', 'Forest');
  g2.setup.putOnBattlefield('A', 'Forest');
  const m = g1.setup.putInHand('A', 'Goblin Matron');
  g2.setup.putInHand('A', 'Goblin Matron');
  g1.check('A', { type: 'cast', object: m, autoPay: true });
  g1.check('A', { type: 'pass' });
  advanceTo(g1, 'upkeep', 3);
  advanceTo(g2, 'upkeep', 3);
  assert.equal(snapshot(g1), snapshot(g2));
});

test('la verifica funziona anche durante il combattimento', () => {
  const g = commanderGame();
  const bears = g.setup.putOnBattlefield('A', 'Grizzly Bears');
  attackWith(g, [[bears, 'B']]);
  const growth = g.setup.putInHand('A', 'Giant Growth');
  g.setup.putOnBattlefield('A', 'Forest');
  const before = snapshot(g);
  assert.equal(g.check('A', { type: 'cast', object: growth, targets: [{ object: bears }], autoPay: true }).ok, true);
  assert.equal(snapshot(g), before);
});

test('con una decisione in attesa non si verificano altre azioni', () => {
  const g = commanderGame();
  g.setup.putOnBattlefield('A', 'Grizzly Bears');
  advanceTo(g, 'declareAttackers');
  assert.equal(g.check('A', { type: 'pass' }).code, 'DECISION_PENDING');
});
