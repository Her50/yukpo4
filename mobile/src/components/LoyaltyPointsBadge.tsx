/**
 * Badge affichant les points de fidélité
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import loyaltyProgram from '../services/loyaltyProgram';
import SafeIcon from './SafeIcon';

interface LoyaltyPointsBadgeProps {
    onPress?: () => void;
    showLevel?: boolean;
}

const LoyaltyPointsBadge: React.FC<LoyaltyPointsBadgeProps> = ({
    onPress,
    showLevel = true,
}) => {
    const { user } = useAuth();
    const [points, setPoints] = useState(0);
    const [level, setLevel] = useState<'bronze' | 'silver' | 'gold' | 'platinum'>('bronze');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.id) {
            loadPoints();
        }
    }, [user?.id]);

    const loadPoints = async () => {
        try {
            setLoading(true);
            const data = await loyaltyProgram.getLoyaltyPoints(user!.id);
            setPoints(data.available_points);
            setLevel(data.level);
        } catch (error) {
            console.error('[LoyaltyBadge] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const getLevelColor = () => {
        switch (level) {
            case 'platinum':
                return '#E5E7EB';
            case 'gold':
                return '#FFD700';
            case 'silver':
                return '#C0C0C0';
            default:
                return '#CD7F32';
        }
    };

    const getLevelIcon = () => {
        switch (level) {
            case 'platinum':
                return 'award';
            case 'gold':
                return 'award';
            case 'silver':
                return 'award';
            default:
                return 'star';
        }
    };

    if (loading) {
        return null;
    }

    return (
        <TouchableOpacity
            style={styles.container}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.badge, { borderColor: getLevelColor() }]}>
                <SafeIcon name={getLevelIcon()} size={16} color={getLevelColor()} />
                <Text style={styles.pointsText}>{points.toLocaleString()}</Text>
                {showLevel && (
                    <View style={[styles.levelBadge, { backgroundColor: getLevelColor() }]}>
                        <Text style={styles.levelText}>{level.toUpperCase()}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        marginRight: 8,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: '#fff',
    },
    pointsText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    levelBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        marginLeft: 4,
    },
    levelText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#fff',
    },
});

export default LoyaltyPointsBadge;


