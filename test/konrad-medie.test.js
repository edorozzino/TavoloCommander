// Carte "medie" del mazzo Syr Konrad salvato nell'editor: servono pezzi nuovi del motore
// (Fuga, inneschi modali, Aure che rianimano, ciclo, segnalini fato, costi facoltativi)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo, passAll, resolveAll, named } = require('./helpers');

const main = (opts) => { const g = commanderGame({ land: 'Swamp', ...opts }); advanceTo(g, 'main1'); return g; };
const on = (g, pid, name, opts) => g.setup.putOnBattlefield(pid, name, opts);
const swamps = (g, n, pid = 'A') => { for (let i = 0; i < n; i++) on(g, pid, 'Swamp'); };
const act = (g, object, extra = {}) => g.perform('A', { type: 'activate', object, autoPay: true, ...extra });
const cast = (g, object, extra = {}) => g.perform('A', { type: 'cast', object, autoPay: true, ...extra });
const hand = (g, pid) => g.zone(pid, 'hand').length;
const field = (g, pid, name) => g.battlefield().filter((o) => o.controller === pid && o.name === name); // conta il controllore
const life = (g, pid) => g.player(pid).life;

test("Witch's Cottage: entra tappata con meno di tre altre Paludi", () => {
  const g = main();
  swamps(g, 2);
  g.setup.putInGraveyard('A', 'Grim Haruspex');
  g.perform('A', { type: 'playLand', object: g.setup.putInHand('A', "Witch's Cottage") });
  assert.equal(field(g, 'A', "Witch's Cottage")[0].tapped, true);
  assert.equal(g.decision, null); // nessun innesco: è entrata tappata
});

test("Witch's Cottage: stappata rimette una creatura dal cimitero in cima al grimorio", () => {
  const g = main();
  swamps(g, 3);
  const dead = g.setup.putInGraveyard('A', 'Grim Haruspex');
  g.perform('A', { type: 'playLand', object: g.setup.putInHand('A', "Witch's Cottage") });
  assert.equal(field(g, 'A', "Witch's Cottage")[0].tapped, false);
  assert.equal(g.decision.type, 'chooseTarget');
  assert.equal(g.decision.optional, true);
  g.perform('A', { type: 'chooseTarget', target: { object: dead } });
  passAll(g);
  assert.equal(g.zone('A', 'library')[0].name, 'Grim Haruspex');
});

test('Nihil Spellbomb: esilia un cimitero, poi si può pagare {B} per pescare', () => {
  const g = main();
  swamps(g, 1);
  for (let i = 0; i < 3; i++) g.setup.putInGraveyard('B', 'Grim Haruspex');
  const bomb = on(g, 'A', 'Nihil Spellbomb');
  const before = hand(g, 'A');
  act(g, bomb, { sacrifice: [bomb], targets: [{ player: 'B' }] });
  // l'innesco del cimitero va sulla Pila sopra l'abilità e si risolve per primo
  passAll(g);
  assert.equal(g.decision.type, 'confirm');
  g.perform('A', { type: 'confirm', yes: true });
  assert.equal(hand(g, 'A'), before + 1);
  assert.equal(field(g, 'A', 'Swamp')[0].tapped, true);
  resolveAll(g);
  assert.equal(g.zone('B', 'graveyard').length, 0);
});

test('Nihil Spellbomb: senza mana per {B} non si pesca', () => {
  const g = main();
  const bomb = on(g, 'A', 'Nihil Spellbomb');
  const before = hand(g, 'A');
  act(g, bomb, { sacrifice: [bomb], targets: [{ player: 'B' }] });
  passAll(g);
  g.perform('A', { type: 'confirm', yes: true });
  resolveAll(g);
  assert.equal(hand(g, 'A'), before);
});

test('Woe Strider: crea una Capra e sacrifica altre creature per profetizzare', () => {
  const g = main();
  swamps(g, 3);
  cast(g, g.setup.putInHand('A', 'Woe Strider'));
  resolveAll(g);
  const goat = field(g, 'A', 'Goat')[0];
  assert.ok(goat && goat.isToken);
  const strider = field(g, 'A', 'Woe Strider')[0];
  assert.throws(() => act(g, strider.id, { sacrifice: [strider.id] }), /sacrificare/);
  act(g, strider.id, { sacrifice: [goat.id] });
  passAll(g);
  assert.equal(g.decision.type, 'scry');
});

