// Remplacement des Ionicons par des emojis pour éviter les crashes
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useLocation } from '../contexts/LocationContext'; // ✅ NOUVEAU: Pour GPS automatique
import { apiPost } from '../services/api'; // ✅ NOUVEAU: Pour autocomplete
import { uploadMultipleToCloud } from '../services/cloudUpload';
import { modernColors } from '../theme/modernTheme';
import ModernGPSModal from './ModernGPSModal'; // Utiliser ModernGPSModal pour support des zones
import { NativeCard } from './NativeDesign';
import SafeIcon from './SafeIcon';

const primaryColor = modernColors?.primary ?? '#6366F1';
const accentColor = modernColors?.accent ?? '#F97316';
const successColor = modernColors?.success ?? '#10B981';
const textSecondaryColor = modernColors?.textSecondary ?? '#6B7280';

interface ChatInputMobileProps {
    onSubmit: (input: any) => void;
    loading?: boolean;
    placeholder?: string;
    onGPSPress?: () => void;
    showSendButton?: boolean; // Nouveau prop pour contrôler l'affichage du bouton
    showAutocomplete?: boolean; // ✅ NOUVEAU: Activer l'autocomplete pour la recherche
    isSearchMode?: boolean; // ✅ NOUVEAU: Indique si on est en mode recherche
}

