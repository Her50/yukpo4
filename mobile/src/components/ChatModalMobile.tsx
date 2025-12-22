import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Linking,
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
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import FindCourierModal from './delivery/FindCourierModal';
import InAppCallModal from './InAppCallModal';
import PriceNegotiationModal from '../legacy/components/TransportIntraUrbain/PriceNegotiationModal';
import ProductGalleryPickerModal from './ProductGalleryPickerModal';
import SafeIcon from './SafeIcon';
import UserMentionPicker from './UserMentionPicker';

interface ChatModalMobileProps {
    visible: boolean;
    onClose: () => void;
    service: any;
    prestataireInfo: any;
    user: any;
}

interface Participant {
    user_id: number;
    user_name: string;
    user_email: string;
    user_avatar?: string;
    role: string;
    invited_by?: number;
    joined_at: string;
    can_remove: boolean;
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

    // ✅ NOUVEAU: États pour @mention
    const [showMentionPicker, setShowMentionPicker] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const [mentionedUsers, setMentionedUsers] = useState<number[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [showParticipantsList, setShowParticipantsList] = useState(false);

    // États pour les médias
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
    const [selectedAudioUri, setSelectedAudioUri] = useState<string | null>(null);
    const [selectedDocuments, setSelectedDocuments] = useState<Array<{ base64: string; name: string; size?: number }>>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [showProductGalleryPicker, setShowProductGalleryPicker] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [audioSound, setAudioSound] = useState<Audio.Sound | null>(null);

    // ✅ NOUVEAU: États pour le système de réponse/citation
    const [replyingTo, setReplyingTo] = useState<any | null>(null);

    // États pour les appels internes
    const [showCallModal, setShowCallModal] = useState(false);
    const [callType, setCallType] = useState<'audio' | 'video'>('audio');
    
    // État pour le modal de recherche de coursier
    const [showFindCourierModal, setShowFindCourierModal] = useState(false);
    
    // État pour le modal de négociation de prix
    const [showNegotiationModal, setShowNegotiationModal] = useState(false);

    const scrollViewRef = useRef<any>(null);
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

    // ✅ CORRIGÉ: Extraire le nom réel du prestataire (nom_complet en priorité, puis name, puis nom)
    const nomPrestataire = prestataireInfo?.nom_complet || prestataireInfo?.name || prestataireInfo?.nom || `Prestataire #${service?.user_id || ''}`;
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
            loadParticipants();
        }
    }, [visible, markAsRead]);

    // ✅ NOUVEAU: Charger les participants de la conversation
    const loadParticipants = async () => {
        if (!service?.id) return;

        try {
            const response = await apiGet<Participant[]>(`/api/conversations/${service.id}/participants`);
            if (response.success && response.data) {
                setParticipants(response.data);
                console.log('[ChatModalMobile] Participants chargés:', response.data);
            }
        } catch (error) {
            console.error('[ChatModalMobile] Erreur chargement participants:', error);
        }
    };

    // ✅ NOUVEAU: Inviter un utilisateur dans la conversation
    const inviteUser = async (userId: number, context?: string) => {
        if (!service?.id) return;

        try {
            const response = await apiPost(`/api/conversations/${service.id}/invite`, {
                user_id: userId,
                context
            });

            if (response.success) {
                Alert.alert(
                    'Utilisateur invité',
                    'L\'utilisateur a été ajouté à la conversation et peut maintenant voir les nouveaux messages.',
                    [{ text: 'OK' }]
                );
                loadParticipants(); // Recharger la liste
            }
        } catch (error) {
            console.error('[ChatModalMobile] Erreur invitation:', error);
            Alert.alert('Erreur', 'Impossible d\'inviter cet utilisateur');
        }
    };

    // ✅ NOUVEAU: Retirer un participant
    const removeParticipant = async (userId: number) => {
        if (!service?.id) return;

        Alert.alert(
            'Retirer le participant',
            'Êtes-vous sûr de vouloir retirer cette personne de la conversation ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Retirer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiPost(`/api/conversations/${service.id}/participants/${userId}`, {});
                            loadParticipants();
                            Alert.alert('Succès', 'Participant retiré de la conversation');
                        } catch (error) {
                            console.error('[ChatModalMobile] Erreur retrait participant:', error);
                            Alert.alert('Erreur', 'Impossible de retirer ce participant');
                        }
                    }
                }
            ]
        );
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;

        // ✅ NOUVEAU: Envoyer avec les IDs des utilisateurs mentionnés et le message cité
        await sendMessage(newMessage.trim(), 'text', {
            mentioned_users: mentionedUsers.length > 0 ? mentionedUsers : undefined,
            reply_to_id: replyingTo?.id || undefined,
            reply_to: replyingTo ? {
                id: replyingTo.id,
                sender_name: replyingTo.sender_name,
                content: replyingTo.content,
                content_type: replyingTo.content_type,
                imageUrl: replyingTo.imageUrl,
                audioUrl: replyingTo.audioUrl,
                fileUrl: replyingTo.fileUrl
            } : undefined
        });

        setNewMessage('');
        setShowEmojiPicker(false);
        setMentionedUsers([]); // Réinitialiser les mentions
        setReplyingTo(null); // ✅ Réinitialiser la réponse APRÈS l'envoi
    };

    const handleEditMessage = async () => {
        if (!editingContent.trim() || !editingMessageId) return;

        await editMessage(editingMessageId, editingContent.trim());
        setEditingMessageId(null);
        setEditingContent('');
    };

    // ✅ NOUVEAU: Handler pour envoyer des médias sélectionnés de la galerie
    const handleSelectGalleryMedia = (selectedUrls: string[]) => {
        if (selectedUrls.length === 0) return;

        // Ajouter les URLs sélectionnées aux images
        setSelectedImages([...selectedImages, ...selectedUrls]);
        console.log('[ChatModal] Médias de la galerie ajoutés:', selectedUrls.length);
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

    const handleTyping = (text: string, cursorPos?: number) => {
        setNewMessage(text);
        if (cursorPos !== undefined) setCursorPosition(cursorPos);

        // ✅ NOUVEAU: Détecter le @ pour ouvrir le mention picker
        const lastAtIndex = text.lastIndexOf('@');
        if (lastAtIndex !== -1 && (cursorPos === undefined || cursorPos > lastAtIndex)) {
            // Extraire le texte après le @
            const query = text.substring(lastAtIndex + 1, cursorPos || text.length);

            // Si pas d'espace après le @, c'est une mention en cours
            if (!query.includes(' ')) {
                setMentionQuery(query);
                setShowMentionPicker(true);
                console.log('[ChatModalMobile] @ détecté, query:', query);
            } else {
                setShowMentionPicker(false);
            }
        } else {
            setShowMentionPicker(false);
        }

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

    // ✅ NOUVEAU: Insérer une mention dans le message
    const insertMention = (user: any) => {
        const lastAtIndex = newMessage.lastIndexOf('@');
        if (lastAtIndex === -1) return;

        // Remplacer le @ et le query par @nom_utilisateur
        const before = newMessage.substring(0, lastAtIndex);
        const mention = `@${user.nom_complet} `;
        const after = newMessage.substring(cursorPosition);

        const newText = before + mention + after;
        setNewMessage(newText);

        // Ajouter l'ID à la liste des mentions
        if (!mentionedUsers.includes(user.id)) {
            setMentionedUsers([...mentionedUsers, user.id]);
        }

        // Inviter l'utilisateur dans la conversation
        inviteUser(user.id, 'mention');

        setShowMentionPicker(false);
        setMentionQuery('');
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

    // Fonction pour convertir fichier en base64 (React Native compatible)
    const convertFileToBase64 = async (uri: string): Promise<string> => {
        try {
            // Utiliser FileSystem d'Expo pour React Native
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            // Déterminer le type MIME basé sur l'extension
            const extension = uri.split('.').pop()?.toLowerCase();
            let mimeType = 'application/octet-stream';

            switch (extension) {
                case 'pdf':
                    mimeType = 'application/pdf';
                    break;
                case 'doc':
                case 'docx':
                    mimeType = 'application/msword';
                    break;
                case 'xls':
                case 'xlsx':
                    mimeType = 'application/vnd.ms-excel';
                    break;
                case 'txt':
                    mimeType = 'text/plain';
                    break;
                case 'jpg':
                case 'jpeg':
                    mimeType = 'image/jpeg';
                    break;
                case 'png':
                    mimeType = 'image/png';
                    break;
                case 'mp3':
                    mimeType = 'audio/mpeg';
                    break;
                case 'mp4':
                    mimeType = 'video/mp4';
                    break;
            }

            return `data:${mimeType};base64,${base64}`;
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

    // Picker de fichiers (UNIQUEMENT doc, pdf, excel - PAS d'images)
    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'application/vnd.ms-excel',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'text/plain'
                ],
                copyToCacheDirectory: true,
                multiple: false,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];

                // Vérifier la taille du fichier (max 10MB)
                if (file.size && file.size > 10 * 1024 * 1024) {
                    Alert.alert('Fichier trop volumineux', 'La taille maximale est de 10MB');
                    return;
                }

                const base64 = await convertFileToBase64(file.uri);
                setSelectedDocuments([...selectedDocuments, { base64, name: file.name || 'document', size: file.size }]);
                console.log('[ChatModal] Fichier sélectionné:', file.name, `(${(file.size / 1024).toFixed(2)} KB)`);
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
            documents: selectedDocuments.length > 0 ? selectedDocuments.map(doc => doc.base64) : undefined,
            mentioned_users: mentionedUsers.length > 0 ? mentionedUsers : undefined,
            reply_to_id: replyingTo?.id || undefined,
            reply_to: replyingTo ? {
                id: replyingTo.id,
                sender_name: replyingTo.sender_name,
                content: replyingTo.content,
                content_type: replyingTo.content_type,
                imageUrl: replyingTo.imageUrl,
                audioUrl: replyingTo.audioUrl,
                fileUrl: replyingTo.fileUrl
            } : undefined
        };

        // ✅ CORRIGÉ: Détecter automatiquement le type de message
        const messageType = selectedImages.length > 0 ? 'image' :
            selectedAudio ? 'audio' :
                selectedDocuments.length > 0 ? 'file' : 'text';

        await sendMessage(newMessage.trim() || '', messageType, messageData);

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
        setMentionedUsers([]); // ✅ Réinitialiser les mentions
        setReplyingTo(null); // ✅ Réinitialiser la réponse
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
                    {/* Première ligne : Bouton retour + Nom + Actions */}
                    <View style={styles.headerTop}>
                        <View style={styles.headerLeft}>
                            <TouchableOpacity style={styles.backButton} onPress={onClose}>
                                <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                            <View style={styles.headerInfo}>
                                <Text style={styles.prestataireName} numberOfLines={1}>{nomPrestataire}</Text>
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
                            </View>
                        </View>

                        <View style={styles.headerActions}>
                            {/* ✅ NOUVEAU: Bouton WhatsApp (prioritaire si disponible) */}
                            {(prestataireInfo?.whatsapp || service?.data?.whatsapp?.valeur || service?.data?.whatsapp || prestataireInfo?.telephone) && (
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.whatsappButton]}
                                    onPress={async () => {
                                        const whatsappNumber = prestataireInfo?.whatsapp ||
                                            service?.data?.whatsapp?.valeur ||
                                            service?.data?.whatsapp ||
                                            prestataireInfo?.telephone;

                                        if (!whatsappNumber) {
                                            Alert.alert('WhatsApp', 'Numéro WhatsApp non disponible');
                                            return;
                                        }

                                        try {
                                            const phoneNumber = whatsappNumber.replace(/\s+/g, '').replace(/\+/g, '');
                                            const serviceName = titreService || 'votre service';
                                            const message = encodeURIComponent(`Bonjour ${nomPrestataire}, je souhaite discuter de ${serviceName}.`);
                                            const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${message}`;

                                            const canOpen = await Linking.canOpenURL(whatsappUrl);
                                            if (canOpen) {
                                                await Linking.openURL(whatsappUrl);
                                            } else {
                                                Alert.alert('WhatsApp', 'WhatsApp n\'est pas installé sur cet appareil');
                                            }
                                        } catch (error) {
                                            console.error('Erreur ouverture WhatsApp:', error);
                                            Alert.alert('Erreur', 'Impossible d\'ouvrir WhatsApp');
                                        }
                                    }}
                                >
                                    {/* Logo WhatsApp officiel */}
                                    <View style={styles.whatsappIconContainer}>
                                        <Text style={styles.whatsappIcon}>📱</Text>
                                    </View>
                                    <View style={styles.whatsappBadge}>
                                        <Text style={styles.whatsappBadgeText}>WA</Text>
                                    </View>
                                </TouchableOpacity>
                            )}

                            {/* ✅ Bouton liste des participants */}
                            <TouchableOpacity
                                style={[styles.actionButton, participants.length > 2 && styles.actionButtonHighlight]}
                                onPress={() => setShowParticipantsList(true)}
                            >
                                <SafeIcon name="users" size={20} color={participants.length > 2 ? modernColors.primary : modernColors.text} />
                                {participants.length > 2 && (
                                    <View style={styles.participantsBadge}>
                                        <Text style={styles.participantsBadgeText}>{participants.length}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

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

                            {/* ✅ REFACTORISÉ: Bouton Me livrer - Toujours visible si service valide */}
                            {(() => {
                                // ✅ SIMPLIFIÉ: Afficher le bouton si on a un service valide
                                // Vérifier plusieurs sources pour les produits
                                const hasProducts = !!(
                                    service?.data?.produits ||
                                    service?.produits ||
                                    (service?.id || service?.service_id)
                                );
                                
                                // Exclure uniquement les services/prestations
                                const isServiceType = service?.data?.type === 'prestation_service' || 
                                                     service?.data?.type === 'service' ||
                                                     service?.type === 'prestation_service' ||
                                                     service?.type === 'service';
                                
                                const shouldShow = hasProducts && !isServiceType;
                                
                                if (__DEV__) {
                                    console.log('[ChatModalMobile] Bouton "Me livrer" - Évaluation:', {
                                        hasProducts,
                                        isServiceType,
                                        shouldShow,
                                        serviceId: service?.id || service?.service_id,
                                        serviceType: service?.data?.type || service?.type
                                    });
                                }
                                
                                return shouldShow;
                            })() && (
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.deliveryButton]}
                                    onPress={() => {
                                        // Vérifier qu'on a bien un produit avant d'ouvrir le modal
                                        const product = service?.data?.produits?.[0] || service?.produits?.[0];
                                        if (!product && !service?.id && !service?.service_id) {
                                            Alert.alert('Erreur', 'Produit non disponible pour la livraison');
                                            return;
                                        }
                                        setShowFindCourierModal(true);
                                    }}
                                >
                                    <SafeIcon name="truck" size={20} color="#10B981" />
                                    <Text style={styles.deliveryButtonText}>Me livrer</Text>
                                </TouchableOpacity>
                            )}

                            {/* ✅ NOUVEAU: Bouton Négociation de prix */}
                            {service?.data?.produits && service.data.produits.length > 0 && service.data.produits[0]?.prix && (
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.negotiationButton]}
                                    onPress={() => setShowNegotiationModal(true)}
                                >
                                    <SafeIcon name="dollar-sign" size={20} color="#F59E0B" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Deuxième ligne : Titre du service (toujours visible) */}
                    <View style={styles.headerBottom}>
                        <Text style={styles.serviceInfo} numberOfLines={1}>{titreService || 'Service'}</Text>
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

                                        {/* ✅ NOUVEAU: Afficher le message cité si présent */}
                                        {message.reply_to && (
                                            <View style={styles.quotedMessage}>
                                                <View style={styles.quotedMessageBar} />
                                                <View style={styles.quotedMessageContent}>
                                                    <Text style={styles.quotedMessageAuthor}>
                                                        {message.reply_to.sender_name || 'Message'}
                                                    </Text>
                                                    <Text style={styles.quotedMessageText} numberOfLines={2}>
                                                        {message.reply_to.content_type === 'text' && message.reply_to.content}
                                                        {message.reply_to.content_type === 'audio' && '🎤 Message audio'}
                                                        {message.reply_to.content_type === 'image' && '🖼️ Image'}
                                                        {message.reply_to.content_type === 'file' && '📄 Fichier'}
                                                        {message.reply_to.content_type === 'video' && '🎥 Vidéo'}
                                                    </Text>
                                                </View>
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

                                        {/* ✅ NOUVEAU: Bouton "Me livrer" dans les messages si produit mentionné */}
                                        {(() => {
                                            // Détecter si le message mentionne un produit ou contient des métadonnées produit
                                            const hasProductMetadata = message.metadata?.product_id || 
                                                                      message.metadata?.product_index ||
                                                                      message.metadata?.service_id;
                                            
                                            // Vérifier aussi si le service a des produits
                                            const serviceHasProducts = !!(service?.data?.produits || service?.produits);
                                            
                                            // Afficher le bouton si on a des métadonnées produit OU si le service a des produits
                                            const shouldShowDeliveryButton = (hasProductMetadata || serviceHasProducts) && 
                                                                             message.from === 'prestataire'; // Seulement pour les messages du prestataire
                                            
                                            return shouldShowDeliveryButton;
                                        })() && (
                                            <TouchableOpacity
                                                style={styles.messageDeliveryButton}
                                                onPress={() => {
                                                    // Récupérer le produit depuis les métadonnées ou le service
                                                    const productFromMetadata = message.metadata?.product_id ? {
                                                        service_id: message.metadata.service_id || service?.id || service?.service_id,
                                                        product_index: message.metadata.product_index || 0,
                                                        ...message.metadata
                                                    } : null;
                                                    
                                                    const product = productFromMetadata || 
                                                                    service?.data?.produits?.[0] || 
                                                                    service?.produits?.[0];
                                                    
                                                    if (!product && !service?.id && !service?.service_id) {
                                                        Alert.alert('Erreur', 'Produit non disponible pour la livraison');
                                                        return;
                                                    }
                                                    
                                                    setShowFindCourierModal(true);
                                                }}
                                                activeOpacity={0.8}
                                            >
                                                <SafeIcon name="truck" size={16} color="#FFFFFF" />
                                                <Text style={styles.messageDeliveryButtonText}>Me livrer</Text>
                                            </TouchableOpacity>
                                        )}

                                        <View style={styles.messageFooter}>
                                            <View style={styles.messageFooterLeft}>
                                                <Text style={[
                                                    styles.messageTime,
                                                    message.from === 'client' ? styles.messageTimeRight : styles.messageTimeLeft
                                                ]}>
                                                    {formatMessageTime(message.timestamp)}
                                                    {message.edited && (
                                                        <Text style={styles.editedIndicator}> (modifié)</Text>
                                                    )}
                                                </Text>

                                                {/* ✅ NOUVEAU: Bouton Répondre (toujours visible) */}
                                                <TouchableOpacity
                                                    style={styles.replyButton}
                                                    onPress={() => setReplyingTo({
                                                        id: message.id,
                                                        sender_name: message.from === 'client' ? user?.name : nomPrestataire,
                                                        content: message.content,
                                                        content_type: message.type || 'text',
                                                        imageUrl: message.imageUrl,
                                                        audioUrl: message.audioUrl,
                                                        fileUrl: message.fileUrl
                                                    })}
                                                >
                                                    <SafeIcon name="corner-down-left" size={14} color={modernColors.textSecondary} />
                                                    <Text style={styles.replyButtonText}>Répondre</Text>
                                                </TouchableOpacity>
                                            </View>

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
                                    <View style={styles.typingDot} />
                                    <View style={styles.typingDot} />
                                    <View style={styles.typingDot} />
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
                                        <SafeIcon name="file-text" size={20} color="#FFFFFF" />
                                        <Text style={styles.audioPreviewText} numberOfLines={1}>{doc.name}</Text>
                                        {doc.size && (
                                            <Text style={styles.documentSize}>{(doc.size / 1024).toFixed(0)} KB</Text>
                                        )}
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
                            <SafeIcon name="file-text" size={22} color={modernColors.primary} />
                        </TouchableOpacity>

                        {/* ✅ Bouton galerie de produits/service */}
                        <TouchableOpacity
                            style={styles.mediaButton}
                            onPress={() => setShowProductGalleryPicker(true)}
                        >
                            <SafeIcon name="folder-open" size={22} color="#8B5CF6" />
                        </TouchableOpacity>
                    </View>

                    {/* ✅ NOUVEAU: Bandeau de citation quand on répond à un message */}
                    {replyingTo && (
                        <View style={styles.replyBanner}>
                            <View style={styles.replyContent}>
                                <View style={styles.replyHeader}>
                                    <SafeIcon name="corner-down-right" size={16} color={modernColors.primary} />
                                    <Text style={styles.replyLabel}>
                                        Réponse à {replyingTo.sender_name || 'Message'}
                                    </Text>
                                </View>
                                <Text style={styles.replyText} numberOfLines={2}>
                                    {replyingTo.content_type === 'text' && replyingTo.content}
                                    {replyingTo.content_type === 'audio' && '🎤 Message audio'}
                                    {replyingTo.content_type === 'image' && '🖼️ Image'}
                                    {replyingTo.content_type === 'file' && '📄 Fichier'}
                                    {replyingTo.content_type === 'video' && '🎥 Vidéo'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setReplyingTo(null)}
                                style={styles.replyCloseButton}
                            >
                                <SafeIcon name="x" size={18} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}

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
                            onChangeText={(text) => handleTyping(text, cursorPosition)}
                            onSelectionChange={(event) => {
                                const position = event.nativeEvent.selection.start;
                                setCursorPosition(position);
                                handleTyping(newMessage, position);
                            }}
                            placeholder={replyingTo ? "Tapez votre réponse..." : "Tapez votre message... (@ pour mentionner)"}
                            placeholderTextColor={modernColors.textSecondary}
                            multiline
                            maxLength={500}
                        />

                        <TouchableOpacity
                            style={[
                                styles.sendButton,
                                (!newMessage.trim() && selectedImages.length === 0 && !selectedAudio && selectedDocuments.length === 0) && styles.sendButtonDisabled
                            ]}
                            onPress={handleSendWithMedia}
                            disabled={!newMessage.trim() && selectedImages.length === 0 && !selectedAudio && selectedDocuments.length === 0}
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

            {/* ✅ Modal de sélection de médias de la galerie produit */}
            <ProductGalleryPickerModal
                visible={showProductGalleryPicker}
                onClose={() => setShowProductGalleryPicker(false)}
                service={service}
                onSelectMedia={handleSelectGalleryMedia}
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

            {/* ✅ NOUVEAU: Modal pour @mention */}
            <UserMentionPicker
                visible={showMentionPicker}
                onClose={() => setShowMentionPicker(false)}
                onSelectUser={insertMention}
                currentQuery={mentionQuery}
            />

            {/* ✅ NOUVEAU: Modal liste des participants */}
            <Modal
                visible={showParticipantsList}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowParticipantsList(false)}
            >
                <View style={styles.participantsOverlay}>
                    <View style={styles.participantsContainer}>
                        <View style={styles.participantsHeader}>
                            <Text style={styles.participantsTitle}>
                                👥 Participants ({participants.length})
                            </Text>
                            <TouchableOpacity onPress={() => setShowParticipantsList(false)}>
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.participantsList}>
                            {participants.map((participant) => (
                                <View key={participant.user_id} style={styles.participantItem}>
                                    <View style={styles.participantInfo}>
                                        <View style={styles.participantAvatar}>
                                            {participant.user_avatar ? (
                                                <Image
                                                    source={{ uri: participant.user_avatar }}
                                                    style={styles.participantAvatarImage}
                                                />
                                            ) : (
                                                <View style={styles.participantAvatarPlaceholder}>
                                                    <Text style={styles.participantAvatarText}>
                                                        {participant.user_name.charAt(0).toUpperCase()}
                                                    </Text>
                                                </View>
                                            )}
                                            {participant.role === 'owner' && (
                                                <View style={styles.ownerBadge}>
                                                    <SafeIcon name="star" size={10} color="#FFD700" />
                                                </View>
                                            )}
                                        </View>
                                        <View style={styles.participantDetails}>
                                            <Text style={styles.participantName}>{participant.user_name}</Text>
                                            <Text style={styles.participantRole}>
                                                {participant.role === 'owner' ? '👑 Propriétaire' :
                                                    participant.invited_by ? '👤 Invité' : '👥 Participant'}
                                            </Text>
                                        </View>
                                    </View>

                                    {participant.can_remove && participant.user_id !== user?.id && (
                                        <TouchableOpacity
                                            style={styles.removeParticipantButton}
                                            onPress={() => removeParticipant(participant.user_id)}
                                        >
                                            <SafeIcon name="user-minus" size={18} color={modernColors.error} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ))}
                        </ScrollView>

                        <View style={styles.participantsFooter}>
                            <TouchableOpacity
                                style={[styles.addParticipantButton, styles.addMemberButton]}
                                onPress={() => {
                                    setShowParticipantsList(false);
                                    setShowMentionPicker(true);
                                }}
                            >
                                <View style={styles.addMemberIconContainer}>
                                    <SafeIcon name="user-plus" size={18} color="#FFFFFF" />
                                    <View style={styles.addMemberPlus}>
                                        <Text style={styles.addMemberPlusText}>+</Text>
                                    </View>
                                </View>
                                <Text style={styles.addParticipantText}>Inviter quelqu'un</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ✅ REFACTORISÉ: Modal de recherche de coursier - Gestion améliorée */}
            {(() => {
                // Récupérer le produit depuis différentes sources
                const product = service?.data?.produits?.[0] || service?.produits?.[0];
                const serviceId = service?.id || service?.service_id;
                
                // Si pas de produit mais qu'on a un service, créer un produit minimal
                const productForDelivery = product || (serviceId ? {
                    service_id: serviceId,
                    product_index: 0,
                    nom: titreService || 'Produit',
                    prix: service?.data?.produits?.[0]?.prix || service?.produits?.[0]?.prix,
                } : null);
                
                return productForDelivery && serviceId;
            })() && (
                <FindCourierModal
                    visible={showFindCourierModal}
                    onClose={() => setShowFindCourierModal(false)}
                    product={service?.data?.produits?.[0] || service?.produits?.[0] || {
                        service_id: service?.id || service?.service_id,
                        product_index: 0,
                        nom: titreService || 'Produit',
                    }}
                    service={service}
                    onSuccess={(deliveryId) => {
                        Alert.alert('✅ Livraison créée', 'Votre demande de livraison a été créée avec succès');
                        setShowFindCourierModal(false);
                    }}
                />
            )}

            {/* ✅ NOUVEAU: Modal de négociation de prix */}
            {service?.data?.produits && service.data.produits.length > 0 && (
                <PriceNegotiationModal
                    visible={showNegotiationModal}
                    onClose={() => setShowNegotiationModal(false)}
                    driverName={nomPrestataire}
                    driverId={String(prestataireInfo?.userId || prestataireInfo?.id || service?.user_id || '')}
                    initialPrice={service.data.produits[0]?.prix ? parseFloat(service.data.produits[0].prix) : undefined}
                    distance={0} // TODO: Calculer la distance réelle si nécessaire
                    onPriceAccepted={(finalPrice) => {
                        Alert.alert('✅ Prix accepté', `Le prix de ${finalPrice} FCFA a été accepté !`);
                        setShowNegotiationModal(false);
                    }}
                    userRole="client"
                />
            )}
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    headerBottom: {
        paddingLeft: 48, // Aligné avec le nom (après le bouton retour)
        paddingRight: 40, // Espace pour ne pas être caché par les boutons
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
        fontSize: 13,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        padding: 8,
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 20,
        position: 'relative',
    },
    actionButtonHighlight: {
        backgroundColor: modernColors.primary + '20', // 20% opacity
    },
    negotiationButton: {
        backgroundColor: '#FEF3C7',
    },
    deliveryButton: {
        backgroundColor: '#10B981' + '20', // 20% opacity pour le bouton livraison
    },
    deliveryButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#10B981',
        marginLeft: 4,
    },
    messageDeliveryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#10B981',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginTop: 8,
        marginBottom: 4,
    },
    messageDeliveryButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    participantsBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: modernColors.primary,
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    participantsBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    whatsappButton: {
        backgroundColor: '#E8F5E9',
        borderWidth: 2,
        borderColor: '#25D366',
    },
    whatsappIconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#25D366',
        justifyContent: 'center',
        alignItems: 'center',
    },
    whatsappIcon: {
        fontSize: 16,
        color: '#FFFFFF',
    },
    whatsappBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        backgroundColor: '#25D366',
        borderRadius: 8,
        paddingHorizontal: 4,
        paddingVertical: 1,
        minWidth: 18,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    whatsappBadgeText: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    addMemberButton: {
        backgroundColor: '#3B82F6',
        borderWidth: 2,
        borderColor: '#1D4ED8',
    },
    addMemberIconContainer: {
        position: 'relative',
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addMemberPlus: {
        position: 'absolute',
        top: -2,
        right: -2,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFFFFF',
    },
    addMemberPlusText: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#FFFFFF',
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
        padding: 4,
    },
    documentSize: {
        fontSize: 8,
        color: '#FFFFFF',
        marginTop: 2,
        textAlign: 'center',
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
    // ✅ NOUVEAU: Styles pour la liste des participants
    participantsOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    participantsContainer: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '70%',
        paddingBottom: 20,
    },
    participantsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    participantsTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    participantsList: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    participantItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: modernColors.background,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    participantInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    participantAvatar: {
        position: 'relative',
        width: 48,
        height: 48,
    },
    participantAvatarImage: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    participantAvatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    participantAvatarText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    ownerBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: modernColors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: modernColors.surface,
    },
    participantDetails: {
        flex: 1,
    },
    participantName: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 2,
    },
    participantRole: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    removeParticipantButton: {
        padding: 8,
        backgroundColor: modernColors.error + '15',
        borderRadius: 8,
    },
    participantsFooter: {
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    addParticipantButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        backgroundColor: modernColors.primary,
        borderRadius: 12,
    },
    addParticipantText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // ✅ NOUVEAU: Styles pour le système de réponse/citation
    replyBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: modernColors.primary + '20',
        borderLeftWidth: 4,
        borderLeftColor: modernColors.primary,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
        borderRadius: 8,
    },
    replyContent: {
        flex: 1,
        marginRight: 8,
    },
    replyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    replyLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    replyText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    replyCloseButton: {
        padding: 4,
    },
    quotedMessage: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
        borderRadius: 8,
        padding: 8,
        marginBottom: 8,
    },
    quotedMessageBar: {
        width: 3,
        backgroundColor: modernColors.primary,
        borderRadius: 2,
        marginRight: 8,
    },
    quotedMessageContent: {
        flex: 1,
    },
    quotedMessageAuthor: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
        marginBottom: 2,
    },
    quotedMessageText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    messageFooterLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    replyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    replyButtonText: {
        fontSize: 11,
        fontWeight: '500',
        color: modernColors.textSecondary,
    },
});

export default ChatModalMobile;
