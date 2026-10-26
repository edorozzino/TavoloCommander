// Carte del mazzo iniziale "Banchetto di Syr Konrad". Testo verificato su Scryfall.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo, addMana, attackWith, castCard, resolveAll, tokensOf, named, passAll } = require('./helpers');

const B = (n) => Array(n).fill('Swamp');
const main = (opts) => { const g = commanderGame({ commander: 'Syr Konrad, the Grim', land: 'Swamp', ...opts }); advanceTo(g, 'main1'); return g; };
const on = (g, pid, name, opts) => g.setup.putOnBattlefield(pid, name, opts);
const act = (g, pid, object, extra = {}) => g.perform(pid, { type: 'activate', object, ...extra });
const hand = (g, pid = 'A') => g.zone(pid, 'hand').length;
const lives = (g) => ['A', 'B', 'C', 'D'].map((p) => g.player(p).life);
const grave = (g, pid, name) => named(g, pid, 'graveyard', name).length;
const field = (g, pid, name) => named(g, pid, 'battlefield', name).length;
const kill = (g, target) => { castCard(g, 'A', 'Infernal Grasp', B(2), { targets: [{ object: target }] }); };
const chooseTarget = (g, target) => { if (!g.decision) passAll(g); g.perform(g.decision.player, { type: 'chooseTarget', target }); };

// ---------- Comandante ----------
test('Syr Konrad: quando muore un\'altra creatura infligge 1 danno a ogni avversario', () => {
  const g = main();
  on(g, 'A', 'Syr Konrad, the Grim');
  kill(g, on(g, 'B', 'Grizzly Bears'));
  resolveAll(g);
  assert.deepEqual(lives(g), [38, 39, 39, 39]); // Infernal Grasp fa perdere 2 vita ad A
});

test('Syr Konrad: anche una carta creatura che va nel cimitero dal grimorio; {1}{B}: ogni giocatore macina una carta', () => {
  const g = main();
  const k = on(g, 'A', 'Syr Konrad, the Grim');
  g.setup.putInLibrary('B', 'Grizzly Bears');
  addMana(g, 'A', B(2));
  act(g, 'A', k);
  resolveAll(g);
  assert.equal(grave(g, 'B', 'Grizzly Bears'), 1);
  assert.equal(g.zone('C', 'graveyard').length, 1);
  assert.deepEqual(lives(g), [40, 39, 39, 39]);
});

test('Syr Konrad: anche una carta creatura che lascia il tuo cimitero, non quello avversario', () => {
  const g = main();
  on(g, 'A', 'Syr Konrad, the Grim');
  const mine = g.setup.putInGraveyard('A', 'Grizzly Bears');
  castCard(g, 'A', 'Reanimate', B(1), { targets: [{ object: mine }] });
  resolveAll(g);
  assert.deepEqual(lives(g), [38, 39, 39, 39]); // Reanimate: -2 per il valore di mana dell'orso
  const theirs = g.setup.putInGraveyard('B', 'Grizzly Bears');
  castCard(g, 'A', 'Reanimate', B(1), { targets: [{ object: theirs }] });
  resolveAll(g);
  assert.deepEqual(lives(g), [36, 39, 39, 39]);
});

// ---------- Sacrifici ----------
test('Viscera Seer: sacrifica una creatura: profetizza 1', () => {
  const g = main();
  const seer = on(g, 'A', 'Viscera Seer');
  act(g, 'A', seer, { sacrifice: [on(g, 'A', 'Grizzly Bears')] });
  passAll(g);
  assert.equal(g.decision.type, 'scry');
  resolveAll(g);
});

test('Carrion Feeder: non può bloccare; sacrifica una creatura: un segnalino +1/+1', () => {
  const g = commanderGame();
  const feeder = on(g, 'B', 'Carrion Feeder');
  advanceTo(g, 'main1');
  const bears = on(g, 'A', 'Grizzly Bears');
  attackWith(g, [[bears, 'B']]);
  advanceTo(g, 'declareBlockers');
  assert.throws(() => g.perform('B', { type: 'declareBlockers', blocks: [{ blocker: feeder, attacker: bears }] }), (e) => e.code === 'INVALID_BLOCK');
  const g2 = main();
  const f2 = on(g2, 'A', 'Carrion Feeder');
  act(g2, 'A', f2, { sacrifice: [on(g2, 'A', 'Grizzly Bears')] });
  resolveAll(g2);
  assert.equal(g2.power(g2.object(f2)), 2);
});

