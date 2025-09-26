import * as React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Card, Title, Paragraph, Chip, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
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
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: '1',
      type: 'credit',
      amount: 50,
      description: 'Recharge de crédits',
      date: '2024-01-15',
      status: 'completed',
    },
    {
      id: '2',
      type: 'debit',
      amount: 5,
      description: 'Service de plomberie',
      date: '2024-01-14',
      status: 'completed',
    },
    {
      id: '3',
      type: 'debit',
      amount: 10,
      description: 'Service de nettoyage',
      date: '2024-01-13',
      status: 'completed',
    },
    {
      id: '4',
      type: 'credit',
      amount: 25,
      description: 'Bonus de bienvenue',
      date: '2024-01-12',
      status: 'completed',
    },
  ]);

  const currentBalance = 150; // Solde actuel

  const onRefresh = async () => {
    setRefreshing(true);
    // Simuler un appel API
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
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

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header avec solde */}
      <View style={styles.header}>
        <Text style={styles.title}>Historique de Consommation</Text>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Solde Actuel</Text>
          <Text style={styles.balanceAmount}>{currentBalance} crédits</Text>
        </View>
      </View>

      {/* Filtres */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={[styles.filterChip, styles.filterChipActive]}>
            <Text style={styles.filterChipTextActive}>Tous</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterChipText}>Crédits</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterChipText}>Débits</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterChip}>
            <Text style={styles.filterChipText}>Ce mois</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Liste des transactions */}
      <View style={styles.transactionsContainer}>
        <Text style={styles.sectionTitle}>Transactions Récentes</Text>
        {transactions.map((transaction) => (
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
        ))}
      </View>

      {/* Bouton de recharge */}
      <View style={styles.rechargeContainer}>
        <TouchableOpacity
          onPress={() => {
            // Navigation vers la page de recharge
            console.log('Navigation vers recharge');
          }}
          style={styles.rechargeButton}
        >
          <Ionicons name="add-circle" size={20} color="white" />
          <Text>Recharger des Crédits</Text>
        </TouchableOpacity>
      </View>

      {/* Statistiques */}
      <Card style={styles.statsCard}>
        <Card.Content>
          <Title style={styles.statsTitle}>Statistiques du Mois</Title>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>+75</Text>
              <Text style={styles.statLabel}>Crédits reçus</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>-25</Text>
              <Text style={styles.statLabel}>Crédits dépensés</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>8</Text>
              <Text style={styles.statLabel}>Transactions</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    borderRadius: 8,
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



