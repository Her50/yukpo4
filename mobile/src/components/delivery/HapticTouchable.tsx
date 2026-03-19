/**
 * 🎯 Composant Touchable avec haptic feedback automatique
 * Micro-interactions partout
 */

import * as Haptics from 'expo-haptics';
import React from 'react';
import { TouchableOpacity, TouchableOpacityProps } from 'react-native';

interface HapticTouchableProps extends TouchableOpacityProps {
    hapticType?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
    children: React.ReactNode;
}

const HapticTouchable: React.FC<HapticTouchableProps> = ({
    hapticType = 'light',
    onPress,
    children,
    ...props
}) => {
    const handlePress = (event: any) => {
        // Haptic feedback selon le type
        switch (hapticType) {
            case 'light':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                break;
            case 'medium':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                break;
            case 'heavy':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                break;
            case 'success':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                break;
            case 'warning':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                break;
            case 'error':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                break;
        }
        onPress?.(event);
    };

    return (
        <TouchableOpacity {...props} onPress={handlePress}>
            {children}
        </TouchableOpacity>
    );
};

export default HapticTouchable;


