// ✅ Phase 6.5: Composant indicateur de statut de synchronisation

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

export type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline' | 'pending';

interface SyncStatusIndicatorProps {
    status: SyncStatus;
    pendingCount?: number;
    onPress?: () => void;
}

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
    status,
    pendingCount = 0,
    onPress,
}) => {
    const getStatusConfig = () => {
        switch (status) {
            case 'synced':
                return {
                    icon: 'check-circle',
                    color: modernColors.success,
                    text: 'Synchronisé',
                    bgColor: modernColors.success + '15',
                };
            case 'syncing':
                return {
                    icon: 'refresh-cw',
                    color: modernColors.primary,
                    text: 'Synchronisation...',
                    bgColor: modernColors.primary + '15',
                };
            case 'error':
                return {
                    icon: 'alert-circle',
                    color: modernColors.error,
                    text: 'Erreur de sync',
                    bgColor: modernColors.error + '15',
                };
            case 'offline':
                return {
                    icon: 'wifi-off',
                    color: modernColors.warning,
                    text: 'Mode hors ligne',
                    bgColor: modernColors.warning + '15',
                };
            case 'pending':
                return {
                    icon: 'clock',
                    color: modernColors.warning,
                    text: `${pendingCount} en attente`,
                    bgColor: modernColors.warning + '15',
                };
            default:
                return {
                    icon: 'circle',
                    color: modernColors.textSecondary,
                    text: 'Inconnu',
                    bgColor: modernColors.textSecondary + '15',
                };
        }
    };

    const config = getStatusConfig();

    return (
        <View
            style={[
                styles.container,
                { backgroundColor: config.bgColor },
                onPress && styles.pressable,
            ]}
            onTouchEnd={onPress}
        >
            <SafeIcon name={config.icon} size={16} color={config.color} />
            <Text style={[styles.text, { color: config.color }]}>{config.text}</Text>
            {pendingCount > 0 && status === 'pending' && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pendingCount}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    pressable: {
        // Permet le touch
    },
    text: {
        fontSize: 12,
        fontWeight: '600',
    },
    badge: {
        backgroundColor: modernColors.error,
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
});

export default SyncStatusIndicator;



