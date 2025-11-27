import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton, NativeInput } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiPost, servicesApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';

const CovoiturageFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const specializedServiceId = (route.params as any)?.specializedServiceId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;

    const [formData, setFormData] = useState({
        depart: null as LocationObject | null,
        destination: null as LocationObject | null,
        date_depart: new Date(),
        heure_depart: '08:00',
        type_vehicule: '',
        marque_modele: '',
        nombre_places: '4',
        places_disponibles: '4',
        prix_par_place: '',
        devise: 'XAF', // ✅ Sera récupéré automatiquement depuis depart/destination
        bagages_autorises: true,
        animaux_autorises: false,
        fumeur_autorise: false,
        climatisation: false,
        image_vehicule: null as string | null, // ✅ NOUVEAU : Image du véhicule
    });

    const [loading, setLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // ✅ NOUVEAU : Fonction pour sélectionner une image du véhicule
    const pickVehicleImage = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Permission refusée', 'Permission d\'accès à la galerie refusée');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaType.Images,
                allowsEditing: true,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets[0]) {
                const base64 = result.assets[0].base64;
                const imageUri = result.assets[0].uri;
                if (base64) {
                    setFormData({ ...formData, image_vehicule: `data:image/jpeg;base64,${base64}` });
                } else {
                    setFormData({ ...formData, image_vehicule: imageUri });
                }
            }
        } catch (error) {
            console.error('[CovoiturageFormScreen] Erreur sélection image:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
        }
    };

    // ✅ NOUVEAU : Récupération automatique de la devise depuis depart ou destination
    useEffect(() => {
        const location = formData.depart || formData.destination;
        if (location) {
            const currency = getCurrencyIntelligently(location);
            if (currency) {
                setFormData(prev => ({ ...prev, devise: currency }));
            }
        }
    }, [formData.depart, formData.destination]);
    const [showGPSModalDepart, setShowGPSModalDepart] = useState(false);
    const [showGPSModalDestination, setShowGPSModalDestination] = useState(false);
    const [selectedGPSDepart, setSelectedGPSDepart] = useState<string | null>(null);
    const [selectedGPSDestination, setSelectedGPSDestination] = useState<string | null>(null);

    // ✅ Créer automatiquement un service si serviceId manquant
    useEffect(() => {
        const createServiceIfNeeded = async () => {
            if (!serviceId && user?.id && formData.depart && formData.destination) {
                try {
                    const departStr = formData.depart.raw || formData.depart.place_name || '';
                    const destStr = formData.destination.raw || formData.destination.place_name || '';
                    const serviceData = {
                        titre_service: `Covoiturage ${departStr} → ${destStr}`,
                        description: 'Trajet de covoiturage',
                        category: 'transport',
                    };

                    const response = await servicesApi.createService(serviceData);
                    if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                        setServiceId((response.data as any).id);
                    }
                } catch (error: any) {
                    console.error('[CovoiturageFormScreen] Erreur création service:', error);
                }
            }
        };

        if (!serviceId && formData.depart && formData.destination) {
            createServiceIfNeeded();
        }
    }, [formData.depart, formData.destination, serviceId, user?.id]);

    // ✅ NOUVEAU : Charger les données existantes si mode='edit' et specializedServiceId fourni
    useEffect(() => {
        const loadExistingData = async () => {
            if (mode === 'edit' && specializedServiceId && serviceId) {
                try {
                    setLoading(true);
                    const { apiGet } = require('../../services/api');
                    const response = await apiGet(`/api/covoiturages/${specializedServiceId}`);

                    if (response.success && response.data) {
                        const data = response.data;

                        // Parser date_depart si c'est une string
                        let dateDepart = new Date();
                        if (data.date_depart) {
                            if (typeof data.date_depart === 'string') {
                                dateDepart = new Date(data.date_depart);
                            } else {
                                dateDepart = new Date(data.date_depart);
                            }
                        }

                        setFormData({
                            depart: data.depart ? { raw: data.depart, place_name: data.depart } : null,
                            destination: data.destination ? { raw: data.destination, place_name: data.destination } : null,
                            date_depart: dateDepart,
                            heure_depart: data.heure_depart || '08:00',
                            type_vehicule: data.type_vehicule || '',
                            marque_modele: data.marque_modele || '',
                            image_vehicule: data.image_vehicule || null,
                            nombre_places: data.nombre_places ? String(data.nombre_places) : '4',
                            places_disponibles: data.places_disponibles ? String(data.places_disponibles) : '4',
                            prix_par_place: data.prix_par_place ? String(data.prix_par_place) : '',
                            devise: data.devise || 'XAF',
                            bagages_autorises: data.bagages_autorises !== undefined ? data.bagages_autorises : true,
                            animaux_autorises: data.animaux_autorises || false,
                            fumeur_autorise: data.fumeur_autorise || false,
                            climatisation: data.climatisation || false,
                        });

                        if (data.gps_depart) {
                            setSelectedGPSDepart(data.gps_depart);
                        }
                        if (data.gps_destination) {
                            setSelectedGPSDestination(data.gps_destination);
                        }
                    }
                } catch (error: any) {
                    console.error('[CovoiturageFormScreen] Erreur chargement données:', error);
                } finally {
                    setLoading(false);
                }
            }
        };

        loadExistingData();
    }, [mode, specializedServiceId, serviceId]);

    const handleGPSSelectDepart = (coordinates: string) => {
        setSelectedGPSDepart(coordinates);
        setShowGPSModalDepart(false);
    };

    const handleGPSSelectDestination = (coordinates: string) => {
        setSelectedGPSDestination(coordinates);
        setShowGPSModalDestination(false);
    };

    const handleSubmit = async () => {
        // ✅ Créer le service si nécessaire
        let finalServiceId = serviceId;
        if (!finalServiceId && user?.id) {
            try {
                setLoading(true);
                const departStr = formData.depart?.raw || formData.depart?.place_name || '';
                const destStr = formData.destination?.raw || formData.destination?.place_name || '';
                const serviceData = {
                    titre_service: `Covoiturage ${departStr} → ${destStr}`,
                    description: 'Trajet de covoiturage',
                    category: 'transport',
                };

                const response = await servicesApi.createService(serviceData);
                if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                    finalServiceId = (response.data as any).id;
                    setServiceId(finalServiceId);
                } else {
                    Alert.alert('Erreur', 'Impossible de créer le service. Veuillez réessayer.');
                    setLoading(false);
                    return;
                }
            } catch (error: any) {
                console.error('[CovoiturageFormScreen] Erreur création service:', error);
                Alert.alert('Erreur', 'Impossible de créer le service. Veuillez réessayer.');
                setLoading(false);
                return;
            }
        }

        if (!finalServiceId) {
            Alert.alert('Erreur', 'Service ID manquant. Veuillez créer un service d\'abord.');
            setLoading(false);
            return;
        }

        if (!formData.depart || !formData.destination) {
            Alert.alert('Erreur', 'Le point de départ et la destination sont obligatoires');
            setLoading(false);
            return;
        }

        if (!formData.prix_par_place.trim()) {
            Alert.alert('Erreur', 'Le prix par place est obligatoire');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // Formater la date au format ISO 8601
            const dateStr = formData.date_depart.toISOString();

            const payload = {
                service_id: finalServiceId,
                depart: formData.depart.raw || formData.depart.place_name || '',
                destination: formData.destination.raw || formData.destination.place_name || '',
                gps_depart: selectedGPSDepart || (location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null),
                gps_destination: selectedGPSDestination || null, // À enrichir avec géocodage si nécessaire
                date_depart: dateStr,
                heure_depart: formData.heure_depart,
                type_vehicule: formData.type_vehicule || null,
                marque_modele: formData.marque_modele || null,
                nombre_places: parseInt(formData.nombre_places) || 4,
                places_disponibles: parseInt(formData.places_disponibles) || 4,
                prix_par_place: parseInt(formData.prix_par_place) || 0,
                devise: formData.devise,
                bagages_autorises: formData.bagages_autorises,
                animaux_autorises: formData.animaux_autorises,
                fumeur_autorise: formData.fumeur_autorise,
                climatisation: formData.climatisation,
                image_vehicule: formData.image_vehicule || null, // ✅ NOUVEAU : Image du véhicule
            };

            const response = await apiPost('/api/covoiturages', payload);

            if (response.success) {
                Alert.alert(
                    'Succès',
                    'Trajet de covoiturage créé avec succès !',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de créer le trajet');
            }
        } catch (error: any) {
            console.error('Erreur création covoiturage:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <ScrollView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Proposer un Covoiturage</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label="Point de départ *"
                            value={formData.depart || ''}
                            onSelect={(value) => setFormData({ ...formData, depart: value })}
                            placeholder="Rechercher un lieu de départ..."
                            scope="all"
                            enrichWithBackend
                            required
                        />
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => setShowGPSModalDepart(true)}
                        >
                            <SafeIcon name="map-pin" size={16} color={modernColors.primary} />
                            <Text style={styles.gpsButtonText}>
                                {selectedGPSDepart ? 'GPS sélectionné' : 'Sélectionner GPS départ'}
                            </Text>
                        </TouchableOpacity>
                        {selectedGPSDepart && (
                            <Text style={styles.gpsText}>{selectedGPSDepart}</Text>
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label="Destination *"
                            value={formData.destination || ''}
                            onSelect={(value) => setFormData({ ...formData, destination: value })}
                            placeholder="Rechercher une destination..."
                            scope="all"
                            enrichWithBackend
                            required
                        />
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => setShowGPSModalDestination(true)}
                        >
                            <SafeIcon name="map-pin" size={16} color={modernColors.primary} />
                            <Text style={styles.gpsButtonText}>
                                {selectedGPSDestination ? 'GPS sélectionné' : 'Sélectionner GPS destination'}
                            </Text>
                        </TouchableOpacity>
                        {selectedGPSDestination && (
                            <Text style={styles.gpsText}>{selectedGPSDestination}</Text>
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Date de départ *</Text>
                        <TouchableOpacity
                            style={styles.dateButton}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <Text style={styles.dateButtonText}>
                                {formData.date_depart.toLocaleDateString('fr-FR')}
                            </Text>
                            <SafeIcon name="calendar" size={20} color={modernColors.primary} />
                        </TouchableOpacity>
                        {showDatePicker && (
                            <DateTimePicker
                                value={formData.date_depart}
                                mode="date"
                                display="default"
                                minimumDate={new Date()}
                                onChange={(event, selectedDate) => {
                                    setShowDatePicker(false);
                                    if (selectedDate) {
                                        setFormData({ ...formData, date_depart: selectedDate });
                                    }
                                }}
                            />
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Heure de départ *</Text>
                        <NativeInput
                            value={formData.heure_depart}
                            onChangeText={(text) => setFormData({ ...formData, heure_depart: text })}
                            placeholder="08:00"
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Type de véhicule</Text>
                            <NativeInput
                                value={formData.type_vehicule}
                                onChangeText={(text) => setFormData({ ...formData, type_vehicule: text })}
                                placeholder="Ex: Berline"
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Marque/Modèle</Text>
                            <NativeInput
                                value={formData.marque_modele}
                                onChangeText={(text) => setFormData({ ...formData, marque_modele: text })}
                                placeholder="Ex: Toyota Corolla"
                            />
                        </View>
                    </View>

                    {/* ✅ NOUVEAU : Image du véhicule */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Photo du véhicule</Text>
                        {formData.image_vehicule ? (
                            <View style={styles.imageContainer}>
                                <Image
                                    source={{ uri: formData.image_vehicule }}
                                    style={styles.imagePreview}
                                />
                                <TouchableOpacity
                                    style={styles.removeImageButton}
                                    onPress={() => setFormData({ ...formData, image_vehicule: null })}
                                >
                                    <SafeIcon name="x" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.imagePickerButton}
                                onPress={pickVehicleImage}
                            >
                                <SafeIcon name="camera" size={24} color={modernColors.primary} />
                                <Text style={styles.imagePickerText}>Ajouter une photo du véhicule</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Nombre de places</Text>
                            <NativeInput
                                value={formData.nombre_places}
                                onChangeText={(text) => setFormData({ ...formData, nombre_places: text })}
                                placeholder="4"
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Places disponibles</Text>
                            <NativeInput
                                value={formData.places_disponibles}
                                onChangeText={(text) => setFormData({ ...formData, places_disponibles: text })}
                                placeholder="4"
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Prix par place *</Text>
                            <NativeInput
                                value={formData.prix_par_place}
                                onChangeText={(text) => setFormData({ ...formData, prix_par_place: text })}
                                placeholder="5000"
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Devise</Text>
                            <NativeInput
                                value={formData.devise}
                                onChangeText={(text) => setFormData({ ...formData, devise: text })}
                                placeholder="XAF"
                            />
                        </View>
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Bagages autorisés</Text>
                        <Switch
                            value={formData.bagages_autorises}
                            onValueChange={(value) => setFormData({ ...formData, bagages_autorises: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Animaux autorisés</Text>
                        <Switch
                            value={formData.animaux_autorises}
                            onValueChange={(value) => setFormData({ ...formData, animaux_autorises: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Fumeur autorisé</Text>
                        <Switch
                            value={formData.fumeur_autorise}
                            onValueChange={(value) => setFormData({ ...formData, fumeur_autorise: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Climatisation</Text>
                        <Switch
                            value={formData.climatisation}
                            onValueChange={(value) => setFormData({ ...formData, climatisation: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    {/* ✅ CORRIGÉ: Utiliser title au lieu de children */}
                    <NativeButton
                        title={loading ? 'Création...' : 'Créer le Trajet'}
                        onPress={handleSubmit}
                        disabled={loading || !formData.depart || !formData.destination || !formData.prix_par_place.trim()}
                        variant="primary"
                        size="large"
                        style={styles.submitButton}
                    />
                </View>
            </ScrollView>

            {/* Modals */}
            <ModernGPSModal
                visible={showGPSModalDepart}
                onClose={() => setShowGPSModalDepart(false)}
                onSelect={handleGPSSelectDepart}
                currentLocation={location ? {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude
                } : null}
                title="Sélectionner GPS départ"
            />

            <ModernGPSModal
                visible={showGPSModalDestination}
                onClose={() => setShowGPSModalDestination(false)}
                onSelect={handleGPSSelectDestination}
                currentLocation={location ? {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude
                } : null}
                title="Sélectionner GPS destination"
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
    switchGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingVertical: 8,
    },
    dateButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    dateButtonText: {
        fontSize: 16,
        color: '#111827',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 10,
        marginTop: 8,
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 12,
        color: '#111827',
    },
    gpsText: {
        marginTop: 4,
        fontSize: 11,
        color: '#6B7280',
    },
    submitButton: {
        marginTop: 24,
    },
    imageContainer: {
        position: 'relative',
        marginTop: 8,
    },
    imagePreview: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
    },
    removeImageButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#DC2626',
        borderRadius: 20,
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    imagePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
        marginTop: 8,
    },
    imagePickerText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
});

export default CovoiturageFormScreen;

