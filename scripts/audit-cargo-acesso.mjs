/** Cargo personalizado com «Ver o cofre»: o colaborador entra e consegue ler o cofre. */
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
const stamp = Date.now();
const dono = `dono+${stamp}@estudo360.pt`, func = `func+${stamp}@estudo360.pt`, pass = 'Teste12345!';

const b = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 950 } });
const p = await ctx.newPage();
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
await p.locator('input[placeholder="O seu nome"]').first().fill('Dono Cargo');
await p.locator('input[placeholder="nome@empresa.pt"]').first().fill(dono);
await p.locator('input[type="password"]').first().fill(pass);
await p.getByRole('button', { name: /^Criar conta$/ }).first().click(); await p.waitForTimeout(2300);
ok(await verificar(dono), 'dono criado');
const sair = p.getByRole('button', { name: /Sair/i }).first();
if (await sair.count()) { await sair.click(); await p.waitForTimeout(800); }
await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1300);
const entrar = p.getByRole('button', { name: /^Entrar$/ }).first();
if (await entrar.count()) await entrar.click();
await p.waitForTimeout(500);
await p.locator('input[placeholder="nome@empresa.pt"]').first().fill(dono);
await p.locator('input[type="password"]').first().fill(pass);
await p.getByRole('button', { name: /^Entrar$/ }).last().click(); await p.waitForTimeout(2500);
const criarGab = p.getByRole('button', { name: /^Criar gabinete$/ }).first();
if (await criarGab.count()) {
  await criarGab.click(); await p.waitForTimeout(700);
  await p.locator('input[placeholder*="Silva"]').first().fill('Cargo Acesso');
  await p.locator('input[placeholder="500000000"]').first().fill('509333222');
  await p.getByRole('button', { name: /Criar e entrar/i }).first().click(); await p.waitForTimeout(2800);
}
let equipa = p.locator('button:visible').filter({ hasText: /^Equipa$/ }).first();
if (!(await equipa.count())) {
  const grupo = p.locator('aside button:visible').filter({ hasText: /Gabinete/ }).first();
  if (await grupo.count()) { await grupo.evaluate((el) => el.click()); await p.waitForTimeout(700); }
  equipa = p.locator('button:visible').filter({ hasText: /^Equipa$/ }).first();
}
if (await equipa.count()) { await equipa.evaluate((el) => el.click()); await p.waitForTimeout(1000); }
const addBtn = p.getByRole('button', { name: /Adicionar (funcionário|colaborador)/i }).first();
if (await addBtn.count()) await addBtn.click(); else { console.log('   [debug] sem botão adicionar:', (await p.evaluate(()=>document.body.innerText)).slice(0,160)); }
await p.waitForTimeout(600);
const sel = p.locator('select:has(option[value="__novo__"])').first();
await sel.selectOption('__novo__'); await p.waitForTimeout(500);
await p.locator('input[placeholder="Ex.: Gestor de clientes"]').fill('Cofre QA');
await p.getByText('Ver o cofre de acessos').click();
await p.getByRole('button', { name: /Criar cargo/ }).click(); await p.waitForTimeout(1000);
await p.locator('input[placeholder="Nome completo"]:visible').first().fill('Funcionário Cofre');
await p.locator('input[placeholder="Email (para login)"]:visible').first().fill(func);
await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Adicionar colaborador|Adicionar funcionário/i.test(x.innerText || '')); b && b.click(); });
await p.waitForTimeout(700);
if (!(await p.locator('input[placeholder="Nome completo"]:visible').count())) {
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Adicionar colaborador|Adicionar funcionário/i.test(x.innerText || '')); b && b.click(); });
  await p.waitForTimeout(500);
}
await p.waitForTimeout(2500);
const token = await p.evaluate(async () => {
  const g = await import('/src/lib/gabinetes.ts');
  const id = g.getActiveGabineteId(); const meta = id ? await g.getGabineteMeta(id) : null;
  return (meta?.invites || []).filter((i) => i.token).pop()?.token || '';
});
ok(!!token, 'convite gerado');

const ctx2 = await b.newContext({ viewport: { width: 420, height: 900 } });
const p2 = await ctx2.newPage();
p2.on('pageerror', (e) => falhas.push('pageerror convite: ' + (e.stack || '').split('\n')[0]));
await p2.goto(BASE + 'convite.html?t=' + token + '&emu=1', { waitUntil: 'load' }); await p2.waitForTimeout(3000);
await p2.locator('#p1').fill('Forte12345'); await p2.locator('#p2').fill('Forte12345');
await p2.locator('#go').click(); await p2.waitForTimeout(6500);
ok(/Gabinete|Lista de Empresas/i.test(await p2.evaluate(() => document.body.innerText)), 'colaborador entrou');
const ui = await p2.evaluate(async () => {
  const g = await import('/src/lib/gabinetes.ts');
  const id = g.getActiveGabineteId();
  const txt = document.body.innerText;
  return { id, cofre: /(^|\n)Cofre(\n|$)/.test(txt) || Array.from(document.querySelectorAll('button')).some((b) => (b.innerText || '').trim() === 'Cofre') };
});
ok(ui.cofre, 'cargo personalizado vê o Cofre no menu');
const acesso = await p2.evaluate(async () => {
  const f = await import('/src/lib/firebase.ts');
  const g = await import('/src/lib/gabinetes.ts');
  const tok = await f.auth.currentUser.getIdToken();
  const id = g.getActiveGabineteId();
  const r = await fetch(`http://127.0.0.1:8180/v1/projects/recofatima-ferramenta/databases/(default)/documents/gabinete/${id}/cofre/qa`, { headers: { Authorization: `Bearer ${tok}` } });
  return r.status;
});
ok(acesso === 200 || acesso === 404, `regras permitem ler o cofre (HTTP ${acesso})`);
await b.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) process.exit(1);
