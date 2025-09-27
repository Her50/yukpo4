import * as React from 'react';
import { useEffect, useState } from 'react';
import { View, ViewProps } from 'react-native';
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
            {children}
        </View>
    );
};

export default TranslatedPage;


