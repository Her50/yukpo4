// Composants de design natifs React Native
import React from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors, modernStyles } from '../theme/modernTheme';

const { width } = Dimensions.get('window');

// Carte native avec ombres
interface NativeCardProps {
    children: React.ReactNode;
    style?: any;
    onPress?: () => void;
    padding?: number;
}

export const NativeCard: React.FC<NativeCardProps> = ({
    children,
    style,
    onPress,
    padding = 16
}) => {
    const CardComponent = onPress ? TouchableOpacity : View;

    return (
        <CardComponent
            style={[
                styles.card,
                { padding },
                style
            ]}
            onPress={onPress}
            activeOpacity={onPress ? 0.8 : 1}
        >
            {children}
        </CardComponent>
    );
};

// Bouton natif moderne
interface NativeButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'small' | 'medium' | 'large';
    disabled?: boolean;
    style?: any;
}

export const NativeButton: React.FC<NativeButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    size = 'medium',
    disabled = false,
    style
}) => {
    const buttonStyle = [
        styles.button,
        styles[`button_${variant}`],
        styles[`button_${size}`],
        disabled && styles.button_disabled,
        style
    ];

    const textStyle = [
        styles.buttonText,
        styles[`buttonText_${variant}`],
        styles[`buttonText_${size}`],
        disabled && styles.buttonText_disabled
    ];

    return (
        <TouchableOpacity
            style={buttonStyle}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.8}
        >
            <Text style={textStyle}>{title}</Text>
        </TouchableOpacity>
    );
};

// Gradient natif (simulation avec des couleurs)
interface NativeGradientProps {
    colors: string[];
    children: React.ReactNode;
    style?: any;
}

export const NativeGradient: React.FC<NativeGradientProps> = ({
    colors,
    children,
    style
}) => {
    const backgroundColor = colors[0] || modernColors.primary;

    return (
        <View style={[styles.gradient, { backgroundColor }, style]}>
            {children}
        </View>
    );
};

// Input natif
export interface NativeInputProps {
    placeholder?: string;
    value?: string;
    onChangeText?: (text: string) => void;
    secureTextEntry?: boolean;
    style?: any;
    multiline?: boolean;
    keyboardType?: any; // ✅ Ajout pour supporter différents types de clavier
    autoCapitalize?: any; // ✅ Ajout pour contrôler la capitalisation
    autoCorrect?: boolean; // ✅ Ajout pour contrôler l'auto-correction
    minLines?: number;
    onContentSizeChange?: (width: number, height: number) => void;
}

export const NativeInput: React.FC<NativeInputProps> = ({
    placeholder,
    value,
    onChangeText,
    secureTextEntry,
    style,
    multiline,
    keyboardType,
    autoCapitalize,
    autoCorrect,
    minLines = 1,
    onContentSizeChange
}) => {
    const [inputHeight, setInputHeight] = React.useState<number | undefined>(undefined);

    const containerStyles = [
        styles.inputContainer,
        multiline && styles.inputContainerMultiline,
        multiline && inputHeight ? { minHeight: inputHeight } : null,
        style
    ];
    const inputStyles = [
        styles.input,
        multiline && styles.inputMultiline,
        multiline && inputHeight ? { height: inputHeight - 24 } : null
    ];

    return (
        <View style={containerStyles}>
            <TextInput
                style={inputStyles}
                placeholder={placeholder}
                value={value}
                onChangeText={onChangeText}
                secureTextEntry={secureTextEntry}
                multiline={multiline}
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                autoCorrect={autoCorrect}
                placeholderTextColor={modernColors.textSecondary}
                blurOnSubmit={multiline ? false : undefined}
                returnKeyType={multiline ? 'default' : undefined}
                textBreakStrategy={multiline ? 'highQuality' : undefined}
                onContentSizeChange={(event) => {
                    if (multiline) {
                        const { width, height } = event.nativeEvent.contentSize;
                        const lineHeight = 24;
                        const minHeight = Math.max(minLines * lineHeight + 24, height + 24);
                        setInputHeight(minHeight);
                        onContentSizeChange?.(width, height);
                    }
                }}
            />
        </View>
    );
};

