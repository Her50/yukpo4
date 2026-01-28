// ✅ NOUVEAU: Écran de création/édition de biens immobiliers (accessible à tous les utilisateurs)

import { useNavigation, useRoute } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiGet, apiPost, servicesApi } from '../../services/api';
import { googlePlacesMediaService } from '../../services/googlePlacesMediaService';
import { uploadFiles } from '../../services/uploadApi';
import { modernColors } from '../../theme/modernTheme';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';
import { useCurrencyDetection, getCurrencyFromGPS } from '../../hooks/useCurrencyDetection';
import MediaUploader, { MediaItem } from '../../components/specialized/MediaUploader';

const ImmobilierFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const propertyId = (route.params as any)?.propertyId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;

    const [formData, setFormData] = useState({
        titre: '',
        description: '',
        type_bien: 'maison',
        statut: 'vente',
        adresse: '',
        quartier: null as LocationObject | null,
        ville: null as LocationObject | null,
        superficie_m2: '',
        nb_chambres: '',
        nb_salles_bain: '',
        standing: '',
        etat_general: '',
        prix_vente: '',
        prix_location_mensuel: '',
    });

    const [loading, setLoading] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedGPS, setSelectedGPS] = useState<string | null>(null);
    
    // ✅ NOUVEAU: Détection automatique de devise depuis GPS/localisation
    const defaultCurrency = useCurrencyDetection(formData.ville || formData.quartier);
    const [devise, setDevise] = useState(defaultCurrency);
    
    // ✅ NOUVEAU: Gestion des médias (images et vidéos)
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [importingGoogleMedia, setImportingGoogleMedia] = useState(false);
    const [lastImportedPlaceId, setLastImportedPlaceId] = useState<string | null>(null);

    const typesBien = ['maison', 'appartement', 'terrain', 'bureau', 'local_commercial'];
    const statuts = ['vente', 'location', 'les_deux'];
    const standings = ['économique', 'moyen', 'haut_de_gamme', 'luxe'];
    const etatsGeneraux = ['neuf', 'bon_etat', 'à_rénover', 'rénové'];

    // ✅ Créer automatiquement un service si serviceId manquant
    useEffect(() => {
        const createServiceIfNeeded = async () => {
            if (!serviceId && user?.id && formData.titre) {
                try {
                    const serviceData = {
                        titre_service: formData.titre || 'Bien immobilier',
                        description: `Bien immobilier: ${formData.type_bien}`,
                        category: 'immobilier',
                        specialized_type: 'immobilier',
                    };

                    const response = await servicesApi.createService(serviceData);
                    if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                        setServiceId((response.data as any).id);
                    }
                } catch (error: any) {
                    console.error('[ImmobilierFormScreen] Erreur création service:', error);
                }
            }
        };

        if (!serviceId && formData.titre) {
            createServiceIfNeeded();
        }
    }, [formData.titre, serviceId, user?.id]);

    // ✅ Récupération automatique de la devise depuis ville ou quartier (avec GPS comme fallback)
    useEffect(() => {
        const locationSource = formData.ville || formData.quartier;
        if (locationSource) {
            const currency = getCurrencyIntelligently(locationSource, location?.coords ? {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
            } : null);
            if (currency) {
                setDevise(currency);
            }
        } else if (location?.coords) {
            // ✅ CORRIGÉ: Utiliser getCurrencyFromGPS au lieu de useCurrencyDetection dans useEffect
            const gpsCurrency = getCurrencyFromGPS({
                lat: location.coords.latitude,
                lng: location.coords.longitude,
            });
            setDevise(gpsCurrency);
        }
    }, [formData.ville, formData.quartier, location]);

    // ✅ Charger les données existantes si mode='edit'
    useEffect(() => {
        const loadExistingData = async () => {
            if (mode === 'edit' && propertyId) {
                try {
                    setLoading(true);
                    const response = await apiGet(`/api/immobilier/biens/${propertyId}`);

                    if (response.success && response.data) {
                        const data = response.data;
                        setFormData({
                            titre: data.titre || '',
                            description: data.description || '',
                            type_bien: data.type_bien || 'maison',
                            statut: data.statut || 'vente',
                            adresse: data.adresse || '',
                            quartier: data.quartier ? { raw: data.quartier, place_name: data.quartier } : null,
                            ville: data.ville ? { raw: data.ville, place_name: data.ville } : null,
                            superficie_m2: data.superficie_m2?.toString() || '',
                            nb_chambres: data.nb_chambres?.toString() || '',
                            nb_salles_bain: data.nb_salles_bain?.toString() || '',
                            standing: data.standing || '',
                            etat_general: data.etat_general || '',
                            prix_vente: data.prix_vente?.toString() || '',
                            prix_location_mensuel: data.prix_location_mensuel?.toString() || '',
                        });
                        if (data.gps) {
                            setSelectedGPS(data.gps);
                        }
                        if (data.service_id) {
                            setServiceId(data.service_id);
                        }
                        // Charger les médias existants
                        if (data.photos && Array.isArray(data.photos)) {
                            const existingMedia: MediaItem[] = data.photos.map((photo: string) => ({
                                uri: photo,
                                type: 'image',
                                uploaded: true,
                                uploadUrl: photo,
                            }));
                            setMedia(existingMedia);
                        }
                    }
                } catch (error: any) {
                    console.error('[ImmobilierFormScreen] Erreur chargement données:', error);
                } finally {
                    setLoading(false);
                }
            }
        };

        loadExistingData();
    }, [mode, propertyId]);

    const handleGPSSelect = (coordinates: string) => {
        setSelectedGPS(coordinates);
        setShowGPSModal(false);
    };

    const importGooglePlacePhotos = async (placeId: string) => {
        if (!placeId) return;
        if (placeId === lastImportedPlaceId) return;

        try {
            setImportingGoogleMedia(true);

            const photoUrls = await googlePlacesMediaService.getPlacePhotoUrls(placeId, { maxPhotos: 10, maxWidth: 1600 });
            if (photoUrls.length === 0) {
                setLastImportedPlaceId(placeId);
                return;
            }

            const downloadedUris = await Promise.all(
                photoUrls.map(async (url, idx) => {
                    const dest = `${FileSystem.cacheDirectory}google_place_${placeId}_${idx}.jpg`;
                    const result = await FileSystem.downloadAsync(url, dest);
                    return result.uri;
                })
            );

            const uploaded = await uploadFiles(
                downloadedUris.map((uri, idx) => ({
                    uri,
                    type: 'image/jpeg',
                    name: `google_place_${placeId}_${idx}.jpg`,
                }))
            );

            const importedItems: MediaItem[] = uploaded
                .filter((f) => f?.url)
                .map((f, idx) => ({
                    uri: downloadedUris[idx],
                    type: 'image',
                    uploaded: true,
                    uploadUrl: f.url,
                }));

            if (importedItems.length > 0) {
                setMedia((prev) => {
                    const existingUrls = new Set(prev.map((m) => m.uploadUrl).filter(Boolean) as string[]);
                    const deduped = importedItems.filter((m) => !m.uploadUrl || !existingUrls.has(m.uploadUrl));
                    return [...prev, ...deduped];
                });

                Alert.alert(
                    '📸 Photos Google ajoutées',
                    `${importedItems.length} photo(s) récupérée(s) depuis Google Places. Vous pouvez les supprimer ou en ajouter d'autres.`
                );
            }

            setLastImportedPlaceId(placeId);
        } catch (error: any) {
            console.error('[ImmobilierFormScreen] Erreur import photos Google:', error);
            // Non bloquant: l'utilisateur peut continuer manuellement
        } finally {
            setImportingGoogleMedia(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.titre.trim()) {
            Alert.alert('Erreur', 'Le titre est obligatoire');
            return;
        }

        if (!serviceId) {
            Alert.alert('Erreur', 'Service ID manquant. Veuillez créer un service d\'abord.');
            return;
        }

        if (!formData.ville && !selectedGPS) {
            Alert.alert('Erreur', 'La localisation (ville ou GPS) est obligatoire');
            return;
        }

        if (formData.statut === 'vente' && !formData.prix_vente) {
            Alert.alert('Erreur', 'Le prix de vente est obligatoire pour une vente');
            return;
        }

        if (formData.statut === 'location' && !formData.prix_location_mensuel) {
            Alert.alert('Erreur', 'Le prix de location mensuel est obligatoire pour une location');
            return;
        }

        try {
            setLoading(true);

            // ✅ NOUVEAU: Extraire les URLs des médias uploadés
            const photos = media
                .filter(item => item.type === 'image' && item.uploadUrl)
                .map(item => item.uploadUrl!);
            const videos = media
                .filter(item => item.type === 'video' && item.uploadUrl)
                .map(item => item.uploadUrl!);

            const payload: any = {
                service_id: serviceId,
                titre: formData.titre.trim(),
                description: formData.description.trim() || null,
                type_bien: formData.type_bien,
                statut: formData.statut,
                adresse: formData.adresse.trim() || null,
                quartier: formData.quartier?.raw || formData.quartier?.place_name || null,
                ville: formData.ville?.raw || formData.ville?.place_name || null,
                gps: selectedGPS || (location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null),
                superficie_m2: formData.superficie_m2 ? parseFloat(formData.superficie_m2) : null,
                nb_chambres: formData.nb_chambres ? parseInt(formData.nb_chambres) : null,
                nb_salles_bain: formData.nb_salles_bain ? parseInt(formData.nb_salles_bain) : null,
                standing: formData.standing || null,
                etat_general: formData.etat_general || null,
                prix_vente: formData.prix_vente ? parseFloat(formData.prix_vente) : null,
                prix_location_mensuel: formData.prix_location_mensuel ? parseFloat(formData.prix_location_mensuel) : null,
                photos: photos.length > 0 ? photos : null, // ✅ NOUVEAU: Photos uploadées
                videos: videos.length > 0 ? videos : null, // ✅ NOUVEAU: Vidéos uploadées
            };

            let response;
            if (mode === 'edit' && propertyId) {
                // TODO: Vérifier si endpoint PUT existe
                response = await apiPost(`/api/immobilier/biens/${propertyId}`, payload);
            } else {
                response = await apiPost('/api/immobilier/biens', payload);
            }

            if (response.success) {
                Alert.alert(
                    'Succès',
                    mode === 'edit' ? 'Bien immobilier modifié avec succès !' : 'Bien immobilier créé avec succès !',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer le bien');
            }
        } catch (error: any) {
            console.error('Erreur création bien:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
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
                        {mode === 'edit' ? 'Modifier le bien' : 'Créer un bien immobilier'}
                    </Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Titre *</Text>
                        <NativeInput
                            value={formData.titre}
                            onChangeText={(text) => setFormData({ ...formData, titre: text })}
                            placeholder="Ex: Belle maison 4 chambres"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Description</Text>
                        <NativeInput
                            value={formData.description}
                            onChangeText={(text) => setFormData({ ...formData, description: text })}
                            placeholder="Description détaillée du bien..."
                            multiline
                            style={styles.textArea}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Type de bien *</Text>
                        <View style={styles.chipsContainer}>
                            {typesBien.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.chip,
                                        formData.type_bien === type && styles.chipSelected,
                                    ]}
                                    onPress={() => setFormData({ ...formData, type_bien: type })}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            formData.type_bien === type && styles.chipTextSelected,
                                        ]}
                                    >
                                        {type === 'maison' ? 'Maison' :
                                         type === 'appartement' ? 'Appartement' :
                                         type === 'terrain' ? 'Terrain' :
                                         type === 'bureau' ? 'Bureau' :
                                         'Local commercial'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Statut *</Text>
                        <View style={styles.chipsContainer}>
                            {statuts.map((statut) => (
                                <TouchableOpacity
                                    key={statut}
                                    style={[
                                        styles.chip,
                                        formData.statut === statut && styles.chipSelected,
                                    ]}
                                    onPress={() => setFormData({ ...formData, statut })}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            formData.statut === statut && styles.chipTextSelected,
                                        ]}
                                    >
                                        {statut === 'vente' ? 'Vente' :
                                         statut === 'location' ? 'Location' :
                                         'Les deux'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Ville *</Text>
                        <LocationSelector
                            label=""
                            value={formData.ville ? (typeof formData.ville === 'string' ? { raw: formData.ville, place_name: formData.ville } : formData.ville) : ''}
                            onSelect={(location: LocationObject) => {
                                setFormData({ ...formData, ville: location });
                            }}
                            placeholder="Rechercher une ville..."
                            scope="city"
                            enrichWithBackend={true}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Quartier</Text>
                        <LocationSelector
                            label=""
                            value={formData.quartier ? (typeof formData.quartier === 'string' ? { raw: formData.quartier, place_name: formData.quartier } : formData.quartier) : ''}
                            onSelect={(location: LocationObject) => {
                                setFormData({ ...formData, quartier: location });
                            }}
                            placeholder="Rechercher un quartier..."
                            scope="neighborhood"
                            cityContext={formData.ville?.raw || formData.ville?.place_name || ''}
                            enrichWithBackend={true}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Adresse complète</Text>
                        <LocationSelector
                            label=""
                            value={formData.adresse ? { raw: formData.adresse, place_name: formData.adresse } : ''}
                            onSelect={(location: LocationObject) => {
                                setFormData((prev) => ({
                                    ...prev,
                                    adresse: location.raw || location.place_name || prev.adresse,
                                    ville: prev.ville || (location.components?.ville ? { raw: location.components.ville, place_name: location.components.ville } : prev.ville),
                                    quartier: prev.quartier || (location.components?.quartier ? { raw: location.components.quartier, place_name: location.components.quartier } : prev.quartier),
                                }));

                                if (location.coordinates?.lat && location.coordinates?.lng) {
                                    setSelectedGPS(`${location.coordinates.lat},${location.coordinates.lng}`);
                                }

                                if (location.place_id) {
                                    importGooglePlacePhotos(location.place_id);
                                }
                            }}
                            placeholder="Rechercher une adresse / un lieu..."
                            scope="all"
                            cityContext={formData.ville?.raw || formData.ville?.place_name || ''}
                            enrichWithBackend={true}
                        />
                        {importingGoogleMedia && (
                            <Text style={styles.helperText}>📥 Récupération des photos Google en cours...</Text>
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Localisation GPS</Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => setShowGPSModal(true)}
                        >
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <Text style={styles.gpsButtonText}>
                                {selectedGPS ? 'Localisation sélectionnée' : 'Sélectionner sur la carte'}
                            </Text>
                            <SafeIcon name="chevron-right" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                        {selectedGPS && (
                            <Text style={styles.gpsText}>{selectedGPS}</Text>
                        )}
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Superficie (m²)</Text>
                            <NativeInput
                                value={formData.superficie_m2}
                                onChangeText={(text) => setFormData({ ...formData, superficie_m2: text })}
                                placeholder="0"
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Chambres</Text>
                            <NativeInput
                                value={formData.nb_chambres}
                                onChangeText={(text) => setFormData({ ...formData, nb_chambres: text })}
                                placeholder="0"
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Salles de bain</Text>
                            <NativeInput
                                value={formData.nb_salles_bain}
                                onChangeText={(text) => setFormData({ ...formData, nb_salles_bain: text })}
                                placeholder="0"
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Standing</Text>
                            <View style={styles.chipsContainer}>
                                {standings.map((standing) => (
                                    <TouchableOpacity
                                        key={standing}
                                        style={[
                                            styles.chipSmall,
                                            formData.standing === standing && styles.chipSelected,
                                        ]}
                                        onPress={() => setFormData({ ...formData, standing })}
                                    >
                                        <Text
                                            style={[
                                                styles.chipText,
                                                formData.standing === standing && styles.chipTextSelected,
                                            ]}
                                        >
                                            {standing}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>État général</Text>
                        <View style={styles.chipsContainer}>
                            {etatsGeneraux.map((etat) => (
                                <TouchableOpacity
                                    key={etat}
                                    style={[
                                        styles.chip,
                                        formData.etat_general === etat && styles.chipSelected,
                                    ]}
                                    onPress={() => setFormData({ ...formData, etat_general: etat })}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            formData.etat_general === etat && styles.chipTextSelected,
                                        ]}
                                    >
                                        {etat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {(formData.statut === 'vente' || formData.statut === 'les_deux') && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Prix de vente ({devise}) *</Text>
                            <NativeInput
                                value={formData.prix_vente}
                                onChangeText={(text) => setFormData({ ...formData, prix_vente: text })}
                                placeholder="0"
                                keyboardType="numeric"
                            />
                        </View>
                    )}

                    {(formData.statut === 'location' || formData.statut === 'les_deux') && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Prix location mensuel ({devise}) *</Text>
                            <NativeInput
                                value={formData.prix_location_mensuel}
                                onChangeText={(text) => setFormData({ ...formData, prix_location_mensuel: text })}
                                placeholder="0"
                                keyboardType="numeric"
                            />
                        </View>
                    )}

                    {/* ✅ NOUVEAU: Upload de médias (images et vidéos) */}
                    <View style={styles.inputGroup}>
                        <MediaUploader
                            media={media}
                            onMediaChange={setMedia}
                            maxImages={10}
                            maxVideos={3}
                            allowVideos={true}
                            label="Photos et vidéos du bien"
                        />
                    </View>

                    <NativeButton
                        title={loading ? 'Enregistrement...' : mode === 'edit' ? 'Modifier le bien' : 'Créer le bien'}
                        onPress={handleSubmit}
                        disabled={loading || !formData.titre.trim() || !serviceId || (!formData.ville && !selectedGPS)}
                        variant="primary"
                        size="large"
                        style={styles.submitButton}
                    />
                </View>
            </KeyboardAwareScreen>

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={location ? {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude
                } : null}
                title="Sélectionner la localisation"
            />
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
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    form: {
        padding: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    helperText: {
        marginTop: 6,
        fontSize: 12,
        color: '#6B7280',
    },
    chipsContainer: {
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
    chipSmall: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
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
        color: '#fff',
        fontWeight: '600',
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        gap: 12,
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#111827',
    },
    gpsText: {
        marginTop: 8,
        fontSize: 12,
        color: '#6B7280',
    },
    submitButton: {
        marginTop: 24,
    },
});

export default ImmobilierFormScreen;

