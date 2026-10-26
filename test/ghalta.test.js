// Carte del mazzo iniziale "Ruggito di Ghalta". Testo verificato su Scryfall.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { commanderGame, advanceTo, addMana, attackWith, castCard, resolveAll, tokensOf, named, passAll } = require('./helpers');

const G = (n) => Array(n).fill('Forest');
const main = (opts) => { const g = commanderGame({ commander: 'Ghalta, Primal Hunger', ...opts }); advanceTo(g, 'main1'); return g; };
const on = (g, pid, name, opts) => g.setup.putOnBattlefield(pid, name, opts);
const act = (g, pid, object, extra = {}) => g.perform(pid, { type: 'activate', object, ...extra });
const hand = (g, pid = 'A') => g.zone(pid, 'hand').length;
const forests = (g, pid = 'A') => named(g, pid, 'battlefield', 'Forest');
const mana = (g, id, extra = {}) => g.perform('A', { type: 'activateMana', object: id, ...extra });

// ---------- Comandante ----------
test('Ghalta, Primal Hunger: costa {X} in meno, dove X è la forza totale delle tue creature; Travolgere', () => {
  const g = main();
  const id = g.zone('A', 'command')[0].id;
  assert.equal(g.costToCast('A', id), '{10}{G}{G}');
  on(g, 'A', 'Colossal Dreadmaw');
  on(g, 'A', 'Llanowar Elves');
  assert.equal(g.costToCast('A', id), '{3}{G}{G}');
  on(g, 'A', 'Thragtusk');
  assert.equal(g.costToCast('A', id), '{G}{G}'); // la riduzione non tocca il mana colorato
  assert.equal(g.hasKw(g.zone('A', 'command')[0], 'Trample'), true);
});

// ---------- Mana ----------
test('Llanowar Elves, Elvish Mystic e Fyndhorn Elves producono {G}; non appena entrate', () => {
  const g = main();
  for (const n of ['Llanowar Elves', 'Elvish Mystic', 'Fyndhorn Elves']) mana(g, on(g, 'A', n));
  assert.equal(g.player('A').pool.G, 3);
  assert.throws(() => mana(g, on(g, 'A', 'Llanowar Elves', { sick: true })), (e) => e.code === 'SUMMONING_SICK');
});

test('Birds of Paradise: Volare; un mana di qualsiasi colore', () => {
  const g = main();
  const birds = on(g, 'A', 'Birds of Paradise');
  mana(g, birds, { color: 'U' });
  assert.equal(g.player('A').pool.U, 1);
  assert.equal(g.hasKw(g.object(birds), 'Flying'), true);
});

test('Priest of Titania: {G} per ogni Elfo sul campo, anche avversario', () => {
  const g = main();
  const priest = on(g, 'A', 'Priest of Titania');
  on(g, 'A', 'Llanowar Elves');
  on(g, 'B', 'Elvish Mystic');
  mana(g, priest);
  assert.equal(g.player('A').pool.G, 3);
});

test('Elvish Archdruid: gli altri tuoi Elfi prendono +1/+1; {G} per ogni Elfo che controlli', () => {
  const g = main();
  const arch = on(g, 'A', 'Elvish Archdruid');
  const elf = on(g, 'A', 'Llanowar Elves');
  on(g, 'B', 'Elvish Mystic');
  assert.equal(g.power(g.object(elf)), 2);
  mana(g, arch);
  assert.equal(g.player('A').pool.G, 2);
});

test('Llanowar Tribe produce {G}{G}{G}; Circle of Dreams Druid {G} per ogni tua creatura', () => {
  const g = main();
  mana(g, on(g, 'A', 'Llanowar Tribe'));
  const circle = on(g, 'A', 'Circle of Dreams Druid');
  on(g, 'B', 'Grizzly Bears');
  mana(g, circle);
  assert.equal(g.player('A').pool.G, 5);
});

test('Sakura-Tribe Elder: sacrificalo: una terra base sul campo tappata', () => {
  const g = main();
  const elder = on(g, 'A', 'Sakura-Tribe Elder', { sick: true });
  act(g, 'A', elder, { sacrifice: [elder] });
  resolveAll(g);
  assert.equal(forests(g).length, 1);
  assert.equal(forests(g)[0].tapped, true);
});

