// Password di accesso facoltativa: con TAVOLO_PASSWORD impostata, sito, API e WebSocket richiedono il login.
// Il login lascia un cookie che vale finché la password non cambia.
const crypto = require('crypto');

const COOKIE = 'tavolo_auth';
const ONE_YEAR = 365 * 24 * 3600;
// Icone e manifest restano pubblici, così il browser può proporre l'installazione dell'app anche prima del login
const PUBLIC_PATHS = ['/manifest.webmanifest', '/login'];

function createAuth(password) {
  const enabled = Boolean(password);
  const token = enabled ? crypto.createHmac('sha256', password).update('tavolo-commander').digest('hex') : '';
  const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();

  function cookies(req) {
    const out = {};
    for (const part of String(req.headers.cookie || '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
  }

  function isAuthorized(req) {
    if (!enabled) return true;
    const given = cookies(req)[COOKIE];
    return Boolean(given) && crypto.timingSafeEqual(digest(given), digest(token));
  }

  function isPublic(pathname) {
    return PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/icons/');
  }

  function checkPassword(given) {
    return enabled && crypto.timingSafeEqual(digest(given), digest(password));
  }

  function loginCookie(req) {
    const https = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
    return `${COOKIE}=${token}; Path=/; Max-Age=${ONE_YEAR}; HttpOnly; SameSite=Lax${https ? '; Secure' : ''}`;
  }

  return { enabled, isAuthorized, isPublic, checkPassword, loginCookie };
}

function loginPage(error = '') {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tavolo Commander</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/icon.svg">
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #14161c; color: #e8e8ec; font: 16px system-ui, sans-serif; }
  form { width: min(320px, calc(100vw - 32px)); display: grid; gap: 12px; }
  h1 { margin: 0 0 8px; font-size: 1.4rem; text-align: center; }
  input, button { font: inherit; padding: 10px 12px; border-radius: 8px; border: 1px solid #3a3e4a; }
  input { background: #1e2129; color: inherit; }
  button { background: #4f8fe0; border-color: #4f8fe0; color: #fff; cursor: pointer; }
  p { margin: 0; color: #e05252; text-align: center; }
</style>
</head>
<body>
<form method="post" action="/login">
  <h1>Tavolo Commander</h1>
  <input type="password" name="password" placeholder="Password del tavolo" autocomplete="current-password" autofocus required>
  <button type="submit">Entra</button>
  ${error ? `<p>${error}</p>` : ''}
</form>
</body>
</html>`;
}

module.exports = { createAuth, loginPage };
