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
const OUT = path.resolve('docs/audit-2026-11-03/word');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
fs.mkdirSync(OUT, { recursive: true });

const DOCS = [
  ['df', 'Demonstração dos Resultados', 'dr', '01-demonstracao-resultados'],
  ['df', 'Alterações no Capital Próprio', 'alteracoes', '02-alteracoes-capital-proprio'],
  ['df', 'Fluxos de Caixa', 'fluxos', '03-fluxos-caixa'],
  ['df', 'Balanço', 'balanco', '04-balanco'],
  ['df', 'Demonstrações Financeiras — Síntese', 'df', '05-demonstracoes-financeiras-sintese'],
  ['fecho', 'Ata de Assembleia', 'acta', '06-ata-assembleia-geral'],
  ['fecho', 'Declaração de Responsabilidade', 'declaracao', '07-declaracao-responsabilidade'],
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
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
    id: 'e1', nome: 'Empresa Exemplo, Lda.', nif: '501234567', createdAt: 1, updatedAt: 1,
    profile: {
      nomeCliente: 'Empresa Exemplo, Lda.',
      nif: '501234567',
      tipoEntidade: 'lda',
      regimeContabilidade: 'organizada',
      faturaçaoAnualPrevista: 285000,
      nrFuncionarios: 6,
      localidade: 'Fátima',
      contabilidade: {
        ativoFixoTangivel: 78000, ativoIntangivel: 12000, investimentosFinanceiros: 15000,
        inventarios: 22000, clientes: 64000, estadoOutrosAtivo: 8500, outrosAtivosCorrentes: 3500,
        caixaDepositos: 47000, capitalRealizado: 50000, reservasResultadosTransitados: 38000,
        outrasVariacoesCapital: 5000, resultadoLiquido: 58500, financiamentosObtidos: 42000,
        fornecedores: 29500, estadoOutrosPassivo: 14800, outrosPassivos: 7200,
        fcRecebimentosClientes: 260000, fcPagamentosFornecedores: 84000, fcPagamentosPessoal: 92000,
        fcImpostoRendimento: 12500, fcOutrosOperacionais: 3000, fcPagamentosInvestimento: 18000,
        fcRecebimentosInvestimento: 2500, fcFinanciamentosObtidos: 12000, fcPagamentosFinanciamento: 9500,
        fcRealizacoesCapital: 0,
      },
      contabilidadeAbertura: {
        ativoFixoTangivel: 65000, ativoIntangivel: 14000, investimentosFinanceiros: 15000,
        inventarios: 19000, clientes: 58000, estadoOutrosAtivo: 7000, outrosAtivosCorrentes: 3200,
        caixaDepositos: 39000, capitalRealizado: 50000, reservasResultadosTransitados: 30000,
        outrasVariacoesCapital: 4000, resultadoLiquido: 48000, financiamentosObtidos: 39000,
        fornecedores: 25000, estadoOutrosPassivo: 12000, outrosPassivos: 6200,
      },
      societaria: {
        capitalSocial: 50000,
        gerenteNome: 'Ana Martins',
        socios: [{ nome: 'Ana Martins', percentagem: 60 }, { nome: 'Rui Martins', percentagem: 40 }],
      },
    },
    previsa: {
      periodo: 2025, volumeNegocios: 285000, rai_711: 235000, rai_712: 20000, rai_72: 30000,
      rai_75: 0, rai_74: 0, rai_cmv: 22000, rai_cmc: 0, rai_62: 68000, rai_63: 92000,
      rai_64: 19000, rai_65: 0, rai_66: 6000, rai_67: 0, rai_68: 0, rai_69: 5200,
      rai_76: 0, rai_77: 0, rai_78: 0, rai_79: 0, c701_rai: 72800,
      regime: 'geral', isPME: true, territorio: 'continental', taxaDerramaMunicipal: 0.015,
    },
    sims: {},
  }] }));
  localStorage.setItem('estudo360:v1:currentEmpresaId', JSON.stringify({ v: 1, data: 'e1' }));
  const officeSettings = {
    tipo: 'sociedade',
    nome: 'Escritório Teste', nif: '509999999', cedulaProfissional: '12345', numeroInscricaoOCC: 'OCC-1',
    contabilistaResponsavel: 'Marta Silva', representanteLegal: 'Marta Silva',
    morada: 'Rua X', codigoPostal: '2495-000', localidade: 'Fátima',
    email: 'geral@escritorio.pt', telefone: '249 111 222', corPrimaria: '#0677FF',
  };
  localStorage.setItem('estudo360:v1:officeSettings', JSON.stringify({ v: 1, data: officeSettings }));
  localStorage.setItem('estudo360:v1:gabinete:officeSettings:audit-office', JSON.stringify({ v: 1, data: officeSettings }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2500);

for (const [tab, label, id, filename] of DOCS) {
  await page.getByRole('tab', { name: tab === 'df' ? /Demonstrações/i : /Encerramento/i }).first().click();
  await page.waitForTimeout(500);
  const card = page.getByRole('radio', { name: new RegExp(label, 'i') }).first();
  if (!(await card.count())) { ok(false, `${label}: cartão não encontrado`); continue; }
  await card.click();
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    window.__ifs = [];
    window.__ifsInfo = [];
    window.__ifsHtml = [];
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
            window.__ifsHtml.push(d.documentElement.outerHTML);
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

  const html = await page.evaluate(() => (window.__ifsHtml || []).slice(-1)[0] || '');
  if (html) {
    const coletor = await context.newPage();
    await coletor.setContent(html, { waitUntil: 'load' });
    await coletor.waitForTimeout(350);
    const pdfPath = path.join(OUT, `${filename}.pdf`);
    await coletor.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
    await coletor.close();
    const pdf = fs.readFileSync(pdfPath).toString('latin1');
    const paginas = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(paginas === 1, `${label}: ficheiro PDF com ${paginas} página(s)`);
  } else {
    ok(false, `${label}: HTML do documento não capturado`);
  }
}

await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) process.exit(1);
