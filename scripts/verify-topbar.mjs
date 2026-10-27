/**
 * verify-topbar.mjs — confirma a barra de topo global em todas as vistas.
 *
 * Para cada vista (empresas, profile, tax, gabinete, legal, proposta), a 1440 e
 * 375, exige:
 *   - existe [data-testid="topbar-global"] e está visível;
 *   - a barra contém "Gabinete" (texto visível ou nome acessível do controlo);
 *   - contém um controlo de troca de gabinete (botão/atalho);
 *   - contém o sino de notificações (aria-label/botão);
 *   - não há overflow horizontal (scrollWidth - clientWidth <= 1);
 *   - não houve pageerror.
 *
 * Confirma também que a landing, sem bypass (?test), NÃO mostra a barra.
 *
 * Uso:
 *   node scripts/verify-topbar.mjs
 *   BASE=http://localhost:3000/ node scripts/verify-topbar.mjs
 *
 * Nota: o bypass `estudo360:test-bypass-auth` só funciona em servidor DEV
 * (import.meta.env.DEV). Num preview de produção o teste acusa "bypass não ativou".
 *
 * Exit code: 0 = PASS, 1 = falhas (lista no fim).
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE || 'http://localhost:3400/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TEST = BASE + '?test';
const VISTAS = ['empresas', 'profile', 'tax', 'gabinete', 'legal', 'proposta'];
const TAMANHOS = [
  { w: 1440, h: 900 },
  { w: 375, h: 812 },
];
const ESPERA_SHELL = 20000;
const ESPERA_TOPBAR = 3000;
const ASSENTAR = 700;
const IGNORAR_ERROS = [/ResizeObserver loop/i, /Failed to load resource/i, /net::ERR_/i];

// Empresa mínima compatível com o storage da app.
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

/**
 * Mede a barra e o layout. Tem de ser auto-contida (é serializada para a página).
 */
