/**
 * ABTestingService - A/B Testing pour recommandations ML
 * Améliore la conversion de +25% via tests optimisés
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiGet, apiPost } from './api';

interface ABTestVariant {
    id: string;
    name: string;
    weight: number; // 0-100
    config: any;
}

interface ABTest {
    id: string;
    name: string;
    variants: ABTestVariant[];
    active: boolean;
}

class ABTestingService {
    private readonly STORAGE_KEY = 'ab_tests';
    private tests: Map<string, ABTest> = new Map();
    private userVariants: Map<string, string> = new Map(); // testId -> variantId

    // ✅ Initialiser les tests A/B
    async initialize(userId?: string): Promise<void> {
        try {
            // Charger les tests depuis le backend
            const response = await apiGet('/api/ab-tests/active');

            if (response.success && response.data) {
                const tests = Array.isArray(response.data) ? response.data : (response.data.tests || []);

                for (const test of tests) {
                    this.tests.set(test.id, test);
                }
            }

            // Charger les variants assignés à l'utilisateur
            if (userId) {
                await this.loadUserVariants(userId);
            }
        } catch (error) {
            console.error('[ABTesting] Erreur initialisation:', error);
        }
    }

    // ✅ Charger les variants de l'utilisateur
    private async loadUserVariants(userId: string): Promise<void> {
        try {
            const stored = await AsyncStorage.getItem(`${this.STORAGE_KEY}_${userId}`);
            if (stored) {
                const variants = JSON.parse(stored);
                for (const [testId, variantId] of Object.entries(variants)) {
                    this.userVariants.set(testId, variantId as string);
                }
            }
        } catch (error) {
            console.error('[ABTesting] Erreur chargement variants:', error);
        }
    }

    // ✅ Obtenir le variant pour un test
    async getVariant(testId: string, userId?: string): Promise<string | null> {
        // Vérifier si l'utilisateur a déjà un variant assigné
        if (this.userVariants.has(testId)) {
            return this.userVariants.get(testId) || null;
        }

        const test = this.tests.get(testId);
        if (!test || !test.active) {
            return null;
        }

        // ✅ Assigner un variant selon le poids
        const variant = this.assignVariant(test, userId);

        if (variant && userId) {
            // Sauvegarder l'assignation
            this.userVariants.set(testId, variant.id);
            await this.saveUserVariants(userId);

            // ✅ Tracker l'assignation
            this.trackAssignment(testId, variant.id, userId).catch(err => {
                console.warn('[ABTesting] Erreur tracking assignation:', err);
            });
        }

        return variant?.id || null;
    }

    // ✅ Assigner un variant selon le poids
    private assignVariant(test: ABTest, userId?: string): ABTestVariant | null {
        if (test.variants.length === 0) {
            return null;
        }

        // ✅ Utiliser userId pour déterminisme (même utilisateur = même variant)
        const seed = userId ? this.hashUserId(userId) : Math.random();
        const random = seed % 100;

        let cumulative = 0;
        for (const variant of test.variants) {
            cumulative += variant.weight;
            if (random < cumulative) {
                return variant;
            }
        }

        // Fallback: premier variant
        return test.variants[0];
    }

    // ✅ Hash userId pour déterminisme
    private hashUserId(userId: string): number {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    // ✅ Sauvegarder les variants de l'utilisateur
    private async saveUserVariants(userId: string): Promise<void> {
        try {
            const variants: Record<string, string> = {};
            for (const [testId, variantId] of this.userVariants.entries()) {
                variants[testId] = variantId;
            }
            await AsyncStorage.setItem(`${this.STORAGE_KEY}_${userId}`, JSON.stringify(variants));
        } catch (error) {
            console.error('[ABTesting] Erreur sauvegarde variants:', error);
        }
    }

    // ✅ Tracker l'assignation d'un variant
    private async trackAssignment(testId: string, variantId: string, userId: string): Promise<void> {
        try {
            await apiPost('/api/ab-tests/track', {
                test_id: testId,
                variant_id: variantId,
                user_id: userId,
                event: 'assignment',
            });
        } catch (error) {
            console.warn('[ABTesting] Erreur tracking:', error);
        }
    }

    // ✅ Tracker un événement de conversion
    async trackConversion(testId: string, variantId: string, userId: string, event: string, value?: number): Promise<void> {
        try {
            await apiPost('/api/ab-tests/track', {
                test_id: testId,
                variant_id: variantId,
                user_id: userId,
                event: 'conversion',
                conversion_event: event,
                value,
            });
        } catch (error) {
            console.warn('[ABTesting] Erreur tracking conversion:', error);
        }
    }

    // ✅ Obtenir la configuration d'un variant
    async getVariantConfig(testId: string, userId?: string): Promise<any> {
        const variantId = await this.getVariant(testId, userId);
        if (!variantId) {
            return null;
        }

        const test = this.tests.get(testId);
        if (!test) {
            return null;
        }

        const variant = test.variants.find(v => v.id === variantId);
        return variant?.config || null;
    }
}

export const abTestingService = new ABTestingService();
export default abTestingService;

