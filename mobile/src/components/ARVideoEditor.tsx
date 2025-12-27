/**
 * 🎬 ARVideoEditor - Éditeur vidéo immersif AR simplifié et robuste
 * Version reconstruite pour éviter les crashes
 * 
 * Utilise expo-image-picker pour une capture vidéo simple et fiable
 */

import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { modernColors } from '../theme/modernTheme';
import { NativeButton } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';

interface ARVideoEditorProps {
    onVideoCaptured?: (videoUri: string) => void;
    onClose?: () => void;
    productName?: string;
    serviceId?: number;
    productIndex?: number;
}

export const ARVideoEditor: React.FC<ARVideoEditorProps> = ({
    onVideoCaptured,
    onClose,
    productName = 'Produit',
}) => {
    const [isCapturing, setIsCapturing] = useState(false);

    // Capturer une vidéo
    const handleCaptureVideo = useCallback(async () => {
        try {
            setIsCapturing(true);

            // Demander les permissions
            const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
            if (!cameraPermission.granted) {
                Alert.alert(
                    'Permission requise',
                    'Veuillez autoriser l\'accès à la caméra pour enregistrer une vidéo.',
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Ouvrir les paramètres',
                            onPress: () => {
                                if (Platform.OS === 'ios') {
                                    Linking.openURL('app-settings:');
                                } else {
                                    Linking.openSettings();
                                }
                            },
                        },
                    ]
                );
                setIsCapturing(false);
                return;
            }

            // Note: La permission microphone est gérée automatiquement par le système lors de la capture vidéo

            // Lancer la caméra vidéo
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: 'videos' as any,
                allowsEditing: true,
                quality: 0.8,
                videoMaxDuration: 60, // 60 secondes max
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const videoUri = result.assets[0].uri;
                console.log('[ARVideoEditor] ✅ Vidéo capturée:', videoUri);
                
                if (onVideoCaptured) {
                    onVideoCaptured(videoUri);
                } else {
                    // Si pas de callback, fermer le modal
                    if (onClose) {
                        onClose();
                    }
                }
            } else {
                // L'utilisateur a annulé
                console.log('[ARVideoEditor] Capture annulée par l\'utilisateur');
            }
        } catch (error: any) {
            console.error('[ARVideoEditor] ❌ Erreur capture vidéo:', error);
            Alert.alert(
                'Erreur',
                `Impossible de capturer la vidéo: ${error?.message || 'Erreur inconnue'}`
            );
        } finally {
            setIsCapturing(false);
        }
    }, [onVideoCaptured, onClose]);

    // Ouvrir les paramètres
    const openSettings = useCallback(() => {
        if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
        } else {
            Linking.openSettings();
        }
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.productInfo}>
                        <Text style={styles.productName}>{productName}</Text>
                        <Text style={styles.productHint}>
                            Capturez une vidéo de votre produit
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={onClose}
                        disabled={isCapturing}
                    >
                        <SafeIcon name="x" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                </View>

                {/* Instructions */}
                <View style={styles.instructionsContainer}>
                    <SafeIcon name="video" size={64} color={modernColors.primary} />
                    <Text style={styles.instructionsTitle}>Vidéo AR Immersive</Text>
                    <Text style={styles.instructionsText}>
                        Cliquez sur le bouton ci-dessous pour ouvrir la caméra et enregistrer une vidéo de votre produit.
                        {'\n\n'}
                        La vidéo sera automatiquement ajoutée à votre médiathèque.
                    </Text>
                </View>

                {/* Bouton de capture */}
                <View style={styles.buttonContainer}>
                    <NativeButton
                        title={isCapturing ? 'Capture en cours...' : '📹 Capturer une vidéo'}
                        variant="primary"
                        size="large"
                        onPress={handleCaptureVideo}
                        disabled={isCapturing}
                        style={styles.captureButton}
                    />
                    {isCapturing && (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="small" color={modernColors.primary} />
                            <Text style={styles.loadingText}>Ouvrir la caméra...</Text>
                        </View>
                    )}
                </View>

                {/* Informations supplémentaires */}
                <View style={styles.infoContainer}>
                    <View style={styles.infoRow}>
                        <SafeIcon name="info" size={16} color={modernColors.textSecondary} />
                        <Text style={styles.infoText}>
                            Durée maximale : 60 secondes
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <SafeIcon name="info" size={16} color={modernColors.textSecondary} />
                        <Text style={styles.infoText}>
                            Qualité : 720p
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 32,
        paddingTop: 20,
    },
    productInfo: {
        flex: 1,
        marginRight: 12,
    },
    productName: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    productHint: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: modernColors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    instructionsContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    instructionsTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: modernColors.text,
        marginTop: 24,
        marginBottom: 16,
        textAlign: 'center',
    },
    instructionsText: {
        fontSize: 16,
        color: modernColors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: 20,
    },
    buttonContainer: {
        marginBottom: 24,
    },
    captureButton: {
        width: '100%',
    },
    loadingContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        gap: 8,
    },
    loadingText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    infoContainer: {
        gap: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
});

export default ARVideoEditor;
