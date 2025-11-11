import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

interface DeliveryAvatarBubbleProps {
    mood?: 'smile' | 'excited' | 'focused';
    message: string;
    subtitle?: string;
}

const moodIconMap: Record<string, string> = {
    smile: 'smile',
    excited: 'shopping-bag',
    focused: 'activity',
};

const DeliveryAvatarBubble: React.FC<DeliveryAvatarBubbleProps> = ({
    mood = 'smile',
    message,
    subtitle,
}) => {
    const iconName = moodIconMap[mood] ?? 'smile';

    return (
        <View style={styles.container}>
            <View style={styles.icon}>
                <SafeIcon name={iconName} size={22} color='#fff' />
            </View>
            <View style={styles.texts}>
                <Text style={styles.message}>{message}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: 12,
        backgroundColor: modernColors.surface,
        borderRadius: 20,
        padding: 16,
        shadowColor: modernColors.shadow,
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 12,
        elevation: 6,
    },
    icon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    texts: {
        flex: 1,
        gap: 4,
    },
    message: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    subtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
});

export default DeliveryAvatarBubble;


