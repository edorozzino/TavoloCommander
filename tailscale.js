// Pubblica il server nella propria rete Tailscale con `tailscale serve` (HTTPS con certificato vero, solo per i membri della rete).
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

async function start(port) {
  console.log('Tailscale: pubblico il tavolo nella tua rete Tailscale…');
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
  const r = await run(['serve', '--bg', String(port)], { echo: true });
  if (r.code !== 0) {
    if (/access denied|permission|sudo/i.test(r.out)) {
      console.log('  Serve i permessi per usare "tailscale serve". Esegui una volta:');
      console.log('    sudo tailscale set --operator=$USER');
      console.log('  e poi riavvia il server.');
    }
    return console.log('  Non è stato possibile pubblicare il tavolo su Tailscale.\n');
  }
  const host = String(st.Self?.DNSName || '').replace(/\.$/, '');
  console.log(`  Dai PC dei tuoi amici nella rete Tailscale: https://${host || '<nome-pc>.<rete>.ts.net'}`);
  console.log('  Con Ctrl+C la pubblicazione su Tailscale viene tolta.\n');
}

async function stop() {
  await run(['serve', '--https=443', 'off']);
}

module.exports = { start, stop };
