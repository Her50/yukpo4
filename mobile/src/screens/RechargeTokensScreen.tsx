// @ts-nocheck
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as React from 'react';
import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Card, RadioButton, Title } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import NavigatorToolbar from '../components/NavigatorToolbar';
import PaymentMethodPrompt from '../components/PaymentMethodPrompt';
import ReceiptModal from '../components/ReceiptModal';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { usePaymentMethodCheck } from '../hooks/usePaymentMethodCheck';
import useUserCountry from '../hooks/useUserCountry';
import { apiGet, apiPost } from '../services/api';
import { theme } from '../theme/theme';

// Mapping pays → devise (miroir du backend payment_aggregator.rs::currency_for_country)
const currencyForCountry = (code: string): { currency: string; symbol: string } => {
  const map: Record<string, { currency: string; symbol: string }> = {
    CM: { currency: 'XAF', symbol: 'FCFA' }, GA: { currency: 'XAF', symbol: 'FCFA' },
    CG: { currency: 'XAF', symbol: 'FCFA' }, CF: { currency: 'XAF', symbol: 'FCFA' },
    TD: { currency: 'XAF', symbol: 'FCFA' }, GQ: { currency: 'XAF', symbol: 'FCFA' },
    SN: { currency: 'XOF', symbol: 'FCFA' }, CI: { currency: 'XOF', symbol: 'FCFA' },
    ML: { currency: 'XOF', symbol: 'FCFA' }, BF: { currency: 'XOF', symbol: 'FCFA' },
    NE: { currency: 'XOF', symbol: 'FCFA' }, TG: { currency: 'XOF', symbol: 'FCFA' },
    BJ: { currency: 'XOF', symbol: 'FCFA' }, GW: { currency: 'XOF', symbol: 'FCFA' },
    NG: { currency: 'NGN', symbol: '₦' }, GH: { currency: 'GHS', symbol: 'GH₵' },
    KE: { currency: 'KES', symbol: 'KSh' }, TZ: { currency: 'TZS', symbol: 'TSh' },
    UG: { currency: 'UGX', symbol: 'USh' }, RW: { currency: 'RWF', symbol: 'FRw' },
    ZA: { currency: 'ZAR', symbol: 'R' }, CD: { currency: 'CDF', symbol: 'FC' },
    ET: { currency: 'ETB', symbol: 'Br' }, MG: { currency: 'MGA', symbol: 'Ar' },
    MA: { currency: 'MAD', symbol: 'DH' }, DZ: { currency: 'DZD', symbol: 'DA' },
    TN: { currency: 'TND', symbol: 'DT' }, EG: { currency: 'EGP', symbol: 'E£' },
  };
  return map[code?.toUpperCase()] || { currency: 'XAF', symbol: 'FCFA' };
};

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
  const route = useRoute<any>();
  const { user, refreshUser } = useAuth();
  const { t } = useLanguageSafe();
  const { countryCode, isLoading: isCountryLoading } = useUserCountry();
  const userCurrency = currencyForCountry(countryCode);

  const returnTo = route.params?.returnTo as string | undefined;
  const returnParams = route.params?.returnParams as Record<string, any> | undefined;
  const debtAmount = route.params?.debtAmount as number | undefined;
  const debtCount = route.params?.debtCount as number | undefined;
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'amount' | 'payment' | 'confirm'>('amount');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'awaiting' | 'success' | 'failed'>('idle');

  // Options de recharge prédéfinies
  // Bonus tiers match backend payment_service.rs::add_tokens_to_user
  // ≥10000 → 20%, ≥5000 → 10%, ≥2000 → 5%, else 0%
  const rechargeOptions: RechargeOption[] = [
    {
      id: 'option1',
      amount: 1000,
      tokens: 1000,
      bonus: 0,
    },
    {
      id: 'option2',
      amount: 2500,
      tokens: 2500,
      bonus: 125,
      popular: true,
      savings: 5,
    },
    {
      id: 'option3',
      amount: 5000,
      tokens: 5000,
      bonus: 500,
      savings: 10,
    },
    {
      id: 'option4',
      amount: 10000,
      tokens: 10000,
      bonus: 2000,
      savings: 20,
    },
  ];

  // All available payment methods (Africa-wide + international)
  const paymentMethods: PaymentMethod[] = [
    // ── Mobile Money Afrique ──
    {
      id: 'mtn_momo',
      name: t('payment.mobile_money') || 'MTN Mobile Money',
      type: 'mobile',
      processingTime: t('rechargeScreen.instant') || 'Instant',
      fees: 0,
      available: true,
      icon: 'phone-portrait',
    },
    {
      id: 'orange_money',
      name: t('payment.orange_money') || 'Orange Money',
      type: 'mobile',
      processingTime: t('rechargeScreen.instant') || 'Instant',
      fees: 0,
      available: true,
      icon: 'phone-portrait',
    },
    {
      id: 'wave',
      name: t('payment.wave') || 'Wave',
      type: 'mobile',
      processingTime: t('rechargeScreen.instant') || 'Instant',
      fees: 0,
      available: true,
      icon: 'phone-portrait',
    },
    {
      id: 'moov_money',
      name: t('payment.moov_money') || 'Moov Money',
      type: 'mobile',
      processingTime: t('rechargeScreen.instant') || 'Instant',
      fees: 0,
      available: true,
      icon: 'phone-portrait',
    },
    {
      id: 'airtel_money',
      name: t('payment.airtel_money') || 'Airtel Money',
      type: 'mobile',
      processingTime: t('rechargeScreen.instant') || 'Instant',
      fees: 0,
      available: true,
      icon: 'phone-portrait',
    },
    {
      id: 'mpesa',
      name: t('payment.mpesa') || 'M-Pesa',
      type: 'mobile',
      processingTime: t('rechargeScreen.instant') || 'Instant',
      fees: 0,
      available: true,
      icon: 'phone-portrait',
    },
    {
      id: 'vodafone_cash',
      name: t('payment.vodafone_cash') || 'Vodafone Cash',
      type: 'mobile',
      processingTime: t('rechargeScreen.instant') || 'Instant',
      fees: 0,
      available: true,
      icon: 'phone-portrait',
    },
    {
      id: 'free_money',
      name: t('payment.free_money') || 'Free Money',
      type: 'mobile',
      processingTime: t('rechargeScreen.instant') || 'Instant',
      fees: 0,
      available: true,
      icon: 'phone-portrait',
    },
    {
      id: 'tigo_pesa',
      name: t('payment.tigo_pesa') || 'Tigo Pesa',
      type: 'mobile',
      processingTime: t('rechargeScreen.instant') || 'Instant',
      fees: 0,
      available: true,
      icon: 'phone-portrait',
    },
    {
      id: 'ecocash',
      name: t('payment.ecocash') || 'EcoCash',
      type: 'mobile',
      processingTime: t('rechargeScreen.instant') || 'Instant',
      fees: 0,
      available: true,
      icon: 'phone-portrait',
    },
    // ── Cartes (CinetPay Afrique + Stripe international) ──
    {
      id: 'visa',
      name: t('payment.visa') || 'Visa / Mastercard',
      type: 'card',
      processingTime: t('rechargeScreen.instant') || 'Instant',
      fees: 0,
      available: true,
      icon: 'card',
    },
    // ── International ──
    {
      id: 'stripe',
      name: t('payment.stripe_card') || 'Visa / Mastercard / Amex (International)',
      type: 'card',
      processingTime: t('rechargeScreen.instant') || 'Instant',
      fees: 0,
      available: true,
      icon: 'card',
    },
    {
      id: 'paypal',
      name: t('payment.paypal') || 'PayPal',
      type: 'card',
      processingTime: t('rechargeScreen.instant') || 'Instant',
      fees: 0,
      available: true,
      icon: 'logo-paypal',
    },
    {
      id: 'bank_transfer',
      name: t('rechargeScreen.bankTransfer') || 'Virement bancaire',
      type: 'bank',
      processingTime: '1-2 ' + (t('rechargeScreen.days') || 'jours'),
      fees: 0,
      available: true,
      icon: 'business',
    },
  ];

  const MIN_RECHARGE_XAF = 1000;

  // ── Enforcement dette: montant minimum = dette cumulée ──
  const hasDebt = (debtAmount ?? 0) > 0;
  const minimumRechargeAmount = hasDebt ? Math.max(debtAmount!, MIN_RECHARGE_XAF) : MIN_RECHARGE_XAF;

  // Pre-select the option that covers the debt
  React.useEffect(() => {
    if (hasDebt && !selectedOption) {
      const coveringOption = rechargeOptions.find(opt => opt.amount >= minimumRechargeAmount);
      if (coveringOption) {
        setSelectedOption(coveringOption.id);
      } else {
        setCustomAmount(String(minimumRechargeAmount));
      }
    }
  }, [hasDebt, minimumRechargeAmount]);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
  const paymentCheck = usePaymentMethodCheck();

  // Filtrage des moyens de paiement mobiles selon le pays (GPS / profil)
  const [mobilePaymentIdsForCountry, setMobilePaymentIdsForCountry] = useState<string[]>(['mtn_momo', 'orange_money']);

  // Charger les moyens de paiement sauvegardés au montage et pré-remplir le numéro
  React.useEffect(() => {
    paymentCheck.fetchPaymentMethods().then((info) => {
      if (info.mtn_phone && !phoneNumber) {
        setPhoneNumber(info.mtn_phone.replace(/[^\d]/g, ''));
      } else if (info.orange_phone && !phoneNumber) {
        setPhoneNumber(info.orange_phone.replace(/[^\d]/g, ''));
      }
    });
  }, []);

  React.useEffect(() => {
    if (isCountryLoading) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await apiGet<any>('/methods');
        // NOTE: certains endpoints backend sont enveloppés (success + data), selon apiCall/apiGet.
        const payload = response?.data ?? response;
        const serverData = payload?.success === true && payload?.data ? payload.data : payload;

        const c = String(countryCode ?? '').toUpperCase();
        const mobile = serverData?.mobile_money ?? {};

        const allowed: string[] = [];
        if (Array.isArray(mobile?.orange_money?.countries) && mobile.orange_money.countries.includes(c)) {
          allowed.push('orange_money');
        }
        if (Array.isArray(mobile?.mtn_money?.countries) && mobile.mtn_money.countries.includes(c)) {
          allowed.push('mtn_momo');
        }

        if (!cancelled) {
          setMobilePaymentIdsForCountry(allowed);
        }
      } catch (e) {
        console.warn('[RechargeTokensScreen] Failed to fetch payment methods availability:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [countryCode, isCountryLoading]);

  // Si l'utilisateur avait sélectionné un moyen mobile qui n'est plus autorise pour le pays,
  // on le deselecctionne pour empecher un echec de paiement.
  React.useEffect(() => {
    if (!selectedPaymentMethod) return;
    const selectedId = selectedPaymentMethod;
    const isMobileSelected = [
      'mtn_momo',
      'orange_money',
      'wave',
      'moov_money',
      'airtel_money',
      'mpesa',
      'vodafone_cash',
      'free_money',
      'tigo_pesa',
      'ecocash',
    ].includes(selectedId);

    if (isMobileSelected && !mobilePaymentIdsForCountry.includes(selectedId)) {
      setSelectedPaymentMethod(null);
    }
  }, [mobilePaymentIdsForCountry, selectedPaymentMethod]);

  const handleRecharge = async () => {
    if (!selectedOption && !customAmount) {
      Alert.alert(
        t('rechargeScreen.errorTitle') || 'Erreur',
        t('rechargeScreen.errorSelectAmount') || t('rechargeTokens.veuillezSelectionnerUnMontant')
      );
      return;
    }

    // Enforce minimum amount (montant libre compris)
    const chosenAmount = selectedOption
      ? rechargeOptions.find(opt => opt.id === selectedOption)?.amount || 0
      : parseInt(customAmount) || 0;

    if (chosenAmount < minimumRechargeAmount) {
      if (hasDebt) {
        Alert.alert(
          t('rechargeScreen.debtMinimumTitle') || 'Montant insuffisant',
          (t('rechargeScreen.debtMinimumMsg') ||
            'Vous avez une dette de {{debt}} XAF. Le montant minimum de recharge est de {{minimum}} XAF pour couvrir votre dette. Nous vous encourageons à recharger davantage pour une utilisation confortable.')
            .replace('{{debt}}', String(debtAmount))
            .replace('{{minimum}}', String(minimumRechargeAmount))
        );
      } else {
        Alert.alert(
          t('rechargeScreen.errorTitle') || 'Erreur',
          `Le montant minimum de recharge est de ${minimumRechargeAmount} ${userCurrency.symbol}.`
        );
      }
      return;
    }

    if (!selectedPaymentMethod) {
      Alert.alert(
        t('rechargeScreen.errorTitle') || 'Erreur',
        t('rechargeScreen.errorSelectMethod') || t('rechargeTokens.veuillezSelectionnerUneMethodeDe')
      );
      return;
    }

    // Validation numéro pour Mobile Money (all African providers)
    const mobileMoneyProviders = [
      'mtn_momo', 'orange_money', 'wave', 'moov_money',
      'airtel_money', 'mpesa', 'vodafone_cash', 'free_money'
    ];
    const isMobileMoney = mobileMoneyProviders.includes(selectedPaymentMethod);
    if (isMobileMoney && (!phoneNumber || phoneNumber.length < 9)) {
      Alert.alert(
        t('rechargeScreen.errorTitle') || 'Erreur',
        t('rechargeScreen.errorPhone') || t('rechargeTokens.veuillezEntrerUnNumeroDe')
      );
      return;
    }

    try {
      setLoading(true);
      setPaymentStatus('processing');

      const amount = selectedOption
        ? rechargeOptions.find(opt => opt.id === selectedOption)?.amount || 0
        : parseInt(customAmount) || 0;

      // Appel API via l'agrégateur (CinetPay/NotchPay)
      const response = await apiPost('/api/payments/initiate', {
        amount_xaf: amount,
        payment_method: selectedPaymentMethod,
        currency: userCurrency.currency,
        phone_number: isMobileMoney ? phoneNumber : undefined,
      });

      const paymentData = (response as any)?.data || response;

      if (!paymentData?.payment_id) {
        throw new Error(paymentData?.message || t('rechargeScreen.failedMessage') || t('rechargeTokens.erreurLorsDeLaRecharge'));
      }

      // Si l'agrégateur retourne une URL de paiement (cartes, certains Mobile Money)
      if (paymentData.payment_url) {
        setPaymentStatus('awaiting');
        // Ouvrir la page de paiement sécurisée de l'agrégateur
        const canOpen = await Linking.canOpenURL(paymentData.payment_url);
        if (canOpen) {
          await Linking.openURL(paymentData.payment_url);
        } else {
          Alert.alert(
            t('payment.title') || 'Paiement',
            (t('rechargeScreen.openBrowser') || 'Ouvrez ce lien pour payer') + ':\n' + paymentData.payment_url
          );
        }

        // Informer l'utilisateur
        Alert.alert(
          t('rechargeScreen.awaitingTitle') || 'Paiement en cours',
          paymentData.instructions || t('rechargeScreen.awaitingMessage') || t('rechargeTokens.validezLePaiementVosTokens'),
          [
            {
              text: t('rechargeScreen.checkStatus') || t('rechargeTokens.verifierLeStatut'),
              onPress: () => pollPaymentStatus(paymentData.payment_id)
            },
            { text: 'OK' }
          ]
        );
      } else {
        // Mobile Money direct — l'utilisateur confirme sur son téléphone
        setPaymentStatus('awaiting');
        Alert.alert(
          t('rechargeScreen.awaitingTitle') || 'Paiement en cours',
          paymentData.instructions || t('rechargeScreen.confirmPhone') || t('rechargeTokens.confirmezLePaiementSurVotre'),
          [
            {
              text: t('rechargeScreen.checkStatus') || t('rechargeTokens.verifierLeStatut'),
              onPress: () => pollPaymentStatus(paymentData.payment_id)
            },
            { text: 'OK' }
          ]
        );
      }

      // Générer le reçu provisoire
      const receipt = {
        id: paymentData.payment_id,
        amount: amount,
        tokens: amount, // 1:1, le bonus sera calculé côté serveur
        bonus: 0,
        paymentMethod: paymentMethods.find(method => method.id === selectedPaymentMethod)?.name || '',
        transactionId: paymentData.payment_id,
        date: new Date().toISOString(),
        status: 'pending' as const,
        instructions: paymentData.instructions,
      };

      setReceiptData(receipt);
      setShowReceiptModal(true);

    } catch (error) {
      console.error('Erreur paiement:', error);
      setPaymentStatus('failed');
      const errorMessage = error instanceof Error ? error.message : (t('rechargeScreen.failedMessage') || t('rechargeTokens.lePaiementAEchoueVeuillez'));
      Alert.alert(t('rechargeScreen.failedTitle') || 'Erreur', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Vérifier le statut du paiement (polling)
  const pollPaymentStatus = useCallback(async (paymentId: string) => {
    try {
      setLoading(true);
      // Appeler l'endpoint de vérification du statut
      const response = await apiPost('/api/payments/confirm', {
        payment_id: paymentId,
        status: 'check',
      });

      const data = (response as any)?.data || response;
      if (data?.success && data?.tokens_added) {
        setPaymentStatus('success');
        // Rafraîchir le solde utilisateur
        if (refreshUser) await refreshUser();
        Alert.alert(
          t('rechargeScreen.successTitle') || t('rechargeTokens.rechargeReussie'),
          (t('rechargeScreen.successMessage') || t('rechargeTokens.votreCompteAEteCredite'))
            .replace('{{tokens}}', String(data.tokens_added)),
          [{
            text: 'OK', onPress: () => {
              setSelectedOption(null);
              setCustomAmount('');
              setSelectedPaymentMethod(null);
              setCurrentStep('amount');
              setPaymentStatus('idle');
              // ✅ Retour automatique vers l'écran appelant après paiement réussi
              if (returnTo) {
                console.log('[RechargeTokens] ✅ Retour automatique vers:', returnTo, returnParams);
                (navigation as any).navigate(returnTo, { ...returnParams, rechargeCompleted: true });
              }
            }
          }]
        );
      } else if (data?.status === 'pending' || data?.status === 'processing') {
        Alert.alert(
          t('rechargeScreen.processingTitle') || t('rechargeTokens.enCours'),
          t('rechargeScreen.processingMessage') || t('rechargeTokens.lePaiementEstToujoursEn'),
          [
            { text: t('rechargeScreen.checkStatus') || t('rechargeTokens.reverifier'), onPress: () => setTimeout(() => pollPaymentStatus(paymentId), 3000) },
            { text: 'OK' }
          ]
        );
      } else {
        setPaymentStatus('failed');
        Alert.alert(
          t('rechargeScreen.failedTitle') || t('rechargeTokens.echec'),
          t('rechargeScreen.failedMessage') || t('rechargeTokens.lePaiementAEchoueVeuillez')
        );
      }
    } catch (e) {
      console.error('Erreur vérification statut:', e);
    } finally {
      setLoading(false);
    }
  }, [t, refreshUser]);

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
      return option?.amount || 0;
    }
    return parseInt(customAmount) || 0;
  };

  const renderAmountStep = () => (
    <View style={styles.stepContainer}>
      <Title style={styles.stepTitle}>{t('rechargeScreen.selectAmount') || 'Choisissez le montant'}</Title>

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
                <Text style={styles.popularText}>{t('rechargeScreen.popular') || 'Populaire'}</Text>
              </View>
            )}

            <View style={styles.optionContent}>
              <Text style={styles.optionAmount}>
                {option.amount.toLocaleString()} {userCurrency.symbol}
              </Text>
              <Text style={styles.optionTokens}>
                {t('rechargeScreen.creditedToBalance') || t('rechargeTokens.crediteAVotreSolde')}
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
          <Title style={styles.customTitle}>{t('rechargeScreen.customAmount') || t('rechargeTokens.montantPersonnalise')}</Title>
          <TextInput
            style={styles.customInput}
            placeholder={t('rechargeScreen.enterAmount') || `Entrez le montant en ${userCurrency.symbol}`}
            value={customAmount}
            onChangeText={(text) => {
              setCustomAmount(text);
              setSelectedOption(null);
            }}
            keyboardType="numeric"
          />
          {customAmount && (
            <Text style={styles.customTokens}>
              {(t('rechargeScreen.willBeCredited') || t('rechargeTokens.amountFcfaSerontCreditesA')).replace('{{amount}}', (parseInt(customAmount) || 0).toLocaleString())}
            </Text>
          )}
        </Card.Content>
      </Card>

      <TouchableOpacity
        onPress={() => setCurrentStep('payment')}
        disabled={!selectedOption && !customAmount || getSelectedAmount() < minimumRechargeAmount}
        style={[
          styles.nextButton,
          ((!selectedOption && !customAmount) || getSelectedAmount() < minimumRechargeAmount) && styles.nextButtonDisabled
        ]}
      >
        <Text style={styles.nextButtonText}>{t('rechargeScreen.continue') || 'Continuer →'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPaymentStep = () => (
    <View style={styles.stepContainer}>
      <Title style={styles.stepTitle}>{t('payment.method') || t('rechargeTokens.methodeDePaiement')}</Title>

      <View style={styles.paymentMethodsContainer}>
        {paymentMethods
          .filter((m) => m.type !== 'mobile' || mobilePaymentIdsForCountry.includes(m.id))
          .map((method) => (
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

      {/* Champ numéro de téléphone pour Mobile Money */}
      {(['mtn_momo', 'orange_money', 'wave', 'moov_money', 'airtel_money', 'mpesa', 'vodafone_cash', 'free_money', 'tigo_pesa', 'ecocash'].includes(selectedPaymentMethod || '')) && (
        <Card style={styles.phoneCard}>
          <Card.Content>
            <Text style={styles.phoneLabel}>📱 {t('payment.phone') || t('rechargeTokens.numeroDeTelephone')}</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder={t('rechargeScreen.phonePlaceholder') || 'Exemple: 699999999'}
              placeholderTextColor="#999"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              maxLength={15}
            />
            <Text style={styles.phoneHint}>
              {selectedPaymentMethod === 'mtn_momo' ? '💡 MTN : 67X XXX XXX ou 65X XXX XXX' : '💡 Orange : 69X XXX XXX'}
            </Text>
            {!paymentCheck.has_payment_method && (
              <TouchableOpacity
                style={{ marginTop: 8, padding: 8, backgroundColor: '#FEF3C7', borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => setShowPaymentPrompt(true)}
              >
                <Text style={{ fontSize: 13, color: '#92400E' }}>
                  ⚠️ {t('paymentPrompt.saveForFuture') || t('rechargeTokens.enregistrerCeNumeroPourLes')}
                </Text>
              </TouchableOpacity>
            )}
          </Card.Content>
        </Card>
      )}

      <View style={styles.navigationButtons}>
        <TouchableOpacity
          onPress={() => setCurrentStep('amount')}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>{t('rechargeScreen.back') || '← Retour'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setCurrentStep('confirm')}
          disabled={
            !selectedPaymentMethod ||
            getSelectedAmount() < minimumRechargeAmount ||
            (['mtn_momo', 'orange_money', 'wave', 'moov_money', 'airtel_money', 'mpesa', 'vodafone_cash', 'free_money', 'tigo_pesa', 'ecocash'].includes(selectedPaymentMethod || '') && !phoneNumber)
          }
          style={[
            styles.nextButton,
            (!selectedPaymentMethod ||
              getSelectedAmount() < minimumRechargeAmount ||
              (['mtn_momo', 'orange_money', 'wave', 'moov_money', 'airtel_money', 'mpesa', 'vodafone_cash', 'free_money', 'tigo_pesa', 'ecocash'].includes(selectedPaymentMethod || '') && !phoneNumber)) &&
              styles.nextButtonDisabled
          ]}
        >
          <Text style={styles.nextButtonText}>{t('rechargeScreen.continue') || 'Continuer →'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderConfirmStep = () => (
    <View style={styles.stepContainer}>
      <Title style={styles.stepTitle}>{t('rechargeScreen.summary') || 'Confirmation'}</Title>

      <Card style={styles.confirmCard}>
        <Card.Content>
          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>{t('rechargeScreen.amount') || 'Montant'}:</Text>
            <Text style={styles.confirmValue}>
              {getSelectedAmount().toLocaleString()} {userCurrency.symbol}
            </Text>
          </View>

          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>{t('rechargeScreen.credited') || t('rechargeTokens.montantCredite')}:</Text>
            <Text style={styles.confirmValue}>{getSelectedAmount().toLocaleString()} {userCurrency.symbol}</Text>
          </View>

          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>{t('payment.method') || t('rechargeTokens.methodeDePaiement')}:</Text>
            <Text style={styles.confirmValue}>
              {paymentMethods.find(m => m.id === selectedPaymentMethod)?.name}
            </Text>
          </View>

          <View style={styles.confirmRow}>
            <Text style={styles.confirmLabel}>{t('rechargeScreen.processingTime') || 'Temps de traitement'}:</Text>
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
          <Text style={styles.backButtonText}>{t('rechargeScreen.back') || '← Retour'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleRecharge}
          disabled={loading || getSelectedAmount() < minimumRechargeAmount}
          style={[
            styles.confirmButton,
            loading && styles.confirmButtonDisabled
          ]}
        >
          <Text style={styles.confirmButtonText}>
            {loading ? (t('rechargeScreen.processing') || 'Traitement...') : (t('rechargeScreen.confirm') || '✓ Confirmer le paiement')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const creditNumber = Number(user?.credits ?? user?.tokens_balance ?? 0);
  const formattedCredits = Number.isFinite(creditNumber) ? creditNumber.toLocaleString() : '0';
  const balanceLabel = `${t('yourBalance') || 'Solde actuel'}: ${formattedCredits} ${userCurrency.symbol}`;

  return (
    <SafeAreaView style={styles.container}>
      <NavigatorToolbar
        title={t('rechargeScreen.title') || 'Recharger mon solde'}
        subtitle={balanceLabel}
        showHandle={false}
        density="compact"
        backIcon="back"
        onClose={() => navigation.goBack()}
        rightSlot={(
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => (navigation as any).navigate('SoldeDetail')}
          >
            <Text style={styles.historyButtonText}>📊 {t('tokens.history') || 'Historique'}</Text>
          </TouchableOpacity>
        )}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Bannière dette - s'affiche quand l'utilisateur est redirigé avec une dette */}
        {hasDebt && (
          <View style={styles.debtBanner}>
            <View style={styles.debtBannerHeader}>
              <Ionicons name="warning" size={22} color="#DC2626" />
              <Text style={styles.debtBannerTitle}>
                {t('rechargeScreen.debtBannerTitle') || 'Dette en cours'}
              </Text>
            </View>
            <Text style={styles.debtBannerMsg}>
              {(t('rechargeScreen.debtBannerMsg') || 'Vous avez {{count}} utilisation(s) impayée(s) pour un total de {{amount}} XAF. Rechargez au minimum {{minimum}} XAF pour couvrir votre dette et restaurer l\'accès complet. Nous vous recommandons de recharger davantage pour une utilisation confortable.')
                .replace('{{count}}', String(debtCount ?? 0))
                .replace('{{amount}}', String(debtAmount ?? 0))
                .replace('{{minimum}}', String(minimumRechargeAmount))}
            </Text>
            <View style={styles.debtBannerMinRow}>
              <Ionicons name="lock-closed" size={14} color="#B91C1C" />
              <Text style={styles.debtBannerMin}>
                {(t('rechargeScreen.debtMinimumLabel') || 'Recharge minimum obligatoire: {{minimum}} XAF')
                  .replace('{{minimum}}', String(minimumRechargeAmount))}
              </Text>
            </View>
          </View>
        )}

        {/* Étapes */}
        <View style={styles.stepsIndicator}>
          <View style={[styles.step, currentStep === 'amount' && styles.stepActive]}>
            <Text style={[styles.stepText, currentStep === 'amount' && styles.stepTextActive]}>
              1. {t('rechargeScreen.amount') || 'Montant'}
            </Text>
          </View>
          <View style={[styles.step, currentStep === 'payment' && styles.stepActive]}>
            <Text style={[styles.stepText, currentStep === 'payment' && styles.stepTextActive]}>
              2. {t('payment.title') || 'Paiement'}
            </Text>
          </View>
          <View style={[styles.step, currentStep === 'confirm' && styles.stepActive]}>
            <Text style={[styles.stepText, currentStep === 'confirm' && styles.stepTextActive]}>
              3. {t('rechargeScreen.summary') || 'Confirmation'}
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

      {/* Modal pour configurer les moyens de paiement */}
      <PaymentMethodPrompt
        visible={showPaymentPrompt}
        onClose={() => setShowPaymentPrompt(false)}
        onSaved={(methods) => {
          // Pré-remplir le numéro depuis les méthodes sauvegardées
          if (methods.mtn_money?.phone) {
            setPhoneNumber(methods.mtn_money.phone.replace(/[^\d]/g, ''));
          } else if (methods.orange_money?.phone) {
            setPhoneNumber(methods.orange_money.phone.replace(/[^\d]/g, ''));
          }
          paymentCheck.refresh();
        }}
        context="recharge"
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
    paddingBottom: 120,
  },
  historyButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  historyButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  debtBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  debtBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  debtBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
  },
  debtBannerMsg: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 19,
    marginBottom: 10,
  },
  debtBannerMinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  debtBannerMin: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
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
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  backButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.5,
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  phoneCard: {
    marginVertical: 16,
    elevation: 2,
  },
  phoneLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  phoneInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  phoneHint: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
});

export default RechargeTokensScreen;




