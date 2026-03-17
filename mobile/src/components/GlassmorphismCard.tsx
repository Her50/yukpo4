import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { createGlassmorphismStyle, getCurrentTheme } from '../theme/advancedTheme';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface GlassmorphismCardProps {
    children: React.ReactNode;
    variant?: 'card' | 'button' | 'input';
    intensity?: number;
    tint?: 'light' | 'dark' | 'default';
    style?: ViewStyle;
    gradient?: boolean;
    theme?: 'glassmorphism' | 'darkModern' | 'minimal' | 'vibrant';
}

const GlassmorphismCard: React.FC<GlassmorphismCardProps> = ({
    children,
    variant = 'card',
    intensity = 20,
    tint = 'light',
    style,
    gradient = false,
    theme = 'glassmorphism'
}) => {
    const currentTheme = getCurrentTheme(theme);
    const glassStyle = createGlassmorphismStyle(currentTheme, variant);

    return (
        <View style={[styles.container, style]}>
            {/* Effet de flou */}
            <BlurView
                intensity={intensity}
                tint={tint}
                style={[styles.blurView, glassStyle]}
            />

            {/* Dégradé optionnel */}
            {gradient && (
                <LinearGradient
                    colors={currentTheme.gradients.primary as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.gradient, { opacity: 0.1 }]}
                />
            )}

            {/* Contenu */}
            <View style={styles.content}>
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
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        overflow: 'hidden',
    },
    blurView: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    gradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    content: {
        position: 'relative',
        zIndex: 1,
    },
});

export default GlassmorphismCard;









