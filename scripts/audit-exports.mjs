/**
 * Audita exportações: descarrega o PDF de cada sítio e confirma 1 folha A4.
 * (Fase 1: simuladores + mapa. Os restantes entram na mesma tabela.)
 *
 *   node scripts/audit-exports.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000/?test';
const OUT = path.resolve('docs/audit-2026-10-26/pdf');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
fs.mkdirSync(OUT, { recursive: true });

const paginasDe = (ficheiro) => {
  const bruto = fs.readFileSync(ficheiro).toString('latin1');
  const total = (bruto.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const media = bruto.match(/\/MediaBox\s*\[([^\]]+)\]/);
  return { total, media: media ? media[1].trim() : null, bytes: fs.statSync(ficheiro).size };
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [{ id: 'e1', nome: 'Empresa Exportação', nif: '501234567', createdAt: 1, updatedAt: 1, profile: { nomeCliente: 'Empresa Exportação', nif: '501234567', tipoEntidade: 'lda', faturaçaoAnualPrevista: 180000, nrFuncionarios: 2, regimeContabilidade: 'organizada' } }] }));
  localStorage.setItem('estudo360:v1:currentEmpresaId', JSON.stringify({ v: 1, data: 'e1' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:gabinete:shared:clientes', JSON.stringify({ v: 1, data: [{
    id: 'c1', nome: 'Empresa Exportação', nif: '501234567', tipoEntidade: 'LDA', regimeIva: 'mensal',
    estado: 'ativo', createdAt: 1, updatedAt: 1, empresaId: 'e1', obrigacoesAtivas: ['iva'],
  }] }));
});

for (const [vista, nome] of [['tax', 'fiscal'], ['vehicle', 'viaturas'], ['salario', 'salario']]) {
  await page.evaluate((v) => localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: v })), vista);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2200);
  const botao = page.locator('#main-content button:visible').filter({ hasText: /Descarregar PDF|Imprimir A4/i }).first();
  if (!(await botao.count())) { ok(false, `${nome}: botão de PDF não encontrado`); continue; }
  const descarga = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
  await botao.click({ force: true });
  const dl = await descarga;
  if (!dl) { ok(false, `${nome}: sem download`); continue; }
  const destino = path.join(OUT, `${nome}.pdf`);
  await dl.saveAs(destino);
  const info = paginasDe(destino);
  ok(info.total === 1, `${nome}: 1 página (${info.total}) · ${info.bytes} B · MediaBox ${info.media}`);
}

// Mapa (Quadro) — botão Exportar PDF (jsPDF)
await page.evaluate(() => {
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'gabinete' }));
  localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: 'dashboard' }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('[data-print-map] table', { timeout: 20000 });
const dlMapa = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
await page.locator('#main-content button:visible').filter({ hasText: /Exportar PDF/i }).first().click();
const mapa = await dlMapa;
if (mapa) {
  const destino = path.join(OUT, 'quadro.pdf');
  await mapa.saveAs(destino);
  const info = paginasDe(destino);
  ok(info.total === 1, `quadro: 1 página (${info.total}) · ${info.bytes} B · MediaBox ${info.media}`);
} else ok(false, 'quadro: sem download');

await browser.close();
fs.writeFileSync(path.join(OUT, 'exports.json'), JSON.stringify({ data: new Date().toISOString(), falhas }, null, 1));
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) process.exit(1);
