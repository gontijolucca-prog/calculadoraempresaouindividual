/**
 * Verifica o arranque da importação TOConline: botão, modal, endpoints
 * pré-preenchidos e o endereço de retorno que tem de ser registado.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000/?test';
const OUT = path.resolve('docs/audit-2026-10-26');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:mode', JSON.stringify({ v: 1, data: 'empresa' }));
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'empresas' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'x' }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2200);

const abrir = page.getByRole('button', { name: /TOConline/i }).first();
ok(await abrir.count() >= 1, 'botão TOConline presente na Lista de Empresas');
await abrir.click();
await page.waitForTimeout(700);
ok(await page.getByRole('dialog', { name: /Importar do TOConline/i }).count() === 1, 'modal de importação abre');

const valores = await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll('input'));
  const byLabel = (txt) => {
    const lab = Array.from(document.querySelectorAll('label')).find((l) => l.textContent?.toLowerCase().includes(txt));
    return lab?.querySelector('input')?.value || '';
  };
  return {
    oauth: byLabel('endereço oauth'),
    api: byLabel('endereço da api'),
    retorno: document.body.innerText.includes('https://') ? (document.body.innerText.match(/https?:\/\/[^\s]+/g) || []).slice(0, 4) : [],
  };
});
ok(valores.oauth.includes('app32.toconline.pt/oauth'), `OAuth pré-preenchido (${valores.oauth})`);
ok(valores.api.includes('api32.toconline.pt'), `API pré-preenchida (${valores.api})`);
const temRetorno = await page.evaluate(() => /oauth\.pstmn\.io\/v1\/callback/.test(document.body.innerText));
ok(temRetorno, 'explica o endereço de retorno pré-fixado (oauth.pstmn.io)');

// Campo do redirect + alternativa de código manual
const temRedirect = await page.evaluate(() => Array.from(document.querySelectorAll('label')).some((l) => /Endereço de retorno/i.test(l.textContent || '')));
ok(temRedirect, 'campo do endereço de retorno presente');
const temCodigo = await page.evaluate(() => /Já tenho um código de autorização/i.test(document.body.innerText));
const temAbrir = await page.evaluate(() => /Abrir autorização TOConline|Entrar pelo site do TOConline/i.test(document.body.innerText));
const naoTemLigarSozinho = await page.evaluate(() => !/Ligar e importar/i.test(document.body.innerText));
ok(temCodigo, 'alternativa "colar código" presente (não obriga a mudar o redirect)');
ok(temAbrir, 'botão para abrir a autorização TOConline');
ok(naoTemLigarSozinho, 'sem botão enganador de ligação automática');

await page.screenshot({ path: path.join(OUT, 'toconline-modal.png') });
await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) process.exit(1);
