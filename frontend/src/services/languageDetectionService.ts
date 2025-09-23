// 🌍 Service de détection intelligente de langue basée sur GPS, habitudes utilisateur et préférences
import { geocodingService } from './geocodingService';

export interface LanguageDetectionResult {
    language: string;
    confidence: number;
    source: 'gps' | 'browser' | 'stored' | 'user_behavior' | 'fallback';
    country?: string;
    region?: string;
    reasoning?: string;
}

export interface UserLanguageBehavior {
    language: string;
    usageCount: number;
    lastUsed: Date;
    contexts: string[]; // 'search', 'form', 'chat', 'navigation'
    confidence: number;
}

export interface CountryLanguageMapping {
    [countryCode: string]: {
        primary: string;
        secondary?: string[];
        confidence: number;
    };
}

// 🗺️ Mapping pays → langues (basé sur les données réelles)
const COUNTRY_LANGUAGE_MAPPING: CountryLanguageMapping = {
    // Afrique
    'CM': { primary: 'fr', secondary: ['en'], confidence: 0.9 }, // Cameroun
    'SN': { primary: 'fr', secondary: ['ff'], confidence: 0.9 }, // Sénégal
    'CI': { primary: 'fr', secondary: ['ff'], confidence: 0.9 }, // Côte d'Ivoire
    'BF': { primary: 'fr', secondary: ['ff'], confidence: 0.9 }, // Burkina Faso
    'ML': { primary: 'fr', secondary: ['ff'], confidence: 0.9 }, // Mali
    'NE': { primary: 'fr', secondary: ['ff'], confidence: 0.9 }, // Niger
    'TD': { primary: 'fr', secondary: ['ar'], confidence: 0.8 }, // Tchad
    'CF': { primary: 'fr', secondary: ['ff'], confidence: 0.8 }, // Centrafrique
    'GA': { primary: 'fr', confidence: 0.9 }, // Gabon
    'CG': { primary: 'fr', confidence: 0.9 }, // Congo
    'CD': { primary: 'fr', secondary: ['en'], confidence: 0.8 }, // RDC
    'MG': { primary: 'fr', confidence: 0.9 }, // Madagascar
    'MA': { primary: 'ar', secondary: ['fr'], confidence: 0.9 }, // Maroc
    'DZ': { primary: 'ar', secondary: ['fr'], confidence: 0.9 }, // Algérie
    'TN': { primary: 'ar', secondary: ['fr'], confidence: 0.9 }, // Tunisie
    'EG': { primary: 'ar', confidence: 0.9 }, // Égypte
    'NG': { primary: 'en', secondary: ['ff'], confidence: 0.9 }, // Nigeria
    'GH': { primary: 'en', confidence: 0.9 }, // Ghana
    'KE': { primary: 'en', confidence: 0.9 }, // Kenya
    'ZA': { primary: 'en', confidence: 0.9 }, // Afrique du Sud
    'AO': { primary: 'pt', confidence: 0.9 }, // Angola
    'MZ': { primary: 'pt', confidence: 0.9 }, // Mozambique
    'CV': { primary: 'pt', confidence: 0.9 }, // Cap-Vert
    'GW': { primary: 'pt', confidence: 0.9 }, // Guinée-Bissau
    'ST': { primary: 'pt', confidence: 0.9 }, // São Tomé

    // Europe
    'FR': { primary: 'fr', confidence: 0.95 },
    'BE': { primary: 'fr', secondary: ['en'], confidence: 0.9 },
    'CH': { primary: 'fr', secondary: ['en'], confidence: 0.8 },
    'GB': { primary: 'en', confidence: 0.95 },
    'US': { primary: 'en', confidence: 0.95 },
    'CA': { primary: 'en', secondary: ['fr'], confidence: 0.9 },
    'PT': { primary: 'pt', confidence: 0.95 },
    'BR': { primary: 'pt', confidence: 0.95 },

    // Moyen-Orient
    'SA': { primary: 'ar', confidence: 0.95 },
    'AE': { primary: 'ar', secondary: ['en'], confidence: 0.9 },
    'IQ': { primary: 'ar', confidence: 0.9 },
    'SY': { primary: 'ar', confidence: 0.9 },
    'LB': { primary: 'ar', secondary: ['fr'], confidence: 0.8 },

    // Asie
    'IN': { primary: 'en', confidence: 0.8 },
    'CN': { primary: 'en', confidence: 0.7 },
    'JP': { primary: 'en', confidence: 0.7 },
};

class LanguageDetectionService {
    private static instance: LanguageDetectionService;
    private currentLanguage: string = 'fr';
    private detectionHistory: LanguageDetectionResult[] = [];
    private userBehaviorData: UserLanguageBehavior[] = [];

