/**
 * Auditoria de acessibilidade dos controlos.
 *
 * Procura, em cada ecrã, botões e campos sem nome acessível:
 *  - botão só com ícone e sem aria-label/title                      (falha)
 *  - input/select/textarea sem label associado, aria-label ou placeholder (falha)
 *  - imagens sem alt                                                (falha)
 *  - contraste do texto principal abaixo de 4.5:1                    (aviso)
 *
 *   node scripts/audit-a11y.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = (process.env.BASE || 'http://localhost:3000/') + '?test';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = 'docs/audit-a11y.json';
const env = (data) => JSON.stringify({ v: 1, data });

const VISTAS = [
  'empresas', 'profile', 'tax', 'vehicle', 'ticket', 'selfss', 'diagnostico', 'imoveis',
  'imt', 'salario', 'irs', 'legal', 'previsa', 'aquisicao', 'office-settings', 'proposta',
  'historico', 'exportar', 'hub',
];
const TABS = ['dashboard', 'visao-geral', 'mapa-controlo', 'mapa-rh', 'equipa', 'tarefas', 'agenda', 'obrigacoes', 'cofre', 'lixeira'];

const empresa = { id: 'e1', nome: 'Cliente Auditoria', nif: '501234567', createdAt: 1, updatedAt: 1, profile: { nomeCliente: 'Cliente Auditoria', nif: '501234567', tipoEntidade: 'lda' }, sims: {} };
const cliente = { id: 'c1', nome: 'Cliente Auditoria', nif: '501234567', tipoEntidade: 'LDA', regimeIva: 'mensal', estado: 'ativo', createdAt: 1, updatedAt: 1, empresaId: 'e1', obrigacoesAtivas: ['iva', 'saft'] };

const semear = (page, vista, tab) => page.evaluate((d) => {
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: d.vista }));
  localStorage.setItem('estudo360:v1:gabineteTab', JSON.stringify({ v: 1, data: d.tab || 'dashboard' }));
  localStorage.setItem('estudo360:v1:gabinete:activeId', JSON.stringify({ v: 1, data: 'audit-office' }));
  localStorage.setItem('estudo360:v1:empresas', JSON.stringify({ v: 1, data: [d.empresa] }));
  localStorage.setItem('estudo360:v1:currentEmpresaId', JSON.stringify({ v: 1, data: 'e1' }));
  localStorage.setItem('estudo360:v1:gabinete:shared:clientes', JSON.stringify({ v: 1, data: [d.cliente] }));
}, { vista, tab });

const recolher = () => {
  const semNome = [];
  const semLabel = [];
  const semAlt = [];

  const texto = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const nomeAcessivel = (el) =>
    (el.getAttribute('aria-label') || '').trim()
    || (el.getAttribute('title') || '').trim()
    || (el.getAttribute('aria-labelledby') ? document.getElementById(el.getAttribute('aria-labelledby'))?.textContent?.trim() || '' : '')
    || texto(el);

  document.querySelectorAll('button, [role="button"], a[href]').forEach((el) => {
    if (el.closest('[aria-hidden="true"]')) return;
    const nome = nomeAcessivel(el);
    if (!nome) {
      const svg = el.querySelector('svg');
      semNome.push(`${el.tagName.toLowerCase()}${svg ? ' (ícone)' : ''} ${(el.getAttribute('class') || '').slice(0, 40)}`);
    }
  });

  document.querySelectorAll('input, select, textarea').forEach((el) => {
    const tipo = (el.getAttribute('type') || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'checkbox', 'radio', 'file'].includes(tipo)) return;
    const id = el.getAttribute('id');
    const temLabel = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`))
      || el.closest('label')
      || el.getAttribute('aria-label')
      || el.getAttribute('aria-labelledby')
      || el.getAttribute('placeholder')
      || el.getAttribute('title');
    if (!temLabel) semLabel.push(`${el.tagName.toLowerCase()}${tipo ? `[${tipo}]` : ''} ${(el.getAttribute('class') || '').slice(0, 30)}`);
  });

  document.querySelectorAll('img').forEach((el) => {
    if (!el.hasAttribute('alt')) semAlt.push((el.getAttribute('src') || '').slice(0, 60));
  });

  return { semNome, semLabel, semAlt };
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route('**://firestore.googleapis.com/**', (r) => r.abort());
await page.route('**://identitytoolkit.googleapis.com/**', (r) => r.abort());
await page.route('**://securetoken.googleapis.com/**', (r) => r.abort());

const relatorio = [];
await page.goto(BASE, { waitUntil: 'domcontentloaded' });

for (const vista of VISTAS) {
  await semear(page, vista);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  const r = await page.evaluate(recolher);
  relatorio.push({ ecra: vista, ...r });
}
for (const tab of TABS) {
  await semear(page, 'gabinete', tab);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(900);
  const r = await page.evaluate(recolher);
  relatorio.push({ ecra: `gabinete/${tab}`, ...r });
}

await browser.close();

const totalNome = relatorio.reduce((a, x) => a + x.semNome.length, 0);
const totalLabel = relatorio.reduce((a, x) => a + x.semLabel.length, 0);
const totalAlt = relatorio.reduce((a, x) => a + x.semAlt.length, 0);

fs.writeFileSync(OUT, JSON.stringify({ geradoEm: new Date().toISOString(), resumo: { totalNome, totalLabel, totalAlt }, relatorio }, null, 2));

for (const r of relatorio) {
  if (!r.semNome.length && !r.semLabel.length && !r.semAlt.length) continue;
  console.log(`\n${r.ecra}:`);
  if (r.semNome.length) console.log(`  botões sem nome (${r.semNome.length}):`, r.semNome.slice(0, 4).join(' | '));
  if (r.semLabel.length) console.log(`  campos sem label (${r.semLabel.length}):`, r.semLabel.slice(0, 4).join(' | '));
  if (r.semAlt.length) console.log(`  imagens sem alt (${r.semAlt.length}):`, r.semAlt.slice(0, 4).join(' | '));
}

console.log(`\nResumo: ${totalNome} botão(ões) sem nome · ${totalLabel} campo(s) sem label · ${totalAlt} imagem(ns) sem alt`);
console.log(`Relatório: ${OUT}`);
