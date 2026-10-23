/**
 * Prova do lote da reunião de 16/10 no que já está feito:
 *  1. Célula isolada — marcar uma célula não acende outras (o bug dos "checks
 *     aleatórios").
 *  2. Pilares por empresa — mexer nos pilares de um cliente não toca nos outros.
 *  3. Confirmação por alteração — cada gravação mostra aviso.
 *  4. SAF-T no sino — datas online visíveis.
 *
 *   node scripts/verify-reuniao-1610.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000/?test';
const OUT = path.resolve('scripts/out');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const env = (data) => JSON.stringify({ v: 1, data });
const dia = (a, m, d) => new Date(a, m - 1, d, 12, 0, 0).getTime();

const clientes = [
  {
    id: 'c1', nome: 'Cliente Alfa', nif: '501234567', tipoEntidade: 'LDA', regimeIva: 'mensal',
    estado: 'ativo', createdAt: 1, updatedAt: 1, empresaId: 'e1',
    obrigacoesAtivas: ['iva', 'saft', 'dossier'],
  },
  {
    id: 'c2', nome: 'Cliente Beta', nif: '502345678', tipoEntidade: 'LDA', regimeIva: 'mensal',
    estado: 'ativo', createdAt: 2, updatedAt: 2, empresaId: 'e2',
    obrigacoesAtivas: ['iva', 'saft', 'dossier'],
  },
];

const obrigacoes = [
  // três obrigações no mesmo mês, de linhas diferentes — o teste é marcar uma
  { id: 'o-iva', tipo: 'iva', catalogoId: 'iva', titulo: 'IVA 03/2026', clienteId: 'c1', clienteNome: 'Cliente Alfa', periodo: '2026-03', vencimento: dia(2026, 3, 20), estado: 'pendente', origem: 'cliente', createdAt: 10, updatedAt: 10 },
  { id: 'o-saft', tipo: 'saft', catalogoId: 'saft', titulo: 'SAF-T 03/2026', clienteId: 'c1', clienteNome: 'Cliente Alfa', periodo: '2026-03', vencimento: dia(2026, 3, 5), estado: 'pendente', origem: 'cliente', createdAt: 11, updatedAt: 11 },
  { id: 'o-dossie', tipo: 'dossier', catalogoId: 'dossier', titulo: 'Dossier 03/2026', clienteId: 'c1', clienteNome: 'Cliente Alfa', periodo: '2026-03', vencimento: dia(2026, 3, 10), estado: 'pendente', origem: 'cliente', createdAt: 12, updatedAt: 12 },
  // legado sem catalogoId, mesmo mês — não pode ser reclamado por duas linhas
  { id: 'o-leg', tipo: 'dossier', titulo: 'Dossier legado 03/2026', clienteId: 'c1', clienteNome: 'Cliente Alfa', periodo: '2026-03', vencimento: dia(2026, 3, 12), estado: 'pendente', origem: 'cliente', createdAt: 13, updatedAt: 13 },
];

const seed = `
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:lastView', ${JSON.stringify(env('gabinete'))});
  localStorage.setItem('estudo360:v1:gabineteTab', ${JSON.stringify(env('dashboard'))});
  localStorage.setItem('estudo360:v1:gabinete:activeId', ${JSON.stringify(env('test-office'))});
  localStorage.setItem('estudo360:v1:gabinete:shared:clientes', ${JSON.stringify(env(clientes))});
  localStorage.setItem('estudo360:v1:gabinete:shared:obrigacoes', ${JSON.stringify(env(obrigacoes))});
`;

const falhas = [];
const ok = (cond, msg) => { console.log(`${cond ? '✓' : '✗'} ${msg}`); if (!cond) falhas.push(msg); };
const ler = (page, chave) => page.evaluate((k) => {
  const raw = localStorage.getItem(k);
  return raw ? JSON.parse(raw).data : null;
}, chave);

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => falhas.push(`pageerror: ${e.message}`));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(seed);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('[data-print-map] table', { timeout: 30000 });

// ── 1. Célula isolada ────────────────────────────────────────────────────────
const linhaIva = page.locator('tbody tr').filter({ hasText: 'IVA' }).first();
const celulaMar = linhaIva.locator('td').nth(3); // 0 = nome da obrigação
const antes = await page.locator('tbody [title="Concluído"]').count();
await celulaMar.locator('button').click();
await page.waitForTimeout(1200);
const depois = await page.locator('tbody [title="Concluído"]').count();
const marcadasNaLinha = await linhaIva.locator('[title="Concluído"]').count();

ok(antes === 0, `antes havia ${antes} célula(s) concluída(s)`);
ok(depois === 1, `depois de marcar há exatamente ${depois} célula(s) concluída(s) — não acende outras`);
ok(marcadasNaLinha === 1, 'a célula marcada é a da linha IVA em março');

// ── 3. Confirmação por alteração ─────────────────────────────────────────────
const toast = await page.locator('[role="status"], .toast, [class*="toast"]').allInnerTexts().catch(() => []);
const textoEcrã = await page.evaluate(() => document.body.innerText);
ok(/gravado/i.test(textoEcrã) || toast.some(t => /gravado/i.test(t)), 'a alteração mostra confirmação ("gravado")');

// ── 2. Pilares por empresa ───────────────────────────────────────────────────
await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify({ v: 1, data: v })), ['estudo360:v1:gabineteTab', 'mapa-rh']);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('[data-print-map] table', { timeout: 30000 });
await page.getByRole('button', { name: /Pilares por empresa/i }).first().click();
await page.waitForSelector('text=Pilares · Mapa RH', { timeout: 10000 });
await page.locator('div.fixed select').first().selectOption('c1');
await page.waitForTimeout(400);
const caixaPilar = page.locator('div.rounded-lg.border').filter({ hasText: 'Salários' }).first();
const checkboxPilar = caixaPilar.locator('input[type="checkbox"]').first();
const estavaAtivo = await checkboxPilar.isChecked();
await checkboxPilar.click();
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, 'pilares-por-empresa.png') });

const clientesDepois = await ler(page, 'estudo360:v1:gabinete:shared:clientes');
const alfa = clientesDepois.find(c => c.id === 'c1');
const beta = clientesDepois.find(c => c.id === 'c2');
const rhAlfa = alfa?.mapas?.rh;
ok(Array.isArray(rhAlfa) && rhAlfa.length > 0, `cliente Alfa ficou com pilares próprios (${rhAlfa?.length ?? 0})`);
ok(rhAlfa?.some(p => p.ativo === !estavaAtivo), 'o pilar alterado ficou com o estado novo só no Alfa');
ok(!beta?.mapas?.rh, 'cliente Beta continua a usar os pilares do gabinete (não foi tocado)');

// ── 4. SAF-T no sino ─────────────────────────────────────────────────────────
await page.keyboard.press('Escape');
await page.locator('button[aria-label*="otifica"], button[title*="otifica"]').first().click().catch(() => {});
await page.waitForTimeout(600);
const sino = await page.evaluate(() => document.body.innerText);
ok(/SAF-T/i.test(sino), 'sino mostra a secção SAF-T online');
await page.screenshot({ path: path.join(OUT, 'sino-saft.png') });

// ── 3b. Confirmação antes de apagar (tarefa) ────────────────────────────────
const tarefaSeed = [{
  id: 't1', titulo: 'Tarefa a apagar', tipo: 'outro', estado: 'pendente', prioridade: 'normal',
  clienteId: 'c1', clienteNome: 'Cliente Alfa', origem: 'manual', createdAt: 1, updatedAt: 1,
}];
await page.evaluate(([tarefas, empresa]) => {
  localStorage.setItem('estudo360:v1:gabinete:shared:tarefas', JSON.stringify({ v: 1, data: tarefas }));
  localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: 'tarefas' }));
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [empresa] }));
  localStorage.setItem('estudo360:v1:currentEmpresaId', JSON.stringify({ v: 1, data: 'e1' }));
}, [tarefaSeed, { id: 'e1', nome: 'Cliente Alfa', nif: '501234567', createdAt: 1, updatedAt: 1 }]);
await page.reload({ waitUntil: 'load' });

let dialogo = null;
page.once('dialog', async (d) => { dialogo = d.message(); await d.accept(); });
const botaoApagar = page.locator('#main-content button').filter({ has: page.locator('svg.lucide-trash2, svg.lucide-trash-2') }).first();
await botaoApagar.waitFor({ timeout: 20000 });
await botaoApagar.click();
await page.waitForTimeout(800);
ok(!!dialogo && /Tarefa a apagar/.test(dialogo), `apagar tarefa pede confirmação ("${dialogo}")`);

await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach(f => console.log(`  - ${f}`)); process.exit(1); }
