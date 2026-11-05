/**
 * Auditoria de botões de exportação/impressão.
 *
 * Percorre as vistas e separadores do gabinete, clica em todos os botões de
 * exportar/descarregar/imprimir/PDF/CSV/Word e verifica:
 *  - se o clique lança exceção;
 *  - se produz download (e com que nome);
 *  - se o nome do ficheiro tem um ano anterior ao atual (ficheiro "antigo").
 *
 *   node scripts/audit-botoes.mjs
 */
import { chromium } from 'playwright-core';

const BASE = (process.env.BASE || 'http://localhost:3000/') + '?test';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ANO_ATUAL = new Date().getFullYear();
const env = (data) => JSON.stringify({ v: 1, data });

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

const RE = /exportar|descarregar|transferir|imprimir|gerar pdf|pdf|excel|csv|word|\.doc/i;
const IGNORAR = /cancelar|fechar|guardar|eliminar|apagar|remover/i;

const falhas = [];
const acoes = [];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
const page = await context.newPage();
let erros = [];
page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text().slice(0, 120)}`); });
await page.route('**://firestore.googleapis.com/**', (r) => r.abort());
await page.route('**://identitytoolkit.googleapis.com/**', (r) => r.abort());
await page.route('**://securetoken.googleapis.com/**', (r) => r.abort());

await page.goto(BASE, { waitUntil: 'domcontentloaded' });

const ecras = [
  ...VISTAS.map((v) => ({ id: v, vista: v, tab: null })),
  ...TABS_GABINETE.map((t) => ({ id: `gabinete/${t}`, vista: 'gabinete', tab: t })),
];

for (const ecra of ecras) {
  await semear(page, ecra.vista, ecra.tab);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1400);
  erros = [];

  // Vista Relatórios: percorre cada documento e descarrega-o.
  if (ecra.id === 'exportar') {
    for (const cat of ['Demonstrações', 'Encerramento', 'Pacote cliente']) {
      await page.getByRole('tab', { name: new RegExp(cat, 'i') }).first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
      await testarDocumentos();
    }
  }

  async function testarDocumentos() {
    const radios = page.locator('[role="radio"]:visible');
    const n = await radios.count();
    for (let i = 0; i < n; i++) {
      const r = page.locator('[role="radio"]:visible').nth(i);
      const nome = ((await r.innerText().catch(() => '')) || '').split('\n')[0].trim();
      await r.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(700);
      const dl = page.locator('button:visible').filter({ hasText: /Descarregar (em Word|PDF)/i }).first();
      if (!(await dl.count())) { acoes.push({ ecra: ecra.id, botao: nome, ficheiro: '(sem botão de descarregar)' }); continue; }
      const esperar = page.waitForEvent('download', { timeout: 6000 }).catch(() => null);
      await dl.click({ timeout: 3000 }).catch(() => {});
      const d = await esperar;
      if (d) {
        const f = d.suggestedFilename();
        acoes.push({ ecra: ecra.id, botao: nome, ficheiro: f });
        const anos = f.match(/20\d{2}/g) || [];
        if (anos.some((a) => Number(a) < ANO_ATUAL - 1)) falhas.push(`${ecra.id} · «${nome}» gerou ficheiro antigo: ${f}`);
        await d.delete().catch(() => {});
      } else {
        acoes.push({ ecra: ecra.id, botao: nome, ficheiro: '(sem download)' });
        falhas.push(`${ecra.id} · «${nome}» não descarregou nada`);
      }
      erros = [];
    }
  }

  const botoes = page.locator('button:visible');
  const total = await botoes.count();
  for (let i = 0; i < total; i++) {
    const botao = botoes.nth(i);
    const texto = ((await botao.innerText().catch(() => '')) || '').trim();
    const titulo = (await botao.getAttribute('title').catch(() => '')) || '';
    const rotulo = `${texto} ${titulo}`.trim();
    if (!RE.test(rotulo) || IGNORAR.test(rotulo)) continue;

    let download = null;
    const esperar = page.waitForEvent('download', { timeout: 2500 }).catch(() => null);
    try {
      await botao.click({ timeout: 2000 });
      download = await esperar;
    } catch {
      // botão pode abrir modal; não é falha por si
    }
    await page.waitForTimeout(200);
    if (download) {
      const nome = download.suggestedFilename();
      acoes.push({ ecra: ecra.id, botao: rotulo, ficheiro: nome });
      const anos = nome.match(/20\d{2}/g) || [];
      // O Previsa simula o exercício anterior (Modelo 22), por isso 1 ano atrás é válido.
      if (anos.some((a) => Number(a) < ANO_ATUAL - 1)) {
        falhas.push(`${ecra.id} · «${rotulo}» gerou ficheiro com ano antigo: ${nome}`);
      }
      await download.delete().catch(() => {});
    } else {
      acoes.push({ ecra: ecra.id, botao: rotulo, ficheiro: '(sem download — abre diálogo/impressão)' });
    }
  }

  if (erros.length) falhas.push(`${ecra.id}: ${erros.slice(0, 2).join(' | ')}`);
}

await browser.close();
console.log(`\nBotões de exportação testados: ${acoes.length}`);
for (const a of acoes) console.log(`  · ${a.ecra} → ${a.botao} → ${a.ficheiro}`);
if (falhas.length) { console.log('\nFALHAS:'); falhas.forEach((f) => console.log(`  ✗ ${f}`)); process.exit(1); }
console.log('\nPASS — sem botões partidos nem ficheiros com ano antigo.');
