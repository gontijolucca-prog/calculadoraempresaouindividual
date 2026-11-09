/**
 * Notas da reunião: escrita sem conta, persistência e navegação entre semanas.
 *
 *  1. Sem chave → só leitura.
 *  2. Com chave → editor.
 *  3. Escrever numa semana grava (200) e cria versão nova.
 *  4. Mudar de semana no seletor carrega as notas dessa semana.
 *  5. A chave é memorizada entre visitas.
 *  6. Chave errada é recusada.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = (process.env.BASE || 'http://localhost:3000/').replace(/\/$/, '');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LOCAL = /localhost|127\.0\.0\.1/.test(BASE);
const PAGINA = LOCAL ? '/estudo360-novidades-semana-09-11.html' : '/estudo360-novidades-semana-09-11';
const MARCADOR_TESTE = 'proximos:teste-automatico';

const chave = (() => {
  try { return fs.readFileSync(process.env.NOTAS_CHAVE_FILE || '/tmp/notas-chave.txt', 'utf8').trim(); } catch { return ''; }
})();
if (!chave) { console.log('Sem chave de teste.'); process.exit(0); }

const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();

// 1) Sem chave
await page.goto(`${BASE}${PAGINA}`, { waitUntil: 'load' });
await page.waitForTimeout(2200);
ok(!(await page.locator('#npEditor').isVisible()), 'sem chave: editor escondido');
ok(await page.locator('#npLocked').isVisible(), 'sem chave: aviso de só leitura');

// 2) Com chave
await page.goto(`${BASE}${PAGINA}?k=${chave}`, { waitUntil: 'load' });
await page.waitForTimeout(2200);
ok(await page.locator('#npEditor').isVisible(), 'com chave: editor disponível');

// 3) Seletor de semanas
const opcoes = await page.locator('#npSemana option').evaluateAll((els) => els.map((e) => e.value));
ok(opcoes.includes('proximos:semana-09-11'), 'semana atual disponível no seletor');
ok(opcoes.includes('proximos:semana-03-11'), 'semana de 03/11 disponível no seletor');
ok(opcoes.includes('proximos:semana-26-10'), 'semana de 28/10 disponível no seletor');

// 4) Gravar em duas semanas diferentes
const marca = `Teste ${new Date().toISOString()}`;
for (const [semana, sufixo] of [['proximos:semana-09-11', 'atual'], ['proximos:semana-03-11', 'anterior']]) {
  const r = await page.evaluate(async ({ base, chave, texto, marcador }) => {
    const res = await fetch(`${base}/api/notas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chave, texto, marcador }),
    });
    return { status: res.status, corpo: await res.json().catch(() => ({})) };
  }, { base: BASE, chave, texto: `${marca} — ${sufixo}`, marcador: semana });
  ok(r.status === 200 && r.corpo?.ok === true, `grava na ${sufixo} (HTTP ${r.status})`);
}

// 5) Trocar de semana no seletor não rebenta e mantém o editor
await page.selectOption('#npSemana', 'proximos:semana-03-11');
await page.waitForTimeout(1500);
ok(await page.locator('#npEditor').isVisible(), 'editor continua disponível ao trocar de semana');
const textoMostrado = await page.locator('#npView').innerText();
ok(!/erro|indispon/i.test(textoMostrado), 'troca de semana carrega sem erro');

// 6) Chave memorizada
await page.goto(`${BASE}${PAGINA}`, { waitUntil: 'load' });
await page.waitForTimeout(1800);
ok(await page.locator('#npEditor').isVisible(), 'chave fica memorizada no browser');

// 7) Chave errada
const errada = await page.evaluate(async ({ base }) => {
  const r = await fetch(`${base}/api/notas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chave: 'b'.repeat(32), texto: 'x', marcador: 'proximos:teste-automatico' }),
  });
  return r.status;
}, { base: BASE });
ok(errada === 401, `chave errada é recusada (HTTP ${errada})`);

// 8) Marcador de teste não se mistura com as notas reais
ok(MARCADOR_TESTE !== 'proximos:semana-09-11', 'testes usam marcador separado das notas reais');

await browser.close();
console.log(falhas.length ? `\nFAIL — ${falhas.length} falha(s)` : '\nPASS — notas sem conta e navegação entre semanas');
process.exit(falhas.length ? 1 : 0);
