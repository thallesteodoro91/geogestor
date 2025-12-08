/**
 * Chart Settings Context
 * Global state for chart preferences including:
 * - Time granularity (month/quarter/year)
 * - Density mode (compact/comfortable)
 * - Colorblind mode
 */

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";

type TimeGranularity = 'month' | 'quarter' | 'year';
type DensityMode = 'compact' | 'comfortable';

interface ChartSettingsContextType {
  // Time granularity
  granularity: TimeGranularity;
  setGranularity: (granularity: TimeGranularity) => void;
  
  // Density mode
  density: DensityMode;
  setDensity: (density: DensityMode) => void;
  toggleDensity: () => void;
  
  // Colorblind mode
  colorblindMode: boolean;
  setColorblindMode: (enabled: boolean) => void;
  toggleColorblindMode: () => void;
}

const ChartSettingsContext = createContext<ChartSettingsContextType | undefined>(undefined);

const STORAGE_KEYS = {
  granularity: 'chart-granularity',
  density: 'chart-density',
  colorblind: 'chart-colorblind',
} as const;

export const ChartSettingsProvider = ({ children }: { children: ReactNode }) => {
  // Initialize from localStorage with defaults
  const [granularity, setGranularityState] = useState<TimeGranularity>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.granularity);
    return (stored as TimeGranularity) || 'month';
  });

  const [density, setDensityState] = useState<DensityMode>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.density);
    return (stored as DensityMode) || 'comfortable';
  });

  const [colorblindMode, setColorblindModeState] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.colorblind);
    return stored === 'true';
  });

  // Persist to localStorage
  const setGranularity = useCallback((value: TimeGranularity) => {
    setGranularityState(value);
    localStorage.setItem(STORAGE_KEYS.granularity, value);
  }, []);

  const setDensity = useCallback((value: DensityMode) => {
    setDensityState(value);
    localStorage.setItem(STORAGE_KEYS.density, value);
  }, []);

  const setColorblindMode = useCallback((value: boolean) => {
    setColorblindModeState(value);
    localStorage.setItem(STORAGE_KEYS.colorblind, String(value));
  }, []);

  const toggleDensity = useCallback(() => {
    setDensity(density === 'compact' ? 'comfortable' : 'compact');
  }, [density, setDensity]);

  const toggleColorblindMode = useCallback(() => {
    setColorblindMode(!colorblindMode);
  }, [colorblindMode, setColorblindMode]);

  // Apply density class to body
  useEffect(() => {
    document.body.classList.remove('density-compact', 'density-comfortable');
    document.body.classList.add(`density-${density}`);
  }, [density]);

  return (
    <ChartSettingsContext.Provider
      value={{
        granularity,
        setGranularity,
        density,
        setDensity,
        toggleDensity,
        colorblindMode,
        setColorblindMode,
        toggleColorblindMode,
      }}
    >
      {children}
    </ChartSettingsContext.Provider>
  );
};

export const useChartSettings = (): ChartSettingsContextType => {
  const context = useContext(ChartSettingsContext);
  if (!context) {
    // Return default values when used outside provider
    return {
      granularity: 'month',
      setGranularity: () => {},
      density: 'comfortable',
      setDensity: () => {},
      toggleDensity: () => {},
      colorblindMode: false,
      setColorblindMode: () => {},
      toggleColorblindMode: () => {},
    };
  }
  return context;
};
