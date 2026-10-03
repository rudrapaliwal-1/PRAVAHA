import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  OperationalMode,
  ModeContextConfig,
  OPERATIONAL_MODES,
} from '../types/operationalMode';

interface OperationalModeContextType {
  mode: OperationalMode;
  config: ModeContextConfig;
  setMode: (mode: OperationalMode) => void;
  toggleMode: () => void;
  getLocalizedEntityName: (id: string, defaultName?: string) => string;
  getLocalizedSupplyName: (supplyType: string) => string;
}

const OperationalModeContext = createContext<OperationalModeContextType | undefined>(undefined);

const STORAGE_KEY = 'missionpath_operational_mode';

export const OperationalModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<OperationalMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'MILITARY_LOGISTICS' || saved === 'DISASTER_RESPONSE') {
        return saved;
      }
    } catch (e) {
      // Local storage not available
    }
    return 'DISASTER_RESPONSE';
  });

  const setMode = (newMode: OperationalMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch (e) {
      // Ignore storage errors
    }
  };

  const toggleMode = () => {
    setMode(mode === 'DISASTER_RESPONSE' ? 'MILITARY_LOGISTICS' : 'DISASTER_RESPONSE');
  };

  const config = OPERATIONAL_MODES[mode];

  const getLocalizedEntityName = (id: string, defaultName?: string): string => {
    return config.entityNameMap[id] || defaultName || id;
  };

  const getLocalizedSupplyName = (supplyType: string): string => {
    const key = supplyType.toLowerCase();
    return config.supplyNameMap[key] || supplyType;
  };

  return (
    <OperationalModeContext.Provider
      value={{
        mode,
        config,
        setMode,
        toggleMode,
        getLocalizedEntityName,
        getLocalizedSupplyName,
      }}
    >
      {children}
    </OperationalModeContext.Provider>
  );
};

export const useOperationalMode = (): OperationalModeContextType => {
  const context = useContext(OperationalModeContext);
  if (!context) {
    throw new Error('useOperationalMode must be used within an OperationalModeProvider');
  }
  return context;
};
