// Carte non programmate in cards.js: la definizione si ricava dai dati di Scryfall.
// Il motore applica da solo ciò che sa leggere (tipi, costo, forza/costituzione, keyword, abilità di mana, entrata tappata);
// il resto del testo finisce in def.manual e lo applica il giocatore con gli effetti manuali (vedi manual.js).
// Le abilità innescate e attivate riconoscibili diventano abilità vere con effetto { kind: 'manual' }:
// vanno sulla Pila al momento giusto e, risolvendosi, aprono la finestra degli effetti manuali.
const { WUBRG } = require('./identity');

const SUPERTYPES = ['Basic', 'Legendary', 'Snow', 'World', 'Ongoing'];
const KEYWORDS = {
  flying: 'Flying', trample: 'Trample', haste: 'Haste', vigilance: 'Vigilance', deathtouch: 'Deathtouch', lifelink: 'Lifelink',
  'first strike': 'First strike', 'double strike': 'Double strike', menace: 'Menace', reach: 'Reach', hexproof: 'Hexproof',
  indestructible: 'Indestructible', defender: 'Defender', flash: 'Flash',
};
const BASIC_LAND_TYPES = { Plains: 'W', Island: 'U', Swamp: 'B', Mountain: 'R', Forest: 'G' };
const MANA_SYMBOL = /^\{(?:\d+|[WUBRGC])\}$/;

const stripReminder = (line) => line.replace(/\s*\([^)]*\)/g, '').trim();
const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function parseTypeLine(typeLine) {
  const [left, right = ''] = typeLine.split(' — ');
  const words = left.split(' ').filter(Boolean);
  return {
    supertypes: words.filter((w) => SUPERTYPES.includes(w)),
    types: words.filter((w) => !SUPERTYPES.includes(w)),
    subtypes: right.split(' ').filter(Boolean),
  };
}

// Costo che il motore sa pagare: ibridi e phyrexiani si pagano con il primo colore, X vale 0
function convertCost(manaCost, notes) {
  const out = [];
  for (const [, s] of manaCost.matchAll(/\{([^}]+)\}/g)) {
    if (/^(\d+|[WUBRGC])$/.test(s)) out.push(`{${s}}`);
    else if (s === 'X' || s === 'Y') notes.add('X vale 0 quando la lanci: paga il mana in più con «Paga mana» e applica l\'effetto a mano.');
    else if (/^[WUBRGC]\/P$/.test(s)) out.push(`{${s[0]}}`);
    else if (/^2\/[WUBRG]$/.test(s)) out.push('{2}');
    else if (/^[WUBRGC]\/[WUBRG]$/.test(s)) {
      out.push(`{${s[0]}}`);
      notes.add(`Il costo ibrido {${s}} si paga con {${s[0]}}.`);
    } else out.push('{1}'); // neve e simboli rari: un mana generico
  }
  return out.join('');
}

const colorsIn = (manaCost) => WUBRG.filter((c) => new RegExp(`\\{[^}]*${c}[^}]*\\}`).test(manaCost));

// "{T}: Add {B}." "{1}, {T}: Add {U}{B}." "{T}: Add {R} or {G}." "{T}: Add one mana of any color."
function parseManaAbility(line) {
  const m = line.match(/^(.+?): Add (.+)\.$/);
  if (!m) return null;
  const costParts = m[1].split(', ');
  if (!costParts.includes('{T}') || !costParts.every((p) => p === '{T}' || MANA_SYMBOL.test(p))) return null;
  const cost = [...costParts.filter((p) => p !== '{T}'), '{T}'].join('');
  const add = m[2];
  if (/^(\{[WUBRGC]\})+$/.test(add)) return { kind: 'mana', cost, produce: add.replace(/[{}]/g, '') };
  if (/^(\{[WUBRGC]\}, )*\{[WUBRGC]\},? or \{[WUBRGC]\}$/.test(add)) {
    return { kind: 'mana', cost, produce: 'choice', options: [...add.matchAll(/\{([WUBRGC])\}/g)].map((x) => x[1]) };
  }
  if (add === 'one mana of any color') return { kind: 'mana', cost, produce: 'anyColor' };
  if (add === "one mana of any color in your commander's color identity") return { kind: 'mana', cost, produce: 'commanderIdentity' };
  return null;
}

// Costo di un'abilità attivata: mana, {T}, sacrifici e scarti che il motore sa verificare
function parseActivationCost(text, self) {
  const ab = { cost: '' };
  for (const part of text.split(', ')) {
    if (part === '{T}' || MANA_SYMBOL.test(part)) ab.cost += part;
    else if (new RegExp(`^Sacrifice (${self})$`).test(part)) ab.sacrifice = 'self';
    else if (part === 'Sacrifice a creature' || part === 'Sacrifice another creature') ab.sacrifice = 'creature';
    else if (part === 'Sacrifice a land') ab.sacrifice = 'land';
    else if (part === 'Sacrifice an artifact or creature') ab.sacrifice = 'artifactOrCreature';
    else if (part === 'Discard a card') ab.discard = 1;
    else return null;
  }
  return ab;
}

