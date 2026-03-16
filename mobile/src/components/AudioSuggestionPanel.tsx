// ✅ NOUVEAU: Panel de suggestions audio contextuelles

import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { AudioSuggestion, audioSuggestionService } from '../services/audioSuggestionService';
import { modernColors } from '../theme/modernTheme';
import { NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface AudioSuggestionPanelProps {
    productName: string;
    productType?: string;
    tone?: string;
    channel?: string;
    durationSeconds?: number;
    onTrackSelected: (track: AudioSuggestion) => void;
}

export const AudioSuggestionPanel: React.FC<AudioSuggestionPanelProps> = ({
    productName,
    productType,
    tone,
    channel,
    durationSeconds,
    onTrackSelected,
}) => {
        const { t } = useLanguageSafe();
const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<AudioSuggestion[]>([]);
    const [contextAnalysis, setContextAnalysis] = useState<any>(null);
    const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

    useEffect(() => {
        // Auto-générer les suggestions au chargement
        handleGenerateSuggestions();
    }, [productName, tone, channel]);

    const handleGenerateSuggestions = async () => {
        setLoading(true);
        try {
            const response = await audioSuggestionService.getSuggestions({
                product_name: productName,
                product_type: productType,
                tone,
                channel,
                duration_seconds: durationSeconds,
                count: 15,
            });

            setSuggestions(response.suggestions);
            setContextAnalysis(response.context_analysis);
        } catch (error: any) {
            console.error('[AudioSuggestionPanel] Error:', error);
            Alert.alert('Erreur', 'Impossible de générer les suggestions audio');
        } finally {
            setLoading(false);
        }
    };

    return (
        <NativeCard style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Suggestions Audio IA</Text>
                    <Text style={styles.subtitle}>
                        Musiques adaptées à votre produit
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={handleGenerateSuggestions}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color={modernColors.primary} size="small" />
                    ) : (
                        <SafeIcon name="refresh" size={18} color={modernColors.primary} />
                    )}
                </TouchableOpacity>
            </View>

            {contextAnalysis && (
                <View style={styles.contextBox}>
                    <Text style={styles.contextTitle}>Analyse IA</Text>
                    <Text style={styles.contextText}>
                        Genre: {contextAnalysis.recommended_genre} •
                        Mood: {contextAnalysis.recommended_mood} •
                        BPM: {contextAnalysis.recommended_bpm_range[0]}-{contextAnalysis.recommended_bpm_range[1]}
                    </Text>
                    <Text style={styles.contextReasoning}>
                        {contextAnalysis.reasoning}
                    </Text>
                </View>
            )}

            {loading && suggestions.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('audioSuggestionPanel.generationDesSuggestions')}</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.suggestionsList}
                    nestedScrollEnabled
                >
                    {suggestions.map((track) => {
                        const isSelected = selectedTrackId === track.track_id;

                        return (
                            <TouchableOpacity
                                key={track.track_id}
                                style={[
                                    styles.trackCard,
                                    isSelected && styles.trackCardSelected,
                                ]}
                                onPress={() => {
                                    setSelectedTrackId(track.track_id);
                                    onTrackSelected(track);
                                }}
                            >
                                <View style={styles.trackHeader}>
                                    <View style={styles.trackInfo}>
                                        <Text style={styles.trackTitle}>{track.title}</Text>
                                        <Text style={styles.trackMeta}>
                                            {track.genre} • {track.mood} • {track.bpm.toFixed(0)} BPM
                                        </Text>
                                    </View>
                                    {isSelected && (
                                        <View style={styles.selectedBadge}>
                                            <SafeIcon name="check" size={16} color="#FFF" />
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.trackDescription} numberOfLines={2}>
                                    {track.description}
                                </Text>
                                <View style={styles.trackFooter}>
                                    <View style={styles.relevanceBadge}>
                                        <SafeIcon name="star" size={12} color="#F59E0B" />
                                        <Text style={styles.relevanceText}>
                                            {(track.relevance_score * 100).toFixed(0)}% pertinent
                                        </Text>
                                    </View>
                                    <Text style={styles.licenseText}>{track.license}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            )}
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    refreshButton: {
        padding: 8,
    },
    contextBox: {
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.surface,
        marginBottom: 12,
    },
    contextTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    contextText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    contextReasoning: {
        fontSize: 11,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    loadingContainer: {
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    suggestionsList: {
        maxHeight: 400,
    },
    trackCard: {
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        marginBottom: 8,
    },
    trackCardSelected: {
        borderColor: modernColors.primary,
        borderWidth: 2,
        backgroundColor: modernColors.primary + '10',
    },
    trackHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    trackInfo: {
        flex: 1,
    },
    trackTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    trackMeta: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    selectedBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    trackDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    trackFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    relevanceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: '#FEF3C7',
    },
    relevanceText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#F59E0B',
    },
    licenseText: {
        fontSize: 10,
        color: modernColors.textSecondary,
    },
});