    public static getInstance(): LanguageDetectionService {
        if (!LanguageDetectionService.instance) {
            LanguageDetectionService.instance = new LanguageDetectionService();
        }
        return LanguageDetectionService.instance;
    }

    constructor() {
        this.loadUserBehaviorData();
    }

    /**
     * 🎯 Détection intelligente de langue basée sur GPS
     */
    public async detectLanguageFromGPS(): Promise<LanguageDetectionResult> {
        try {
            console.log('🌍 [LanguageDetection] Détection de langue basée sur GPS...');

            // 1. Obtenir la position GPS
            const position = await this.getCurrentPosition();
            if (!position) {
                return this.getFallbackDetection();
            }

            // 2. Convertir GPS en pays
            const countryInfo = await this.getCountryFromCoordinates(
                position.coords.latitude,
                position.coords.longitude
            );

            if (!countryInfo) {
                return this.getFallbackDetection();
            }

            // 3. Mapper pays → langue
            const languageMapping = COUNTRY_LANGUAGE_MAPPING[countryInfo.countryCode];
            if (!languageMapping) {
                console.log(`🌍 [LanguageDetection] Pays ${countryInfo.countryCode} non mappé, utilisation du fallback`);
                return this.getFallbackDetection();
            }

            const result: LanguageDetectionResult = {
                language: languageMapping.primary,
                confidence: languageMapping.confidence,
                source: 'gps',
                country: countryInfo.countryCode,
                region: countryInfo.region
            };

            console.log(`🌍 [LanguageDetection] Langue détectée via GPS: ${result.language} (${result.country}) - Confiance: ${result.confidence}`);

            this.detectionHistory.push(result);
            return result;

        } catch (error) {
            console.warn('⚠️ [LanguageDetection] Erreur détection GPS:', error);
            return this.getFallbackDetection();
        }
    }

    /**
     * 🌐 Détection basée sur le navigateur
     */
    public detectLanguageFromBrowser(): LanguageDetectionResult {
        const browserLang = navigator.language.split('-')[0];
        const supportedLanguages = ['fr', 'en', 'pt', 'ar', 'ff'];

        const language = supportedLanguages.includes(browserLang) ? browserLang : 'fr';

        const result: LanguageDetectionResult = {
            language,
            confidence: 0.8,
            source: 'browser',
            country: navigator.language.split('-')[1] || undefined
        };

        console.log(`🌍 [LanguageDetection] Langue détectée via navigateur: ${result.language} - Confiance: ${result.confidence}`);

        this.detectionHistory.push(result);
        return result;
    }

    /**
     * 💾 Détection basée sur les préférences stockées
     */
    public detectLanguageFromStorage(): LanguageDetectionResult | null {
        const storedLang = localStorage.getItem('yukpo_preferred_language');
        if (!storedLang) return null;

        const result: LanguageDetectionResult = {
            language: storedLang,
            confidence: 0.95,
            source: 'stored'
        };

        console.log(`🌍 [LanguageDetection] Langue détectée via stockage: ${result.language} - Confiance: ${result.confidence}`);

        this.detectionHistory.push(result);
        return result;
    }

    /**
     * 🧠 Détection basée sur les habitudes d'utilisation
     */
    public detectLanguageFromUserBehavior(): LanguageDetectionResult | null {
        if (this.userBehaviorData.length === 0) return null;

        // Trier par usage et confiance
        const sortedBehaviors = this.userBehaviorData
            .sort((a, b) => {
                // Priorité: usage récent + fréquence élevée
                const scoreA = a.usageCount * 0.7 + (a.confidence * 10) * 0.3;
                const scoreB = b.usageCount * 0.7 + (b.confidence * 10) * 0.3;
                return scoreB - scoreA;
            });

        const topBehavior = sortedBehaviors[0];
        if (!topBehavior || topBehavior.usageCount < 3) return null;

        const result: LanguageDetectionResult = {
            language: topBehavior.language,
            confidence: Math.min(0.9, topBehavior.confidence + (topBehavior.usageCount * 0.1)),
            source: 'user_behavior',
            reasoning: `Basé sur ${topBehavior.usageCount} utilisations récentes dans les contextes: ${topBehavior.contexts.join(', ')}`
        };

        console.log(`🧠 [LanguageDetection] Langue détectée via comportement: ${result.language} - Confiance: ${result.confidence}`);
        this.detectionHistory.push(result);
        return result;
    }

