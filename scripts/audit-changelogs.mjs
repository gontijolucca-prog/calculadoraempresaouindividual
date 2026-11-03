#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'tmp/audit-changelogs';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const failures = [];
const check = (condition, label) => {
  console.log(`${condition ? '✓' : '✗'} ${label}`);
  if (!condition) failures.push(label);
};

for (const [path, marker] of [
  ['estudo360-novidades-semana-03-11.html', 'Mais simples de usar'],
  ['estudo360-novidades-semana-26-10.html', 'Tudo o que mudou desde 16/10'],
  ['estudo360-novidades-e-svat.html', 'O primeiro registo'],
]) {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const response = await page.goto(new URL(path, BASE).href, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(response?.status() === 200, `${path} responde 200 em ${viewport.width}px`);
    check((await page.locator('h1').first().innerText()).includes(marker), `${path} mostra o título esperado em ${viewport.width}px`);
    check(overflow <= 1, `${path} sem overflow em ${viewport.width}px (${overflow})`);
    check(errors.length === 0, `${path} sem erros JavaScript em ${viewport.width}px`);
    await page.screenshot({
      path: `${OUT}/${path}-${viewport.width}.png`,
      fullPage: viewport.width === 375,
    });
    await context.close();
  }
}

const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await page.goto(new URL('estudo360-novidades-semana-03-11.html', BASE).href, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
const hrefs = await page.locator('a[href*="docs-candidatura-svat/"]').evaluateAll((links) => links.map((link) => link.href));
check(hrefs.length === 10, `página lista os 10 documentos SVAT (${hrefs.length})`);
for (const href of hrefs) {
  const response = await page.request.get(href);
  check(response.status() === 200, `${href.split('/').pop()} responde 200`);
}
const body = await page.locator('body').innerText();
check(/requisito h\).*não implementado/is.test(body), 'página declara h) não implementado');
check(/requisito i\).*não implementado/is.test(body), 'página declara i) não implementado');
check(!/9\/9|dossier.*100% pronto|sem objeto/i.test(body), 'página não contém alegações antigas');
const changelogCards = page.locator('#novidades .card');
const testedCards = page.locator('#novidades .card .test');
check(await changelogCards.count() === await testedCards.count(), 'todos os cartões do changelog indicam como testar');
const timelineText = await page.locator('#novidades .timeline').innerText();
check(!/firestore|base de dados|servidor|deploy|pipeline|quota/i.test(timelineText), 'changelog não lista trabalho técnico invisível');
const changelogPdfLinks = await page.locator('#documentos a[data-pdf]').evaluateAll((links) => links.map((link) => link.href));
check(changelogPdfLinks.length === 26, `changelog lista diretamente os 26 PDFs (${changelogPdfLinks.length})`);
for (const href of changelogPdfLinks) {
  const response = await page.request.get(href);
  check(response.status() === 200, `${href.split('/').pop()} abre a partir do changelog`);
}
const examplesResponse = await page.request.get(new URL('exemplos-exportacoes-2026-11-03/index.html', BASE).href);
check(examplesResponse.status() === 200, 'pasta de exemplos dos 26 PDFs responde 200');
await page.goto(new URL('exemplos-exportacoes-2026-11-03/index.html', BASE).href, { waitUntil: 'domcontentloaded' });
const exampleLinks = await page.locator('a.doc').evaluateAll((links) => links.map((link) => link.href));
check(exampleLinks.length === 26, `pasta lista os 26 PDFs (${exampleLinks.length})`);
for (const href of exampleLinks) {
  const response = await page.request.get(href);
  check(response.status() === 200, `${href.split('/').pop()} responde 200`);
}
await context.close();
await browser.close();

console.log(failures.length ? `\nFAIL - ${failures.length} falha(s)` : '\nPASS - changelogs e pacote SVAT visuais OK');
if (failures.length) process.exit(1);
