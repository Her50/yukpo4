/**
 * SpecializedServicesButton - Bouton élégant pour accéder aux services spécialisés
 * Remplace le scroll horizontal par un bouton cliquable
 */

import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
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

    const handlePress = () => {
        hapticPress();
        if (onPress) {
            onPress();
        } else {
            // Navigation par défaut vers la page des services spécialisés
            (navigation as any).navigate('SpecializedServicesHub');
        }
    };

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={handlePress}
            activeOpacity={0.8}
            accessibilityLabel="Accéder aux services spécialisés"
            accessibilityRole="button"
        >
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <SafeIcon name="sparkles" size={32} color={modernColors.primary} type="lucide" />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>Services Spécialisés</Text>
                    <Text style={styles.subtitle}>
                        Santé • Transport • Immobilier • Éducation • Cuisine
                    </Text>
                </View>
                <View style={styles.arrowContainer}>
                    <SafeIcon name="chevron-right" size={24} color={modernColors.primary} type="lucide" />
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

