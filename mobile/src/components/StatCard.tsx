import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme/theme';

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: string;
    color: string;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    onPress?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    subtitle,
    icon,
    color,
    trend,
    onPress
}) => {
    const formatValue = (val: string | number) => {
        if (typeof val === 'number') {
            return val.toLocaleString('fr-FR');
        }
        return val;
    };

    const CardContent = () => (
        <View style={[styles.container, { borderLeftColor: color }]}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Text style={[styles.icon, { color }]}>{icon}</Text>
                </View>

                <View style={styles.textContainer}>
                    <Text style={styles.value}>{formatValue(value)}</Text>
                    <Text style={styles.title}>{title}</Text>
                    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

                    {trend && (
                        <View style={styles.trendContainer}>
                            <Text style={[
                                styles.trendText,
                                { color: trend.isPositive ? '#10B981' : '#EF4444' }
                            ]}>
                                {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value)}%
                            </Text>
                            <Text style={styles.trendLabel}>vs mois dernier</Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
                <CardContent />
            </TouchableOpacity>
        );
    }

    return <CardContent />;
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        marginRight: 16,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    icon: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    textContainer: {
        flex: 1,
    },
    value: {
        fontSize: 28,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 4,
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginBottom: 4,
    },
    trendContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    trendText: {
        fontSize: 12,
        fontWeight: '600',
        marginRight: 4,
    },
    trendLabel: {
        fontSize: 10,
        color: theme.colors.textSecondary,
    },
});

export default StatCard;


