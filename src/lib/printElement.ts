/**
 * Imprime um só bloco (mapa, quadro, tabela) em vez da página inteira.
 *
 * Clona o elemento para um contentor próprio e esconde o resto da app durante
 * a impressão. Sem bibliotecas: o CSS vive em `index.css` (`.print-holder`) e
 * só o `@page` é injetado aqui, porque depende da orientação.
 */

type OpcoesImpressao = {
  /** `true` (omissão) para mapas largos; `false` para documentos verticais. */
  paisagem?: boolean;
};

let limparEmCurso: (() => void) | null = null;

export function imprimirElemento(
  alvo: HTMLElement | null | undefined,
  titulo?: string,
  opcoes: OpcoesImpressao = {},
): void {
  // Dois cliques seguidos não deixam dois contentores pendurados.
  limparEmCurso?.();

  const origem = alvo ?? document.body;
  const paisagem = opcoes.paisagem !== false;

  const holder = document.createElement('div');
  holder.id = 'print-holder';

  const clone = origem.cloneNode(true) as HTMLElement;
  clone.classList.add('print-clone');
  // Só sai o que é chrome de interface. Nada de apagar `button`: o nome do
  // cliente e os símbolos ✓/✕ do quadro estão lá dentro.
  clone.querySelectorAll('.no-print, [data-print-hide]').forEach((n) => n.remove());

  holder.appendChild(clone);

  const page = document.createElement('style');
  page.id = 'print-holder-page';
  page.textContent = `@page { size: A4 ${paisagem ? 'landscape' : 'portrait'}; margin: 8mm; }`;

  const tituloAnterior = document.title;
  if (titulo) document.title = titulo;

  document.head.appendChild(page);
  document.body.appendChild(holder);
  document.body.classList.add('printing-target');

  const limpar = () => {
    holder.remove();
    page.remove();
    document.body.classList.remove('printing-target');
    document.title = tituloAnterior;
    window.removeEventListener('afterprint', limpar);
    window.removeEventListener('focus', limpar);
    if (limparEmCurso === limpar) limparEmCurso = null;
  };
  limparEmCurso = limpar;
  window.addEventListener('afterprint', limpar);

  // Duas frames para o browser aplicar o clone antes de medir.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const larguraPagina = paisagem ? 1060 : 720;
      const largura = clone.scrollWidth || 1;
      if (largura > larguraPagina) {
        clone.style.zoom = String(Math.max(0.4, larguraPagina / largura));
      }
      try {
        window.print();
      } finally {
        // Rede de segurança para browsers que não disparam afterprint. O contentor
        // fica oculto fora do ecrã, por isso pode esperar sem incomodar ninguém.
        setTimeout(limpar, 60000);
      }
    });
  });
}

/**
 * Imprime um documento A4 de uma só folha (Proposta, Minuta, deck).
 *
 * Mede a altura real do conteúdo e aplica `zoom` até caber na altura da A4;
 * nunca corta texto nem abre segunda página. Repõe o zoom no fim.
 */
export function imprimirUmaFolha(
  rootId: string,
  opcoes: { paisagem?: boolean; piso?: number; seletor?: string } = {},
): { fator: number } {
  const root = document.getElementById(rootId);
  const piso = opcoes.piso ?? 0.45;
  const seletor = opcoes.seletor ?? '.pp-page, .mc-page, .deck-page';
  const alvoPx = ((opcoes.paisagem ? 210 : 297) * 96) / 25.4;

  if (!root) {
    window.print();
    return { fator: 1 };
  }

  const paginas = Array.from(root.querySelectorAll<HTMLElement>(seletor));

  // Documentos com várias "folhas" (ex.: contrato) passam a fluxo contínuo:
  // sem quebras nem altura mínima, para caber tudo numa só A4.
  if (paginas.length > 1) {
    root.classList.add('uma-folha-flow');
    if (!document.getElementById('uma-folha-flow-css')) {
      const style = document.createElement('style');
      style.id = 'uma-folha-flow-css';
      style.textContent = `.uma-folha-flow .pp-page, .uma-folha-flow .mc-page {
        min-height: 0 !important; height: auto !important;
        page-break-after: auto !important; break-after: auto !important;
        margin: 0 !important; box-shadow: none !important;
      }`;
      document.head.appendChild(style);
    }
  }

  // Com várias folhas o que conta é a altura total; com uma, a altura dela.
  const altura = paginas.length > 1
    ? paginas.reduce((soma, p) => soma + p.scrollHeight, 0)
    : (paginas[0]?.scrollHeight ?? root.scrollHeight);

  // 0.97 dá folga para arredondamentos do zoom (evita 1 linha na 2.ª página).
  let fator = Math.min(1, Math.max(piso, (alvoPx * 0.97) / Math.max(1, altura)));
  const zoomAnterior = root.style.zoom;
  root.style.zoom = String(fator);

  // O zoom estreita a largura e o texto pode passar a ocupar mais linhas: mede
  // outra vez e afina até caber (2 passagens chegam).
  for (let i = 0; i < 3; i++) {
    // scrollHeight = conteúdo real (o `min-height` da folha corta o rect).
    const alturaReal = paginas.length > 1
      ? paginas.reduce((soma, p) => soma + p.scrollHeight, 0)
      : (paginas[0]?.scrollHeight ?? root.scrollHeight);
    const ocupado = alturaReal * fator;
    const pretendido = alvoPx * 0.97;
    if (ocupado <= pretendido) break;
    fator = Math.max(piso, fator * (pretendido / ocupado) * 0.99);
    root.style.zoom = String(fator);
  }

  // Duas frames para o browser aplicar o zoom antes de imprimir.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        window.print();
      } finally {
        setTimeout(() => { root.style.zoom = zoomAnterior; }, 1500);
      }
    });
  });

  return { fator };
}
