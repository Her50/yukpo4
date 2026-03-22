import React, { memo, useCallback, useMemo } from 'react';
import { FlatList, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { SafeIcon } from './SafeIcon';
import { formatDistance } from '../services/navigationPricing';
import { modernColors } from '../theme/modernTheme';
import i18n from 'i18next';

interface PointOfInterest {
    id: string;
    name: string | { name?: string; text?: string };
    type: string;
    latitude?: number;
    longitude?: number;
    location?: { lat: number; lng: number };
    distance_from_route_meters: number;
    rating?: number;
    is_open?: boolean;
    address?: string;
    phone?: string;
    price_level?: number;
    total_ratings?: number;
}

interface PoiCategory {
    /** Chaîne ou objet i18n { labelKey, fallback } (évite crash React si mal typé) */
    label: string | { labelKey: string; fallback: string };
    icon: string;
    color: string;
    types: string[];
}

function categoryLabelText(
    label: PoiCategory['label'] | undefined,
    t: typeof i18n.t
): string {
    if (label == null) return '';
    if (typeof label === 'string') return label;
    if (typeof label === 'object' && label !== null && 'labelKey' in label) {
        const tr = t(label.labelKey);
        return (tr && tr !== label.labelKey ? tr : label.fallback) || label.fallback || '';
    }
    return '';
}

interface PoiFlatListItem {
    type: 'header' | 'poi';
    categoryKey?: string;
    category?: PoiCategory;
    poi?: PointOfInterest;
    expanded?: boolean;
    showAll?: boolean;
    poiCount?: number;
}

interface PoiFlatListProps {
    groupedPOIs: Record<string, PointOfInterest[]>;
    expandedCategories: Record<string, boolean>;
    poiShowAll: Record<string, boolean>;
    poiCategories: Record<string, PoiCategory>;
    onToggleCategory: (categoryKey: string) => void;
    onToggleShowAll: (categoryKey: string, showAll: boolean) => void;
    onNavigateToPOI: (poi: PointOfInterest) => void;
    onAddWaypoint: (poi: PointOfInterest) => void;
    onSharePOI: (poi: PointOfInterest) => void;
}

// Styles extraits pour éviter les re-renders
const styles = StyleSheet.create({
    poiCatCard: {
        marginBottom: 8,
        padding: 0,
        overflow: 'hidden',
    },
    poiCatHdr: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
    },
    poiCatIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    poiCatLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.text,
    },
    poiCatCount: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    poiExpandBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    poiItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    poiName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    poiAddr: {
        fontSize: 11,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    poiMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
        flexWrap: 'wrap',
    },
    poiDist: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    poiRating: {
        fontSize: 12,
        color: modernColors.text,
        fontWeight: '600',
    },
    poiPrice: {
        fontSize: 12,
    },
    openBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    openText: {
        fontSize: 10,
        fontWeight: '600',
    },
    poiNavBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#DCFCE7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    poiAddBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    poiShareBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: modernColors.surfaceVariant,
        alignItems: 'center',
        justifyContent: 'center',
    },
    poiShowMoreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    poiShowMoreTxt: {
        fontSize: 13,
        fontWeight: '600',
    },
});

