/**
 * E2E visual e funcional do novo fluxo Equipa.
 * Requer Firebase Auth/Firestore Emulator + Vite dev com emuladores ligados.
 */
import { chromium } from 'playwright-core';
import { patchFirestoreDoc } from '../functions/_firebaseAdmin.ts';

const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const KEY = 'AIzaSyChJKEBjPKZcRVF4R_n07UoUB9QO0q_EzM';
const PROJECT = 'demo-estudo360-audit';
const AUTH = 'http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1';
const env = {
  FIREBASE_PROJECT_ID: PROJECT,
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9199',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180',
  FIREBASE_API_KEY: KEY,
};
const failures = [];
const check = (condition, label) => {
  console.log(`${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failures.push(label);
};

async function signup(email, password = 'Teste12345!') {
  const response = await fetch(`${AUTH}/accounts:signUp?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await response.json();
  if (!data.localId) throw new Error(JSON.stringify(data));
  return data;
}

const stamp = Date.now();
const ownerEmail = `dono-ui+${stamp}@estudo360.pt`;
const ownerPassword = 'Teste12345!';
const ownerNewPassword = 'DonoNova23456!';
const collaboratorEmail = `colaborador-ui+${stamp}@empresa.pt`;
const collaboratorPassword = 'Equipa12345!';
const changedPassword = 'EquipaNova23456!';
const normalAccountPassword = 'Normal12345!';
const gid = `gab_ui_${stamp.toString(36)}`;
const owner = await signup(ownerEmail);
await patchFirestoreDoc(env, `gabinetes/${gid}`, {
  id: gid,
  nome: 'Gabinete UI',
  ownerUid: owner.localId,
  ownerEmail,
  memberUids: [owner.localId],
  members: {
    [owner.localId]: { role: 'admin', email: ownerEmail, addedAt: Date.now() },
  },
  customRoles: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('dialog', (dialog) => dialog.accept());

async function loginOn(targetPage, email, password) {
  await targetPage.goto(BASE, { waitUntil: 'load' });
  await targetPage.waitForTimeout(1200);
  const enter = targetPage.getByRole('button', { name: /^Entrar$/ }).first();
  if (await enter.count()) {
    await enter.click();
    await targetPage.waitForTimeout(350);
  }
  await targetPage.locator('input[autocomplete="username"]').first().fill(email);
  await targetPage.locator('input[type="password"]').first().fill(password);
  await targetPage.getByRole('button', { name: /^Entrar$/ }).last().click();
  await targetPage.waitForTimeout(2300);
}

async function login(email, password) {
  await loginOn(page, email, password);
}

async function logout() {
  const leave = page.getByRole('button', { name: /^Sair$/ }).first();
  if (await leave.count()) {
    await leave.click();
  } else {
    await page.evaluate(async () => {
      const { auth } = await import('/src/lib/firebase.ts');
      await auth.signOut();
    });
  }
  await page.waitForTimeout(900);
}

await login(ownerEmail, ownerPassword);
check(/Gabinete UI|Em que gabinete pretende trabalhar/i.test(await page.locator('body').innerText()), 'dono entra após login');
const gabButton = page.getByRole('button', { name: /Gabinete UI/i }).first();
if (await gabButton.count()) {
  await gabButton.click();
  await page.waitForTimeout(900);
}
await page.evaluate(() => {
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'gabinete' }));
  localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: 'equipa' }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1800);

const changePasswordButton = page.getByRole('button', { name: 'Alterar password' });
if (await changePasswordButton.count() === 0) {
  console.log('\n[debug entrada]', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1600));
  await page.screenshot({ path: 'docs/equipa-ui-debug.png', fullPage: true });
  await browser.close();
  process.exit(1);
}
await changePasswordButton.click();
await page.waitForTimeout(250);
const ownerPasswordDialog = page.getByRole('dialog', { name: 'Alterar password' });
await ownerPasswordDialog.locator('input').nth(0).fill(ownerPassword);
await ownerPasswordDialog.locator('input').nth(1).fill(ownerNewPassword);
await ownerPasswordDialog.locator('input').nth(2).fill(ownerNewPassword);
await ownerPasswordDialog.getByRole('button', { name: /Guardar password/i }).click();
await page.waitForTimeout(1000);
check(/Password da conta alterada/i.test(await page.locator('body').innerText()), 'conta normal altera a própria password');
await ownerPasswordDialog.getByRole('button', { name: /^Fechar$/ }).last().click();
await page.waitForTimeout(250);

