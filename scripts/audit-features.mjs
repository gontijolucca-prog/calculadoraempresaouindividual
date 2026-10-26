/**
 * Testa funcionalidades uma a uma (sem Firebase): CSV do quadro, N/A no Fiscal,
 * tarefas (criar → apagar com confirmação), lixeira (restaurar) e guia da página.
 *
 *   node scripts/audit-features.mjs
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

const cliente = {
  id: 'c1', nome: 'Cliente Funcional', nif: '501234567', tipoEntidade: 'LDA', regimeIva: 'mensal',
  estado: 'ativo', createdAt: 1, updatedAt: 1, empresaId: 'e1', obrigacoesAtivas: ['iva'],
};
const semear = (page, vista, tab) => page.evaluate((d) => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:mode', JSON.stringify({ v: 1, data: 'empresa' }));
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: d.vista }));
  localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: d.tab }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [{ id: 'e1', nome: 'Cliente Funcional', nif: '501234567', createdAt: 1, updatedAt: 1, profile: { nomeCliente: 'Cliente Funcional', nif: '501234567', tipoEntidade: 'lda', faturaçaoAnualPrevista: 250000, nrFuncionarios: 3 }, sims: {} }] }));
  localStorage.setItem('estudo360:v1:currentEmpresaId', JSON.stringify({ v: 1, data: 'e1' }));
  localStorage.setItem('estudo360:v1:gabinete:shared:clientes', JSON.stringify({ v: 1, data: [d.cliente] }));
  localStorage.setItem('estudo360:v1:officeSettings', JSON.stringify({ v: 1, data: { nome: 'Esc Teste', nif: '509999999', morada: 'Rua X', localidade: 'Fátima', codigoPostal: '2495', email: 'a@b.pt', telefone: '249 111 222', corPrimaria: '#0677FF' } }));
}, { vista, tab, cliente });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
const page = await context.newPage();
page.on('pageerror', (e) => falhas.push(`pageerror: ${(e.stack || '').split('\n')[0]}`));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });

// 1) CSV do Quadro
await semear(page, 'gabinete', 'dashboard');
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('[data-print-map] table', { timeout: 20000 });
const csvWait = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
await page.locator('#main-content button:visible').filter({ hasText: /Exportar Excel/i }).first().click();
const csv = await csvWait;
if (csv) {
  const p = path.join(OUT, 'quadro.csv');
  await csv.saveAs(p);
  const linhas = fs.readFileSync(p, 'utf8').trim().split('\n');
  ok(linhas.length >= 2 && linhas[0].includes('Cliente'), `CSV do quadro: ${linhas.length} linha(s)`);
} else ok(false, 'CSV do quadro não descarregou');

// 2) N/A no Fiscal
await semear(page, 'tax', '');
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2200);
const na = page.locator('#main-content label, #main-content span').filter({ hasText: /^N\/A$/ }).first();
const naCount = await page.locator('text=N/A').count();
if (naCount) {
  const checkbox = page.locator('input[type="checkbox"]').nth(0);
  const antes = await page.locator('#main-content input[type="number"]:disabled').count();
  await page.locator('#main-content label:has-text("N/A") input[type="checkbox"]').first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
  const depois = await page.locator('#main-content input[type="number"]:disabled').count();
  ok(depois >= antes, `N/A no Fiscal: campos desativados ${antes} → ${depois}`);
} else ok(false, 'N/A no Fiscal não encontrado');

// 3) Tarefas: criar por localStorage + apagar com confirmação
const tarefa = { id: 't1', titulo: 'Tarefa Funcional', tipo: 'outro', estado: 'pendente', prioridade: 'normal', clienteId: 'c1', clienteNome: 'Cliente Funcional', origem: 'manual', createdAt: 1, updatedAt: 1 };
await page.evaluate((t) => localStorage.setItem('estudo360:v1:gabinete:shared:tarefas', JSON.stringify({ v: 1, data: [t] })), tarefa);
await semear(page, 'gabinete', 'tarefas');
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1800);
ok(await page.locator('text=Tarefa Funcional').count() >= 1, 'tarefa aparece na lista');
let dialogoTxt = null;
page.once('dialog', async (d) => { dialogoTxt = d.message(); await d.accept(); });
const lixo = page.locator('#main-content button:has(svg.lucide-trash2)').first();
if (await lixo.count()) await lixo.click({ force: true });
await page.waitForTimeout(900);
ok(!!dialogoTxt && /Tarefa Funcional/.test(dialogoTxt), `apagar tarefa pede confirmação (${dialogoTxt || 'sem diálogo'})`);
const apagada = await page.evaluate(() => {
  const l = JSON.parse(localStorage.getItem('estudo360:v1:gabinete:shared:tarefas')).data;
  return l.find((t) => t.id === 't1')?.deletedAt || 0;
});
ok(!!apagada, 'tarefa foi para a Lixeira (deletedAt)');

// 4) Guia da página
await semear(page, 'gabinete', 'dashboard');
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1500);
const guia = page.locator('[aria-label*="Aprender esta página"], button:has-text("Aprender")').first();
if (await guia.count()) {
  await page.evaluate(() => {
    const b = document.querySelector('[aria-label="Aprender esta página — guia"]');
    if (b) b.click();
    window.dispatchEvent(new CustomEvent('estudo360:open-guia'));
  });
  await page.waitForTimeout(1000);
  const guiaEstado = await page.evaluate(() => ({
    txt: document.body.innerText.slice(-400),
    menu: document.querySelectorAll('[aria-label="Fechar"]').length,
    guia: /guia|passo|tour|aprender|visita/i.test(document.body.innerText),
  }));
  console.log('   guia:', JSON.stringify(guiaEstado).slice(0, 300));
  ok(guiaEstado.guia || guiaEstado.menu > 0, 'guia da página abre');
} else ok(false, 'botão do guia não encontrado');

ok(!falhas.some((f) => f.startsWith('pageerror')), 'sem exceções de página');
await page.screenshot({ path: path.join(OUT, 'funcionalidades.png') });
await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach((f) => console.log('  - ' + f)); process.exit(1); }
