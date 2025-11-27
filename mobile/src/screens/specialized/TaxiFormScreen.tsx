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

const TaxiFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const specializedServiceId = (route.params as any)?.specializedServiceId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;

    const [formData, setFormData] = useState({
        nom_chauffeur: '',
        telephone: '',
        whatsapp: '',
        type_vehicule: '',
        marque_modele: '',
        immatriculation: '',
        couleur: '',
        annee: '',
        zone_intervention: [] as string[],
        tarif_base: '500',
        tarif_par_km: '200',
        devise: 'XAF', // ✅ Sera récupéré automatiquement depuis zone_intervention
        paiement_cash: true,
        paiement_mobile_money: false,
        paiement_carte: false,
        climatisation: false,
        wifi: false,
        image_vehicule: null as string | null, // ✅ NOUVEAU : Image du véhicule
    });

    const [loading, setLoading] = useState(false);
    const [selectedZones, setSelectedZones] = useState<LocationObject[]>([]);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedGPS, setSelectedGPS] = useState<string | null>(null);

    // ✅ NOUVEAU : Fonction pour sélectionner une image du véhicule
    const pickVehicleImage = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Permission refusée', 'Permission d\'accès à la galerie refusée');
                return;
            }

            // ✅ CORRIGÉ: Utiliser 'images' as any pour éviter les erreurs TypeScript
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images' as any,
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
            console.error('[TaxiFormScreen] Erreur sélection image:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
        }
    };

    // ✅ NOUVEAU : Récupération automatique de la devise depuis la première zone
    useEffect(() => {
        if (selectedZones.length > 0) {
            const currency = getCurrencyIntelligently(selectedZones[0]);
            if (currency) {
                setFormData(prev => ({ ...prev, devise: currency }));
            }
        }
    }, [selectedZones]);

    // ✅ Créer automatiquement un service si serviceId manquant
    useEffect(() => {
        const createServiceIfNeeded = async () => {
            if (!serviceId && user?.id && formData.telephone) {
                try {
                    const serviceData = {
                        titre_service: formData.nom_chauffeur || 'Service Taxi',
                        description: 'Service de taxi',
                        category: 'transport',
                    };

                    const response = await servicesApi.createService(serviceData);
                    if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                        setServiceId((response.data as any).id);
                    }
                } catch (error: any) {
                    console.error('[TaxiFormScreen] Erreur création service:', error);
                }
            }
        };

        if (!serviceId && formData.telephone) {
            createServiceIfNeeded();
        }
    }, [formData.telephone, serviceId, user?.id]);

    // ✅ NOUVEAU : Charger les données existantes si mode='edit' et specializedServiceId fourni
    useEffect(() => {
        const loadExistingData = async () => {
            if (mode === 'edit' && specializedServiceId && serviceId) {
                try {
                    setLoading(true);
                    const { apiGet } = require('../../services/api');
                    const response = await apiGet(`/api/taxis/${specializedServiceId}`);

                    if (response.success && response.data) {
                        const data = response.data;

                        // Convertir zone_intervention string[] en LocationObject[]
                        const zones: LocationObject[] = (data.zone_intervention || []).map((zone: string) => ({
                            raw: zone,
                            place_name: zone
                        }));

                        setFormData({
                            nom_chauffeur: data.nom_chauffeur || '',
                            telephone: data.telephone || '',
                            whatsapp: data.whatsapp || '',
                            type_vehicule: data.type_vehicule || '',
                            marque_modele: data.marque_modele || '',
                            image_vehicule: data.image_vehicule || null,
                            immatriculation: data.immatriculation || '',
                            couleur: data.couleur || '',
                            annee: data.annee ? String(data.annee) : '',
                            zone_intervention: data.zone_intervention || [],
                            tarif_base: data.tarif_base ? String(data.tarif_base) : '500',
                            tarif_par_km: data.tarif_par_km ? String(data.tarif_par_km) : '200',
                            devise: data.devise || 'XAF',
                            paiement_cash: data.paiement_cash !== undefined ? data.paiement_cash : true,
                            paiement_mobile_money: data.paiement_mobile_money || false,
                            paiement_carte: data.paiement_carte || false,
                            climatisation: data.climatisation || false,
                            wifi: data.wifi || false,
                        });

                        setSelectedZones(zones);
                        if (data.gps_actuel) {
                            setSelectedGPS(data.gps_actuel);
                        }
                    }
                } catch (error: any) {
                    console.error('[TaxiFormScreen] Erreur chargement données:', error);
                } finally {
                    setLoading(false);
                }
            }
        };

        loadExistingData();
    }, [mode, specializedServiceId, serviceId]);

    const handleZoneSelect = (zone: LocationObject) => {
        const zoneStr = zone.raw || zone.place_name || '';
        const exists = selectedZones.some(z => (z.raw || z.place_name) === zoneStr);
        if (exists) {
            setSelectedZones(prev => prev.filter(z => (z.raw || z.place_name) !== zoneStr));
        } else {
            setSelectedZones(prev => [...prev, zone]);
        }
    };

    const handleGPSSelect = (coordinates: string) => {
        setSelectedGPS(coordinates);
        setShowGPSModal(false);
    };

    const handleSubmit = async () => {
        // ✅ Créer le service si nécessaire
        let finalServiceId = serviceId;
        if (!finalServiceId && user?.id) {
            try {
                setLoading(true);
                const serviceData = {
                    titre_service: formData.nom_chauffeur || 'Service Taxi',
                    description: 'Service de taxi',
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
                console.error('[TaxiFormScreen] Erreur création service:', error);
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

        if (!formData.telephone.trim()) {
            Alert.alert('Erreur', 'Le numéro de téléphone est obligatoire');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            const payload = {
                service_id: finalServiceId,
                nom_chauffeur: formData.nom_chauffeur || null,
                telephone: formData.telephone,
                whatsapp: formData.whatsapp || null,
                type_vehicule: formData.type_vehicule || null,
                marque_modele: formData.marque_modele || null,
                immatriculation: formData.immatriculation || null,
                couleur: formData.couleur || null,
                annee: formData.annee ? parseInt(formData.annee) : null,
                zone_intervention: selectedZones.length > 0 ? selectedZones.map(z => z.raw || z.place_name || '') : null,
                gps_actuel: selectedGPS || (location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null),
                tarif_base: parseInt(formData.tarif_base) || 500,
                tarif_par_km: parseInt(formData.tarif_par_km) || 200,
                devise: formData.devise,
                paiement_cash: formData.paiement_cash,
                paiement_mobile_money: formData.paiement_mobile_money,
                paiement_carte: formData.paiement_carte,
                climatisation: formData.climatisation,
                wifi: formData.wifi,
                image_vehicule: formData.image_vehicule || null, // ✅ NOUVEAU : Image du véhicule
            };

            const response = await apiPost('/api/taxis', payload);

            if (response.success) {
                Alert.alert(
                    'Succès',
                    'Service de taxi enregistré avec succès !',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer le taxi');
            }
        } catch (error: any) {
            console.error('Erreur création taxi:', error);
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
                    <Text style={styles.title}>Enregistrer un Taxi</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nom du chauffeur</Text>
                        <NativeInput
                            value={formData.nom_chauffeur}
                            onChangeText={(text) => setFormData({ ...formData, nom_chauffeur: text })}
                            placeholder="Ex: Jean Dupont"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Téléphone *</Text>
                        <NativeInput
                            value={formData.telephone}
                            onChangeText={(text) => setFormData({ ...formData, telephone: text })}
                            placeholder="+237 6XX XX XX XX"
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>WhatsApp</Text>
                        <NativeInput
                            value={formData.whatsapp}
                            onChangeText={(text) => setFormData({ ...formData, whatsapp: text })}
                            placeholder="+237 6XX XX XX XX"
                            keyboardType="phone-pad"
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

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Immatriculation</Text>
                            <NativeInput
                                value={formData.immatriculation}
                                onChangeText={(text) => setFormData({ ...formData, immatriculation: text })}
                                placeholder="Ex: LT-1234-AB"
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Couleur</Text>
                            <NativeInput
                                value={formData.couleur}
                                onChangeText={(text) => setFormData({ ...formData, couleur: text })}
                                placeholder="Ex: Blanc"
                            />
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Année</Text>
                        <NativeInput
                            value={formData.annee}
                            onChangeText={(text) => setFormData({ ...formData, annee: text })}
                            placeholder="2020"
                            keyboardType="numeric"
                        />
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

                    {/* ✅ Localisation avec Google Maps */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Localisation GPS actuelle</Text>
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

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Zones d'intervention</Text>
                        <LocationSelector
                            label=""
                            value=""
                            onSelect={handleZoneSelect}
                            placeholder="Rechercher une zone d'intervention..."
                            scope="all"
                            enrichWithBackend
                        />
                        {selectedZones.length > 0 && (
                            <View style={styles.chipsContainer}>
                                {selectedZones.map((zone, index) => {
                                    const zoneStr = zone.raw || zone.place_name || '';
                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[styles.chip, styles.chipSelected]}
                                            onPress={() => handleZoneSelect(zone)}
                                        >
                                            <Text style={styles.chipTextSelected}>
                                                {zoneStr}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Tarif de base (XAF)</Text>
                            <NativeInput
                                value={formData.tarif_base}
                                onChangeText={(text) => setFormData({ ...formData, tarif_base: text })}
                                placeholder="500"
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Tarif par km (XAF)</Text>
                            <NativeInput
                                value={formData.tarif_par_km}
                                onChangeText={(text) => setFormData({ ...formData, tarif_par_km: text })}
                                placeholder="200"
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Paiement cash</Text>
                        <Switch
                            value={formData.paiement_cash}
                            onValueChange={(value) => setFormData({ ...formData, paiement_cash: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Paiement Mobile Money</Text>
                        <Switch
                            value={formData.paiement_mobile_money}
                            onValueChange={(value) => setFormData({ ...formData, paiement_mobile_money: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Paiement carte</Text>
                        <Switch
                            value={formData.paiement_carte}
                            onValueChange={(value) => setFormData({ ...formData, paiement_carte: value })}
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

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>WiFi</Text>
                        <Switch
                            value={formData.wifi}
                            onValueChange={(value) => setFormData({ ...formData, wifi: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    {/* ✅ CORRIGÉ: Utiliser title au lieu de children */}
                    <NativeButton
                        title={loading ? 'Enregistrement...' : 'Enregistrer le Taxi'}
                        onPress={handleSubmit}
                        disabled={loading || !formData.telephone.trim()}
                        variant="primary"
                        size="large"
                        style={styles.submitButton}
                    />
                </View>
            </ScrollView>

            {/* Modals */}
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
    switchGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingVertical: 8,
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

export default TaxiFormScreen;

