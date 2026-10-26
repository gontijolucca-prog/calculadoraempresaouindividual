/**
 * Prova ponta-a-ponta da ligação TOConline (precisa das credenciais reais em
 * TOC_CLIENT_ID / TOC_SECRET; sem elas, salta sem falhar).
 *
 *   TOC_CLIENT_ID=... TOC_SECRET=... node scripts/audit-toconline-live.mjs
 */
import { chromium } from 'playwright-core';

const CID = process.env.TOC_CLIENT_ID || '';
const SEC = process.env.TOC_SECRET || '';
if (!CID || !SEC) {
  console.log('SKIP — sem TOC_CLIENT_ID/TOC_SECRET no ambiente (não guardamos segredos no repo).');
  process.exit(0);
}

const BASE = 'http://localhost:3000/?test';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', (e) => falhas.push('pageerror: ' + (e.stack || '').split('\n')[0]));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:mode', JSON.stringify({ v: 1, data: 'empresa' }));
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'empresas' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'toc-live' }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2000);
await page.getByRole('button', { name: /TOConline/i }).first().click();
await page.waitForTimeout(700);

// preencher credenciais (campos já têm OAuth/API)
await page.locator('input').filter({ hasNot: page.locator('[type=hidden]') }).count();
const inputs = page.locator('input:visible');
const valores = await inputs.evaluateAll((els) => els.map((e) => ({ ph: e.placeholder, type: e.type })));
const idxCid = valores.findIndex((v) => v.type !== 'password' && (v.ph || '') === '');
// Client ID é o penúltimo input de texto antes do segredo; usar labels
const campoCid = page.locator('label', { hasText: /Client ID/i }).locator('input').first();
await campoCid.fill(CID);
const campoSec = page.locator('label', { hasText: /Segredo/i }).locator('input').first();
await campoSec.fill(SEC);

const ligar = page.getByRole('button', { name: /Ligar e importar/i }).first();
ok(await ligar.count() === 1, 'botão "Ligar e importar" presente');
await ligar.click();
await page.waitForTimeout(12000);

const txt = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText || document.body.innerText);
console.log('   modal:', txt.slice(0, 400).replace(/\n+/g, ' | '));
const m = txt.match(/(\d+)\s+novos?/i) || txt.match(/(\d+)\s+empresa/i);
ok(!!m && Number(m[1]) > 0, `lista recebida (${m ? m[0] : 'sem contagem visível'})`);
const linhas = await page.locator('[role="dialog"] input[type="checkbox"]').count();
ok(linhas > 0, `pré-visualização com ${linhas} empresa(s) para importar`);

await page.screenshot({ path: 'docs/audit-2026-10-26/toconline-live.png' });
await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) process.exit(1);
