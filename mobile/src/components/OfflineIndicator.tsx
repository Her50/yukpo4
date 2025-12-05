// ✅ Composant indicateur mode offline
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useOffline } from '../hooks/useOffline';
import { modernColors } from '../theme/modernTheme';

const OfflineIndicator: React.FC = () => {
    const { isOnline, isSyncing, queueLength } = useOffline();

    if (isOnline && queueLength === 0) {
        return null; // Pas d'indicateur si tout est OK
    }

    return (
        <View style={styles.container}>
            {!isOnline ? (
                <View style={[styles.banner, styles.offlineBanner]}>
                    <Text style={styles.text}>📴 Mode hors ligne</Text>
                    {queueLength > 0 && (
                        <Text style={styles.subtext}>
                            {queueLength} action{queueLength > 1 ? 's' : ''} en attente
                        </Text>
                    )}
                </View>
            ) : isSyncing ? (
                <View style={[styles.banner, styles.syncingBanner]}>
                    <Text style={styles.text}>🔄 Synchronisation en cours...</Text>
                </View>
            ) : queueLength > 0 ? (
                <View style={[styles.banner, styles.pendingBanner]}>
                    <Text style={styles.text}>
                        ⏳ {queueLength} action{queueLength > 1 ? 's' : ''} en attente de synchronisation
                    </Text>
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
    },
    banner: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    offlineBanner: {
        backgroundColor: modernColors.error,
    },
    syncingBanner: {
        backgroundColor: modernColors.warning,
    },
    pendingBanner: {
        backgroundColor: modernColors.info,
    },
    text: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    subtext: {
        color: '#FFFFFF',
        fontSize: 12,
        marginTop: 2,
        opacity: 0.9,
    },
});

export default OfflineIndicator;
