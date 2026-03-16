import { useIsFocused, useNavigation } from '@react-navigation/native';
import { ResizeMode, Video } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { config } from '../config/environment';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;
const CARD_HEIGHT = CARD_WIDTH * 1.2;

interface PubliciteCarouselPlacementProps {
    userId?: string;
    userBehavior?: string[];
    onItemClick?: (publicite: ApiPublicite) => void;
}

interface ApiPublicite {
    id: string;
    titre?: string;
    description?: string;
    produits?: any[];
    videos_meta?: any[];
    [key: string]: any;
}

const toVideoUri = (value?: string | null): string | null => {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('data:video')) return trimmed;
    if (trimmed.startsWith('/')) {
        const base = (config.UPLOAD_BASE_URL || '').replace(/\/$/, '');
        if (base) return `${base}/${trimmed.replace(/^\//, '')}`;
    }
    return null;
};

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

export const PubliciteCarouselPlacement: React.FC<PubliciteCarouselPlacementProps> = ({
    userId,
    userBehavior = [],
    onItemClick,
}) => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const { t } = useLanguageSafe();
    const [publicites, setPublicites] = useState<ApiPublicite[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const videoRefs = useRef<Record<string, Video | null>>({});
    const viewedRef = useRef<Set<string>>(new Set());

    const loadPublicites = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (userBehavior.length > 0) {
                params.append('categories', userBehavior.join(','));
            }
            if (userId) {
                params.append('user_id', userId);
            }
            params.append('placement', 'carousel');

            const response = await apiGet(`/api/publicites/actives?${params.toString()}`);

            if (response.success && response.data) {
                const pubs = Array.isArray(response.data) ? response.data : [];
                setPublicites(pubs);
            } else {
                setPublicites([]);
            }
        } catch (error) {
            console.error('[PubliciteCarousel] Erreur chargement:', error);
            setPublicites([]);
        } finally {
            setLoading(false);
        }
    }, [userBehavior, userId]);

    useEffect(() => {
        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        loadPublicites().catch(error => {
            console.error('[PubliciteCarouselPlacement] Erreur loadPublicites:', error);
        });
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
    }, [loadPublicites]);

    useEffect(() => {
        if (!isFocused || publicites.length === 0) return;

        const activePub = publicites[currentIndex];
        if (!activePub) return;

        const pubId = String(activePub.id);
        if (viewedRef.current.has(pubId)) return;

        const timeout = setTimeout(() => {
            viewedRef.current.add(pubId);
            apiPost('/api/publicites/track-view', {
                publicite_id: Number(pubId),
                user_id: userId,
                placement: 'carousel',
            }).catch(() => undefined);
        }, 2000);

        return () => {
            // ✅ SÉCURITÉ: Vérifier que timeout existe avant de le nettoyer
            if (timeout) {
                clearTimeout(timeout);
            }
        };
    }, [currentIndex, publicites, isFocused, userId]);

    const handleCTAClick = useCallback(
        async (pub: ApiPublicite) => {
            try {
                await apiPost('/api/publicites/track-click', {
                    publicite_id: Number(pub.id),
                    user_id: userId,
                    placement: 'carousel',
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
                console.error('[PubliciteCarousel] Erreur tracking:', error);
            }
        },
        [navigation, userId, onItemClick]
    );

    const renderItem = useCallback(
        ({ item, index }: { item: ApiPublicite; index: number }) => {
            const videoUri = toVideoUri(
                item?.square_video_url || item?.video_square_url || item?.video_url || item?.videos?.[0]
            );
            const imageUri = toImageUri(
                item?.thumbnail || item?.preview_image || item?.produits?.[0]?.images?.[0]
            );
            const isActive = index === currentIndex;

            return (
                <View style={styles.card}>
                    {videoUri ? (
                        <Video
                            ref={(ref) => {
                                videoRefs.current[item.id] = ref;
                            }}
                            source={{ uri: videoUri }}
                            style={styles.media}
                            resizeMode={ResizeMode.COVER}
                            isLooping={true}
                            isMuted={true}
                            shouldPlay={isFocused && isActive}
                        />
                    ) : imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.media} resizeMode="cover" />
                    ) : (
                        <View style={[styles.media, styles.placeholder]}>
                            <SafeIcon name="image" size={48} color={modernColors.border} />
                        </View>
                    )}

                    <View style={styles.content}>
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
                        <TouchableOpacity style={styles.ctaButton} onPress={() => handleCTAClick(item)}>
                            <Text style={styles.ctaText}>{t('publiciteCarouselPlacement.voirLeProduit')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        },
        [currentIndex, isFocused, handleCTAClick]
    );

    if (loading || publicites.length === 0) {
        return null;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('publiciteCarouselPlacement.publicites')}</Text>
                <Text style={styles.headerSubtitle}>
                    {publicites.length} {publicites.length > 1 ? t('publiciteCarouselPlacement.publicites') : t('publiciteCarouselPlacement.publicite')}
                </Text>
            </View>

            <FlatList
                data={publicites}
                renderItem={renderItem}
                keyExtractor={(item) => String(item.id)}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / CARD_WIDTH);
                    setCurrentIndex(index);
                }}
                snapToInterval={CARD_WIDTH}
                decelerationRate="fast"
                contentContainerStyle={styles.listContent}
            />

            {/* Indicators */}
            {publicites.length > 1 && (
                <View style={styles.indicators}>
                    {publicites.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.indicator,
                                index === currentIndex && styles.indicatorActive,
                            ]}
                        />
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 16,
    },
    header: {
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    listContent: {
        paddingHorizontal: (width - CARD_WIDTH) / 2,
    },
    card: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: modernColors.surface,
        borderRadius: 16,
        overflow: 'hidden',
        marginHorizontal: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    media: {
        width: '100%',
        height: CARD_HEIGHT * 0.7,
    },
    placeholder: {
        backgroundColor: modernColors.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        padding: 16,
        justifyContent: 'space-between',
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
        marginBottom: 12,
    },
    ctaButton: {
        backgroundColor: modernColors.primary,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    ctaText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    indicators: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 12,
        gap: 6,
    },
    indicator: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: modernColors.border,
    },
    indicatorActive: {
        backgroundColor: modernColors.primary,
        width: 20,
    },
});

