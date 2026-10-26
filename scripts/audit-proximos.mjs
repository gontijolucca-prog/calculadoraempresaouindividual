/**
 * Próximos passos da página de 26/10: começa vazio, grava no site (Firestore)
 * com sessão iniciada e fica visível sem sessão. Versões antigas não se perdem.
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:3000/';
const PAGE = BASE + 'estudo360-novidades-semana-26-10.html?emu=1';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };

const email = `prox+${Date.now()}@estudo360.pt`;
const pass = 'Teste12345!';
const TEXTO = '1. Validar valores fiscais com contabilista\n2. Publicar regras de acesso';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

// A) com sessão: cria conta na app (emulador) e grava na página
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const app = await ctx.newPage();
await app.goto(BASE, { waitUntil: 'load' });
await app.waitForTimeout(1800);
const criar = app.getByRole('button', { name: /Criar conta/i }).first();
if (await criar.count()) await criar.click();
await app.waitForTimeout(500);
await app.locator('input[placeholder="O seu nome"]').first().fill('Proximos QA');
await app.locator('input[placeholder="nome@empresa.pt"]').first().fill(email);
await app.locator('input[type="password"]').first().fill(pass);
await app.getByRole('button', { name: /^Criar conta$/ }).first().click();
await app.waitForTimeout(2500);

const page = await ctx.newPage();
await page.goto(PAGE, { waitUntil: 'load' });
await page.waitForTimeout(3500);
const inicial = await page.evaluate(() => ({
  texto: document.getElementById('npView')?.textContent?.trim(),
  editorVisivel: getComputedStyle(document.getElementById('npEditor')).display !== 'none',
  vazio: (document.getElementById('npText')?.value || '') === '',
}));
ok(inicial.vazio, 'lista desta semana começa vazia');
ok(inicial.editorVisivel, 'editor aparece com sessão iniciada');

await page.locator('#npText').fill(TEXTO);
await page.getByRole('button', { name: /Guardar no site/i }).click();
await page.waitForTimeout(3500);
const depois = await page.evaluate(() => ({
  texto: document.getElementById('npView')?.textContent?.trim(),
  meta: document.getElementById('npMeta')?.textContent?.trim(),
  msg: document.getElementById('npMsg')?.textContent?.trim(),
}));
ok(depois.texto === TEXTO, 'texto guardado aparece na página');
ok(/Guardado a/.test(depois.meta || ''), `meta da gravação: ${depois.meta}`);

// B) sem sessão: lê a mesma nota e não pode editar
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 950 } });
const anon = await ctx2.newPage();
await anon.goto(PAGE, { waitUntil: 'load' });
await anon.waitForTimeout(3500);
const semSessao = await anon.evaluate(() => ({
  texto: document.getElementById('npView')?.textContent?.trim(),
  editorVisivel: getComputedStyle(document.getElementById('npEditor')).display !== 'none',
}));
ok(semSessao.texto === TEXTO, 'sem sessão vê a mesma lista (guardada no site)');
ok(!semSessao.editorVisivel, 'sem sessão não edita');

await anon.screenshot({ path: 'docs/proximos-semana.png' });
await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach((f) => console.log('  - ' + f)); process.exit(1); }
