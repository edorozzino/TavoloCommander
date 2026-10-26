// Pubblica il server con Tailscale: `tailscale serve` solo per i membri della propria rete,
// `tailscale funnel` per chiunque su internet (in entrambi i casi HTTPS con certificato vero).
const { spawn } = require('child_process');
const fs = require('fs');

const MAC_CLI = '/Applications/Tailscale.app/Contents/MacOS/Tailscale';
const CLI = process.platform === 'darwin' && fs.existsSync(MAC_CLI) ? MAC_CLI : 'tailscale';

// Esegue la CLI mostrando a schermo quello che scrive (per esempio il link per attivare Serve) e restituisce l'output
function run(args, { echo = false } = {}) {
  return new Promise((resolve) => {
    let out = '';
    let child;
    try {
      child = spawn(CLI, args, { windowsHide: true });
    } catch (e) {
      resolve({ code: -1, out: '', error: e });
      return;
    }
    const collect = (chunk) => {
      out += chunk;
      if (echo) process.stdout.write(chunk);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (error) => resolve({ code: -1, out, error }));
    child.on('close', (code) => resolve({ code, out }));
  });
}

async function status() {
  const r = await run(['status', '--json']);
  if (r.error) return { error: r.error };
  try {
    return JSON.parse(r.out);
  } catch {
    return { error: new Error(r.out.trim()) };
  }
}

async function start(port, { funnel = false, password = '' } = {}) {
  const mode = funnel ? 'funnel' : 'serve';
  console.log(funnel ? 'Tailscale Funnel: pubblico il tavolo su internet…' : 'Tailscale: pubblico il tavolo nella tua rete Tailscale…');
  const st = await status();
  if (st.error) {
    if (st.error.code === 'ENOENT') console.log('  Tailscale non è installato: scaricalo da https://tailscale.com/download e fai login.');
    else console.log('  Tailscale non risponde: ' + st.error.message);
    return console.log('  Il tavolo resta raggiungibile solo in rete locale.\n');
  }
  if (st.BackendState !== 'Running') {
    console.log('  Tailscale non è connesso: esegui "tailscale up" (o apri l\'app Tailscale) e riavvia il server.\n');
    return;
  }
  const r = await run([mode, '--bg', String(port)], { echo: true });
  if (r.code !== 0) {
    if (/access denied|permission|sudo/i.test(r.out)) {
      console.log(`  Serve i permessi per usare "tailscale ${mode}". Esegui una volta:`);
      console.log('    sudo tailscale set --operator=$USER');
      console.log('  e poi riavvia il server.');
    }
    return console.log('  Non è stato possibile pubblicare il tavolo su Tailscale.\n');
  }
  const url = 'https://' + (String(st.Self?.DNSName || '').replace(/\.$/, '') || '<nome-pc>.<rete>.ts.net');
  console.log(`\n  Indirizzo del tavolo: ${url}`);
  if (password) {
    console.log('\n  Messaggio da mandare agli amici:\n');
    console.log('    Si gioca a Commander! Apri questo link ed entri subito:');
    console.log(`    ${url}/login?k=${encodeURIComponent(password)}`);
    console.log(`    (se chiede la password: ${password})`);
    if (!funnel) console.log('    Serve Tailscale acceso sul tuo dispositivo.');
  }
  console.log(`\n  Con Ctrl+C la pubblicazione su Tailscale viene tolta.\n`);
}

async function stop(funnel = false) {
  await run([funnel ? 'funnel' : 'serve', '--https=443', 'off']);
}

module.exports = { start, stop };