test('Blood Artist e Falkenrath Noble: quando muore una creatura qualsiasi, un giocatore perde 1 e tu guadagni 1', () => {
  const g = main();
  on(g, 'A', 'Blood Artist');
  const noble = on(g, 'A', 'Falkenrath Noble');
  assert.equal(g.hasKw(g.object(noble), 'Flying'), true);
  kill(g, on(g, 'B', 'Grizzly Bears'));
  chooseTarget(g, { player: 'C' });
  g.perform('A', { type: 'chooseTarget', target: { player: 'C' } });
  resolveAll(g);
  assert.deepEqual(lives(g), [40, 40, 38, 40]); // A: -2 Grasp, +2 dai due inneschi
});

test('Zulaport Cutthroat: quando muore essa o un\'altra tua creatura, ogni avversario perde 1 e tu guadagni 1', () => {
  const g = main();
  on(g, 'A', 'Zulaport Cutthroat');
  kill(g, on(g, 'A', 'Grizzly Bears'));
  resolveAll(g);
  kill(g, on(g, 'B', 'Grizzly Bears'));
  resolveAll(g);
  assert.deepEqual(lives(g), [37, 39, 39, 39]);
});

test('Butcher of Malakir: Volare; quando muore una tua creatura ogni avversario sacrifica una creatura a sua scelta', () => {
  const g = main();
  on(g, 'A', 'Butcher of Malakir');
  const [b1, b2] = [on(g, 'B', 'Grizzly Bears'), on(g, 'B', 'Serra Angel')];
  on(g, 'C', 'Grizzly Bears');
  kill(g, on(g, 'A', 'Grizzly Bears'));
  passAll(g);
  passAll(g);
  assert.deepEqual([g.decision.type, g.decision.player], ['chooseSacrifice', 'B']);
  assert.deepEqual(g.decision.options.sort(), [b1, b2].sort());
  g.perform('B', { type: 'chooseSacrifice', object: b1 });
  resolveAll(g);
  assert.deepEqual([field(g, 'B', 'Serra Angel'), field(g, 'B', 'Grizzly Bears'), field(g, 'C', 'Grizzly Bears')], [1, 0, 0]);
});

test('Fleshbag Marauder e Merciless Executioner: entrando ogni giocatore sacrifica una creatura, tu compreso', () => {
  const g = main();
  on(g, 'B', 'Grizzly Bears');
  castCard(g, 'A', 'Fleshbag Marauder', B(3));
  resolveAll(g);
  assert.equal(field(g, 'A', 'Fleshbag Marauder'), 0);
  assert.equal(field(g, 'B', 'Grizzly Bears'), 0);
  on(g, 'C', 'Grizzly Bears');
  castCard(g, 'A', 'Merciless Executioner', B(3));
  resolveAll(g);
  assert.equal(field(g, 'C', 'Grizzly Bears'), 0);
});

test('Plaguecrafter: ogni giocatore sacrifica una creatura; chi non può scarta una carta', () => {
  const g = main();
  on(g, 'B', 'Grizzly Bears');
  const handC = hand(g, 'C');
  castCard(g, 'A', 'Plaguecrafter', B(3));
  resolveAll(g);
  assert.equal(field(g, 'B', 'Grizzly Bears'), 0);
  assert.equal(hand(g, 'C'), handC - 1);
});

test('Gray Merchant of Asphodel: ogni avversario perde X, X = devozione al nero; guadagni il totale', () => {
  const g = main();
  on(g, 'A', 'Typhoid Rats');
  castCard(g, 'A', 'Gray Merchant of Asphodel', B(5));
  resolveAll(g);
  assert.deepEqual(lives(g), [49, 37, 37, 37]);
});

test('Kokusho: Volare; quando muore ogni avversario perde 5 e guadagni il totale', () => {
  const g = main();
  const k = on(g, 'A', 'Kokusho, the Evening Star');
  kill(g, k);
  resolveAll(g);
  assert.deepEqual(lives(g), [53, 35, 35, 35]);
});

test('Midnight Reaper: quando muore una tua creatura non token, 1 danno a te e peschi; un token no', () => {
  const g = main();
  on(g, 'A', 'Midnight Reaper');
  const before = hand(g);
  kill(g, on(g, 'A', 'Grizzly Bears'));
  resolveAll(g);
  kill(g, g.setup.createToken('A', 'Goblin'));
  resolveAll(g);
  assert.equal(hand(g), before + 1);
  assert.equal(g.player('A').life, 35);
});

