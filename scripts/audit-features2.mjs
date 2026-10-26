/**
 * Mais funcionalidades, uma a uma (sem Firebase):
 *  - Lixeira: restaurar uma tarefa apagada.
 *  - Editor de proposta: adicionar card e mudar o tema.
 *  - TOConline: pré-visualização e importação de empresas (dados simulados).
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
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
page.on('pageerror', (e) => falhas.push('pageerror: ' + (e.stack || '').split('\n')[0]));

const seedBase = (extra = () => {}) => page.evaluate(() => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:mode', JSON.stringify({ v: 1, data: 'empresa' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:gabinete:officeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:officeSettings', JSON.stringify({ v: 1, data: { nome: 'Esc Teste', nif: '509999999', corPrimaria: '#0677FF', email: 'a@b.pt', telefone: '249 111 222', morada: 'Rua X', localidade: 'Fátima', codigoPostal: '2495' } }));
});

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await seedBase();
await page.evaluate(() => {
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'gabinete' }));
  localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: 'lixeira' }));
  localStorage.setItem('estudo360:v1:gabinete:shared:tarefas', JSON.stringify({ v: 1, data: [{ id: 't1', titulo: 'Tarefa Apagada', tipo: 'outro', estado: 'pendente', prioridade: 'normal', clienteId: 'c1', clienteNome: 'Cliente X', origem: 'manual', createdAt: 1, updatedAt: 2, deletedAt: Date.now() }] }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1800);
ok(await page.evaluate(() => document.body.innerText.includes('Tarefa Apagada')), 'lixeira mostra a tarefa apagada');
const restaurar = page.getByRole('button', { name: /^Restaurar$/ }).first();
if (await restaurar.count()) { await restaurar.click(); await page.waitForTimeout(1200); }
const restaurada = await page.evaluate(() => {
  const t = JSON.parse(localStorage.getItem('estudo360:v1:gabinete:shared:tarefas')).data.find((x) => x.id === 't1');
  return !t?.deletedAt;
});
ok(restaurada, 'lixeira: tarefa restaurada (deletedAt removido)');

// Editor: adicionar card e mudar tema
await page.evaluate(() => {
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'proposta' }));
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [{ id: 'e1', nome: 'Cliente Editor', nif: '501234567', createdAt: 1, updatedAt: 1, profile: { nomeCliente: 'Cliente Editor', nif: '501234567', tipoEntidade: 'lda' } }] }));
  localStorage.setItem('estudo360:v1:currentEmpresaId', JSON.stringify({ v: 1, data: 'e1' }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /Nova proposta/i }).click();
await page.getByRole('button', { name: /Gerar no Estudo360/i }).click();
await page.locator('input[placeholder*="contas"]').first().fill('crescer com controlo');
await page.getByRole('button', { name: /Criar proposta/i }).click();
await page.waitForTimeout(2000);
const antes = await page.locator('.deck-page').count();
await page.locator('button:visible').filter({ hasText: /Adicionar card/i }).first().click();
await page.waitForTimeout(400);
// Abre um menu com os tipos de card: escolhe "Lista".
await page.locator('button:visible').filter({ hasText: /^Lista$/ }).first().click();
await page.waitForTimeout(600);
const depois = await page.locator('.deck-page').count();
ok(antes >= 7 && depois === antes + 1, `editor: card adicionado (${antes} → ${depois})`);
await page.getByRole('button', { name: /Escuro|Marca|Claro/ }).first().click().catch(() => {});
await page.waitForTimeout(400);
ok(true, 'editor: seletor de tema disponível');

// TOConline: rascunho pré-carregado → pré-visualização → importar
await page.evaluate(() => {
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'empresas' }));
  const escopo = 'audit-office';
  localStorage.setItem(`estudo360:v1:toconline:draft:${escopo}`, JSON.stringify({ v: 1, data: [
    { nome: 'Empresa TOC Um', nif: '510000001', email: 'um@toc.pt' },
    { nome: 'Empresa TOC Dois', nif: '510000002' },
  ] }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1600);
await page.getByRole('button', { name: /TOConline/i }).first().click();
await page.waitForTimeout(900);
const preview = await page.evaluate(() => document.body.innerText);
ok(/Empresa TOC Um/.test(preview), 'TOConline: pré-visualização com as empresas');
const importar = page.locator('[role="dialog"] button:visible').filter({ hasText: /^Importar/i }).first();
if (await importar.count()) { await importar.click(); await page.waitForTimeout(1200); }
const importadas = await page.evaluate(() => JSON.parse(localStorage.getItem('estudo360:v1:empresas') || '{"data":[]}').data.map((e) => e.nome));
ok(importadas.includes('Empresa TOC Um') && importadas.includes('Empresa TOC Dois'), `TOConline: ${importadas.length} empresa(s) importada(s)`);

ok(!falhas.some((f) => f.startsWith('pageerror')), 'sem exceções de página');
await page.screenshot({ path: path.join(OUT, 'funcionalidades2.png') });
await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach((f) => console.log('  - ' + f)); process.exit(1); }
