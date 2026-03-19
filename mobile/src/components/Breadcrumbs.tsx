/**
 * Breadcrumbs - Navigation fil d'ariane pour aider l'utilisateur à s'orienter dans la navigation
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { modernColors } from '../theme/modernTheme';

export interface BreadcrumbItem {
    label: string;
    route?: string;
    onPress?: () => void;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
    maxItems?: number; // Nombre maximum d'items à afficher (avec ellipsis si plus)
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
    items,
    maxItems = 4,
}) => {
    // Si trop d'items, afficher seulement le premier, ellipsis, et les 2 derniers
    const { t } = useLanguageSafe();
    const displayItems = React.useMemo(() => {
        if (items.length <= maxItems) {
            return items;
        }

        const first = items[0];
        const last = items.slice(-2);

        return [
            first,
            { label: '...', route: undefined, onPress: undefined } as BreadcrumbItem,
            ...last,
        ];
    }, [items, maxItems]);

    if (items.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {displayItems.map((item, index) => {
                    const isLast = index === displayItems.length - 1;
                    const isEllipsis = item.label === '...';

                    if (isEllipsis) {
                        return (
                            <React.Fragment key={`ellipsis-${index}`}>
                                <Text style={styles.separator}>›</Text>
                                <Text style={styles.ellipsis}>...</Text>
                            </React.Fragment>
                        );
                    }

                    return (
                        <React.Fragment key={`${item.label}-${index}`}>
                            {index > 0 && <Text style={styles.separator}>›</Text>}
                            {isLast ? (
                                <View style={styles.currentItem}>
                                    <Text style={styles.currentLabel}>{item.label}</Text>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={styles.item}
                                    onPress={item.onPress}
                                    activeOpacity={0.7}
                                    disabled={!item.onPress}
                                >
                                    <Text style={styles.label}>{item.label}</Text>
                                </TouchableOpacity>
                            )}
                        </React.Fragment>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: modernColors.borderLight,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    item: {
        paddingVertical: 4,
        paddingHorizontal: 4,
    },
    label: {
        fontSize: 13,
        color: modernColors.primary,
        fontWeight: '500',
    },
    currentItem: {
        paddingVertical: 4,
        paddingHorizontal: 4,
    },
    currentLabel: {
        fontSize: 13,
        color: modernColors.text,
        fontWeight: '600',
    },
    separator: {
        fontSize: 14,
        color: modernColors.textTertiary,
        marginHorizontal: 6,
        fontWeight: '400',
    },
    ellipsis: {
        fontSize: 13,
        color: modernColors.textTertiary,
        marginHorizontal: 4,
    },
});

