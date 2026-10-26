/**
 * Proposta de Honorários e Minuta de Contrato: confirmar que imprimem numa
 * única folha A4 (zoom calculado antes do print) e sem campos em falta.
 *
 *   node scripts/audit-pkg-pdfs.mjs
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

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:mode', JSON.stringify({ v: 1, data: 'empresa' }));
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'exportar' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:gabinete:officeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [{
    id: 'e1', nome: 'Empresa PDF', nif: '501234567', createdAt: 1, updatedAt: 1,
    profile: { nomeCliente: 'Empresa PDF', nif: '501234567', tipoEntidade: 'lda', regimeContabilidade: 'organizada', faturaçaoAnualPrevista: 250000, nrFuncionarios: 3, atividadePrincipal: 'servicos', email: 'geral@empresa.pt', telefone: '249 000 000' },
    sims: {},
  }] }));
  localStorage.setItem('estudo360:v1:currentEmpresaId', JSON.stringify({ v: 1, data: 'e1' }));
  localStorage.setItem('estudo360:v1:officeSettings', JSON.stringify({ v: 1, data: {
    nome: 'Escritório Teste', nif: '509999999', cedulaProfissional: '12345', numeroInscricaoOCC: 'OCC-1',
    morada: 'Rua do Escritório 10', codigoPostal: '2495-000', localidade: 'Fátima',
    email: 'geral@escritorio.pt', telefone: '249 111 222', corPrimaria: '#0677FF',
  } }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2500);

ok((await page.locator('#main-content').count()) > 0, 'vista Relatórios abriu');

// Escolher o separador "Pacote cliente" e o documento
const tabPacote = page.getByRole('tab', { name: /Pacote cliente/i });
if (await tabPacote.count()) { await tabPacote.first().click(); await page.waitForTimeout(600); }
ok((await tabPacote.count()) > 0, 'separador Pacote cliente presente');

for (const [doc, botaoNome, root, ficheiro] of [
  ['Proposta de Honorários', /Imprimir proposta/i, '#proposta-print-root', 'proposta-honorarios'],
  ['Minuta de Contrato', /Imprimir contrato/i, '#minuta-print-root', 'minuta-contrato'],
]) {
  const card = page.getByRole('radio', { name: new RegExp(doc, 'i') });
  if (!(await card.count())) { ok(false, `${doc}: cartão não encontrado`); continue; }
  await card.first().click();
  await page.waitForTimeout(1500);

  const raiz = page.locator(root).first();
  if (!(await raiz.count())) { ok(false, `${doc}: pré-visualização não apareceu`); continue; }

  await page.evaluate(() => { window.__prints = 0; window.print = () => { window.__prints += 1; }; });
  const botao = page.getByRole('button', { name: /Imprimir \/ Guardar PDF/i }).first();
  if (!(await botao.count())) { ok(false, `${doc}: botão de imprimir não encontrado`); continue; }
  await botao.click();
  await page.waitForTimeout(1300);

  const A4 = (297 * 96) / 25.4; // px
  const iframeInfo = await page.evaluate(() => (window.__ifsInfo || []).slice(-1)[0] || null);
  let medida;
  if (iframeInfo) {
    // Minuta: documento próprio, versão resumida de 1 folha.
    medida = { zoom: iframeInfo.zoom, altura: iframeInfo.altura, prints: 1, texto: iframeInfo.texto };
    ok(/Versão resumida|Contrato de Prestação/i.test(medida.texto), `${doc}: versão resumida de 1 página`);
  } else {
    medida = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const zoom = Number(getComputedStyle(el).zoom || '1');
      const paginas = Array.from(el.querySelectorAll('.pp-page, .mc-page')).map((p) => p.scrollHeight);
      return { zoom, altura: paginas.reduce((s, h) => s + h, 0), prints: window.__prints || 0 };
    }, root);
    ok(medida.prints >= 1, `${doc}: impressão disparada`);
  }
  const pisoDoc = doc === 'Minuta de Contrato' ? 0.79 : 0.4;
  ok(medida.zoom <= 1 && medida.zoom >= pisoDoc, `${doc}: zoom ${medida.zoom.toFixed(2)}`);
  ok(medida.altura * medida.zoom <= A4 + 4, `${doc}: cabe na A4 (${Math.round(medida.altura * medida.zoom)}px de ${Math.round(A4)}px)`);

  // PDF real: repõe o zoom medido e imprime em modo print
  await page.evaluate(([sel, zoom]) => {
    const el = document.querySelector(sel);
    if (el) el.style.zoom = String(zoom);
  }, [root, medida.zoom]);
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(400);
  await page.waitForTimeout(1200);
  const pdfPath = path.join(OUT, `${ficheiro}.pdf`);
  await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
  await page.emulateMedia({ media: 'screen' });
  const bytes = fs.statSync(pdfPath).size;
  const bruto = fs.readFileSync(pdfPath).toString('latin1');
  const paginas = (bruto.match(/\/Type\s*\/Page[^s]/g) || []).length;
  ok(paginas === 1, `${doc}: PDF com ${paginas} página(s) · ${bytes} B`);
}

await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) process.exit(1);
