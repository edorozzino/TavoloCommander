// Accesso su invito: link monouso, sessioni revocabili, permessi per ruolo
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createAccounts, createAccountAuth, canCreateDeck, canEditDeck, INVITE_LINK } = require('../accounts');

let clock, store, accounts;
const HOUR = 3600 * 1000;

beforeEach(() => {
  clock = 1000;
  store = { value: { users: {}, sessions: {}, invites: {} }, saves: 0, save() { this.saves++; } };
  accounts = createAccounts({ store, now: () => clock });
});

const join = (name = 'Luca', role = 'player') => accounts.redeem(accounts.createInvite(role).token, name);
const reqWith = (cookie) => ({ headers: { cookie }, socket: {} });

test('l\'invito crea un utente con il ruolo scelto e lo tiene collegato', () => {
  const { user, session } = join('Luca', 'guest');
  assert.equal(user.role, 'guest');
  assert.equal(accounts.userForSession(session).name, 'Luca');
});

test('un link vale una volta sola', () => {
  const { token } = accounts.createInvite('player');
  accounts.redeem(token, 'Luca');
  assert.equal(accounts.isInviteValid(token), false);
  assert.throws(() => accounts.redeem(token, 'Marco'), (e) => e.code === 'INVITE_INVALID');
});

test('controllare un link non lo consuma (anteprime di WhatsApp)', () => {
  const { token } = accounts.createInvite('player');
  assert.ok(accounts.isInviteValid(token));
  assert.ok(accounts.isInviteValid(token));
  assert.equal(accounts.redeem(token, 'Luca').user.name, 'Luca');
});

test('un link scade dopo 48 ore', () => {
  const { token } = accounts.createInvite('player');
  clock += 48 * HOUR - 1;
  assert.ok(accounts.isInviteValid(token));
  clock += 1;
  assert.equal(accounts.isInviteValid(token), false);
});

test('un nome già in uso non consuma il link e si può riprovare', () => {
  join('Luca');
  const { token } = accounts.createInvite('player');
  assert.throws(() => accounts.redeem(token, 'luca'), (e) => e.code === 'NAME_TAKEN');
  assert.throws(() => accounts.redeem(token, 'Admin'), (e) => e.code === 'NAME_TAKEN');
  assert.equal(accounts.redeem(token, 'Marco').user.name, 'Marco');
});

test('non si può creare un invito da admin', () => {
  assert.throws(() => accounts.createInvite('admin'), (e) => e.code === 'BAD_ROLE');
});

test('un invito annullato non funziona più', () => {
  const { id, token } = accounts.createInvite('player');
  assert.ok(accounts.cancelInvite(id));
  assert.equal(accounts.isInviteValid(token), false);
});

test('revocare una persona chiude tutte le sue sessioni', () => {
  const { user, session } = join();
  assert.ok(accounts.removeUser(user.id));
  assert.equal(accounts.userForSession(session), null);
  assert.deepEqual(store.value.sessions, {});
});

test('il cambio di ruolo vale subito', () => {
  const { user, session } = join();
  accounts.setRole(user.id, 'guest');
  assert.equal(accounts.userForSession(session).role, 'guest');
  assert.throws(() => accounts.setRole(user.id, 'admin'), (e) => e.code === 'BAD_ROLE');
});

test('nell\'archivio non restano link né sessioni in chiaro', () => {
  const { token } = accounts.createInvite('player');
  const other = accounts.createInvite('guest');
  const { session } = accounts.redeem(token, 'Luca');
  const saved = JSON.stringify(store.value);
  assert.ok(!saved.includes(token) && !saved.includes(session) && !saved.includes(other.token));
});

test('permessi sui mazzi', () => {
  const admin = { id: 'admin', role: 'admin' };
  const player = { id: 'p1', role: 'player' };
  const guest = { id: 'g1', role: 'guest' };
  const mine = { owner: 'p1' };
  const theirs = { owner: 'p2' };
  const legacy = { owner: null };
  assert.ok(canCreateDeck(player) && canCreateDeck(admin));
  assert.equal(canCreateDeck(guest), false);
  assert.ok(canEditDeck(player, mine));
  assert.equal(canEditDeck(player, theirs), false);
  assert.equal(canEditDeck(player, legacy), false);
  assert.equal(canEditDeck(guest, { owner: 'g1' }), false);
  assert.ok(canEditDeck(admin, theirs) && canEditDeck(admin, legacy));
  assert.ok(canCreateDeck(null) && canEditDeck(null, theirs)); // senza account, come prima
});

test('l\'admin entra con la password, gli altri con la sessione; i cookie falsi no', () => {
  const auth = createAccountAuth('segreta', accounts);
  const { session } = join();
  const adminCookie = auth.loginCookie({ headers: {}, socket: {} }).split(';')[0];
  assert.equal(auth.user(reqWith(adminCookie)).role, 'admin');
  assert.equal(auth.user(reqWith(`tavolo_session=${session}`)).name, 'Luca');
  assert.equal(auth.isAuthorized(reqWith('tavolo_session=falso')), false);
  assert.equal(auth.isAuthorized(reqWith('')), false);
  assert.ok(auth.isPublic(`/invito/${'a'.repeat(64)}`));
  assert.equal(auth.isPublic('/admin'), false);
});

test('riconosce il link incollato nella pagina di ingresso', () => {
  const token = 'b'.repeat(64);
  assert.equal(`Ecco: https://x.onrender.com/invito/${token}`.match(INVITE_LINK)[1], token);
  assert.equal('una-password'.match(INVITE_LINK), null);
});
