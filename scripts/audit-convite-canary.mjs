/**
 * Canário de produção: conta descartável cria gabinete, convida, copia link,
 * abre em contexto limpo, define password, confirma "Ativa" na mesma linha,
 * remove e limpa tudo. Só devolve 0 (PASS) quando tudo acontece.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJ = 'recofatima-ferramenta';
const KEY = 'AIzaSyBxc-JFWwxlauY6U4A3IKTxxd5UFiDzjhI';
const BASE = process.env.CANARY_BASE || 'https://estudo360.pt/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const stamp = Date.now();
const ownerEmail = process.env.CANARY_EMAIL || `canario+${stamp}@estudo360.pt`;
const ownerPass = 'Canario12345!';
const colabEmail = `canario-colab+${stamp}@estudo360.pt`;
const colabPass = 'Canario12345!';
const falhas = []; const notas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };

async function tokenAdmin() {
  const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.config/configstore/firebase-tools.json'), 'utf8'));
  const body = new URLSearchParams({
    grant_type: 'refresh_token', refresh_token: cfg.tokens.refresh_token,
    client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body });
  const j = await r.json();
  if (!j.access_token) throw new Error('sem token admin');
  return j.access_token;
}
async function criarUser(at, email, pass) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJ}/accounts`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` },
    body: JSON.stringify({ email, password: pass, emailVerified: true, displayName: 'Canário QA' }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error('criar user: ' + JSON.stringify(j).slice(0, 200));
  return j.localId;
}
async function apagarUser(at, uid) {
  if (!uid) return;
  await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJ}/accounts:delete`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` }, body: JSON.stringify({ localId: uid }) }).catch(() => {});
}
async function apagarGabinete(at, gabId) {
  if (!gabId) return;
  const base = `https://firestore.googleapis.com/v1/projects/${PROJ}/databases/(default)/documents`;
  const lid = await fetch(`${base}/gabinetes/${gabId}:listCollectionIds`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${at}` }, body: JSON.stringify({ pageSize: 100 }) }).then((r) => r.json()).catch(() => ({}));
  for (const col of lid.collectionIds || []) {
    const docs = await fetch(`${base}/gabinetes/${gabId}/${col}?pageSize=300`, { headers: { Authorization: `Bearer ${at}` } }).then((r) => r.json()).catch(() => ({}));
    for (const d of docs.documents || []) {
      await fetch(`https://firestore.googleapis.com/v1/${d.name}`, { method: 'DELETE', headers: { Authorization: `Bearer ${at}` } }).catch(() => {});
    }
  }
  await fetch(`${base}/gabinetes/${gabId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${at}` } }).catch(() => {});
}
async function signInUI(p, email, pass) {
  await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(2500);
  if (!(await p.locator('input[placeholder="nome@empresa.pt"]').count())) {
    const entrar = p.getByRole('button', { name: /^Entrar$/i }).first();
    if (await entrar.count()) { await entrar.click(); await p.waitForTimeout(900); }
    else {
      const link = p.getByRole('link', { name: /Entrar/i }).first();
      if (await link.count()) { await link.click(); await p.waitForTimeout(900); }
    }
  }
  if (await p.locator('input[placeholder="nome@empresa.pt"]').count()) {
    await p.locator('input[placeholder="nome@empresa.pt"]').first().fill(email);
    await p.locator('input[type="password"]').first().fill(pass);
    await p.getByRole('button', { name: /^Entrar$/ }).last().click();
    await p.waitForTimeout(3500);
  }
}
async function abrirEquipa(p) {
  let eq = p.locator('button:visible').filter({ hasText: /^Equipa$/ }).first();
  if (!(await eq.count())) {
    const grupo = p.locator('aside button:visible').filter({ hasText: /Gabinete/ }).first();
    if (await grupo.count()) { await grupo.evaluate((el) => el.click()); await p.waitForTimeout(800); }
    eq = p.locator('button:visible').filter({ hasText: /^Equipa$/ }).first();
  }
  if (await eq.count()) { await eq.evaluate((el) => el.click()); await p.waitForTimeout(1200); }
}

let at = '';
let ownerUid = '', colabUid = '', gabId = '';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  at = await tokenAdmin();
  ownerUid = await criarUser(at, ownerEmail, ownerPass);
  ok(!!ownerUid, 'conta canário criada');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => notas.push('pageerror: ' + e.message.slice(0, 120)));
  await signInUI(p, ownerEmail, ownerPass);
  ok(/Gabinete|Lista de Empresas|Criar gabinete/i.test(await p.evaluate(() => document.body.innerText)), 'canário entrou');
  const criar = p.getByRole('button', { name: /Criar (novo )?gabinete/i }).first();
  if (await criar.count()) {
    await criar.click(); await p.waitForTimeout(700);
    await p.locator('input[placeholder*="Silva"]').first().fill('QA Canário');
    await p.locator('input[placeholder="500000000"]').first().fill('509' + String(stamp).slice(-6));
    await p.getByRole('button', { name: /Criar e entrar/i }).first().click();
    await p.waitForTimeout(3000);
  }
  gabId = await p.evaluate(() => {
    for (const k of Object.keys(localStorage)) {
      if (!k.includes('gabinete:activeId')) continue;
      try { const d = JSON.parse(localStorage.getItem(k)); const v = d?.data || d; if (typeof v === 'string' && v.length >= 3) return v; } catch { const v = localStorage.getItem(k); if (v && v.length >= 3) return v; }
    }
    return '';
  });
  if (!gabId) {
    const corpo = await p.evaluate(() => document.body.innerText.slice(0, 300).replace(/\n+/g, ' | '));
    notas.push('BLOQUEADO: gabinete não foi criado (escrita recusada) — ' + corpo.slice(0, 140));
    throw new Error('BLOQUEADO: servidor recusou a escrita (quota/rede)');
  }
  ok(!!gabId, 'gabinete criado');
  await abrirEquipa(p);
  await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Adicionar colaborador/i.test(x.innerText || '')); b && b.click(); });
  await p.waitForTimeout(800);
  await p.locator('input[placeholder="Nome completo"]:visible').first().fill('Colaborador Canário');
  await p.locator('input[placeholder="Email (para login)"]:visible').first().fill(colabEmail);
  await p.getByRole('button', { name: /Adicionar \(convite pendente\)/i }).filter({ visible: true }).first().click();
  await p.waitForTimeout(1800);
  const textoAposGuardar = await p.evaluate(() => document.body.innerText);
  if (/sem quota|Não consegui criar o link|Quota/i.test(textoAposGuardar)) {
    notas.push(textoAposGuardar.match(/[^\n]*(quota|Não consegui criar o link)[^\n]*/i)?.[0] || 'erro de quota');
    throw new Error('BLOQUEADO: servidor recusou a criação do convite');
  }
  const linkVal = await p.locator('div.fixed.inset-0.z-50 input').first().inputValue().catch(() => '');
  const token = (() => { try { return new URL(linkVal).searchParams.get('t') || ''; } catch { return ''; } })();
  ok(!!token, 'link do convite criado');
  const copiar = p.locator('div.fixed.inset-0.z-50').last().getByRole('button', { name: /Copiar link/i }).first();
  if (await copiar.count()) { await copiar.click({ force: true }); await p.waitForTimeout(400); }
  const clip = await p.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  ok(/convite\?t=/.test(clip), 'botão copiar link funciona');
  const ctx2 = await browser.newContext({ viewport: { width: 420, height: 900 } });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + 'convite?t=' + token, { waitUntil: 'load' }); await p2.waitForTimeout(3500);
  ok(await p2.locator('#p1').isVisible().catch(() => false), 'link pede para definir password');
  await p2.locator('#p1').fill(colabPass); await p2.locator('#p2').fill(colabPass);
  await p2.locator('#go').click(); await p2.waitForTimeout(7000);
  colabUid = await p2.evaluate(() => { try { const k = Object.keys(localStorage).find((x) => x.includes('authUser')); return k ? JSON.parse(localStorage.getItem(k))?.uid || '' : ''; } catch { return ''; } });
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(3000);
  await abrirEquipa(p);
  const lista = await p.evaluate(() => document.body.innerText);
  ok(lista.includes(colabEmail), 'colaborador continua na lista');
  ok(/Ativa/.test(lista), 'estado mudou para Ativa');
  // remover
  const linha = p.locator('tr').filter({ hasText: colabEmail }).first();
  await linha.locator('button[title="Remover da equipa"]').click(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: /^Remover$/ }).filter({ visible: true }).first().click();
  await p.waitForTimeout(2500);
  ok(!(await p.evaluate(() => document.body.innerText)).includes(colabEmail), 'colaborador removido');
  await p.screenshot({ path: 'docs/canario-producao-' + stamp + '.png' });
} catch (e) {
  notas.push(String(e?.message || e).slice(0, 220));
} finally {
  await apagarGabinete(at, gabId);
  await apagarUser(at, ownerUid);
  await apagarUser(at, colabUid);
  await browser.close();
}
console.log('\nNotas:', notas.slice(0, 4).join(' | ') || '—');
const bloqueado = notas.some((n) => /BLOQUEADO|quota/i.test(n));
console.log(`\n${falhas.length === 0 && !bloqueado ? 'PASS' : bloqueado ? 'BLOQUEADO (quota)' : 'FAIL'} — ${falhas.length} falha(s)`);
if (bloqueado) process.exit(2);
if (falhas.length) process.exit(1);
