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
import { NativeButton, NativeInput } from '../../components/NativeDesign';
import PrestationSelectorWithSchedule, { PrestationWithSchedule } from '../../components/PrestationSelectorWithSchedule';
import SafeIcon from '../../components/SafeIcon';
// ✅ SUPPRIMÉ : WeekScheduleSelector (planning hebdomadaire supprimé)
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiPost, servicesApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

// ✅ SUPPRIMÉ : ScheduleDay interface (planning hebdomadaire supprimé)


const HopitalFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const specializedServiceId = (route.params as any)?.specializedServiceId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;

    const [formData, setFormData] = useState({
        nom: '',
        type_etablissement: 'Hôpital',
        adresse: '',
        quartier: null as LocationObject | null,
        // ✅ SUPPRIMÉ : ville (quartier contient déjà ville et pays)
        prestations_medicales: [] as string[],
        // ✅ SUPPRIMÉ : banque_sang (service spécialisé dédié)
        urgences_disponible: false,
        rdv_en_ligne: false,
        telephone: '',
        telephone_urgence: '',
        whatsapp: '',
        email: '',
        site_web: '',
    });

    const [loading, setLoading] = useState(false);
    const [prestationsWithSchedule, setPrestationsWithSchedule] = useState<PrestationWithSchedule[]>([]);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedGPS, setSelectedGPS] = useState<string | null>(null);
    // ✅ SUPPRIMÉ : showScheduleModal et schedule (planning hebdomadaire supprimé)

    const typesEtablissement = ['Hôpital', 'Clinique', 'Centre de santé', 'Dispensaire'];

    // ✅ Liste complète des prestations médicales essentielles
    const prestationsOptions = [
        'Urgences',
        'Consultation générale',
        'Chirurgie générale',
        'Chirurgie cardiaque',
        'Chirurgie orthopédique',
        'Maternité',
        'Pédiatrie',
        'Cardiologie',
        'Radiologie',
        'Imagerie médicale',
        'Urologie',
        'Cancérologie',
        'Oncologie',
        'Dentisterie',
        'Ophtalmologie',
        'ORL',
        'Dermatologie',
        'Neurologie',
        'Psychiatrie',
        'Gynécologie',
        'Médecine interne',
        'Anesthésie',
        'Réanimation',
        'Laboratoire d\'analyses',
        'Pharmacie',
        'Kinésithérapie',
        'Physiothérapie',
    ];

    // ✅ Créer automatiquement un service si serviceId manquant
    useEffect(() => {
        const createServiceIfNeeded = async () => {
            if (!serviceId && user?.id) {
                try {
                    const serviceData = {
                        titre_service: formData.nom || 'Établissement de santé',
                        description: `Établissement de santé: ${formData.type_etablissement}`,
                        category: 'sante',
                    };

                    const response = await servicesApi.createService(serviceData);
                    if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                        setServiceId((response.data as any).id);
                    }
                } catch (error: any) {
                    console.error('[HopitalFormScreen] Erreur création service:', error);
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
                    const response = await apiGet(`/api/hopitaux/${specializedServiceId}`);

                    if (response.success && response.data) {
                        const data = response.data;
                        setFormData({
                            nom: data.nom || '',
                            type_etablissement: data.type_etablissement || 'Hôpital',
                            adresse: data.adresse || '',
                            quartier: data.quartier ? { raw: data.quartier, place_name: data.quartier } : null,
                            prestations_medicales: data.prestations_medicales || [],
                            urgences_disponible: data.urgences_disponible || false,
                            rdv_en_ligne: data.rdv_en_ligne || false,
                            telephone: data.telephone || '',
                            telephone_urgence: data.telephone_urgence || '',
                            whatsapp: data.whatsapp || '',
                            email: data.email || '',
                            site_web: data.site_web || '',
                        });

                        // Charger les prestations avec planning si disponible
                        if (data.planning_prestations && Array.isArray(data.planning_prestations)) {
                            const prestations: PrestationWithSchedule[] = data.planning_prestations.map((p: any) => ({
                                prestation: p.prestation,
                                scheduleByDay: p.scheduleByDay || (p.days || []).map((day: number) => ({
                                    day,
                                    timeSlots: p.timeSlots || [{ start: '08:00', end: '17:00' }]
                                })),
                                days: p.days || [],
                                timeSlots: p.timeSlots || []
                            }));
                            setPrestationsWithSchedule(prestations);
                        }

                        if (data.gps) {
                            setSelectedGPS(data.gps);
                        }
                    }
                } catch (error: any) {
                    console.error('[HopitalFormScreen] Erreur chargement données:', error);
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
                    titre_service: formData.nom || 'Établissement de santé',
                    description: `Établissement de santé: ${formData.type_etablissement}`,
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
                console.error('[HopitalFormScreen] Erreur création service:', error);
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
            Alert.alert('Erreur', 'Le nom de l\'établissement est obligatoire');
            setLoading(false);
            return;
        }

        try {
            // ✅ SUPPRIMÉ : planning_hebdomadaire (pas d'utilité selon demande)

            // ✅ Construire le planning des prestations avec horaires indépendants par jour
            // Structure: chaque prestation a des horaires spécifiques par jour
            const planningPrestations = prestationsWithSchedule.length > 0
                ? prestationsWithSchedule.map(ps => ({
                    prestation: ps.prestation,
                    // ✅ NOUVEAU : Utiliser scheduleByDay si disponible (structure refondue)
                    scheduleByDay: ps.scheduleByDay && ps.scheduleByDay.length > 0
                        ? ps.scheduleByDay // Utiliser la nouvelle structure
                        : (ps.days || []).map(day => ({
                            // Fallback vers ancien format pour compatibilité
                            day,
                            timeSlots: ps.timeSlots || [{ start: '08:00', end: '17:00' }]
                        })),
                    // Compatibilité avec ancien format
                    days: ps.scheduleByDay ? ps.scheduleByDay.map(d => d.day) : (ps.days || []),
                    timeSlots: ps.scheduleByDay && ps.scheduleByDay.length > 0
                        ? ps.scheduleByDay[0].timeSlots // Premier jour pour compatibilité
                        : (ps.timeSlots || [])
                }))
                : null;

            const payload = {
                service_id: finalServiceId,
                nom: formData.nom,
                type_etablissement: formData.type_etablissement,
                adresse: formData.adresse || null,
                quartier: formData.quartier?.raw || formData.quartier?.place_name || null,
                // ✅ SUPPRIMÉ : ville (quartier contient déjà ville et pays)
                gps: selectedGPS || (location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null),
                prestations_medicales: prestationsWithSchedule.length > 0
                    ? prestationsWithSchedule.map(p => p.prestation)
                    : null,
                planning_prestations: planningPrestations,
                // ✅ SUPPRIMÉ : banque_sang (service spécialisé dédié)
                urgences_disponible: formData.urgences_disponible,
                rdv_en_ligne: formData.rdv_en_ligne,
                telephone: formData.telephone || null,
                telephone_urgence: formData.telephone_urgence || null,
                whatsapp: formData.whatsapp || null,
                email: formData.email || null,
                site_web: formData.site_web || null,
            };

            const response = await apiPost('/api/hopitaux', payload);

            if (response.success) {
                Alert.alert(
                    'Succès',
                    'Établissement de santé enregistré avec succès !',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer l\'établissement');
            }
        } catch (error: any) {
            console.error('Erreur création hôpital:', error);
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
                    <Text style={styles.title}>Enregistrer un Hôpital/Clinique</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nom de l'établissement *</Text>
                        <NativeInput
                            value={formData.nom}
                            onChangeText={(text) => setFormData({ ...formData, nom: text })}
                            placeholder="Ex: Hôpital Central"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Type d'établissement</Text>
                        <View style={styles.chipsContainer}>
                            {typesEtablissement.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.chip,
                                        formData.type_etablissement === type && styles.chipSelected,
                                    ]}
                                    onPress={() => setFormData({ ...formData, type_etablissement: type })}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            formData.type_etablissement === type && styles.chipTextSelected,
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

                    {/* ✅ Prestations médicales avec planification inline */}
                    {/* ✅ AMÉLIORÉ : Horaires indépendants par jour (chaque jour peut avoir ses propres horaires) */}
                    {/* TODO: Modifier PrestationSelectorWithSchedule pour supporter horaires indépendants par jour */}
                    <View style={styles.inputGroup}>
                        <PrestationSelectorWithSchedule
                            label="Prestations médicales"
                            options={prestationsOptions}
                            selected={prestationsWithSchedule}
                            onSelectionChange={setPrestationsWithSchedule}
                            allowCustom={true}
                            placeholder="Ajouter une prestation personnalisée"
                        />
                    </View>

                    {/* ✅ SUPPRIMÉ : Planning hebdomadaire (pas d'utilité) */}

                    {/* ✅ SUPPRIMÉ : Banque de sang (service spécialisé dédié) */}

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Urgences disponibles</Text>
                        <Switch
                            value={formData.urgences_disponible}
                            onValueChange={(value) => setFormData({ ...formData, urgences_disponible: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Rendez-vous en ligne</Text>
                        <Switch
                            value={formData.rdv_en_ligne}
                            onValueChange={(value) => setFormData({ ...formData, rdv_en_ligne: value })}
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
                        <Text style={styles.label}>Téléphone urgence</Text>
                        <NativeInput
                            value={formData.telephone_urgence}
                            onChangeText={(text) => setFormData({ ...formData, telephone_urgence: text })}
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
                            placeholder="hopital@example.com"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Site web</Text>
                        <NativeInput
                            value={formData.site_web}
                            onChangeText={(text) => setFormData({ ...formData, site_web: text })}
                            placeholder="https://..."
                            keyboardType="url"
                            autoCapitalize="none"
                        />
                    </View>

                    {/* ✅ CORRIGÉ: Utiliser title au lieu de children */}
                    <NativeButton
                        title={loading ? 'Enregistrement...' : 'Enregistrer l\'Établissement'}
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
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
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
    removeCustomButton: {
        padding: 2,
    },
    addPrestationContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    addPrestationInput: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
    },
    addPrestationButton: {
        padding: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
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
    hintText: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
        fontStyle: 'italic',
    },
    submitButton: {
        marginTop: 24,
    },
});

export default HopitalFormScreen;
