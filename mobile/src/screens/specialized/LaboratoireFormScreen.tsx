import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import SimplePrestationSelector from '../../components/SimplePrestationSelector';
// ✅ SUPPRIMÉ : WeekScheduleSelector (planning hebdomadaire supprimé)
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiPost, servicesApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

// ✅ SUPPRIMÉ : ScheduleDay interface (planning hebdomadaire supprimé)

const LaboratoireFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const specializedServiceId = (route.params as any)?.specializedServiceId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;

    const [formData, setFormData] = useState({
        nom: '',
        type_laboratoire: 'Laboratoire',
        adresse: '',
        quartier: null as LocationObject | null,
        // ✅ SUPPRIMÉ : ville (quartier contient déjà ville et pays)
        analyses_disponibles: [] as string[],
        imagerie_disponible: [] as string[],
        heures_ouverture: '08:00', // ✅ NOUVEAU : Heures d'ouverture
        heures_fermeture: '18:00', // ✅ NOUVEAU : Heures de fermeture
        permanent_24h: false, // ✅ NOUVEAU : Bouton 24h/24 pour gérer recherches liées au moment
        rdv_requis: true,
        resultats_en_ligne: false,
        telephone: '',
        whatsapp: '',
        email: '',
    });

    const [loading, setLoading] = useState(false);
    const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>([]);
    const [selectedImagerie, setSelectedImagerie] = useState<string[]>([]);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedGPS, setSelectedGPS] = useState<string | null>(null);
    // ✅ SUPPRIMÉ : showScheduleModal et schedule (planning hebdomadaire supprimé)

    const typesLaboratoire = ['Laboratoire', 'Centre d\'imagerie', 'Les deux'];
    const analysesOptions = ['Sang', 'Urine', 'Bactériologie', 'Parasitologie', 'Sérologie', 'Biochimie'];
    const imagerieOptions = ['Radiologie', 'Échographie', 'Scanner', 'IRM', 'Mammographie'];

    // ✅ Créer automatiquement un service si serviceId manquant
    useEffect(() => {
        const createServiceIfNeeded = async () => {
            if (!serviceId && user?.id && formData.nom) {
                try {
                    const serviceData = {
                        titre_service: formData.nom || 'Laboratoire',
                        description: `Laboratoire: ${formData.type_laboratoire}`,
                        category: 'sante',
                    };

                    const response = await servicesApi.createService(serviceData);
                    if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                        setServiceId((response.data as any).id);
                    }
                } catch (error: any) {
                    console.error('[LaboratoireFormScreen] Erreur création service:', error);
                }
            }
        };

        if (!serviceId && formData.nom) {
            createServiceIfNeeded();
        }
    }, [formData.nom, serviceId, user?.id]);

    // ✅ NOUVEAU : Charger les données existantes si mode='edit' et specializedServiceId fourni
    useEffect(() => {
        const loadExistingData = async () => {
            if (mode === 'edit' && specializedServiceId && serviceId) {
                try {
                    setLoading(true);
                    const { apiGet } = require('../../services/api');
                    const response = await apiGet(`/api/laboratoires/${specializedServiceId}`);

                    if (response.success && response.data) {
                        const data = response.data;
                        setFormData({
                            nom: data.nom || '',
                            type_laboratoire: data.type_laboratoire || 'Laboratoire',
                            adresse: data.adresse || '',
                            quartier: data.quartier ? { raw: data.quartier, place_name: data.quartier } : null,
                            analyses_disponibles: data.analyses_disponibles || [],
                            imagerie_disponible: data.imagerie_disponible || [],
                            heures_ouverture: data.heures_ouverture || '08:00',
                            heures_fermeture: data.heures_fermeture || '18:00',
                            permanent_24h: data.permanent_24h || false,
                            rdv_requis: data.rdv_requis !== undefined ? data.rdv_requis : true,
                            resultats_en_ligne: data.resultats_en_ligne || false,
                            telephone: data.telephone || '',
                            whatsapp: data.whatsapp || '',
                            email: data.email || '',
                        });

                        setSelectedAnalyses(data.analyses_disponibles || []);
                        setSelectedImagerie(data.imagerie_disponible || []);
                        if (data.gps) {
                            setSelectedGPS(data.gps);
                        }
                    }
                } catch (error: any) {
                    console.error('[LaboratoireFormScreen] Erreur chargement données:', error);
                } finally {
                    setLoading(false);
                }
            }
        };

        loadExistingData();
    }, [mode, specializedServiceId, serviceId]);

    const handleGPSSelect = (coordinates: string) => {
        setSelectedGPS(coordinates);
        setShowGPSModal(false);
    };

    // ✅ SUPPRIMÉ : handleScheduleSave (planning hebdomadaire supprimé)

    const handleSubmit = async () => {
        // ✅ Créer le service si nécessaire
        let finalServiceId = serviceId;
        if (!finalServiceId && user?.id) {
            try {
                setLoading(true);
                const serviceData = {
                    titre_service: formData.nom || 'Laboratoire',
                    description: `Laboratoire: ${formData.type_laboratoire}`,
                    category: 'sante',
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
                console.error('[LaboratoireFormScreen] Erreur création service:', error);
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

        if (!formData.nom.trim()) {
            Alert.alert('Erreur', 'Le nom du laboratoire est obligatoire');
            setLoading(false);
            return;
        }

        try {
            // ✅ SUPPRIMÉ : planning_hebdomadaire (pas d'utilité selon demande)

            const payload = {
                service_id: finalServiceId,
                nom: formData.nom,
                type_laboratoire: formData.type_laboratoire,
                adresse: formData.adresse || null,
                quartier: formData.quartier?.raw || formData.quartier?.place_name || null,
                // ✅ SUPPRIMÉ : ville (quartier contient déjà ville et pays)
                gps: selectedGPS || (location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null),
                analyses_disponibles: selectedAnalyses.length > 0 ? selectedAnalyses : null,
                imagerie_disponible: selectedImagerie.length > 0 ? selectedImagerie : null,
                heures_ouverture: formData.heures_ouverture || null, // ✅ NOUVEAU
                heures_fermeture: formData.heures_fermeture || null, // ✅ NOUVEAU
                permanent_24h: formData.permanent_24h, // ✅ NOUVEAU : Pour gérer recherches liées au moment
                rdv_requis: formData.rdv_requis,
                resultats_en_ligne: formData.resultats_en_ligne,
                telephone: formData.telephone || null,
                whatsapp: formData.whatsapp || null,
                email: formData.email || null,
            };

            const response = await apiPost('/api/laboratoires', payload);

            if (response.success) {
                Alert.alert(
                    'Succès',
                    'Laboratoire enregistré avec succès !',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer le laboratoire');
            }
        } catch (error: any) {
            console.error('Erreur création laboratoire:', error);
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
                    <Text style={styles.title}>Enregistrer un Laboratoire</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nom du laboratoire *</Text>
                        <NativeInput
                            value={formData.nom}
                            onChangeText={(text) => setFormData({ ...formData, nom: text })}
                            placeholder="Ex: Laboratoire Central"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Type</Text>
                        <View style={styles.chipsContainer}>
                            {typesLaboratoire.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.chip,
                                        formData.type_laboratoire === type && styles.chipSelected,
                                    ]}
                                    onPress={() => setFormData({ ...formData, type_laboratoire: type })}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            formData.type_laboratoire === type && styles.chipTextSelected,
                                        ]}
                                    >
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* ✅ Localisation avec Google Maps */}
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

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Adresse</Text>
                        <NativeInput
                            value={formData.adresse}
                            onChangeText={(text) => setFormData({ ...formData, adresse: text })}
                            placeholder="Adresse complète"
                            multiline
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label="Quartier"
                            value={formData.quartier || ''}
                            onSelect={(value) => setFormData({ ...formData, quartier: value })}
                            placeholder="Rechercher un quartier (inclut ville et pays)..."
                            scope="neighborhood"
                            enrichWithBackend
                        />
                        <Text style={styles.hintText}>
                            Le quartier permet de récupérer automatiquement la ville et le pays
                        </Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <SimplePrestationSelector
                            label="Analyses disponibles"
                            options={analysesOptions}
                            selected={selectedAnalyses}
                            onSelectionChange={setSelectedAnalyses}
                            allowCustom={true}
                            placeholder="Ajouter un type d'analyse"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <SimplePrestationSelector
                            label="Imagerie disponible"
                            options={imagerieOptions}
                            selected={selectedImagerie}
                            onSelectionChange={setSelectedImagerie}
                            allowCustom={true}
                            placeholder="Ajouter un type d'imagerie"
                        />
                    </View>

                    {/* ✅ SUPPRIMÉ : Planning hebdomadaire (pas d'utilité) */}

                    {/* ✅ NOUVEAU : Heures d'ouverture et fermeture */}
                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                            <Text style={styles.label}>Heure d'ouverture</Text>
                            <NativeInput
                                value={formData.heures_ouverture}
                                onChangeText={(text) => setFormData({ ...formData, heures_ouverture: text })}
                                placeholder="08:00"
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Heure de fermeture</Text>
                            <NativeInput
                                value={formData.heures_fermeture}
                                onChangeText={(text) => setFormData({ ...formData, heures_fermeture: text })}
                                placeholder="18:00"
                            />
                        </View>
                    </View>

                    {/* ✅ NOUVEAU : Bouton 24h/24 pour gérer recherches liées au moment */}
                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Ouvert 24h/24</Text>
                        <Switch
                            value={formData.permanent_24h}
                            onValueChange={(value) => setFormData({ ...formData, permanent_24h: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Rendez-vous requis</Text>
                        <Switch
                            value={formData.rdv_requis}
                            onValueChange={(value) => setFormData({ ...formData, rdv_requis: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Résultats en ligne</Text>
                        <Switch
                            value={formData.resultats_en_ligne}
                            onValueChange={(value) => setFormData({ ...formData, resultats_en_ligne: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Téléphone</Text>
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

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email</Text>
                        <NativeInput
                            value={formData.email}
                            onChangeText={(text) => setFormData({ ...formData, email: text })}
                            placeholder="labo@example.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* ✅ CORRIGÉ: Utiliser title au lieu de children */}
                    <NativeButton
                        title={loading ? 'Enregistrement...' : 'Enregistrer le Laboratoire'}
                        onPress={handleSubmit}
                        disabled={loading || !formData.nom.trim()}
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

            {/* ✅ SUPPRIMÉ : WeekScheduleSelector (planning hebdomadaire supprimé) */}
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
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
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
    switchGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingVertical: 8,
    },
    hintText: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
        fontStyle: 'italic',
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
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
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
    planningButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: `${modernColors.primary}15`,
        borderRadius: 8,
    },
    planningButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    scheduleSummary: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    submitButton: {
        marginTop: 24,
    },
});

export default LaboratoireFormScreen;

