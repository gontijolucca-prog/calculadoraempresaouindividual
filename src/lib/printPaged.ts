/**
 * Impressão paginada (paged.js) para os documentos do Pacote do Cliente.
 *
 * Os componentes (Proposta, Minuta, Simulação) renderizam uma folha A4 editável
 * inline. Para IMPRIMIR/exportar PDF com margens em TODAS as páginas, rodapé
 * repetido e numeração "Página X de Y", clonamos o conteúdo já editado para um
 * iframe isolado, achatamos a "caixa A4" para o conteúdo fluir, e deixamos o
 * paged.js paginar com @page + margin-boxes (que o Chrome não suporta sozinho).
 *
 * A pré-visualização React fica intacta — o paged.js só corre nesta cópia.
 */
// Polyfill paged.js auto-hospedado em public/ (o package bloqueia deep-imports
// via "exports"; servir como asset estático mantém a impressão offline-safe).
// A query de versão evita que o browser sirva uma cópia antiga do cache quando
// o polyfill for atualizado — bump ao trocar a versão do ficheiro em public/.
const pagedPolyfillUrl = '/paged.polyfill.js?v=0.4.3';

// Carrega a Montserrat (fonte do site) no iframe de impressão, para o PDF condizer
// com estudo360.pt. Sem isto o iframe cai para a fonte de sistema. CSP permite.
const fontLink = '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&display=swap">';

