// ✅ NOUVEAU Phase 5: Modal de génération de visite virtuelle immersive avec IA
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { immobilierService } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';
import { NativeButton } from '../SafeNativeDesign';
import SafeIcon from '../SafeIcon';

interface GenerateVirtualTourModalProps {
    visible: boolean;
    onClose: () => void;
    propertyId: number;
    propertyTitle: string;
    onSuccess?: (virtualTourId: number) => void;
}

const GenerateVirtualTourModal: React.FC<GenerateVirtualTourModalProps> = ({
    visible,
    onClose,
    propertyId,
    propertyTitle,
    onSuccess,
}) => {
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<'idle' | 'generating' | 'completed' | 'error'>('idle');
    const [jobId, setJobId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (visible && generating && jobId) {
            // Polling pour vérifier le statut de génération
            const interval = setInterval(async () => {
                try {
                    const response = await immobilierService.getVirtualTourGenerationStatus(jobId);
                    if (response.success) {
                        if (response.status === 'completed') {
                            setStatus('completed');
                            setProgress(100);
                            setGenerating(false);
                            if (pollingInterval) {
                                clearInterval(pollingInterval);
                            }
                            if (response.virtual_tour_id && onSuccess) {
                                onSuccess(response.virtual_tour_id);
                            }
                            Alert.alert(
                                'Succès',
                                'Votre visite virtuelle immersive a été générée avec succès !'
                            );
                        } else if (response.status === 'failed') {
                            setStatus('error');
                            setError(response.error || 'Erreur lors de la génération');
                            setGenerating(false);
                            if (pollingInterval) {
                                clearInterval(pollingInterval);
                            }
                        } else if (response.status === 'processing') {
                            setProgress(response.progress || 0);
                        }
                    }
                } catch (err: any) {
                    console.error('[GenerateVirtualTourModal] Erreur polling:', err);
                }
            }, 2000); // Vérifier toutes les 2 secondes

            setPollingInterval(interval);
        }

        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        };
    }, [visible, generating, jobId]);

    const handleGenerate = async () => {
        try {
            setGenerating(true);
            setStatus('generating');
            setProgress(0);
            setError(null);

            const response = await immobilierService.generateVirtualTour(propertyId);
            if (response.success && response.job_id) {
                setJobId(response.job_id);
                setProgress(10);
            } else {
                throw new Error(response.message || 'Erreur lors du démarrage de la génération');
            }
        } catch (err: any) {
            console.error('[GenerateVirtualTourModal] Erreur génération:', err);
            setStatus('error');
            setError(err.message || 'Impossible de générer la visite virtuelle');
            setGenerating(false);
            Alert.alert('Erreur', err.message || 'Impossible de générer la visite virtuelle');
        }
    };

    const handleClose = () => {
        if (generating) {
            Alert.alert(
                'Génération en cours',
                'La génération est en cours. Voulez-vous vraiment fermer ?',
                [
                    { text: 'Annuler', style: 'cancel' },
                    {
                        text: 'Fermer',
                        style: 'destructive',
                        onPress: () => {
                            if (pollingInterval) {
                                clearInterval(pollingInterval);
                            }
                            setGenerating(false);
                            setStatus('idle');
                            setProgress(0);
                            setJobId(null);
                            onClose();
                        },
                    },
                ]
            );
        } else {
            setStatus('idle');
            setProgress(0);
            setJobId(null);
            setError(null);
            onClose();
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Générer une visite virtuelle immersive</Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        <Text style={styles.propertyTitle}>{propertyTitle}</Text>

                        {status === 'idle' && (
                            <View style={styles.infoSection}>
                                <SafeIcon name="sparkles" size={48} color={modernColors.primary} />
                                <Text style={styles.infoTitle}>
                                    Visite virtuelle avec IA
                                </Text>
                                <Text style={styles.infoText}>
                                    Notre IA va créer automatiquement une visite virtuelle immersive
                                    à partir des photos de votre bien. La génération prend généralement
                                    2-5 minutes.
                                </Text>
                                <View style={styles.featuresList}>
                                    <View style={styles.featureItem}>
                                        <SafeIcon name="check" size={16} color="#10B981" />
                                        <Text style={styles.featureText}>
                                            Vidéo immersive 360°
                                        </Text>
                                    </View>
                                    <View style={styles.featureItem}>
                                        <SafeIcon name="check" size={16} color="#10B981" />
                                        <Text style={styles.featureText}>
                                            Transitions professionnelles
                                        </Text>
                                    </View>
                                    <View style={styles.featureItem}>
                                        <SafeIcon name="check" size={16} color="#10B981" />
                                        <Text style={styles.featureText}>
                                            Musique et effets sonores
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {status === 'generating' && (
                            <View style={styles.progressSection}>
                                <ActivityIndicator size="large" color={modernColors.primary} />
                                <Text style={styles.progressText}>
                                    Génération en cours... {progress}%
                                </Text>
                                <View style={styles.progressBar}>
                                    <View
                                        style={[
                                            styles.progressBarFill,
                                            { width: `${progress}%` },
                                        ]}
                                    />
                                </View>
                                <Text style={styles.progressSubtext}>
                                    L'IA analyse vos photos et crée la visite virtuelle...
                                </Text>
                            </View>
                        )}

                        {status === 'completed' && (
                            <View style={styles.successSection}>
                                <SafeIcon name="check-circle" size={64} color="#10B981" />
                                <Text style={styles.successText}>
                                    Visite virtuelle générée avec succès !
                                </Text>
                                <Text style={styles.successSubtext}>
                                    Votre visite virtuelle est maintenant disponible dans la galerie.
                                </Text>
                            </View>
                        )}

                        {status === 'error' && (
                            <View style={styles.errorSection}>
                                <SafeIcon name="alert-circle" size={64} color="#EF4444" />
                                <Text style={styles.errorText}>
                                    Erreur lors de la génération
                                </Text>
                                {error && (
                                    <Text style={styles.errorSubtext}>{error}</Text>
                                )}
                            </View>
                        )}
                    </View>

                    <View style={styles.footer}>
                        {status === 'idle' && (
                            <NativeButton
                                title="Générer la visite virtuelle"
                                onPress={handleGenerate}
                                variant="primary"
                                size="large"
                            />
                        )}
                        {status === 'completed' && (
                            <NativeButton
                                title="Fermer"
                                onPress={handleClose}
                                variant="primary"
                                size="large"
                            />
                        )}
                        {status === 'error' && (
                            <>
                                <NativeButton
                                    title="Réessayer"
                                    onPress={handleGenerate}
                                    variant="primary"
                                    size="large"
                                    style={styles.retryButton}
                                />
                                <NativeButton
                                    title="Fermer"
                                    onPress={handleClose}
                                    variant="secondary"
                                    size="large"
                                />
                            </>
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
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '90%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
    },
    closeButton: {
        padding: 4,
    },
    content: {
        marginBottom: 24,
    },
    propertyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 24,
    },
    infoSection: {
        alignItems: 'center',
    },
    infoTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginTop: 16,
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    featuresList: {
        width: '100%',
        gap: 12,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    featureText: {
        fontSize: 14,
        color: '#374151',
    },
    progressSection: {
        alignItems: 'center',
    },
    progressText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginTop: 16,
        marginBottom: 12,
    },
    progressBar: {
        width: '100%',
        height: 8,
        backgroundColor: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: 12,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: modernColors.primary,
        borderRadius: 4,
    },
    progressSubtext: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
    },
    successSection: {
        alignItems: 'center',
    },
    successText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#10B981',
        marginTop: 16,
        marginBottom: 8,
    },
    successSubtext: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    errorSection: {
        alignItems: 'center',
    },
    errorText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#EF4444',
        marginTop: 16,
        marginBottom: 8,
    },
    errorSubtext: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    footer: {
        gap: 12,
    },
    retryButton: {
        marginBottom: 0,
    },
});

export default GenerateVirtualTourModal;

