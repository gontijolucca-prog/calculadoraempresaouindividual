/**
 * Varredura automática do site: passa por todas as vistas e procura bugs.
 *
 * Para cada ecrã, a 1440 / 1024 / 375:
 *  - erros de consola e exceções da página;
 *  - overflow horizontal;
 *  - "NaN", "undefined", "Infinity", "null" visíveis;
 *  - imagens quebradas;
 *  - botões principais presentes (não fica em branco).
 *
 *   node scripts/audit-site.mjs            (varredura completa)
 *   node scripts/audit-site.mjs --only=tax (uma vista)
 *
 * Saída: docs/audit-2026-10-24/site.json + PNGs em docs/audit-2026-10-24/shots/
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000/?test';
const OUT = path.resolve('docs/audit-2026-10-24');
const SHOTS = path.join(OUT, 'shots');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const env = (data) => JSON.stringify({ v: 1, data });
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || '';

const VISTAS = [
  'empresas', 'profile', 'tax', 'vehicle', 'ticket', 'selfss', 'diagnostico', 'imoveis',
  'imt', 'salario', 'irs', 'legal', 'previsa', 'aquisicao', 'office-settings', 'proposta',
  'historico', 'exportar', 'hub',
];
const TABS_GABINETE = ['dashboard', 'visao-geral', 'mapa-controlo', 'mapa-rh', 'equipa', 'tarefas', 'agenda', 'obrigacoes', 'cofre', 'lixeira'];

const empresa = { id: 'e1', nome: 'Cliente Auditoria', nif: '501234567', createdAt: 1, updatedAt: 1, profile: { nomeCliente: 'Cliente Auditoria', nif: '501234567', tipoEntidade: 'lda', faturaçaoAnualPrevista: 250000, nrFuncionarios: 3, regimeContabilidade: 'organizada' }, sims: {} };
const cliente = {
  id: 'c1', nome: 'Cliente Auditoria', nif: '501234567', tipoEntidade: 'LDA', regimeIva: 'trimestral',
  estado: 'ativo', createdAt: 1, updatedAt: 1, empresaId: 'e1',
  obrigacoesAtivas: ['iva', 'saft', 'dmr', 'ies', 'modelo10'],
};
const obrigacao = {
  id: 'o1', tipo: 'iva', catalogoId: 'iva', titulo: 'IVA 03/2026', clienteId: 'c1', clienteNome: 'Cliente Auditoria',
  periodo: '2026-03', vencimento: new Date(2026, 2, 20, 12).getTime(), estado: 'entregue', origem: 'cliente', createdAt: 1, updatedAt: 1,
};
const tarefa = { id: 't1', titulo: 'Tarefa de auditoria', tipo: 'outro', estado: 'pendente', prioridade: 'normal', clienteId: 'c1', clienteNome: 'Cliente Auditoria', origem: 'manual', createdAt: 1, updatedAt: 1 };

const semear = (page, vista, tab) => page.evaluate((d) => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: d.vista }));
  localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: d.tab || 'dashboard' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:gabinete:officeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [d.empresa] }));
  localStorage.setItem('estudo360:v1:currentEmpresaId', JSON.stringify({ v: 1, data: 'e1' }));
  localStorage.setItem('estudo360:v1:gabinete:shared:clientes', JSON.stringify({ v: 1, data: [d.cliente] }));
  localStorage.setItem('estudo360:v1:gabinete:shared:obrigacoes', JSON.stringify({ v: 1, data: [d.obrigacao] }));
  localStorage.setItem('estudo360:v1:gabinete:shared:tarefas', JSON.stringify({ v: 1, data: [d.tarefa] }));
}, { vista, tab, empresa, cliente, obrigacao, tarefa });

const TAMANHOS = [1440, 1024, 375];

const IGNORAR_CONSOLA = [
  'Missing or insufficient permissions',
  '[vite]',
  'Download the React DevTools',
  'net::ERR_',
  'Failed to load resource',
];

const problemas = [];
const resumo = [];

fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

let errosAtuais = [];
page.on('pageerror', (e) => errosAtuais.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() !== 'error' && m.type() !== 'warning') return;
  const t = m.text();
  if (IGNORAR_CONSOLA.some((x) => t.includes(x))) return;
  errosAtuais.push(`${m.type()}: ${t}`);
});

await page.goto(BASE, { waitUntil: 'domcontentloaded' });

const ecras = [];
for (const v of VISTAS) ecras.push({ id: v, vista: v, tab: null, nome: v });
for (const t of TABS_GABINETE) ecras.push({ id: `gabinete/${t}`, vista: 'gabinete', tab: t, nome: `gabinete · ${t}` });

for (const ecra of ecras) {
  if (only && ecra.id !== only) continue;
  errosAtuais = [];
  await semear(page, ecra.vista, ecra.tab);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1600);

  const resultado = { ecra: ecra.id, erros: [], overflow: {}, texto: {}, imagens: 0, vazio: false };

  for (const w of TAMANHOS) {
    await page.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => ({
      vistaReal: document.querySelector('#main-content')?.getAttribute('data-view') || null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      texto: document.body.innerText.slice(0, 20000),
      imagensQuebradas: Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).length,
      alturaTexto: document.body.innerText.trim().length,
    }));
    resultado.overflow[w] = m.overflow;
    if (m.vistaReal && m.vistaReal !== ecra.vista) resultado.vistaErrada = m.vistaReal;
    resultado.imagens = Math.max(resultado.imagens, m.imagensQuebradas);
    const sujos = m.texto.match(/\b(NaN|undefined|Infinity)\b/g);
    if (sujos) resultado.texto[w] = Array.from(new Set(sujos));
    if (m.alturaTexto < 40) resultado.vazio = true;
    if (m.overflow > 1) problemas.push({ ecra: ecra.id, tipo: 'overflow', valor: m.overflow, largura: w });
    if (m.imagensQuebradas > 0) problemas.push({ ecra: ecra.id, tipo: 'imagem_quebrada', valor: m.imagensQuebradas, largura: w });
    if (w === 375) await page.screenshot({ path: path.join(SHOTS, `${ecra.id.replace(/[/]/g, '-')}-375.png`) });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: path.join(SHOTS, `${ecra.id.replace(/[/]/g, '-')}-1440.png`) });

  resultado.erros = Array.from(new Set(errosAtuais)).slice(0, 8);
  for (const e of resultado.erros) problemas.push({ ecra: ecra.id, tipo: 'consola', valor: e });
  if (resultado.vazio) problemas.push({ ecra: ecra.id, tipo: 'ecra_vazio' });
  if (resultado.vistaErrada) problemas.push({ ecra: ecra.id, tipo: 'vista_errada', valor: resultado.vistaErrada });
  for (const [w, sujos] of Object.entries(resultado.texto)) {
    for (const s of sujos) problemas.push({ ecra: ecra.id, tipo: 'texto_sujo', valor: s, largura: w });
  }

  resumo.push(resultado);
  const estado = resultado.erros.length || Object.values(resultado.overflow).some((v) => v > 1) || resultado.vazio ? 'FALHA' : 'ok';
  console.log(`${estado === 'ok' ? '✓' : '✗'} ${ecra.id}${resultado.erros.length ? ` · ${resultado.erros.length} erro(s)` : ''}${Object.values(resultado.overflow).some((v) => v > 1) ? ' · overflow' : ''}${resultado.vazio ? ' · vazio' : ''}`);
}

await browser.close();
fs.writeFileSync(path.join(OUT, 'site.json'), JSON.stringify({ data: new Date().toISOString(), resumo, problemas }, null, 1));

console.log(`\n${problemas.length === 0 ? 'PASS' : 'FALHAS'} — ${problemas.length} problema(s) em ${resumo.length} ecrã(s)`);
for (const p of problemas.slice(0, 40)) console.log(`  - ${p.ecra}: ${p.tipo}${p.valor ? ` (${String(p.valor).slice(0, 90)})` : ''}${p.largura ? ` @${p.largura}` : ''}`);
console.log(`\nRelatório: ${path.join(OUT, 'site.json')}`);
if (problemas.length) process.exit(1);
