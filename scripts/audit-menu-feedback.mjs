/**
 * audit-menu-feedback.mjs — testa o feedback ao clicar no item de menu já ativo.
 *
 * Com bypass de teste, abre a vista "empresas". Depois:
 *   1. faz scroll de #main-content e clica no item ativo
 *      ("Lista de Empresas" ou "Trocar de Empresa", só :visible);
 *   2. exige [data-menu-feedback="1"] com «Já estás em» em <= 2s;
 *   3. exige #main-content com scrollTop ~0 (<= 2px);
 *   4. exige que a vista (data-view) não mude;
 *   5. repete 3 cliques seguidos, sem erros e sempre com feedback.
 * Repete o mesmo para "Gabinete" se o item existir (opcional: falhas viram aviso).
 *
 * Uso:
 *   node scripts/audit-menu-feedback.mjs
 *   BASE=http://localhost:3000/ node scripts/audit-menu-feedback.mjs
 *
 * Exit code: 0 = PASS, 1 = falhas.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE || 'http://localhost:3400/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TEST = BASE + '?test';
const ESPERA_SHELL = 20000;
const ESPERA_FEEDBACK = 2000;
const TOLERANCIA_SCROLL = 2;
const IGNORAR_ERROS = [/ResizeObserver loop/i, /Failed to load resource/i, /net::ERR_/i];

const EMPRESA = {
  id: 'e1',
  nome: 'Cliente QA',
  nif: '501234567',
  createdAt: 1,
  updatedAt: 1,
  profile: {
    nomeCliente: 'Cliente QA',
    nif: '501234567',
    tipoEntidade: 'lda',
    faturaçaoAnualPrevista: 250000,
    nrFuncionarios: 3,
    regimeContabilidade: 'organizada',
  },
  sims: {},
};

const falhas = [];
const avisos = [];
const linhas = [];
const falha = (texto) => {
  falhas.push(texto);
  linhas.push(`[FAIL] ${texto}`);
};
const passa = (texto) => linhas.push(`[PASS] ${texto}`);
const aviso = (texto) => {
  avisos.push(texto);
  linhas.push(`[WARN] ${texto}`);
};
const soPrimeiros = (lista, n = 2) => lista.slice(0, n).join(' | ');

/** Estado da vista + contentor de scroll. Auto-contida para page.evaluate. */
function medirEstado() {
  const mains = [...document.querySelectorAll('#main-content')];
  const scroller =
    mains.find((m) => ['auto', 'scroll'].includes(getComputedStyle(m).overflowY)) || mains[0] || null;
  const vistaEl = mains.find((m) => m.hasAttribute('data-view')) || document.querySelector('[data-view]');
  return {
    vista: vistaEl ? vistaEl.getAttribute('data-view') : null,
    temDataView: !!vistaEl,
    scrollTop: scroller ? Math.round(scroller.scrollTop) : null,
    scrollMax: scroller ? Math.round(scroller.scrollHeight - scroller.clientHeight) : null,
    mains: mains.length,
    topbar: !!document.querySelector('[data-testid="topbar-global"]'),
    url: location.href,
  };
}

/** Semeia o storage do bypass de teste (igual ao resto dos scripts do repo). */
async function semear(page) {
  await page.evaluate((empresa) => {
    const set = (k, data) => localStorage.setItem(k, JSON.stringify({ v: 1, data }));
    localStorage.setItem('estudo360:test-bypass-auth', '1');
    set('estudo360:v1:mode', 'empresa');
    set('estudo360:v1:gabinete:activeId', 'x');
    set('estudo360:v1:empresas', [empresa]);
    set('estudo360:v1:currentEmpresaId', 'e1');
  }, EMPRESA);
}

