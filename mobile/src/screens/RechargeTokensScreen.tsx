import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import * as React from 'react';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Card, RadioButton, Title } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import ReceiptModal from '../components/ReceiptModal';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../theme/theme';

interface RechargeOption {
  id: string;
  amount: number;
  tokens: number;
  bonus: number;
  popular?: boolean;
  savings?: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  type: 'card' | 'mobile' | 'bank';
  processingTime: string;
  fees: number;
  available: boolean;
  icon: string;
}

const RechargeTokensScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'amount' | 'payment' | 'confirm'>('amount');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  // Options de recharge prédéfinies
  const rechargeOptions: RechargeOption[] = [
    {
      id: 'option1',
      amount: 1000,
      tokens: 200,
      bonus: 0,
    },
    {
      id: 'option2',
      amount: 2500,
      tokens: 500,
      bonus: 50,
      popular: true,
    },
    {
      id: 'option3',
      amount: 5000,
      tokens: 1000,
      bonus: 200,
      savings: 10,
    },
    {
      id: 'option4',
      amount: 10000,
      tokens: 2000,
      bonus: 500,
      savings: 15,
    },
  ];

  // Méthodes de paiement disponibles
  const paymentMethods: PaymentMethod[] = [
    {
      id: 'mobile_money',
      name: 'Mobile Money',
      type: 'mobile',
      processingTime: 'Instantané',
      fees: 0,
      available: true,
      icon: 'phone-portrait',
    },
    {
      id: 'bank_transfer',
      name: 'Virement bancaire',
      type: 'bank',
      processingTime: '1-2 jours',
      fees: 0,
      available: true,
      icon: 'card',
    },
    {
      id: 'credit_card',
      name: 'Carte de crédit',
      type: 'card',
      processingTime: 'Instantané',
      fees: 2.5,
      available: true,
      icon: 'card',
    },
  ];

  const handleRecharge = async () => {
    if (!selectedOption && !customAmount) {
      Alert.alert('Erreur', 'Veuillez sélectionner un montant');
      return;
    }

    if (!selectedPaymentMethod) {
      Alert.alert('Erreur', 'Veuillez sélectionner une méthode de paiement');
      return;
    }

    try {
      setLoading(true);

      const amount = selectedOption
        ? rechargeOptions.find(opt => opt.id === selectedOption)?.amount || 0
        : parseInt(customAmount) || 0;

      // Appel API pour initier le paiement
      const response = await fetch('https://yukpomnang.onrender.com/api/payments/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({
          amount_xaf: amount,
          payment_method: selectedPaymentMethod,
          currency: 'XAF',
          phone_number: selectedPaymentMethod === 'mobile_money' ? user?.phone : null
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de l\'initiation du paiement');
      }

      const paymentData = await response.json();

      // Calculer les tokens et bonus
      const tokens = amount; // 1 XAF = 1 token
      const bonus = amount >= 10000 ? Math.floor(amount * 0.2) :
        amount >= 5000 ? Math.floor(amount * 0.1) :
          amount >= 2000 ? Math.floor(amount * 0.05) : 0;

      // Générer le reçu
      const receipt = {
        id: paymentData.payment_id,
        amount: amount,
        tokens: tokens,
        bonus: bonus,
        paymentMethod: paymentMethods.find(method => method.id === selectedPaymentMethod)?.name || 'Méthode de paiement',
        transactionId: paymentData.payment_id,
        date: new Date().toISOString(),
        status: 'completed' as const,
        instructions: paymentData.instructions
      };

      setReceiptData(receipt);
      setShowReceiptModal(true);

      // Réinitialiser le formulaire
      setSelectedOption(null);
      setCustomAmount('');
      setSelectedPaymentMethod(null);
      setCurrentStep('amount');
    } catch (error) {
      console.error('Erreur paiement:', error);
      const errorMessage = error instanceof Error ? error.message : 'Le paiement a échoué. Veuillez réessayer.';
      Alert.alert('Erreur', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getSelectedAmount = () => {
    if (selectedOption) {
      const option = rechargeOptions.find(opt => opt.id === selectedOption);
      return option?.amount || 0;
    }
    return parseInt(customAmount) || 0;
  };

  const getSelectedTokens = () => {
    if (selectedOption) {
      const option = rechargeOptions.find(opt => opt.id === selectedOption);
      return (option?.tokens || 0) + (option?.bonus || 0);
    }
    return Math.floor((parseInt(customAmount) || 0) / 5); // 1 token = 5 XAF
  };

  const renderAmountStep = () => (
    <View style={styles.stepContainer}>
      <Title style={styles.stepTitle}>Choisissez le montant</Title>

      {/* Options prédéfinies */}
      <View style={styles.optionsContainer}>
        {rechargeOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.optionCard,
              selectedOption === option.id && styles.optionCardSelected,
              option.popular && styles.popularCard,
            ]}
            onPress={() => {
              setSelectedOption(option.id);
              setCustomAmount('');
            }}
          >
            {option.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>Populaire</Text>
              </View>
            )}

            <View style={styles.optionContent}>
              <Text style={styles.optionAmount}>
                {option.amount.toLocaleString()} XAF
              </Text>
              <Text style={styles.optionTokens}>
                {option.tokens} tokens
                {option.bonus > 0 && (
                  <Text style={styles.bonusText}> + {option.bonus} bonus</Text>
                )}
              </Text>
              {option.savings && (
                <Text style={styles.savingsText}>
                  Économisez {option.savings}%
                </Text>
              )}
            </View>

            <RadioButton
              value={option.id}
              status={selectedOption === option.id ? 'checked' : 'unchecked'}
              onPress={() => {
                setSelectedOption(option.id);
                setCustomAmount('');
              }}
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Option personnalisée */}
      <Card style={styles.customCard}>
        <Card.Content>
          <Title style={styles.customTitle}>Montant personnalisé</Title>
          <TextInput
            style={styles.customInput}
            placeholder="Entrez le montant en XAF"
            value={customAmount}
            onChangeText={(text) => {
              setCustomAmount(text);
              setSelectedOption(null);
            }}
            keyboardType="numeric"
          />
          {customAmount && (
            <Text style={styles.customTokens}>
              Vous recevrez {getSelectedTokens()} tokens
            </Text>
          )}
        </Card.Content>
      </Card>

      <TouchableOpacity
        onPress={() => setCurrentStep('payment')}
        disabled={!selectedOption && !customAmount}
        style={styles.nextButton}
      >
        <Text>Continuer</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPaymentStep = () => (
    <View style={styles.stepContainer}>
      <Title style={styles.stepTitle}>Méthode de paiement</Title>

      <View style={styles.paymentMethodsContainer}>
        {paymentMethods.map((method) => (
          <TouchableOpacity
            key={method.id}
            style={[
              styles.paymentCard,
              selectedPaymentMethod === method.id && styles.paymentCardSelected,
            ]}
            onPress={() => setSelectedPaymentMethod(method.id)}
          >
            <View style={styles.paymentContent}>
              <Ionicons
                name={method.icon as any}
                size={24}
                color={theme.colors.primary}
              />
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentName}>{method.name}</Text>
                <Text style={styles.paymentTime}>
                  {method.processingTime}
                  {method.fees > 0 && ` • Frais: ${method.fees}%`}
                </Text>
              </View>
            </View>

            <RadioButton
              value={method.id}
              status={selectedPaymentMethod === method.id ? 'checked' : 'unchecked'}
              onPress={() => setSelectedPaymentMethod(method.id)}
            />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.navigationButtons}>
        <TouchableOpacity
          onPress={() => setCurrentStep('amount')}
          style={styles.backButton}
        >
          <Text>Retour</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setCurrentStep('confirm')}
          disabled={!selectedPaymentMethod}
          style={styles.nextButton}
        >
          <Text>Continuer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderConfirmStep = () => (
    <View style={styles.stepContainer}>
      <Title style={styles.stepTitle}>Confirmation</Title>

      <Card style={styles.confirmCard}>
        <Card.Content>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Montant:</Text>
            <Text style={styles.confirmValue}>
              {getSelectedAmount().toLocaleString()} XAF
            </Text>
          </View>

          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Tokens à recevoir:</Text>
            <Text style={styles.confirmValue}>{getSelectedTokens()}</Text>
          </View>

          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Méthode de paiement:</Text>
            <Text style={styles.confirmValue}>
              {paymentMethods.find(m => m.id === selectedPaymentMethod)?.name}
            </Text>
          </View>

          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>Temps de traitement:</Text>
            <Text style={styles.confirmValue}>
              {paymentMethods.find(m => m.id === selectedPaymentMethod)?.processingTime}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.navigationButtons}>
        <TouchableOpacity
          onPress={() => setCurrentStep('payment')}
          style={styles.backButton}
        >
          <Text>Retour</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleRecharge}
          disabled={loading}
          style={styles.confirmButton}
        >
          <Text>Confirmer le paiement</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Title style={styles.title}>💳 Recharger mes tokens</Title>
          <Text style={styles.subtitle}>
            Solde actuel: {user?.credits?.toLocaleString() || '0'} XAF
          </Text>
        </View>

        {/* Étapes */}
        <View style={styles.stepsIndicator}>
          <View style={[styles.step, currentStep === 'amount' && styles.stepActive]}>
            <Text style={[styles.stepText, currentStep === 'amount' && styles.stepTextActive]}>
              1. Montant
            </Text>
          </View>
          <View style={[styles.step, currentStep === 'payment' && styles.stepActive]}>
            <Text style={[styles.stepText, currentStep === 'payment' && styles.stepTextActive]}>
              2. Paiement
            </Text>
          </View>
          <View style={[styles.step, currentStep === 'confirm' && styles.stepActive]}>
            <Text style={[styles.stepText, currentStep === 'confirm' && styles.stepTextActive]}>
              3. Confirmation
            </Text>
          </View>
        </View>

        {/* Contenu des étapes */}
        {currentStep === 'amount' && renderAmountStep()}
        {currentStep === 'payment' && renderPaymentStep()}
        {currentStep === 'confirm' && renderConfirmStep()}
      </ScrollView>

      {/* Modal de reçu */}
      <ReceiptModal
        visible={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        receiptData={receiptData}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  stepsIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  step: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
  },
  stepActive: {
    borderBottomColor: theme.colors.primary,
  },
  stepText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  stepTextActive: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  optionsContainer: {
    marginBottom: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    position: 'relative',
  },
  optionCardSelected: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  popularCard: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 16,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },
  optionContent: {
    flex: 1,
  },
  optionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  optionTokens: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  bonusText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  savingsText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 4,
  },
  customCard: {
    marginBottom: 20,
    elevation: 2,
  },
  customTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  customInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  customTokens: {
    fontSize: 14,
    color: theme.colors.primary,
    marginTop: 8,
    fontWeight: '500',
  },
  paymentMethodsContainer: {
    marginBottom: 20,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
  },
  paymentCardSelected: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  paymentContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentInfo: {
    marginLeft: 12,
  },
  paymentName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
  },
  paymentTime: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  confirmCard: {
    marginBottom: 20,
    elevation: 2,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  confirmLabel: {
    fontSize: 16,
    color: theme.colors.text,
  },
  confirmValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  backButton: {
    flex: 1,
    marginRight: 8,
  },
  nextButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: theme.colors.primary,
  },
  confirmButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: theme.colors.primary,
  },
});

export default RechargeTokensScreen;



