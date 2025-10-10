import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

const { width, height } = Dimensions.get('window');

interface ModernBackgroundProps {
    variant?: 'home' | 'services' | 'dashboard' | 'minimal';
    children: React.ReactNode;
}

const ModernBackground: React.FC<ModernBackgroundProps> = ({
    variant = 'home',
    children
}) => {
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

    return (
        <View style={styles.container}>
            {/* Arrière-plan avec dégradés animés */}
            <View style={styles.backgroundContainer}>
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
            </View>

            {/* Effet glassmorphism */}
            <BlurView
                intensity={20}
                tint="light"
                style={styles.blurOverlay}
            />

            {/* Contenu principal */}
            <View style={styles.content}>
                {children}
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

