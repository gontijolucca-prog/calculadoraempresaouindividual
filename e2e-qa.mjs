// QA E2E temporário — corre contra vite dev (3001) + Firebase Emulator Suite.
// Uso: node e2e-qa.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3001';
const AUTH_EMU = 'http://127.0.0.1:9199';
const FS_EMU = 'http://127.0.0.1:8180';
const PROJECT = 'demo-estudo360';
const EMAIL = process.env.QA_EMAIL || `qa.${Date.now()}@estudo360.test`;
const PASS = 'Teste360!forte';
const SHOT = '/tmp/e2e360';
fs.mkdirSync(SHOT, { recursive: true });

const errors = [];
const logs = [];
let stepN = 0;
let page;
const step = async (name, fn) => {
  stepN++;
  process.stdout.write(`\n== ${String(stepN).padStart(2, '0')} ${name}\n`);
  try {
    await fn();
    console.log('   ok');
    await page.screenshot({ path: `${SHOT}/${String(stepN).padStart(2, '0')}.png` }).catch(() => {});
  } catch (e) {
    console.error('   FALHOU:', e?.message?.slice(0, 500));
    await page.screenshot({ path: `${SHOT}/falha-${String(stepN).padStart(2, '0')}.png`, fullPage: true }).catch(() => {});
    throw e;
  }
};
const checkpoint = (msg) => console.log('   ·', msg);

const oobCodes = async () => (await (await fetch(`${AUTH_EMU}/emulator/v1/projects/${PROJECT}/oobCodes`)).json()).oobCodes || [];
async function verifyEmail(email) {
  for (let i = 0; i < 30; i++) {
    const c = (await oobCodes()).find(x => x.email === email && x.requestType === 'VERIFY_EMAIL');
    if (c) {
      const r = await fetch(`${AUTH_EMU}/identitytoolkit.googleapis.com/v1/accounts:update?key=fake`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ oobCode: c.oobCode }),
      });
      if (!r.ok) throw new Error(`applyActionCode: ${r.status} ${await r.text()}`);
      return;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('oobCode de verificação não apareceu para ' + email);
}

async function openGabTab(label) {
  const nav = page.locator('aside button[title^="Gabinete —"]').first();
  for (let i = 0; i < 4; i++) {
    const expanded = await nav.getAttribute('aria-expanded').catch(() => null);
    if (expanded === 'true') break;
    await nav.click();
    await page.waitForTimeout(500);
  }
  await page.locator(`aside button:has-text("${label}")`).first().click({ timeout: 15000 });
  await page.waitForTimeout(400);
}

