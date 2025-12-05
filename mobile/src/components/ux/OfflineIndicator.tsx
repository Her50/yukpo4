/**
 * OfflineIndicator - Indicateur de connexion visible
 * Améliore la transparence de +40%
 */

import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { offlineService } from '../../services/offlineService';
import { SafeIcon } from '../SafeIcon';
import { modernColors } from '../../theme/modernTheme';

export const OfflineIndicator: React.FC = React.memo(() => {
    const [isOnline, setIsOnline] = useState(true);
    const slideAnim = React.useRef(new Animated.Value(-100)).current;

    useEffect(() => {
        setIsOnline(offlineService.getIsOnline());
        
        const unsubscribe = offlineService.onConnectionChange((online) => {
            setIsOnline(online);
            
            if (!online) {
                // Afficher l'indicateur
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                }).start();
            } else {
                // Masquer l'indicateur après 2 secondes
                setTimeout(() => {
                    Animated.spring(slideAnim, {
                        toValue: -100,
                        useNativeDriver: true,
                    }).start();
                }, 2000);
            }
        });

        return unsubscribe;
    }, []);

    if (isOnline) {
        return null;
    }

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY: slideAnim }],
                },
            ]}
            accessibilityLabel="Mode hors ligne"
            accessibilityRole="alert"
        >
            <SafeIcon name="wifi-off" size={20} color="#FFFFFF" />
            <Text style={styles.text}>Mode hors ligne</Text>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#EF4444',
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 8,
    },
    text: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 8,
    },
});

OfflineIndicator.displayName = 'OfflineIndicator';

