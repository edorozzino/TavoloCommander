// Carte ricavate dai dati di Scryfall (engine/generated.js) e giocate dal motore.
const test = require('node:test');
const assert = require('node:assert/strict');
const { defFromScryfall } = require('../engine/generated');
const { colorIdentity } = require('../engine/identity');
const { commanderGame, passAll, advanceTo, resolveAll } = require('./helpers');

// Voci come quelle salvate da scryfall.js (solo i campi che servono al generatore)
const info = (name, type, manaCost, oracle, extra = {}) => ({ name, type, manaCost, oracle, power: null, toughness: null, colorIdentity: [], ...extra });

const ELVES = info('Llanowar Elves', 'Creature — Elf Druid', '{G}', '{T}: Add {G}.', { power: '1', toughness: '1', colorIdentity: ['G'] });
const ANGEL = info('Serra Angel', 'Creature — Angel', '{3}{W}{W}', 'Flying, vigilance', { power: '4', toughness: '4', colorIdentity: ['W'] });
const TOMB = info('Overgrown Tomb', 'Land — Swamp Forest', '', '({T}: Add {B} or {G}.)\nAs Overgrown Tomb enters, you may pay 2 life. If you don\'t, it enters tapped.', { colorIdentity: ['B', 'G'] });
const SEER = info('Viscera Seer', 'Creature — Vampire Wizard', '{B}', 'Sacrifice a creature: Scry 1. (Look at the top card of your library. You may put that card on the bottom.)', { power: '1', toughness: '1', colorIdentity: ['B'] });
const RITUAL = info('Dark Ritual', 'Instant', '{B}', 'Add {B}{B}{B}.', { colorIdentity: ['B'] });
const TALISMAN = info('Talisman of Indulgence', 'Artifact', '{2}', '{T}: Add {C}.\n{T}: Add {B} or {R}. Talisman of Indulgence deals 1 damage to you.', { colorIdentity: ['B', 'R'] });
const GUARDIAN = info('Elvish Visionary', 'Creature — Elf Shaman', '{1}{G}', 'When this creature enters, draw a card.', { power: '1', toughness: '1', colorIdentity: ['G'] });
const BARD = info('Gloom Bard', 'Creature — Zombie Bard', '{2}{B}', 'At the beginning of your end step, each opponent loses 1 life.', { power: '2', toughness: '2', colorIdentity: ['B'] });
const ZUL = info('Zul Ashur, Lich Lord', 'Legendary Creature — Zombie Warlock', '{1}{B}', 'Ward—Pay 2 life.', { power: '2', toughness: '2', colorIdentity: ['B'] });

const CARDS = Object.fromEntries([ELVES, ANGEL, TOMB, SEER, RITUAL, TALISMAN, GUARDIAN, BARD, ZUL].map((i) => [i.name, defFromScryfall(i)]));
const game = (opts = {}) => commanderGame({ players: 2, land: 'Swamp', commander: 'Zul Ashur, Lich Lord', cards: CARDS, ...opts });

test('una creatura con sola abilità di mana è del tutto automatica', () => {
  const d = CARDS['Llanowar Elves'];
  assert.deepEqual(d.manual, []);
  assert.deepEqual(d.abilities, [{ kind: 'mana', cost: '{T}', produce: 'G' }]);
  assert.equal(d.power, 1);
  assert.deepEqual(d.subtypes, ['Elf', 'Druid']);
});

test('le keyword note al motore si leggono dal testo', () => {
  assert.deepEqual(CARDS['Serra Angel'].keywords, ['Flying', 'Vigilance']);
  assert.deepEqual(CARDS['Serra Angel'].manual, []);
});

test('una terra con due tipi base produce uno dei due colori; il resto del testo resta manuale', () => {
  const d = CARDS['Overgrown Tomb'];
  assert.deepEqual(d.abilities, [{ kind: 'mana', cost: '{T}', produce: 'choice', options: ['B', 'G'] }]);
  assert.equal(d.manual.length, 1);
  assert.deepEqual(colorIdentity(d), ['B', 'G']);
});

