import * as React from "react";
import { createContext, useContext, ReactNode, useState } from 'react';

interface IAStats {
  totalTokensUsed: number;
  totalRequests: number;
  averageResponseTime: number;
  lastActivity: Date | null;
}

interface GlobalIAStatsContextType {
  stats: IAStats;
  updateStats: (newStats: Partial<IAStats>) => void;
  incrementTokens: (tokens: number) => void;
  incrementRequests: () => void;
  resetStats: () => void;
}

const GlobalIAStatsContext = createContext<GlobalIAStatsContextType | undefined>(undefined);

interface GlobalIAStatsProviderProps {
  children: ReactNode;
}

export const GlobalIAStatsProvider: React.FC<GlobalIAStatsProviderProps> = ({ children }) => {
  const [stats, setStats] = useState<IAStats>({
    totalTokensUsed: 0,
    totalRequests: 0,
    averageResponseTime: 0,
    lastActivity: null,
  });

  const updateStats = (newStats: Partial<IAStats>) => {
    setStats(prev => ({
      ...prev,
      ...newStats,
    }));
  };

  const incrementTokens = (tokens: number) => {
    setStats(prev => ({
      ...prev,
      totalTokensUsed: prev.totalTokensUsed + tokens,
      lastActivity: new Date(),
    }));
  };

  const incrementRequests = () => {
    setStats(prev => ({
      ...prev,
      totalRequests: prev.totalRequests + 1,
      lastActivity: new Date(),
    }));
  };

  const resetStats = () => {
    setStats({
      totalTokensUsed: 0,
      totalRequests: 0,
      averageResponseTime: 0,
      lastActivity: null,
    });
  };

  const value: GlobalIAStatsContextType = {
    stats,
    updateStats,
    incrementTokens,
    incrementRequests,
    resetStats,
  };

  return (
    <GlobalIAStatsContext.Provider value={value}>
      {children}
    </GlobalIAStatsContext.Provider>
  );
};

export const useGlobalIAStats = (): GlobalIAStatsContextType => {
  const context = useContext(GlobalIAStatsContext);
  if (context === undefined) {
    throw new Error('useGlobalIAStats must be used within a GlobalIAStatsProvider');
  }
  return context;
};