const ChatInputMobile: React.FC<ChatInputMobileProps> = ({
    onSubmit,
    loading = false,
    placeholder = 'Décrivez votre besoin ou service...',
    onGPSPress,
    showSendButton = true,
    showAutocomplete = false, // ✅ NOUVEAU
    isSearchMode = false // ✅ NOUVEAU
}) => {
    // ✅ NOUVEAU: Utiliser la position GPS du contexte pour l'autocomplete
    const { location } = useLocation();

    const [text, setText] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [audioUri, setAudioUri] = useState<string | null>(null);
    const [videos, setVideos] = useState<string[]>([]);
    const [documents, setDocuments] = useState<string[]>([]); // PDFs et autres docs en base64
    const [excelFiles, setExcelFiles] = useState<string[]>([]); // Fichiers Excel en base64
    const [logo, setLogo] = useState<string[]>([]);
    const [banner, setBanner] = useState<string[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [gpsData, setGpsData] = useState<{ lat: number; lng: number; address?: string } | null>(null);
    const [gpsString, setGpsString] = useState<string>(''); // Format: "lat,lng" ou "lat1,lng1|lat2,lng2|..."
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<string>('');

    // ✅ NOUVEAU: États pour autocomplete intelligente (mode recherche uniquement)
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [dynamicPlaceholder, setDynamicPlaceholder] = useState<string | null>(null);

    const normalizeAutocompleteResponse = (response: any): any[] => {
        if (!response) {
            return [];
        }

        const payload = response.data ?? response;

        if (Array.isArray(payload)) {
            return payload;
        }

        if (Array.isArray(payload?.data)) {
            return payload.data;
        }

        if (Array.isArray(payload?.results)) {
            return payload.results;
        }

        if (Array.isArray(payload?.items)) {
            return payload.items;
        }

        if (Array.isArray(payload?.data?.data)) {
            return payload.data.data;
        }

        return [];
    };

    const resolveLatLng = (source: any): { lat: number; lng: number } | null => {
        if (!source) {
            return null;
        }

        if (typeof source.lat === 'number' && typeof source.lng === 'number') {
            return { lat: source.lat, lng: source.lng };
        }

        if (typeof source.latitude === 'number' && typeof source.longitude === 'number') {
            return { lat: source.latitude, lng: source.longitude };
        }

        if (source.coords && typeof source.coords.latitude === 'number' && typeof source.coords.longitude === 'number') {
            return { lat: source.coords.latitude, lng: source.coords.longitude };
        }

        return null;
    };

    const getSuggestionVector = (suggestion: any): string[] => {
        if (Array.isArray(suggestion?.full_vector) && suggestion.full_vector.length > 0) {
            return suggestion.full_vector;
        }
        if (Array.isArray(suggestion?.product_vector) && suggestion.product_vector.length > 0) {
            return suggestion.product_vector;
        }
        return [];
    };

    const formatSuggestionExample = (suggestion: any): string | null => {
        const vector = getSuggestionVector(suggestion);
        if (!vector || vector.length === 0) {
            return null;
        }
        return vector.filter(Boolean).slice(0, 5).join(' • ');
    };

    // ✅ NOUVEAU: Autocomplete intelligente en mode recherche
    useEffect(() => {
        if (!showAutocomplete || !isSearchMode) return;

        const debounce = setTimeout(async () => {
            if (text.trim().length >= 2) {
                setLoadingSuggestions(true);
                try {
                    // ✅ CORRECTION 2025-11-06: Inclure coordonnées GPS pour résultats priorisés
                    const payload: any = {
                        query: text.trim(),
                        limit: 10, // ✅ Augmenté de 8 à 10 pour plus de suggestions
                    };

                    // ✅ Ajouter GPS si disponible (ordre de priorité : GPS manuel > GPS contexte)
                    const currentGPS = resolveLatLng(gpsData) ?? resolveLatLng(location);
                    if (currentGPS) {
                        payload.user_lat = currentGPS.lat;
                        payload.user_lng = currentGPS.lng;
                        console.log('[ChatInputMobile] 📍 GPS inclus dans autocomplete:', {
                            lat: payload.user_lat,
                            lng: payload.user_lng,
                            source: gpsData ? 'manuel' : 'auto'
                        });
                    } else {
                        console.log('[ChatInputMobile] ⚠️ Aucun GPS disponible pour l\'autocomplete');
                    }

                    const response = await apiPost('/api/autocomplete/search-products', payload);

                    if (response.success) {
                        const normalized = normalizeAutocompleteResponse(response);
                        setSuggestions(normalized);
                        setShowSuggestions(normalized.length > 0);

                        if (normalized.length > 0) {
                            const example = formatSuggestionExample(normalized[0]);
                            setDynamicPlaceholder(example ? `ex: ${example}` : null);
                        } else {
                            setDynamicPlaceholder(null);
                        }

                        console.log('[ChatInputMobile] 🔍 Suggestions autocomplete:', {
                            count: normalized.length,
                            withGPS: !!gpsData,
                            query: text.trim()
                        });
                    } else {
                        setSuggestions([]);
                        setShowSuggestions(false);
                        setDynamicPlaceholder(null);
                    }
                } catch (error) {
                    console.error('[ChatInputMobile] Erreur autocomplete:', error);
                    setSuggestions([]);
                    setShowSuggestions(false);
                    setDynamicPlaceholder(null);
                } finally {
                    setLoadingSuggestions(false);
                }
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
                setDynamicPlaceholder(null);
            }
        }, 300);

        return () => clearTimeout(debounce);
    }, [text, showAutocomplete, isSearchMode, gpsData, location]);

    // Animations pour l'enregistrement audio
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const waveAnim1 = useRef(new Animated.Value(0)).current;
    const waveAnim2 = useRef(new Animated.Value(0)).current;
    const waveAnim3 = useRef(new Animated.Value(0)).current;
    const timerInterval = useRef<NodeJS.Timeout | null>(null);

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

        if (!result.canceled && result.assets.length > 0) {
            setIsUploading(true);
            setUploadProgress('Upload des images...');

            try {
                // Préparer les fichiers pour l'upload
                const filesToUpload = result.assets
                    .filter(asset => asset.base64)
                    .map(asset => ({
                        uri: `data:image/jpeg;base64,${asset.base64}`,
                        name: asset.fileName || `image_${Date.now()}.jpg`
                    }));

                // Upload vers le cloud
                const uploadResults = await uploadMultipleToCloud(
                    filesToUpload,
                    'image',
                    (completed, total) => {
                        setUploadProgress(`Upload ${completed}/${total} images...`);
                    }
                );

                // Récupérer les URLs des images uploadées
                const uploadedUrls = uploadResults
                    .filter(result => result.success && result.url)
                    .map(result => result.url!);

                if (uploadedUrls.length > 0) {
                    setImages([...images, ...uploadedUrls]);
                    console.log('[ChatInputMobile] Images uploadées:', uploadedUrls.length);
                } else {
                    Alert.alert('Erreur', 'Impossible d\'uploader les images');
                }
            } catch (error) {
                console.error('Erreur upload images:', error);
                Alert.alert('Erreur', 'Échec de l\'upload des images');
            } finally {
                setIsUploading(false);
                setUploadProgress('');
            }
        }
    };

    // Fonction pour convertir un fichier en base64
    const convertFileToBase64 = async (uri: string): Promise<string> => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64data = reader.result as string;
                    resolve(base64data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Erreur conversion base64:', error);
            throw error;
        }
    };

    // Choisir un document (tous types)
    const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets[0]) {
                const file = result.assets[0];
                const mimeType = file.mimeType || '';
                const fileName = file.name || '';

                // Convertir en base64
                const base64Data = await convertFileToBase64(file.uri);

                // Séparer par type
                if (mimeType.includes('excel') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                    setExcelFiles([...excelFiles, base64Data]);
                } else if (mimeType.includes('pdf') || fileName.endsWith('.pdf')) {
                    setDocuments([...documents, base64Data]);
                } else if (mimeType.includes('video') || fileName.endsWith('.mp4') || fileName.endsWith('.mov')) {
                    setVideos([...videos, base64Data]);
                } else {
                    // Autres documents
                    setDocuments([...documents, base64Data]);
                }

                console.log('[ChatInputMobile] Fichier ajouté:', fileName, 'Type:', mimeType);
            }
        } catch (error) {
            console.error('Erreur lors de la sélection du document:', error);
            Alert.alert('Erreur', 'Impossible de charger le fichier');
        }
    };

    // État de l'enregistrement
    const [recording, setRecording] = useState<Audio.Recording | null>(null);

    // Effet pour les animations pendant l'enregistrement
    useEffect(() => {
        if (isRecording) {
            // Animation de pulsation
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            // Animations des ondes
            [waveAnim1, waveAnim2, waveAnim3].forEach((anim, index) => {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(anim, {
                            toValue: 1,
                            duration: 1000 + (index * 200),
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim, {
                            toValue: 0,
                            duration: 1000 + (index * 200),
                            useNativeDriver: true,
                        }),
                    ])
                ).start();
            });

            // Timer
            timerInterval.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } else {
            // Réinitialiser les animations
            pulseAnim.setValue(1);
            waveAnim1.setValue(0);
            waveAnim2.setValue(0);
            waveAnim3.setValue(0);

            if (timerInterval.current) {
                clearInterval(timerInterval.current);
                timerInterval.current = null;
            }
            setRecordingDuration(0);
        }

        return () => {
            if (timerInterval.current) {
                clearInterval(timerInterval.current);
            }
        };
    }, [isRecording]);

    // Formater la durée d'enregistrement
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Enregistrer audio - VERSION CORRIGÉE
    const startRecording = async () => {
        try {
            console.log('[ChatInput] Demande permission audio...');

            // Demander permission
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Permission requise', 'Nous avons besoin de la permission pour enregistrer l\'audio');
                return;
            }

            console.log('[ChatInput] Permission accordée');

            // Configurer le mode audio AVANT de créer le recording
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: false,
                    shouldDuckAndroid: true,
                    playThroughEarpieceAndroid: false,
                });
                console.log('[ChatInput] Mode audio configuré');
            } catch (modeError) {
                console.error('[ChatInput] Erreur configuration mode audio:', modeError);
                // Continuer quand même
            }

            // Créer le recording avec options simplifiées
            console.log('[ChatInput] Création du recording...');
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
            console.log('[ChatInput] ✅ Enregistrement démarré avec succès');
        } catch (error) {
            console.error('[ChatInput] ❌ Erreur complète enregistrement:', error);
            Alert.alert(
                'Erreur Audio',
                'Impossible de démarrer l\'enregistrement. Vérifiez que le microphone n\'est pas utilisé par une autre app.',
                [{ text: 'OK' }]
            );
            setIsRecording(false);
            setRecording(null);
        }
    };

    const stopRecording = async () => {
        if (!recording) {
            console.warn('[ChatInput] Pas de recording actif');
            setIsRecording(false);
            return;
        }

        try {
            console.log('[ChatInput] Arrêt enregistrement...');
            setIsRecording(false);

            await recording.stopAndUnloadAsync();

            // Réinitialiser le mode audio
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                });
            } catch (modeError) {
                console.warn('[ChatInput] Erreur reset mode audio:', modeError);
            }

            const uri = recording.getURI();
            console.log('[ChatInput] URI audio:', uri);

            if (uri) {
                setAudioUri(uri);
                console.log('✅ Audio enregistré avec succès:', uri);
            } else {
                console.warn('⚠️ Pas d\'URI audio généré');
            }

            setRecording(null);
        } catch (error) {
            console.error('[ChatInput] ❌ Erreur arrêt enregistrement:', error);
            Alert.alert('Erreur', 'Erreur lors de l\'arrêt de l\'enregistrement');
            setRecording(null);
            setIsRecording(false);
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

    const removeAudio = () => {
        setAudioUri(null);
        setIsRecording(false);
    };

    const removeGPS = () => {
        setGpsData(null);
        setGpsString('');
    };

    // Soumettre
    const handleSubmit = () => {
        // Vérifier qu'il y a au moins un élément
        const hasContent = text.trim() || images.length > 0 || documents.length > 0 ||
            videos.length > 0 || excelFiles.length > 0 || audioUri;

        if (!hasContent) {
            Alert.alert('Erreur', 'Veuillez saisir du texte ou ajouter des médias');
            return;
        }

        // Construire les données GPS selon le format (point ou zone)
        let gpsFixe = gpsString;
        let gpsFixeCoords = undefined;
        let gpsZone = undefined;

        if (gpsString) {
            if (gpsString.includes('|')) {
                // Zone (polygone)
                const points = gpsString.split('|').map(coordStr => {
                    const [lat, lng] = coordStr.split(',').map(parseFloat);
                    return { lat, lng };
                });
                gpsFixeCoords = JSON.stringify(points);
                gpsZone = points;
            } else {
                // Point unique
                const [lat, lng] = gpsString.split(',').map(parseFloat);
                gpsFixeCoords = JSON.stringify([{ lat, lng }]);
                gpsZone = [{ lat, lng }];
            }
        }

        // Fonction pour extraire le base64 pur (sans préfixe data:)
        const extractBase64 = (dataUrl: string): string => {
            if (!dataUrl.startsWith('data:')) return dataUrl;
            const base64Index = dataUrl.indexOf('base64,');
            if (base64Index !== -1) {
                return dataUrl.substring(base64Index + 7);
            }
            return dataUrl;
        };

        const input = {
            texte: text.trim(),  // IMPORTANT: "texte" pas "text" (comme le frontend)
            text: text.trim(),   // Garder les deux pour compatibilité
            base64_image: images.map(extractBase64),
            audio_base64: audioUri ? [extractBase64(audioUri)] : [],
            video_base64: videos.map(extractBase64),
            doc_base64: documents.map(extractBase64),
            excel_base64: excelFiles.map(extractBase64),
            pdf_base64: documents.filter(d => d.includes('pdf')).map(extractBase64), // PDFs séparés
            logo: logo.map(extractBase64),
            banner: banner.map(extractBase64),
            gps_mobile: gpsData ? `${gpsData.lat},${gpsData.lng}` : undefined,
            gps_zone: gpsZone,
            gps_fixe: gpsFixe || undefined,
            gps_fixe_coords: gpsFixeCoords,
        };

        console.log('[ChatInputMobile] Soumission complète:', {
            texte: input.texte,
            images: input.base64_image.length,
            audios: input.audio_base64.length,
            videos: input.video_base64.length,
            documents: input.doc_base64.length,
            excel: input.excel_base64.length,
            logo: input.logo.length,
            banner: input.banner.length,
            gps: !!input.gps_fixe
        });

        onSubmit(input);

        // Réinitialiser tous les champs après soumission
        setText('');
        setImages([]);
        setVideos([]);
        setDocuments([]);
        setExcelFiles([]);
        setLogo([]);
        setBanner([]);
        setAudioUri(null);
        setGpsData(null);
        setGpsString('');
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

            {/* Aperçu des fichiers - Documents, Excel, Vidéos */}
            {(documents.length > 0 || excelFiles.length > 0 || videos.length > 0) && (
                <View style={styles.documentsContainer}>
                    {/* Documents PDF */}
                    {documents.map((doc, index) => (
                        <View key={`doc-${index}`} style={styles.documentItem}>
                            <Text style={styles.documentIcon}>📄</Text>
                            <Text style={styles.documentName} numberOfLines={1}>
                                Document PDF {index + 1}
                            </Text>
                            <TouchableOpacity onPress={() => setDocuments(documents.filter((_, i) => i !== index))}>
                                <Text style={styles.closeIconSmall}>❌</Text>
                            </TouchableOpacity>
                        </View>
                    ))}

                    {/* Fichiers Excel */}
                    {excelFiles.map((excel, index) => (
                        <View key={`excel-${index}`} style={styles.excelItem}>
                            <Text style={styles.excelIcon}>📊</Text>
                            <Text style={styles.documentName} numberOfLines={1}>
                                Excel {index + 1}
                            </Text>
                            <TouchableOpacity onPress={() => setExcelFiles(excelFiles.filter((_, i) => i !== index))}>
                                <Text style={styles.closeIconSmall}>❌</Text>
                            </TouchableOpacity>
                        </View>
                    ))}

                    {/* Vidéos */}
                    {videos.map((video, index) => (
                        <View key={`video-${index}`} style={styles.videoItem}>
                            <Text style={styles.videoIcon}>🎥</Text>
                            <Text style={styles.documentName} numberOfLines={1}>
                                Vidéo {index + 1}
                            </Text>
                            <TouchableOpacity onPress={() => setVideos(videos.filter((_, i) => i !== index))}>
                                <Text style={styles.closeIconSmall}>❌</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            )}

            {/* Aperçu de l'audio avec animation */}
            {(audioUri || isRecording) && (
                <View style={styles.audioContainer}>
                    {isRecording ? (
                        <View style={styles.recordingActive}>
                            <Animated.View style={[
                                styles.recordingPulse,
                                { transform: [{ scale: pulseAnim }] }
                            ]}>
                                <Text style={styles.recordingIcon}>🎤</Text>
                            </Animated.View>

                            <View style={styles.recordingInfo}>
                                <Text style={styles.recordingText}>Enregistrement en cours...</Text>
                                <Text style={styles.recordingTimer}>{formatDuration(recordingDuration)}</Text>
                            </View>

                            {/* Visualisation d'onde sonore */}
                            <View style={styles.waveformContainer}>
                                <Animated.View style={[
                                    styles.waveBar,
                                    {
                                        height: waveAnim1.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [10, 30]
                                        })
                                    }
                                ]} />
                                <Animated.View style={[
                                    styles.waveBar,
                                    {
                                        height: waveAnim2.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [15, 40]
                                        })
                                    }
                                ]} />
                                <Animated.View style={[
                                    styles.waveBar,
                                    {
                                        height: waveAnim3.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [10, 25]
                                        })
                                    }
                                ]} />
                                <Animated.View style={[
                                    styles.waveBar,
                                    {
                                        height: waveAnim1.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [20, 35]
                                        })
                                    }
                                ]} />
                                <Animated.View style={[
                                    styles.waveBar,
                                    {
                                        height: waveAnim2.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [10, 30]
                                        })
                                    }
                                ]} />
                            </View>

                            <TouchableOpacity
                                style={styles.stopRecordingButton}
                                onPress={toggleRecording}
                            >
                                <Text style={styles.stopRecordingIcon}>⏹</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.audioItem}>
                            <Text style={styles.audioIcon}>🎤</Text>
                            <Text style={styles.audioText}>Audio enregistré ({formatDuration(recordingDuration)})</Text>
                            <TouchableOpacity onPress={removeAudio}>
                                <Text style={styles.closeIconSmall}>❌</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

            {/* Aperçu du GPS - Amélioré pour afficher point ou zone */}
            {gpsData && (
                <View style={styles.gpsContainer}>
                    <View style={styles.gpsItem}>
                        <Text style={styles.gpsIcon}>
                            {gpsString.includes('|') ? '🎯' : '📍'}
                        </Text>
                        <View style={styles.gpsTextContainer}>
                            <Text style={styles.gpsText} numberOfLines={1}>
                                {gpsString.includes('|')
                                    ? `Zone avec ${gpsString.split('|').length} points`
                                    : (gpsData.address || `${gpsData.lat.toFixed(4)}, ${gpsData.lng.toFixed(4)}`)}
                            </Text>
                            {gpsString.includes('|') && (
                                <Text style={styles.gpsSubtext}>
                                    📍 {gpsData.lat.toFixed(4)}, {gpsData.lng.toFixed(4)}
                                </Text>
                            )}
                        </View>
                        <TouchableOpacity onPress={removeGPS}>
                            <Text style={styles.closeIconSmall}>❌</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Zone de texte principale avec boutons intégrés en bas */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.textInput}
                    placeholder={text.length === 0 && dynamicPlaceholder ? dynamicPlaceholder : placeholder}
                    placeholderTextColor="#9CA3AF" // Gris moyen pour le placeholder
                    value={text}
                    onChangeText={setText}
                    multiline
                    numberOfLines={2} // ✅ Réduit de 3 à 2 lignes
                    textAlignVertical="top"
                />

                {/* Boutons d'action - LIGNE PRINCIPALE */}
                <View style={styles.actionsContainer}>
                    {/* Audio - Affichage amélioré */}
                    {!isRecording ? (
                        <TouchableOpacity
                            style={[styles.actionButton, audioUri && styles.actionButtonActive]}
                            onPress={toggleRecording}
                            disabled={loading}
                        >
                            <Text style={[styles.actionIcon, audioUri && styles.actionButtonActive]}>🎤</Text>
                            <Text style={[styles.actionButtonText, audioUri && styles.actionButtonTextActive]}>
                                {audioUri ? '✓ Audio' : 'Audio'}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.recordingButtonContainer}>
                            <Animated.View style={[
                                styles.recordingButtonPulse,
                                { transform: [{ scale: pulseAnim }] }
                            ]}>
                                <TouchableOpacity
                                    style={styles.recordingButton}
                                    onPress={toggleRecording}
                                >
                                    <Text style={styles.recordingButtonIcon}>⏹️</Text>
                                </TouchableOpacity>
                            </Animated.View>
                            <Text style={styles.recordingButtonTimer}>{formatDuration(recordingDuration)}</Text>
                        </View>
                    )}

                    {/* GPS - Affichage amélioré */}
                    <TouchableOpacity
                        style={[styles.actionButton, gpsData && styles.actionButtonActive]}
                        onPress={() => setShowGPSModal(true)}
                    >
                        <Text style={[styles.gpsIcon, gpsData && styles.gpsIconActive]}>
                            {gpsString.includes('|') ? '🎯' : '📍'}
                        </Text>
                        <Text style={[styles.actionButtonText, gpsData && styles.actionButtonTextActive]}>
                            {gpsData ? (gpsString.includes('|') ? 'Zone' : 'GPS') : 'GPS'}
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
                </View>
            </View>

            {/* ✅ NOUVEAU: Suggestions intelligentes (mode recherche uniquement) */}
            {showAutocomplete && isSearchMode && (showSuggestions || loadingSuggestions) && (
                <View style={styles.suggestionsContainer}>
                    <View style={styles.suggestionsHeader}>
                        <Text style={styles.suggestionsTitle}>🔥 Caractéristiques recommandées</Text>
                        <TouchableOpacity onPress={() => setShowSuggestions(false)}>
                            <Text style={styles.closeSuggestions}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.suggestionsCaption}>
                        Suggestions issues de l'autocomplete caractéristique
                    </Text>

                    {loadingSuggestions ? (
                        <View style={styles.loadingSuggestionsRow}>
                            <ActivityIndicator size="small" color={primaryColor} />
                            <Text style={styles.loadingSuggestionsText}>Analyse en cours...</Text>
                        </View>
                    ) : suggestions.length > 0 ? (
                        <ScrollView style={styles.suggestionsList} nestedScrollEnabled={true}>
                            {suggestions.map((suggestion, index) => {
                                const chips = getSuggestionVector(suggestion).slice(0, 6);
                                const fullText = getSuggestionVector(suggestion).join(' ');
                                const priceText = typeof suggestion?.prix === 'number'
                                    ? `${Math.round(suggestion.prix).toLocaleString()} ${suggestion?.devise || 'XAF'}`
                                    : null;

                                return (
                                    <NativeCard
                                        key={`suggestion-${index}`}
                                        onPress={() => {
                                            setText(fullText);
                                            setShowSuggestions(false);
                                            console.log('[ChatInputMobile] ✅ Suggestion sélectionnée:', fullText);
                                        }}
                                        style={styles.suggestionCard}
                                    >
                                        <View style={styles.suggestionCardHeader}>
                                            <SafeIcon name="sparkles" size={16} color={primaryColor} />
                                            <Text style={styles.suggestionCardTitle}>Proposition {index + 1}</Text>
                                        </View>

                                        <View style={styles.suggestionChips}>
                                            {chips.map((chip: string, i: number) => (
                                                <View key={`${chip}-${i}`} style={styles.suggestionChip}>
                                                    <Text style={styles.suggestionChipText}>{chip}</Text>
                                                </View>
                                            ))}
                                        </View>

                                        <View style={styles.suggestionMetaRow}>
                                            {suggestion?.chosen_location ? (
                                                <View style={styles.suggestionMetaItem}>
                                                    <SafeIcon name="map-pin" size={14} color={primaryColor} />
                                                    <Text style={styles.suggestionMetaText}>{suggestion.chosen_location}</Text>
                                                </View>
                                            ) : null}

                                            {suggestion?.usage_count ? (
                                                <View style={styles.suggestionMetaItem}>
                                                    <SafeIcon name="users" size={14} color={accentColor} />
                                                    <Text style={styles.suggestionMetaText}>
                                                        {suggestion.usage_count}× recherché
                                                    </Text>
                                                </View>
                                            ) : null}

                                            {priceText ? (
                                                <View style={styles.suggestionMetaItem}>
                                                    <SafeIcon name="tag" size={14} color={successColor} />
                                                    <Text style={styles.suggestionMetaText}>{priceText}</Text>
                                                </View>
                                            ) : null}
                                        </View>

                                        <View style={styles.suggestionApply}>
                                            <SafeIcon name="arrow-right" size={14} color="#FFFFFF" />
                                            <Text style={styles.suggestionApplyText}>Utiliser cette suggestion</Text>
                                        </View>
                                    </NativeCard>
                                );
                            })}
                        </ScrollView>
                    ) : (
                        <View style={styles.emptySuggestions}>
                            <SafeIcon name="search" size={18} color={textSecondaryColor} />
                            <Text style={styles.emptySuggestionsText}>Aucune suggestion disponible</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Bouton d'envoi - HORS DE LA ZONE DE SAISIE */}
            {showSendButton && (
                <View style={styles.sendButtonContainerExternal}>
                    <TouchableOpacity
                        style={[styles.submitButtonBottom, loading && styles.sendButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={loading || (!text.trim() && images.length === 0 && videos.length === 0 && audioUri === null && documents.length === 0 && excelFiles.length === 0)}
                    >
                        <Text style={styles.sendIcon}>🚀</Text>
                        <Text style={styles.submitButtonText}>
                            {loading ? 'Envoi...' : 'Envoyer'}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Modal GPS Moderne avec support des zones */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={(coordinatesString) => {
                    // Format: "lat,lng" pour un point ou "lat1,lng1|lat2,lng2|..." pour une zone
                    setGpsString(coordinatesString);

                    // Parser le premier point pour l'affichage
                    const firstPoint = coordinatesString.split('|')[0].split(',');
                    if (firstPoint.length === 2) {
                        const lat = parseFloat(firstPoint[0]);
                        const lng = parseFloat(firstPoint[1]);
                        setGpsData({ lat, lng });
                    }

                    setShowGPSModal(false);
                }}
                currentLocation={gpsData}
                title="Sélection de localisation GPS"
                allowZoneSelection={true}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16, // ✅ Augmenté pour un look plus moderne
        padding: 16, // ✅ Augmenté pour plus d'espace
        marginHorizontal: 0,
        marginBottom: 12, // ✅ Augmenté
        borderWidth: 2, // ✅ Rétabli à 2
        borderColor: '#E5E7EB',
        minHeight: 160, // ✅ Augmenté de 110 à 160 comme demandé
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4, // ✅ Ajout d'une ombre pour plus de profondeur
    },
    inputContainer: {
        borderRadius: 12, // ✅ Rétabli à 12
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#F9FAFB',
        marginBottom: 12, // ✅ Rétabli à 12
        minHeight: 100, // ✅ Augmenté de 65 à 100 pour plus de hauteur
    },
    textInput: {
        fontSize: 15,
        color: '#374151',
        minHeight: 50, // ✅ Réduit de 70 à 50
        maxHeight: 80, // ✅ Réduit de 120 à 80
        textAlignVertical: 'top',
        padding: 12,
        fontWeight: '500',
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end', // ✅ Compacter à droite
        alignItems: 'center',
        paddingVertical: 4, // ✅ Réduit de 6 à 4
        paddingHorizontal: 4, // ✅ Réduit de 6 à 4
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 2, // ✅ Réduit de 3 à 2
        marginBottom: 0,
    },
    sendButtonContainer: {
        paddingHorizontal: 6,
        paddingBottom: 2,
        alignItems: 'center',
        marginTop: 0,
    },
    sendButtonContainerExternal: {
        paddingHorizontal: 6,
        paddingTop: 4, // ✅ Réduit de 8 à 4
        paddingBottom: 2,
        alignItems: 'center',
        marginTop: 0, // ✅ Supprimé l'espace
    },
    actionButton: {
        flexDirection: 'column',
        alignItems: 'center',
        paddingVertical: 3, // ✅ Réduit de 4 à 3
        paddingHorizontal: 1, // ✅ Réduit de 2 à 1
        minWidth: 32, // ✅ Réduit de 40 à 32 pour compacter davantage
        borderRadius: 5,
        backgroundColor: 'transparent',
        borderWidth: 0,
        flex: 0, // ✅ Pas de flex pour compacter à droite
        marginHorizontal: 0, // ✅ Supprimé la marge pour plus de compacité
    },
    actionButtonActive: {
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: '#6366F1',
    },
    actionButtonRecording: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderColor: '#EF4444',
    },
    actionButtonText: {
        fontSize: 7, // ✅ Réduit de 9 à 7 pour compacter
        color: '#6B7280',
        fontWeight: '500',
        textAlign: 'center',
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
        color: '#F59E0B',
    },
    excelIcon: {
        fontSize: 20,
        marginRight: 8,
        color: '#3B82F6',
    },
    videoIcon: {
        fontSize: 20,
        marginRight: 8,
        color: '#EC4899',
    },
    gpsIcon: {
        fontSize: 20,
    },
    gpsIconActive: {
        color: '#4CAF50',
    },
    actionIcon: {
        fontSize: 16, // ✅ Réduit de 20 à 16 pour compacter
        marginRight: 0, // ✅ Supprimé la marge
    },
    actionIconRecording: {
        color: '#EF4444',
    },
    // Styles pour l'audio
    audioContainer: {
        marginBottom: 12,
    },
    audioItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#EF4444',
    },
    audioIcon: {
        fontSize: 20,
        marginRight: 8,
        color: '#EF4444',
    },
    audioText: {
        flex: 1,
        fontSize: 14,
        color: '#7F1D1D',
        fontWeight: '600',
    },
    // Styles pour l'enregistrement actif
    recordingActive: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        borderRadius: 16,
        padding: 16,
        borderWidth: 2,
        borderColor: '#EF4444',
        gap: 12,
    },
    recordingPulse: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#DC2626',
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordingIcon: {
        fontSize: 24,
    },
    recordingInfo: {
        flex: 1,
    },
    recordingText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#991B1B',
        marginBottom: 4,
    },
    recordingTimer: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#7F1D1D',
        fontFamily: 'monospace',
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        height: 40,
        marginRight: 8,
    },
    waveBar: {
        width: 3,
        backgroundColor: '#EF4444',
        borderRadius: 2,
    },
    stopRecordingButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#991B1B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stopRecordingIcon: {
        fontSize: 20,
        color: '#FFFFFF',
    },
    // Styles pour le bouton d'enregistrement dans la barre d'actions
    recordingButtonContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
    },
    recordingButtonPulse: {
        borderRadius: 20,
    },
    recordingButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#DC2626',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    recordingButtonIcon: {
        fontSize: 18,
    },
    recordingButtonTimer: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#DC2626',
        fontFamily: 'monospace',
    },
    // Styles pour le GPS
    gpsContainer: {
        marginBottom: 12,
    },
    gpsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D1FAE5', // Vert clair pour le GPS
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    gpsTextContainer: {
        flex: 1,
        marginLeft: 8,
    },
    gpsText: {
        fontSize: 14,
        color: '#065F46',
        fontWeight: '600',
    },
    gpsSubtext: {
        fontSize: 11,
        color: '#059669',
        marginTop: 2,
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
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    excelItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#DBEAFE',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        gap: 8,
        borderWidth: 1,
        borderColor: '#3B82F6',
    },
    videoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FCE7F3',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
        gap: 8,
        borderWidth: 1,
        borderColor: '#EC4899',
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
        backgroundColor: '#6366F1',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
        gap: 3,
        borderWidth: 1,
        borderColor: '#6366F1',
        minWidth: 70,
        flex: 1.1,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    submitButtonBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#10B981',
        paddingVertical: 10, // ✅ Réduit de 12 à 10
        paddingHorizontal: 28, // ✅ Réduit de 32 à 28
        borderRadius: 10, // ✅ Réduit de 12 à 10
        gap: 5, // ✅ Réduit de 6 à 5
        borderWidth: 1,
        borderColor: '#10B981',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 }, // ✅ Réduit shadow
        shadowOpacity: 0.3, // ✅ Réduit opacité
        shadowRadius: 4, // ✅ Réduit radius
        elevation: 4,
        marginTop: 6, // ✅ Réduit de 16 à 6 pour optimiser l'espace
    },
    submitButtonDisabled: {
        backgroundColor: '#9CA3AF',
        elevation: 0,
    },
    submitButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFF',
    },
    sendButtonCompact: {
        backgroundColor: '#20B2AA', // Turquoise/cyan cohérent
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
    // ✅ NOUVEAU: Styles pour autocomplete suggestions
    suggestionsContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginTop: 8,
        marginBottom: 12,
        maxHeight: 300,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingBottom: 8,
    },
    suggestionsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    suggestionsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
    },
    suggestionsCaption: {
        fontSize: 12,
        color: '#6B7280',
        paddingHorizontal: 16,
        paddingBottom: 8,
    },
    closeSuggestions: {
        fontSize: 20,
        color: '#6B7280',
        fontWeight: '600',
    },
    suggestionsList: {
        maxHeight: 250,
        paddingHorizontal: 12,
        paddingBottom: 12,
    },
    loadingSuggestionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    loadingSuggestionsText: {
        marginLeft: 10,
        color: '#6B7280',
        fontSize: 13,
        fontWeight: '500',
    },
    suggestionChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 12,
    },
    suggestionChip: {
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#6366F1',
    },
    suggestionChipText: {
        fontSize: 12,
        color: '#6366F1',
        fontWeight: '600',
    },
    suggestionCard: {
        marginVertical: 6,
    },
    suggestionCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    suggestionCardTitle: {
        marginLeft: 8,
        fontSize: 13,
        fontWeight: '600',
        color: '#1F2937',
    },
    suggestionMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 12,
    },
    suggestionMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 12,
        marginBottom: 8,
    },
    suggestionMetaText: {
        marginLeft: 6,
        fontSize: 12,
        color: '#4B5563',
        fontWeight: '500',
    },
    suggestionApply: {
        marginTop: 12,
        backgroundColor: '#6366F1',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
    },
    suggestionApplyText: {
        marginLeft: 8,
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
    },
    emptySuggestions: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
        gap: 8,
    },
    emptySuggestionsText: {
        marginLeft: 10,
        color: '#6B7280',
        fontSize: 12,
        fontWeight: '500',
    },
});

export default ChatInputMobile;

