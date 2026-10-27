/**
 * Adicionar funcionário: cria registo + convite no gabinete e mostra a mensagem
 * pronta (não há email automático). Confirma também que o convite fica no gabinete.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
const stamp = Date.now();
const email = `dono+${stamp}@estudo360.pt`;
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

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(1600);
await page.getByRole('button', { name: /Criar conta/i }).first().click();
await page.waitForTimeout(500);
await page.locator('input[placeholder="O seu nome"]').first().fill('Dono Equipa');
await page.locator('input[placeholder="nome@empresa.pt"]').first().fill(email);
await page.locator('input[type="password"]').first().fill(pass);
await page.getByRole('button', { name: /^Criar conta$/ }).first().click();
await page.waitForTimeout(2400);
ok(await verificar(email), 'conta do dono confirmada');
const sair = page.getByRole('button', { name: /Sair/i }).first();
if (await sair.count()) { await sair.click(); await page.waitForTimeout(800); }
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(1400);
const entrar = page.getByRole('button', { name: /^Entrar$/ }).first();
if (await entrar.count()) await entrar.click();
await page.waitForTimeout(500);
await page.locator('input[placeholder="nome@empresa.pt"]').first().fill(email);
await page.locator('input[type="password"]').first().fill(pass);
await page.getByRole('button', { name: /^Entrar$/ }).last().click();
await page.waitForTimeout(2600);

const criarGab = page.getByRole('button', { name: /^Criar gabinete$/ }).first();
if (await criarGab.count()) {
  await criarGab.click(); await page.waitForTimeout(800);
  await page.locator('input[placeholder*="Silva"]').first().fill('Equipa QA');
  await page.locator('input[placeholder="500000000"]').first().fill('509777666');
  await page.getByRole('button', { name: /Criar e entrar/i }).first().click();
  await page.waitForTimeout(3000);
}

// Equipa → Adicionar funcionário
const equipa = page.locator('button:visible').filter({ hasText: /^Equipa$/ }).first();
if (await equipa.count()) { await equipa.evaluate((el) => el.click()); await page.waitForTimeout(1200); }
else {
  const grupo = page.locator('aside button:visible').filter({ hasText: /Gabinete/ }).first();
  if (await grupo.count()) { await grupo.evaluate((el) => el.click()); await page.waitForTimeout(700); }
  const eq2 = page.locator('button:visible').filter({ hasText: /^Equipa$/ }).first();
  if (await eq2.count()) { await eq2.evaluate((el) => el.click()); await page.waitForTimeout(1200); }
}
const add = page.getByRole('button', { name: /Adicionar funcionário/i }).first();
ok(await add.count() >= 1, 'botão Adicionar funcionário disponível');
await add.click();
await page.waitForTimeout(600);
await page.locator('input[placeholder="Nome completo"]:visible').first().fill('Funcionária QA');
await page.locator('input[placeholder="Email (para login)"]:visible').first().fill(func);
const cargo = page.locator('select:visible').last();
await cargo.selectOption('estagiaria');
await page.getByRole('button', { name: /Adicionar \(convite pendente\)/i }).filter({ visible: true }).first().click();
await page.waitForTimeout(5000);

const texto = await page.evaluate(() => document.body.innerText);
ok(texto.includes(func), 'modal mostra o email do convite');
ok(/não enviamos email automático/i.test(texto), 'avisa que o email não é automático');
ok(await page.getByRole('button', { name: /Copiar mensagem/i }).count() === 1, 'botão Copiar mensagem');
ok(await page.getByRole('link', { name: /Abrir no email/i }).count() === 1, 'atalho Abrir no email');

// convite realmente gravado no gabinete?
const convites = await page.evaluate(async (alvo) => {
  const g = await import('/src/lib/gabinetes.ts');
  const id = g.getActiveGabineteId();
  const meta = id ? await g.getGabineteMeta(id) : null;
  return { emails: (meta?.inviteEmails || []).map((e) => e.toLowerCase()).includes(alvo), invites: (meta?.invites || []).some((i) => (i.email || '').toLowerCase() === alvo) };
}, func);
ok(convites.emails && convites.invites, 'convite gravado no gabinete (email + registo)');

await page.screenshot({ path: 'docs/equipa-convite.png' });
await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach((f) => console.log('  - ' + f)); process.exit(1); }
