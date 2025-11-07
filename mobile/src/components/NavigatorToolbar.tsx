import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors, modernStyles } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { SafeNativeView } from './SafeNativeView';

type NavigatorToolbarTone = 'light' | 'dark';

interface NavigatorToolbarProps {
    title?: string;
    subtitle?: string;
    onClose?: () => void;
    rightSlot?: React.ReactNode;
    tone?: NavigatorToolbarTone;
    showHandle?: boolean;
    backgroundColor?: string;
}

export const NavigatorToolbar: React.FC<NavigatorToolbarProps> = ({
    title,
    subtitle,
    onClose,
    rightSlot,
    tone = 'light',
    showHandle = true,
    backgroundColor = 'transparent',
}) => {
    const navigation = useNavigation();

    const isDark = tone === 'dark';
    const textColor = isDark ? '#FFFFFF' : modernColors.text;
    const subTextColor = isDark ? 'rgba(255,255,255,0.7)' : modernColors.textSecondary;

    const handleClose = () => {
        if (onClose) {
            onClose();
            return;
        }

        if (navigation.canGoBack()) {
            navigation.goBack();
        }
    };

    return (
        <SafeNativeView
            edges={['top']}
            backgroundColor={backgroundColor}
            style={[styles.safeContainer, backgroundColor !== 'transparent' && { backgroundColor }]}
        >
            <View style={styles.container}>
                {showHandle && (
                    <View
                        style={[
                            styles.handle,
                            { backgroundColor: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.12)' },
                        ]}
                    />
                )}

                <View style={styles.toolbarRow}>
                    <TouchableOpacity
                        onPress={handleClose}
                        style={[
                            styles.actionButton,
                            {
                                backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.06)',
                            },
                        ]}
                        activeOpacity={0.8}
                    >
                        <SafeIcon name="x" size={18} color={textColor} />
                    </TouchableOpacity>

                    <View style={styles.titleContainer}>
                        {title ? (
                            <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
                                {title}
                            </Text>
                        ) : null}
                        {subtitle ? (
                            <Text style={[styles.subtitle, { color: subTextColor }]} numberOfLines={1}>
                                {subtitle}
                            </Text>
                        ) : null}
                    </View>

                    <View style={styles.rightSlot}>{rightSlot}</View>
                </View>
            </View>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    safeContainer: {
        paddingBottom: modernStyles.spacing.sm,
    },
    container: {
        paddingHorizontal: modernStyles.spacing.md,
        gap: modernStyles.spacing.sm,
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 999,
    },
    toolbarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleContainer: {
        flex: 1,
        marginHorizontal: modernStyles.spacing.sm,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
    },
    subtitle: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    rightSlot: {
        minWidth: 36,
        minHeight: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

export default NavigatorToolbar;

