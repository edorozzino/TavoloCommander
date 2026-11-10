// Tavoli con regole automatiche: il motore applica le regole, il server inoltra le azioni e invia a ognuno la sua vista.
const crypto = require('crypto');
const { createGame } = require('./engine');
const { buildView } = require('./engine/view');
const { CARDS } = require('./engine/cards');
const { defFromScryfall } = require('./engine/generated');
const { RuleError } = require('./engine/errors');
const { STARTER_DECKS } = require('./engine/decks');
const { lookupCards, cachedCard } = require('./scryfall');
const decks = require('./decks');
const lessons = require('./lessons');
const { botMove } = require('./engine/bot');

const { sweepRooms } = require('./room-sweep');
const { claimSeat, newSeatKey } = require('./seats');
const { nextPassMode, shouldAutoPass, autoAnswer } = require('./autopass');

const rooms = new Map();
const id = () => crypto.randomBytes(6).toString('hex');
const MAX_PLAYERS = 4;
// Il ritmo della partita: abbastanza lento da capire che cosa succede a ogni passo
const AUTO_PASS_DELAY = 600;
const BOT_PASS_DELAY = 300;
const BOT_ACTION_DELAY = 1400;
// Chi deve muovere ma è scollegato non blocca il tavolo: dopo l'attesa il computer decide per lui
const AWAY_LIMIT = 45 * 1000;
const AWAY_REPEAT_LIMIT = 3 * 1000;
const MOVE_LIMITS = [0, 60, 120]; // secondi per mossa scelti da chi crea il tavolo (0 = nessun limite)

const STEP_NAMES = {
  untap: 'stap', upkeep: 'mantenimento', draw: 'acquisizione', main1: 'prima fase principale', beginCombat: 'inizio combattimento',
  declareAttackers: 'dichiarazione attaccanti', declareBlockers: 'dichiarazione bloccanti', firstStrikeDamage: 'danno (attacco improvviso)',
  combatDamage: 'danno da combattimento', endCombat: 'fine combattimento', main2: 'seconda fase principale', end: 'finale', cleanup: 'cancellazione',
};
const ZONE_NAMES = { hand: 'in mano', battlefield: 'sul campo', graveyard: 'nel cimitero', exile: 'in esilio', command: 'nella zona di comando', library: 'nel grimorio', stack: 'sulla Pila' };

// Come il motore tratta una carta: programmata, ricavata da Scryfall (con o senza testo da applicare a mano)
// oppure ancora sconosciuta (non è nella cache di Scryfall)
function cardStatus(name) {
  if (CARDS[name]) return 'auto';
  const info = cachedCard(name);
  if (!info) return 'unknown';
  if (CARDS[info.name]) return 'auto';
  return defFromScryfall(info).manual.length ? 'manual' : 'auto';
}

const namesOf = (d) => [...d.commanders, ...d.cards.map((e) => e.name)];

// Mazzi disponibili: i mazzi iniziali e tutti i mazzi salvati con un comandante. Le carte che il motore non conosce
// si ricavano da Scryfall; quelle con effetti che il motore non sa applicare si giocano con gli effetti manuali
function deckChoices() {
  const starters = STARTER_DECKS.map((d, i) => ({ id: `starter-${i}`, name: d.name, commander: d.commander, ok: true }));
  const saved = decks.list().map((d) => {
    const full = decks.get(d.id);
    const status = full.cards.flatMap((e) => Array(e.count).fill(cardStatus(e.name)));
    const manual = full.cards.filter((e) => cardStatus(e.name) === 'manual').length;
    return {
      id: d.id, name: d.name, commander: full.commanders.join(' + '), ok: full.commanders.length > 0,
      autoPct: status.length ? Math.round((100 * status.filter((x) => x === 'auto').length) / status.length) : 100,
      manualCount: manual, unknownCount: namesOf(full).filter((n) => cardStatus(n) === 'unknown').length,
    };
  });
  return [...starters, ...saved];
}

// Cerca su Scryfall le carte dei mazzi salvati che non sono ancora nella cache
async function prefetchDecks() {
  const names = decks.list().flatMap((d) => namesOf(decks.get(d.id))).filter((n) => cardStatus(n) === 'unknown');
  if (names.length) await lookupCards(names);
}

