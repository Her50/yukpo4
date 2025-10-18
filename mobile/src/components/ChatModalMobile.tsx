import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useWebSocketChat } from '../hooks/useWebSocketChat';
import { modernColors } from '../theme/modernTheme';
import InAppCallModal from './InAppCallModal';
import SafeIcon from './SafeIcon';
import ServiceMediaGallery from './ServiceMediaGallery';

interface ChatModalMobileProps {
    visible: boolean;
    onClose: () => void;
    service: any;
    prestataireInfo: any;
    user: any;
}

const ChatModalMobile: React.FC<ChatModalMobileProps> = ({
    visible,
    onClose,
    service,
    prestataireInfo,
    user
}) => {
    const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // États pour les médias
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
    const [selectedAudioUri, setSelectedAudioUri] = useState<string | null>(null);
    const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [showMediaGallery, setShowMediaGallery] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);

    // États pour les appels internes
    const [showCallModal, setShowCallModal] = useState(false);
    const [callType, setCallType] = useState<'audio' | 'video'>('audio');

    const scrollViewRef = useRef<ScrollView>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Utiliser le hook WebSocket
    const {
        messages,
        isConnected,
        isTyping: prestataireTyping,
        sendMessage,
        editMessage,
        deleteMessage,
        markAsRead
    } = useWebSocketChat(
        service?.id || 0,
        prestataireInfo?.userId || 0,
        user?.id || 0
    );

    // Fonction utilitaire pour extraire la valeur d'un champ de service
    const getServiceFieldValue = (field: any): string => {
        if (!field) return 'Non spécifié';
        if (typeof field === 'string') return field;
        if (field && typeof field === 'object') {
            if (field.valeur !== undefined) {
                const value = field.valeur;
                if (typeof value === 'string') return value;
                if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
                if (typeof value === 'number') return value.toString();
                if (Array.isArray(value)) return value.join(', ');
                return String(value);
            }
        }
        return 'Non spécifié';
    };

    const nomPrestataire = prestataireInfo?.nom_complet || prestataireInfo?.nom || `Prestataire #${service?.user_id}`;
    const titreService = getServiceFieldValue(service?.data?.titre_service);
    const categorieService = getServiceFieldValue(service?.data?.category);

    // Auto-scroll vers le bas
    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => {
                scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages]);

    // Marquer comme lu quand le modal s'ouvre
    useEffect(() => {
        if (visible) {
            markAsRead();
        }
    }, [visible, markAsRead]);

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;

        await sendMessage(newMessage.trim(), 'text');
        setNewMessage('');
        setShowEmojiPicker(false);
    };

    const handleEditMessage = async () => {
        if (!editingContent.trim() || !editingMessageId) return;

        await editMessage(editingMessageId, editingContent.trim());
        setEditingMessageId(null);
        setEditingContent('');
    };

    const handleDeleteMessage = async (messageId: string) => {
        Alert.alert(
            'Supprimer le message',
            'Êtes-vous sûr de vouloir supprimer ce message ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => deleteMessage(messageId)
                }
            ]
        );
    };

    const startEditing = (message: any) => {
        setEditingMessageId(message.id);
        setEditingContent(message.content);
    };

    const cancelEditing = () => {
        setEditingMessageId(null);
        setEditingContent('');
    };

    const handleCall = () => {
        const phoneNumber = getServiceFieldValue(service?.data?.telephone) ||
            getServiceFieldValue(service?.data?.whatsapp);

        if (phoneNumber && phoneNumber !== 'Non spécifié') {
            const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
            Alert.alert(
                'Appeler le prestataire',
                `Voulez-vous appeler ${nomPrestataire} au ${phoneNumber} ?`,
                [
                    { text: 'Annuler', style: 'cancel' },
                    {
                        text: 'Appeler',
                        onPress: () => {
                            // Ici vous pouvez implémenter l'appel téléphonique
                            Alert.alert('Appel', `Appel vers ${cleanPhone}`);
                        }
                    }
                ]
            );
        } else {
            Alert.alert('Contact', 'Aucun numéro de téléphone disponible pour ce prestataire');
        }
    };

    const handleTyping = (text: string) => {
        setNewMessage(text);

        // Simuler l'indication de frappe
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        if (text.trim()) {
            setIsTyping(true);
            typingTimeoutRef.current = setTimeout(() => {
                setIsTyping(false);
            }, 1000);
        } else {
            setIsTyping(false);
        }
    };

    const handleEmojiClick = (emoji: string) => {
        setNewMessage(prev => prev + emoji);
        setShowEmojiPicker(false);
    };

    const formatMessageTime = (date: Date | string) => {
        try {
            const dateObj = typeof date === 'string' ? new Date(date) : date;
            if (isNaN(dateObj.getTime())) {
                return '--:--';
            }
            return dateObj.toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return '--:--';
        }
    };

    const popularEmojis = ['😊', '😂', '❤️', '👍', '👎', '😍', '🤔', '😢', '😮', '🔥', '💯', '🎉', '👏', '🙏', '💪'];

    // Fonction pour convertir fichier en base64
    const convertFileToBase64 = async (uri: string): Promise<string> => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result as string;
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Erreur conversion base64:', error);
            throw error;
        }
    };

    // Picker d'images
    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets) {
                const images64 = result.assets.map(asset =>
                    asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : ''
                ).filter(img => img);

                setSelectedImages([...selectedImages, ...images64]);
            }
        } catch (error) {
            console.error('Erreur sélection images:', error);
            Alert.alert('Erreur', 'Impossible de charger les images');
        }
    };

    // Picker de fichiers
    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
                multiple: false,
            });

            if (result.type === 'success' || !result.canceled) {
                const file = result.assets ? result.assets[0] : result;
                const base64 = await convertFileToBase64(file.uri);
                setSelectedDocuments([...selectedDocuments, base64]);
            }
        } catch (error) {
            console.error('Erreur sélection fichier:', error);
            Alert.alert('Erreur', 'Impossible de charger le fichier');
        }
    };

    // Enregistrer audio - VERSION ROBUSTE
    const startAudioRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Permission requise', 'Permission microphone nécessaire');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            const { recording: newRecording } = await Audio.Recording.createAsync({
                android: {
                    extension: '.m4a',
                    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                    audioEncoder: Audio.AndroidAudioEncoder.AAC,
                    sampleRate: 44100,
                    numberOfChannels: 2,
                    bitRate: 128000,
                },
                ios: {
                    extension: '.m4a',
                    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
                    audioQuality: Audio.IOSAudioQuality.HIGH,
                    sampleRate: 44100,
                    numberOfChannels: 2,
                    bitRate: 128000,
                    linearPCMBitDepth: 16,
                    linearPCMIsBigEndian: false,
                    linearPCMIsFloat: false,
                },
                web: {
                    mimeType: 'audio/webm',
                    bitsPerSecond: 128000,
                }
            });

            setRecording(newRecording);
            setIsRecording(true);
            setRecordingDuration(0);
        } catch (error) {
            console.error('Erreur enregistrement audio:', error);
            Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement audio');
            setIsRecording(false);
        }
    };

    const stopAudioRecording = async () => {
        if (!recording) return;

        try {
            setIsRecording(false);
            await recording.stopAndUnloadAsync();

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
            });

            const uri = recording.getURI();
            if (uri) {
                const audioBase64 = await convertFileToBase64(uri);
                setSelectedAudio(audioBase64);
                setSelectedAudioUri(uri); // Sauvegarder l'URI pour la lecture
            }
            setRecording(null);
        } catch (error) {
            console.error('Erreur arrêt audio:', error);
            setRecording(null);
        }
    };

    // Fonction pour jouer/arrêter l'audio enregistré
    const togglePlayAudio = async () => {
        try {
            if (isPlayingAudio && audioSound) {
                // Arrêter la lecture
                await audioSound.stopAsync();
                await audioSound.unloadAsync();
                setAudioSound(null);
                setIsPlayingAudio(false);
            } else if (selectedAudioUri) {
                // Démarrer la lecture
                const { sound } = await Audio.Sound.createAsync(
                    { uri: selectedAudioUri },
                    { shouldPlay: true }
                );
                setAudioSound(sound);
                setIsPlayingAudio(true);

                // Arrêter automatiquement quand la lecture est terminée
                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded && status.didJustFinish) {
                        setIsPlayingAudio(false);
                        sound.unloadAsync();
                        setAudioSound(null);
                    }
                });
            }
        } catch (error) {
            console.error('Erreur lecture audio:', error);
            Alert.alert('Erreur', 'Impossible de lire l\'audio');
            setIsPlayingAudio(false);
        }
    };

    // Fonction pour supprimer l'audio
    const deleteAudio = async () => {
        if (audioSound) {
            await audioSound.unloadAsync();
            setAudioSound(null);
        }
        setSelectedAudio(null);
        setSelectedAudioUri(null);
        setIsPlayingAudio(false);
    };

    // Envoyer message avec médias
    const handleSendWithMedia = async () => {
        if (!newMessage.trim() && selectedImages.length === 0 && !selectedAudio && selectedDocuments.length === 0) {
            Alert.alert('Message vide', 'Écrivez un message ou ajoutez un média');
            return;
        }

        const messageData = {
            content: newMessage.trim(),
            images: selectedImages.length > 0 ? selectedImages : undefined,
            audio: selectedAudio || undefined,
            documents: selectedDocuments.length > 0 ? selectedDocuments : undefined,
        };

        await sendMessage(newMessage.trim(), 'text', messageData);

        // Nettoyer l'audio si présent
        if (audioSound) {
            await audioSound.unloadAsync();
            setAudioSound(null);
        }

        // Réinitialiser
        setNewMessage('');
        setSelectedImages([]);
        setSelectedAudio(null);
        setSelectedAudioUri(null);
        setSelectedDocuments([]);
        setIsPlayingAudio(false);
    };

    // Nettoyer l'audio quand le modal se ferme
    useEffect(() => {
        return () => {
            if (audioSound) {
                audioSound.unloadAsync();
            }
        };
    }, [audioSound]);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity style={styles.backButton} onPress={onClose}>
                            <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                        <View style={styles.headerInfo}>
                            <Text style={styles.prestataireName}>{nomPrestataire}</Text>
                            <View style={styles.headerMeta}>
                                <View style={styles.statusIndicator}>
                                    <View style={[
                                        styles.statusDot,
                                        { backgroundColor: isConnected ? modernColors.success : modernColors.textSecondary }
                                    ]} />
                                    <Text style={[
                                        styles.statusText,
                                        { color: isConnected ? modernColors.success : modernColors.textSecondary }
                                    ]}>
                                        {isConnected ? 'En ligne' : 'Hors ligne'}
                                    </Text>
                                </View>
                                <Text style={styles.serviceInfo}>{titreService || 'Service'}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                                setCallType('audio');
                                setShowCallModal(true);
                            }}
                        >
                            <SafeIcon name="phone" size={20} color={modernColors.success} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                                setCallType('video');
                                setShowCallModal(true);
                            }}
                        >
                            <SafeIcon name="video" size={20} color={modernColors.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Messages */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.messagesContainer}
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                >
                    {messages.map((message) => (
                        <View
                            key={message.id}
                            style={[
                                styles.messageContainer,
                                message.from === 'client' ? styles.messageContainerRight : styles.messageContainerLeft
                            ]}
                        >
                            <View style={[
                                styles.messageBubble,
                                message.from === 'client' ? styles.messageBubbleRight : styles.messageBubbleLeft
                            ]}>
                                {editingMessageId === message.id ? (
                                    <View style={styles.editContainer}>
                                        <TextInput
                                            style={styles.editInput}
                                            value={editingContent}
                                            onChangeText={setEditingContent}
                                            multiline
                                            autoFocus
                                        />
                                        <View style={styles.editActions}>
                                            <TouchableOpacity
                                                style={[styles.editButton, styles.saveButton]}
                                                onPress={handleEditMessage}
                                            >
                                                <SafeIcon name="check" size={16} color="#FFFFFF" />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.editButton, styles.cancelEditButton]}
                                                onPress={cancelEditing}
                                            >
                                                <SafeIcon name="x" size={16} color="#FFFFFF" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    <>
                                        {/* ✅ NOUVEAU: Afficher l'image si présente */}
                                        {message.type === 'image' && message.imageUrl && (
                                            <Image
                                                source={{ uri: message.imageUrl }}
                                                style={styles.messageImage}
                                                resizeMode="cover"
                                            />
                                        )}

                                        {/* ✅ NOUVEAU: Afficher l'audio si présent */}
                                        {message.type === 'audio' && message.audioUrl && (
                                            <View style={styles.audioContainer}>
                                                <SafeIcon name="mic" size={20} color={message.from === 'client' ? '#FFFFFF' : modernColors.primary} />
                                                <Text style={[
                                                    styles.audioText,
                                                    message.from === 'client' ? styles.messageTextRight : styles.messageTextLeft
                                                ]}>
                                                    Message vocal
                                                </Text>
                                            </View>
                                        )}

                                        {/* ✅ NOUVEAU: Afficher le fichier si présent */}
                                        {message.type === 'file' && message.fileUrl && (
                                            <View style={styles.fileContainer}>
                                                <SafeIcon name="file" size={20} color={message.from === 'client' ? '#FFFFFF' : modernColors.primary} />
                                                <Text style={[
                                                    styles.fileText,
                                                    message.from === 'client' ? styles.messageTextRight : styles.messageTextLeft
                                                ]}>
                                                    Document
                                                </Text>
                                            </View>
                                        )}

                                        {/* Afficher le texte pour les messages texte ou avec le texte */}
                                        {(message.type === 'text' || (message.content && !message.content.match(/^[📷🎤📎]/))) && (
                                            <Text style={[
                                                styles.messageText,
                                                message.from === 'client' ? styles.messageTextRight : styles.messageTextLeft
                                            ]}>
                                                {message.content}
                                            </Text>
                                        )}

                                        <View style={styles.messageFooter}>
                                            <Text style={[
                                                styles.messageTime,
                                                message.from === 'client' ? styles.messageTimeRight : styles.messageTimeLeft
                                            ]}>
                                                {formatMessageTime(message.timestamp)}
                                                {message.edited && (
                                                    <Text style={styles.editedIndicator}> (modifié)</Text>
                                                )}
                                            </Text>

                                            {message.from === 'client' && message.editable && (
                                                <View style={styles.messageActions}>
                                                    <TouchableOpacity
                                                        style={styles.messageActionButton}
                                                        onPress={() => startEditing(message)}
                                                    >
                                                        <SafeIcon name="edit" size={14} color={modernColors.primary} />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        style={styles.messageActionButton}
                                                        onPress={() => handleDeleteMessage(message.id)}
                                                    >
                                                        <SafeIcon name="trash" size={14} color={modernColors.error} />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    </>
                                )}
                            </View>
                        </View>
                    ))}

                    {prestataireTyping && (
                        <View style={styles.typingContainer}>
                            <View style={styles.typingBubble}>
                                <View style={styles.typingDots}>
                                    <View style={[styles.typingDot, { animationDelay: '0ms' }]} />
                                    <View style={[styles.typingDot, { animationDelay: '150ms' }]} />
                                    <View style={[styles.typingDot, { animationDelay: '300ms' }]} />
                                </View>
                                <Text style={styles.typingText}>En train d'écrire...</Text>
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* Emoji picker */}
                {showEmojiPicker && (
                    <View style={styles.emojiPicker}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.emojiContainer}>
                                {popularEmojis.map((emoji) => (
                                    <TouchableOpacity
                                        key={emoji}
                                        style={styles.emojiButton}
                                        onPress={() => handleEmojiClick(emoji)}
                                    >
                                        <Text style={styles.emojiText}>{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                )}

                {/* Input */}
                <View style={styles.inputContainer}>
                    {/* Preview des médias sélectionnés */}
                    {(selectedImages.length > 0 || selectedAudio || selectedDocuments.length > 0) && (
                        <ScrollView horizontal style={styles.mediaPreviewContainer} showsHorizontalScrollIndicator={false}>
                            {/* Images */}
                            {selectedImages.map((img, idx) => (
                                <View key={idx} style={styles.mediaPreviewItem}>
                                    <Image source={{ uri: img }} style={styles.previewImage} />
                                    <TouchableOpacity
                                        style={styles.removeMediaButton}
                                        onPress={() => setSelectedImages(selectedImages.filter((_, i) => i !== idx))}
                                    >
                                        <Text style={styles.removeMediaText}>×</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}

                            {/* Audio */}
                            {selectedAudio && (
                                <View style={styles.mediaPreviewItem}>
                                    <View style={styles.audioPreview}>
                                        <TouchableOpacity
                                            style={styles.playAudioButton}
                                            onPress={togglePlayAudio}
                                        >
                                            <SafeIcon
                                                name={isPlayingAudio ? "pause" : "play"}
                                                size={24}
                                                color="#FFFFFF"
                                            />
                                        </TouchableOpacity>
                                        <View style={styles.audioInfo}>
                                            <SafeIcon name="mic" size={16} color="#FFFFFF" />
                                            <Text style={styles.audioPreviewText}>
                                                {isPlayingAudio ? 'En lecture...' : 'Audio enregistré'}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.removeMediaButton}
                                        onPress={deleteAudio}
                                    >
                                        <SafeIcon name="trash-2" size={12} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Documents */}
                            {selectedDocuments.map((doc, idx) => (
                                <View key={idx} style={styles.mediaPreviewItem}>
                                    <View style={styles.documentPreview}>
                                        <SafeIcon name="file" size={20} color="#FFFFFF" />
                                        <Text style={styles.audioPreviewText}>Doc</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.removeMediaButton}
                                        onPress={() => setSelectedDocuments(selectedDocuments.filter((_, i) => i !== idx))}
                                    >
                                        <Text style={styles.removeMediaText}>×</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    {/* Boutons d'actions média */}
                    <View style={styles.mediaActionsRow}>
                        <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
                            <SafeIcon name="image" size={22} color={modernColors.primary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.mediaButton, isRecording && styles.mediaButtonActive]}
                            onPress={isRecording ? stopAudioRecording : startAudioRecording}
                        >
                            <SafeIcon name={isRecording ? "stop-circle" : "mic"} size={22} color={isRecording ? "#EF4444" : modernColors.primary} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.mediaButton} onPress={pickDocument}>
                            <SafeIcon name="file" size={22} color={modernColors.primary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.mediaButton}
                            onPress={() => setShowMediaGallery(true)}
                        >
                            <SafeIcon name="folder-open" size={22} color={modernColors.primary} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputRow}>
                        <TouchableOpacity
                            style={styles.emojiButton}
                            onPress={() => setShowEmojiPicker(!showEmojiPicker)}
                        >
                            <SafeIcon name="smile" size={20} color={modernColors.textSecondary} />
                        </TouchableOpacity>

                        <TextInput
                            style={styles.textInput}
                            value={newMessage}
                            onChangeText={handleTyping}
                            placeholder="Tapez votre message..."
                            placeholderTextColor={modernColors.textSecondary}
                            multiline
                            maxLength={500}
                        />

                        <TouchableOpacity
                            style={[
                                styles.sendButton,
                                (!newMessage.trim() && selectedImages.length === 0 && !selectedAudio) && styles.sendButtonDisabled
                            ]}
                            onPress={handleSendWithMedia}
                            disabled={!newMessage.trim() && selectedImages.length === 0 && !selectedAudio}
                        >
                            <SafeIcon name="send" size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputFooter}>
                        <View style={styles.connectionStatus}>
                            <View style={[
                                styles.connectionDot,
                                { backgroundColor: isConnected ? modernColors.success : modernColors.textSecondary }
                            ]} />
                            <Text style={styles.connectionText}>
                                {isConnected ? 'Connexion sécurisée' : 'Mode hors ligne'}
                            </Text>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* Modal de galerie média du prestataire */}
            <ServiceMediaGallery
                visible={showMediaGallery}
                onClose={() => setShowMediaGallery(false)}
                service={service}
                prestataireInfo={prestataireInfo}
            />

            {/* Modal d'appel interne (audio/vidéo) */}
            <InAppCallModal
                visible={showCallModal}
                onClose={() => setShowCallModal(false)}
                callType={callType}
                recipientName={nomPrestataire}
                recipientId={prestataireInfo?.userId || ''}
                currentUserId={user?.id || ''}
                serviceId={service?.id}
            />
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    headerInfo: {
        flex: 1,
    },
    prestataireName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    headerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '500',
    },
    serviceInfo: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        padding: 8,
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 20,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 16,
    },
    messageContainer: {
        marginBottom: 12,
    },
    messageContainerLeft: {
        alignItems: 'flex-start',
    },
    messageContainerRight: {
        alignItems: 'flex-end',
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
    },
    messageBubbleLeft: {
        backgroundColor: modernColors.surface,
        borderBottomLeftRadius: 4,
    },
    messageBubbleRight: {
        backgroundColor: modernColors.primary,
        borderBottomRightRadius: 4,
    },
    messageText: {
        fontSize: 16,
        lineHeight: 20,
    },
    messageTextLeft: {
        color: modernColors.text,
    },
    messageTextRight: {
        color: '#FFFFFF',
    },
    messageFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
    },
    messageTime: {
        fontSize: 11,
        opacity: 0.7,
    },
    messageTimeLeft: {
        color: modernColors.textSecondary,
    },
    messageTimeRight: {
        color: '#FFFFFF',
    },
    editedIndicator: {
        fontStyle: 'italic',
    },
    messageActions: {
        flexDirection: 'row',
        gap: 8,
        marginLeft: 8,
    },
    messageActionButton: {
        padding: 4,
    },
    editContainer: {
        gap: 8,
    },
    editInput: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 8,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
    },
    editActions: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'flex-end',
    },
    editButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    saveButton: {
        backgroundColor: modernColors.success,
    },
    cancelEditButton: {
        backgroundColor: modernColors.error,
    },
    typingContainer: {
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    typingBubble: {
        backgroundColor: modernColors.surface,
        padding: 12,
        borderRadius: 16,
        borderBottomLeftRadius: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    typingDots: {
        flexDirection: 'row',
        gap: 4,
    },
    typingDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: modernColors.textSecondary,
        // Animation sera ajoutée via Animated API si nécessaire
    },
    typingText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    emojiPicker: {
        backgroundColor: modernColors.surface,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        paddingVertical: 8,
    },
    emojiContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 8,
    },
    emojiButton: {
        padding: 8,
        borderRadius: 8,
    },
    emojiText: {
        fontSize: 24,
    },
    inputContainer: {
        backgroundColor: modernColors.surface,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    textInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: modernColors.surfaceVariant,
        maxHeight: 100,
    },
    sendButton: {
        backgroundColor: modernColors.primary,
        borderRadius: 20,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 40,
        minHeight: 40,
    },
    sendButtonDisabled: {
        backgroundColor: modernColors.textSecondary,
        opacity: 0.5,
    },
    inputFooter: {
        marginTop: 8,
    },
    connectionStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    connectionDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    connectionText: {
        fontSize: 11,
        color: modernColors.textSecondary,
    },
    mediaPreviewContainer: {
        paddingVertical: 12,
        paddingHorizontal: 8,
        gap: 8,
    },
    mediaPreviewItem: {
        position: 'relative',
        marginRight: 8,
    },
    previewImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
    },
    audioPreview: {
        width: 140,
        height: 80,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    playAudioButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    audioInfo: {
        flex: 1,
        marginLeft: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    audioPreviewText: {
        fontSize: 9,
        color: '#FFFFFF',
        marginTop: 4,
        textAlign: 'center',
    },
    documentPreview: {
        width: 80,
        height: 80,
        borderRadius: 12,
        backgroundColor: '#F59E0B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeMediaButton: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: modernColors.error,
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeMediaText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    mediaActionsRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 8,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    mediaButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: modernColors.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
    },
    callButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    callButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaButtonActive: {
        backgroundColor: '#FEE2E2',
    },
    recordingTime: {
        position: 'absolute',
        bottom: -16,
        fontSize: 10,
        color: '#EF4444',
        fontWeight: 'bold',
    },
    // ✅ NOUVEAU: Styles pour les médias dans les messages
    messageImage: {
        width: 200,
        height: 150,
        borderRadius: 12,
        marginBottom: 8,
    },
    audioContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    audioText: {
        fontSize: 14,
        fontWeight: '500',
    },
    fileContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    fileText: {
        fontSize: 14,
        fontWeight: '500',
    },
});

export default ChatModalMobile;
