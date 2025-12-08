/**
 * Service de détection de langue et d'apprentissage des préférences utilisateur
 * Analyse le comportement utilisateur pour déterminer la langue préférée
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const BEHAVIOR_DATA_KEY = 'language_behavior_data';
const USAGE_STATS_KEY = 'language_usage_stats';
const MAX_BEHAVIOR_ENTRIES = 1000; // Limiter la taille des données
const MAX_AGE_DAYS = 90; // Supprimer les données de plus de 90 jours

interface LanguageBehaviorEntry {
    timestamp: number;
    language: string;
    context: string;
    platform: string;
    action?: string;
}

interface LanguageUsageStat {
    language: string;
    count: number;
    lastUsed: number;
    contexts: string[];
}

class LanguageDetectionService {
    private behaviorData: LanguageBehaviorEntry[] = [];
    private usageStats: Map<string, LanguageUsageStat> = new Map();

    /**
     * Enregistrer l'usage d'une langue
     */
    recordLanguageUsage = async (language: string, platform: string, context: string = 'general', action?: string) => {
        try {
            const entry: LanguageBehaviorEntry = {
                timestamp: Date.now(),
                language,
                context,
                platform,
                action,
            };

            // Ajouter à la liste en mémoire
            this.behaviorData.push(entry);

            // Mettre à jour les statistiques
            const statKey = `${language}_${context}`;
            const existing = this.usageStats.get(statKey);
            if (existing) {
                existing.count++;
                existing.lastUsed = Date.now();
                if (!existing.contexts.includes(context)) {
                    existing.contexts.push(context);
                }
            } else {
                this.usageStats.set(statKey, {
                    language,
                    count: 1,
                    lastUsed: Date.now(),
                    contexts: [context],
                });
            }

            // Sauvegarder périodiquement (toutes les 10 entrées)
            if (this.behaviorData.length % 10 === 0) {
                await this.saveBehaviorData();
                await this.saveUsageStats();
            }
        } catch (error) {
            console.error('[languageDetectionService] Erreur enregistrement usage:', error);
        }
    };

    /**
     * Obtenir la langue préférée basée sur les statistiques
     */
    getPreferredLanguage = (): string | null => {
        if (this.usageStats.size === 0) {
            return null;
        }

        // Trier par nombre d'utilisations
        const sorted = Array.from(this.usageStats.values())
            .sort((a, b) => b.count - a.count);

        if (sorted.length > 0 && sorted[0].count >= 5) {
            return sorted[0].language;
        }

        return null;
    };

    /**
     * Obtenir les statistiques d'usage par langue
     */
    getUsageStats = (): LanguageUsageStat[] => {
        return Array.from(this.usageStats.values());
    };

    /**
     * Nettoyer les anciennes données de comportement
     */
    cleanupOldBehaviorData = async () => {
        try {
            const now = Date.now();
            const maxAge = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

            // Filtrer les entrées trop anciennes
            this.behaviorData = this.behaviorData.filter(
                entry => (now - entry.timestamp) < maxAge
            );

            // Limiter le nombre d'entrées
            if (this.behaviorData.length > MAX_BEHAVIOR_ENTRIES) {
                this.behaviorData = this.behaviorData
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, MAX_BEHAVIOR_ENTRIES);
            }

            // Nettoyer les statistiques pour les langues non utilisées depuis longtemps
            const statsToRemove: string[] = [];
            this.usageStats.forEach((stat, key) => {
                if ((now - stat.lastUsed) > maxAge) {
                    statsToRemove.push(key);
                }
            });
            statsToRemove.forEach(key => this.usageStats.delete(key));

            // Sauvegarder après nettoyage
            await this.saveBehaviorData();
            await this.saveUsageStats();

            console.log(`[languageDetectionService] Nettoyage terminé: ${this.behaviorData.length} entrées conservées`);
        } catch (error) {
            console.error('[languageDetectionService] Erreur nettoyage:', error);
        }
    };

    /**
     * Charger les données de comportement depuis le stockage
     */
    loadBehaviorData = async () => {
        try {
            const data = await AsyncStorage.getItem(BEHAVIOR_DATA_KEY);
            if (data) {
                this.behaviorData = JSON.parse(data);
                // Nettoyer les données obsolètes au chargement
                await this.cleanupOldBehaviorData();
            }
        } catch (error) {
            console.error('[languageDetectionService] Erreur chargement données:', error);
            this.behaviorData = [];
        }
    };

    /**
     * Sauvegarder les données de comportement
     */
    private saveBehaviorData = async () => {
        try {
            await AsyncStorage.setItem(BEHAVIOR_DATA_KEY, JSON.stringify(this.behaviorData));
        } catch (error) {
            console.error('[languageDetectionService] Erreur sauvegarde données:', error);
        }
    };

    /**
     * Charger les statistiques d'usage
     */
    loadUsageStats = async () => {
        try {
            const data = await AsyncStorage.getItem(USAGE_STATS_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                this.usageStats = new Map(Object.entries(parsed));
            }
        } catch (error) {
            console.error('[languageDetectionService] Erreur chargement stats:', error);
            this.usageStats = new Map();
        }
    };

    /**
     * Sauvegarder les statistiques d'usage
     */
    private saveUsageStats = async () => {
        try {
            const serialized = Object.fromEntries(this.usageStats);
            await AsyncStorage.setItem(USAGE_STATS_KEY, JSON.stringify(serialized));
        } catch (error) {
            console.error('[languageDetectionService] Erreur sauvegarde stats:', error);
        }
    };

    /**
     * Réinitialiser toutes les données
     */
    reset = async () => {
        try {
            this.behaviorData = [];
            this.usageStats.clear();
            await AsyncStorage.removeItem(BEHAVIOR_DATA_KEY);
            await AsyncStorage.removeItem(USAGE_STATS_KEY);
        } catch (error) {
            console.error('[languageDetectionService] Erreur réinitialisation:', error);
        }
    };
}

// Instance singleton
export const languageDetectionService = new LanguageDetectionService();

// Charger les données au démarrage
languageDetectionService.loadBehaviorData().catch(error => {
    console.error('[languageDetectionService] Erreur chargement initial:', error);
});
languageDetectionService.loadUsageStats().catch(error => {
    console.error('[languageDetectionService] Erreur chargement stats initial:', error);
});
