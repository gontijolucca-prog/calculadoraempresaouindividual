/**
 * Filtros da importação TOConline: tipo de NIF, primeiro dígito, pesquisa,
 * selecionar visíveis e importação só do que está escolhido.
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:3000/?test';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };

const draft = [
  { nome: 'Restaurante Alfa, Lda', nif: '501234567', localidade: 'Fátima' },
  { nome: 'Empresa Beta, SA', nif: '502345678', localidade: 'Leiria' },
  { nome: 'João Silva', nif: '123456789', localidade: 'Fátima' },
  { nome: 'Condomínio Rua X', nif: '980000001', localidade: 'Ourém' },
  { nome: 'Câmara Municipal', nif: '600000001', localidade: 'Ourém' },
  { nome: 'Sem NIF', nif: '', localidade: '' },
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
page.on('pageerror', (e) => falhas.push('pageerror: ' + (e.stack || '').split('\n')[0]));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate((lista) => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:mode', JSON.stringify({ v: 1, data: 'empresa' }));
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'empresas' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'filtros' }));
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [] }));
  localStorage.setItem('estudo360:v1:toconline:draft:filtros', JSON.stringify({ v: 1, data: lista }));
}, draft);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1800);
await page.getByRole('button', { name: /TOConline/i }).first().click();
await page.waitForTimeout(900);

const dlg = page.locator('[role="dialog"]');
const linhas = () => dlg.locator('label:has(input[type="checkbox"])').filter({ hasText: /NIF/ }).count();
ok(await linhas() === 6, `lista inicial com ${await linhas()} linhas`);

// filtro por tipo Empresas
await dlg.getByRole('button', { name: /^Empresas/ }).click();
await page.waitForTimeout(250);
ok(await linhas() === 2, `filtro Empresas → ${await linhas()} linhas`);

// primeiro dígito 9 (condomínios)
await dlg.getByRole('button', { name: /^Empresas/ }).click();
await dlg.getByRole('button', { name: /^9$/ }).click();
await page.waitForTimeout(250);
ok(await linhas() === 1, `filtro NIF 9 → ${await linhas()} linha`);
ok((await dlg.innerText()).includes('Condomínio Rua X'), 'condomínio aparece no filtro 9');

// pesquisa por nome, sem acentos
await dlg.getByRole('button', { name: /^9$/ }).click();
await dlg.getByPlaceholder(/Procurar nome/).fill('joao');
await page.waitForTimeout(250);
ok(await linhas() === 1, `pesquisa "joao" → ${await linhas()} linha`);

// limpar filtros e selecionar visíveis
await dlg.getByRole('button', { name: /Limpar filtros/i }).click();
await page.waitForTimeout(250);
ok(await linhas() === 6, `depois de limpar → ${await linhas()} linhas`);

// multi-seleção: Empresas + Particulares
await dlg.getByRole('button', { name: /^Empresas/ }).click();
await dlg.getByRole('button', { name: /^Particulares/ }).click();
await page.waitForTimeout(250);
ok(await linhas() === 3, `Empresas + Particulares → ${await linhas()} linhas`);
await dlg.getByRole('button', { name: /Limpar filtros/i }).click();
await page.waitForTimeout(250);
await dlg.getByRole('button', { name: /Limpar seleção/i }).click();
await page.waitForTimeout(200);
const marcar = dlg.getByRole('button', { name: /Selecionar visíveis/i }).first();
ok((await marcar.textContent() || '').includes('5'), 'selecionar visíveis conta 5 (exclui sem NIF)');
await marcar.click();
await page.waitForTimeout(250);
const btnImportar = dlg.getByRole('button', { name: /Importar \d+ selecionado/i }).first();
const rotulo = await btnImportar.textContent();
ok(/Importar 5/.test(rotulo || ''), `botão de importar: ${rotulo?.trim()}`);

await btnImportar.click();
await page.waitForTimeout(1200);
const nomes = await page.evaluate(() => JSON.parse(localStorage.getItem('estudo360:v1:empresas') || '{"data":[]}').data.map((e) => e.nome));
ok(nomes.length === 5, `importou ${nomes.length} empresas (sem a que não tem NIF)`);
ok(!nomes.includes('Sem NIF'), 'a linha sem NIF ficou de fora');

await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach((f) => console.log('  - ' + f)); process.exit(1); }
