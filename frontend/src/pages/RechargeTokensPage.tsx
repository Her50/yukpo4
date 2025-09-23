import {
  ArrowRight,
  CheckCircle,
  Coins,
  CreditCard,
  Lock,
  Shield,
  Sparkles,
  Plus,
  Wallet
} from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import SavedPaymentMethods from '../components/payment/SavedPaymentMethods';
import AddPaymentMethodModal from '../components/payment/AddPaymentMethodModal';
import PaymentMethodIcons from '../components/payment/PaymentMethodIcons';
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
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<'amount' | 'payment' | 'confirm'>('amount');
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);

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


  const handleRecharge = async (option: RechargeOption) => {
    if (!selectedPaymentMethod) {
      toast.error('Veuillez sélectionner un moyen de paiement');
      return;
    }

    setLoading(true);
    try {
      // Appel API pour effectuer la recharge
      const response = await fetch('https://yukpomnang.onrender.com/api/users/recharge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          amount: option.amount,
          tokens: option.tokens,
          payment_method: selectedPaymentMethod.id,
          payment_type: selectedPaymentMethod.type
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la recharge');
      }

      const result = await response.json();
      
      // Mettre à jour le solde local
      const newBalance = (balance || 0) + option.tokens;
      localStorage.setItem('user_balance', newBalance.toString());
      
      // Déclencher l'événement de mise à jour du solde
      window.dispatchEvent(new CustomEvent('tokens_updated', { 
        detail: { newBalance, tokensAdded: option.tokens } 
      }));

      toast.success(`Recharge de ${formatAmount(option.amount)} effectuée avec succès ! +${option.tokens} tokens ajoutés`);
      setCurrentStep('amount');
      setSelectedOption(null);
      setSelectedPaymentMethod(null);
    } catch (error) {
      console.error('Erreur lors de la recharge:', error);
      toast.error('Erreur lors de la recharge. Veuillez réessayer.');
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
      const tokens = Math.floor(customAmount);
      const bonus = customAmount >= 10000 ? Math.floor(customAmount * 0.2) :
        customAmount >= 5000 ? Math.floor(customAmount * 0.1) :
          customAmount >= 2000 ? Math.floor(customAmount * 0.05) : 0;
      const totalTokens = tokens + bonus;

      // Appel API pour effectuer la recharge personnalisée
      const response = await fetch('https://yukpomnang.onrender.com/api/users/recharge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          amount: customAmount,
          tokens: totalTokens,
          payment_method: selectedPaymentMethod.id,
          payment_type: selectedPaymentMethod.type
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la recharge');
      }

      const result = await response.json();
      
      // Mettre à jour le solde local
      const newBalance = (balance || 0) + totalTokens;
      localStorage.setItem('user_balance', newBalance.toString());
      
      // Déclencher l'événement de mise à jour du solde
      window.dispatchEvent(new CustomEvent('tokens_updated', { 
        detail: { newBalance, tokensAdded: totalTokens } 
      }));

      toast.success(`Recharge de ${formatAmount(customAmount)} effectuée avec succès ! +${totalTokens} tokens ajoutés`);
      setCurrentStep('amount');
      setCustomAmount(0);
      setSelectedPaymentMethod(null);
    } catch (error) {
      console.error('Erreur lors de la recharge:', error);
      toast.error('Erreur lors de la recharge. Veuillez réessayer.');
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
                  Équivalent à {formatAmount(balance || 0)}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {rechargeOptions.map((option) => (
                      <Card
                  key={option.id}
                        className={`cursor-pointer transition-all ${
                          selectedOption === option.id
                            ? 'ring-2 ring-blue-500 bg-blue-50'
                            : 'hover:shadow-md'
                    }`}
                  onClick={() => setSelectedOption(option.id)}
                >
                        <CardContent className="p-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600 mb-2">
                              {formatAmount(option.amount)}
                            </div>
                            <div className="text-sm text-gray-600 mb-1">
                              {option.tokens.toLocaleString()} tokens
                            </div>
                            {option.bonus > 0 && (
                              <div className="text-xs text-green-600 font-medium">
                                +{option.bonus} bonus
                              </div>
                            )}
                  {option.popular && (
                              <Badge className="mt-2 bg-orange-100 text-orange-800">
                      Populaire
                    </Badge>
                  )}
                    </div>
                        </CardContent>
                      </Card>
                    ))}
                    </div>

                  <div className="border-t pt-4">
                    <div className="text-center mb-4">
                      <p className="text-sm text-gray-600 mb-2">Ou entrez un montant personnalisé</p>
                      <div className="max-w-xs mx-auto">
                        <input
                          type="number"
                          placeholder="Montant en FCFA"
                          value={customAmount || ''}
                          onChange={(e) => setCustomAmount(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          min="2000"
                        />
                        {customAmount > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Vous recevrez {Math.floor(customAmount).toLocaleString()} tokens
                          </p>
                        )}
                      </div>
                    </div>
            </div>

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
                  <SavedPaymentMethods
                    onSelectMethod={(method) => setSelectedPaymentMethod(method)}
                    onAddNew={() => setShowAddPaymentModal(true)}
                    selectedMethodId={selectedPaymentMethod?.id}
                  />

                  {/* Message d'information si aucun moyen de paiement */}
                  {!selectedPaymentMethod && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2 text-yellow-800">
                        <CreditCard className="w-5 h-5" />
                        <span className="font-medium">Aucun moyen de paiement sélectionné</span>
                      </div>
                      <p className="text-sm text-yellow-700 mt-1">
                        Veuillez ajouter et sélectionner un moyen de paiement pour continuer.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-4 mt-6">
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
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* Historique des paiements récents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Paiements récents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-center py-8 text-gray-500">
                    <Wallet className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>Aucun paiement récent</p>
                    <p className="text-sm">Vos transactions apparaîtront ici</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = '/mon-solde'}
                    className="w-full"
                  >
                    Voir tout l'historique
                  </Button>
                </div>
          </CardContent>
        </Card>

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

        {/* Modal d'ajout de moyen de paiement */}
        <AddPaymentMethodModal
          isOpen={showAddPaymentModal}
          onClose={() => setShowAddPaymentModal(false)}
          onSave={(method) => {
            console.log('Nouveau moyen de paiement:', method);
            toast.success('Moyen de paiement ajouté avec succès');
            // Pour l'instant, on ne rafraîchit pas la page car les données sont simulées
            // TODO: Rafraîchir quand l'API sera prête
            // window.location.reload();
          }}
        />
      </div>
    </div>
  );
};

export default RechargeTokensPage;