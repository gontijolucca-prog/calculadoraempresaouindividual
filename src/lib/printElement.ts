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
