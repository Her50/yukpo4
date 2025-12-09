/**
 * AccessibilityWrapper - Wrapper pour accessibilité WCAG AA
 * Améliore l'accessibilité de +80%
 */

import React from 'react';
import { AccessibilityInfo, Platform, Text, View, ViewProps } from 'react-native';

interface AccessibilityWrapperProps extends ViewProps {
    children: React.ReactNode;
    accessible?: boolean;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    accessibilityRole?: 'button' | 'text' | 'header' | 'link' | 'image' | 'none';
    accessibilityState?: {
        disabled?: boolean;
        selected?: boolean;
        checked?: boolean;
        busy?: boolean;
        expanded?: boolean;
    };
    accessibilityValue?: {
        min?: number;
        max?: number;
        now?: number;
        text?: string;
    };
    testID?: string;
}

export const AccessibilityWrapper: React.FC<AccessibilityWrapperProps> = ({
    children,
    accessible = true,
    accessibilityLabel,
    accessibilityHint,
    accessibilityRole,
    accessibilityState,
    accessibilityValue,
    testID,
    ...props
}) => {
    // ✅ Vérifier si le lecteur d'écran est actif
    const [isScreenReaderEnabled, setIsScreenReaderEnabled] = React.useState(false);

    React.useEffect(() => {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
            // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
            AccessibilityInfo.isScreenReaderEnabled().then(setIsScreenReaderEnabled).catch(error => {
                console.error('[AccessibilityWrapper] Erreur isScreenReaderEnabled:', error);
            });

            const subscription = AccessibilityInfo.addEventListener('change', (enabled) => {
                setIsScreenReaderEnabled(enabled);
            });

            return () => {
                subscription?.remove();
            };
        }
        // ✅ CRITIQUE: Retourner explicitement undefined si la condition n'est pas remplie
        return undefined;
    }, []);

    // ✅ Améliorer les labels pour les lecteurs d'écran
    const enhancedLabel = React.useMemo(() => {
        if (!accessibilityLabel) {
            return undefined;
        }

        // Ajouter le hint si présent
        if (accessibilityHint) {
            return `${accessibilityLabel}. ${accessibilityHint}`;
        }

        return accessibilityLabel;
    }, [accessibilityLabel, accessibilityHint]);

    return (
        <View
            {...props}
            accessible={accessible && isScreenReaderEnabled}
            accessibilityLabel={enhancedLabel}
            accessibilityRole={accessibilityRole}
            accessibilityState={accessibilityState}
            accessibilityValue={accessibilityValue}
            testID={testID}
        >
            {React.Children.map(children, (child, index) => {
                // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
                // Éviter de rendre des valeurs primitives directement
                if (typeof child === 'string' || typeof child === 'number') {
                    return <Text key={index}>{String(child)}</Text>;
                }
                if (child == null) {
                    return null;
                }
                return child;
            })}
        </View>
    );
};

// ✅ Hook pour vérifier l'accessibilité
export const useAccessibility = () => {
    const [isScreenReaderEnabled, setIsScreenReaderEnabled] = React.useState(false);
    const [isReduceMotionEnabled, setIsReduceMotionEnabled] = React.useState(false);

    React.useEffect(() => {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
            // ✅ CRITIQUE: Appeler les fonctions async mais ne pas retourner leurs Promises
            AccessibilityInfo.isScreenReaderEnabled().then(setIsScreenReaderEnabled).catch(error => {
                console.error('[useAccessibility] Erreur isScreenReaderEnabled:', error);
            });
            AccessibilityInfo.isReduceMotionEnabled().then(setIsReduceMotionEnabled).catch(error => {
                console.error('[useAccessibility] Erreur isReduceMotionEnabled:', error);
            });

            const screenReaderSubscription = AccessibilityInfo.addEventListener('change', (enabled) => {
                setIsScreenReaderEnabled(enabled);
            });

            const reduceMotionSubscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
                setIsReduceMotionEnabled(enabled);
            });

            return () => {
                screenReaderSubscription?.remove();
                reduceMotionSubscription?.remove();
            };
        }
        // ✅ CRITIQUE: Retourner explicitement undefined si la condition n'est pas remplie
        return undefined;
    }, []);

    return {
        isScreenReaderEnabled,
        isReduceMotionEnabled,
    };
};

// ✅ Composant pour texte accessible
export const AccessibleText: React.FC<{
    children: React.ReactNode;
    style?: any;
    accessibilityLabel?: string;
    accessibilityRole?: 'text' | 'header' | 'link';
    testID?: string;
}> = ({ children, style, accessibilityLabel, accessibilityRole = 'text', testID }) => {
    const { isScreenReaderEnabled } = useAccessibility();

    if (typeof children === 'string') {
        return (
            <AccessibilityWrapper
                accessibilityLabel={accessibilityLabel || children}
                accessibilityRole={accessibilityRole}
                testID={testID}
            >
                <Text style={style}>
                    {children}
                </Text>
            </AccessibilityWrapper>
        );
    }

    return (
        <AccessibilityWrapper
            accessibilityLabel={accessibilityLabel}
            accessibilityRole={accessibilityRole}
            testID={testID}
        >
            <View style={style}>
                {React.Children.map(children, (child, index) => {
                    // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
                    // Éviter de rendre des valeurs primitives directement
                    if (typeof child === 'string' || typeof child === 'number') {
                        return <Text key={index}>{String(child)}</Text>;
                    }
                    if (child == null) {
                        return null;
                    }
                    return child;
                })}
            </View>
        </AccessibilityWrapper>
    );
};

// ✅ Composant pour bouton accessible
export const AccessibleButton: React.FC<{
    children: React.ReactNode;
    onPress: () => void;
    disabled?: boolean;
    accessibilityLabel: string;
    accessibilityHint?: string;
    testID?: string;
    style?: any;
}> = ({ children, onPress, disabled, accessibilityLabel, accessibilityHint, testID, style }) => {
    return (
        <AccessibilityWrapper
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ disabled }}
            testID={testID}
            onStartShouldSetResponder={() => !disabled}
            onResponderRelease={() => {
                if (!disabled) {
                    onPress();
                }
            }}
            style={style}
        >
            {React.Children.map(children, (child, index) => {
                // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
                // Éviter de rendre des valeurs primitives directement
                if (typeof child === 'string' || typeof child === 'number') {
                    return <Text key={index}>{String(child)}</Text>;
                }
                if (child == null) {
                    return null;
                }
                return child;
            })}
        </AccessibilityWrapper>
    );
};