const createButton = page.getByRole('button', { name: /Criar acesso/i }).first();
check(await createButton.count() === 1, 'dono vê o botão Criar acesso');
await createButton.click();
await page.waitForTimeout(300);
const form = page.locator('div.fixed.inset-0.z-\\[60\\]').first();
await form.locator('label').filter({ hasText: 'Nome completo' }).locator('input').fill('Colaborador UI');
await form.locator('label').filter({ hasText: 'Utilizador de entrada' }).locator('input').fill(collaboratorEmail);
await form.locator('label').filter({ hasText: 'Password inicial' }).locator('input').fill(collaboratorPassword);
await form.locator('label').filter({ hasText: 'Repetir password' }).locator('input').fill(collaboratorPassword);
await form.locator('label').filter({ hasText: 'Cargo' }).locator('select').selectOption('contabilista');
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(250);
const modalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(modalOverflow <= 1, `modal de criação não cria overflow em 375px (${modalOverflow})`);
await form.getByRole('button', { name: /^Criar acesso$/ }).click();
await page.waitForTimeout(2200);
check(/Acesso criado/i.test(await page.locator('body').innerText()), 'credenciais aparecem uma vez após criação');
check((await page.locator('body').innerText()).includes(collaboratorPassword), 'password é mostrada apenas no painel de entrega');
const storedBrowserData = await page.evaluate(() => [
  ...Object.values(localStorage),
  ...Object.values(sessionStorage),
].join('\n'));
check(!storedBrowserData.includes(collaboratorPassword), 'password não é guardada em localStorage nem sessionStorage');
if (!/Acesso criado/i.test(await page.locator('body').innerText())) {
  console.log('\n[debug Equipa]', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1200));
  await page.screenshot({ path: 'docs/equipa-tecnica-debug.png' });
  await browser.close();
  process.exit(1);
}
const credentialsPanel = page.locator('div.fixed.inset-0.z-\\[65\\]').first();
await credentialsPanel.getByRole('button', { name: /^Concluir$/ }).click();
await page.waitForTimeout(1200);
check((await page.locator('body').innerText()).includes(collaboratorEmail), 'colaborador fica na lista da equipa');

// Uma conta normal criada depois só entra no gabinete depois de confirmar a
// password secreta criada pelo dono. O mesmo email, sozinho, não é suficiente.
await signup(collaboratorEmail, normalAccountPassword);
const normalContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const normalPage = await normalContext.newPage();
normalPage.on('pageerror', (error) => pageErrors.push(`normal: ${error.message}`));
await loginOn(normalPage, collaboratorEmail, normalAccountPassword);
check(/Em que gabinete pretende trabalhar/i.test(await normalPage.locator('body').innerText()), 'conta normal criada depois não recebe acesso só pelo email');
await normalPage.getByRole('button', { name: /Confirmar acesso ao gabinete/i }).click();
const linkPassword = normalPage.locator('label').filter({ hasText: 'Password criada pelo gabinete' }).locator('input');
await linkPassword.fill('PasswordErrada123!');
await normalPage.getByRole('button', { name: /^Confirmar$/ }).click();
await normalPage.waitForTimeout(700);
check(/Não encontrámos um acesso ativo|Email ou password incorretos|password incorretos/i.test(await normalPage.locator('body').innerText()), 'password errada não associa a conta normal');
await linkPassword.fill(collaboratorPassword);
await normalPage.getByRole('button', { name: /^Confirmar$/ }).click();
await normalPage.waitForTimeout(2200);
check(/Lista de Empresas|Gabinete/i.test(await normalPage.locator('body').innerText()), 'password do gabinete liga a conta normal e entra');
await normalContext.close();

