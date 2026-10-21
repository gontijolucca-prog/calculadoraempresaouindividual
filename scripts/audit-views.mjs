import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://localhost:3000/';
const env = (d) => JSON.stringify({ v: 1, data: d });
const DAY = (d) => new Date(2026, 2, d, 0, 30).getTime();

const empresas = [{
  id: 'e1', nome: 'Empresa Audit', nif: '501234567', createdAt: 1, updatedAt: 1,
  profile: { nomeCliente: 'Empresa Audit', nif: '501234567' },
  sims: {},
}];

const clientes = [
  {
    id: 'c1', nome: 'Cliente A', nif: '501234567', tipoEntidade: 'LDA', regimeIva: 'trimestral',
    estado: 'ativo', createdAt: 1, updatedAt: 1, empresaId: 'e1',
    obrigacoesAtivas: ['iva', 'saft', 'dmr'],
    mapas: {
      rh: [{ id: 'salarios', labelShort: 'Salários', labelFull: 'Salários', tipos: ['retencao', 'ss'], ativo: true }],
      controlo: [{ id: 'banco', labelShort: 'Banco', labelFull: 'Rec. Bancária', tipos: ['dossier', 'outro'], ativo: true }],
    },
  },
  { id: 'c2', nome: 'Cliente B', nif: '502345678', tipoEntidade: 'ENI', regimeIva: 'mensal', estado: 'ativo', createdAt: 2, updatedAt: 2, empresaId: 'e1' },
];

const obrigacoes = [
  // legado duplicado (tipos partilhados) no dia 1 às 00:30
  { id: 'leg1', tipo: 'dossier', titulo: 'Dossier legado 03', clienteId: 'c1', clienteNome: 'Cliente A', periodo: '2026-03', vencimento: DAY(1), estado: 'atrasada', origem: 'cliente', createdAt: 1, updatedAt: 1 },
  { id: 'leg2', tipo: 'dossier', titulo: 'Dossier legado 03 (dup)', clienteId: 'c1', clienteNome: 'Cliente A', periodo: '2026-03', vencimento: DAY(1), estado: 'pendente', origem: 'cliente', createdAt: 2, updatedAt: 2 },
  { id: 'iva1', tipo: 'iva', catalogoId: 'iva', titulo: 'IVA 03/2026', clienteId: 'c1', clienteNome: 'Cliente A', periodo: '2026-03', vencimento: DAY(20), estado: 'pendente', origem: 'cliente', createdAt: 3, updatedAt: 3 },
];

const store = `
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:empresas', ${JSON.stringify(env(empresas))});
  localStorage.setItem('estudo360:v1:currentEmpresaId', ${JSON.stringify(env('e1'))});
  localStorage.setItem('estudo360:v1:gabinete:activeId', ${JSON.stringify(env('test-office'))});
  localStorage.setItem('estudo360:v1:gabinete:shared:clientes', ${JSON.stringify(env(clientes))});
  localStorage.setItem('estudo360:v1:gabinete:shared:obrigacoes', ${JSON.stringify(env(obrigacoes))});
  localStorage.setItem('estudo360:v1:gabinete:shared:alertasGeral', ${JSON.stringify(env([
    { id: 'a1', clienteId: 'c1', clienteNome: 'Cliente A', texto: 'Confirmar NIF', vencimento: DAY(10), estado: 'aberto' },
  ]))});
  localStorage.setItem('estudo360:v1:gabinete:shared:tarefas', ${JSON.stringify(env([
    { id: 't1', titulo: 'Enviar IVA', tipo: 'tarefa', estado: 'todo', prioridade: 'alta', clienteId: 'c1', clienteNome: 'Cliente A', dataVencimento: DAY(5), createdAt: 1, updatedAt: 1 },
  ]))});
  localStorage.setItem('estudo360:v1:gabinete:shared:contactosGeral', ${JSON.stringify(env([
    { id: 'ct1', clienteId: 'c1', clienteNome: 'Cliente A', nome: 'Ana', cargo: 'Gerente', telefone: '910000000', email: 'ana@example.pt', createdAt: 1, updatedAt: 1 },
  ]))});
  localStorage.setItem('estudo360:v1:gabinete:shared:documentos', ${JSON.stringify(env([]))});
  localStorage.setItem('estudo360:v1:gabinete:shared:cofre', ${JSON.stringify(env([]))});
  localStorage.setItem('estudo360:v1:gabinete:shared:colaboradores', ${JSON.stringify(env([]))});
`;

