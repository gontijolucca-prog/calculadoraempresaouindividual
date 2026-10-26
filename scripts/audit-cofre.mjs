/**
 * Cofre pelo ecrã, com sessão real nos emuladores: cria conta, gabinete,
 * abre Cofre, cria uma entrada, confirma que aparece, apaga e confirma.
 *   BASE=http://localhost:3100/ node scripts/audit-cofre.mjs
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
const email = `cofre+${Date.now()}@estudo360.pt`;
const pass = 'Teste12345!';
const TITULO = `QA cofre ${Date.now()}`;

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
page.on('pageerror', (e) => falhas.push('pageerror: ' + (e.stack || '').split('\n')[0]));
page.on('dialog', (d) => d.accept());

async function verificar() {
  for (let i = 0; i < 10; i++) {
    const r = await fetch('http://127.0.0.1:9199/emulator/v1/projects/demo-estudo360/oobCodes').then((x) => x.json()).catch(() => null);
    const c = r?.oobCodes?.filter((x) => x.email === email && x.requestType === 'VERIFY_EMAIL').pop();
    if (c?.oobLink) { const v = await fetch(c.oobLink).catch(() => null); if (v?.ok) return true; }
    await page.waitForTimeout(700);
  }
  return false;
}

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /Criar conta/i }).first().click();
await page.waitForTimeout(500);
await page.locator('input[placeholder="O seu nome"]').first().fill('Cofre QA');
await page.locator('input[placeholder="nome@empresa.pt"]').first().fill(email);
await page.locator('input[type="password"]').first().fill(pass);
await page.getByRole('button', { name: /^Criar conta$/ }).first().click();
await page.waitForTimeout(2200);
ok(await verificar(), 'conta criada e email confirmado');

const sair = page.getByRole('button', { name: /Sair/i }).first();
if (await sair.count()) { await sair.click(); await page.waitForTimeout(900); }
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(1500);
const entrar = page.getByRole('button', { name: /^Entrar$/ }).first();
if (await entrar.count()) await entrar.click();
await page.waitForTimeout(500);
await page.locator('input[placeholder="nome@empresa.pt"]').first().fill(email);
await page.locator('input[type="password"]').first().fill(pass);
await page.getByRole('button', { name: /^Entrar$/ }).last().click();
await page.waitForTimeout(3000);

const criarGab = page.getByRole('button', { name: /^Criar gabinete$/ }).first();
if (await criarGab.count()) {
  await criarGab.click(); await page.waitForTimeout(700);
  await page.locator('input[placeholder*="Silva"]').first().fill('Cofre Gab');
  await page.locator('input[placeholder="500000000"]').first().fill('509888777');
  await page.getByRole('button', { name: /Criar e entrar/i }).first().click();
  await page.waitForTimeout(2500);
}

async function abrirCofre() {
  const clicar = async (loc) => loc.evaluate((el) => el.click());
  const ler = () => page.locator('button:visible').filter({ hasText: /^Cofre$/ }).count();
  if (!(await ler())) {
    const grupo = page.locator('aside button:visible').filter({ hasText: /Gabinete/ }).first();
    if (await grupo.count()) { await clicar(grupo); await page.waitForTimeout(700); }
  }
  const cofre = page.locator('button:visible').filter({ hasText: /^Cofre$/ }).first();
  if (await cofre.count()) { await clicar(cofre); await page.waitForTimeout(1000); return true; }
  return false;
}
ok(await abrirCofre(), 'abre a área Cofre');

await page.getByRole('button', { name: /Adicionar/i }).filter({ visible: true }).first().click();
await page.waitForTimeout(600);
const titulo = page.locator('input[placeholder="ex: Portal das Finanças"]:visible, input[placeholder="Título *"]:visible').first();
let abriu = true;
try { await titulo.waitFor({ timeout: 6000 }); } catch { abriu = false; }
ok(abriu, 'formulário aberto');
if (abriu) {
  await titulo.fill(TITULO);
  const user = page.locator('input[placeholder="NIF ou utilizador"]:visible, input[placeholder="Utilizador"]:visible').first();
  if (await user.count()) await user.fill('qa@estudo360.pt');
  const pw = page.locator('input[type="password"]:visible').first();
  if (await pw.count()) await pw.fill('Segredo123!');
  await page.getByRole('button', { name: /^Guardar$/ }).filter({ visible: true }).first().click();
  await page.waitForTimeout(1500);
}
ok((await page.evaluate(() => document.body.innerText)).includes(TITULO), 'entrada aparece na lista');

const apagar = page.getByRole('button', { name: /^Eliminar$/ }).filter({ visible: true }).first();
ok(await apagar.count() === 1, 'entrada selecionada com botão Eliminar');
if (await apagar.count()) { await apagar.click(); await page.waitForTimeout(1500); }
ok(!(await page.evaluate(() => document.body.innerText)).includes(TITULO), 'entrada apagada');
await page.screenshot({ path: 'docs/cofre-qa.png' });

await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach((f) => console.log('  - ' + f)); process.exit(1); }
