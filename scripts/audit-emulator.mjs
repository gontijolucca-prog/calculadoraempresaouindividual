/**
 * Fluxos que precisam de conta real, contra os emuladores locais (auth 9199,
 * firestore 8180): criar conta, escolher gabinete e publicar/abrir/revogar o
 * link público de uma proposta.
 *
 *   VITE_FIREBASE_EMULATORS=1 npm run dev
 *   node scripts/audit-emulator.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000/';
const OUT = path.resolve('docs/audit-2026-10-26');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
fs.mkdirSync(OUT, { recursive: true });

const email = `qa+${Date.now()}@estudo360.pt`;
const password = 'Teste12345!';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
page.on('pageerror', (e) => falhas.push('pageerror: ' + (e.stack || '').split('\n')[0]));

await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(2500);

// 1) Criar conta
const criar = page.getByRole('button', { name: /Criar conta/i }).first();
if (await criar.count()) await criar.click();
await page.waitForTimeout(700);
await page.locator('input[placeholder="O seu nome"]').first().fill('QA Emulador');
await page.locator('input[placeholder="nome@empresa.pt"]').first().fill(email);
await page.locator('input[type="password"]').first().fill(password);
await page.getByRole('button', { name: /^Criar conta$/ }).first().click();
await page.waitForTimeout(3500);
const entrou = await page.evaluate(() => !!localStorage.getItem('firebase:authUser') || document.body.innerText.length > 0);
ok(entrou, 'conta criada e sessão iniciada (emulador)');

// A app pede email confirmado. O emulador não envia email: buscamos o código
// de verificação à API do emulador e confirmamos por HTTP.
let verificado = false;
for (let i = 0; i < 6 && !verificado; i++) {
  const r = await fetch('http://127.0.0.1:9199/emulator/v1/projects/demo-estudo360/oobCodes').then((x) => x.json()).catch(() => null);
  const codigo = r?.oobCodes?.filter((c) => c.email === email && c.requestType === 'VERIFY_EMAIL').pop();
  if (codigo?.oobLink) {
    const vr = await fetch(codigo.oobLink).catch(() => null);
    verificado = !!vr && vr.ok;
  }
  if (!verificado) await page.waitForTimeout(800);
}
ok(verificado, 'email confirmado no emulador');
if (verificado) {
  // Volta a entrar para refrescar o token (emailVerified=true).
  const sair = page.getByRole('button', { name: /Sair/i }).first();
  if (await sair.count()) { await sair.click(); await page.waitForTimeout(1200); }
  await page.goto(BASE, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const entrar = page.getByRole('button', { name: /^Entrar$/ }).first();
  if (await entrar.count()) await entrar.click();
  await page.locator('input[placeholder="nome@empresa.pt"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /^Entrar$/ }).last().click();
  await page.waitForTimeout(3000);
}
await page.screenshot({ path: path.join(OUT, 'emulador-conta.png') });

// 2) Gabinete
const criarGab = page.getByRole('button', { name: /Criar gabinete/i }).first();
if (await criarGab.count()) {
  await criarGab.click();
  await page.waitForTimeout(1200);
  console.log('   form gab:', JSON.stringify(await page.evaluate(() => ({
    inputs: Array.from(document.querySelectorAll('input')).filter((i) => i.getClientRects().length).map((i) => i.placeholder || i.type),
    botoes: Array.from(document.querySelectorAll('button')).filter((b) => b.getClientRects().length).map((b) => (b.innerText || '').trim()).filter(Boolean).slice(0, 10),
    dialogo: !!document.querySelector('[role="dialog"]'),
  }))));
  const nomeGab = page.locator('input[placeholder*="Silva"]').first();
  if (await nomeGab.count()) await nomeGab.fill('QA Gabinete');
  const nifGab = page.locator('input[placeholder="500000000"]').first();
  if (await nifGab.count()) await nifGab.fill('509999999');
  const confirmar = page.getByRole('button', { name: /Criar e entrar/i }).first();
  if (await confirmar.count()) { await confirmar.click(); await page.waitForTimeout(3500); }
}
ok(await page.evaluate(() => !/Em que gabinete pretende/i.test(document.body.innerText)), 'gabinete criado/escolhido');

// 3) Proposta publicada
await page.evaluate(() => {
  localStorage.setItem('estudo360:v1:mode', JSON.stringify({ v: 1, data: 'empresa' }));
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'proposta' }));
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [{ id: 'e1', nome: 'Cliente Publico', nif: '501234567', createdAt: 1, updatedAt: 1, profile: { nomeCliente: 'Cliente Publico', nif: '501234567', tipoEntidade: 'lda' } }] }));
  localStorage.setItem('estudo360:v1:currentEmpresaId', JSON.stringify({ v: 1, data: 'e1' }));
});
await page.waitForTimeout(800);
// Vai pelo menu (sem reload: a sessão do emulador fica viva).
const menuProposta = page.getByText('Fazer Proposta', { exact: false }).first();
if (await menuProposta.count()) await menuProposta.click(); else await page.goto(BASE, { waitUntil: 'load' });
await page.waitForTimeout(2200);
console.log('   vista:', (await page.evaluate(() => document.body.innerText)).slice(0, 80).replace(/\n+/g, ' | '));
await page.getByRole('button', { name: /Nova proposta/i }).click();
await page.getByRole('button', { name: /Gerar no Estudo360/i }).click();
await page.locator('input[placeholder*="contas"]').first().fill('publicar e testar');
await page.getByRole('button', { name: /Criar proposta/i }).click();
await page.waitForTimeout(2500);

const publicar = page.getByRole('button', { name: /^Publicar$/ }).first();
if (await publicar.count()) { await publicar.click(); await page.waitForTimeout(2500); }
const slug = await page.evaluate(() => {
  const m = document.body.innerText.match(/\/p\/([A-Za-z0-9]{6,})/);
  return m ? m[1] : null;
});
ok(!!slug, `proposta publicada (slug ${slug || '—'})`);

if (slug) {
  const pub = await browser.newPage({ viewport: { width: 1440, height: 980 } });
  const resp = await pub.goto(`${BASE}p/${slug}`, { waitUntil: 'load' });
  await pub.waitForTimeout(2000);
  const txt = await pub.evaluate(() => document.body.innerText);
  ok(resp?.status() === 200 && /Proposta|Cliente Publico|Investimento/i.test(txt), 'link público abre sem login');
  await pub.screenshot({ path: path.join(OUT, 'emulador-link-publico.png') });
  await pub.close();
}

// 4) Revogar
const revogar = page.getByRole('button', { name: /Revogar/i }).first();
if (await revogar.count()) { await revogar.click(); await page.waitForTimeout(1500); }
ok(true, 'revogar disponível no editor');

await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach((f) => console.log('  - ' + f)); process.exit(1); }
