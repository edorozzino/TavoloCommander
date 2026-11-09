// Pagine dell'accesso su invito e pannello admin: stanno fuori dal service worker e non dipendono dall'app.
const STYLE = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100dvh; padding: max(16px, env(safe-area-inset-top)) 16px 24px; background: #14161c; color: #e8e8ec; font: 16px system-ui, sans-serif; }
  h1 { margin: 0 0 8px; font-size: 1.4rem; }
  h2 { margin: 24px 0 8px; font-size: 1.05rem; }
  input, button, select { font: inherit; min-height: 44px; padding: 8px 12px; border-radius: 8px; border: 1px solid #3a3e4a; background: #1e2129; color: inherit; }
  button.primary, a.primary { background: #4f8fe0; border-color: #4f8fe0; color: #fff; }
  a { color: #8fb9ee; }
  .muted { color: #a9adb8; font-size: .9rem; }
  .error { color: #e05252; }
`;

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function shell(title, body) {
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/icons/icon.svg">
<style>${STYLE}
  .center { min-height: calc(100dvh - 48px); display: grid; place-items: center; }
  form, .box { width: min(340px, 100%); display: grid; gap: 12px; }
  main { max-width: 640px; margin: 0 auto; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; }
  .row .grow { flex: 1 1 140px; min-width: 0; overflow-wrap: anywhere; }
  #link { width: 100%; }
</style>
</head>
<body>${body}</body>
</html>`;
}

function invitePage(token, error = '') {
  return shell('Invito · Tavolo Commander', `<div class="center"><form method="post" action="/invito/${escapeHtml(token)}">
  <h1>Sei stato invitato!</h1>
  <p class="muted">Scegli il nome con cui giocherai a Tavolo Commander. Resterai collegato su questo dispositivo.</p>
  <input name="name" placeholder="Il tuo nome" maxlength="24" autocomplete="nickname" autofocus required>
  <button class="primary" type="submit">Entra</button>
  ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
</form></div>`);
}

function inviteExpiredPage() {
  return shell('Invito non valido', `<div class="center"><div class="box">
  <h1>Invito non valido</h1>
  <p class="muted">Questo link è già stato usato o è scaduto. Chiedi un nuovo invito a chi gestisce il tavolo.</p>
</div></div>`);
}

function adminPage() {
  return shell('Accessi · Tavolo Commander', `<main>
  <p><a href="/">← Torna al gioco</a></p>
  <h1>Accessi</h1>
  <h2>Nuovo invito</h2>
  <p class="muted">Il link vale per una persona sola e scade dopo 48 ore.</p>
  <div class="row">
    <select id="role" aria-label="Ruolo"><option value="player">Giocatore: gioca e crea mazzi</option><option value="guest">Ospite: gioca soltanto</option></select>
    <button class="primary" id="create">Crea link</button>
  </div>
  <div id="created" hidden>
    <input id="link" readonly aria-label="Link d'invito">
    <div class="row"><button id="copy">Copia</button><a id="wa" target="_blank" rel="noopener">Manda su WhatsApp</a></div>
    <p class="muted">Copialo ora: per sicurezza non potrà più essere mostrato.</p>
  </div>
  <p class="error" id="error" hidden></p>
  <h2>Inviti in attesa</h2><div id="invites"></div>
  <h2>Persone con accesso</h2><div id="users"></div>
  <h2>Tavoli aperti</h2>
  <p class="muted">I tavoli senza nessuno collegato si chiudono da soli dopo 30 minuti.</p>
  <div id="tables"></div>
<script>
const $ = (id) => document.getElementById(id);
const ROLE = { player: 'Giocatore', guest: 'Ospite' };
async function api(path, method = 'GET', body) {
  const res = await fetch('/api/admin/' + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Errore ' + res.status);
  return json;
}
function fail(e) { $('error').hidden = false; $('error').textContent = e.message; }
function button(label, onclick) { const b = document.createElement('button'); b.textContent = label; b.onclick = () => Promise.resolve().then(onclick).catch(fail); return b; }
function row(text, ...controls) {
  const div = document.createElement('div'); div.className = 'row';
  const span = document.createElement('span'); span.className = 'grow'; span.textContent = text;
  div.append(span, ...controls); return div;
}
function empty(text) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = text; return p; }
async function refresh() {
  const s = await api('state');
  $('invites').replaceChildren(...(s.invites.length ? s.invites.map((i) => row(ROLE[i.role] + ' · scade il ' + new Date(i.expires).toLocaleString('it-IT'), button('Annulla', async () => { await api('invites/' + i.id, 'DELETE'); await refresh(); }))) : [empty('Nessun invito in attesa.')]));
  $('users').replaceChildren(...(s.users.length ? s.users.map((u) => {
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Ruolo di ' + u.name);
    for (const [value, label] of Object.entries(ROLE)) select.add(new Option(label, value, false, value === u.role));
    select.onchange = () => api('users/' + u.id, 'PATCH', { role: select.value }).then(refresh).catch(fail);
    return row(u.name, select, button('Revoca', async () => { if (confirm('Togliere l\\'accesso a ' + u.name + '?')) { await api('users/' + u.id, 'DELETE'); await refresh(); } }));
  }) : [empty('Ancora nessuno.')]));
  $('tables').replaceChildren(...(s.tables.length ? s.tables.map((t) => {
    const who = t.players.map((p) => p.name + (p.bot ? ' (computer)' : p.connected ? '' : ' (non collegato)')).join(', ') || 'nessuno';
    return row((t.mode === 'auto' ? 'Regole automatiche' : 'LAN') + ' · ' + t.code + ' · ' + who, button('Chiudi', async () => {
      if (confirm('Chiudere il tavolo ' + t.code + '? La partita in corso andrà persa.')) { await api('tables/' + t.mode + '/' + encodeURIComponent(t.code), 'DELETE'); await refresh(); }
    }));
  }) : [empty('Nessun tavolo aperto.')]));
}
$('create').onclick = () => api('invites', 'POST', { role: $('role').value }).then(async (inv) => {
  const link = location.origin + '/invito/' + inv.token;
  $('link').value = link; $('created').hidden = false; $('error').hidden = true;
  $('wa').href = 'https://wa.me/?text=' + encodeURIComponent('Ti invito a Tavolo Commander: ' + link);
  await refresh();
}).catch(fail);
$('copy').onclick = () => { $('link').select(); navigator.clipboard?.writeText($('link').value); $('copy').textContent = 'Copiato'; };
refresh().catch(fail);
</script>
</main>`);
}

module.exports = { invitePage, inviteExpiredPage, adminPage };
