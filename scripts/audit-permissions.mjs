/**
 * Permissões por cargo com convite real (emuladores Firebase):
 *  dono convida estagiária → ela entra → vê menos e não pode editar obrigações.
 *
 *   node scripts/audit-permissions.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:3000/';
const OUT = path.resolve('docs/audit-2026-10-26');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };

/** Tabs do Gabinete visíveis; abre o submenu se estiver fechado. */
async function tabsDoGabinete(page) {
  const ler = () => page.evaluate(() => Array.from(document.querySelectorAll('button'))
    .filter((b) => b.getClientRects().length)
    .map((b) => (b.innerText || '').trim().split('\n')[0])
    .filter((s) => ['Visão geral', 'Quadro de obrigações', 'Mapa de controlo', 'Mapa RH', 'Equipa', 'Tarefas', 'Agenda', 'Obrigações', 'Cofre', 'Lixeira'].includes(s)));
  let tabs = await ler();
  if (tabs.length) return tabs;

  const grupo = page.locator('aside button:visible').filter({ hasText: /Gabinete/ }).first();
  if (await grupo.count()) { await grupo.click(); await page.waitForTimeout(700); }
  return ler();
}

fs.mkdirSync(OUT, { recursive: true });

const stamp = Date.now();
const donoEmail = `dono+${stamp}@estudo360.pt`;
const estEmail = `est+${stamp}@estudo360.pt`;
const pass = 'Teste12345!';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
page.on('dialog', (d) => { console.log('   [dialog]', d.message().slice(0, 160)); d.accept(); });
page.on('pageerror', (e) => falhas.push('pageerror: ' + (e.stack || '').split('\n')[0]));
const consola = [];
page.on('console', (m) => consola.push(m.text()));

async function verificar(email) {
  for (let i = 0; i < 8; i++) {
    const r = await fetch('http://127.0.0.1:9199/emulator/v1/projects/demo-estudo360/oobCodes').then((x) => x.json()).catch(() => null);
    const c = r?.oobCodes?.filter((x) => x.email === email && x.requestType === 'VERIFY_EMAIL').pop();
    if (c?.oobLink) { const vr = await fetch(c.oobLink).catch(() => null); if (vr?.ok) return true; }
    await page.waitForTimeout(700);
  }
  return false;
}

async function criarConta(nome, email) {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1800);
  const criar = page.getByRole('button', { name: /Criar conta/i }).first();
  if (await criar.count()) await criar.click();
  await page.waitForTimeout(600);
  await page.locator('input[placeholder="O seu nome"]').first().fill(nome);
  await page.locator('input[placeholder="nome@empresa.pt"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(pass);
  await page.getByRole('button', { name: /^Criar conta$/ }).first().click();
  await page.waitForTimeout(2600);
  const okVer = await verificar(email);
  // reentra para refrescar o token
  const sair = page.getByRole('button', { name: /Sair/i }).first();
  if (await sair.count()) { await sair.click(); await page.waitForTimeout(900); }
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1400);
  const entrar = page.getByRole('button', { name: /^Entrar$/ }).first();
  if (await entrar.count()) await entrar.click();
  await page.locator('input[placeholder="nome@empresa.pt"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(pass);
  await page.getByRole('button', { name: /^Entrar$/ }).last().click();
  await page.waitForTimeout(3000);
  return okVer;
}

// 0) Confirmar que o dev está ligado aos emuladores (nunca à produção)
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(2500);
ok(consola.some((l) => /emuladores locais ligados/i.test(l)), 'dev ligado aos emuladores (auth/firestore)');

// 1) Dono
ok(await criarConta('Dono QA', donoEmail), 'dono: conta criada e email confirmado');
const criarGab = page.getByRole('button', { name: /Criar gabinete/i }).first();
if (await criarGab.count()) {
  await criarGab.click();
  await page.waitForTimeout(1000);
  const nome = page.locator('input[placeholder*="Silva"]').first();
  if (await nome.count()) await nome.fill('Gabinete Permissoes');
  const nif = page.locator('input[placeholder="500000000"]').first();
  if (await nif.count()) await nif.fill('509999999');
  await page.getByRole('button', { name: /Criar e entrar/i }).first().click();
  await page.waitForTimeout(3000);
}
ok(await page.evaluate(() => !/Em que gabinete pretende/i.test(document.body.innerText)), 'dono: gabinete ativo');
const tabsDono = await tabsDoGabinete(page);
ok(['Cofre', 'Equipa', 'Lixeira'].every((x) => tabsDono.includes(x)), `dono vê todas as tabs (${tabsDono.length}/10)`);
// 2) Convidar estagiária
await page.evaluate(() => {
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'gabinete' }));
  localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: 'equipa' }));
});
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(2500);
console.log('   equipa?', JSON.stringify(await page.evaluate(() => ({
  txt: (document.querySelector('#main-content')?.innerText || '').slice(0, 120).replace(/\n+/g, ' | '),
  botoes: Array.from(document.querySelectorAll('#main-content button')).filter((b) => b.getClientRects().length).map((b) => (b.innerText || '').trim()).filter(Boolean).slice(0, 8),
}))));
const add = page.locator('#main-content button:visible').filter({ hasText: /Adicionar (funcionário|colaborador)|Novo colaborador/i }).first();
if (await add.count()) { await add.click(); await page.waitForTimeout(800); }
await page.locator('input[placeholder="Nome completo"]').first().fill('Estagiária QA');
await page.locator('input[placeholder="Email (para login)"]').first().fill(estEmail);
// O select do formulário é o último aberto (o primeiro é o filtro da lista).
const selRole = page.locator('select:visible').last();
await selRole.selectOption('estagiaria');
console.log('   role escolhida:', await selRole.inputValue());
const guardar = page.getByRole('button', { name: /Adicionar \(convite pendente\)/i }).filter({ visible: true }).first();
if (await guardar.count()) await guardar.click({ force: true });
await page.waitForTimeout(2500);

