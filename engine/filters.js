// Filtri usati dalle definizioni delle carte: chi è influenzato, chi si può bersagliare o sacrificare.
const { colorsOf } = require('./identity');

const isType = (o, type) => o.def.types.includes(type);
const isCreature = (o) => isType(o, 'Creature');
const isGoblin = (o) => (o.def.subtypes || []).includes('Goblin');
const hasSub = (o, sub) => (o.def.subtypes || []).includes(sub);
const onField = (o) => o && o.zone === 'battlefield';

// Oggetti influenzati da un effetto statico o da un effetto "tutte le creature…" (source = fonte dell'effetto)
const GROUP = {
  otherGoblinsYouControl: (g, o, src) => isCreature(o) && isGoblin(o) && o.controller === src.controller && o.id !== src.id,
  otherGoblins: (g, o, src) => isCreature(o) && isGoblin(o) && o.id !== src.id,
  goblinsYouControl: (g, o, src) => isCreature(o) && isGoblin(o) && o.controller === src.controller,
  goblinCreatures: (g, o) => isCreature(o) && isGoblin(o),
  creaturesYouControl: (g, o, src) => isCreature(o) && o.controller === src.controller,
  otherAttackingCreatures: (g, o, src) => isCreature(o) && !!g.combat?.attackers.has(o.id) && o.id !== src.id,
  // usato solo per concedere keyword: può leggere forza e costituzione senza ricorsione
  creaturesYouControlPowerOrToughness1: (g, o, src) => isCreature(o) && o.controller === src.controller && (g.power(o) <= 1 || g.toughness(o) <= 1),
  creatures: (g, o) => isCreature(o),
  otherElfCreaturesYouControl: (g, o, src) => isCreature(o) && hasSub(o, 'Elf') && o.controller === src.controller && o.id !== src.id,
  otherCreaturesYouControl: (g, o, src) => isCreature(o) && o.controller === src.controller && o.id !== src.id,
  nonHumanCreaturesYouControl: (g, o, src) => isCreature(o) && !hasSub(o, 'Human') && o.controller === src.controller,
  permanentsYouControl: (g, o, src) => o.controller === src.controller,
  creaturesOpponentsControl: (g, o, src) => isCreature(o) && o.controller !== src.controller,
  otherZombieCreaturesYouControl: (g, o, src) => isCreature(o) && hasSub(o, 'Zombie') && o.controller === src.controller && o.id !== src.id,
  artifactsCreaturesEnchantments: (g, o) => ['Artifact', 'Creature', 'Enchantment'].some((x) => isType(o, x)),
  attackingCreaturesYouControl: (g, o, src) => isCreature(o) && o.controller === src.controller && !!g.combat?.attackers.has(o.id),
  attackingCreatures: (g, o) => isCreature(o) && !!g.combat?.attackers.has(o.id),
};

// Eventi che fanno innescare un'abilità (w = permanente con l'abilità, d = oggetto dell'evento)
const TRIGGER = {
  creatureYouControl: (g, d, w) => isCreature(d) && d.controller === w.controller,
  goblinYouControl: (g, d, w) => isCreature(d) && isGoblin(d) && d.controller === w.controller,
  anyCreature: (g, d) => isCreature(d),
  anotherRedCreatureYouControl: (g, d, w) => isCreature(d) && d.controller === w.controller && d.id !== w.id && colorsOf(d.def).includes('R'),
  pirateSpell: (g, d, w) => d.controller === w.controller && (d.def.subtypes || []).includes('Pirate'),
  multicoloredSpell: (g, d, w) => d.controller === w.controller && colorsOf(d.def).length > 1,
  instantOrSorcerySpell: (g, d, w) => d.controller === w.controller && (isType(d, 'Instant') || isType(d, 'Sorcery')),
  creatureTokenYouControl: (g, d, w) => isCreature(d) && d.isToken && d.controller === w.controller,
  creatureYouControlPower3: (g, d, w) => isCreature(d) && d.controller === w.controller && g.power(d) >= 3,
  anotherCreatureYouControlPower3: (g, d, w) => isCreature(d) && d.controller === w.controller && d.id !== w.id && g.power(d) >= 3,
  anotherNontokenCreatureYouControl: (g, d, w) => isCreature(d) && !d.isToken && d.controller === w.controller && d.id !== w.id,
  landYouControl: (g, d, w) => isType(d, 'Land') && d.controller === w.controller,
  creatureSpell: (g, d, w) => d.controller === w.controller && isCreature(d),
  anotherCreature: (g, d, w) => isCreature(d) && d.id !== w.id,
  anotherCreatureYouControl: (g, d, w) => isCreature(d) && d.controller === w.controller && d.id !== w.id,
  nontokenCreatureYouControl: (g, d, w) => isCreature(d) && !d.isToken && d.controller === w.controller,
  selfOrZombie: (g, d, w) => d.id === w.id || (isCreature(d) && hasSub(d, 'Zombie')),
  creatureOpponentControls: (g, d, w) => isCreature(d) && d.controller !== w.controller,
  blackCreatureYouControl: (g, d, w) => isCreature(d) && d.controller === w.controller && colorsOf(d.def).includes('B'),
};

// Magie che ricevono una riduzione di costo
const SPELL = {
  goblinSpell: (def) => (def.subtypes || []).includes('Goblin'),
  redSpell: (def) => colorsOf(def).includes('R'),
  blueSpell: (def) => colorsOf(def).includes('U'),
  greenSpell: (def) => colorsOf(def).includes('G'),
  blackSpell: (def) => colorsOf(def).includes('B'),
  instantOrSorcerySpell: (def) => def.types.includes('Instant') || def.types.includes('Sorcery'),
  creatureWithFlyingSpell: (def) => def.types.includes('Creature') && (def.keywords || []).includes('Flying'),
};

