/**
 * Modal de création Duet/Remix (style TikTok)
 * Permet de créer un duet (côte à côte) ou remix (audio réutilisé)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import VideoRecorder from './VideoRecorder';

interface FeedItem {
    contentId: string;
    videoUrl: string;
    titre: string;
    serviceId?: number;
}

interface DuetRemixModalProps {
    visible: boolean;
    originalVideo: FeedItem | null;
    onClose: () => void;
    onSuccess?: (duetId: string) => void;
}

type DuetType = 'audio' | 'side_by_side';

const DuetRemixModal: React.FC<DuetRemixModalProps> = ({
    visible,
    originalVideo,
    onClose,
    onSuccess,
}) => {
    const { user } = useAuth();
    const [selectedType, setSelectedType] = useState<DuetType | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [step, setStep] = useState<'select' | 'recording' | 'uploading'>('select');
    const [recordedVideoUri, setRecordedVideoUri] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            setSelectedType(null);
            setStep('select');
            setIsCreating(false);
        }
    }, [visible]);

    const handleTypeSelect = useCallback((type: DuetType) => {
        setSelectedType(type);
        setStep('recording');
    }, []);

    const handleRecordingComplete = useCallback(async (videoUri: string) => {
        setRecordedVideoUri(videoUri);
        setStep('uploading');
        setIsCreating(true);

        try {
            if (!originalVideo || !selectedType || !user?.token) {
                throw new Error('Données manquantes');
            }

            // Upload la vidéo vers le backend
            const formData = new FormData();
            formData.append('video', {
                uri: videoUri,
                type: 'video/mp4',
                name: `duet_${Date.now()}.mp4`,
            } as any);
            formData.append('original_video_id', originalVideo.contentId);
            formData.append('duet_type', selectedType);
            formData.append('service_id', originalVideo.serviceId?.toString() || '');
            formData.append('titre', `${selectedType === 'audio' ? 'Remix' : 'Duet'} - ${originalVideo.titre}`);
            formData.append('description', `Créé avec ${selectedType === 'audio' ? 'remix' : 'duet'}`);

            const response = await apiPost('/api/duets/upload', formData, {
                'Content-Type': 'multipart/form-data',
            });

            if (response.success) {
                Alert.alert(
                    'Succès',
                    'Votre duet/remix a été créé avec succès !',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                onSuccess?.((response.data as any)?.duet_id || '');
                                onClose();
                            },
                        },
                    ]
                );
            } else {
                throw new Error(response.error || 'Erreur lors de la création');
            }
        } catch (error: any) {
            console.error('[DuetRemixModal] Erreur création:', error);
            Alert.alert(
                'Erreur',
                error.message || 'Impossible de créer le duet/remix'
            );
            setStep('recording');
        } finally {
            setIsCreating(false);
        }
    }, [originalVideo, selectedType, user?.token, onClose, onSuccess]);

    if (!originalVideo) {
        return null;
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Créer un Duet/Remix</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                        {step === 'select' && (
                            <>
                                <Text style={styles.subtitle}>
                                    Choisissez le type de duet/remix que vous souhaitez créer
                                </Text>

                                {/* Option Audio (Remix) */}
                                <TouchableOpacity
                                    style={styles.optionCard}
                                    onPress={() => handleTypeSelect('audio')}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.optionIcon}>
                                        <SafeIcon name="music" size={32} color={modernColors.primary} />
                                    </View>
                                    <View style={styles.optionContent}>
                                        <Text style={styles.optionTitle}>Remix (Audio)</Text>
                                        <Text style={styles.optionDescription}>
                                            Réutilisez l'audio de cette vidéo pour créer votre propre contenu
                                        </Text>
                                    </View>
                                    <SafeIcon name="chevron-right" size={20} color={modernColors.textSecondary} />
                                </TouchableOpacity>

                                {/* Option Side-by-Side (Duet) */}
                                <TouchableOpacity
                                    style={styles.optionCard}
                                    onPress={() => handleTypeSelect('side_by_side')}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.optionIcon}>
                                        <SafeIcon name="users" size={32} color={modernColors.primary} />
                                    </View>
                                    <View style={styles.optionContent}>
                                        <Text style={styles.optionTitle}>Duet (Côte à côte)</Text>
                                        <Text style={styles.optionDescription}>
                                            Créez une vidéo côte à côte avec la vidéo originale
                                        </Text>
                                    </View>
                                    <SafeIcon name="chevron-right" size={20} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                            </>
                        )}

                        {step === 'recording' && selectedType && (
                            <VideoRecorder
                                onRecordingComplete={handleRecordingComplete}
                                onCancel={() => {
                                    setStep('select');
                                    setSelectedType(null);
                                }}
                                duetType={selectedType}
                                maxDuration={60}
                            />
                        )}

                        {step === 'uploading' && (
                            <View style={styles.uploadingContainer}>
                                <ActivityIndicator size="large" color={modernColors.primary} />
                                <Text style={styles.uploadingText}>Création du duet/remix...</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.surfaceVariant,
    },
    content: {
        padding: 20,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 24,
        textAlign: 'center',
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    optionIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: modernColors.surfaceVariant,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    optionContent: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    optionDescription: {
        fontSize: 13,
        color: modernColors.textSecondary,
        lineHeight: 18,
    },
    recordingContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    recordingTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 8,
    },
    recordingSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 32,
    },
    recordButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.primary,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 999,
        gap: 8,
    },
    recordButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    uploadingContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    uploadingText: {
        marginTop: 16,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
});

export default DuetRemixModal;