test('Morbid Opportunist: quando muoiono altre creature pesca, una sola volta per turno', () => {
  const g = main();
  on(g, 'A', 'Morbid Opportunist');
  const before = hand(g);
  kill(g, on(g, 'B', 'Grizzly Bears'));
  resolveAll(g);
  kill(g, on(g, 'C', 'Grizzly Bears'));
  resolveAll(g);
  assert.equal(hand(g), before + 1);
});

test('Dreadhound: entrando macina tre carte; ogni creatura che muore o va nel cimitero dal grimorio fa perdere 1', () => {
  const g = main();
  g.setup.putInLibrary('A', 'Grizzly Bears');
  castCard(g, 'A', 'Dreadhound', B(6));
  resolveAll(g);
  assert.equal(g.zone('A', 'graveyard').length, 3);
  assert.deepEqual(lives(g), [40, 39, 39, 39]);
  kill(g, on(g, 'B', 'Grizzly Bears'));
  resolveAll(g);
  assert.deepEqual(lives(g), [38, 38, 38, 38]);
});

test('Vengeful Dead: quando muore essa o un altro Zombie ogni avversario perde 1; un non Zombie no', () => {
  const g = main();
  on(g, 'A', 'Vengeful Dead');
  kill(g, on(g, 'B', 'Carrion Feeder'));
  resolveAll(g);
  kill(g, on(g, 'B', 'Grizzly Bears'));
  resolveAll(g);
  assert.deepEqual(lives(g), [36, 39, 39, 39]);
});

test('Massacre Wurm: entrando le creature avversarie prendono -2/-2; ogni creatura avversaria che muore fa perdere 2', () => {
  const g = main();
  on(g, 'B', 'Grizzly Bears');
  on(g, 'B', 'Llanowar Elves');
  const angel = on(g, 'C', 'Serra Angel');
  const mine = on(g, 'A', 'Grizzly Bears');
  castCard(g, 'A', 'Massacre Wurm', B(6));
  resolveAll(g);
  assert.deepEqual(lives(g), [40, 36, 40, 40]);
  assert.equal(g.power(g.object(angel)), 2);
  assert.equal(g.object(mine).zone, 'battlefield');
});

test('Ayara: quando entra lei o un\'altra tua creatura nera, ogni avversario perde 1 e guadagni 1; {T}, sacrifica un\'altra creatura nera: pesca', () => {
  const g = main();
  castCard(g, 'A', 'Ayara, First of Locthwain', B(3));
  resolveAll(g);
  castCard(g, 'A', 'Blood Pet', B(1));
  resolveAll(g);
  assert.deepEqual(lives(g), [42, 38, 38, 38]); // due prosciugamenti da 1
  const ayara = named(g, 'A', 'battlefield', 'Ayara, First of Locthwain')[0].id;
  g.setup.setControlSince(ayara, -1);
  const before = hand(g);
  assert.throws(() => act(g, 'A', ayara, { sacrifice: [on(g, 'A', 'Grizzly Bears')] }), (e) => e.code === 'MISSING_COST');
  act(g, 'A', ayara, { sacrifice: [named(g, 'A', 'battlefield', 'Blood Pet')[0].id] });
  resolveAll(g);
  assert.equal(hand(g), before + 1);
});

test('Blood Pet: sacrificalo: aggiungi {B}', () => {
  const g = main();
  const pet = on(g, 'A', 'Blood Pet', { sick: true });
  g.perform('A', { type: 'activateMana', object: pet, sacrifice: [pet] });
  assert.equal(g.player('A').pool.B, 1);
});

test("Stitcher's Supplier: quando entra o muore macina tre carte", () => {
  const g = main();
  castCard(g, 'A', "Stitcher's Supplier", B(1));
  resolveAll(g);
  kill(g, named(g, 'A', 'battlefield', "Stitcher's Supplier")[0].id);
  resolveAll(g);
  assert.equal(g.zone('A', 'graveyard').length, 3 + 3 + 2); // le carte macinate, il Supplier e Infernal Grasp
});

test('Serrated Scorpion: quando muore infligge 2 danni a ogni avversario e guadagni 2', () => {
  const g = main();
  kill(g, on(g, 'A', 'Serrated Scorpion'));
  resolveAll(g);
  assert.deepEqual(lives(g), [40, 38, 38, 38]);
});

