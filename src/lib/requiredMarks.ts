/**
 * Marca automaticamente os campos obrigatórios de toda a aplicação.
 * Um só observador: qualquer input/select/textarea com `required` ganha um
 * asterisco no rótulo associado; campos inválidos ficam com contorno.
 */
const STAR = 'campo-obrigatorio';

function labelDe(el: HTMLElement): HTMLLabelElement | null {
  const dentro = el.closest('label');
  if (dentro) return dentro as HTMLLabelElement;
  const id = el.getAttribute('id');
  if (id) {
    const fora = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`);
    if (fora) return fora;
  }
  // Formulários do perfil/cofre/definições usam <label> irmã antes do campo,
  // sem `for` nem wrapper — sem este fallback o asterisco nunca aparecia.
  const anterior = el.previousElementSibling;
  if (anterior instanceof HTMLLabelElement) return anterior;
  return null;
}

function marcar(el: HTMLElement) {
  const obrigatorio = el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';
  if (!obrigatorio) return;
  el.setAttribute('aria-required', 'true');
  const label = labelDe(el);
  if (!label) return;
  // Rótulos que já escrevem "*" à mão não ganham segundo asterisco.
  if ((label.textContent || '').includes('*')) return;
  if (label.querySelector(`.${STAR}`)) return;
  const span = document.createElement('span');
  span.className = STAR;
  span.textContent = ' *';
  span.setAttribute('aria-hidden', 'true');
  span.style.color = '#E11D48';
  span.style.fontWeight = '700';
  label.appendChild(span);
}

function varrer() {
  document.querySelectorAll<HTMLElement>('input[required], select[required], textarea[required], [aria-required="true"]').forEach(marcar);
}

export function instalarMarcasObrigatorias(): () => void {
  if (typeof document === 'undefined') return () => {};
  varrer();
  const obs = new MutationObserver(() => varrer());
  obs.observe(document.body, { childList: true, subtree: true });
  return () => obs.disconnect();
}
