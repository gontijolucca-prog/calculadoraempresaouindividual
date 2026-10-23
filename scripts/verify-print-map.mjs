/**
 * Prova real do "Imprimir" dos mapas: o papel leva só o quadro, não a app.
 *
 * Corre contra o dev server (http://localhost:3000). Semeia dados no
 * localStorage e usa o bypass de auth de desenvolvimento (`?test`).
 *
 *   node scripts/verify-print-map.mjs
 *
 * Saídas em scripts/out/: screenshot do modo impressão + PDF A4 + recorte 375.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000/?test';
const OUT = path.resolve('scripts/out');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const env = (data) => JSON.stringify({ v: 1, data });

const empresas = [{ id: 'e1', nome: 'Cliente A', nif: '501234567', createdAt: 1, updatedAt: 1, profile: { nomeCliente: 'Cliente A', nif: '501234567' }, sims: {} }];

const clientes = [{
  id: 'c1', nome: 'Cliente A', nif: '501234567', tipoEntidade: 'LDA', regimeIva: 'trimestral',
  estado: 'ativo', createdAt: 1, updatedAt: 1, empresaId: 'e1',
  obrigacoesAtivas: ['iva', 'saft', 'dmr'],
}];

const obrigacoes = [
  { id: 'iva1', tipo: 'iva', catalogoId: 'iva', titulo: 'IVA 03/2026', clienteId: 'c1', clienteNome: 'Cliente A', periodo: '2026-03', vencimento: new Date(2026, 2, 20).getTime(), estado: 'concluida', origem: 'cliente', createdAt: 3, updatedAt: 3 },
  { id: 'saft1', tipo: 'saft', catalogoId: 'saft', titulo: 'SAF-T 02/2026', clienteId: 'c1', clienteNome: 'Cliente A', periodo: '2026-02', vencimento: new Date(2026, 1, 5).getTime(), estado: 'atrasada', origem: 'cliente', createdAt: 4, updatedAt: 4 },
];

const seed = `
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:lastView', ${JSON.stringify(env('gabinete'))});
  localStorage.setItem('estudo360:v1:gabineteTab', ${JSON.stringify(env('dashboard'))});
  localStorage.setItem('estudo360:v1:gabinete:activeId', ${JSON.stringify(env('test-office'))});
  localStorage.setItem('estudo360:v1:gabinete:shared:clientes', ${JSON.stringify(env(clientes))});
`;

const falhas = [];
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) falhas.push(msg); };

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
page.on('pageerror', (e) => falhas.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') falhas.push(`console: ${m.text().slice(0, 200)}`); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(seed);
await page.reload({ waitUntil: 'load' });

// Quadro resumo do dashboard
await page.waitForSelector('[data-print-map] table', { timeout: 30000 });
await page.screenshot({ path: path.join(OUT, 'quadro-1440.png'), fullPage: false });

// Sem diálogo de impressão em headless: substituímos window.print para o
// contentor de impressão não ser limpo pelo evento afterprint antes de o
// podermos fotografar/medir. O resto do fluxo é o real (handler → clone → CSS).
await page.evaluate(() => { window.print = () => {}; });

// O botão Imprimir do cartão do quadro
const botao = page.locator('[data-print-scope] button', { hasText: 'Imprimir' }).first();
await botao.click();

await page.waitForSelector('#print-holder table', { timeout: 10000 });
const estado = await page.evaluate(() => {
  const holder = document.querySelector('#print-holder');
  return {
    linhasNoClone: holder?.querySelectorAll('tbody tr').length ?? 0,
    temFiltrosNoClone: !!holder?.querySelector('input, select'),
    bodyComClasse: document.body.classList.contains('printing-target'),
    titulo: document.title,
  };
});

// Modo impressão: é isto que sai no papel
await page.emulateMedia({ media: 'print' });
const noPapel = await page.evaluate(() => {
  const appRoot = document.body.querySelector(':scope > #root, :scope > div:not(#print-holder)');
  const visivel = (el) => !!el && el.getBoundingClientRect().width > 0;
  return {
    appDisplay: appRoot ? getComputedStyle(appRoot).display : 'sem-root',
    holderVisivel: visivel(document.querySelector('#print-holder')),
    sidebarVisivel: visivel(document.querySelector('aside, nav')),
    colunas: document.querySelectorAll('#print-holder thead th').length,
    toolbarEscondida: (() => {
      const b = document.querySelector('#print-holder [data-print-toolbar] button');
      return !!b && getComputedStyle(b).display === 'none';
    })(),
    simbolos: (document.querySelector('#print-holder tbody')?.innerText || '').trim(),
  };
});
await page.screenshot({ path: path.join(OUT, 'impressao-quadro.png'), fullPage: true });
await page.pdf({ path: path.join(OUT, 'quadro.pdf'), format: 'A4', landscape: true, printBackground: true });
await page.emulateMedia({ media: 'screen' });

ok(estado.linhasNoClone > 0, `clone tem ${estado.linhasNoClone} linha(s) de dados`);
ok(noPapel.toolbarEscondida, 'botões da barra (Imprimir/Excel/PDF) escondidos no papel');
ok(/✓|✕|—/.test(noPapel.simbolos), 'células levam os símbolos ✓/✕/— (não saem em branco)');
ok(!estado.temFiltrosNoClone, 'clone não leva filtros/inputs do ecrã');
ok(estado.bodyComClasse, 'body recebeu a classe printing-target');
ok(noPapel.appDisplay === 'none', `resto da app escondido no papel (display=${noPapel.appDisplay})`);
ok(noPapel.holderVisivel, 'clone visível no papel');
ok(!noPapel.sidebarVisivel, 'menu lateral não aparece no papel');
ok(noPapel.colunas >= 13, `tabela com ${noPapel.colunas} colunas (cliente + 12 meses)`);
ok(/Quadro/i.test(estado.titulo), `título do documento = "${estado.titulo}"`);

const pdfBytes = fs.statSync(path.join(OUT, 'quadro.pdf')).size;
ok(pdfBytes > 8000, `PDF gerado com ${pdfBytes} bytes`);

// Exportar PDF do mesmo mapa continua a funcionar (não foi tocado)
const descarga = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
await page.locator('[data-print-scope] button', { hasText: 'Exportar PDF' }).first().click();
const dl = await descarga;
if (dl) {
  const destino = path.join(OUT, 'quadro-export.pdf');
  await dl.saveAs(destino);
  ok(fs.statSync(destino).size > 8000, `Exportar PDF gera ficheiro (${fs.statSync(destino).size} bytes)`);
} else {
  ok(false, 'Exportar PDF não gerou download');
}

// Os outros dois mapas usam o mesmo mecanismo — imprimem o próprio quadro
for (const [tab, titulo] of [['mapa-controlo', 'Mapa de Controlo'], ['mapa-rh', 'Mapa RH']]) {
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify({ v: 1, data: v })), ['estudo360:v1:gabineteTab', tab]);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('[data-print-map] table', { timeout: 30000 });
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('[data-print-scope] button', { hasText: 'Imprimir' }).first().click();
  await page.waitForSelector('#print-holder table', { timeout: 10000 });
  await page.emulateMedia({ media: 'print' });
  const r = await page.evaluate(() => ({
    titulo: document.title,
    colunas: document.querySelectorAll('#print-holder thead th').length,
    appEscondida: getComputedStyle(document.body.querySelector(':scope > #root, :scope > div:not(#print-holder)')).display === 'none',
  }));
  await page.screenshot({ path: path.join(OUT, `${tab}-impressao.png`), fullPage: false });
  await page.emulateMedia({ media: 'screen' });
  ok(new RegExp(titulo, 'i').test(r.titulo), `${tab}: título "${r.titulo}"`);
  ok(r.appEscondida, `${tab}: só o mapa no papel`);
  ok(r.colunas >= 13, `${tab}: ${r.colunas} colunas`);
}

// Recorte móvel do ecrã normal (o print não pode ter mudado o layout)
await page.reload({ waitUntil: 'load' });
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForSelector('[data-print-map] table', { timeout: 30000 });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(overflow <= 1, `375px sem overflow horizontal (${overflow}px)`);
await page.screenshot({ path: path.join(OUT, 'quadro-375.png'), fullPage: false });

await browser.close();

console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { for (const f of falhas) console.log(`  - ${f}`); process.exit(1); }
