// @ts-nocheck
// ✅ NOUVEAU: Bibliothèque de musique trending avec intégration TikTok/Spotify

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { apiGet } from '../services/api';
import i18n from '../i18n';
import { modernColors } from '../theme/modernTheme';
import type { CuratedPlaylist, MusicTrack } from '../types/Music';
import { SafeIcon } from './SafeIcon';
import { NativeButton, NativeInput } from './SafeNativeDesign';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface TrendingMusicLibraryProps {
    onTrackSelected?: (track: MusicTrack) => void;
    onPlaylistSelected?: (playlist: CuratedPlaylist) => void;
    maxSelection?: number;
    showWaveform?: boolean;
    enableVideoAnalysis?: boolean;
    videoUrl?: string;
}

const MUSIC_CATEGORIES = [
    { key: 'viral', label: '🔥 Viral', icon: 'trending-up', color: '#FF0050' },
    { key: 'cinematic', label: t('trendingMusicLibrary.cine'), icon: 'film', color: '#8B5CF6' },
    { key: 'corporate', label: '💼 Business', icon: 'briefcase', color: '#3B82F6' },
    { key: 'chill', label: '🌊 Chill', icon: 'waves', color: '#10B981' },
    { key: 'energy', label: '⚡ Energy', icon: 'zap', color: '#F59E0B' },
    { key: 'lofi', label: '🎧 Lo-Fi', icon: 'headphones', color: '#6B7280' },
];

const MOOD_FILTERS = [
    { key: 'energetic', label: String(i18n.t('trendingMusicLibrary.energique')), emoji: '🔥' },
    { key: 'happy', label: 'Joyeux', emoji: '😊' },
    { key: 'romantic', label: 'Romantique', emoji: '💕' },
    { key: 'sad', label: 'Triste', emoji: '😢' },
    { key: 'chill', label: String(i18n.t('trendingMusicLibrary.detendu')), emoji: '😌' },
    { key: 'dramatic', label: 'Dramatique', emoji: '🎭' },
];

const GENRE_FILTERS = [
    'Pop', 'Hip-Hop', 'Electronic', 'Rock', 'R&B', 'Country',
    'Jazz', 'Classical', 'Latin', 'Indie', 'Metal', 'Folk'
];

