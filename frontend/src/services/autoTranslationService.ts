// 🌍 Service de traduction automatique intelligent
import { languageDetectionService } from './languageDetectionService';

export interface TranslationRequest {
    text: string;
    targetLanguage: string;
    sourceLanguage?: string;
    context?: string; // 'ui', 'content', 'notification', 'form'
}

export interface TranslationResult {
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
    confidence: number;
    cached: boolean;
    context: string;
}

export interface TranslationCache {
    [key: string]: {
        result: TranslationResult;
        timestamp: number;
        expiresAt: number;
    };
}

class AutoTranslationService {
    private static instance: AutoTranslationService;
    private cache: TranslationCache = {};
    private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 heures
    private readonly MAX_CACHE_SIZE = 1000;
    private isEnabled: boolean = true;

    public static getInstance(): AutoTranslationService {
        if (!AutoTranslationService.instance) {
            AutoTranslationService.instance = new AutoTranslationService();
        }
        return AutoTranslationService.instance;
    }

    constructor() {
        this.loadCache();
        this.cleanupExpiredCache();
    }

    /**
     * 🌍 Traduire un texte automatiquement
     */
    public async translateText(request: TranslationRequest): Promise<TranslationResult> {
        if (!this.isEnabled) {
            return this.createFallbackResult(request);
        }

        // 1. Vérifier le cache
        const cacheKey = this.generateCacheKey(request);
        const cached = this.cache[cacheKey];

        if (cached && cached.expiresAt > Date.now()) {
            console.log(`🌍 [AutoTranslation] Cache hit pour: ${request.text.substring(0, 50)}...`);
            return { ...cached.result, cached: true };
        }

        // 2. Détecter la langue source si non fournie
        const sourceLanguage = request.sourceLanguage || await this.detectLanguage(request.text);

        // 3. Si même langue, pas de traduction nécessaire
        if (sourceLanguage === request.targetLanguage) {
            const result = this.createFallbackResult(request, sourceLanguage);
            this.cacheResult(cacheKey, result);
            return result;
        }

        // 4. Effectuer la traduction
        try {
            const translatedText = await this.callGoogleTranslate(
                request.text,
                sourceLanguage,
                request.targetLanguage
            );

            const result: TranslationResult = {
                translatedText,
                sourceLanguage,
                targetLanguage: request.targetLanguage,
                confidence: 0.9,
                cached: false,
                context: request.context || 'ui'
            };

            // 5. Mettre en cache
            this.cacheResult(cacheKey, result);

            // 6. Enregistrer l'usage de la langue
            languageDetectionService.recordLanguageUsage(request.targetLanguage, request.context || 'translation');

            console.log(`🌍 [AutoTranslation] Traduit: ${sourceLanguage} → ${request.targetLanguage}`);
            return result;

        } catch (error) {
            console.warn('⚠️ [AutoTranslation] Erreur traduction:', error);
            return this.createFallbackResult(request, sourceLanguage);
        }
    }

    /**
     * 🎯 Traduire automatiquement selon les préférences utilisateur
     */
    public async translateToUserLanguage(text: string, context: string = 'ui'): Promise<TranslationResult> {
        const userLanguage = languageDetectionService.getCurrentLanguage();

        return this.translateText({
            text,
            targetLanguage: userLanguage,
            context
        });
    }

    /**
     * 📝 Traduire un objet complet (formulaires, contenus)
     */
    public async translateObject(obj: any, targetLanguage: string, context: string = 'content'): Promise<any> {
        if (typeof obj === 'string') {
            const result = await this.translateText({ text: obj, targetLanguage, context });
            return result.translatedText;
        }

        if (Array.isArray(obj)) {
            return Promise.all(obj.map(item => this.translateObject(item, targetLanguage, context)));
        }

        if (obj && typeof obj === 'object') {
            const translated: any = {};
            for (const [key, value] of Object.entries(obj)) {
                // Traduire seulement les clés de texte (pas les IDs, URLs, etc.)
                if (this.shouldTranslateKey(key)) {
                    translated[key] = await this.translateObject(value, targetLanguage, context);
                } else {
                    translated[key] = value;
                }
            }
            return translated;
        }

        return obj;
    }

    /**
     * 🔄 Traduire les éléments DOM automatiquement
     */
    public async translateDOM(targetLanguage: string, selector: string = '[data-translate]'): Promise<void> {
        const elements = document.querySelectorAll(selector);

        for (const element of elements) {
            const originalText = element.textContent;
            if (!originalText || originalText.trim().length === 0) continue;

            try {
                const result = await this.translateText({
                    text: originalText,
                    targetLanguage,
                    context: 'ui'
                });

                if (result.translatedText !== originalText) {
                    element.textContent = result.translatedText;
                    element.setAttribute('data-translated', 'true');
                    element.setAttribute('data-original-text', originalText);
                }
            } catch (error) {
                console.warn('⚠️ [AutoTranslation] Erreur traduction DOM:', error);
            }
        }
    }