if (!(await page.locator('body').innerText()).includes(collaboratorEmail)) {
  console.log('\n[debug lista]', (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(-900));
}
const editRow = page.locator('tr').filter({ hasText: collaboratorEmail }).first();
await editRow.locator('button[title="Editar nome ou cargo"]').click();
await page.waitForTimeout(250);
const editForm = page.locator('div.fixed.inset-0.z-\\[60\\]').first();
await editForm.locator('label').filter({ hasText: 'Nome completo' }).locator('input').fill('Colaborador Editado');
await editForm.locator('label').filter({ hasText: 'Cargo' }).locator('select').selectOption('estagiaria');
await editForm.getByRole('button', { name: /Guardar alterações/i }).click();
await page.waitForTimeout(1000);
check(/Colaborador Editado/.test(await page.locator('body').innerText()), 'dono edita nome e cargo do colaborador');
await page.setViewportSize({ width: 1280, height: 900 });
await page.waitForTimeout(300);
const ownerOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(ownerOverflow <= 1, `ecrã Equipa não tem overflow no dono (${ownerOverflow})`);

await logout();
await login(collaboratorEmail, collaboratorPassword);
check(/Lista de Empresas|Gabinete/i.test(await page.locator('body').innerText()), 'colaborador entra com a password criada pelo dono');
check(await page.locator('button[title="Trocar de gabinete"]').count() === 0, 'conta técnica não vê a opção de trocar/criar gabinete');
check(await page.getByText(/Em que gabinete pretende trabalhar/i).count() === 0, 'conta técnica não passa pelo selector de gabinetes');
const employeeOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(employeeOverflow <= 1, `app do colaborador não tem overflow horizontal (${employeeOverflow})`);

await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1700);
check(/Lista de Empresas|Gabinete/i.test(await page.locator('body').innerText()), 'colaborador continua dentro após recarregar');

await page.getByRole('button', { name: 'Alterar password' }).click();
await page.waitForTimeout(250);
const passwordDialog = page.getByRole('dialog', { name: 'Alterar password' });
await passwordDialog.locator('input').nth(0).fill(collaboratorPassword);
await passwordDialog.locator('input').nth(1).fill(changedPassword);
await passwordDialog.locator('input').nth(2).fill(changedPassword);
await passwordDialog.getByRole('button', { name: /Guardar password/i }).click();
await page.waitForTimeout(1200);
check(/Password do acesso ao gabinete alterada/i.test(await page.locator('body').innerText()), 'colaborador altera a própria password');
await passwordDialog.getByRole('button', { name: /^Fechar$/ }).last().click();
await page.waitForTimeout(250);

await logout();
await login(collaboratorEmail, changedPassword);
check(/Lista de Empresas|Gabinete/i.test(await page.locator('body').innerText()), 'nova password do colaborador funciona');

const ownerContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const ownerPage = await ownerContext.newPage();
ownerPage.on('pageerror', (error) => pageErrors.push(`owner: ${error.message}`));
ownerPage.on('dialog', (dialog) => dialog.accept());
await loginOn(ownerPage, ownerEmail, ownerNewPassword);
const ownerGabButton = ownerPage.getByRole('button', { name: /Gabinete UI/i }).first();
if (await ownerGabButton.count()) {
  await ownerGabButton.click();
  await ownerPage.waitForTimeout(800);
}
await ownerPage.evaluate(() => {
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'gabinete' }));
  localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: 'equipa' }));
});
await ownerPage.reload({ waitUntil: 'load' });
await ownerPage.waitForTimeout(1700);
const row = ownerPage.locator('tr').filter({ hasText: collaboratorEmail }).first();
check(await row.count() === 1, 'dono volta a ver o colaborador');
await row.locator('button[title="Remover acesso"]').click();
await ownerPage.waitForTimeout(250);
await ownerPage.getByRole('button', { name: /^Remover acesso$/ }).last().click();
await ownerPage.waitForTimeout(1500);
check(await ownerPage.locator('tr').filter({ hasText: collaboratorEmail }).count() === 0, 'dono remove o acesso');

