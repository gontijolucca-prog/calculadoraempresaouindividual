/**
 * Ajusta folhas lógicas `.pdf-page` para caberem numa única A4 física antes
 * do `window.print()`. O Chrome cortava o excesso para uma página seguinte
 * sem cabeçalho nem numeração. O zoom mínimo de 0,72 protege a legibilidade.
 */
export function ajustarFolhasParaA4(root: ParentNode = document, a4px = (297 * 96) / 25.4): void {
  root.querySelectorAll<HTMLElement>('.pdf-page').forEach((pg) => {
    pg.style.removeProperty('zoom');
    let z = 1;
    for (let i = 0; i < 4; i++) {
      const h = pg.scrollHeight;
      if (!h || h <= a4px * 0.99) break;
      z = Math.max(0.72, z * ((a4px * 0.99) / h));
      pg.style.setProperty('zoom', String(z), 'important');
    }
  });
}

export function reporZoomFolhas(root: ParentNode, anteriores: Map<HTMLElement, string>): void {
  root.querySelectorAll<HTMLElement>('.pdf-page').forEach((pg) => {
    const v = anteriores.get(pg);
    if (v) pg.style.setProperty('zoom', v);
    else pg.style.removeProperty('zoom');
  });
}