function medirBarra() {
  const normalizar = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const attrs = (el) =>
    ['aria-label', 'title', 'data-testid', 'aria-keyshortcuts', 'data-shortcut', 'name']
      .map((a) => el.getAttribute(a) || '')
      .join(' ');
  const visivel = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return (
      r.width > 1 &&
      r.height > 1 &&
      s.display !== 'none' &&
      s.visibility !== 'hidden' &&
      Number(s.opacity) > 0
    );
  };

  const topbar = document.querySelector('[data-testid="topbar-global"]');
  const textoTopbar = normalizar(topbar ? topbar.innerText || topbar.textContent : '');
  const controlos = topbar
    ? [...topbar.querySelectorAll('button, a, [role="button"], [role="combobox"], select, summary')]
    : [];
  const controlo = (el) =>
    normalizar(el.innerText || el.textContent) + ' ' + attrs(el) + ' ' + (el.className || '');

  const gabineteControlos = controlos.filter((el) =>
    /gabinete|trocar|escrit[oó]rio|office/i.test(controlo(el)),
  );
  // Prefere o controlo visível (há variantes desktop/mobile do mesmo botão).
  const troca = gabineteControlos.find(visivel) || gabineteControlos[0] || null;
  // "Gabinete" pode estar no texto visível (título/etiqueta) ou no nome acessível
  // de um controlo (ex.: botão só com ícone + title="Trocar de gabinete").
  const gabineteVisivel = /gabinete/i.test(textoTopbar);
  const gabineteAcessivel = /gabinete/i.test(controlos.map((el) => attrs(el)).join(' '));
  const sino =
    (topbar &&
      topbar.querySelector(
        '[aria-label*="otifica" i], [aria-label*="lerta" i], [title*="otifica" i], ' +
          '[data-testid*="notif" i], [data-testid*="sino" i], .lucide-bell, [data-lucide="bell"], [data-icon="bell"]',
      )) ||
    controlos.find((el) => /notifica|sino|alert/i.test(attrs(el))) ||
    null;

  const mains = [...document.querySelectorAll('#main-content')];
  const scroller =
    mains.find((m) => ['auto', 'scroll'].includes(getComputedStyle(m).overflowY)) || mains[0] || null;
  const vistaEl = mains.find((m) => m.hasAttribute('data-view')) || document.querySelector('[data-view]');
  const de = document.documentElement;
  const body = document.body;
  const rect = topbar ? topbar.getBoundingClientRect() : null;

  return {
    temTopbar: !!topbar,
    topbarVisivel: visivel(topbar),
    textoTopbar: textoTopbar.slice(0, 240),
    temTextoGabinete: gabineteVisivel || gabineteAcessivel,
    fonteGabinete: gabineteVisivel ? 'texto' : gabineteAcessivel ? 'aria/título' : 'ausente',
    temTrocaGabinete: !!troca,
    trocaVisivel: visivel(troca),
    detalheTroca: troca ? normalizar(`${troca.innerText || troca.textContent || ''} ${attrs(troca)}`) : '',
    temSino: !!sino,
    detalheSino: sino ? normalizar(attrs(sino)) || 'ícone sino' : '',
    overflowDoc: de.scrollWidth - de.clientWidth,
    overflowBody: body.scrollWidth - body.clientWidth,
    topbarFora: rect ? rect.left < -1 || rect.right > window.innerWidth + 1 : false,
    vista: vistaEl ? vistaEl.getAttribute('data-view') : null,
    mains: mains.length,
    loginVisivel: !!document.querySelector('input[type="password"]'),
    scrollTop: scroller ? Math.round(scroller.scrollTop) : null,
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

const soPrimeiros = (lista, n = 2) => lista.slice(0, n).join(' | ');

let browser = null;
try {
  browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Erros da página: renovados a cada vista; o handler lê sempre a variável atual.
  let erros = [];
  page.on('pageerror', (e) => {
    const msg = String(e && e.message ? e.message : e);
    if (IGNORAR_ERROS.some((re) => re.test(msg))) return;
    erros.push(msg);
  });

  console.log(`== verify-topbar ==`);
  console.log(`BASE: ${BASE}`);
  console.log(`Vistas: ${VISTAS.join(', ')} · larguras: 1440 / 375`);
  console.log('');

  // 1) Landing sem bypass: a barra não pode existir.
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  const errosLanding = [...erros];
  for (const { w, h } of TAMANHOS) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(350);
    const m = await page.evaluate(medirBarra);
    if (m.temTopbar) {
      falha(`landing@${w} (sem bypass): topbar-global presente — devia estar ausente`);
    } else {
      passa(`landing@${w} (sem bypass): sem topbar-global`);
    }
  }
  if (errosLanding.length) aviso(`landing: pageerror (${soPrimeiros(errosLanding, 1)})`);

  // 2) App com bypass: semear storage e recarregar.
  erros = [];
  await page.goto(TEST, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await semear(page);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#main-content', { timeout: ESPERA_SHELL }).catch(() => {});
  await page.waitForTimeout(ASSENTAR);

  const primeira = await page.evaluate(medirBarra);
  let abortar = false;
  if (primeira.loginVisivel && !primeira.temTopbar) {
    falha(
      'bypass de teste não ativou: a app mostra login e não há topbar. ' +
        'Confirma que BASE é o servidor DEV (vite) e que o URL leva ?test.',
    );
    abortar = true;
  }

  // 3) Cada vista × cada largura.
  for (const vista of VISTAS) {
    if (abortar) break;
    await page.evaluate((v) => {
      localStorage.setItem('estudo360:v1:lastView', JSON.stringify({ v: 1, data: v }));
    }, vista);

    erros = [];
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#main-content', { timeout: ESPERA_SHELL }).catch(() => {});
    await page.waitForSelector('[data-testid="topbar-global"]', { timeout: ESPERA_TOPBAR }).catch(() => {});
    await page.waitForTimeout(ASSENTAR);

    let marcaErros = 0;
    for (const { w, h } of TAMANHOS) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(450);

      const m = await page.evaluate(medirBarra);
      const passoErros = erros.slice(marcaErros);
      marcaErros = erros.length;

      const motivos = [];
      if (!m.temTopbar) motivos.push('topbar-global ausente');
      else if (!m.topbarVisivel) motivos.push('topbar-global não visível');
      if (!m.temTextoGabinete) motivos.push('sem texto "Gabinete" na barra');
      if (!m.temTrocaGabinete) motivos.push('sem botão/atalho de troca de gabinete');
      if (!m.temSino) motivos.push('sem sino de notificações');
      if (m.overflowDoc > 1 || m.overflowBody > 1) {
        motivos.push(`overflow horizontal (doc ${m.overflowDoc}px, body ${m.overflowBody}px)`);
      }
      if (m.topbarFora) motivos.push('barra de topo transborda a viewport');
      if (passoErros.length) motivos.push(`pageerror: ${soPrimeiros(passoErros)}`);

      if (motivos.length) {
        falha(`${vista}@${w}: ${motivos.join('; ')}`);
      } else {
        passa(
          `${vista}@${w}: topbar visível · "Gabinete" (${m.fonteGabinete}) · ` +
            `troca (${m.detalheTroca.trim() || 'controlo'}) · sino (${m.detalheSino || 'ok'}) · ` +
            `overflow ${m.overflowDoc}px`,
        );
      }

      if (m.temTrocaGabinete && !m.trocaVisivel) {
        aviso(`${vista}@${w}: controlo de troca de gabinete existe mas está oculto (ver CSS/breakpoint)`);
      }

      if (!m.vista) aviso(`${vista}@${w}: #main-content sem data-view (não foi possível confirmar a vista)`);
      else if (m.vista !== vista) aviso(`${vista}@${w}: app abriu a vista "${m.vista}" em vez de "${vista}"`);
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
    console.log(
      `RESULTADO: PASS — topbar global OK em ${VISTAS.length} vistas × 2 larguras; landing limpa${extra}.`,
    );
  }
} catch (e) {
  console.error('');
  console.error(`RESULTADO: FAIL — erro inesperado: ${e && e.message ? e.message : e}`);
  if (falhas.length) falhas.forEach((f, i) => console.error(`  ${i + 1}. ${f}`));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
}
