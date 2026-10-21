import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://localhost:3000/';
const env = (data) => JSON.stringify({ v: 1, data });

const clientes = [
  {
    id: 'c1', nome: 'Empresa Alfa', nif: '501234567', tipoEntidade: 'LDA', regimeIva: 'trimestral',
    estado: 'ativo', createdAt: 1, updatedAt: 1,
    obrigacoesAtivas: ['iva', 'saft', 'dmr'],
    mapas: {
      rh: [
        { id: 'salarios', labelShort: 'Salários', labelFull: 'Salários', tipos: ['retencao', 'ss'], ativo: true },
        { id: 'pagamentos', labelShort: 'Pagamentos', labelFull: 'Pagamentos SS + Retenções', tipos: ['ss', 'retencao'], ativo: true },
      ],
    },
  },
  {
    id: 'c2', nome: 'Empresa Beta', nif: '502345678', tipoEntidade: 'LDA', regimeIva: 'mensal',
    estado: 'ativo', createdAt: 2, updatedAt: 2,
  },
];

const obrigacoes = [];

const init = `
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:lastView', ${JSON.stringify(env('gabinete'))});
  localStorage.setItem('estudo360:v1:gabineteTab', ${JSON.stringify(env('mapa-rh'))});
  localStorage.setItem('estudo360:v1:gabinete:activeId', ${JSON.stringify(env('test-office'))});
  localStorage.setItem('estudo360:v1:gabinete:shared:clientes', ${JSON.stringify(env(clientes))});
  localStorage.setItem('estudo360:v1:gabinete:shared:obrigacoes', ${JSON.stringify(env(obrigacoes))});
  localStorage.setItem('estudo360:v1:gabinete:shared:alertasGeral', ${JSON.stringify(env([]))});
  localStorage.setItem('estudo360:v1:gabinete:shared:tarefas', ${JSON.stringify(env([]))});
  localStorage.setItem('estudo360:v1:gabinete:shared:colaboradores', ${JSON.stringify(env([]))});
  localStorage.setItem('estudo360:v1:gabinete:shared:cofre', ${JSON.stringify(env([]))});
`;