// Nomi del mazzo trasformati nei nomi ufficiali, più le definizioni delle carte che il motore non ha programmato
async function resolveDeck(d) {
  const { found, notFound } = await lookupCards(namesOf(d).filter((n) => !CARDS[n]));
  if (notFound.length) {
    throw new RuleError('DECK_UNKNOWN', `Scryfall non trova ${notFound.length} carte di questo mazzo: ${notFound.slice(0, 5).join(', ')}. Correggi i nomi nell'editor dei mazzi.`);
  }
  const cards = {};
  const real = (n) => {
    if (CARDS[n]) return n;
    const info = found.get(n);
    if (!CARDS[info.name]) cards[info.name] = defFromScryfall(info);
    return info.name;
  };
  return {
    commanders: d.commanders.map(real),
    library: d.cards.flatMap((e) => Array(e.count).fill(real(e.name))),
    cards,
  };
}

function deckContents(deckId) {
  if (deckId.startsWith('starter-')) {
    const d = STARTER_DECKS[Number(deckId.slice(8))];
    return d && { commanders: [d.commander], cards: d.cards };
  }
  const d = decks.get(deckId);
  return d && { commanders: d.commanders, cards: d.cards };
}

function getRoom(code) {
  if (!rooms.has(code)) rooms.set(code, { code, players: new Map(), order: [], host: null, game: null, log: [], sockets: new Set(), seen: 0, moveLimit: 0, images: {}, arts: {}, artists: {} });
  return rooms.get(code);
}

const nameOf = (room, pid) => room.players.get(pid)?.name || pid;
function log(room, text) {
  room.log.push({ ts: Date.now(), text });
  if (room.log.length > 300) room.log.shift();
}

// Racconta in italiano gli eventi del motore non ancora registrati
function narrate(room) {
  const g = room.game;
  for (; room.seen < g.events.length; room.seen++) {
    const e = g.events[room.seen];
    if (e.type === 'move') {
      if (e.to === 'stack' && !e.ability) { log(room, `${nameOf(room, e.owner)} lancia ${e.name}`); continue; }
      if (e.ability || e.to === 'stack' || (e.from === 'library' && e.to === 'hand') || (e.from === 'hand' && e.to === 'battlefield')) continue;
      if (e.from === 'stack' && e.to === 'battlefield') { log(room, `${e.name} si risolve ed entra sul campo`); continue; }
      log(room, `${e.name} (${nameOf(room, e.owner)}) va ${ZONE_NAMES[e.to] || e.to}`);
    } else if (e.type === 'combatDamage') {
      log(room, `${e.name} infligge ${e.amount} danni a ${e.player ? nameOf(room, e.player) : e.target}`);
    } else if (e.type === 'mulligan') {
      log(room, `${nameOf(room, e.player)} fa mulligan`);
    } else if (e.type === 'lose') {
      log(room, `${nameOf(room, e.player)} ha perso la partita`);
    } else if (e.type === 'fizzle') {
      log(room, 'Una magia o abilità non si risolve: il suo bersaglio non è più valido');
    } else if (e.type === 'manual') {
      log(room, `${nameOf(room, e.player)} applica a mano l'effetto di ${e.source}`);
    } else if (e.type === 'reveal') {
      log(room, `${nameOf(room, e.player)} rivela delle carte`);
    }
  }
}

function describeAction(room, pid, a) {
  const g = room.game;
  const obj = (oid) => g.object(oid)?.name || 'una carta';
  switch (a.type) {
    case 'activate': return `${nameOf(room, pid)} attiva un'abilità di ${obj(a.object)}`;
    case 'playLand': return `${nameOf(room, pid)} gioca ${obj(a.object)}`;
    case 'declareAttackers': return a.attackers?.length
      ? `${nameOf(room, pid)} attacca con ${a.attackers.map((x) => `${obj(x.object)} → ${nameOf(room, x.defender)}`).join(', ')}`
      : `${nameOf(room, pid)} non attacca`;
    case 'declareBlockers': return a.blocks?.length
      ? `${nameOf(room, pid)} blocca: ${a.blocks.map((x) => `${obj(x.blocker)} blocca ${obj(x.attacker)}`).join(', ')}`
      : `${nameOf(room, pid)} non blocca`;
    case 'manual': return describeManual(room, pid, a);
    default: return null;
  }
}

