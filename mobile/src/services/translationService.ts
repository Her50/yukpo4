// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import { ENVIRONMENT } from '../config/environment';
import SafeStorage from '../utils/safeStorage';

export interface TranslationResult {
    translatedText: string;
    detectedLanguage: string;
    confidence: number;
}

export interface LanguageConfig {
    code: string;
    name: string;
    nativeName: string;
    flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
    { code: 'fr', name: 'Français', nativeName: 'Français', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
    { code: 'en', name: 'English', nativeName: 'English', flag: '\uD83C\uDDFA\uD83C\uDDF8' },
    { code: 'es', name: 'Español', nativeName: 'Español', flag: '\uD83C\uDDEA\uD83C\uDDF8' },
    { code: 'de', name: 'Deutsch', nativeName: 'Deutsch', flag: '\uD83C\uDDE9\uD83C\uDDEA' },
    { code: 'it', name: 'Italiano', nativeName: 'Italiano', flag: '\uD83C\uDDEE\uD83C\uDDF9' },
    { code: 'pt', name: 'Português', nativeName: 'Português', flag: '\uD83C\uDDF5\uD83C\uDDF9' },
    { code: 'ar', name: 'العربية', nativeName: 'العربية', flag: '\uD83C\uDDF8\uD83C\uDDE6' },
    { code: 'zh', name: '中文', nativeName: '中文', flag: '\uD83C\uDDE8\uD83C\uDDF3' },
    { code: 'ja', name: '日本語', nativeName: '日本語', flag: '\uD83C\uDDEF\uD83C\uDDF5' },
    { code: 'ko', name: '한국어', nativeName: '한국어', flag: '\uD83C\uDDF0\uD83C\uDDF7' },
    { code: 'ru', name: 'Русский', nativeName: 'Русский', flag: '\uD83C\uDDF7\uD83C\uDDFA' },
    { code: 'hi', name: 'हिन्दी', nativeName: 'हिन्दी', flag: '\uD83C\uDDEE\uD83C\uDDF3' },
];

export class TranslationService {
    private static instance: TranslationService;
    private apiKey: string;
    private baseUrl = 'https://translation.googleapis.com/language/translate/v2';
    private currentLanguage: string = ENVIRONMENT.TRANSLATION.DEFAULT_LANGUAGE;
    private cache: Map<string, string> = new Map();

    private constructor() {
        // La clé API sera chargée depuis la configuration
        this.apiKey = ENVIRONMENT.GOOGLE_TRANSLATE_API_KEY;
        this.loadLanguage();
    }

    public static getInstance(): TranslationService {
        if (!TranslationService.instance) {
            TranslationService.instance = new TranslationService();
        }
        return TranslationService.instance;
    }

    /**
     * Charger la langue préférée depuis AsyncStorage
     */
    private async loadLanguage(): Promise<void> {
        try {
            const savedLanguage = await SafeStorage.getItem('yukpo_language');
            if (savedLanguage && SUPPORTED_LANGUAGES.some(lang => lang.code === savedLanguage)) {
                this.currentLanguage = savedLanguage;
            }
        } catch (error) {
            console.warn('Erreur lors du chargement de la langue:', error);
        }
    }

    /**
     * Sauvegarder la langue préférée
     */
    private async saveLanguage(language: string): Promise<void> {
        try {
            await SafeStorage.setItem('yukpo_language', language);
            this.currentLanguage = language;
        } catch (error) {
            console.warn('Erreur lors de la sauvegarde de la langue:', error);
        }
    }

    /**
     * Obtenir la langue actuelle
     */
    public getCurrentLanguage(): string {
        return this.currentLanguage;
    }

    /**
     * Changer la langue
     */
    public async setLanguage(languageCode: string): Promise<void> {
        if (SUPPORTED_LANGUAGES.some(lang => lang.code === languageCode)) {
            await this.saveLanguage(languageCode);
            // Vider le cache pour forcer la retraduction
            this.cache.clear();
        }
    }

