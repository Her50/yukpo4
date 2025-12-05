/**
 * 🎨 Toast d'erreur moderne avec animations
 * Design inspiré de Material Design et iOS
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import { SafeIcon } from '../SafeIcon';

interface ModernErrorToastProps {
    visible: boolean;
    message: string;
    onClose?: () => void;
    duration?: number;
    type?: 'error' | 'warning' | 'info' | 'success';
}

const ModernErrorToast: React.FC<ModernErrorToastProps> = ({
    visible,
    message,
    onClose,
    duration = 4000,
    type = 'error',
}) => {
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Animation d'entrée
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 50,
                    friction: 8,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();

            // Animation de shake pour les erreurs
            if (type === 'error') {
                Animated.sequence([
                    Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                    Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
                ]).start();
            }

            // Auto-fermeture
            if (duration > 0) {
                const timer = setTimeout(() => {
                    handleClose();
                }, duration);
                return () => clearTimeout(timer);
            }
        } else {
            handleClose();
        }
    }, [visible]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: -100,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onClose?.();
        });
    };

    if (!visible) return null;

    const typeConfig = {
        error: {
            icon: 'alert-circle',
            color: modernColors.error,
            bgColor: modernColors.error + '15',
        },
        warning: {
            icon: 'alert-triangle',
            color: modernColors.warning,
            bgColor: modernColors.warning + '15',
        },
        info: {
            icon: 'info',
            color: modernColors.info,
            bgColor: modernColors.info + '15',
        },
        success: {
            icon: 'check-circle',
            color: modernColors.success,
            bgColor: modernColors.success + '15',
        },
    };

    const config = typeConfig[type];

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    opacity: opacityAnim,
                    transform: [
                        { translateY: slideAnim },
                        { translateX: type === 'error' ? shakeAnim : 0 },
                    ],
                },
            ]}
        >
            <View style={[styles.toast, { backgroundColor: config.bgColor, borderLeftColor: config.color }]}>
                <SafeIcon name={config.icon} size={20} color={config.color} />
                <Text style={[styles.message, { color: config.color }]}>{message}</Text>
                {onClose && (
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                        <SafeIcon name="x" size={16} color={config.color} />
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: 20,
        right: 20,
        zIndex: 9999,
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    message: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 20,
    },
    closeButton: {
        padding: 4,
    },
});

export default ModernErrorToast;