const views = [
  ['profile', null], ['tax', null], ['vehicle', null], ['aquisicao', null], ['ticket', null],
  ['selfss', null], ['diagnostico', null], ['imoveis', null], ['imt', null], ['salario', null],
  ['irs', null], ['previsa', null], ['empresas', null],
  ['gabinete', 'dashboard'], ['gabinete', 'mapa-rh'], ['gabinete', 'mapa-controlo'],
  ['gabinete', 'visao-geral'], ['gabinete', 'tarefas'], ['gabinete', 'agenda'],
  ['gabinete', 'obrigacoes'], ['gabinete', 'cofre'], ['gabinete', 'equipa'], ['gabinete', 'lixeira'],
];

const NOISE = ['frame-ancestors', 'Version Checker', 'Firestore', 'permission', 'Failed to load resource', 'net::ERR', 'backend', 'offline', 'Missing or insufficient', 'unavailable'];
const limpar = (t) => {
  const s = String(t || '');
  if (NOISE.some(n => s.includes(n))) return '';
  return s.slice(0, 160);
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const problemas = [];

for (const [width, height] of [[1440, 950], [375, 812]]) {
  for (const [view, tab] of views) {
    const ctx = await browser.newContext({ viewport: { width, height } });
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', e => { const m = limpar(e.message); if (m) erros.push('pageerror: ' + m); });
    page.on('console', m => { if (m.type() === 'error') { const t = limpar(m.text()); if (t) erros.push('console: ' + t); } });
    await page.addInitScript(store + `
      localStorage.setItem('estudo360:v1:lastView', ${JSON.stringify(env(view))});
      ${tab ? `localStorage.setItem('estudo360:v1:gabineteTab', ${JSON.stringify(env(tab))});` : ''}
    `);
    await page.goto(BASE + '?test', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2600);

    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const overflow = de.scrollWidth - de.clientWidth;
      const campos = Array.from(document.querySelectorAll('input, select, textarea'))
        .filter(el => el.offsetParent !== null && el.type !== 'file' && el.type !== 'hidden' && !String(el.className || '').includes('sr-only'));
      const cortados = campos.filter(el => el.scrollWidth > el.clientWidth + 3).length;
      const texto = document.body.innerText || '';
      const suspeitos = ['NaN', 'undefined', 'Infinity'].filter(x => texto.includes(x));
      return { overflow, cortados, suspeitos, titulo: (document.querySelector('h1,h2')?.textContent || '').slice(0, 60) };
    });

    if (m.overflow > 1 || erros.length || m.cortados > 0 || m.suspeitos.length) {
      problemas.push({ view, tab, width, overflow: m.overflow, cortados: m.cortados, erros, suspeitos: m.suspeitos, titulo: m.titulo });
      const nome = `${view}${tab ? '-' + tab : ''}-${width}`;
      await page.screenshot({ path: `/tmp/audit-${nome}.png`, fullPage: false });
      console.log(`✗ ${nome} overflow=${m.overflow} cortados=${m.cortados} erros=${erros.length} suspeitos=${m.suspeitos.join(',')} ${erros[0] || ''}`);
    } else {
      console.log(`✓ ${view}${tab ? '/' + tab : ''} @${width}`);
    }
    await ctx.close();
  }
}

await browser.close();
fs.writeFileSync('/tmp/audit-views.json', JSON.stringify(problemas, null, 2));
console.log(`\n${problemas.length} ecrãs com problemas`);
if (problemas.length) process.exit(1);
