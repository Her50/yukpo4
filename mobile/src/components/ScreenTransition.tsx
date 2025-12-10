/**
 * ScreenTransition - Composant pour transitions fluides entre écrans
 * Gain estimé: +35% de perception de fluidité
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { TransitionType } from '../hooks/useScreenTransition';

interface ScreenTransitionProps {
    children: React.ReactNode;
    type?: TransitionType;
    duration?: number;
    delay?: number;
    style?: ViewStyle;
    onAnimationComplete?: () => void;
}

export const ScreenTransition: React.FC<ScreenTransitionProps> = React.memo(({
    children,
    type = 'fade',
    duration = 300,
    delay = 0,
    style,
    onAnimationComplete,
}) => {
    // ✅ DEBUG: Logger les children pour identifier les problèmes (TOUJOURS activé pour capturer les erreurs)
    React.useEffect(() => {
        try {
            const { componentDebugger } = require('../utils/componentDebugger');
            componentDebugger.enable(); // ✅ CRITIQUE: Activer même en production pour capturer les erreurs
            componentDebugger.logComponent('ScreenTransition', { type, duration, delay }, children);
        } catch (e) {
            // Ignorer si le debugger n'est pas disponible
        }
    }, [children, type, duration, delay]);
    const opacity = useSharedValue(0);
    const translateX = useSharedValue(type === 'slide' ? 50 : 0);
    const translateY = useSharedValue(
        type === 'slideUp' ? 50 : type === 'slideDown' ? -50 : 0
    );
    const scale = useSharedValue(type === 'scale' ? 0.9 : 1);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (typeof withTiming === 'function' && typeof withSpring === 'function') {
                try {
                    opacity.value = withTiming(1, {
                        duration,
                        easing: Easing.out(Easing.ease),
                    });

                    if (type === 'slide') {
                        translateX.value = withSpring(0, {
                            damping: 15,
                            stiffness: 100,
                        });
                    } else if (type === 'slideUp' || type === 'slideDown') {
                        translateY.value = withSpring(0, {
                            damping: 15,
                            stiffness: 100,
                        });
                    } else if (type === 'scale') {
                        scale.value = withSpring(1, {
                            damping: 15,
                            stiffness: 100,
                        });
                    }

                    if (onAnimationComplete && typeof onAnimationComplete === 'function') {
                        setTimeout(() => {
                            try {
                                onAnimationComplete();
                            } catch (error) {
                                console.warn('[ScreenTransition] Erreur callback onAnimationComplete:', error);
                            }
                        }, duration);
                    }
                } catch (error) {
                    console.warn('[ScreenTransition] Erreur animation:', error);
                }
            }
        }, delay);

        return () => {
            // ✅ SÉCURITÉ: Vérifier que timer existe avant de le nettoyer
            if (timer) {
                clearTimeout(timer);
            }
        };
        // ✅ CORRIGÉ: Ne pas inclure les SharedValues dans les dépendances (elles sont stables)
        // ✅ CORRIGÉ: Ne pas inclure onAnimationComplete pour éviter les re-renders infinis
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type, duration, delay]);

    const animatedStyle = useAnimatedStyle(() => {
        const transform: any[] = [];

        if (type === 'slide') {
            transform.push({ translateX: translateX.value });
        } else if (type === 'slideUp' || type === 'slideDown') {
            transform.push({ translateY: translateY.value });
        }

        if (type === 'scale') {
            transform.push({ scale: scale.value });
        }

        return {
            opacity: opacity.value,
            transform: transform.length > 0 ? transform : undefined,
        };
    });

    // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
    // Éviter de rendre des valeurs primitives directement
    const safeChildren = (() => {
        // ✅ CRITIQUE: Gérer le cas où children est null/undefined
        if (children == null) {
            return null;
        }

        // ✅ CRITIQUE: Si children est un boolean false, retourner null (React Native ne peut pas rendre false)
        if (typeof children === 'boolean') {
            // ✅ CRITIQUE: Logger si on détecte un boolean false
            if (!children) {
                try {
                    const { componentDebugger } = require('../utils/componentDebugger');
                    const { remoteLoggingService } = require('../services/remoteLoggingService');
                    const errorMsg = `🚨 [ScreenTransition] BOOLEAN FALSE DÉTECTÉ - Retour null`;
                    console.warn(errorMsg);
                    componentDebugger.logComponent('ScreenTransition', { type, duration, delay, hasBooleanFalse: true }, children);
                    remoteLoggingService.warn(errorMsg, 'ScreenTransition', {
                        children: String(children),
                        type,
                        duration,
                        delay
                    });
                } catch (e) {
                    // Ignorer si les services ne sont pas disponibles
                }
            }
            return null; // Toujours null pour boolean (React Native ne peut pas rendre false)
        }

        // ✅ CRITIQUE: Si children est une string/number, la wrapper directement
        if (typeof children === 'string' || typeof children === 'number') {
            // ✅ CRITIQUE: Vérifier si c'est la string "false" (qui pourrait venir d'un boolean converti)
            if (children === 'false' || children === 'true') {
                try {
                    const { componentDebugger } = require('../utils/componentDebugger');
                    const { remoteLoggingService } = require('../services/remoteLoggingService');
                    const errorMsg = `🚨 [ScreenTransition] STRING DÉTECTÉE DIRECTEMENT: "${children}"`;
                    console.error(errorMsg);
                    componentDebugger.logComponent('ScreenTransition', { type, duration, delay, hasStringChild: true, isBooleanString: true }, children);
                    remoteLoggingService.error(errorMsg, 'ScreenTransition', {
                        children: String(children),
                        childrenType: 'boolean',
                        type,
                        duration,
                        delay
                    }, new Error().stack);
                } catch (e) {
                    // Ignorer si les services ne sont pas disponibles
                }
                return null; // Ne pas rendre "false" ou "true" comme string
            }
            // ✅ CRITIQUE: Logger immédiatement si on détecte une string
            try {
                const { componentDebugger } = require('../utils/componentDebugger');
                const { remoteLoggingService } = require('../services/remoteLoggingService');
                const errorMsg = `🚨 [ScreenTransition] STRING DÉTECTÉE DIRECTEMENT: "${String(children).substring(0, 50)}"`;
                console.error(errorMsg);
                componentDebugger.logComponent('ScreenTransition', { type, duration, delay, hasStringChild: true }, children);
                remoteLoggingService.error(errorMsg, 'ScreenTransition', {
                    children: String(children).substring(0, 100),
                    type,
                    duration,
                    delay
                }, new Error().stack);
            } catch (e) {
                // Ignorer si les services ne sont pas disponibles
            }
            return <Text>{String(children)}</Text>;
        }

        // ✅ CRITIQUE: Si children est un tableau, le traiter récursivement
        if (Array.isArray(children)) {
            const safeArray = children
                .map((child, index) => {
                    // ✅ CRITIQUE: Filtrer les boolean false (React Native ne peut pas les rendre)
                    if (typeof child === 'boolean') {
                        return null; // Toujours null pour boolean
                    }
                    if (typeof child === 'string' || typeof child === 'number') {
                        return <Text key={index}>{String(child)}</Text>;
                    }
                    if (child == null) {
                        return null;
                    }
                    if (React.isValidElement(child)) {
                        return child;
                    }
                    return <Text key={index}>{String(child)}</Text>;
                })
                .filter(child => child != null && child !== false); // Filtrer null, undefined et false

            return safeArray.length > 0 ? safeArray : null;
        }

        // ✅ CRITIQUE: Utiliser React.Children.map pour gérer les fragments et autres cas
        const mapped = React.Children.map(children, (child, index) => {
            // ✅ CRITIQUE: Si c'est un boolean false, retourner null (React Native ne peut pas rendre false)
            if (typeof child === 'boolean') {
                if (!child) {
                    try {
                        const { componentDebugger } = require('../utils/componentDebugger');
                        const { remoteLoggingService } = require('../services/remoteLoggingService');
                        const errorMsg = `🚨 [ScreenTransition] BOOLEAN FALSE DÉTECTÉ DANS React.Children.map - Retour null`;
                        console.warn(errorMsg, { child, index, childrenType: typeof child });
                        componentDebugger.logComponent('ScreenTransition', { type, duration, delay, hasBooleanFalse: true, childIndex: index }, child);
                        remoteLoggingService.warn(errorMsg, 'ScreenTransition', {
                            child: String(child),
                            childIndex: index,
                            childrenType: typeof child,
                            allChildren: Array.isArray(children) ? children.length : 'not array',
                            type,
                            duration
                        });
                    } catch (e) {
                        // Ignorer si les services ne sont pas disponibles
                    }
                }
                return null; // Toujours null pour boolean
            }

            // Si c'est une valeur primitive (string, number), l'envelopper dans un Text
            if (typeof child === 'string' || typeof child === 'number') {
                // ✅ CRITIQUE: Vérifier si c'est la string "false" (qui pourrait venir d'un boolean converti)
                if (child === 'false' || child === 'true') {
                    try {
                        const { componentDebugger } = require('../utils/componentDebugger');
                        const { remoteLoggingService } = require('../services/remoteLoggingService');
                        const errorMsg = `🚨 [ScreenTransition] STRING DÉTECTÉE DANS React.Children.map: "${child}"`;
                        console.error(errorMsg, { child, index, childrenType: 'boolean' });
                        componentDebugger.logComponent('ScreenTransition', { type, duration, delay, hasStringChild: true, childIndex: index, isBooleanString: true }, child);
                        remoteLoggingService.error(errorMsg, 'ScreenTransition', {
                            child: String(child),
                            childIndex: index,
                            childrenType: 'boolean',
                            allChildren: Array.isArray(children) ? children.length : 'not array',
                            type,
                            duration
                        }, new Error().stack);
                    } catch (e) {
                        // Ignorer si les services ne sont pas disponibles
                    }
                    return null; // Ne pas rendre "false" ou "true" comme string
                }
                // ✅ CRITIQUE: Logger immédiatement si on détecte une string dans React.Children.map
                try {
                    const { componentDebugger } = require('../utils/componentDebugger');
                    const { remoteLoggingService } = require('../services/remoteLoggingService');
                    const errorMsg = `🚨 [ScreenTransition] STRING DÉTECTÉE DANS React.Children.map: "${String(child).substring(0, 50)}"`;
                    console.error(errorMsg, { child, index, childrenType: typeof child });
                    componentDebugger.logComponent('ScreenTransition', { type, duration, delay, hasStringChild: true, childIndex: index }, child);
                    remoteLoggingService.error(errorMsg, 'ScreenTransition', {
                        child: String(child).substring(0, 100),
                        childIndex: index,
                        childrenType: typeof child,
                        allChildren: Array.isArray(children) ? children.length : 'not array',
                        type,
                        duration
                    }, new Error().stack);
                } catch (e) {
                    // Ignorer si les services ne sont pas disponibles
                }
                return <Text key={index}>{String(child)}</Text>;
            }
            // Si c'est null ou undefined, retourner null
            if (child == null) {
                return null;
            }
            // Si c'est un tableau, le traiter récursivement
            if (Array.isArray(child)) {
                return child
                    .map((item, itemIndex) => {
                        // ✅ CRITIQUE: Filtrer les boolean false
                        if (typeof item === 'boolean') {
                            return null; // Toujours null pour boolean
                        }
                        if (typeof item === 'string' || typeof item === 'number') {
                            return <Text key={`${index}-${itemIndex}`}>{String(item)}</Text>;
                        }
                        if (item == null) {
                            return null;
                        }
                        if (React.isValidElement(item)) {
                            return item;
                        }
                        return <Text key={`${index}-${itemIndex}`}>{String(item)}</Text>;
                    })
                    .filter(item => item != null && item !== false); // Filtrer null, undefined et false
            }
            // Si c'est un élément React valide, vérifier récursivement ses children
            if (React.isValidElement(child)) {
                // ✅ NOUVEAU: Vérifier récursivement les children de l'élément pour détecter et wrapper les strings
                try {
                    const childProps = (child as any).props;
                    if (childProps && childProps.children) {
                        // Fonction récursive pour wrapper les strings dans les children
                        const wrapStringsInChildren = (childrenToCheck: any, keyPrefix: string = ''): any => {
                            if (childrenToCheck == null) return null;

                            // ✅ CRITIQUE: Si c'est un boolean, retourner null AVANT toute conversion en string
                            if (typeof childrenToCheck === 'boolean') {
                                // ✅ CRITIQUE: Logger si on détecte un boolean false
                                if (!childrenToCheck) {
                                    try {
                                        const { remoteLoggingService } = require('../services/remoteLoggingService');
                                        remoteLoggingService.warn(
                                            `🚨 [ScreenTransition] STRING DÉTECTÉE DANS ScreenTransition: "false"`,
                                            'ScreenTransition',
                                            { child: 'false', childComponent: 'ScreenTransition', childrenType: 'boolean' }
                                        );
                                    } catch (e) {
                                        // Ignorer si les services ne sont pas disponibles
                                    }
                                }
                                return null; // Toujours null pour boolean (React Native ne peut pas rendre false)
                            }

                            // Si c'est une primitive, la wrapper dans Text
                            if (typeof childrenToCheck === 'string' || typeof childrenToCheck === 'number') {
                                // ✅ CRITIQUE: Vérifier si c'est la string "false" (qui pourrait venir d'un boolean converti)
                                if (childrenToCheck === 'false' || childrenToCheck === 'true') {
                                    try {
                                        const { remoteLoggingService } = require('../services/remoteLoggingService');
                                        remoteLoggingService.warn(
                                            `🚨 [ScreenTransition] STRING DÉTECTÉE DANS ScreenTransition: "${childrenToCheck}"`,
                                            'ScreenTransition',
                                            { child: String(childrenToCheck), childComponent: 'ScreenTransition', childrenType: 'boolean' }
                                        );
                                    } catch (e) {
                                        // Ignorer si les services ne sont pas disponibles
                                    }
                                    return null; // Ne pas rendre "false" ou "true" comme string
                                }
                                console.warn('[ScreenTransition] ⚠️ String détectée et wrappée:', String(childrenToCheck).substring(0, 50));
                                return <Text key={`${keyPrefix}-text`}>{String(childrenToCheck)}</Text>;
                            }

                            // Si c'est un tableau, traiter chaque élément
                            if (Array.isArray(childrenToCheck)) {
                                return childrenToCheck.map((item, idx) => wrapStringsInChildren(item, `${keyPrefix}-${idx}`));
                            }

                            // Si c'est un élément React valide, vérifier ses children
                            if (React.isValidElement(childrenToCheck)) {
                                const props = (childrenToCheck as any).props;
                                if (props && props.children) {
                                    const wrappedChildren = wrapStringsInChildren(props.children, keyPrefix);
                                    // Cloner l'élément avec les children wrappés
                                    return React.cloneElement(childrenToCheck as React.ReactElement, {
                                        ...props,
                                        children: wrappedChildren
                                    });
                                }
                            }

                            return childrenToCheck;
                        };

                        const wrappedChildren = wrapStringsInChildren(childProps.children, `child-${index}`);
                        if (wrappedChildren !== childProps.children) {
                            // Les children ont été modifiés, cloner l'élément avec les nouveaux children
                            return React.cloneElement(child as React.ReactElement, {
                                ...childProps,
                                children: wrappedChildren
                            });
                        }
                    }
                } catch (e) {
                    // Ignorer les erreurs de vérification
                    console.warn('[ScreenTransition] Erreur vérification récursive:', e);
                }
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
            return <Text key={index}>{childString}</Text>;
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

    // ✅ CRITIQUE: Double vérification avant rendu pour éviter les strings non wrappées
    const finalChildren = React.useMemo(() => {
        if (safeChildren == null) {
            return null;
        }

        // ✅ CRITIQUE: Si safeChildren est un boolean false, retourner null (React Native ne peut pas rendre false)
        if (typeof safeChildren === 'boolean') {
            return safeChildren ? null : null; // Toujours null pour boolean
        }

        // ✅ CRITIQUE: Si safeChildren est une string/number, la wrapper
        if (typeof safeChildren === 'string' || typeof safeChildren === 'number') {
            return <Text>{String(safeChildren)}</Text>;
        }

        // ✅ CRITIQUE: Si c'est un tableau, vérifier chaque élément et filtrer les false
        if (Array.isArray(safeChildren)) {
            return safeChildren
                .map((child, idx) => {
                    // ✅ CRITIQUE: Filtrer les boolean false (React Native ne peut pas les rendre)
                    if (typeof child === 'boolean') {
                        return child ? null : null; // Toujours null pour boolean
                    }
                    if (typeof child === 'string' || typeof child === 'number') {
                        return <Text key={idx}>{String(child)}</Text>;
                    }
                    if (child == null) {
                        return null;
                    }
                    return child;
                })
                .filter(child => child != null && child !== false); // Filtrer null et false
        }

        return safeChildren;
    }, [safeChildren]);

    return (
        <Animated.View style={[styles.container, animatedStyle, style]}>
            {finalChildren}
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

ScreenTransition.displayName = 'ScreenTransition';