export const TrendingMusicLibrary: React.FC<TrendingMusicLibraryProps> = ({
    onTrackSelected,
    onPlaylistSelected,
    maxSelection = 5,
    showWaveform = true,
    enableVideoAnalysis = false,
    videoUrl,
}) => {
        const { t } = useLanguageSafe();
const [trendingTracks, setTrendingTracks] = useState<MusicTrack[]>([]);
    const [curatedPlaylists, setCuratedPlaylists] = useState<CuratedPlaylist[]>([]);
    const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('viral');
    const [selectedMood, setSelectedMood] = useState<string | null>(null);
    const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'tracks' | 'playlists'>('tracks');
    const [analyzedTracks, setAnalyzedTracks] = useState<MusicTrack[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Charger les données initiales
    useEffect(() => {
        loadTrendingData();
    }, [selectedCategory, selectedMood, selectedGenre]);

    // Analyser la vidéo si disponible
    useEffect(() => {
        if (enableVideoAnalysis && videoUrl) {
            analyzeVideoForMusic();
        }
    }, [enableVideoAnalysis, videoUrl]);

    const loadTrendingData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Charger les pistes trending
            const tracksResponse = await apiGet('/music/trending', {
                params: {
                    category: selectedCategory,
                    mood: selectedMood,
                    genre: selectedGenre,
                    limit: 50
                }
            });

            const trd: any = tracksResponse.data;
            if (tracksResponse.success && trd?.tracks) {
                setTrendingTracks(trd.tracks);
            }

            // Charger les playlists curées
            const playlistsResponse = await apiGet('/music/playlists', {
                params: {
                    category: selectedCategory,
                    mood: selectedMood,
                    limit: 20
                }
            });

            const prd: any = playlistsResponse.data;
            if (playlistsResponse.success && prd?.playlists) {
                setCuratedPlaylists(prd.playlists);
            }
        } catch (err: any) {
            console.error('[TrendingMusicLibrary] Erreur chargement:', err);
            setError(err.message || t('trendingMusicLibrary.erreurLorsDuChargementDe'));
        } finally {
            setLoading(false);
        }
    }, [selectedCategory, selectedMood, selectedGenre]);

    const analyzeVideoForMusic = useCallback(async () => {
        if (!videoUrl) return;

        setIsAnalyzing(true);
        try {
            const response = await apiGet('/music/analyze-video', {
                params: { video_url: videoUrl }
            });

            const ard: any = response.data;
            if (response.success && ard?.recommendations) {
                setAnalyzedTracks(ard.recommendations);
            }
        } catch (err: any) {
            console.warn('[TrendingMusicLibrary] Erreur analyse vidéo:', err);
        } finally {
            setIsAnalyzing(false);
        }
    }, [videoUrl]);

    const handleTrackSelect = useCallback((track: MusicTrack) => {
        const newSelection = new Set(selectedTracks);

        if (newSelection.has(track.id)) {
            newSelection.delete(track.id);
        } else if (newSelection.size < maxSelection) {
            newSelection.add(track.id);
            onTrackSelected?.(track);
        }

        setSelectedTracks(newSelection);
    }, [selectedTracks, maxSelection, onTrackSelected]);

    const handlePlaylistSelect = useCallback((playlist: CuratedPlaylist) => {
        onPlaylistSelected?.(playlist);
    }, [onPlaylistSelected]);

    const searchTracks = useCallback(async () => {
        if (!searchQuery.trim()) {
            loadTrendingData();
            return;
        }

        setLoading(true);
        try {
            const response = await apiGet('/music/search', {
                params: {
                    q: searchQuery,
                    genre: selectedGenre,
                    mood: selectedMood,
                    limit: 30
                }
            });

            const srd: any = response.data;
            if (response.success && srd?.tracks) {
                setTrendingTracks(srd.tracks);
            }
        } catch (err: any) {
            console.error('[TrendingMusicLibrary] Erreur recherche:', err);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, selectedGenre, selectedMood]);

    // Combiner toutes les pistes (trending + analysées)
    const allTracks = analyzedTracks.length > 0 ? analyzedTracks : trendingTracks;

    const renderTrackItem = useCallback(({ item: track }: { item: MusicTrack }) => {
        const isSelected = selectedTracks.has(track.id);
        const categoryInfo = MUSIC_CATEGORIES.find(cat => cat.key === selectedCategory);

        return (
            <TouchableOpacity
                style={[
                    styles.trackCard,
                    isSelected && styles.trackCardSelected,
                    { borderLeftColor: categoryInfo?.color || modernColors.primary }
                ]}
                onPress={() => handleTrackSelect(track)}
            >
                <View style={styles.trackHeader}>
                    <View style={styles.trackInfo}>
                        <Text style={styles.trackTitle} numberOfLines={1}>
                            {track.title}
                        </Text>
                        <Text style={styles.trackArtist}>{track.artist}</Text>
                        {track.album && (
                            <Text style={styles.trackAlbum} numberOfLines={1}>
                                {track.album}
                            </Text>
                        )}
                    </View>
                    <View style={styles.trackMeta}>
                        {isSelected && (
                            <View style={styles.selectedBadge}>
                                <SafeIcon name="check" size={14} color="white" />
                            </View>
                        )}
                        {track.is_explicit && (
                            <View style={styles.explicitBadge}>
                                <Text style={styles.explicitText}>E</Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={styles.trackDetails}>
                    <View style={styles.trackStats}>
                        <Text style={styles.trackStat}>
                            🎵 {track.genre}
                        </Text>
                        <Text style={styles.trackStat}>
                            😊 {track.mood}
                        </Text>
                        {track.tempo_bpm && (
                            <Text style={styles.trackStat}>
                                ⏱️ {track.tempo_bpm} BPM
                            </Text>
                        )}
                    </View>

                    <View style={styles.trackMetrics}>
                        <View style={styles.popularityBar}>
                            <View style={[
                                styles.popularityFill,
                                { width: `${track.popularity_score * 100}%` }
                            ]} />
                        </View>
                        <Text style={styles.popularityText}>
                            🔥 {Math.round(track.trending_score * 100)}%
                        </Text>
                    </View>
                </View>

                {/* Waveform visualization */}
                {showWaveform && track.waveform_data && (
                    <View style={styles.waveformContainer}>
                        {track.waveform_data.slice(0, 50).map((amplitude, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.waveformBar,
                                    {
                                        height: amplitude * 30,
                                        backgroundColor: isSelected
                                            ? modernColors.primary
                                            : modernColors.textSecondary
                                    }
                                ]}
                            />
                        ))}
                    </View>
                )}

                <View style={styles.trackFooter}>
                    <Text style={styles.duration}>
                        ⏱️ {Math.floor(track.duration_seconds / 60)}:{(track.duration_seconds % 60).toString().padStart(2, '0')}
                    </Text>
                    <View style={styles.trackActions}>
                        <TouchableOpacity style={styles.previewButton}>
                            <SafeIcon name="play" size={16} color={modernColors.primary} />
                        </TouchableOpacity>
                        <Text style={styles.licenseType}>
                            {track.license_type === 'royalty_free' ? '🆓' : '💎'}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    }, [selectedTracks, selectedCategory, handleTrackSelect, showWaveform]);

    const renderPlaylistItem = useCallback(({ item: playlist }: { item: CuratedPlaylist }) => {
        return (
            <TouchableOpacity
                style={styles.playlistCard}
                onPress={() => handlePlaylistSelect(playlist)}
            >
                <Image source={{ uri: playlist.cover_image_url }} style={styles.playlistCover} />
                <View style={styles.playlistInfo}>
                    <Text style={styles.playlistName} numberOfLines={1}>
                        {playlist.name}
                    </Text>
                    <Text style={styles.playlistDescription} numberOfLines={2}>
                        {playlist.description}
                    </Text>
                    <View style={styles.playlistStats}>
                        <Text style={styles.playlistStat}>
                            🎵 {playlist.track_count} titres
                        </Text>
                        <Text style={styles.playlistStat}>
                            ⏱️ {playlist.total_duration_minutes} min
                        </Text>
                    </View>
                    <View style={styles.playlistMoods}>
                        {playlist.mood_tags.slice(0, 3).map((mood, index) => (
                            <View key={index} style={styles.moodTag}>
                                <Text style={styles.moodTagText}>{mood}</Text>
                            </View>
                        ))}
                    </View>
                </View>
                {playlist.is_premium && (
                    <SafeIcon name="crown" size={16} color={modernColors.accent} />
                )}
            </TouchableOpacity>
        );
    }, [handlePlaylistSelect]);

    const renderCategoryButton = useCallback((category: typeof MUSIC_CATEGORIES[0]) => (
        <TouchableOpacity
            key={category.key}
            style={[
                styles.categoryButton,
                selectedCategory === category.key && styles.categoryButtonSelected,
                { borderColor: category.color }
            ]}
            onPress={() => setSelectedCategory(category.key)}
        >
            <SafeIcon name={category.icon} size={16} color={category.color} />
            <Text
                style={[
                    styles.categoryButtonText,
                    selectedCategory === category.key && { color: category.color }
                ]}
            >
                {category.label}
            </Text>
        </TouchableOpacity>
    ), [selectedCategory]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('trendingMusicLibrary.chargementDeLaMusiqueTrending')}</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.errorContainer}>
                <SafeIcon name="alert-circle" size={24} color={modernColors.error} />
                <Text style={styles.errorText}>{error}</Text>
                <NativeButton title={t('trendingMusicLibrary.reessayer')} onPress={loadTrendingData} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Musique Trending</Text>
                <Text style={styles.subtitle}>
                    {allTracks.length} titres • {selectedTracks.size}/{maxSelection} sélectionnés
                </Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'tracks' && styles.tabActive
                    ]}
                    onPress={() => setActiveTab('tracks')}
                >
                    <Text style={[
                        styles.tabText,
                        activeTab === 'tracks' && styles.tabTextActive
                    ]}>
                        Titres
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        activeTab === 'playlists' && styles.tabActive
                    ]}
                    onPress={() => setActiveTab('playlists')}
                >
                    <Text style={[
                        styles.tabText,
                        activeTab === 'playlists' && styles.tabTextActive
                    ]}>
                        Playlists
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Catégories */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoriesContainer}
                contentContainerStyle={styles.categoriesContent}
            >
                {MUSIC_CATEGORIES.map(renderCategoryButton)}
            </ScrollView>

            {/* Filtres */}
            <View style={styles.filtersContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.moodFiltersContainer}
                    contentContainerStyle={styles.filtersContent}
                >
                    {MOOD_FILTERS.map(mood => (
                        <TouchableOpacity
                            key={mood.key}
                            style={[
                                styles.filterButton,
                                selectedMood === mood.key && styles.filterButtonSelected
                            ]}
                            onPress={() => setSelectedMood(selectedMood === mood.key ? null : mood.key)}
                        >
                            <Text style={styles.filterEmoji}>{mood.emoji}</Text>
                            <Text style={[
                                styles.filterText,
                                selectedMood === mood.key && styles.filterTextSelected
                            ]}>
                                {mood.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <NativeInput
                    placeholder={t('trendingMusicLibrary.rechercherUnTitreArtiste')}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={searchTracks}
                    style={styles.searchInput}
                />
            </View>

            {/* Recommendations from video analysis */}
            {analyzedTracks.length > 0 && (
                <View style={styles.recommendationsContainer}>
                    <View style={styles.recommendationsHeader}>
                        <SafeIcon name="sparkles" size={20} color={modernColors.primary} />
                        <Text style={styles.recommendationsTitle}>
                            Recommandé pour votre vidéo
                        </Text>
                    </View>
                    <FlatList
                        data={analyzedTracks}
                        renderItem={renderTrackItem}
                        keyExtractor={(item) => item.id}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.recommendationsContent}
                    />
                </View>
            )}

            {/* Main content */}
            {activeTab === 'tracks' ? (
                <FlatList
                    data={allTracks}
                    renderItem={renderTrackItem}
                    keyExtractor={(item) => item.id}
                    style={styles.tracksList}
                    contentContainerStyle={styles.tracksListContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <SafeIcon name="music" size={48} color={modernColors.textSecondary} />
                            <Text style={styles.emptyText}>{t('trendingMusicLibrary.aucunTitreTrouve')}</Text>
                            <Text style={styles.emptySubtext}>Essayez d'autres filtres</Text>
                        </View>
                    }
                />
            ) : (
                <FlatList
                    data={curatedPlaylists}
                    renderItem={renderPlaylistItem}
                    keyExtractor={(item) => item.id}
                    style={styles.playlistsList}
                    contentContainerStyle={styles.playlistsListContent}
                    showsVerticalScrollIndicator={false}
                    numColumns={2}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    header: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    tabsContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    tab: {
        flex: 1,
        paddingVertical: 16,
        alignItems: 'center',
    },
    tabActive: {
        borderBottomWidth: 2,
        borderBottomColor: modernColors.primary,
    },
    tabText: {
        fontSize: 16,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    tabTextActive: {
        color: modernColors.primary,
    },
    categoriesContainer: {
        maxHeight: 60,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    categoriesContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    categoryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        backgroundColor: 'white',
        gap: 6,
        minWidth: 80,
    },
    categoryButtonSelected: {
        backgroundColor: modernColors.background,
    },
    categoryButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.textSecondary,
    },
    filtersContainer: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        gap: 12,
    },
    moodFiltersContainer: {
        maxHeight: 50,
    },
    filtersContent: {
        gap: 8,
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: 'white',
        gap: 6,
    },
    filterButtonSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    filterEmoji: {
        fontSize: 16,
    },
    filterText: {
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.textSecondary,
    },
    filterTextSelected: {
        color: 'white',
    },
    searchInput: {
        flex: 1,
    },
    recommendationsContainer: {
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    recommendationsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 16,
        paddingBottom: 8,
    },
    recommendationsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    recommendationsContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 12,
    },
    tracksList: {
        flex: 1,
    },
    tracksListContent: {
        padding: 16,
        gap: 16,
    },
    trackCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    trackCardSelected: {
        backgroundColor: `${modernColors.primary}10`,
        borderColor: modernColors.primary,
    },
    trackHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    trackInfo: {
        flex: 1,
    },
    trackTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    trackArtist: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '500',
        marginBottom: 2,
    },
    trackAlbum: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    trackMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    selectedBadge: {
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        padding: 6,
    },
    explicitBadge: {
        backgroundColor: '#FF4444',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    explicitText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '600',
    },
    trackDetails: {
        marginBottom: 12,
    },
    trackStats: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 8,
    },
    trackStat: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    trackMetrics: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    popularityBar: {
        flex: 1,
        height: 4,
        backgroundColor: modernColors.border,
        borderRadius: 2,
        overflow: 'hidden',
    },
    popularityFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
    },
    popularityText: {
        fontSize: 11,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 30,
        marginBottom: 12,
        gap: 1,
    },
    waveformBar: {
        width: 2,
        backgroundColor: modernColors.textSecondary,
        borderRadius: 1,
    },
    trackFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    duration: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    trackActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    previewButton: {
        padding: 8,
        borderRadius: 16,
        backgroundColor: modernColors.background,
    },
    licenseType: {
        fontSize: 14,
    },
    playlistsList: {
        flex: 1,
    },
    playlistsListContent: {
        padding: 16,
        gap: 16,
    },
    playlistCard: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        maxWidth: '48%',
    },
    playlistCover: {
        width: '100%',
        height: 120,
        backgroundColor: modernColors.background,
    },
    playlistInfo: {
        padding: 12,
    },
    playlistName: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    playlistDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 8,
        lineHeight: 16,
    },
    playlistStats: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 8,
    },
    playlistStat: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
    playlistMoods: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    moodTag: {
        backgroundColor: modernColors.background,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    moodTagText: {
        fontSize: 10,
        color: modernColors.textSecondary,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    loadingText: {
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        padding: 32,
    },
    errorText: {
        fontSize: 16,
        color: modernColors.error,
        textAlign: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        gap: 16,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    emptySubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
});

export default TrendingMusicLibrary;