    /**
     * Détecter la langue d'un texte
     */
    async detectLanguage(text: string): Promise<string> {
        if (!this.apiKey) {
            return 'fr'; // Fallback
        }

        try {
            const response = await fetch(`${this.baseUrl}/detect?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text,
                }),
            });

            if (!response.ok) {
                throw new Error(`Erreur détection langue: ${response.status}`);
            }

            const data = await response.json();
            return data.data.detections[0][0].language;
        } catch (error) {
            console.warn('Erreur détection langue:', error);
            return 'fr'; // Fallback
        }
    }

    /**
     * Traduire un texte vers la langue actuelle
     */
    async translateText(
        text: string,
        targetLanguage?: string,
        sourceLanguage?: string
    ): Promise<TranslationResult> {
        const target = targetLanguage || this.currentLanguage;

        // Vérifier le cache
        const cacheKey = `${text}_${sourceLanguage || 'auto'}_${target}`;
        if (this.cache.has(cacheKey)) {
            return {
                translatedText: this.cache.get(cacheKey)!,
                detectedLanguage: sourceLanguage || 'auto',
                confidence: 1.0
            };
        }

        if (!this.apiKey) {
            console.warn('Clé API Google Translate non configurée');
            return {
                translatedText: text,
                detectedLanguage: 'unknown',
                confidence: 0
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: text,
                    target: target,
                    source: sourceLanguage,
                    format: 'text',
                }),
            });

            if (!response.ok) {
                throw new Error(`Erreur traduction: ${response.status}`);
            }

            const data = await response.json();
            const result = data.data.translations[0];

            // Mettre en cache
            this.cache.set(cacheKey, result.translatedText);

            return {
                translatedText: result.translatedText,
                detectedLanguage: result.detectedSourceLanguage || sourceLanguage || 'auto',
                confidence: 0.9
            };
        } catch (error) {
            console.warn('Erreur traduction:', error);
            return {
                translatedText: text,
                detectedLanguage: 'unknown',
                confidence: 0
            };
        }
    }

    /**
     * Traduire plusieurs textes en une seule requête
     */
    async translateBatch(
        texts: string[],
        targetLanguage?: string,
        sourceLanguage?: string
    ): Promise<TranslationResult[]> {
        const target = targetLanguage || this.currentLanguage;

        if (!this.apiKey) {
            return texts.map(text => ({
                translatedText: text,
                detectedLanguage: 'unknown',
                confidence: 0
            }));
        }

        try {
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: texts,
                    target: target,
                    source: sourceLanguage,
                    format: 'text',
                }),
            });

            if (!response.ok) {
                throw new Error(`Erreur traduction batch: ${response.status}`);
            }

            const data = await response.json();
            return data.data.translations.map((result: any, index: number) => ({
                translatedText: result.translatedText,
                detectedLanguage: result.detectedSourceLanguage || sourceLanguage || 'auto',
                confidence: 0.9
            }));
        } catch (error) {
            console.warn('Erreur traduction batch:', error);
            return texts.map(text => ({
                translatedText: text,
                detectedLanguage: 'unknown',
                confidence: 0
            }));
        }
    }

    /**
     * Traduire un texte avec fallback (retourne le texte original si la traduction échoue)
     */
    async translateWithFallback(
        text: string,
        targetLanguage?: string,
        sourceLanguage?: string
    ): Promise<string> {
        const result = await this.translateText(text, targetLanguage, sourceLanguage);
        return result.translatedText || text;
    }

    /**
     * Obtenir les langues supportées
     */
    public getSupportedLanguages(): LanguageConfig[] {
        return SUPPORTED_LANGUAGES;
    }

    /**
     * Obtenir la configuration d'une langue
     */
    public getLanguageConfig(languageCode: string): LanguageConfig | undefined {
        return SUPPORTED_LANGUAGES.find(lang => lang.code === languageCode);
    }

    /**
     * Vider le cache de traduction
     */
    public clearCache(): void {
        this.cache.clear();
    }

    /**
     * Obtenir la taille du cache
     */
    public getCacheSize(): number {
        return this.cache.size;
    }
}

export default TranslationService;
