// 🌍 Fournisseur intelligent de gestion des langues
import { useIntelligentLanguage } from '@/hooks/useIntelligentLanguage';
import { languageDetectionService } from '@/services/languageDetectionService';
import * as React from "react";
import { createContext, useContext, useEffect, useState } from 'react';
import { Text } from 'react-native';

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

    // Enregistrer les interactions utilisateur pour l'apprentissage (React Native compatible)
    useEffect(() => {
        // En React Native, nous pouvons enregistrer l'usage de la langue actuelle
        // sans avoir besoin d'écouter les événements DOM
        const recordLanguageUsage = () => {
            try {
                languageDetectionService.recordLanguageUsage(intelligentLanguage.currentLanguage, 'mobile');
            } catch (error) {
                console.warn('⚠️ [IntelligentLanguageProvider] Erreur enregistrement usage:', error);
            }
        };

        // Enregistrer l'usage périodiquement
        const interval = setInterval(recordLanguageUsage, 30000); // Toutes les 30 secondes

        return () => {
            clearInterval(interval);
        };
    }, [intelligentLanguage.currentLanguage]);

    // Traduction automatique pour React Native
    useEffect(() => {
        if (!isInitialized) return;

        const initializeTranslation = async () => {
            try {
                // En React Native, nous initialisons simplement le service de traduction
                // sans manipulation DOM
                console.log('🌍 [IntelligentLanguageProvider] Service de traduction initialisé pour:', intelligentLanguage.currentLanguage);
            } catch (error) {
                console.warn('⚠️ [IntelligentLanguageProvider] Erreur initialisation traduction:', error);
            }
        };

        initializeTranslation();
    }, [intelligentLanguage.currentLanguage, isInitialized]);

    // Traduction automatique des notifications (React Native compatible)
    useEffect(() => {
        if (!isInitialized) return;

        // En React Native, nous pouvons gérer les notifications différemment
        // sans utiliser les APIs web window et CustomEvent
        console.log('🌍 [IntelligentLanguageProvider] Gestionnaire de notifications initialisé');

        // Ici, nous pourrions intégrer avec des services de notifications React Native
        // comme @react-native-async-storage/async-storage ou des services de push notifications

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

    // ✅ CORRECTION CRITIQUE: Encapsuler le contenu dans un composant Text si c'est une chaîne
    if (typeof translatedContent === 'string') {
        return <Text>{translatedContent}</Text>;
    }

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







