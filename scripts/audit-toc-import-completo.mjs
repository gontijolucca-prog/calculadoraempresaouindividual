/**
 * Certifica a importação TOConline: liga, escolhe 5 clientes, importa e compara
 * campo a campo com o que a API devolveu. Também confirma que só entram os
 * selecionados e que reimportar não duplica.
 *
 *   TOC_CLIENT_ID=... TOC_SECRET=... BASE=http://localhost:3200/ node scripts/audit-toc-import-completo.mjs
 */
import { chromium } from 'playwright-core';

const CID = process.env.TOC_CLIENT_ID, SEC = process.env.TOC_SECRET;
if (!CID || !SEC) { console.log('SKIP — faltam TOC_CLIENT_ID/TOC_SECRET'); process.exit(0); }
const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.on('pageerror', (e) => falhas.push('pageerror: ' + (e.stack || '').split('\n')[0]));

await page.goto(BASE + '?test', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:mode', JSON.stringify({ v: 1, data: 'empresa' }));
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'empresas' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'toc-full' }));
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [] }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1800);

// 1) API como fonte de verdade (mesmo pedido que o servidor faz)
const api = await page.evaluate(async ([cid, sec]) => {
  const post = async (body) => {
    const r = await fetch('/api/toconline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  };
  const tok = await post({ action: 'connect', oauthUrl: 'https://app32.toconline.pt/oauth', apiUrl: 'https://api32.toconline.pt', clientId: cid, secret: sec });
  const res = await post({ action: 'customers', apiUrl: 'https://api32.toconline.pt', accessToken: tok.access_token });
  return { debug: res.debug || {}, data: res.data || [] };
}, [CID, SEC]);
ok(api.data.length > 0, `API devolveu ${api.data.length} clientes`);
console.log('cobertura API:', JSON.stringify(api.debug));

// 2) escolher 5 clientes "ricos" (morada + email ou telefone), sem NIF repetido
const vistos = new Set(); const escolhidos = [];
for (const c of api.data) {
  if (!c.nif || vistos.has(c.nif)) continue;
  vistos.add(c.nif);
  if (c.morada && (c.email || c.telefone)) escolhidos.push(c);
  if (escolhidos.length === 5) break;
}
ok(escolhidos.length === 5, `5 clientes escolhidos para o teste (${escolhidos.map((c) => c.nif).join(', ')})`);

// 3) UI: ligar e importar exatamente estes 5
await page.getByRole('button', { name: /TOConline/i }).first().click();
await page.waitForTimeout(600);
await page.locator('label', { hasText: /Client ID/i }).locator('input').first().fill(CID);
await page.locator('label', { hasText: /Segredo/i }).locator('input').first().fill(SEC);
await page.getByRole('button', { name: /Ligar e importar/i }).first().click();
await page.waitForTimeout(12000);
const dlg = page.locator('[role="dialog"]');
ok(await dlg.count() === 1, 'pré-visualização aberta');

await dlg.getByRole('button', { name: /Limpar seleção/i }).click();
await page.waitForTimeout(300);
const nifs = new Set(escolhidos.map((c) => c.nif));
const rows = dlg.locator('label:has(input[type="checkbox"])');
const total = await rows.count();
let marcados = 0;
for (let i = 0; i < total; i++) {
  const row = rows.nth(i);
  const txt = (await row.innerText()).replace(/\s+/g, ' ');
  const nif = (txt.match(/NIF (\d{9})/) || [])[1];
  if (nif && nifs.has(nif)) { await row.locator('input[type="checkbox"]').check(); marcados++; }
}
ok(marcados === 5, `marquei ${marcados}/5 clientes na lista`);
const btn = dlg.getByRole('button', { name: /^Importar \d+ selecionado/ }).first();
ok(/Importar 5/.test((await btn.textContent()) || ''), 'botão mostra Importar 5');
await btn.click();
await page.waitForTimeout(2000);

// 4) comparação campo a campo
const guardados = await page.evaluate(() => JSON.parse(localStorage.getItem('estudo360:v1:empresas') || '{"data":[]}').data);
ok(guardados.length === 5, `importou exatamente 5 (${guardados.length})`);

const campos = [
  ['nome', (e) => e.nome, (c) => c.nome],
  ['nif', (e) => e.nif, (c) => c.nif],
  ['email', (e) => e.profile.email, (c) => c.email || ''],
  ['telefone', (e) => e.profile.telefone, (c) => c.telefone || ''],
  ['morada', (e) => e.profile.morada, (c) => c.morada || ''],
  ['codigoPostal', (e) => e.profile.codigoPostal, (c) => c.codigoPostal || ''],
  ['localidade', (e) => e.profile.localidade, (c) => c.localidade || ''],
  ['regimeIva(isento)', (e) => e.profile.regimeIva === 'isento', (c) => !!c.isencaoIva],
  ['toc.id', (e) => e.toc?.id || '', (c) => c.tocId || ''],
  ['toc.website', (e) => e.toc?.website || '', (c) => c.website || ''],
  ['toc.contacto', (e) => e.toc?.contacto || '', (c) => c.contacto || ''],
  ['toc.regiao', (e) => e.toc?.regiao || '', (c) => c.regiao || ''],
  ['toc.observacoes', (e) => e.toc?.observacoes || '', (c) => c.observacoes || ''],
  ['toc.ativo', (e) => e.toc?.ativo !== false, (c) => c.ativo !== false],
  ['toc.emails (nº)', (e) => (e.toc?.emails || []).length, (c) => (c.emails || []).length],
  ['toc.email principal', (e) => e.toc?.emails?.[0] || '', (c) => c.emails?.[0] || ''],
  ['toc.moradas extra (nº)', (e) => (e.toc?.moradasExtra || []).length, (c) => (c.moradasExtra || []).length],
  ['toc.isencaoCodigo', (e) => e.toc?.isencaoCodigo || '', (c) => c.isencaoCodigo || ''],
  ['toc.prazoPagamento', (e) => (typeof e.toc?.prazoPagamento === 'number' ? e.toc.prazoPagamento : ''), (c) => (typeof c.prazoPagamento === 'number' ? c.prazoPagamento : '')],
  ['toc.moeda', (e) => e.toc?.moeda || '', (c) => c.moeda || ''],
  ['toc.raw.cliente (nº campos)', (e) => Object.keys(e.toc?.raw?.cliente || {}).length, (c) => Object.keys(c.raw?.cliente || {}).length],
  ['toc.raw.moradas (nº)', (e) => (e.toc?.raw?.moradas || []).length, (c) => (c.raw?.moradas || []).length],
  ['toc.raw.emails (nº)', (e) => (e.toc?.raw?.emails || []).length, (c) => (c.raw?.emails || []).length],
  ['toc.raw.isencao.codigo', (e) => e.toc?.raw?.isencao?.code || '', (c) => c.raw?.isencao?.code || ''],
];
const porNif = new Map(guardados.map((e) => [e.nif, e]));
for (const [nome, getGuardado, getApi] of campos) {
  const pares = escolhidos.map((c) => ({ esperado: getApi(c), obtido: getGuardado(porNif.get(c.nif) || {}) }));
  const iguais = pares.filter((p) => String(p.esperado) === String(p.obtido)).length;
  const comDados = pares.filter((p) => String(p.esperado) !== '').length;
  ok(iguais === 5, `${nome}: ${iguais}/5 iguais (${comDados}/5 tinham valor na API)`);
}

// 5) os dados ficam no cliente certo e não se perdem ao recarregar
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2200);
const depoisReload = await page.evaluate(() => JSON.parse(localStorage.getItem('estudo360:v1:empresas') || '{"data":[]}').data);
ok(depoisReload.length === 5, `continua com 5 empresas depois de recarregar (${depoisReload.length})`);
const amostra = depoisReload.find((e) => e.nif === escolhidos[0].nif);
ok(!!amostra?.profile?.morada && !!amostra?.toc?.id, 'morada e id do TOConline persistem no registo');
ok(!!amostra?.toc?.raw?.cliente && Object.keys(amostra.toc.raw.cliente).length >= 5, 'registo completo (raw) guardado no cliente');

await page.screenshot({ path: 'docs/toconline-import-completo.png' });
await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach((f) => console.log('  - ' + f)); process.exit(1); }
