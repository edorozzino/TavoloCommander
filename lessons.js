// Accademia: lezioni guidate. Ogni lezione è una partita vera del motore contro il "Maestro", un avversario
// con mosse predefinite, con un obiettivo, suggerimenti passo per passo e un controllo automatico del superamento.
const { createGame } = require('./engine');
const { RuleError } = require('./engine/errors');

const YOU = 'tu';
const MAESTRO = 'maestro';

const STEP_HINTS = {
  upkeep: 'Mantenimento: qui si risolvono le abilità "all\'inizio del tuo mantenimento". Di solito non succede nulla: passa.',
  draw: 'Acquisizione: il giocatore di turno pesca una carta (chi inizia una partita a 2 salta la prima pescata). Passa.',
  main1: 'Prima fase principale: puoi giocare una terra e lanciare creature e stregonerie. Quando hai finito, passa.',
  beginCombat: 'Inizio del combattimento: ultimo momento per rispondere prima degli attacchi. Passa.',
  declareAttackers: 'Dichiarazione degli attaccanti: scegli con quali creature attaccare, oppure nessuna.',
  declareBlockers: 'Dichiarazione dei bloccanti: il difensore sceglie come bloccare. Dopo, tutti possono ancora rispondere.',
  combatDamage: 'Danno da combattimento: le creature infliggono danno tutte insieme. Passa.',
  endCombat: 'Fine del combattimento. Passa.',
  main2: 'Seconda fase principale: come la prima, ma dopo il combattimento. Passa.',
  end: 'Fase finale: le abilità "all\'inizio della fase finale" si risolvono qui. Passa.',
};

// ---------- Strumenti per preparare le lezioni ----------
const fill = (name, n) => Array(n).fill(name);
const on = (g, pid, name) => g.setup.putOnBattlefield(pid, name);
const hand = (g, pid, name) => g.setup.putInHand(pid, name);
const has = (g, pid, zone, name) => g.zone(pid, zone).some((o) => o.name === name)
  || (zone === 'battlefield' && g.battlefield().some((o) => o.controller === pid && o.name === name));
const yourStack = (g, name) => g.stack.some((o) => o.name === name && o.controller === YOU);

function newGame({ commander, library = 'Forest', maestroLibrary = 'Island' } = {}) {
  const g = createGame({
    seed: 7,
    players: [
      { id: YOU, commanders: commander ? [commander] : [], library: fill(library, 40) },
      { id: MAESTRO, commanders: [], library: fill(maestroLibrary, 40) },
    ],
  });
  // mani vuote: la lezione decide quali carte servono
  for (const pid of [YOU, MAESTRO]) for (const o of g.zone(pid, 'hand')) g.setup.moveTo(o.id, 'library');
  return g;
}

// Porta la partita al passo indicato del primo turno passando la priorità
function advance(g, step) {
  for (let i = 0; i < 40 && g.step !== step; i++) g.perform(g.priority, { type: 'pass' });
  return g;
}

const common = (g) => {
  if (g.stack.length) return 'Sulla Pila c\'è qualcosa: passa la priorità perché si risolva (o rispondi con un istantaneo).';
  return STEP_HINTS[g.step] || 'Passa la priorità per andare avanti.';
};