test('abilità di mana con un effetto in più: si usa la prima, l\'altra resta manuale', () => {
  const d = CARDS['Talisman of Indulgence'];
  assert.deepEqual(d.abilities, [{ kind: 'mana', cost: '{T}', produce: 'C' }]);
  assert.match(d.manual[0], /deals 1 damage to you/);
});

test('un\'abilità attivata con costo riconosciuto diventa attivabile, con effetto manuale', () => {
  const [ab] = CARDS['Viscera Seer'].abilities;
  assert.equal(ab.kind, 'activated');
  assert.equal(ab.sacrifice, 'creature');
  assert.equal(ab.effect.kind, 'manual');
});

test('gli inneschi riconosciuti diventano abilità innescate con effetto manuale', () => {
  assert.equal(CARDS['Elvish Visionary'].abilities[0].when, 'etb');
  assert.equal(CARDS['Gloom Bard'].abilities[0].when, 'endStep');
});

test('i costi ibridi, phyrexiani e X diventano costi pagabili, con una nota', () => {
  const d = defFromScryfall(info('Prova Ibrida', 'Sorcery', '{X}{2/B}{W/B}{G/P}', 'Draw X cards.'));
  assert.equal(d.cost, '{2}{W}{G}');
  assert.deepEqual(d.colors, ['W', 'B', 'G']);
  assert.ok(d.manual.some((t) => /X vale 0/.test(t)));
});

test('il comandante ricavato da Scryfall dà la sua identità di colore', () => {
  const g = game();
  assert.deepEqual(g.state.get('A').identity, ['B']);
  assert.equal(g.zone('A', 'command')[0].name, 'Zul Ashur, Lich Lord');
});

test('una carta ricavata entra sul campo con forza, costituzione e keyword', () => {
  const g = game();
  advanceTo(g, 'main1');
  const id = g.setup.putInHand('A', 'Serra Angel');
  for (let i = 0; i < 5; i++) g.setup.putOnBattlefield('A', 'Plains');
  g.perform('A', { type: 'cast', object: id, autoPay: true });
  resolveAll(g);
  const angel = g.zone('A', 'battlefield').find((o) => o.name === 'Serra Angel');
  assert.equal(g.power(angel), 4);
  assert.ok(g.hasKw(angel, 'Flying') && g.hasKw(angel, 'Vigilance'));
});

test('mana a scelta: si sceglie uno dei colori indicati, e il pagamento automatico lo usa', () => {
  const g = game();
  advanceTo(g, 'main1');
  const tomb = g.setup.putOnBattlefield('A', 'Overgrown Tomb');
  assert.throws(() => g.perform('A', { type: 'activateMana', object: tomb, color: 'R' }), /Scegli un colore/);
  g.perform('A', { type: 'activateMana', object: tomb, color: 'G' });
  assert.equal(g.player('A').pool.G, 1);
  g.setup.putOnBattlefield('A', 'Overgrown Tomb');
  const elves = g.setup.putInHand('A', 'Llanowar Elves');
  g.perform('A', { type: 'cast', object: elves, autoPay: true });
  assert.equal(g.stack[0].name, 'Llanowar Elves');
});

test('il bonus dei segnalini -1/-1 riduce forza e costituzione', () => {
  const g = game();
  const id = g.setup.putOnBattlefield('A', 'Serra Angel');
  g.object(id).counters['-1/-1'] = 1;
  assert.equal(g.toughness(g.object(id)), 3);
});

test('l\'innesco di fine turno va sulla Pila all\'inizio della sottofase finale', () => {
  const g = game();
  g.setup.putOnBattlefield('A', 'Gloom Bard');
  advanceTo(g, 'end');
  assert.equal(g.stack.length, 1);
  assert.equal(g.stack[0].effects[0].kind, 'manual');
  passAll(g);
  assert.equal(g.decision.type, 'manual');
});
