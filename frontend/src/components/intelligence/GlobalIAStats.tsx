import React, { useState } from 'react';
import IAStatsPanel from '@/components/intelligence/IAStatsPanel';

export const GlobalIAStatsContext = React.createContext({
  confidence: 0,
  tokensUsed: 0, // Tokens OpenAI réels
  tokensFactured: 0, // Tokens facturés par l'application
  isProcessing: false,
  inputLength: 0,
  tokensCostXaf: undefined, // Coût facturé en XAF
  setStats: (_: any) => {},
});

export const GlobalIAStatsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stats, setStats] = useState({
    confidence: 0,
    tokensUsed: 0, // Tokens OpenAI réels
    tokensFactured: 0, // Tokens facturés par l'application
    isProcessing: false,
    inputLength: 0,
    tokensCostXaf: undefined, // Coût facturé en XAF
  });

  // Fonction wrapper pour logger les mises à jour
  const setStatsWithLog = (newStats: any) => {
    console.log('[GlobalIAStats] Mise à jour des statistiques:', newStats);
    console.log('[GlobalIAStats] Anciennes valeurs:', stats);
    console.log('[GlobalIAStats] Changements détectés:', {
      confidence: stats.confidence !== newStats.confidence ? `${stats.confidence} → ${newStats.confidence}` : 'inchangé',
      tokensUsed: stats.tokensUsed !== newStats.tokensUsed ? `${stats.tokensUsed} → ${newStats.tokensUsed}` : 'inchangé',
      tokensCostXaf: stats.tokensCostXaf !== newStats.tokensCostXaf ? `${stats.tokensCostXaf} → ${newStats.tokensCostXaf}` : 'inchangé',
    });
    setStats(newStats);
  };

  return (
    <GlobalIAStatsContext.Provider value={{ ...stats, setStats: setStatsWithLog }}>
      {children}
    </GlobalIAStatsContext.Provider>
  );
};

export const GlobalIAStatsPanel: React.FC = () => {
  const { confidence, tokensUsed, tokensFactured, isProcessing, inputLength, tokensCostXaf } = React.useContext(GlobalIAStatsContext);
  
  // Log des valeurs reçues
  React.useEffect(() => {
    console.log('[GlobalIAStatsPanel] Valeurs reçues:', {
      confidence,
      tokensUsed,
      tokensFactured,
      isProcessing,
      inputLength,
      tokensCostXaf
    });
  }, [confidence, tokensUsed, tokensFactured, isProcessing, inputLength, tokensCostXaf]);

  return (
    <div className="fixed top-24 left-4 z-40">
      <IAStatsPanel
        confidence={confidence}
        tokensUsed={tokensUsed} // Tokens OpenAI réels
        tokensFactured={tokensFactured} // Tokens facturés
        isProcessing={isProcessing}
        inputLength={inputLength}
        tokensCostXaf={tokensCostXaf} // Coût facturé en XAF
        miniMode={true}
      />
    </div>
  );
};
