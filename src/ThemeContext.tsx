import React, { createContext, useContext } from 'react';

/**
 * Modo de layout dos simuladores. Atualmente fixo em 'split' (paneis lado-a-lado).
 * Os simuladores ainda têm ramos para outros modos ('stacked' | 'mosaic' | 'compact' | 'hero')
 * que não são exercitados — quando a feature for retomada, expandir este tipo.
 */
export type SimMode = 'split';

interface LayoutContextValue {
  simMode: SimMode;
}

const LayoutContext = createContext<LayoutContextValue>({ simMode: 'split' });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <LayoutContext.Provider value={{ simMode: 'split' }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useTheme() {
  return useContext(LayoutContext);
}
