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
