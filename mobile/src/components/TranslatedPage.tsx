import * as React from 'react';
import { useEffect, useState } from 'react';
import { Text, View, ViewProps } from 'react-native';
import { useTranslation } from '../hooks/useTranslation';

interface TranslatedPageProps extends ViewProps {
    children: React.ReactNode;
    autoTranslate?: boolean;
    targetLanguage?: string;
    onTranslationComplete?: () => void;
}

const TranslatedPage: React.FC<TranslatedPageProps> = ({
    children,
    autoTranslate = true,
    targetLanguage,
    onTranslationComplete,
    style,
    ...viewProps
}) => {
    const { currentLanguage, isTranslating } = useTranslation();
    const [hasTranslated, setHasTranslated] = useState<boolean>(false);

    useEffect(() => {
        if (autoTranslate && !hasTranslated) {
            // Simuler le processus de traduction
            const timer = setTimeout(() => {
                setHasTranslated(true);
                onTranslationComplete?.();
            }, 1000);

            return () => clearTimeout(timer);
        }
    }, [autoTranslate, hasTranslated, onTranslationComplete]);

    // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
    // Éviter de rendre des valeurs primitives directement
    const safeChildren = React.Children.map(children, (child, index) => {
        // Si c'est une valeur primitive (string, number), l'envelopper dans un Text
        if (typeof child === 'string' || typeof child === 'number') {
            return <Text key={index}>{String(child)}</Text>;
        }
        // Si c'est null ou undefined, retourner null
        if (child == null) {
            return null;
        }
        return child;
    });

    return (
        <View
            style={[
                {
                    opacity: isTranslating ? 0.7 : 1,
                },
                style
            ]}
            {...viewProps}
        >
            {safeChildren}
        </View>
    );
};

export default TranslatedPage;















