import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import { SafeIcon } from '../SafeIcon';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastNotificationProps {
    message: string;
    type?: ToastType;
    duration?: number;
    onClose?: () => void;
    visible: boolean;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({
    message,
    type = 'info',
    duration = 3000,
    onClose,
    visible,
}) => {
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
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

            const timer = setTimeout(() => {
                hideToast();
            }, duration);

            return () => clearTimeout(timer);
        } else {
            hideToast();
        }
    }, [visible, duration]);

    const hideToast = () => {
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

    const getTypeStyles = () => {
        switch (type) {
            case 'success':
                return {
                    backgroundColor: modernColors.success + '15',
                    borderColor: modernColors.success,
                    icon: 'check-circle',
                    iconColor: modernColors.success,
                };
            case 'error':
                return {
                    backgroundColor: modernColors.error + '15',
                    borderColor: modernColors.error,
                    icon: 'alert-circle',
                    iconColor: modernColors.error,
                };
            case 'warning':
                return {
                    backgroundColor: modernColors.warning + '15',
                    borderColor: modernColors.warning,
                    icon: 'alert-triangle',
                    iconColor: modernColors.warning,
                };
            default:
                return {
                    backgroundColor: modernColors.info + '15',
                    borderColor: modernColors.info,
                    icon: 'info',
                    iconColor: modernColors.info,
                };
        }
    };

    const typeStyles = getTypeStyles();

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY: slideAnim }],
                    opacity: opacityAnim,
                },
            ]}
        >
            <View
                style={[
                    styles.toast,
                    {
                        backgroundColor: typeStyles.backgroundColor,
                        borderColor: typeStyles.borderColor,
                    },
                ]}
            >
                <SafeIcon
                    name={typeStyles.icon}
                    size={20}
                    color={typeStyles.iconColor}
                />
                <Text style={styles.message}>{message}</Text>
                <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
                    <SafeIcon name="x" size={16} color={modernColors.textSecondary} />
                </TouchableOpacity>
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
        borderWidth: 1,
        shadowColor: modernColors.shadow,
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 5,
        gap: 12,
    },
    message: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
});

export default ToastNotification;