test('Woe Strider: Fuga dal cimitero esiliando altre quattro carte, con due segnalini +1/+1', () => {
  const g = main();
  swamps(g, 5);
  const strider = g.setup.putInGraveyard('A', 'Woe Strider');
  const others = [];
  for (let i = 0; i < 4; i++) others.push(g.setup.putInGraveyard('A', 'Grim Haruspex'));
  assert.throws(() => cast(g, strider, { escape: true, exile: others.slice(0, 3) }), /esiliare altre 4/);
  assert.throws(() => cast(g, strider, { exile: others }), /disponibile/); // senza Fuga dal cimitero non si lancia
  cast(g, strider, { escape: true, exile: others });
  assert.equal(g.zone('A', 'exile').length, 4);
  resolveAll(g);
  const o = field(g, 'A', 'Woe Strider')[0];
  assert.equal(g.power(o), 5);
  assert.equal(g.toughness(o), 4);
});

test('Shambling Ghast: morendo si sceglie la modalità', () => {
  const g = main();
  const ghast = on(g, 'A', 'Shambling Ghast');
  const victim = on(g, 'B', 'Shambling Ghast');
  g.toGraveyard([g.object(ghast)]);
  g.givePriority('A');
  assert.equal(g.decision.type, 'chooseMode');
  g.perform('A', { type: 'chooseMode', mode: 1 });
  assert.equal(g.decision.type, 'chooseTarget');
  assert.ok(g.decision.options.every((t) => g.object(t.object).controller !== 'A'));
  g.perform('A', { type: 'chooseTarget', target: { object: victim } });
  resolveAll(g);
  assert.equal(g.zone('B', 'graveyard').length, 1); // la Ghast avversaria muore con -1/-1
  assert.equal(life(g, 'B'), 41); // anche la Ghast di B si innesca: prosciuga
});

test('Shambling Ghast: la modalità drena ogni avversario', () => {
  const g = main();
  const ghast = on(g, 'A', 'Shambling Ghast');
  g.toGraveyard([g.object(ghast)]);
  g.givePriority('A');
  assert.equal(g.decision.modes[1].ok, false); // nessuna creatura avversaria da bersagliare
  assert.throws(() => g.perform('A', { type: 'chooseMode', mode: 1 }), /modalità/);
  g.perform('A', { type: 'chooseMode', mode: 0 });
  resolveAll(g);
  assert.deepEqual(['A', 'B', 'C', 'D'].map((p) => life(g, p)), [41, 39, 39, 39]);
});

test('Grim Haruspex: pesca quando muore un\'altra creatura non pedina', () => {
  const g = main();
  on(g, 'A', 'Grim Haruspex');
  const ghast = on(g, 'A', 'Woe Strider');
  const before = hand(g, 'A');
  g.setup.createToken('A', 'Goat');
  g.toGraveyard([g.object(ghast), field(g, 'A', 'Goat')[0]]);
  g.givePriority('A');
  resolveAll(g);
  assert.equal(hand(g, 'A'), before + 1);
});

test('Plumb the Forbidden: una pescata e una vita in più per ogni creatura sacrificata', () => {
  const g = main();
  swamps(g, 2);
  const a = on(g, 'A', 'Woe Strider');
  const b = on(g, 'A', 'Shambling Ghast');
  const before = hand(g, 'A');
  const plumb = g.setup.putInHand('A', 'Plumb the Forbidden');
  assert.throws(() => cast(g, plumb, { sacrifice: [on(g, 'B', 'Grim Haruspex')] }), /creature che controlli/);
  cast(g, plumb, { sacrifice: [a, b] });
  resolveAll(g);
  assert.equal(hand(g, 'A'), before + 3);
  assert.equal(life(g, 'A'), 40 - 3 + 1); // la Ghast drena morendo
});