/** Lê o feedback visível (espera até 2s). */
async function lerFeedback(page) {
  const fb = page.locator('[data-menu-feedback="1"]:visible');
  let visivel = false;
  try {
    await fb.first().waitFor({ state: 'visible', timeout: ESPERA_FEEDBACK });
    visivel = true;
  } catch {
    visivel = false;
  }
  let texto = '';
  if (visivel) {
    texto = ((await fb.first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  }
  const temFrase = /j[áa]\s+est[áa]s\s+em/i.test(texto);
  return { visivel, texto: texto.slice(0, 160), ok: visivel && temFrase };
}

/**
 * Procura o botão visível com um texto. Prefere a sidebar (é o menu), para não
 * apanhar botões de conteúdo com o mesmo rótulo nem o atalho da topbar.
 */
async function localizarItem(page, regex) {
  const ambitos = [
    page.locator('nav[aria-label="Navegação principal"] button:visible'),
    page.locator('button:visible'),
  ];
  for (const ambito of ambitos) {
    const candidatos = ambito.filter({ hasText: regex });
    const total = await candidatos.count();
    for (let i = 0; i < total; i++) {
      const botao = candidatos.nth(i);
      const naTopbar = await botao
        .evaluate((el) => !!(el.closest && el.closest('[data-testid="topbar-global"]')))
        .catch(() => false);
      if (!naTopbar) return botao;
    }
  }
  return null;
}

/** Clique com fallback programático (se um toast cobrir o item) + pequena espera. */
async function clicar(locator) {
  let programatico = false;
  try {
    await locator.click({ timeout: 4000 });
  } catch {
    await locator.evaluate((el) => el.click());
    programatico = true;
  }
  return programatico;
}

/**
 * Põe #main-content scrollável e desce-o. Com pouco conteúdo (1 empresa a
 * 1440) o contentor não tem scroll: nesse caso aplica padding temporário
 * (removido no fim) para o teste de "voltar ao topo" ser real, não vacuoso.
 */
async function prepararScroll(page) {
  const prep = await page.evaluate(() => {
    const mains = [...document.querySelectorAll('#main-content')];
    const s =
      mains.find((m) => ['auto', 'scroll'].includes(getComputedStyle(m).overflowY)) || mains[0] || null;
    if (!s) return { existe: false, forcado: false, max: 0 };
    let max = s.scrollHeight - s.clientHeight;
    let forcado = false;
    if (max < 50) {
      s.style.paddingBottom = '1200px';
      s.dataset.auditScroll = '1';
      max = s.scrollHeight - s.clientHeight;
      forcado = true;
    }
    s.scrollTop = Math.min(300, max);
    return { existe: true, forcado, max };
  });
  await page.waitForTimeout(200);
  const estado = await page.evaluate(medirEstado);
  return { ...prep, ...estado };
}

/** Remove o padding temporário usado para forçar scroll. */
async function limparScroll(page) {
  await page.evaluate(() => {
    document.querySelectorAll('#main-content[data-audit-scroll]').forEach((s) => {
      s.style.paddingBottom = '';
      delete s.dataset.auditScroll;
    });
  });
}

/** Espera que o scroll chegue ao topo (a app usa behavior:'smooth'). */
async function esperarNoTopo(page, timeout = 2500) {
  return page
    .waitForFunction(
      () => {
        const mains = [...document.querySelectorAll('#main-content')];
        const s =
          mains.find((m) => ['auto', 'scroll'].includes(getComputedStyle(m).overflowY)) || mains[0] || null;
        return !!s && s.scrollTop <= 2;
      },
      null,
      { timeout },
    )
    .then(() => true)
    .catch(() => false);
}

const esperaVista = (page, vista, timeout = 5000) =>
  page
    .waitForFunction(
      (v) => {
        const mains = [...document.querySelectorAll('#main-content')];
        const el = mains.find((m) => m.hasAttribute('data-view')) || document.querySelector('[data-view]');
        return !!el && el.getAttribute('data-view') === v;
      },
      vista,
      { timeout },
    )
    .then(() => true)
    .catch(() => false);

let browser = null;
try {
  browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  let erros = [];
  page.on('pageerror', (e) => {
    const msg = String(e && e.message ? e.message : e);
    if (IGNORAR_ERROS.some((re) => re.test(msg))) return;
    erros.push(msg);
  });

  console.log('== audit-menu-feedback ==');
  console.log(`BASE: ${BASE}`);
  console.log('');

  // 1) Abrir com bypass e ir para "empresas".
  await page.goto(TEST, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await semear(page);
  await page.evaluate(() => {
    localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: 'empresas' }));
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#main-content', { timeout: ESPERA_SHELL }).catch(() => {});
  await esperaVista(page, 'empresas', 8000);
  await page.waitForTimeout(1200);

  const inicial = await page.evaluate(medirEstado);
  if (inicial.vista !== 'empresas') {
    const dica = inicial.topbar ? '' : ' (topbar ainda não implementada?)';
    falha(
      `não abriu na vista "empresas" (data-view=${inicial.vista === null ? 'ausente' : `"${inicial.vista}"`})${dica}`,
    );
  }
  if (inicial.scrollTop === null) falha('#main-content não encontrado — app não renderizou');

  // 2) Localizar o item ativo da carteira.
  const item = await localizarItem(page, /^\s*(Lista de Empresas|Trocar de Empresa)\s*$/);
  if (!item) {
    falha('item de menu ativo não encontrado (botão visível "Lista de Empresas"/"Trocar de Empresa")');
  }

  if (inicial.vista === 'empresas' && item) {
    const antes = await prepararScroll(page);
    const marca = erros.length;

    const programatico = await clicar(item);
    if (programatico) aviso('o clique no item ativo teve de ser programático (elemento coberto)');

    // 3) Feedback «Já estás em» em <= 2s.
    const fb = await lerFeedback(page);
    const noTopo = await esperarNoTopo(page);
    const depois = await page.evaluate(medirEstado);
    await limparScroll(page);
    const errosClique = erros.slice(marca);

    if (fb.ok) {
      passa(`feedback visível: «${fb.texto}»`);
    } else if (fb.visivel) {
      falha(`feedback apareceu sem «Já estás em»: «${fb.texto}»`);
    } else {
      falha(`[data-menu-feedback="1"] com «Já estás em» não apareceu em ${ESPERA_FEEDBACK / 1000}s`);
    }

    // 4) Scroll voltou ao topo.
    if (depois.scrollTop === null) {
      falha('#main-content sem scrollTop após o clique');
    } else if (!noTopo || depois.scrollTop > TOLERANCIA_SCROLL) {
      falha(`#main-content não voltou ao topo: scrollTop=${depois.scrollTop}px (máx ${depois.scrollMax}px)`);
    } else if (antes.scrollTop <= 0) {
      aviso(
        `#main-content com scrollTop=${antes.scrollTop} antes do clique — não foi possível descer o conteúdo, ` +
          'a verificação de scroll é vacuosa',
      );
    } else {
      passa(
        `#main-content no topo: scrollTop=${depois.scrollTop}px (antes ${antes.scrollTop}px` +
          `${antes.forcado ? ', scroll forçado com padding temporário' : ''})`,
      );
    }

    // 5) A vista não mudou.
    if (!depois.temDataView) {
      falha('#main-content sem data-view — não foi possível confirmar que a vista se manteve');
    } else if (depois.vista !== 'empresas') {
      falha(`navegou para outra vista: data-view "${depois.vista}" (esperado "empresas")`);
    } else {
      passa(`vista mantida: data-view="${depois.vista}"`);
    }

    if (errosClique.length) falha(`pageerror ao clicar no item ativo: ${soPrimeiros(errosClique)}`);

    // 6) Três cliques seguidos continuam a dar feedback, sem erros.
    const marca3 = erros.length;
    let feedbacks = 0;
    let vistaMudou = false;
    for (let i = 1; i <= 3; i++) {
      const prog = await clicar(item);
      if (prog) aviso(`clique ${i}/3 teve de ser programático`);
      await page.waitForTimeout(150);
      const fbi = await lerFeedback(page);
      if (fbi.ok) feedbacks++;
      else falha(`clique ${i}/3 sem feedback «Já estás em» (visível=${fbi.visivel}, texto="${fbi.texto}")`);

      const e = await page.evaluate(medirEstado);
      if (e.vista !== 'empresas') {
        falha(`clique ${i}/3 navegou para "${e.vista}" (esperado "empresas")`);
        vistaMudou = true;
        break;
      }
    }
    const erros3 = erros.slice(marca3);
    if (!vistaMudou && feedbacks === 3) passa('3 cliques seguidos: feedback em todos, vista mantida');
    if (erros3.length) falha(`pageerror nos 3 cliques: ${soPrimeiros(erros3)}`);
  }

  // 7) Repetir para "Gabinete" (opcional).
  const gabinete = await localizarItem(page, /^\s*Gabinete\s*$/);
  if (!gabinete) {
    linhas.push('[SKIP] Gabinete: item não encontrado na sidebar (opcional)');
  } else {
    const marcaG = erros.length;
    try {
      // 1.º clique: sair de empresas e entrar no Gabinete.
      const prog1 = await clicar(gabinete);
      if (prog1) aviso('Gabinete: clique de navegação teve de ser programático');
      const abriu = await esperaVista(page, 'gabinete', 6000);

      if (!abriu) {
        const e = await page.evaluate(medirEstado);
        aviso(`Gabinete: clique não abriu a vista (data-view="${e.vista}") — sem feedback a testar`);
      } else {
        // Limpa o toast anterior para não confundir com o do Gabinete.
        await page
          .waitForFunction(() => !document.querySelector('[data-menu-feedback="1"]'), null, { timeout: 3000 })
          .catch(() => {});

        // 2.º clique: já com o item ativo — é este que deve dar feedback.
        const antesG = await prepararScroll(page);
        const prog2 = await clicar(gabinete);
        if (prog2) aviso('Gabinete: clique no item ativo teve de ser programático');
        const fbG = await lerFeedback(page);
        const noTopoG = await esperarNoTopo(page);
        const depoisG = await page.evaluate(medirEstado);
        await limparScroll(page);

        const refereGabinete = /gabinete/i.test(fbG.texto);
        if (!fbG.ok) {
          aviso(
            `Gabinete: feedback «Já estás em» não apareceu (visível=${fbG.visivel}, texto="${fbG.texto}") — opcional`,
          );
        } else if (!refereGabinete) {
          aviso(`Gabinete: feedback apareceu mas não refere "Gabinete": «${fbG.texto}» — opcional`);
        } else if (depoisG.vista !== 'gabinete') {
          aviso(`Gabinete: vista mudou para "${depoisG.vista}" após o clique — opcional`);
        } else if (depoisG.scrollTop === null || !noTopoG) {
          aviso(`Gabinete: scrollTop=${depoisG.scrollTop}px após o clique — opcional`);
        } else {
          passa(
            `Gabinete: feedback «${fbG.texto}» · scrollTop=${depoisG.scrollTop}px (antes ${antesG.scrollTop}px` +
              `${antesG.forcado ? ', scroll forçado' : ''}) · vista mantida`,
          );
        }
      }

      const errosG = erros.slice(marcaG);
      if (errosG.length) aviso(`Gabinete: pageerror (opcional) — ${soPrimeiros(errosG)}`);
    } catch (e) {
      aviso(`Gabinete: não foi possível testar (${String(e && e.message ? e.message : e).split('\n')[0]})`);
    } finally {
      await limparScroll(page).catch(() => {});
    }
  }

  console.log(linhas.join('\n'));
  console.log('');

  if (falhas.length) {
    console.log(`RESULTADO: FAIL — ${falhas.length} falha(s)`);
    falhas.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
    process.exitCode = 1;
  } else {
    const extra = avisos.length ? ` (${avisos.length} aviso[s])` : '';
    console.log(`RESULTADO: PASS — feedback do item ativo OK${extra}.`);
  }
} catch (e) {
  console.error('');
  console.error(`RESULTADO: FAIL — erro inesperado: ${e && e.message ? e.message : e}`);
  if (falhas.length) falhas.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
}
