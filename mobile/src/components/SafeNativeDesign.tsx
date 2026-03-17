/**
 * ✅ WRAPPER SÉCURISÉ pour les composants NativeDesign
 * Garantit que les composants sont toujours des fonctions React valides
 * avec fallback automatique en cas dt('safeNativeDesign.echecD')import
 */

import React from 'react';
import { TextInput as RNTextInput, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { useLanguageSafe } from '../contexts/LanguageContext';

// ✅ Import avec gestion d'erreur
let NativeDesignModule: any;
try {
    NativeDesignModule = require('./NativeDesign');
} catch (error) {
    console.error('[SafeNativeDesign] Erreur import NativeDesign:', error);
    NativeDesignModule = null;
}

// ✅ Vérification qu'un composant est valide
// CRITIQUE: Vérifier que c'est vraiment un composant React, pas un objet ou autre chose
const isReactComponent = (comp: any): comp is React.ComponentType<any> => {
    if (comp == null || comp === undefined) {
        return false;
    }
    // Un composant React doit être une fonction
    if (typeof comp !== 'function') {
        return false;
    }
    // Vérifier que ce n'est pas un objet qui se comporte comme une fonction (rare mais possible)
    if (typeof comp === 'object' && comp !== null) {
        return false;
    }
    // Vérifier que la fonction a les propriétés attendues d'un composant React
    // (optionnel mais recommandé pour plus de sécurité)
    return true;
};

// ✅ Fallback pour NativeButton
const FallbackButton: React.FC<{ title: string; onPress: () => void;[key: string]: any }> = ({ title, onPress, ...props }) => (
    <TouchableOpacity onPress={onPress} style={[fallbackStyles.button, props.style]} {...props}>
        <Text style={fallbackStyles.buttonText}>{title}</Text>
    </TouchableOpacity>
);

// ✅ Fallback pour NativeBadge
const FallbackBadge: React.FC<{ text: string;[key: string]: any }> = ({ text, ...props }) => (
    <View style={[fallbackStyles.badge, props.style]} {...props}>
        <Text style={fallbackStyles.badgeText}>{text}</Text>
    </View>
);

// ✅ Fallback pour NativeCard avec gestion sécurisée des enfants
const FallbackCard: React.FC<{ children: React.ReactNode;[key: string]: any }> = ({ children, ...props }) => {
    // ✅ CRITIQUE: Gérer les enfants de manière sécurisée
    // Éviter de rendre des valeurs primitives directement
    const safeChildren = React.useMemo(() => {
        // Si children est null/undefined, retourner null
        if (children == null) {
            return null;
        }

        // ✅ CRITIQUE: Gérer les chaînes vides explicitement
        if (typeof children === 'string' && children === '') {
            return null;
        }

        // Les booléens (false, true) ne doivent PAS être rendus (comportement React standard)
        if (typeof children === 'boolean') {
            return null;
        }

        // Si children est une primitive (string, number), l'envelopper dans Text
        if (typeof children === 'string' || typeof children === 'number') {
            return <Text>{String(children)}</Text>;
        }

        // Si children est un tableau, traiter chaque élément
        if (Array.isArray(children)) {
            const processed = children.map((child, idx) => {
                // ✅ CRITIQUE: Gérer les chaînes vides
                if (typeof child === 'string' && child === '') {
                    return null;
                }
                if (typeof child === 'boolean') {
                    return null;
                }
                if (typeof child === 'string' || typeof child === 'number') {
                    return <Text key={idx}>{String(child)}</Text>;
                }
                if (child == null) {
                    return null;
                }
                if (React.isValidElement(child)) {
                    return child;
                }
                return <Text key={idx}>{String(child)}</Text>;
            }).filter(child => child != null);
            return processed.length > 0 ? processed : null;
        }

        // ✅ CRITIQUE: Fonction récursive pour traiter les enfants de manière sécurisée
        const processChild = (child: any, idx: number | string): React.ReactNode => {
            // Si c'est une chaîne vide, retourner null
            if (typeof child === 'string' && child === '') {
                return null;
            }
            // Les booléens ne sont pas rendus en React
            if (typeof child === 'boolean') {
                return null;
            }
            // Si c'est une valeur primitive, l'envelopper dans Text
            if (typeof child === 'string' || typeof child === 'number') {
                return <Text key={idx}>{String(child)}</Text>;
            }
            // Si c'est null ou undefined, retourner null
            if (child == null) {
                return null;
            }
            // Si c'est un tableau, le traiter récursivement
            if (Array.isArray(child)) {
                const processed = child.map((item, itemIndex) => processChild(item, `${idx}-${itemIndex}`)).filter(item => item != null);
                return processed.length > 0 ? processed : null;
            }
            // Si c'est un élément React valide, le retourner tel quel
            if (React.isValidElement(child)) {
                return child;
            }
            // Fallback - toujours wrapper dans Text si ce n'est pas un élément React valide
            return <Text key={idx}>{String(child)}</Text>;
        };

        // Utiliser React.Children.map pour gérer les fragments et autres cas
        // ✅ CRITIQUE: React.Children.map peut retourner null, un tableau, ou un seul élément
        const mapped = React.Children.map(children, (child, idx) => {
            // Si child est null/undefined, le retourner tel quel (React.Children.map le gère)
            if (child == null) {
                return null;
            }
            // Traiter l'enfant avec notre fonction récursive
            return processChild(child, idx);
        });

        // ✅ CRITIQUE: Filtrer les null/undefined et gérer le cas où tout est null
        if (mapped == null) {
            return null;
        }

        // Si mapped est un tableau, filtrer les null/undefined
        if (Array.isArray(mapped)) {
            const filtered = mapped.filter(child => child != null);
            return filtered.length > 0 ? filtered : null;
        }

        // Si mapped est un seul élément, le retourner tel quel
        return mapped != null ? mapped : null;
    }, [children]);

    return (
        <View style={[fallbackStyles.card, props.style]} {...props}>
            {safeChildren}
        </View>
    );
};

// ✅ Fallback pour NativeInput
const FallbackInput: React.FC<any> = (props) => {
    return <RNTextInput style={[fallbackStyles.input, props.style]} {...props} />;
};

// ✅ Fallback pour NativeDivider
const FallbackDivider: React.FC<{ style?: any }> = ({ style }) => (
    <View style={[fallbackStyles.divider, style]} />
);

// ✅ Fallback pour NativeGradient
const FallbackGradient: React.FC<{ colors: string[]; children: React.ReactNode; style?: any }> = ({ colors, children, style }) => {
    const backgroundColor = colors?.[0] || modernColors.primary;

    // Gérer les enfants de manière sécurisée
    const safeChildren = React.useMemo(() => {
        if (children == null) return null;
        if (typeof children === 'boolean') return null;
        if (typeof children === 'string' || typeof children === 'number') {
            return <Text>{String(children)}</Text>;
        }
        if (Array.isArray(children)) {
            return children.map((child, idx) => {
                if (typeof child === 'boolean') return null;
                if (typeof child === 'string' || typeof child === 'number') {
                    return <Text key={idx}>{String(child)}</Text>;
                }
                if (child == null) return null;
                if (React.isValidElement(child)) return child;
                return <Text key={idx}>{String(child)}</Text>;
            }).filter(child => child != null);
        }
        return React.Children.map(children, (child, idx) => {
            if (typeof child === 'boolean') return null;
            if (typeof child === 'string' || typeof child === 'number') {
                return <Text key={idx}>{String(child)}</Text>;
            }
            if (child == null) return null;
            if (Array.isArray(child)) {
                return child.map((item, itemIndex) => {
                    if (typeof item === 'boolean') return null;
                    if (typeof item === 'string' || typeof item === 'number') {
                        return <Text key={`${idx}-${itemIndex}`}>{String(item)}</Text>;
                    }
                    if (item == null) return null;
                    if (React.isValidElement(item)) return item;
                    return <Text key={`${idx}-${itemIndex}`}>{String(item)}</Text>;
                });
            }
            if (React.isValidElement(child)) return child;
            return <Text key={idx}>{String(child)}</Text>;
        });
    }, [children]);

    return (
        <View style={[{ backgroundColor }, style]}>
            {safeChildren}
        </View>
    );
};

// ✅ Wrapper sécurisé pour NativeCard qui garantit toujours une gestion correcte des enfants
const SafeNativeCardWrapper: React.FC<any> = (props) => {
    // ✅ CRITIQUE: Fonction récursive pour traiter les enfants de manière sécurisée
    // Cette fonction garantit que TOUTES les chaînes sont wrappées dans <Text>
    const processChild = React.useCallback((child: any, idx: number | string): React.ReactNode => {
        // Si c'est null ou undefined, retourner null
        if (child == null) {
            return null;
        }

        // ✅ CRITIQUE: Si c'est une chaîne vide, retourner null
        if (typeof child === 'string' && child === '') {
            return null;
        }

        // ✅ CRITIQUE: Les booléens (false, true) doivent être filtrés, PAS rendus comme texte
        // C'est le comportement standard de React: {false && <Component/>} ne rend rien
        if (typeof child === 'boolean') {
            return null;
        }

        // ✅ Si c'est une chaîne ou un nombre, l'envelopper dans Text
        if (typeof child === 'string' || typeof child === 'number') {
            return <Text key={idx}>{String(child)}</Text>;
        }

        // ✅ CRITIQUE: Si c'est un tableau, traiter chaque élément récursivement
        if (Array.isArray(child)) {
            const processed = child
                .map((item, itemIndex) => processChild(item, `${idx}-${itemIndex}`))
                .filter(item => item != null);
            return processed.length > 0 ? processed : null;
        }

        // ✅ CRITIQUE: Si c'est un Fragment React, traiter ses enfants
        if (React.isValidElement(child) && child.type === React.Fragment) {
            const fragmentChildren = React.Children.toArray((child.props as any).children);
            const processed = fragmentChildren
                .map((item, itemIndex) => processChild(item, `${idx}-fragment-${itemIndex}`))
                .filter(item => item != null);
            return processed.length > 0 ? processed : null;
        }

        // ✅ CRITIQUE: Si c'est un élément React valide, vérifier qu'il n'a pas de chaînes comme enfants directs
        if (React.isValidElement(child)) {
            // Si l'élément a des enfants, les traiter récursivement
            if (child.props && (child.props as any).children != null) {
                const processedChildren = processChild((child.props as any).children, `${idx}-children`);
                // Cloner l'élément avec les enfants traités
                return React.cloneElement(child, { key: idx }, processedChildren);
            }
            // Sinon, retourner l'élément tel quel
            return React.cloneElement(child, { key: idx });
        }

        // ✅ CRITIQUE: Fallback - toujours wrapper dans Text si ce n'est pas un élément React valide
        return <Text key={idx}>{String(child)}</Text>;
    }, []);

    // Toujours utiliser notre logique sécurisée pour les enfants
    const safeChildren = React.useMemo(() => {
        const { children } = props;

        // Si children est null/undefined, retourner null
        if (children == null) {
            return null;
        }

        // ✅ CRITIQUE: Gérer les chaînes vides explicitement
        if (typeof children === 'string' && children === '') {
            return null;
        }

        // ✅ CRITIQUE: Les booléens doivent être filtrés (false, true ne sont pas rendus en React)
        if (typeof children === 'boolean') {
            return null;
        }

        // ✅ CRITIQUE: Si children est une chaîne ou un nombre, l'envelopper dans Text
        if (typeof children === 'string' || typeof children === 'number') {
            return <Text>{String(children)}</Text>;
        }

        // ✅ CRITIQUE: Utiliser React.Children.map pour gérer les fragments et autres cas
        // React.Children.map garantit que nous traitons tous les enfants, y compris les fragments
        const mapped = React.Children.map(children, (child, idx) => {
            return processChild(child, idx);
        });

        // ✅ CRITIQUE: Filtrer les null/undefined et gérer le cas où tout est null
        if (mapped == null) {
            return null;
        }

        // Si mapped est un tableau, filtrer les null/undefined
        if (Array.isArray(mapped)) {
            const filtered = mapped.filter(child => child != null);
            return filtered.length > 0 ? filtered : null;
        }

        // Si mapped est un seul élément, le retourner tel quel
        return mapped != null ? mapped : null;
    }, [props.children, processChild]);

    // Essayer d'utiliser le composant original avec nos enfants sécurisés
    if (NativeDesignModule) {
        let OriginalCard = NativeDesignModule.NativeCard;
        if (!OriginalCard && NativeDesignModule.default && typeof NativeDesignModule.default === 'object') {
            OriginalCard = NativeDesignModule.default.NativeCard;
        }
        // ✅ CRITIQUE: Vérifier que OriginalCard est vraiment un composant React valide
        // et non un objet ou autre chose
        if (isReactComponent(OriginalCard)) {
            try {
                // Utiliser le composant original mais avec nos enfants sécurisés
                return React.createElement(OriginalCard, { ...props, children: safeChildren });
            } catch (error) {
                // Si React.createElement échoue, utiliser le fallback
                console.warn('[SafeNativeCardWrapper] Erreur lors de la création du composant original, utilisation du fallback:', error);
                return <FallbackCard {...props}>{safeChildren}</FallbackCard>;
            }
        }
    }

    // Sinon utiliser le fallback
    return <FallbackCard {...props}>{safeChildren}</FallbackCard>;
};

// ✅ CRITIQUE: S'assurer que le nom du composant est préservé pour le debugging
SafeNativeCardWrapper.displayName = 'SafeNativeCard';

// ✅ Extraction sécurisée des composants
const getComponent = (name: string, fallback: React.ComponentType<any>): React.ComponentType<any> => {
    if (!NativeDesignModule) {
        return fallback;
    }

    // Essayer l'export nommé
    let component = NativeDesignModule[name];

    // Si pas trouvé, essayer l'export par défaut
    if (!component && NativeDesignModule.default && typeof NativeDesignModule.default === 'object') {
        component = NativeDesignModule.default[name];
    }

    // Vérifier que c'est un composant React valide
    if (isReactComponent(component)) {
        return component;
    }

    return fallback;
};

// ✅ CRITIQUE: Wrapper qui garantit toujours un composant React valide
// ✅ CORRIGÉ: Ne pas utiliser forwardRef pour éviter les problèmes d'objet
const createSafeComponent = (name: string, fallback: React.ComponentType<any>): React.ComponentType<any> => {
    const component = getComponent(name, fallback);

    // ✅ CRITIQUE: Vérifier une dernière fois que c'est un composant valide
    if (!isReactComponent(component)) {
        console.warn(`[SafeNativeDesign] ${name} n'est pas un composant valide, utilisation du fallback`);
        return fallback;
    }

    // ✅ CRITIQUE: Wrapper simple sans forwardRef pour garantir que c'est toujours une fonction
    const SafeComponent: React.FC<any> = (props: any) => {
        try {
            // Vérifier que le composant est toujours valide avant de l'utiliser
            if (!isReactComponent(component)) {
                return React.createElement(fallback, props);
            }
            return React.createElement(component, props);
        } catch (error) {
            console.error(`[SafeNativeDesign] Erreur lors du rendu de ${name}:`, error);
            return React.createElement(fallback, props);
        }
    };

    // ✅ CRITIQUE: S'assurer que le nom du composant est préservé pour le debugging
    SafeComponent.displayName = `Safe${name}`;

    return SafeComponent;
};

// ✅ Export des composants sécurisés - GARANTIS comme composants React valides
// ✅ CRITIQUE: NativeCard utilise directement SafeNativeCardWrapper pour éviter les problèmes d'enveloppement
export const NativeCard: React.ComponentType<any> = SafeNativeCardWrapper;
export const NativeButton: React.ComponentType<any> = createSafeComponent('NativeButton', FallbackButton);
export const NativeBadge: React.ComponentType<any> = createSafeComponent('NativeBadge', FallbackBadge);
export const NativeInput: React.ComponentType<any> = createSafeComponent('NativeInput', FallbackInput);
export const NativeDivider: React.ComponentType<any> = createSafeComponent('NativeDivider', FallbackDivider);
export const NativeGradient: React.ComponentType<any> = createSafeComponent('NativeGradient', FallbackGradient);

// ✅ Export par défaut pour compatibilité
export default {
    NativeButton,
    NativeBadge,
    NativeCard,
    NativeInput,
    NativeDivider,
    NativeGradient,
};

// ✅ Styles pour les fallbacks
const fallbackStyles = StyleSheet.create({
    button: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: modernColors.textSecondary + '20',
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    card: {
        backgroundColor: modernColors.surface,
        borderRadius: 16,
        padding: 16,
        marginVertical: 4,
    },
    input: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: modernColors.surface,
        fontSize: 16,
        color: modernColors.text,
    },
    divider: {
        height: 1,
        backgroundColor: modernColors.border,
        marginVertical: 8,
    },
});

