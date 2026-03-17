/**
 * DistanceBadge
 * Affiche la distance d'un produit/service par rapport à une position
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface DistanceBadgeProps {
    distance: number; // en km
    variant?: 'compact' | 'full';
}

export const DistanceBadge: React.FC<DistanceBadgeProps> = ({
    distance,
    variant = 'compact'
}) => {
    // Formater la distance
    const formatDistance = (km: number): string => {
    const { t } = useLanguageSafe();
        if (km < 1) {
            return `${Math.round(km * 1000)} m`;
        }
        if (km < 10) {
            return `${km.toFixed(1)} km`;
        }
        return `${Math.round(km)} km`;
    };

    // Couleur selon la distance
    const getDistanceColor = (km: number): string => {
        if (km < 1) return '#10B981'; // Vert - Très proche
        if (km < 5) return '#3B82F6'; // Bleu - Proche
        if (km < 10) return '#F59E0B'; // Orange - Moyen
        return '#6B7280'; // Gris - Loin
    };

    const formattedDistance = formatDistance(distance);
    const color = getDistanceColor(distance);

    if (variant === 'compact') {
        return (
            <View style={[styles.badgeCompact, { backgroundColor: color }]}>
                <SafeIcon name="map-pin" size={10} color="#FFFFFF" />
                <Text style={styles.badgeTextCompact}>{formattedDistance}</Text>
            </View>
        );
    }

    return (
        <View style={[styles.badgeFull, { borderColor: color }]}>
            <SafeIcon name="navigation" size={14} color={color} />
            <Text style={[styles.badgeTextFull, { color }]}>{formattedDistance}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badgeCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    badgeTextCompact: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    badgeFull: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1.5,
        gap: 6,
        backgroundColor: '#FFFFFF',
    },
    badgeTextFull: {
        fontSize: 13,
        fontWeight: '600',
    },
});

export default DistanceBadge;