// Badge natif
interface NativeBadgeProps {
    text: string;
    variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
    size?: 'small' | 'medium';
}

export const NativeBadge: React.FC<NativeBadgeProps> = ({
    text,
    variant = 'neutral',
    size = 'medium'
}) => {
    return (
        <View style={[
            styles.badge,
            styles[`badge_${variant}`],
            styles[`badge_${size}`]
        ]}>
            <Text style={[
                styles.badgeText,
                styles[`badgeText_${variant}`],
                styles[`badgeText_${size}`]
            ]}>
                {text}
            </Text>
        </View>
    );
};

// Divider natif
export const NativeDivider: React.FC<{ style?: any }> = ({ style }) => {
    return <View style={[styles.divider, style]} />;
};

const styles = StyleSheet.create({
    // Card
    card: {
        backgroundColor: modernColors.surface,
        borderRadius: modernStyles.borderRadius.lg,
        ...modernStyles.shadowMedium,
        marginVertical: 4,
        marginHorizontal: 2,
    },

    // Button
    button: {
        borderRadius: modernStyles.borderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    button_primary: {
        backgroundColor: modernColors.primary,
    },
    button_secondary: {
        backgroundColor: modernColors.secondary,
    },
    button_outline: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: modernColors.primary,
    },
    button_ghost: {
        backgroundColor: 'transparent',
    },
    button_small: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        minHeight: 32,
    },
    button_medium: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 44,
    },
    button_large: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        minHeight: 52,
    },
    button_disabled: {
        opacity: 0.5,
    },
    buttonText: {
        fontWeight: '600',
        textAlign: 'center',
    },
    buttonText_primary: {
        color: '#FFFFFF',
    },
    buttonText_secondary: {
        color: '#FFFFFF',
    },
    buttonText_outline: {
        color: modernColors.primary,
    },
    buttonText_ghost: {
        color: modernColors.primary,
    },
    buttonText_small: {
        fontSize: 14,
    },
    buttonText_medium: {
        fontSize: 16,
    },
    buttonText_large: {
        fontSize: 18,
    },
    buttonText_disabled: {
        opacity: 0.7,
    },

    // Gradient
    gradient: {
        borderRadius: modernStyles.borderRadius.lg,
    },

    // Input
    inputContainer: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: modernStyles.borderRadius.md,
        backgroundColor: modernColors.surface,
        paddingHorizontal: 12,
        paddingVertical: 12,
        width: '100%',
    },
    input: {
        fontSize: 16,
        color: modernColors.text,
        minHeight: 20,
        flex: 1,
    },
    inputContainerMultiline: {
        minHeight: 160,
        paddingVertical: 16,
    },
    inputMultiline: {
        minHeight: 120,
        textAlignVertical: 'top',
    },

    // Badge
    badge: {
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
    },
    badge_success: {
        backgroundColor: modernColors.success + '20',
    },
    badge_warning: {
        backgroundColor: modernColors.warning + '20',
    },
    badge_error: {
        backgroundColor: modernColors.error + '20',
    },
    badge_info: {
        backgroundColor: modernColors.info + '20',
    },
    badge_neutral: {
        backgroundColor: modernColors.textSecondary + '20',
    },
    badge_small: {
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    badge_medium: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    badgeText: {
        fontWeight: '600',
        textAlign: 'center',
    },
    badgeText_success: {
        color: modernColors.success,
    },
    badgeText_warning: {
        color: modernColors.warning,
    },
    badgeText_error: {
        color: modernColors.error,
    },
    badgeText_info: {
        color: modernColors.info,
    },
    badgeText_neutral: {
        color: modernColors.textSecondary,
    },
    badgeText_small: {
        fontSize: 12,
    },
    badgeText_medium: {
        fontSize: 14,
    },

    // Divider
    divider: {
        height: 1,
        backgroundColor: modernColors.border,
        marginVertical: 8,
    },
});

export default {
    NativeCard,
    NativeButton,
    NativeGradient,
    NativeInput,
    NativeBadge,
    NativeDivider,
};