test('Gravedigger: entrando puoi riprendere in mano una carta creatura dal tuo cimitero', () => {
  const g = main();
  const card = g.setup.putInGraveyard('A', 'Grizzly Bears');
  castCard(g, 'A', 'Gravedigger', B(4));
  chooseTarget(g, { object: card });
  resolveAll(g);
  assert.equal(named(g, 'A', 'hand', 'Grizzly Bears').length, 1);
});

test('Ravenous Chupacabra: entrando distrugge una creatura avversaria', () => {
  const g = main();
  const angel = on(g, 'B', 'Serra Angel');
  castCard(g, 'A', 'Ravenous Chupacabra', B(4));
  chooseTarget(g, { object: angel });
  resolveAll(g);
  assert.equal(grave(g, 'B', 'Serra Angel'), 1);
});

test('Grave Titan: Tocco letale; quando entra o attacca crea due Zombie 2/2', () => {
  const g = commanderGame();
  advanceTo(g, 'main1');
  castCard(g, 'A', 'Grave Titan', B(6));
  resolveAll(g);
  assert.equal(tokensOf(g, 'A').filter((o) => o.name === 'Zombie').length, 2);
  const titan = named(g, 'A', 'battlefield', 'Grave Titan')[0].id;
  assert.equal(g.hasKw(g.object(titan), 'Deathtouch'), true);
  g.setup.setControlSince(titan, -1);
  attackWith(g, [[titan, 'B']]);
  resolveAll(g);
  assert.equal(tokensOf(g, 'A').length, 4);
});

test('Pitiless Plunderer: quando muore un\'altra tua creatura crea un Tesoro', () => {
  const g = main();
  on(g, 'A', 'Pitiless Plunderer');
  kill(g, on(g, 'A', 'Grizzly Bears'));
  resolveAll(g);
  assert.equal(tokensOf(g, 'A').filter((o) => o.name === 'Treasure').length, 1);
});

test('Vindictive Vampire: quando muore un\'altra tua creatura, 1 danno a ogni avversario e guadagni 1', () => {
  const g = main();
  on(g, 'A', 'Vindictive Vampire');
  kill(g, on(g, 'A', 'Grizzly Bears'));
  resolveAll(g);
  assert.deepEqual(lives(g), [39, 39, 39, 39]);
});

test('Cemetery Reaper: gli altri tuoi Zombie +1/+1; {2}{B},{T}: esilia una carta creatura da un cimitero e crea uno Zombie', () => {
  const g = main();
  const reaper = on(g, 'A', 'Cemetery Reaper');
  const feeder = on(g, 'A', 'Carrion Feeder');
  assert.equal(g.power(g.object(feeder)), 2);
  const card = g.setup.putInGraveyard('C', 'Grizzly Bears');
  addMana(g, 'A', B(3));
  act(g, 'A', reaper, { targets: [{ object: card }] });
  resolveAll(g);
  assert.equal(named(g, 'C', 'exile', 'Grizzly Bears').length, 1);
  const [zombie] = tokensOf(g, 'A');
  assert.deepEqual([zombie.name, g.power(zombie)], ['Zombie', 3]);
});

test('Bastion of Remembrance: entrando crea un Umano Soldato 1/1; quando muore una tua creatura, prosciugamento di 1', () => {
  const g = main();
  castCard(g, 'A', 'Bastion of Remembrance', B(3));
  resolveAll(g);
  const [soldier] = tokensOf(g, 'A');
  assert.equal(soldier.name, 'Human Soldier');
  kill(g, soldier.id);
  resolveAll(g);
  assert.deepEqual(lives(g), [39, 39, 39, 39]);
});

test('Dictate of Erebos (Lampo) e Grave Pact: quando muore una tua creatura gli altri giocatori sacrificano una creatura', () => {
  const g = commanderGame({ commander: 'Syr Konrad, the Grim' });
  const dictate = g.setup.putInHand('A', 'Dictate of Erebos');
  addMana(g, 'A', B(5));
  g.perform('A', { type: 'cast', object: dictate }); // nel mantenimento: ha Lampo
  resolveAll(g);
  advanceTo(g, 'main1');
  on(g, 'A', 'Grave Pact');
  on(g, 'B', 'Grizzly Bears');
  on(g, 'B', 'Grizzly Bears');
  kill(g, on(g, 'A', 'Grizzly Bears'));
  resolveAll(g);
  assert.equal(field(g, 'B', 'Grizzly Bears'), 0);
});