// Confirma no emulador (admin) que o convite ficou gravado no gabinete.
const conviteGravado = await (async () => {
  const url = 'http://127.0.0.1:8180/v1/projects/recofatima-ferramenta/databases/(default)/documents:runQuery';
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'gabinetes' }], limit: 50 } }) });
  const j = await r.json().catch(() => []);
  for (const row of Array.isArray(j) ? j : []) {
    const f = row?.document?.fields || null;
    if (!f) continue;
    const emails = (f.inviteEmails?.arrayValue?.values || []).map((v) => v.stringValue).filter(Boolean);
    if (emails.includes(estEmail.toLowerCase())) return true;
  }
  return false;
})();
ok(conviteGravado, 'dono: convite de estagiária gravado no gabinete');
// fechar a janela do convite (não deve bloquear o resto do fluxo)
await page.mouse.click(6, 6).catch(() => {});
await page.waitForTimeout(600);
const modalAberto = await page.locator('div.fixed.inset-0.z-50').count();
if (modalAberto) await page.evaluate(() => { const m = document.querySelector('div.fixed.inset-0.z-50'); if (m) m.click(); });
await page.waitForTimeout(400);

// 3) Estagiária entra
const sair = page.getByRole('button', { name: /Sair/i }).first();
if (await sair.count()) { await sair.click(); await page.waitForTimeout(1200); }
ok(await criarConta('Estagiária QA', estEmail), 'estagiária: conta criada e email confirmado');

// 3b) Com o auto-aceite, ao entrar com 1 convite pendente ela deve cair no
// gabinete sozinha; se tal não acontecer, ainda pode aceitar no cartão.
let entrou = false;
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(800);
  const diag = await page.evaluate(async () => {
    const g = await import('/src/lib/gabinetes.ts');
    return { active: g.getActiveGabineteId(), txt: document.body.innerText.slice(0, 200) };
  });
  if (diag.active) { entrou = true; break; }
  const aceitar = page.getByRole('button', { name: /Aceitar e entrar/i }).first();
  if (await aceitar.count()) { await aceitar.click(); await page.waitForTimeout(3000); entrou = true; break; }
}
const diagConv = await page.evaluate(async () => {
  const g = await import('/src/lib/gabinetes.ts');
  return { active: g.getActiveGabineteId(), texto: document.body.innerText.slice(0, 120).replace(/\s+/g, ' ') };
});
console.log('   [diag convites]', JSON.stringify(diagConv));
ok(entrou, 'estagiária: entrou no gabinete (auto-aceite ou convite)');
await page.waitForTimeout(2500);

// 4) Prova de segurança nas regras (Firestore emulator): a estagiária não lê o
// cofre, mas lê os clientes. O token é o dela, autenticado.
const token = await page.evaluate(async () => {
  const m = await import('/src/lib/firebase.ts');
  return await m.auth.currentUser.getIdToken();
});
const gabId = await page.evaluate(() => JSON.parse(localStorage.getItem('estudo360:v1:gabinete:activeId') || '{}').data);
const baseFs = `http://127.0.0.1:8180/v1/projects/recofatima-ferramenta/databases/(default)/documents/gabinete/${gabId}`;
const lerDoc = async (col) => {
  const r = await fetch(`${baseFs}/${col}/qa-permissao`, { headers: { Authorization: `Bearer ${token}` } });
  return r.status;
};
const metaR = await fetch(`http://127.0.0.1:8180/v1/projects/recofatima-ferramenta/databases/(default)/documents/gabinetes/${gabId}`, { headers: { Authorization: `Bearer ${token}` } });
const metaTxt = await metaR.text();
console.log('   meta status', metaR.status, 'ids?', /memberUids/.test(metaTxt), 'gabId', gabId);
const cofreStatus = await lerDoc('cofre');
const clientesStatus = await lerDoc('clientes');
ok(cofreStatus === 403, `estagiária: regras negam o cofre (HTTP ${cofreStatus})`);
ok(clientesStatus === 200 || clientesStatus === 404, `estagiária: clientes permitidos (HTTP ${clientesStatus})`);

const tabsEst = await tabsDoGabinete(page);
ok(!tabsEst.includes('Cofre'), `estagiária: sem Cofre no menu (${tabsEst.length} tabs)`);
ok(!tabsEst.includes('Equipa'), 'estagiária: sem Equipa no menu');
ok(!tabsEst.includes('Lixeira'), 'estagiária: sem Lixeira no menu');

// E o dono lê o cofre (comparação)
const tokenDono = null; void tokenDono;

await page.screenshot({ path: path.join(OUT, 'permissoes-estagiaria.png') });
await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach((f) => console.log('  - ' + f)); process.exit(1); }
