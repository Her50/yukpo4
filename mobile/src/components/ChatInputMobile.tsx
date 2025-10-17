// @ts-nocheck
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
import { uploadToCloud, uploadMultipleToCloud } from '../services/cloudUpload';
import ModernGPSModal from './ModernGPSModal'; // Utiliser ModernGPSModal pour support des zones

interface ChatInputMobileProps {
    onSubmit: (input: any) => void;
    loading?: boolean;
    placeholder?: string;
    onGPSPress?: () => void;
    showSendButton?: boolean; // Nouveau prop pour contrôler l'affichage du bouton
}

const ChatInputMobile: React.FC<ChatInputMobileProps> = ({
    onSubmit,
    loading = false,
    placeholder = 'Décrivez votre besoin ou service...',
    onGPSPress,
    showSendButton = true
}) => {
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
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF" // Gris moyen pour le placeholder
                    value={text}
                    onChangeText={setText}
                    multiline
                    numberOfLines={3}
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
                            <Text style={[styles.actionIcon, audioUri && styles.actionIconActive]}>🎤</Text>
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

            {/* Bouton d'envoi - HORS DE LA ZONE DE SAISIE */}
            {showSendButton && (
                <View style={styles.sendButtonContainerExternal}>
                    <TouchableOpacity
                        style={[styles.submitButtonBottom, loading && styles.sendButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={loading || (!text.trim() && images.length === 0)}
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
        backgroundColor: '#FFFFFF', // Fond blanc pour la visibilité
        borderRadius: 16, // Rayon de bordure réduit
        padding: 16, // Padding réduit pour économiser l'espace
        marginHorizontal: 0,
        marginBottom: 12, // Marge réduite
        borderWidth: 2, // Bordure plus épaisse et raffinée
        borderColor: '#E5E7EB', // Bordure grise claire raffinée
        minHeight: 140, // Hauteur minimale réduite
        // Suppression de l'ombre
    },
    inputContainer: {
        borderRadius: 12, // Rayon de bordure réduit
        borderWidth: 1,
        borderColor: '#D1D5DB', // Bordure grise claire
        backgroundColor: '#F9FAFB', // Fond gris très clair
        marginBottom: 12, // Marge réduite
        minHeight: 80, // Hauteur minimale réduite
    },
    textInput: {
        fontSize: 15,
        color: '#374151', // Texte gris foncé pour la visibilité
        minHeight: 60, // Hauteur minimale réduite
        maxHeight: 100, // Hauteur maximale réduite
        textAlignVertical: 'top',
        padding: 12, // Padding réduit
        fontWeight: '500',
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 4,
        marginBottom: 4, // Espace réduit
    },
    sendButtonContainer: {
        paddingHorizontal: 8,
        paddingBottom: 4, // Padding réduit
        alignItems: 'center',
        marginTop: 2,
    },
    sendButtonContainerExternal: {
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: 4,
        alignItems: 'center',
        marginTop: 4,
    },
    actionButton: {
        flexDirection: 'column',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 3,
        minWidth: 45,
        borderRadius: 6,
        backgroundColor: 'transparent', // Suppression du fond
        borderWidth: 0, // Suppression de la bordure
        flex: 1,
        marginHorizontal: 1,
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
        fontSize: 9,
        color: 'rgba(255, 255, 255, 0.8)',
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
        fontSize: 20,
        marginRight: 4,
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
        backgroundColor: '#10B981', // Vert moderne au lieu du turquoise
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 12,
        gap: 6,
        borderWidth: 1,
        borderColor: '#10B981',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 6,
        marginTop: 16, // Remonte le bouton pour qu'il ne soit pas trop bas
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
});

export default ChatInputMobile;

