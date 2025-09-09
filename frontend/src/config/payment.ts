// Configuration des moyens de paiement par région et devise

export interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  currencies: string[];
  regions: string[];
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  // Mobile Money pour l'Afrique
  {
    id: 'orange_money',
    name: 'Orange Money',
    description: 'Paiement mobile sécurisé',
    icon: '📱',
    enabled: true,
    currencies: ['XAF', 'XOF'],
    regions: ['africa_west', 'africa_central']
  },
  {
    id: 'mtn_momo',
    name: 'MTN Mobile Money',
    description: 'Paiement mobile MTN',
    icon: '📱',
    enabled: true,
    currencies: ['XAF', 'XOF'],
    regions: ['africa_west', 'africa_central']
  },
  {
    id: 'airtel_money',
    name: 'Airtel Money',
    description: 'Paiement mobile Airtel',
    icon: '📱',
    enabled: true,
    currencies: ['XAF'],
    regions: ['africa_central']
  },
  
  // Cartes bancaires (international)
  {
    id: 'visa',
    name: 'Visa',
    description: 'Carte Visa',
    icon: '💳',
    enabled: true,
    currencies: ['USD', 'EUR', 'XAF', 'GBP', 'ZAR', 'NGN'],
    regions: ['global']
  },
  {
    id: 'mastercard',
    name: 'Mastercard',
    description: 'Carte Mastercard',
    icon: '💳',
    enabled: true,
    currencies: ['USD', 'EUR', 'XAF', 'GBP', 'ZAR', 'NGN'],
    regions: ['global']
  },
  
  // PayPal (international)
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'Compte PayPal',
    icon: '🌐',
    enabled: true,
    currencies: ['USD', 'EUR', 'GBP'],
    regions: ['america', 'europe']
  },
  
  // Crypto (global)
  {
    id: 'crypto_btc',
    name: 'Bitcoin',
    description: 'Paiement en Bitcoin',
    icon: '₿',
    enabled: false, // Désactivé pour l'instant
    currencies: ['BTC'],
    regions: ['global']
  }
];

export const CURRENCY_INFO = {
  XAF: { name: 'Franc CFA', symbol: 'FCFA', decimals: 0 },
  XOF: { name: 'Franc CFA (Ouest)', symbol: 'FCFA', decimals: 0 },
  EUR: { name: 'Euro', symbol: '€', decimals: 2 },
  USD: { name: 'Dollar US', symbol: '$', decimals: 2 },
  GBP: { name: 'Livre Sterling', symbol: '£', decimals: 2 },
  ZAR: { name: 'Rand', symbol: 'R', decimals: 2 },
  NGN: { name: 'Naira', symbol: '₦', decimals: 2 }
};

export function getAvailablePaymentMethods(currency: string, region: string): PaymentMethod[] {
  return PAYMENT_METHODS.filter(method => 
    method.enabled && 
    (method.currencies.includes(currency) || method.regions.includes('global')) &&
    (method.regions.includes(region) || method.regions.includes('global'))
  );
}

export function detectUserRegion(): string {
  const region = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  if (region.includes("Africa")) {
    if (region.includes("Dakar") || region.includes("Abidjan")) return "africa_west";
    if (region.includes("Douala") || region.includes("Yaounde")) return "africa_central";
    if (region.includes("Lagos")) return "africa_west";
    if (region.includes("Johannesburg")) return "africa_south";
    return "africa_central"; // Défaut pour l'Afrique
  }
  
  if (region.includes("Europe")) return "europe";
  if (region.includes("America")) return "america";
  
  return "global";
}
