import {
  ArrowRight,
  CheckCircle,
  Coins,
  CreditCard,
  Lock,
  Shield,
  Sparkles
} from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import PaymentMethodManager from '../components/payment/PaymentMethodManager';
import AmountSelector from '../components/recharge/AmountSelector';
import HistorySummary from '../components/recharge/HistorySummary';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useUser } from '../hooks/useUser';
import { useUserCredit } from '../hooks/useUserCredit';

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

const RechargeTokensPage: React.FC = () => {
  const { user } = useUser();
  const { balance, devise, formatAmount } = useUserCredit();
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<number>(0);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'amount' | 'payment' | 'confirm'>('amount');

  // Options de recharge prédéfinies (en FCFA de base, converties selon la devise)
  const baseAmounts = [2000, 5000, 10000, 20000, 50000]; // Montants en FCFA
  const rechargeOptions: RechargeOption[] = baseAmounts.map((baseAmount, index) => {
    const tokens = baseAmount; // 1 FCFA = 1 token
    const bonus = baseAmount >= 10000 ? Math.floor(baseAmount * 0.2) :
      baseAmount >= 5000 ? Math.floor(baseAmount * 0.1) :
        baseAmount >= 2000 ? Math.floor(baseAmount * 0.05) : 0;

    return {
      id: ['basic', 'standard', 'premium', 'pro', 'enterprise'][index],
      amount: baseAmount, // Montant en FCFA (sera converti par formatAmount)
      tokens: tokens + bonus,
      bonus: bonus,
      popular: baseAmount === 10000,
      description: ['Recharge de base', 'Recharge standard', 'Recharge premium', 'Recharge professionnelle', 'Recharge entreprise'][index]
    };
  });

  // Méthodes de paiement disponibles (frais en FCFA de base)
  const baseFees = {
    mobile: 0,      // Mobile Money gratuit
    card: 50,       // Cartes bancaires : 50 FCFA
    bank: 0         // Virement bancaire gratuit
  };

  const paymentMethods: PaymentMethod[] = [
    {
      id: 'mtn_money',
      name: 'MTN Money',
      type: 'mobile',
      processingTime: 'Instantané',
      fees: baseFees.mobile,
      available: true,
      icon: '📱'
    },
    {
      id: 'orange_money',
      name: 'Orange Money',
      type: 'mobile',
      processingTime: 'Instantané',
      fees: baseFees.mobile,
      available: true,
      icon: '🍊'
    },
    {
      id: 'moov_money',
      name: 'Moov Money',
      type: 'mobile',
      processingTime: 'Instantané',
      fees: baseFees.mobile,
      available: true,
      icon: '📲'
    },
    {
      id: 'visa',
      name: 'Visa',
      type: 'card',
      processingTime: '2-3 minutes',
      fees: baseFees.card,
      available: true,
      icon: '💳'
    },
    {
      id: 'mastercard',
      name: 'Mastercard',
      type: 'card',
      processingTime: '2-3 minutes',
      fees: baseFees.card,
      available: true,
      icon: '💳'
    },
    {
      id: 'bank_transfer',
      name: 'Virement bancaire',
      type: 'bank',
      processingTime: '1-2 heures',
      fees: baseFees.bank,
      available: true,
      icon: '🏦'
    }
  ];

  // Historique de consommation (mock)
  const consumptionHistory = [
    {
      id: '1',
      service: 'Génération de contenu IA',
      tokens: 150,
      date: new Date(Date.now() - 1000 * 60 * 30),
      type: 'consumption'
    },
    {
      id: '2',
      service: 'Recherche de services',
      tokens: 50,
      date: new Date(Date.now() - 1000 * 60 * 60 * 2),
      type: 'consumption'
    }
  ];

  // Historique de paiement (mock)
  const paymentHistory = [
    {
      id: '1',
      amount: 5000,
      method: 'MTN Money',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24),
      status: 'completed'
    },
    {
      id: '2',
      amount: 10000,
      method: 'Orange Money',
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      status: 'completed'
    }
  ];

  const handleRecharge = async (option: RechargeOption) => {
    if (!selectedPaymentMethod) {
      toast.error('Veuillez sélectionner un moyen de paiement');
      return;
    }

    setLoading(true);
    try {
      // Simuler la recharge
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast.success(`Recharge de ${formatAmount(option.amount)} effectuée avec succès !`);
      setCurrentStep('amount');
      setSelectedOption(null);
      setSelectedPaymentMethod(null);
    } catch (error) {
      toast.error('Erreur lors de la recharge');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomRecharge = async () => {
    if (customAmount < 1000) {
      toast.error('Montant minimum: 1000 FCFA');
      return;
    }

    if (!selectedPaymentMethod) {
      toast.error('Veuillez sélectionner un moyen de paiement');
      return;
    }

    setLoading(true);
    try {
      // Simuler la recharge personnalisée
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast.success(`Recharge de ${formatAmount(customAmount)} effectuée avec succès !`);
      setCurrentStep('amount');
      setCustomAmount(0);
      setSelectedPaymentMethod(null);
    } catch (error) {
      toast.error('Erreur lors de la recharge');
    } finally {
      setLoading(false);
    }
  };

  const getSelectedOption = () => {
    if (selectedOption === 'custom') {
      return {
        id: 'custom',
        amount: customAmount,
        tokens: Math.floor(customAmount),
        bonus: customAmount >= 10000 ? Math.floor(customAmount * 0.2) :
          customAmount >= 5000 ? Math.floor(customAmount * 0.1) :
            customAmount >= 2000 ? Math.floor(customAmount * 0.05) : 0
      };
    }
    return rechargeOptions.find(opt => opt.id === selectedOption);
  };

  const selectedOptionData = getSelectedOption();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Recharge instantanée
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Rechargez vos tokens
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Accédez à tous les services Yukpo avec des tokens.
            Rechargez facilement et profitez de bonus exclusifs !
          </p>
        </div>

        {/* Solde actuel */}
        <Card className="mb-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium mb-1">Solde actuel</h3>
                <div className="flex items-center gap-2">
                  <Coins className="w-6 h-6" />
                  <span className="text-3xl font-bold">
                    {balance?.toLocaleString() || '0'} tokens
                  </span>
                </div>
                <p className="text-blue-100 mt-1">
                  Équivalent à {formatAmount(balance)}
                </p>
              </div>
              <div className="text-right">
                <Badge className="bg-white/20 text-white border-white/30">
                  <Shield className="w-3 h-3 mr-1" />
                  Sécurisé
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Étapes de progression */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            {[
              { key: 'amount', label: 'Montant', icon: Coins },
              { key: 'payment', label: 'Paiement', icon: CreditCard },
              { key: 'confirm', label: 'Confirmation', icon: CheckCircle }
            ].map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.key;
              const isCompleted = ['amount', 'payment', 'confirm'].indexOf(currentStep) > index;

              return (
                <div key={step.key} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${isActive || isCompleted
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-400'
                    }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`ml-2 font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'
                    }`}>
                    {step.label}
                  </span>
                  {index < 2 && (
                    <ArrowRight className="w-4 h-4 text-gray-400 mx-4" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Colonne principale */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sélection du montant */}
            {currentStep === 'amount' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="w-5 h-5" />
                    Choisissez votre montant
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AmountSelector
                    options={rechargeOptions}
                    selectedOption={selectedOption}
                    onSelectOption={setSelectedOption}
                    customAmount={customAmount}
                    onCustomAmountChange={setCustomAmount}
                    formatAmount={formatAmount}
                    currency={devise}
                  />

                  {selectedOptionData && (
                    <div className="mt-6">
                      <Button
                        onClick={() => setCurrentStep('payment')}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-3"
                      >
                        Continuer vers le paiement
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Sélection du moyen de paiement */}
            {currentStep === 'payment' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Choisissez votre moyen de paiement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {paymentMethods.map((method) => (
                      <Card
                        key={method.id}
                        className={`cursor-pointer transition-all ${selectedPaymentMethod === method.id
                            ? 'ring-2 ring-blue-500 bg-blue-50'
                            : 'hover:shadow-md'
                          }`}
                        onClick={() => setSelectedPaymentMethod(method.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="text-2xl">{method.icon}</div>
                              <div>
                                <h4 className="font-medium">{method.name}</h4>
                                <p className="text-sm text-gray-600">{method.processingTime}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">
                                {method.fees === 0 ? 'Gratuit' : `+${formatAmount(method.fees)}`}
                              </div>
                              {selectedPaymentMethod === method.id && (
                                <CheckCircle className="w-5 h-5 text-blue-600 ml-auto" />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep('amount')}
                      className="flex-1"
                    >
                      Retour
                    </Button>
                    <Button
                      onClick={() => setCurrentStep('confirm')}
                      disabled={!selectedPaymentMethod}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      Continuer
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Confirmation */}
            {currentStep === 'confirm' && selectedOptionData && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    Confirmez votre recharge
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Résumé de la recharge */}
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h4 className="font-semibold mb-4">Résumé de votre recharge</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Montant:</span>
                          <span className="font-semibold">{formatAmount(selectedOptionData.amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tokens:</span>
                          <span className="font-semibold">{selectedOptionData?.tokens?.toLocaleString() || '0'}</span>
                        </div>
                        {selectedOptionData.bonus > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Bonus:</span>
                            <span className="font-semibold">+{selectedOptionData?.bonus?.toLocaleString() || '0'}</span>
                          </div>
                        )}
                        <div className="border-t pt-3">
                          <div className="flex justify-between text-lg font-bold">
                            <span>Total tokens:</span>
                            <span>{((selectedOptionData?.tokens || 0) + (selectedOptionData?.bonus || 0)).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Moyen de paiement sélectionné */}
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h5 className="font-medium mb-2">Moyen de paiement</h5>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">
                          {paymentMethods.find(pm => pm.id === selectedPaymentMethod)?.icon}
                        </span>
                        <span>{paymentMethods.find(pm => pm.id === selectedPaymentMethod)?.name}</span>
                      </div>
                    </div>

                    {/* Boutons d'action */}
                    <div className="flex gap-4">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep('payment')}
                        className="flex-1"
                      >
                        Retour
                      </Button>
                      <Button
                        onClick={() => handleRecharge(selectedOptionData as RechargeOption)}
                        disabled={loading}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-lg py-3"
                      >
                        {loading ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Traitement...
                          </div>
                        ) : (
                          <>
                            <Lock className="w-4 h-4 mr-2" />
                            Payer {formatAmount(selectedOptionData.amount)}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Colonne latérale */}
          <div className="space-y-6">
            {/* Gestion des moyens de paiement */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Moyens de paiement</CardTitle>
              </CardHeader>
              <CardContent>
                <PaymentMethodManager />
              </CardContent>
            </Card>

            {/* Historique compact */}
            <HistorySummary
              consumptionHistory={consumptionHistory}
              paymentHistory={paymentHistory}
              formatAmount={formatAmount}
              onViewFullHistory={() => {
                window.location.href = '/mon-solde';
              }}
            />

            {/* Informations de sécurité */}
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <h5 className="font-medium text-green-900 mb-1">Paiement sécurisé</h5>
                    <p className="text-sm text-green-700">
                      Tous vos paiements sont protégés par un chiffrement de niveau bancaire.
                      Vos informations ne sont jamais stockées.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RechargeTokensPage;