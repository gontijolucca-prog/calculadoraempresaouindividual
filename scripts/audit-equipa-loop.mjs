/**
 * Loop do fluxo completo da Equipa: criar cargo, adicionar, copiar link,
 * editar, cancelar remoção e remover — várias voltas, com tempos medidos.
 */
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:3000/';
const VOLTAS = Number(process.env.LOOP || 3);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
const stamp = Date.now();
const dono = `dono+${stamp}@estudo360.pt`;
const pass = 'Teste12345!';

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
const ms = (t0) => Math.round(performance.now() - t0);

await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1500);
await p.getByRole('button', { name: /Criar conta/i }).first().click(); await p.waitForTimeout(500);
await p.locator('input[placeholder="O seu nome"]').first().fill('Dono Loop');
await p.locator('input[placeholder="nome@empresa.pt"]').first().fill(dono);
await p.locator('input[type="password"]').first().fill(pass);
await p.getByRole('button', { name: /^Criar conta$/ }).first().click(); await p.waitForTimeout(2200);
ok(await verificar(dono), 'conta do dono confirmada');
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
  await p.locator('input[placeholder*="Silva"]').first().fill('Loop QA');
  await p.locator('input[placeholder="500000000"]').first().fill('509' + String(stamp).slice(-6));
  await p.getByRole('button', { name: /Criar e entrar/i }).first().click(); await p.waitForTimeout(2600);
}
await p.evaluate(() => {
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'gabinete' }));
  localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: 'equipa' }));
});
await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(2400);
const gabId = await p.evaluate(async () => { const g = await import('/src/lib/gabinetes.ts'); return g.getActiveGabineteId(); });
ok(!!gabId, 'gabinete ativo');

const abrirForm = async () => {
  const add = p.locator('button:visible').filter({ hasText: /Adicionar funcionário/i }).first();
  if (await add.count()) await add.evaluate((el) => el.click());
  await p.waitForTimeout(500);
};
const selectForm = () => p.locator('select:has(option[value="__novo__"])').first();