test('Wood Elves: entrando cerca una Forest e la mette sul campo stappata', () => {
  const g = main();
  castCard(g, 'A', 'Wood Elves', G(3));
  resolveAll(g);
  assert.equal(forests(g).filter((o) => !o.tapped).length, 1);
});

test('Farhaven Elf: entrando puoi cercare una terra base e metterla sul campo tappata', () => {
  const g = main();
  castCard(g, 'A', 'Farhaven Elf', G(3));
  resolveAll(g);
  assert.equal(forests(g).length, 4);
  assert.equal(forests(g).every((o) => o.tapped), true);
});

test('Emerald Medallion: le magie verdi costano {1} in meno', () => {
  const g = main();
  on(g, 'A', 'Emerald Medallion');
  assert.equal(g.costToCast('A', g.setup.putInHand('A', 'Harmonize')), '{1}{G}{G}');
  assert.equal(g.costToCast('A', g.setup.putInHand('A', 'Sol Ring')), '{1}');
});

test('Font of Fertility: {1}{G}, sacrificalo: una terra base sul campo tappata', () => {
  const g = main();
  const font = on(g, 'A', 'Font of Fertility');
  addMana(g, 'A', G(2));
  act(g, 'A', font, { sacrifice: [font] });
  resolveAll(g);
  assert.equal(forests(g).length, 3);
});

test('Exploration: puoi giocare una terra in più in ogni tuo turno', () => {
  const g = main();
  on(g, 'A', 'Exploration');
  const [x, y, z] = g.zone('A', 'hand');
  g.perform('A', { type: 'playLand', object: x.id });
  g.perform('A', { type: 'playLand', object: y.id });
  assert.throws(() => g.perform('A', { type: 'playLand', object: z.id }), (e) => e.code === 'LAND_ALREADY_PLAYED');
});

// ---------- Cerca-terre ----------
test('Cultivate e Kodama\'s Reach: due terre base, una sul campo tappata e una in mano', () => {
  const g = main();
  for (const name of ['Cultivate', "Kodama's Reach"]) {
    const before = hand(g);
    castCard(g, 'A', name, G(3));
    passAll(g);
    assert.equal(g.decision.max, 2, name);
    resolveAll(g);
    assert.equal(hand(g), before + 1, name);
  }
  assert.equal(forests(g).length, 8); // 6 usate per pagare + 2 cercate
});

test('Rampant Growth: una terra base sul campo tappata', () => {
  const g = main();
  castCard(g, 'A', 'Rampant Growth', G(2));
  resolveAll(g);
  assert.equal(forests(g).length, 3);
});

test("Nature's Lore e Three Visits: una Forest sul campo stappata", () => {
  const g = main();
  castCard(g, 'A', "Nature's Lore", G(2));
  resolveAll(g);
  castCard(g, 'A', 'Three Visits', G(2));
  resolveAll(g);
  assert.equal(forests(g).filter((o) => !o.tapped).length, 2);
});

test("Explosive Vegetation e Ranger's Path: due terre tappate; Skyshroud Claim: due Forest stappate", () => {
  const g = main();
  castCard(g, 'A', 'Explosive Vegetation', G(4));
  resolveAll(g);
  castCard(g, 'A', "Ranger's Path", G(4));
  resolveAll(g);
  assert.equal(forests(g).filter((o) => !o.tapped).length, 0);
  castCard(g, 'A', 'Skyshroud Claim', G(4));
  resolveAll(g);
  assert.equal(forests(g).filter((o) => !o.tapped).length, 2);
});

test('Harrow: sacrifica una terra come costo aggiuntivo; due terre base stappate', () => {
  const g = main();
  const id = g.setup.putInHand('A', 'Harrow');
  addMana(g, 'A', G(3));
  assert.throws(() => g.perform('A', { type: 'cast', object: id }), (e) => e.code === 'MISSING_COST');
  g.perform('A', { type: 'cast', object: id, sacrifice: [forests(g)[0].id] });
  resolveAll(g);
  assert.equal(forests(g).length, 4);
  assert.equal(forests(g).filter((o) => !o.tapped).length, 2);
});

// ---------- Pescate ----------
test('Wall of Blossoms: Difensore; entrando pesca una carta', () => {
  const g = main();
  const before = hand(g);
  castCard(g, 'A', 'Wall of Blossoms', G(2));
  resolveAll(g);
  assert.equal(hand(g), before + 1);
});

