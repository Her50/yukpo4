import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';

import { NativeButton, NativeCard, NativeInput } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';

import { mediaApi } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import type { CreateVoiceProfilePayload, MusicMode, VoiceProfileSummary } from '../types/audio';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface StudioAudioPanelProps {
    serviceId?: number;
    voiceoverEnabled: boolean;
    onVoiceoverToggle: (next: boolean) => void;
    voiceoverLang: 'fr' | 'en';
    onVoiceoverLangChange: (lang: 'fr' | 'en') => void;
    selectedVoiceProfileId?: number;
    onVoiceProfileSelect: (id?: number) => void;
    voiceProfiles: VoiceProfileSummary[];
    isLoadingProfiles: boolean;
    onCreateProfile: (
        payload: Omit<CreateVoiceProfilePayload, 'service_id'> & { sample_media_id?: number | null },
    ) => Promise<void>;
    onDeleteProfile: (profileId: number) => Promise<void>;
    musicMode: MusicMode;
    onMusicModeChange: (mode: MusicMode) => void;
}

const langOptions: Array<{ value: 'fr' | 'en'; label: string }> = [
    { value: 'fr', label: 'FR' },
    { value: 'en', label: 'EN' },
];

const musicModePresets: Array<{ value: MusicMode; label: string; subtitle: string }> = [
    { value: 'pulse', label: 'Pulse', subtitle: 'Hook dynamique, format TikTok/Shorts' },
    { value: 'lofi', label: 'Lo-Fi', subtitle: 'Ambiance chill, storytelling intimiste' },
    { value: 'ambient', label: 'Ambient', subtitle: t('studioAudioPanel.texturesAeriennesFocusProduitservice') },
    { value: 'cinematic', label: 'Cinematic', subtitle: t('studioAudioPanel.transitionsHeroiquesEtRevealDramatique') },
    { value: 'none', label: 'Silence', subtitle: 'Voix + SFX uniquement' },
];

const AudioTimelineLayer = ({
    icon,
    title,
    detail,
    active = true,
}: {
    icon: string;
    title: string;
    detail: string;
    active?: boolean;
}) => (
    <View
        style={[
            styles.timelineLayer,
            { borderColor: active ? 'rgba(129, 235, 193, 0.35)' : 'rgba(255,255,255,0.08)' },
            { backgroundColor: active ? 'rgba(35, 255, 189, 0.08)' : 'rgba(255,255,255,0.04)' },
        ]}
    >
        <View style={styles.timelineLayerHeader}>
            <SafeIcon
                name={icon}
                size={16}
                color={active ? modernColors.success : modernColors.textSecondary}
            />
            <Text style={styles.timelineLayerTitle}>{title}</Text>
        </View>
        <Text style={styles.timelineLayerDetail}>{detail}</Text>
        <View style={styles.timelineBar}>
            <View
                style={[
                    styles.timelineProgress,
                    { width: active ? '75%' : '0%', opacity: active ? 1 : 0.2 },
                ]}
            />
        </View>
    </View>
);

