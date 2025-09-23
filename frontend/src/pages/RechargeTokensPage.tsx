import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import HistorySummary from '@/components/recharge/HistorySummary';
import PaymentMethods from '@/components/recharge/PaymentMethods';
import RechargeOptions from '@/components/recharge/RechargeOptions';
import { Button } from '@/components/ui/buttons/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useUser } from '@/hooks/useUser';
import { useUserCredit } from '@/hooks/useUserCredit';
import {
  AlertCircle,
  CheckCircle,
  Coins,
  CreditCard,
  Info,
  Shield,
  Smartphone,
  Star,
  Wallet,
  Zap
} from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface RechargeOption {
  id: string;
  amount: number;
  tokens: number;
  bonus: number;
  popular?: boolean;
  description: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  available: boolean;
  processingTime: string;
  fees: number;
}

interface ConsumptionHistory {
  id: string;
  date: string;
  service: string;
  amount: number;
  type: 'consumption' | 'recharge';
  description: string;
}

interface PaymentHistory {
  id: string;
  date: string;
  amount: number;
  payment_method: string;
  status: 'completed' | 'pending' | 'failed';
  transaction_id?: string;
  description: string;
}

const RechargeTokensPage: React.FC = () => {
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<number>(2000);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [consumptionHistory, setConsumptionHistory] = useState<ConsumptionHistory[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { user } = useUser();
  const { creditDevise, devise } = useUserCredit();
  const { toast } = useToast();

  // Fonction pour charger l'historique des consommations
  const loadConsumptionHistory = async () => {
    if (!user?.id) return;

    setHistoryLoading(true);
    try {
      const response = await fetch('/api/users/consumption-history', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConsumptionHistory(data.history || []);
      }
    } catch (error) {
      console.error('Erreur chargement historique:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Fonction pour charger l'historique des paiements
  const loadPaymentHistory = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch('/api/users/payment-history', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentHistory(data.payments || []);
      }
    } catch (error) {
      console.error('Erreur chargement historique paiements:', error);
    }
  };

  // Charger l'historique au montage du composant
  useEffect(() => {
    loadConsumptionHistory();
    loadPaymentHistory();
  }, [user?.id]);

  // Options de recharge predéfinies (converties selon la devise de l'utilisateur)
  const getRechargeOptions = (): RechargeOption[] => {
    const baseAmounts = [2000, 5000, 10000]; // Montants de base en FCFA
    const baseTokens = [2000, 5500, 12000];
    const bonuses = [0, 500, 2000];

    return baseAmounts.map((amount, index) => ({
      id: ['basic', 'standard', 'premium'][index],
      amount: amount,
      tokens: baseTokens[index],
      bonus: bonuses[index],
      popular: index === 1,
      description: ['Recharge de base', 'Recharge standard avec bonus', 'Recharge premium avec bonus maximum'][index]
    }));
  };

  const rechargeOptions = getRechargeOptions();

  // Fonction pour formater les montants selon la devise
  const formatAmount = (amount: number, showCurrency: boolean = true) => {
    if (devise === 'XAF') {
      return showCurrency ? `${amount.toLocaleString()} FCFA` : amount.toLocaleString();
    }

    // Pour les autres devises, utiliser le formatage standard
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: devise,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Modes de paiement disponibles
  const paymentMethods: PaymentMethod[] = [
    {
      id: 'orange_money',
      name: 'Orange Money',
      icon: <Smartphone className="w-6 h-6 text-orange-600" />,
      description: 'Paiement mobile Orange Money',
      available: true,
      processingTime: 'Instantané',
      fees: 0
    },
    {
      id: 'mtn_money',
      name: 'MTN Money',
      icon: <Smartphone className="w-6 h-6 text-yellow-600" />,
      description: 'Paiement mobile MTN Money',
      available: true,
      processingTime: 'Instantané',
      fees: 0
    },
    {
      id: 'visa_card',
      name: 'Carte Visa',
      icon: <CreditCard className="w-6 h-6 text-blue-600" />,
      description: 'Paiement par carte bancaire Visa',
      available: true,
      processingTime: '2-5 minutes',
      fees: 50
    },
    {
      id: 'mastercard',
      name: 'Mastercard',
      icon: <CreditCard className="w-6 h-6 text-red-600" />,
      description: 'Paiement par carte Mastercard',
      available: true,
      processingTime: '2-5 minutes',
      fees: 50
    }
  ];

  const handleRecharge = async (option: RechargeOption | null) => {
    if (!user?.id) {
      toast({
        title: "Erreur",
        description: "Vous devez etre connecte pour recharger",
        type: "error"
      });
      return;
    }

    if (!selectedPaymentMethod) {
      toast({
        title: "Mode de paiement requis",
        description: "Veuillez selectionner un mode de paiement",
        type: "error"
      });
      return;
    }

    setLoading(true);

    try {
      const amount = option ? option.amount : customAmount;
      const tokens = option ? option.tokens : customAmount;
      const paymentMethod = paymentMethods.find(pm => pm.id === selectedPaymentMethod);

      // Validation du montant minimum
      if (amount < 2000) {
        toast({
          title: "Montant insuffisant",
          description: `Le montant minimum de recharge est de ${formatAmount(2000)}`,
          type: "error"
        });
        setLoading(false);
        return;
      }

      // Simulation de l'appel API
      const response = await fetch('/api/tokens/recharge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          amount: amount,
          tokens: tokens,
          payment_method: selectedPaymentMethod,
          payment_method_name: paymentMethod?.name,
          fees: paymentMethod?.fees || 0,
          user_id: user.id
        })
      });

      if (response.ok) {
        const data = await response.json();

        toast({
          title: "Recharge reussie !",
          description: `Vous avez reçu ${tokens.toLocaleString()} tokens (${formatAmount(amount)})`,
          type: "success"
        });

        // Recharger les historiques
        loadConsumptionHistory();
        loadPaymentHistory();

        // Mettre à jour le solde dans localStorage
        localStorage.setItem('tokens_balance', data.new_balance.toString());

        // Déclencher un événement pour mettre à jour l'affichage du solde
        window.dispatchEvent(new CustomEvent('balanceUpdated', {
          detail: { newBalance: data.new_balance }
        }));
      } else {
        throw new Error('Erreur de recharge');
      }
    } catch (error) {
      console.error('Erreur recharge:', error);
      toast({
        title: "Erreur de recharge",
        description: "Impossible de traiter votre recharge. Veuillez reessayer.",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCustomRecharge = () => {
    if (customAmount < 2000) {
      toast({
        title: "Montant insuffisant",
        description: `Le montant minimum de recharge est de ${formatAmount(2000)}`,
        type: "error"
      });
      return;
    }

    const customOption: RechargeOption = {
      id: 'custom',
      amount: customAmount,
      tokens: customAmount,
      bonus: 0,
      description: 'Montant personnalise'
    };

    handleRecharge(customOption);
  };

  return (
    <ResponsiveContainer>
      <div className="py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Recharger mes Tokens
          </h1>
          <p className="text-gray-600">
            Achetez des tokens pour utiliser les fonctionnalites IA de Yukpo
          </p>
        </div>

        {/* Solde actuel */}
        <Card className="mb-8 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Solde actuel</h3>
                <p className="text-2xl font-bold text-green-600">
                  {creditDevise !== null ? formatAmount(creditDevise) : "Chargement..."}
                </p>
                <p className="text-sm text-gray-600">
                  Devise détectée: {devise}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informations sur les tokens */}
        <Card className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                <Coins className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">A quoi servent les tokens ?</h3>
                <p className="text-gray-600">Les tokens vous permettent d'utiliser l'IA pour creer et optimiser vos services</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span>Creation de services IA</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Shield className="w-4 h-4 text-green-500" />
                <span>Optimisation automatique</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Star className="w-4 h-4 text-purple-500" />
                <span>Suggestions intelligentes</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Options de recharge predéfinies */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Options de recharge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RechargeOptions
              options={rechargeOptions}
              selectedOption={selectedOption}
              onSelectOption={setSelectedOption}
              formatAmount={formatAmount}
            />

            <div className="mt-6 text-center">
              <Button
                onClick={() => selectedOption && handleRecharge(rechargeOptions.find(o => o.id === selectedOption)!)}
                disabled={!selectedOption || !selectedPaymentMethod || loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-semibold"
              >
                {loading ? 'Traitement...' : 'Recharger maintenant'}
              </Button>
              {!selectedPaymentMethod && (
                <p className="text-sm text-red-600 mt-2">
                  Veuillez sélectionner un mode de paiement
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Montant personnalise */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Montant personnalise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-w-md mx-auto">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant en {devise} (minimum {formatAmount(2000)})
                </label>
                <input
                  type="number"
                  min="2000"
                  step="100"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  placeholder="2000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Vous recevrez {customAmount.toLocaleString()} tokens
                </p>
              </div>

              <div className="text-center">
                <Button
                  onClick={handleCustomRecharge}
                  disabled={customAmount < 2000 || !selectedPaymentMethod || loading}
                  variant="outline"
                  className="w-full py-3 text-lg font-semibold border-blue-500 text-blue-600 hover:bg-blue-50"
                >
                  {loading ? 'Traitement...' : `Recharger ${formatAmount(customAmount)}`}
                </Button>
                {!selectedPaymentMethod && (
                  <p className="text-sm text-red-600 mt-2">
                    Veuillez sélectionner un mode de paiement
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sélection du mode de paiement */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Choisir votre mode de paiement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentMethods
              methods={paymentMethods}
              selectedMethod={selectedPaymentMethod}
              onSelectMethod={setSelectedPaymentMethod}
              formatAmount={formatAmount}
            />

            {selectedPaymentMethod && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Mode de paiement sélectionné</span>
                </div>
                <p className="text-sm text-blue-800">
                  {paymentMethods.find(pm => pm.id === selectedPaymentMethod)?.name} -
                  {paymentMethods.find(pm => pm.id === selectedPaymentMethod)?.processingTime}
                  {paymentMethods.find(pm => pm.id === selectedPaymentMethod)?.fees === 0 ? ' (Sans frais)' :
                    ` (+${formatAmount(paymentMethods.find(pm => pm.id === selectedPaymentMethod)?.fees || 0)} de frais)`}
                </p>
              </div>
            )}
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

        {/* Informations de paiement */}
        <Card className="bg-gray-50">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Informations importantes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-sm">M</span>
                </div>
                <div>
                  <div className="font-medium">Mobile Money</div>
                  <div className="text-sm text-gray-600">MTN, Orange, Nexttel</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                  <span className="text-white font-bold text-sm">C</span>
                </div>
                <div>
                  <div className="font-medium">Carte bancaire</div>
                  <div className="text-sm text-gray-600">Visa, Mastercard</div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <strong>Important :</strong> Les tokens sont credites instantanement apres confirmation du paiement.
                  En cas de probleme, contactez le support.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ResponsiveContainer>
  );
};

export default RechargeTokensPage;
