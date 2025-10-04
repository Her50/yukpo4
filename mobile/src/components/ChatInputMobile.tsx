// Remplacement des Ionicons par des emojis pour éviter les crashes
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface ChatInputMobileProps {
    onSubmit: (input: any) => void;
    loading: boolean;
    placeholder?: string;
    gpsData?: { lat: number; lng: number } | null;
    onGPSPress?: () => void;
}

const ChatInputMobile: React.FC<ChatInputMobileProps> = ({
    onSubmit,
    loading,
    placeholder = 'Décrivez votre besoin ou service...',
    gpsData,
    onGPSPress
}) => {
    const [text, setText] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [audioUri, setAudioUri] = useState<string | null>(null);
    const [documents, setDocuments] = useState<any[]>([]);
    const [isRecording, setIsRecording] = useState(false);

    // Demander les permissions
    const requestPermissions = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission requise', 'Nous avons besoin de la permission pour accéder à vos photos');
            return false;
        }
        return true;
    };

    // Prendre une photo avec validation
    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission requise', 'Nous avons besoin de la permission pour utiliser la caméra');
            return;
        }

        try {
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets[0].base64) {
                const imageBase64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
                
                // Demander confirmation à l'utilisateur
                Alert.alert(
                    'Confirmer la photo',
                    'Voulez-vous utiliser cette photo ?',
                    [
                        {
                            text: 'Reprendre',
                            style: 'cancel',
                            onPress: () => takePhoto() // Relancer la prise de photo
                        },
                        {
                            text: 'Utiliser',
                            onPress: () => {
                                setImages([...images, imageBase64]);
                                console.log('[ChatInputMobile] Photo confirmée');
                            }
                        }
                    ]
                );
            }
        } catch (error) {
            console.error('Erreur prise de photo:', error);
            Alert.alert('Erreur', 'Impossible de prendre la photo');
        }
    };

    // Choisir une image
    const pickImage = async () => {
        const hasPermission = await requestPermissions();
        if (!hasPermission) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled) {
            const newImages = result.assets
                .filter(asset => asset.base64)
                .map(asset => `data:image/jpeg;base64,${asset.base64}`);
            setImages([...images, ...newImages]);
        }
    };

    // Choisir un document
    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled) {
                setDocuments([...documents, result.assets[0]]);
            }
        } catch (error) {
            console.error('Erreur lors de la sélection du document:', error);
        }
    };

    // État de l'enregistrement
    const [recording, setRecording] = useState<Audio.Recording | null>(null);

    // Enregistrer audio
    const startRecording = async () => {
        try {
            console.log('[ChatInput] Demande permission audio...');
            const permission = await Audio.requestPermissionsAsync();

            if (permission.status !== 'granted') {
                Alert.alert('Permission requise', 'Nous avons besoin de la permission pour enregistrer l\'audio');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            console.log('[ChatInput] Démarrage enregistrement...');
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(recording);
            setIsRecording(true);
            console.log('[ChatInput] Enregistrement démarré');
        } catch (error) {
            console.error('[ChatInput] Erreur enregistrement:', error);
            Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement');
        }
    };

    const stopRecording = async () => {
        if (!recording) return;

        try {
            console.log('[ChatInput] Arrêt enregistrement...');
            setIsRecording(false);
            await recording.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            const uri = recording.getURI();
            console.log('[ChatInput] Audio enregistré:', uri);

            // Sauvegarder l'URI audio
            if (uri) {
                setAudioUri(uri);
                console.log('✅ Audio enregistré avec succès');
            }

            setRecording(null);
        } catch (error) {
            console.error('[ChatInput] Erreur arrêt:', error);
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // Supprimer une image
    const removeImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
    };

    // Supprimer un document
    const removeDocument = (index: number) => {
        setDocuments(documents.filter((_, i) => i !== index));
    };

    // Soumettre
    const handleSubmit = () => {
        if (!text.trim() && images.length === 0 && documents.length === 0) {
            Alert.alert('Erreur', 'Veuillez saisir du texte ou ajouter des médias');
            return;
        }

        const input = {
            texte: text.trim(),  // IMPORTANT: "texte" pas "text" (comme le frontend)
            text: text.trim(),   // Garder les deux pour compatibilité
            base64_image: images || [],
            audio_base64: audioUri ? [audioUri] : [],
            video_base64: [],
            doc_base64: documents.map(d => d.uri) || [],
            excel_base64: [],
            pdf_base64: [],
            gps_mobile: gpsData ? `${gpsData.lat},${gpsData.lng}` : undefined,
            gps_zone: gpsData ? [gpsData] : undefined,
            gps_fixe: gpsData ? `${gpsData.lat},${gpsData.lng}` : undefined,
            gps_fixe_coords: gpsData ? JSON.stringify([gpsData]) : undefined,
        };

        console.log('[ChatInputMobile] Soumission:', input);
        onSubmit(input);
        
        // Réinitialiser les champs après soumission
        setText('');
        setImages([]);
        setDocuments([]);
        setAudioUri(null);
    };

    return (
        <View style={styles.container}>
            {/* Aperçu des images */}
            {images.length > 0 && (
                <ScrollView horizontal style={styles.previewContainer} showsHorizontalScrollIndicator={false}>
                    {images.map((uri, index) => (
                        <View key={index} style={styles.imagePreview}>
                            <Image source={{ uri }} style={styles.previewImage} />
                            <TouchableOpacity
                                style={styles.removeButton}
                                onPress={() => removeImage(index)}
                            >
                                <Text style={styles.closeIcon}>❌</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>
            )}

            {/* Aperçu des documents */}
            {documents.length > 0 && (
                <View style={styles.documentsContainer}>
                    {documents.map((doc, index) => (
                        <View key={index} style={styles.documentItem}>
                            <Text style={styles.documentIcon}>📄</Text>
                            <Text style={styles.documentName} numberOfLines={1}>
                                {doc.name}
                            </Text>
                            <TouchableOpacity onPress={() => removeDocument(index)}>
                                <Text style={styles.closeIconSmall}>❌</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}

            {/* Zone de texte principale avec boutons intégrés en bas */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.textInput}
                    placeholder={placeholder}
                    placeholderTextColor="#999"
                    value={text}
                    onChangeText={setText}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                />
                
                {/* Boutons d'action intégrés en bas de la zone de texte */}
                <View style={styles.actionsContainer}>
                {/* Audio - EN PREMIER */}
                <TouchableOpacity
                    style={[styles.actionButton, isRecording && styles.actionButtonRecording]}
                    onPress={toggleRecording}
                    disabled={loading}
                >
                    <Text style={[styles.actionIcon, isRecording && styles.actionIconRecording]}>
                        {isRecording ? "⏹️" : "🎤"}
                    </Text>
                    <Text style={[styles.actionButtonText, isRecording && styles.actionButtonTextRecording]}>
                        {isRecording ? 'Stop' : (audioUri ? '✓ Audio' : 'Audio')}
                    </Text>
                </TouchableOpacity>

                {/* GPS */}
                <TouchableOpacity
                    style={[styles.actionButton, gpsData && styles.actionButtonActive]}
                    onPress={onGPSPress}
                >
                    <Text style={[styles.gpsIcon, gpsData && styles.gpsIconActive]}>📍</Text>
                    <Text style={[styles.actionButtonText, gpsData && styles.actionButtonTextActive]}>
                        GPS
                    </Text>
                </TouchableOpacity>

                {/* Photo */}
                <TouchableOpacity style={styles.actionButton} onPress={takePhoto} disabled={loading}>
                    <Text style={styles.actionIcon}>📷</Text>
                    <Text style={styles.actionButtonText}>Photo</Text>
                </TouchableOpacity>

                {/* Image */}
                <TouchableOpacity style={styles.actionButton} onPress={pickImage} disabled={loading}>
                    <Text style={styles.actionIcon}>🖼️</Text>
                    <Text style={styles.actionButtonText}>Image</Text>
                </TouchableOpacity>

                {/* Document */}
                <TouchableOpacity style={styles.actionButton} onPress={pickDocument} disabled={loading}>
                    <Text style={styles.actionIcon}>📄</Text>
                    <Text style={styles.actionButtonText}>Fichier</Text>
                </TouchableOpacity>
                
                {/* Bouton d'envoi principal - MIS EN VALEUR */}
                <TouchableOpacity
                    style={[styles.submitButton, loading && styles.sendButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading || (!text.trim() && images.length === 0)}
                >
                    <Text style={styles.sendIcon}>🚀</Text>
                    <Text style={styles.submitButtonText}>
                        {loading ? 'Envoi...' : 'Envoyer'}
                    </Text>
                </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFF',
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    inputContainer: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        backgroundColor: '#F8F9FA',
        marginBottom: 12,
    },
    textInput: {
        fontSize: 16,
        color: '#1A1A1A',
        minHeight: 90,
        maxHeight: 150,
        textAlignVertical: 'top',
        padding: 12,
        paddingBottom: 4,
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    actionButton: {
        flexDirection: 'column',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8,
    },
    actionButtonActive: {
        backgroundColor: '#6366F1',
        borderColor: '#6366F1',
    },
    actionButtonRecording: {
        backgroundColor: '#FEE2E2',
        borderColor: '#EF4444',
    },
    actionButtonText: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '600',
    },
    actionButtonTextActive: {
        color: '#FFF',
    },
    actionButtonTextRecording: {
        color: '#EF4444',
    },
    previewContainer: {
        marginBottom: 12,
    },
    imagePreview: {
        position: 'relative',
        marginRight: 12,
    },
    previewImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
    },
    removeButton: {
        position: 'absolute',
        top: -8,
        right: -8,
    },
    closeIcon: {
        fontSize: 24,
    },
    closeIconSmall: {
        fontSize: 20,
    },
    documentIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    gpsIcon: {
        fontSize: 20,
    },
    gpsIconActive: {
        color: '#4CAF50',
    },
    actionIcon: {
        fontSize: 20,
        marginRight: 4,
    },
    actionIconRecording: {
        color: '#EF4444',
    },
    sendIcon: {
        fontSize: 20,
        marginRight: 4,
    },
    documentsContainer: {
        marginBottom: 12,
    },
    documentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF9E6',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        gap: 8,
    },
    documentName: {
        flex: 1,
        fontSize: 14,
        color: '#1A1A1A',
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#06B6D4',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 16,
        marginTop: 8,
        gap: 8,
        shadowColor: '#06B6D4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
        minWidth: 120,
    },
    submitButtonDisabled: {
        backgroundColor: '#9CA3AF',
        elevation: 0,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFF',
    },
    sendButtonCompact: {
        backgroundColor: '#6366F1',
        padding: 10,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 50,
    },
    sendButtonDisabled: {
        backgroundColor: '#9CA3AF',
        opacity: 0.5,
    },
});

export default ChatInputMobile;