// ---------- Magie ----------
test('Deadly Dispute: sacrifica un artefatto o una creatura; pesca due e crea un Tesoro', () => {
  const g = main();
  const before = hand(g);
  castCard(g, 'A', 'Deadly Dispute', B(2), { sacrifice: [on(g, 'A', 'Sol Ring')] });
  resolveAll(g);
  assert.equal(hand(g), before + 2);
  assert.equal(tokensOf(g, 'A').filter((o) => o.name === 'Treasure').length, 1);
});

test('Village Rites pesca due; Culling the Weak aggiunge {B}{B}{B}{B}; Dark Ritual aggiunge {B}{B}{B}', () => {
  const g = main();
  const before = hand(g);
  castCard(g, 'A', 'Village Rites', B(1), { sacrifice: [on(g, 'A', 'Grizzly Bears')] });
  resolveAll(g);
  assert.equal(hand(g), before + 2);
  castCard(g, 'A', 'Culling the Weak', B(1), { sacrifice: [on(g, 'A', 'Grizzly Bears')] });
  resolveAll(g);
  castCard(g, 'A', 'Dark Ritual', B(1));
  resolveAll(g);
  assert.equal(g.player('A').pool.B, 7);
});

test('Reanimate: una carta creatura da un cimitero sul campo sotto il tuo controllo; perdi vita pari al suo valore di mana', () => {
  const g = main();
  const djinn = g.setup.putInGraveyard('B', 'Mahamoti Djinn');
  castCard(g, 'A', 'Reanimate', B(1), { targets: [{ object: djinn }] });
  resolveAll(g);
  assert.equal(field(g, 'A', 'Mahamoti Djinn') + g.battlefield().filter((o) => o.name === 'Mahamoti Djinn' && o.controller === 'A').length, 1);
  assert.equal(g.player('A').life, 34);
});

test('Exhume: ogni giocatore rimette sul campo una carta creatura dal proprio cimitero', () => {
  const g = main();
  g.setup.putInGraveyard('A', 'Grizzly Bears');
  g.setup.putInGraveyard('B', 'Serra Angel');
  castCard(g, 'A', 'Exhume', B(2));
  resolveAll(g);
  assert.deepEqual([field(g, 'A', 'Grizzly Bears'), field(g, 'B', 'Serra Angel')], [1, 1]);
});

test('Victimize: due carte creatura dal tuo cimitero tornano tappate se sacrifichi una creatura', () => {
  const g = main();
  const a = g.setup.putInGraveyard('A', 'Grizzly Bears');
  const b = g.setup.putInGraveyard('A', 'Serra Angel');
  on(g, 'A', 'Typhoid Rats');
  castCard(g, 'A', 'Victimize', B(3), { targets: [{ object: a }, { object: b }] });
  resolveAll(g);
  assert.deepEqual([field(g, 'A', 'Grizzly Bears'), field(g, 'A', 'Serra Angel'), field(g, 'A', 'Typhoid Rats')], [1, 1, 0]);
  assert.equal(named(g, 'A', 'battlefield', 'Serra Angel')[0].tapped, true);
});

test('Living Death: le creature sul campo vanno al cimitero e quelle nei cimiteri tornano', () => {
  const g = main();
  on(g, 'A', 'Grizzly Bears');
  g.setup.putInGraveyard('B', 'Serra Angel');
  castCard(g, 'A', 'Living Death', B(5));
  resolveAll(g);
  assert.deepEqual([field(g, 'A', 'Grizzly Bears'), field(g, 'B', 'Serra Angel'), grave(g, 'A', 'Grizzly Bears')], [0, 1, 1]);
});

test('Rise of the Dark Realms: tutte le carte creatura di tutti i cimiteri sul campo sotto il tuo controllo', () => {
  const g = main();
  g.setup.putInGraveyard('B', 'Serra Angel');
  g.setup.putInGraveyard('C', 'Grizzly Bears');
  castCard(g, 'A', 'Rise of the Dark Realms', B(9));
  resolveAll(g);
  assert.equal(g.battlefield().filter((o) => o.controller === 'A' && ['Serra Angel', 'Grizzly Bears'].includes(o.name)).length, 2);
});

