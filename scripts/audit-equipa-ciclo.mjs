/**
 * Ciclo completo da equipa: dono adiciona funcionária (Equipa), ela cria conta,
 * aceita o convite e o registo passa a "Ativo" com o uid ligado.
 */
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
const stamp = Date.now();
const dono = `dono+${stamp}@estudo360.pt`;
const func = `func+${stamp}@estudo360.pt`;
const pass = 'Teste12345!';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
page.on('pageerror', (e) => falhas.push('pageerror: ' + (e.stack || '').split('\n')[0]));

async function verificar(addr) {
  for (let i = 0; i < 10; i++) {
    const r = await fetch('http://127.0.0.1:9199/emulator/v1/projects/demo-estudo360/oobCodes').then((x) => x.json()).catch(() => null);
    const c = r?.oobCodes?.filter((x) => x.email === addr && x.requestType === 'VERIFY_EMAIL').pop();
    if (c?.oobLink) { const v = await fetch(c.oobLink).catch(() => null); if (v?.ok) return true; }
    await page.waitForTimeout(700);
  }
  return false;
}

async function criarConta(nome, addr) {
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const sairAntes = page.getByRole('button', { name: /Sair/i }).first();
  if (await sairAntes.count()) { await sairAntes.click(); await page.waitForTimeout(1200); }
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Criar conta/i }).first().click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="O seu nome"]').first().fill(nome);
  await page.locator('input[placeholder="nome@empresa.pt"]').first().fill(addr);
  await page.locator('input[type="password"]').first().fill(pass);
  await page.getByRole('button', { name: /^Criar conta$/ }).first().click();
  await page.waitForTimeout(2400);
  const v = await verificar(addr);
  const sair = page.getByRole('button', { name: /Sair/i }).first();
  if (await sair.count()) { await sair.click(); await page.waitForTimeout(800); }
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1300);
  const entrar = page.getByRole('button', { name: /^Entrar$/ }).first();
  if (await entrar.count()) await entrar.click();
  await page.waitForTimeout(400);
  await page.locator('input[placeholder="nome@empresa.pt"]').first().fill(addr);
  await page.locator('input[type="password"]').first().fill(pass);
  await page.getByRole('button', { name: /^Entrar$/ }).last().click();
  await page.waitForTimeout(2600);
  return v;
}

ok(await criarConta('Dono Ciclo', dono), 'dono criado');
const criarGab = page.getByRole('button', { name: /^Criar gabinete$/ }).first();
if (await criarGab.count()) {
  await criarGab.click(); await page.waitForTimeout(700);
  await page.locator('input[placeholder*="Silva"]').first().fill('Ciclo QA');
  await page.locator('input[placeholder="500000000"]').first().fill('509666555');
  await page.getByRole('button', { name: /Criar e entrar/i }).first().click();
  await page.waitForTimeout(3000);
}
const equipa = page.locator('button:visible').filter({ hasText: /^Equipa$/ }).first();
if (await equipa.count()) { await equipa.evaluate((el) => el.click()); await page.waitForTimeout(1000); }
await page.getByRole('button', { name: /Adicionar (funcionário|colaborador)/i }).first().click();
await page.waitForTimeout(600);
await page.locator('input[placeholder="Nome completo"]:visible').first().fill('Funcionária Ciclo');
await page.locator('input[placeholder="Email (para login)"]:visible').first().fill(func);
await page.locator('select:visible').last().selectOption('estagiaria');
await page.getByRole('button', { name: /Adicionar \(convite pendente\)/i }).filter({ visible: true }).first().click();
await page.waitForTimeout(4500);
let apareceu = false;
for (let i = 0; i < 12; i++) {
  apareceu = await page.evaluate(() => /Convite para/i.test(document.body.innerText));
  if (apareceu) break;
  await page.waitForTimeout(1000);
}
ok(apareceu, 'convite mostrado ao dono');
if (!apareceu) console.log('   [debug]', await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 300)));
await page.screenshot({ path: 'docs/equipa-ciclo-debug.png' });
await page.mouse.click(6, 6).catch(() => {});
await page.waitForTimeout(500);

ok(await criarConta('Funcionária Ciclo', func), 'funcionária criada');
// Auto-aceite: ao entrar com 1 convite pendente, segue direto para o gabinete.
await page.waitForTimeout(5000);
ok(/Gabinete|Lista de Empresas/i.test(await page.evaluate(() => document.body.innerText)), 'auto-aceite e entrada na app');

const colab = await page.evaluate(async (alvo) => {
  const g = await import('/src/lib/gabinetes.ts');
  const id = g.getActiveGabineteId();
  const url = `http://127.0.0.1:8180/v1/projects/recofatima-ferramenta/databases/(default)/documents/gabinete/${id}:runQuery`;
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'colaboradores' }], where: { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: alvo } } }, limit: 1 } }) });
  const j = await r.json().catch(() => []);
  const f = (Array.isArray(j) ? j.find((x) => x.document)?.document?.fields : null) || null;
  return f ? { status: f.status?.stringValue, linked: !!f.linkedUid?.stringValue, id } : { id, http: r.status, n: Array.isArray(j) ? j.length : -1 };
}, func);
console.log('   [colab]', JSON.stringify(colab));
ok(colab?.status === 'ativo' && colab?.linked, `registo da equipa Ativo com uid (${JSON.stringify(colab)})`);
await page.screenshot({ path: 'docs/equipa-ciclo.png' });
await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach((f) => console.log('  - ' + f)); process.exit(1); }
