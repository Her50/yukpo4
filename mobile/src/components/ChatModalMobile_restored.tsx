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
import InAppCallModal from './InAppCallModal';
import ProductGalleryPickerModal from './ProductGalleryPickerModal';
import SafeIcon from './SafeIcon';
import UserMentionPicker from './UserMentionPicker';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface ChatModalMobileProps {
    visible: boolean;
    onClose: () => void;
    service: any;
    prestataireInfo: any;
    user: any;
    conversationId?: string;  // Ô£à NOUVEAU : Pour conversations priv├®es (format UUID)
    isPrivateConversation?: boolean;  // Ô£à NOUVEAU : Flag pour conversation priv├®e
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
    user,
    conversationId: privateConversationId,
    isPrivateConversation = false
}) => {
        const { t } = useLanguageSafe();
const [newMessage, setNewMessage] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // Ô£à NOUVEAU: ├ëtats pour @mention
    const [showMentionPicker, setShowMentionPicker] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);
    const [mentionedUsers, setMentionedUsers] = useState<number[]>([]);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [showParticipantsList, setShowParticipantsList] = useState(false);

    // ├ëtats pour les m├®dias
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

    // Ô£à NOUVEAU: ├ëtats pour le syst├¿me de r├®ponse/citation
    const [replyingTo, setReplyingTo] = useState<any | null>(null);

    // ├ëtats pour les appels internes
    const [showCallModal, setShowCallModal] = useState(false);
    const [callType, setCallType] = useState<'audio' | 'video'>('audio');

    const scrollViewRef = useRef<any>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Ô£à NOUVEAU : Utiliser conversationId si conversation priv├®e, sinon service.id
    const effectiveServiceId = isPrivateConversation && privateConversationId
        ? parseInt(privateConversationId, 10)
        : (service?.id || 0);

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
        effectiveServiceId,
        prestataireInfo?.userId || 0,
        user?.id || 0
    );

    // Fonction utilitaire pour extraire la valeur d'un champ de service
    const getServiceFieldValue = (field: any): string => {
        if (!field) return 'Non sp├®cifi├®';
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
        return 'Non sp├®cifi├®';
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
            loadParticipants();
        }
    }, [visible, markAsRead]);

    // Ô£à NOUVEAU: Charger les participants de la conversation
    const loadParticipants = async () => {
        const convId = effectiveServiceId;
        if (!convId) return;

        try {
            const response = await apiGet<Participant[]>(`/api/conversations/${convId}/participants`);
            if (response.success && response.data) {
                setParticipants(response.data);
                console.log('[ChatModalMobile] Participants charg├®s:', response.data);
            }
        } catch (error) {
            console.error('[ChatModalMobile] Erreur chargement participants:', error);
        }
    };

    // Ô£à NOUVEAU: Inviter un utilisateur dans la conversation
    const inviteUser = async (userId: number, context?: string) => {
        if (!service?.id) return;

        try {
            const response = await apiPost(`/api/conversations/${service.id}/invite`, {
                user_id: userId,
                context
            });

            if (response.success) {
                Alert.alert(
                    'Utilisateur invit├®',
                    'L\'utilisateur a ├®t├® ajout├® ├á la conversation et peut maintenant voir les nouveaux messages.',
                    [{ text: 'OK' }]
                );
                loadParticipants(); // Recharger la liste
            }
        } catch (error) {
            console.error('[ChatModalMobile] Erreur invitation:', error);
            Alert.alert('Erreur', 'Impossible d\'inviter cet utilisateur');
        }
    };

    // Ô£à NOUVEAU: Retirer un participant
    const removeParticipant = async (userId: number) => {
        if (!service?.id) return;

        Alert.alert(
            'Retirer le participant',
            '├ètes-vous s├╗r de vouloir retirer cette personne de la conversation ?',
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: 'Retirer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiPost(`/api/conversations/${service.id}/participants/${userId}`, {});
                            loadParticipants();
                            Alert.alert('Succ├¿s', 'Participant retir├® de la conversation');
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

        // Ô£à NOUVEAU: Envoyer avec les IDs des utilisateurs mentionn├®s et le message cit├®
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
        setMentionedUsers([]); // R├®initialiser les mentions
        setReplyingTo(null); // Ô£à R├®initialiser la r├®ponse APR├êS l'envoi
    };

    const handleEditMessage = async () => {
        if (!editingContent.trim() || !editingMessageId) return;

        await editMessage(editingMessageId, editingContent.trim());
        setEditingMessageId(null);
        setEditingContent('');
    };

    // Ô£à NOUVEAU: Handler pour envoyer des m├®dias s├®lectionn├®s de la galerie
    const handleSelectGalleryMedia = (selectedUrls: string[]) => {
        if (selectedUrls.length === 0) return;

        // Ajouter les URLs s├®lectionn├®es aux images
        setSelectedImages([...selectedImages, ...selectedUrls]);
        console.log('[ChatModal] M├®dias de la galerie ajout├®s:', selectedUrls.length);
    };

    const handleDeleteMessage = async (messageId: string) => {
        Alert.alert(
            'Supprimer le message',
            '├ètes-vous s├╗r de vouloir supprimer ce message ?',
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
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

        if (phoneNumber && phoneNumber !== 'Non sp├®cifi├®') {
            const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
            Alert.alert(
                'Appeler le prestataire',
                `Voulez-vous appeler ${nomPrestataire} au ${phoneNumber} ?`,
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                        text: t('common.call'),
                        onPress: () => {
                            // Ici vous pouvez impl├®menter l'appel t├®l├®phonique
                            Alert.alert('Appel', `Appel vers ${cleanPhone}`);
                        }
                    }
                ]
            );
        } else {
            Alert.alert('Contact', 'Aucun num├®ro de t├®l├®phone disponible pour ce prestataire');
        }
    };

    const handleTyping = (text: string, cursorPos?: number) => {
        setNewMessage(text);
        if (cursorPos !== undefined) setCursorPosition(cursorPos);

        // Ô£à NOUVEAU: D├®tecter le @ pour ouvrir le mention picker
        const lastAtIndex = text.lastIndexOf('@');
        if (lastAtIndex !== -1 && (cursorPos === undefined || cursorPos > lastAtIndex)) {
            // Extraire le texte apr├¿s le @
            const query = text.substring(lastAtIndex + 1, cursorPos || text.length);

            // Si pas d'espace apr├¿s le @, c'est une mention en cours
            if (!query.includes(' ')) {
                setMentionQuery(query);
                setShowMentionPicker(true);
                console.log('[ChatModalMobile] @ d├®tect├®, query:', query);
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

    // Ô£à NOUVEAU: Ins├®rer une mention dans le message
    const insertMention = (user: any) => {
        const lastAtIndex = newMessage.lastIndexOf('@');
        if (lastAtIndex === -1) return;

        // Remplacer le @ et le query par @nom_utilisateur
        const before = newMessage.substring(0, lastAtIndex);
        const mention = `@${user.nom_complet} `;
        const after = newMessage.substring(cursorPosition);

        const newText = before + mention + after;
        setNewMessage(newText);

        // Ajouter l'ID ├á la liste des mentions
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

    const popularEmojis = [t('chatModalMobileRestored.ye'), t('chatModalMobileRestored.ye'), 'ÔØñ´©Å', '­ƒæì', '­ƒæÄ', '­ƒÿì', '­ƒñö', '­ƒÿó', '­ƒÿ«', t('chatModalMobileRestored.on'), '­ƒÆ»', t('chatModalMobileRestored.ae'), '­ƒæÅ', '­ƒÖÅ', '­ƒÆ¬'];

    // Fonction pour convertir fichier en base64 (React Native compatible)
    const convertFileToBase64 = async (uri: string): Promise<string> => {
        try {
            // Utiliser FileSystem d'Expo pour React Native
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
            });

            // D├®terminer le type MIME bas├® sur l'extension
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
            console.error('Erreur s├®lection images:', error);
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

                // V├®rifier la taille du fichier (max 10MB)
                if (file.size && file.size > 10 * 1024 * 1024) {
                    Alert.alert('Fichier trop volumineux', 'La taille maximale est de 10MB');
                    return;
                }

                const base64 = await convertFileToBase64(file.uri);
                setSelectedDocuments([...selectedDocuments, { base64, name: file.name || 'document', size: file.size }]);
                console.log('[ChatModal] Fichier s├®lectionn├®:', file.name, `(${(file.size / 1024).toFixed(2)} KB)`);
            }
        } catch (error) {
            console.error('Erreur s├®lection fichier:', error);
            Alert.alert('Erreur', 'Impossible de charger le fichier');
        }
    };

    // Enregistrer audio - VERSION ROBUSTE
    const startAudioRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Permission requise', 'Permission microphone n├®cessaire');
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
            Alert.alert('Erreur', 'Impossible de d├®marrer l\'enregistrement audio');
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
            console.error('Erreur arr├¬t audio:', error);
            setRecording(null);
        }
    };

    // Fonction pour jouer/arr├¬ter l'audio enregistr├®
    const togglePlayAudio = async () => {
        try {
            if (isPlayingAudio && audioSound) {
                // Arr├¬ter la lecture
                await audioSound.stopAsync();
                await audioSound.unloadAsync();
                setAudioSound(null);
                setIsPlayingAudio(false);
            } else if (selectedAudioUri) {
                // D├®marrer la lecture
                const { sound } = await Audio.Sound.createAsync(
                    { uri: selectedAudioUri },
                    { shouldPlay: true }
                );
                setAudioSound(sound);
                setIsPlayingAudio(true);

                // Arr├¬ter automatiquement quand la lecture est termin├®e
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

    // Envoyer message avec m├®dias
    const handleSendWithMedia = async () => {
        if (!newMessage.trim() && selectedImages.length === 0 && !selectedAudio && selectedDocuments.length === 0) {
            Alert.alert('Message vide', '├ëcrivez un message ou ajoutez un m├®dia');
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

        // Ô£à CORRIG├ë: D├®tecter automatiquement le type de message
        const messageType = selectedImages.length > 0 ? 'image' :
            selectedAudio ? 'audio' :
                selectedDocuments.length > 0 ? 'file' : 'text';

        await sendMessage(newMessage.trim() || '', messageType, messageData);

        // Nettoyer l'audio si pr├®sent
        if (audioSound) {
            await audioSound.unloadAsync();
            setAudioSound(null);
        }

        // R├®initialiser
        setNewMessage('');
        setSelectedImages([]);
        setSelectedAudio(null);
        setSelectedAudioUri(null);
        setSelectedDocuments([]);
        setIsPlayingAudio(false);
        setMentionedUsers([]); // Ô£à R├®initialiser les mentions
        setReplyingTo(null); // Ô£à R├®initialiser la r├®ponse
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
                    {/* Premi├¿re ligne : Bouton retour + Nom + Actions */}
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
                            {/* Ô£à NOUVEAU: Bouton WhatsApp (prioritaire si disponible) */}
                            {(prestataireInfo?.whatsapp || service?.data?.whatsapp?.valeur || service?.data?.whatsapp || prestataireInfo?.telephone) && (
                                <TouchableOpacity
                                    style={[styles.actionButton, styles.whatsappButton]}
                                    onPress={async () => {
                                        const whatsappNumber = prestataireInfo?.whatsapp ||
                                            service?.data?.whatsapp?.valeur ||
                                            service?.data?.whatsapp ||
                                            prestataireInfo?.telephone;

                                        if (!whatsappNumber) {
                                            Alert.alert('WhatsApp', 'Num├®ro WhatsApp non disponible');
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
                                                Alert.alert('WhatsApp', 'WhatsApp n\'est pas install├® sur cet appareil');
                                            }
                                        } catch (error) {
                                            console.error('Erreur ouverture WhatsApp:', error);
                                            Alert.alert('Erreur', 'Impossible d\'ouvrir WhatsApp');
                                        }
                                    }}
                                >
                                    {/* Logo WhatsApp officiel */}
                                    <View style={styles.whatsappIconContainer}>
                                        <Text style={styles.whatsappIcon}>{t('chatModalMobileRestored.o')}</Text>
                                    </View>
                                    <View style={styles.whatsappBadge}>
                                        <Text style={styles.whatsappBadgeText}>WA</Text>
                                    </View>
                                </TouchableOpacity>
                            )}

                            {/* Ô£à Bouton liste des participants */}
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
                        </View>
                    </View>

                    {/* Deuxi├¿me ligne : Titre du service (toujours visible) */}
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
                                        {/* Ô£à NOUVEAU: Afficher l'image si pr├®sente */}
                                        {message.type === 'image' && message.imageUrl && (
                                            <Image
                                                source={{ uri: message.imageUrl }}
                                                style={styles.messageImage}
                                                resizeMode="cover"
                                            />
                                        )}

                                        {/* Ô£à NOUVEAU: Afficher l'audio si pr├®sent */}
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

                                        {/* Ô£à NOUVEAU: Afficher le fichier si pr├®sent */}
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

                                        {/* Ô£à NOUVEAU: Afficher le message cit├® si pr├®sent */}
                                        {message.reply_to && (
                                            <View style={styles.quotedMessage}>
                                                <View style={styles.quotedMessageBar} />
                                                <View style={styles.quotedMessageContent}>
                                                    <Text style={styles.quotedMessageAuthor}>
                                                        {message.reply_to.sender_name || 'Message'}
                                                    </Text>
                                                    <Text style={styles.quotedMessageText} numberOfLines={2}>
                                                        {message.reply_to.content_type === 'text' && message.reply_to.content}
                                                        {message.reply_to.content_type === 'audio' && t('chatModalMobile_restored.anMessageAudio')}
                                                        {message.reply_to.content_type === 'image' && t('chatModalMobile_restored.uaImage')}
                                                        {message.reply_to.content_type === 'file' && t('chatModalMobile_restored.oaFichier')}
                                                        {message.reply_to.content_type === 'video' && t('chatModalMobile_restored.anVido')}
                                                    </Text>
                                                </View>
                                            </View>
                                        )}

                                        {/* Afficher le texte pour les messages texte ou avec le texte */}
                                        {(message.type === 'text' || (message.content && !message.content.match(/^[­ƒôÀ­ƒÄñ­ƒôÄ]/))) && (
                                            <Text style={[
                                                styles.messageText,
                                                message.from === 'client' ? styles.messageTextRight : styles.messageTextLeft
                                            ]}>
                                                {message.content}
                                            </Text>
                                        )}

                                        <View style={styles.messageFooter}>
                                            <View style={styles.messageFooterLeft}>
                                                <Text style={[
                                                    styles.messageTime,
                                                    message.from === 'client' ? styles.messageTimeRight : styles.messageTimeLeft
                                                ]}>
                                                    {formatMessageTime(message.timestamp)}
                                                    {message.edited && (
                                                        <Text style={styles.editedIndicator}> (modifi├®)</Text>
                                                    )}
                                                </Text>

                                                {/* Ô£à NOUVEAU: Bouton R├®pondre (toujours visible) */}
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
                                                    <Text style={styles.replyButtonText}>R├®pondre</Text>
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
                                <Text style={styles.typingText}>En train d'├®crire...</Text>
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
                    {/* Preview des m├®dias s├®lectionn├®s */}
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
                                        <Text style={styles.removeMediaText}>{t('chatModalMobileRestored.u')}</Text>
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
                                                {isPlayingAudio ? 'En lecture...' : 'Audio enregistr├®'}
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
                                        <Text style={styles.removeMediaText}>{t('chatModalMobileRestored.u')}</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    )}

                    {/* Boutons d'actions m├®dia */}
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

                        {/* Ô£à Bouton galerie de produits/service */}
                        <TouchableOpacity
                            style={styles.mediaButton}
                            onPress={() => setShowProductGalleryPicker(true)}
                        >
                            <SafeIcon name="folder-open" size={22} color="#8B5CF6" />
                        </TouchableOpacity>
                    </View>

                    {/* Ô£à NOUVEAU: Bandeau de citation quand on r├®pond ├á un message */}
                    {replyingTo && (
                        <View style={styles.replyBanner}>
                            <View style={styles.replyContent}>
                                <View style={styles.replyHeader}>
                                    <SafeIcon name="corner-down-right" size={16} color={modernColors.primary} />
                                    <Text style={styles.replyLabel}>
                                        R├®ponse ├á {replyingTo.sender_name || 'Message'}
                                    </Text>
                                </View>
                                <Text style={styles.replyText} numberOfLines={2}>
                                    {replyingTo.content_type === 'text' && replyingTo.content}
                                    {replyingTo.content_type === 'audio' && t('chatModalMobile_restored.anMessageAudio')}
                                    {replyingTo.content_type === 'image' && t('chatModalMobile_restored.uaImage')}
                                    {replyingTo.content_type === 'file' && t('chatModalMobile_restored.oaFichier')}
                                    {replyingTo.content_type === 'video' && t('chatModalMobile_restored.anVido')}
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
                            placeholder={replyingTo ? "Tapez votre r├®ponse..." : "Tapez votre message... (@ pour mentionner)"}
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
                                {isConnected ? 'Connexion s├®curis├®e' : 'Mode hors ligne'}
                            </Text>
                        </View>
                    </View>
                </View>
            </KeyboardAvoidingView>

            {/* Ô£à Modal de s├®lection de m├®dias de la galerie produit */}
            <ProductGalleryPickerModal
                visible={showProductGalleryPicker}
                onClose={() => setShowProductGalleryPicker(false)}
                service={service}
                onSelectMedia={handleSelectGalleryMedia}
            />

            {/* Modal d'appel interne (audio/vid├®o) */}
            <InAppCallModal
                visible={showCallModal}
                onClose={() => setShowCallModal(false)}
                callType={callType}
                recipientName={nomPrestataire}
                recipientId={prestataireInfo?.userId || ''}
                currentUserId={user?.id || ''}
                serviceId={service?.id}
            />

            {/* Ô£à NOUVEAU: Modal pour @mention */}
            <UserMentionPicker
                visible={showMentionPicker}
                onClose={() => setShowMentionPicker(false)}
                onSelectUser={insertMention}
                currentQuery={mentionQuery}
            />

            {/* Ô£à NOUVEAU: Modal liste des participants */}
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
                                ­ƒæÑ Participants ({participants.length})
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
                                                {participant.role === 'owner' ? t('chatModalMobileRestored.propritaire') :
                                                    participant.invited_by ? t('chatModalMobileRestored.nInvit') : t('chatModalMobileRestored.nParticipant')}
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
        paddingLeft: 48, // Align├® avec le nom (apr├¿s le bouton retour)
        paddingRight: 40, // Espace pour ne pas ├¬tre cach├® par les boutons
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
        // Animation sera ajout├®e via Animated API si n├®cessaire
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
    // Ô£à NOUVEAU: Styles pour les m├®dias dans les messages
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
    // Ô£à NOUVEAU: Styles pour la liste des participants
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
    // Ô£à NOUVEAU: Styles pour le syst├¿me de r├®ponse/citation
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
