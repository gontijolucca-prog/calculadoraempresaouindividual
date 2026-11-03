#!/usr/bin/env node
import { chromium } from 'playwright-core';

const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const AUTH = 'http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1';
const KEY = 'AIzaSyChJKEBjPKZcRVF4R_n07UoUB9Q0q_EzM';
const EMAIL = 'admin@estudo360.pt';
const PASSWORD = 'AdminTeste12345!';
const URL_PAGE = new URL('estudo360-novidades-semana-03-11.html?emu', BASE).href;

let signup = await fetch(`${AUTH}/accounts:signUp?key=${KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
});
if (!signup.ok) {
  signup = await fetch(`${AUTH}/accounts:signInWithPassword?key=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
  });
}
if (!signup.ok) throw new Error(`Não foi possível preparar admin: ${await signup.text()}`);

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const failures = [];
const check = (condition, label) => {
  console.log(`${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failures.push(label);
};

const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const admin = await adminContext.newPage();
await admin.goto(URL_PAGE, { waitUntil: 'domcontentloaded' });
await admin.waitForTimeout(700);
await admin.evaluate(async ({ email, password }) => {
  const authModule = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
  await authModule.signInWithEmailAndPassword(authModule.getAuth(), email, password);
}, { email: EMAIL, password: PASSWORD });
await admin.locator('#npEditor').waitFor({ state: 'visible', timeout: 5000 });
check(true, 'administrador vê o editor de próximos passos');

const first = 'Ponto um: confirmar os dados oficiais do produtor.\nPonto dois: submeter o pedido de classificação.';
await admin.locator('#npText').fill(first);
await admin.locator('#npSave').click();
await admin.waitForTimeout(700);
check((await admin.locator('#npView').innerText()).includes('Ponto dois'), 'primeira versão fica visível');

const publicContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const publicPage = await publicContext.newPage();
await publicPage.goto(URL_PAGE, { waitUntil: 'domcontentloaded' });
await publicPage.waitForTimeout(1200);
check((await publicPage.locator('#npView').innerText()).includes('Ponto dois'), 'visitante lê a versão mais recente sem login');
check(await publicPage.locator('#npEditor').isHidden(), 'visitante não vê o editor');

const second = `${first}\nPonto três: registar a resposta da AT.`;
await admin.locator('#npText').fill(second);
await admin.locator('#npSave').click();
await admin.waitForTimeout(700);
await publicPage.reload({ waitUntil: 'domcontentloaded' });
await publicPage.waitForTimeout(1100);
check((await publicPage.locator('#npView').innerText()).includes('Ponto três'), 'nova gravação substitui apenas a vista atual');
check((await publicPage.locator('#npHist').innerText()).includes('Ponto dois'), 'versão anterior permanece no histórico');

await adminContext.close();
await publicContext.close();
await browser.close();
console.log(failures.length ? `\nFAIL - ${failures.length} falha(s)` : '\nPASS - próximos passos versionados e permanentes');
if (failures.length) process.exit(1);
