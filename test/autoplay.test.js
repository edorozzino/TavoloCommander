// Tavolo con regole automatiche lato server: lobby, avvio, viste separate, azioni legali e rifiutate
const { test } = require('node:test');
const assert = require('node:assert/strict');
const autoplay = require('../autoplay');

function fakeSocket() {
  return { OPEN: 1, readyState: 1, sent: [], send(m) { this.sent.push(JSON.parse(m)); }, last(t) { return this.sent.filter((x) => x.t === t).at(-1); } };
}

async function table(room) {
  const a = fakeSocket();
  const b = fakeSocket();
  await autoplay.handle(a, { t: 'autoJoin', room, name: 'Anna' });
  await autoplay.handle(b, { t: 'autoJoin', room, name: 'Bruno' });
  await autoplay.handle(a, { t: 'autoDeck', deckId: 'starter-0' });
  await autoplay.handle(b, { t: 'autoDeck', deckId: 'starter-1' });
  return { a, b };
}

// Tutti i giocatori umani tengono la mano; i computer rispondono da soli dopo una breve pausa
async function keepHands(...sockets) {
  for (let i = 0; i < 300; i++) { // il computer può fare più mulligan, ognuno con le sue pause
    const views = sockets.map((s) => s.last('autoState').game);
    if (views[0].step !== 'mulligan') return;
    const turn = sockets.find((s, j) => views[j].decision?.player === views[j].me);
    if (turn) await autoplay.handle(turn, { t: 'autoAct', action: { type: 'confirm', yes: false } });
    else await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('il mulligan non si è concluso');
}

test('due giocatori scelgono un mazzo iniziale e chi ha creato il tavolo avvia la partita', async () => {
  const { a, b } = await table('t-start');
  await autoplay.handle(b, { t: 'autoStart' });
  assert.equal(b.last('error').code, 'NOT_HOST');
  await autoplay.handle(a, { t: 'autoStart' });
  const view = a.last('autoState').game;
  assert.equal(view.players.length, 2);
  assert.equal(view.players.find((p) => p.id === view.me).hand.length, 7);
  assert.equal(view.players.find((p) => p.id !== view.me).hand, null);
});

test('un mazzo inesistente non si può scegliere', async () => {
  const a = fakeSocket();
  await autoplay.handle(a, { t: 'autoJoin', room: 't-deck', name: 'Anna' });
  const decks = a.last('autoState').decks;
  assert.ok(decks.some((d) => d.id === 'starter-3' && d.ok));
  await autoplay.handle(a, { t: 'autoDeck', deckId: 'inesistente' });
  assert.equal(a.last('error').code, 'NO_DECK');
});

test("un'azione illegale è rifiutata con il motivo; una legale fa avanzare la partita e finisce nel registro", async () => {
  const { a, b } = await table('t-act');
  await autoplay.handle(a, { t: 'autoStart' });
  await keepHands(a, b);
  const v = a.last('autoState').game;
  const active = v.active === v.me ? a : b;
  const other = active === a ? b : a;
  await autoplay.handle(other, { t: 'autoAct', action: { type: 'pass' } });
  assert.equal(other.last('error').code, 'NO_PRIORITY');
  await autoplay.handle(active, { t: 'autoAct', action: { type: 'pass' } });
  assert.notEqual(active.last('autoState').game.priority, v.priority);
});

test('chi ha creato il tavolo aggiunge un giocatore computer, che gioca da solo quando tocca a lui', async () => {
  const a = fakeSocket();
  await autoplay.handle(a, { t: 'autoJoin', room: 't-bot', name: 'Anna' });
  await autoplay.handle(a, { t: 'autoDeck', deckId: 'starter-0' });
  await autoplay.handle(a, { t: 'autoAddBot', deckId: 'starter-2' });
  const lobby = a.last('autoState').lobby;
  assert.equal(lobby.players.length, 2);
  assert.equal(lobby.players[1].bot, true);
  await autoplay.handle(a, { t: 'autoStart' });
  await keepHands(a);
  const g = a.last('autoState').game;
  assert.equal(g.players.length, 2);
  // Anna passa finché non tocca al computer, poi il computer risponde da solo dopo una breve pausa
  for (let i = 0; i < 20 && a.last('autoState').game.priority === g.me; i++) await autoplay.handle(a, { t: 'autoAct', action: { type: 'pass' } });
  const before = a.sent.length;
  await new Promise((r) => setTimeout(r, 1500));
  assert.ok(a.sent.length > before, 'il computer ha mosso e la vista è stata aggiornata');
  await autoplay.handle(a, { t: 'autoLeave' });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const canPlaySomething = (view) => {
  const me = view.players.find((p) => p.id === view.me);
  return [...(me.hand || []), ...me.command].some((o) => o.playable?.ok)
    || me.battlefield.some((o) => (o.abilities || []).some((a) => a.kind !== 'mana' && a.playable?.ok));
};
// nelle proprie fasi principali a Pila vuota il gioco aspetta sempre, anche senza niente da giocare
const myMainPhase = (view) => view.active === view.me && ['main1', 'main2'].includes(view.step) && !view.stack.length;
const mustWait = (view) => canPlaySomething(view) || myMainPhase(view);

test('come in Arena, chi ha la priorità ma non può fare niente passa da solo: nessuno resta ad aspettare un clic', async () => {
  const { a, b } = await table('t-autopass');
  await autoplay.handle(a, { t: 'autoStart' });
  assert.equal(a.last('autoState').autoPass, true);
  for (let i = 0; i < 40; i++) {
    await sleep(100);
    const g = a.last('autoState').game;
    if (g.decision) break;
    const holder = g.priority === g.me ? a : b;
    const view = holder.last('autoState').game;
    if (view.priority === view.me && mustWait(view)) break;
  }
  const g = a.last('autoState').game;
  const holder = g.priority === g.me ? a : b;
  assert.ok(g.decision || mustWait(holder.last('autoState').game), `fermi a ${g.step} con la priorità a chi non può fare niente`);
});

test('con il passaggio automatico disattivato la priorità resta a chi ce l’ha finché non preme Passa', async () => {
  const { a, b } = await table('t-manual');
  await autoplay.handle(a, { t: 'autoPass', on: false });
  await autoplay.handle(b, { t: 'autoPass', on: false });
  await autoplay.handle(a, { t: 'autoStart' });
  const before = a.last('autoState').game;
  assert.equal(a.last('autoState').autoPass, false);
  await sleep(700);
  const after = a.last('autoState').game;
  assert.equal(after.step, before.step);
  assert.equal(after.priority, before.priority);
});

test('con un account si rientra nel proprio posto, senza sedersi due volte', async () => {
  const first = { ...fakeSocket(), user: { id: 'u1' } };
  await autoplay.handle(first, { t: 'autoJoin', room: 'posto-unico', name: 'Luca' });
  const seat = first.last('autoJoined').pid;
  const again = { ...fakeSocket(), user: { id: 'u1' } };
  await autoplay.handle(again, { t: 'autoJoin', room: 'posto-unico', name: 'Luca' });
  assert.equal(again.last('autoJoined').pid, seat);
  assert.equal(again.last('autoState').lobby.players.length, 1);
});

test('due account diversi occupano due posti; senza account si resta distinti', async () => {
  const a = { ...fakeSocket(), user: { id: 'u1' } };
  const b = { ...fakeSocket(), user: { id: 'u2' } };
  await autoplay.handle(a, { t: 'autoJoin', room: 'posti-due', name: 'Luca' });
  await autoplay.handle(b, { t: 'autoJoin', room: 'posti-due', name: 'Marco' });
  assert.notEqual(a.last('autoJoined').pid, b.last('autoJoined').pid);
  const c = fakeSocket();
  const d = fakeSocket();
  await autoplay.handle(c, { t: 'autoJoin', room: 'senza-account', name: 'Anna' });
  await autoplay.handle(d, { t: 'autoJoin', room: 'senza-account', name: 'Anna' });
  assert.notEqual(c.last('autoJoined').pid, d.last('autoJoined').pid);
});

test('Passa il turno arriva da solo fino al turno successivo e poi si spegne', async () => {
  const { a, b } = await table('passa-turno');
  await autoplay.handle(a, { t: 'autoStart' });
  await keepHands(a, b);
  const start = a.last('autoState').game;
  const active = start.active === start.me ? a : b;
  await autoplay.handle(active, { t: 'autoPassMode', mode: 'turn' });
  assert.equal(active.last('autoState').passMode, 'turn');
  for (let i = 0; i < 200 && active.last('autoState').game.turn === start.turn; i++) await new Promise((r) => setTimeout(r, 100));
  assert.equal(active.last('autoState').game.turn, start.turn + 1);
  assert.equal(active.last('autoState').passMode, null);
});

test('un doppio tocco su Avvia fa partire una sola partita', async () => {
  const { a } = await table('doppio-avvio');
  await Promise.all([autoplay.handle(a, { t: 'autoStart' }), autoplay.handle(a, { t: 'autoStart' })]);
  assert.equal(a.last('autoState').log.filter((l) => l.text.startsWith('La partita comincia')).length, 1);
});

test('se chi ha creato il tavolo si scollega in sala, il tavolo passa a un altro', async () => {
  const { a, b } = await table('erede');
  a.pid = a.last('autoJoined').pid;
  autoplay.disconnect(a);
  assert.equal(b.last('autoState').lobby.host, b.last('autoJoined').pid);
  await autoplay.handle(b, { t: 'autoStart' });
  assert.ok(b.last('autoState').game);
});

test('chi lascia a partita in corso viene sostituito dal computer e può rientrare', async () => {
  const { a, b } = await table('abbandono');
  await autoplay.handle(a, { t: 'autoStart' });
  const { pid: seat, key } = b.last('autoJoined');
  await autoplay.handle(b, { t: 'autoLeave' });
  const left = () => a.last('autoState').lobby.players.find((p) => p.id === seat);
  assert.equal(left().bot, true);
  await keepHands(a); // il computer risponde al mulligan al posto di chi è uscito
  assert.notEqual(a.last('autoState').game.step, 'mulligan');
  const back = fakeSocket();
  await autoplay.handle(back, { t: 'autoJoin', room: 'abbandono', pid: seat, key });
  assert.equal(left().bot, false);
});

test('il tempo per mossa lo sceglie solo chi ha creato il tavolo', async () => {
  const { a, b } = await table('tempo');
  await autoplay.handle(b, { t: 'autoTimer', seconds: 60 });
  assert.equal(a.last('autoState').lobby.moveLimit, 0);
  await autoplay.handle(a, { t: 'autoTimer', seconds: 60 });
  assert.equal(a.last('autoState').lobby.moveLimit, 60);
  await autoplay.handle(a, { t: 'autoTimer', seconds: 7 });
  assert.equal(a.last('autoState').lobby.moveLimit, 0);
});

test('il posto di un altro non si prende conoscendone solo l\'identificativo', async () => {
  const { a, b } = await table('posto-sicuro');
  const victim = a.last('autoJoined').pid;
  const thief = fakeSocket();
  await autoplay.handle(thief, { t: 'autoJoin', room: 'posto-sicuro', pid: victim, name: 'Ladro' });
  assert.notEqual(thief.last('autoJoined').pid, victim);
  const wrongKey = fakeSocket();
  await autoplay.handle(wrongKey, { t: 'autoJoin', room: 'posto-sicuro', pid: victim, key: b.last('autoJoined').key });
  assert.notEqual(wrongKey.last('autoJoined').pid, victim);
});

test('con un account il posto altrui resta protetto anche con la chiave giusta', async () => {
  const a = { ...fakeSocket(), user: { id: 'u1' } };
  await autoplay.handle(a, { t: 'autoJoin', room: 'posto-account', name: 'Luca' });
  const { pid, key } = a.last('autoJoined');
  const other = { ...fakeSocket(), user: { id: 'u2' } };
  await autoplay.handle(other, { t: 'autoJoin', room: 'posto-account', pid, key, name: 'Marco' });
  assert.notEqual(other.last('autoJoined').pid, pid);
});

test('il posto di un giocatore computer non si può occupare', async () => {
  const a = fakeSocket();
  await autoplay.handle(a, { t: 'autoJoin', room: 'posto-bot', name: 'Anna' });
  await autoplay.handle(a, { t: 'autoAddBot' });
  const bot = a.last('autoState').lobby.players.find((p) => p.bot).id;
  const thief = fakeSocket();
  await autoplay.handle(thief, { t: 'autoJoin', room: 'posto-bot', pid: bot, name: 'Ladro' });
  assert.notEqual(thief.last('autoJoined').pid, bot);
});

test('la partita non parte finché un giocatore collegato non ha scelto il mazzo', async () => {
  const { a } = await table('senza-mazzo');
  const c = fakeSocket();
  await autoplay.handle(c, { t: 'autoJoin', room: 'senza-mazzo', name: 'Carla' });
  await autoplay.handle(a, { t: 'autoStart' });
  assert.match(a.last('error').msg, /Carla/);
  assert.equal(a.last('autoState').game, undefined);
});

test('chi è scollegato e senza mazzo perde il posto all\'avvio', async () => {
  const { a } = await table('senza-mazzo-via');
  const c = fakeSocket();
  await autoplay.handle(c, { t: 'autoJoin', room: 'senza-mazzo-via', name: 'Carla' });
  c.pid = c.last('autoJoined').pid;
  autoplay.disconnect(c);
  await autoplay.handle(a, { t: 'autoStart' });
  assert.equal(a.last('autoState').game.players.length, 2);
  assert.equal(a.last('autoState').lobby.players.length, 2);
});

test('dopo la fine si torna in sala con gli stessi mazzi per la rivincita', async () => {
  const { a, b } = await table('rivincita');
  await autoplay.handle(a, { t: 'autoRematch' }); // senza partita finita non succede nulla
  await autoplay.handle(a, { t: 'autoStart' });
  await autoplay.handle(b, { t: 'autoRematch' });
  assert.ok(a.last('autoState').game, 'a partita in corso la rivincita è ignorata');
  autoplay.endGameForTest('rivincita', a.last('autoJoined').pid);
  await autoplay.handle(b, { t: 'autoRematch' });
  const lobby = a.last('autoState').lobby;
  assert.equal(a.last('autoState').game, undefined);
  assert.deepEqual(lobby.players.map((p) => p.deckName != null), [true, true]);
  await autoplay.handle(a, { t: 'autoStart' });
  assert.ok(a.last('autoState').game);
});
