// ✅ NOUVEAU: Panel de génération automatique de sous-titres

import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { captionsService, Subtitle } from '../services/captionsService';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { NativeCard } from './SafeNativeDesign';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface AutoCaptionsPanelProps {
    videoUrl: string;
    lang?: string;
    onCaptionsGenerated: (subtitles: Subtitle[], subtitleFileUrl: string) => void;
}

const CAPTION_STYLES = [
    { key: 'modern', label: 'Moderne', description: 'Style classique avec fond' },
    { key: 'minimal', label: 'Minimal', description: t('autoCaptionsPanel.sansFondEpure') },
    { key: 'bold', label: 'Bold', description: t('autoCaptionsPanel.grasCentreImpactant') },
    { key: 'elegant', label: t('autoCaptionsPanel.elegant'), description: t('autoCaptionsPanel.raffineDiscret') },
];

const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const AutoCaptionsPanel: React.FC<AutoCaptionsPanelProps> = ({
    videoUrl,
    lang = 'fr',
    onCaptionsGenerated,
}) => {
        const { t } = useLanguageSafe();
const [loading, setLoading] = useState(false);
    const [selectedStyle, setSelectedStyle] = useState('modern');
    const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
    const [confidence, setConfidence] = useState<number | null>(null);

    const handleGenerate = async () => {
        // ✅ CORRIGÉ: Validation avant d'appeler l'API
        if (!videoUrl || videoUrl.trim() === '') {
            Alert.alert(
                t('autoCaptionsPanel.videoManquante'),
                t('autoCaptionsPanel.aucuneVideoDisponiblePourGenererLesSoustitresnnveuillez'),
                [{ text: 'OK' }]
            );
            return;
        }

        // ✅ CORRIGÉ: Vérifier que l'URL de la vidéo est valide
        if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://') && !videoUrl.startsWith('file://')) {
            Alert.alert(
                'URL invalide',
                'L\t('autoCaptionsPanel.urlDeLaVideoNestPasValidennveuillez'),
                [{ text: 'OK' }]
            );
            return;
        }

        setLoading(true);
        try {
            const result = await captionsService.generateCaptions({
                video_url: videoUrl,
                lang,
                style: selectedStyle as any,
                position: 'auto',
            });

            if (!result || !result.subtitles) {
                throw new Error('Réponse invalide du serveur');
            }

            setSubtitles(result.subtitles);
            setConfidence(result.confidence || null);
            onCaptionsGenerated(result.subtitles, result.subtitle_file_url || '');
        } catch (error: any) {
            console.error('[AutoCaptionsPanel] Error:', error);

            // ✅ CORRIGÉ: Messages d'erreur plus clairs selon le type d'erreur
            let errorMessage = t('autoCaptionsPanel.impossibleDeGenererLesSoustitres');

            if (error?.message) {
                if (error.message.includes('500') || error.message.includes('Erreur 500')) {
                    errorMessage = 'Erreur serveur : Les sous-titres n\t('autoCaptionsPanel.ontPasPuEtreGeneresnnverifiezQueLa');
                } else if (error.message.includes('audio') || error.message.includes('fichier audio')) {
                    errorMessage = t('autoCaptionsPanel.aucunFichierAudioTrouveDansLaVideonnverifiez');
                } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
                    errorMessage = t('autoCaptionsPanel.leTraitementPrendTropDeTempsnnveuillez');
                } else {
                    errorMessage = error.message;
                }
            }

            Alert.alert('Erreur de génération', errorMessage, [{ text: 'OK' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <NativeCard style={styles.container}>
            <Text style={styles.title}>Sous-titres Automatiques</Text>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.stylesList}
                contentContainerStyle={styles.stylesContent}
            >
                {CAPTION_STYLES.map((style) => (
                    <TouchableOpacity
                        key={style.key}
                        style={[
                            styles.styleCard,
                            selectedStyle === style.key && styles.styleCardSelected,
                        ]}
                        onPress={() => setSelectedStyle(style.key)}
                    >
                        <Text style={styles.styleLabel}>{style.label}</Text>
                        <Text style={styles.styleDescription}>{style.description}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <TouchableOpacity
                style={styles.generateButton}
                onPress={handleGenerate}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#FFF" />
                ) : (
                    <>
                        <SafeIcon name="closed-captioning" size={18} color="#FFF" />
                        <Text style={styles.generateButtonText}>{t('autoCaptionsPanel.genererLesSoustitres')}</Text>
                    </>
                )}
            </TouchableOpacity>

            {confidence !== null && (
                <View style={styles.confidenceInfo}>
                    <Text style={styles.confidenceLabel}>
                        Confiance: {(confidence * 100).toFixed(0)}%
                    </Text>
                </View>
            )}

            {subtitles.length > 0 && (
                <View style={styles.preview}>
                    <Text style={styles.previewTitle}>
                        Aperçu ({subtitles.length} sous-titres)
                    </Text>
                    <ScrollView style={styles.subtitlesList} nestedScrollEnabled>
                        {subtitles.slice(0, 5).map((subtitle, index) => (
                            <View key={index} style={styles.subtitleItem}>
                                <Text style={styles.subtitleTime}>
                                    {formatTime(subtitle.start_time)} - {formatTime(subtitle.end_time)}
                                </Text>
                                <Text style={styles.subtitleText}>{subtitle.text}</Text>
                            </View>
                        ))}
                    </ScrollView>
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
        marginBottom: 12,
    },
    stylesList: {
        marginBottom: 12,
    },
    stylesContent: {
        gap: 8,
    },
    styleCard: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    styleCardSelected: {
        borderColor: modernColors.primary,
        borderWidth: 2,
        backgroundColor: modernColors.primary + '10',
    },
    styleLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 2,
    },
    styleDescription: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
    generateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        marginTop: 8,
    },
    generateButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFF',
    },
    confidenceInfo: {
        marginTop: 12,
        padding: 10,
        borderRadius: 8,
        backgroundColor: modernColors.surface,
    },
    confidenceLabel: {
        fontSize: 13,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    preview: {
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.surface,
    },
    previewTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    subtitlesList: {
        maxHeight: 200,
    },
    subtitleItem: {
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    subtitleTime: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    subtitleText: {
        fontSize: 14,
        color: modernColors.text,
    },
});

