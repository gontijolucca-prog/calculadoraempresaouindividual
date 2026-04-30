import React, { createContext, useContext } from 'react';

export type SimMode = 'split';

interface LayoutContextValue {
  layoutIndex: 0;
  layoutName: string;
  simMode: SimMode;
  nextLayout: () => void;
  prevLayout: () => void;
}

const LayoutContext = createContext<LayoutContextValue>({
  layoutIndex: 0,
  layoutName: 'Top Bar Maroon',
  simMode: 'split',
  nextLayout: () => {},
  prevLayout: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <LayoutContext.Provider value={{
      layoutIndex: 0,
      layoutName: 'Top Bar Maroon',
      simMode: 'split',
      nextLayout: () => {},
      prevLayout: () => {},
    }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useTheme() {
  return useContext(LayoutContext);
}
