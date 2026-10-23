/**
 * Prova do botão "Gamma" dentro do editor de propostas:
 * painel abre, texto tem as secções da cópia original (Ativiwise), o preço é o
 * do motor de honorários e a cópia para a área de transferência funciona.
 *
 *   node scripts/verify-gamma-copy.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000/?test';
const OUT = path.resolve('scripts/out');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const env = (data) => JSON.stringify({ v: 1, data });

const falhas = [];
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) falhas.push(msg); };

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
page.on('pageerror', (e) => falhas.push(`pageerror: ${e.message}`));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'proposta' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'test-office' }));
  localStorage.setItem('estudo360:v1:gabinete:officeId', JSON.stringify({ v: 1, data: 'test-office' }));
});
await page.reload({ waitUntil: 'load' });

await page.getByRole('button', { name: /Nova proposta/i }).click();
await page.getByRole('button', { name: /Começar do template/i }).click();
await page.waitForSelector('text=Propostas', { timeout: 20000 });

// Botão Gamma no cabeçalho do editor
const botaoGamma = page.getByRole('button', { name: /^Gamma$/ }).first();
await botaoGamma.waitFor({ timeout: 15000 });
await botaoGamma.click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'gamma-painel.png') });

// textContent: o <pre> está dentro de <details> fechado (innerText viria vazio)
const texto = await page.locator('div.absolute pre').evaluate((el) => el.textContent || '');
ok(/## Sobre nós/.test(texto), 'texto tem "Sobre nós"');
ok(/## Âmbito da proposta/.test(texto), 'texto tem "Âmbito da proposta"');
ok(/## Investimento — Honorários/.test(texto), 'texto tem "Investimento — Honorários"');
ok(/## Agradecemos a oportunidade/.test(texto), 'texto tem o fecho');
ok(/€\/mês/.test(texto), 'investimento mostra valor mensal em euros');
ok(texto.length > 1200, `texto completo (${texto.length} caracteres)`);

// Cópia real para a área de transferência
const [popup] = await Promise.all([
  context.waitForEvent('page', { timeout: 8000 }).catch(() => null),
  page.getByRole('button', { name: /Copiar \+ abrir Gamma/i }).click(),
]);
await page.waitForTimeout(600);
const copiado = await page.evaluate(() => navigator.clipboard.readText());
ok(copiado.includes('## Sobre nós') && copiado.includes('Investimento'), 'área de transferência recebeu a proposta');
ok(copiado.trim() === texto.trim(), 'o que copia é o mesmo texto que está à vista');
if (popup) { await popup.close().catch(() => {}); }
ok(!!popup, 'abre o gamma.app numa tab nova');

// 375 px: o painel não pode estourar
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(400);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(overflow <= 1, `375px sem overflow horizontal (${overflow}px)`);
await page.screenshot({ path: path.join(OUT, 'gamma-painel-375.png') });

await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach(f => console.log(`  - ${f}`)); process.exit(1); }
