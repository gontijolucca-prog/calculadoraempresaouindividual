/** A fila de auditoria tem de esvaziar após envio (senão reescreve sempre). */
import { chromium } from 'playwright-core';
const BASE = process.env.BASE || 'http://localhost:3000/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const stamp = Date.now(); const email = `audit+${stamp}@estudo360.pt`;
const b = await chromium.launch({ executablePath: CHROME, headless: true });
const p = await b.newPage();
const falhas = []; const ok = (c, m) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) falhas.push(m); };
await p.goto(BASE, { waitUntil: 'load' }); await p.waitForTimeout(1200);
await p.getByRole('button', { name: /Criar conta/i }).first().click(); await p.waitForTimeout(400);
await p.locator('input[placeholder="O seu nome"]').first().fill('Auditoria QA');
await p.locator('input[placeholder="nome@empresa.pt"]').first().fill(email);
await p.locator('input[type="password"]').first().fill('Teste12345!');
await p.getByRole('button', { name: /^Criar conta$/ }).first().click(); await p.waitForTimeout(2200);
for (let i = 0; i < 10; i++) {
  const r = await fetch('http://127.0.0.1:9199/emulator/v1/projects/demo-estudo360/oobCodes').then((x) => x.json()).catch(() => null);
  const c = r?.oobCodes?.filter((x) => x.email === email && x.requestType === 'VERIFY_EMAIL').pop();
  if (c?.oobLink) { const v = await fetch(c.oobLink).catch(() => null); if (v?.ok) break; }
  await p.waitForTimeout(700);
}
const r = await p.evaluate(async () => {
  const a = await import('/src/lib/audit.ts');
  a.logAudit('teste_fila', 'um');
  a.logAudit('teste_fila', 'dois');
  const antes = JSON.parse(localStorage.getItem('estudo360:v1:auditQueue') || '{"data":[]}').data.length;
  await a.flushAuditQueue();
  const depois = JSON.parse(localStorage.getItem('estudo360:v1:auditQueue') || '{"data":[]}').data.length;
  await a.flushAuditQueue();
  const depois2 = JSON.parse(localStorage.getItem('estudo360:v1:auditQueue') || '{"data":[]}').data.length;
  return { antes, depois, depois2 };
});
ok(r.antes >= 2, `eventos na fila antes (${r.antes})`);
ok(r.depois === 0, `fila esvaziada após envio (${r.depois})`);
ok(r.depois2 === 0, `segundo flush não reenvia (${r.depois2})`);
await b.close();
console.log(`\n${falhas.length === 0 ? 'PASS' : 'FAIL'} — ${falhas.length} falha(s)`);
process.exit(falhas.length ? 1 : 0);
