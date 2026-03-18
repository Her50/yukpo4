import * as React from "react";
import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet } from '../services/api';

interface TokensBalanceProps {
  showLabel?: boolean;
  style?: any;
}

export const TokensBalance: React.FC<TokensBalanceProps> = ({
  showLabel = true,
  style
}) => {
  const { user, refreshUser } = useAuth();
  const { t } = useLanguageSafe();
  const initialBalance = Number(user?.credits ?? user?.tokens_balance ?? 0);
  const [tokensBalance, setTokensBalance] = React.useState<number | null>(initialBalance || null);
  const [loading, setLoading] = React.useState(false);

  // Synchroniser avec le user context quand il change
  useEffect(() => {
    const b = Number(user?.credits ?? user?.tokens_balance ?? 0);
    if (Number.isFinite(b) && b > 0) setTokensBalance(b);
  }, [user?.credits, user?.tokens_balance]);

  const refreshTokensBalance = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await apiGet('/api/tokens/stats');
      const data = (response as any)?.data || response;
      const balance = data?.current_balance ?? data?.balance ?? data?.tokens_balance;
      if (balance !== undefined && balance !== null) {
        setTokensBalance(Number(balance));
      }
      // Aussi rafraîchir le contexte auth
      if (refreshUser) await refreshUser();
    } catch (error) {
      console.error('Erreur rafraîchissement solde:', error);
    } finally {
      setLoading(false);
    }
  }, [user, refreshUser]);

  useEffect(() => {
    // Rafraîchir le solde périodiquement (toutes les 30 secondes)
    const interval = setInterval(() => {
      if (user) {
        refreshTokensBalance();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [user, refreshTokensBalance]);

  useEffect(() => {
    if (user) {
      refreshTokensBalance();
    }
  }, [user, refreshTokensBalance]);

  if (!user) {
    return null;
  }

  const formatBalance = (balance: number | null) => {
    if (balance === null) return "...";
    return balance.toLocaleString();
  };

  const getBalanceColor = (balance: number | null) => {
    if (balance === null) return styles.balanceGray;
    if (balance <= 10) return styles.balanceRed;
    if (balance <= 50) return styles.balanceOrange;
    return styles.balanceGreen;
  };

  return (
    <View style={[styles.container, style]}>
      {showLabel && (
        <Text style={styles.label}>{t?.('yourBalance') || t('tokensBalance.solde')}:</Text>
      )}
      <View style={styles.balanceContainer}>
        <Text style={[styles.balanceText, getBalanceColor(tokensBalance)]}>
          {formatBalance(tokensBalance)}
        </Text>
        <Text style={styles.currency}>XAF</Text>
      </View>
      <TouchableOpacity
        onPress={refreshTokensBalance}
        style={styles.refreshButton}
        disabled={loading}
      >
        <Text style={styles.refreshIcon}>\uD83D\uDD04</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balanceText: {
    fontWeight: '600',
    fontSize: 16,
  },
  balanceGray: {
    color: '#6B7280',
  },
  balanceRed: {
    color: '#EF4444',
  },
  balanceOrange: {
    color: '#F97316',
  },
  balanceGreen: {
    color: '#10B981',
  },
  currency: {
    fontSize: 12,
    color: '#6B7280',
  },
  refreshButton: {
    padding: 4,
  },
  refreshIcon: {
    fontSize: 16,
  },
});

export default TokensBalance;




