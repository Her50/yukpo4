// ✅ NOUVEAU Phase 2.2: Bibliothèque audio étendue avec intégration Spotify/YouTube

import { Audio } from 'expo-av';
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
import {
    AudioMetadata,
    AudioSearchParams,
    extendedAudioLibraryService,
} from '../services/extendedAudioLibraryService';
import { modernColors } from '../theme/modernTheme';
import { NativeInput } from './SafeNativeDesign';
import { SafeIcon } from './SafeIcon';

interface ExtendedAudioLibraryProps {
    onTrackSelected?: (track: AudioMetadata) => void;
    selectedTrackId?: string | null;
}

export const ExtendedAudioLibrary: React.FC<ExtendedAudioLibraryProps> = ({
    onTrackSelected,
    selectedTrackId,
}) => {
    const [tracks, setTracks] = useState<AudioMetadata[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
    const [selectedMood, setSelectedMood] = useState<string | null>(null);
    const [selectedSource, setSelectedSource] = useState<'all' | 'spotify' | 'youtube'>('all');
    const [genres, setGenres] = useState<string[]>([]);
    const [moods, setMoods] = useState<string[]>([]);
    const [previewingTrack, setPreviewingTrack] = useState<AudioMetadata | null>(null);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // Charger genres et moods
    useEffect(() => {
        loadGenresAndMoods();
    }, []);

    // Rechercher au changement de filtres
    useEffect(() => {
        if (searchQuery.trim() || selectedGenre || selectedMood) {
            searchTracks();
        }
    }, [searchQuery, selectedGenre, selectedMood, selectedSource]);

    const loadGenresAndMoods = async () => {
        try {
            const [genresList, moodsList] = await Promise.all([
                extendedAudioLibraryService.listGenres(),
                extendedAudioLibraryService.listMoods(),
            ]);
            setGenres(genresList);
            setMoods(moodsList);
        } catch (err: any) {
            console.error('[ExtendedAudioLibrary] Erreur chargement genres/moods:', err);
        }
    };

    const searchTracks = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const params: AudioSearchParams = {
                q: searchQuery.trim() || undefined,
                genre: selectedGenre || undefined,
                mood: selectedMood || undefined,
                source: selectedSource,
                limit: 50,
                offset: 0,
            };

            const response = await extendedAudioLibraryService.searchAudio(params);
            setTracks(response.tracks || []);
        } catch (err: any) {
            console.error('[ExtendedAudioLibrary] Erreur recherche audio:', err);
            setError(err.message || 'Erreur lors de la recherche audio');
        } finally {
            setLoading(false);
        }
    }, [searchQuery, selectedGenre, selectedMood, selectedSource]);

    const handlePlayPreview = async (track: AudioMetadata) => {
        if (!track.preview_url) {
            return;
        }

        // Arrêter le son actuel
        if (sound) {
            await sound.unloadAsync();
            setSound(null);
        }

        if (previewingTrack?.track_id === track.track_id && isPlaying) {
            setIsPlaying(false);
            return;
        }

        try {
            setPreviewingTrack(track);
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: track.preview_url },
                { shouldPlay: true }
            );
            setSound(newSound);
            setIsPlaying(true);

            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setIsPlaying(false);
                }
            });
        } catch (err: any) {
            console.error('[ExtendedAudioLibrary] Erreur lecture preview:', err);
            setError('Impossible de lire la preview');
        }
    };

    const formatDuration = (ms: number): string => {
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getSourceIcon = (source: string): string => {
        switch (source) {
            case 'spotify':
                return 'music';
            case 'youtube':
                return 'youtube';
            default:
                return 'headphones';
        }
    };

    const renderTrackItem = ({ item }: { item: AudioMetadata }) => (
        <TouchableOpacity
            style={[
                styles.trackCard,
                selectedTrackId === item.track_id && styles.trackCardSelected,
            ]}
            onPress={() => onTrackSelected?.(item)}
            activeOpacity={0.7}
        >
            {/* Thumbnail */}
            {item.thumbnail_url ? (
                <Image
                    source={{ uri: item.thumbnail_url }}
                    style={styles.trackThumbnail}
                    resizeMode="cover"
                />
            ) : (
                <View style={styles.trackThumbnailPlaceholder}>
                    <SafeIcon
                        name={getSourceIcon(item.source)}
                        size={32}
                        color={modernColors.textSecondary}
                    />
                </View>
            )}

            {/* Informations */}
            <View style={styles.trackInfo}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                    {item.title}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                    {item.artist}
                </Text>
                <View style={styles.trackMeta}>
                    {item.genre && (
                        <View style={styles.metaTag}>
                            <Text style={styles.metaText}>{item.genre}</Text>
                        </View>
                    )}
                    {item.mood && (
                        <View style={styles.metaTag}>
                            <Text style={styles.metaText}>{item.mood}</Text>
                        </View>
                    )}
                    {item.bpm && (
                        <Text style={styles.bpmText}>{item.bpm} BPM</Text>
                    )}
                </View>
                <Text style={styles.trackDuration}>
                    {formatDuration(item.duration_ms)}
                </Text>
            </View>

            {/* Actions */}
            <View style={styles.trackActions}>
                {item.preview_url && (
                    <TouchableOpacity
                        style={styles.playButton}
                        onPress={() => handlePlayPreview(item)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <SafeIcon
                            name={previewingTrack?.track_id === item.track_id && isPlaying ? 'pause' : 'play'}
                            size={24}
                            color={modernColors.primary}
                        />
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => onTrackSelected?.(item)}
                >
                    <SafeIcon name="check-circle" size={24} color={modernColors.success} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Recherche et Filtres */}
            <View style={styles.controls}>
                <NativeInput
                    placeholder="Rechercher un titre, artiste..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchInput}
                />

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filtersContainer}
                >
                    {/* Source Filter */}
                    <View style={styles.sourceFilter}>
                        {(['all', 'spotify', 'youtube'] as const).map((source) => (
                            <TouchableOpacity
                                key={source}
                                style={[
                                    styles.filterChip,
                                    selectedSource === source && styles.filterChipActive,
                                ]}
                                onPress={() => setSelectedSource(source)}
                            >
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        selectedSource === source && styles.filterChipTextActive,
                                    ]}
                                >
                                    {source === 'all' ? 'Tous' : source.charAt(0).toUpperCase() + source.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Genre Filter */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <TouchableOpacity
                            style={[
                                styles.filterChip,
                                !selectedGenre && styles.filterChipActive,
                            ]}
                            onPress={() => setSelectedGenre(null)}
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    !selectedGenre && styles.filterChipTextActive,
                                ]}
                            >
                                Tous genres
                            </Text>
                        </TouchableOpacity>
                        {genres.slice(0, 10).map((genre) => (
                            <TouchableOpacity
                                key={genre}
                                style={[
                                    styles.filterChip,
                                    selectedGenre === genre && styles.filterChipActive,
                                ]}
                                onPress={() => setSelectedGenre(genre)}
                            >
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        selectedGenre === genre && styles.filterChipTextActive,
                                    ]}
                                >
                                    {genre}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Mood Filter */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <TouchableOpacity
                            style={[
                                styles.filterChip,
                                !selectedMood && styles.filterChipActive,
                            ]}
                            onPress={() => setSelectedMood(null)}
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    !selectedMood && styles.filterChipTextActive,
                                ]}
                            >
                                Tous moods
                            </Text>
                        </TouchableOpacity>
                        {moods.slice(0, 10).map((mood) => (
                            <TouchableOpacity
                                key={mood}
                                style={[
                                    styles.filterChip,
                                    selectedMood === mood && styles.filterChipActive,
                                ]}
                                onPress={() => setSelectedMood(mood)}
                            >
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        selectedMood === mood && styles.filterChipTextActive,
                                    ]}
                                >
                                    {mood}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </ScrollView>
            </View>

            {/* Liste des tracks */}
            {loading ? (
                <ActivityIndicator size="large" color={modernColors.primary} style={styles.loadingIndicator} />
            ) : error ? (
                <Text style={styles.errorText}>{error}</Text>
            ) : tracks.length === 0 ? (
                <View style={styles.emptyState}>
                    <SafeIcon name="music-off" size={48} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>
                        Aucun résultat. Essayez une autre recherche.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={tracks}
                    renderItem={renderTrackItem}
                    keyExtractor={(item) => item.track_id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    controls: {
        padding: 16,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    searchInput: {
        marginBottom: 12,
    },
    filtersContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    sourceFilter: {
        flexDirection: 'row',
        gap: 8,
        marginRight: 8,
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    filterChipText: {
        fontSize: 12,
        color: modernColors.text,
        fontWeight: '500',
    },
    filterChipTextActive: {
        color: modernColors.surface,
        fontWeight: '600',
    },
    loadingIndicator: {
        marginTop: 50,
    },
    errorText: {
        color: modernColors.error,
        textAlign: 'center',
        marginTop: 20,
        paddingHorizontal: 16,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 12,
        textAlign: 'center',
    },
    listContent: {
        padding: 16,
    },
    trackCard: {
        flexDirection: 'row',
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    trackCardSelected: {
        borderColor: modernColors.primary,
        borderWidth: 2,
        backgroundColor: modernColors.primary + '10',
    },
    trackThumbnail: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: modernColors.border,
    },
    trackThumbnailPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: modernColors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    trackInfo: {
        flex: 1,
        marginLeft: 12,
        justifyContent: 'center',
    },
    trackTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    trackArtist: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginBottom: 6,
    },
    trackMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    metaTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: modernColors.background,
    },
    metaText: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
    bpmText: {
        fontSize: 11,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    trackDuration: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    trackActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginLeft: 8,
    },
    playButton: {
        padding: 8,
    },
    selectButton: {
        padding: 8,
    },
});

