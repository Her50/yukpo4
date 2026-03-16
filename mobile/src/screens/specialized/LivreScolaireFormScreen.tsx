// ✅ Formulaire de création/édition d'un livre scolaire (Mobile)

import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { ConfirmationSection } from '../../components/FormConfirmationModal';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import { useToaster } from '../../components/ToasterProvider';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { useAIWithFallback } from '../../hooks/useAIWithFallback';
import { useFormAutoSave } from '../../hooks/useFormAutoSave';
import { useFormValidation } from '../../hooks/useFormValidation';
import { usePartnerData } from '../../hooks/usePartnerData';
import { apiGet, apiPost, apiPut } from '../../services/api';
import { BookImageAnalysis, livreScolaireService } from '../../services/livreScolaireService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

const STORAGE_KEY = '@livre_scolaire_form';

const niveaux = ['Primaire', t('livreScolaireFormScreen.college'), t('livreScolaireFormScreen.lycee')];
const etats = ['Neuf', 'Très bon', 'Bon', 'Acceptable'];

const LivreScolaireFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const { location } = useLocation();
    const toaster = useToaster();
    const { callWithFallback } = useAIWithFallback();
    const params = route.params as any;
    const mode = params?.mode || 'create';
    const livreId = params?.livreId as number | undefined;

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        titre: '',
        auteur: '',
        editeur: '',
        isbn: '',
        classe_actuelle: '',
        classe_souhaitee: '',
        matiere: '',
        niveau: '',
        etat_livre: '',
        description_etat: '',
        ville: '',
        quartier: null as LocationObject | null,
    });

    const [selectedGPS, setSelectedGPS] = useState<string | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [imageBase64List, setImageBase64List] = useState<string[]>([]);
    const [analyzingImage, setAnalyzingImage] = useState(false);
    const [showImagePickerModal, setShowImagePickerModal] = useState(false);
    const [showIAAnalysisModal, setShowIAAnalysisModal] = useState(false);
    const [iaAnalysisResult, setIAAnalysisResult] = useState<BookImageAnalysis | null>(null);
    const [showConfirmation, setShowConfirmation] = useState(false);

    const { partnerData } = usePartnerData(user?.role);
    const { errors, validateField, validateForm, setError } = useFormValidation({
        titre: { required: true, minLength: 3 },
        classe_actuelle: { required: true },
        matiere: { required: true },
    });

    useFormAutoSave(STORAGE_KEY, formData, mode !== 'edit', 1000);

    useEffect(() => {
        if (mode === 'edit' && livreId) {
            loadLivreData();
        } else if (location?.coords) {
            // Pré-remplir GPS avec position actuelle
            const lat = location.coords.latitude;
            const lng = location.coords.longitude;
            setSelectedGPS(`${lat},${lng}`);
        }
    }, [mode, livreId]);

    const loadLivreData = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/bourse-livre/${livreId}`);

            const r = response.data as any;
            if (response.success && r?.livre) {
                const livre = r.livre;
                setFormData({
                    titre: livre.titre || '',
                    auteur: livre.auteur || '',
                    editeur: livre.editeur || '',
                    isbn: livre.isbn || '',
                    classe_actuelle: livre.classe_actuelle || '',
                    classe_souhaitee: livre.classe_souhaitee || '',
                    matiere: livre.matiere || '',
                    niveau: livre.niveau || '',
                    etat_livre: livre.etat_livre || '',
                    description_etat: livre.description_etat || '',
                    ville: livre.ville || '',
                    quartier: livre.quartier ? { raw: livre.quartier, place_name: livre.quartier } : null,
                });
                if (livre.gps) {
                    setSelectedGPS(livre.gps);
                }
            }
        } catch (error: any) {
            console.error('[LivreScolaireFormScreen] Erreur chargement:', error);
            Alert.alert(t('message.error'), t('livreScolaire.cannotLoadBook'));
        } finally {
            setLoading(false);
        }
    };

    const handleGPSSelect = (coordinates: string) => {
        setSelectedGPS(coordinates);
        setShowGPSModal(false);
    };

    const handleFieldChange = (field: string, value: any) => {
        setFormData({ ...formData, [field]: value });
        const error = validateField(field, value);
        if (error) {
            setError(field, error);
        }
    };

    const confirmationSections: ConfirmationSection[] = [
        {
            title: 'Livre',
            icon: 'book',
            fields: [
                { label: 'Titre', value: formData.titre },
                { label: 'Auteur', value: formData.auteur },
                { label: t('livreScolaireForm.editeur'), value: formData.editeur },
                { label: 'ISBN', value: formData.isbn },
            ],
        },
        {
            title: 'Classe',
            icon: 'book-open',
            fields: [
                { label: 'Classe actuelle', value: formData.classe_actuelle },
                { label: t('livreScolaireForm.classeSouhaitee'), value: formData.classe_souhaitee },
                { label: t('livreScolaireForm.matiere'), value: formData.matiere },
                { label: 'Niveau', value: formData.niveau },
            ],
        },
        {
            title: t('livreScolaireForm.etat'),
            icon: 'info',
            fields: [
                { label: t('livreScolaireForm.etat'), value: formData.etat_livre },
                { label: t('livreScolaireFormScreen.description'), value: formData.description_etat },
            ],
        },
        {
            title: t('livreScolaireForm.localisation'),
            icon: 'map-pin',
            fields: [
                { label: t('livreScolaireForm.ville'), value: formData.ville },
                { label: t('livreScolaireForm.quartier'), value: typeof formData.quartier === 'string' ? formData.quartier : formData.quartier?.place_name },
            ],
        },
    ];

    // ✅ NOUVEAU: Demander permission caméra
    useEffect(() => {
        (async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                console.log('Permission caméra non accordée');
            }
        })();
    }, []);

    // ✅ NOUVEAU: Prendre une photo avec l'appareil photo
    const handleTakePhoto = async () => {
        hapticPress();
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('livreScolaire.permissionRequired'), t('livreScolaire.allowCamera'));
            return;
        }

        try {
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                const newImages = [...selectedImages, asset.uri];
                setSelectedImages(newImages);

                if (asset.base64) {
                    const base64Image = `data:image/jpeg;base64,${asset.base64}`;
                    const newBase64List = [...imageBase64List, base64Image];
                    setImageBase64List(newBase64List);

                    // Analyser automatiquement la première image
                    if (imageBase64List.length === 0) {
                        await analyzeImage(base64Image);
                    }
                }
            }
        } catch (error: any) {
            console.error('[LivreScolaireFormScreen] Erreur prise photo:', error);
            Alert.alert(t('message.error'), t('livreScolaire.cannotTakePhoto'));
        }
    };

    // ✅ NOUVEAU: Sélectionner une image depuis la galerie
    const handlePickImage = async () => {
        hapticPress();
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('livreScolaire.permissionRequired'), t('livreScolaire.allowGallery'));
            return;
        }

        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.8,
                base64: true,
                allowsMultipleSelection: true,
            });

            if (!result.canceled && result.assets.length > 0) {
                const newUris: string[] = [];
                const newBase64: string[] = [];

                for (const asset of result.assets) {
                    newUris.push(asset.uri);
                    if (asset.base64) {
                        const base64Image = `data:image/jpeg;base64,${asset.base64}`;
                        newBase64.push(base64Image);
                    }
                }

                setSelectedImages([...selectedImages, ...newUris]);
                const updatedBase64 = [...imageBase64List, ...newBase64];
                setImageBase64List(updatedBase64);

                // Analyser automatiquement la première image si c'est la première
                if (imageBase64List.length === 0 && newBase64.length > 0) {
                    await analyzeImage(newBase64[0]);
                }
            }
        } catch (error: any) {
            console.error('[LivreScolaireFormScreen] Erreur sélection image:', error);
            Alert.alert(t('message.error'), t('livreScolaire.cannotSelectImage'));
        }
    };

    // ✅ REFONDU: Analyser l'image avec l'IA + fallback 3 niveaux
    const analyzeImage = async (imageBase64: string) => {
        setAnalyzingImage(true);

        const result = await callWithFallback(
            async () => {
                const response = await livreScolaireService.analyzeBookImage(
                    imageBase64,
                    location?.coords?.latitude,
                    location?.coords?.longitude
                );
                const r = response.data as any;
                if (response.success && r?.book_info) {
                    return r.book_info as BookImageAnalysis;
                }
                return null;
            },
            'livre_analyse_image',
            t('livreScolaireFormScreen.analyserImageDeLivreScolairePour'),
            () => ({
                titre: '',
                auteur: '',
                editeur: '',
                isbn: '',
                classe_actuelle: '',
                classe_souhaitee: '',
                matiere: '',
                niveau: '',
                etat_livre: 'Bon',
                description_etat: t('livreScolaireFormScreen.etatNonDetermineParLiaVeuillezVerifier'),
                confidence: 0.1,
            } as BookImageAnalysis)
        );

        if (result.success && result.data) {
            const bookInfo = result.data;
            setIAAnalysisResult(bookInfo);

            setFormData({
                ...formData,
                titre: bookInfo.titre || formData.titre,
                auteur: bookInfo.auteur || formData.auteur,
                editeur: bookInfo.editeur || formData.editeur,
                isbn: bookInfo.isbn || formData.isbn,
                classe_actuelle: bookInfo.classe_actuelle || formData.classe_actuelle,
                classe_souhaitee: bookInfo.classe_souhaitee || formData.classe_souhaitee,
                matiere: bookInfo.matiere || formData.matiere,
                niveau: bookInfo.niveau || formData.niveau,
                etat_livre: bookInfo.etat_livre || formData.etat_livre,
                description_etat: bookInfo.description_etat || formData.description_etat,
            });

            if (result.source === 'local') {
                toaster.warning('Analyse IA indisponible — veuillez remplir le formulaire manuellement.');
            } else {
                toaster.success(
                    t('livreScolaireFormScreen.analyseTermineeDeConfianceVerifiezLes', { ((bookInfo_confidence || 0) * 100)_toFixed(0): ((bookInfo.confidence || 0) * 100).toFixed(0) })
                );
                setShowIAAnalysisModal(true);
            }
        } else {
            toaster.error('Impossible d\'analyser l\'image. Veuillez remplir le formulaire manuellement.');
        }

        setAnalyzingImage(false);
    };

    // ✅ NOUVEAU: Appliquer les données de l'IA au formulaire
    const applyIAAnalysis = () => {
        if (iaAnalysisResult) {
            setFormData({
                ...formData,
                titre: iaAnalysisResult.titre || formData.titre,
                auteur: iaAnalysisResult.auteur || formData.auteur,
                editeur: iaAnalysisResult.editeur || formData.editeur,
                isbn: iaAnalysisResult.isbn || formData.isbn,
                classe_actuelle: iaAnalysisResult.classe_actuelle || formData.classe_actuelle,
                classe_souhaitee: iaAnalysisResult.classe_souhaitee || formData.classe_souhaitee,
                matiere: iaAnalysisResult.matiere || formData.matiere,
                niveau: iaAnalysisResult.niveau || formData.niveau,
                etat_livre: iaAnalysisResult.etat_livre || formData.etat_livre,
                description_etat: iaAnalysisResult.description_etat || formData.description_etat,
            });
            setShowIAAnalysisModal(false);
            toaster.success(t('livreScolaireFormScreen.informationsAppliqueesAuFormulaire'));
        }
    };

    // ✅ NOUVEAU: Supprimer une image
    const handleRemoveImage = (index: number) => {
        hapticPress();
        const newImages = selectedImages.filter((_, i) => i !== index);
        const newBase64 = imageBase64List.filter((_, i) => i !== index);
        setSelectedImages(newImages);
        setImageBase64List(newBase64);
    };

    const handleSubmit = () => {
        if (!validateForm(formData)) {
            Alert.alert(t('message.error'), t('livreScolaire.fixFormErrors'));
            return;
        }
        setShowConfirmation(true);
    };

    const handleFinalSubmit = async () => {
        // Validation
        if (!formData.titre.trim()) {
            Alert.alert(t('message.error'), t('livreScolaire.titleRequired'));
            return;
        }
        if (!formData.classe_actuelle.trim()) {
            Alert.alert(t('message.error'), t('livreScolaire.currentClassRequired'));
            return;
        }
        if (!formData.classe_souhaitee.trim()) {
            Alert.alert(t('message.error'), t('livreScolaire.desiredClassRequired'));
            return;
        }
        if (!formData.matiere.trim()) {
            Alert.alert(t('message.error'), t('livreScolaire.subjectRequired'));
            return;
        }
        if (!formData.etat_livre.trim()) {
            Alert.alert(t('message.error'), t('livreScolaire.bookConditionRequired'));
            return;
        }

        try {
            setLoading(true);

            // ✅ NOUVEAU: Uploader les images d'abord si présentes
            let imageUrls: string[] = [];
            if (imageBase64List.length > 0) {
                try {
                    // Uploader chaque image
                    for (const base64Image of imageBase64List) {
                        const uploadResponse = await apiPost<{ success: boolean; url: string }>(
                            '/api/media/upload',
                            {
                                file: base64Image,
                                type: 'image',
                                folder: 'livres-scolaires',
                            }
                        );
                        const ur = uploadResponse.data as any;
                        if (uploadResponse.success && ur?.url) {
                            imageUrls.push(ur.url);
                        }
                    }
                } catch (uploadError: any) {
                    console.error('[LivreScolaireFormScreen] Erreur upload images:', uploadError);
                    // Continuer même si l'upload échoue
                }
            }

            const payload: any = {
                titre: formData.titre.trim(),
                auteur: formData.auteur.trim() || null,
                editeur: formData.editeur.trim() || null,
                isbn: formData.isbn.trim() || null,
                classe_actuelle: formData.classe_actuelle.trim(),
                classe_souhaitee: formData.classe_souhaitee.trim(),
                matiere: formData.matiere.trim(),
                niveau: formData.niveau.trim() || null,
                etat_livre: formData.etat_livre.trim(),
                description_etat: formData.description_etat.trim() || null,
                ville: formData.quartier?.raw || formData.ville.trim() || null,
                quartier: formData.quartier?.raw || null,
                gps: selectedGPS || (location?.coords
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null),
                images_urls: imageUrls.length > 0 ? imageUrls : undefined, // ✅ NOUVEAU: Inclure les URLs des images
            };

            let response;
            if (mode === 'edit' && livreId) {
                response = await apiPut(`/api/bourse-livre/${livreId}`, payload);
            } else {
                response = await apiPost('/api/bourse-livre', payload);
            }

            if (response.success) {
                Alert.alert(
                    t('message.success'),
                    mode === 'edit' ? t('livreScolaire.bookUpdated') : t('livreScolaire.bookCreated'),
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack(),
                        },
                    ]
                );
            } else {
                Alert.alert(t('message.error'), response.error || t('livreScolaire.genericError'));
            }
        } catch (error: any) {
            console.error('[LivreScolaireFormScreen] Erreur:', error);
            Alert.alert(t('message.error'), error.message || t('livreScolaire.genericError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <KeyboardAwareScreen style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>
                        {mode === 'edit' ? 'Modifier le livre' : t('livreScolaireFormScreen.creerUnLivre')}
                    </Text>
                </View>

                <View style={styles.form}>
                    {/* Titre */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Titre du livre *</Text>
                        <NativeInput
                            value={formData.titre}
                            onChangeText={(text) => setFormData({ ...formData, titre: text })}
                            placeholder={t('livreScolaireForm.exMathematiques6eme')}
                        />
                    </View>

                    {/* Auteur */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Auteur</Text>
                        <NativeInput
                            value={formData.auteur}
                            onChangeText={(text) => setFormData({ ...formData, auteur: text })}
                            placeholder={t('livreScolaireForm.nomDeL')}auteur"
                        />
                    </View>

                    {/* Éditeur */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('livreScolaireForm.editeur')}</Text>
                        <NativeInput
                            value={formData.editeur}
                            onChangeText={(text) => setFormData({ ...formData, editeur: text })}
                            placeholder="Ex: Hachette, Nathan"
                        />
                    </View>

                    {/* ISBN */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>ISBN</Text>
                        <NativeInput
                            value={formData.isbn}
                            onChangeText={(text) => setFormData({ ...formData, isbn: text })}
                            placeholder={t('livreScolaireForm.numeroIsbnOptionnel')}
                            keyboardType="numeric"
                        />
                    </View>

                    {/* Classe actuelle */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Classe actuelle *</Text>
                        <NativeInput
                            value={formData.classe_actuelle}
                            onChangeText={(text) => setFormData({ ...formData, classe_actuelle: text })}
                            placeholder={t('livreScolaireForm.ex6eme5emeTerminale')}
                        />
                    </View>

                    {/* Classe souhaitée */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('livreScolaireForm.classeSouhaitee')}</Text>
                        <NativeInput
                            value={formData.classe_souhaitee}
                            onChangeText={(text) => setFormData({ ...formData, classe_souhaitee: text })}
                            placeholder={t('livreScolaireForm.ex5eme4eme1ere')}
                        />
                    </View>

                    {/* Matière */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('livreScolaireForm.matiere')}</Text>
                        <NativeInput
                            value={formData.matiere}
                            onChangeText={(text) => setFormData({ ...formData, matiere: text })}
                            placeholder={t('livreScolaireForm.exMathematiquesFrancais')}
                        />
                    </View>

                    {/* Niveau */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Niveau</Text>
                        <View style={styles.chipContainer}>
                            {niveaux.map((n) => (
                                <TouchableOpacity
                                    key={n}
                                    style={[
                                        styles.chip,
                                        formData.niveau === n && styles.chipSelected
                                    ]}
                                    onPress={() => setFormData({
                                        ...formData,
                                        niveau: formData.niveau === n ? '' : n
                                    })}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        formData.niveau === n && styles.chipTextSelected
                                    ]}>
                                        {n}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* État du livre */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('livreScolaireForm.etatDuLivre')}</Text>
                        <View style={styles.chipContainer}>
                            {etats.map((etat) => (
                                <TouchableOpacity
                                    key={etat}
                                    style={[
                                        styles.chip,
                                        formData.etat_livre === etat && styles.chipSelected
                                    ]}
                                    onPress={() => setFormData({
                                        ...formData,
                                        etat_livre: formData.etat_livre === etat ? '' : etat
                                    })}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        formData.etat_livre === etat && styles.chipTextSelected
                                    ]}>
                                        {etat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Description de l'état */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('livreScolaireForm.descriptionDeLetat')}</Text>
                        <NativeInput
                            value={formData.description_etat}
                            onChangeText={(text) => setFormData({ ...formData, description_etat: text })}
                            placeholder={t('livreScolaireForm.decrivezL')}état du livre en détail..."
                            multiline
                            numberOfLines={4}
                        />
                    </View>

                    {/* ✅ NOUVEAU: Section Upload d'images */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('livreScolaireForm.photosDuLivre')}/Text>
                        <Text style={styles.labelSubtext}>
                            Prenez une photo ou sélectionnez depuis la galerie. L'IA analysera automatiquement la première image.
                        </Text>

                        {/* Boutons d'action */}
                        <View style={styles.imageActions}>
                            <TouchableOpacity
                                style={styles.imageActionButton}
                                onPress={handleTakePhoto}
                            >
                                <SafeIcon name="camera" size={20} color="#fff" type="lucide" />
                                <Text style={styles.imageActionText}>Prendre une photo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.imageActionButton, styles.imageActionButtonSecondary]}
                                onPress={handlePickImage}
                            >
                                <SafeIcon name="image" size={20} color={modernColors.primary} type="lucide" />
                                <Text style={[styles.imageActionText, styles.imageActionTextSecondary]}>
                                    Galerie
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Indicateur d'analyse */}
                        {analyzingImage && (
                            <View style={styles.analyzingContainer}>
                                <ActivityIndicator size="small" color={modernColors.primary} />
                                <Text style={styles.analyzingText}>
                                    Analyse de l'image en cours par l'IA...
                                </Text>
                            </View>
                        )}

                        {/* Aperçu des images sélectionnées */}
                        {selectedImages.length > 0 && (
                            <View style={styles.imagesPreview}>
                                {selectedImages.map((uri, index) => (
                                    <View key={index} style={styles.imagePreviewItem}>
                                        <Image source={{ uri }} style={styles.imagePreview} />
                                        <TouchableOpacity
                                            style={styles.removeImageButton}
                                            onPress={() => handleRemoveImage(index)}
                                        >
                                            <SafeIcon name="x" size={16} color="#fff" type="lucide" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Localisation */}
                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label={t('livreScolaireForm.quartier')}
                            value={formData.quartier ? (typeof formData.quartier === 'string' ? { raw: formData.quartier, place_name: formData.quartier } : formData.quartier) : ''}
                            onSelect={(location: LocationObject) => {
                                // ✅ CORRECTION: Stocker le LocationObject directement
                                setFormData({
                                    ...formData,
                                    quartier: location,
                                    // ✅ NOUVEAU: Extraire automatiquement ville si disponible
                                    ville: location.components?.ville || formData.ville,
                                });
                            }}
                            placeholder={t('livreScolaireForm.rechercherUnLieuVilleQuartier')}
                            scope="all"
                        />
                    </View>

                    {/* ✅ NOUVEAU: Section Statistiques (si livre existe) */}
                    {livreId && (
                        <View style={styles.statsSection}>
                            <View style={styles.sectionHeader}>
                                <SafeIcon name="bar-chart" size={20} color={modernColors.primary} type="lucide" />
                                <Text style={styles.sectionTitle}>Informations</Text>
                            </View>
                            <View style={styles.statsContainer}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{formData.niveau || 'N/A'}</Text>
                                    <Text style={styles.statLabel}>Niveau</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{formData.etat_livre || 'N/A'}</Text>
                                    <Text style={styles.statLabel}>{t('livreScolaireForm.etat')}</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>
                                        {formData.classe_actuelle ? 'Oui' : 'Non'}
                                    </Text>
                                    <Text style={styles.statLabel}>{t('livreScolaireForm.echange')}</Text>
                                </View>
                            </View>
                            {formData.classe_actuelle && formData.classe_souhaitee && (
                                <View style={styles.exchangeInfo}>
                                    <SafeIcon name="repeat" size={16} color={modernColors.primary} type="lucide" />
                                    <Text style={styles.exchangeInfoText}>
                                        {formData.classe_actuelle} → {formData.classe_souhaitee}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* GPS */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('livreScolaireForm.positionGps')}/Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => setShowGPSModal(true)}
                        >
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <Text style={styles.gpsButtonText}>
                                {selectedGPS ? t('livreScolaireFormScreen.localisationSelectionnee') : 'Sélectionner sur la carte'}
                            </Text>
                            <SafeIcon name="chevron-right" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                        {selectedGPS && (
                            <Text style={styles.gpsText}>{selectedGPS}</Text>
                        )}
                    </View>

                    {/* Bouton de soumission */}
                    <NativeButton
                        title={mode === 'edit' ? '💾 Enregistrer les modifications' : t('livreScolaireFormScreen.creerLeLivre')}
                        variant="primary"
                        onPress={handleSubmit}
                        style={styles.submitButton}
                        disabled={loading || analyzingImage}
                    />
                </View>
            </KeyboardAwareScreen>

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={selectedGPS as any}
            />

            {/* ✅ NOUVEAU: Modal d'affichage des résultats de l'analyse IA */}
            <Modal
                visible={showIAAnalysisModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowIAAnalysisModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={styles.modalHeaderLeft}>
                                <SafeIcon name="sparkles" size={24} color={modernColors.primary} type="lucide" />
                                <Text style={styles.modalTitle}>{t('livreScolaireForm.analyseIaTerminee')}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowIAAnalysisModal(false)}
                                style={styles.modalCloseButton}
                            >
                                <SafeIcon name="x" size={24} color="#6B7280" type="lucide" />
                            </TouchableOpacity>
                        </View>

                        {iaAnalysisResult && (
                            <View style={styles.modalBody}>
                                <View style={styles.confidenceBadge}>
                                    <SafeIcon name="check-circle" size={20} color="#10B981" type="lucide" />
                                    <Text style={styles.confidenceText}>
                                        Confiance: {(iaAnalysisResult.confidence * 100).toFixed(0)}%
                                    </Text>
                                </View>

                                <View style={styles.analysisResults}>
                                    <Text style={styles.analysisSectionTitle}>{t('livreScolaireForm.informationsExtraites')}/Text>

                                    {iaAnalysisResult.titre && (
                                        <View style={styles.analysisItem}>
                                            <Text style={styles.analysisLabel}>Titre :</Text>
                                            <Text style={styles.analysisValue}>{iaAnalysisResult.titre}</Text>
                                        </View>
                                    )}

                                    {iaAnalysisResult.auteur && (
                                        <View style={styles.analysisItem}>
                                            <Text style={styles.analysisLabel}>Auteur :</Text>
                                            <Text style={styles.analysisValue}>{iaAnalysisResult.auteur}</Text>
                                        </View>
                                    )}

                                    {iaAnalysisResult.editeur && (
                                        <View style={styles.analysisItem}>
                                            <Text style={styles.analysisLabel}>{t('livreScolaireForm.editeur')}</Text>
                                            <Text style={styles.analysisValue}>{iaAnalysisResult.editeur}</Text>
                                        </View>
                                    )}

                                    {iaAnalysisResult.isbn && (
                                        <View style={styles.analysisItem}>
                                            <Text style={styles.analysisLabel}>ISBN :</Text>
                                            <Text style={styles.analysisValue}>{iaAnalysisResult.isbn}</Text>
                                        </View>
                                    )}

                                    {iaAnalysisResult.matiere && (
                                        <View style={styles.analysisItem}>
                                            <Text style={styles.analysisLabel}>{t('livreScolaireForm.matiere')}</Text>
                                            <Text style={styles.analysisValue}>{iaAnalysisResult.matiere}</Text>
                                        </View>
                                    )}

                                    {iaAnalysisResult.niveau && (
                                        <View style={styles.analysisItem}>
                                            <Text style={styles.analysisLabel}>Niveau :</Text>
                                            <Text style={styles.analysisValue}>{iaAnalysisResult.niveau}</Text>
                                        </View>
                                    )}

                                    {iaAnalysisResult.classe_actuelle && (
                                        <View style={styles.analysisItem}>
                                            <Text style={styles.analysisLabel}>Classe actuelle :</Text>
                                            <Text style={styles.analysisValue}>{iaAnalysisResult.classe_actuelle}</Text>
                                        </View>
                                    )}

                                    {iaAnalysisResult.classe_souhaitee && (
                                        <View style={styles.analysisItem}>
                                            <Text style={styles.analysisLabel}>{t('livreScolaireForm.classeSouhaitee')}</Text>
                                            <Text style={styles.analysisValue}>{iaAnalysisResult.classe_souhaitee}</Text>
                                        </View>
                                    )}

                                    {iaAnalysisResult.etat_livre && (
                                        <View style={styles.analysisItem}>
                                            <Text style={styles.analysisLabel}>{t('livreScolaireForm.etat')}</Text>
                                            <Text style={styles.analysisValue}>{iaAnalysisResult.etat_livre}</Text>
                                        </View>
                                    )}

                                    {iaAnalysisResult.description_etat && (
                                        <View style={styles.analysisItem}>
                                            <Text style={styles.analysisLabel}>Description :</Text>
                                            <Text style={styles.analysisValue}>{iaAnalysisResult.description_etat}</Text>
                                        </View>
                                    )}

                                    {iaAnalysisResult.notes && (
                                        <View style={styles.analysisItem}>
                                            <Text style={styles.analysisLabel}>{t('livreScolaireForm.notes')}/Text>
                                            <Text style={styles.analysisValue}>{iaAnalysisResult.notes}</Text>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.modalActions}>
                                    <TouchableOpacity
                                        style={styles.modalButtonSecondary}
                                        onPress={() => setShowIAAnalysisModal(false)}
                                    >
                                        <Text style={styles.modalButtonTextSecondary}>{t('livreScolaireFormScreen.fermer')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.modalButtonPrimary}
                                        onPress={applyIAAnalysis}
                                    >
                                        <Text style={styles.modalButtonTextPrimary}>Appliquer au formulaire</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
        padding: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    form: {
        padding: 16,
        gap: 16,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    chipSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    chipText: {
        fontSize: 14,
        color: '#374151',
    },
    chipTextSelected: {
        color: '#FFF',
        fontWeight: '600',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
    },
    gpsText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    submitButton: {
        marginTop: 8,
    },
    // ✅ NOUVEAU: Styles pour section statistiques
    statsSection: {
        marginTop: 24,
        marginBottom: 16,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        marginBottom: 12,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 11,
        color: '#6B7280',
        textAlign: 'center',
    },
    statDivider: {
        width: 1,
        height: 35,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 8,
    },
    exchangeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#EEF2FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    exchangeInfoText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '500',
    },
    // ✅ NOUVEAU: Styles pour upload d'images
    labelSubtext: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
        marginBottom: 12,
    },
    imageActions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    imageActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        gap: 8,
    },
    imageActionButtonSecondary: {
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    imageActionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    imageActionTextSecondary: {
        color: modernColors.primary,
    },
    analyzingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
        marginBottom: 16,
    },
    analyzingText: {
        fontSize: 14,
        color: modernColors.primary,
    },
    imagesPreview: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 12,
    },
    imagePreviewItem: {
        position: 'relative',
        width: 100,
        height: 100,
        borderRadius: 8,
        overflow: 'hidden',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    removeImageButton: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ✅ NOUVEAU: Styles pour modal d'analyse IA
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        paddingBottom: 32,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalCloseButton: {
        padding: 4,
    },
    modalBody: {
        padding: 20,
    },
    confidenceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#D1FAE5',
        borderRadius: 12,
        marginBottom: 20,
    },
    confidenceText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#065F46',
    },
    analysisResults: {
        marginBottom: 24,
    },
    analysisSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    analysisItem: {
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    analysisLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 4,
    },
    analysisValue: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '500',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    modalButtonSecondary: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    modalButtonTextSecondary: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
    },
    modalButtonPrimary: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
    },
    modalButtonTextPrimary: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default LivreScolaireFormScreen;

