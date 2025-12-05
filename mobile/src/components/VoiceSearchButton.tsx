// ✅ NOUVEAU Phase 4.3: Bouton de recherche vocale
// Utilise expo-speech pour la transcription (ou alternative)

import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface Props {
    onTranscript: (text: string) => void;
    disabled?: boolean;
}

const VoiceSearchButton: React.FC<Props> = ({ onTranscript, disabled }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // TODO: Intégrer expo-speech ou @react-native-voice/voice
    // Pour l'instant, simulation avec prompt
    const handlePress = async () => {
        if (isRecording) {
            // Arrêter l'enregistrement
            setIsRecording(false);
            setIsProcessing(true);

            // Simulation: demander à l'utilisateur de saisir (en attendant l'intégration réelle)
            Alert.prompt(
                'Recherche vocale',
                'La transcription vocale sera bientôt disponible. Veuillez saisir votre recherche:',
                [
                    {
                        text: 'Annuler',
                        style: 'cancel',
                        onPress: () => setIsProcessing(false),
                    },
                    {
                        text: 'Rechercher',
                        onPress: (text) => {
                            if (text && text.trim()) {
                                onTranscript(text.trim());
                            }
                            setIsProcessing(false);
                        },
                    },
                ],
                'plain-text'
            );
        } else {
            // Démarrer l'enregistrement
            setIsRecording(true);
            // TODO: Démarrer l'enregistrement audio réel
            // await startRecording();
        }
    };

    return (
        <TouchableOpacity
            style={[
                styles.button,
                isRecording && styles.buttonRecording,
                disabled && styles.buttonDisabled,
            ]}
            onPress={handlePress}
            disabled={disabled || isProcessing}
        >
            {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
            ) : (
                <>
                    <SafeIcon
                        name={isRecording ? 'mic' : 'mic-off'}
                        size={20}
                        color="#fff"
                        type="lucide"
                    />
                    <Text style={styles.buttonText}>
                        {isRecording ? 'Enregistrement...' : 'Recherche vocale'}
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
    },
    buttonRecording: {
        backgroundColor: modernColors.error,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
});

export default VoiceSearchButton;

