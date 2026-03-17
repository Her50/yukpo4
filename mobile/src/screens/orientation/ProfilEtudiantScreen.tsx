// ✅ Écran Profil Étudiant REFONDU - Champ descriptif simple avec audio
// Pas de données personnelles, juste description du profil académique

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';
import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiPost } from '../../services/api';
import { orientationScolaireService } from '../../services/orientationScolaireService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

const ProfilEtudiantScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [profileDescription, setProfileDescription] = useState('');
    const [recommendation, setRecommendation] = useState<string | null>(null);

    // États pour l'enregistrement audio
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const recordingTimer = useRef<NodeJS.Timeout | null>(null);

    useFocusEffect(
        useCallback(() => {
            loadProfile();
        }, [])
    );

    const loadProfile = async () => {
        try {
            setLoading(true);
            const response = await orientationScolaireService.getMyProfile();
            if (response.success && response.data?.profile) {
                const profile = response.data.profile;
                // Charger la description si elle existe
                if (profile.description_profil) {
                    setProfileDescription(profile.description_profil);
                }
                if (profile.recommendation_ia) {
                    setRecommendation(profile.recommendation_ia);
                }
            }
        } catch (error: any) {
            console.error('[ProfilEtudiant] Erreur chargement profil:', error);
        } finally {
            setLoading(false);
        }
    };

    // Démarrer l'enregistrement audio
    const startRecording = async () => {
        try {
            hapticPress();
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert(t('profilEtudiant.permissionRequired'), t('profilEtudiant.allowMicrophone'));
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(newRecording);
            setIsRecording(true);
            setRecordingDuration(0);

            // Timer pour la durée
            recordingTimer.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (error: any) {
            console.error('[ProfilEtudiant] Erreur démarrage enregistrement:', error);
            Alert.alert(t('message.error'), t('profilEtudiant.cannotStartRecording'));
        }
    };

    // Arrêter l'enregistrement et transcrire
    const stopRecording = async () => {
        try {
            hapticPress();
            if (!recording) return;

            setIsRecording(false);
            if (recordingTimer.current) {
                clearInterval(recordingTimer.current);
                recordingTimer.current = null;
            }

            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            setRecording(null);
            setRecordingDuration(0);

            if (!uri) {
                Alert.alert(t('message.error'), t('profilEtudiant.noRecordingAvailable'));
                return;
            }

            // Convertir l'audio en base64 et transcrire
            setIsTranscribing(true);
            try {
                // Lire le fichier audio et le convertir en base64
                const response = await fetch(uri);
                const blob = await response.blob();
                const reader = new FileReader();

                reader.onloadend = async () => {
                    const base64Audio = (reader.result as string).split(',')[1];

                    try {
                        // Appeler l'API de transcription
                        const transcribeResponse = await apiPost('/api/ia/transcribe', {
                            audio_base64: base64Audio,
                            language: 'fr',
                            format: 'base64',
                        });

                        const trd: any = transcribeResponse.data;
                        if (transcribeResponse.success && trd?.transcription) {
                            const transcription = trd.transcription;
                            setProfileDescription(prev => prev ? `${prev}\n${transcription}` : transcription);
                            Alert.alert(t('message.success'), t('profilEtudiant.audioTranscribed'));
                        } else {
                            Alert.alert(t('message.error'), t('profilEtudiant.cannotTranscribe'));
                        }
                    } catch (err: any) {
                        console.error('[ProfilEtudiant] Erreur transcription:', err);
                        Alert.alert(t('message.error'), t('profilEtudiant.transcriptionError'));
                    } finally {
                        setIsTranscribing(false);
                    }
                };

                reader.onerror = () => {
                    setIsTranscribing(false);
                    Alert.alert(t('message.error'), t('profilEtudiant.cannotReadAudio'));
                };

                reader.readAsDataURL(blob);
            } catch (err: any) {
                console.error('[ProfilEtudiant] Erreur conversion audio:', err);
                setIsTranscribing(false);
                Alert.alert(t('message.error'), t('profilEtudiant.cannotConvertAudio'));
            }
        } catch (error: any) {
            console.error('[ProfilEtudiant] Erreur arrêt enregistrement:', error);
            Alert.alert(t('message.error'), t('profilEtudiant.cannotStopRecording'));
        }
    };

    const handleSave = async () => {
        if (!profileDescription.trim()) {
            Alert.alert(t('message.error'), t('profilEtudiant.describeProfile'));
            return;
        }

        try {
            setSaving(true);

            // Sauvegarder le profil avec la description
            const response = await (orientationScolaireService as any).createOrUpdateProfile({
                description_profil: profileDescription.trim(),
            });

            if (response.success) {
                // Demander une recommandation IA
                Alert.alert(t('profilEtudiant.profileSaved'), t('profilEtudiant.generatingRecommendation'));
                await generateRecommendation();
            } else {
                Alert.alert(t('message.error'), t('profilEtudiant.cannotSaveProfile'));
            }
        } catch (error: any) {
            console.error('[ProfilEtudiant] Erreur sauvegarde:', error);
            Alert.alert(t('message.error'), t('profilEtudiant.cannotSaveProfile'));
        } finally {
            setSaving(false);
        }
    };

    const generateRecommendation = async () => {
        try {
            setLoading(true);

            // Appeler l'API pour générer une recommandation d'orientation
            const response = await apiPost('/api/orientation/ai/generate-recommendation', {
                profile_description: profileDescription.trim(),
            });

            const rd: any = response.data;
            if (response.success && rd?.recommendation) {
                setRecommendation(rd.recommendation);

                // Sauvegarder la recommandation dans le profil
                await (orientationScolaireService as any).createOrUpdateProfile({
                    description_profil: profileDescription.trim(),
                    recommendation_ia: rd.recommendation,
                });
            } else {
                Alert.alert(t('message.error'), t('profilEtudiant.cannotGenerateRecommendation'));
            }
        } catch (error: any) {
            console.error('[ProfilEtudiant] Erreur génération recommandation:', error);
            Alert.alert(t('message.error'), t('profilEtudiant.recommendationError'));
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (loading && !profileDescription) {
        return (
            <SafeNativeView style={styles.container}>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('profilEtudiant.chargement')}</Text>
                </View>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>{t('profilEtudiant.monProfilEtudiant')}</Text>
                    <Text style={styles.subtitle}>
                        Décrivez votre profil académique pour obtenir des recommandations d'orientation intelligentes
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Description de votre profil</Text>
                    <Text style={styles.sectionDescription}>
                        Précisez votre niveau scolaire, votre filière/série, les matières où vous êtes performant et celles où vous avez des difficultés.
                    </Text>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.textInput}
                            placeholder={t('profilEtudiant.exJeSuisEnClasset('profilEtudiantScreen.aiDesDifficultesEnFrancaisEtt('profilEtudiantScreen.aimeraisFaireDesEtudesD')ingénierie..."
                            placeholderTextColor="#9CA3AF"
                            value={profileDescription}
                            onChangeText={setProfileDescription}
                            multiline
                            numberOfLines={8}
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Bouton audio */}
                    <View style={styles.audioContainer}>
                        {!isRecording ? (
                            <TouchableOpacity
                                style={styles.audioButton}
                                onPress={startRecording}
                                activeOpacity={0.7}
                            >
                                <SafeIcon name="mic" size={20} color="#FFFFFF" type="lucide" />
                                <Text style={styles.audioButtonText}>{t('profilEtudiantScreen.enregistrerEnAudio')}</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.recordingContainer}>
                                <View style={styles.recordingIndicator}>
                                    <View style={styles.recordingDot} />
                                    <Text style={styles.recordingText}>
                                        Enregistrement... {formatDuration(recordingDuration)}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.stopButton}
                                    onPress={stopRecording}
                                    activeOpacity={0.7}
                                >
                                    <SafeIcon name="square" size={18} color="#FFFFFF" type="lucide" />
                                    <Text style={styles.stopButtonText}>{t('profilEtudiant.arreter')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {isTranscribing && (
                            <View style={styles.transcribingContainer}>
                                <ActivityIndicator size="small" color="#8B5CF6" />
                                <Text style={styles.transcribingText}>Transcription en cours...</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Recommandation IA */}
                {recommendation && (
                    <View style={styles.recommendationCard}>
                        <View style={styles.recommendationHeader}>
                            <SafeIcon name="sparkles" size={24} color="#8B5CF6" type="lucide" />
                            <Text style={styles.recommendationTitle}>Recommandation IA</Text>
                        </View>
                        <Text style={styles.recommendationText}>{recommendation}</Text>
                    </View>
                )}

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.saveButton, (!profileDescription.trim() || saving) && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={!profileDescription.trim() || saving}
                        activeOpacity={0.8}
                    >
                        {saving ? (
                            <>
                                <ActivityIndicator size="small" color="#FFFFFF" />
                                <Text style={styles.saveButtonText}>Enregistrement...</Text>
                            </>
                        ) : (
                            <>
                                <SafeIcon name="save" size={18} color="#FFFFFF" type="lucide" />
                                <Text style={styles.saveButtonText}>{t('profilEtudiantScreen.enregistrerEtObtenirRecommandation')}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    sectionDescription: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
        marginBottom: 16,
    },
    inputContainer: {
        marginBottom: 16,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#111827',
        backgroundColor: '#F9FAFB',
        minHeight: 200,
        textAlignVertical: 'top',
    },
    audioContainer: {
        marginTop: 8,
    },
    audioButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8B5CF6',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 8,
    },
    audioButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    recordingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    recordingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#EF4444',
    },
    recordingText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#991B1B',
    },
    stopButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EF4444',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        gap: 6,
    },
    stopButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    transcribingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 12,
        padding: 12,
        backgroundColor: '#EEF2FF',
        borderRadius: 8,
    },
    transcribingText: {
        fontSize: 13,
        color: '#4F46E5',
        fontWeight: '500',
    },
    recommendationCard: {
        backgroundColor: '#EEF2FF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    recommendationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    recommendationTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#4F46E5',
    },
    recommendationText: {
        fontSize: 15,
        color: '#1E1B4B',
        lineHeight: 24,
    },
    actions: {
        marginTop: 8,
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#8B5CF6',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 20,
        gap: 8,
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default ProfilEtudiantScreen;
