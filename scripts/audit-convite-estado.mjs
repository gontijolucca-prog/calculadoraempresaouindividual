/** Convite: link abre página de password; após aceitar a linha fica "Ativa". */
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = []; const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
const stamp = Date.now();
const dono = `dono+${stamp}@estudo360.pt`, func = `colab+${stamp}@estudo360.pt`, pass = 'Teste12345!';

const b = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 950 }, permissions: ['clipboard-read', 'clipboard-write'] });
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
await p.locator('input[placeholder="O seu nome"]').first().fill('Dono Estado');
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
  await p.locator('input[placeholder*="Silva"]').first().fill('Estado QA');
  await p.locator('input[placeholder="500000000"]').first().fill('509' + String(stamp).slice(-6));
  await p.getByRole('button', { name: /Criar e entrar/i }).first().click(); await p.waitForTimeout(2600);
}
await p.evaluate(() => {
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'gabinete' }));
  localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: 'equipa' }));
});
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2400);
const add = p.locator('button:visible').filter({ hasText: /Adicionar colaborador/i }).first();
ok(await add.count() === 1, 'botão diz «Adicionar colaborador»');
await add.evaluate((el) => el.click()); await p.waitForTimeout(700);
console.log('   [debug] form?', await p.locator('input[placeholder="Nome completo"]:visible').count(), '| modais', await p.locator('div.fixed.inset-0').count(), '|', (await p.evaluate(() => document.body.innerText)).slice(0, 120).replace(/\n+/g, ' | '));
await p.locator('input[placeholder="Nome completo"]:visible').first().fill('Colaborador Estado');
await p.locator('input[placeholder="Email (para login)"]:visible').first().fill(func);
const btnAdd = p.getByRole('button', { name: /Adicionar \(convite pendente\)/i }).filter({ visible: true }).first();
ok(await btnAdd.count() === 1, 'botão de guardar visível');
await btnAdd.click({ force: true });
await p.waitForTimeout(900);
console.log('   [debug modal]', (await p.locator('div.fixed.inset-0').first().innerText().catch(() => '')).slice(0, 220).replace(/\n+/g, ' | '));
await p.waitForTimeout(2500);
console.log('   [debug aviso]', (await p.evaluate(() => document.body.innerText)).match(/[^\n]*(falhou|Não consegui|Sem permissão|tempo esgotado)[^\n]*/gi)?.slice(0,2) || 'sem aviso');
// Copiar link tem de responder e colocar o URL na área de transferência
const copiar = p.locator('div.fixed.inset-0.z-50').last().getByRole('button', { name: /Copiar link/i }).first();
ok(await copiar.count() === 1, 'botão Copiar link visível');
if (await copiar.count()) {
  await copiar.click({ force: true }); await p.waitForTimeout(500);
  const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  ok(/convite\?t=/.test(clip), `clipboard tem o link (${String(clip).slice(0, 48)}…)`);
  ok(/copiado/i.test(await p.evaluate(() => document.body.innerText)), 'aviso «Link copiado.»');
}
const linkVal = await p.locator('div.fixed.inset-0.z-50 input').first().inputValue().catch(() => '');
const token = (() => { try { return new URL(linkVal).searchParams.get('t') || ''; } catch { return ''; } })();
ok(!!token, `link com token no modal (${linkVal.slice(0, 60)}…)`);
// O documento público tem de existir
const docOk = await p.evaluate(async (t) => {
  const f = await import('/src/lib/firebase.ts');
  const tok = await f.auth.currentUser.getIdToken();
  const r = await fetch(`http://127.0.0.1:8180/v1/projects/recofatima-ferramenta/databases/(default)/documents/convites/${t}`, { headers: { Authorization: `Bearer ${tok}` } });
  return r.status === 200;
}, token);
ok(docOk, 'documento do convite existe no Firestore');

const ctx2 = await b.newContext({ viewport: { width: 420, height: 900 } });
const p2 = await ctx2.newPage();
await p2.goto(BASE + 'convite.html?t=' + token + '&emu=1', { waitUntil: 'load' }); await p2.waitForTimeout(3000);
ok(await p2.locator('#p1').isVisible().catch(() => false), 'página pede password');
await p2.locator('#p1').fill('Forte12345'); await p2.locator('#p2').fill('Forte12345');
await p2.locator('#go').click(); await p2.waitForTimeout(6500);

// volta ao dono e verifica estado na lista
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2500);
const texto = await p.evaluate(() => document.body.innerText);
ok(texto.includes(func), 'colaborador continua na lista');
ok(/Ativa/.test(texto), 'estado mudou para Ativa (não desapareceu)');
await p.screenshot({ path: 'docs/colaborador-ativa.png' });
await b.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) process.exit(1);
