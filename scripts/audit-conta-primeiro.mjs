/** «Conta primeiro»: dono adiciona email; pessoa cria conta e entra sozinha. */
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = []; const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
const stamp = Date.now();
const dono = `dono+${stamp}@estudo360.pt`, func = `novo+${stamp}@estudo360.pt`, pass = 'Teste12345!';
const b = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } });
const p = await ctx.newPage(); p.on('dialog', (d) => d.accept());
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
await p.locator('input[placeholder="O seu nome"]').first().fill('Dono Conta');
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
  await p.locator('input[placeholder*="Silva"]').first().fill('Conta QA');
  await p.locator('input[placeholder="500000000"]').first().fill('509' + String(stamp).slice(-6));
  await p.getByRole('button', { name: /Criar e entrar/i }).first().click(); await p.waitForTimeout(2600);
}
await p.evaluate(() => { localStorage.setItem('estudo360:v1:lastView', JSON.stringify({v:1,data:'gabinete'})); localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({v:1,data:'equipa'})); });
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2400);
await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Adicionar colaborador/i.test(x.innerText || '')); b && b.click(); });
await p.waitForTimeout(700);
await p.locator('input[placeholder="Nome completo"]:visible').first().fill('Pessoa Nova');
await p.locator('input[placeholder="Email (para login)"]:visible').first().fill(func);
await p.getByRole('button', { name: /Adicionar \(convite pendente\)/i }).filter({ visible: true }).first().click();
await p.waitForTimeout(1800);
const txt = await p.evaluate(() => document.body.innerText);
ok(/entra automaticamente/i.test(txt), 'dono vê aviso de entrada automática');
ok(!/LINK DO CONVITE/i.test(txt), 'não abre modal de link');
ok(/Aguarda conta/i.test(txt), 'estado «Aguarda conta»');

const ctx2 = await b.newContext({ viewport: { width: 420, height: 900 } });
const p2 = await ctx2.newPage();
await p2.goto(BASE, { waitUntil: 'load' }); await p2.waitForTimeout(1500);
await p2.getByRole('button', { name: /Criar conta/i }).first().click(); await p2.waitForTimeout(500);
await p2.locator('input[placeholder="O seu nome"]').first().fill('Pessoa Nova');
await p2.locator('input[placeholder="nome@empresa.pt"]').first().fill(func);
await p2.locator('input[type="password"]').first().fill('Forte12345');
await p2.getByRole('button', { name: /^Criar conta$/ }).first().click();
await p2.waitForTimeout(7000);
const dentro = await p2.evaluate(() => /Gabinete|Visão geral|Equipa/i.test(document.body.innerText));
ok(dentro, 'nova conta entrou no gabinete sozinha');
const gid = await p2.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.includes('activeId')) { try { const d = JSON.parse(localStorage.getItem(k)); const v = d?.data || d; if (typeof v === 'string' && v.length > 3) return v; } catch {} } return ''; });
ok(!!gid, 'gabinete ativo definido');
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2500);
ok(/Gabinete|Visão geral/i.test(await p.evaluate(() => document.body.innerText)), 'continua dentro após recarregar');
await b.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
process.exit(falhas.length ? 1 : 0);
