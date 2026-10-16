// QA E2E fase 2 — cofre, outbox offline, convite de estagiária e regras REST.
// Uso: node e2e-qa2.mjs  (requer vite em :3001 + emuladores)
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3001';
const AUTH_EMU = 'http://127.0.0.1:9199';
const FS_EMU = 'http://127.0.0.1:8180';
const FSP = 'recofatima-ferramenta';
const PROJECT = 'demo-estudo360';
const STAMP = Date.now();
const EMAIL1 = `qa2.dono.${STAMP}@estudo360.test`;
const EMAIL2 = `qa2.estag.${STAMP}@estudo360.test`;
const PASS = 'Teste360!forte';
const SHOT = '/tmp/e2e360-qa2';
fs.mkdirSync(SHOT, { recursive: true });

const errors = [];
const logsA = [];
const facts = [];
let stepN = 0;
const dialogs = [];
async function step(p, name, fn) {
  stepN++;
  process.stdout.write(`\n== ${String(stepN).padStart(2, '0')} ${name}\n`);
  try {
    await fn();
    console.log('   ok');
    await p.screenshot({ path: `${SHOT}/${String(stepN).padStart(2, '0')}.png` }).catch(() => {});
  } catch (e) {
    console.error('   FALHOU:', e?.message?.slice(0, 400));
    await p.screenshot({ path: `${SHOT}/falha-${String(stepN).padStart(2, '0')}.png`, fullPage: true }).catch(() => {});
    throw e;
  }
}