test('Beast Whisperer: ogni magia creatura che lanci fa pescare', () => {
  const g = main();
  on(g, 'A', 'Beast Whisperer');
  const before = hand(g);
  castCard(g, 'A', 'Llanowar Elves', G(1));
  resolveAll(g);
  castCard(g, 'A', 'Giant Growth', G(1), { targets: [{ object: named(g, 'A', 'battlefield', 'Llanowar Elves')[0].id }] });
  resolveAll(g);
  assert.equal(hand(g), before + 1);
});

test("Garruk's Packleader: quando entra un'altra tua creatura con forza 3 o più, puoi pescare", () => {
  const g = main();
  on(g, 'A', "Garruk's Packleader");
  const before = hand(g);
  castCard(g, 'A', 'Llanowar Elves', G(1));
  resolveAll(g);
  castCard(g, 'A', 'Thragtusk', G(5));
  resolveAll(g);
  assert.equal(hand(g), before + 1);
});

test('Soul of the Harvest: Travolgere; quando entra un\'altra tua creatura non token, puoi pescare', () => {
  const g = main();
  on(g, 'A', 'Soul of the Harvest');
  const before = hand(g);
  castCard(g, 'A', 'Llanowar Elves', G(1));
  resolveAll(g);
  castCard(g, 'A', "Beast Within", G(3), { targets: [{ object: on(g, 'A', 'Sol Ring') }] }); // il Beast è un token
  resolveAll(g);
  assert.equal(hand(g), before + 1);
});

test('Elemental Bond: quando entra una tua creatura con forza 3 o più, pesca', () => {
  const g = main();
  on(g, 'A', 'Elemental Bond');
  const before = hand(g);
  castCard(g, 'A', 'Thragtusk', G(5));
  resolveAll(g);
  castCard(g, 'A', 'Llanowar Elves', G(1));
  resolveAll(g);
  assert.equal(hand(g), before + 1);
});

test('Harmonize: pesca tre carte', () => {
  const g = main();
  const before = hand(g);
  castCard(g, 'A', 'Harmonize', G(4));
  resolveAll(g);
  assert.equal(hand(g), before + 3);
});

test('Return of the Wildspeaker: pesca pari alla forza massima dei tuoi non Umani, oppure +3/+3 ai non Umani', () => {
  const g = main();
  on(g, 'A', 'Colossal Dreadmaw');
  const human = on(g, 'A', 'Surrak and Goreclaw'); // è anche Umano: non conta
  const before = hand(g);
  castCard(g, 'A', 'Return of the Wildspeaker', G(5), { mode: 0 });
  resolveAll(g);
  assert.equal(hand(g), before + 6);
  const elf = on(g, 'A', 'Llanowar Elves');
  castCard(g, 'A', 'Return of the Wildspeaker', G(5), { mode: 1 });
  resolveAll(g);
  assert.equal(g.power(g.object(elf)), 1 + 1 + 3); // segnalino +1/+1 di Surrak all'entrata, poi +3/+3
  assert.equal(g.power(g.object(human)), 6);
});

test('Shamanic Revelation: pesca per ogni tua creatura; 4 vita per ogni creatura con forza 4 o più', () => {
  const g = main();
  on(g, 'A', 'Colossal Dreadmaw');
  on(g, 'A', 'Llanowar Elves');
  const before = hand(g);
  castCard(g, 'A', 'Shamanic Revelation', G(5));
  resolveAll(g);
  assert.equal(hand(g), before + 2);
  assert.equal(g.player('A').life, 44);
});

// ---------- Creature grosse ----------
test('Rampaging Baloths: Travolgere; ogni terra che entra sotto il tuo controllo crea una Bestia 4/4', () => {
  const g = main();
  on(g, 'A', 'Rampaging Baloths');
  g.perform('A', { type: 'playLand', object: g.zone('A', 'hand')[0].id });
  resolveAll(g);
  const [beast] = tokensOf(g, 'A');
  assert.deepEqual([beast.name, g.power(beast)], ['Beast', 4]);
});