    /**
     * 🎯 Détection intelligente complète (Comportement + GPS + Browser + Storage)
     * Suit les meilleures pratiques de l'industrie
     */
    public async detectOptimalLanguage(): Promise<LanguageDetectionResult> {
        console.log('🌍 [LanguageDetection] Démarrage de la détection intelligente avancée...');

        // 1. PRIORITÉ MAXIMALE: Préférence utilisateur stockée (explicite)
        const storedDetection = this.detectLanguageFromStorage();
        if (storedDetection && storedDetection.confidence > 0.9) {
            console.log('🌍 [LanguageDetection] ✅ Utilisation de la préférence utilisateur explicite');
            return { ...storedDetection, reasoning: 'Préférence utilisateur explicite' };
        }

        // 2. PRIORITÉ ÉLEVÉE: Habitudes d'utilisation (comportement appris)
        const behaviorDetection = this.detectLanguageFromUserBehavior();
        if (behaviorDetection && behaviorDetection.confidence > 0.7) {
            console.log('🌍 [LanguageDetection] ✅ Utilisation des habitudes d\'utilisation');
            return behaviorDetection;
        }

        // 3. PRIORITÉ MOYENNE: Détection GPS (localisation actuelle)
        try {
            const gpsDetection = await this.detectLanguageFromGPS();
            if (gpsDetection.confidence > 0.6) {
                console.log('🌍 [LanguageDetection] ✅ Utilisation de la détection GPS');
                return { ...gpsDetection, reasoning: `Basé sur la localisation GPS (${gpsDetection.country})` };
            }
        } catch (error) {
            console.warn('⚠️ [LanguageDetection] Détection GPS échouée, passage au navigateur');
        }

        // 4. PRIORITÉ FAIBLE: Navigateur (Accept-Language header)
        const browserDetection = this.detectLanguageFromBrowser();
        console.log('🌍 [LanguageDetection] ✅ Utilisation de la langue du navigateur');
        return { ...browserDetection, reasoning: 'Basé sur les paramètres du navigateur' };
    }