let revokedAoVivo = false;
for (let attempt = 0; attempt < 20; attempt++) {
  revokedAoVivo = /O acesso a este gabinete foi removido/i.test(await page.locator('body').innerText());
  if (revokedAoVivo) break;
  await page.waitForTimeout(500);
}
check(revokedAoVivo, 'sessão aberta do colaborador recebe o estado de acesso removido sem recarregar');
check(await page.getByText(/Em que gabinete pretende trabalhar/i).count() === 0, 'colaborador revogado não entra no selector nem na app');
await page.setViewportSize({ width: 375, height: 812 });
await page.waitForTimeout(250);
await page.screenshot({ path: 'docs/equipa-tecnica-revogada-375.png' });
check(pageErrors.length === 0, `sem exceções JavaScript (${pageErrors.join(' | ')})`);
// Login sem email: utilizador simples criado pelo dono entra pela AuthView.
const utilizadorSimples = `balcao${stamp.toString(36).slice(-5)}`;
const passwordSimples = 'Balcao2026!';
await ownerPage.bringToFront();
await ownerPage.getByRole('button', { name: /Criar acesso/i }).first().click();
await ownerPage.waitForTimeout(300);
const form2 = ownerPage.locator('div.fixed.inset-0.z-\\[60\\]').first();
await form2.locator('label').filter({ hasText: 'Nome completo' }).locator('input').fill('Balcão Sem Email');
await form2.locator('label').filter({ hasText: 'Utilizador de entrada' }).locator('input').fill(utilizadorSimples);
await form2.locator('label').filter({ hasText: 'Password inicial' }).locator('input').fill(passwordSimples);
await form2.locator('label').filter({ hasText: 'Repetir password' }).locator('input').fill(passwordSimples);
await form2.locator('label').filter({ hasText: 'Cargo' }).locator('select').selectOption('contabilista');
await ownerPage.setViewportSize({ width: 1280, height: 900 });
await form2.getByRole('button', { name: /^Criar acesso$/ }).click();
await ownerPage.waitForTimeout(2200);
const semEmailCriado = /Acesso criado/i.test(await ownerPage.locator('body').innerText());
check(semEmailCriado, 'dono cria acesso com utilizador simples (sem @)');
if (semEmailCriado) {
  await ownerPage.locator('div.fixed.inset-0.z-\\[65\\]').first().getByRole('button', { name: /^Concluir$/ }).click();
  await ownerPage.waitForTimeout(600);

  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p2 = await ctx2.newPage();
  const respostas = [];
  p2.on('response', async (r) => {
    if (r.url().includes('/api/colaborador-login')) {
      respostas.push(`${r.status()} ${(await r.text().catch(() => '')).slice(0, 160)}`);
    }
  });
  await loginOn(p2, utilizadorSimples, passwordSimples);
  let entrou = false;
  for (let i = 0; i < 12; i++) {
    // Entrou = saiu do ecrã de autenticação e está na app (a conta técnica
    // entra direto no gabinete, sem selector).
    const t = await p2.locator('body').innerText();
    entrou = /Lista de Empresas|Gabinete|Carteira/i.test(t) && !/Indique o email ou o utilizador/i.test(t);
    if (entrou) break;
    await p2.waitForTimeout(500);
  }
  check(entrou, 'entra com utilizador sem email pelo ecrã de login');
  if (!entrou) {
    console.log('[debug login]', (await p2.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400));
    console.log('[debug api]', respostas.join(' | ') || 'sem chamada a /api/colaborador-login');
  }
  await ctx2.close();
}

await ownerContext.close();

await browser.close();
console.log(failures.length ? `\nFAIL — ${failures.length} falha(s)` : '\nPASS — E2E visual da Equipa OK');
if (failures.length) process.exit(1);
