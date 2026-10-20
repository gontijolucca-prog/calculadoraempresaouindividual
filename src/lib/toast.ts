/** Toast global — um só sítio mostra as mensagens (Gabinete monta o <ToastHost />). */
export type ToastKind = 'ok' | 'erro' | 'info';

export interface ToastPayload { msg: string; kind: ToastKind }

export const TOAST_EVENT = 'estudo360:toast';

export function toast(msg: string, kind: ToastKind = 'ok'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: { msg, kind } }));
}
