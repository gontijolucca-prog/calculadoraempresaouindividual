/**
 * Portabilidade dos PDFs exportados: 1 página, A4 exato, metadados, sem
 * referências externas (http) e fontes padrão/embutidas.
 *
 *   node scripts/audit-pdf-portability.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('docs/audit-2026-10-26/pdf');
const ficheiros = fs.readdirSync(DIR).filter((f) => f.endsWith('.pdf'));
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };

const A4_RETRATO = [595.28, 841.89];
const A4_PAISAGEM = [841.89, 595.28];
const perto = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;

for (const f of ficheiros) {
  const p = path.join(DIR, f);
  const bruto = fs.readFileSync(p).toString('latin1');
  const paginas = (bruto.match(/\/Type\s*\/Page[^s]/g) || []).length;
  const mb = (bruto.match(/\/MediaBox\s*\[([^\]]+)\]/) || [])[1]?.trim().split(/\s+/).map(Number) || [];
  const [x0, y0, x1, y1] = mb;
  const a4 = (perto(x1 - x0, A4_RETRATO[0]) && perto(y1 - y0, A4_RETRATO[1]))
    || (perto(x1 - x0, A4_PAISAGEM[0]) && perto(y1 - y0, A4_PAISAGEM[1]));
  const externos = (bruto.match(/\/URI\s*\((https?:[^)]+)\)/g) || []).filter((u) => !u.includes('estudo360'));
  const temTitulo = /\/Title\s*\(/.test(bruto) || /\/Title\s*<</.test(bruto)
    || /\/Creator\s*\(/.test(bruto) || /\/Producer\s*\(/.test(bruto);
  const fontes = (bruto.match(/\/(?:FontFile2?|FontFile3)\b/g) || []).length;
  const base14 = /\/BaseFont\s*\/(Helvetica|Times|Courier)/.test(bruto);

  ok(paginas === 1, `${f}: 1 página (${paginas})`);
  ok(a4, `${f}: A4 exato (${(x1 - x0).toFixed(1)}×${(y1 - y0).toFixed(1)})`);
  ok(externos.length === 0, `${f}: sem referências externas (${externos.length})`);
  ok(temTitulo, `${f}: metadados com título`);
  ok(fontes > 0 || base14, `${f}: fontes embutidas ou standard (${fontes} embutidas${base14 ? ', base14' : ''})`);
}

console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s) em ${ficheiros.length} PDF(s)`);
if (falhas.length) process.exit(1);
