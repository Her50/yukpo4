// @ts-nocheck
import { useFocusEffect, useNavigation } from '@react-navigation/native'; // ? Pour rafra�chir au retour sur l'�cran
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { userApi } from '../services/api';
import { theme } from '../theme/theme';

type UsageLog = {
  date: string;
  usage_type: string;
  montant: number;
  moteur: string;
  service_id?: string;
  service_title?: string;
  payment_method?: string;
  transaction_id?: string;
};

type PaymentLog = {
  id: string;
  date: string;
  amount: number;
  payment_method: string;
  status: 'completed' | 'pending' | 'failed';
  transaction_id: string;
  tokens_added: number;
};

const SoldeDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, refreshUser } = useAuth(); // ? Ajout de refreshUser
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLog[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedTab, setSelectedTab] = useState<'consumption' | 'payments'>('consumption');
  const [loading, setLoading] = useState(false);

  // R�cup�rer le solde actuel
  const getCurrentBalance = () => {
    if (user?.credits) {
      return user.credits;
    }
    return 0;
  };

  const currentBalance = getCurrentBalance();

  useEffect(() => {
    if (!user?.id) return;
    loadData();
  }, [user, selectedPeriod]);

  // ? NOUVEAU: Rafra�chir les donn�es quand on revient sur l'�cran
  useFocusEffect(
    React.useCallback(() => {
      console.log('[SoldeDetailScreen] ?? �cran focus - Rafra�chissement des donn�es...');
      if (user?.id) {
        // Rafra�chir le solde utilisateur
        refreshUser().catch(err => {
          console.error('[SoldeDetailScreen] Erreur rafra�chissement solde:', err);
        });
        // Recharger les logs
        loadData();
      }
    }, [user?.id])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      // Charger l'historique de consommation
      const consumptionResponse = await userApi.getCreditHistory(user.id, selectedPeriod);
      console.log('[SoldeDetailScreen] R�ponse consommation:', consumptionResponse);

      // ? Adapter le format des donn�es backend vers le format mobile
      if (consumptionResponse.success && consumptionResponse.data) {
        const history = consumptionResponse.data.history || consumptionResponse.data;
        if (Array.isArray(history)) {
          // ? Mapping corrig� selon la structure r�elle du backend:
          // Backend retourne: { id, date, service, amount, type, description }
          const mappedLogs = history.map((item: any) => ({
            date: item.date,                    // ? D�j� format� par le backend
            usage_type: item.description,       // ? Description de la consommation
            montant: item.amount,               // ? Montant consomm�
            moteur: item.type,                  // ? Type: "consumption" ou "recharge"
            service_id: item.id,                // ? ID de l'entr�e
            service_title: item.service         // ? Nom du service
          }));
          console.log('[SoldeDetailScreen] Logs mapp�s:', mappedLogs);
          setLogs(mappedLogs);
        } else {
          setLogs([]);
        }
      } else {
        setLogs([]);
      }

      // Charger l'historique des paiements
      const paymentsResponse = await userApi.getPaymentsHistory(user.id, selectedPeriod);
      console.log('[SoldeDetailScreen] R�ponse paiements:', paymentsResponse);

      // ? Adapter le format des donn�es backend vers le format mobile
      if (paymentsResponse.success && paymentsResponse.data) {
        const payments = paymentsResponse.data.payments || paymentsResponse.data;
        if (Array.isArray(payments)) {
          // ? Mapping corrig� selon la structure r�elle du backend:
          // Backend retourne: { id, date, amount, payment_method, status, transaction_id, description }
          const mappedPayments = payments.map((item: any) => ({
            id: item.id,                                // ? ID du paiement
            date: item.date,                            // ? D�j� format� par le backend
            amount: item.amount,                        // ? Montant pay� en FCFA
            payment_method: item.payment_method,        // ? M�thode de paiement
            status: item.status,                        // ? Statut: completed/pending/failed
            transaction_id: item.transaction_id || '',  // ? ID de transaction (optionnel)
            tokens_added: item.amount                   // ? Tokens = montant (1 FCFA = 1 token)
          }));
          console.log('[SoldeDetailScreen] Paiements mapp�s:', mappedPayments);
          setPaymentLogs(mappedPayments);
        } else {
          setPaymentLogs([]);
        }
      } else {
        setPaymentLogs([]);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des donn�es:', error);
      setLogs([]);
      setPaymentLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF'
    }).format(amount);
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'orange_money':
        return '🟠';
      case 'mtn_money':
        return '🟡';
      case 'visa_card':
      case 'mastercard':
        return '💳';
      default:
        return '💰';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10B981';
      case 'pending': return '#F59E0B';
      case 'failed': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const totalConsumed = logs.reduce((sum, log) => sum + (log.montant || 0), 0);
  const totalPaid = paymentLogs.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  const totalTokensAdded = paymentLogs.reduce((sum, payment) => sum + (payment.tokens_added || 0), 0);

  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      <Text style={styles.periodLabel}>P�riode:</Text>
      <View style={styles.periodButtons}>
        {[
          { key: '7d', label: '7j' },
          { key: '30d', label: '30j' },
          { key: '90d', label: '90j' },
          { key: 'all', label: 'Tout' }
        ].map((period) => (
          <TouchableOpacity
            key={period.key}
            style={[
              styles.periodButton,
              selectedPeriod === period.key && styles.periodButtonActive
            ]}
            onPress={() => setSelectedPeriod(period.key as any)}
          >
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === period.key && styles.periodButtonTextActive
            ]}>
              {period.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderTabSelector = () => (
    <View style={styles.tabSelector}>
      <TouchableOpacity
        style={[styles.tabButton, selectedTab === 'consumption' && styles.tabButtonActive]}
        onPress={() => setSelectedTab('consumption')}
      >
        <Text style={styles.tabIcon}>?</Text>
        <Text style={[styles.tabText, selectedTab === 'consumption' && styles.tabTextActive]}>
          Consommation
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabButton, selectedTab === 'payments' && styles.tabButtonActive]}
        onPress={() => setSelectedTab('payments')}
      >
        <Text style={styles.tabIcon}>??</Text>
        <Text style={[styles.tabText, selectedTab === 'payments' && styles.tabTextActive]}>
          Paiements
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderConsumptionTab = () => (
    <View style={styles.tabContent}>
      {/* Statistiques */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>??</Text>
          <Text style={styles.statValue}>{formatCurrency(totalConsumed)}</Text>
          <Text style={styles.statLabel}>Total consomm�</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>??</Text>
          <Text style={styles.statValue}>{logs.length}</Text>
          <Text style={styles.statLabel}>Utilisations</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>??</Text>
          <Text style={styles.statValue}>
            {logs.length > 0 ? formatCurrency(totalConsumed / logs.length) : '0 FCFA'}
          </Text>
          <Text style={styles.statLabel}>Moyenne</Text>
        </View>
      </View>

      {/* Liste des utilisations */}
      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>D�tail des utilisations Yukpo</Text>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        ) : logs.length > 0 ? (
          logs.map((log, index) => (
            <View key={index} style={styles.logItem}>
              <View style={styles.logIcon}>
                <Text style={styles.logIconText}>?</Text>
              </View>
              <View style={styles.logContent}>
                <Text style={styles.logTitle}>{log.usage_type}</Text>
                <Text style={styles.logSubtitle}>{log.moteur}</Text>
                {log.service_title && (
                  <Text style={styles.logService}>Service: {log.service_title}</Text>
                )}
                <Text style={styles.logDate}>
                  {new Date(log.date).toLocaleDateString('fr-FR')}
                </Text>
              </View>
              <View style={styles.logAmount}>
                <Text style={styles.logAmountText}>-{formatCurrency(log.montant || 0)}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>?</Text>
            <Text style={styles.emptyText}>Aucune utilisation Yukpo enregistr�e</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderPaymentsTab = () => (
    <View style={styles.tabContent}>
      {/* Statistiques */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>??</Text>
          <Text style={styles.statValue}>{formatCurrency(totalPaid)}</Text>
          <Text style={styles.statLabel}>Total pay�</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>??</Text>
          <Text style={styles.statValue}>{totalTokensAdded.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Tokens ajout�s</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>??</Text>
          <Text style={styles.statValue}>{paymentLogs.length}</Text>
          <Text style={styles.statLabel}>Transactions</Text>
        </View>
      </View>

      {/* Liste des paiements */}
      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>Historique des paiements</Text>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        ) : paymentLogs.length > 0 ? (
          paymentLogs.map((payment) => (
            <View key={payment.id} style={styles.logItem}>
              <View style={styles.logIcon}>
                <Text style={styles.logIconText}>{getPaymentMethodIcon(payment.payment_method)}</Text>
              </View>
              <View style={styles.logContent}>
                <Text style={styles.logTitle}>{payment.payment_method}</Text>
                <Text style={styles.logSubtitle}>ID: {payment.transaction_id}</Text>
                <Text style={styles.logService}>+{(payment.tokens_added || 0).toLocaleString()} tokens</Text>
                <Text style={styles.logDate}>
                  {new Date(payment.date).toLocaleDateString('fr-FR')}
                </Text>
              </View>
              <View style={styles.logAmount}>
                <Text style={[styles.logAmountText, { color: '#10B981' }]}>
                  +{formatCurrency(payment.amount || 0)}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(payment.status) }]}>
                  <Text style={styles.statusText}>{payment.status}</Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>??</Text>
            <Text style={styles.emptyText}>Aucun paiement enregistr�</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Historique de Consommation</Text>
        </View>

        {/* Solde actuel */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceContent}>
            <View style={styles.balanceLeft}>
              <Text style={styles.balanceLabel}>Solde actuel</Text>
              <Text style={styles.balanceValue}>
                {currentBalance.toFixed(0)} FCFA
              </Text>
            </View>
            <View style={styles.balanceRight}>
              <Text style={styles.balanceSubLabel}>Total consomm�</Text>
              <Text style={styles.balanceSubValue}>
                {formatCurrency(totalConsumed)}
              </Text>
            </View>
          </View>

          {/* ? Bouton Recharger Tokens - Bien visible */}
          <TouchableOpacity
            style={styles.rechargeButton}
            onPress={() => (navigation as any).navigate('RechargeTokens')}
          >
            <Text style={styles.rechargeIcon}>??</Text>
            <Text style={styles.rechargeText}>Recharger tokens</Text>
            <Text style={styles.rechargeArrow}>?</Text>
          </TouchableOpacity>
        </View>

        {/* S�lecteur de p�riode */}
        {renderPeriodSelector()}

        {/* S�lecteur d'onglets */}
        {renderTabSelector()}

        {/* Contenu des onglets */}
        {selectedTab === 'consumption' ? renderConsumptionTab() : renderPaymentsTab()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  balanceCard: {
    margin: 20,
    marginTop: 0,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLeft: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#10B981',
  },
  balanceRight: {
    alignItems: 'flex-end',
  },
  balanceSubLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  balanceSubValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#EF4444',
  },
  periodSelector: {
    margin: 20,
    marginTop: 0,
  },
  periodLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
  },
  periodButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  periodButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  periodButtonText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  periodButtonTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  tabSelector: {
    flexDirection: 'row',
    margin: 20,
    marginTop: 0,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  tabButtonActive: {
    backgroundColor: theme.colors.primary,
  },
  tabIcon: {
    fontSize: 16,
  },
  tabText: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '500',
  },
  tabTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    margin: 20,
    marginTop: 0,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  listContainer: {
    margin: 20,
    marginTop: 0,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: theme.colors.textSecondary,
  },
  logItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logIconText: {
    fontSize: 18,
  },
  logContent: {
    flex: 1,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  logSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 2,
  },
  logService: {
    fontSize: 12,
    color: '#3B82F6',
    marginBottom: 2,
  },
  logDate: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  logAmount: {
    alignItems: 'flex-end',
  },
  logAmountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  // ? Styles pour le bouton Recharger Tokens
  rechargeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  rechargeIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  rechargeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#D97706',
    flex: 1,
  },
  rechargeArrow: {
    fontSize: 18,
    color: '#D97706',
    fontWeight: 'bold',
  },
});

export default SoldeDetailScreen;
