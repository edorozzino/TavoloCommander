// Effetti manuali: per il testo che il motore non sa applicare (carte ricavate da Scryfall, vedi generated.js)
// il giocatore usa comandi liberi, come a un tavolo vero. Si possono usare quando si ha la priorità oppure
// durante la decisione 'manual', che si apre quando si risolve una magia o abilità con effetto { kind: 'manual' }.
// Ogni comando passa comunque dal motore: le zone restano coerenti e le azioni basate sullo stato si applicano.
const { RuleError } = require('./errors');
const { TOKENS } = require('./cards');
const { COLORS, parseCost, canPay, pay } = require('./mana');
const { isCreature } = require('./filters');

const DESTINATIONS = ['hand', 'battlefield', 'graveyard', 'exile', 'libraryTop', 'libraryBottom'];
const COUNTER_KINDS = ['+1/+1', '-1/-1', 'loyalty', 'charge'];

function amountOf(action, { min = 1, max = 99, signed = false } = {}) {
  const n = Number(action.amount ?? 1);
  if (!Number.isInteger(n) || Math.abs(n) > max || (signed ? n === 0 : n < min)) throw new RuleError('INVALID_AMOUNT', 'Quantità non valida');
  return n;
}

const OPS = {
  done(pid) {
    const d = this.decision;
    if (d?.type !== 'manual') throw new RuleError('NOT_NOW', 'Non c\'è nessun effetto da completare');
    this.decision = null;
    d.resume();
  },

  draw(pid, a) {
    this.draw(this.manualPlayer(a), amountOf(a));
  },

  mill(pid, a) {
    this.mill(this.manualPlayer(a), amountOf(a));
  },

  life(pid, a) {
    this.state.get(this.manualPlayer(a)).life += amountOf(a, { signed: true, max: 999 });
  },

  damage(pid, a) {
    const o = this.manualObject(a, ['battlefield']);
    if (!isCreature(o)) throw new RuleError('NOT_A_CREATURE', `${o.name} non è una creatura`);
    o.damage += amountOf(a);
  },

  counter(pid, a) {
    const o = this.manualObject(a, ['battlefield']);
    if (!COUNTER_KINDS.includes(a.kind)) throw new RuleError('INVALID_COUNTER', 'Tipo di segnalino non valido');
    const n = (o.counters[a.kind] || 0) + amountOf(a, { signed: true });
    if (n > 0) o.counters[a.kind] = n;
    else delete o.counters[a.kind];
  },

  tap(pid, a) {
    this.manualObject(a, ['battlefield']).tapped = !!a.tapped;
  },

  control(pid, a) {
    const o = this.manualObject(a, ['battlefield']);
    Object.assign(o, { controller: pid, controlSince: this.turn });
  },

  // Sposta una carta: dal campo, dai cimiteri e dall'esilio di chiunque; dalla propria mano
  move(pid, a) {
    const o = this.manualObject(a, ['battlefield', 'graveyard', 'exile', 'hand']);
    if (o.zone === 'hand' && o.owner !== pid) throw new RuleError('NOT_YOURS', 'Puoi spostare solo le carte della tua mano');
    if (!DESTINATIONS.includes(a.to)) throw new RuleError('INVALID_ZONE', 'Destinazione non valida');
    const to = a.to.startsWith('library') ? 'library' : a.to;
    if (o.zone === to) throw new RuleError('SAME_ZONE', `${o.name} è già lì`);
    if (o.zone === 'battlefield' && to === 'graveyard') return this.toGraveyard([o]); // innesca "quando muore"
    this.move(o.id, to, { top: a.to === 'libraryTop', controller: to === 'battlefield' ? pid : undefined });
    return undefined;
  },

  token(pid, a) {
    const name = String(a.name || '').trim().slice(0, 40);
    if (!name) throw new RuleError('NO_NAME', 'Dai un nome alla pedina');
    const n = amountOf(a, { max: 20 });
    const hasPT = Number.isInteger(a.power) && Number.isInteger(a.toughness);
    const def = TOKENS[name] && !hasPT ? TOKENS[name] : {
      name, types: hasPT ? ['Creature'] : ['Artifact'], subtypes: [], colors: [], keywords: [],
      ...(hasPT ? { power: a.power, toughness: a.toughness } : {}),
    };
    for (let i = 0; i < n; i++) this.create(pid, def.name, 'battlefield', { def, isToken: true });
  },

  mana(pid, a) {
    if (!COLORS.includes(a.color)) throw new RuleError('INVALID_COLOR', 'Colore non valido');
    this.state.get(pid).pool[a.color] += amountOf(a, { max: 20 });
  },

  // Paga un costo di mana (X, costi aggiuntivi, tasse): tappa le fonti in automatico se il pool non basta
  pay(pid, a) {
    let cost;
    try {
      cost = parseCost(String(a.cost || ''));
    } catch {
      throw new RuleError('INVALID_COST', 'Scrivi il costo con i simboli, per esempio {2}{B}');
    }
    const s = this.state.get(pid);
    if (!canPay(s.pool, cost)) this.payAutomatically(pid, cost, new Set());
    s.pool = pay(s.pool, cost);
  },

  shuffle(pid) {
    this.rng.shuffle(this.state.get(pid).zones.library);
  },

  // Cerca nel proprio grimorio una carta qualsiasi e la mette nella destinazione scelta, poi si mescola
  search(pid, a) {
    if (!DESTINATIONS.includes(a.to) || a.to === 'libraryBottom') throw new RuleError('INVALID_ZONE', 'Destinazione non valida');
    const options = [...this.state.get(pid).zones.library];
    this.nested(pid, { type: 'search', options, max: 1 }, (ids) => {
      for (const id of ids) if (a.to !== 'libraryTop') this.move(id, a.to, { controller: a.to === 'battlefield' ? pid : undefined });
      const lib = this.state.get(pid).zones.library;
      this.rng.shuffle(lib);
      if (a.to === 'libraryTop') for (const id of ids) { lib.splice(lib.indexOf(id), 1); lib.unshift(id); }
    });
  },

  // Guarda le prime N carte e decide quali restano in cima e quali vanno in fondo
  scry(pid, a) {
    const cards = this.state.get(pid).zones.library.slice(0, amountOf(a, { max: 20 }));
    if (cards.length) this.nested(pid, { type: 'scry', cards }, () => {});
  },
};

class Manual {
  manualPlayer(a) {
    if (!this.isAlive(a.player)) throw new RuleError('INVALID_PLAYER', 'Giocatore non valido');
    return a.player;
  }

  manualObject(a, zones) {
    const o = this.objects.get(a.object);
    if (!o || !zones.includes(o.zone)) throw new RuleError('NOT_AVAILABLE', 'Questa carta non si può usare così');
    return o;
  }

  // Una scelta dentro l'effetto manuale (ricerca, profezia): finita la scelta si torna dove si era
  nested(pid, decision, after) {
    const prev = this.decision;
    this.ask({
      ...decision,
      player: pid,
      resume: (ids) => {
        after(ids);
        if (prev) this.decision = prev;
        else this.givePriority(pid);
      },
    });
  }
}

const actions = {
  manual(pid, action) {
    const op = OPS[action.op];
    if (!op) throw new RuleError('UNKNOWN_OP', 'Comando manuale sconosciuto');
    op.call(this, pid, action);
  },
};

function install(Game) {
  for (const name of Object.getOwnPropertyNames(Manual.prototype)) {
    if (name !== 'constructor') Game.prototype[name] = Manual.prototype[name];
  }
  Object.assign(Game.prototype.actions, actions);
}

module.exports = { install, OPS, DESTINATIONS };