// Carte cercate in una zona nascosta
const CARD = {
  goblinCard: (o) => isGoblin(o),
  basicLand: (o) => isType(o, 'Land') && (o.def.supertypes || []).includes('Basic'),
  forestCard: (o) => isType(o, 'Land') && hasSub(o, 'Forest'),
  anyCard: () => true,
  creatureCard: (o) => isCreature(o),
};

// Permanenti che si possono sacrificare per pagare un costo (pid = chi paga, src = fonte del costo)
const SACRIFICE = {
  self: (g, o, pid, src) => src && o.id === src.id,
  goblin: (g, o, pid) => o.controller === pid && isGoblin(o),
  creature: (g, o, pid) => o.controller === pid && isCreature(o),
  land: (g, o, pid) => o.controller === pid && isType(o, 'Land'),
  artifactOrCreature: (g, o, pid) => o.controller === pid && (isType(o, 'Artifact') || isCreature(o)),
  anotherBlackCreature: (g, o, pid, src) => o.controller === pid && isCreature(o) && colorsOf(o.def).includes('B') && (!src || o.id !== src.id),
};

// Bersagli legali (t = { player } oppure { object }, pid = controllore della magia o abilità)
const TARGET = {
  any: (g, t, pid) => (t.player ? g.isAlive(t.player) : permanent(g, t, pid, isCreature)),
  player: (g, t) => !!t.player && g.isAlive(t.player),
  creature: (g, t, pid) => permanent(g, t, pid, isCreature),
  opponentCreature: (g, t, pid) => permanent(g, t, pid, (o) => isCreature(o) && o.controller !== pid),
  artifact: (g, t, pid) => permanent(g, t, pid, (o) => isType(o, 'Artifact')),
  creaturePower2: (g, t, pid) => permanent(g, t, pid, (o) => isCreature(o) && g.power(o) <= 2),
  creatureYouControlPower2: (g, t, pid) => permanent(g, t, pid, (o) => isCreature(o) && o.controller === pid && g.power(o) <= 2),
  graveyardCard: (g, t) => !!t.object && g.object(t.object)?.zone === 'graveyard',
  spell: (g, t) => spellOnStack(g, t, () => true),
  noncreatureSpell: (g, t) => spellOnStack(g, t, (o) => !isCreature(o)),
  creatureSpell: (g, t) => spellOnStack(g, t, isCreature),
  enchantmentInstantSorcerySpell: (g, t) => spellOnStack(g, t, (o) => ['Enchantment', 'Instant', 'Sorcery'].some((x) => isType(o, x))),
  artifactCreaturePlaneswalkerSpell: (g, t) => spellOnStack(g, t, (o) => ['Artifact', 'Creature', 'Planeswalker'].some((x) => isType(o, x))),
  spellOrPermanent: (g, t, pid) => spellOnStack(g, t, () => true) || permanent(g, t, pid, () => true),
  nonlandPermanent: (g, t, pid) => permanent(g, t, pid, (o) => !isType(o, 'Land')),
  permanent: (g, t, pid) => permanent(g, t, pid, () => true),
  enchantment: (g, t, pid) => permanent(g, t, pid, (o) => isType(o, 'Enchantment')),
  artifactOrEnchantment: (g, t, pid) => permanent(g, t, pid, (o) => isType(o, 'Artifact') || isType(o, 'Enchantment')),
  artifactEnchantmentOrLand: (g, t, pid) => permanent(g, t, pid, (o) => ['Artifact', 'Enchantment', 'Land'].some((x) => isType(o, x))),
  creatureYouControl: (g, t, pid) => permanent(g, t, pid, (o) => isCreature(o) && o.controller === pid),
  creatureYouDontControl: (g, t, pid) => permanent(g, t, pid, (o) => isCreature(o) && o.controller !== pid),
  creatureOrPlaneswalker: (g, t, pid) => permanent(g, t, pid, (o) => isCreature(o) || isType(o, 'Planeswalker')),
  nonartifactCreature: (g, t, pid) => permanent(g, t, pid, (o) => isCreature(o) && !isType(o, 'Artifact')),
  nonblackCreature: (g, t, pid) => permanent(g, t, pid, (o) => isCreature(o) && !colorsOf(o.def).includes('B')),
  creatureOrEnchantmentOpponentControls: (g, t, pid) => permanent(g, t, pid, (o) => (isCreature(o) || isType(o, 'Enchantment')) && o.controller !== pid),
  creatureCardInGraveyard: (g, t) => graveyardCard(g, t, () => true),
  creatureCardInYourGraveyard: (g, t, pid) => graveyardCard(g, t, (o) => o.owner === pid),
};

function graveyardCard(g, t, test) {
  const o = t.object && g.object(t.object);
  return !!o && o.zone === 'graveyard' && isCreature(o) && test(o);
}

function spellOnStack(g, t, test) {
  const o = t.object && g.object(t.object);
  return !!o && o.zone === 'stack' && !o.isAbility && test(o);
}

// Un permanente bersagliabile: sul campo, del tipo giusto e senza Anti-malocchio verso gli avversari (CR 702.11b)
function permanent(g, t, pid, test) {
  const o = t.object && g.object(t.object);
  if (!onField(o) || !test(o)) return false;
  return !(g.hasKw(o, 'Hexproof') && o.controller !== pid);
}

module.exports = { GROUP, TRIGGER, SPELL, CARD, SACRIFICE, TARGET, isType, isCreature, isGoblin, hasSub };
