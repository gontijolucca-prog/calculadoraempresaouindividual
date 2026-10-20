import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://localhost:3000/';
const env = (data) => JSON.stringify({ v: 1, data });
const results = [];
const check = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`); };

const clientes = [
  {
    id: 'c1', nome: 'Empresa Alfa', nif: '501234567', tipoEntidade: 'LDA', regimeIva: 'trimestral',
    estado: 'ativo', createdAt: 1, updatedAt: 1,
    obrigacoesAtivas: ['iva', 'saft', 'modelo44'],
    mapas: {
      controlo: [
        { id: 'salarios', labelShort: 'Salários', labelFull: 'Salários', tipos: ['retencao', 'ss'], ativo: true },
        { id: 'pagamentos', labelShort: 'Pagamentos', labelFull: 'Pagamentos SS + Retenções', tipos: ['ss', 'retencao'], ativo: true },
      ],
    },
  },
];

const baseStorage = (tab, extra = '') => `
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:lastView', ${JSON.stringify(env('gabinete'))});
  localStorage.setItem('estudo360:v1:gabineteTab', ${JSON.stringify(env(tab))});
  localStorage.setItem('estudo360:v1:gabinete:activeId', ${JSON.stringify(env('test-office'))});
  localStorage.setItem('estudo360:v1:gabinete:shared:clientes', ${JSON.stringify(env(clientes))});
  localStorage.setItem('estudo360:v1:gabinete:shared:obrigacoes', ${JSON.stringify(env([]))});
  localStorage.setItem('estudo360:v1:gabinete:shared:alertasGeral', ${JSON.stringify(env([]))});
  localStorage.setItem('estudo360:v1:gabinete:shared:tarefas', ${JSON.stringify(env([]))});
  localStorage.setItem('estudo360:v1:gabinete:shared:colaboradores', ${JSON.stringify(env([]))});
  localStorage.setItem('estudo360:v1:gabinete:shared:cofre', ${JSON.stringify(env([]))});
  ${extra}
