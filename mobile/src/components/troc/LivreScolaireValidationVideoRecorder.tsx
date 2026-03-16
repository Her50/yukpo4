// @ts-nocheck
/**
 * Enregistreur vidéo de validation d'état pour livre scolaire
 * Permet de valider l'état d'un livre lors d'un troc via vidéo Live
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
import { useLanguageSafe } from '../contexts/LanguageContext';

interface LivreScolaireValidationVideoRecorderProps {
    livreId: number;
    livreTitre: string;
    onRecordingComplete: (uri: string) => void;
    onCancel: () => void;
    maxDuration?: number; // en secondes, défaut 60 pour validation livre
}

const LivreScolaireValidationVideoRecorder: React.FC<LivreScolaireValidationVideoRecorderProps> = ({
    livreId,
    livreTitre,
    onRecordingComplete,
    onCancel,
    maxDuration = 60, // 60 secondes max pour validation livre
}) => {
        const { t } = useLanguageSafe();
const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [cameraType, setCameraType] = useState<CameraType>('back' as CameraType);
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
            console.error('[LivreScolaireValidationVideoRecorder] Erreur enregistrement:', error);
            Alert.alert('Erreur', 'Impossible d\'enregistrer la vidéo');
            setIsRecording(false);
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }
        }
    }, [isRecording, maxDuration, onRecordingComplete]);

    const stopRecording = useCallback(async () => {
        if (!isRecording || !cameraRef.current) {
            return;
        }

        try {
            setIsRecording(false);

            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }

            if (cameraRef.current) {
                cameraRef.current.stopRecording();
            }

            if (recordingPromiseRef.current) {
                const video = await recordingPromiseRef.current;
                if (video?.uri) {
                    await MediaLibrary.createAssetAsync(video.uri);
                    onRecordingComplete(video.uri);
                }
            }
        } catch (error: any) {
            console.error('[LivreScolaireValidationVideoRecorder] Erreur arrêt:', error);
            Alert.alert('Erreur', 'Impossible d\'arrêter l\'enregistrement');
        }
    }, [isRecording, onRecordingComplete]);

    const toggleCameraType = () => {
        setCameraType((current) =>
            current === ('back' as CameraType) ? ('front' as CameraType) : ('back' as CameraType)
        );
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (hasPermission === null) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.permissionText}>{t('livreScolaireValidationVideoRecorder.demandeDautorisation')}</Text>
            </View>
        );
    }

    if (hasPermission === false) {
        return (
            <View style={styles.container}>
                <SafeIcon name="CameraOff" size={64} color={modernColors.error} type="lucide" />
                <Text style={styles.errorText}>
                    Permission caméra refusée
                </Text>
                <Text style={styles.errorSubtext}>
                    Veuillez autoriser l'accès à la caméra dans les paramètres
                </Text>
                <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                    <Text style={styles.cancelButtonText}>{t('livreScolaireValidationVideoRecorder.retour')}</Text>
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
                <View style={styles.overlay}>
                    {/* Header avec titre du livre */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
                            <SafeIcon name="X" size={24} color="#FFF" type="lucide" />
                        </TouchableOpacity>
                        <View style={styles.titleContainer}>
                            <Text style={styles.title} numberOfLines={2}>
                                Validation: {livreTitre}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.flipButton}
                            onPress={toggleCameraType}
                        >
                            <SafeIcon name="RefreshCw" size={24} color="#FFF" type="lucide" />
                        </TouchableOpacity>
                    </View>

                    {/* Instructions */}
                    <View style={styles.instructionsContainer}>
                        <Text style={styles.instructionsTitle}>
                            📚 Instructions de validation
                        </Text>
                        <Text style={styles.instructionsText}>
                            • Montrez bien la couverture du livre{'\n'}
                            • Feuilletez les pages importantes{'\n'}
                            • Montrez les dommages éventuels{'\n'}
                            • Montrez le dos du livre
                        </Text>
                    </View>

                    {/* Timer et contrôles */}
                    <View style={styles.controlsContainer}>
                        {isRecording && (
                            <View style={styles.recordingIndicator}>
                                <View style={styles.recordingDot} />
                                <Text style={styles.recordingText}>
                                    {formatTime(recordingTime)} / {formatTime(maxDuration)}
                                </Text>
                            </View>
                        )}

                        <View style={styles.controlsRow}>
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
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleContainer: {
        flex: 1,
        marginHorizontal: 10,
    },
    title: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    flipButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    instructionsContainer: {
        position: 'absolute',
        top: 120,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 12,
        padding: 16,
    },
    instructionsTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 8,
    },
    instructionsText: {
        color: '#FFF',
        fontSize: 13,
        lineHeight: 20,
    },
    controlsContainer: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    recordingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 20,
    },
    recordingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FFF',
        marginRight: 8,
    },
    recordingText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 30,
    },
    recordButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderWidth: 4,
        borderColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordButtonInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: modernColors.error,
    },
    stopButton: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderWidth: 4,
        borderColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stopButtonInner: {
        width: 40,
        height: 40,
        borderRadius: 4,
        backgroundColor: '#FFF',
    },
    permissionText: {
        color: '#FFF',
        marginTop: 16,
        fontSize: 16,
    },
    errorText: {
        color: modernColors.error,
        fontSize: 18,
        fontWeight: '700',
        marginTop: 20,
        textAlign: 'center',
    },
    errorSubtext: {
        color: '#FFF',
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    cancelButton: {
        marginTop: 30,
        paddingHorizontal: 30,
        paddingVertical: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    cancelButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default LivreScolaireValidationVideoRecorder;