const DEST_NAMES = { hand: 'in mano', battlefield: 'sul campo', graveyard: 'nel cimitero', exile: 'in esilio', libraryTop: 'in cima al grimorio', libraryBottom: 'in fondo al grimorio' };
const COUNTER_NAMES = { '+1/+1': '+1/+1', '-1/-1': '-1/-1', loyalty: 'fedeltà', charge: 'carica' };

// Gli effetti manuali si vedono tutti nel registro: è il modo in cui il tavolo controlla che siano giusti
function describeManual(room, pid, a) {
  const g = room.game;
  const who = `✋ ${nameOf(room, pid)}`;
  const o = g.object(a.object);
  // una carta che lascia la mano senza essere rivelata resta coperta
  const card = o ? (o.zone === 'hand' && a.to?.startsWith('library') ? 'una carta dalla mano' : o.name) : 'una carta';
  const n = Number(a.amount ?? 1);
  switch (a.op) {
    case 'done': return null;
    case 'draw': return `${who}: ${nameOf(room, a.player)} pesca ${n} ${n === 1 ? 'carta' : 'carte'}`;
    case 'mill': return `${who}: ${nameOf(room, a.player)} mette le prime ${n} carte del grimorio nel cimitero`;
    case 'life': return `${who}: ${nameOf(room, a.player)} ${n > 0 ? `guadagna ${n}` : `perde ${-n}`} punti vita`;
    case 'damage': return `${who}: ${n} danni a ${card}`;
    case 'counter': return `${who}: ${n > 0 ? `+${n}` : n} segnalini ${COUNTER_NAMES[a.kind] || a.kind} su ${card}`;
    case 'tap': return `${who}: ${a.tapped ? 'tappa' : 'stappa'} ${card}`;
    case 'control': return `${who}: prende il controllo di ${card}`;
    case 'move': return `${who}: ${card} va ${DEST_NAMES[a.to] || a.to}`;
    case 'token': return `${who}: crea ${n} pedin${n === 1 ? 'a' : 'e'} ${String(a.name || '')}${Number.isInteger(a.power) ? ` ${a.power}/${a.toughness}` : ''}`;
    case 'mana': return `${who}: aggiunge ${n} mana {${a.color}}`;
    case 'pay': return `${who}: paga ${a.cost}`;
    case 'shuffle': return `${who}: mescola il grimorio`;
    case 'search': return `${who}: cerca una carta nel grimorio e la mette ${DEST_NAMES[a.to] || a.to}`;
    case 'scry': return `${who}: guarda le prime ${n} carte del grimorio`;
    default: return null;
  }
}

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}

// Tempo massimo per la mossa di un giocatore umano in questo momento, in millisecondi (0 = nessuno)
function moveLimitFor(room, p) {
  if (!p || p.isBot || room.lesson) return 0;
  if (!p.connected) return p.away ? AWAY_REPEAT_LIMIT : AWAY_LIMIT;
  return room.moveLimit * 1000;
}

function armIdleTimer(room) {
  const g = room.game;
  const who = g && !g.winner ? (g.decision ? g.decision.player : g.priority) : null;
  const p = who && room.players.get(who);
  const limit = moveLimitFor(room, p);
  const key = limit ? [who, limit, g.turn, g.step, g.stack.length, g.passes, g.events.length, g.decision?.type].join(':') : null;
  if (key === room.idleKey) return;
  clearTimeout(room.idleTimer);
  room.idleKey = key;
  room.idle = null;
  if (!key) return;
  room.idle = { player: who, until: Date.now() + limit };
  room.idleTimer = setTimeout(() => {
    room.idleKey = null;
    room.idle = null;
    if (!rooms.has(room.code) || room.game !== g || g.winner || (g.decision ? g.decision.player : g.priority) !== who) return;
    if (!p.connected) p.away = true;
    try {
      g.perform(who, g.decision ? botMove(g, who) : { type: 'pass' });
      log(room, `⏳ Tempo scaduto per ${p.name}: ${g.decision ? 'decide' : 'passa'} il computer`);
    } catch (e) {
      if (!(e instanceof RuleError)) console.error(e);
    }
    narrate(room);
    if (g.winner) log(room, `${nameOf(room, g.winner)} vince la partita!`);
    broadcast(room);
    scheduleBots(room);
  }, limit);
}