const LESSONS = [
  {
    id: 'zone', n: 1, title: 'Le carte e le zone',
    goal: 'Gioca una Forest e lancia Grizzly Bears.',
    intro: 'Le carte stanno in zone: grimorio (il mazzo), mano, campo di battaglia, cimitero, esilio e zona di comando. '
      + 'Le terre si giocano dalla mano gratis, una per turno. Le altre carte si lanciano pagando il loro costo in mana: '
      + 'il costo di Grizzly Bears è {1}{G}, cioè un mana verde più uno qualsiasi.',
    build() {
      const g = advance(newGame(), 'main1');
      on(g, YOU, 'Forest');
      hand(g, YOU, 'Forest');
      hand(g, YOU, 'Grizzly Bears');
      return g;
    },
    hint(g) {
      if (yourStack(g, 'Grizzly Bears')) return 'Grizzly Bears è sulla Pila: le magie non si risolvono subito. Passa la priorità: se nessuno risponde, entra sul campo.';
      if (has(g, YOU, 'hand', 'Forest') && g.state.get(YOU).landsPlayed === 0) return 'Clicca la Forest nella tua mano per giocarla sul campo.';
      if (has(g, YOU, 'hand', 'Grizzly Bears')) return 'Ora hai due Forest: clicca Grizzly Bears per lanciarla. Il mana si paga tappando le terre (lo fa il gioco per te).';
      return common(g);
    },
    done: (g) => has(g, YOU, 'battlefield', 'Grizzly Bears'),
  },
  {
    id: 'mana', n: 2, title: 'Terre e mana',
    goal: 'Lancia Cruel Celebrant, che costa {W}{B}: un mana bianco e uno nero.',
    intro: 'Ogni terra base produce un colore: Plains bianco, Island blu, Swamp nero, Mountain rosso, Forest verde. '
      + 'Tappare una terra (girarla di lato) mette il suo mana nel tuo mana pool, che si svuota alla fine di ogni passo. '
      + 'In questa lezione prova a tappare tu le terre cliccandole, poi lancia la magia.',
    build() {
      const g = advance(newGame(), 'main1');
      on(g, YOU, 'Plains');
      on(g, YOU, 'Swamp');
      hand(g, YOU, 'Cruel Celebrant');
      return g;
    },
    hint(g) {
      const pool = g.state.get(YOU).pool;
      if (yourStack(g, 'Cruel Celebrant')) return 'La magia è sulla Pila: passa la priorità perché si risolva.';
      if (has(g, YOU, 'hand', 'Cruel Celebrant')) {
        if (pool.W && pool.B) return 'Nel tuo mana pool ci sono {W} e {B}: ora clicca Cruel Celebrant per lanciarla.';
        return 'Clicca la Plains e la Swamp (scegli "Mana") per aggiungere {W} e {B} al tuo mana pool, in alto nel tuo pannello.';
      }
      return common(g);
    },
    done: (g) => has(g, YOU, 'battlefield', 'Cruel Celebrant'),
  },
  {
    id: 'turno', n: 3, title: 'Il turno',
    goal: 'Attraversa tutto il turno e arriva alla prima fase principale del tuo turno successivo.',
    intro: 'Ogni turno ha cinque fasi: inizio (stap, mantenimento, acquisizione), prima fase principale, combattimento, '
      + 'seconda fase principale e fase finale. In ogni passo i giocatori ricevono la priorità: quando tutti passano, '
      + 'si va al passo successivo. Segui la barra in alto: il passo attuale è evidenziato.',
    build() {
      const g = newGame();
      on(g, YOU, 'Forest');
      on(g, MAESTRO, 'Island');
      hand(g, YOU, 'Grizzly Bears');
      return g;
    },
    hint(g) {
      if (g.active === MAESTRO) return 'È il turno del Maestro: anche lui attraversa le stesse fasi. Passa quando ricevi la priorità.';
      return common(g);
    },
    done: (g) => g.turn >= 3 && g.active === YOU && g.step === 'main1',
  },
  {
    id: 'combattimento', n: 4, title: 'Combattimento',
    goal: 'Attacca con il tuo orso: il Maestro bloccherà. Fai in modo che muoia il suo orso e non il tuo.',
    intro: 'Le creature che controlli dall\'inizio del turno possono attaccare: si tappano e infliggono danno pari alla '
      + 'loro forza (il primo numero). Il difensore può bloccare: allora le due creature si colpiscono a vicenda, e muore chi '
      + 'riceve danno pari alla sua costituzione (il secondo numero). Due 2/2 si eliminano a vicenda... a meno che tu non intervenga.',
    build() {
      const g = advance(newGame(), 'main1');
      on(g, YOU, 'Grizzly Bears');
      on(g, YOU, 'Forest');
      hand(g, YOU, 'Giant Growth');
      on(g, MAESTRO, 'Grizzly Bears');
      return g;
    },
    blocks(g) { // il Maestro blocca il primo attaccante con il suo orso
      const [attacker] = g.combat.attackers.keys();
      const bear = g.battlefield().find((o) => o.controller === MAESTRO && o.name === 'Grizzly Bears');
      return attacker && bear ? [{ blocker: bear.id, attacker }] : [];
    },
    hint(g) {
      const blocked = g.combat && [...g.combat.attackers.values()].some((a) => a.blocked);
      if (g.decision?.type === 'declareAttackers') return 'Clicca il tuo Grizzly Bears per farlo attaccare il Maestro, poi conferma.';
      if (blocked && has(g, YOU, 'hand', 'Giant Growth')) return 'Il Maestro ha bloccato! Prima del danno lancia Giant Growth sul tuo orso: diventa 5/5 fino a fine turno.';
      if (g.active === YOU && ['main1', 'beginCombat'].includes(g.step)) return 'Passa la priorità fino alla dichiarazione degli attaccanti.';
      return common(g);
    },
    done: (g) => has(g, MAESTRO, 'graveyard', 'Grizzly Bears') && has(g, YOU, 'battlefield', 'Grizzly Bears'),
    failed: (g) => has(g, YOU, 'graveyard', 'Grizzly Bears'),
  },
  {
    id: 'pila', n: 5, title: 'Istantanei e la Pila',
    goal: 'Il Maestro proverà a colpire il tuo orso con Lightning Bolt. Salvalo rispondendo con Giant Growth.',
    intro: 'Gli istantanei si possono lanciare in qualsiasi momento in cui hai la priorità, anche in risposta a un\'altra magia. '
      + 'Le magie vanno sulla Pila e si risolvono dall\'ultima arrivata: se rispondi a Lightning Bolt con Giant Growth, '
      + 'Giant Growth si risolve per prima e il tuo orso sarà 5/5 quando arriva il fulmine.',
    build() {
      const g = advance(newGame(), 'main1');
      on(g, YOU, 'Grizzly Bears');
      on(g, YOU, 'Forest');
      hand(g, YOU, 'Giant Growth');
      on(g, MAESTRO, 'Mountain');
      hand(g, MAESTRO, 'Lightning Bolt');
      return g;
    },
    maestro(g) {
      const bear = g.battlefield().find((o) => o.controller === YOU && o.name === 'Grizzly Bears');
      const bolt = g.zone(MAESTRO, 'hand').find((o) => o.name === 'Lightning Bolt');
      if (bear && bolt && !g.stack.length) return { type: 'cast', object: bolt.id, targets: [{ object: bear.id }], autoPay: true };
      return null;
    },
    hint(g) {
      const boltOnStack = g.stack.some((o) => o.name === 'Lightning Bolt');
      if (boltOnStack && has(g, YOU, 'hand', 'Giant Growth')) return 'Lightning Bolt è sulla Pila e bersaglia il tuo orso! Rispondi: lancia Giant Growth sul tuo orso adesso.';
      if (boltOnStack) return 'Giant Growth è sopra il fulmine sulla Pila: passa e guarda l\'ordine in cui si risolvono.';
      if (has(g, YOU, 'hand', 'Giant Growth')) return 'Passa la priorità: vediamo che cosa fa il Maestro.';
      return common(g);
    },
    done: (g) => has(g, MAESTRO, 'graveyard', 'Lightning Bolt') && has(g, YOU, 'battlefield', 'Grizzly Bears') && !g.stack.length,
    failed: (g) => has(g, YOU, 'graveyard', 'Grizzly Bears'),
  },
  {
    id: 'abilita', n: 6, title: 'Abilità',
    goal: 'Crea almeno tre token Goblin.',
    intro: 'I permanenti hanno abilità. Le abilità innescate partono da sole quando succede qualcosa ("quando entra..."). '
      + 'Le abilità attivate le usi tu pagando il costo: {T} significa tappare il permanente. Entrambe vanno sulla Pila come le magie. '
      + 'Krenko crea un Goblin per ogni Goblin che controlli: più Goblin hai, meglio è.',
    build() {
      const g = advance(newGame({ library: 'Mountain' }), 'main1');
      on(g, YOU, 'Krenko, Mob Boss');
      for (let i = 0; i < 3; i++) on(g, YOU, 'Mountain');
      hand(g, YOU, 'Goblin Instigator');
      return g;
    },
    hint(g) {
      const tokens = g.battlefield().filter((o) => o.controller === YOU && o.isToken).length;
      if (g.stack.length) return 'Sulla Pila c\'è un\'abilità o una magia: passa la priorità perché si risolva.';
      if (has(g, YOU, 'hand', 'Goblin Instigator')) return 'Lancia prima Goblin Instigator: quando entra, la sua abilità innescata crea un Goblin.';
      if (tokens < 3) return 'Ora clicca Krenko e attiva la sua abilità ({T}): conterà tutti i tuoi Goblin.';
      return common(g);
    },
    done: (g) => g.battlefield().filter((o) => o.controller === YOU && o.isToken && o.name === 'Goblin').length >= 3,
  },
  {
    id: 'keyword', n: 7, title: 'Le keyword',
    goal: 'Attacca con entrambe le creature: infliggi almeno 5 danni al Maestro e guadagna vita.',
    intro: 'Le keyword sono abilità con un nome. Volare: si blocca solo con Volare o Raggiungere. Legame vitale: il danno '
      + 'inflitto ti fa guadagnare altrettanta vita. Tocco letale: basta 1 danno per distruggere una creatura. Travolgere: il '
      + 'danno oltre quello letale per il bloccante arriva al giocatore. Passa il mouse sulle carte per leggerle.',
    build() {
      const g = advance(newGame(), 'main1');
      on(g, YOU, 'Vampire Nighthawk');
      on(g, YOU, 'Colossal Dreadmaw');
      on(g, MAESTRO, 'Grizzly Bears');
      on(g, MAESTRO, 'Wall of Wood');
      return g;
    },
    blocks(g) { // il Muro blocca la creatura più grossa che può bloccare
      const wall = g.battlefield().find((o) => o.controller === MAESTRO && o.name === 'Wall of Wood');
      const target = [...g.combat.attackers.keys()].map((id) => g.object(id)).find((o) => o && !g.hasKw(o, 'Flying'));
      return wall && target ? [{ blocker: wall.id, attacker: target.id }] : [];
    },
    hint(g) {
      if (g.decision?.type === 'declareAttackers') return 'Clicca Vampire Nighthawk e Colossal Dreadmaw per farli attaccare, poi conferma.';
      if (g.active === YOU && ['main1', 'beginCombat'].includes(g.step)) return 'Passa fino alla dichiarazione degli attaccanti.';
      if (g.step === 'declareBlockers' || g.step === 'combatDamage') return 'Il Muro può bloccare solo Colossal Dreadmaw (Nighthawk vola): guarda quanto danno passa con Travolgere.';
      return common(g);
    },
    done: (g) => g.state.get(MAESTRO).life <= 35 && g.state.get(YOU).life >= 42,
  },
  {
    id: 'comandante', n: 8, title: 'Il comandante',
    goal: 'Lancia Krenko dalla zona di comando, poi rilancialo pagando la tassa.',
    intro: 'In Commander il tuo comandante parte dalla zona di comando e puoi lanciarlo da lì. Se muore o va in esilio, '
      + 'puoi rimetterlo nella zona di comando. Ogni volta che lo rilanci da lì costa {2} in più: è la tassa del comandante.',
    build() {
      const g = advance(newGame({ commander: 'Krenko, Mob Boss', library: 'Mountain' }), 'main1');
      for (let i = 0; i < 10; i++) on(g, YOU, 'Mountain');
      on(g, MAESTRO, 'Mountain');
      hand(g, MAESTRO, 'Lightning Bolt');
      return g;
    },
    maestro(g) {
      const krenko = g.battlefield().find((o) => o.controller === YOU && o.isCommander);
      const bolt = g.zone(MAESTRO, 'hand').find((o) => o.name === 'Lightning Bolt');
      if (krenko && bolt && !g.stack.length) return { type: 'cast', object: bolt.id, targets: [{ object: krenko.id }], autoPay: true };
      return null;
    },
    hint(g) {
      const casts = Object.values(g.state.get(YOU).commanderCasts).reduce((a, b) => a + b, 0);
      if (g.stack.length) return 'Sulla Pila c\'è una magia: passa la priorità perché si risolva.';
      if (casts === 0) return 'Clicca Krenko nella tua zona di comando (il riquadro dorato) per lanciarlo: costa {2}{R}{R}.';
      if (casts === 1 && g.zone(YOU, 'command').length) {
        return 'Krenko è morto ed è tornato nella zona di comando. Rilancialo: adesso costa {4}{R}{R}, cioè {2} di tassa in più.';
      }
      if (casts === 1) return 'Krenko è sul campo. Passa la priorità: il Maestro ha qualcosa in mente...';
      return common(g);
    },
    done: (g) => Object.values(g.state.get(YOU).commanderCasts).reduce((a, b) => a + b, 0) >= 2
      && g.battlefield().some((o) => o.controller === YOU && o.isCommander),
  },
];

