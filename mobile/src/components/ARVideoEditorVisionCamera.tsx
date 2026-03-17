/**
 * 🎬 ARVideoEditorVisionCamera - Éditeur vidéo AR avec VisionCamera
 * Phase 2: Migration vers react-native-vision-camera pour tracking AR réel
 * 
 * Cette version utilise react-native-vision-camera avec Frame Processor
 * pour la détection de plans AR en temps réel via ARKit/ARCore
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Camera, Frame, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { createARPlugin } from '../native/ARPlugin';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { NativeButton, NativeCard } from './SafeNativeDesign';
import { useLanguageSafe } from '../contexts/LanguageContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ARVideoEditorVisionCameraProps {
    onVideoCaptured?: (videoUri: string) => void;
    onClose?: () => void;
    productName?: string;
    serviceId?: number;
    productIndex?: number;
}

type ARTrackingState = 'idle' | 'tracking' | 'tracking_lost' | 'error';
type ARMode = 'preview' | 'recording' | 'processing';

interface ARTrackingResult {
    hasPlane: boolean;
    planePosition?: { x: number; y: number; z: number };
    planeNormal?: { x: number; y: number; z: number };
    trackingQuality: 'excellent' | 'good' | 'poor' | 'none';
}

export const ARVideoEditorVisionCamera: React.FC<ARVideoEditorVisionCameraProps> = ({
    onVideoCaptured,
    onClose,
    productName = 'Produit',
    serviceId,
    productIndex,
}) => {
    const { hasPermission, requestPermission } = useCameraPermission();
    const device = useCameraDevice('back');
        const { t } = useLanguageSafe();
const [trackingState, setTrackingState] = useState<ARTrackingState>('idle');
    const [arMode, setArMode] = useState<ARMode>('preview');
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [videoUri, setVideoUri] = useState<string | null>(null);
    const [arTrackingResult, setArTrackingResult] = useState<ARTrackingResult | null>(null);

    const cameraRef = useRef<Camera>(null);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const trackingIndicatorOpacity = useSharedValue(0);

    // ✅ Callbacks pour mise à jour état depuis worklet
    const updateTrackingResult = useCallback((result: ARTrackingResult) => {
        setArTrackingResult(result);
        if (result.hasPlane) {
            setTrackingState('tracking');
        } else if (result.trackingQuality === 'none') {
            setTrackingState('error');
        } else {
            setTrackingState('tracking_lost');
        }
    }, []);

    // ✅ NOUVEAU Phase 2: Frame Processor pour AR tracking en temps réel avec runOnJS
    const frameProcessor = useFrameProcessor((frame: Frame) => {
        'worklet';

        try {
            const arPlugin = createARPlugin();
            const result = arPlugin.detectPlanes(frame);

            // Convertir le résultat du plugin en format ARTrackingResult
            if (result.hasPlane && result.planes.length > 0) {
                const plane = result.planes[0];

                const trackingResult: ARTrackingResult = {
                    hasPlane: true,
                    planePosition: plane.center,
                    planeNormal: plane.normal,
                    trackingQuality: result.trackingQuality,
                };

                // ✅ Utiliser runOnJS pour mettre à jour l'état depuis le worklet
                runOnJS(updateTrackingResult)(trackingResult);
            } else {
                const trackingResult: ARTrackingResult = {
                    hasPlane: false,
                    trackingQuality: result.trackingQuality,
                };

                runOnJS(updateTrackingResult)(trackingResult);
            }
        } catch (error) {
            console.error('[ARVideoEditor] Erreur frame processor AR:', error);
            const errorResult: ARTrackingResult = {
                hasPlane: false,
                trackingQuality: 'none',
            };
            runOnJS(updateTrackingResult)(errorResult);
        }
    }, [updateTrackingResult]);

    // Animation pour les indicateurs AR
    useEffect(() => {
        if (trackingState === 'tracking') {
            trackingIndicatorOpacity.value = withSpring(1, { damping: 15 });
        } else {
            trackingIndicatorOpacity.value = withTiming(0, { duration: 300 });
        }
    }, [trackingState]);

    // Demander les permissions caméra
    useEffect(() => {
        if (!hasPermission) {
            requestPermission();
        }
    }, [hasPermission, requestPermission]);

    const handleStartRecording = useCallback(async () => {
        if (!cameraRef.current || !hasPermission) {
            Alert.alert('Erreur', t('aRVideoEditorVisionCamera.permissionsCameraRequises'));
            return;
        }

        if (trackingState !== 'tracking') {
            Alert.alert('Erreur', t('aRVideoEditorVisionCamera.veuillezAttendreLaDetectionD')une surface AR');
            return;
        }

        try {
            setIsRecording(true);
            setArMode('recording');
            setRecordingDuration(0);

            // Démarrer le timer d'enregistrement
            recordingTimerRef.current = setInterval(() => {
                setRecordingDuration((prev) => prev + 1);
            }, 1000);

            // ✅ Enregistrement vidéo avec VisionCamera
            await cameraRef.current.startRecording({
                onRecordingFinished: (video) => {
                    setVideoUri(video.path);
                    setIsRecording(false);
                    setArMode('preview');
                    if (recordingTimerRef.current) {
                        clearInterval(recordingTimerRef.current);
                        recordingTimerRef.current = null;
                    }
                    // ✅ CORRIGÉ: Ne pas appeler onVideoCaptured automatiquement
                    // L'utilisateur doit cliquer sur "Utiliser cette vidéo" pour continuer
                },
                onRecordingError: (error) => {
                    console.error('[ARVideoEditor] Erreur enregistrement:', error);
                    Alert.alert('Erreur', 'Impossible d\t('aRVideoEditorVisionCamera.enregistrerLaVideo'));
                    setIsRecording(false);
                    setArMode('preview');
                    if (recordingTimerRef.current) {
                        clearInterval(recordingTimerRef.current);
                        recordingTimerRef.current = null;
                    }
                },
            });

            console.log('[ARVideoEditor] Démarrage enregistrement AR...');
        } catch (error) {
            console.error('[ARVideoEditor] Erreur enregistrement:', error);
            Alert.alert('Erreur', t('aRVideoEditorVisionCamera.impossibleDeDemarrerL')enregistrement');
            setIsRecording(false);
            setArMode('preview');
        }
    }, [hasPermission, trackingState, onVideoCaptured]);

    const handleStopRecording = useCallback(async () => {
        if (recordingTimerRef.current) {
            clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }

        try {
            await cameraRef.current?.stopRecording();
        } catch (error) {
            console.error('[ARVideoEditor] Erreur arrêt enregistrement:', error);
        }
    }, []);

    const animatedTrackingStyle = useAnimatedStyle(() => {
        return {
            opacity: trackingIndicatorOpacity.value,
        };
    });

    // Vérifier les permissions
    if (!hasPermission) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>{t('aRVideoEditorVisionCamera.verificationDesPermissions')}</Text>
            </View>
        );
    }

    if (!device) {
        return (
            <View style={styles.container}>
                <NativeCard style={styles.permissionCard}>
                    <SafeIcon name="camera-off" size={64} color={modernColors.primary} />
                    <Text style={styles.permissionTitle}>{t('aRVideoEditorVisionCamera.cameraNonDisponible')}</Text>
                    <Text style={styles.permissionText}>
                        Aucune caméra arrière trouvée sur cet appareil.
                    </Text>
                </NativeCard>
            </View>
        );
    }

    // Obtenir le message de tracking selon l'état
    const getTrackingMessage = () => {
        switch (trackingState) {
            case 'tracking':
                const quality = arTrackingResult?.trackingQuality || 'good';
                return t('aRVideoEditorVisionCamera.surfaceDetecteeQualite', { quality === 'excellent' ? 'Excellente' : 'Bonne': quality === 'excellent' ? 'Excellente' : 'Bonne' });
            case 'tracking_lost':
                return t('aRVideoEditorVisionCamera.surfacePerdueDeplacezLaCamera');
            case 'error':
                return 'Erreur de tracking AR';
            default:
                return 'Recherche de surface...';
        }
    };

    return (
        <View style={styles.container}>
            {/* Vue caméra AR avec VisionCamera - Masquée après capture */}
            {!videoUri && (
                <Camera
                    ref={cameraRef}
                    style={styles.camera}
                    device={device}
                    isActive={arMode === 'preview' || arMode === 'recording'}
                    frameProcessor={frameProcessor}
                    video={true}
                    audio={true}
                >
                    {/* Overlay AR */}
                    <View style={styles.overlay}>
                        {/* Indicateur de tracking AR */}
                        <View style={[styles.trackingIndicator, animatedTrackingStyle]}>
                            <LinearGradient
                                colors={[
                                    trackingState === 'tracking'
                                        ? modernColors.primary + '80'
                                        : '#f59e0b80',
                                    trackingState === 'tracking'
                                        ? modernColors.primary + '20'
                                        : '#f59e0b20'
                                ]}
                                style={styles.trackingGradient}
                            >
                                <SafeIcon
                                    name={
                                        trackingState === 'tracking'
                                            ? 'check-circle'
                                            : trackingState === 'error'
                                                ? 'alert-circle'
                                                : 'search'
                                    }
                                    size={24}
                                    color={
                                        trackingState === 'tracking'
                                            ? '#ffffff'
                                            : '#f59e0b'
                                    }
                                />
                                <Text style={styles.trackingText}>{getTrackingMessage()}</Text>
                            </LinearGradient>
                        </View>

                        {/* Indicateur de plan détecté */}
                        {arTrackingResult?.planePosition && (
                            <View style={styles.planeIndicator}>
                                <Text style={styles.planeText}>
                                    Position: ({arTrackingResult.planePosition.x.toFixed(2)}, {arTrackingResult.planePosition.y.toFixed(2)}, {arTrackingResult.planePosition.z.toFixed(2)})
                                </Text>
                            </View>
                        )}

                        {/* Contrôles */}
                        <View style={styles.controls}>
                            {!videoUri && !isRecording ? (
                                <NativeButton
                                    title={t('aRVideoEditorVisionCamera.demarrerL')}enregistrement"
                                    variant="primary"
                                    size="large"
                                    onPress={handleStartRecording}
                                    disabled={trackingState !== 'tracking'}
                                />
                            ) : (
                                <View style={styles.recordingControls}>
                                    <NativeButton
                                        title={t('aRVideoEditorVisionCamera.arreterS', { recordingDuration: recordingDuration })}
                                        variant="danger"
                                        size="large"
                                        onPress={handleStopRecording}
                                    />
                                </View>
                            )}

                            {!videoUri && onClose && (
                                <NativeButton
                                    title={t('aRVideoEditorVisionCamera.fermer')}
                                    variant="secondary"
                                    size="medium"
                                    onPress={onClose}
                                    style={styles.closeButton}
                                />
                            )}
                        </View>
                    </View>
                </Camera>
            )}

            {/* ✅ Interface post-capture */}
            {videoUri && (
                <View style={styles.postCaptureOverlay}>
                    <LinearGradient
                        colors={['#667eea', '#764ba2']}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.postCaptureContent}>
                        <NativeCard style={styles.videoPreviewCard}>
                            <SafeIcon name="check-circle" size={64} color={modernColors.success} />
                            <Text style={styles.successText}>{t('aRVideoEditorVisionCamera.videoEnregistreeAvecSucces')}</Text>
                            <Text style={styles.successSubtext}>{t('aRVideoEditorVisionCamera.pretPourLetapeSuivante')}</Text>
                        </NativeCard>

                        <View style={styles.actionButtons}>
                            <NativeButton
                                title={t('aRVideoEditorVisionCamera.utiliserCetteVideo')}
                                variant="primary"
                                size="large"
                                onPress={() => {
                                    if (onVideoCaptured && videoUri) {
                                        onVideoCaptured(videoUri);
                                    }
                                }}
                                style={styles.continueButton}
                            />

                            <NativeButton
                                title={t('aRVideoEditorVisionCamera.reenregistrer')}
                                variant="secondary"
                                size="medium"
                                onPress={() => {
                                    setVideoUri(null);
                                    setArMode('preview');
                                    setRecordingDuration(0);
                                }}
                                style={styles.retryButton}
                            />
                        </View>

                        {onClose && (
                            <NativeButton
                                title={t('aRVideoEditorVisionCamera.fermer')}
                                variant="secondary"
                                size="medium"
                                onPress={onClose}
                                style={styles.closeButton}
                            />
                        )}
                    </View>
                </View>
            )}
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
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
    },
    trackingIndicator: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        borderRadius: 12,
        overflow: 'hidden',
    },
    trackingGradient: {
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    trackingText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
    planeIndicator: {
        position: 'absolute',
        top: 100,
        left: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 8,
        borderRadius: 8,
    },
    planeText: {
        color: '#ffffff',
        fontSize: 12,
    },
    controls: {
        padding: 20,
        alignItems: 'center',
        gap: 12,
    },
    recordingControls: {
        alignItems: 'center',
        gap: 12,
    },
    closeButton: {
        marginTop: 12,
    },
    postCaptureControls: {
        width: '100%',
        alignItems: 'center',
        gap: 16,
    },
    videoPreviewCard: {
        padding: 24,
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 16,
    },
    successText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        textAlign: 'center',
    },
    successSubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    actionButtons: {
        width: '100%',
        alignItems: 'center',
        gap: 12,
    },
    continueButton: {
        width: '100%',
    },
    retryButton: {
        width: '100%',
    },
    postCaptureOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    postCaptureContent: {
        width: '100%',
        padding: 24,
        alignItems: 'center',
        gap: 24,
    },
    loadingText: {
        color: '#ffffff',
        marginTop: 12,
    },
    permissionCard: {
        padding: 24,
        alignItems: 'center',
        gap: 16,
    },
    permissionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    permissionText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
});

