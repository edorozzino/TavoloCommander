// CR 903: regole Commander (tassa, zona di comando)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo, addMana, passAll } = require('./helpers');

const RED4 = ['Mountain', 'Mountain', 'Mountain', 'Mountain'];

function castCommander(g, pid = 'A') {
  g.perform(pid, { type: 'cast', object: g.zone(pid, 'command')[0].id });
  passAll(g);
  return g.zone(pid, 'battlefield').find((o) => o.isCommander);
}

function killWithBolt(g, target, caster = 'A') {
  const bolt = g.setup.putInHand(caster, 'Lightning Bolt');
  addMana(g, caster, ['Mountain']);
  g.perform(caster, { type: 'cast', object: bolt, targets: [{ object: target }] });
  passAll(g);
}

test('il primo lancio dalla zona di comando non ha tassa', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  addMana(g, 'A', RED4);
  const krenko = castCommander(g);
  assert.ok(krenko, 'Krenko dovrebbe essere sul campo');
  assert.equal(g.player('A').commanderCasts, 1);
});

test('un comandante distrutto torna nella zona di comando (CR 903.9a)', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  addMana(g, 'A', RED4);
  const krenko = castCommander(g);
  killWithBolt(g, krenko.id);
  assert.deepEqual(g.zone('A', 'command').map((o) => o.name), ['Krenko, Mob Boss']);
  assert.equal(g.zone('A', 'graveyard').some((o) => o.isCommander), false);
});

test('chi preferisce può lasciare il comandante nel cimitero', () => {
  const g = commanderGame();
  g.setup.setPreference('A', 'commanderToCommandZone', false);
  advanceTo(g, 'main1');
  addMana(g, 'A', RED4);
  const krenko = castCommander(g);
  killWithBolt(g, krenko.id);
  assert.ok(g.zone('A', 'graveyard').some((o) => o.isCommander));
});

test('il secondo lancio dalla zona di comando costa {2} in più (CR 903.8)', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  addMana(g, 'A', RED4);
  killWithBolt(g, castCommander(g).id);
  addMana(g, 'A', RED4);
  assert.throws(() => g.perform('A', { type: 'cast', object: g.zone('A', 'command')[0].id }), (e) => e.code === 'NOT_ENOUGH_MANA');
  addMana(g, 'A', ['Mountain', 'Mountain']);
  assert.ok(castCommander(g));
  assert.equal(g.player('A').commanderCasts, 2);
});

test('la tassa è mostrata nel costo da pagare', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  addMana(g, 'A', RED4);
  killWithBolt(g, castCommander(g).id);
  assert.equal(g.costToCast('A', g.zone('A', 'command')[0].id), '{4}{R}{R}');
});

test('lanciare il comandante dalla mano non paga tassa e non la aumenta (CR 903.8)', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  addMana(g, 'A', RED4);
  castCommander(g);
  const krenko = g.zone('A', 'battlefield').find((o) => o.isCommander);
  g.setup.moveTo(krenko.id, 'hand');
  const inHand = g.zone('A', 'hand').find((o) => o.isCommander);
  addMana(g, 'A', RED4);
  g.perform('A', { type: 'cast', object: inHand.id });
  passAll(g);
  assert.ok(g.zone('A', 'battlefield').some((o) => o.isCommander));
  assert.equal(g.player('A').commanderCasts, 1);
});