const PoiFlatList: React.FC<PoiFlatListProps> = memo(({
    groupedPOIs,
    expandedCategories,
    poiShowAll,
    poiCategories,
    onToggleCategory,
    onToggleShowAll,
    onNavigateToPOI,
    onAddWaypoint,
    onSharePOI,
}) => {
    // Transforme les données groupées en liste plate pour FlatList
    const flatData = useMemo<PoiFlatListItem[]>(() => {
        const data: PoiFlatListItem[] = [];

        Object.entries(groupedPOIs).forEach(([catKey, pois]) => {
            if (pois.length === 0) return;

            const category = poiCategories[catKey];
            if (!category) return;

            const expanded = expandedCategories[catKey] || false;
            const showAll = poiShowAll[catKey] || false;

            // Header de catégorie
            data.push({
                type: 'header',
                categoryKey: catKey,
                category,
                expanded,
                showAll,
                poiCount: pois.length,
            });

            // POI visibles si catégorie expandée
            if (expanded) {
                const visiblePois = showAll ? pois : pois.slice(0, 5);
                visiblePois.forEach(poi => {
                    data.push({
                        type: 'poi',
                        categoryKey: catKey,
                        poi,
                    });
                });
            }
        });

        return data;
    }, [groupedPOIs, expandedCategories, poiShowAll, poiCategories]);

    // Hauteur fixe pour chaque type d'élément (optimisation FlatList)
    const getItemLayout = useCallback((data: PoiFlatListItem[] | null, index: number) => {
        const item = data?.[index];
        if (!item) return { length: 0, offset: 0, index };

        if (item.type === 'header') {
            return { length: 68, offset: 68 * index, index }; // Hauteur header
        } else if (item.type === 'poi') {
            return { length: 80, offset: 80 * index, index }; // Hauteur POI moyenne
        }

        return { length: 0, offset: 0, index };
    }, []);

    // Rendu optimisé des éléments
    const renderItem = useCallback(({ item }: { item: PoiFlatListItem }) => {
        if (item.type === 'header') {
            const { categoryKey, category, expanded, showAll, poiCount } = item;
            return (
                <View style={[styles.poiCatCard, { borderLeftWidth: 3, borderLeftColor: category?.color }]}>
                    <TouchableOpacity
                        style={styles.poiCatHdr}
                        onPress={() => categoryKey && onToggleCategory(categoryKey)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.poiCatIcon, { backgroundColor: category?.color + '15' }]}>
                            <Text style={{ fontSize: 20 }}>{category?.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.poiCatLabel}>{categoryLabelText(category?.label, i18n.t.bind(i18n))}</Text>
                            <Text style={styles.poiCatCount}>
                                {poiCount} {i18n.t('navPayment.placesFound') || i18n.t('navigationScreen.lieuxTrouves')}
                            </Text>
                        </View>
                        <View style={[styles.poiExpandBadge, {
                            backgroundColor: expanded ? category?.color + '20' : modernColors.surfaceVariant
                        }]}>
                            <SafeIcon
                                name={expanded ? 'ChevronUp' : 'ChevronDown'}
                                size={16}
                                color={expanded ? category?.color : modernColors.textSecondary}
                            />
                        </View>
                    </TouchableOpacity>
                </View>
            );
        } else if (item.type === 'poi') {
            const { poi, categoryKey } = item;
            const displayName = typeof poi?.name === 'string'
                ? poi.name
                : (typeof poi?.name === 'object' && poi?.name !== null
                    ? (poi.name as any).name || (poi.name as any).text || JSON.stringify(poi.name)
                    : 'Nom inconnu');

            return (
                <View style={styles.poiItem}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.poiName}>{displayName}</Text>
                        {poi?.address && (
                            <Text style={styles.poiAddr} numberOfLines={1}>
                                {poi.address}
                            </Text>
                        )}
                        <View style={styles.poiMeta}>
                            <Text style={styles.poiDist}>
                                {formatDistance(poi?.distance_from_route_meters || 0)}
                            </Text>
                            {poi?.rating != null && poi.rating > 0 && (
                                <Text style={styles.poiRating}>
                                    ⭐ {poi.rating}{poi.total_ratings ? ` (${poi.total_ratings})` : ''}
                                </Text>
                            )}
                            {poi?.price_level != null && poi.price_level > 0 && (
                                <Text style={styles.poiPrice}>
                                    {'💰'.repeat(poi.price_level)}
                                </Text>
                            )}
                            {poi?.is_open != null && (
                                <View style={[styles.openBadge, {
                                    backgroundColor: poi.is_open ? '#DCFCE7' : '#FEE2E2'
                                }]}>
                                    <Text style={[styles.openText, {
                                        color: poi.is_open ? '#16A34A' : '#EF4444'
                                    }]}>
                                        {poi.is_open ? 'Ouvert' : i18n.t('navigationScreen.ferme')}
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <View style={{ gap: 6 }}>
                        <TouchableOpacity
                            style={styles.poiNavBtn}
                            onPress={() => poi && onNavigateToPOI(poi)}
                        >
                            <SafeIcon name="Navigation" size={14} color="#10B981" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.poiAddBtn}
                            onPress={() => poi && onAddWaypoint(poi)}
                        >
                            <SafeIcon name="Plus" size={14} color={modernColors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.poiShareBtn}
                            onPress={() => poi && onSharePOI(poi)}
                        >
                            <SafeIcon name="Redo2" size={12} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return null;
    }, [onToggleCategory, onNavigateToPOI, onAddWaypoint, onSharePOI]);

    // Rendu du footer avec boutons "Voir plus"
    const renderFooter = useCallback(() => {
        const footerItems: JSX.Element[] = [];

        Object.entries(groupedPOIs).forEach(([catKey, pois]) => {
            if (pois.length === 0) return;

            const category = poiCategories[catKey];
            if (!category) return;

            const expanded = expandedCategories[catKey] || false;
            const showAll = poiShowAll[catKey] || false;

            if (expanded && !showAll && pois.length > 5) {
                footerItems.push(
                    <TouchableOpacity
                        key={`show-more-${catKey}`}
                        style={styles.poiShowMoreBtn}
                        onPress={() => onToggleShowAll(catKey, true)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.poiShowMoreTxt, { color: category.color }]}>
                            {i18n.t('navPayment.seeMore') || 'Voir plus'} ({pois.length - 5})
                        </Text>
                        <SafeIcon name="ChevronDown" size={14} color={category.color} />
                    </TouchableOpacity>
                );
            } else if (expanded && showAll && pois.length > 5) {
                footerItems.push(
                    <TouchableOpacity
                        key={`show-less-${catKey}`}
                        style={styles.poiShowMoreBtn}
                        onPress={() => onToggleShowAll(catKey, false)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.poiShowMoreTxt, { color: category.color }]}>
                            {i18n.t('navigation.reduire')}
                        </Text>
                        <SafeIcon name="ChevronUp" size={14} color={category.color} />
                    </TouchableOpacity>
                );
            }
        });

        return footerItems.length > 0 ? <View>{footerItems}</View> : null;
    }, [groupedPOIs, expandedCategories, poiShowAll, poiCategories, onToggleShowAll]);

    return (
        <FlatList
            data={flatData}
            keyExtractor={(item, index) =>
                item.type === 'header'
                    ? `header-${item.categoryKey}`
                    : `poi-${item.poi?.id || `temp-${index}`}`
            }
            renderItem={renderItem}
            getItemLayout={getItemLayout}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={8}
            windowSize={5}
            ListFooterComponent={renderFooter}
            contentContainerStyle={{ paddingBottom: 20 }}
        />
    );
});

PoiFlatList.displayName = 'PoiFlatList';

export default PoiFlatList;