const esc = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// content das margin-boxes do paged.js é uma string CSS — escapar aspas/barras.
const cssStr = (s: string) => (s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * Remove TODOS os blocos `@media <…cond…> { … }` cuja condição (o texto entre
 * `@media` e o primeiro `{`) contém `condFragment`, equilibrando chavetas — lida
 * com regras aninhadas (ex.: um `@page` dentro do `@media print`).
 *
 * A versão anterior tinha um bug: quando o fragmento aparecia ANTES do primeiro
 * `{` (o caso normal `@media print {`), a condição saltava a remoção e o bloco
 * ficava. Isso deixava o `@media print { @page { margin:0 } body * { visibility:
 * hidden } }` das minutas/propostas a contaminar a impressão paged.js — sem
 * margens, sem numeração e com conteúdo escondido.
 */
function stripAtMedia(css: string, condFragment: string): string {
  let out = css;
  for (let guard = 0; guard < 50; guard++) {
    // localiza um @media cuja "cabeça" (até ao primeiro `{`) contenha o fragmento
    let found = -1, braceStart = -1, from = 0;
    for (;;) {
      const at = out.indexOf('@media', from);
      if (at === -1) break;
      const brace = out.indexOf('{', at);
      if (brace === -1) break;
      if (out.slice(at, brace).includes(condFragment)) { found = at; braceStart = brace; break; }
      from = at + 6;
    }
    if (found === -1) return out;
    // remove do `@media` até à chaveta de fecho correspondente (balanceada)
    let i = braceStart + 1, depth = 1;
    while (i < out.length && depth > 0) {
      if (out[i] === '{') depth++;
      else if (out[i] === '}') depth--;
      i++;
    }
    out = out.slice(0, found) + out.slice(i);
  }
  return out;
}

/** Remove a regra `@page { ... }` (sem condição) equilibrando chavetas. O paged.js
 *  precisa de ser o dono do @page para aplicar margens + margin-boxes; um @page do
 *  próprio documento entraria em conflito (ex.: o `margin: 1.8cm 1.4cm` do Word-HTML). */
function stripAtPage(css: string): string {
  let out = css;
  for (let guard = 0; guard < 20; guard++) {
    const m = /@page[^{]*\{/.exec(out);
    if (!m) return out;
    let i = m.index + m[0].length, depth = 1;
    while (i < out.length && depth > 0) {
      if (out[i] === '{') depth++;
      else if (out[i] === '}') depth--;
      i++;
    }
    out = out.slice(0, m.index) + out.slice(i);
  }
  return out;
}

/**
 * CSS de paginação partilhado: regras de quebra (orphans/widows, break-inside,
 * cabeçalho de tabela repetido) + bloco @page com margens A4 e margin-boxes
 * (rodapé esquerdo/direito + "Página X de Y"). Estas margin-boxes são o que o
 * Chrome NÃO suporta nativamente — daí o paged.js.
 */
function buildPageBreakCss(footerLeft: string, footerRight: string): string {
  return `
    /* Regras de paginação (CSS Paged Media). */
    p, blockquote { orphans: 3; widows: 3; }
    tr, img, figure, .pp-keep, .mc-keep, .sigs, ul, li { break-inside: avoid; page-break-inside: avoid; }
    /* Não deixar um título/secção/total órfão no fundo da página. */
    h1, h2, h3, h4, .sec, .title { break-after: avoid; page-break-after: avoid; }
    .tot { break-before: avoid; page-break-before: avoid; }
    /* Cabeçalho/rodapé de tabela repetem em cada página. */
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    table { break-inside: auto; }
    @page {
      size: A4; margin: 18mm 16mm 20mm 16mm;
      @bottom-center {
        content: "Página " counter(page) " de " counter(pages);
        font: 9pt Georgia, 'Times New Roman', serif; color: #64748B;
      }
      @bottom-left  { content: "${cssStr(footerLeft)}";  font: 8pt Georgia, serif; color: #94A3B8; }
      @bottom-right { content: "${cssStr(footerRight)}"; font: 8pt Georgia, serif; color: #94A3B8; }
    }
    /* Primeira página sem o número repetido em cima do título (estética). */
  `;
}

interface PagedOpts {
  title: string;
  footerLeft?: string;   // ex.: nome do escritório
  footerRight?: string;  // ex.: estudo360.pt
  onSettled?: () => void; // chamado quando o diálogo de impressão é disparado (ou em erro/timeout)
}

export function printViaPaged(printRoot: HTMLElement, opts: PagedOpts): void {
  const clone = printRoot.cloneNode(true) as HTMLElement;
  // Remove dicas de edição e qualquer elemento marcado para não imprimir.
  clone.querySelectorAll('.no-print').forEach(n => n.remove());

  // Extrai e limpa o CSS scoped do componente (tira os @media print/zoom, que
  // forçavam margin:0 e position:absolute e estragavam a paginação do paged.js).
  let css = '';
  clone.querySelectorAll('style').forEach(s => { css += (s.textContent || '') + '\n'; s.remove(); });
  css = stripAtMedia(css, 'print');
  css = stripAtMedia(css, 'screen');
  css = stripAtMedia(css, 'max-width');
  // O paged.js tem de ser o ÚNICO dono do @page (margens + margin-boxes). Tira
  // qualquer @page que tenha sobrado do componente (ex.: `@page{margin:0}`).
  css = stripAtPage(css);

  const footerLeft = cssStr(opts.footerLeft || '');
  const footerRight = cssStr(opts.footerRight || 'estudo360.pt');

  // Achata a caixa A4 fixa para o conteúdo fluir; o paged.js + @page tratam das
  // margens/quebras. Margin-boxes dão o rodapé repetido e a numeração.
  const pageCss = `
    .pp-page, .mc-page, .pdf-page {
      width: auto !important; min-height: 0 !important; box-shadow: none !important;
      margin: 0 !important; padding: 0 !important; overflow: visible !important;
    }
    .pdf-page { break-after: page; }
    .pdf-page:last-child { break-after: auto; }
    .pp-band, .mc-band { margin-left: 0 !important; margin-right: 0 !important; }
    [contenteditable] { outline: none !important; }
  ` + buildPageBreakCss(footerLeft, footerRight);

  const fullDoc = `<!doctype html><html><head><meta charset="utf-8">${fontLink}<title>${esc(opts.title)}</title>
<style>${css}\n${pageCss}</style>
</head><body>${clone.outerHTML}
<script src="${pagedPolyfillUrl}"></script>
</body></html>`;
  runPagedIframe(fullDoc, opts.onSettled);
}

/**
 * Variante para os documentos da contabilista (Demonstrações & documentos), que
 * são HTML "Word" (string) renderizado num iframe — não um componente React.
 * Reaproveita o motor paged.js para dar margens em TODAS as páginas, rodapé
 * repetido e numeração "Página X de Y", que o `window.print()` do Chrome não faz.
 *
 * `fullHtml` é o documento já editado/serializado (sem `contenteditable`). Tiramos
 * o @page e o @media screen do próprio documento para o paged.js controlar a página.
 */
export function printHtmlViaPaged(fullHtml: string, opts: PagedOpts): void {
  const footerLeft = opts.footerLeft || '';
  const footerRight = opts.footerRight || 'estudo360.pt';

  let styleCss = '';
  let bodyHtml = fullHtml;
  try {
    const parsed = new DOMParser().parseFromString(fullHtml, 'text/html');
    parsed.querySelectorAll('style').forEach(s => { styleCss += (s.textContent || '') + '\n'; });
    bodyHtml = parsed.body ? parsed.body.innerHTML : fullHtml;
  } catch {
    /* fallback: usa o html cru */
  }

  styleCss = stripAtPage(styleCss);
  styleCss = stripAtMedia(styleCss, 'screen');

  const pageCss = styleCss + '\n' + buildPageBreakCss(footerLeft, footerRight);

  const fullDoc = `<!doctype html><html><head><meta charset="utf-8">${fontLink}<title>${esc(opts.title)}</title>
<style>${pageCss}</style>
</head><body>${bodyHtml}
<script src="${pagedPolyfillUrl}"></script>
</body></html>`;
  runPagedIframe(fullDoc, opts.onSettled);
}

/** Cria um iframe isolado, escreve o documento, espera o paged.js paginar e imprime. */
function runPagedIframe(fullDoc: string, onSettled?: () => void): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(fullDoc);
  doc.close();

  // Espera o paged.js terminar a paginação (aparecem .pagedjs_page) e imprime.
  const win = iframe.contentWindow!;
  let done = false;
  const cleanup = () => { setTimeout(() => iframe.remove(), 1000); };
  const tryPrint = () => {
    if (done) return;
    done = true;
    try {
      win.focus();
      win.print();
    } finally {
      onSettled?.();
      cleanup();
    }
  };
  // paged.js dispara este evento no document quando termina.
  doc.addEventListener('pagedjs:rendered', tryPrint as EventListener);
  // Fallback: faz polling por páginas renderizadas (caso o evento não dispare).
  let tries = 0;
  const poll = () => {
    if (done) return;
    if (doc.querySelector('.pagedjs_page')) { setTimeout(tryPrint, 150); return; }
    if (++tries > 120) { tryPrint(); return; } // ~12s de teto
    setTimeout(poll, 100);
  };
  setTimeout(poll, 200);
}