test('Plumb the Forbidden: senza sacrifici pesca una carta', () => {
  const g = main();
  swamps(g, 2);
  const before = hand(g, 'A');
  cast(g, g.setup.putInHand('A', 'Plumb the Forbidden'));
  resolveAll(g);
  assert.equal(hand(g, 'A'), before + 1);
  assert.equal(life(g, 'A'), 39);
});

test('Oblivion Stone: distrugge i permanenti non terra senza segnalino fato', () => {
  const g = main();
  swamps(g, 9);
  const stone = on(g, 'A', 'Oblivion Stone');
  const keep = on(g, 'A', 'Grim Haruspex');
  on(g, 'B', 'Woe Strider');
  act(g, stone, { ability: 0, targets: [{ object: keep }] });
  resolveAll(g);
  assert.equal(g.object(keep).counters.fate, 1);
  g.object(stone).tapped = false;
  act(g, stone, { ability: 1, sacrifice: [stone] });
  resolveAll(g);
  assert.equal(field(g, 'A', 'Grim Haruspex').length, 1);
  assert.equal(field(g, 'B', 'Woe Strider').length, 0);
  assert.equal(field(g, 'A', 'Grim Haruspex')[0].counters.fate, undefined);
  assert.equal(field(g, 'A', 'Swamp').length, 9);
});

test('Animate Dead: rianima con -1/-0; se l\'Aura se ne va la creatura viene sacrificata', () => {
  const g = main();
  swamps(g, 2);
  const dead = g.setup.putInGraveyard('B', 'Woe Strider');
  cast(g, g.setup.putInHand('A', 'Animate Dead'), { targets: [{ object: dead }] });
  resolveAll(g);
  const strider = field(g, 'A', 'Woe Strider')[0];
  assert.ok(strider, 'la creatura avversaria torna sotto il mio controllo');
  assert.equal(g.power(strider), 2);
  assert.equal(field(g, 'A', 'Goat').length, 1); // il suo innesco di entrata funziona
  const aura = field(g, 'A', 'Animate Dead')[0];
  g.toGraveyard([aura]);
  g.givePriority('A');
  resolveAll(g);
  assert.equal(field(g, 'A', 'Woe Strider').length, 0);
  assert.equal(named(g, 'B', 'graveyard', 'Woe Strider').length, 1);
});

test('Animate Dead: se la creatura muore, l\'Aura va nel cimitero', () => {
  const g = main();
  swamps(g, 2);
  const dead = g.setup.putInGraveyard('A', 'Grim Haruspex');
  cast(g, g.setup.putInHand('A', 'Animate Dead'), { targets: [{ object: dead }] });
  resolveAll(g);
  g.toGraveyard([field(g, 'A', 'Grim Haruspex')[0]]);
  g.givePriority('A');
  resolveAll(g);
  assert.equal(field(g, 'A', 'Animate Dead').length, 0);
  assert.equal(named(g, 'A', 'graveyard', 'Animate Dead').length, 1);
});

test('Animate Dead: senza creature nei cimiteri non si lancia', () => {
  const g = main();
  swamps(g, 2);
  assert.throws(() => cast(g, g.setup.putInHand('A', 'Animate Dead')), /bersaglio/);
});

test('Ash Barrens: il ciclo terre base la scarta e cerca una terra base', () => {
  const g = main();
  swamps(g, 1);
  const barrens = g.setup.putInHand('A', 'Ash Barrens');
  const before = hand(g, 'A');
  g.perform('A', { type: 'cycle', object: barrens, autoPay: true });
  assert.equal(named(g, 'A', 'graveyard', 'Ash Barrens').length, 1);
  passAll(g);
  assert.equal(g.decision.type, 'search');
  g.perform('A', { type: 'search', objects: [g.decision.options[0]] });
  assert.equal(hand(g, 'A'), before);
  assert.equal(g.zone('A', 'hand').at(-1).name, 'Swamp');
});

test('Ash Barrens: il ciclo richiede il mana', () => {
  const g = main();
  assert.throws(() => g.perform('A', { type: 'cycle', object: g.setup.putInHand('A', 'Ash Barrens'), autoPay: true }), /Servono|abbastanza/);
});
