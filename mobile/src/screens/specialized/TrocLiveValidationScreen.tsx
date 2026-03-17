// ✅ Écran de validation Live/Video d'un livre scolaire lors d'un troc (Mobile)

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import LivreScolaireValidationVideoRecorder from '../../components/troc/LivreScolaireValidationVideoRecorder';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface RouteParams {
    trocId: number;
    livreId: number;
    livreTitre?: string;
}

const TrocLiveValidationScreen: React.FC = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { user } = useAuth();
    const params = (route.params as any) as RouteParams;

    const [step, setStep] = useState<'info' | 'recording' | 'review' | 'uploading'>('info');
    const [videoUri, setVideoUri] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [trocData, setTrocData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTrocData();
    }, []);

    const loadTrocData = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/troc-livres/${params.trocId}`);
            const resData = (response?.data || response) as any;

            if (resData?.success && resData?.data) {
                setTrocData(resData.data);
            }
        } catch (error: any) {
            console.error('[TrocLiveValidationScreen] Erreur:', error);
            Alert.alert('Erreur', t('trocLiveValidationScreen.impossibleDeChargerLesDonneesDu'));
        } finally {
            setLoading(false);
        }
    };

    const handleRecordingComplete = (uri: string) => {
        setVideoUri(uri);
        setStep('review');
    };

    const handleStartRecording = () => {
        setStep('recording');
    };

    const handleCancelRecording = () => {
        setStep('info');
        setVideoUri(null);
    };

    const handleUploadVideo = async () => {
        if (!videoUri || !trocData) {
            return;
        }

        try {
            setUploading(true);
            setStep('uploading');

            // ✅ TODO: Uploader la vidéo vers le serveur (Cloud Storage GCP / Cloud CDN GCP)
            // ⚠️ AWS/Cloudflare (ancien): Uploader la vidéo vers le serveur (S3/Cloudflare)
            // Pour l'instant, on simule l'upload
            // const formData = new FormData();
            // formData.append('video', {
            //     uri: videoUri,
            //     type: 'video/mp4',
            //     name: 'validation-video.mp4',
            // });

            // const uploadResponse = await apiPost(
            //     `/api/troc-livres/${params.trocId}/upload-validation-video`,
            //     formData,
            //     {
            //         headers: { 'Content-Type': 'multipart/form-data' },
            //     }
            // );

            // Simuler un délai d'upload
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Mettre à jour le statut de validation vidéo
            const response = await apiPost(`/api/troc-livres/${params.trocId}/validate-video`, {
                video_url: videoUri, // En production, utiliser l'URL du serveur
            });
            const valData = (response?.data || response) as any;

            if (valData?.success) {
                Alert.alert(
                    t('trocLiveValidationScreen.succes'),
                    t('trocLiveValidationScreen.videoDeValidationEnregistreeAvecSucces'),
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                navigation.goBack();
                            },
                        },
                    ]
                );
            } else {
                throw new Error(valData?.error || 'Erreur lors de l\'upload');
            }
        } catch (error: any) {
            console.error('[TrocLiveValidationScreen] Erreur upload:', error);
            Alert.alert('Erreur', error.message || 'Impossible d\t('trocLiveValidationScreen.uploaderLaVideo'));
            setStep('review');
        } finally {
            setUploading(false);
        }
    };

    const handleRetake = () => {
        setVideoUri(null);
        setStep('recording');
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('trocLiveValidation.chargement')}</Text>
            </View>
        );
    }

    if (step === 'recording') {
        return (
            <LivreScolaireValidationVideoRecorder
                livreId={params.livreId}
                livreTitre={trocData?.livre_offert?.titre || params.livreTitre || 'Livre'}
                onRecordingComplete={handleRecordingComplete}
                onCancel={handleCancelRecording}
                maxDuration={60}
            />
        );
    }

    if (step === 'uploading') {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Upload en cours...</Text>
                <Text style={styles.loadingSubtext}>
                    Veuillez patienter, la vidéo est en cours d'envoi
                </Text>
            </View>
        );
    }

    if (step === 'review' && videoUri) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
                <NativeCard style={styles.card}>
                    <View style={styles.header}>
                        <SafeIcon name="Video" size={32} color={modernColors.primary} type="lucide" />
                        <Text style={styles.title}>{t('trocLiveValidation.videoEnregistree')}</Text>
                    </View>

                    <Text style={styles.description}>
                        Votre vidéo de validation a été enregistrée. Vous pouvez la revoir avant de
                        l'envoyer.
                    </Text>

                    {/* TODO: Ajouter un lecteur vidéo pour prévisualiser */}
                    <View style={styles.videoPlaceholder}>
                        <SafeIcon name="PlayCircle" size={64} color={modernColors.primary} type="lucide" />
                        <Text style={styles.videoPlaceholderText}>{t('trocLiveValidation.videoEnregistree')}</Text>
                    </View>

                    <View style={styles.actions}>
                        <NativeButton
                            variant="secondary"
                            onPress={handleRetake}
                            style={styles.retakeButton}
                        >
                            <SafeIcon name="RefreshCw" size={20} color={modernColors.primary} type="lucide" />
                            <Text style={styles.retakeButtonText}>Reprendre</Text>
                        </NativeButton>

                        <NativeButton
                            variant="primary"
                            onPress={handleUploadVideo}
                            style={styles.uploadButton}
                            disabled={uploading}
                        >
                            <SafeIcon name="Upload" size={20} color="#FFF" type="lucide" />
                            <Text style={styles.uploadButtonText}>{t('trocLiveValidation.envoyerLaVideo')}</Text>
                        </NativeButton>
                    </View>
                </NativeCard>
            </ScrollView>
        );
    }

    // Écran d'information initial
    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <NativeCard style={styles.card}>
                <View style={styles.header}>
                    <SafeIcon name="Camera" size={32} color={modernColors.primary} type="lucide" />
                    <Text style={styles.title}>{t('trocLiveValidation.validationVideoDuLivre')}</Text>
                </View>

                {trocData && (
                    <View style={styles.trocInfo}>
                        <Text style={styles.trocInfoLabel}>{t('trocLiveValidation.livreAValider')}</Text>
                        <Text style={styles.trocInfoValue}>
                            {trocData.livre_offert?.titre || 'Livre'}
                        </Text>
                    </View>
                )}

                <View style={styles.instructions}>
                    <Text style={styles.instructionsTitle}>📋 Instructions</Text>
                    <Text style={styles.instructionsText}>
                        Pour valider l'état du livre, vous devez enregistrer une vidéo montrant :
                    </Text>
                    <View style={styles.instructionsList}>
                        <Text style={styles.instructionItem}>
                            ✓ La couverture du livre (recto et verso)
                        </Text>
                        <Text style={styles.instructionItem}>
                            ✓ Les pages importantes (première et dernière page)
                        </Text>
                        <Text style={styles.instructionItem}>
                            ✓ Les dommages éventuels (coins abîmés, pages déchirées, etc.)
                        </Text>
                        <Text style={styles.instructionItem}>
                            ✓ Le dos du livre (reliure)
                        </Text>
                        <Text style={styles.instructionItem}>
                            ✓ L'état général du livre
                        </Text>
                    </View>
                </View>

                <View style={styles.requirements}>
                    <Text style={styles.requirementsTitle}>⚠️ Important</Text>
                    <Text style={styles.requirementsText}>
                        • La vidéo doit durer entre 30 et 60 secondes{'\n'}
                        • Assurez-vous dt('trocLiveValidationScreen.avoirUnBonEclairage')\n'}
                        • Montrez clairement tous les détails
                    </Text>
                </View>

                <View style={styles.actions}>
                    <NativeButton
                        variant="secondary"
                        onPress={() => navigation.goBack()}
                        style={styles.cancelButton}
                    >
                        <SafeIcon name="X" size={20} color={modernColors.text} type="lucide" />
                        <Text style={styles.cancelButtonText}>{t('trocLiveValidationScreen.annuler')}</Text>
                    </NativeButton>

                    <NativeButton
                        variant="primary"
                        onPress={handleStartRecording}
                        style={styles.startButton}
                    >
                        <SafeIcon name="Video" size={20} color="#FFF" type="lucide" />
                        <Text style={styles.startButtonText}>{t('trocLiveValidationScreen.commencerLenregistrement')}</Text>
                    </NativeButton>
                </View>
            </NativeCard>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    contentContainer: {
        padding: 16,
    },
    card: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.text,
        textAlign: 'center',
    },
    loadingSubtext: {
        marginTop: 8,
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    trocInfo: {
        backgroundColor: modernColors.surface,
        padding: 16,
        borderRadius: 8,
        marginBottom: 20,
    },
    trocInfoLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    trocInfoValue: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    instructions: {
        marginBottom: 20,
    },
    instructionsTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 12,
    },
    instructionsText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 12,
        lineHeight: 20,
    },
    instructionsList: {
        gap: 8,
    },
    instructionItem: {
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 22,
    },
    requirements: {
        backgroundColor: '#FFF3CD',
        padding: 16,
        borderRadius: 8,
        marginBottom: 24,
        borderLeftWidth: 4,
        borderLeftColor: '#FFC107',
    },
    requirementsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#856404',
        marginBottom: 8,
    },
    requirementsText: {
        fontSize: 13,
        color: '#856404',
        lineHeight: 20,
    },
    videoPlaceholder: {
        height: 200,
        backgroundColor: modernColors.surface,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    videoPlaceholderText: {
        marginTop: 12,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    cancelButton: {
        flex: 1,
    },
    cancelButtonText: {
        marginLeft: 8,
        color: modernColors.text,
        fontWeight: '600',
    },
    startButton: {
        flex: 1,
    },
    startButtonText: {
        marginLeft: 8,
        color: '#FFF',
        fontWeight: '600',
    },
    retakeButton: {
        flex: 1,
    },
    retakeButtonText: {
        marginLeft: 8,
        color: modernColors.primary,
        fontWeight: '600',
    },
    uploadButton: {
        flex: 1,
    },
    uploadButtonText: {
        marginLeft: 8,
        color: '#FFF',
        fontWeight: '600',
    },
    description: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 20,
        lineHeight: 20,
    },
});

export default TrocLiveValidationScreen;

