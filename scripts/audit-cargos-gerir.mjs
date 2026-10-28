/** Gerir cargos: criar, editar e apagar (com guarda de uso). */
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = []; const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
const stamp = Date.now();
const dono = `dono+${stamp}@estudo360.pt`, pass = 'Teste12345!';
const b = await chromium.launch({ executablePath: CHROME, headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 950 } });
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
await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1400);
await p.getByRole('button', { name: /Criar conta/i }).first().click(); await p.waitForTimeout(400);
await p.locator('input[placeholder="O seu nome"]').first().fill('Dono Cargos');
await p.locator('input[placeholder="nome@empresa.pt"]').first().fill(dono);
await p.locator('input[type="password"]').first().fill(pass);
await p.getByRole('button', { name: /^Criar conta$/ }).first().click(); await p.waitForTimeout(2200);
ok(await verificar(dono), 'dono criado');
const sair = p.getByRole('button', { name: /Sair/i }).first(); if (await sair.count()) { await sair.click(); await p.waitForTimeout(700); }
await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1200);
const entrar = p.getByRole('button', { name: /^Entrar$/ }).first(); if (await entrar.count()) await entrar.click();
await p.waitForTimeout(400);
await p.locator('input[placeholder="nome@empresa.pt"]').first().fill(dono);
await p.locator('input[type="password"]').first().fill(pass);
await p.getByRole('button', { name: /^Entrar$/ }).last().click(); await p.waitForTimeout(2400);
const criar = p.getByRole('button', { name: /Criar (novo )?gabinete/i }).first();
if (await criar.count()) {
  await criar.click(); await p.waitForTimeout(600);
  await p.locator('input[placeholder*="Silva"]').first().fill('Cargos QA');
  await p.locator('input[placeholder="500000000"]').first().fill('509' + String(stamp).slice(-6));
  await p.getByRole('button', { name: /Criar e entrar/i }).first().click(); await p.waitForTimeout(2600);
}
await p.evaluate(() => { localStorage.setItem('estudo360:v1:lastView', JSON.stringify({v:1,data:'gabinete'})); localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({v:1,data:'equipa'})); });
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2400);
// criar
await p.getByRole('button', { name: /Gerir cargos/i }).click(); await p.waitForTimeout(400);
await p.getByRole('button', { name: /Novo cargo/i }).click(); await p.waitForTimeout(400);
await p.locator('input[placeholder="Ex.: Gestor de clientes"]').fill('Revisor');
await p.getByText('Ver o cofre de acessos').click();
await p.getByRole('button', { name: /^Criar cargo$/ }).click(); await p.waitForTimeout(1200);
// editar
await p.getByRole('button', { name: /Gerir cargos/i }).click(); await p.waitForTimeout(400);
ok(/Revisor/.test(await p.evaluate(() => document.body.innerText)), 'cargo listado em Gerir cargos');
await p.getByRole('button', { name: /Editar/ }).first().click(); await p.waitForTimeout(400);
await p.locator('input[placeholder="Ex.: Gestor de clientes"]').fill('Revisor Sénior');
await p.getByRole('button', { name: /^Guardar cargo$/ }).click(); await p.waitForTimeout(1200);
await p.getByRole('button', { name: /Gerir cargos/i }).click(); await p.waitForTimeout(400);
ok(/Revisor Sénior/.test(await p.evaluate(() => document.body.innerText)), 'edição do cargo aplicada');
// apagar
await p.getByRole('button', { name: /Apagar/ }).first().click(); await p.waitForTimeout(1200);
const txt = await p.evaluate(() => document.body.innerText);
ok(!/Revisor Sénior/.test(txt) || /Ainda sem cargos personalizados/.test(txt), 'cargo apagado');
const meta = await p.evaluate(async () => { const g = await import('/src/lib/gabinetes.ts'); const id = g.getActiveGabineteId(); const m = await g.getGabineteMeta(id,{force:true}); return Object.keys(m?.customRoles||{}).length; });
ok(meta === 0, `sem cargos no gabinete (${meta})`);
await b.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
process.exit(falhas.length ? 1 : 0);
