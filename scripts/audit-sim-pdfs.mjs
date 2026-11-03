/**
 * Testa o PDF de cada simulador: preenche o formulário, simula, descarrega e
 * confirma que sai numa única folha A4.
 *
 *   node scripts/audit-sim-pdfs.mjs            (todos)
 *   node scripts/audit-sim-pdfs.mjs --only=irs (um)
 *
 * Os valores são de teste (não servem para validar cálculos) — servem para o
 * formulário aceitar e o PDF ser gerado.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000/?test';
const OUT = path.resolve('docs/audit-2026-10-26/pdf');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '';

const VISTAS = [
  ['tax', 'Fiscal'], ['vehicle', 'Viaturas'], ['ticket', 'Tickets'], ['selfss', 'SS Independente'],
  ['diagnostico', 'Diagnóstico'], ['imoveis', 'Imóveis'], ['imt', 'IMT'], ['salario', 'Salário'],
  ['irs', 'IRS'], ['previsa', 'PreviSa'], ['aquisicao', 'Aquisição'],
];

const falhas = [];
const resultados = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
fs.mkdirSync(OUT, { recursive: true });

const paginasDe = (ficheiro) => {
  const bruto = fs.readFileSync(ficheiro).toString('latin1');
  return {
    paginas: (bruto.match(/\/Type\s*\/Page[^s]/g) || []).length,
    media: (bruto.match(/\/MediaBox\s*\[([^\]]+)\]/) || [])[1]?.trim() || null,
    bytes: fs.statSync(ficheiro).size,
  };
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
const page = await context.newPage();

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
await page.evaluate(() => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [{
    id: 'e1', nome: 'Empresa Exemplo, Lda.', nif: '501234567', createdAt: 1, updatedAt: 1,
    profile: {
      nomeCliente: 'Empresa Exemplo, Lda.', nif: '501234567', tipoEntidade: 'lda', regimeContabilidade: 'organizada',
      faturaçaoAnualPrevista: 180000, nrFuncionarios: 3, atividadePrincipal: 'servicos',
      email: 'geral@empresa.pt', telefone: '249 000 000', morada: 'Rua A, 1', localidade: 'Fátima',
    },
    previsa: {
      periodo: 2025, volumeNegocios: 180000,
      rai_711: 150000, rai_712: 10000, rai_72: 20000,
      rai_cmv: 15000, rai_cmc: 0, rai_62: 42000, rai_63: 62000,
      rai_64: 12000, rai_65: 0, rai_66: 4000, rai_67: 0, rai_68: 0,
      rai_69: 3000, rai_74: 0, rai_75: 0, rai_76: 0, rai_77: 0, rai_78: 0, rai_79: 0,
      c701_rai: 42000, regime: 'geral', isPME: true, territorio: 'continental', taxaDerramaMunicipal: 0.015,
    },
    sims: {},
  }] }));
  localStorage.setItem('estudo360:v1:currentEmpresaId', JSON.stringify({ v: 1, data: 'e1' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:gabinete:officeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:gabinete:shared:clientes', JSON.stringify({ v: 1, data: [{
    id: 'c1', nome: 'Empresa Exemplo, Lda.', nif: '501234567', tipoEntidade: 'LDA', regimeIva: 'mensal',
    estado: 'ativo', createdAt: 1, updatedAt: 1, empresaId: 'e1', obrigacoesAtivas: ['iva'],
  }] }));
  const officeSettings = {
    nome: 'Gabinete Exemplo & Associados', nif: '509999999', cedulaProfissional: '12345', numeroInscricaoOCC: 'OCC-1',
    morada: 'Avenida do Gabinete 100', codigoPostal: '2495-000', localidade: 'Fátima',
    email: 'geral@gabinete-exemplo.pt', telefone: '249 111 222', corPrimaria: '#0677FF',
  };
  localStorage.setItem('estudo360:v1:officeSettings', JSON.stringify({ v: 1, data: officeSettings }));
  localStorage.setItem('estudo360:v1:gabinete:officeSettings:audit-office', JSON.stringify({ v: 1, data: officeSettings }));
});

/** Preenche o que estiver vazio com valores plausíveis por rótulo. */
const preencher = async () => page.evaluate(() => {
  const numPorTexto = (t) => {
    const s = t.toLowerCase();
    if (/idade/.test(s)) return 35;
    if (/dependente|filho/.test(s)) return 1;
    if (/ano|meses|duraç|prazo/.test(s)) return 48;
    if (/funcion..ri|pessoa|colaborador|nº de s/.test(s)) return 3;
    if (/taxa|tan|juro|percent/.test(s)) return 5;
    if (/dia/.test(s)) return 22;
    if (/km|quilóm/.test(s)) return 15000;
    if (/rendimento.*atual|rendimento.*anual|rendimento.*trabalho|remunera/.test(s)) return 42000;
    if (/necessidade mensal/.test(s)) return 3200;
    if (/custo fixo mensal|custo mensal/.test(s)) return 4500;
    if (/custo vari[aá]vel|gastos anuais/.test(s)) return 30000;
    if (/investimento|equipamento|licen[cç]a|obras/.test(s)) return 12000;
    if (/sal[aá]rio/.test(s)) return 2400;
    if (/fatura|volume de neg|receita/.test(s)) return 180000;
    if (/pre..o|valor/.test(s)) return 30000;
    return 1000;
  };
  const rotulo = (el) => {
    const id = el.getAttribute('id');
    if (id) { const l = document.querySelector(`label[for="${CSS.escape(id)}"]`); if (l) return l.textContent || ''; }
    const pai = el.closest('label, div');
    return (pai?.textContent || '') + ' ' + (el.getAttribute('placeholder') || '') + ' ' + (el.getAttribute('aria-label') || '');
  };
  // React ignora `el.value = x`; é preciso o setter nativo + evento input.
  const escrever = (el, valor) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(el, valor);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  let preenchidos = 0;
  const visivel = (el) => el.offsetParent !== null || el.getClientRects().length > 0;

  document.querySelectorAll('#main-content input').forEach((el) => {
    if (!visivel(el) || el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') return;
    if (el.value) return;
    escrever(el, el.type === 'number' ? String(numPorTexto(rotulo(el))) : 'Empresa Teste');
    preenchidos++;
  });
  document.querySelectorAll('#main-content select').forEach((el) => {
    if (!visivel(el) || el.value) return;
    const opt = Array.from(el.options).find((o) => o.value && !o.disabled);
    if (opt) { escrever(el, opt.value); preenchidos++; }
  });
  document.querySelectorAll('#main-content textarea').forEach((el) => {
    if (!visivel(el) || el.value) return;
    escrever(el, 'Nota de teste');
    preenchidos++;
  });
  return preenchidos;
});

for (const [vista, nome] of VISTAS) {
  if (only && only !== vista) continue;
  await page.evaluate((v) => localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: v })), vista);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(2200);

  const preenchidos = await preencher();
  await page.waitForTimeout(300);

  const simular = page.locator('#main-content button:visible').filter({ hasText: /^(Simular|Calcular|Continuar|Ver resultado|Gerar)/ }).first();
  if (await simular.count()) {
    const activo = await simular.isEnabled();
    if (activo) { await simular.click(); await page.waitForTimeout(2200); }
    else { ok(false, `${nome}: botão de simular desativado (${preenchidos} campos preenchidos)`); continue; }
  }

  const botao = page.locator('#main-content button:visible').filter({ hasText: /Descarregar PDF|Imprimir A4/i }).first();
  if (!(await botao.count())) {
    const faltam = await page.evaluate(() => Array.from(document.querySelectorAll('#main-content [required]')).filter((e) => !e.value).map((e) => e.getAttribute('placeholder') || e.getAttribute('aria-label') || e.tagName).slice(0, 5));
    ok(false, `${nome}: sem botão de PDF${faltam.length ? ` (faltam: ${faltam.join(', ')})` : ''}`);
    continue;
  }

  const descarga = page.waitForEvent('download', { timeout: 25000 }).catch(() => null);
  await botao.click({ force: true });
  const dl = await descarga;
  if (!dl) { ok(false, `${nome}: sem download`); continue; }
  const destino = path.join(OUT, `${vista}.pdf`);
  await dl.saveAs(destino);
  const info = paginasDe(destino);
  const texto = fs.readFileSync(destino).toString('latin1');
  const emFalta = ['Por preencher', 'Sem dados para apresentar', 'undefined', 'NaN'].filter((x) => texto.includes(x));
  resultados.push({ vista, nome, preenchidos, ...info, emFalta });
  ok(info.paginas === 1, `${nome}: ${info.paginas} página(s) · ${info.bytes} B · ${info.media}`);
  ok(emFalta.length === 0, `${nome}: sem campos em falta${emFalta.length ? ` (${emFalta.join(', ')})` : ''}`);
}

await browser.close();
fs.writeFileSync(path.join(OUT, 'simuladores.json'), JSON.stringify({ data: new Date().toISOString(), resultados, falhas }, null, 1));
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) process.exit(1);
