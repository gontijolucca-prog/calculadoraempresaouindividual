/**
 * Fluxo novo: dono convida → servidor (simulado) dá link → página /convite define
 * password → conta criada e ligada ao gabinete → entra direto no gabinete.
 */
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
const stamp = Date.now();
const dono = `dono+${stamp}@estudo360.pt`, func = `func+${stamp}@estudo360.pt`, pass = 'Teste12345!';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ownerCtx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ownerCtx.newPage();
page.on('pageerror', (e) => falhas.push('pageerror: ' + (e.stack || '').split('\n')[0]));
page.on('dialog', (d) => d.accept());

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
  const sair = page.getByRole('button', { name: /Sair/i }).first();
  if (await sair.count()) { await sair.click(); await page.waitForTimeout(1000); }
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Criar conta/i }).first().click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="O seu nome"]').first().fill(nome);
  await page.locator('input[placeholder="nome@empresa.pt"]').first().fill(addr);
  await page.locator('input[type="password"]').first().fill(pass);
  await page.getByRole('button', { name: /^Criar conta$/ }).first().click();
  await page.waitForTimeout(2400);
  const v = await verificar(addr);
  const sair2 = page.getByRole('button', { name: /Sair/i }).first();
  if (await sair2.count()) { await sair2.click(); await page.waitForTimeout(900); }
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

ok(await criarConta('Dono Link', dono), 'dono criado');
const criarGab = page.getByRole('button', { name: /^Criar gabinete$/ }).first();
if (await criarGab.count()) {
  await criarGab.click(); await page.waitForTimeout(700);
  await page.locator('input[placeholder*="Silva"]').first().fill('Gabinete Link');
  await page.locator('input[placeholder="500000000"]').first().fill('509555444');
  await page.getByRole('button', { name: /Criar e entrar/i }).first().click();
  await page.waitForTimeout(3000);
}
const equipa = page.locator('button:visible').filter({ hasText: /^Equipa$/ }).first();
if (await equipa.count()) { await equipa.evaluate((el) => el.click()); await page.waitForTimeout(900); }
await page.getByRole('button', { name: /Adicionar funcionário/i }).first().click();
await page.waitForTimeout(500);
await page.locator('input[placeholder="Nome completo"]:visible').first().fill('Funcionária Link');
await page.locator('input[placeholder="Email (para login)"]:visible').first().fill(func);
await page.locator('select:visible').last().selectOption('estagiaria');
await page.getByRole('button', { name: /Adicionar \(convite pendente\)/i }).filter({ visible: true }).first().click();
await page.waitForTimeout(4500);

const token = await page.evaluate(async () => {
  const g = await import('/src/lib/gabinetes.ts');
  const id = g.getActiveGabineteId();
  const meta = id ? await g.getGabineteMeta(id) : null;
  const inv = (meta?.invites || []).filter((i) => i.token).pop();
  return inv?.token || '';
});
ok(!!token, `token do convite gerado (${token ? token.slice(0, 8) + '…' : 'sem token'})`);

// funcionária abre o link num browser limpo
const ctx2 = await browser.newContext({ viewport: { width: 420, height: 900 } });
const p2 = await ctx2.newPage();
p2.on('pageerror', (e) => falhas.push('pageerror convite: ' + (e.stack || '').split('\n')[0]));
await p2.goto(BASE + 'convite.html?t=' + token + '&emu=1', { waitUntil: 'load' });
await p2.waitForTimeout(3500);
const texto = await p2.evaluate(() => document.body.innerText);
ok(texto.includes(func), 'página mostra o email do convite');
ok(/Entrar na equipa/i.test(texto), 'página de definição de password aberta');

await p2.locator('#p1').fill('Forte12345');
await p2.locator('#p2').fill('Forte12345');
await p2.waitForTimeout(300);
const ativo = await p2.evaluate(() => !document.getElementById('go').disabled);
ok(ativo, 'botão ativa com password forte e confirmação igual');
await p2.locator('#go').click();
await p2.waitForTimeout(6000);
const url = p2.url();
ok(/\/\?convite=|%3F|\?convite=/.test(url) || url.endsWith('/'), `seguiu para a app (${url.slice(0, 80)})`);
await p2.waitForTimeout(2500);
const dentro = await p2.evaluate(() => /Gabinete|Lista de Empresas/i.test(document.body.innerText));
ok(dentro, 'funcionária entra na app');

const acesso = await p2.evaluate(async () => {
  const g = await import('/src/lib/gabinetes.ts');
  const f = await import('/src/lib/firebase.ts');
  const id = g.getActiveGabineteId();
  const meta = id ? await g.getGabineteMeta(id).catch(() => null) : null;
  return { id: !!id, membro: !!meta?.memberUids?.includes(f.auth.currentUser?.uid || ''), role: meta?.members?.[f.auth.currentUser?.uid || '']?.role || null };
});
ok(acesso.id && acesso.membro, `conta ligada ao gabinete (${JSON.stringify(acesso)})`);
await p2.screenshot({ path: 'docs/convite-link.png' });

await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach((f) => console.log('  - ' + f)); process.exit(1); }
