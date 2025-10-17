// Bouton flottant pour ouvrir le panneau de debug
import React, { useState } from 'react';
import {
    View,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Platform,
    PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DebugPanel, useDebugPanel } from './DebugPanel';

interface DebugFloatingButtonProps {
    enabled?: boolean;
}

export const DebugFloatingButton: React.FC<DebugFloatingButtonProps> = ({ 
    enabled = __DEV__ // Activé par défaut en mode développement
}) => {
    const debugPanel = useDebugPanel();
    const [position] = useState(new Animated.ValueXY({ x: 20, y: 100 }));
    const [errorCount, setErrorCount] = useState(0);

    // Intercepter les erreurs pour afficher un badge
    React.useEffect(() => {
        const originalError = console.error;
        console.error = (...args) => {
            originalError(...args);
            setErrorCount(prev => prev + 1);
        };

        return () => {
            console.error = originalError;
        };
    }, []);

    // Rendre le bouton déplaçable
    const panResponder = React.useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: Animated.event(
                [null, { dx: position.x, dy: position.y }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: (_, gesture) => {
                // Si le mouvement est petit, c'est un clic
                if (Math.abs(gesture.dx) < 10 && Math.abs(gesture.dy) < 10) {
                    debugPanel.toggle();
                    setErrorCount(0); // Réinitialiser le compteur d'erreurs
                }
            },
        })
    ).current;

    if (!enabled) return null;

    return (
        <>
            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.container,
                    {
                        transform: [
                            { translateX: position.x },
                            { translateY: position.y },
                        ],
                    },
                ]}
            >
                <TouchableOpacity
                    style={[
                        styles.button,
                        errorCount > 0 && styles.buttonError,
                    ]}
                    onPress={() => {
                        debugPanel.toggle();
                        setErrorCount(0);
                    }}
                    activeOpacity={0.8}
                >
                    <Ionicons 
                        name="bug" 
                        size={24} 
                        color="#FFF" 
                    />
                    {errorCount > 0 && (
                        <View style={styles.badge}>
                            <View style={styles.badgeInner}>
                                <Ionicons name="warning" size={12} color="#FFF" />
                            </View>
                        </View>
                    )}
                </TouchableOpacity>
            </Animated.View>

            <DebugPanel 
                visible={debugPanel.visible} 
                onClose={debugPanel.hide} 
            />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        zIndex: 9999,
    },
    button: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#6366F1',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    buttonError: {
        backgroundColor: '#EF4444',
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#FFF',
        borderRadius: 12,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeInner: {
        backgroundColor: '#F59E0B',
        borderRadius: 10,
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

