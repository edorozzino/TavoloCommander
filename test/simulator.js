// Simulatore di partite con azioni casuali: cerca crash e violazioni degli invarianti del motore.
// Le azioni rifiutate dalle regole sono attese; ciò che conta è che non lascino lo stato modificato.
const { createGame } = require('../engine');
const { createRng } = require('../engine/rng');
const { CARDS } = require('../engine/cards');
const { RuleError } = require('../engine/errors');

const { STARTER_DECKS } = require('../engine/decks');

const SPELLS = Object.keys(CARDS).filter((n) => !CARDS[n].supertypes?.includes('Basic') && n !== 'Krenko, Mob Boss');
const LANDS = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'];
const DECKS = STARTER_DECKS.map((d) => ({ commander: d.commander, cards: d.cards.flatMap((e) => Array(e.count).fill(e.name)) }));
const COLORS = ['W', 'U', 'B', 'R', 'G'];

// Impronta dello stato: tutto ciò che un'azione rifiutata non deve modificare
function snapshot(g) {
  const d = g.decision && { ...g.decision, resume: undefined, trigger: undefined };
  // (le decisioni contengono funzioni di ripresa: si confronta solo la parte serializzabile)
  const parts = [g.turn, g.step, g.priority, g.passes, g.stackIds.join(','), g.pendingTriggers.length, g.triggerQueue.length,
    JSON.stringify(d), JSON.stringify(g.eot), JSON.stringify(g.enteredThisTurn)];
  for (const o of g.objects.values()) {
    if (o.zone === 'library') continue; // nel grimorio conta solo l'ordine, già nelle zone qui sotto
    parts.push(`${o.id}:${o.zone}:${o.owner}:${o.controller}:${+o.tapped}:${o.damage}:${+o.deathtouched}:${o.controlSince}:${JSON.stringify(o.counters)}`);
  }
  for (const [pid, s] of g.state) {
    const zones = Object.entries(s.zones).map(([z, ids]) => `${z}=${ids.join(',')}`).join(';');
    const pool = Object.values(s.pool).join(',');
    const cmd = JSON.stringify([s.commanderCasts, s.commanderDamage]);
    parts.push(`${pid}:${s.life}:${s.poison}:${pool}:${+s.lost}:${s.landsPlayed}:${cmd}:${zones}`);
  }
  if (g.combat) {
    for (const [id, a] of g.combat.attackers) parts.push(`atk${id}>${a.defender}:${a.blockers.join(',')}:${+a.blocked}`);
  }
  return parts.join('|');
}

function checkInvariants(g) {
  const fail = (msg) => { throw new Error(`Invariante violato (turno ${g.turn}, ${g.step}): ${msg}`); };
  const seen = new Map();
  const note = (id, where) => {
    if (seen.has(id)) fail(`l'oggetto ${id} è sia in ${seen.get(id)} sia in ${where}`);
    seen.set(id, where);
  };
  for (const id of g.stackIds) note(id, 'stack');
  for (const [pid, s] of g.state) {
    for (const [zone, ids] of Object.entries(s.zones)) {
      for (const id of ids) {
        note(id, `${pid}.${zone}`);
        const o = g.objects.get(id);
        if (!o) fail(`la zona ${pid}.${zone} contiene l'oggetto inesistente ${id}`);
        if (o.zone !== zone || o.owner !== pid) fail(`${o.name} è registrato in ${pid}.${zone} ma dice ${o.owner}.${o.zone}`);
      }
    }
    if (!Number.isInteger(s.life)) fail(`vita non intera per ${pid}`);
    if (Object.values(s.pool).some((v) => v < 0)) fail(`mana negativo per ${pid}`);
  }
  for (const [id, o] of g.objects) {
    if (!seen.has(id)) fail(`${o.name} (${id}) non è in nessuna zona`);
    if (g.state.get(o.owner).lost) fail(`${o.name} appartiene a un giocatore eliminato`);
    if (o.isToken && o.zone !== 'battlefield') fail(`il token ${o.name} esiste fuori dal campo`);
  }
  const waiting = [g.priority !== null, g.decision !== null, g.winner !== null].filter(Boolean).length;
  if (waiting !== 1) fail(`stato di attesa ambiguo (priorità ${g.priority}, decisione ${g.decision?.type}, vincitore ${g.winner})`);
}

