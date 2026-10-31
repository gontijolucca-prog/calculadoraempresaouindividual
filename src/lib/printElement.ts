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

  const zoomOriginal = root.style.zoom;
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
      }
      /* Versão condensada: documento longo cabe numa folha sem virar miniatura.
         Os seletores com ID dentro do componente têm especificidade maior, por
         isso o !important é obrigatório também nos parágrafos/listas. */
      .uma-folha-flow .mc-page { font-size: var(--uma-folha-pt, 9pt) !important; line-height: 1.28 !important; padding: 12mm 16mm !important; width: 210mm !important; }
      .uma-folha-flow .mc-page h1 { font-size: 13pt !important; margin: 0 0 3mm !important; }
      .uma-folha-flow .mc-page h2 { font-size: 10pt !important; margin: 2.5mm 0 1mm !important; }
      .uma-folha-flow .mc-page p,
      .uma-folha-flow .mc-page li,
      .uma-folha-flow .mc-page .mc-sub { font-size: var(--uma-folha-pt, 9pt) !important; line-height: 1.28 !important; margin: 2px 0 !important; }
      .uma-folha-flow .mc-page *.mc-kicker { margin: 1mm 0 2mm !important; }`;
      document.head.appendChild(style);
    }
  }

  // Com várias folhas o que conta é a altura total; com uma, a altura dela.
  const altura = paginas.length > 1
    ? paginas.reduce((soma, p) => soma + p.scrollHeight, 0)
    : (paginas[0]?.scrollHeight ?? root.scrollHeight);

  // Compensa a largura: o zoom encolhe a folha de 210 mm e deixaria metade da
  // página em branco. Alargar na proporção 1/zoom faz o conteúdo voltar a
  // ocupar a largura toda da A4 (e o texto reflui, ocupando menos altura).
  const larguraOriginal = paginas.map((p) => p.style.width);
  const compensar = (z: number) => {
    paginas.forEach((p) => {
      if (z < 1) {
        p.style.width = `calc(210mm / ${z.toFixed(4)})`;
        p.style.maxWidth = 'none';
      } else {
        p.style.width = '';
        p.style.maxWidth = '';
      }
    });
  };

  // Documento com várias folhas (contrato): a prioridade é a tipografia — um
  // contrato a 3 pt é ilegível. Desce-se o corpo do texto até caber; o zoom só
  // entra como último recurso.
  let fator = Math.min(1, Math.max(piso, (alvoPx * 0.97) / Math.max(1, altura)));
  if (paginas.length > 1) {
    const medir = () => paginas.reduce((s, p) => s + p.scrollHeight, 0);
    for (const pt of [9, 8.4, 7.8, 7.2, 6.6, 6.0]) {
      root.style.setProperty('--uma-folha-pt', `${pt}pt`);
      root.classList.add('uma-folha-texto');
      if (medir() <= alvoPx * 0.97) { fator = 1; break; }
    }
    root.style.zoom = String(fator);
    if (fator < 1) compensar(fator);
  } else {
    const zoomAnterior0 = root.style.zoom;
    void zoomAnterior0;
    root.style.zoom = String(fator);
    compensar(fator);
  }

  // O zoom estreita a largura e o texto reflui; alargar compensa, mas a altura
  // muda outra vez. Itera até o conteúdo encher ~97% da A4 (cresce e encolhe).
  const pretendido = alvoPx * 0.97;
  for (let i = 0; i < 5; i++) {
    const alturaReal = paginas.length > 1
      ? paginas.reduce((soma, p) => soma + p.scrollHeight, 0)
      : (paginas[0]?.scrollHeight ?? root.scrollHeight);
    const ocupado = alturaReal * fator;
    if (Math.abs(ocupado - pretendido) <= 12) break;
    const novo = Math.min(1, Math.max(piso, pretendido / Math.max(1, alturaReal)));
    if (Math.abs(novo - fator) < 0.005) break;
    fator = novo;
    root.style.zoom = String(fator);
    compensar(fator);
  }

  // Duas frames para o browser aplicar o zoom antes de imprimir.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        window.print();
      } finally {
        setTimeout(() => {
          root.style.zoom = zoomOriginal;
          root.style.removeProperty('--uma-folha-pt');
          root.classList.remove('uma-folha-flow', 'uma-folha-texto');
          paginas.forEach((p, i) => { p.style.width = larguraOriginal[i] || ''; p.style.maxWidth = ''; });
        }, 1500);
      }
    });
  });

  return { fator };
}
