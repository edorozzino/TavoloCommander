// Terre e artefatti di utilità del mazzo Syr Konrad salvato nell'editor
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo, passAll, named } = require('./helpers');

const main = (opts) => { const g = commanderGame({ land: 'Swamp', ...opts }); advanceTo(g, 'main1'); return g; };
const on = (g, pid, name, opts) => g.setup.putOnBattlefield(pid, name, opts);
const swamps = (g, n) => { for (let i = 0; i < n; i++) on(g, 'A', 'Swamp'); };
const act = (g, object, extra = {}) => g.perform('A', { type: 'activate', object, autoPay: true, ...extra });
const grave = (g, pid) => g.zone(pid, 'graveyard').length;
const hand = (g, pid) => g.zone(pid, 'hand').length;
const lands = (g, pid, name) => named(g, pid, 'battlefield', name);
function fillGraves(g) {
  for (const pid of ['A', 'B', 'C', 'D']) for (let i = 0; i < 2; i++) g.move(g.zone(pid, 'library')[0].id, 'graveyard');
}

test("Tormod's Crypt: esilia il cimitero del giocatore bersaglio", () => {
  const g = main();
  fillGraves(g);
  const crypt = on(g, 'A', "Tormod's Crypt");
  act(g, crypt, { sacrifice: [crypt], targets: [{ player: 'B' }] });
  passAll(g);
  assert.equal(grave(g, 'B'), 0);
  assert.equal(grave(g, 'C'), 2);
});

test('Mikokoro: ogni giocatore pesca una carta', () => {
  const g = main();
  swamps(g, 2);
  const before = ['A', 'B', 'C', 'D'].map((p) => hand(g, p));
  act(g, on(g, 'A', 'Mikokoro, Center of the Sea'));
  passAll(g);
  assert.deepEqual(['A', 'B', 'C', 'D'].map((p) => hand(g, p)), before.map((n) => n + 1));
});

test('Geier Reach Sanitarium: ogni giocatore pesca e poi scarta, in ordine di turno', () => {
  const g = main();
  swamps(g, 2);
  const before = ['A', 'B', 'C', 'D'].map((p) => hand(g, p));
  act(g, on(g, 'A', 'Geier Reach Sanitarium'));
  passAll(g);
  for (const pid of ['A', 'B', 'C', 'D']) {
    assert.equal(g.decision.type, 'discard');
    assert.equal(g.decision.player, pid);
    g.perform(pid, { type: 'discard', objects: [g.zone(pid, 'hand')[0].id] });
  }
  assert.deepEqual(['A', 'B', 'C', 'D'].map((p) => hand(g, p)), before);
  assert.deepEqual(['A', 'B', 'C', 'D'].map((p) => grave(g, p)), [1, 1, 1, 1]);
});

test('Prismatic Vista: paga 1 vita e mette una terra base stappata', () => {
  const g = main();
  const vista = on(g, 'A', 'Prismatic Vista');
  act(g, vista, { sacrifice: [vista] });
  assert.equal(g.player('A').life, 39);
  passAll(g);
  g.perform('A', { type: 'search', objects: [g.decision.options[0]] });
  assert.equal(lands(g, 'A', 'Swamp')[0].tapped, false);
});

test('Prismatic Vista: senza punti vita sufficienti non si attiva', () => {
  const g = main();
  g.setup.setLife('A', 0);
  const vista = on(g, 'A', 'Prismatic Vista');
  assert.throws(() => act(g, vista, { sacrifice: [vista] }), /punti vita/);
});

test('Fabled Passage: la terra arriva tappata, ma si stappa se controlli quattro terre', () => {
  for (const [others, tapped] of [[1, true], [3, false]]) {
    const g = main();
    swamps(g, others);
    const passage = on(g, 'A', 'Fabled Passage');
    act(g, passage, { sacrifice: [passage] });
    passAll(g);
    const before = new Set(lands(g, 'A', 'Swamp').map((o) => o.id));
    g.perform('A', { type: 'search', objects: [g.decision.options[0]] });
    const fetched = lands(g, 'A', 'Swamp').find((o) => !before.has(o.id));
    assert.equal(fetched.tapped, tapped, `con ${others} altre terre`);
  }
});

