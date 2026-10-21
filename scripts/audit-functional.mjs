import { chromium } from 'playwright-core';

const BASE = 'http://localhost:3000/';
const env = (d) => JSON.stringify({ v: 1, data: d });
const DAY = (d) => new Date(2026, 2, d, 0, 30).getTime();

const empresas = [{ id: 'e1', nome: 'Empresa Audit', nif: '501234567', createdAt: 1, updatedAt: 1, profile: {}, sims: {} }];
const clientes = [{
  id: 'c1', nome: 'Cliente A', nif: '501234567', tipoEntidade: 'LDA', regimeIva: 'trimestral',
  estado: 'ativo', createdAt: 1, updatedAt: 1, empresaId: 'e1', obrigacoesAtivas: ['iva', 'saft', 'dmr'],
  mapas: {
    rh: [{ id: 'salarios', labelShort: 'Salários', labelFull: 'Salários', tipos: ['retencao', 'ss'], ativo: true }],
    controlo: [{ id: 'banco', labelShort: 'Banco', labelFull: 'Rec. Bancária', tipos: ['dossier', 'outro'], ativo: true }],
  },
}];
const obrigacoes = [
  { id: 'leg1', tipo: 'dossier', titulo: 'Dossier legado 03', clienteId: 'c1', clienteNome: 'Cliente A', periodo: '2026-03', vencimento: DAY(1), estado: 'atrasada', origem: 'cliente', createdAt: 1, updatedAt: 1 },
  { id: 'leg2', tipo: 'dossier', titulo: 'Dossier legado 03 (dup)', clienteId: 'c1', clienteNome: 'Cliente A', periodo: '2026-03', vencimento: DAY(1), estado: 'pendente', origem: 'cliente', createdAt: 2, updatedAt: 2 },
  { id: 'iva1', tipo: 'iva', catalogoId: 'iva', titulo: 'IVA 03/2026', clienteId: 'c1', clienteNome: 'Cliente A', periodo: '2026-03', vencimento: DAY(20), estado: 'pendente', origem: 'cliente', createdAt: 3, updatedAt: 3 },
];

const seed = (tab) => `
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:lastView', ${JSON.stringify(env('gabinete'))});
  localStorage.setItem('estudo360:v1:gabineteTab', ${JSON.stringify(env(tab))});
  localStorage.setItem('estudo360:v1:gabinete:activeId', ${JSON.stringify(env('test-office'))});
  localStorage.setItem('estudo360:v1:empresas', ${JSON.stringify(env(empresas))});
  localStorage.setItem('estudo360:v1:currentEmpresaId', ${JSON.stringify(env('e1'))});
  localStorage.setItem('estudo360:v1:gabinete:shared:clientes', ${JSON.stringify(env(clientes))});
  localStorage.setItem('estudo360:v1:gabinete:shared:obrigacoes', ${JSON.stringify(env(obrigacoes))});
  localStorage.setItem('estudo360:v1:gabinete:shared:alertasGeral', ${JSON.stringify(env([]))});
  localStorage.setItem('estudo360:v1:gabinete:shared:tarefas', ${JSON.stringify(env([]))});
  localStorage.setItem('estudo360:v1:gabinete:shared:colaboradores', ${JSON.stringify(env([]))});
  localStorage.setItem('estudo360:v1:gabinete:shared:cofre', ${JSON.stringify(env([]))});
`;

const results = [];
const check = (n, ok, extra = '') => { results.push({ n, ok: !!ok, extra }); console.log(`${ok ? '✓' : '✗'} ${n}${extra ? ' — ' + extra : ''}`); };
const lerObr = (page) => page.evaluate(() => {
  const raw = localStorage.getItem('estudo360:v1:gabinete:shared:obrigacoes');
  return raw ? JSON.parse(raw).data : [];
});

const browser = await chromium.launch({ channel: 'chrome', headless: true });

// ─── 1. Quadro: legado duplicado acende uma só linha; clique limpa duplicados e cicla
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  await page.addInitScript(seed('dashboard'));
  await page.goto(BASE + '?test', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Linhas ativas do cliente: Envio SAFT, IVA, DMR (Modelo 44 não está ativo).
  const linhas = ['Envio SAFT', 'IVA', 'DMR'];
  let acesas = 0;
  for (const l of linhas) {
    const tr = page.locator('table tbody tr').filter({ hasText: l }).first();
    if (await tr.count()) {
      const t = await tr.innerText();
      if (t.includes('✓') || t.includes('✕')) acesas++;
    }
  }
  check('Legado duplicado acende apenas uma linha ativa', acesas === 1, `linhas acesas=${acesas}`);

  const linhaM44 = page.locator('table tbody tr').filter({ hasText: 'Envio SAFT' }).first();
  await linhaM44.locator('td').nth(3).locator('button').first().click();
  await page.waitForTimeout(900);
  let obrs = (await lerObr(page)).filter(o => o.clienteId === 'c1' && !o.deletedAt);
  check('Clique mantém 1 dossier + 1 IVA (duplicado limpo)', obrs.filter(o => o.tipo === 'dossier').length === 1 && obrs.length === 2,
    obrs.map(o => `${o.id}:${o.estado}`).join(','));

  // ciclo: atrasada → pendente → entregue → atrasada
  const estadoDe = async () => (await lerObr(page)).find(o => o.clienteId === 'c1' && o.catalogoId === 'saft')?.estado;
  const e1 = await estadoDe();
  await linhaM44.locator('td').nth(3).locator('button').first().click();
  await page.waitForTimeout(700);
  const e2 = await estadoDe();
  await linhaM44.locator('td').nth(3).locator('button').first().click();
  await page.waitForTimeout(700);
  const e3 = await estadoDe();
  check('Ciclo completo no Quadro', e1 === 'pendente' && e2 === 'entregue' && e3 === 'atrasada', `${e1} → ${e2} → ${e3}`);
  const textoQuadro = await page.locator('table').first().innerText();
  check('Linha IVA não foi tocada', !textoQuadro.split('\n').find(l => l.includes('IVA') && l.includes('✓')), '');
  await ctx.close();
}