    /**
     * 📍 Obtenir la position GPS actuelle
     */
    private getCurrentPosition(): Promise<GeolocationPosition | null> {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => resolve(position),
                (error) => {
                    console.warn('⚠️ [LanguageDetection] Erreur GPS:', error.message);
                    resolve(null);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutes de cache
                }
            );
        });
    }

    /**
     * 🗺️ Convertir coordonnées en informations de pays
     */
    private async getCountryFromCoordinates(lat: number, lng: number): Promise<{ countryCode: string; region?: string } | null> {
        try {
            // Utiliser le service de géocodage existant
            const locationName = await geocodingService.getLocationFromCoordinates(lat, lng);

            // Extraire le code pays de la réponse (format: "Ville, Région, Pays")
            const parts = locationName.split(',').map(part => part.trim());
            if (parts.length < 2) return null;

            const countryName = parts[parts.length - 1];

            // Mapping des noms de pays vers codes ISO
            const countryNameToCode: { [key: string]: string } = {
                'Cameroun': 'CM',
                'Cameroon': 'CM',
                'Sénégal': 'SN',
                'Senegal': 'SN',
                'Côte d\'Ivoire': 'CI',
                'Ivory Coast': 'CI',
                'Burkina Faso': 'BF',
                'Mali': 'ML',
                'Niger': 'NE',
                'Tchad': 'TD',
                'Chad': 'TD',
                'Centrafrique': 'CF',
                'Central African Republic': 'CF',
                'Gabon': 'GA',
                'Congo': 'CG',
                'République démocratique du Congo': 'CD',
                'Democratic Republic of the Congo': 'CD',
                'Madagascar': 'MG',
                'Maroc': 'MA',
                'Morocco': 'MA',
                'Algérie': 'DZ',
                'Algeria': 'DZ',
                'Tunisie': 'TN',
                'Tunisia': 'TN',
                'Égypte': 'EG',
                'Egypt': 'EG',
                'Nigeria': 'NG',
                'Ghana': 'GH',
                'Kenya': 'KE',
                'Afrique du Sud': 'ZA',
                'South Africa': 'ZA',
                'Angola': 'AO',
                'Mozambique': 'MZ',
                'Cap-Vert': 'CV',
                'Cape Verde': 'CV',
                'Guinée-Bissau': 'GW',
                'Guinea-Bissau': 'GW',
                'São Tomé et Príncipe': 'ST',
                'São Tomé and Príncipe': 'ST',
                'France': 'FR',
                'Belgique': 'BE',
                'Belgium': 'BE',
                'Suisse': 'CH',
                'Switzerland': 'CH',
                'Royaume-Uni': 'GB',
                'United Kingdom': 'GB',
                'États-Unis': 'US',
                'United States': 'US',
                'Canada': 'CA',
                'Portugal': 'PT',
                'Brésil': 'BR',
                'Brazil': 'BR',
                'Arabie saoudite': 'SA',
                'Saudi Arabia': 'SA',
                'Émirats arabes unis': 'AE',
                'United Arab Emirates': 'AE',
                'Irak': 'IQ',
                'Iraq': 'IQ',
                'Syrie': 'SY',
                'Syria': 'SY',
                'Liban': 'LB',
                'Lebanon': 'LB',
                'Inde': 'IN',
                'India': 'IN',
                'Chine': 'CN',
                'China': 'CN',
                'Japon': 'JP',
                'Japan': 'JP'
            };

            const countryCode = countryNameToCode[countryName];
            if (!countryCode) {
                console.warn(`⚠️ [LanguageDetection] Pays non reconnu: ${countryName}`);
                return null;
            }

            return {
                countryCode,
                region: parts.length > 2 ? parts[parts.length - 2] : undefined
            };

        } catch (error) {
            console.warn('⚠️ [LanguageDetection] Erreur géocodage:', error);
            return null;
        }
    }

    /**
     * 🔄 Fallback par défaut
     */
    private getFallbackDetection(): LanguageDetectionResult {
        const result: LanguageDetectionResult = {
            language: 'fr',
            confidence: 0.5,
            source: 'fallback'
        };

        console.log('🌍 [LanguageDetection] Utilisation du fallback: français');
        this.detectionHistory.push(result);
        return result;
    }

    /**
     * 💾 Sauvegarder la préférence de langue
     */
    public saveLanguagePreference(language: string): void {
        localStorage.setItem('yukpo_preferred_language', language);
        this.currentLanguage = language;
        console.log(`🌍 [LanguageDetection] Préférence de langue sauvegardée: ${language}`);
    }

    /**
     * 📊 Obtenir l'historique de détection
     */
    public getDetectionHistory(): LanguageDetectionResult[] {
        return [...this.detectionHistory];
    }

    /**
     * 🎯 Obtenir la langue actuelle
     */
    public getCurrentLanguage(): string {
        return this.currentLanguage;
    }

    /**
     * 📊 Enregistrer l'utilisation d'une langue dans un contexte
     */
    public recordLanguageUsage(language: string, context: string): void {
        const existingBehavior = this.userBehaviorData.find(b => b.language === language);

        if (existingBehavior) {
            existingBehavior.usageCount += 1;
            existingBehavior.lastUsed = new Date();
            existingBehavior.confidence = Math.min(0.95, existingBehavior.confidence + 0.05);

            if (!existingBehavior.contexts.includes(context)) {
                existingBehavior.contexts.push(context);
            }
        } else {
            this.userBehaviorData.push({
                language,
                usageCount: 1,
                lastUsed: new Date(),
                contexts: [context],
                confidence: 0.6
            });
        }

        // Sauvegarder les données
        this.saveUserBehaviorData();

        console.log(`📊 [LanguageDetection] Usage enregistré: ${language} dans le contexte ${context}`);
    }

    /**
     * 💾 Charger les données de comportement utilisateur
     */
    private loadUserBehaviorData(): void {
        try {
            const stored = localStorage.getItem('yukpo_language_behavior');
            if (stored) {
                const parsed = JSON.parse(stored);
                this.userBehaviorData = parsed.map((item: any) => ({
                    ...item,
                    lastUsed: new Date(item.lastUsed)
                }));
                console.log(`📊 [LanguageDetection] Données de comportement chargées: ${this.userBehaviorData.length} entrées`);
            }
        } catch (error) {
            console.warn('⚠️ [LanguageDetection] Erreur chargement comportement:', error);
            this.userBehaviorData = [];
        }
    }

    /**
     * 💾 Sauvegarder les données de comportement utilisateur
     */
    private saveUserBehaviorData(): void {
        try {
            localStorage.setItem('yukpo_language_behavior', JSON.stringify(this.userBehaviorData));
        } catch (error) {
            console.warn('⚠️ [LanguageDetection] Erreur sauvegarde comportement:', error);
        }
    }

    /**
     * 🧹 Nettoyer les anciennes données de comportement (> 30 jours)
     */
    public cleanupOldBehaviorData(): void {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        this.userBehaviorData = this.userBehaviorData.filter(behavior =>
            behavior.lastUsed > thirtyDaysAgo
        );

        this.saveUserBehaviorData();
        console.log(`🧹 [LanguageDetection] Nettoyage des données anciennes effectué`);
    }

    /**
     * 📈 Obtenir les statistiques d'utilisation des langues
     */
    public getLanguageUsageStats(): { language: string; usageCount: number; contexts: string[] }[] {
        return this.userBehaviorData
            .sort((a, b) => b.usageCount - a.usageCount)
            .map(behavior => ({
                language: behavior.language,
                usageCount: behavior.usageCount,
                contexts: behavior.contexts
            }));
    }

    /**
     * 🔄 Réinitialiser les données de comportement
     */
    public resetBehaviorData(): void {
        this.userBehaviorData = [];
        this.saveUserBehaviorData();
        console.log('🔄 [LanguageDetection] Données de comportement réinitialisées');
    }
}

export const languageDetectionService = LanguageDetectionService.getInstance();
export default languageDetectionService;
