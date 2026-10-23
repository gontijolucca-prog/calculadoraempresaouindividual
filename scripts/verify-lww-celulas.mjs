/**
 * Prova do LWW (último a gravar ganha) quando dois dispositivos mexem na mesma
 * célula e ficam dois documentos:
 *  - o ecrã mostra o estado do mais recente (✕), não o antigo (✓);
 *  - aparece aviso uma vez;
 *  - nada é apagado no armazenamento (fica para a Lixeira no próximo clique).
 *
 *   node scripts/verify-lww-celulas.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000/?test';
const OUT = path.resolve('scripts/out');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const env = (data) => JSON.stringify({ v: 1, data });
const dia = (m, d) => new Date(2026, m - 1, d, 12).getTime();

const clientes = [
  { id: 'c1', nome: 'Cliente Alfa', nif: '501234567', tipoEntidade: 'LDA', regimeIva: 'mensal', estado: 'ativo', createdAt: 1, updatedAt: 1, empresaId: 'e1', obrigacoesAtivas: ['iva'] },
  { id: 'c2', nome: 'Cliente Beta', nif: '502345678', tipoEntidade: 'LDA', regimeIva: 'mensal', estado: 'ativo', createdAt: 2, updatedAt: 2, empresaId: 'e2', obrigacoesAtivas: ['iva'] },
];

const obrigacoes = [
  // mesma célula: dispositivo A marcou ✓ (mais antigo), dispositivo B marcou ✕ (mais recente)
  { id: 'a-velho', tipo: 'iva', catalogoId: 'iva', titulo: 'IVA 03/2026', clienteId: 'c1', clienteNome: 'Cliente Alfa', periodo: '2026-03', vencimento: dia(3, 20), estado: 'entregue', origem: 'cliente', createdAt: 10, updatedAt: 100 },
  { id: 'b-novo', tipo: 'iva', catalogoId: 'iva', titulo: 'IVA 03/2026', clienteId: 'c1', clienteNome: 'Cliente Alfa', periodo: '2026-03', vencimento: dia(3, 20), estado: 'atrasada', origem: 'cliente', createdAt: 11, updatedAt: 200 },
  // outro cliente: não pode ser mexido
  { id: 'c2-iva', tipo: 'iva', catalogoId: 'iva', titulo: 'IVA 03/2026', clienteId: 'c2', clienteNome: 'Cliente Beta', periodo: '2026-03', vencimento: dia(3, 20), estado: 'entregue', origem: 'cliente', createdAt: 12, updatedAt: 150 },
];

const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => falhas.push(`pageerror: ${e.message}`));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(([c, o]) => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'gabinete' }));
  localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: 'dashboard' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'test-office' }));
  localStorage.setItem('estudo360:v1:gabinete:shared:clientes', JSON.stringify({ v: 1, data: c }));
  localStorage.setItem('estudo360:v1:gabinete:shared:obrigacoes', JSON.stringify({ v: 1, data: o }));
}, [clientes, obrigacoes]);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('[data-print-map] table', { timeout: 30000 });
await page.waitForTimeout(1200);

const estado = await page.evaluate(() => ({
  concluidos: document.querySelectorAll('tbody [title="Concluído"]').length,
  naoConcluidos: document.querySelectorAll('tbody [title="Não Concluído"]').length,
  avisoFlag: sessionStorage.getItem('estudo360:lww:avisado'),
  meus: JSON.parse(localStorage.getItem('estudo360:v1:gabinete:shared:obrigacoes')).data
    .filter((o) => ['a-velho', 'b-novo', 'c2-iva'].includes(o.id))
    .map((o) => ({ id: o.id, apagado: !!o.deletedAt })),
}));

ok(estado.concluidos === 1, `1 célula ✓ — a do Cliente Beta, intocada (${estado.concluidos})`);
ok(estado.naoConcluidos === 1, `1 célula ✕ — a do Alfa, do registo mais recente (${estado.naoConcluidos})`);
ok(estado.avisoFlag === '1', 'aviso de "dois dispositivos" mostrado uma vez (marcador na sessão)');
ok(estado.meus.length === 3 && estado.meus.every((o) => !o.apagado), 'nada apagado no armazenamento — 3 registos intactos');
await page.screenshot({ path: path.join(OUT, 'lww-celulas.png') });

// Clicar na célula ✕ (Alfa) manda o duplicado antigo para a Lixeira
await page.locator('tbody [title="Não Concluído"]').first().locator('xpath=ancestor::button').click();
await page.waitForTimeout(1800);
const depois = await page.evaluate(() => JSON.parse(localStorage.getItem('estudo360:v1:gabinete:shared:obrigacoes')).data
  .filter((o) => ['a-velho', 'b-novo', 'c2-iva'].includes(o.id))
  .map((o) => ({ id: o.id, apagado: !!o.deletedAt })));
const apagados = depois.filter((o) => o.apagado);
ok(apagados.length === 1 && apagados[0].id === 'a-velho', `duplicado antigo foi para a Lixeira (${apagados.map((o) => o.id).join(',') || 'nenhum'})`);
ok(depois.length === 3, 'registo continua recuperável (nada destruído)');

await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach((f) => console.log(`  - ${f}`)); process.exit(1); }
