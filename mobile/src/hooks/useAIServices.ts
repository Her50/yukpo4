import i18n from 'i18next';
import { useState } from 'react';
import { apiPost } from '../services/api';

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

            // Backend expose les routes AI sans préfixe `/api` : POST /ai/chat
            const response = await apiPost<{
                message?: string;
                text?: string;
                response?: string;
                suggestions?: string[];
                confidence?: number;
            }>('/ai/chat', {
                message: question,
                context: context,
                type: 'question'
            });

            if (response.success && response.data) {
                const aiResponse: AIResponse = {
                    message: response.data.message || response.data.text || response.data.response || i18n.t('ai.responseUnavailable'),
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
            setError(i18n.t('ai.serviceUnavailable'));

            // Fallback avec réponse par défaut
            const fallbackResponse: AIResponse = {
                message: i18n.t('ai.fallbackMessage'),
                suggestions: [i18n.t('ai.fallbackRetry'), i18n.t('ai.fallbackSupport')],
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

            // Backend expose les routes AI sans préfixe `/api` : POST /ai/recommendations
            const response = await apiPost<{
                recommendations?: string[];
            }>('/ai/recommendations', {
                preferences: userPreferences,
                type: 'recommendation'
            });

            if (response.success && response.data && response.data.recommendations) {
                return response.data.recommendations;
            }

            return [];
        } catch (err) {
            console.error('AI recommendations API error:', err);
            setError(i18n.t('ai.cannotGenerateRecommendations'));

            // Fallback avec recommandations par défaut
            return [
                i18n.t('ai.checkConnection'),
                i18n.t('ai.retryShortly')
            ];
        } finally {
            setLoading(false);
        }
    };

    const analyzeText = async (text: string): Promise<{ sentiment: string; keywords: string[] } | null> => {
        try {
            setLoading(true);
            setError(null);

            // Backend expose les routes AI sans préfixe `/api` : POST /ai/analyze
            const response = await apiPost<{
                sentiment?: string;
                keywords?: string[];
            }>('/ai/analyze', {
                text: text,
                type: 'analysis'
            });

            if (response.success && response.data) {
                return {
                    sentiment: response.data.sentiment || i18n.t('ai.neutral'),
                    keywords: response.data.keywords || []
                };
            }

            return null;
        } catch (err) {
            console.error('AI text analysis API error:', err);
            setError(i18n.t('ai.cannotAnalyzeText'));

            // Fallback avec analyse basique
            return {
                sentiment: i18n.t('ai.neutral'),
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
