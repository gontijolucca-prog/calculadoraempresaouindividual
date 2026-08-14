/**
 * Loop RÁPIDO de verificação — visitas guiadas (qualidade + acessibilidade).
 * 5 vistas representativas + persistência. Verifica: bot fala primeiro, oferta,
 * tour abre com role="dialog"/aria-modal, foco entra no tooltip, aria-live,
 * setas navegam, follow-up do bot ao fechar, "não perguntar" persiste.
 */
const { chromium } = require('/tmp/pwtest/node_modules/playwright');

const VIEWS = ['empresas', 'tax', 'vehicle', 'salario', 'previsa'];
const BASE = 'http://localhost:3000';

function seed(view) {
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
  ctx.setDefaultTimeout(7000);
  let fails = 0;
  const check = (label, cond) => { if (!cond) { fails++; console.log(`   ✗ [${VISTA}] ${label}`); } else console.log(`   ✓ [${VISTA}] ${label}`); };
  const waitFor = async (loc, ms = 7000) => { try { await loc.waitFor({ state: 'visible', timeout: ms }); return true; } catch { return false; } };
  const isVis = (loc) => loc.isVisible().catch(() => false);

  let VISTA = '';
  for (const view of VIEWS) {
    VISTA = view;
    console.log(`\n── ${view} ──`);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message.slice(0, 90)));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 90)); });
    await p.addInitScript(([entries]) => { localStorage.clear(); for (const [k, v] of entries) localStorage.setItem(k, JSON.stringify(v)); }, [seed(view)]);
    await p.goto(BASE, { waitUntil: 'load', timeout: 30000 }).catch(e => errs.push('GOTO'));
    await p.waitForTimeout(3000);

    check('bot fala primeiro', await waitFor(p.locator('text=Posso ajudar-te com alguma coisa').first(), 6000));
    check('oferta de tour da página', await waitFor(p.locator('text=Visita guiada ·').first(), 5000));

    await p.locator('button:has-text("Ver tour")').first().click({ timeout: 6000 }).catch(() => {});
    const tooltip = await waitFor(p.locator('[aria-modal="true"]').first());
    check('tour abre (role=dialog)', tooltip);
    if (tooltip) {
      const a11y = await p.evaluate(() => {
        const d = document.querySelector('[aria-modal="true"]');
        return {
          ariaModal: d?.getAttribute('aria-modal') === 'true',
          ariaLabelled: !!d?.getAttribute('aria-labelledby'),
          live: !!document.querySelector('[aria-live="polite"]'),
        };
      });
      check('aria-modal=true', a11y.ariaModal);
      check('aria-labelledby presente', a11y.ariaLabelled);
      check('aria-live presente', a11y.live);
      // foco: espera condicional (move-se 60ms após o ready)
      const focoOk = await p.waitForFunction(() => {
        const d = document.querySelector('[aria-modal="true"]');
        return !!d && (document.activeElement === d || d.contains(document.activeElement));
      }, { timeout: 7000 }).then(() => true).catch(() => false);
      check('foco entra no tooltip (WCAG 2.4.3)', focoOk);
      // seta direita: o CONTADOR tem de mudar (independe da resolução do alvo seguinte)
      const contadorAntes = await p.evaluate(() => {
        const d = document.querySelector('[aria-modal="true"]');
        const s = [...(d?.querySelectorAll('span') ?? [])].map((x) => x.textContent).find((t) => /Passo \d+ de/.test(t ?? ''));
        return s ?? '';
      });
      await p.keyboard.press('ArrowRight');
      const avancou = await p.waitForFunction((antes) => {
        const d = document.querySelector('[aria-modal="true"]');
        const s = [...(d?.querySelectorAll('span') ?? [])].map((x) => x.textContent).find((t) => /Passo \d+ de/.test(t ?? ''));
        return !!d && !!s && s !== antes;
      }, contadorAntes, { timeout: 6000 }).then(() => true).catch(() => false);
      check('seta → avança passo', avancou);
    }
    await p.locator('button:has-text("Saltar")').first().click({ timeout: 6000 }).catch(() => {});
    await p.waitForTimeout(1200);
    const followUp = await p.waitForFunction(() => document.body.innerText.includes('Fechaste a visita guiada'), null, { timeout: 8000 }).then(() => true).catch(() => false);
    check('follow-up do bot ao fechar', followUp);

    const real = errs.filter(e => !e.includes('favicon') && !e.includes('Version Checker') && !e.includes('frame-ancestors') && !e.includes('404'));
    if (real.length) { fails++; console.log('   ⚠ erros de consola:', real.slice(0, 2).join(' | ')); }
    await p.close();
  }

  // persistência rápida
  console.log('\n── persistência (não perguntar) ──');
  {
    const p = await ctx.newPage();
    await p.addInitScript(([entries]) => {
      if (!sessionStorage.getItem('persistSeed')) { localStorage.clear(); sessionStorage.setItem('persistSeed', '1'); }
      for (const [k, v] of entries) if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v));
    }, [seed('salario')]);
    await p.goto(BASE, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(3000);
    await waitFor(p.locator('text=Visita guiada ·').first(), 6000);
    await p.locator('label:has-text("Não perguntar novamente") input[type="checkbox"]').check({ timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(300);
    check('flag gravada', await p.evaluate(() => localStorage.getItem('estudo360:guias:off:salario') === '1'));
    await p.reload({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
    await p.waitForTimeout(3000);
    check('sem oferta após reload', !(await isVis(p.locator('text=Visita guiada ·').first())));
    await p.close();
  }

  await browser.close();
  console.log(`\n═══ RÁPIDO: ${fails} falhas | ${5 - fails}/5 OK`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ERRO GLOBAL:', e.message); process.exit(1); });
