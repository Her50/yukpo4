// ✅ REFONTE 2026-03-16: Service de tarification DYNAMIQUE basé sur les coûts réels
// Architecture: Backend pilote les prix → mobile cache + fallback hardcodé
// Modèle: prix = coût_réel × 2 (marge 100%), arrondi au multiple de 5 supérieur
//
// COÛTS RÉELS — modèle backend (TYPICAL_SEARCH_POINTS ≈ 12, marge 100 %). Voir GET /api/pricing/navigation.
// ┌─────────────────────────┬──────────────────────────────────┬───────────┬───────────┐
// │ Feature                 │ Modèle facturation                 │ Coût réel │ Prix XAF  │
// ├─────────────────────────┼──────────────────────────────────┼───────────┼───────────┤
// │ POI health (2 types G.) │ 12 pts × 2 Nearby + overhead      │ ~504 XAF  │ ~1010 XAF │
// │ POI food (3 types)      │ 12 × 3 Nearby                       │ ~756 XAF  │ ~1515 XAF │
// │ POI fuel / finance / h. │ 12 × 1 Nearby                       │ ~252 XAF  │ ~505 XAF  │
// │ security                │ public → 0                          │ —         │ 0         │
// │ Alertes communautaires  │ 1 SQL + 5 reverseGeocode max      │ ~17 XAF   │ 35 XAF    │
// └─────────────────────────┴──────────────────────────────────┴───────────┴───────────┘

import SafeStorage from '../utils/safeStorage';
import { apiGet } from './api';

export interface NavigationFeaturePrice {
    feature: string;
    unitPrice: number;
    currency: string;
    requiresConfirmation: boolean;
    description_key: string;
}

// ══════════════════════════════════════════════════════════════════════
// TARIFS FALLBACK — utilisés si le backend est indisponible
// Ces valeurs sont en XAF et seront converties selon la devise utilisateur
// ══════════════════════════════════════════════════════════════════════

const FALLBACK_POI_PRICES: Record<string, number> = {
    health: 1010,       // aligné backend poi_cost(2) avec TYPICAL_SEARCH_POINTS=12 + marge 100%
    food: 1515,         // 3 types Google dans la catégorie
    fuel: 505,
    finance: 505,
    auto: 1515,
    religion: 1010,
    accommodation: 505,
    security: 0,        // GRATUIT — service public
};

const FALLBACK_MICRO_PRICES: Record<string, number> = {
    community_alerts: 100,      // 100 FCFA par checkpoint unique rencontré pendant le tracking (rappels progressifs gratuits)
    community_alerts_sound: 0,   // ✅ FIX 2026-03-18: GRATUIT — la facturation est par checkpoint unique (via community_alerts), pas par notification sonore
    activity_stats: 0,           // GRATUIT — statistiques santé incluses dans coaching mensuel
    ai_coach: 10,               // 3.4 XAF × 2 (marge 100%) → 10 XAF
    coaching_monthly: 1000,    // Forfait push coaching mensuel (augmenté à 1000 FCFA)
    co2_tracking: 0,            // GRATUIT (engagement écologique)
    gamification: 0,            // GRATUIT (engagement)
    route_search: 35,           // Coût par recherche trajet (même logique que alertes communautaires)
    checkpoint_report: 0,       // GRATUIT (contribution communautaire)
};

// ══════════════════════════════════════════════════════════════════════
// TAUX DE CONVERSION — XAF vers autres devises
// Mis à jour depuis le backend; fallback statique ici
// Source: taux indicatifs au 2026-03 (1 EUR ≈ 655.957 XAF)
// ══════════════════════════════════════════════════════════════════════

const FALLBACK_EXCHANGE_RATES: Record<string, number> = {
    XAF: 1,           // Franc CFA CEMAC (devise de base)
    XOF: 1,           // Franc CFA UEMOA (parité 1:1 avec XAF)
    EUR: 0.001524,    // 1 XAF = 0.001524 EUR
    USD: 0.001650,    // 1 XAF = 0.00165 USD
    GBP: 0.001300,    // 1 XAF = 0.0013 GBP
    NGN: 2.50,        // 1 XAF = 2.5 NGN
    GHS: 0.025,       // 1 XAF = 0.025 GHS
    KES: 0.230,       // 1 XAF = 0.23 KES
    ZAR: 0.030,       // 1 XAF = 0.03 ZAR
    MAD: 0.016,       // 1 XAF = 0.016 MAD
    TND: 0.005,       // 1 XAF = 0.005 TND
    DZD: 0.225,       // 1 XAF = 0.225 DZD
    EGP: 0.080,       // 1 XAF = 0.08 EGP
    CDF: 4.30,        // 1 XAF = 4.3 CDF
    RWF: 2.10,        // 1 XAF = 2.1 RWF
    MGA: 7.50,        // 1 XAF = 7.5 MGA
    CAD: 0.002250,    // 1 XAF = 0.00225 CAD
    CHF: 0.001450,    // 1 XAF = 0.00145 CHF
    CNY: 0.012,       // 1 XAF = 0.012 CNY
    INR: 0.140,       // 1 XAF = 0.14 INR
};

