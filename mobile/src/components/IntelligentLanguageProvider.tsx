// 🌍 Fournisseur intelligent de gestion des langues
import * as React from "react";
import { createContext, useContext, useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useIntelligentLanguage } from '../hooks/useIntelligentLanguage';
import { languageDetectionService } from '../services/languageDetectionService';

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

        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        initializeLanguage().catch(error => {
            console.error('[IntelligentLanguageProvider] Erreur initializeLanguage:', error);
        });
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
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
        if (!isInitialized) {
            // ✅ CRITIQUE: Retourner explicitement undefined si non initialisé
            return undefined;
        }

        const initializeTranslation = async () => {
            try {
                // En React Native, nous initialisons simplement le service de traduction
                // sans manipulation DOM
                console.log('🌍 [IntelligentLanguageProvider] Service de traduction initialisé pour:', intelligentLanguage.currentLanguage);
            } catch (error) {
                console.warn('⚠️ [IntelligentLanguageProvider] Erreur initialisation traduction:', error);
            }
        };

        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        initializeTranslation().catch(error => {
            console.error('[IntelligentLanguageProvider] Erreur initializeTranslation:', error);
        });
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
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

        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        translateContent().catch(error => {
            console.error('[AutoTranslate] Erreur translateContent:', error);
        });
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
    }, [children, context, translateText]);

    // ✅ CORRECTION CRITIQUE: Encapsuler le contenu dans un composant Text si c'est une valeur primitive
    // En React Native, toutes les valeurs primitives (string, number, boolean) doivent être dans un <Text>

    // Cas 1: translatedContent est null ou undefined
    if (translatedContent === null || translatedContent === undefined) {
        // Si children est une string, l'encapsuler dans <Text>
        if (typeof children === 'string') {
            return <Text>{children}</Text>;
        }
        // Sinon, retourner children tel quel (peut être un élément React ou null)
        return <>{children}</>;
    }

    // Cas 2: translatedContent est une valeur primitive (string, number, boolean)
    if (typeof translatedContent === 'string' || typeof translatedContent === 'number' || typeof translatedContent === 'boolean') {
        return <Text>{String(translatedContent)}</Text>;
    }

    // Cas 3: translatedContent est un élément React valide
    if (React.isValidElement(translatedContent)) {
        return translatedContent;
    }

    // Cas 4: translatedContent est un tableau
    if (Array.isArray(translatedContent)) {
        // Vérifier si le tableau contient des primitives qui doivent être encapsulées
        const processedContent = translatedContent.map((item, index) => {
            if (item === null || item === undefined) {
                return null;
            }
            if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
                return <Text key={index}>{String(item)}</Text>;
            }
            if (React.isValidElement(item)) {
                return item;
            }
            // Si c'est un objet non-React, essayer de le convertir en string
            return <Text key={index}>{String(item)}</Text>;
        });
        return <>{processedContent}</>;
    }

    // Cas 5: Fallback - translatedContent est un objet non-React
    // Essayer de le convertir en string et l'encapsuler dans <Text>
    try {
        return <Text>{String(translatedContent)}</Text>;
    } catch (error) {
        console.warn('⚠️ [AutoTranslate] Impossible de convertir translatedContent en string:', error);
        // Dernier recours: retourner children
        if (typeof children === 'string') {
            return <Text>{children}</Text>;
        }
        return <>{children}</>;
    }
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