    /**
     * 🌐 Appel à l'API Google Translate
     */
    private async callGoogleTranslate(text: string, sourceLang: string, targetLang: string): Promise<string> {
        const apiKey = import.meta.env.VITE_GOOGLE_TRANSLATE_API_KEY;

        if (!apiKey) {
            console.warn('⚠️ [AutoTranslation] Clé API Google Translate manquante');
            throw new Error('API key not configured');
        }

        const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: text,
                source: sourceLang,
                target: targetLang,
                format: 'text'
            })
        });

        if (!response.ok) {
            throw new Error(`Google Translate API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.data?.translations?.[0]?.translatedText) {
            return data.data.translations[0].translatedText;
        }

        throw new Error('Invalid response from Google Translate API');
    }

    /**
     * 🔍 Détecter la langue d'un texte
     */
    private async detectLanguage(text: string): Promise<string> {
        // Utiliser le service de détection existant
        const detection = await languageDetectionService.detectOptimalLanguage();
        return detection.language;
    }

    /**
     * 🗝️ Générer une clé de cache
     */
    private generateCacheKey(request: TranslationRequest): string {
        return `${request.sourceLanguage || 'auto'}_${request.targetLanguage}_${request.context || 'ui'}_${btoa(request.text)}`;
    }

    /**
     * 💾 Mettre en cache un résultat
     */
    private cacheResult(key: string, result: TranslationResult): void {
        // Nettoyer le cache si nécessaire
        if (Object.keys(this.cache).length >= this.MAX_CACHE_SIZE) {
            this.cleanupOldCache();
        }

        this.cache[key] = {
            result,
            timestamp: Date.now(),
            expiresAt: Date.now() + this.CACHE_DURATION
        };

        this.saveCache();
    }

    /**
     * 🧹 Nettoyer le cache expiré
     */
    private cleanupExpiredCache(): void {
        const now = Date.now();
        Object.keys(this.cache).forEach(key => {
            if (this.cache[key].expiresAt <= now) {
                delete this.cache[key];
            }
        });
        this.saveCache();
    }

    /**
     * 🧹 Nettoyer les anciens éléments du cache
     */
    private cleanupOldCache(): void {
        const entries = Object.entries(this.cache)
            .sort(([, a], [, b]) => a.timestamp - b.timestamp);

        // Supprimer les 20% les plus anciens
        const toDelete = Math.floor(entries.length * 0.2);
        for (let i = 0; i < toDelete; i++) {
            delete this.cache[entries[i][0]];
        }
    }

    /**
     * 💾 Sauvegarder le cache
     */
    private saveCache(): void {
        try {
            localStorage.setItem('yukpo_translation_cache', JSON.stringify(this.cache));
        } catch (error) {
            console.warn('⚠️ [AutoTranslation] Erreur sauvegarde cache:', error);
        }
    }

    /**
     * 📂 Charger le cache
     */
    private loadCache(): void {
        try {
            const stored = localStorage.getItem('yukpo_translation_cache');
            if (stored) {
                this.cache = JSON.parse(stored);
                console.log(`🌍 [AutoTranslation] Cache chargé: ${Object.keys(this.cache).length} entrées`);
            }
        } catch (error) {
            console.warn('⚠️ [AutoTranslation] Erreur chargement cache:', error);
            this.cache = {};
        }
    }

    /**
     * 🎯 Créer un résultat de fallback
     */
    private createFallbackResult(request: TranslationRequest, sourceLanguage?: string): TranslationResult {
        return {
            translatedText: request.text,
            sourceLanguage: sourceLanguage || 'unknown',
            targetLanguage: request.targetLanguage,
            confidence: 0.5,
            cached: false,
            context: request.context || 'ui'
        };
    }

    /**
     * 🔍 Déterminer si une clé doit être traduite
     */
    private shouldTranslateKey(key: string): boolean {
        const nonTranslatableKeys = [
            'id', 'url', 'email', 'phone', 'gps', 'coordinates', 'latitude', 'longitude',
            'price', 'amount', 'quantity', 'count', 'number', 'date', 'time', 'timestamp',
            'status', 'type', 'category', 'tags', 'metadata', 'config', 'settings'
        ];

        return !nonTranslatableKeys.includes(key.toLowerCase());
    }

    /**
     * ⚙️ Activer/désactiver la traduction automatique
     */
    public setEnabled(enabled: boolean): void {
        this.isEnabled = enabled;
        localStorage.setItem('yukpo_auto_translation_enabled', enabled.toString());
        console.log(`🌍 [AutoTranslation] Traduction automatique ${enabled ? 'activée' : 'désactivée'}`);
    }

    /**
     * 📊 Obtenir les statistiques du cache
     */
    public getCacheStats(): { size: number; hitRate: number } {
        const totalRequests = Object.values(this.cache).reduce((sum, item) => sum + 1, 0);
        const cacheHits = Object.values(this.cache).filter(item => item.result.cached).length;

        return {
            size: Object.keys(this.cache).length,
            hitRate: totalRequests > 0 ? cacheHits / totalRequests : 0
        };
    }

    /**
     * 🧹 Vider le cache
     */
    public clearCache(): void {
        this.cache = {};
        this.saveCache();
        console.log('🧹 [AutoTranslation] Cache vidé');
    }
}

export const autoTranslationService = AutoTranslationService.getInstance();
export default autoTranslationService;