// Symboles de devises pour affichage
const CURRENCY_SYMBOLS: Record<string, string> = {
    XAF: 'FCFA', XOF: 'FCFA', EUR: '€', USD: '$', GBP: '£',
    NGN: '₦', GHS: 'GH₵', KES: 'KSh', ZAR: 'R', MAD: 'MAD',
    CDF: 'FC', RWF: 'FRw', CAD: 'CA$', CHF: 'CHF', CNY: '¥', INR: '₹',
};

// Nombre de décimales par devise
const CURRENCY_DECIMALS: Record<string, number> = {
    XAF: 0, XOF: 0, EUR: 2, USD: 2, GBP: 2, NGN: 0, GHS: 2,
    KES: 0, ZAR: 2, CDF: 0, RWF: 0, JPY: 0,
};

// ══════════════════════════════════════════════════════════════════════
// ÉTAT DYNAMIQUE — prix chargés depuis le backend + cache local
// ══════════════════════════════════════════════════════════════════════

interface DynamicPricingState {
    poiPrices: Record<string, number>;        // en XAF (devise de référence)
    microPrices: Record<string, number>;      // en XAF
    exchangeRates: Record<string, number>;    // XAF → devise
    lastFetchedAt: number;                    // timestamp ms
    source: 'backend' | 'cache' | 'fallback';
}

const PRICING_CACHE_KEY = 'nav_dynamic_pricing';
const PRICING_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 heures

let _dynamicState: DynamicPricingState = {
    poiPrices: { ...FALLBACK_POI_PRICES },
    microPrices: { ...FALLBACK_MICRO_PRICES },
    exchangeRates: { ...FALLBACK_EXCHANGE_RATES },
    lastFetchedAt: 0,
    source: 'fallback',
};

// ── Charger les tarifs depuis le backend ──
export async function fetchDynamicPricing(): Promise<DynamicPricingState> {
    try {
        // Essayer le cache d'abord
        if (_dynamicState.source === 'fallback') {
            try {
                const cached = await SafeStorage.getItem(PRICING_CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached) as DynamicPricingState;
                    if (Date.now() - parsed.lastFetchedAt < PRICING_CACHE_TTL) {
                        _dynamicState = { ...parsed, source: 'cache' };
                        console.log('[NavigationPricing] \uD83D\uDCE6 Tarifs chargés depuis le cache');
                        return _dynamicState;
                    }
                }
            } catch { /* cache invalide, continuer */ }
        }

        // Appel backend
        const response = await apiGet('/api/pricing/navigation') as any;
        const data = response?.data?.data || response?.data;

        if (data?.poi_prices || data?.micro_prices) {
            _dynamicState = {
                poiPrices: { ...FALLBACK_POI_PRICES, ...(data.poi_prices || {}) },
                microPrices: { ...FALLBACK_MICRO_PRICES, ...(data.micro_prices || {}) },
                exchangeRates: { ...FALLBACK_EXCHANGE_RATES, ...(data.exchange_rates || {}) },
                lastFetchedAt: Date.now(),
                source: 'backend',
            };

            // Persister en cache
            await SafeStorage.setItem(PRICING_CACHE_KEY, JSON.stringify(_dynamicState)).catch(() => { });
            console.log('[NavigationPricing] ✅ Tarifs dynamiques chargés depuis le backend');
        } else {
            console.log('[NavigationPricing] ⚠️ Réponse backend vide, utilisation fallback');
        }
    } catch (e) {
        console.warn('[NavigationPricing] ⚠️ Backend indisponible, utilisation fallback/cache:', e);
    }

    return _dynamicState;
}

// ── Accès aux prix actuels (dynamiques si disponibles) ──
export function getPoiPrices(): Record<string, number> {
    return _dynamicState.poiPrices;
}

export function getMicroPrices(): Record<string, number> {
    return _dynamicState.microPrices;
}

export function getPricingSource(): string {
    return _dynamicState.source;
}

// Alias pour compatibilité (les anciens consommateurs lisent POI_CATEGORY_PRICES)
export const POI_CATEGORY_PRICES = new Proxy(FALLBACK_POI_PRICES, {
    get: (_target, prop: string) => _dynamicState.poiPrices[prop] ?? FALLBACK_POI_PRICES[prop] ?? 0,
    ownKeys: () => Object.keys(_dynamicState.poiPrices),
    getOwnPropertyDescriptor: (_target, prop: string) => ({
        configurable: true, enumerable: true, value: _dynamicState.poiPrices[prop] ?? 0,
    }),
});

export const MICRO_FEATURE_PRICES = new Proxy(FALLBACK_MICRO_PRICES, {
    get: (_target, prop: string) => _dynamicState.microPrices[prop] ?? FALLBACK_MICRO_PRICES[prop] ?? 0,
    ownKeys: () => Object.keys(_dynamicState.microPrices),
    getOwnPropertyDescriptor: (_target, prop: string) => ({
        configurable: true, enumerable: true, value: _dynamicState.microPrices[prop] ?? 0,
    }),
});

