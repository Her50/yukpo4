import React, { useCallback } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from './SafeIcon';

interface ProductDescriptionSectionProps {
    description: string;
    contentId: string;
    expandedDescriptions: Record<string, boolean>;
    onToggleDescription: (contentId: string) => void;
    textColor?: string;
    seeMoreColor?: string;
    fontSize?: number;
    maxHeightCollapsed?: number;
    maxHeightExpanded?: number;
    showSeeMoreThreshold?: number;
}

const ProductDescriptionSection: React.FC<ProductDescriptionSectionProps> = ({
    description,
    contentId,
    expandedDescriptions,
    onToggleDescription,
    textColor = 'rgba(255,255,255,0.8)',
    seeMoreColor = '#FF2D55',
    fontSize = 13,
    maxHeightCollapsed = 36,
    maxHeightExpanded = 120,
    showSeeMoreThreshold = 100,
}) => {
    const isExpanded = expandedDescriptions[contentId] || false;
    const shouldShowSeeMore = description.length > showSeeMoreThreshold;

    const handleToggle = useCallback(() => {
        onToggleDescription(contentId);
    }, [contentId, onToggleDescription]);

    if (!description) return null;

    return (
        <View style={styles.descriptionSection}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled={true}
                style={[
                    styles.descriptionCollapsed,
                    isExpanded && { maxHeight: maxHeightExpanded }
                ]}
            >
                <Text style={[styles.description, { fontSize, color: textColor }]}>
                    {description}
                </Text>
            </ScrollView>
            {shouldShowSeeMore && (
                <TouchableOpacity
                    style={styles.seeMoreButton}
                    onPress={handleToggle}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.seeMoreText, { color: seeMoreColor }]}>
                        {isExpanded ? 'Voir moins' : 'Voir plus'}
                    </Text>
                    <SafeIcon
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={12}
                        color={seeMoreColor}
                        type="lucide"
                    />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    descriptionSection: {
        marginTop: 4,
        marginBottom: 4,
    },
    descriptionCollapsed: {
        maxHeight: 36, // Environ 2 lignes
    },
    description: {
        fontSize: 13,
        lineHeight: 18,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    seeMoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
        alignSelf: 'flex-start',
    },
    seeMoreText: {
        fontSize: 12,
        fontWeight: '600',
    },
});

export default ProductDescriptionSection;
