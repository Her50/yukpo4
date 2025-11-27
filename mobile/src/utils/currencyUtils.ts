/**
 * Utilitaire pour récupérer intelligemment la devise depuis une localisation
 * Utilise le champ quartier qui contient quartier, ville et pays
 */

export interface LocationObject {
    raw?: string;
    place_name?: string;
    quartier?: string;
    ville?: string;
    pays?: string;
    [key: string]: any;
}

/**
 * Mapping des pays vers leur devise principale
 */
const COUNTRY_CURRENCY_MAP: Record<string, string> = {
    // Afrique Centrale (CEMAC - Franc CFA)
    'Cameroun': 'XAF',
    'Côte d\'Ivoire': 'XOF',
    'Sénégal': 'XOF',
    'Mali': 'XOF',
    'Burkina Faso': 'XOF',
    'Niger': 'XOF',
    'Tchad': 'XAF',
    'Guinée': 'XOF',
    'Bénin': 'XOF',
    'Togo': 'XOF',
    'Congo': 'XAF',
    'Gabon': 'XAF',
    'Centrafrique': 'XAF',
    'Guinée équatoriale': 'XAF',

    // Autres pays africains
    'Nigeria': 'NGN',
    'Ghana': 'GHS',
    'Kenya': 'KES',
    'Afrique du Sud': 'ZAR',
    'Maroc': 'MAD',
    'Tunisie': 'TND',
    'Algérie': 'DZD',
    'Égypte': 'EGP',
    'Éthiopie': 'ETB',
    'Tanzanie': 'TZS',
    'Ouganda': 'UGX',
    'Rwanda': 'RWF',
    'Madagascar': 'MGA',
    'Mauritanie': 'MRU',
    'RD Congo': 'CDF',

    // Europe
    'France': 'EUR',
    'Belgique': 'EUR',
    'Suisse': 'CHF',
    'Allemagne': 'EUR',
    'Espagne': 'EUR',
    'Italie': 'EUR',
    'Royaume-Uni': 'GBP',
    'Portugal': 'EUR',

    // Amériques
    'États-Unis': 'USD',
    'Canada': 'CAD',
    'Brésil': 'BRL',
    'Mexique': 'MXN',

    // Asie
    'Chine': 'CNY',
    'Inde': 'INR',
    'Japon': 'JPY',
    'Corée du Sud': 'KRW',
    'Thaïlande': 'THB',

    // Autres
    'Arabie Saoudite': 'SAR',
    'Émirats arabes unis': 'AED',
    'Turquie': 'TRY',
};

/**
 * Extrait le pays depuis un LocationObject (quartier qui contient quartier, ville, pays)
 */
export const extractCountryFromLocation = (location: LocationObject | string | null): string | null => {
    if (!location) return null;

    // Si c'est une string, essayer de parser
    if (typeof location === 'string') {
        const locationLower = location.toLowerCase();

        // Chercher un pays connu dans la string
        for (const [country, _] of Object.entries(COUNTRY_CURRENCY_MAP)) {
            if (locationLower.includes(country.toLowerCase())) {
                return country;
            }
        }

        // Fallback: chercher des patterns communs
        if (locationLower.includes('cameroun') || locationLower.includes('douala') || locationLower.includes('yaoundé') || locationLower.includes('yaounde')) {
            return 'Cameroun';
        }
        if (locationLower.includes('côte d\'ivoire') || locationLower.includes('cote d\'ivoire') || locationLower.includes('abidjan')) {
            return 'Côte d\'Ivoire';
        }
        if (locationLower.includes('sénégal') || locationLower.includes('senegal') || locationLower.includes('dakar')) {
            return 'Sénégal';
        }

        return null;
    }

    // Si c'est un LocationObject
    if (typeof location === 'object') {
        // Priorité 1: champ pays explicite
        if (location.pays && typeof location.pays === 'string') {
            return location.pays;
        }

        // Priorité 2: parser depuis place_name ou raw
        const locationStr = location.place_name || location.raw || '';
        if (locationStr) {
            // Format: "Quartier, Ville, Pays" ou "Ville, Pays"
            const parts = locationStr.split(',').map(s => s.trim());
            if (parts.length >= 2) {
                const lastPart = parts[parts.length - 1];
                // Vérifier si c'est un pays connu
                for (const [country, _] of Object.entries(COUNTRY_CURRENCY_MAP)) {
                    if (lastPart.toLowerCase().includes(country.toLowerCase())) {
                        return country;
                    }
                }
                // Sinon retourner la dernière partie comme pays potentiel
                return lastPart;
            }
        }
    }

    return null;
};

/**
 * Récupère la devise depuis une localisation (LocationObject ou string)
 * Retourne 'XAF' par défaut si aucun pays n'est détecté
 */
export const getCurrencyFromLocation = (location: LocationObject | string | null): string => {
    const country = extractCountryFromLocation(location);
    if (!country) {
        // Par défaut XAF (Franc CFA) pour l'Afrique Centrale
        return 'XAF';
    }

    // Chercher la devise correspondante
    const currency = COUNTRY_CURRENCY_MAP[country];
    if (currency) {
        return currency;
    }

    // Fallback: chercher par similarité partielle
    const countryLower = country.toLowerCase();
    for (const [c, curr] of Object.entries(COUNTRY_CURRENCY_MAP)) {
        if (countryLower.includes(c.toLowerCase()) || c.toLowerCase().includes(countryLower)) {
            return curr;
        }
    }

    // Par défaut XAF
    return 'XAF';
};

/**
 * Récupère la devise depuis plusieurs sources (priorité: quartier > GPS > défaut)
 */
export const getCurrencyIntelligently = (
    quartier?: LocationObject | string | null,
    gpsLocation?: { lat: number; lng: number } | null
): string => {
    // Priorité 1: Quartier (contient pays)
    if (quartier) {
        const currency = getCurrencyFromLocation(quartier);
        if (currency && currency !== 'XAF') {
            return currency;
        }
    }

    // TODO: Priorité 2: GPS reverse geocoding (si nécessaire plus tard)
    // Pour l'instant on utilise le quartier uniquement

    // Par défaut
    return 'XAF';
};

