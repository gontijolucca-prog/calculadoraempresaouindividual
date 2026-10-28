/** Remover colaborador pendente: modal, confirmação e desaparecimento. */
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = []; const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
const stamp = Date.now();
const dono = `dono+${stamp}@estudo360.pt`, func = `colab+${stamp}@estudo360.pt`, pass = 'Teste12345!';
const b = await chromium.launch({ executablePath: CHROME, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 950 } });
p.on('pageerror', (e) => falhas.push('pageerror: ' + (e.stack || '').split('\n')[0]));
p.on('dialog', (d) => d.accept());
async function verificar(addr) {
  for (let i = 0; i < 10; i++) {
    const r = await fetch('http://127.0.0.1:9199/emulator/v1/projects/demo-estudo360/oobCodes').then((x) => x.json()).catch(() => null);
    const c = r?.oobCodes?.filter((x) => x.email === addr && x.requestType === 'VERIFY_EMAIL').pop();
    if (c?.oobLink) { const v = await fetch(c.oobLink).catch(() => null); if (v?.ok) return true; }
    await p.waitForTimeout(700);
  }
  return false;
}
await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1500);
await p.getByRole('button', { name: /Criar conta/i }).first().click(); await p.waitForTimeout(500);
await p.locator('input[placeholder="O seu nome"]').first().fill('Dono Remover');
await p.locator('input[placeholder="nome@empresa.pt"]').first().fill(dono);
await p.locator('input[type="password"]').first().fill(pass);
await p.getByRole('button', { name: /^Criar conta$/ }).first().click(); await p.waitForTimeout(2200);
ok(await verificar(dono), 'dono criado');
const sair = p.getByRole('button', { name: /Sair/i }).first();
if (await sair.count()) { await sair.click(); await p.waitForTimeout(700); }
await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1200);
const entrar = p.getByRole('button', { name: /^Entrar$/ }).first();
if (await entrar.count()) await entrar.click();
await p.waitForTimeout(400);
await p.locator('input[placeholder="nome@empresa.pt"]').first().fill(dono);
await p.locator('input[type="password"]').first().fill(pass);
await p.getByRole('button', { name: /^Entrar$/ }).last().click(); await p.waitForTimeout(2500);
const criarGab = p.getByRole('button', { name: /^Criar gabinete$/ }).first();
if (await criarGab.count()) {
  await criarGab.click(); await p.waitForTimeout(600);
  await p.locator('input[placeholder*="Silva"]').first().fill('Remover QA');
  await p.locator('input[placeholder="500000000"]').first().fill('509' + String(stamp).slice(-6));
  await p.getByRole('button', { name: /Criar e entrar/i }).first().click(); await p.waitForTimeout(2600);
}
await p.evaluate(() => {
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'gabinete' }));
  localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: 'equipa' }));
});
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2500);
await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Adicionar colaborador|Adicionar funcionário/i.test(x.innerText || '')); b && b.click(); });
await p.waitForTimeout(800);
await p.locator('input[placeholder="Nome completo"]:visible').first().fill('Colaborador Remover');
await p.locator('input[placeholder="Email (para login)"]:visible').first().fill(func);
await p.getByRole('button', { name: /Adicionar \(convite pendente\)/i }).filter({ visible: true }).first().click();
await p.waitForTimeout(1800);
// fecha o modal do convite (clique no fundo)
await p.mouse.click(8, 8); await p.waitForTimeout(600);
const linha = p.locator('tr').filter({ hasText: func }).first();
ok(await linha.count() === 1, 'colaborador na lista');
await linha.locator('button[title="Remover da equipa"]').click();
await p.waitForTimeout(600);
const confirmar = p.getByRole('button', { name: /^Remover$/ }).filter({ visible: true }).first();
ok(await confirmar.count() === 1, 'modal de remoção abre');
const t0 = Date.now();
await confirmar.click();
await p.waitForTimeout(300);
const modalFechou = (await p.getByRole('button', { name: /^Remover$/ }).filter({ visible: true }).count()) === 0;
ok(modalFechou, `modal fechou de imediato (${Date.now() - t0} ms)`);
for (let i = 0; i < 24; i++) {
  if ((await p.locator('tr').filter({ hasText: func }).count()) === 0) break;
  await p.waitForTimeout(500);
}
ok(await p.locator('tr').filter({ hasText: func }).count() === 0, 'desapareceu da lista');
ok(!(await p.evaluate(() => document.body.innerText)).includes('A remover…'), 'não ficou preso');
const gabId = await p.evaluate(async () => { const g = await import('/src/lib/gabinetes.ts'); return g.getActiveGabineteId(); });
const colab = await fetch(`http://127.0.0.1:8180/v1/projects/recofatima-ferramenta/databases/(default)/documents/gabinete/${gabId}:runQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'colaboradores' }], limit: 50 } }) }).then((r) => r.json()).catch(() => []);
const emails = (Array.isArray(colab) ? colab : []).map((x) => x.document?.fields?.email?.stringValue || '');
ok(!emails.includes(func), `registo apagado no Firestore (${emails.length} restantes)`);
await b.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) process.exit(1);
