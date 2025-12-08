import { useIsFocused, useNavigation } from '@react-navigation/native';
import { AVPlaybackStatus, ResizeMode, Video } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Dimensions,
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

const { width, height } = Dimensions.get('window');
const STORY_WIDTH = width;
const STORY_HEIGHT = height * 0.8;

interface PubliciteStoriesProps {
    userId?: string;
    userBehavior?: string[];
    onStoryEnd?: () => void;
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

const resolveMediaSource = (pub: ApiPublicite): { video?: string; image?: string } => {
    const videoUri = toVideoUri(
        pub?.square_video_url || pub?.video_square_url || pub?.video_url || pub?.videos?.[0]
    );
    if (videoUri) return { video: videoUri };

    const imageUri = toImageUri(
        pub?.thumbnail || pub?.preview_image || pub?.produits?.[0]?.images?.[0]
    );
    if (imageUri) return { image: imageUri };

    return {};
};

export const PubliciteStories: React.FC<PubliciteStoriesProps> = ({
    userId,
    userBehavior = [],
    onStoryEnd,
}) => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const { t } = useLanguageSafe();
    const videoRef = useRef<Video | null>(null);
    const [publicites, setPublicites] = useState<ApiPublicite[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(true);
    const [viewedRef, setViewedRef] = useState<Set<string>>(new Set());

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
            params.append('placement', 'stories');

            const response = await apiGet(`/api/publicites/actives?${params.toString()}`);

            if (response.success && response.data) {
                const pubs = Array.isArray(response.data) ? response.data : [];
                setPublicites(pubs);
                setCurrentIndex(0);
            } else {
                setPublicites([]);
            }
        } catch (error) {
            console.error('[PubliciteStories] Erreur chargement:', error);
            setPublicites([]);
        } finally {
            setLoading(false);
        }
    }, [userBehavior, userId]);

    useEffect(() => {
        loadPublicites();
    }, [loadPublicites]);

    useEffect(() => {
        if (!isFocused || publicites.length === 0) return;

        const activePub = publicites[currentIndex];
        if (!activePub) return;

        const pubId = String(activePub.id);
        if (viewedRef.has(pubId)) return;

        const timeout = setTimeout(() => {
            setViewedRef((prev) => new Set(prev).add(pubId));
            apiPost('/api/publicites/track-view', {
                publicite_id: Number(pubId),
                user_id: userId,
                placement: 'stories',
            }).catch(() => undefined);
        }, 2000);

        return () => {
            // ✅ SÉCURITÉ: Vérifier que timeout existe avant de le nettoyer
            if (timeout) {
                clearTimeout(timeout);
            }
        };
    }, [currentIndex, publicites, isFocused, userId, viewedRef]);

    const handleNext = useCallback(() => {
        if (currentIndex < publicites.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            onStoryEnd?.();
        }
    }, [currentIndex, publicites.length, onStoryEnd]);

    const handlePrevious = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    }, [currentIndex]);

    const handleCTAClick = useCallback(
        async (pub: ApiPublicite) => {
            try {
                await apiPost('/api/publicites/track-click', {
                    publicite_id: Number(pub.id),
                    user_id: userId,
                    placement: 'stories',
                });

                if (Array.isArray(pub.produits_indexes) && pub.produits_indexes.length > 0) {
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
                console.error('[PubliciteStories] Erreur tracking:', error);
            }
        },
        [navigation, userId]
    );

    if (loading || publicites.length === 0) {
        return null;
    }

    const activePub = publicites[currentIndex];
    if (!activePub) return null;

    const mediaSource = resolveMediaSource(activePub);
    const hasVideo = Boolean(mediaSource.video);

    return (
        <View style={styles.container}>
            {/* Progress bar */}
            <View style={styles.progressContainer}>
                {publicites.map((_, index) => (
                    <View
                        key={index}
                        style={[
                            styles.progressBar,
                            index < currentIndex && styles.progressBarFilled,
                            index === currentIndex && styles.progressBarActive,
                        ]}
                    />
                ))}
            </View>

            {/* Media */}
            <View style={styles.mediaContainer}>
                {hasVideo && mediaSource.video ? (
                    <Video
                        ref={videoRef}
                        source={{ uri: mediaSource.video }}
                        style={styles.video}
                        resizeMode={ResizeMode.COVER}
                        isLooping={false}
                        isMuted={isMuted}
                        shouldPlay={isFocused}
                        onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
                            if (status.isLoaded && status.didJustFinish) {
                                handleNext();
                            }
                        }}
                    />
                ) : mediaSource.image ? (
                    <Image source={{ uri: mediaSource.image }} style={styles.image} resizeMode="cover" />
                ) : (
                    <View style={styles.placeholder}>
                        <SafeIcon name="image" size={48} color={modernColors.border} />
                    </View>
                )}
            </View>

            {/* Content overlay */}
            <View style={styles.overlay}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => (navigation as any).goBack()}>
                        <SafeIcon name="x" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.sponsorLabel}>Publicité</Text>
                </View>

                <View style={styles.content}>
                    {activePub.titre && (
                        <Text style={styles.title} numberOfLines={2}>
                            {activePub.titre}
                        </Text>
                    )}
                    {activePub.description && (
                        <Text style={styles.description} numberOfLines={3}>
                            {activePub.description}
                        </Text>
                    )}
                </View>

                <TouchableOpacity style={styles.ctaButton} onPress={() => handleCTAClick(activePub)}>
                    <Text style={styles.ctaText}>Voir le produit</Text>
                </TouchableOpacity>
            </View>

            {/* Navigation areas */}
            <TouchableOpacity style={styles.leftArea} onPress={handlePrevious} />
            <TouchableOpacity style={styles.rightArea} onPress={handleNext} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    progressContainer: {
        flexDirection: 'row',
        paddingHorizontal: 8,
        paddingTop: 8,
        gap: 4,
        zIndex: 10,
    },
    progressBar: {
        flex: 1,
        height: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 2,
    },
    progressBarFilled: {
        backgroundColor: '#fff',
    },
    progressBarActive: {
        backgroundColor: modernColors.primary,
    },
    mediaContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    video: {
        width: STORY_WIDTH,
        height: STORY_HEIGHT,
    },
    image: {
        width: STORY_WIDTH,
        height: STORY_HEIGHT,
    },
    placeholder: {
        width: STORY_WIDTH,
        height: STORY_HEIGHT,
        backgroundColor: modernColors.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        paddingTop: 40,
    },
    sponsorLabel: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    content: {
        flex: 1,
        justifyContent: 'flex-end',
        padding: 20,
    },
    title: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    description: {
        color: '#fff',
        fontSize: 16,
        marginBottom: 16,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    ctaButton: {
        backgroundColor: modernColors.primary,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 25,
        alignSelf: 'flex-start',
        marginBottom: 20,
    },
    ctaText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    leftArea: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '33%',
        zIndex: 1,
    },
    rightArea: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: '33%',
        zIndex: 1,
    },
});

