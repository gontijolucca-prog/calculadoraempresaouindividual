/** Editar colaborador: nome e cargo persistem no registo e no gabinete. */
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
const stamp = Date.now();
const dono = `dono+${stamp}@estudo360.pt`, func = `func+${stamp}@estudo360.pt`, pass = 'Teste12345!';

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
await p.locator('input[placeholder="O seu nome"]').first().fill('Dono Editar');
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
  await p.locator('input[placeholder*="Silva"]').first().fill('Editar QA');
  await p.locator('input[placeholder="500000000"]').first().fill('509111000');
  await p.getByRole('button', { name: /Criar e entrar/i }).first().click(); await p.waitForTimeout(2800);
}
await p.evaluate(() => {
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'gabinete' }));
  localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: 'equipa' }));
});
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2500);
await p.getByRole('button', { name: /Adicionar (funcionário|colaborador)/i }).first().click(); await p.waitForTimeout(500);
await p.locator('input[placeholder="Nome completo"]:visible').first().fill('Nome Antigo');
await p.locator('input[placeholder="Email (para login)"]:visible').first().fill(func);
await p.getByRole('button', { name: /Adicionar \(convite pendente\)/i }).filter({ visible: true }).first().click();
await p.waitForTimeout(2200);
// fechar modal e editar
await p.mouse.click(6, 6); await p.waitForTimeout(500);
const linha = p.locator('tr').filter({ hasText: func }).first();
ok(await linha.count() === 1, 'linha do colaborador visível');
await linha.locator('button[title="Editar"]').click();
await p.waitForTimeout(600);
await p.locator('input[placeholder="Nome completo"]:visible').first().fill('Nome Novo');
await p.locator('select:has(option[value="__novo__"])').first().selectOption('estagiaria');
await p.getByRole('button', { name: /^Guardar$/ }).filter({ visible: true }).first().click();
await p.waitForTimeout(2000);
// tentar mudar o email: tem de ser recusado (o acesso é do uid, não do email)
const linhaEdit = p.locator('tr').filter({ hasText: 'Nome Novo' }).first();
if (await linhaEdit.count()) {
  await linhaEdit.locator('button[title="Editar"]').click(); await p.waitForTimeout(500);
  await p.locator('input[placeholder="Email (para login)"]:visible').first().fill('outro+' + Date.now() + '@estudo360.pt');
  await p.getByRole('button', { name: /^Guardar$/ }).filter({ visible: true }).first().click();
  await p.waitForTimeout(700);
  ok(/Para mudar o email/i.test(await p.evaluate(() => document.body.innerText)), 'mudança de email recusada com explicação');
  await p.getByRole('button', { name: /^Cancelar$/ }).filter({ visible: true }).first().click();
  await p.waitForTimeout(400);
}
const texto = await p.evaluate(() => document.body.innerText);
ok(/Nome Novo/.test(texto), 'nome novo na lista');
// Firestore: convite e colaborador atualizados
const j = await fetch('http://127.0.0.1:8180/v1/projects/recofatima-ferramenta/databases/(default)/documents:runQuery', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
  body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'gabinetes' }], limit: 50 } }),
}).then((r) => r.json()).catch(() => []);
const docs = (Array.isArray(j) ? j : []).map((x) => x.document).filter(Boolean);
const g = docs.find((d) => (d.fields?.invites?.arrayValue?.values || []).some((v) => v.mapValue?.fields?.email?.stringValue === func));
const inv = (g?.fields?.invites?.arrayValue?.values || []).map((v) => v.mapValue?.fields || {}).find((f) => (f.email?.stringValue || '').toLowerCase() === func);
ok(inv?.role?.stringValue === 'estagiaria', `cargo no convite atualizado (${inv?.role?.stringValue})`);
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2500);
ok(/Nome Novo/.test(await p.evaluate(() => document.body.innerText)), 'nome persiste depois de recarregar');
await b.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) process.exit(1);
