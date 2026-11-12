#!/usr/bin/env node
/**
 * Gera e valida os PDFs que não passam pelo teste dos simuladores:
 * ficha do cliente, ficha 360 do gabinete, três mapas e proposta comercial.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000/?test';
const OUT = path.resolve('docs/audit-2026-11-03/extra');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const fails = [];
const ok = (condition, label) => {
  console.log(`${condition ? '✓' : '✗'} ${label}`);
  if (!condition) fails.push(label);
};
fs.mkdirSync(OUT, { recursive: true });

const pageCount = (file) => {
  const raw = fs.readFileSync(file).toString('latin1');
  const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const media = (raw.match(/\/MediaBox\s*\[([^\]]+)\]/) || [])[1]?.trim() || '';
  return { pages, media, bytes: fs.statSync(file).size };
};

const seed = {
  profile: {
    nomeCliente: 'Empresa Demonstração, Lda.',
    nif: '501234567',
    email: 'geral@empresa-demo.pt',
    telefone: '249 000 000',
    morada: 'Rua da Empresa 25',
    codigoPostal: '2495-123',
    localidade: 'Fátima',
    regimeIva: 'normal_trimestral',
    regimeContabilidade: 'organizada',
    cae: '69201',
    inicioAtividade: 2018,
    atividadePrincipal: 'servicos',
    idade: 42,
    estadoCivil: 'casado',
    nrDependentes: 2,
    tipoEntidade: 'lda',
    faturaçaoAnualPrevista: 285000,
    nrFuncionarios: 6,
    contabilidade: {
      ativoFixoTangivel: 78000,
      ativoIntangivel: 12000,
      investimentosFinanceiros: 15000,
      inventarios: 22000,
      clientes: 64000,
      estadoOutrosAtivo: 8500,
      outrosAtivosCorrentes: 3500,
      caixaDepositos: 47000,
      capitalRealizado: 50000,
      reservasResultadosTransitados: 38000,
      outrasVariacoesCapital: 5000,
      resultadoLiquido: 58500,
      financiamentosObtidos: 42000,
      fornecedores: 29500,
      estadoOutrosPassivo: 14800,
      outrosPassivos: 7200,
      vendasMaiorCliente: 61000,
      fcRecebimentosClientes: 260000,
      fcPagamentosFornecedores: 84000,
      fcPagamentosPessoal: 92000,
      fcImpostoRendimento: 12500,
      fcOutrosOperacionais: 3000,
      fcPagamentosInvestimento: 18000,
      fcRecebimentosInvestimento: 2500,
      fcFinanciamentosObtidos: 12000,
      fcPagamentosFinanciamento: 9500,
      fcRealizacoesCapital: 0,
    },
    contabilidadeAbertura: {
      ativoFixoTangivel: 65000,
      ativoIntangivel: 14000,
      investimentosFinanceiros: 15000,
      inventarios: 19000,
      clientes: 58000,
      estadoOutrosAtivo: 7000,
      outrosAtivosCorrentes: 3200,
      caixaDepositos: 39000,
      capitalRealizado: 50000,
      reservasResultadosTransitados: 30000,
      outrasVariacoesCapital: 4000,
      resultadoLiquido: 48000,
      financiamentosObtidos: 39000,
      fornecedores: 25000,
      estadoOutrosPassivo: 12000,
      outrosPassivos: 6200,
    },
    societaria: {
      capitalSocial: 50000,
      gerenteNome: 'Ana Martins',
      socios: [
        { nome: 'Ana Martins', percentagem: 60 },
        { nome: 'Rui Martins', percentagem: 40 },
      ],
    },
  },
  previsa: {
    periodo: 2025,
    volumeNegocios: 285000,
    rai_711: 235000,
    rai_712: 20000,
    rai_72: 30000,
    rai_75: 0,
    rai_74: 0,
    rai_cmv: 22000,
    rai_cmc: 0,
    rai_62: 68000,
    rai_63: 92000,
    rai_64: 19000,
    rai_65: 0,
    rai_66: 6000,
    rai_67: 0,
    rai_68: 0,
    rai_69: 5200,
    rai_76: 0,
    rai_77: 0,
    rai_78: 0,
    rai_79: 0,
    c701_rai: 72800,
    regime: 'geral',
    isPME: true,
    territorio: 'continental',
    taxaDerramaMunicipal: 0.015,
  },
  office: {
    tipo: 'sociedade',
    nome: 'Gabinete Exemplo & Associados',
    nif: '509999999',
    cedulaProfissional: '12345',
    contabilistaResponsavel: 'Marta Silva',
    numeroInscricaoOCC: 'OCC-123',
    representanteLegal: 'Marta Silva',
    morada: 'Avenida do Gabinete 100',
    codigoPostal: '2495-000',
    localidade: 'Fátima',
    telefone: '249 111 222',
    email: 'geral@gabinete-exemplo.pt',
    website: 'gabinete-exemplo.pt',
    iban: 'PT50 0000 0000 0000 0000 0000 0',
    foroComarca: 'Leiria',
    logoDataUrl: '',
    corPrimaria: '#0677FF',
  },
  cliente: {
    id: 'c1',
    nome: 'Empresa Demonstração, Lda.',
    nif: '501234567',
    caes: '69201',
    caeDescricao: 'Contabilidade e auditoria',
    tipoEntidade: 'LDA',
    tipoSociedade: 'Sociedade por quotas',
    regimeIva: 'trimestral',
    regimeIrc: 'geral',
    inicioAtividade: Date.UTC(2018, 0, 2),
    nrTrabalhadores: 6,
    gerentes: ['Ana Martins', 'Rui Martins'],
    responsavelInterno: { nome: 'Marta Silva', initials: 'MS' },
    supervisor: { nome: 'João Costa', initials: 'JC' },
    apoioAdministrativo: { nome: 'Sofia Lopes', initials: 'SL' },
    estado: 'ativo',
    obrigacoesAtivas: ['iva', 'saft', 'dmr', 'ies'],
    situacaoAtual: [{ texto: 'Fecho anual em preparação.', cor: 'orange' }],
    orientacoes: 'Confirmar documentação de fecho até 15 de março.',
    createdAt: 1,
    updatedAt: Date.now(),
    empresaId: 'e1',
  },
};
seed.clientes = [
  seed.cliente,
  { ...seed.cliente, id: 'c2', nome: 'Oficina Alfa, Unipessoal Lda.', nif: '502345678', regimeIva: 'mensal', nrTrabalhadores: 3, empresaId: undefined, responsavelInterno: { nome: 'João Costa', initials: 'JC' }, situacaoAtual: [], orientacoes: '' },
  { ...seed.cliente, id: 'c3', nome: 'Clínica Horizonte, Lda.', nif: '503456789', regimeIva: 'trimestral', nrTrabalhadores: 9, empresaId: undefined, responsavelInterno: { nome: 'Sofia Lopes', initials: 'SL' }, situacaoAtual: [], orientacoes: '' },
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('dialog', (dialog) => dialog.accept());

const env = (data) => JSON.stringify({ v: 1, data });
const empresa = {
  id: 'e1',
  nome: seed.profile.nomeCliente,
  nif: seed.profile.nif,
  createdAt: 1,
  updatedAt: Date.now(),
  profile: seed.profile,
  previsa: seed.previsa,
  sims: {
    tax: { profSit: 'empresa', currentInc: 42000, age: 42, isMainAct: true, monthlyNeed: 3500, isServices: true, b2b: true, rev: 285000, isSeasonal: false, invEquip: 18000, invLic: 2500, invWorks: 0, invFundo: 5000, fixedMo: 4500, varYr: 18000, accMoLda: 2500, accMoEni: 1800, anosAtividade: 8, transparenciaFiscal: false, taxaDerramaMunicipal: 1.5 },
    vehicle: { category: 'passageiros', engineType: 'phev', price: 42000, ivaRegime: 'normal', activity: 'other', maintenanceCost: 1200, insuranceCost: 650, fuelCost: 1800, exemptTA: false, phevCompliant: true, agravamentoTA: false },
    ticket: { employees: 6, ticketValue: 10.46, daysPerMonth: 22, months: 11 },
  },
};

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(700);
await page.evaluate((data) => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:mode', JSON.stringify({ v: 1, data: 'empresa' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:gabinete:officeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:officeSettings', JSON.stringify({ v: 1, data: data.office }));
  localStorage.setItem('estudo360:v1:gabinete:officeSettings:audit-office', JSON.stringify({ v: 1, data: data.office }));
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [data.empresa] }));
  localStorage.setItem('estudo360:v1:currentEmpresaId', JSON.stringify({ v: 1, data: 'e1' }));
  localStorage.setItem('estudo360:v1:gabinete:shared:clientes', JSON.stringify({ v: 1, data: data.clientes }));
  localStorage.setItem('estudo360:v1:gabinete:shared:obrigacoes', JSON.stringify({ v: 1, data: [
    { id: 'o1', tipo: 'iva', catalogoId: 'iva', titulo: 'Declaração periódica de IVA', clienteId: 'c1', clienteNome: data.cliente.nome, periodo: '2025-12', vencimento: Date.now() + 86400000 * 20, estado: 'pendente', origem: 'cliente', createdAt: 1, updatedAt: 1 },
    { id: 'o2', tipo: 'ies', catalogoId: 'ies', titulo: 'IES / Declaração anual', clienteId: 'c1', clienteNome: data.cliente.nome, periodo: '2025', vencimento: Date.now() + 86400000 * 45, estado: 'entregue', origem: 'cliente', createdAt: 1, updatedAt: 1 },
    { id: 'mc1', tipo: 'dossier', titulo: 'Gestão documental 01/2026', clienteId: 'c1', clienteNome: data.cliente.nome, mapa: 'controlo', pilarId: 'docfalta', periodo: '2026-01', vencimento: Date.UTC(2026, 0, 20), estado: 'entregue', origem: 'cliente', createdAt: 1, updatedAt: 10 },
    { id: 'mc2', tipo: 'iva', titulo: 'Vendas 02/2026', clienteId: 'c1', clienteNome: data.cliente.nome, mapa: 'controlo', pilarId: 'vendas', periodo: '2026-02', vencimento: Date.UTC(2026, 1, 20), estado: 'atrasada', origem: 'cliente', createdAt: 1, updatedAt: 11 },
    { id: 'mc3', tipo: 'retencao', titulo: 'Salários 03/2026', clienteId: 'c1', clienteNome: data.cliente.nome, mapa: 'controlo', pilarId: 'salarios', periodo: '2026-03', vencimento: Date.UTC(2026, 2, 20), estado: 'entregue', origem: 'cliente', createdAt: 1, updatedAt: 12 },
    { id: 'mc4', tipo: 'iva', titulo: 'Compras 04/2026', clienteId: 'c2', clienteNome: 'Oficina Alfa, Unipessoal Lda.', mapa: 'controlo', pilarId: 'compras', periodo: '2026-04', vencimento: Date.UTC(2026, 3, 20), estado: 'entregue', origem: 'cliente', createdAt: 1, updatedAt: 13 },
    { id: 'mc5', tipo: 'dossier', titulo: 'Banco 05/2026', clienteId: 'c2', clienteNome: 'Oficina Alfa, Unipessoal Lda.', mapa: 'controlo', pilarId: 'banco', periodo: '2026-05', vencimento: Date.UTC(2026, 4, 20), estado: 'atrasada', origem: 'cliente', createdAt: 1, updatedAt: 14 },
    { id: 'mc6', tipo: 'ies', titulo: 'Balancete 06/2026', clienteId: 'c3', clienteNome: 'Clínica Horizonte, Lda.', mapa: 'controlo', pilarId: 'balancete', periodo: '2026-06', vencimento: Date.UTC(2026, 5, 20), estado: 'entregue', origem: 'cliente', createdAt: 1, updatedAt: 15 },
    { id: 'rh1', tipo: 'retencao', titulo: 'Salários 01/2026', clienteId: 'c1', clienteNome: data.cliente.nome, mapa: 'rh', pilarId: 'salarios', periodo: '2026-01', vencimento: Date.UTC(2026, 0, 20), estado: 'entregue', origem: 'cliente', createdAt: 1, updatedAt: 20 },
    { id: 'rh2', tipo: 'ss', titulo: 'DMR SS 02/2026', clienteId: 'c1', clienteNome: data.cliente.nome, mapa: 'rh', pilarId: 'dmr_ss', periodo: '2026-02', vencimento: Date.UTC(2026, 1, 20), estado: 'atrasada', origem: 'cliente', createdAt: 1, updatedAt: 21 },
    { id: 'rh3', tipo: 'dossier', titulo: 'Ticket 03/2026', clienteId: 'c2', clienteNome: 'Oficina Alfa, Unipessoal Lda.', mapa: 'rh', pilarId: 'ticket', periodo: '2026-03', vencimento: Date.UTC(2026, 2, 20), estado: 'entregue', origem: 'cliente', createdAt: 1, updatedAt: 22 },
    { id: 'rh4', tipo: 'retencao', titulo: 'Guia IRS 04/2026', clienteId: 'c2', clienteNome: 'Oficina Alfa, Unipessoal Lda.', mapa: 'rh', pilarId: 'irs_guia', periodo: '2026-04', vencimento: Date.UTC(2026, 3, 20), estado: 'entregue', origem: 'cliente', createdAt: 1, updatedAt: 23 },
    { id: 'rh5', tipo: 'retencao', titulo: 'Pagamentos 05/2026', clienteId: 'c3', clienteNome: 'Clínica Horizonte, Lda.', mapa: 'rh', pilarId: 'pagamentos', periodo: '2026-05', vencimento: Date.UTC(2026, 4, 20), estado: 'atrasada', origem: 'cliente', createdAt: 1, updatedAt: 24 },
  ] }));
  localStorage.setItem('estudo360:v1:gabinete:shared:alertasGeral', JSON.stringify({ v: 1, data: [
    { id: 'a1', clienteId: 'c1', clienteNome: data.cliente.nome, texto: 'Confirmar documentação de fecho', vencimento: Date.now() + 86400000 * 10, estado: 'aberto', createdAt: 1, updatedAt: 1 },
  ] }));
  localStorage.setItem('estudo360:v1:gabinete:shared:contactosGeral', JSON.stringify({ v: 1, data: [
    { id: 'ct1', clienteId: 'c1', clienteNome: data.cliente.nome, nome: 'Ana Martins', cargo: 'Gerente', telefone: '910000000', email: 'ana@empresa-demo.pt', createdAt: 1, updatedAt: 1 },
  ] }));
  localStorage.setItem('estudo360:v1:gabinete:shared:tarefas', JSON.stringify({ v: 1, data: [
    { id: 't1', titulo: 'Validar fecho de exercício', tipo: 'outro', estado: 'doing', prioridade: 'alta', clienteId: 'c1', clienteNome: data.cliente.nome, dataVencimento: Date.now() + 86400000 * 8, createdAt: 1, updatedAt: 1 },
  ] }));
  localStorage.setItem('estudo360:v1:gabinete:shared:documentos', JSON.stringify({ v: 1, data: [] }));
  localStorage.setItem('estudo360:v1:gabinete:shared:cofre', JSON.stringify({ v: 1, data: [] }));
  localStorage.setItem('estudo360:v1:gabinete:shared:colaboradores', JSON.stringify({ v: 1, data: [] }));
}, { ...seed, empresa: { ...empresa, profile: seed.profile, previsa: seed.previsa }, clientes: seed.clientes });

async function reloadView(view, tab) {
  await page.evaluate(({ view, tab }) => {
    localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: view }));
    if (tab) localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: tab }));
  }, { view, tab });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1800);
}

async function download(file, button, label = file) {
  try {
    const wait = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
    await button.click();
    const item = await wait;
    if (!item) {
      ok(false, `${label}: não iniciou download`);
      return;
    }
    const target = path.join(OUT, file);
    await item.saveAs(target);
    const info = pageCount(target);
    ok(info.pages === 1, `${label}: 1 página A4 (${info.pages}, ${info.bytes} B)`);
  } catch (error) {
    ok(false, `${label}: download falhou (${error instanceof Error ? error.message : String(error)})`);
  }
}

async function downloadFromEvaluate(file, label, operation, arg) {
  try {
    const wait = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
    await page.evaluate(operation, arg);
    const item = await wait;
    if (!item) {
      ok(false, `${label}: não iniciou download`);
      return;
    }
    const target = path.join(OUT, file);
    await item.saveAs(target);
    const info = pageCount(target);
    ok(info.pages === 1, `${label}: 1 página A4 (${info.pages}, ${info.bytes} B)`);
  } catch (error) {
    ok(false, `${label}: download falhou (${error instanceof Error ? error.message : String(error)})`);
  }
}

await reloadView('profile');
await download('08-ficha-simulacao-cliente.pdf', page.getByRole('button', { name: /PDF da ficha/i }).first(), 'Ficha de simulação do cliente');

await downloadFromEvaluate(
  '09-ficha-360-gabinete.pdf',
  'Ficha 360 do gabinete',
  async (data) => {
    const { exportarFichaGabinetePdf } = await import('/src/lib/gabineteFichaPdf.ts');
    exportarFichaGabinetePdf({
      cliente: data.cliente,
      contactos: data.contactos,
      alertas: data.alertas,
      tarefas: data.tarefas,
      obrigacoes: data.obrigacoes,
      office: data.office,
    });
  },
  {
    cliente: seed.cliente,
    contactos: [{ id: 'ct1', clienteId: 'c1', clienteNome: seed.cliente.nome, nome: 'Ana Martins', cargo: 'Gerente', telefone: '910000000', email: 'ana@empresa-demo.pt', createdAt: 1, updatedAt: 1 }],
    alertas: [{ id: 'a1', clienteId: 'c1', clienteNome: seed.cliente.nome, texto: 'Confirmar documentação de fecho', vencimento: Date.now() + 86400000 * 10, estado: 'aberto', createdAt: 1, updatedAt: 1 }],
    tarefas: [{ id: 't1', titulo: 'Validar fecho de exercício', tipo: 'outro', estado: 'doing', prioridade: 'alta', clienteId: 'c1', clienteNome: seed.cliente.nome, dataVencimento: Date.now() + 86400000 * 8, createdAt: 1, updatedAt: 1 }],
    obrigacoes: [{ id: 'o1', tipo: 'iva', catalogoId: 'iva', titulo: 'Declaração periódica de IVA', clienteId: 'c1', clienteNome: seed.cliente.nome, periodo: '2025-12', vencimento: Date.now() + 86400000 * 20, estado: 'pendente', origem: 'cliente', createdAt: 1, updatedAt: 1 }],
    office: seed.office,
  },
);

for (const [tab, file, label] of [
  ['dashboard', '10-quadro-obrigacoes.pdf', 'Quadro Resumo de Obrigações'],
  ['mapa-controlo', '11-mapa-controlo.pdf', 'Mapa de Controlo'],
  ['mapa-rh', '12-mapa-rh.pdf', 'Mapa RH'],
]) {
  await page.evaluate(() => {
    localStorage.removeItem('estudo360:v1:currentEmpresaId');
    localStorage.removeItem('estudo360:v1:currentEmpresaId:shared');
  });
  await reloadView('gabinete', tab);
  const button = page.getByRole('button', { name: /Exportar PDF/i }).first();
  ok(await button.count() === 1, `${label}: botão Exportar PDF presente`);
  await download(file, button, label);
}

const mapSample = {
  office: seed.office,
  clientes: seed.clientes.map((cliente) => cliente.nome),
};
const makeMap = async (file, label, kind) => downloadFromEvaluate(
  file,
  label,
  async (data) => {
    const { RelatorioPdf } = await import('/src/lib/reportPdf.ts');
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const estado = (row, col) => (row * 3 + col) % 5 === 0 ? '✓' : (row + col) % 7 === 0 ? '✕' : '—';
    const pilares = data.kind === 'controlo'
      ? ['Gestão Doc. em Falta', 'Vendas/Recebimentos', 'Compras/Pagamentos', 'Interface Salários', 'AFT - Aquisição/Alienação', 'Rec. Bancária', 'Balancete Analítico']
      : data.kind === 'rh'
        ? ['Salários', 'Carregamento Ticket', 'Guia de IRS/Retenções', 'DMR - AT', 'DMR - SS', 'Pagamentos SS + Retenções']
        : ['Modelo 44', 'Envio SAFT', 'IVA', 'IES', 'Modelo 10', 'DMR', 'Segurança Social'];
    const rows = [];
    data.clientes.forEach((cliente, ci) => {
      pilares.forEach((pilar, pi) => {
        rows.push([cliente, pilar, ...meses.map((_, mi) => estado(ci * 10 + pi, mi))]);
      });
    });
    const pdf = new RelatorioPdf({
      titulo: data.kind === 'controlo' ? 'Mapa de Controlo' : data.kind === 'rh' ? 'Mapa RH' : 'Quadro Resumo de Obrigações',
      subtitulo: `Ano 2026 · ${data.clientes.length} clientes · ${rows.length} linhas de exemplo`,
      escritorio: { nome: data.office.nome, corPrimaria: data.office.corPrimaria, logoDataUrl: data.office.logoDataUrl },
      paisagem: true,
      nomeFicheiro: data.file,
    });
    pdf.matriz(['Cliente', data.kind === 'quadro' ? 'Obrigação' : 'Pilar', ...meses], rows);
    pdf.nota('✓ concluído · ✕ não concluído · — sem registo. Exemplo com três clientes para revisão visual.');
    pdf.save();
  },
  { ...mapSample, file, kind },
);

await makeMap('10-quadro-obrigacoes.pdf', 'Quadro Resumo de Obrigações — amostra completa', 'quadro');
await makeMap('11-mapa-controlo.pdf', 'Mapa de Controlo — amostra completa', 'controlo');
await makeMap('12-mapa-rh.pdf', 'Mapa RH — amostra completa', 'rh');

// A proposta deixou de ser gerada dentro da app (passou a texto para o Gamma);
// o exemplo 19 é produzido pelo exportador de propostas, não por este teste.

ok(pageErrors.length === 0, `sem exceções JavaScript (${pageErrors.join(' | ')})`);
await browser.close();
fs.writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify({ data: new Date().toISOString(), fails }, null, 2));
console.log(fails.length ? `\nFAIL - ${fails.length} falha(s)` : '\nPASS - exportações extra OK');
if (fails.length) process.exit(1);
