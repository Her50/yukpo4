import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { Dimensions, Animated as RNAnimated, StyleSheet, View } from 'react-native';
// ✅ CORRIGÉ: Utiliser cleanChildren pour éviter les erreurs de rendu
import { cleanChildren } from '../utils/safeChildren';
import { useLanguageSafe } from '../contexts/LanguageContext';

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
    const { t } = useLanguageSafe();
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
            <RNAnimated.View
                style={[styles.backgroundContainer, parallaxStyle]}
                pointerEvents="none" // ✅ CRITIQUE: Ne pas bloquer les interactions utilisateur
            >
                {gradients.map((colors, index) => (
                    <LinearGradient
                        key={index}
                        colors={colors as any}
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
                pointerEvents="none" // ✅ CRITIQUE: Ne pas bloquer les interactions utilisateur
            />

            {/* Contenu principal */}
            <View style={styles.content}>
                {React.useMemo(() => cleanChildren(children, 'ModernBackground'), [children])}
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

