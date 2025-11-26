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
import WeekScheduleSelector from '../../components/WeekScheduleSelector';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiPost, servicesApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface ScheduleDay {
    day: number;
    enabled: boolean;
    timeSlots: Array<{ start: string; end: string }>;
}


const HopitalFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);

    const [formData, setFormData] = useState({
        nom: '',
        type_etablissement: 'Hôpital',
        adresse: '',
        quartier: null as LocationObject | null,
        ville: null as LocationObject | null,
        prestations_medicales: [] as string[],
        banque_sang: false,
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
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [schedule, setSchedule] = useState<ScheduleDay[]>([]);

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


    const handleGPSSelect = (coordinates: string) => {
        setSelectedGPS(coordinates);
        setShowGPSModal(false);
    };

    const handleScheduleSave = (savedSchedule: ScheduleDay[]) => {
        setSchedule(savedSchedule);
        setShowScheduleModal(false);
    };

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
            // Construire le planning hebdomadaire depuis schedule
            const planningHebdomadaire = schedule.length > 0
                ? schedule.map(day => ({
                    day: day.day,
                    enabled: day.enabled,
                    timeSlots: day.timeSlots
                }))
                : null;

            // Construire le planning des prestations depuis le nouveau format
            const planningPrestations = prestationsWithSchedule.length > 0
                ? prestationsWithSchedule.map(ps => ({
                    prestation: ps.prestation,
                    days: ps.days,
                    timeSlots: ps.timeSlots
                }))
                : null;

            const payload = {
                service_id: finalServiceId,
                nom: formData.nom,
                type_etablissement: formData.type_etablissement,
                adresse: formData.adresse || null,
                quartier: formData.quartier?.raw || formData.quartier?.place_name || null,
                ville: formData.ville?.raw || formData.ville?.place_name || null,
                gps: selectedGPS || (location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null),
                prestations_medicales: prestationsWithSchedule.length > 0
                    ? prestationsWithSchedule.map(p => p.prestation)
                    : null,
                planning_hebdomadaire: planningHebdomadaire,
                planning_prestations: planningPrestations,
                banque_sang: formData.banque_sang,
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
                            placeholder="Rechercher un quartier..."
                            scope="neighborhood"
                            enrichWithBackend
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label="Ville"
                            value={formData.ville || ''}
                            onSelect={(value) => setFormData({ ...formData, ville: value })}
                            placeholder="Rechercher une ville..."
                            scope="city"
                            enrichWithBackend
                        />
                    </View>

                    {/* ✅ Prestations médicales avec planification inline */}
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

                    {/* ✅ Planning hebdomadaire */}
                    <View style={styles.inputGroup}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.label}>Planning hebdomadaire</Text>
                            <TouchableOpacity
                                style={styles.planningButton}
                                onPress={() => setShowScheduleModal(true)}
                            >
                                <SafeIcon name="calendar" size={16} color={modernColors.primary} />
                                <Text style={styles.planningButtonText}>
                                    {schedule.length > 0 ? 'Modifier' : 'Configurer'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        {schedule.length > 0 && (
                            <Text style={styles.scheduleSummary}>
                                {schedule.filter(d => d.enabled).length} jour(s) configuré(s)
                            </Text>
                        )}
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Banque de sang</Text>
                        <Switch
                            value={formData.banque_sang}
                            onValueChange={(value) => setFormData({ ...formData, banque_sang: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

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

            <WeekScheduleSelector
                visible={showScheduleModal}
                onClose={() => setShowScheduleModal(false)}
                onSave={handleScheduleSave}
                initialSchedule={schedule}
                title="Planning hebdomadaire"
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
    submitButton: {
        marginTop: 24,
    },
});

export default HopitalFormScreen;