`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function abrir(tab, viewport = { width: 1440, height: 900 }, extra = '') {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.addInitScript(baseStorage(tab, extra));
  await page.goto(BASE + '?test', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  return { ctx, page };
}

const lerObr = (page) => page.evaluate(() => {
  const raw = localStorage.getItem('estudo360:v1:gabinete:shared:obrigacoes');
  return raw ? JSON.parse(raw).data : [];
});

// ─── Mapa Controlo ─────────────────────────────────────────────────────────
{
  const { ctx, page } = await abrir('mapa-controlo');
  check('Mapa Controlo abre', await page.getByText('Pilares por empresa').count() >= 1);
  const sal = page.locator('table tbody tr').filter({ hasText: 'Salários' }).first();
  const pag = page.locator('table tbody tr').filter({ hasText: 'Pagamentos' }).first();
  await sal.locator('td').nth(3).locator('button').first().click();
  await page.waitForTimeout(700);
  await pag.locator('td').nth(3).locator('button').first().click();
  await page.waitForTimeout(700);
  const obrs = (await lerObr(page)).filter(o => o.clienteId === 'c1');
  check('Controlo: 2 obrigações independentes', obrs.length === 2, obrs.map(o => `${o.mapa}/${o.pilarId}`).join(','));
  check('Controlo: mapa gravado', obrs.every(o => o.mapa === 'controlo'), obrs.map(o => o.mapa).join(','));
  const st = await sal.locator('td').nth(3).innerText();
  check('Controlo: célula acesa', st.includes('✓'), JSON.stringify(st));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('Controlo: sem overflow', overflow <= 1, `${overflow}px`);
  await page.screenshot({ path: '/tmp/estudo360-mapa-controlo.png' });
  await ctx.close();
}

// ─── Quadro (Dashboard) ────────────────────────────────────────────────────
{
  const { ctx, page } = await abrir('dashboard');
  await page.waitForTimeout(1500);
  const temQuadro = await page.getByText('Quadro Resumo', { exact: false }).count();
  check('Quadro Resumo presente', temQuadro >= 1);

  const linhaSaft = page.locator('table tbody tr').filter({ hasText: 'Envio SAFT' }).first();
  if (await linhaSaft.count()) {
    // primeira célula de mês com botão (a linha expandida tem td0 + 12 meses)
    await linhaSaft.locator('td').nth(3).locator('button').first().click();
    await page.waitForTimeout(800);
    const obrs = (await lerObr(page)).filter(o => o.clienteId === 'c1');
    check('Quadro: obrigação SAF-T com catalogoId', obrs.some(o => o.catalogoId === 'saft'), obrs.map(o => o.catalogoId || o.tipo).join(','));
    check('Quadro: não gravou no modelo 44', !obrs.some(o => o.catalogoId === 'modelo44'), obrs.map(o => o.catalogoId || '—').join(','));
  } else {
    check('Quadro: linha SAF-T visível', false);
  }
  await ctx.close();
}

// ─── Quadro: legado com tipos partilhados não acende duas linhas ───────────
{
  const legado = [{
    id: 'leg1', tipo: 'dossier', titulo: 'Dossier 03/2026', clienteId: 'c1', clienteNome: 'Empresa Alfa',
    periodo: '2026-03', vencimento: new Date(2026, 2, 20).getTime(), estado: 'atrasada', origem: 'cliente',
    createdAt: 1, updatedAt: 1,
  }];
  const extra = `localStorage.setItem('estudo360:v1:gabinete:shared:obrigacoes', ${JSON.stringify(env(legado))});`;
  const { ctx, page } = await abrir('dashboard', { width: 1440, height: 1000 }, extra);
  await page.waitForTimeout(1200);
  const linhaM44 = page.locator('table tbody tr').filter({ hasText: 'Modelo 44' }).first();
  const linhaSaft = page.locator('table tbody tr').filter({ hasText: 'Envio SAFT' }).first();
  const txtM44 = await linhaM44.innerText();
  const txtSaft = await linhaSaft.innerText();
  const acesos = [txtM44, txtSaft].filter(t => t.includes('✓') || t.includes('✕')).length;
  check('Legado dossier acende só uma linha', acesos === 1, `modelo44=${JSON.stringify(txtM44.slice(0, 40))} saft=${JSON.stringify(txtSaft.slice(0, 40))}`);
  check('Legado fica na linha mais específica (Modelo 44)', txtM44.includes('✕'), JSON.stringify(txtM44.slice(0, 40)));

  // Clicar SAF-T cria uma obrigação própria e não muda a de Modelo 44
  await linhaSaft.locator('td').nth(3).locator('button').first().click();
  await page.waitForTimeout(900);
  const todas = (await lerObr(page)).filter(o => o.clienteId === 'c1');
  check('Clique em SAF-T cria obrigação própria', todas.some(o => o.catalogoId === 'saft'), todas.map(o => o.catalogoId || 'legado').join(','));
  const txtM44Depois = await linhaM44.innerText();
  check('Modelo 44 mantém o estado do legado', txtM44Depois.includes('✕'), JSON.stringify(txtM44Depois.slice(0, 40)));
  await ctx.close();
}

// ─── Viaturas: comparador ──────────────────────────────────────────────────
{
  const empresas = [{
    id: 'e1', nome: 'Empresa Teste', nif: '501234567', createdAt: 1, updatedAt: 1,
    profile: { nomeCliente: 'Empresa Teste', nif: '501234567' },
    sims: {
      vehicle: {
        category: 'passageiros', engineType: 'diesel', price: 30000, ivaRegime: 'normal', activity: 'other',
        maintenanceCost: 1230, insuranceCost: 500, fuelCost: 1230, exemptTA: false, phevCompliant: false,
        financiamento: { entrada: 6000, duracaoMeses: 48, tanPercent: 6, valorResidual: 0 },
      },
    },
  }];
  const extra = `
    localStorage.setItem('estudo360:v1:lastView', ${JSON.stringify(env('vehicle'))});
    localStorage.setItem('estudo360:v1:empresas', ${JSON.stringify(env(empresas))});
    localStorage.setItem('estudo360:v1:currentEmpresaId', ${JSON.stringify(env('e1'))});
  `;
  const { ctx, page } = await abrir('dashboard', { width: 1440, height: 1000 }, extra);
  const simular = page.getByRole('button', { name: 'Simular' }).first();
  if (await simular.count()) { await simular.click(); await page.waitForTimeout(900); }
  check('Comparador visível', await page.getByText('Comparar aquisição').count() >= 1);
  const cabecalhos = await page.getByRole('columnheader').allInnerTexts().catch(() => []);
  const tabela = page.locator('table').filter({ hasText: 'Custo líquido' }).first();
  const texto = await tabela.innerText().catch(() => '');
  check('Comparador tem os 4 modos', ['Compra', 'Crédito', 'Leasing', 'Renting'].every(m => texto.includes(m)), `${cabecalhos.length} cabeçalhos`);
  check('Comparador com valores', texto.includes('€'), texto.split('\n').slice(0, 3).join(' | '));
  check('Mensalidade de crédito calculada', /Mensalidade[\s\S]{0,120}€/.test(texto), '');
  await page.screenshot({ path: '/tmp/estudo360-viaturas.png' });

  const pdfBtn = page.locator('button').filter({ hasText: 'Descarregar PDF' }).first();
  if (await pdfBtn.count()) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), pdfBtn.click()]);
    if (dl) {
      const p = '/tmp/estudo360-viaturas.pdf';
      await dl.saveAs(p);
      const size = fs.statSync(p).size;
      check('PDF da simulação descarrega', size > 3000, `${size} bytes`);
    } else check('PDF da simulação descarrega', false, 'sem download');
  } else check('Botão PDF do simulador', false);

  for (const [w, h] of [[375, 812], [1024, 900], [1440, 1000]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`Viaturas sem overflow a ${w}px`, overflow <= 1, `${overflow}px`);
  }
  await ctx.close();
}

// ─── Visão Geral: ficha em PDF ─────────────────────────────────────────────
{
  const extra = `localStorage.setItem('estudo360:v1:currentEmpresaId', ${JSON.stringify(env('c1'))});`;
  const { ctx, page } = await abrir('visao-geral', { width: 1440, height: 1000 }, extra);
  check('Visão Geral abre', await page.getByText('Resumo da empresa').count() >= 1);
  const btn = page.locator('button').filter({ hasText: 'PDF' }).first();
  if (await btn.count()) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), btn.click()]);
    if (dl) {
      const p = '/tmp/estudo360-ficha.pdf';
      await dl.saveAs(p);
      const size = fs.statSync(p).size;
      check('Ficha do cliente PDF descarrega', size > 3000, `${size} bytes`);
    } else check('Ficha do cliente PDF descarrega', false, 'sem download');
  } else check('Botão PDF da ficha presente', false);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('Visão Geral sem overflow', overflow <= 1, `${overflow}px`);
  await page.screenshot({ path: '/tmp/estudo360-visao.png' });
  await ctx.close();
}

// ─── Novo simulador: Aquisição (leasing / renting / crédito / compra) ──────
{
  const empresas = [{
    id: 'e1', nome: 'Empresa Teste', nif: '501234567', createdAt: 1, updatedAt: 1,
    profile: { nomeCliente: 'Empresa Teste', nif: '501234567' },
    sims: {
      aquisicao: {
        categoria: 'passageiros', motor: 'diesel', ivaRegime: 'normal', activity: 'other', regimeTributario: 'irc',
        price: 30000, maintenanceCost: 1230, insuranceCost: 500, fuelCost: 1230,
        financiamento: { entrada: 6000, duracaoMeses: 48, tanPercent: 6, valorResidual: 0 },
      },
    },
  }];
  const extra = `
    localStorage.setItem('estudo360:v1:lastView', ${JSON.stringify(env('aquisicao'))});
    localStorage.setItem('estudo360:v1:empresas', ${JSON.stringify(env(empresas))});
    localStorage.setItem('estudo360:v1:currentEmpresaId', ${JSON.stringify(env('e1'))});
  `;
  const { ctx, page } = await abrir('dashboard', { width: 1440, height: 1000 }, extra);
  check('Simulador Aquisição abre', await page.getByText('Aquisição de viatura').count() >= 1);
  const tabela = page.locator('table').filter({ hasText: 'Custo líquido' }).first();
  const txt = await tabela.innerText().catch(() => '');
  check('Aquisição: 4 modos', ['Compra', 'Crédito', 'Leasing', 'Renting'].every(m => txt.includes(m)), '');
  check('Aquisição: recomendação presente', await page.getByText('Recomendação:').count() >= 1);
  // N/A: desativa o campo e zera o valor
  const checkNa = page.locator('input.accent-slate-500').first();
  if (await checkNa.count()) {
    await checkNa.check();
    await page.waitForTimeout(400);
    const input = page.locator('input[placeholder="ex: 30000"]').first();
    const guardado = await page.evaluate(() => {
      const raw = localStorage.getItem('estudo360:v1:empresas');
      const list = raw ? JSON.parse(raw).data : [];
      return list.find(e => e.id === 'e1')?.sims?.aquisicao || {};
    });
    check('N/A grava o campo e zera o valor', (guardado.na || []).includes('maintenanceCost') && guardado.maintenanceCost === 0, JSON.stringify(guardado.na || []));
  } else check('Checkbox N/A presente na manutenção', false);

  const btn = page.locator('button').filter({ hasText: 'Descarregar PDF' }).first();
  if (await btn.count()) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }).catch(() => null), btn.click()]);
    if (dl) {
      const p = '/tmp/estudo360-aquisicao.pdf';
      await dl.saveAs(p);
      check('Aquisição: PDF descarrega', fs.statSync(p).size > 3000, `${fs.statSync(p).size} bytes`);
    } else check('Aquisição: PDF descarrega', false, 'sem download');
  } else check('Aquisição: botão PDF', false);
  for (const [w, h] of [[375, 812], [1024, 900], [1440, 1000]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(350);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`Aquisição sem overflow a ${w}px`, overflow <= 1, `${overflow}px`);
  }
  await page.screenshot({ path: '/tmp/estudo360-aquisicao.png' });
  await ctx.close();
}

await browser.close();
fs.writeFileSync('/tmp/estudo360-smoke2.json', JSON.stringify(results, null, 2));
const falhas = results.filter(r => !r.ok);
console.log(`\n${results.length - falhas.length}/${results.length} verificações OK`);
if (falhas.length) process.exit(1);