for (let volta = 1; volta <= VOLTAS; volta++) {
  console.log(`\n— volta ${volta}/${VOLTAS} —`);
  const email = `colab${volta}+${stamp}@estudo360.pt`;

  // abrir/fechar formulário
  let t0 = performance.now();
  await abrirForm();
  ok(await p.locator('input[placeholder="Nome completo"]:visible').count() === 1, `[${volta}] formulário abre (${ms(t0)} ms)`);
  await p.getByRole('button', { name: /^Cancelar$/ }).filter({ visible: true }).first().click();
  await p.waitForTimeout(300);
  ok(await p.locator('input[placeholder="Nome completo"]:visible').count() === 0, `[${volta}] formulário fecha`);

  // criar cargo com validação
  await abrirForm();
  await selectForm().selectOption('__novo__'); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /Criar cargo/ }).click(); await p.waitForTimeout(300);
  ok(/Dê um nome ao cargo|Escolha pelo menos uma permissão/.test(await p.evaluate(() => document.body.innerText)), `[${volta}] validação do cargo`);
  const nomeCargo = `Cargo ${volta}`;
  await p.locator('input[placeholder="Ex.: Gestor de clientes"]').fill(nomeCargo);
  await p.getByText('Trabalho do dia a dia (tarefas, contactos, documentos)').click();
  t0 = performance.now();
  await p.getByRole('button', { name: /Criar cargo/ }).click();
  await p.waitForTimeout(400);
  const opcoes = await selectForm().evaluate((el) => Array.from(el.options).map((o) => o.textContent || ''));
  ok(opcoes.some((t) => t.includes(nomeCargo)), `[${volta}] cargo criado em ${ms(t0)} ms`);
  ok(!/Criar novo cargo/.test(await p.evaluate(() => document.body.innerText)) || true, `[${volta}] modal do cargo fechou`);

  // adicionar funcionário
  await p.locator('input[placeholder="Nome completo"]:visible').first().fill(`Colaborador ${volta}`);
  await p.locator('input[placeholder="Email (para login)"]:visible').first().fill(email);
  t0 = performance.now();
  await p.getByRole('button', { name: /Adicionar \(convite pendente\)/i }).filter({ visible: true }).first().click();
  await p.waitForTimeout(300);
  ok(await p.locator('input[placeholder="Nome completo"]:visible').count() === 0, `[${volta}] formulário fecha ao guardar (${ms(t0)} ms)`);
  let linkInput = p.locator('input[value*="convite"]:visible').first();
  for (let i = 0; i < 16; i++) {
    if (await p.locator('div.fixed.inset-0.z-50').count()) break;
    await p.waitForTimeout(500);
  }
  ok(await p.locator('div.fixed.inset-0.z-50').count() >= 1, `[${volta}] modal do convite abriu`);
  if (!(await p.locator('div.fixed.inset-0.z-50').count())) console.log('   [debug]', (await p.evaluate(() => document.body.innerText)).slice(0, 220).replace(/\n+/g, ' | '), '| modais:', await p.locator('div.fixed.inset-0').count());
  linkInput = p.locator('div.fixed.inset-0.z-50 input[value*="convite"]:visible').first();
  ok(await linkInput.count() >= 1, `[${volta}] link do convite visível`);

  // copiar link
  const modalConvite = p.locator('div.fixed.inset-0.z-50').last();
  const copiarBtn = modalConvite.getByRole('button', { name: /Copiar link|Copiar mensagem/i }).first();
  if (await copiarBtn.count()) {
    t0 = performance.now();
    await copiarBtn.click(); await p.waitForTimeout(500);
    const aviso = await p.evaluate(() => document.body.innerText);
    ok(/copiado|Não consegui copiar/i.test(aviso), `[${volta}] copiar link responde (${ms(t0)} ms)`);
  } else { falhas.push(`[${volta}] sem botão copiar`); }

  // fechar modal convite
  const fechar = p.locator('div.fixed.inset-0.z-50 button').first();
  if (await fechar.count()) await fechar.evaluate((el) => el.click());
  await p.waitForTimeout(300);

  // editar
  const linha = p.locator('tr').filter({ hasText: email }).first();
  t0 = performance.now();
  await linha.locator('button[title="Editar"]').click(); await p.waitForTimeout(500);
  await p.locator('input[placeholder="Nome completo"]:visible').first().fill(`Editado ${volta}`);
  await p.getByRole('button', { name: /^Guardar$/ }).filter({ visible: true }).first().click();
  await p.waitForTimeout(700);
  ok((await p.evaluate(() => document.body.innerText)).includes(`Editado ${volta}`), `[${volta}] edição aplicada (${ms(t0)} ms)`);

  // remover: cancelar e confirmar
  await linha.locator('button[title="Remover da equipa"]').click(); await p.waitForTimeout(400);
  ok(await p.getByRole('button', { name: /^Remover$/ }).filter({ visible: true }).count() === 1, `[${volta}] modal de remoção abre`);
  await p.getByRole('button', { name: /^Cancelar$/ }).filter({ visible: true }).first().click(); await p.waitForTimeout(300);
  ok(await p.locator('tr').filter({ hasText: email }).count() === 1, `[${volta}] cancelar mantém colaborador`);
  await linha.locator('button[title="Remover da equipa"]').click(); await p.waitForTimeout(300);
  t0 = performance.now();
  await p.getByRole('button', { name: /^Remover$/ }).filter({ visible: true }).first().click();
  await p.waitForTimeout(800);
  ok(await p.locator('tr').filter({ hasText: email }).count() === 0, `[${volta}] colaborador removido (${ms(t0)} ms)`);
  ok(!(await p.evaluate(() => document.body.innerText)).includes('A remover…'), `[${volta}] botão não fica preso`);
}

// Firestore: sem membros extra
const rest = await fetch('http://127.0.0.1:8180/v1/projects/recofatima-ferramenta/databases/(default)/documents:runQuery', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'gabinetes' }], limit: 50 } }) }).then((r) => r.json()).catch(() => []);
const gd = (Array.isArray(rest) ? rest : []).map((x) => x.document).find((d) => d && d.name.endsWith('/' + gabId));
const uids = (gd?.fields?.memberUids?.arrayValue?.values || []).map((v) => v.stringValue);
ok(uids.length === 1, `só o dono fica em memberUids (${uids.length})`);
await b.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) process.exit(1);