test("Sign in Blood, Night's Whisper, Read the Bones e Dark Bargain: pescate a caro prezzo", () => {
  const g = main();
  castCard(g, 'A', 'Sign in Blood', B(2), { targets: [{ player: 'C' }] });
  resolveAll(g);
  assert.deepEqual([hand(g, 'C'), g.player('C').life], [9, 38]);
  const before = hand(g);
  castCard(g, 'A', "Night's Whisper", B(2));
  resolveAll(g);
  castCard(g, 'A', 'Read the Bones', B(3));
  resolveAll(g);
  castCard(g, 'A', 'Dark Bargain', B(4));
  resolveAll(g);
  assert.equal(hand(g), before + 6);
  assert.equal(g.player('A').life, 34);
  assert.equal(g.zone('A', 'graveyard').filter((o) => o.name === 'Swamp').length, 1);
});

test('Damnation distrugge tutte le creature', () => {
  const g = main();
  on(g, 'A', 'Grizzly Bears');
  on(g, 'B', 'Serra Angel');
  on(g, 'C', 'Darksteel Myr');
  castCard(g, 'A', 'Damnation', B(4));
  resolveAll(g);
  assert.deepEqual(g.battlefield().filter((o) => o.def.types.includes('Creature')).map((o) => o.name), ['Darksteel Myr']);
});

test("Hero's Downfall, Go for the Throat, Doom Blade: distruggono una creatura del tipo giusto", () => {
  const g = main();
  const myr = on(g, 'B', 'Darksteel Myr');
  const rats = on(g, 'B', 'Typhoid Rats');
  const id = g.setup.putInHand('A', 'Go for the Throat');
  addMana(g, 'A', B(2));
  assert.throws(() => g.perform('A', { type: 'cast', object: id, targets: [{ object: myr }] }), (e) => e.code === 'INVALID_TARGET');
  const blade = g.setup.putInHand('A', 'Doom Blade');
  assert.throws(() => g.perform('A', { type: 'cast', object: blade, targets: [{ object: rats }] }), (e) => e.code === 'INVALID_TARGET');
  g.perform('A', { type: 'cast', object: id, targets: [{ object: rats }] });
  resolveAll(g);
  castCard(g, 'A', "Hero's Downfall", B(3), { targets: [{ object: on(g, 'C', 'Serra Angel') }] });
  resolveAll(g);
  assert.deepEqual([grave(g, 'B', 'Typhoid Rats'), grave(g, 'C', 'Serra Angel')], [1, 1]);
});

test('Feed the Swarm: distruggi una creatura o un incantesimo avversario; perdi vita pari al suo valore di mana', () => {
  const g = main();
  const arena = on(g, 'B', 'Phyrexian Arena');
  const mine = on(g, 'A', 'Grizzly Bears');
  const id = g.setup.putInHand('A', 'Feed the Swarm');
  addMana(g, 'A', B(2));
  assert.throws(() => g.perform('A', { type: 'cast', object: id, targets: [{ object: mine }] }), (e) => e.code === 'INVALID_TARGET');
  g.perform('A', { type: 'cast', object: id, targets: [{ object: arena }] });
  resolveAll(g);
  assert.deepEqual([grave(g, 'B', 'Phyrexian Arena'), g.player('A').life], [1, 37]);
});

test('Bone Splinters: sacrifica una creatura come costo aggiuntivo; distruggi una creatura', () => {
  const g = main();
  const angel = on(g, 'B', 'Serra Angel');
  castCard(g, 'A', 'Bone Splinters', B(1), { sacrifice: [on(g, 'A', 'Grizzly Bears')], targets: [{ object: angel }] });
  resolveAll(g);
  assert.equal(grave(g, 'B', 'Serra Angel'), 1);
});

test('All Is Dust: ogni giocatore sacrifica i permanenti colorati; artefatti incolori e terre restano', () => {
  const g = main();
  on(g, 'A', 'Sol Ring');
  on(g, 'B', 'Grizzly Bears');
  on(g, 'B', 'Phyrexian Arena');
  g.setup.createToken('C', 'Goblin');
  castCard(g, 'A', 'All Is Dust', B(7));
  resolveAll(g);
  assert.deepEqual([field(g, 'A', 'Sol Ring'), field(g, 'B', 'Grizzly Bears'), field(g, 'B', 'Phyrexian Arena'), tokensOf(g, 'C').length], [1, 0, 0, 0]);
});