const browser = await chromium.launch({
  executablePath: process.env.QA_CHROME || '/Users/lucca/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell',
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
page = await ctx.newPage();
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text().slice(0, 300)}`); });
page.on('console', m => logs.push(m.text()));
page.on('requestfailed', r => {
  const u = r.url();
  if (!u.includes('favicon') && !u.includes('fonts.g')) errors.push(`requestfailed: ${u.slice(0, 120)} ${r.failure()?.errorText}`);
});

let gabineteId = null;

try {
  await step('Landing carrega', async () => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    for (let i = 0; i < 20 && !logs.some(l => l.includes('emuladores locais ligados')); i++) await page.waitForTimeout(300);
    if (!logs.some(l => l.includes('emuladores locais ligados'))) {
      throw new Error('GUARDA: emuladores não ligados — abortar para não tocar em produção');
    }
    await page.locator('button:has-text("Criar conta grátis")').first().click({ timeout: 20000 });
    await page.locator('input[placeholder="O seu nome"]').waitFor({ timeout: 20000 });
  });

  await step('Signup com email/senha', async () => {
    await page.locator('input[placeholder="O seu nome"]').fill('QA E2E');
    await page.locator('input[placeholder="nome@empresa.pt"]').fill(EMAIL);
    await page.locator('input[placeholder="Mínimo 8 caracteres"]').fill(PASS);
    await page.locator('form button:has-text("Criar conta")').click();
    await page.locator('text=Confirme o seu email').waitFor({ timeout: 20000 });
  });

  await step('Verificação de email (oobCode do emulador)', async () => {
    await verifyEmail(EMAIL);
    await page.locator('button:has-text("Já confirmei")').click();
    await page.locator('text=Em que gabinete pretende trabalhar?').waitFor({ timeout: 25000 });
  });

  await step('Criar gabinete', async () => {
    await page.locator('button:has-text("Criar gabinete")').first().click();
    await page.locator('input[placeholder="Ex: Silva & Associados"]').fill('QA Gabinete E2E');
    await page.locator('button:has-text("Criar e entrar")').click();
    await page.locator('aside button:has-text("Lista de Empresas")').first().waitFor({ timeout: 30000 });
    gabineteId = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('estudo360:v1:gabinete:activeId') || '')?.data || null; } catch { return null; }
    });
    checkpoint('gabineteId=' + gabineteId);
  });

  await step('Criar cliente (Lista de Empresas → à mão → Guardar)', async () => {
    await page.locator('aside button:has-text("Lista de Empresas")').first().click();
    await page.locator('button:has-text("Nova Empresa")').first().click();
    await page.locator('button:has-text("Inserir à mão")').click();
    await page.locator('input[placeholder="Nome completo ou denominação social"]').first().fill('QA Cliente E2E Lda');
    await page.locator('button:has-text("Guardar cliente")').click();
    await page.waitForTimeout(2500);
  });

  await step('Gabinete → Visão geral mostra cliente real', async () => {
    await openGabTab('Visão geral');
    await page.locator('text=Ficha 360').first().waitFor({ timeout: 20000 });
    await page.locator('text=Resumo da empresa').first().waitFor({ timeout: 20000 });
    await page.locator('text=QA Cliente E2E Lda').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(2500);
  });

  await step('Obrigações: desligar DMR persiste (6/7 ativas)', async () => {
    await page.locator('text=7/7 ativas').waitFor({ timeout: 15000 });
    const chk = page.locator('label:has-text("DMR") input[type="checkbox"]').first();
    await chk.click();
    await page.locator('text=6/7 ativas').waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
  });

  await step('Adicionar alerta com vencimento', async () => {
    await page.locator('button:has-text("+ Alerta")').first().click();
    const modal = page.locator('div.fixed', { has: page.locator('h3:has-text("Novo alerta")') }).last();
    await modal.locator('textarea').fill('QA Alerta E2E confirmar IVA');
    const d = new Date(); d.setDate(d.getDate() + 3);
    await modal.locator('input[type="date"]').fill(d.toISOString().slice(0, 10));
    await modal.locator('button:has-text("Adicionar")').click();
    await page.locator('text=QA Alerta E2E confirmar IVA').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
  });

  await step('Adicionar tarefa', async () => {
    await page.locator('button:has-text("+ Nova")').first().click();
    const modal = page.locator('div.fixed', { has: page.locator('h3:has-text("Nova tarefa")') }).last();
    await modal.locator('input[placeholder="Título da tarefa"]').fill('QA Tarefa E2E');
    const d = new Date(); d.setDate(d.getDate() + 2);
    const dateInput = modal.locator('input[type="date"]');
    if (await dateInput.count()) await dateInput.first().fill(d.toISOString().slice(0, 10));
    await modal.locator('button:has-text("Criar tarefa")').click();
    await page.locator('text=QA Tarefa E2E').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
  });

  await step('Agenda mostra eventos do mês', async () => {
    await openGabTab('Agenda');
    await page.waitForTimeout(1500);
    const dia = String(new Date().getDate() + 3);
    await page.locator(`button:has-text("${dia}")`).first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
  });

  await step('Tarefas: apagar QA Tarefa (soft-delete)', async () => {
    await openGabTab('Tarefas');
    await page.locator('button:has-text("Nova tarefa")').first().waitFor({ timeout: 15000 });
    const row = page.locator('tr:has-text("QA Tarefa E2E")').first();
    await row.waitFor({ timeout: 15000 });
    await row.locator('button').last().click();
    await page.waitForTimeout(1200);
    if (await page.locator('tr:has-text("QA Tarefa E2E")').count()) throw new Error('tarefa continua na lista após apagar');
  });

  await step('Lixeira: restaurar QA Tarefa', async () => {
    await openGabTab('Lixeira');
    const linha = page.locator('tr:has-text("QA Tarefa E2E")').first();
    await linha.waitFor({ timeout: 15000 });
    await linha.locator('button:has-text("Restaurar")').click({ timeout: 15000 });
    await page.waitForTimeout(1500);
  });

  await step('Tarefas: QA Tarefa voltou após restaurar', async () => {
    await openGabTab('Tarefas');
    await page.locator('button:has-text("Nova tarefa")').first().waitFor({ timeout: 15000 });
    await page.locator('tr:has-text("QA Tarefa E2E")').first().waitFor({ timeout: 15000 });
  });

  await step('Reload: dados persistem (Firestore emulador)', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('aside button[title^="Gabinete —"]').first().waitFor({ timeout: 30000 });
    await openGabTab('Visão geral');
    await page.locator('text=QA Cliente E2E Lda').first().waitFor({ timeout: 25000 });
    await page.locator('text=QA Alerta E2E confirmar IVA').first().waitFor({ timeout: 15000 });
    await page.locator('text=QA Tarefa E2E').first().waitFor({ timeout: 15000 });
    await page.locator('text=6/7 ativas').waitFor({ timeout: 15000 });
  });

  await step('Regras Firestore (emulador): intruso bloqueado, dono permitido', async () => {
    const idToken2 = await (async () => {
      const r = await fetch(`${AUTH_EMU}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: `intruso.${Date.now()}@estudo360.test`, password: 'Teste360!forte', returnSecureToken: true }),
      });
      const j = await r.json();
      if (!j.idToken) throw new Error('signup intruso falhou: ' + JSON.stringify(j).slice(0, 200));
      return j.idToken;
    })();
    const idToken1 = await (async () => {
      const r = await fetch(`${AUTH_EMU}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASS, returnSecureToken: true }),
      });
      const j = await r.json();
      if (!j.idToken) throw new Error('login dono falhou: ' + JSON.stringify(j).slice(0, 200));
      return j.idToken;
    })();
    // O Firestore emulado é namespaced pelo projectId da app (recofatima-ferramenta).
    const FSP = 'recofatima-ferramenta';
    const gurl = `${FS_EMU}/v1/projects/${FSP}/databases/(default)/documents/gabinetes/${gabineteId}`;
    const curl = `${FS_EMU}/v1/projects/${FSP}/databases/(default)/documents/gabinete/${gabineteId}/clientes`;
    const get = async (url, tok) => (await fetch(url, { headers: { Authorization: `Bearer ${tok}` } })).status;
    const intrusoMeta = await get(gurl, idToken2);
    const intrusoClientes = await get(curl, idToken2);
    const donoMeta = await get(gurl, idToken1);
    const donoClientes = await get(curl, idToken1);
    checkpoint(`intruso: meta=${intrusoMeta} clientes=${intrusoClientes} · dono: meta=${donoMeta} clientes=${donoClientes}`);
    if (intrusoMeta !== 403) throw new Error(`intruso devia levar 403 em gabinetes/{id}, veio ${intrusoMeta}`);
    if (intrusoClientes !== 403) throw new Error(`intruso devia levar 403 em clientes, veio ${intrusoClientes}`);
    if (donoMeta !== 200) throw new Error(`dono devia ler meta (200), veio ${donoMeta}`);
    if (donoClientes !== 200) throw new Error(`dono devia ler clientes (200), veio ${donoClientes}`);
  });

  console.log('\n=== RESULTADO: todos os passos ok ===');
} catch (e) {
  console.error('\n=== RESULTADO: falhou ===', e?.message);
  process.exitCode = 1;
} finally {
  await page.waitForTimeout(1200);
  const relevant = [...new Set(errors)];
  console.log(`\nErros de consola/rede capturados: ${relevant.length}`);
  for (const e of relevant.slice(0, 30)) console.log(' -', e);
  await browser.close();
  if (relevant.length) process.exitCode = 1;
}
