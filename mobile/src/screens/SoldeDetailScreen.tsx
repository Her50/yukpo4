import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Card, Chip, Title } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { userApi } from '../services/api';
import { theme } from '../theme/theme';

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
}

const SoldeDetailScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedTab, setSelectedTab] = useState<'consumption' | 'payments'>('consumption');
  const currentBalance = user?.credits || 0;

  // Charger les données au montage et quand la période change
  useEffect(() => {
    if (user?.id) {
      loadHistoryData();
    }
  }, [user?.id, selectedPeriod]);

  const loadHistoryData = async () => {
    try {
      setLoading(true);

      // Charger l'historique de consommation
      const consumptionResponse = await userApi.getConsumptionHistory(user!.id, selectedPeriod);
      if (consumptionResponse.success && consumptionResponse.data) {
        const consumptionData = Array.isArray(consumptionResponse.data) ? consumptionResponse.data : [];

        // Convertir en format Transaction
        const consumptionTransactions: Transaction[] = consumptionData.map((item: any, index: number) => ({
          id: `consumption-${index}`,
          type: 'debit',
          amount: item.montant || 0,
          description: item.usage_type || 'Consommation',
          date: item.date || new Date().toISOString(),
          status: 'completed',
        }));

        setTransactions(consumptionTransactions);
      }

      // Charger l'historique des paiements
      const paymentsResponse = await userApi.getPaymentsHistory(user!.id, selectedPeriod);
      if (paymentsResponse.success && paymentsResponse.data) {
        const paymentsData = Array.isArray(paymentsResponse.data) ? paymentsResponse.data : [];
        setPaymentHistory(paymentsData);
      }
    } catch (error) {
      console.error('Erreur chargement historique:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistoryData();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'failed': return '#F44336';
      default: return theme.colors.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Terminé';
      case 'pending': return 'En attente';
      case 'failed': return 'Échoué';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF8C00" />
        <Text style={styles.loadingText}>Chargement de l'historique...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF8C00']} />
      }
    >
      {/* Header avec solde */}
      <View style={styles.header}>
        <Text style={styles.title}>Mon Historique</Text>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Solde Actuel</Text>
          <Text style={styles.balanceAmount}>{currentBalance.toLocaleString()} tokens</Text>
        </View>
      </View>

      {/* Onglets Consommation / Paiements */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'consumption' && styles.tabActive]}
          onPress={() => setSelectedTab('consumption')}
        >
          <Text style={[styles.tabText, selectedTab === 'consumption' && styles.tabTextActive]}>
            Consommation
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'payments' && styles.tabActive]}
          onPress={() => setSelectedTab('payments')}
        >
          <Text style={[styles.tabText, selectedTab === 'payments' && styles.tabTextActive]}>
            Paiements
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filtres de période */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterChip, selectedPeriod === '7d' && styles.filterChipActive]}
            onPress={() => setSelectedPeriod('7d')}
          >
            <Text style={[styles.filterChipText, selectedPeriod === '7d' && styles.filterChipTextActive]}>
              7 jours
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedPeriod === '30d' && styles.filterChipActive]}
            onPress={() => setSelectedPeriod('30d')}
          >
            <Text style={[styles.filterChipText, selectedPeriod === '30d' && styles.filterChipTextActive]}>
              30 jours
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedPeriod === '90d' && styles.filterChipActive]}
            onPress={() => setSelectedPeriod('90d')}
          >
            <Text style={[styles.filterChipText, selectedPeriod === '90d' && styles.filterChipTextActive]}>
              90 jours
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Liste des transactions */}
      <View style={styles.transactionsContainer}>
        <Text style={styles.sectionTitle}>
          {selectedTab === 'consumption' ? 'Historique de Consommation' : 'Historique des Paiements'}
        </Text>

        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>Aucune transaction pour cette période</Text>
          </View>
        ) : (
          transactions.map((transaction) => (
            <Card key={transaction.id} style={styles.transactionCard}>
              <Card.Content style={styles.transactionContent}>
                <View style={styles.transactionLeft}>
                  <View style={[
                    styles.transactionIcon,
                    { backgroundColor: transaction.type === 'credit' ? '#4CAF50' + '20' : '#F44336' + '20' }
                  ]}>
                    <Ionicons
                      name={transaction.type === 'credit' ? 'add-circle' : 'remove-circle'}
                      size={24}
                      color={transaction.type === 'credit' ? '#4CAF50' : '#F44336'}
                    />
                  </View>
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionDescription}>{transaction.description}</Text>
                    <Text style={styles.transactionDate}>{formatDate(transaction.date)}</Text>
                    <Chip
                      style={[styles.statusChip, { backgroundColor: getStatusColor(transaction.status) + '20' }]}
                      textStyle={{ color: getStatusColor(transaction.status), fontSize: 12 }}
                    >
                      {getStatusText(transaction.status)}
                    </Chip>
                  </View>
                </View>
                <View style={styles.transactionRight}>
                  <Text style={[
                    styles.transactionAmount,
                    { color: transaction.type === 'credit' ? '#4CAF50' : '#F44336' }
                  ]}>
                    {transaction.type === 'credit' ? '+' : '-'}{transaction.amount} crédits
                  </Text>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </View>

      {/* Bouton de recharge */}
      <View style={styles.rechargeContainer}>
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('RechargeTokens')}
          style={styles.rechargeButton}
        >
          <Ionicons name="wallet" size={20} color="white" />
          <Text style={styles.rechargeButtonText}>Recharger des Tokens</Text>
        </TouchableOpacity>
      </View>

      {/* Statistiques réelles */}
      {transactions.length > 0 && (
        <Card style={styles.statsCard}>
          <Card.Content>
            <Title style={styles.statsTitle}>Statistiques de la Période</Title>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {transactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + t.amount, 0)}
                </Text>
                <Text style={styles.statLabel}>Tokens reçus</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {transactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + t.amount, 0)}
                </Text>
                <Text style={styles.statLabel}>Tokens dépensés</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{transactions.length}</Text>
                <Text style={styles.statLabel}>Transactions</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginVertical: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#FF8C00',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#FFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  header: {
    backgroundColor: theme.colors.primary,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    paddingTop: 20,
    marginBottom: 20,
  },
  balanceCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    elevation: 3,
  },
  balanceLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 5,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  filtersContainer: {
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  filterChip: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  filterChipTextActive: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  transactionsContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 15,
  },
  transactionCard: {
    marginBottom: 10,
    elevation: 2,
  },
  transactionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 5,
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  rechargeContainer: {
    padding: 20,
  },
  rechargeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF8C00',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    elevation: 4,
  },
  rechargeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  statsCard: {
    margin: 20,
    marginTop: 0,
    elevation: 2,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: theme.colors.text,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 5,
  },
});

export default SoldeDetailScreen;



