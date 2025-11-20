import { ResizeMode, Video } from 'expo-av';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_BASE_URL } from '../config/api.config';
import { modernColors } from '../theme/modernTheme';
import { NativeButton, NativeCard } from './NativeDesign';
import SafeIcon from './SafeIcon';

interface VideoExampleModalProps {
    visible: boolean;
    onClose: () => void;
    onStartCreation: () => void;
}

const VideoExampleModal: React.FC<VideoExampleModalProps> = ({
    visible,
    onClose,
    onStartCreation,
}) => {
    const [videoError, setVideoError] = useState(false);
    const [loading, setLoading] = useState(true);

    // ✅ PHASE 2: Vidéo exemple depuis le backend
    // La vidéo doit être placée dans: backend/uploads/examples/video-creation-demo.mp4
    // Pour créer cette vidéo, voir: GUIDE_CREATION_VIDEO_EXEMPLE.md
    const exampleVideoUrl = `${API_BASE_URL}/api/media/examples/video-creation-demo.mp4`;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <NativeCard style={styles.modal}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Exemple de vidéo créée</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.subtitle}>
                        Découvrez un exemple de vidéo promotionnelle générée avec Yukpo
                    </Text>

                    <View style={styles.videoContainer}>
                        {!videoError ? (
                            <Video
                                source={{ uri: exampleVideoUrl }}
                                style={styles.video}
                                resizeMode={ResizeMode.CONTAIN}
                                shouldPlay={false}
                                useNativeControls={true}
                                onError={(error) => {
                                    console.warn('[VideoExampleModal] Erreur chargement vidéo:', error);
                                    setVideoError(true);
                                    setLoading(false);
                                }}
                                onLoad={() => {
                                    setLoading(false);
                                }}
                            />
                        ) : (
                            <View style={styles.videoFallback}>
                                <SafeIcon name="film" size={64} color={modernColors.primary} />
                                <Text style={styles.fallbackText}>
                                    Exemple de vidéo promotionnelle
                                </Text>
                                <Text style={styles.fallbackDescription}>
                                    • 🎬 Vidéos promotionnelles pour vos produits{'\n'}
                                    • 📚 Tutoriels et démonstrations{'\n'}
                                    • 💬 Témoignages clients{'\n'}
                                    • ⚖️ Comparatifs produits{'\n'}
                                    • 🎨 Animations et effets visuels
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.features}>
                        <View style={styles.featureItem}>
                            <SafeIcon name="sparkles" size={20} color={modernColors.primary} />
                            <Text style={styles.featureText}>Génération IA automatique</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <SafeIcon name="film" size={20} color={modernColors.primary} />
                            <Text style={styles.featureText}>Timeline immersive</Text>
                        </View>
                        <View style={styles.featureItem}>
                            <SafeIcon name="volume" size={20} color={modernColors.primary} />
                            <Text style={styles.featureText}>Audio premium</Text>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <NativeButton
                            title="Fermer"
                            variant="outline"
                            size="medium"
                            onPress={onClose}
                            style={styles.cancelButton}
                        />
                        <NativeButton
                            title="Créer ma vidéo"
                            variant="primary"
                            size="medium"
                            onPress={() => {
                                onClose();
                                onStartCreation();
                            }}
                            style={styles.createButton}
                        />
                    </View>
                </NativeCard>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modal: {
        width: '100%',
        maxWidth: 500,
        maxHeight: '90%',
        backgroundColor: modernColors.background,
        borderRadius: 16,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 20,
        textAlign: 'center',
    },
    videoContainer: {
        width: '100%',
        height: 250,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: modernColors.background,
        marginBottom: 20,
    },
    video: {
        width: '100%',
        height: '100%',
    },
    videoFallback: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: modernColors.primary + '10',
        padding: 20,
    },
    fallbackText: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
        marginTop: 12,
        marginBottom: 8,
        textAlign: 'center',
    },
    fallbackDescription: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    features: {
        marginBottom: 20,
        gap: 12,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    featureText: {
        fontSize: 14,
        color: modernColors.text,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
    },
    createButton: {
        flex: 1,
    },
});

export default VideoExampleModal;