function broadcast(room) {
  armIdleTimer(room);
  const names = Object.fromEntries([...room.players.values()].map((p) => [p.id, p.name]));
  const lobby = {
    host: room.host,
    started: !!room.game,
    moveLimit: room.moveLimit,
    players: room.order.map((pid) => {
      const p = room.players.get(pid);
      return { id: pid, name: p.name, deck: p.deckId, deckName: p.deckName, connected: p.connected, bot: !!p.isBot };
    }),
  };
  for (const ws of room.sockets) {
    const msg = { t: 'autoState', room: room.code, me: ws.pid, lobby, log: room.log.slice(-120), autoPass: !room.lesson && room.players.get(ws.pid)?.autoPass !== false, passMode: room.players.get(ws.pid)?.passMode || null, timer: room.idle ? { player: room.idle.player, left: room.idle.until - Date.now() } : null };
    if (room.lesson) msg.lesson = lessons.lessonStatus(room.lesson);
    if (room.game) {
      msg.game = buildView(room.game, ws.pid, { names, images: room.images, arts: room.arts, artists: room.artists });
      msg.stepName = STEP_NAMES[room.game.step];
    } else {
      msg.decks = deckChoices();
    }
    send(ws, msg);
  }
}

async function start(room) {
  // Chi è al tavolo senza mazzo: se è collegato si aspetta lui, se è sparito gli si toglie il posto
  const missing = room.order.filter((pid) => !room.players.get(pid).deckId);
  const waiting = missing.filter((pid) => room.players.get(pid).connected);
  if (waiting.length) throw new RuleError('NOT_READY', `Deve ancora scegliere un mazzo: ${waiting.map((pid) => nameOf(room, pid)).join(', ')}`);
  for (const pid of missing) {
    log(room, `${nameOf(room, pid)} non è collegato e non ha scelto un mazzo: lascia il posto`);
    room.players.delete(pid);
    room.order = room.order.filter((x) => x !== pid);
  }
  const ready = room.order;
  if (ready.length < 2) throw new RuleError('NOT_READY', 'Servono almeno 2 giocatori con un mazzo scelto');
  const seats = ready.map((pid) => {
    const d = deckContents(room.players.get(pid).deckId);
    return { id: pid, commanders: d.commanders, library: d.cards.flatMap((e) => Array(e.count).fill(e.name)) };
  });
  // carte non programmate nel motore: definizioni ricavate da Scryfall
  const cards = {};
  for (const seat of seats) {
    const { deckId } = room.players.get(seat.id);
    if (deckId.startsWith('starter-')) continue;
    const r = await resolveDeck(deckContents(deckId));
    Object.assign(seat, { commanders: r.commanders, library: r.library });
    Object.assign(cards, r.cards);
  }
  // immagini delle carte da Scryfall (dalla cache se già viste)
  const names = [...new Set(seats.flatMap((s) => [...s.commanders, ...s.library]))];
  try {
    const { found } = await lookupCards(names);
    for (const [n, info] of found) { room.images[n] = info.img; room.arts[n] = info.art; room.artists[n] = info.artist; }
  } catch { /* senza internet si gioca con le carte di solo testo */ }
  room.game = createGame({ seed: crypto.randomInt(1, 2 ** 31), mulligan: true, orderTriggers: true, assignDamage: true, players: seats, cards });
  room.seen = room.game.events.length;
  log(room, `La partita comincia: ${seats.map((s) => nameOf(room, s.id)).join(', ')}. Tocca a ${nameOf(room, room.game.active)}.`);
}

