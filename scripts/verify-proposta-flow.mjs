/**
 * Prova do fluxo novo de propostas: escolha obrigatória (app ou Gamma), as 4
 * perguntas, proposta de 7 blocos com preço real e texto Gamma com os mesmos
 * blocos.
 *
 *   node scripts/verify-proposta-flow.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000/?test';
const OUT = path.resolve('docs/audit-2026-10-26');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', (e) => falhas.push(`pageerror: ${(e.stack || e.message).split('\n')[0]}`));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:mode', JSON.stringify({ v: 1, data: 'empresa' }));
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'proposta' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:gabinete:officeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [{
    id: 'e1', nome: 'Restaurante Alfa', nif: '501234567', createdAt: 1, updatedAt: 1,
    profile: { nomeCliente: 'Restaurante Alfa', nif: '501234567', tipoEntidade: 'lda', faturaçaoAnualPrevista: 250000, nrFuncionarios: 6, regimeContabilidade: 'organizada' },
    sims: {},
  }] }));
  localStorage.setItem('estudo360:v1:currentEmpresaId', JSON.stringify({ v: 1, data: 'e1' }));
  localStorage.setItem('estudo360:v1:officeSettings', JSON.stringify({ v: 1, data: {
    nome: 'Escritório Teste', nif: '509999999', cedulaProfissional: '12345', numeroInscricaoOCC: 'OCC-1',
    morada: 'Rua X', codigoPostal: '2495-000', localidade: 'Fátima', email: 'geral@x.pt', telefone: '249 111 222', corPrimaria: '#0677FF',
  } }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2500);

// Passo 1: escolha obrigatória
await page.getByRole('button', { name: /Nova proposta/i }).click();
await page.waitForTimeout(400);
ok(await page.getByRole('button', { name: /Gerar no Estudo360/i }).count() === 1, 'ecrã de escolha: opção Estudo360');
ok(await page.getByRole('button', { name: /Levar para o Gamma/i }).count() === 1, 'ecrã de escolha: opção Gamma');
ok(await page.locator('text=Criar proposta').count() === 0, 'não dá para criar sem escolher caminho');

// Caminho app
await page.getByRole('button', { name: /Gerar no Estudo360/i }).click();
await page.waitForTimeout(500);
const inputs = page.locator('input[placeholder^="ex.:"], input[placeholder^="ex.:"]');
ok(await page.locator('input[placeholder*="pessoas"]').count() >= 1, 'pergunta Dimensão presente');
ok(await page.locator('input[placeholder*="contas"]').count() >= 1, 'pergunta Objetivo presente');
const dimensaoPrefill = await page.locator('input[placeholder*="pessoas"]').first().inputValue();
ok(/6/.test(dimensaoPrefill), `dimensão pré-preenchida do perfil (${dimensaoPrefill})`);

await page.locator('input[placeholder*="contas"]').first().fill('fechar contas a tempo e reduzir impostos');
await page.locator('select').first().selectOption('e1');
await page.waitForTimeout(300);
await page.getByRole('button', { name: /Criar proposta/i }).click();
await page.waitForTimeout(2500);

const editor = await page.evaluate(() => document.body.innerText);
ok(/Cliente|Proposta/i.test(editor), 'editor da proposta abriu');
const cards = await page.locator('.deck-page, [data-deck-card]').count();
ok(cards >= 7, `proposta com ${cards} cards (esperado 7)`);
await page.screenshot({ path: path.join(OUT, 'proposta-tailored.png'), fullPage: false });

// Caminho Gamma: voltar e gerar texto
await page.getByRole('button', { name: /Propostas/i }).first().click();
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /Nova proposta/i }).click();
await page.getByRole('button', { name: /Levar para o Gamma/i }).click();
await page.waitForTimeout(400);
await page.locator('select').first().selectOption('e1');
await page.locator('input[placeholder*="contas"]').first().fill('fechar contas a tempo');
await page.getByRole('button', { name: /Gerar texto/i }).click();
await page.waitForTimeout(800);
const texto = await page.locator('pre').first().textContent().catch(() => '');
ok(!!texto && texto.includes('## Diagnóstico') && texto.includes('## Investimento') && texto.includes('## Plano de arranque'), 'texto Gamma com os 7 blocos');
ok(!!texto && texto.includes('fechar contas a tempo'), 'texto Gamma usa o objetivo respondido');
ok(!!texto && /€\/mês/.test(texto), 'texto Gamma tem preço mensal');
await page.screenshot({ path: path.join(OUT, 'proposta-gamma.png'), fullPage: false });

ok(!falhas.some((f) => f.startsWith('pageerror')), 'sem exceções de página');

await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach((f) => console.log('  - ' + f)); process.exit(1); }
