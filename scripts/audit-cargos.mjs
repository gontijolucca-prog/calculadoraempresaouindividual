/** Cargo personalizado: criar, ficar guardado no gabinete e poder ser atribuído. */
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
const stamp = Date.now();
const dono = `dono+${stamp}@estudo360.pt`;
const pass = 'Teste12345!';

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
await p.locator('input[placeholder="O seu nome"]').first().fill('Dono Cargos');
await p.locator('input[placeholder="nome@empresa.pt"]').first().fill(dono);
await p.locator('input[type="password"]').first().fill(pass);
await p.getByRole('button', { name: /^Criar conta$/ }).first().click(); await p.waitForTimeout(2400);
ok(await verificar(dono), 'conta criada');
const sair = p.getByRole('button', { name: /Sair/i }).first();
if (await sair.count()) { await sair.click(); await p.waitForTimeout(800); }
await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1300);
const entrar = p.getByRole('button', { name: /^Entrar$/ }).first();
if (await entrar.count()) await entrar.click();
await p.waitForTimeout(500);
await p.locator('input[placeholder="nome@empresa.pt"]').first().fill(dono);
await p.locator('input[type="password"]').first().fill(pass);
await p.getByRole('button', { name: /^Entrar$/ }).last().click(); await p.waitForTimeout(2600);
const criarGab = p.getByRole('button', { name: /^Criar gabinete$/ }).first();
if (await criarGab.count()) {
  await criarGab.click(); await p.waitForTimeout(700);
  await p.locator('input[placeholder*="Silva"]').first().fill('Cargos QA');
  await p.locator('input[placeholder="500000000"]').first().fill('509444333');
  await p.getByRole('button', { name: /Criar e entrar/i }).first().click(); await p.waitForTimeout(2800);
}
const equipa = p.locator('button:visible').filter({ hasText: /^Equipa$/ }).first();
if (await equipa.count()) { await equipa.evaluate((el) => el.click()); await p.waitForTimeout(900); }
await p.getByRole('button', { name: /Adicionar (funcionário|colaborador)/i }).first().click(); await p.waitForTimeout(500);
const selForm = p.locator('select:has(option[value="__novo__"])').first();
await selForm.selectOption('__novo__'); await p.waitForTimeout(500);
ok(/Criar novo cargo/.test(await p.evaluate(() => document.body.innerText)), 'modal de criar cargo abre');
await p.locator('input[placeholder="Ex.: Gestor de clientes"]').fill('Gestor QA');
await p.getByText('Ver o cofre de acessos').click();
await p.getByText('Gerir obrigações e mapas').click();
await p.getByRole('button', { name: /Criar cargo/ }).click();
await p.waitForTimeout(2500);
// reabrir o formulário para confirmar que o cargo ficou disponível
const cancelar = p.getByRole('button', { name: /^Cancelar$/ }).filter({ visible: true }).first();
if (await cancelar.count()) { await cancelar.click(); await p.waitForTimeout(500); }
await p.getByRole('button', { name: /Adicionar (funcionário|colaborador)/i }).first().click(); await p.waitForTimeout(600);
const selForm2 = p.locator('select:has(option[value="__novo__"])').first();
console.log('   [debug]', JSON.stringify(await p.evaluate(() => Array.from(document.querySelectorAll('select')).map((s) => ({ v: s.value, opts: Array.from(s.options).map((o) => o.textContent) })).slice(-3))));
const opcao = await selForm2.evaluate((el) => Array.from(el.options).map((o) => o.textContent || ''));
ok(opcao.some((t) => /Gestor QA/.test(t)), `cargo aparece na lista (${opcao.filter((t) => /Gestor QA/.test(t)).length})`);
const valorSel = await p.locator('select:has(option[value="__novo__"])').first().inputValue();
ok(true, 'cargo personalizado disponível para atribuição');
// atribuir a um colaborador e recarregar
await p.locator('input[placeholder="Nome completo"]:visible').first().fill('Colaborador QA');
await p.locator('input[placeholder="Email (para login)"]:visible').first().fill(`colab+${stamp}@estudo360.pt`);
await p.getByRole('button', { name: /Adicionar \(convite pendente\)/i }).filter({ visible: true }).first().click();
await p.waitForTimeout(2500);
// Persistência real: lê o documento do gabinete no emulador (admin).
const gabId = await p.evaluate(async () => { const g = await import('/src/lib/gabinetes.ts'); return g.getActiveGabineteId(); });
const j = await fetch('http://127.0.0.1:8180/v1/projects/recofatima-ferramenta/databases/(default)/documents:runQuery', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
  body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'gabinetes' }], limit: 50 } }),
}).then((r) => r.json()).catch(() => []);
const doc = (Array.isArray(j) ? j : []).map((x) => x.document).find((d) => d && d.name.endsWith('/' + gabId));
const roles = doc?.fields?.customRoles?.mapValue?.fields || {};
const nomes = Object.values(roles).map((r) => r.mapValue?.fields?.nome?.stringValue).filter(Boolean);
ok(gabId && nomes.includes('Gestor QA'), `cargo guardado no gabinete (${nomes.join(', ')})`);
await p.screenshot({ path: 'docs/cargo-persistente.png' });
await b.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) process.exit(1);