async function handle(ws, msg) {
  if (msg.t === 'lessonList') {
    return send(ws, { t: 'autoLessons', lessons: lessons.LESSONS.map((l) => ({ id: l.id, n: l.n, title: l.title, goal: l.goal })) });
  }
  if (msg.t === 'lessonStart') { // ogni lezione è una stanza privata: tu contro il Maestro
    let session;
    try {
      session = lessons.startLesson(String(msg.id));
    } catch (e) {
      return send(ws, { t: 'error', msg: e.message });
    }
    if (ws.autoRoom) ws.autoRoom.sockets.delete(ws);
    const room = getRoom(`lezione-${id()}`);
    room.lesson = session;
    room.game = session.game;
    room.seen = session.game.events.length;
    room.players.set(lessons.YOU, { id: lessons.YOU, name: String(msg.name || 'Allievo').slice(0, 24), connected: true });
    room.players.set(lessons.MAESTRO, { id: lessons.MAESTRO, name: 'Maestro', connected: true });
    room.order = [lessons.YOU, lessons.MAESTRO];
    room.host = lessons.YOU;
    const names = [...new Set([...session.game.objects.values()].map((o) => o.name))];
    try {
      const { found } = await lookupCards(names.concat(lessons.LESSON_CARDS || []));
      for (const [n, info] of found) { room.images[n] = info.img; room.arts[n] = info.art; room.artists[n] = info.artist; }
    } catch { /* si gioca anche senza immagini */ }
    log(room, `Lezione ${session.lesson.n}: ${session.lesson.title}. Obiettivo: ${session.lesson.goal}`);
    ws.autoRoom = room;
    ws.pid = lessons.YOU;
    room.sockets.add(ws);
    send(ws, { t: 'autoJoined', pid: lessons.YOU, room: room.code, lesson: true });
    return broadcast(room);
  }
  if (msg.t === 'autoJoin') {
    const code = String(msg.room || 'tavolo').trim().toLowerCase().slice(0, 20) || 'tavolo';
    const room = getRoom(code);
    // con gli account si rientra nel proprio posto anche da un link o da un altro dispositivo
    let p = claimSeat(room, msg, ws.user);
    if (!p) {
      if (room.game) return send(ws, { t: 'error', msg: 'La partita su questo tavolo è già iniziata.' });
      if (room.players.size >= MAX_PLAYERS) return send(ws, { t: 'error', msg: `Il tavolo è pieno (max ${MAX_PLAYERS} giocatori).` });
      p = { id: id(), name: String(msg.name || 'Giocatore').trim().slice(0, 24) || 'Giocatore', deckId: null, deckName: null, connected: true };
      p.userId = ws.user?.id;
      p.key = newSeatKey();
      room.players.set(p.id, p);
      room.order.push(p.id);
      if (!room.host) room.host = p.id;
      log(room, `${p.name} si siede al tavolo`);
    }
    p.connected = true;
    p.away = false;
    if (p.left) { // era uscito a partita in corso: riprende il posto dal computer
      p.left = false;
      p.isBot = false;
      log(room, `${p.name} torna al tavolo`);
    }
    ws.autoRoom = room;
    ws.pid = p.id;
    room.sockets.add(ws);
    send(ws, { t: 'autoJoined', pid: p.id, room: code, key: p.key });
    if (!room.game) prefetchDecks().then(() => broadcast(room), () => {}); // percentuali dei mazzi aggiornate
    broadcast(room);
    return scheduleBots(room);
  }
  const room = ws.autoRoom;
  const p = room && room.players.get(ws.pid);
  if (!p) return;
  try {
    if (msg.t === 'autoDeck' && !room.game) {
      const choice = deckChoices().find((d) => d.id === msg.deckId);
      if (!choice) throw new RuleError('NO_DECK', 'Mazzo non trovato');
      if (!choice.ok) throw new RuleError('NO_COMMANDER', 'Questo mazzo non ha un comandante: sceglilo nell\'editor dei mazzi');
      if (!choice.id.startsWith('starter-')) await resolveDeck(deckContents(choice.id)); // nomi da correggere: lo dice subito
      p.deckId = choice.id;
      p.deckName = choice.name;
    } else if (msg.t === 'autoAddBot' && !room.game) {
      if (ws.pid !== room.host) throw new RuleError('NOT_HOST', 'Solo chi ha creato il tavolo può aggiungere giocatori computer');
      if (room.players.size >= MAX_PLAYERS) throw new RuleError('FULL', `Il tavolo è pieno (max ${MAX_PLAYERS} giocatori)`);
      const taken = new Set([...room.players.values()].map((x) => x.deckId));
      const starters = deckChoices().filter((d) => d.id.startsWith('starter-'));
      const deck = starters.find((d) => d.id === msg.deckId) || starters.find((d) => !taken.has(d.id)) || starters[0];
      const n = [...room.players.values()].filter((x) => x.isBot).length + 1;
      const bot = { id: `bot-${id()}`, name: `Computer ${n}`, deckId: deck.id, deckName: deck.name, connected: true, isBot: true };
      room.players.set(bot.id, bot);
      room.order.push(bot.id);
      log(room, `${bot.name} si siede al tavolo con il mazzo ${deck.name}`);
    } else if (msg.t === 'autoRemoveBot' && !room.game) {
      const bot = room.players.get(msg.pid);
      if (ws.pid !== room.host || !bot?.isBot) throw new RuleError('NOT_HOST', 'Solo chi ha creato il tavolo può togliere i giocatori computer');
      room.players.delete(bot.id);
      room.order = room.order.filter((x) => x !== bot.id);
    } else if (msg.t === 'autoPass') {
      p.autoPass = !!msg.on;
    } else if (msg.t === 'autoPassMode' && room.game && !room.lesson) {
      p.passMode = ['response', 'turn'].includes(msg.mode) ? msg.mode : null;
      p.passTurn = room.game.turn;
    } else if (msg.t === 'autoStart' && !room.game) {
      if (ws.pid !== room.host) throw new RuleError('NOT_HOST', 'Solo chi ha creato il tavolo può avviare la partita');
      if (room.starting) return; // un secondo tocco mentre la partita si prepara
      room.starting = true;
      try {
        await start(room);
      } finally {
        room.starting = false;
      }
    } else if (msg.t === 'autoRematch' && room.game?.winner && !room.lesson) {
      // Si torna in sala d'attesa con gli stessi posti e gli stessi mazzi; chi era uscito non c'è più
      clearTimeout(room.botTimer);
      room.botTimer = null;
      room.game = null;
      for (const x of [...room.players.values()]) {
        Object.assign(x, { passMode: null, away: false });
        if (!x.left) continue;
        room.players.delete(x.id);
        room.order = room.order.filter((pid) => pid !== x.id);
      }
      const host = room.players.get(room.host);
      if (!host || host.isBot || !host.connected) room.host = p.id;
      log(room, `${p.name} propone la rivincita`);
    } else if (msg.t === 'autoTimer' && !room.game) {
      if (ws.pid !== room.host) throw new RuleError('NOT_HOST', 'Solo chi ha creato il tavolo può cambiare il tempo per mossa');
      room.moveLimit = MOVE_LIMITS.includes(msg.seconds) ? msg.seconds : 0;
    } else if (msg.t === 'autoAct' && room.game) {
      const text = describeAction(room, ws.pid, msg.action || {});
      if (room.lesson) lessons.lessonAct(room.lesson, msg.action || {});
      else room.game.perform(ws.pid, msg.action || {});
      if (text) log(room, text);
      narrate(room);
      if (room.game.winner) log(room, `${nameOf(room, room.game.winner)} vince la partita!`);
    } else if (msg.t === 'autoLeave') {
      room.sockets.delete(ws);
      ws.autoRoom = null;
      if (room.lesson) rooms.delete(room.code);
      if (room.game && !room.game.winner && !room.lesson) { // a partita in corso il posto passa al computer, così nessuno resta bloccato
        p.left = true;
        p.isBot = true;
        log(room, `${p.name} lascia il tavolo: al suo posto gioca il computer`);
        if (![...room.players.values()].some((x) => !x.isBot)) closeRoom(room); // non resta nessuna persona
      }
      if (!room.game) {
        room.players.delete(p.id);
        room.order = room.order.filter((x) => x !== p.id);
        if (room.host === p.id) room.host = room.order.find((x) => !room.players.get(x).isBot) || null;
      if (!room.host) rooms.delete(room.code); // restano solo computer: il tavolo si chiude
      }
      send(ws, { t: 'autoLeft' });
    }
  } catch (e) {
    if (!(e instanceof RuleError)) console.error(e);
    send(ws, { t: 'error', msg: e.message, code: e.code });
  }
  broadcast(room);
  scheduleBots(room);
}

