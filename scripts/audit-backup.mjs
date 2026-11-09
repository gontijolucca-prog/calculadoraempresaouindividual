/**
 * E2E da cópia de segurança: exportar cria um JSON válido com os dados do
 * gabinete que estão em cache, e o ficheiro restaura sem perder registos.
 *
 *   node scripts/audit-backup.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = (process.env.BASE || 'http://localhost:3000/') + '?test';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const falhas = [];
const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };

const env = (data) => JSON.stringify({ v: 1, data });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
await page.route('**://firestore.googleapis.com/**', (r) => r.abort());
await page.route('**://identitytoolkit.googleapis.com/**', (r) => r.abort());

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(({ envStr }) => {
  const env = eval('(' + envStr + ')');
  localStorage.setItem('estudo360:test-bypass-auth', '1');
  localStorage.setItem('estudo360:v1:lastView', env('office-settings'));
  localStorage.setItem('estudo360:v1:gabinete:activeId', env('audit-office'));
  localStorage.setItem('estudo360:v1:gabinete:officeId', env('audit-office'));
  localStorage.setItem('estudo360:v1:gabinete:shared:clientes', env([
    { id: 'c1', nome: 'Cliente A', nif: '501234567', createdAt: 1, updatedAt: 1 },
    { id: 'c2', nome: 'Cliente B', nif: '509999999', createdAt: 1, updatedAt: 1 },
  ]));
  localStorage.setItem('estudo360:v1:gabinete:shared:tarefas', env([
    { id: 't1', titulo: 'Tarefa A', estado: 'pendente', createdAt: 1, updatedAt: 1 },
  ]));
  localStorage.setItem('estudo360:v1:officeSettings', env({
    nome: 'Escritório Backup', nif: '509999999', corPrimaria: '#0677FF',
  }));
}, { envStr: env.toString() });

await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1500);

await page.getByRole('tab', { name: /Cópia de segurança/i }).click();
await page.waitForTimeout(400);

const espera = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
await page.getByRole('button', { name: /Exportar gabinete/i }).click();
const dl = await espera;
ok(!!dl, 'exportar produz um ficheiro');

let backup = null;
if (dl) {
  const nome = dl.suggestedFilename();
  ok(/^estudo360-backup-.*\.json$/.test(nome), `nome do ficheiro correto (${nome})`);
  const tmp = `/tmp/${nome}`;
  await dl.saveAs(tmp);
  backup = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  ok(backup.formato === 'estudo360-backup', 'formato identificado no ficheiro');
  ok(backup.versao === 1, 'versão do formato presente');
  ok(backup.colecoes?.clientes?.length === 2, `clientes exportados (${backup.colecoes?.clientes?.length})`);
  ok(backup.colecoes?.tarefas?.length === 1, `tarefas exportadas (${backup.colecoes?.tarefas?.length})`);
  ok(backup.escritorio?.nome === 'Escritório Backup', 'definições do escritório incluídas');
  fs.writeFileSync('/tmp/backup-para-restaurar.json', JSON.stringify(backup));
  fs.unlinkSync(tmp);
}

// Mensagem de sucesso visível
const texto = await page.locator('body').innerText();
ok(/Cópia criada/i.test(texto), 'utilizador recebe confirmação');

// Restaurar: apaga a cache local e repõe a partir do ficheiro
await page.evaluate(() => {
  localStorage.removeItem('estudo360:v1:gabinete:shared:clientes');
  localStorage.removeItem('estudo360:v1:gabinete:shared:tarefas');
});
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(1200);
await page.getByRole('tab', { name: /Cópia de segurança/i }).click();
await page.waitForTimeout(300);
await page.setInputFiles('[data-testid="backup-file"]', '/tmp/backup-para-restaurar.json');
await page.waitForTimeout(600);
ok(/Cópia válida/i.test(await page.locator('body').innerText()), 'ficheiro válido é reconhecido antes de restaurar');
await page.getByRole('button', { name: /Restaurar neste gabinete/i }).click();
await page.waitForTimeout(1500);
const depois = await page.evaluate(() => {
  const ler = (k) => {
    try { return JSON.parse(localStorage.getItem('estudo360:v1:gabinete:shared:' + k) || 'null')?.data?.length ?? 0; } catch { return -1; }
  };
  return { clientes: ler('clientes'), tarefas: ler('tarefas') };
});
ok(depois.clientes === 2, `restauro repõe os clientes (${depois.clientes})`);
ok(depois.tarefas === 1, `restauro repõe as tarefas (${depois.tarefas})`);
ok(/restaurados/i.test(await page.locator('body').innerText()), 'utilizador recebe confirmação do restauro');
try { fs.unlinkSync('/tmp/backup-para-restaurar.json'); } catch {}

// Ficheiro inválido é recusado
await page.setInputFiles('[data-testid="backup-file"]', {
  name: 'mau.json',
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify({ hello: 'world' })),
});
await page.waitForTimeout(500);
const textoErro = await page.locator('body').innerText();
const recusou = /não é uma cópia de segurança do Estudo360|Não consegui ler o ficheiro/i.test(textoErro);
ok(recusou, 'ficheiro alheio é recusado com explicação');
if (!recusou) console.log('[debug]', textoErro.replace(/\s+/g, ' ').slice(-400));

await browser.close();
console.log(falhas.length ? `\nFAIL — ${falhas.length} falha(s)` : '\nPASS — cópia de segurança funciona');
process.exit(falhas.length ? 1 : 0);
