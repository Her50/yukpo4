import React from 'react';
import {
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors, modernStyles } from '../theme/modernTheme';

interface ModernToggleProps {
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
    size?: 'small' | 'medium' | 'large';
    color?: string;
}

const ModernToggle: React.FC<ModernToggleProps> = ({
    value,
    onValueChange,
    disabled = false,
    size = 'medium',
    color = modernColors.primary,
}) => {
    const getSizeStyles = () => {
        switch (size) {
            case 'small':
                return {
                    width: 36,
                    height: 20,
                    thumbSize: 16,
                    padding: 2,
                };
            case 'large':
                return {
                    width: 56,
                    height: 32,
                    thumbSize: 28,
                    padding: 2,
                };
            default: // medium
                return {
                    width: 44,
                    height: 24,
                    thumbSize: 20,
                    padding: 2,
                };
        }
    };

    const sizeStyles = getSizeStyles();

    return (
        <TouchableOpacity
            style={[
                styles.container,
                {
                    width: sizeStyles.width,
                    height: sizeStyles.height,
                    backgroundColor: value ? color : modernColors.surfaceVariant,
                    opacity: disabled ? 0.5 : 1,
                }
            ]}
            onPress={() => !disabled && onValueChange(!value)}
            disabled={disabled}
            activeOpacity={0.8}
        >
            <View
                style={[
                    styles.thumb,
                    {
                        width: sizeStyles.thumbSize,
                        height: sizeStyles.thumbSize,
                        transform: [{ translateX: value ? sizeStyles.width - sizeStyles.thumbSize - sizeStyles.padding : sizeStyles.padding }],
                    }
                ]}
            />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        justifyContent: 'center',
        ...modernStyles.shadowSmall,
    },
    thumb: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        ...modernStyles.shadowSmall,
    },
});

export default ModernToggle;






