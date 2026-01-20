/**
 * Toast Component - Notification visuelle moderne
 * Alternative à Alert.alert pour meilleure UX
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { SafeIcon } from './SafeIcon';

const { width } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
    message: string;
    type?: ToastType;
    duration?: number;
    onHide?: () => void;
}

const Toast: React.FC<ToastProps> = ({
    message,
    type = 'info',
    duration = 3000,
    onHide
}) => {
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
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

        // Auto-hide après duration
        const timer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: -100,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                onHide?.();
            });
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onHide, slideAnim, opacityAnim]);

    const getIcon = () => {
        switch (type) {
            case 'success':
                return 'check-circle';
            case 'error':
                return 'alert-circle';
            case 'warning':
                return 'alert-triangle';
            default:
                return 'info';
        }
    };

    const getColor = () => {
        switch (type) {
            case 'success':
                return '#10B981';
            case 'error':
                return '#EF4444';
            case 'warning':
                return '#F59E0B';
            default:
                return modernColors.primary;
        }
    };

    const getBackgroundColor = () => {
        switch (type) {
            case 'success':
                return '#D1FAE5';
            case 'error':
                return '#FEE2E2';
            case 'warning':
                return '#FEF3C7';
            default:
                return '#DBEAFE';
        }
    };

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY: slideAnim }],
                    opacity: opacityAnim,
                    backgroundColor: getBackgroundColor(),
                    borderLeftColor: getColor(),
                },
            ]}
        >
            <SafeIcon name={getIcon()} size={20} color={getColor()} />
            <Text style={[styles.message, { color: getColor() }]} numberOfLines={3}>
                {message}
            </Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 9999,
        gap: 12,
    },
    message: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
    },
});

export default Toast;