test('Craterhoof Behemoth: Rapidità; le tue creature prendono Travolgere e +X/+X, X = creature che controlli', () => {
  const g = main();
  const elf = on(g, 'A', 'Llanowar Elves');
  on(g, 'A', 'Grizzly Bears');
  castCard(g, 'A', 'Craterhoof Behemoth', G(8));
  resolveAll(g);
  assert.equal(g.power(g.object(elf)), 4);
  assert.equal(g.hasKw(g.object(elf), 'Trample'), true);
  const hoof = named(g, 'A', 'battlefield', 'Craterhoof Behemoth')[0];
  assert.deepEqual([g.power(hoof), g.isSick(hoof)], [8, false]);
});

test('End-Raze Forerunners: le altre tue creature prendono +2/+2, Cautela e Travolgere', () => {
  const g = main();
  const elf = on(g, 'A', 'Llanowar Elves');
  castCard(g, 'A', 'End-Raze Forerunners', G(8));
  resolveAll(g);
  assert.equal(g.power(g.object(elf)), 3);
  assert.equal(g.hasKw(g.object(elf), 'Vigilance'), true);
  assert.equal(g.power(named(g, 'A', 'battlefield', 'End-Raze Forerunners')[0]), 7);
});

test('Hornet Queen: entrando crea quattro Insetti 1/1 con Volare e Tocco letale', () => {
  const g = main();
  castCard(g, 'A', 'Hornet Queen', G(7));
  resolveAll(g);
  const insects = tokensOf(g, 'A');
  assert.equal(insects.length, 4);
  assert.equal(insects.every((o) => g.hasKw(o, 'Flying') && g.hasKw(o, 'Deathtouch')), true);
});

test('Acidic Slime: Tocco letale; entrando distrugge un artefatto, incantesimo o terra', () => {
  const g = main();
  const land = on(g, 'B', 'Island');
  castCard(g, 'A', 'Acidic Slime', G(5));
  passAll(g);
  g.perform('A', { type: 'chooseTarget', target: { object: land } });
  resolveAll(g);
  assert.equal(named(g, 'B', 'graveyard', 'Island').length, 1);
});

test('Reclamation Sage: entrando puoi distruggere un artefatto o incantesimo', () => {
  const g = main();
  const ring = on(g, 'B', 'Sol Ring');
  castCard(g, 'A', 'Reclamation Sage', G(3));
  passAll(g);
  assert.equal(g.decision.optional, true);
  g.perform('A', { type: 'chooseTarget', target: { object: ring } });
  resolveAll(g);
  assert.equal(named(g, 'B', 'graveyard', 'Sol Ring').length, 1);
});

test('Thunderfoot Baloth: se controlli il tuo comandante prende +2/+2 e le altre creature +2/+2 e Travolgere', () => {
  const g = main();
  const baloth = on(g, 'A', 'Thunderfoot Baloth');
  const elf = on(g, 'A', 'Llanowar Elves');
  assert.deepEqual([g.power(g.object(baloth)), g.power(g.object(elf))], [5, 1]);
  g.setup.moveTo(g.zone('A', 'command')[0].id, 'battlefield');
  assert.deepEqual([g.power(g.object(baloth)), g.power(g.object(elf)), g.hasKw(g.object(elf), 'Trample')], [7, 3, true]);
});

test("Verdant Sun's Avatar: quando entra essa o un'altra tua creatura guadagni vita pari alla sua costituzione", () => {
  const g = main();
  castCard(g, 'A', "Verdant Sun's Avatar", G(7));
  resolveAll(g);
  castCard(g, 'A', 'Wall of Blossoms', G(2));
  resolveAll(g);
  assert.equal(g.player('A').life, 49);
});

test('Kalonian Hydra: entra con quattro segnalini +1/+1; quando attacca raddoppia i segnalini delle tue creature', () => {
  const g = commanderGame();
  const hydra = on(g, 'A', 'Kalonian Hydra');
  assert.equal(g.power(g.object(hydra)), 4);
  const elf = on(g, 'A', 'Llanowar Elves');
  g.object(elf).counters['+1/+1'] = 1;
  attackWith(g, [[hydra, 'B']]);
  resolveAll(g);
  assert.deepEqual([g.power(g.object(hydra)), g.power(g.object(elf))], [8, 3]);
});