test('Myriad Landscape: due terre base con un tipo in comune, tappate', () => {
  const g = main();
  swamps(g, 2);
  const land = on(g, 'A', 'Myriad Landscape');
  g.object(land).tapped = false; // entra tappata: qui la si usa come in un turno successivo
  act(g, land, { sacrifice: [land] });
  passAll(g);
  const before = lands(g, 'A', 'Swamp').length;
  g.perform('A', { type: 'search', objects: g.decision.options.slice(0, 2) });
  assert.equal(lands(g, 'A', 'Swamp').length, before + 2);
  assert.ok(lands(g, 'A', 'Swamp').slice(-2).every((o) => o.tapped));
});

test('Myriad Landscape: terre di tipo diverso sono rifiutate', () => {
  const g = main();
  swamps(g, 2);
  const forest = g.setup.putInLibrary('A', 'Forest');
  const land = on(g, 'A', 'Myriad Landscape');
  g.object(land).tapped = false; // entra tappata: qui la si usa come in un turno successivo
  act(g, land, { sacrifice: [land] });
  passAll(g);
  const swamp = g.decision.options.find((id) => g.object(id).name === 'Swamp');
  assert.throws(() => g.perform('A', { type: 'search', objects: [swamp, forest] }), /tipo di terra in comune/);
  assert.equal(g.decision.type, 'search');
});

test('Command Beacon: il comandante va in mano dalla zona di comando', () => {
  const g = main();
  const beacon = on(g, 'A', 'Command Beacon');
  const commander = g.zone('A', 'command')[0].id;
  act(g, beacon, { sacrifice: [beacon] });
  passAll(g);
  assert.ok(g.zone('A', 'hand').some((o) => o.id === commander || o.isCommander));
  assert.equal(g.zone('A', 'command').length, 0);
});

test('Scavenger Grounds: si sacrifica un Deserto ed esilia tutti i cimiteri', () => {
  const g = main();
  swamps(g, 2);
  fillGraves(g);
  const grounds = on(g, 'A', 'Scavenger Grounds');
  assert.throws(() => act(g, grounds, { sacrifice: [lands(g, 'A', 'Swamp')[0].id] }), /sacrificare/);
  act(g, grounds, { sacrifice: [grounds] });
  passAll(g);
  assert.deepEqual(['A', 'B', 'C', 'D'].map((p) => grave(g, p)), [0, 0, 0, 0]); // anche Scavenger Grounds, sacrificata come costo
});

test('Soul-Guide Lantern: esilia una carta entrando, poi i cimiteri avversari o pesca', () => {
  const g = main();
  fillGraves(g);
  swamps(g, 1);
  const card = g.setup.putInHand('A', 'Soul-Guide Lantern');
  g.perform('A', { type: 'cast', object: card, autoPay: true });
  passAll(g);
  assert.equal(g.decision.type, 'chooseTarget');
  g.perform('A', { type: 'chooseTarget', target: { object: g.zone('B', 'graveyard')[0].id } });
  passAll(g);
  assert.equal(grave(g, 'B'), 1);
  const lantern = lands(g, 'A', 'Soul-Guide Lantern')[0].id;
  act(g, lantern, { ability: 0, sacrifice: [lantern] });
  passAll(g);
  assert.deepEqual(['A', 'B', 'C', 'D'].map((p) => grave(g, p)), [3, 0, 0, 0]);
});

test('Soul-Guide Lantern: la seconda abilità pesca una carta', () => {
  const g = main();
  const lantern = on(g, 'A', 'Soul-Guide Lantern');
  g.givePriority('A'); // l'innesco di entrata non ha bersagli e non va sulla Pila
  const before = hand(g, 'A');
  act(g, lantern, { ability: 1, sacrifice: [lantern] });
  passAll(g);
  assert.equal(hand(g, 'A'), before + 1);
});
