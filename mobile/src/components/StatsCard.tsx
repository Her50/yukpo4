/**
 * StatsCard - Card de statistique visuelle moderne (inspiré Shopify/Amazon)
 * Remplace le texte compressé par des cards visuelles
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface StatsCardProps {
    icon: string;
    value: string | number;
    label: string;
    trend?: string; // Ex: "+12%", "-5%"
    trendPositive?: boolean;
    onPress?: () => void;
    gradient?: string[];
    color?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
    icon,
    value,
    label,
    trend,
    trendPositive,
    onPress,
    gradient,
    color = modernColors.primary,
}) => {
    const CardComponent = onPress ? TouchableOpacity : View;

    const content = (
        <View style={styles.container}>
            {gradient ? (
                <LinearGradient
                    colors={gradient as any}
                    style={styles.iconContainer}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <SafeIcon name={icon} size={24} color="#fff" />
                </LinearGradient>
            ) : (
                <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
                    <SafeIcon name={icon} size={24} color={color} />
                </View>
            )}

            <View style={styles.content}>
                <Text style={styles.value}>{value}</Text>
                <Text style={styles.label}>{label}</Text>
                {trend && (
                    <View style={styles.trendContainer}>
                        <SafeIcon
                            name={trendPositive !== false ? 'trending-up' : 'trending-down'}
                            size={12}
                            color={trendPositive !== false ? modernColors.success : modernColors.error}
                        />
                        <Text
                            style={[
                                styles.trend,
                                { color: trendPositive !== false ? modernColors.success : modernColors.error },
                            ]}
                        >
                            {trend}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.8}
                style={styles.touchable}
            >
                {content}
            </TouchableOpacity>
        );
    }

    return <View style={styles.wrapper}>{content}</View>;
};

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        minWidth: 140, // ✅ Responsive: Largeur minimale pour tablette
    },
    touchable: {
        flex: 1,
        minWidth: 140,
    },
    container: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: modernColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: modernColors.borderLight,
        minHeight: 90,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    content: {
        flex: 1,
    },
    value: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    label: {
        fontSize: 13,
        color: modernColors.textSecondary,
        fontWeight: '500',
        marginBottom: 4,
    },
    trendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    trend: {
        fontSize: 12,
        fontWeight: '600',
    },
});