// Può fare qualcosa adesso? Una carta da giocare o un'abilità da attivare (le abilità di mana da sole non contano)
function canAct(g, pid) {
  const me = buildView(g, pid).players.find((p) => p.id === pid);
  if ([...(me.hand || []), ...me.command].some((o) => o.playable?.ok)) return true;
  return me.battlefield.some((o) => (o.abilities || []).some((a) => a.kind !== 'mana' && a.playable?.ok));
}

// La mossa automatica di un giocatore umano in questo momento, se ce n'è una (si disattiva dal gioco; nelle lezioni dell'Accademia si passa sempre a mano)
function automaticMove(room, pid) {
  const p = room.players.get(pid);
  const g = room.game;
  if (room.lesson || !p || p.isBot) return null;
  if (g.decision) return autoAnswer(g, pid, p);
  return shouldAutoPass(g, pid, p, () => canAct(g, pid)) ? { type: 'pass' } : null;
}

// Le modalità "passa il turno" e "fino a una risposta" finiscono da sole: il pulsante deve aggiornarsi
function refreshPassModes(room) {
  let changed = false;
  for (const p of room.players.values()) {
    if (!p.passMode) continue;
    const next = nextPassMode(room.game, p.id, p, () => canAct(room.game, p.id));
    if (next !== p.passMode) {
      p.passMode = next;
      changed = true;
    }
  }
  if (changed) broadcast(room);
}

