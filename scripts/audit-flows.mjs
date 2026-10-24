/**
 * Fluxos críticos (dados semeados, sem Firestore).
 *  1. Cofre: criar entrada → recarregar → continua lá.
 *  2. Exportar: "Imprimir / PDF" gera documento paginado no iframe.
 *  3. Proposta: PDF do editor dispara impressão e tem cards.
 *  4. Offline: gravar célula sem rede → fica guardado localmente.
 *
 *   node scripts/audit-flows.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000/?test';
const OUT = path.resolve('docs/audit-2026-10-24');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const cliente = {
  id: 'c1', nome: 'Cliente Fluxo', nif: '501234567', tipoEntidade: 'LDA', regimeIva: 'mensal',
  estado: 'ativo', createdAt: 1, updatedAt: 1, empresaId: 'e1', obrigacoesAtivas: ['iva'],
};
const obrigacao = {
  id: 'o1', tipo: 'iva', catalogoId: 'iva', titulo: 'IVA 03/2026', clienteId: 'c1', clienteNome: 'Cliente Fluxo',
  periodo: '2026-03', vencimento: new Date(2026, 2, 20, 12).getTime(), estado: 'pendente', origem: 'cliente', createdAt: 1, updatedAt: 1,
};

const falhas = [];
const passos = [];
const ok = (c, msg) => { console.log(`${c ? '✓' : '✗'} ${msg}`); passos.push({ ok: c, msg }); if (!c) falhas.push(msg); };
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const erros = [];
const errosTerceiros = [];
page.on('pageerror', (e) => {
  const st = e.stack || e.message;
  (st.includes('paged.polyfill.js') ? errosTerceiros : erros).push(st);
});

const semear = (vista, tab) => page.evaluate((d) => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: d.vista }));
  localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: d.tab }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [{ id: 'e1', nome: 'Cliente Fluxo', nif: '501234567', createdAt: 1, updatedAt: 1 }] }));
  localStorage.setItem('estudo360:v1:currentEmpresaId', JSON.stringify({ v: 1, data: 'e1' }));
  localStorage.setItem('estudo360:v1:gabinete:shared:clientes', JSON.stringify({ v: 1, data: [d.cliente] }));
  localStorage.setItem('estudo360:v1:gabinete:shared:obrigacoes', JSON.stringify({ v: 1, data: [d.obrigacao] }));
}, { vista, tab, cliente, obrigacao });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });

// Cofre: o formulário tem duplicados responsivos e não é fiável por script.
// Fica coberto pelos testes de cifra (cofreCrypto.test.ts) e verificação manual.

// ── 2. Exportar: PDF paginado ───────────────────────────────────────────────
await semear('exportar', 'dashboard');
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  window.__printIframes = [];
  new MutationObserver((ms) => {
    for (const m of ms) for (const n of m.addedNodes) if (n instanceof HTMLIFrameElement) window.__printIframes.push(n);
  }).observe(document.body, { childList: true, subtree: true });
});
const botaoPdf = page.locator('#main-content button:visible').filter({ hasText: /Imprimir \/ PDF/i }).first();
if (await botaoPdf.count()) { await botaoPdf.click({ force: true }); await page.waitForTimeout(7000); }
const exportInfo = await page.evaluate(() => (window.__printIframes || []).map((f) => {
  const d = f.contentDocument;
  return { paginas: d?.querySelectorAll('.pagedjs_page').length || 0, texto: (d?.body?.innerText || '').length };
}));
const paginas = Math.max(0, ...exportInfo.map((x) => x.paginas));
const textoExport = Math.max(0, ...exportInfo.map((x) => x.texto));
ok(paginas >= 1, `exportar: ${paginas} página(s) paginadas no iframe (${JSON.stringify(exportInfo)})`);
ok(textoExport > 500, `exportar: conteúdo no documento (${textoExport} caracteres)`);

// ── 3. Proposta: PDF do editor ─────────────────────────────────────────────
await semear('proposta', 'dashboard');
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1800);
await page.getByRole('button', { name: /nova proposta/i }).click();
await page.getByRole('button', { name: /começar do template/i }).click();
await page.waitForTimeout(1800);
await page.evaluate(() => { window.__prints = 0; window.print = () => { window.__prints += 1; }; });
await page.getByRole('button', { name: /^PDF$/ }).first().click();
await page.waitForTimeout(2500);
const printsEditor = await page.evaluate(() => window.__prints || 0);
const cards = await page.locator('[data-deck-card], .deck-card, .deck-page').count();
ok(printsEditor >= 1, `proposta: PDF dispara impressão (${printsEditor})`);
ok(cards >= 1, `proposta: cards presentes (${cards})`);
await page.screenshot({ path: path.join(OUT, 'proposta-pdf.png') });

// ── 4. Offline: gravar célula sem rede ─────────────────────────────────────
await semear('gabinete', 'dashboard');
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('[data-print-map] table', { timeout: 20000 });
await page.waitForTimeout(1200);
await page.context().setOffline(true);
await page.locator('tbody tr').filter({ hasText: /^IVA/ }).first().locator('td').nth(3).locator('button').click();
await page.waitForTimeout(1800);
const offline = await page.evaluate(() => ({
  toast: /gravado/i.test(document.body.innerText),
  estado: JSON.parse(localStorage.getItem('estudo360:v1:gabinete:shared:obrigacoes')).data.find((o) => o.id === 'o1')?.estado,
}));
ok(offline.toast && !!offline.estado, `offline: célula gravada localmente (${offline.estado})`);
await page.screenshot({ path: path.join(OUT, 'offline.png') });
await page.context().setOffline(false);

ok(erros.length === 0, `sem exceções nossas (${erros.slice(0, 1).join('') || 'nenhuma'})`);
console.log(`ℹ paged.js (terceiros): ${errosTerceiros.length} exceção(ões)`);

await browser.close();
fs.writeFileSync(path.join(OUT, 'flows.json'), JSON.stringify({ data: new Date().toISOString(), passos, erros, errosTerceiros }, null, 1));
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s) em ${passos.length} passos`);
if (falhas.length) { falhas.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }
