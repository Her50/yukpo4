// 🌍 Fournisseur intelligent de gestion des langues
import { useIntelligentLanguage } from '@/hooks/useIntelligentLanguage';
import { autoTranslationService } from '@/services/autoTranslationService';
import { languageDetectionService } from '@/services/languageDetectionService';
import * as React from "react";
import { createContext, useContext, useEffect, useState } from 'react';

interface IntelligentLanguageContextType {
    // État
    currentLanguage: string;
    isDetecting: boolean;
    detectionResult: any;

    // Actions
    changeLanguage: (language: string) => Promise<void>;
    detectAndSetLanguage: () => Promise<void>;
    translateText: (text: string, context?: string) => Promise<string>;

    // Statistiques
    languageUsageStats: any[];
    translationCacheStats: { size: number; hitRate: number };

    // Contrôles
    enableAutoTranslation: (enabled: boolean) => void;
    clearLanguageData: () => void;
}

const IntelligentLanguageContext = createContext<IntelligentLanguageContextType | null>(null);

interface IntelligentLanguageProviderProps {
    children: React.ReactNode;
}

export const IntelligentLanguageProvider: React.FC<IntelligentLanguageProviderProps> = ({ children }) => {
    const intelligentLanguage = useIntelligentLanguage();
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialisation automatique
    useEffect(() => {
        const initializeLanguage = async () => {
            try {
                // Détecter et définir la langue optimale
                await intelligentLanguage.detectAndSetLanguage();

                // Nettoyer les anciennes données périodiquement
                languageDetectionService.cleanupOldBehaviorData();

                setIsInitialized(true);
                console.log('🌍 [IntelligentLanguageProvider] Initialisation terminée');
            } catch (error) {
                console.error('❌ [IntelligentLanguageProvider] Erreur initialisation:', error);
                setIsInitialized(true); // Continuer même en cas d'erreur
            }
        };

        initializeLanguage();
    }, []);

    // Enregistrer les interactions utilisateur pour l'apprentissage
    useEffect(() => {
        const handleUserInteraction = (event: Event) => {
            // Enregistrer l'usage de la langue actuelle dans différents contextes
            const target = event.target as HTMLElement;

            if (target) {
                let context = 'general';

                // Déterminer le contexte basé sur l'élément
                if (target.closest('form')) {
                    context = 'form';
                } else if (target.closest('[data-chat]')) {
                    context = 'chat';
                } else if (target.closest('[data-search]')) {
                    context = 'search';
                } else if (target.closest('nav')) {
                    context = 'navigation';
                }

                // Enregistrer l'usage
                languageDetectionService.recordLanguageUsage(intelligentLanguage.currentLanguage, context);
            }
        };

        // Écouter les interactions utilisateur
        document.addEventListener('click', handleUserInteraction);
        document.addEventListener('input', handleUserInteraction);
        document.addEventListener('submit', handleUserInteraction);

        return () => {
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('input', handleUserInteraction);
            document.removeEventListener('submit', handleUserInteraction);
        };
    }, [intelligentLanguage.currentLanguage]);

    // Traduction automatique des éléments DOM
    useEffect(() => {
        if (!isInitialized) return;

        const translateDOM = async () => {
            try {
                // Traduire les éléments marqués pour la traduction automatique
                await autoTranslationService.translateDOM(intelligentLanguage.currentLanguage, '[data-auto-translate]');
            } catch (error) {
                console.warn('⚠️ [IntelligentLanguageProvider] Erreur traduction DOM:', error);
            }
        };

        // Traduire après un délai pour laisser le temps au DOM de se charger
        const timer = setTimeout(translateDOM, 1000);

        return () => clearTimeout(timer);
    }, [intelligentLanguage.currentLanguage, isInitialized]);

    // Traduction automatique des notifications
    useEffect(() => {
        if (!isInitialized) return;

        const handleNotification = (event: CustomEvent) => {
            const { title, message, type } = event.detail;

            // Traduire automatiquement les notifications
            Promise.all([
                autoTranslationService.translateToUserLanguage(title, 'notification'),
                autoTranslationService.translateToUserLanguage(message, 'notification')
            ]).then(([translatedTitle, translatedMessage]) => {
                // Redispatch l'événement avec les traductions
                const translatedEvent = new CustomEvent('intelligent-notification', {
                    detail: {
                        title: translatedTitle.translatedText,
                        message: translatedMessage.translatedText,
                        type,
                        originalTitle: title,
                        originalMessage: message
                    }
                });

                window.dispatchEvent(translatedEvent);
            }).catch(error => {
                console.warn('⚠️ [IntelligentLanguageProvider] Erreur traduction notification:', error);
                // Redispatch l'événement original en cas d'erreur
                window.dispatchEvent(event);
            });
        };

        window.addEventListener('show-notification', handleNotification as EventListener);

        return () => {
            window.removeEventListener('show-notification', handleNotification as EventListener);
        };
    }, [isInitialized]);

    const contextValue: IntelligentLanguageContextType = {
        ...intelligentLanguage,
    };

    return (
        <IntelligentLanguageContext.Provider value={contextValue}>
            {children}
        </IntelligentLanguageContext.Provider>
    );
};

// Hook pour utiliser le contexte
export const useIntelligentLanguageContext = (): IntelligentLanguageContextType => {
    const context = useContext(IntelligentLanguageContext);
    if (!context) {
        throw new Error('useIntelligentLanguageContext must be used within an IntelligentLanguageProvider');
    }
    return context;
};

// Composant pour marquer les éléments à traduire automatiquement
export const AutoTranslate: React.FC<{ children: React.ReactNode; context?: string }> = ({
    children,
    context = 'ui'
}) => {
    const { translateText } = useIntelligentLanguageContext();
    const [translatedContent, setTranslatedContent] = useState<React.ReactNode>(children);

    useEffect(() => {
        const translateContent = async () => {
            if (typeof children === 'string') {
                try {
                    const result = await translateText(children, context);
                    setTranslatedContent(result);
                } catch (error) {
                    console.warn('⚠️ [AutoTranslate] Erreur traduction:', error);
                    setTranslatedContent(children);
                }
            }
        };

        translateContent();
    }, [children, context, translateText]);

    return <>{translatedContent}</>;
};

// Hook pour traduire du texte dans les composants
export const useAutoTranslate = () => {
    const { translateText } = useIntelligentLanguageContext();

    return {
        translate: translateText,
        t: translateText // Alias plus court
    };
};

export default IntelligentLanguageProvider;







