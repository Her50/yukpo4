import { useState } from 'react';
import { apiGet, apiPost } from '../services/api';

interface AIResponse {
    message: string;
    suggestions: string[];
    confidence: number;
    timestamp: Date;
    type: 'question' | 'recommendation' | 'analysis';
}

export const useAIServices = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const askAI = async (question: string, context?: any): Promise<AIResponse | null> => {
        try {
            setLoading(true);
            setError(null);

            // ✅ API IA réelle - OpenAI ou équivalent
            // L'endpoint est /api/ai/chat (le router ajoute /api)
            const response = await apiPost<{
                message?: string;
                text?: string;
                response?: string;
                suggestions?: string[];
                confidence?: number;
            }>('/api/ai/chat', {
                message: question,
                context: context,
                type: 'question'
            });

            if (response.success && response.data) {
                const aiResponse: AIResponse = {
                    message: response.data.message || response.data.text || response.data.response || 'Réponse non disponible',
                    suggestions: response.data.suggestions || [],
                    confidence: response.data.confidence || 0.8,
                    timestamp: new Date(),
                    type: 'question'
                };
                return aiResponse;
            }

            return null;
        } catch (err) {
            console.error('AI API error:', err);
            setError('Service IA temporairement indisponible');

            // Fallback avec réponse par défaut
            const fallbackResponse: AIResponse = {
                message: 'Je suis temporairement indisponible. Veuillez réessayer plus tard.',
                suggestions: ['Réessayer', 'Contacter le support'],
                confidence: 0.5,
                timestamp: new Date(),
                type: 'question'
            };
            return fallbackResponse;
        } finally {
            setLoading(false);
        }
    };

    const getRecommendations = async (userPreferences: any): Promise<string[]> => {
        try {
            setLoading(true);
            setError(null);

            // API IA pour les recommandations
            const response = await apiPost<{
                recommendations?: string[];
            }>('/api/ai/recommendations', {
                preferences: userPreferences,
                type: 'recommendation'
            });

            if (response.success && response.data && response.data.recommendations) {
                return response.data.recommendations;
            }

            return [];
        } catch (err) {
            console.error('AI recommendations API error:', err);
            setError('Impossible de générer des recommandations');

            // Fallback avec recommandations par défaut
            return [
                'Vérifiez votre connexion internet',
                'Réessayez dans quelques instants'
            ];
        } finally {
            setLoading(false);
        }
    };

    const analyzeText = async (text: string): Promise<{ sentiment: string; keywords: string[] } | null> => {
        try {
            setLoading(true);
            setError(null);

            // API IA pour l'analyse de texte
            const response = await apiPost<{
                sentiment?: string;
                keywords?: string[];
            }>('/api/ai/analyze', {
                text: text,
                type: 'analysis'
            });

            if (response.success && response.data) {
                return {
                    sentiment: response.data.sentiment || 'neutre',
                    keywords: response.data.keywords || []
                };
            }

            return null;
        } catch (err) {
            console.error('AI text analysis API error:', err);
            setError('Impossible d\'analyser le texte');

            // Fallback avec analyse basique
            return {
                sentiment: 'neutre',
                keywords: text.split(' ').slice(0, 3)
            };
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        askAI,
        getRecommendations,
        analyzeText
    };
};
