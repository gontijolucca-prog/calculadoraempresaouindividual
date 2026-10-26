/**
 * Minuta de Contrato em 1 folha: gera o HTML resumido, imprime para PDF e
 * confirma 1 página + cláusulas essenciais.
 *
 *   node scripts/audit-minuta-resumo.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { buildMinutaResumoHtml } from '../src/lib/minutaResumo.ts';
import { defaultOfficeSettings } from '../src/lib/officeSettings.ts';
import { defaultHonorariosConfig } from '../src/lib/honorarios.ts';
import { defaultProfile } from '../src/ClientProfile.tsx';

const OUT = path.resolve('docs/audit-2026-10-26/pdf');
fs.mkdirSync(OUT, { recursive: true });

const office = { ...defaultOfficeSettings, nome: 'Escritório Teste', nif: '509999999', cedulaProfissional: '12345', numeroInscricaoOCC: 'OCC-1', morada: 'Rua X 10', codigoPostal: '2495-000', localidade: 'Fátima', email: 'geral@x.pt', telefone: '249 111 222' };
const profile = { ...defaultProfile, nomeCliente: 'Restaurante Alfa', nif: '501234567', localidade: 'Fátima', email: 'alfa@rest.pt', tipoEntidade: 'lda', faturaçaoAnualPrevista: 250000, nrFuncionarios: 6, regimeContabilidade: 'organizada' };
const html = buildMinutaResumoHtml(office, defaultHonorariosConfig, profile);
fs.writeFileSync('/tmp/minuta-resumo.html', html);

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage();
await page.goto('file:///tmp/minuta-resumo.html', { waitUntil: 'load' });
const pdfPath = path.join(OUT, 'minuta-contrato.pdf');
await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
await browser.close();

const bruto = fs.readFileSync(pdfPath).toString('latin1');
const paginas = (bruto.match(/\/Type\s*\/Page[^s]/g) || []).length;
const texto = await (async () => {
  const p2 = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const pg = await p2.newPage();
  await pg.goto('file:///tmp/minuta-resumo.html');
  const t = await pg.evaluate(() => document.body.innerText);
  await p2.close();
  return t;
})();

const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
ok(paginas === 1, `1 página A4 (${paginas}) · ${fs.statSync(pdfPath).size} B`);
const minus = texto.toLowerCase();
for (const s of ['partes', 'objeto', 'serviços incluídos', 'honorários', 'obrigações essenciais', 'duração e foro', 'versão resumida']) {
  ok(minus.includes(s), `cláusula presente: ${s}`);
}
ok(/€/.test(texto) && !/undefined|NaN|Por preencher/.test(texto), 'preços e campos completos');
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) process.exit(1);
