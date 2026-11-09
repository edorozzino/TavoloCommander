// Passaggio automatico sul modello di MTG Arena
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nextPassMode, shouldAutoPass, autoAnswer } = require('../autopass');

const yes = () => true;
const no = () => false;
const game = (over = {}) => ({ active: 'A', step: 'upkeep', turn: 3, stack: [], combat: null, ...over });
const attacking = { combat: { attackers: new Map([[1, {}]]) } };
const spell = (controller) => ({ controller });
const auto = (g, pid, canAct, player = {}) => shouldAutoPass(g, pid, player, canAct);

test('senza mosse possibili passa da solo, tranne nelle proprie fasi principali', () => {
  assert.equal(auto(game(), 'A', no), true);
  assert.equal(auto(game({ step: 'main1' }), 'A', no), false);
  assert.equal(auto(game({ step: 'main2' }), 'A', no), false);
  assert.equal(auto(game({ step: 'main1' }), 'B', no), true);
});

test('con un istantaneo disponibile non ci si ferma nei passi senza interesse', () => {
  for (const step of ['upkeep', 'draw', 'beginCombat', 'combatDamage', 'endCombat', 'main1', 'main2']) {
    assert.equal(auto(game({ step }), 'B', yes), true, step);
  }
  assert.equal(auto(game({ step: 'end' }), 'A', yes), true);
});

test('con un istantaneo disponibile ci si ferma se c\'è qualcosa in Pila', () => {
  assert.equal(auto(game({ step: 'main1', stack: [spell('A')] }), 'B', yes), false);
  assert.equal(auto(game({ step: 'upkeep', stack: [spell('B')] }), 'B', yes), false);
});

test('con un istantaneo disponibile ci si ferma se ci sono attaccanti e alla fine del turno altrui', () => {
  assert.equal(auto(game({ step: 'declareAttackers', ...attacking }), 'B', yes), false);
  assert.equal(auto(game({ step: 'declareBlockers', ...attacking }), 'A', yes), false);
  assert.equal(auto(game({ step: 'end' }), 'B', yes), false);
});

test('in Pila senza mosse possibili si passa', () => {
  assert.equal(auto(game({ stack: [spell('A')] }), 'B', no), true);
});

test('togliendo Passa da solo ci si ferma a ogni passo', () => {
  assert.equal(auto(game(), 'A', no, { autoPass: false }), false);
});

test('Passa il turno vale fino al cambio di turno, anche nelle fasi principali', () => {
  const player = { passMode: 'turn', passTurn: 3 };
  assert.equal(nextPassMode(game({ step: 'main2' }), 'A', player, yes), 'turn');
  assert.equal(auto(game({ step: 'main2' }), 'A', yes, player), true);
  assert.equal(nextPassMode(game({ turn: 4 }), 'A', player, yes), null);
});

test('Passa fino a una risposta continua finché non si può rispondere', () => {
  const player = { passMode: 'response' };
  assert.equal(nextPassMode(game(), 'B', player, yes), 'response');
  assert.equal(nextPassMode(game({ stack: [spell('B')] }), 'B', player, yes), 'response');
  assert.equal(nextPassMode(game({ stack: [spell('A')] }), 'B', player, no), 'response');
  assert.equal(nextPassMode(game({ stack: [spell('A')] }), 'B', player, yes), null);
  assert.equal(nextPassMode(game({ step: 'declareAttackers', ...attacking }), 'B', player, yes), null);
  assert.equal(nextPassMode(game({ step: 'main1' }), 'A', player, no), null);
});

test('Passa il turno salta la dichiarazione di attacco ma non le altre scelte', () => {
  const player = { passMode: 'turn' };
  assert.deepEqual(autoAnswer({ decision: { type: 'declareAttackers', player: 'A' } }, 'A', player), { type: 'declareAttackers', attackers: [] });
  assert.equal(autoAnswer({ decision: { type: 'declareBlockers', player: 'A' } }, 'A', player), null);
  assert.equal(autoAnswer({ decision: { type: 'declareAttackers', player: 'A' } }, 'A', { passMode: 'response' }), null);
});
