import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Dimensions, Animated as RNAnimated, StyleSheet, Text, View } from 'react-native';

const { width, height } = Dimensions.get('window');

interface ModernBackgroundProps {
    variant?: 'home' | 'services' | 'dashboard' | 'minimal';
    children: React.ReactNode;
    scrollY?: RNAnimated.Value; // ✅ NOUVEAU: Pour parallax scrolling
}

const ModernBackground: React.FC<ModernBackgroundProps> = ({
    variant = 'home',
    children,
    scrollY,
}) => {
    // ✅ DEBUG: Logger les children pour identifier les problèmes (TOUJOURS activé pour capturer les erreurs)
    // ✅ CORRIGÉ: Ne pas logger dans useEffect car cela peut causer des erreurs si les children contiennent des primitives
    // Le logging sera fait dans la fonction de traitement des children si nécessaire
    // React.useEffect(() => {
    //     try {
    //         const { componentDebugger } = require('../utils/componentDebugger');
    //         componentDebugger.enable(); // ✅ CRITIQUE: Activer même en production pour capturer les erreurs
    //         componentDebugger.logComponent('ModernBackground', { variant, scrollY: scrollY ? 'present' : 'null' }, children);
    //     } catch (e) {
    //         // Ignorer si le debugger n'est pas disponible
    //     }
    // }, [children, variant, scrollY]);
    const getGradientColors = () => {
        switch (variant) {
            case 'home':
                // Gradient cosmique ultramoderne 2025 (Cosmic/Premium Dark)
                return [
                    ['#0F172A', '#1E293B'], // Midnight Blue profond
                    ['#6366F1', '#8B5CF6'], // Indigo vibrant vers Violet électrique
                    ['#1E293B', '#6366F1']  // Transition slate vers indigo
                ];
            case 'services':
                return [
                    ['#a8edea', '#fed6e3'], // Vert-rose pastel
                    ['#ffecd2', '#fcb69f'], // Orange doux
                    ['#d299c2', '#fef9d7']  // Violet-jaune
                ];
            case 'dashboard':
                return [
                    ['#667eea', '#764ba2'], // Bleu-violet
                    ['#f093fb', '#f5576c'], // Rose-orange
                    ['#4facfe', '#00f2fe']  // Bleu cyan
                ];
            case 'minimal':
                return [
                    ['#f8f9fa', '#e9ecef'], // Gris très doux
                    ['#ffffff', '#f1f3f4'], // Blanc pur
                    ['#f8f9fa', '#e9ecef']  // Gris doux
                ];
            default:
                return [
                    ['#667eea', '#764ba2'],
                    ['#f093fb', '#f5576c'],
                    ['#4facfe', '#00f2fe']
                ];
        }
    };

    const gradients = getGradientColors();

    // ✅ NOUVEAU: Parallax scrolling pour background
    const parallaxAnim = React.useRef(new RNAnimated.Value(0)).current;

    useEffect(() => {
        // ✅ SÉCURITÉ: Vérifier que scrollY existe et a la méthode addListener
        if (!scrollY || typeof scrollY.addListener !== 'function') {
            // ✅ CRITIQUE: Retourner explicitement undefined
            return undefined;
        }

        try {
            const listener = scrollY.addListener(({ value }: { value: number }) => {
                // Parallax: background se déplace 3x plus lentement que le scroll
                parallaxAnim.setValue(value * 0.3);
            });
            return () => {
                // ✅ SÉCURITÉ: Vérifier que scrollY et removeListener existent
                if (scrollY && typeof scrollY.removeListener === 'function' && listener) {
                    scrollY.removeListener(listener);
                }
            };
        } catch (error) {
            console.warn('[ModernBackground] Erreur listener scrollY:', error);
        }
    }, [scrollY, parallaxAnim]);

    const parallaxStyle = scrollY ? {
        transform: [{ translateY: parallaxAnim }],
    } : {};

    return (
        <View style={styles.container}>
            {/* Arrière-plan avec dégradés animés + Parallax */}
            <RNAnimated.View style={[styles.backgroundContainer, parallaxStyle]}>
                {gradients.map((colors, index) => (
                    <LinearGradient
                        key={index}
                        colors={colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[
                            styles.gradientLayer,
                            {
                                opacity: 0.3 + (index * 0.1),
                                transform: [
                                    { translateX: index * 20 },
                                    { translateY: index * 15 },
                                    { scale: 1 + (index * 0.1) }
                                ]
                            }
                        ]}
                    />
                ))}
            </RNAnimated.View>

            {/* Effet glassmorphism */}
            <BlurView
                intensity={20}
                tint="light"
                style={styles.blurOverlay}
            />

            {/* Contenu principal */}
            <View style={styles.content}>
                {(() => {
                    // ✅ CRITIQUE: Gérer le cas où children est null/undefined
                    if (children == null) {
                        return null;
                    }

                    // ✅ CRITIQUE: Si children est une primitive, la wrapper directement
                    if (typeof children === 'string' || typeof children === 'number' || typeof children === 'boolean') {
                        // ✅ CRITIQUE: Logger immédiatement si on détecte une string
                        try {
                            const { componentDebugger } = require('../utils/componentDebugger');
                            const { remoteLoggingService } = require('../services/remoteLoggingService');
                            const errorMsg = `🚨 [ModernBackground] STRING DÉTECTÉE DIRECTEMENT: "${String(children).substring(0, 50)}"`;
                            console.error(errorMsg);
                            componentDebugger.logComponent('ModernBackground', { variant, hasStringChild: true }, children);
                            remoteLoggingService.error(errorMsg, 'ModernBackground', { children: String(children).substring(0, 100) }, new Error().stack);
                        } catch (e) {
                            // Ignorer si les services ne sont pas disponibles
                        }
                        return <Text>{String(children)}</Text>;
                    }

                    // ✅ CRITIQUE: Si children est un tableau, le traiter récursivement
                    if (Array.isArray(children)) {
                        const safeArray = children
                            .map((child, idx) => {
                                if (child == null) {
                                    return null;
                                }
                                if (typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean') {
                                    return <Text key={idx}>{String(child)}</Text>;
                                }
                                if (React.isValidElement(child)) {
                                    return child;
                                }
                                return <Text key={idx}>{String(child)}</Text>;
                            })
                            .filter(child => child != null);
                        return safeArray.length > 0 ? safeArray : null;
                    }

                    // ✅ CRITIQUE: Utiliser React.Children.map pour gérer les fragments et autres cas
                    const mapped = React.Children.map(children, (child, index) => {
                        // ✅ CRITIQUE: Si c'est null ou undefined, retourner null
                        if (child == null) {
                            return null;
                        }

                        // ✅ CRITIQUE: Si c'est une valeur primitive (string, number, boolean), l'envelopper dans un Text
                        if (typeof child === 'string' || typeof child === 'number' || typeof child === 'boolean') {
                            // ✅ CRITIQUE: Logger immédiatement si on détecte une string dans React.Children.map
                            try {
                                const { componentDebugger } = require('../utils/componentDebugger');
                                const { remoteLoggingService } = require('../services/remoteLoggingService');
                                const errorMsg = `🚨 [ModernBackground] STRING DÉTECTÉE DANS React.Children.map: "${String(child).substring(0, 50)}"`;
                                console.error(errorMsg, { child, index, childrenType: typeof child });
                                componentDebugger.logComponent('ModernBackground', { variant, hasStringChild: true, childIndex: index }, child);
                                remoteLoggingService.error(errorMsg, 'ModernBackground', {
                                    child: String(child).substring(0, 100),
                                    childIndex: index,
                                    childrenType: typeof child,
                                    allChildren: Array.isArray(children) ? children.length : 'not array'
                                }, new Error().stack);
                            } catch (e) {
                                // Ignorer si les services ne sont pas disponibles
                            }
                            return <Text key={index}>{String(child)}</Text>;
                        }

                        // ✅ CRITIQUE: Si c'est un tableau, le traiter récursivement
                        if (Array.isArray(child)) {
                            return child.map((item, itemIndex) => {
                                if (item == null) {
                                    return null;
                                }
                                if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
                                    return <Text key={`${index}-${itemIndex}`}>{String(item)}</Text>;
                                }
                                if (React.isValidElement(item)) {
                                    return item;
                                }
                                return <Text key={`${index}-${itemIndex}`}>{String(item)}</Text>;
                            });
                        }

                        // ✅ CRITIQUE: Si c'est un élément React valide, le retourner tel quel
                        // ✅ CORRIGÉ: Ne PAS modifier les children des composants qui gèrent déjà leurs propres children
                        // Ces composants (ScreenTransition, AnimatedCard, SafeNativeView, etc.) gèrent déjà leurs propres children
                        if (React.isValidElement(child)) {
                            // ✅ NOUVEAU: Liste des composants qui gèrent déjà leurs propres children
                            const componentName = (child as any).type?.displayName || (child as any).type?.name || 'Unknown';
                            const componentsThatHandleChildren = [
                                'ScreenTransition',
                                'AnimatedCard',
                                'SafeNativeView',
                                'ModernBackground',
                                'Animated.View',
                                'View',
                                'ScrollView',
                                'FlatList'
                            ];

                            // Si c'est un composant qui gère déjà ses children, le retourner tel quel
                            // Ne pas essayer de modifier ses children car cela peut causer des erreurs
                            if (componentsThatHandleChildren.some(name => componentName.includes(name))) {
                                return child;
                            }

                            // Pour les autres composants, on peut vérifier mais ne pas modifier
                            // (laisser le composant gérer ses propres children ou laisser React gérer l'erreur)
                            return child;
                        }

                        // ✅ CRITIQUE: Fallback - toujours wrapper dans Text si ce n'est pas un élément React valide
                        return <Text key={index}>{String(child)}</Text>;
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
                })()}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        position: 'relative',
    },
    backgroundContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    gradientLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 0,
    },
    blurOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: 0.1,
    },
    content: {
        flex: 1,
        zIndex: 1,
    },
});

export default ModernBackground;

