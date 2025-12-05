/**
 * Liste de hashtags affichée dans VideoFeed
 * Affiche les hashtags d'une vidéo avec navigation
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { HashtagChip } from './HashtagChip';

interface HashtagsListProps {
    hashtags: string[];
    maxVisible?: number;
    showTrending?: boolean;
    onHashtagPress?: (hashtag: string) => void;
}

export const HashtagsList: React.FC<HashtagsListProps> = ({
    hashtags,
    maxVisible = 5,
    showTrending = false,
    onHashtagPress,
}) => {
    if (!hashtags || hashtags.length === 0) {
        return null;
    }

    const visibleHashtags = hashtags.slice(0, maxVisible);
    const remainingCount = Math.max(0, hashtags.length - maxVisible);

    return (
        <View style={styles.container}>
            {visibleHashtags.map((hashtag, index) => (
                <HashtagChip
                    key={`${hashtag}-${index}`}
                    hashtag={hashtag}
                    variant={showTrending && index === 0 ? 'trending' : 'default'}
                    onPress={onHashtagPress ? () => onHashtagPress(hashtag) : undefined}
                />
            ))}
            {remainingCount > 0 && (
                <HashtagChip
                    hashtag={`+${remainingCount}`}
                    variant="default"
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 8,
    },
});

