// Composant de carte moderne avec glassmorphism et gradients
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { modernColors, modernStyles } from '../theme/modernTheme';

interface ModernCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'glass' | 'gradient' | 'solid';
  gradientColors?: string[];
  blurType?: 'light' | 'dark' | 'regular';
  intensity?: number;
}

const ModernCard: React.FC<ModernCardProps> = ({
  children,
  style,
  variant = 'glass',
  gradientColors = modernColors.primaryGradient,
  blurType = 'light',
  intensity = 20,
}) => {
  const cardStyle = [
    styles.baseCard,
    variant === 'glass' && styles.glassCard,
    variant === 'gradient' && styles.gradientCard,
    variant === 'solid' && styles.solidCard,
    style,
  ];

  // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
  // Éviter de rendre des valeurs primitives directement
  const safeChildren = React.Children.map(children, (child, index) => {
    // Si c'est une valeur primitive (string, number), l'envelopper dans un Text
    if (typeof child === 'string' || typeof child === 'number') {
      return <Text key={index}>{String(child)}</Text>;
    }
    // Si c'est null ou undefined, retourner null
    if (child == null) {
      return null;
    }
    return child;
  });

  if (variant === 'gradient') {
    return (
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={cardStyle}
      >
        {safeChildren}
      </LinearGradient>
    );
  }

  if (variant === 'glass') {
    return (
      <BlurView
        style={cardStyle}
        intensity={intensity}
        tint={blurType === 'dark' ? 'dark' : 'light'}
      >
        <View style={styles.glassOverlay}>
          {safeChildren}
        </View>
      </BlurView>
    );
  }

  return (
    <View style={cardStyle}>
      {safeChildren}
    </View>
  );
};

const styles = StyleSheet.create({
  baseCard: {
    borderRadius: modernStyles.borderRadius.large,
    ...modernStyles.shadowMedium,
  },
  glassCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  gradientCard: {
    overflow: 'hidden',
  },
  solidCard: {
    backgroundColor: modernColors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  glassOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: modernStyles.borderRadius.large,
    padding: modernStyles.spacing.lg,
  },
});

export default ModernCard;

