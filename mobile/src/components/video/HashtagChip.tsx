/**
 * Composant chip hashtag cliquable
 * Utilisé dans VideoFeed pour afficher et naviguer vers les hashtags
 */

import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { modernColors } from '../../theme/modernTheme';

interface HashtagChipProps {
    hashtag: string;
    onPress?: () => void;
    variant?: 'default' | 'trending' | 'selected';
}

export const HashtagChip: React.FC<HashtagChipProps> = ({
    hashtag,
    onPress,
    variant = 'default',
}) => {
    const navigation = useNavigation();

    const handlePress = () => {
        if (onPress) {
            onPress();
        } else {
            // Navigation par défaut vers page découverte hashtag
            (navigation as any).navigate('HashtagDiscovery', { hashtag });
        }
    };

    const displayTag = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;

    return (
        <TouchableOpacity
            style={[
                styles.chip,
                variant === 'trending' && styles.chipTrending,
                variant === 'selected' && styles.chipSelected,
            ]}
            onPress={handlePress}
            activeOpacity={0.7}
        >
            <Text
                style={[
                    styles.chipText,
                    variant === 'trending' && styles.chipTextTrending,
                    variant === 'selected' && styles.chipTextSelected,
                ]}
            >
                {displayTag}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        marginRight: 8,
        marginBottom: 8,
    },
    chipTrending: {
        backgroundColor: 'rgba(99, 102, 241, 0.3)',
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    chipSelected: {
        backgroundColor: modernColors.primary,
    },
    chipText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
    chipTextTrending: {
        color: '#E0E7FF',
    },
    chipTextSelected: {
        color: '#FFF',
        fontWeight: '700',
    },
});

