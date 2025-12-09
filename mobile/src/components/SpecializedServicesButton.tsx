/**
 * SpecializedServicesButton - Bouton élégant pour accéder aux services spécialisés
 * Remplace le scroll horizontal par un bouton cliquable
 * ✅ AMÉLIORÉ: État de chargement, gestion d'erreur, accessibilité améliorée
 */

import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { hapticPress } from '../utils/hapticFeedback';
import SafeIcon from './SafeIcon';

interface SpecializedServicesButtonProps {
    onPress?: () => void;
}

export const SpecializedServicesButton: React.FC<SpecializedServicesButtonProps> = ({
    onPress,
}) => {
    const navigation = useNavigation();
    const [isNavigating, setIsNavigating] = useState(false);

    const handlePress = async () => {
        // ✅ AMÉLIORÉ: Empêcher les clics multiples
        if (isNavigating) {
            return;
        }

        hapticPress();
        setIsNavigating(true);

        try {
            if (onPress) {
                // ✅ AMÉLIORÉ: Gérer les handlers async
                const result = onPress();
                if (result instanceof Promise) {
                    await result;
                }
            } else {
                // ✅ AMÉLIORÉ: Navigation avec gestion d'erreur
                const navResult = (navigation as any).navigate('SpecializedServicesHub');
                if (navResult === false) {
                    throw new Error('Navigation failed');
                }
            }
        } catch (error) {
            console.error('[SpecializedServicesButton] Erreur navigation:', error);
            // ✅ AMÉLIORÉ: Afficher un message d'erreur à l'utilisateur
            Alert.alert(
                'Erreur',
                'Impossible d\'accéder aux services spécialisés. Veuillez réessayer.',
                [{ text: 'OK' }]
            );
        } finally {
            // ✅ AMÉLIORÉ: Réinitialiser l'état après un court délai pour permettre l'animation
            setTimeout(() => {
                setIsNavigating(false);
            }, 300);
        }
    };

    return (
        <TouchableOpacity
            style={[styles.container, isNavigating && styles.containerLoading]}
            onPress={handlePress}
            activeOpacity={0.8}
            disabled={isNavigating}
            accessibilityLabel="Accéder aux services spécialisés"
            accessibilityRole="button"
            accessibilityHint="Ouvre la page des services spécialisés : santé, transport, immobilier, éducation et cuisine"
            accessibilityState={{ disabled: isNavigating }}
        >
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    {isNavigating ? (
                        <ActivityIndicator size="small" color={modernColors.primary} />
                    ) : (
                        <SafeIcon name="sparkles" size={32} color={modernColors.primary} type="lucide" />
                    )}
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>Services Spécialisés</Text>
                    <Text style={styles.subtitle}>
                        Santé • Transport • Immobilier • Éducation • Cuisine
                    </Text>
                </View>
                <View style={styles.arrowContainer}>
                    {isNavigating ? (
                        <ActivityIndicator size="small" color={modernColors.primary} />
                    ) : (
                        <SafeIcon name="chevron-right" size={24} color={modernColors.primary} type="lucide" />
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: modernColors.surface,
        borderRadius: 16,
        marginHorizontal: 16,
        marginVertical: 12,
        padding: 20,
        borderWidth: 2,
        borderColor: modernColors.primary + '20', // 20% opacity
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    containerLoading: {
        opacity: 0.7,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: modernColors.primary + '15', // 15% opacity
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        fontWeight: '400',
    },
    arrowContainer: {
        marginLeft: 12,
    },
});

