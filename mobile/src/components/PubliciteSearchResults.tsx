import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { config } from '../config/environment';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { NativeCard } from './NativeDesign';
import SafeIcon from './SafeIcon';

interface PubliciteSearchResultsProps {
    userId?: string;
    searchQuery?: string;
    onItemClick?: (publicite: ApiPublicite) => void;
}

interface ApiPublicite {
    id: string;
    titre?: string;
    description?: string;
    produits?: any[];
    [key: string]: any;
}

const toImageUri = (value?: string | null): string | null => {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (trimmed.startsWith('data:image')) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('/')) {
        const base = (config.UPLOAD_BASE_URL || '').replace(/\/$/, '');
        if (base) return `${base}/${trimmed.replace(/^\//, '')}`;
    }
    return null;
};

export const PubliciteSearchResults: React.FC<PubliciteSearchResultsProps> = ({
    userId,
    searchQuery,
    onItemClick,
}) => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const [publicites, setPublicites] = useState<ApiPublicite[]>([]);
    const [loading, setLoading] = useState(false);

    const loadPublicites = useCallback(async () => {
        if (!searchQuery || searchQuery.length < 2) {
            setPublicites([]);
            return;
        }

        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (userId) {
                params.append('user_id', userId);
            }
            params.append('placement', 'search');
            params.append('search', searchQuery);

            const response = await apiGet(`/api/publicites/actives?${params.toString()}`);

            if (response.success && response.data) {
                const pubs = Array.isArray(response.data) ? response.data : [];
                // Filtrer par recherche (titre/description)
                const filtered = pubs.filter((pub: ApiPublicite) => {
                    const query = searchQuery.toLowerCase();
                    const titre = (pub.titre || '').toLowerCase();
                    const description = (pub.description || '').toLowerCase();
                    return titre.includes(query) || description.includes(query);
                });
                setPublicites(filtered);
            } else {
                setPublicites([]);
            }
        } catch (error) {
            console.error('[PubliciteSearchResults] Erreur chargement:', error);
            setPublicites([]);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, userId]);

    useEffect(() => {
        loadPublicites();
    }, [loadPublicites]);

    const handleItemClick = useCallback(
        async (pub: ApiPublicite) => {
            try {
                await apiPost('/api/publicites/track-click', {
                    publicite_id: Number(pub.id),
                    user_id: userId,
                    placement: 'search',
                });

                if (onItemClick) {
                    onItemClick(pub);
                } else if (Array.isArray(pub.produits_indexes) && pub.produits_indexes.length > 0) {
                    const firstIndex = pub.produits_indexes[0];
                    const parts = firstIndex.split('_');
                    if (parts.length >= 2) {
                        const serviceId = parseInt(parts[0], 10);
                        const productIndex = parseInt(parts[1], 10);
                        if (!isNaN(serviceId) && !isNaN(productIndex)) {
                            (navigation as any).navigate('ProductDetail', {
                                serviceId,
                                productIndex,
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('[PubliciteSearchResults] Erreur tracking:', error);
            }
        },
        [navigation, userId, onItemClick]
    );

    const renderItem = useCallback(
        ({ item }: { item: ApiPublicite }) => {
            const imageUri = toImageUri(
                item?.thumbnail || item?.preview_image || item?.produits?.[0]?.images?.[0]
            );

            return (
                <TouchableOpacity onPress={() => handleItemClick(item)}>
                    <NativeCard style={styles.card}>
                        <View style={styles.cardContent}>
                            {imageUri ? (
                                <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
                            ) : (
                                <View style={[styles.image, styles.placeholder]}>
                                    <SafeIcon name="image" size={32} color={modernColors.border} />
                                </View>
                            )}
                            <View style={styles.textContent}>
                                <View style={styles.badge}>
                                    <SafeIcon name="tag" size={12} color={modernColors.primary} />
                                    <Text style={styles.badgeText}>Publicité</Text>
                                </View>
                                {item.titre && (
                                    <Text style={styles.title} numberOfLines={2}>
                                        {item.titre}
                                    </Text>
                                )}
                                {item.description && (
                                    <Text style={styles.description} numberOfLines={2}>
                                        {item.description}
                                    </Text>
                                )}
                            </View>
                        </View>
                    </NativeCard>
                </TouchableOpacity>
            );
        },
        [handleItemClick]
    );

    if (!searchQuery || searchQuery.length < 2) {
        return null;
    }

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={modernColors.primary} />
            </View>
        );
    }

    if (publicites.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>
                Publicités ({publicites.length})
            </Text>
            <FlatList
                data={publicites}
                renderItem={renderItem}
                keyExtractor={(item) => String(item.id)}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 12,
        paddingHorizontal: 16,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    card: {
        marginHorizontal: 16,
    },
    cardContent: {
        flexDirection: 'row',
        gap: 12,
    },
    image: {
        width: 80,
        height: 80,
        borderRadius: 8,
    },
    placeholder: {
        backgroundColor: modernColors.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContent: {
        flex: 1,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: modernColors.surfaceVariant,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginBottom: 8,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: modernColors.primary,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    description: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    separator: {
        height: 12,
    },
});

