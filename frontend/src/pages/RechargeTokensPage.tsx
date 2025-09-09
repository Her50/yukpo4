// Page de recharge de tokens avec moyens de paiement localisés
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/buttons';
import AppLayout from '@/components/layout/AppLayout';
import { useUser } from '@/hooks/useUser';
import { useUserCredit } from '@/hooks/useUserCredit';
import { 
  getAvailablePaymentMethods, 
  detectUserRegion, 
  CURRENCY_INFO,
  PaymentMethod 
} from '@/config/payment';
import { 
  initiatePayment, 
  confirmPayment, 
  simulatePaymentConfirmation, 
  InitiatePaymentRequest 
} from '@/lib/paymentClient';
import { 
  CreditCard, 
  Smartphone, 
  Wallet, 
  ArrowLeft,
  Check
} from 'lucide-react';

// Packs de tokens proposés (en XAF, base)
const TOKEN_PACKS = [
  { tokens: 100, price_xaf: 100, popular: false },
  { tokens: 500, price_xaf: 500, popular: true },
  { tokens: 1000, price_xaf: 1000, popular: false },
  { tokens: 2500, price_xaf: 2500, popular: false },
  { tokens: 5000, price_xaf: 5000, popular: false },
];

const RechargeTokensPage: React.FC = () => {
  const { user } = useUser();
  const { creditDevise, devise } = useUserCredit(false);
  const [selectedPack, setSelectedPack] = useState<typeof TOKEN_PACKS[0] | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(1);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const userRegion = detectUserRegion();

  useEffect(() => {
    // Charger les moyens de paiement disponibles
    const methods = getAvailablePaymentMethods(devise, userRegion);
    setPaymentMethods(methods);
    
    // Obtenir le taux de change si nécessaire
    if (devise !== 'XAF') {
      fetchExchangeRate();
    }
  }, [devise, userRegion]);

  const fetchExchangeRate = async () => {
    try {
      const response = await fetch(`https://api.exchangerate.host/latest?base=XAF&symbols=${devise}`);
      const data = await response.json();
      const rate = data?.rates?.[devise] || 1;
      setExchangeRate(rate);
    } catch (error) {
      console.error('Erreur lors de la récupération du taux de change:', error);
      setExchangeRate(1);
    }
  };

  const convertPrice = (priceXAF: number): number => {
    if (devise === 'XAF') return priceXAF;
    // Convertir depuis XAF vers la devise cible
    return Math.round(priceXAF * exchangeRate * 100) / 100;
  };

  const convertToXAFDixieme = (priceXAF: number): number => {
    // Convertir le prix affiché en XAF vers les XAF/10ème stockés en base
    return priceXAF * 10;
  };

  const formatPrice = (price: number): string => {
    const currencyInfo = CURRENCY_INFO[devise as keyof typeof CURRENCY_INFO];
    if (!currencyInfo) return `${price} ${devise}`;
    
    if (currencyInfo.decimals === 0) {
      return `${Math.round(price)} ${currencyInfo.symbol}`;
    }
    return `${price.toFixed(currencyInfo.decimals)} ${currencyInfo.symbol}`;
  };

  const handlePurchase = async () => {
    if (!selectedPack || !selectedPayment) {
      toast.error('Veuillez sélectionner un pack et un moyen de paiement');
      return;
    }

    setLoading(true);
    try {
      // Préparer la requête de paiement
      const paymentRequest: InitiatePaymentRequest = {
        amount_xaf: convertToXAFDixieme(selectedPack.price_xaf), // Convertir en XAF/10ème pour la base
        payment_method: selectedPayment.id,
        currency: devise,
        phone_number: selectedPayment.id.includes('money') ? undefined : undefined // À implémenter : champ de saisie
      };

      // Initier le paiement
      const paymentResponse = await initiatePayment(paymentRequest);
      
      toast.success(paymentResponse.instructions);
      
      // Pour Mobile Money, simuler la confirmation (en développement)
      if (selectedPayment.id.includes('money') || selectedPayment.id.includes('momo')) {
        // En production, ceci serait fait via webhook ou vérification manuelle
        setTimeout(async () => {
          try {
            const result = await simulatePaymentConfirmation(paymentResponse.payment_id, true);
            if (result.success) {
              toast.success(`✅ ${result.message}`);
              // Recharger le solde utilisateur
              setTimeout(() => window.location.reload(), 1500);
            } else {
              toast.error('❌ Paiement échoué');
            }
          } catch (error) {
            toast.error('Erreur lors de la confirmation');
          }
        }, 3000); // Simuler un délai de traitement
      } else if (paymentResponse.payment_url) {
        // Pour les cartes bancaires, rediriger vers la page de paiement
        window.open(paymentResponse.payment_url, '_blank');
      }
      
    } catch (error: any) {
      console.error('Erreur paiement:', error);
      toast.error(error.response?.data?.message || 'Erreur lors du paiement');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <AppLayout padding>
        <div className="text-center py-20">
          <p className="text-gray-500">Connectez-vous pour recharger vos tokens</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout padding>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Retour
            </Button>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Recharger vos tokens
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Solde actuel: <span className="font-semibold text-green-600">
              {creditDevise !== null ? formatPrice(creditDevise) : '...'}
            </span>
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Sélection du pack */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Choisir un pack
            </h2>
            
            {TOKEN_PACKS.map((pack, index) => (
              <div
                key={index}
                className={`relative border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                  selectedPack === pack
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                } ${pack.popular ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
                onClick={() => setSelectedPack(pack)}
              >
                {pack.popular && (
                  <span className="absolute -top-2 left-4 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                    Populaire
                  </span>
                )}
                
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {pack.tokens} tokens
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      {formatPrice(convertPrice(pack.price_xaf))}
                    </p>
                  </div>
                  
                  {selectedPack === pack && (
                    <Check className="text-green-500" size={20} />
                  )}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Sélection du moyen de paiement */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Moyen de paiement
            </h2>
            
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                  selectedPayment === method
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
                onClick={() => setSelectedPayment(method)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{method.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {method.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {method.description}
                    </p>
                  </div>
                  
                  {selectedPayment === method && (
                    <Check className="text-green-500" size={20} />
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Résumé et confirmation */}
        {selectedPack && selectedPayment && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-6"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Résumé de l'achat
            </h3>
            
            <div className="space-y-2 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Pack sélectionné:</span>
                <span className="font-semibold">{selectedPack.tokens} tokens</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Prix:</span>
                <span className="font-semibold">{formatPrice(convertPrice(selectedPack.price_xaf))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Moyen de paiement:</span>
                <span className="font-semibold">{selectedPayment.name}</span>
              </div>
            </div>
            
            <Button
              onClick={handlePurchase}
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-medium py-3 px-4 rounded-lg"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Traitement en cours...
                </>
              ) : (
                `Acheter ${selectedPack.tokens} tokens`
              )}
            </Button>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
};

export default RechargeTokensPage;