// ---------- Svolgimento ----------
function maestroDecide(s, d) {
  const g = s.game;
  const first = (n) => g.zone(MAESTRO, 'hand').slice(0, n).map((o) => o.id);
  const choices = {
    declareAttackers: () => ({ type: 'declareAttackers', attackers: [] }),
    declareBlockers: () => ({ type: 'declareBlockers', blocks: s.lesson.blocks ? s.lesson.blocks(g) : [] }),
    discard: () => ({ type: 'discard', objects: first(d.count) }),
    chooseTarget: () => ({ type: 'chooseTarget', target: d.optional ? null : d.options[0] }),
    confirm: () => ({ type: 'confirm', yes: true }),
    search: () => ({ type: 'search', objects: d.options.slice(0, d.max) }),
    scry: () => ({ type: 'scry', top: d.cards, bottom: [] }),
    putBack: () => ({ type: 'putBack', objects: first(d.count) }),
    chooseCards: () => ({ type: 'chooseCards', objects: d.options.slice(0, d.count) }),
    chooseSacrifice: () => ({ type: 'chooseSacrifice', object: d.options[0] }),
  };
  g.perform(MAESTRO, choices[d.type]());
}

// Il Maestro gioca finché non tocca di nuovo a te
function runMaestro(s) {
  const g = s.game;
  for (let i = 0; i < 300 && !g.winner; i++) {
    if (g.decision) {
      if (g.decision.player !== MAESTRO) return;
      maestroDecide(s, g.decision);
      continue;
    }
    if (g.priority !== MAESTRO) return;
    const move = s.lesson.maestro ? s.lesson.maestro(g) : null;
    try {
      g.perform(MAESTRO, move || { type: 'pass' });
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
      g.perform(MAESTRO, { type: 'pass' });
    }
  }
}

function startLesson(id) {
  const lesson = LESSONS.find((l) => l.id === id);
  if (!lesson) throw new RuleError('NO_LESSON', 'Lezione non trovata');
  const s = { lesson, game: lesson.build() };
  runMaestro(s);
  return s;
}

// Un'azione del giocatore; le azioni vietate sollevano RuleError con il motivo, come in partita
function lessonAct(s, action) {
  s.game.perform(YOU, action);
  runMaestro(s);
}

function lessonStatus(s) {
  const done = s.lesson.done(s.game);
  const failed = !done && !!s.lesson.failed?.(s.game);
  return {
    id: s.lesson.id, n: s.lesson.n, title: s.lesson.title, goal: s.lesson.goal, intro: s.lesson.intro,
    done, failed,
    hint: done ? 'Obiettivo raggiunto!' : failed ? 'Non è andata come previsto: riprova la lezione.' : s.lesson.hint(s.game),
    next: LESSONS.find((l) => l.n === s.lesson.n + 1)?.id || null,
  };
}

module.exports = { LESSONS, startLesson, lessonAct, lessonStatus, YOU, MAESTRO };
