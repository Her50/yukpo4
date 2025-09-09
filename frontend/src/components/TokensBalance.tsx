import React, { useEffect } from 'react';
import { useUserContext } from '../context/UserContext';

interface TokensBalanceProps {
  showLabel?: boolean;
  className?: string;
}

export const TokensBalance: React.FC<TokensBalanceProps> = ({ 
  showLabel = true, 
  className = "" 
}) => {
  const { user, tokensBalance, refreshTokensBalance } = useUserContext();

  useEffect(() => {
    // Rafraîchir le solde périodiquement (toutes les 30 secondes)
    const interval = setInterval(() => {
      if (user) {
        refreshTokensBalance();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user, refreshTokensBalance]);

  if (!user) {
    return null;
  }

  const formatBalance = (balance: number | null) => {
    if (balance === null) return "...";
    return balance.toLocaleString();
  };

  const getBalanceColor = (balance: number | null) => {
    if (balance === null) return "text-gray-500";
    if (balance <= 10) return "text-red-500";
    if (balance <= 50) return "text-orange-500";
    return "text-green-500";
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {showLabel && (
        <span className="text-sm text-gray-600">Solde:</span>
      )}
      <div className="flex items-center space-x-1">
        <span className={`font-semibold ${getBalanceColor(tokensBalance)}`}>
          {formatBalance(tokensBalance)}
        </span>
        <span className="text-xs text-gray-500">XAF</span>
      </div>
      <button
        onClick={refreshTokensBalance}
        className="text-xs text-blue-500 hover:text-blue-700 ml-1"
        title="Actualiser le solde"
      >
        🔄
      </button>
    </div>
  );
};

export default TokensBalance; 