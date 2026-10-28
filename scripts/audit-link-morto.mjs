/** Link guardado mas morto: «Copiar link» gera um novo em vez de copiar um 404. */
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = []; const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
const stamp = Date.now();
const dono = `dono+${stamp}@estudo360.pt`, func = `colab+${stamp}@estudo360.pt`, pass = 'Teste12345!';
const b = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 950 }, permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctx.newPage();
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
await p.locator('input[placeholder="O seu nome"]').first().fill('Dono Link Morto');
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
  await p.locator('input[placeholder*="Silva"]').first().fill('Link Morto');
  await p.locator('input[placeholder="500000000"]').first().fill('509' + String(stamp).slice(-6));
  await p.getByRole('button', { name: /Criar e entrar/i }).first().click(); await p.waitForTimeout(2600);
}
await p.evaluate(() => { localStorage.setItem('estudo360:v1:lastView', JSON.stringify({v:1,data:'gabinete'})); localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({v:1,data:'equipa'})); });
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2400);
await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Adicionar colaborador/i.test(x.innerText || '')); b && b.click(); });
await p.waitForTimeout(700);
await p.locator('input[placeholder="Nome completo"]:visible').first().fill('Colaborador Link');
await p.locator('input[placeholder="Email (para login)"]:visible').first().fill(func);
await p.getByRole('button', { name: /Adicionar \(convite pendente\)/i }).filter({ visible: true }).first().click();
await p.waitForTimeout(1800);
const tokenAntigo = await p.evaluate(async () => { const g = await import('/src/lib/gabinetes.ts'); const id = g.getActiveGabineteId(); const m = await g.getGabineteMeta(id,{force:true}); return (m?.invites||[]).filter(i=>i.token).pop()?.token || ''; });
ok(!!tokenAntigo, 'convite inicial criado');
await p.mouse.click(8, 8); await p.waitForTimeout(400);
// apaga o documento público (simula link morto)
const del = await fetch(`http://127.0.0.1:8180/v1/projects/recofatima-ferramenta/databases/(default)/documents/convites/${tokenAntigo}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } });
ok(del.status === 200 || del.status === 204, 'documento do link apagado');
const linha = p.locator('tr').filter({ hasText: func }).first();
await linha.getByRole('button', { name: /Copiar link/i }).click({ force: true });
await p.waitForTimeout(3000);
const linkNovo = await p.locator('div.fixed.inset-0.z-50 input').first().inputValue().catch(() => '');
const tokenNovo = (() => { try { return new URL(linkNovo).searchParams.get('t') || ''; } catch { return ''; } })();
ok(!!tokenNovo && tokenNovo !== tokenAntigo, 'gerou token novo');
const chk = await fetch(`http://127.0.0.1:8180/v1/projects/recofatima-ferramenta/databases/(default)/documents/convites/${tokenNovo}`, { headers: { Authorization: 'Bearer owner' } });
ok(chk.status === 200, 'documento do token novo existe');
await b.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
process.exit(falhas.length ? 1 : 0);
