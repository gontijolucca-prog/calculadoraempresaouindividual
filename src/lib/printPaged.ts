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
const pagedPolyfillUrl = '/paged.polyfill.js';

const esc = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// content das margin-boxes do paged.js é uma string CSS — escapar aspas/barras.
const cssStr = (s: string) => (s ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Remove um bloco @media <cond> { ... } equilibrando chavetas (limpa print/zoom). */
function stripAtMedia(css: string, condFragment: string): string {
  let out = css;
  let guard = 0;
  for (;;) {
    const at = out.indexOf('@media');
    const idx = out.indexOf(condFragment, at);
    if (at === -1 || idx === -1 || idx > out.indexOf('{', at)) {
      // procurar a próxima ocorrência cuja condição contém o fragmento
      const re = new RegExp('@media[^{]*' + condFragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^{]*\\{');
      const m = re.exec(out);
      if (!m) return out;
      const start = m.index;
      let i = start + m[0].length, depth = 1;
      while (i < out.length && depth > 0) {
        if (out[i] === '{') depth++;
        else if (out[i] === '}') depth--;
        i++;
      }
      out = out.slice(0, start) + out.slice(i);
    }
    if (++guard > 20) return out;
  }
}

interface PagedOpts {
  title: string;
  footerLeft?: string;   // ex.: nome do escritório
  footerRight?: string;  // ex.: estudo360.pt
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
  css = stripAtMedia(css, 'max-width: 820px');
  css = stripAtMedia(css, 'max-width: 480px');
  css = stripAtMedia(css, 'max-width: 380px');

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
    /* Nunca partir a meio de blocos de texto/tabelas. */
    p, li, tr, .pp-keep, .mc-keep { break-inside: avoid; page-break-inside: avoid; }
    h1, h2, h3, .sec { break-after: avoid; page-break-after: avoid; }
    @page {
      size: A4; margin: 16mm 16mm 18mm 16mm;
      @bottom-center {
        content: "Página " counter(page) " de " counter(pages);
        font: 9pt Georgia, 'Times New Roman', serif; color: #64748B;
      }
      @bottom-left  { content: "${footerLeft}";  font: 8pt Georgia, serif; color: #94A3B8; }
      @bottom-right { content: "${footerRight}"; font: 8pt Georgia, serif; color: #94A3B8; }
    }
  `;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(opts.title)}</title>
<style>${css}\n${pageCss}</style>
</head><body>${clone.outerHTML}
<script src="${pagedPolyfillUrl}"></script>
</body></html>`);
  doc.close();

  // Espera o paged.js terminar a paginação (aparecem .pagedjs_page) e imprime.
  const win = iframe.contentWindow!;
  let done = false;
  const cleanup = () => { setTimeout(() => iframe.remove(), 1000); };
  const tryPrint = () => {
    if (done) return;
    done = true;
    win.focus();
    win.print();
    cleanup();
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
