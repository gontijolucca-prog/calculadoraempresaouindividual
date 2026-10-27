/** Remover colaborador: desaparece da equipa e perde acesso (regras). */
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
const stamp = Date.now();
const dono = `dono+${stamp}@estudo360.pt`, func = `func+${stamp}@estudo360.pt`, pass = 'Teste12345!';

const b = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => falhas.push('pageerror: ' + (e.stack || '').split('\n')[0]));
p.on('dialog', (d) => d.accept());

async function verificar(addr) {
  for (let i = 0; i < 10; i++) {
    const r = await fetch('http://127.0.0.1:9199/emulator/v1/projects/demo-estudo360/oobCodes').then((x) => x.json()).catch(() => null);
    const c = r?.oobCodes?.filter((x) => x.email === addr && x.requestType === 'VERIFY_EMAIL').pop();
    if (c?.oobLink) { const v = await fetch(c.oobLink).catch(() => null); if (v?.ok) return true; }
    await p.waitForTimeout(700);
  }
  return false;
}
await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1500);
await p.getByRole('button', { name: /Criar conta/i }).first().click(); await p.waitForTimeout(500);
await p.locator('input[placeholder="O seu nome"]').first().fill('Dono Remover');
await p.locator('input[placeholder="nome@empresa.pt"]').first().fill(dono);
await p.locator('input[type="password"]').first().fill(pass);
await p.getByRole('button', { name: /^Criar conta$/ }).first().click(); await p.waitForTimeout(2300);
ok(await verificar(dono), 'dono criado');
const sair = p.getByRole('button', { name: /Sair/i }).first();
if (await sair.count()) { await sair.click(); await p.waitForTimeout(800); }
await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1300);
const entrar = p.getByRole('button', { name: /^Entrar$/ }).first();
if (await entrar.count()) await entrar.click();
await p.waitForTimeout(500);
await p.locator('input[placeholder="nome@empresa.pt"]').first().fill(dono);
await p.locator('input[type="password"]').first().fill(pass);
await p.getByRole('button', { name: /^Entrar$/ }).last().click(); await p.waitForTimeout(2500);
const criarGab = p.getByRole('button', { name: /^Criar gabinete$/ }).first();
if (await criarGab.count()) {
  await criarGab.click(); await p.waitForTimeout(700);
  await p.locator('input[placeholder*="Silva"]').first().fill('Remover QA');
  await p.locator('input[placeholder="500000000"]').first().fill('509222111');
  await p.getByRole('button', { name: /Criar e entrar/i }).first().click(); await p.waitForTimeout(2800);
}
// Vai direto à tab Equipa (mais estável do que navegar pelo menu).
await p.evaluate(() => {
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'gabinete' }));
  localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: 'equipa' }));
});
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(2600);
const dbg = await p.evaluate(() => ({ txt: document.body.innerText.slice(0, 150).replace(/\n+/g, ' | '), add: Array.from(document.querySelectorAll('button')).filter((b) => /Adicionar funcionário/i.test(b.innerText || '')).length }));
console.log('   [debug]', JSON.stringify(dbg));
const addB = p.getByRole('button', { name: /Adicionar funcionário/i }).first();
if (await addB.count()) await addB.click(); else { falhas.push('sem botão Adicionar funcionário'); }
await p.waitForTimeout(700);
await p.locator('input[placeholder="Nome completo"]:visible').first().fill('Funcionário Remover');
await p.locator('input[placeholder="Email (para login)"]:visible').first().fill(func);
await p.getByRole('button', { name: /Adicionar \(convite pendente\)/i }).filter({ visible: true }).first().click();
await p.waitForTimeout(2200);
const token = await p.evaluate(async () => {
  const g = await import('/src/lib/gabinetes.ts');
  const id = g.getActiveGabineteId(); const meta = id ? await g.getGabineteMeta(id) : null;
  return (meta?.invites || []).filter((i) => i.token).pop()?.token || '';
});
const ctx2 = await b.newContext({ viewport: { width: 420, height: 900 } });
const p2 = await ctx2.newPage();
await p2.goto(BASE + 'convite.html?t=' + token + '&emu=1', { waitUntil: 'load' }); await p2.waitForTimeout(3000);
await p2.locator('#p1').fill('Forte12345'); await p2.locator('#p2').fill('Forte12345'); await p2.locator('#go').click();
await p2.waitForTimeout(6000);
const uidFunc = await p2.evaluate(async () => { const f = await import('/src/lib/firebase.ts'); return f.auth.currentUser?.uid || ''; });
ok(!!uidFunc, 'colaborador entrou');

// dono remove na lista
await p.waitForTimeout(500);
const linha = p.locator('tr').filter({ hasText: func }).first();
ok(await linha.count() === 1, 'linha do colaborador visível');
const lixo = linha.locator('button[title="Remover da equipa"]').first();
await lixo.evaluate((el) => el.click());
await p.waitForTimeout(2500);
const depois = await p.evaluate(() => document.body.innerText);
ok(!depois.includes(func), 'colaborador desapareceu da lista');

// Firestore: doc colaborador apagado e já não é membro
const rest = await fetch('http://127.0.0.1:8180/v1/projects/recofatima-ferramenta/databases/(default)/documents:runQuery', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
  body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'gabinetes' }], limit: 50 } }),
}).then((r) => r.json()).catch(() => []);
const doc = (Array.isArray(rest) ? rest : []).map((x) => x.document).find((d) => d && (d.fields?.invites?.arrayValue?.values || []).some((v) => v.mapValue?.fields?.email?.stringValue === func));
const gabDoc = doc || (Array.isArray(rest) ? rest : []).map((x) => x.document).filter(Boolean)[0];
const membros = (gabDoc?.fields?.memberUids?.arrayValue?.values || []).map((v) => v.stringValue);
ok(!membros.includes(uidFunc), 'uid removido de memberUids');

// O colaborador perde acesso: leitura ao gabinete deve dar 403
const acesso = await p2.evaluate(async (gid) => {
  const f = await import('/src/lib/firebase.ts');
  const tok = await f.auth.currentUser.getIdToken();
  const r = await fetch(`http://127.0.0.1:8180/v1/projects/recofatima-ferramenta/databases/(default)/documents/gabinetes/${gid}`, { headers: { Authorization: `Bearer ${tok}` } });
  return r.status;
}, await p.evaluate(async () => { const g = await import('/src/lib/gabinetes.ts'); return g.getActiveGabineteId(); }));
ok(acesso === 403, `acesso revogado nas regras (HTTP ${acesso})`);
await b.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) process.exit(1);
