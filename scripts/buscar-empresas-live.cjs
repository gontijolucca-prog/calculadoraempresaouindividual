/**
 * Vigia do login no estudo360.pt (BrowserOS) — CDP puro (sem Playwright).
 * Lê o token do Firebase do indexedDB e faz fetch ao Firestore DENTRO da página
 * (CORS OK) → grava public/import-empresas.json.
 */
const fs = require('fs');
const API_KEY = 'AIzaSyBxc-JFWwxlauY6U4A3IKTxxd5UFiDzjhI';
const PROJECT = 'recofatima-ferramenta';
const OUT = '/Users/lucca/Documents/GitHub/calculadoraempresaouindividual/public/import-empresas.json';
const LOG = '/tmp/login-vigia.log';
function log(m) { console.log(m); fs.appendFileSync(LOG, m + '\n'); }

const CDP = 'http://localhost:9223';

async function listTabs() {
  const res = await fetch(CDP + '/json');
  return res.json();
}

function cdp(ws, method, params) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1e9);
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) { ws.removeEventListener('message', onMsg); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
}

async function evaluate(ws, expr) {
  const r = await cdp(ws, 'Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'evaluate error');
  return r.result.value;
}

(async () => {
  fs.writeFileSync(LOG, '');
  let tabs = await listTabs();
  let target = tabs.find((t) => t.type === 'page' && t.url.includes('estudo360'));
  if (!target) {
    const r = await fetch(CDP + '/json/new?url=' + encodeURIComponent('https://estudo360.pt'), { method: 'PUT' });
    target = await r.json();
    await new Promise((r) => setTimeout(r, 6000));
  }
  log('Tab: ' + target.url);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  await cdp(ws, 'Runtime.enable', {});
  // garantir que a tab está no estudo360.pt
  if (!target.url || target.url === 'about:blank') {
    await cdp(ws, 'Page.enable', {});
    await cdp(ws, 'Page.navigate', { url: 'https://estudo360.pt' });
    await new Promise((r) => setTimeout(r, 7000));
  }

  // esperar login (token no indexedDB)
  log('⏳ À espera do teu login (clica Entrar → Google → a tua conta)…');
  const TOKEN_EXPR = `(async () => {
    try {
      const db = await new Promise((res) => { const r = indexedDB.open('firebaseLocalStorageDb'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
      if (!db) return null;
      const tx = db.transaction('firebaseLocalStorage', 'readonly');
      const store = tx.objectStore('firebaseLocalStorage');
      const keys = await new Promise((res) => { const k = store.getAllKeys(); k.onsuccess = () => res(k.result); });
      for (const key of keys) {
        const val = await new Promise((res) => { const g = store.get(key); g.onsuccess = () => res(g.result); });
        const s = JSON.stringify(val || {});
        if (s.includes('stsTokenManager') && s.includes('accessToken')) {
          try {
            const v = JSON.parse(s);
            const tok = v && v.value && v.value.stsTokenManager ? v.value.stsTokenManager.accessToken : (v && v.stsTokenManager ? v.stsTokenManager.accessToken : null);
            if (tok && tok.length > 50) return tok;
          } catch {}
        }
      }
      return null;
    } catch { return null; }
  })()`;

  let token = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 5 * 60 * 1000) {
    token = await evaluate(ws, TOKEN_EXPR).catch(() => null);
    if (token) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
  if (!token) { log('❌ Login não detetado em 5 min.'); ws.close(); process.exit(1); }
  log('✅ Login detetado — token obtido.');

  // ler o Firestore DENTRO da página (CORS OK com key + token)
  const FETCH_EXPR = `(async () => {
    const token = ${JSON.stringify(token)};
    const url = 'https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/empresas?key=${API_KEY}';
    const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    return { status: res.status, body: await res.json() };
  })()`;
  const result = await evaluate(ws, FETCH_EXPR);
  log('Firestore HTTP: ' + result.status);
  const data = result.body;
  const docs = (data && data.documents) || [];

  const registos = [];
  const mapFields = (m) => {
    const out = {};
    for (const k of Object.keys(m || {})) {
      const v = m[k];
      if (v && typeof v === 'object') {
        if ('stringValue' in v) out[k] = v.stringValue;
        else if ('integerValue' in v) out[k] = Number(v.integerValue);
        else if ('booleanValue' in v) out[k] = v.booleanValue;
        else if ('doubleValue' in v) out[k] = Number(v.doubleValue);
        else if ('mapValue' in v) out[k] = mapFields(v.mapValue.fields);
        else if ('arrayValue' in v) out[k] = (v.arrayValue.values || []).map(mapFields);
        else out[k] = v;
      } else out[k] = v;
    }
    return out;
  };
  for (const d of docs) {
    const list = (d.fields && d.fields.list && d.fields.list.arrayValue) ? (d.fields.list.arrayValue.values || []) : [];
    const recs = list.map(mapFields);
    registos.push(...recs);
    log('  doc ' + String(d.name).split('/').pop() + ': ' + recs.length + ' empresas');
  }
  log('Total de registos de empresas: ' + registos.length);

  if (registos.length === 0) { log('⚠ Sem empresas no Firestore (login OK).'); ws.close(); process.exit(2); }

  fs.writeFileSync(OUT, JSON.stringify({ _nota: 'Empresas REAIS importadas do Firestore — ' + new Date().toISOString(), list: registos }, null, 2));
  log('✅ Gravado: public/import-empresas.json (' + registos.length + ' empresas)');
  ws.close();
  process.exit(0);
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