const TRIGGERS = [
  ['etb', (self) => `^When(?:ever)? (?:${self}) enters(?: the battlefield)?, `],
  ['dies', (self) => `^When(?:ever)? (?:${self}) dies, `],
  ['attacks', (self) => `^When(?:ever)? (?:${self}) attacks, `],
  ['upkeep', () => '^At the beginning of your upkeep, '],
  ['endStep', () => '^At the beginning of your end step, '],
  ['beginCombat', () => '^At the beginning of combat on your turn, '],
];

const cache = new Map();

// info = voce semplificata di scryfall.js (name, type, manaCost, oracle, power, toughness, colorIdentity)
function defFromScryfall(info) {
  if (cache.has(info.name)) return cache.get(info.name);
  const twoFaced = info.type.includes(' // ');
  const front = (s) => String(s || '').split(' // ')[0];
  const { supertypes, types, subtypes } = parseTypeLine(front(info.type));
  const manaCost = front(info.manaCost);
  const notes = new Set();
  const def = {
    name: info.name,
    supertypes,
    types,
    subtypes,
    cost: convertCost(manaCost, notes),
    colors: colorsIn(manaCost),
    colorIdentity: info.colorIdentity || [],
    keywords: [],
    abilities: [],
    generated: true,
  };
  if (types.includes('Creature')) {
    const pt = (v) => (/^\d+$/.test(String(v)) ? Number(v) : null);
    def.power = pt(info.power) ?? 0;
    def.toughness = pt(info.toughness) ?? 0;
    if (pt(info.power) == null || pt(info.toughness) == null) notes.add(`Forza/costituzione variabile (${info.power}/${info.toughness}): sul campo vale ${def.power}/${def.toughness}, correggi con i segnalini.`);
  }

  const lines = String(info.oracle || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const manual = [];
  const isSpell = types.includes('Instant') || types.includes('Sorcery');
  if (twoFaced || isSpell) {
    // Le carte a due facce e gli effetti di istantanei e stregonerie si applicano a mano, tutti insieme
    for (const line of lines) {
      const kw = keywordLine(stripReminder(line));
      if (kw && !twoFaced) def.keywords.push(...kw);
      else manual.push(line);
    }
    if (isSpell) def.effect = [{ kind: 'manual', text: manual.join('\n') }];
  } else {
    const shortName = info.name.split(',')[0];
    const self = ['this creature', 'this artifact', 'this enchantment', 'this land', 'this permanent', reEscape(info.name), reEscape(shortName)].join('|');
    const mana = [];
    for (const line of lines) {
      const text = stripReminder(line);
      if (!text) continue; // solo testo di richiamo
      const kw = keywordLine(text);
      if (kw) { def.keywords.push(...kw); continue; }
      if (new RegExp(`^(${self}) enters(?: the battlefield)? tapped\\.$`, 'i').test(text)) { def.entersTapped = true; continue; }
      const ma = parseManaAbility(text);
      if (ma) { mana.push({ ability: ma, line }); continue; }
      manual.push(line);
      const trigger = TRIGGERS.find(([, re]) => new RegExp(re(self)).test(text));
      if (trigger) {
        def.abilities.push({ kind: 'triggered', when: trigger[0], effect: { kind: 'manual', text: line } });
        continue;
      }
      const act = text.match(/^([^:"]+): (.+)$/);
      // le abilità di mana con effetti in più non usano la Pila: restano solo nel testo manuale
      const cost = act && !act[2].startsWith('Add ') && parseActivationCost(act[1], self);
      if (cost) def.abilities.push({ kind: 'activated', ...cost, effect: { kind: 'manual', text: line } });
    }
    // Il motore usa una sola abilità di mana per permanente: più abilità semplici diventano "un colore a scelta"
    const simple = mana.every(({ ability: a }) => a.cost === '{T}' && (a.produce.length === 1 || a.produce === 'choice' || a.produce === 'anyColor'));
    if (mana.length > 1 && simple) {
      const any = mana.some(({ ability: a }) => a.produce === 'anyColor');
      const options = [...new Set(mana.flatMap(({ ability: a }) => (a.produce === 'choice' ? a.options : [a.produce])))];
      def.abilities.unshift(any ? { kind: 'mana', cost: '{T}', produce: 'anyColor' } : { kind: 'mana', cost: '{T}', produce: 'choice', options });
    } else if (mana.length) {
      def.abilities.unshift(mana[0].ability);
      manual.push(...mana.slice(1).map((x) => x.line));
    }
    // Terre con tipi base (Overgrown Tomb, Plains Island…): la loro abilità di mana è implicita
    const basics = subtypes.filter((s) => BASIC_LAND_TYPES[s]).map((s) => BASIC_LAND_TYPES[s]);
    if (types.includes('Land') && basics.length && !mana.length) {
      def.abilities.unshift(basics.length === 1 ? { kind: 'mana', cost: '{T}', produce: basics[0] } : { kind: 'mana', cost: '{T}', produce: 'choice', options: basics });
    }
  }
  def.manual = [...manual, ...notes];
  cache.set(info.name, def);
  return def;
}

// "Flying, vigilance" → ['Flying', 'Vigilance']; null se la riga contiene altro
function keywordLine(text) {
  const parts = text.replace(/\.$/, '').split(/,\s*/).map((p) => p.trim().toLowerCase());
  if (!parts.length || !parts.every((p) => KEYWORDS[p])) return null;
  return parts.map((p) => KEYWORDS[p]);
}

module.exports = { defFromScryfall };
