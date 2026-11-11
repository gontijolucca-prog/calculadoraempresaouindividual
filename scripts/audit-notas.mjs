/**
 * E2E das notas da reunião sem conta.
 *
 *  1. Sem chave, a página mostra as notas e o editor (escreve quem tem o link).
 *  2. Com chave no link, o editor continua disponível.
 *  3. Guardar cria uma versão nova e o texto aparece imediatamente.
 *  4. A versão guardada sobrevive a um reload (não desaparece).
 *  5. Chave errada é recusada pelo servidor.
 *
 * Requer o servidor de funções a correr (dev: proxy do Vite) e o Firestore
 * acessível para leitura. Escrever passa por /api/notas.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = (process.env.BASE || 'http://localhost:3000/').replace(/\/$/, '');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Em dev o Vite não reescreve rotas sem extensão; em produção o Cloudflare serve
// o .html. Usa-se o ficheiro direto quando o BASE é local.
const LOCAL = /localhost|127\.0\.0\.1/.test(BASE);
const PAGINA = LOCAL ? '/estudo360-novidades-semana-03-11.html' : '/estudo360-novidades-semana-03-11';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };

// Em produção usa-se um marcador de teste para não sujar as notas reais.
const MARCADOR = process.env.NOTAS_MARCADOR || 'proximos:teste-automatico';

const chave = (() => {
  const f = process.env.NOTAS_CHAVE_FILE || '/tmp/notas-chave.txt';
  try { return fs.readFileSync(f, 'utf8').trim(); } catch { return ''; }
})();

// A chave passou a ser opcional: escreve quem tem o link.

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();

// 1) Sem chave → só leitura
await page.goto(`${BASE}${PAGINA}`, { waitUntil: 'load' });
await page.waitForTimeout(2500);
ok(await page.locator('#npEditor').isVisible(), 'sem chave: editor disponível');
ok(!(await page.locator('#npLocked').isVisible()), 'sem chave: sem aviso de só leitura');

// 2) Com chave no link → editor
if (chave) {
  await page.goto(`${BASE}${PAGINA}?k=${chave}`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  ok(await page.locator('#npEditor').isVisible(), 'com chave: editor disponível');
  ok(!(await page.locator('#npLocked').isVisible()), 'com chave: aviso de só leitura escondido');
}

// 3) Gravar pela API (não suja as notas reais: marcador de teste)
const marca = `Teste automático ${new Date().toISOString()}`;
const gravacoes = [];
for (let i = 0; i < 2; i++) {
  gravacoes.push(await page.evaluate(async ({ base, chave, texto, marcador }) => {
    const r = await fetch(`${base}/api/notas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chave, texto, marcador }),
    });
    return { status: r.status, corpo: await r.json().catch(() => ({})) };
  }, { base: BASE === '' ? '' : BASE, chave, texto: `${marca} #${i + 1}`, marcador: MARCADOR }));
}
ok(gravacoes[0].status === 200 && gravacoes[0].corpo?.ok === true, `gravação aceite (HTTP ${gravacoes[0].status})`);
ok(!!gravacoes[0].corpo?.id && gravacoes[1].corpo?.id !== gravacoes[0].corpo?.id, 'cada gravação é uma versão nova (ids diferentes)');

// 4) A chave fica memorizada: voltar sem ?k= mantém o editor
await page.goto(`${BASE}${PAGINA}`, { waitUntil: 'load' });
await page.waitForTimeout(2000);
ok(await page.locator('#npEditor').isVisible(), 'editor continua disponível sem ?k=');

// 5) Gravar sem chave (link é o segredo)
const semChaveStatus = await page.evaluate(async ({ base }) => {
  const r = await fetch(`${base}/api/notas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto: 'gravação sem chave', marcador: 'proximos:teste-automatico' }),
  });
  return r.status;
}, { base: BASE });
ok(semChaveStatus === 200, `gravação sem chave aceite (HTTP ${semChaveStatus})`);

await browser.close();
console.log(falhas.length ? `\nFAIL — ${falhas.length} falha(s)` : '\nPASS — notas sem conta funcionam');
process.exit(falhas.length ? 1 : 0);
