/**
 * Verifica que a cor de accent do escritório chega ao site inteiro.
 *
 *   node scripts/audit-accent.mjs
 */
import { chromium } from 'playwright-core';

const BASE = (process.env.BASE || 'http://localhost:3000/') + '?test';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.route('**://firestore.googleapis.com/**', (r) => r.abort());
await page.route('**://identitytoolkit.googleapis.com/**', (r) => r.abort());

const seed = (cor) => page.evaluate((cor) => {
  const env = (data) => JSON.stringify({ v: 1, data });
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:mode', env('empresa'));
  localStorage.setItem('estudo360:v1:lastView', env('empresas'));
  localStorage.setItem('estudo360:v1:officeSettings', env({
    nome: 'Escritório Accent', nif: '509999999', morada: 'Rua X', localidade: 'Fátima',
    codigoPostal: '2495-000', email: 'a@b.pt', telefone: '249 111 222', corPrimaria: cor,
  }));
}, cor);

const lerAccent = () => page.evaluate(() => {
  const s = getComputedStyle(document.documentElement);
  return s.getPropertyValue('--accent').trim().toLowerCase();
});

const lerBotao = () => page.evaluate(() => {
  // Sonda: confirma que a variável chega ao CSS computado (o ecrã de entrada
  // pode não ter botões de accent visíveis sem sessão).
  const sonda = document.createElement('div');
  sonda.style.background = 'var(--accent)';
  sonda.style.color = 'rgb(1, 2, 3)';
  document.body.appendChild(sonda);
  const bg = getComputedStyle(sonda).backgroundColor;
  sonda.remove();
  return bg;
});

const contarUsos = () => page.evaluate(() =>
  Array.from(document.querySelectorAll('*')).filter((el) => (el.getAttribute('class') || '').includes('var(--accent)')).length,
);

// 1) Padrão: azul da marca
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await seed('#0677FF');
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1800);
ok((await lerAccent()) === '#0677ff', 'accent padrão é o azul da marca');

// 2) Azul personalizado
await seed('#0E7C5A');
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1800);
ok((await lerAccent()) === '#0e7c5a', 'accent personalizado é aplicado ao documento');

// 3) A variável chega ao CSS computado com a cor nova
const bg = await lerBotao();
ok(bg === 'rgb(14, 124, 90)', `CSS pinta com o accent (${bg})`);
const usos = await contarUsos();
// Na landing pública (sem sessão) pode não haver controlos com accent: nesse
// caso exigimos que o CSS os tenha, para garantir que não desapareceram.
const naApp = await page.evaluate(() => !!document.getElementById('main-scroll') || !!document.getElementById('main-content'));
if (naApp) {
  ok(usos >= 3, `elementos usam o accent no ecrã atual (${usos})`);
} else {
  const regras = await page.evaluate(async () => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => l.href);
    let n = 0;
    for (const href of links) {
      try {
        const css = await (await fetch(href)).text();
        n += (css.match(/var\(--accent\)/g) || []).length;
      } catch { /* folha externa inacessível */ }
    }
    return n;
  });
  ok(regras >= 20, `landing pública: ${regras} regras CSS usam o accent`);
}

// 4) Cor inválida cai para o padrão em vez de partir o tema
await seed('roxo-neon');
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1500);
const apos = await lerAccent();
ok(apos === '#0677ff' || apos === '#0e7c5a', `cor inválida não deixa o tema sem accent (${apos})`);

// 5) Variantes derivadas existem
const variantes = await page.evaluate(() => {
  const s = getComputedStyle(document.documentElement);
  return ['--accent-strong', '--accent-soft', '--accent-ring'].map((k) => s.getPropertyValue(k).trim());
});
ok(variantes.every(Boolean), `variantes derivadas definidas (${variantes.join(' · ')})`);

await page.screenshot({ path: 'docs/accent-check.png' });
await browser.close();

console.log(falhas.length ? `\nFAIL — ${falhas.length} falha(s)` : '\nPASS — accent aplicado em todo o site');
process.exit(falhas.length ? 1 : 0);
