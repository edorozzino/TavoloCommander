// CR 601 (lanciare magie), 405 e 608 (Pila e risoluzione), 117.3 (priorità dopo le azioni)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo, addMana, passAll } = require('./helpers');

function mainWith(cards, mana, opts) {
  const g = commanderGame(opts);
  advanceTo(g, 'main1');
  const ids = cards.map((name) => g.setup.putInHand('A', name));
  addMana(g, 'A', mana);
  return { g, ids };
}

test('una creatura lanciata va sulla Pila e chi l\'ha lanciata mantiene la priorità (CR 117.3c)', () => {
  const { g, ids } = mainWith(['Grizzly Bears'], ['Forest', 'Forest']);
  g.perform('A', { type: 'cast', object: ids[0] });
  assert.deepEqual(g.stack.map((o) => o.name), ['Grizzly Bears']);
  assert.equal(g.priority, 'A');
  assert.equal(g.player('A').pool.G, 0);
});

test('quando tutti passano, la creatura si risolve ed entra sul campo (CR 608.3)', () => {
  const { g, ids } = mainWith(['Grizzly Bears'], ['Forest', 'Forest']);
  g.perform('A', { type: 'cast', object: ids[0] });
  passAll(g);
  assert.equal(g.stack.length, 0);
  assert.ok(g.zone('A', 'battlefield').some((o) => o.name === 'Grizzly Bears'));
});

test('dopo la risoluzione la priorità torna al giocatore attivo e il passo non cambia (CR 117.3b)', () => {
  const { g, ids } = mainWith(['Grizzly Bears'], ['Forest', 'Forest']);
  g.perform('A', { type: 'cast', object: ids[0] });
  passAll(g);
  assert.equal(g.step, 'main1');
  assert.equal(g.priority, 'A');
});

test('cambiando zona la carta diventa un oggetto nuovo, ma resta la stessa carta fisica (CR 400.7)', () => {
  const { g, ids } = mainWith(['Grizzly Bears'], ['Forest', 'Forest']);
  const cardId = g.object(ids[0]).cardId;
  g.perform('A', { type: 'cast', object: ids[0] });
  passAll(g);
  const bears = g.zone('A', 'battlefield').find((o) => o.name === 'Grizzly Bears');
  assert.notEqual(bears.id, ids[0]);
  assert.equal(bears.cardId, cardId);
});

test('senza mana sufficiente la magia non si lancia e il motivo è spiegato', () => {
  const { g, ids } = mainWith(['Grizzly Bears'], ['Forest']);
  assert.throws(() => g.perform('A', { type: 'cast', object: ids[0] }), (e) => e.code === 'NOT_ENOUGH_MANA' && /\{1\}\{G\}/.test(e.message));
  assert.equal(g.zone('A', 'hand').some((o) => o.id === ids[0]), true);
});

test('una creatura non si lancia a velocità istantanea (CR 307.1)', () => {
  const g = commanderGame();
  const bears = g.setup.putInHand('A', 'Grizzly Bears');
  addMana(g, 'A', ['Forest', 'Forest']);
  assert.throws(() => g.perform('A', { type: 'cast', object: bears }), (e) => e.code === 'SORCERY_TIMING');
});

test('una creatura non si lancia se la Pila non è vuota', () => {
  const { g, ids } = mainWith(['Grizzly Bears', 'Grizzly Bears'], ['Forest', 'Forest', 'Forest', 'Forest']);
  g.perform('A', { type: 'cast', object: ids[0] });
  assert.throws(() => g.perform('A', { type: 'cast', object: ids[1] }), (e) => e.code === 'SORCERY_TIMING');
});

test('un istantaneo si lancia nel turno di un avversario quando si ha la priorità', () => {
  const g = commanderGame();
  const bolt = g.setup.putInHand('B', 'Lightning Bolt');
  g.perform('A', { type: 'pass' });
  addMana(g, 'B', ['Mountain']);
  g.perform('B', { type: 'cast', object: bolt, targets: [{ player: 'C' }] });
  passAll(g);
  assert.equal(g.player('C').life, 37);
});

test('Lightning Bolt senza bersaglio non si può lanciare (CR 601.2c)', () => {
  const g = commanderGame();
  const bolt = g.setup.putInHand('A', 'Lightning Bolt');
  addMana(g, 'A', ['Mountain']);
  assert.throws(() => g.perform('A', { type: 'cast', object: bolt }), (e) => e.code === 'NEEDS_TARGET');
});

test('la Pila si risolve dall\'ultimo oggetto aggiunto: Counterspell neutralizza la creatura', () => {
  const { g, ids } = mainWith(['Grizzly Bears'], ['Forest', 'Forest']);
  const counter = g.setup.putInHand('B', 'Counterspell');
  g.perform('A', { type: 'cast', object: ids[0] });
  const spell = g.stack[0].id;
  g.perform('A', { type: 'pass' });
  addMana(g, 'B', ['Island', 'Island']);
  g.perform('B', { type: 'cast', object: counter, targets: [{ object: spell }] });
  assert.deepEqual(g.stack.map((o) => o.name), ['Grizzly Bears', 'Counterspell']);
  passAll(g);
  assert.equal(g.stack.length, 0);
  assert.ok(g.zone('A', 'graveyard').some((o) => o.name === 'Grizzly Bears'));
  assert.ok(g.zone('B', 'graveyard').some((o) => o.name === 'Counterspell'));
  assert.equal(g.zone('A', 'battlefield').some((o) => o.name === 'Grizzly Bears'), false);
});

test('una creatura con danno pari alla costituzione viene distrutta (CR 704.5g)', () => {
  const g = commanderGame();
  const bears = g.setup.putOnBattlefield('B', 'Grizzly Bears');
  const bolt = g.setup.putInHand('A', 'Lightning Bolt');
  addMana(g, 'A', ['Mountain']);
  g.perform('A', { type: 'cast', object: bolt, targets: [{ object: bears }] });
  passAll(g);
  assert.ok(g.zone('B', 'graveyard').some((o) => o.name === 'Grizzly Bears'));
  assert.ok(g.zone('A', 'graveyard').some((o) => o.name === 'Lightning Bolt'));
});

test('una magia il cui unico bersaglio non esiste più non si risolve (CR 608.2b)', () => {
  const g = commanderGame();
  const bears = g.setup.putOnBattlefield('B', 'Grizzly Bears');
  const [b1, b2] = [g.setup.putInHand('A', 'Lightning Bolt'), g.setup.putInHand('A', 'Lightning Bolt')];
  addMana(g, 'A', ['Mountain', 'Mountain']);
  g.perform('A', { type: 'cast', object: b1, targets: [{ object: bears }] });
  g.perform('A', { type: 'cast', object: b2, targets: [{ object: bears }] });
  passAll(g); // si risolve il secondo fulmine: la creatura muore
  passAll(g); // il primo non ha più un bersaglio legale
  assert.equal(g.zone('A', 'graveyard').filter((o) => o.name === 'Lightning Bolt').length, 2);
  assert.ok(g.events.some((e) => e.type === 'fizzle'));
});

test('Sol Ring produce due mana incolore', () => {
  const g = commanderGame();
  const ring = g.setup.putOnBattlefield('A', 'Sol Ring');
  g.perform('A', { type: 'activateMana', object: ring });
  assert.equal(g.player('A').pool.C, 2);
});
