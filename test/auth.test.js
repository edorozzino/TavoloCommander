// Password di accesso al server (TAVOLO_PASSWORD)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createAuth } = require('../auth');

const req = (cookie, extra = {}) => ({ headers: { cookie, ...extra }, socket: {} });

test('senza password l\'accesso è libero', () => {
  const auth = createAuth('');
  assert.equal(auth.enabled, false);
  assert.ok(auth.isAuthorized(req()));
  assert.equal(auth.checkPassword(''), false);
});

test('con password serve il cookie rilasciato dal login', () => {
  const auth = createAuth('segreta');
  assert.ok(auth.checkPassword('segreta'));
  assert.ok(!auth.checkPassword('sbagliata'));
  assert.ok(!auth.isAuthorized(req()));
  assert.ok(!auth.isAuthorized(req('tavolo_auth=falso')));
  const cookie = auth.loginCookie(req()).split(';')[0];
  assert.ok(auth.isAuthorized(req(`altro=1; ${cookie}`)));
});

test('cambiando password i vecchi cookie non valgono più', () => {
  const cookie = createAuth('vecchia').loginCookie(req()).split(';')[0];
  assert.ok(!createAuth('nuova').isAuthorized(req(cookie)));
});

test('il cookie è Secure solo in HTTPS (anche dietro Tailscale)', () => {
  const auth = createAuth('segreta');
  assert.ok(!auth.loginCookie(req()).includes('Secure'));
  assert.ok(auth.loginCookie(req('', { 'x-forwarded-proto': 'https' })).includes('Secure'));
});

test('icone e manifest restano pubblici, il resto no', () => {
  const auth = createAuth('segreta');
  assert.ok(auth.isPublic('/icons/icon-192.png'));
  assert.ok(auth.isPublic('/manifest.webmanifest'));
  assert.ok(!auth.isPublic('/'));
  assert.ok(!auth.isPublic('/api/decks'));
  assert.ok(!auth.isPublic('/app.js'));
});

test('la password generata è fatta di tre parole e un numero, diversa a ogni avvio', () => {
  const { generatePassword } = require('../auth');
  const a = generatePassword();
  assert.match(a, /^[a-z]+-[a-z]+-[a-z]+-\d{2}$/);
  const seen = new Set(Array.from({ length: 50 }, generatePassword));
  assert.ok(seen.size > 45);
});

test('dopo troppi tentativi sbagliati il login si blocca per qualche minuto, anche con la password giusta', () => {
  const auth = createAuth('segreta');
  const t0 = 1_000_000;
  for (let i = 0; i < 19; i++) assert.equal(auth.attempt('no', t0 + i), 'wrong');
  assert.equal(auth.attempt('segreta', t0 + 20), 'ok');
  assert.equal(auth.attempt('no', t0 + 21), 'wrong'); // ventesimo errore
  assert.equal(auth.attempt('segreta', t0 + 22), 'locked');
  assert.equal(auth.attempt('segreta', t0 + 10 * 60 * 1000 + 22), 'ok');
});

test('gli errori vecchi non contano per il blocco', () => {
  const auth = createAuth('segreta');
  for (let i = 0; i < 19; i++) auth.attempt('no', i);
  assert.equal(auth.attempt('no', 11 * 60 * 1000), 'wrong');
  assert.equal(auth.attempt('segreta', 11 * 60 * 1000 + 1), 'ok');
});
