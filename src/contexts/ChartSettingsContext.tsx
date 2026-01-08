/**
 * Chart Settings Context
 * Global state for chart preferences including:
 * - Time granularity (month/quarter/year)
 * - Period offset (navigation between periods)
 * - Density mode (compact/comfortable)
 */

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";

export type TimeGranularity = 'month' | 'quarter' | 'year';
type DensityMode = 'compact' | 'comfortable';

interface ChartSettingsContextType {
  // Time granularity
  granularity: TimeGranularity;
  setGranularity: (granularity: TimeGranularity) => void;
  
  // Period offset (0 = current, -1 = previous, 1 = next)
  periodOffset: number;
  setPeriodOffset: (offset: number) => void;
  goToPreviousPeriod: () => void;
  goToNextPeriod: () => void;
  goToCurrentPeriod: () => void;
  
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
  periodOffset: 'chart-period-offset',
  density: 'chart-density',
  colorblind: 'chart-colorblind',
} as const;

export const ChartSettingsProvider = ({ children }: { children: ReactNode }) => {
  // Initialize from localStorage with defaults
  const [granularity, setGranularityState] = useState<TimeGranularity>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.granularity);
    return (stored as TimeGranularity) || 'month';
  });

  const [periodOffset, setPeriodOffsetState] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.periodOffset);
    return stored ? parseInt(stored, 10) : 0;
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
    setPeriodOffsetState(0); // Reset offset when changing granularity
    localStorage.setItem(STORAGE_KEYS.granularity, value);
    localStorage.setItem(STORAGE_KEYS.periodOffset, '0');
  }, []);

  const setPeriodOffset = useCallback((offset: number) => {
    setPeriodOffsetState(offset);
    localStorage.setItem(STORAGE_KEYS.periodOffset, String(offset));
  }, []);

  const goToPreviousPeriod = useCallback(() => {
    setPeriodOffsetState(prev => {
      const newOffset = prev - 1;
      localStorage.setItem(STORAGE_KEYS.periodOffset, String(newOffset));
      return newOffset;
    });
  }, []);

  const goToNextPeriod = useCallback(() => {
    setPeriodOffsetState(prev => {
      const newOffset = prev + 1;
      localStorage.setItem(STORAGE_KEYS.periodOffset, String(newOffset));
      return newOffset;
    });
  }, []);

  const goToCurrentPeriod = useCallback(() => {
    setPeriodOffsetState(0);
    localStorage.setItem(STORAGE_KEYS.periodOffset, '0');
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
        periodOffset,
        setPeriodOffset,
        goToPreviousPeriod,
        goToNextPeriod,
        goToCurrentPeriod,
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
      periodOffset: 0,
      setPeriodOffset: () => {},
      goToPreviousPeriod: () => {},
      goToNextPeriod: () => {},
      goToCurrentPeriod: () => {},
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
