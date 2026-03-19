/**
 * 🎯 Bouton avec haptic feedback
 * Micro-interactions niveau iOS/Android natif
 */

import * as Haptics from 'expo-haptics';
import React from 'react';
import { NativeButton } from '../SafeNativeDesign';

interface HapticFeedbackButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'small' | 'medium' | 'large';
    disabled?: boolean;
    style?: any;
    hapticType?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
}

const HapticFeedbackButton: React.FC<HapticFeedbackButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    disabled = false,
    style,
    hapticType = 'light',
}) => {
    const handlePress = () => {
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
        onPress();
    };

    return (
        <NativeButton
            title={title}
            onPress={handlePress}
            variant={variant}
            size={size}
            disabled={disabled}
            style={style}
        />
    );
};

export default HapticFeedbackButton;