// ══════════════════════════════════════════════════════════════════════
// CONVERSION MULTI-DEVISES
// ══════════════════════════════════════════════════════════════════════

// Convertir un montant XAF vers la devise cible
export function convertFromXAF(amountXAF: number, targetCurrency: string): number {
    if (targetCurrency === 'XAF' || !targetCurrency) return amountXAF;
    const rate = _dynamicState.exchangeRates[targetCurrency] ?? FALLBACK_EXCHANGE_RATES[targetCurrency];
    if (!rate) return amountXAF; // devise inconnue → garder XAF
    const decimals = CURRENCY_DECIMALS[targetCurrency] ?? 2;
    const factor = Math.pow(10, decimals);
    return Math.round(amountXAF * rate * factor) / factor;
}

// Convertir un montant de la devise source vers XAF (pour débit côté serveur)
export function convertToXAF(amount: number, sourceCurrency: string): number {
    if (sourceCurrency === 'XAF' || !sourceCurrency) return amount;
    const rate = _dynamicState.exchangeRates[sourceCurrency] ?? FALLBACK_EXCHANGE_RATES[sourceCurrency];
    if (!rate || rate === 0) return amount;
    return Math.round(amount / rate);
}

// ══════════════════════════════════════════════════════════════════════
// POLITIQUE DE SUSPENSION (inchangée)
// ══════════════════════════════════════════════════════════════════════

export const MICRO_PAYMENT_POLICY = {
    MAX_UNPAID_USES: 3,
    SUSPENSION_ALERT_THRESHOLD: 1,
    SUSPENSION_STORAGE_KEY: 'nav_micro_payment_failures',
    DEBT_STORAGE_KEY: 'nav_micro_payment_debt',
    DEBT_AUTO_RECOVER: true,
};

// ══════════════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES (multi-devises)
// ══════════════════════════════════════════════════════════════════════

// Estimation du coût POI en XAF (devise interne)
export function estimatePoiCost(selectedCategories: string[]): number {
    return selectedCategories.reduce((total, cat) => total + (_dynamicState.poiPrices[cat] ?? 0), 0);
}

// Estimation du coût POI dans la devise utilisateur
export function estimatePoiCostInCurrency(selectedCategories: string[], currency: string): number {
    const costXAF = estimatePoiCost(selectedCategories);
    return convertFromXAF(costXAF, currency);
}

export function isFeatureFree(feature: string): boolean {
    return (_dynamicState.microPrices[feature] ?? 0) === 0;
}

// Prix micro-feature en XAF (devise interne pour débit)
export function getMicroFeaturePrice(feature: string): number {
    return _dynamicState.microPrices[feature] ?? 0;
}

// Prix micro-feature dans la devise utilisateur (pour affichage)
export function getMicroFeaturePriceInCurrency(feature: string, currency: string): number {
    return convertFromXAF(getMicroFeaturePrice(feature), currency);
}

// Formatage du prix avec devise et symbole
export function formatPrice(amount: number, currency: string = 'XAF'): string {
    if (amount === 0) return 'Gratuit';
    const symbol = CURRENCY_SYMBOLS[currency] || currency;
    const decimals = CURRENCY_DECIMALS[currency] ?? 0;
    const formatted = amount.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
    // EUR/USD/GBP: symbole avant, Afrique: symbole après
    if (['EUR', 'USD', 'GBP', 'CAD', 'CHF'].includes(currency)) {
        return `${symbol}${formatted}`;
    }
    return `${formatted} ${symbol}`;
}

// Formatage d'un montant XAF dans la devise utilisateur
export function formatPriceInCurrency(amountXAF: number, currency: string): string {
    if (amountXAF === 0) return 'Gratuit';
    const converted = convertFromXAF(amountXAF, currency);
    return formatPrice(converted, currency);
}

// Résumé des prix POI dans la devise utilisateur
export function getPoiPricingSummary(
    selectedCategories: string[],
    poiCategoryLabels: Record<string, string>,
    currency: string = 'XAF',
): Array<{ category: string; label: string; price: number; priceFormatted: string }> {
    return selectedCategories.map(cat => {
        const priceXAF = _dynamicState.poiPrices[cat] ?? 0;
        const priceConverted = convertFromXAF(priceXAF, currency);
        return {
            category: cat,
            label: poiCategoryLabels[cat] || cat,
            price: priceConverted,
            priceFormatted: formatPrice(priceConverted, currency),
        };
    });
}

/** Distance en mètres → libellé court (liste POI, navigation) */
export function formatDistance(meters: number): string {
    const m = Number(meters) || 0;
    if (m >= 1000) {
        return `${(m / 1000).toFixed(1)} km`;
    }
    return `${Math.round(m)} m`;
}