test('Old Gnawbone: Volare; quando una tua creatura infligge danno da combattimento a un giocatore, tanti Tesori', () => {
  const g = commanderGame();
  on(g, 'A', 'Old Gnawbone');
  attackWith(g, [[on(g, 'A', 'Grizzly Bears'), 'B']]);
  advanceTo(g, 'endCombat');
  resolveAll(g);
  assert.equal(tokensOf(g, 'A').filter((o) => o.name === 'Treasure').length, 2);
});

test('Surrak and Goreclaw: le altre tue creature hanno Travolgere; una tua creatura non token che entra prende +1/+1 e Rapidità', () => {
  const g = main();
  on(g, 'A', 'Surrak and Goreclaw');
  castCard(g, 'A', 'Llanowar Elves', G(1));
  resolveAll(g);
  const elf = named(g, 'A', 'battlefield', 'Llanowar Elves')[0];
  assert.deepEqual([g.power(elf), g.isSick(elf), g.hasKw(elf, 'Trample')], [2, false, true]);
});

test('Ohran Frostfang: le tue creature attaccanti hanno Tocco letale; il danno a un giocatore fa pescare', () => {
  const g = commanderGame();
  on(g, 'A', 'Ohran Frostfang');
  const elf = on(g, 'A', 'Llanowar Elves');
  const bears = on(g, 'A', 'Grizzly Bears');
  const wall = on(g, 'B', 'Wall of Wood');
  attackWith(g, [[elf, 'B'], [bears, 'B']]);
  assert.equal(g.hasKw(g.object(elf), 'Deathtouch'), true);
  advanceTo(g, 'declareBlockers');
  g.perform('B', { type: 'declareBlockers', blocks: [{ blocker: wall, attacker: elf }] });
  const before = hand(g);
  advanceTo(g, 'endCombat');
  resolveAll(g);
  assert.equal(named(g, 'B', 'graveyard', 'Wall of Wood').length, 1);
  assert.equal(hand(g), before + 1);
});

test('Pelakka Wurm: Travolgere; entrando guadagni 7 punti vita; quando muore pesca', () => {
  const g = main();
  castCard(g, 'A', 'Pelakka Wurm', G(7));
  resolveAll(g);
  assert.equal(g.player('A').life, 47);
  const wurm = named(g, 'A', 'battlefield', 'Pelakka Wurm')[0].id;
  const before = hand(g);
  castCard(g, 'A', 'Beast Within', G(3), { targets: [{ object: wurm }] });
  resolveAll(g);
  assert.equal(hand(g), before + 1);
});

test('Thragtusk: entrando 5 vita; quando lascia il campo, in qualsiasi modo, crea una Bestia 3/3', () => {
  const g = main();
  castCard(g, 'A', 'Thragtusk', G(5));
  resolveAll(g);
  assert.equal(g.player('A').life, 45);
  g.setup.moveTo(named(g, 'A', 'battlefield', 'Thragtusk')[0].id, 'hand');
  g.perform('A', { type: 'pass' }); // l'innesco va sulla Pila quando qualcuno riceve la priorità
  resolveAll(g);
  assert.equal(tokensOf(g, 'A').filter((o) => o.name === 'Beast' && g.power(o) === 3).length, 1);
});

// ---------- Rimozioni e trucchi ----------
test('Beast Within: distruggi un permanente qualsiasi; il suo controllore crea una Bestia 3/3', () => {
  const g = main();
  const land = on(g, 'B', 'Island');
  castCard(g, 'A', 'Beast Within', G(3), { targets: [{ object: land }] });
  resolveAll(g);
  assert.equal(tokensOf(g, 'B')[0].name, 'Beast');
});

test("Nature's Claim: distruggi un artefatto o incantesimo; il suo controllore guadagna 4 punti vita", () => {
  const g = main();
  const ring = on(g, 'B', 'Sol Ring');
  castCard(g, 'A', "Nature's Claim", G(1), { targets: [{ object: ring }] });
  resolveAll(g);
  assert.equal(g.player('B').life, 44);
});