const CreateProfileModal = ({
    visible,
    onClose,
    onSubmit,
    onImportSample,
    onClearSample,
    onPlaySample,
    uploadingSample,
    pendingSample,
}: {
    visible: boolean;
    onClose: () => void;
    onSubmit: (payload: Omit<CreateVoiceProfilePayload, 'service_id'>) => Promise<void>;
    onImportSample: () => Promise<void>;
    onClearSample: () => void;
    onPlaySample: () => Promise<void>;
    uploadingSample: boolean;
    pendingSample?: { filename: string } | null;
}) => {
        const { t } = useLanguageSafe();
const [name, setName] = useState('');
    const [provider, setProvider] = useState('custom');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!name.trim()) {
            return;
        }
        setSaving(true);
        try {
            await onSubmit({
                name: name.trim(),
                provider,
                description: description.trim() || undefined,
            });
            setName('');
            setDescription('');
            setProvider('custom');
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
            <View style={styles.modalBackdrop}>
                <View style={styles.modalContainer}>
                    <Text style={styles.modalTitle}>{t('studioAudioPanel.nouveauProfilVocal')}</Text>
                    <NativeInput
                        placeholder={t('studioAudioPanel.nomDuProfil')}
                        value={name}
                        onChangeText={setName}
                        style={styles.modalInput}
                    />
                    <TextInput
                        value={provider}
                        onChangeText={setProvider}
                        style={styles.modalTextInput}
                        placeholder="Provider (custom, dolby, ...)"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                    />
                    <TextInput
                        value={description}
                        onChangeText={setDescription}
                        style={[styles.modalTextInput, styles.modalTextarea]}
                        placeholder={t('studioAudioPanel.descriptionTonaliteInstructionsIa')}
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        multiline
                    />
                    <View style={styles.modalSampleRow}>
                        <NativeButton
                            title={uploadingSample ? 'Import en cours...' : 'Joindre un sample'}
                            variant="secondary"
                            onPress={onImportSample}
                            disabled={uploadingSample}
                            style={styles.modalButton}
                        />
                        {pendingSample && (
                            <View style={styles.sampleInfo}>
                                <Text style={styles.sampleName}>{pendingSample.filename}</Text>
                                <View style={styles.sampleActions}>
                                    <TouchableOpacity style={styles.sampleIconButton} onPress={onPlaySample}>
                                        <SafeIcon name="play" size={18} color="#e0e9ff" />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.sampleIconButton} onPress={onClearSample}>
                                        <SafeIcon name="x" size={18} color="#ff6b6b" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                    <View style={styles.modalActions}>
                        <NativeButton
                            title={t('studioAudioPanel.annuler')}
                            variant="secondary"
                            onPress={onClose}
                            style={styles.modalButton}
                        />
                        <NativeButton
                            title={saving ? t('studioAudioPanel.creation') : t('studioAudioPanel.creer')}
                            variant="primary"
                            onPress={handleSubmit}
                            disabled={saving || !name.trim()}
                            style={styles.modalButton}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export const StudioAudioPanel: React.FC<StudioAudioPanelProps> = ({
    serviceId,
    voiceoverEnabled,
    onVoiceoverToggle,
    voiceoverLang,
    onVoiceoverLangChange,
    voiceProfiles,
    selectedVoiceProfileId,
    onVoiceProfileSelect,
    isLoadingProfiles,
    onCreateProfile,
    onDeleteProfile,
    musicMode,
    onMusicModeChange,
}) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [pendingSample, setPendingSample] = useState<{
        id: number;
        filename: string;
        uri?: string;
    } | null>(null);
    const [uploadingSample, setUploadingSample] = useState(false);
    const soundRef = useRef<Audio.Sound | null>(null);

    const selectedProfile = useMemo(
        () => voiceProfiles.find((profile) => profile.id === selectedVoiceProfileId),
        [selectedVoiceProfileId, voiceProfiles],
    );

    const handleImportSample = async () => {
        if (!serviceId) {
            Alert.alert('Profil vocal', t('studioAudioPanel.selectionnezUnServiceAvantDimporterUn'));
            return;
        }
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['audio/*'],
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.length) {
                return;
            }
            const asset = result.assets[0];
            setUploadingSample(true);
            const uploaded = await mediaApi.uploadServiceAudio(serviceId, {
                uri: asset.uri,
                name: asset.name || `sample_${Date.now()}.mp3`,
                type: asset.mimeType || 'audio/mpeg',
            });
            if (!uploaded) {
                throw new Error(t('studioAudioPanel.reponseInattendueDuServeur'));
            }
            setPendingSample({
                id: uploaded.id,
                filename: asset.name || uploaded.path?.split('/').pop() || `sample_${uploaded.id}`,
                uri: asset.uri,
            });
            Alert.alert('Profil vocal', t('studioAudioPanel.sampleImporteAssociezleAVotreProfil'));
        } catch (error: any) {
            Alert.alert('Profil vocal', error?.message || 'Impossible d’importer ce sample audio.');
        } finally {
            setUploadingSample(false);
        }
    };

    const handlePlaySample = async () => {
        if (!pendingSample?.uri) {
            return;
        }
        try {
            if (soundRef.current) {
                await soundRef.current.stopAsync().catch(() => undefined);
                await soundRef.current.unloadAsync().catch(() => undefined);
                soundRef.current = null;
            }
            const { sound } = await Audio.Sound.createAsync(
                { uri: pendingSample.uri },
                { shouldPlay: true },
            );
            soundRef.current = sound;
            sound.setOnPlaybackStatusUpdate((status) => {
                if ('didJustFinish' in status && status.didJustFinish) {
                    sound.unloadAsync().catch(() => undefined);
                    soundRef.current = null;
                }
            });
        } catch (error: any) {
            Alert.alert('Lecture audio', error?.message || 'Impossible de lire ce sample local.');
        }
    };

    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync().catch(() => undefined);
                soundRef.current = null;
            }
        };
    }, []);

    const handleCreateProfile = async (
        payload: Omit<CreateVoiceProfilePayload, 'service_id'>,
    ) => {
        await onCreateProfile({
            ...payload,
            sample_media_id: pendingSample?.id ?? undefined,
        });
        setPendingSample(null);
    };

    return (
        <NativeCard style={styles.card}>
            <View style={styles.headerRow}>
                <View>
                    <Text style={styles.kicker}>Studio audio</Text>
                    <Text style={styles.cardTitle}>Voix & mix intelligent</Text>
                    <Text style={styles.cardSubtitle}>
                        Calibrage auto : voix premium, musique adaptative, SFX synchronisés timeline.
                    </Text>
                </View>
                <View style={styles.badge}>
                    <SafeIcon name="sparkles" size={16} color={modernColors.primary} />
                    <Text style={styles.badgeText}>{t('studioAudioPanel.assisteIa')}</Text>
                </View>
            </View>

            <View style={styles.toggleRow}>
                <View>
                    <Text style={styles.sectionTitle}>Voix-off intelligente</Text>
                    <Text style={styles.sectionSubtitle}>
                        Clones vocaux, profils premium ou provider Dolby/Auphonic.
                    </Text>
                </View>
                <Switch value={voiceoverEnabled} onValueChange={onVoiceoverToggle} />
            </View>

            {voiceoverEnabled && (
                <>
                    <View style={styles.langRow}>
                        {langOptions.map((option) => (
                            <TouchableOpacity
                                key={option.value}
                                style={[
                                    styles.langPill,
                                    voiceoverLang === option.value && styles.langPillActive,
                                ]}
                                onPress={() => onVoiceoverLangChange(option.value)}
                            >
                                <Text
                                    style={[
                                        styles.langPillText,
                                        voiceoverLang === option.value && styles.langPillTextActive,
                                    ]}
                                >
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.profileActions}>
                        <NativeButton
                            title={t('studioAudioPanel.nouveauProfil')}
                            variant="primary"
                            onPress={() => setModalVisible(true)}
                            style={styles.profileButton}
                        />
                        <NativeButton
                            title="Importer un sample"
                            variant="secondary"
                            disabled
                            style={styles.profileButton}
                        />
                    </View>

                    {isLoadingProfiles ? (
                        <View style={styles.loaderRow}>
                            <ActivityIndicator color={modernColors.primary} />
                            <Text style={styles.loaderText}>{t('studioAudioPanel.chargementDesProfils')}</Text>
                        </View>
                    ) : (
                        <View style={styles.profileList}>
                            {voiceProfiles.length === 0 && (
                                <Text style={styles.emptyText}>
                                    Aucun profil enregistré. Créez-en un pour personnaliser la voix IA.
                                </Text>
                            )}
                            {voiceProfiles.map((profile) => {
                                const selected = profile.id === selectedVoiceProfileId;
                                return (
                                    <TouchableOpacity
                                        key={profile.id}
                                        onPress={() =>
                                            onVoiceProfileSelect(selected ? undefined : profile.id)
                                        }
                                        style={[
                                            styles.profileItem,
                                            selected && styles.profileItemActive,
                                        ]}
                                    >
                                        <View>
                                            <Text style={styles.profileName}>{profile.name}</Text>
                                            <Text style={styles.profileProvider}>{profile.provider}</Text>
                                        </View>
                                        <View style={styles.profileActionsRow}>
                                            {selected && (
                                                <SafeIcon
                                                    name="check-circle"
                                                    size={18}
                                                    color={modernColors.success}
                                                />
                                            )}
                                            <TouchableOpacity
                                                style={styles.deleteButton}
                                                onPress={() => onDeleteProfile(profile.id)}
                                            >
                                                <SafeIcon name="trash" size={18} color="#ff6b6b" />
                                            </TouchableOpacity>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </>
            )}

            <View style={styles.musicSection}>
                <Text style={styles.sectionTitle}>Musique adaptive</Text>
                <Text style={styles.sectionSubtitle}>
                    Yukpo mixe automatiquement la musique selon la timeline immersive.
                </Text>
                <View style={styles.musicGrid}>
                    {musicModePresets.map((preset) => {
                        const active = musicMode === preset.value;
                        return (
                            <TouchableOpacity
                                key={preset.value}
                                onPress={() => onMusicModeChange(preset.value)}
                                style={[
                                    styles.musicCard,
                                    active && styles.musicCardActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.musicCardTitle,
                                        active && styles.musicCardTitleActive,
                                    ]}
                                >
                                    {preset.label}
                                </Text>
                                <Text
                                    style={[
                                        styles.musicCardSubtitle,
                                        active && styles.musicCardSubtitleActive,
                                    ]}
                                >
                                    {preset.subtitle}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <View style={styles.timelineSection}>
                <Text style={styles.sectionTitle}>Timeline audio</Text>
                <Text style={styles.sectionSubtitle}>
                    Visualisez les couches mixées (voix, musique, SFX, mastering premium).
                </Text>
                <AudioTimelineLayer
                    icon="mic"
                    title="Voix-off"
                    detail={
                        voiceoverEnabled
                            ? selectedProfile?.name || 'Profil IA actif'
                            : t('studioAudioPanel.desactivee')
                    }
                    active={voiceoverEnabled}
                />
                <AudioTimelineLayer
                    icon="music-note"
                    title="Musique"
                    detail={
                        musicMode === 'none'
                            ? 'Silence'
                            : musicModePresets.find((preset) => preset.value === musicMode)?.label ||
                            'Adaptive'
                    }
                    active={musicMode !== 'none'}
                />
                <AudioTimelineLayer
                    icon="activity"
                    title="SFX & spatialisation"
                    detail="Transitions dynamiques, spatial audio IA"
                />
            </View>

            <CreateProfileModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onSubmit={handleCreateProfile}
                onImportSample={handleImportSample}
                onClearSample={() => setPendingSample(null)}
                onPlaySample={handlePlaySample}
                uploadingSample={uploadingSample}
                pendingSample={pendingSample}
            />
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    card: {
        marginTop: 16,
        padding: 16,
        backgroundColor: '#080c17',
        borderColor: 'rgba(255,255,255,0.06)',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    kicker: {
        fontSize: 12,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: 'rgba(129, 167, 255, 0.8)',
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    cardSubtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(129, 167, 255, 0.12)',
        borderColor: 'rgba(129, 167, 255, 0.32)',
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
    },
    badgeText: {
        fontSize: 11,
        color: '#e0e9ff',
        fontWeight: '600',
    },
    toggleRow: {
        marginTop: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#f8f9ff',
    },
    sectionSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.65)',
        marginTop: 2,
    },
    langRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
    },
    langPill: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    langPillActive: {
        backgroundColor: 'rgba(142, 115, 255, 0.2)',
        borderColor: 'rgba(142,115,255,0.8)',
    },
    langPillText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
    },
    langPillTextActive: {
        color: '#fff',
        fontWeight: '600',
    },
    profileActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
        flexWrap: 'wrap',
    },
    profileButton: {
        flex: 1,
    },
    loaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 16,
    },
    loaderText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
    },
    profileList: {
        marginTop: 12,
        gap: 12,
    },
    emptyText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
    },
    profileItem: {
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.02)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    profileItemActive: {
        borderColor: 'rgba(129,235,193,0.55)',
        backgroundColor: 'rgba(129,235,193,0.08)',
    },
    profileName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    profileProvider: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 2,
    },
    profileActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    deleteButton: {
        padding: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,107,107,0.12)',
    },
    musicSection: {
        marginTop: 20,
    },
    musicGrid: {
        marginTop: 12,
        gap: 10,
    },
    musicCard: {
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    musicCardActive: {
        borderColor: 'rgba(129,167,255,0.55)',
        backgroundColor: 'rgba(129,167,255,0.1)',
    },
    musicCardTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
    },
    musicCardTitleActive: {
        color: '#fff',
    },
    musicCardSubtitle: {
        marginTop: 4,
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
    },
    musicCardSubtitleActive: {
        color: 'rgba(255,255,255,0.85)',
    },
    timelineSection: {
        marginTop: 20,
    },
    timelineLayer: {
        marginTop: 12,
        borderRadius: 14,
        borderWidth: 1,
        padding: 12,
    },
    timelineLayerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    timelineLayerTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
    timelineLayerDetail: {
        marginTop: 4,
        fontSize: 12,
        color: 'rgba(255,255,255,0.65)',
    },
    timelineBar: {
        marginTop: 10,
        height: 6,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    timelineProgress: {
        height: '100%',
        backgroundColor: 'rgba(35,255,189,0.85)',
        borderRadius: 999,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        borderRadius: 24,
        backgroundColor: '#05070f',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 12,
    },
    modalInput: {
        marginBottom: 12,
    },
    modalTextInput: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
        color: '#fff',
        fontSize: 14,
        marginBottom: 12,
    },
    modalTextarea: {
        minHeight: 90,
        textAlignVertical: 'top',
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 4,
    },
    modalButton: {
        minWidth: 120,
    },
    modalSampleRow: {
        marginTop: 8,
        marginBottom: 8,
        gap: 8,
    },
    sampleInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    sampleName: {
        fontSize: 13,
        color: '#fff',
        flex: 1,
    },
    sampleActions: {
        flexDirection: 'row',
        gap: 8,
        marginLeft: 12,
    },
    sampleIconButton: {
        padding: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
});