// I giocatori computer muovono uno alla volta, con una breve pausa perché si veda che cosa fanno
function scheduleBots(room) {
  armIdleTimer(room);
  if (room.botTimer || !room.game || room.game.winner) return;
  if (!room.sockets.size) return; // nessuno guarda: la partita aspetta, riprende quando qualcuno rientra
  const g = room.game;
  refreshPassModes(room);
  const who = g.decision ? g.decision.player : g.priority;
  if (who && automaticMove(room, who)) {
    room.botTimer = setTimeout(() => {
      room.botTimer = null;
      if (!rooms.has(room.code) || room.game !== g || g.winner) return;
      const move = (g.decision ? g.decision.player : g.priority) === who ? automaticMove(room, who) : null;
      if (move) {
        g.perform(who, move);
        narrate(room);
        broadcast(room);
      }
      scheduleBots(room);
    }, AUTO_PASS_DELAY);
    return;
  }
  if (!who || !room.players.get(who)?.isBot) return;
  const move = botMove(g, who);
  const delay = move.type === 'pass' ? BOT_PASS_DELAY : BOT_ACTION_DELAY;
  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    if (!rooms.has(room.code) || room.game !== g || g.winner) return;
    const current = g.decision ? g.decision.player : g.priority;
    if (current !== who) return scheduleBots(room);
    const next = botMove(g, who); // lo stato potrebbe essere cambiato durante l'attesa
    const text = describeAction(room, who, next);
    try {
      g.perform(who, next);
    } catch (e) {
      if (!(e instanceof RuleError)) console.error(e);
      if (!g.decision) g.perform(who, { type: 'pass' });
    }
    if (text) log(room, text);
    narrate(room);
    if (g.winner) log(room, `${nameOf(room, g.winner)} vince la partita!`);
    broadcast(room);
    scheduleBots(room);
  }, delay);
}

function disconnect(ws) {
  const room = ws.autoRoom;
  if (!room) return;
  room.sockets.delete(ws);
  const p = room.players.get(ws.pid);
  if (p && ![...room.sockets].some((s) => s.pid === p.id)) {
    p.connected = false;
    if (!room.game && room.host === p.id) { // in sala d'attesa il tavolo passa a chi è ancora collegato
      const heir = room.order.find((pid) => !room.players.get(pid).isBot && room.players.get(pid).connected);
      if (heir) {
        room.host = heir;
        log(room, `${p.name} si è scollegato: ora il tavolo lo gestisce ${nameOf(room, heir)}`);
      }
    }
    broadcast(room);
    scheduleBots(room);
  }
}

function closeRoom(room) {
  clearTimeout(room.botTimer);
  clearTimeout(room.idleTimer);
  rooms.delete(room.code);
  for (const ws of room.sockets) {
    ws.autoRoom = null;
    send(ws, { t: 'tableClosed' });
  }
}

function listTables() {
  return [...rooms.values()].filter((room) => !room.lesson).map((room) => {
    const online = new Set([...room.sockets].map((ws) => ws.pid));
    return {
      mode: 'auto', code: room.code, started: Boolean(room.game),
      players: room.order.map((pid) => ({ name: room.players.get(pid).name, bot: Boolean(room.players.get(pid).isBot), connected: online.has(pid) })),
    };
  });
}

function closeTable(code) {
  const room = rooms.get(code);
  if (room) closeRoom(room);
  return Boolean(room);
}

// Solo per i test: chiude la partita di un tavolo con un vincitore
function endGameForTest(code, winner) {
  rooms.get(code).game.winner = winner;
}

module.exports = { handle, disconnect, endGameForTest, listTables, closeTable, sweep: () => sweepRooms(rooms, closeRoom), isAutoMessage: (msg) => /^(auto|lesson)/.test(String(msg.t || '')) };
