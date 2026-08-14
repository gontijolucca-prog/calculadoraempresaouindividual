/**
 * Loop de verificação E2E — visitas guiadas via AI Contabilista (dev, modo direto).
 * Verifica por ferramenta: bot abre sozinho com saudação → oferta de tour da página →
 * "Ver tour" inicia (tooltip+spotlight) → Saltar fecha → sem repetição se "não perguntar"
 * → texto "guia" reativa. Zero erros de consola.
 */
const { chromium } = require('/tmp/pwtest/node_modules/playwright');

const VIEWS = ['empresas', 'profile', 'tax', 'vehicle', 'ticket', 'selfss', 'diagnostico',
  'imoveis', 'imt', 'salario', 'irs', 'previsa', 'legal', 'office-settings', 'historico', 'exportar', 'hub'];

const BASE = 'http://localhost:3000';

function seedStorage(view) {
  const now = Date.now();
  return [
    ['estudo360:v1:sessao', { v: 1, data: true }],
    ['estudo360:v1:mode', { v: 1, data: 'empresa' }],
    ['estudo360:v1:lastView', { v: 1, data: view }],
    ['estudo360:v1:currentEmpresaId', { v: 1, data: 'demo' }],
    ['estudo360:v1:empresas', { v: 1, data: { list: [{ id: 'demo', nome: 'Cliente Demo', nif: '123456789', createdAt: now, updatedAt: now, profile: {}, sims: {} }], updatedAt: now } }],
  ];
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 850 } });
  ctx.setDefaultTimeout(8000);
  let fails = 0;
  const errorsByView = {};
  const check = (label, cond) => { if (!cond) { fails++; console.log('   ✗', label); } else console.log('   ✓', label); };
  const waitFor = async (loc, ms = 7000) => {
    try { await loc.waitFor({ state: 'visible', timeout: ms }); return true; } catch { return false; }
  };
  const isVis = (loc) => loc.isVisible().catch(() => false);

  for (const view of VIEWS) {
    console.log(`\n── ${view} ──`);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message.slice(0, 100)));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 100)); });

    await page.addInitScript(([entries]) => {
      localStorage.clear();
      for (const [k, v] of entries) localStorage.setItem(k, JSON.stringify(v));
    }, [seedStorage(view)]);
    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 }).catch(e => errs.push('GOTO: ' + e.message.slice(0, 70)));
    await page.waitForTimeout(3000);

    // 1) o bot fala primeiro (painel abre sozinho + saudação)
    const saudacao = await waitFor(page.locator('text=AI Contabilista').first());
    const painel = await isVis(page.locator('text=Posso ajudar-te com alguma coisa?').first());
    check('bot abre sozinho com saudação', painel || (await isVis(page.locator('text=Posso ajudar-te com alguma coisa').first())));

    // 2) oferta de visita guiada da página
    const oferta = await waitFor(page.locator('text=Visita guiada ·').first());
    check('bot oferece tour da página', oferta);

    // 3) "Ver tour" inicia o tour
    await page.locator('button:has-text("Ver tour")').first().click({ timeout: 6000 }).catch(() => {});
    const tooltip = await waitFor(page.locator('text=/Passo \\d+ de/').first());
    const spotlight = await waitFor(page.locator('.fixed.z-\\[98\\]').first(), 3000);
    check('tour abre (tooltip + spotlight)', tooltip && spotlight);

    // 4) avança e salta
    for (let i = 0; i < 4; i++) {
      if (await isVis(page.locator('button:has-text("Concluir")').first())) break;
      const next = page.locator('button:has-text("Seguinte")').first();
      if (!(await isVis(next))) break;
      await next.click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(700);
    }
    await page.locator('button:has-text("Saltar")').first().click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(400);
    check('tour fecha com "Saltar"', !(await isVis(page.locator('text=/Passo \\d+ de/').first())));

    errorsByView[view] = errs.filter(e => !e.includes('favicon') && !e.includes('Version Checker') && !e.includes('frame-ancestors') && !e.includes('404'));
    if (errorsByView[view].length) console.log('   ⚠ erros:', errorsByView[view].slice(0, 3).join(' | '));
    await page.close();
  }

  // 5) "não perguntar novamente" persiste
  console.log('\n── não perguntar novamente ──');
  {
    const page = await ctx.newPage();
    await page.addInitScript(([entries]) => {
      // limpa só no 1º load desta secção (marcador de sessão sobrevive ao reload)
      if (!sessionStorage.getItem('persistSeed')) {
        localStorage.clear();
        sessionStorage.setItem('persistSeed', '1');
      }
      for (const [k, v] of entries) if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v));
    }, [seedStorage('salario')]);
    await page.goto(BASE, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await waitFor(page.locator('text=Visita guiada ·').first());
    await page.locator('label:has-text("Não perguntar novamente") input[type="checkbox"]').check({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(300);
    const flag = await page.evaluate(() => localStorage.getItem('estudo360:guias:off:salario') === '1');
    check('flag gravada', flag);
    // recarrega a mesma página → sem nova oferta
    await page.reload({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(3000);
    check('sem oferta após "não perguntar" (reload)', !(await isVis(page.locator('text=Visita guiada ·').first())));
    // escrever "guia" reativa e oferece
    await page.locator('textarea').last().fill('quero ver o guia desta página');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    const reativado = await isVis(page.locator('text=Visita guiada ·').first());
    check('texto "guia" reativa e oferece tour', reativado);
    await page.close();
  }

  await browser.close();
  const viewsWithErrors = Object.entries(errorsByView).filter(([, e]) => e.length);
  console.log(`\n═══ RESULTADO: ${fails} falhas | ${17 - fails}/17 ferramentas OK | ${viewsWithErrors.length} com erros de consola`);
  if (viewsWithErrors.length) console.log('ferramentas com erros:', viewsWithErrors.map(([v]) => v).join(', '));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERRO GLOBAL:', e.message); process.exit(1); });
