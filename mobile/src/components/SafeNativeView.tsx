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
    // ✅ DEBUG: Logger les children pour identifier les problèmes
    React.useEffect(() => {
        if (__DEV__) {
            try {
                const { componentDebugger } = require('../utils/componentDebugger');
                componentDebugger.logComponent('SafeNativeView', { edges, backgroundColor, testID }, children);
            } catch (e) {
                // Ignorer si le debugger n'est pas disponible
            }
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

        // ✅ CRITIQUE: Si children est une primitive, la wrapper directement
        if (typeof children === 'string' || typeof children === 'number' || typeof children === 'boolean') {
            return <Text>{String(children)}</Text>;
        }

        // ✅ CRITIQUE: Si children est un tableau, le traiter récursivement
        if (Array.isArray(children)) {
            const safeArray = children
                .map((child, idx) => {
                    if (typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean') {
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
                .filter(child => child != null); // Filtrer les null/undefined

            return safeArray.length > 0 ? safeArray : null;
        }

        // ✅ CRITIQUE: Utiliser React.Children.map pour gérer les fragments et autres cas
        const mapped = React.Children.map(children, (child, idx) => {
            // Si c'est une valeur primitive (string, number, boolean), l'envelopper dans un Text
            if (typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean') {
                return <Text key={idx}>{String(child)}</Text>;
            }
            // Si c'est null ou undefined, retourner null
            if (child == null) {
                return null;
            }
            // Si c'est un tableau, le traiter récursivement
            if (Array.isArray(child)) {
                return child.map((item, itemIndex) => {
                    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
                        return <Text key={`${idx}-${itemIndex}`}>{String(item)}</Text>;
                    }
                    if (item == null) {
                        return null;
                    }
                    if (React.isValidElement(item)) {
                        return item;
                    }
                    return <Text key={`${idx}-${itemIndex}`}>{String(item)}</Text>;
                });
            }
            // Si c'est un élément React valide, le retourner tel quel
            if (React.isValidElement(child)) {
                return child;
            }
            // ✅ CRITIQUE: Fallback - toujours wrapper dans Text si ce n'est pas un élément React valide
            return <Text key={idx}>{String(child)}</Text>;
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