const oobCodes = async () => (await (await fetch(`${AUTH_EMU}/emulator/v1/projects/${PROJECT}/oobCodes`)).json()).oobCodes || [];
async function verifyEmail(email) {
  for (let i = 0; i < 40; i++) {
    const c = (await oobCodes()).find(x => x.email === email && x.requestType === 'VERIFY_EMAIL');
    if (c) {
      const r = await fetch(`${AUTH_EMU}/identitytoolkit.googleapis.com/v1/accounts:update?key=fake`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ oobCode: c.oobCode }),
      });
      if (!r.ok) throw new Error(`applyActionCode: ${r.status}`);
      return;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('sem oobCode para ' + email);
}
async function openGabTab(p, label) {
  const nav = p.locator('aside button[title^="Gabinete —"]').first();
  for (let i = 0; i < 4; i++) {
    const expanded = await nav.getAttribute('aria-expanded').catch(() => null);
    if (expanded === 'true') break;
    await nav.click();
    await p.waitForTimeout(500);
  }
  await p.locator('aside button').filter({ hasText: new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click({ timeout: 15000 });
  await p.waitForTimeout(400);
}
function wireCtx(ctx, logs, tag) {
  ctx.on('page', page => {
    page.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
    page.on('console', m => { logs.push(m.text()); if (m.type() === 'error') errors.push(`[${tag}] console.error: ${m.text().slice(0, 250)}`); });
    page.on('dialog', async d => { dialogs.push(`[${tag}] ${d.type()}: ${d.message().slice(0, 200)}`); await d.accept().catch(() => {}); });
    page.on('response', r => { if (r.status() >= 400 && !r.url().includes('cleardot')) errors.push(`[${tag}] HTTP ${r.status()} ${r.url().slice(0, 160)}`); });
  });
}

const browser = await chromium.launch({
  executablePath: process.env.QA_CHROME || '/Users/lucca/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell',
});
const ctxA = await browser.newContext({ viewport: { width: 1440, height: 950 } });
wireCtx(ctxA, logsA, 'A');
const A = await ctxA.newPage();
const logsB = [];
const ctxB = await browser.newContext({ viewport: { width: 1440, height: 950 } });
wireCtx(ctxB, logsB, 'B');
const B = await ctxB.newPage();

async function signup(p, name, email) {
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 20 && !logsA.some(l => l.includes('emuladores locais ligados')); i++) await p.waitForTimeout(300);
  if (!logsA.some(l => l.includes('emuladores locais ligados'))) throw new Error('GUARDA: emuladores não ligados');
  await p.locator('button:has-text("Criar conta grátis")').first().click({ timeout: 20000 });
  await p.locator('input[placeholder="O seu nome"]').fill(name);
  await p.locator('input[placeholder="nome@empresa.pt"]').fill(email);
  await p.locator('input[placeholder="Mínimo 8 caracteres"]').fill(PASS);
  await p.locator('form button:has-text("Criar conta")').click();
  await p.locator('text=Confirme o seu email').waitFor({ timeout: 20000 });
}

let gabineteId = null;
try {
  await step(A, 'Dono: signup + verificar + criar gabinete + cliente', async () => {
    await signup(A, 'QA2 Dono', EMAIL1);
    await verifyEmail(EMAIL1);
    await A.locator('button:has-text("Já confirmei")').click();
    await A.locator('text=Em que gabinete pretende trabalhar?').waitFor({ timeout: 25000 });
    await A.locator('button:has-text("Criar gabinete")').first().click();
    await A.locator('input[placeholder="Ex: Silva & Associados"]').fill('QA2 Gabinete');
    await A.locator('button:has-text("Criar e entrar")').click();
    await A.locator('aside button:has-text("Lista de Empresas")').first().waitFor({ timeout: 30000 });
    gabineteId = await A.evaluate(() => { try { return JSON.parse(localStorage.getItem('estudo360:v1:gabinete:activeId') || '')?.data || null; } catch { return null; } });
    if (!gabineteId) throw new Error('sem gabineteId');
    facts.push('gabineteId=' + gabineteId);
    await A.locator('aside button:has-text("Lista de Empresas")').first().click();
    await A.locator('button:has-text("Nova Empresa")').first().click();
    await A.locator('button:has-text("Inserir à mão")').click();
    await A.locator('input[placeholder="Nome completo ou denominação social"]').first().fill('QA2 Cliente Lda');
    await A.locator('button:has-text("Guardar cliente")').click();
    await A.waitForTimeout(2500);
  });

  await step(A, 'Cofre: adicionar entrada, revelar, sem "Limpar vazias"', async () => {
    await openGabTab(A, 'Cofre');
    await A.locator('text=Cofre vazio').waitFor({ timeout: 15000 }).catch(() => {});
    const vazio = await A.locator('text=Cofre vazio').count();
    facts.push('cofre vazio no inicio=' + vazio);
    if (vazio) await A.locator('button:has-text("Guardar primeiro")').first().click();
    else await A.locator('button:has-text("Adicionar")').first().click();
    await A.locator('text=Novo acesso').waitFor({ timeout: 10000 });
    await A.locator('input[placeholder="ex: Portal das Finanças"]').fill('QA Portal AT');
    await A.locator('input[placeholder="••••••••"]').fill('SegredoQA123!');
    await A.locator('button:has-text("Guardar")').first().click();
    await A.locator('text=QA Portal AT').first().waitFor({ timeout: 15000 });
    await A.waitForTimeout(1200);
    const purge = await A.locator('button[aria-label*="vazias"], button[aria-label*="A limpar"]').count();
    facts.push('botao limpar vazias (esperado 0)=' + purge);
    if (purge) throw new Error('aparece botão "Limpar vazias" com entrada preenchida');
    await A.locator('button:has(svg.lucide-eye)').first().click();
    await A.locator('text=SegredoQA123!').first().waitFor({ timeout: 10000 });
    facts.push('reveal mostra a password em claro');
  });

  await step(A, 'Cofre: persiste após reload', async () => {
    await A.reload({ waitUntil: 'domcontentloaded' });
    await A.locator('aside button[title^="Gabinete —"]').first().waitFor({ timeout: 30000 });
    await openGabTab(A, 'Cofre');
    await A.locator('text=QA Portal AT').first().waitFor({ timeout: 20000 });
    await A.locator('button:has(svg.lucide-eye)').first().click();
    await A.locator('text=SegredoQA123!').first().waitFor({ timeout: 10000 });
    facts.push('cofre persiste no reload');
  });

  await step(A, 'Outbox offline: criar tarefa sem rede e sincronizar', async () => {
    await ctxA.setOffline(true);
    await openGabTab(A, 'Visão geral');
    await A.locator('#sec-tarefas button:has-text("+ Nova")').first().click({ timeout: 15000 });
    const modal = A.locator('div.fixed', { has: A.locator('h3:has-text("Nova tarefa")') }).last();
    await modal.locator('input[placeholder="Título da tarefa"]').fill('QA2 Tarefa Offline');
    await modal.locator('button:has-text("Criar tarefa")').click();
    await A.waitForTimeout(2500);
    const sinc = await A.locator('text=A sincronizar').count();
    facts.push('indicador "A sincronizar" offline=' + sinc);
    await ctxA.setOffline(false);
    await A.locator('text=Sincronizado').first().waitFor({ timeout: 40000 });
    facts.push('voltou a sincronizado');
  });

  await step(A, 'Outbox: tarefa offline persiste após reload', async () => {
    await A.reload({ waitUntil: 'domcontentloaded' });
    await A.locator('aside button[title^="Gabinete —"]').first().waitFor({ timeout: 30000 });
    await openGabTab(A, 'Visão geral');
    await A.locator('text=QA2 Tarefa Offline').first().waitFor({ timeout: 25000 });
    facts.push('tarefa offline persistiu');
  });

  await step(A, 'Equipa: convidar estagiária por email', async () => {
    await openGabTab(A, 'Equipa');
    await A.locator('button:has-text("Adicionar funcionário")').first().click({ timeout: 15000 });
    const form = A.locator('div.fixed', { has: A.locator('h3:has-text("Adicionar funcionário")') }).last();
    await form.locator('input[placeholder="Nome completo"]').fill('QA2 Estagiária');
    await form.locator('input[placeholder="Email (para login)"]').fill(EMAIL2);
    await form.locator('select').selectOption('estagiaria');
    await A.locator('button:has-text("Adicionar (convite pendente)")').click();
    await A.waitForTimeout(2500);
    const dlg = dialogs.filter(d => d.includes('falhou'));
    facts.push('convite dialog falha=' + dlg.length);
    if (dlg.length) throw new Error('convite falhou: ' + dlg[0]);
    await A.locator('text=QA2 Estagiária').first().waitFor({ timeout: 15000 });
    facts.push('estagiária na lista da equipa');
  });

  await step(B, 'Estagiária: signup + aceitar convite', async () => {
    await signup(B, 'QA2 Estagiária', EMAIL2);
    await verifyEmail(EMAIL2);
    await B.locator('button:has-text("Já confirmei")').click();
    await B.locator('text=Convites para si').waitFor({ timeout: 25000 });
    await B.locator('button:has-text("Aceitar e entrar")').first().click();
    await B.locator('aside button:has-text("Lista de Empresas")').first().waitFor({ timeout: 30000 });
    facts.push('estagiária entrou no gabinete');
  });

  await step(B, 'Estagiária: Cofre/Lixeira/Equipa bloqueados', async () => {
    await openGabTab(B, 'Cofre');
    await B.locator('text=Cofre — sem permissão').waitFor({ timeout: 15000 });
    await openGabTab(B, 'Lixeira');
    await B.locator('text=Lixeira — sem permissão').waitFor({ timeout: 15000 });
    await openGabTab(B, 'Equipa');
    await B.locator('text=Equipa — sem permissão').waitFor({ timeout: 15000 });
    facts.push('sem permissões nas 3 áreas');
  });

  await step(B, 'Estagiária: obrigações da Visão geral ficam só-leitura', async () => {
    await openGabTab(B, 'Visão geral');
    await B.locator('button:has-text("QA2 Cliente Lda")').first().click({ timeout: 20000 });
    await B.waitForTimeout(1500);
    const chk = B.locator('label:has-text("DMR") input[type="checkbox"]').first();
    await chk.waitFor({ timeout: 20000 });
    const dis = await chk.isDisabled();
    facts.push('checkbox DMR disabled=' + dis);
    if (!dis) throw new Error('estagiária consegue editar obrigações');
    const addBtn = await B.locator('xpath=//h3[normalize-space()="Obrigações"]/ancestor::div[contains(@class,"bg-white")][1]//button[normalize-space()="+ Nova"]').count();
    facts.push('botao + Nova (obrigações) p/ estagiária=' + addBtn);
    if (addBtn) throw new Error('estagiária vê botão de adicionar obrigação');
  });

  await step(A, 'Regras REST: cofre 403 p/ estagiária, 200 p/ dono; tarefas 200', async () => {
    const tok = async (email) => {
      const r = await fetch(`${AUTH_EMU}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: PASS, returnSecureToken: true }),
      });
      const j = await r.json();
      if (!j.idToken) throw new Error('login falhou ' + email + ': ' + JSON.stringify(j).slice(0, 150));
      return j.idToken;
    };
    const t1 = await tok(EMAIL1); const t2 = await tok(EMAIL2);
    const base = `${FS_EMU}/v1/projects/${FSP}/databases/(default)/documents/gabinete/${gabineteId}`;
    const get = async (path, t) => (await fetch(`${base}/${path}`, { headers: { Authorization: `Bearer ${t}` } })).status;
    const cofreDono = await get('cofre', t1);
    const cofreEstag = await get('cofre', t2);
    const tarefasEstag = await get('tarefas', t2);
    facts.push(`REST cofre dono=${cofreDono} estagiaria=${cofreEstag} tarefas estagiaria=${tarefasEstag}`);
    if (cofreDono !== 200) throw new Error('dono devia ler cofre (200), veio ' + cofreDono);
    if (cofreEstag !== 403) throw new Error('estagiária devia levar 403 no cofre, veio ' + cofreEstag);
    if (tarefasEstag !== 200) throw new Error('estagiária devia ler tarefas (200), veio ' + tarefasEstag);
    const post = await fetch(`${FS_EMU}/v1/projects/${FSP}/databases/(default)/documents/gabinete/${gabineteId}/cofre`, {
      method: 'POST', headers: { Authorization: `Bearer ${t2}`, 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { titulo: { stringValue: 'x' }, segredo: { stringValue: 'y' } } }),
    });
    facts.push('REST create cofre estagiaria=' + post.status);
    if (post.status !== 403) throw new Error('create no cofre devia dar 403, veio ' + post.status);
  });

  console.log('\n=== QA2: todos os passos ok ===');
} catch (e) {
  console.error('\n=== QA2: falhou ===', e?.message);
  process.exitCode = 1;
} finally {
  console.log('\n==== FACTOS ===='); for (const f of facts) console.log(' -', f);
  if (dialogs.length) { console.log('Diálogos:'); for (const d of dialogs) console.log(' -', d); }
  const relevant = [...new Set(errors)].filter(e => !e.includes('frame-ancestors') && !e.includes('Version Checker') && !e.includes('cleardot') && !e.includes('ERR_INTERNET_DISCONNECTED') && !e.includes('ERR_NETWORK_CHANGED'));
  console.log(`\nErros consola/rede relevantes: ${relevant.length}`);
  for (const e of relevant.slice(0, 20)) console.log(' -', e);
  if (relevant.length) process.exitCode = 1;
  await browser.close();
}
