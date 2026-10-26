// Avversario computer: sceglie mosse legali e sensate; partite tra bot arrivano a un vincitore
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo, attackWith } = require('./helpers');
const { botMove, chooseSacrifice } = require('../engine/bot');
const { createGame } = require('../engine');
const { STARTER_DECKS } = require('../engine/decks');
const { checkInvariants } = require('./simulator');

const field = (g, pid) => g.battlefield().filter((o) => o.controller === pid);
const play = (g, pid) => g.perform(pid, botMove(g, pid));

test('nella sua fase principale il bot gioca una terra', () => {
  const g = commanderGame({ players: 2 });
  advanceTo(g, 'main1');
  const hand = g.zone('A', 'hand').length;
  play(g, 'A');
  assert.equal(g.zone('A', 'hand').length, hand - 1); // la mano iniziale è fatta di Forest: ne gioca una
  assert.equal(field(g, 'A').filter((o) => o.name === 'Forest').length, 1);
});

test('il bot lancia la magia più costosa che riesce a pagare', () => {
  const g = commanderGame({ players: 2 });
  advanceTo(g, 'main1');
  g.state.get('A').landsPlayed = 1;
  for (let i = 0; i < 4; i++) g.setup.putOnBattlefield('A', 'Forest');
  g.setup.putInHand('A', 'Grizzly Bears');
  g.setup.putInHand('A', 'Giant Spider');
  g.setup.putInHand('A', 'Colossal Dreadmaw');
  play(g, 'A');
  assert.equal(g.stack.at(-1).name, 'Giant Spider');
});

test('con una rimozione il bot colpisce la creatura avversaria più forte che può eliminare', () => {
  const g = commanderGame({ players: 2 });
  advanceTo(g, 'main1');
  g.state.get('A').landsPlayed = 1;
  g.setup.putOnBattlefield('A', 'Mountain');
  const bears = g.setup.putOnBattlefield('B', 'Grizzly Bears');
  g.setup.putOnBattlefield('B', 'Llanowar Elves');
  g.setup.putInHand('A', 'Lightning Bolt');
  play(g, 'A');
  assert.deepEqual(g.stack.at(-1).targets, [{ object: bears }]);
});

test('senza creature da eliminare il bot colpisce l\'avversario con meno vita', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  g.state.get('A').landsPlayed = 1;
  g.setup.putOnBattlefield('A', 'Mountain');
  g.setup.setLife('C', 12);
  g.setup.putInHand('A', 'Lightning Bolt');
  play(g, 'A');
  assert.deepEqual(g.stack.at(-1).targets, [{ player: 'C' }]);
});

test('il bot non lancia una distruzione di massa quando ha più creature degli avversari', () => {
  const g = commanderGame({ players: 2 });
  advanceTo(g, 'main1');
  g.state.get('A').landsPlayed = 1;
  for (let i = 0; i < 4; i++) g.setup.putOnBattlefield('A', 'Swamp');
  g.setup.putOnBattlefield('A', 'Grizzly Bears');
  g.setup.putOnBattlefield('A', 'Typhoid Rats');
  g.setup.putInHand('A', 'Damnation');
  assert.equal(botMove(g, 'A').type, 'pass');
});

test('il bot attacca con una creatura volante se nessuno può bloccarla', () => {
  const g = commanderGame({ players: 2 });
  const angel = g.setup.putOnBattlefield('A', 'Serra Angel');
  g.setup.putOnBattlefield('B', 'Grizzly Bears');
  advanceTo(g, 'declareAttackers');
  const move = botMove(g, 'A');
  assert.deepEqual(move, { type: 'declareAttackers', attackers: [{ object: angel, defender: 'B' }] });
});

test('il bot non manda un 2/2 contro un bloccante 2/4 che lo ucciderebbe senza morire', () => {
  const g = commanderGame({ players: 2 });
  g.setup.putOnBattlefield('A', 'Grizzly Bears');
  g.setup.putOnBattlefield('B', 'Giant Spider');
  advanceTo(g, 'declareAttackers');
  assert.deepEqual(botMove(g, 'A').attackers, []);
});

test('il bot blocca quando può uccidere l\'attaccante e sopravvivere', () => {
  const g = commanderGame({ players: 2 });
  const bears = g.setup.putOnBattlefield('A', 'Grizzly Bears');
  const spider = g.setup.putOnBattlefield('B', 'Giant Spider');
  attackWith(g, [[bears, 'B']]);
  advanceTo(g, 'declareBlockers');
  assert.deepEqual(botMove(g, 'B'), { type: 'declareBlockers', blocks: [{ blocker: spider, attacker: bears }] });
});

test('il bot fa un blocco di sacrificio solo se il danno sarebbe letale', () => {
  const g = commanderGame({ players: 2 });
  const big = g.setup.putOnBattlefield('A', 'Colossal Dreadmaw');
  const elf = g.setup.putOnBattlefield('B', 'Llanowar Elves');
  attackWith(g, [[big, 'B']]);
  advanceTo(g, 'declareBlockers');
  assert.deepEqual(botMove(g, 'B').blocks, []);
  g.setup.setLife('B', 5);
  assert.deepEqual(botMove(g, 'B').blocks, [{ blocker: elf, attacker: big }]);
});

test('per sacrificare il bot sceglie prima un token', () => {
  const g = commanderGame({ players: 2 });
  const bears = g.setup.putOnBattlefield('A', 'Grizzly Bears');
  const tok = g.setup.createToken('A', 'Goblin');
  assert.equal(chooseSacrifice(g, 'A', [bears, tok]), tok);
});

for (const [a, b] of [[0, 2], [1, 3], [2, 0], [3, 1]]) {
  test(`partita tra bot: ${STARTER_DECKS[a].name} contro ${STARTER_DECKS[b].name} arriva a un vincitore, con sole mosse legali`, () => {
    const g = createGame({
      seed: 11 + a,
      players: [a, b].map((i, k) => ({ id: k ? 'B' : 'A', commanders: [STARTER_DECKS[i].commander], library: STARTER_DECKS[i].cards.flatMap((e) => Array(e.count).fill(e.name)) })),
    });
    for (let step = 0; step < 6000 && !g.winner && g.turn <= 60; step++) {
      const pid = g.decision ? g.decision.player : g.priority;
      play(g, pid);
      checkInvariants(g);
    }
    assert.ok(g.winner, `nessun vincitore entro il turno ${g.turn}`);
  });
}
