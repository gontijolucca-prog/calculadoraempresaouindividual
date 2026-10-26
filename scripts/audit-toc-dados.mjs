/**
 * Prova que a importação traz o máximo de dados do TOConline:
 *  - liga e mede a cobertura dos campos (morada, localidade, email, telefone, contacto);
 *  - importa 3 clientes e confirma que o perfil e os extras ficaram guardados.
 *
 *   TOC_CLIENT_ID=... TOC_SECRET=... node scripts/audit-toc-dados.mjs
 */
import { chromium } from 'playwright-core';
const CID = process.env.TOC_CLIENT_ID, SEC = process.env.TOC_SECRET;
if (!CID || !SEC) { console.log('SKIP — faltam TOC_CLIENT_ID/TOC_SECRET'); process.exit(0); }

const BASE = 'http://localhost:3000/?test';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
page.on('pageerror', (e) => falhas.push('pageerror: ' + (e.stack || '').split('\n')[0]));

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:mode', JSON.stringify({ v: 1, data: 'empresa' }));
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'empresas' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'dados' }));
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [] }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1800);

await page.getByRole('button', { name: /TOConline/i }).first().click();
await page.waitForTimeout(600);
await page.locator('label', { hasText: /Client ID/i }).locator('input').first().fill(CID);
await page.locator('label', { hasText: /Segredo/i }).locator('input').first().fill(SEC);
await page.getByRole('button', { name: /Ligar e importar/i }).first().click();
await page.waitForTimeout(12000);

// cobertura real (via debug do servidor, sem expor nomes)
const cobertura = await page.evaluate(async ([cid, sec]) => {
  const post = async (body) => {
    const r = await fetch('/api/toconline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
  };
  const tok = await post({ action: 'connect', oauthUrl: 'https://app32.toconline.pt/oauth', apiUrl: 'https://api32.toconline.pt', clientId: cid, secret: sec });
  const res = await post({ action: 'customers', apiUrl: 'https://api32.toconline.pt', accessToken: tok.access_token });
  const d = res.debug || {};
  const exemplo = (res.data || []).find((c) => c.morada && c.localidade) || (res.data || [])[0] || {};
  return {
    total: d.total, comMorada: d.comMorada, comLocalidade: d.comLocalidade, comEmail: d.comEmail,
    comTelefone: d.comTelefone, comContacto: d.comContacto, isentosIva: d.isentosIva,
    camposExemplo: Object.keys(exemplo).filter((k) => exemplo[k] !== undefined && exemplo[k] !== '' && exemplo[k] !== false).sort(),
  };
}, [CID, SEC]);

console.log('cobertura:', JSON.stringify(cobertura));
ok(cobertura.total > 0, `recebidos ${cobertura.total} clientes`);
ok(cobertura.comMorada > 0, `com morada: ${cobertura.comMorada}`);
ok(cobertura.comLocalidade > 0, `com localidade: ${cobertura.comLocalidade}`);
ok(cobertura.comEmail > 0, `com email: ${cobertura.comEmail}`);
ok(cobertura.comTelefone >= 0, `com telefone: ${cobertura.comTelefone}`);
ok(Array.isArray(cobertura.camposExemplo) && cobertura.camposExemplo.includes('morada'), 'exemplo traz morada');
ok(cobertura.camposExemplo.includes('localidade'), 'exemplo traz localidade');

// importar 3 clientes e verificar o que ficou guardado
const dlg = page.locator('[role="dialog"]');
await dlg.getByRole('button', { name: /Limpar seleção/i }).click();
await page.waitForTimeout(200);
const checks = dlg.locator('label:has(input[type="checkbox"]) input[type="checkbox"]:enabled');
const n = Math.min(3, await checks.count());
for (let i = 0; i < n; i++) await checks.nth(i).check();
await page.waitForTimeout(300);
const btnImp = dlg.getByRole('button', { name: /^Importar \d+ selecionado/ }).first();
const rotuloImp = (await btnImp.textContent()) || '';
const nSel = Number((rotuloImp.match(/Importar (\d+)/) || [])[1] || 0);
console.log('botão:', rotuloImp.trim(), '| nSel', nSel);
await btnImp.click();
await page.waitForTimeout(1500);

const importados = await page.evaluate(() => JSON.parse(localStorage.getItem('estudo360:v1:empresas') || '{"data":[]}').data);
ok(importados.length === nSel, `importou ${importados.length} cliente(s) (esperado ${nSel})`);
const comPerfil = importados.filter((e) => e.profile?.nomeCliente && e.profile?.nif).length;
ok(comPerfil === nSel, 'todos com nome e NIF no perfil');
const comMoradaGuardada = importados.filter((e) => e.profile?.morada).length;
const comToc = importados.filter((e) => e.toc && e.toc.id).length;
console.log('guardados:', JSON.stringify(importados.map((e) => ({
  temMorada: !!e.profile?.morada, temLocalidade: !!e.profile?.localidade, temEmail: !!e.profile?.email,
  temTelefone: !!e.profile?.telefone, temTocId: !!e.toc?.id, website: !!e.toc?.website, contacto: !!e.toc?.contacto,
}))));
ok(comToc === nSel, `todos guardam o id e extras do TOConline (${comToc}/${nSel})`);
ok(comMoradaGuardada === nSel, `com morada guardada: ${comMoradaGuardada}/${nSel}`);

await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) { falhas.forEach((f) => console.log('  - ' + f)); process.exit(1); }
