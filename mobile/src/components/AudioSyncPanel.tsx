// ✅ NOUVEAU: Panel de synchronisation audio-vidéo

import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { audioSyncService, Beat, SyncPoint } from '../services/audioSyncService';
import { modernColors } from '../theme/modernTheme';
import { NativeCard } from './NativeDesign';
import SafeIcon from './SafeIcon';

interface AudioSyncPanelProps {
    videoUrl: string;
    audioUrl?: string;
    musicTrackId?: number;
    videoTransitions?: number[];
    onSyncComplete: (syncedAudioUrl: string, beats: Beat[]) => void;
}

export const AudioSyncPanel: React.FC<AudioSyncPanelProps> = ({
    videoUrl,
    audioUrl,
    musicTrackId,
    videoTransitions,
    onSyncComplete,
}) => {
    const [loading, setLoading] = useState(false);
    const [beatDetection, setBeatDetection] = useState(true);
    const [autoDucking, setAutoDucking] = useState(true);
    const [syncWithTransitions, setSyncWithTransitions] = useState(true);
    const [beats, setBeats] = useState<Beat[]>([]);
    const [bpm, setBpm] = useState<number | null>(null);
    const [syncPoints, setSyncPoints] = useState<SyncPoint[]>([]);

    const handleSync = async () => {
        setLoading(true);
        try {
            const result = await audioSyncService.syncAudio({
                video_url: videoUrl,
                audio_url: audioUrl,
                music_track_id: musicTrackId,
                beat_detection: beatDetection,
                auto_ducking: autoDucking,
                sync_with_transitions: syncWithTransitions,
                video_transitions: videoTransitions,
            });

            setBeats(result.beats);
            setBpm(result.bpm);
            setSyncPoints(result.sync_points);
            onSyncComplete(result.synced_audio_url, result.beats);
        } catch (error: any) {
            console.error('[AudioSyncPanel] Error:', error);
            Alert.alert('Erreur', 'Impossible de synchroniser l\'audio');
        } finally {
            setLoading(false);
        }
    };

    return (
        <NativeCard style={styles.container}>
            <Text style={styles.title}>Synchronisation Audio-Vidéo</Text>

            <View style={styles.optionRow}>
                <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>Détection de beats</Text>
                    <Text style={styles.optionDescription}>
                        Synchronise les transitions avec le rythme musical
                    </Text>
                </View>
                <Switch
                    value={beatDetection}
                    onValueChange={setBeatDetection}
                    trackColor={{ true: modernColors.primary }}
                />
            </View>

            <View style={styles.optionRow}>
                <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>Audio ducking automatique</Text>
                    <Text style={styles.optionDescription}>
                        Réduit la musique pendant les dialogues
                    </Text>
                </View>
                <Switch
                    value={autoDucking}
                    onValueChange={setAutoDucking}
                    trackColor={{ true: modernColors.primary }}
                />
            </View>

            <View style={styles.optionRow}>
                <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>Sync avec transitions</Text>
                    <Text style={styles.optionDescription}>
                        Aligne les beats avec les changements de scène
                    </Text>
                </View>
                <Switch
                    value={syncWithTransitions}
                    onValueChange={setSyncWithTransitions}
                    trackColor={{ true: modernColors.primary }}
                />
            </View>

            <TouchableOpacity
                style={styles.syncButton}
                onPress={handleSync}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#FFF" />
                ) : (
                    <>
                        <SafeIcon name="music" size={18} color="#FFF" />
                        <Text style={styles.syncButtonText}>Synchroniser</Text>
                    </>
                )}
            </TouchableOpacity>

            {bpm && (
                <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>BPM détecté:</Text>
                    <Text style={styles.infoValue}>{bpm.toFixed(0)}</Text>
                </View>
            )}

            {beats.length > 0 && (
                <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>
                        {beats.length} beats détectés
                    </Text>
                </View>
            )}

            {syncPoints.length > 0 && (
                <View style={styles.infoBox}>
                    <Text style={styles.infoLabel}>
                        {syncPoints.length} point{syncPoints.length > 1 ? 's' : ''} de synchronisation
                    </Text>
                </View>
            )}
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 16,
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    optionText: {
        flex: 1,
        marginRight: 12,
    },
    optionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    optionDescription: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    syncButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        marginTop: 8,
    },
    syncButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFF',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        padding: 10,
        borderRadius: 8,
        backgroundColor: modernColors.surface,
    },
    infoLabel: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
});

