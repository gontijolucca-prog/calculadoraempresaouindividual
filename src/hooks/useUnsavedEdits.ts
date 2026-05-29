/**
 * Hook to detect unsaved edits in simulators, forms, or contentEditable regions
 *
 * Monitors:
 * - contentEditable changes (LegalInfo, MinutaContrato sections)
 * - Form input changes (modal forms)
 * - Simulator state changes (via beforeunload warning)
 *
 * Returns true if there are unsaved changes that would be lost on reload
 */

import {useCallback, useEffect, useRef} from 'react';

export function useUnsavedEdits() {
  const hasUnsavedRef = useRef(false);

  useEffect(() => {
    // Só conta como "edição por guardar" o que se PERDE num reload: edição inline
    // de documentos (contentEditable — Proposta, Minuta, doc exportado). Os campos
    // normais (perfil, simuladores) são persistidos por cliente, por isso digitar
    // neles NÃO deve impedir a auto-atualização — senão a app nunca se atualizava
    // sozinha depois do primeiro clique. Edição de doc → mostra botão manual.
    const onInput = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (t && t.isContentEditable) hasUnsavedRef.current = true;
    };
    const onBeforeUnload = () => { hasUnsavedRef.current = false; };

    document.addEventListener('input', onInput, true);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('input', onInput, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  return useCallback(() => hasUnsavedRef.current, []);
}
