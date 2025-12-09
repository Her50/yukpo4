// Remplacement des Ionicons par des emojis pour éviter les crashes
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
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
import { useLocationSafe } from '../contexts/LocationContext'; // ✅ SAFE: Pour GPS automatique (ne crash jamais)
import { useTheme } from '../contexts/ThemeContext'; // ✅ NOUVEAU: Support thème
import { useDebounce } from '../hooks/useDebounce'; // ✅ OPTIMISATION: Debounce hook
import { apiPost } from '../services/api'; // ✅ NOUVEAU: Pour autocomplete
import { uploadMultipleToCloud } from '../services/cloudUpload';
import { modernColors } from '../theme/modernTheme';
import ModernGPSModal from './ModernGPSModal'; // Utiliser ModernGPSModal pour support des zones
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
    isCreateService?: boolean; // ✅ NOUVEAU: Indique si on est en mode création de service
}

const ChatInputMobile: React.FC<ChatInputMobileProps> = React.memo(({
    onSubmit,
    loading = false,
    placeholder = 'Décrivez votre besoin ou service...',
    onGPSPress,
    showSendButton = true,
    showAutocomplete = false, // ✅ NOUVEAU
    isSearchMode = false, // ✅ NOUVEAU
    isCreateService = false // ✅ NOUVEAU
}) => {
    // ✅ SAFE: Utiliser la position GPS du contexte pour l'autocomplete (ne crash jamais)
    const { location } = useLocationSafe();
    const { colors } = useTheme(); // ✅ NOUVEAU: Support thème

    const [text, setText] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [audioUri, setAudioUri] = useState<string | null>(null);
    const [audioBase64, setAudioBase64] = useState<string | null>(null);
    const [videos, setVideos] = useState<string[]>([]);
    const [documents, setDocuments] = useState<string[]>([]); // PDFs et autres docs en base64
    const [excelFiles, setExcelFiles] = useState<string[]>([]); // Fichiers Excel en base64
    const [logo, setLogo] = useState<string[]>([]);
    const [banner, setBanner] = useState<string[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [lastRecordedDuration, setLastRecordedDuration] = useState(0);
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
        // ✅ AMÉLIORATION: Essayer plusieurs sources pour le texte de recherche
        if (Array.isArray(suggestion?.full_vector) && suggestion.full_vector.length > 0) {
            return suggestion.full_vector.filter((item: any) => item && typeof item === 'string' && item.trim().length > 0);
        }
        if (Array.isArray(suggestion?.product_vector) && suggestion.product_vector.length > 0) {
            return suggestion.product_vector.filter((item: any) => item && typeof item === 'string' && item.trim().length > 0);
        }
        // ✅ FALLBACK: Utiliser d'autres champs si les vecteurs sont vides
        if (suggestion?.combinaison_brute && typeof suggestion.combinaison_brute === 'string') {
            return [suggestion.combinaison_brute];
        }
        if (suggestion?.full_text && typeof suggestion.full_text === 'string') {
            return [suggestion.full_text];
        }
        if (suggestion?.title && typeof suggestion.title === 'string') {
            return [suggestion.title];
        }
        if (suggestion?.nom && typeof suggestion.nom === 'string') {
            return [suggestion.nom];
        }
        // ✅ DERNIER FALLBACK: Essayer de construire depuis product_labels
        if (Array.isArray(suggestion?.product_labels) && suggestion.product_labels.length > 0) {
            return suggestion.product_labels.filter((item: any) => item && typeof item === 'string' && item.trim().length > 0);
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

    const normalizeText = (value: string | null | undefined): string => {
        if (!value) {
            return '';
        }
        try {
            return value
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();
        } catch (error) {
            return value.toLowerCase();
        }
    };

    const extractBase64Value = (dataUrl: string): string => {
        if (typeof dataUrl !== 'string') {
            return '';
        }
        if (!dataUrl.startsWith('data:')) {
            return dataUrl;
        }
        const base64Index = dataUrl.indexOf('base64,');
        if (base64Index !== -1) {
            return dataUrl.substring(base64Index + 7);
        }
        return dataUrl;
    };

    // ✅ OPTIMISATION: Debounce avec hook personnalisé (gain: -80% requêtes API)
    const debouncedText = useDebounce(text, 300);

    // ✅ NOUVEAU: Autocomplete intelligente en mode recherche (optimisée avec debounce)
    useEffect(() => {
        if (!showAutocomplete || !isSearchMode) {
            setSuggestions([]);
            setShowSuggestions(false);
            setDynamicPlaceholder(null);
            return;
        }

        if (debouncedText.trim().length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            setDynamicPlaceholder(null);
            return;
        }

        const fetchSuggestions = async () => {
            setLoadingSuggestions(true);
            try {
                // ✅ CORRECTION 2025-11-06: Inclure coordonnées GPS pour résultats priorisés
                const payload: any = {
                    query: debouncedText.trim(),
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
                    const queryText = normalizeText(debouncedText.trim());

                    let filtered = normalized;
                    if (queryText.length > 0) {
                        filtered = normalized.filter((item: any) => {
                            const vectorText = normalizeText(getSuggestionVector(item).join(' '));
                            const labelsText = normalizeText(
                                Array.isArray(item?.product_labels)
                                    ? item.product_labels.join(' ')
                                    : item?.product_labels
                            );
                            const titleText = normalizeText((item?.title || item?.nom || item?.name || '') as string);
                            const aliasText = normalizeText(item?.combinaison_brute || item?.full_text);

                            return (
                                vectorText.includes(queryText) ||
                                labelsText.includes(queryText) ||
                                titleText.includes(queryText) ||
                                aliasText.includes(queryText)
                            );
                        });

                        if (filtered.length === 0) {
                            filtered = normalized;
                        }
                    }

                    setSuggestions(filtered);
                    setShowSuggestions(filtered.length > 0);

                    if (filtered.length > 0) {
                        const example = formatSuggestionExample(filtered[0]);
                        setDynamicPlaceholder(example ? `ex: ${example}` : null);
                    } else {
                        setDynamicPlaceholder(null);
                    }

                    console.log('[ChatInputMobile] 🔍 Suggestions autocomplete:', {
                        count: filtered.length,
                        withGPS: !!gpsData,
                        query: debouncedText.trim()
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
        };

        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        fetchSuggestions().catch(error => {
            console.error('[ChatInputMobile] Erreur fetchSuggestions:', error);
        });
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
    }, [debouncedText, showAutocomplete, isSearchMode, gpsData, location]);

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
            // ✅ CORRIGÉ: Utiliser 'images' as any pour compatibilité avec toutes les versions d'expo-image-picker
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: 'images' as any,
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

        // ✅ CORRIGÉ: Utiliser 'images' as any pour compatibilité avec toutes les versions d'expo-image-picker
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images' as any,
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
            setLastRecordedDuration(0);
            setAudioUri(null);
            setAudioBase64(null);
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
            const finalDurationSeconds = recordingDuration;
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

            let computedDurationSeconds = finalDurationSeconds;

            if (uri) {
                setAudioUri(uri);
                try {
                    const base64Audio = await FileSystem.readAsStringAsync(uri, {
                        encoding: FileSystem.EncodingType.Base64,
                    });
                    setAudioBase64(base64Audio);
                    console.log('[ChatInput] ✅ Audio converti en base64 (taille):', base64Audio.length);

                    try {
                        const playback = new Audio.Sound();
                        await playback.loadAsync({ uri });
                        const status = await playback.getStatusAsync();
                        if (status.isLoaded && typeof status.durationMillis === 'number') {
                            const durationFromFile = Math.max(1, Math.round(status.durationMillis / 1000));
                            computedDurationSeconds = Math.max(computedDurationSeconds, durationFromFile);
                        }
                        await playback.unloadAsync();
                    } catch (durationError) {
                        console.warn('[ChatInput] ⚠️ Impossible de déterminer la durée audio via Sound:', durationError);
                    }
                } catch (fsError) {
                    console.error('[ChatInput] ❌ Erreur conversion audio en base64:', fsError);
                    Alert.alert('Erreur', 'Impossible de traiter l\'audio enregistré.');
                    setAudioBase64(null);
                }
                console.log('✅ Audio enregistré avec succès:', uri);
            } else {
                console.warn('⚠️ Pas d\'URI audio généré');
                setAudioBase64(null);
            }

            setLastRecordedDuration(computedDurationSeconds > 0 ? computedDurationSeconds : 0);
            setRecordingDuration(0);
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
        setAudioBase64(null);
        setRecordingDuration(0);
        setLastRecordedDuration(0);
        setIsRecording(false);
    };

    const removeGPS = () => {
        setGpsData(null);
        setGpsString('');
    };

    const buildInputPayload = (overrideText?: string) => {
        const finalText = (overrideText ?? text).trim();

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

        const mapBase64 = (values: string[]): string[] =>
            values
                .filter((value) => typeof value === 'string' && value.length > 0)
                .map((value) => extractBase64Value(value));

        return {
            texte: finalText,
            text: finalText,
            base64_image: mapBase64(images),
            audio_base64: audioBase64 ? [audioBase64] : [],
            video_base64: mapBase64(videos),
            doc_base64: mapBase64(documents),
            excel_base64: mapBase64(excelFiles),
            pdf_base64: documents
                .filter((value) => typeof value === 'string' && value.includes('pdf'))
                .map((value) => extractBase64Value(value)),
            logo: mapBase64(logo),
            banner: mapBase64(banner),
            gps_mobile: gpsData ? `${gpsData.lat},${gpsData.lng}` : undefined,
            gps_zone: gpsZone,
            gps_fixe: gpsFixe || undefined,
            gps_fixe_coords: gpsFixeCoords,
        };
    };

    const resetForm = () => {
        setText('');
        setImages([]);
        setVideos([]);
        setDocuments([]);
        setExcelFiles([]);
        setLogo([]);
        setBanner([]);
        setAudioUri(null);
        setAudioBase64(null);
        setGpsData(null);
        setGpsString('');
        setRecordingDuration(0);
        setLastRecordedDuration(0);
        setSuggestions([]);
        setShowSuggestions(false);
        setDynamicPlaceholder(null);
    };

    // Soumettre
    const handleSubmit = (overrideText?: string) => {
        try {
            const finalText = (overrideText ?? text).trim();
            const hasContent = finalText || images.length > 0 || documents.length > 0 ||
                videos.length > 0 || excelFiles.length > 0 || audioBase64;

            console.log('[ChatInputMobile] 🔍 handleSubmit appelé:', {
                overrideText: overrideText,
                finalText: finalText,
                hasContent: hasContent,
                textLength: finalText.length,
                imagesCount: images.length,
                documentsCount: documents.length
            });

            if (!hasContent) {
                console.warn('[ChatInputMobile] ⚠️ Pas de contenu, abandon de la soumission');
                Alert.alert('Erreur', 'Veuillez saisir du texte ou ajouter des médias');
                return;
            }

            const input = buildInputPayload(overrideText);

            console.log('[ChatInputMobile] 📦 Payload construit:', {
                texte: input.texte,
                texteLength: input.texte?.length || 0,
                images: input.base64_image.length,
                audios: input.audio_base64.length,
                videos: input.video_base64.length,
                documents: input.doc_base64.length,
                excel: input.excel_base64.length,
                logo: input.logo.length,
                banner: input.banner.length,
                gps: !!input.gps_fixe,
                gps_mobile: input.gps_mobile
            });

            console.log('[ChatInputMobile] 📤 Appel onSubmit avec payload...');
            onSubmit(input);
            console.log('[ChatInputMobile] ✅ onSubmit appelé avec succès');
            resetForm();
        } catch (error: any) {
            console.error('[ChatInputMobile] ❌ ERREUR CRITIQUE dans handleSubmit:', {
                error: error,
                message: error?.message,
                stack: error?.stack,
                overrideText: overrideText
            });
            Alert.alert('Erreur', `Une erreur est survenue lors de la soumission: ${error?.message || 'Erreur inconnue'}`);
        }
    };

    const handleSuggestionSelect = (suggestion: any) => {
        try {
            console.log('[ChatInputMobile] 🎯 handleSuggestionSelect appelé avec:', {
                suggestion: suggestion,
                hasFullVector: !!suggestion?.full_vector,
                hasProductVector: !!suggestion?.product_vector,
                fullVectorLength: Array.isArray(suggestion?.full_vector) ? suggestion.full_vector.length : 0,
                productVectorLength: Array.isArray(suggestion?.product_vector) ? suggestion.product_vector.length : 0
            });

            const vector = getSuggestionVector(suggestion);
            console.log('[ChatInputMobile] 📊 Vecteur extrait:', {
                vectorLength: vector.length,
                vector: vector
            });

            if (!vector || vector.length === 0) {
                console.error('[ChatInputMobile] ❌ ERREUR: Vecteur vide ou invalide pour la suggestion:', suggestion);
                Alert.alert('Erreur', 'Cette suggestion ne contient pas de données valides. Veuillez en sélectionner une autre.');
                return;
            }

            const fullText = vector.join(' ').trim();
            if (!fullText) {
                console.error('[ChatInputMobile] ❌ ERREUR: Texte vide après jointure du vecteur');
                Alert.alert('Erreur', 'Impossible d\'extraire le texte de cette suggestion.');
                return;
            }

            console.log('[ChatInputMobile] ✅ Suggestion sélectionnée, texte final:', fullText);
            setShowSuggestions(false);
            setSuggestions([]);

            // ✅ CORRECTION: Appeler handleSubmit avec le texte de la suggestion
            console.log('[ChatInputMobile] 📤 Appel handleSubmit avec texte:', fullText);
            handleSubmit(fullText);
            console.log('[ChatInputMobile] ✅ handleSubmit appelé avec succès');
        } catch (error: any) {
            console.error('[ChatInputMobile] ❌ ERREUR CRITIQUE dans handleSuggestionSelect:', {
                error: error,
                message: error?.message,
                stack: error?.stack,
                suggestion: suggestion
            });
            Alert.alert('Erreur', `Une erreur est survenue lors de la sélection de la suggestion: ${error?.message || 'Erreur inconnue'}`);
        }
    };

    // ✅ NOUVEAU: Créer les styles dynamiquement avec le thème
    const dynamicStyles = React.useMemo(() => createStyles(colors), [colors]);

    return (
        <View style={dynamicStyles.container}>
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
                            <Text style={styles.audioText}>Audio enregistré ({formatDuration(lastRecordedDuration)})</Text>
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
            <View style={dynamicStyles.inputContainer}>
                <TextInput
                    style={dynamicStyles.textInput}
                    placeholder={text.length === 0 && dynamicPlaceholder ? dynamicPlaceholder : placeholder}
                    placeholderTextColor="#9CA3AF"
                    value={text}
                    onChangeText={setText}
                    multiline
                    numberOfLines={2}
                    textAlignVertical="top"
                    accessibilityLabel={isCreateService ? "Zone de saisie pour créer un service" : "Zone de saisie pour rechercher un service"}
                    accessibilityHint={isCreateService ? "Tapez votre description ou ajoutez des médias pour créer un service" : "Tapez votre recherche ou ajoutez des médias pour trouver un service"}
                />

                {/* Boutons d'action - LIGNE PRINCIPALE */}
                <View style={dynamicStyles.actionsContainer}>
                    {/* Audio - Affichage amélioré */}
                    {!isRecording ? (
                        <TouchableOpacity
                            style={[styles.actionButton, audioUri && styles.actionButtonActive]}
                            onPress={toggleRecording}
                            disabled={loading}
                            accessibilityLabel="Enregistrer un message audio"
                            accessibilityRole="button"
                            accessibilityHint="Appuyez pour commencer l'enregistrement audio"
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
                        accessibilityLabel={gpsData ? "Localisation GPS sélectionnée" : "Sélectionner une localisation GPS"}
                        accessibilityRole="button"
                        accessibilityHint="Appuyez pour ouvrir la carte et sélectionner une localisation"
                    >
                        <Text style={[styles.gpsIcon, gpsData && styles.gpsIconActive]}>
                            {gpsString.includes('|') ? '🎯' : '📍'}
                        </Text>
                        <Text style={[styles.actionButtonText, gpsData && styles.actionButtonTextActive]}>
                            {gpsData ? (gpsString.includes('|') ? 'Zone' : 'GPS') : 'GPS'}
                        </Text>
                    </TouchableOpacity>

                    {/* Photo */}
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={takePhoto}
                        disabled={loading}
                        accessibilityLabel="Prendre une photo"
                        accessibilityRole="button"
                        accessibilityHint="Ouvre l'appareil photo pour prendre une photo"
                    >
                        <Text style={styles.actionIcon}>📷</Text>
                        <Text style={styles.actionButtonText}>Photo</Text>
                    </TouchableOpacity>

                    {/* Image */}
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={pickImage}
                        disabled={loading}
                        accessibilityLabel="Sélectionner une image"
                        accessibilityRole="button"
                        accessibilityHint="Ouvre la galerie pour sélectionner une image"
                    >
                        <Text style={styles.actionIcon}>🖼️</Text>
                        <Text style={styles.actionButtonText}>Image</Text>
                    </TouchableOpacity>

                    {/* Document */}
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={pickDocument}
                        disabled={loading}
                        accessibilityLabel="Sélectionner un fichier"
                        accessibilityRole="button"
                        accessibilityHint="Ouvre le sélecteur de fichiers pour choisir un document"
                    >
                        <Text style={styles.actionIcon}>📄</Text>
                        <Text style={styles.actionButtonText}>Fichier</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ✅ NOUVEAU: Suggestions intelligentes (mode recherche uniquement) - OPTIMISÉ pour taille réduite */}
            {showAutocomplete && isSearchMode && (showSuggestions || loadingSuggestions) && (
                <View
                    style={dynamicStyles.suggestionsContainer}
                    accessibilityLabel="Suggestions de recherche"
                    accessibilityRole="list"
                >
                    <View style={dynamicStyles.suggestionsHeader}>
                        <Text
                            style={dynamicStyles.suggestionsTitle}
                            accessibilityRole="header"
                        >
                            🔥 Caractéristiques recommandées
                        </Text>
                        <TouchableOpacity
                            onPress={() => setShowSuggestions(false)}
                            accessibilityLabel="Fermer les suggestions"
                            accessibilityRole="button"
                        >
                            <Text style={styles.closeSuggestions}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    {loadingSuggestions ? (
                        <View style={styles.loadingSuggestionsRow}>
                            <ActivityIndicator size="small" color={primaryColor} />
                            <Text style={styles.loadingSuggestionsText}>Analyse en cours...</Text>
                        </View>
                    ) : suggestions.length > 0 ? (
                        <ScrollView
                            style={styles.suggestionsList}
                            contentContainerStyle={styles.suggestionsContent}
                            nestedScrollEnabled
                        >
                            {suggestions.map((suggestion, index) => {
                                const chips = getSuggestionVector(suggestion).slice(0, 6);
                                const fullText = getSuggestionVector(suggestion).join(' ');
                                const priceText = typeof suggestion?.prix === 'number'
                                    ? `${Math.round(suggestion.prix).toLocaleString()} ${suggestion?.devise || 'XAF'}`
                                    : null;

                                return (
                                    <TouchableOpacity
                                        key={`suggestion-${index}`}
                                        onPress={() => handleSuggestionSelect(suggestion)}
                                        activeOpacity={0.85}
                                        style={dynamicStyles.suggestionItem}
                                        accessibilityLabel={`Suggestion ${index + 1}: ${fullText.substring(0, 50)}`}
                                        accessibilityRole="button"
                                        accessibilityHint="Appuyez deux fois pour sélectionner cette suggestion"
                                    >
                                        <View style={styles.suggestionHeaderRow}>
                                            <Text style={styles.suggestionTitle}>Proposition {index + 1}</Text>
                                            {suggestion?.usage_count ? (
                                                <View style={styles.suggestionBadge}>
                                                    <SafeIcon name="users" size={11} color={accentColor} />
                                                    <Text style={styles.suggestionBadgeText}>
                                                        {suggestion.usage_count}× recherché
                                                    </Text>
                                                </View>
                                            ) : null}
                                        </View>

                                        <View style={styles.suggestionChipsWrap}>
                                            {chips.map((chip: string, i: number) => (
                                                <View key={`${chip}-${i}`} style={styles.suggestionChip}>
                                                    <Text style={styles.suggestionChipText}>{chip}</Text>
                                                </View>
                                            ))}
                                        </View>

                                        <View style={styles.suggestionMetaWrap}>
                                            {suggestion?.chosen_location ? (
                                                <View style={styles.suggestionMetaPill}>
                                                    <SafeIcon name="map-pin" size={12} color={primaryColor} />
                                                    <Text style={styles.suggestionMetaText}>{suggestion.chosen_location}</Text>
                                                </View>
                                            ) : null}

                                            {priceText ? (
                                                <View style={styles.suggestionMetaPill}>
                                                    <SafeIcon name="tag" size={12} color={successColor} />
                                                    <Text style={styles.suggestionMetaText}>{priceText}</Text>
                                                </View>
                                            ) : null}
                                        </View>

                                        {fullText.length > 0 && (
                                            <Text style={styles.suggestionFooterText} numberOfLines={2}>
                                                {fullText}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    ) : (
                        <View style={styles.emptySuggestions}>
                            <SafeIcon name="search" size={18} color={textSecondaryColor} />
                            <Text style={dynamicStyles.emptySuggestionsText}>Aucune suggestion disponible</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Bouton d'envoi - HORS DE LA ZONE DE SAISIE */}
            {showSendButton && (
                <View style={styles.sendButtonContainerExternal}>
                    <TouchableOpacity
                        style={[styles.submitButtonBottom, loading && styles.sendButtonDisabled]}
                        onPress={() => handleSubmit()}
                        disabled={loading || (!text.trim() && images.length === 0 && videos.length === 0 && audioUri === null && documents.length === 0 && excelFiles.length === 0)}
                        accessibilityLabel={loading ? "Envoi en cours" : (isCreateService ? "Créer un service" : "Rechercher")}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: loading || (!text.trim() && images.length === 0 && videos.length === 0 && audioUri === null && documents.length === 0 && excelFiles.length === 0) }}
                    >
                        <Text style={styles.sendIcon}>🚀</Text>
                        <Text style={[styles.submitButtonText, { color: '#FFFFFF' }]}>
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
});

// ✅ NOUVEAU: Fonction pour créer les styles avec support thème
const createStyles = (colors: any) => StyleSheet.create({
    container: {
        backgroundColor: colors.surface, // ✅ NOUVEAU: Support thème
        borderRadius: 12, // ✅ Réduit pour un look plus compact
        padding: 10, // ✅ Réduit de 16 à 10 pour compacter
        marginHorizontal: 0,
        marginBottom: 8, // ✅ Réduit de 12 à 8
        borderWidth: 1.5, // ✅ Réduit de 2 à 1.5
        borderColor: colors.border, // ✅ NOUVEAU: Support thème
        minHeight: 70, // ✅ OPTIMISÉ: 60 → 70 (équilibre entre compacité et utilisabilité)
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2, // ✅ Réduit pour un look plus subtil
    },
    inputContainer: {
        borderRadius: 8, // ✅ Réduit de 12 à 8 pour compacter
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: colors.surfaceVariant, // ✅ NOUVEAU: Support thème
        marginBottom: 8, // ✅ Réduit de 12 à 8
        minHeight: 55, // ✅ Ajusté de 50 à 55 pour meilleure lisibilité
    },
    textInput: {
        fontSize: 14, // ✅ Réduit de 15 à 14 pour compacter
        color: colors.text, // ✅ NOUVEAU: Support thème
        minHeight: 40, // ✅ Ajusté de 35 à 40 pour meilleure utilisabilité
        maxHeight: 70, // ✅ Ajusté de 60 à 70 pour permettre plus de texte
        textAlignVertical: 'top',
        padding: 8, // ✅ Réduit de 12 à 8 pour compacter
        fontWeight: '500',
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end', // ✅ Compacter à droite
        alignItems: 'center',
        paddingVertical: 2, // ✅ Réduit de 4 à 2 pour compacter
        paddingHorizontal: 2, // ✅ Réduit de 4 à 2 pour compacter
        borderTopWidth: 1,
        borderTopColor: colors.border, // ✅ NOUVEAU: Support thème
        gap: 1, // ✅ Réduit de 2 à 1 pour compacter
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
        paddingTop: 2, // ✅ Réduit de 4 à 2 pour compacter
        paddingBottom: 2,
        alignItems: 'center',
        marginTop: 0,
    },
    actionButton: {
        flexDirection: 'column',
        alignItems: 'center',
        paddingVertical: 2, // ✅ Réduit de 3 à 2 pour compacter
        paddingHorizontal: 1,
        minWidth: 28, // ✅ Réduit de 32 à 28 pour compacter davantage
        borderRadius: 4,
        backgroundColor: 'transparent',
        borderWidth: 0,
        flex: 0, // ✅ Pas de flex pour compacter à droite
        marginHorizontal: 0,
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
        fontSize: 6, // ✅ Réduit de 7 à 6 pour compacter
        color: colors.textSecondary, // ✅ NOUVEAU: Support thème
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
        fontSize: 14, // ✅ Réduit de 16 à 14 pour compacter
        marginRight: 0,
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
        paddingVertical: 8, // ✅ Réduit de 10 à 8 pour compacter
        paddingHorizontal: 20, // ✅ Réduit de 24 à 20 pour compacter
        borderRadius: 8, // ✅ Réduit de 10 à 8
        gap: 4, // ✅ Réduit de 5 à 4
        borderWidth: 1,
        borderColor: '#10B981',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
        marginTop: 0,
        flex: 1,
        minWidth: 100, // ✅ Réduit de 120 à 100 pour compacter
    },
    submitButtonDisabled: {
        backgroundColor: '#9CA3AF',
        elevation: 0,
    },
    submitButtonText: {
        fontSize: 11, // ✅ Réduit de 12 à 11 pour compacter
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
    // ✅ NOUVEAU: Styles pour autocomplete suggestions - OPTIMISÉ pour taille réduite
    suggestionsContainer: {
        backgroundColor: colors.surface, // ✅ NOUVEAU: Support thème
        borderRadius: 10, // ✅ Réduit de 12 à 10
        marginTop: 6, // ✅ Réduit de 8 à 6
        marginBottom: 8, // ✅ Réduit de 12 à 8
        maxHeight: 250, // ✅ Réduit de 300 à 250 pour s'adapter à la taille réduite
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
        borderWidth: 1,
        borderColor: colors.border, // ✅ NOUVEAU: Support thème
        paddingBottom: 6, // ✅ Réduit de 8 à 6
    },
    suggestionsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12, // ✅ Réduit de 16 à 12
        paddingVertical: 8, // ✅ Réduit de 12 à 8
        borderBottomWidth: 1,
        borderBottomColor: colors.border, // ✅ NOUVEAU: Support thème
    },
    suggestionsTitle: {
        fontSize: 12, // ✅ Réduit de 14 à 12
        fontWeight: '600',
        color: colors.text, // ✅ NOUVEAU: Support thème
    },
    closeSuggestions: {
        fontSize: 20,
        color: colors.textSecondary, // ✅ NOUVEAU: Support thème
        fontWeight: '600',
    },
    suggestionsList: {
        maxHeight: 200, // ✅ Réduit de 250 à 200
    },
    suggestionsContent: {
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
        color: colors.textSecondary, // ✅ NOUVEAU: Support thème
        fontSize: 13,
        fontWeight: '500',
    },
    suggestionItem: {
        marginBottom: 8, // ✅ Réduit de 10 à 8
        padding: 10, // ✅ Réduit de 12 à 10
        borderRadius: 10, // ✅ Réduit de 14 à 10
        borderWidth: 1,
        borderColor: colors.border, // ✅ NOUVEAU: Support thème
        backgroundColor: colors.surface, // ✅ NOUVEAU: Support thème
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    suggestionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    suggestionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
    },
    suggestionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
    },
    suggestionBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#92400E',
    },
    suggestionChipsWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
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
    suggestionMetaWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
    },
    suggestionMetaPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#F3F4F6',
        borderRadius: 999,
    },
    suggestionMetaText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#4B5563',
    },
    suggestionFooterText: {
        marginTop: 8,
        fontSize: 12,
        color: colors.textSecondary, // ✅ NOUVEAU: Support thème
        lineHeight: 16,
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
        color: colors.textSecondary, // ✅ NOUVEAU: Support thème
        fontSize: 12,
        fontWeight: '500',
    },
});

// ✅ Styles par défaut (pour compatibilité)
const styles = createStyles(modernColors);

ChatInputMobile.displayName = 'ChatInputMobile';

export default ChatInputMobile;

