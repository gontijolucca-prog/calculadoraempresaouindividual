import React, { createContext, useContext, useState } from 'react';
import { LAYOUTS } from './Layouts';

export type SimMode = 'split' | 'stacked' | 'mosaic' | 'compact' | 'hero';
const SIM_MODES: SimMode[] = ['split', 'stacked', 'mosaic', 'compact', 'hero'];

interface LayoutContextValue {
  layoutIndex: number;
  layoutName: string;
  simMode: SimMode;
  nextLayout: () => void;
  prevLayout: () => void;
}

const LayoutContext = createContext<LayoutContextValue>({
  layoutIndex: 0,
  layoutName: LAYOUTS[0].name,
  simMode: 'split',
  nextLayout: () => {},
  prevLayout: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [layoutIndex, setLayoutIndex] = useState(0);

  const nextLayout = () => setLayoutIndex(i => (i + 1) % LAYOUTS.length);
  const prevLayout = () => setLayoutIndex(i => (i - 1 + LAYOUTS.length) % LAYOUTS.length);

  return (
    <LayoutContext.Provider value={{
      layoutIndex,
      layoutName: LAYOUTS[layoutIndex].name,
      simMode: SIM_MODES[layoutIndex],
      nextLayout,
      prevLayout,
    }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useTheme() {
  return useContext(LayoutContext);
}
