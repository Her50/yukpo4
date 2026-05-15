// ✅ NOUVEAU Phase 4.3: Recherche vocale avec @react-native-voice/voice
import React, { useState, useEffect } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Voice from '@react-native-voice/voice';
import SafeIcon from '../SafeIcon';
import { modernColors } from '../../theme/modernTheme';

interface VoiceSearchButtonProps {
    onResult: (text: string) => void;
    onError?: (error: string) => void;
}

const VoiceSearchButton: React.FC<VoiceSearchButtonProps> = ({
    onResult,
    onError,
}) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isAvailable, setIsAvailable] = useState(false);

    // ✅ Vérifier la disponibilité de la reconnaissance vocale au montage
    useEffect(() => {
        const checkAvailability = async () => {
            try {
                if (Platform.OS === 'ios' || Platform.OS === 'android') {
                    const available = await Voice.isAvailable();
                    setIsAvailable(available);
                } else {
                    // Web : Vérifier Web Speech API
                    setIsAvailable(
                        typeof window !== 'undefined' &&
                        ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
                    );
                }
            } catch (error) {
                console.error('[VoiceSearchButton] Erreur vérification disponibilité:', error);
                setIsAvailable(false);
            }
        };

        checkAvailability();

        // ✅ Configurer les handlers Voice
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
            Voice.onSpeechStart = () => {
                console.log('[VoiceSearchButton] Enregistrement démarré');
                setIsRecording(true);
            };

            Voice.onSpeechEnd = () => {
                console.log('[VoiceSearchButton] Enregistrement terminé');
                setIsRecording(false);
            };

            Voice.onSpeechResults = (e: any) => {
                if (e.value && e.value.length > 0) {
                    const recognizedText = e.value[0];
                    console.log('[VoiceSearchButton] Texte reconnu:', recognizedText);
                    onResult(recognizedText);
                }
                setIsRecording(false);
            };

            Voice.onSpeechError = (e: any) => {
                console.error('[VoiceSearchButton] Erreur reconnaissance:', e);
                setIsRecording(false);
                if (onError) {
                    onError(e.error?.message || 'Erreur lors de la reconnaissance vocale');
                }
            };
        }

        // Cleanup
        return () => {
            if (Platform.OS === 'ios' || Platform.OS === 'android') {
                Voice.destroy().then(() => {
                    Voice.removeAllListeners();
                }).catch((err) => {
                    console.error('[VoiceSearchButton] Erreur cleanup:', err);
                });
            }
        };
    }, [onResult, onError]);

    const startVoiceSearch = async () => {
        try {
            if (Platform.OS === 'ios' || Platform.OS === 'android') {
                if (!isAvailable) {
                    Alert.alert(
                        'Recherche vocale',
                        'La reconnaissance vocale n\'est pas disponible sur cet appareil.',
                        [{ text: 'OK' }]
                    );
                    return;
                }

                // ✅ Démarrer la reconnaissance vocale
                await Voice.start('fr-FR'); // Langue française
                setIsRecording(true);
            } else {
                // Web : Utiliser Web Speech API
                if (typeof window !== 'undefined') {
                    const SpeechRecognition = (window as any).webkitSpeechRecognition || 
                                            (window as any).SpeechRecognition;
                    
                    if (SpeechRecognition) {
                        const recognition = new SpeechRecognition();
                        recognition.lang = 'fr-FR';
                        recognition.continuous = false;
                        recognition.interimResults = false;

                        recognition.onstart = () => {
                            setIsRecording(true);
                        };

                        recognition.onresult = (event: any) => {
                            const transcript = event.results[0][0].transcript;
                            onResult(transcript);
                            setIsRecording(false);
                        };

                        recognition.onerror = (event: any) => {
                            console.error('[VoiceSearchButton] Erreur Web Speech:', event);
                            setIsRecording(false);
                            if (onError) {
                                onError(event.error || 'Erreur lors de la reconnaissance vocale');
                            }
                        };

                        recognition.onend = () => {
                            setIsRecording(false);
                        };

                        recognition.start();
                    } else {
                        Alert.alert(
                            'Recherche vocale',
                            'Votre navigateur ne supporte pas la reconnaissance vocale.',
                            [{ text: 'OK' }]
                        );
                    }
                }
            }
        } catch (error: any) {
            console.error('[VoiceSearchButton] Erreur démarrage:', error);
            setIsRecording(false);
            if (onError) {
                onError(error.message || 'Erreur lors du démarrage de la reconnaissance vocale');
            }
        }
    };

    const stopVoiceSearch = async () => {
        try {
            if (Platform.OS === 'ios' || Platform.OS === 'android') {
                await Voice.stop();
            }
            setIsRecording(false);
        } catch (error: any) {
            console.error('[VoiceSearchButton] Erreur arrêt:', error);
            setIsRecording(false);
        }
    };

    return (
        <TouchableOpacity
            style={[styles.button, isRecording && styles.buttonRecording, !isAvailable && styles.buttonDisabled]}
            onPress={isRecording ? stopVoiceSearch : startVoiceSearch}
            disabled={!isAvailable}
        >
            <SafeIcon
                name={isRecording ? 'mic' : 'mic'}
                size={20}
                color={isRecording ? '#FFFFFF' : (isAvailable ? modernColors.primary : '#9CA3AF')}
            />
            {isRecording && (
                <View style={styles.recordingIndicator}>
                    <View style={styles.pulse} />
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    buttonRecording: {
        backgroundColor: modernColors.primary,
    },
    recordingIndicator: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: modernColors.primary,
    },
    pulse: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.primary,
        opacity: 0.3,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
});

export default VoiceSearchButton;