test('Return to Nature: distruggi un artefatto, un incantesimo, oppure esilia una carta da un cimitero', () => {
  const g = main();
  const ring = on(g, 'B', 'Sol Ring');
  const id = g.setup.putInHand('A', 'Return to Nature');
  addMana(g, 'A', G(2));
  assert.throws(() => g.perform('A', { type: 'cast', object: id, mode: 1, targets: [{ object: ring }] }), (e) => e.code === 'INVALID_TARGET');
  g.perform('A', { type: 'cast', object: id, mode: 0, targets: [{ object: ring }] });
  resolveAll(g);
  const card = g.setup.putInGraveyard('C', 'Grizzly Bears');
  castCard(g, 'A', 'Return to Nature', G(2), { mode: 2, targets: [{ object: card }] });
  resolveAll(g);
  assert.equal(named(g, 'C', 'exile', 'Grizzly Bears').length, 1);
});

test('Bite Down: una tua creatura infligge danni pari alla sua forza a una creatura che non controlli', () => {
  const g = main();
  const dreadmaw = on(g, 'A', 'Colossal Dreadmaw');
  const angel = on(g, 'B', 'Serra Angel');
  const id = g.setup.putInHand('A', 'Bite Down');
  addMana(g, 'A', G(2));
  assert.throws(() => g.perform('A', { type: 'cast', object: id, targets: [{ object: angel }, { object: dreadmaw }] }), (e) => e.code === 'INVALID_TARGET');
  g.perform('A', { type: 'cast', object: id, targets: [{ object: dreadmaw }, { object: angel }] });
  resolveAll(g);
  assert.equal(named(g, 'B', 'graveyard', 'Serra Angel').length, 1);
  assert.equal(g.object(dreadmaw).damage, 0);
});

test('Giant Growth +3/+3; Blossoming Defense +2/+2 e Anti-malocchio; Overprotect +3/+3, Travolgere, Anti-malocchio, Indistruttibile', () => {
  const g = main();
  const elf = on(g, 'A', 'Llanowar Elves');
  castCard(g, 'A', 'Giant Growth', G(1), { targets: [{ object: elf }] });
  resolveAll(g);
  castCard(g, 'A', 'Blossoming Defense', G(1), { targets: [{ object: elf }] });
  resolveAll(g);
  castCard(g, 'A', 'Overprotect', G(2), { targets: [{ object: elf }] });
  resolveAll(g);
  const o = g.object(elf);
  assert.deepEqual([g.power(o), g.toughness(o)], [9, 9]);
  assert.ok(['Hexproof', 'Trample', 'Indestructible'].every((k) => g.hasKw(o, k)));
});

test('Blossoming Defense bersaglia solo una creatura che controlli', () => {
  const g = main();
  const theirs = on(g, 'B', 'Grizzly Bears');
  const id = g.setup.putInHand('A', 'Blossoming Defense');
  addMana(g, 'A', G(1));
  assert.throws(() => g.perform('A', { type: 'cast', object: id, targets: [{ object: theirs }] }), (e) => e.code === 'INVALID_TARGET');
});

test('Overrun: le tue creature prendono +3/+3 e Travolgere', () => {
  const g = main();
  const elf = on(g, 'A', 'Llanowar Elves');
  castCard(g, 'A', 'Overrun', G(5));
  resolveAll(g);
  assert.deepEqual([g.power(g.object(elf)), g.hasKw(g.object(elf), 'Trample')], [4, true]);
});

test('Heroic Intervention: i tuoi permanenti prendono Anti-malocchio e Indistruttibile', () => {
  const g = main();
  const ring = on(g, 'A', 'Sol Ring');
  castCard(g, 'A', 'Heroic Intervention', G(2));
  resolveAll(g);
  assert.equal(g.hasKw(g.object(ring), 'Indestructible') && g.hasKw(g.object(ring), 'Hexproof'), true);
});

test('Overwhelming Stampede: le tue creature prendono Travolgere e +X/+X, X = forza massima tra di esse', () => {
  const g = main();
  const elf = on(g, 'A', 'Llanowar Elves');
  on(g, 'A', 'Colossal Dreadmaw');
  castCard(g, 'A', 'Overwhelming Stampede', G(5));
  resolveAll(g);
  assert.equal(g.power(g.object(elf)), 7);
});

test('Primal Rage: le tue creature hanno Travolgere', () => {
  const g = main();
  on(g, 'A', 'Primal Rage');
  assert.equal(g.hasKw(g.object(on(g, 'A', 'Llanowar Elves')), 'Trample'), true);
  assert.equal(g.hasKw(g.object(on(g, 'B', 'Grizzly Bears')), 'Trample'), false);
});
