// Composant SafeAreaView natif pour remplacer react-native-safe-area-context
import React from 'react';
import { Dimensions, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';

const { height, width } = Dimensions.get('window');

interface SafeNativeViewProps {
    children: React.ReactNode;
    style?: any;
    edges?: ('top' | 'bottom' | 'left' | 'right')[];
    backgroundColor?: string;
    testID?: string;
}

export const SafeNativeView: React.FC<SafeNativeViewProps> = ({
    children,
    style,
    edges = ['top', 'bottom', 'left', 'right'],
    backgroundColor = '#FFFFFF',
    testID,
}) => {
    // ✅ DEBUG: Logger les children pour identifier les problèmes (TOUJOURS activé pour capturer les erreurs)
    React.useEffect(() => {
        try {
            const { componentDebugger } = require('../utils/componentDebugger');
            componentDebugger.enable(); // ✅ CRITIQUE: Activer même en production pour capturer les erreurs
            componentDebugger.logComponent('SafeNativeView', { edges, backgroundColor, testID }, children);
        } catch (e) {
            // Ignorer si le debugger n'est pas disponible
        }
    }, [children, edges, backgroundColor, testID]);
    const getStatusBarHeight = () => {
        if (Platform.OS === 'android') {
            return StatusBar.currentHeight || 24;
        }
        // iOS - valeurs approximatives
        return 44;
    };

    const getSafeAreaInsets = () => {
        const statusBarHeight = getStatusBarHeight();
        const bottomInset = Platform.OS === 'ios' ? 34 : 0; // iPhone X+ home indicator

        return {
            top: edges.includes('top') ? statusBarHeight : 0,
            bottom: edges.includes('bottom') ? bottomInset : 0,
            left: edges.includes('left') ? 0 : 0,
            right: edges.includes('right') ? 0 : 0,
        };
    };

    const insets = getSafeAreaInsets();

    const containerStyle = [
        styles.container,
        {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            backgroundColor,
        },
        style,
    ];

    // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
    // Éviter de rendre des valeurs primitives directement
    const safeChildren = (() => {
        // ✅ CRITIQUE: Gérer le cas où children est null/undefined
        if (children == null) {
            return null;
        }

        // ✅ CRITIQUE: Si children est un boolean, retourner null (React Native ne peut pas rendre false)
        if (typeof children === 'boolean') {
            return null; // Toujours null pour boolean (React Native ne peut pas rendre false)
        }

        // ✅ CRITIQUE: Si children est une primitive (string/number), la wrapper directement
        if (typeof children === 'string' || typeof children === 'number') {
            // ✅ CRITIQUE: Vérifier si c'est la string "false" (qui pourrait venir d'un boolean converti)
            if (children === 'false' || children === 'true') {
                return null; // Ne pas rendre "false" ou "true" comme string
            }
            // ✅ CRITIQUE: Logger immédiatement si on détecte une string
            try {
                const { componentDebugger } = require('../utils/componentDebugger');
                const { remoteLoggingService } = require('../services/remoteLoggingService');
                const errorMsg = `🚨 [SafeNativeView] STRING DÉTECTÉE DIRECTEMENT: "${String(children).substring(0, 50)}"`;
                console.error(errorMsg);
                componentDebugger.logComponent('SafeNativeView', { edges, backgroundColor, testID, hasStringChild: true }, children);
                remoteLoggingService.error(errorMsg, 'SafeNativeView', {
                    children: String(children).substring(0, 100),
                    edges,
                    backgroundColor,
                    testID
                }, new Error().stack);
            } catch (e) {
                // Ignorer si les services ne sont pas disponibles
            }
            return <Text>{String(children)}</Text>;
        }

        // ✅ CRITIQUE: Si children est un tableau, le traiter récursivement
        if (Array.isArray(children)) {
            const safeArray = children
                .map((child, idx) => {
                    // ✅ CRITIQUE: Filtrer les boolean false (React Native ne peut pas les rendre)
                    if (typeof child === 'boolean') {
                        return null; // Toujours null pour boolean
                    }
                    if (typeof child === 'string' || typeof child === 'number') {
                        // ✅ CRITIQUE: Vérifier si c'est la string "false" (qui pourrait venir d'un boolean converti)
                        if (child === 'false' || child === 'true') {
                            return null; // Ne pas rendre "false" ou "true" comme string
                        }
                        return <Text key={idx}>{String(child)}</Text>;
                    }
                    if (child == null) {
                        return null;
                    }
                    if (React.isValidElement(child)) {
                        return child;
                    }
                    return <Text key={idx}>{String(child)}</Text>;
                })
                .filter(child => child != null && child !== false); // Filtrer null, undefined et false

            return safeArray.length > 0 ? safeArray : null;
        }

        // ✅ CRITIQUE: Utiliser React.Children.map pour gérer les fragments et autres cas
        const mapped = React.Children.map(children, (child, idx) => {
            // ✅ CRITIQUE: Si c'est un boolean, retourner null (React Native ne peut pas rendre false)
            if (typeof child === 'boolean') {
                return null; // Toujours null pour boolean
            }

            // Si c'est une valeur primitive (string, number), l'envelopper dans un Text
            if (typeof child === 'string' || typeof child === 'number') {
                // ✅ CRITIQUE: Vérifier si c'est la string "false" (qui pourrait venir d'un boolean converti)
                if (child === 'false' || child === 'true') {
                    return null; // Ne pas rendre "false" ou "true" comme string
                }
                // ✅ CRITIQUE: Logger immédiatement si on détecte une string dans React.Children.map
                try {
                    const { componentDebugger } = require('../utils/componentDebugger');
                    const { remoteLoggingService } = require('../services/remoteLoggingService');
                    const errorMsg = `🚨 [SafeNativeView] STRING DÉTECTÉE DANS React.Children.map: "${String(child).substring(0, 50)}"`;
                    console.error(errorMsg, { child, idx, childrenType: typeof child });
                    componentDebugger.logComponent('SafeNativeView', { edges, backgroundColor, testID, hasStringChild: true, childIndex: idx }, child);
                    remoteLoggingService.error(errorMsg, 'SafeNativeView', {
                        child: String(child).substring(0, 100),
                        childIndex: idx,
                        childrenType: typeof child,
                        allChildren: Array.isArray(children) ? children.length : 'not array',
                        edges,
                        backgroundColor
                    }, new Error().stack);
                } catch (e) {
                    // Ignorer si les services ne sont pas disponibles
                }
                return <Text key={idx}>{String(child)}</Text>;
            }
            // Si c'est null ou undefined, retourner null
            if (child == null) {
                return null;
            }
            // Si c'est un tableau, le traiter récursivement
            if (Array.isArray(child)) {
                return child
                    .map((item, itemIndex) => {
                        // ✅ CRITIQUE: Filtrer les boolean false (React Native ne peut pas les rendre)
                        if (typeof item === 'boolean') {
                            return null; // Toujours null pour boolean
                        }
                        if (typeof item === 'string' || typeof item === 'number') {
                            // ✅ CRITIQUE: Vérifier si c'est la string "false" (qui pourrait venir d'un boolean converti)
                            if (item === 'false' || item === 'true') {
                                return null; // Ne pas rendre "false" ou "true" comme string
                            }
                            return <Text key={`${idx}-${itemIndex}`}>{String(item)}</Text>;
                        }
                        if (item == null) {
                            return null;
                        }
                        if (React.isValidElement(item)) {
                            return item;
                        }
                        return <Text key={`${idx}-${itemIndex}`}>{String(item)}</Text>;
                    })
                    .filter(item => item != null && item !== false); // Filtrer null, undefined et false
            }
            // Si c'est un élément React valide, le retourner tel quel
            if (React.isValidElement(child)) {
                return child;
            }
            // ✅ CRITIQUE: Fallback - vérifier si c'est un boolean avant de convertir en string
            if (typeof child === 'boolean') {
                return null; // Toujours null pour boolean (React Native ne peut pas rendre false)
            }
            // ✅ CRITIQUE: Fallback - vérifier si la conversion en string donne "false" ou "true"
            const childString = String(child);
            if (childString === 'false' || childString === 'true') {
                return null; // Ne pas rendre "false" ou "true" comme string
            }
            // ✅ CRITIQUE: Fallback - toujours wrapper dans Text si ce n'est pas un élément React valide
            return <Text key={idx}>{childString}</Text>;
        });

        // ✅ CRITIQUE: Filtrer les null/undefined du résultat
        if (mapped == null) {
            return null;
        }

        if (Array.isArray(mapped)) {
            const filtered = mapped.filter(child => child != null);
            return filtered.length > 0 ? filtered : null;
        }

        return mapped;
    })();

    return (
        <View style={containerStyle} testID={testID}>
            {safeChildren}
        </View>
    );
};

// Composant pour les écrans entiers
export const SafeScreen: React.FC<{
    children: React.ReactNode;
    style?: any;
    backgroundColor?: string;
}> = ({ children, style, backgroundColor = '#FFFFFF' }) => {
    return (
        <SafeNativeView
            style={[styles.screen, style]}
            backgroundColor={backgroundColor}
        >
            {children}
        </SafeNativeView>
    );
};

// Composant pour les conteneurs
export const SafeContainer: React.FC<{
    children: React.ReactNode;
    style?: any;
    padding?: number;
}> = ({ children, style, padding = 16 }) => {
    return (
        <SafeNativeView style={[styles.container, { padding }, style]}>
            {children}
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    screen: {
        flex: 1,
        width: width,
        height: height,
    },
});

export default SafeNativeView;
