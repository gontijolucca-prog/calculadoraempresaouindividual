/**
 * Prova do orbe "A trabalhar em": existe, pulsa (2 s) e fica estático com
 * movimento reduzido. Capturas 375/1024/1440.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000/?test';
const OUT = path.resolve('docs/audit-2026-10-26');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'gabinete' }));
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [{ id: 'e1', nome: 'Cliente Orbe', nif: '501234567', createdAt: 1, updatedAt: 1 }] }));
  localStorage.setItem('estudo360:v1:currentEmpresaId', JSON.stringify({ v: 1, data: 'e1' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'audit-office' }));
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2500);

const orbe = page.locator('.orb-status').first();
ok(await orbe.count() === 1, 'orbe presente no indicador "A trabalhar em"');
const info = await orbe.evaluate((el) => {
  const cs = getComputedStyle(el);
  return { anim: cs.animationName, dur: cs.animationDuration, iter: cs.animationIterationCount, bg: cs.backgroundImage.slice(0, 60) };
});
ok(info.anim === 'orb-pulse', `animação aplicada (${info.anim})`);
ok(info.dur === '2s' && info.iter === 'infinite', `ciclo 2s infinito (${info.dur}/${info.iter})`);
ok(info.bg.includes('radial-gradient'), 'gradiente radial (igual à bola do logo)');

// escala muda ao longo do ciclo
const s1 = await orbe.evaluate((el) => getComputedStyle(el).transform);
await page.waitForTimeout(700);
const s2 = await orbe.evaluate((el) => getComputedStyle(el).transform);
ok(s1 !== s2, `transform anima (${s1} → ${s2})`);

for (const w of [1440, 1024, 375]) {
  await page.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `orbe-${w}.png`) });
}

// movimento reduzido: estático
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const p2 = await ctx2.newPage();
await p2.goto(BASE, { waitUntil: 'domcontentloaded' });
await p2.evaluate(() => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'gabinete' }));
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [{ id: 'e1', nome: 'Cliente Orbe', nif: '501234567', createdAt: 1, updatedAt: 1 }] }));
  localStorage.setItem('estudo360:v1:currentEmpresaId', JSON.stringify({ v: 1, data: 'e1' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'audit-office' }));
});
await p2.reload({ waitUntil: 'load' });
await p2.waitForTimeout(2000);
const reduzido = await p2.locator('.orb-status').first().evaluate((el) => getComputedStyle(el).animationName);
ok(reduzido === 'none', `movimento reduzido desliga a animação (${reduzido})`);

await browser.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
if (falhas.length) process.exit(1);
