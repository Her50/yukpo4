// @ts-nocheck
/**
 * Enregistreur vidéo de preuve de livraison
 * Basé sur VideoRecorder avec instructions spécifiques pour la livraison
 * Utilise expo-camera pour l'enregistrement professionnel
 */

import { Camera, type CameraType } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

interface DeliveryProofVideoRecorderProps {
    proofType: 'pickup' | 'delivery';
    onRecordingComplete: (uri: string) => void;
    onCancel: () => void;
    maxDuration?: number; // en secondes, défaut 30 pour preuve de livraison
}

const DeliveryProofVideoRecorder: React.FC<DeliveryProofVideoRecorderProps> = ({
    proofType,
    onRecordingComplete,
    onCancel,
    maxDuration = 30, // 30 secondes max pour preuve de livraison
}) => {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [cameraType, setCameraType] = useState<CameraType>('back' as CameraType); // Caméra arrière par défaut pour livraison
    const cameraRef = useRef<Camera>(null);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const recordingPromiseRef = useRef<Promise<any> | null>(null);

    useEffect(() => {
        (async () => {
            const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
            const { status: audioStatus } = await Camera.requestMicrophonePermissionsAsync();
            const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();

            setHasPermission(
                cameraStatus === 'granted' &&
                audioStatus === 'granted' &&
                mediaStatus === 'granted'
            );
        })();
    }, []);

    const startRecording = useCallback(async () => {
        if (!cameraRef.current || isRecording) {
            return;
        }

        try {
            setIsRecording(true);
            setRecordingTime(0);

            // Démarrer le timer
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime((prev) => {
                    const next = prev + 1;
                    if (next >= maxDuration) {
                        stopRecording();
                    }
                    return next;
                });
            }, 1000);

            // Démarrer l'enregistrement
            recordingPromiseRef.current = cameraRef.current.recordAsync({
                maxDuration,
                quality: Platform.OS === 'ios' ? 'high' : 'high',
            });

            const video = await recordingPromiseRef.current;

            // Sauvegarder dans la galerie
            if (video?.uri) {
                await MediaLibrary.createAssetAsync(video.uri);
                onRecordingComplete(video.uri);
            }
        } catch (error: any) {
            console.error('[DeliveryProofVideoRecorder] Erreur enregistrement:', error);
            Alert.alert('Erreur', 'Impossible d\'enregistrer la vidéo');
            setIsRecording(false);
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }
        }
    }, [isRecording, maxDuration, onRecordingComplete]);

    const stopRecording = useCallback(async () => {
        if (!cameraRef.current || !isRecording) {
            return;
        }

        try {
            cameraRef.current.stopRecording();
            setIsRecording(false);
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }
        } catch (error) {
            console.error('[DeliveryProofVideoRecorder] Erreur arrêt:', error);
        }
    }, [isRecording]);

    const toggleCamera = useCallback(() => {
        setCameraType((prev) =>
            prev === ('back' as CameraType) ? ('front' as CameraType) : ('back' as CameraType)
        );
    }, []);

    const formatTime = useCallback((seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, []);

    const getInstructions = () => {
        if (proofType === 'pickup') {
            return {
                title: '📦 Preuve de récupération',
                subtitle: 'Montrez le colis avant la récupération',
                tips: [
                    'Montrez l\'état du colis',
                    'Vérifiez l\'adresse de destination',
                    'Confirmez l\'identité du destinataire si présent'
                ]
            };
        } else {
            return {
                title: '✅ Preuve de livraison',
                subtitle: 'Montrez le colis à son emplacement final',
                tips: [
                    'Montrez où le colis a été déposé',
                    'Vérifiez que le colis est intact',
                    'Confirmez l\'adresse de livraison'
                ]
            };
        }
    };

    const instructions = getInstructions();

    if (hasPermission === null) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Demande de permissions...</Text>
            </View>
        );
    }

    if (hasPermission === false) {
        return (
            <View style={styles.container}>
                <SafeIcon name="camera-off" size={48} color={modernColors.textSecondary} />
                <Text style={styles.errorText}>Accès à la caméra refusé</Text>
                <Text style={styles.errorSubtext}>
                    Veuillez autoriser l'accès à la caméra dans les paramètres
                </Text>
                <TouchableOpacity style={styles.button} onPress={onCancel}>
                    <Text style={styles.buttonText}>Fermer</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Camera
                ref={cameraRef}
                style={styles.camera}
                type={cameraType}
                ratio="16:9"
            >
                {/* Overlay */}
                <View style={styles.overlay}>
                    {/* Header avec instructions */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
                            <SafeIcon name="x" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <View style={styles.timerContainer}>
                            {isRecording && (
                                <View style={styles.recordingIndicator} />
                            )}
                            <Text style={styles.timer}>
                                {formatTime(recordingTime)} / {formatTime(maxDuration)}
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.flipButton} onPress={toggleCamera}>
                            <SafeIcon name="refresh-cw" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Instructions */}
                    {!isRecording && (
                        <View style={styles.instructionsContainer}>
                            <Text style={styles.instructionsTitle}>{instructions.title}</Text>
                            <Text style={styles.instructionsSubtitle}>{instructions.subtitle}</Text>
                            <View style={styles.tipsContainer}>
                                {instructions.tips.map((tip, index) => (
                                    <View key={index} style={styles.tipItem}>
                                        <Text style={styles.tipBullet}>•</Text>
                                        <Text style={styles.tipText}>{tip}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Footer avec contrôles */}
                    <View style={styles.footer}>
                        <View style={styles.controls}>
                            {!isRecording ? (
                                <TouchableOpacity
                                    style={styles.recordButton}
                                    onPress={startRecording}
                                >
                                    <View style={styles.recordButtonInner} />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={styles.stopButton}
                                    onPress={stopRecording}
                                >
                                    <View style={styles.stopButtonInner} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Camera>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: 'transparent',
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    recordingIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
        marginRight: 8,
    },
    timer: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    flipButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    instructionsContainer: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        marginHorizontal: 20,
        padding: 16,
        borderRadius: 12,
        marginTop: 20,
    },
    instructionsTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
        textAlign: 'center',
    },
    instructionsSubtitle: {
        color: '#FFF',
        fontSize: 14,
        marginBottom: 12,
        textAlign: 'center',
        opacity: 0.9,
    },
    tipsContainer: {
        gap: 8,
    },
    tipItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    tipBullet: {
        color: modernColors.primary,
        fontSize: 16,
        marginRight: 8,
        fontWeight: 'bold',
    },
    tipText: {
        color: '#FFF',
        fontSize: 13,
        flex: 1,
        opacity: 0.9,
    },
    footer: {
        paddingBottom: Platform.OS === 'ios' ? 40 : 20,
        alignItems: 'center',
    },
    controls: {
        alignItems: 'center',
    },
    recordButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderWidth: 4,
        borderColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordButtonInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#EF4444',
    },
    stopButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderWidth: 4,
        borderColor: '#FFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stopButtonInner: {
        width: 40,
        height: 40,
        borderRadius: 4,
        backgroundColor: '#FFF',
    },
    loadingText: {
        marginTop: 16,
        color: modernColors.textSecondary,
        fontSize: 14,
    },
    errorText: {
        marginTop: 16,
        color: modernColors.error,
        fontSize: 16,
        fontWeight: '600',
    },
    errorSubtext: {
        marginTop: 8,
        color: modernColors.textSecondary,
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    button: {
        marginTop: 24,
        backgroundColor: modernColors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default DeliveryProofVideoRecorder;