test('Demonic Tutor e Diabolic Tutor cercano una carta qualsiasi; Vampiric Tutor la mette in cima e costa 2 vita', () => {
  const g = main();
  const wanted = g.setup.putInLibrary('A', 'Grave Titan');
  castCard(g, 'A', 'Demonic Tutor', B(2));
  passAll(g);
  g.perform('A', { type: 'search', objects: [wanted] });
  assert.equal(named(g, 'A', 'hand', 'Grave Titan').length, 1);
  castCard(g, 'A', 'Diabolic Tutor', B(4));
  resolveAll(g);
  const k = g.setup.putInLibrary('A', 'Kokusho, the Evening Star');
  castCard(g, 'A', 'Vampiric Tutor', B(1));
  passAll(g);
  g.perform('A', { type: 'search', objects: [k] });
  resolveAll(g);
  assert.equal(g.zone('A', 'library')[0].name, 'Kokusho, the Evening Star');
  assert.equal(g.player('A').life, 38);
});

// ---------- Artefatti e terre ----------
test('Jet Medallion: le magie nere costano {1} in meno', () => {
  const g = main();
  on(g, 'A', 'Jet Medallion');
  assert.equal(g.costToCast('A', g.setup.putInHand('A', 'Gravedigger')), '{2}{B}');
});

test("Nevinyrral's Disk: entra tappato; {1},{T}: distrugge tutti gli artefatti, le creature e gli incantesimi", () => {
  const g = main();
  castCard(g, 'A', "Nevinyrral's Disk", B(4));
  resolveAll(g);
  const disk = named(g, 'A', 'battlefield', "Nevinyrral's Disk")[0];
  assert.equal(disk.tapped, true);
  disk.tapped = false;
  on(g, 'B', 'Grizzly Bears');
  on(g, 'C', 'Phyrexian Arena');
  const land = on(g, 'D', 'Island');
  addMana(g, 'A', B(1));
  act(g, 'A', disk.id);
  resolveAll(g);
  assert.deepEqual(g.battlefield().filter((o) => o.controller !== 'A' || o.name !== 'Swamp').map((o) => o.id), [land]);
});

test('Cabal Coffers: {2},{T}: {B} per ogni Swamp che controlli', () => {
  const g = main();
  const coffers = on(g, 'A', 'Cabal Coffers');
  addMana(g, 'A', B(3));
  g.perform('A', { type: 'activateMana', object: coffers });
  assert.equal(g.player('A').pool.B, 1 + 3);
});

test('Castle Locthwain: entra tappata senza Swamp; {1}{B}{B},{T}: pesca e perdi vita pari alle carte in mano', () => {
  const g = main();
  const c1 = g.setup.putInHand('A', 'Castle Locthwain');
  g.perform('A', { type: 'playLand', object: c1 });
  assert.equal(named(g, 'A', 'battlefield', 'Castle Locthwain')[0].tapped, true);
  const g2 = main();
  on(g2, 'A', 'Swamp');
  g2.perform('A', { type: 'playLand', object: g2.setup.putInHand('A', 'Castle Locthwain') });
  const castle = named(g2, 'A', 'battlefield', 'Castle Locthwain')[0];
  assert.equal(castle.tapped, false);
  addMana(g2, 'A', B(3));
  act(g2, 'A', castle.id);
  resolveAll(g2);
  assert.equal(g2.player('A').life, 40 - hand(g2));
});

test('Reliquary Tower: nessun limite di carte in mano; {T}: {C}', () => {
  const g = commanderGame();
  const tower = on(g, 'A', 'Reliquary Tower');
  g.setup.putInHand('A', 'Swamp');
  advanceTo(g, 'upkeep', 2);
  assert.equal(hand(g), 9);
  advanceTo(g, 'main1', 5);
  g.perform('A', { type: 'activateMana', object: tower });
  assert.equal(g.player('A').pool.C, 1);
});

test("Bojuka Bog: entra tappata; quando entra esilia il cimitero di un giocatore", () => {
  const g = main();
  g.setup.putInGraveyard('B', 'Grizzly Bears');
  g.setup.putInGraveyard('B', 'Serra Angel');
  g.perform('A', { type: 'playLand', object: g.setup.putInHand('A', 'Bojuka Bog') });
  chooseTarget(g, { player: 'B' });
  resolveAll(g);
  assert.deepEqual([g.zone('B', 'graveyard').length, g.zone('B', 'exile').length], [0, 2]);
  assert.equal(named(g, 'A', 'battlefield', 'Bojuka Bog')[0].tapped, true);
});