function randomGame(seed, { players = 4, maxTurns = 25 } = {}) {
  const rng = createRng(seed * 7919);
  const pick = (arr) => arr[Math.floor(rng.next() * arr.length)];
  // la maggior parte dei giocatori usa un mazzo iniziale vero, gli altri un miscuglio di tutte le carte del motore
  const deck = () => (rng.next() < 0.7 ? pick(DECKS)
    : { commander: 'Krenko, Mob Boss', cards: Array.from({ length: 99 }, () => (rng.next() < 0.4 ? pick(LANDS) : pick(SPELLS))) });
  const ids = ['A', 'B', 'C', 'D'].slice(0, players);
  const g = createGame({ seed, players: ids.map((id) => { const d = deck(); return { id, commanders: [d.commander], library: [...d.cards] }; }) });
  const stats = { accepted: 0, rejected: 0, turns: 0 };

  const randomTarget = () => (rng.next() < 0.5 ? { player: pick(ids) } : { object: pick([...g.objects.keys()]) });
  // Parametri facoltativi dei costi: colore del mana, sacrifici, scarti, modalità
  const extras = (p, self) => {
    const x = {};
    if (rng.next() < 0.6) x.color = pick(COLORS);
    if (rng.next() < 0.3) {
      const field = g.battlefield().filter((o) => o.controller === p);
      x.sacrifice = [rng.next() < 0.5 && self ? self : pick(field.length ? field : [{ id: 0 }]).id];
    }
    if (rng.next() < 0.2) {
      const hand = mine(p, 'hand');
      if (hand.length) x.discard = [pick(hand).id];
    }
    if (rng.next() < 0.5) x.mode = Math.floor(rng.next() * 2);
    if (rng.next() < 0.5) x.autoPay = true;
    return x;
  };
  const mine = (pid, zone) => g.zone(pid, zone);

  function attempt(pid, action) {
    const before = snapshot(g);
    try {
      g.perform(pid, action);
      stats.accepted++;
      return true;
    } catch (e) {
      if (!(e instanceof RuleError)) throw new Error(`Seme ${seed}: errore inatteso su ${JSON.stringify(action)}: ${e.stack}`);
      if (snapshot(g) !== before) throw new Error(`Seme ${seed}: azione rifiutata (${e.code}) ma lo stato è cambiato: ${JSON.stringify(action)}`);
      stats.rejected++;
      return false;
    }
  }

  function decide() {
    const d = g.decision;
    const p = d.player;
    if (d.type === 'declareAttackers') {
      const opponents = g.players.filter((x) => x !== p);
      const attackers = mine(p, 'battlefield').filter(() => rng.next() < 0.5).map((o) => ({ object: o.id, defender: pick(opponents) }));
      if (!attempt(p, { type: 'declareAttackers', attackers })) attempt(p, { type: 'declareAttackers', attackers: [] });
    } else if (d.type === 'declareBlockers') {
      const attacking = [...g.combat.attackers.keys()];
      const blocks = mine(p, 'battlefield').filter(() => rng.next() < 0.5).map((o) => ({ blocker: o.id, attacker: pick(attacking) }));
      if (!attempt(p, { type: 'declareBlockers', blocks })) attempt(p, { type: 'declareBlockers', blocks: [] });
    } else if (d.type === 'chooseTarget') {
      const choice = d.optional && rng.next() < 0.3 ? null : pick(d.options);
      if (!attempt(p, { type: 'chooseTarget', target: choice })) attempt(p, { type: 'chooseTarget', target: d.options[0] });
    } else if (d.type === 'confirm') {
      attempt(p, { type: 'confirm', yes: rng.next() < 0.5 });
    } else if (d.type === 'search') {
      attempt(p, { type: 'search', objects: d.options.filter(() => rng.next() < 0.5).slice(0, d.max) });
    } else if (d.type === 'scry') {
      const top = d.cards.filter(() => rng.next() < 0.5);
      attempt(p, { type: 'scry', top, bottom: d.cards.filter((x) => !top.includes(x)) });
    } else if (d.type === 'putBack') {
      const hand = mine(p, 'hand').map((o) => o.id);
      if (!attempt(p, { type: 'putBack', objects: [pick(hand)] })) attempt(p, { type: 'putBack', objects: hand.slice(-d.count) });
    } else if (d.type === 'chooseSacrifice') {
      if (!attempt(p, { type: 'chooseSacrifice', object: pick([...g.objects.keys()]) })) attempt(p, { type: 'chooseSacrifice', object: pick(d.options) });
    } else if (d.type === 'chooseCards') {
      if (!attempt(p, { type: 'chooseCards', objects: [] })) attempt(p, { type: 'chooseCards', objects: d.options.slice(0, d.count) });
    } else if (d.type === 'discard') {
      const hand = mine(p, 'hand').map((o) => o.id);
      for (let i = hand.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [hand[i], hand[j]] = [hand[j], hand[i]]; }
      attempt(p, { type: 'discard', objects: hand.slice(0, d.count) });
    }
  }

  function act() {
    const p = g.priority;
    const r = rng.next();
    const hand = mine(p, 'hand');
    const field = g.battlefield().filter((o) => o.controller === p);
    if (r < 0.45 || (!hand.length && !field.length)) return attempt(p, { type: 'pass' });
    if (r < 0.55 && hand.length) return attempt(p, { type: 'playLand', object: pick(hand).id });
    if (r < 0.7 && field.length) {
      const o = pick(field);
      return attempt(p, { type: 'activateMana', object: o.id, ...extras(p, o.id) });
    }
    if (r < 0.88) {
      const castable = [...hand, ...mine(p, 'command')];
      if (castable.length) return attempt(p, { type: 'cast', object: pick(castable).id, targets: rng.next() < 0.7 ? [randomTarget()] : [], ...extras(p) });
    }
    if (field.length) {
      const o = pick(field);
      return attempt(p, { type: 'activate', object: o.id, targets: rng.next() < 0.7 ? [randomTarget()] : [], ...extras(p, o.id) });
    }
    return attempt(p, { type: 'pass' });
  }

  for (let steps = 0; steps < 20000 && !g.winner && g.turn <= maxTurns; steps++) {
    if (g.decision) decide();
    else act();
    checkInvariants(g);
  }
  stats.turns = g.turn;
  stats.winner = g.winner;
  return stats;
}

module.exports = { randomGame, checkInvariants, snapshot };