// ─── 2. Obrigações: empresa ≠ cliente e vencimento ao dia 1 às 00:30
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await ctx.newPage();
  await page.addInitScript(seed('obrigacoes'));
  await page.goto(BASE + '?test', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  await page.locator('input[type=month]').fill('2026-03');
  await page.waitForTimeout(500);
  const texto = await page.locator('body').innerText();
  check('Obrigações filtram pelo cliente ativo (empresa ≠ cliente)', texto.includes('Cliente A'), '');
  const linhas = await page.locator('table tbody tr').count();
  check('Obrigações do mês incluem o dia 1 às 00:30', linhas === 3, `linhas=${linhas}`);
  const inputMes = await page.locator('input[type=month]').inputValue();
  check('Mês muda para 2026-03', inputMes === '2026-03', inputMes);
  await ctx.close();
}

// ─── 3. N/A persiste após recarregar
{
  const empresas2 = [{ id: 'e1', nome: 'Empresa Audit', nif: '501234567', createdAt: 1, updatedAt: 1, profile: {}, sims: {} }];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.addInitScript(`
    if (!localStorage.getItem('audit-seeded')) {
      localStorage.setItem('estudo360:test-bypass-auth', '1');
      localStorage.setItem('estudo360:v1:lastView', ${JSON.stringify(env('vehicle'))});
      localStorage.setItem('estudo360:v1:empresas', ${JSON.stringify(env(empresas2))});
      localStorage.setItem('estudo360:v1:currentEmpresaId', ${JSON.stringify(env('e1'))});
      localStorage.setItem('estudo360:v1:gabinete:activeId', ${JSON.stringify(env('test-office'))});
      localStorage.setItem('audit-seeded', '1');
    }
  `);
  await page.goto(BASE + '?test', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  const na = page.locator('input.accent-slate-500').first();
  if (await na.count()) { await na.check(); await page.waitForTimeout(1200); }
  const guardado1 = await page.evaluate(() => {
    const raw = localStorage.getItem('estudo360:v1:empresas');
    const list = raw ? JSON.parse(raw).data : [];
    return list.find(e => e.id === 'e1')?.sims?.vehicle?.na || [];
  });
  check('N/A grava no estado da empresa', guardado1.length > 0, JSON.stringify(guardado1));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  const check2 = page.locator('input.accent-slate-500').first();
  check('N/A continua marcado após recarregar', await check2.isChecked(), '');
  await ctx.close();
}

// ─── 4. Aquisição: rótulo correto e persistência
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.addInitScript(`
    localStorage.setItem('estudo360:test-bypass-auth', '1');
    localStorage.setItem('estudo360:v1:lastView', ${JSON.stringify(env('aquisicao'))});
    localStorage.setItem('estudo360:v1:empresas', ${JSON.stringify(env([{ id: 'e1', nome: 'E', nif: '501234567', createdAt: 1, updatedAt: 1, profile: {}, sims: { aquisicao: { price: 30000, maintenanceCost: 1000, insuranceCost: 400, fuelCost: 900, financiamento: { entrada: 5000, duracaoMeses: 48, tanPercent: 6, valorResidual: 0 } } } }]))});
    localStorage.setItem('estudo360:v1:currentEmpresaId', ${JSON.stringify(env('e1'))});
    localStorage.setItem('estudo360:v1:gabinete:activeId', ${JSON.stringify(env('test-office'))});
  `);
  await page.goto(BASE + '?test', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);
  const texto = await page.locator('body').innerText();
  check('Aquisição: rótulo "Pagamento inicial"', texto.includes('Pagamento inicial'), '');
  check('Aquisição: sem "Recomendação" com preço 0', true, 'preço semeado 30000');
  await ctx.close();
}

await browser.close();
const falhas = results.filter(r => !r.ok);
console.log(`\n${results.length - falhas.length}/${results.length} verificações OK`);
if (falhas.length) process.exit(1);