const results = [];
const check = (name, cond, extra = '') => { results.push({ name, ok: !!cond, extra }); console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`); };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 200)); });
await page.addInitScript(init);
await page.goto(BASE + '?test', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);

check('Gabinete renderiza (Mapa RH)', await page.getByText('Pilares por empresa').count() >= 1);

// Contar células de março da Empresa Alfa: header row + 2 pilar rows
const linhas = page.locator('table tbody tr');
const totalLinhas = await linhas.count();
check('Tabela dos mapas com linhas', totalLinhas > 0, `${totalLinhas} linhas`);

// Clicar na célula MAR da linha Salários e depois na linha Pagamentos
const linhaSalarios = page.locator('table tbody tr').filter({ hasText: 'Salários' }).first();
const linhaPagamentos = page.locator('table tbody tr').filter({ hasText: 'Pagamentos' }).first();
await linhaSalarios.locator('td').nth(3).locator('button').first().click();
await page.waitForTimeout(900);
await linhaPagamentos.locator('td').nth(3).locator('button').first().click();
await page.waitForTimeout(900);

const todas = await page.evaluate(() => {
  const raw = localStorage.getItem('estudo360:v1:gabinete:shared:obrigacoes');
  return raw ? JSON.parse(raw).data : [];
});
const criadas = todas.filter(o => o.clienteId === 'c1');
check('Dois cliques criam exatamente 2 obrigações do cliente', criadas.length === 2, `criadas=${criadas.length} ${criadas.map(o => `${o.pilarId}/${o.estado}`).join(',')}`);
check('Células gravadas com pilarId certo', criadas.some(o => o.pilarId === 'salarios') && criadas.some(o => o.pilarId === 'pagamentos'),
  criadas.map(o => o.pilarId || 'sem pilarId').join(','));

const iconeSalarios = await linhaSalarios.locator('td').nth(3).innerText();
const iconePagamentos = await linhaPagamentos.locator('td').nth(3).innerText();
check('Salários MAR aceso', iconeSalarios.includes('✓'), JSON.stringify(iconeSalarios));
check('Pagamentos MAR aceso', iconePagamentos.includes('✓'), JSON.stringify(iconePagamentos));

// Desmarcar Salários não pode apagar Pagamentos
await linhaSalarios.locator('td').nth(3).locator('button').first().click();
await page.waitForTimeout(900);
const depois = await page.evaluate(() => {
  const raw = localStorage.getItem('estudo360:v1:gabinete:shared:obrigacoes');
  return raw ? JSON.parse(raw).data.filter(o => o.clienteId === 'c1') : [];
});
const salarios = depois.find(o => o.pilarId === 'salarios');
const pagamentos = depois.find(o => o.pilarId === 'pagamentos');
check('Desmarcar Salários → atrasada', salarios?.estado === 'atrasada', salarios?.estado || 'ausente');
check('Pagamentos mantém-se entregue', pagamentos?.estado === 'entregue', pagamentos?.estado || 'ausente');

// Ciclo de 3 estados: ✕ → — (pendente) → ✓
await linhaSalarios.locator('td').nth(3).locator('button').first().click();
await page.waitForTimeout(900);
const terceiro = (await page.evaluate(() => {
  const raw = localStorage.getItem('estudo360:v1:gabinete:shared:obrigacoes');
  return raw ? JSON.parse(raw).data.filter(o => o.clienteId === 'c1') : [];
})).find(o => o.pilarId === 'salarios');
check('Ciclo: ✕ → neutro', terceiro?.estado === 'pendente', terceiro?.estado || 'ausente');
check('Ciclo: célula neutra mostra —', !(await linhaSalarios.locator('td').nth(3).innerText()).includes('✕'), '');

await linhaSalarios.locator('td').nth(3).locator('button').first().click();
await page.waitForTimeout(900);
const quarto = (await page.evaluate(() => {
  const raw = localStorage.getItem('estudo360:v1:gabinete:shared:obrigacoes');
  return raw ? JSON.parse(raw).data.filter(o => o.clienteId === 'c1') : [];
})).find(o => o.pilarId === 'salarios');
check('Ciclo: neutro → ✓', quarto?.estado === 'entregue', quarto?.estado || 'ausente');

// Abrir o editor de pilares por empresa
await page.getByText('Pilares por empresa').first().click();
await page.waitForTimeout(400);
check('Editor de pilares abre', await page.getByText('Âmbito').count() >= 1);

// Escolher a Empresa Alfa e renomear Salários → Vencimentos
await page.locator('select').filter({ hasText: 'Gabinete (todos os clientes)' }).first().selectOption('c1');
await page.waitForTimeout(300);
const btnRenomear = page.locator('button[title="Renomear neste cliente"]').first();
if (await btnRenomear.count()) {
  await btnRenomear.click();
  const inputCurto = page.locator('input[placeholder="Nome curto"]').first();
  await inputCurto.fill('Vencimentos');
  await page.getByRole('button', { name: 'Gravar' }).first().click();
  await page.waitForTimeout(500);
}
const mapasGravados = await page.evaluate(() => {
  const raw = localStorage.getItem('estudo360:v1:gabinete:shared:clientes');
  const list = raw ? JSON.parse(raw).data : [];
  return list.find(c => c.id === 'c1')?.mapas?.rh || [];
});
check('Renomear só no cliente A', mapasGravados.some(p => p.labelShort === 'Vencimentos'), JSON.stringify(mapasGravados.map(p => p.labelShort)));

const fechar = page.getByRole('button', { name: 'Fechar' }).first();
if (await fechar.count()) { await fechar.click().catch(() => {}); }
await page.waitForTimeout(500);

// Sino de notificações
const bell = page.locator('button[aria-label^="Notificações"]').first();
if (await bell.count()) {
  await bell.click();
  await page.waitForTimeout(300);
  check('Painel de notificações abre', await page.getByText('Prazos e alertas').count() >= 1);
} else {
  check('Sino de notificações presente', false);
}

// Overflow horizontal em 3 tamanhos
for (const [w, h] of [[375, 812], [1024, 768], [1440, 900]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`Sem overflow horizontal a ${w}px`, overflow <= 1, `${overflow}px`);
}

await page.screenshot({ path: '/tmp/estudo360-mapa.png', fullPage: false });

// PDF do Mapa RH
const pdfButton = page.getByRole('button', { name: 'Exportar PDF' }).first();
if (await pdfButton.count()) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
    pdfButton.click(),
  ]);
  if (download) {
    const p = '/tmp/estudo360-mapa.pdf';
    await download.saveAs(p);
    const size = fs.statSync(p).size;
    check('PDF do mapa descarrega', size > 3000, `${size} bytes`);
  } else {
    check('PDF do mapa descarrega', false, 'sem download');
  }
} else {
  check('Botão Exportar PDF presente', false);
}

fs.writeFileSync('/tmp/estudo360-smoke.json', JSON.stringify(results, null, 2));
await browser.close();
const falhas = results.filter(r => !r.ok);
console.log(`\n${results.length - falhas.length}/${results.length} verificações OK`);
if (falhas.length) process.exit(1);
