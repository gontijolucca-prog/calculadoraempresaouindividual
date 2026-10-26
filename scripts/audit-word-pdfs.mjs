/**
 * Documentos Word (Demonstrações / Encerramento): confirmar que cada um é
 * impresso numa só folha A4 através do novo motor (zoom medido, sem paged.js).
 *
 *   node scripts/audit-word-pdfs.mjs
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

const DOCS = [
  ['df', 'Demonstração dos Resultados', 'dr'],
  ['df', 'Alterações no Capital Próprio', 'alteracoes'],
  ['df', 'Fluxos de Caixa', 'fluxos'],
  ['df', 'Balanço', 'balanco'],
  ['df', 'Demonstrações Financeiras', 'df'],
  ['fecho', 'Ata de Assembleia', 'acta'],
  ['fecho', 'Declaração de Responsabilidade', 'declaracao'],
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', e => console.log('PAGEERROR', (e.stack||'').split('\n')[0]));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE', m.text().slice(0,160)); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:mode', JSON.stringify({ v: 1, data: 'empresa' }));
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'exportar' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:gabinete:officeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [{
    id: 'e1', nome: 'Empresa PDF', nif: '501234567', createdAt: 1, updatedAt: 1,
    profile: { nomeCliente: 'Empresa PDF', nif: '501234567', tipoEntidade: 'lda', regimeContabilidade: 'organizada', faturaçaoAnualPrevista: 250000, nrFuncionarios: 3 },
    sims: {},
  }] }));
  localStorage.setItem('estudo360:v1:currentEmpresaId', JSON.stringify({ v: 1, data: 'e1' }));
  localStorage.setItem('estudo360:v1:officeSettings', JSON.stringify({ v: 1, data: {
    nome: 'Escritório Teste', nif: '509999999', cedulaProfissional: '12345', numeroInscricaoOCC: 'OCC-1',
    morada: 'Rua X', codigoPostal: '2495-000', localidade: 'Fátima',
    email: 'geral@escritorio.pt', telefone: '249 111 222', corPrimaria: '#0677FF',
  } }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2500);

for (const [tab, label, id] of DOCS) {
  await page.getByRole('tab', { name: tab === 'df' ? /Demonstrações/i : /Encerramento/i }).first().click();
  await page.waitForTimeout(500);
  const card = page.getByRole('radio', { name: new RegExp(label, 'i') }).first();
  if (!(await card.count())) { ok(false, `${label}: cartão não encontrado`); continue; }
  await card.click();
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    window.__ifs = [];
    window.__ifsInfo = [];
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (!(n instanceof HTMLIFrameElement)) continue;
        window.__ifs.push(n);
        // Mede antes de o iframe ser removido (1,2 s depois de imprimir).
        setTimeout(() => {
          try {
            const d = n.contentDocument;
            if (!d || !d.body) return;
            window.__ifsInfo.push({
              zoom: Number(getComputedStyle(d.body).zoom || '1'),
              altura: Math.max(d.body.scrollHeight, d.documentElement.scrollHeight),
            });
          } catch { /* iframe já removido */ }
        }, 700);
      }
    }).observe(document.body, { childList: true, subtree: true });
  });

  const botao = page.getByRole('button', { name: /Imprimir \/ PDF|Imprimir \/ Guardar PDF/i }).first();
  if (!(await botao.count())) { ok(false, `${label}: botão de imprimir não encontrado`); continue; }
  await botao.click();
  await page.waitForTimeout(500);
  console.log('   estado:', await page.evaluate(() => JSON.stringify({
    txt: (document.body.innerText.match(/A preparar[^\n]*/) || ['-'])[0],
    iframes: document.querySelectorAll('iframe').length,
    capturados: (window.__ifs || []).length,
    observer: typeof MutationObserver,
  })));
  await page.waitForTimeout(1800);

  const medida = await page.evaluate(() => {
    const info = window.__ifsInfo || [];
    return info[info.length - 1] || null;
  });

  if (!medida) { ok(false, `${label}: iframe de impressão não encontrado`); continue; }
  const A4 = (297 * 96) / 25.4;
  const ocupado = medida.altura * medida.zoom;
  ok(medida.zoom >= 0.41 && medida.zoom <= 1, `${label}: zoom ${medida.zoom.toFixed(2)}`);
  ok(ocupado <= A4 * 1.01, `${label}: cabe na A4 (${Math.round(ocupado)}px de ${Math.round(A4)}px)`);
}

await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) process.exit(1);
