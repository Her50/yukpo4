import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
// ✅ SUPPRIMÉ: PartnerSelector - Les données partenaire sont chargées automatiquement depuis /api/partners/me
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import SimplePrestationSelector from '../../components/SimplePrestationSelector';
// ✅ SUPPRIMÉ : WeekScheduleSelector (planning hebdomadaire supprimé)
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiDelete, apiGet, apiPatch, apiPost, servicesApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

// ✅ NOUVEAU: Interface pour les types d'examens
interface ExaminationType {
    id?: number;
    nom: string;
    categorie: 'analyse' | 'imagerie';
    prix?: number;
    duree_estimee?: string; // Format: "30 min", "1h", etc.
    preparation_requise?: string;
}

const LaboratoireFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const specializedServiceId = (route.params as any)?.specializedServiceId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;

    const [formData, setFormData] = useState({
        nom: '', // ✅ Sera rempli automatiquement depuis /api/partners/me
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

    // ✅ NOUVEAU: Données du partenaire pour affichage dans l'en-tête
    const [partnerData, setPartnerData] = useState<any>(null);

    // ✅ NOUVEAU: États pour la gestion des types d'examens
    const [examinationTypes, setExaminationTypes] = useState<ExaminationType[]>([]);
    const [loadingExaminations, setLoadingExaminations] = useState(false);
    const [showExaminationModal, setShowExaminationModal] = useState(false);
    const [editingExamination, setEditingExamination] = useState<ExaminationType | null>(null);
    const [examinationFormData, setExaminationFormData] = useState<ExaminationType>({
        nom: '',
        categorie: 'analyse',
        prix: undefined,
        duree_estimee: '',
        preparation_requise: '',
    });
    const [searchQuery, setSearchQuery] = useState('');

    const typesLaboratoire = ['Laboratoire', 'Centre d\'imagerie', 'Les deux'];
    const analysesOptions = ['Sang', 'Urine', 'Bactériologie', 'Parasitologie', 'Sérologie', 'Biochimie'];
    const imagerieOptions = ['Radiologie', 'Échographie', 'Scanner', 'IRM', 'Mammographie'];

    // ✅ NOUVEAU: Charger automatiquement les données partenaire depuis /api/partners/me
    useEffect(() => {
        const loadPartnerData = async () => {
            if (user?.role === 'partenaire' && user?.partner_type === 'laboratoire') {
                try {
                    const { apiGet } = require('../../services/api');
                    const response = await apiGet('/api/partners/me');
                    if (response.success && response.data) {
                        const partner = response.data;
                        setPartnerData(partner); // ✅ Stocker pour affichage dans l'en-tête
                        // ✅ Pré-remplir silencieusement les champs pour l'envoi au backend (mais ne pas les afficher)
                        setFormData(prev => ({
                            ...prev,
                            nom: partner.name || prev.nom,
                            adresse: partner.address || partner.location_address || prev.adresse,
                            telephone: partner.contact_phone || prev.telephone,
                            email: partner.contact_email || prev.email,
                            quartier: partner.city ? {
                                raw: partner.city,
                                place_name: partner.city,
                                components: {
                                    ville: partner.city,
                                    pays: partner.country,
                                }
                            } : prev.quartier,
                        }));
                    }
                } catch (error) {
                    console.error('[LaboratoireFormScreen] Erreur chargement partenaire:', error);
                }
            }
        };
        loadPartnerData();
    }, [user?.role, user?.partner_type]);

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

    // ✅ NOUVEAU: Charger les types d'examens
    useEffect(() => {
        const loadExaminationTypes = async () => {
            if (serviceId && specializedServiceId) {
                try {
                    setLoadingExaminations(true);
                    const response = await apiGet(`/api/laboratoires/${specializedServiceId}/examination-types`);
                    if (response.success && response.data) {
                        const data = response.data.data || response.data;
                        if (Array.isArray(data) && data.length > 0) {
                            setExaminationTypes(data);
                        } else {
                            // Si backend retourne vide, utiliser analyses_disponibles et imagerie_disponible
                            const exams: ExaminationType[] = [];
                            if (selectedAnalyses.length > 0) {
                                selectedAnalyses.forEach(nom => {
                                    exams.push({ nom, categorie: 'analyse' });
                                });
                            }
                            if (selectedImagerie.length > 0) {
                                selectedImagerie.forEach(nom => {
                                    exams.push({ nom, categorie: 'imagerie' });
                                });
                            }
                            setExaminationTypes(exams);
                        }
                    }
                } catch (error: any) {
                    console.error('[LaboratoireFormScreen] Erreur chargement types examens:', error);
                    // Utiliser les données du formulaire comme fallback
                    const exams: ExaminationType[] = [];
                    selectedAnalyses.forEach(nom => exams.push({ nom, categorie: 'analyse' }));
                    selectedImagerie.forEach(nom => exams.push({ nom, categorie: 'imagerie' }));
                    setExaminationTypes(exams);
                } finally {
                    setLoadingExaminations(false);
                }
            }
        };

        if (serviceId && specializedServiceId) {
            loadExaminationTypes();
        } else if (selectedAnalyses.length > 0 || selectedImagerie.length > 0) {
            // Fallback : utiliser les sélections actuelles
            const exams: ExaminationType[] = [];
            selectedAnalyses.forEach(nom => exams.push({ nom, categorie: 'analyse' }));
            selectedImagerie.forEach(nom => exams.push({ nom, categorie: 'imagerie' }));
            setExaminationTypes(exams);
        }
    }, [serviceId, specializedServiceId, selectedAnalyses, selectedImagerie]);

    // ✅ NOUVEAU: Filtrer les types d'examens selon la recherche
    const filteredExaminations = examinationTypes.filter((exam) => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
            exam.nom.toLowerCase().includes(query) ||
            exam.categorie.toLowerCase().includes(query) ||
            (exam.preparation_requise && exam.preparation_requise.toLowerCase().includes(query))
        );
    });

    // ✅ NOUVEAU: Calculer les statistiques
    const stats = {
        total: examinationTypes.length,
        analyses: examinationTypes.filter(e => e.categorie === 'analyse').length,
        imagerie: examinationTypes.filter(e => e.categorie === 'imagerie').length,
        avecPrix: examinationTypes.filter(e => e.prix && e.prix > 0).length,
    };

    const handleGPSSelect = (coordinates: string) => {
        setSelectedGPS(coordinates);
        setShowGPSModal(false);
    };

    // ✅ NOUVEAU: Gestion des types d'examens
    const openExaminationModal = (exam?: ExaminationType) => {
        if (exam) {
            setEditingExamination(exam);
            setExaminationFormData(exam);
        } else {
            setEditingExamination(null);
            setExaminationFormData({
                nom: '',
                categorie: 'analyse',
                prix: undefined,
                duree_estimee: '',
                preparation_requise: '',
            });
        }
        setShowExaminationModal(true);
    };

    const closeExaminationModal = () => {
        setShowExaminationModal(false);
        setEditingExamination(null);
        setExaminationFormData({
            nom: '',
            categorie: 'analyse',
            prix: undefined,
            duree_estimee: '',
            preparation_requise: '',
        });
    };

    const handleSaveExamination = () => {
        if (!examinationFormData.nom.trim()) {
            Alert.alert('Erreur', 'Le nom de l\'examen est obligatoire');
            return;
        }

        // Ajouter à la liste locale (pour l'instant, pas d'endpoint backend dédié)
        if (editingExamination) {
            setExaminationTypes(prev => prev.map(e => 
                e.nom === editingExamination.nom ? examinationFormData : e
            ));
        } else {
            setExaminationTypes(prev => [...prev, examinationFormData]);
        }

        // Mettre à jour les sélections
        if (examinationFormData.categorie === 'analyse') {
            if (!selectedAnalyses.includes(examinationFormData.nom)) {
                setSelectedAnalyses(prev => [...prev, examinationFormData.nom]);
            }
        } else {
            if (!selectedImagerie.includes(examinationFormData.nom)) {
                setSelectedImagerie(prev => [...prev, examinationFormData.nom]);
            }
        }

        closeExaminationModal();
        Alert.alert('Succès', editingExamination ? 'Type d\'examen modifié' : 'Type d\'examen ajouté');
    };

    const handleDeleteExamination = (exam: ExaminationType) => {
        Alert.alert(
            'Confirmer la suppression',
            `Êtes-vous sûr de vouloir supprimer "${exam.nom}" ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => {
                        setExaminationTypes(prev => prev.filter(e => e.nom !== exam.nom));
                        if (exam.categorie === 'analyse') {
                            setSelectedAnalyses(prev => prev.filter(n => n !== exam.nom));
                        } else {
                            setSelectedImagerie(prev => prev.filter(n => n !== exam.nom));
                        }
                        Alert.alert('Succès', 'Type d\'examen supprimé');
                    },
                },
            ]
        );
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

        const nom = formData.partner?.name || formData.nom;
        if (!nom.trim()) {
            Alert.alert('Erreur', 'Veuillez sélectionner un partenaire ou saisir le nom du laboratoire');
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
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>Enregistrer un Laboratoire</Text>
                        {/* ✅ NOUVEAU: Afficher le nom du partenaire dans l'en-tête */}
                        {user?.role === 'partenaire' && partnerData && (
                            <View style={styles.partnerHeader}>
                                <SafeIcon name="building" size={16} color={modernColors.primary} />
                                <Text style={styles.partnerName}>{partnerData.name}</Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={styles.form}>
                    {/* ✅ Masquer les champs redondants pour les partenaires */}
                    {user?.role !== 'partenaire' && (
                        <View style={styles.inputGroup}>
                            <NativeInput
                                label="Nom du laboratoire *"
                                value={formData.nom}
                                onChangeText={(text) => setFormData({ ...formData, nom: text })}
                                placeholder="Ex: Laboratoire Central"
                            />
                        </View>
                    )}

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

                    {/* ✅ Masquer l'adresse pour les partenaires (chargée automatiquement) */}
                    {user?.role !== 'partenaire' && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Adresse</Text>
                            <NativeInput
                                value={formData.adresse}
                                onChangeText={(text) => setFormData({ ...formData, adresse: text })}
                                placeholder="Adresse complète"
                                multiline
                            />
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label="Quartier"
                            value={formData.quartier ? (typeof formData.quartier === 'string' ? { raw: formData.quartier, place_name: formData.quartier } : formData.quartier) : ''}
                            onSelect={(location: LocationObject) => {
                                // ✅ CORRECTION: Extraire la valeur à stocker (string ou LocationObject selon besoin)
                                const quartierValue = location.raw || location.place_name || '';
                                setFormData({ 
                                    ...formData, 
                                    quartier: quartierValue,
                                    // ✅ NOUVEAU: Extraire automatiquement ville et pays si disponibles
                                    ville: location.components?.ville || formData.ville,
                                    pays: location.components?.pays || formData.pays,
                                });
                            }}
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

                    {/* ✅ NOUVEAU: Section Gestion des types d'examens */}
                    {serviceId && specializedServiceId && (
                        <View style={styles.examinationsSection}>
                            <View style={styles.sectionHeader}>
                                <View style={styles.sectionTitleContainer}>
                                    <SafeIcon name="microscope" size={20} color={modernColors.primary} type="lucide" />
                                    <Text style={styles.sectionTitle}>Types d'examens disponibles</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.addButton}
                                    onPress={() => openExaminationModal()}
                                >
                                    <SafeIcon name="plus" size={18} color="#fff" type="lucide" />
                                    <Text style={styles.addButtonText}>Ajouter</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Statistiques */}
                            {examinationTypes.length > 0 && (
                                <View style={styles.statsContainer}>
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{stats.total}</Text>
                                        <Text style={styles.statLabel}>Total</Text>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{stats.analyses}</Text>
                                        <Text style={styles.statLabel}>Analyses</Text>
                                    </View>
                                    <View style={styles.statDivider} />
                                    <View style={styles.statItem}>
                                        <Text style={styles.statValue}>{stats.imagerie}</Text>
                                        <Text style={styles.statLabel}>Imagerie</Text>
                                    </View>
                                </View>
                            )}

                            {/* Barre de recherche */}
                            {examinationTypes.length > 0 && (
                                <View style={styles.searchContainer}>
                                    <SafeIcon name="search" size={18} color="#9CA3AF" type="lucide" />
                                    <NativeInput
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        placeholder="Rechercher un examen..."
                                        style={styles.searchInput}
                                    />
                                    {searchQuery.trim() && (
                                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                                            <SafeIcon name="x" size={18} color="#9CA3AF" type="lucide" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}

                            {loadingExaminations ? (
                                <Text style={styles.loadingText}>Chargement...</Text>
                            ) : filteredExaminations.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <SafeIcon name="file-x" size={48} color="#9CA3AF" type="lucide" />
                                    <Text style={styles.emptyText}>
                                        {searchQuery.trim() ? 'Aucun résultat' : 'Aucun type d\'examen enregistré'}
                                    </Text>
                                    {!searchQuery.trim() && (
                                        <Text style={styles.emptyHint}>
                                            Ajoutez les types d'examens que votre laboratoire propose
                                        </Text>
                                    )}
                                </View>
                            ) : (
                                <View style={styles.examinationsList}>
                                    {filteredExaminations.map((exam, index) => (
                                        <View key={`${exam.nom}-${index}`} style={styles.examinationCard}>
                                            <View style={styles.examinationInfo}>
                                                <View style={styles.examinationHeader}>
                                                    <Text style={styles.examinationName}>{exam.nom}</Text>
                                                    <View style={[
                                                        styles.categoryBadge,
                                                        exam.categorie === 'analyse' ? styles.badgeAnalyse : styles.badgeImagerie
                                                    ]}>
                                                        <Text style={styles.categoryText}>
                                                            {exam.categorie === 'analyse' ? 'Analyse' : 'Imagerie'}
                                                        </Text>
                                                    </View>
                                                </View>
                                                {exam.prix && exam.prix > 0 && (
                                                    <Text style={styles.examinationPrice}>
                                                        {exam.prix.toLocaleString()} FCFA
                                                    </Text>
                                                )}
                                                {exam.duree_estimee && (
                                                    <Text style={styles.examinationDuration}>
                                                        Durée: {exam.duree_estimee}
                                                    </Text>
                                                )}
                                                {exam.preparation_requise && (
                                                    <Text style={styles.examinationPrep}>
                                                        Préparation: {exam.preparation_requise}
                                                    </Text>
                                                )}
                                            </View>
                                            <View style={styles.examinationActions}>
                                                <TouchableOpacity
                                                    style={styles.actionButton}
                                                    onPress={() => openExaminationModal(exam)}
                                                >
                                                    <SafeIcon name="edit" size={18} color={modernColors.primary} type="lucide" />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.actionButton, styles.deleteButton]}
                                                    onPress={() => handleDeleteExamination(exam)}
                                                >
                                                    <SafeIcon name="trash-2" size={18} color="#DC2626" type="lucide" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            )}
                            {searchQuery.trim() && filteredExaminations.length > 0 && (
                                <Text style={styles.searchResultsText}>
                                    {filteredExaminations.length} résultat(s) sur {examinationTypes.length}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* ✅ CORRIGÉ: Utiliser title au lieu de children */}
                    <NativeButton
                        title={loading ? 'Enregistrement...' : 'Enregistrer le Laboratoire'}
                        onPress={handleSubmit}
                        disabled={loading || !(formData.partner?.name || formData.nom).trim()}
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

            {/* ✅ NOUVEAU: Modal pour ajouter/modifier un type d'examen */}
            <Modal
                visible={showExaminationModal}
                animationType="slide"
                transparent={true}
                onRequestClose={closeExaminationModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingExamination ? 'Modifier le type d\'examen' : 'Ajouter un type d\'examen'}
                            </Text>
                            <TouchableOpacity onPress={closeExaminationModal}>
                                <SafeIcon name="x" size={24} color="#6B7280" type="lucide" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Nom de l'examen *</Text>
                                <NativeInput
                                    value={examinationFormData.nom}
                                    onChangeText={(text) => setExaminationFormData({ ...examinationFormData, nom: text })}
                                    placeholder="Ex: Analyse de sang complète"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Catégorie *</Text>
                                <View style={styles.chipsContainer}>
                                    <TouchableOpacity
                                        style={[
                                            styles.chip,
                                            examinationFormData.categorie === 'analyse' && styles.chipSelected,
                                        ]}
                                        onPress={() => setExaminationFormData({ ...examinationFormData, categorie: 'analyse' })}
                                    >
                                        <Text
                                            style={[
                                                styles.chipText,
                                                examinationFormData.categorie === 'analyse' && styles.chipTextSelected,
                                            ]}
                                        >
                                            Analyse
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.chip,
                                            examinationFormData.categorie === 'imagerie' && styles.chipSelected,
                                        ]}
                                        onPress={() => setExaminationFormData({ ...examinationFormData, categorie: 'imagerie' })}
                                    >
                                        <Text
                                            style={[
                                                styles.chipText,
                                                examinationFormData.categorie === 'imagerie' && styles.chipTextSelected,
                                            ]}
                                        >
                                            Imagerie
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                    <Text style={styles.label}>Prix (FCFA)</Text>
                                    <NativeInput
                                        value={examinationFormData.prix?.toString() || ''}
                                        onChangeText={(text) => setExaminationFormData({ 
                                            ...examinationFormData, 
                                            prix: text ? parseFloat(text) : undefined 
                                        })}
                                        placeholder="0"
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                    <Text style={styles.label}>Durée estimée</Text>
                                    <NativeInput
                                        value={examinationFormData.duree_estimee || ''}
                                        onChangeText={(text) => setExaminationFormData({ ...examinationFormData, duree_estimee: text })}
                                        placeholder="Ex: 30 min"
                                    />
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Préparation requise</Text>
                                <NativeInput
                                    value={examinationFormData.preparation_requise || ''}
                                    onChangeText={(text) => setExaminationFormData({ ...examinationFormData, preparation_requise: text })}
                                    placeholder="Ex: À jeun depuis 12h"
                                    multiline
                                />
                            </View>
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <NativeButton
                                title="Annuler"
                                onPress={closeExaminationModal}
                                variant="secondary"
                                style={styles.modalButton}
                            />
                            <NativeButton
                                title={editingExamination ? 'Modifier' : 'Ajouter'}
                                onPress={handleSaveExamination}
                                variant="primary"
                                style={styles.modalButton}
                                disabled={!examinationFormData.nom.trim()}
                            />
                        </View>
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
    // ✅ NOUVEAU: Styles pour la section types d'examens
    examinationsSection: {
        marginTop: 24,
        marginBottom: 16,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
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
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        backgroundColor: '#fff',
    },
    loadingText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        padding: 16,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginTop: 12,
        marginBottom: 8,
    },
    emptyHint: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    examinationsList: {
        gap: 12,
    },
    examinationCard: {
        flexDirection: 'row',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    examinationInfo: {
        flex: 1,
    },
    examinationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    examinationName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
    },
    categoryBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    badgeAnalyse: {
        backgroundColor: '#EEF2FF',
    },
    badgeImagerie: {
        backgroundColor: '#F0FDF4',
    },
    categoryText: {
        fontSize: 12,
        fontWeight: '500',
        color: modernColors.primary,
    },
    examinationPrice: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
        marginBottom: 4,
    },
    examinationDuration: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    examinationPrep: {
        fontSize: 12,
        color: '#6B7280',
        fontStyle: 'italic',
    },
    examinationActions: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
    },
    actionButton: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#F3F4F6',
    },
    deleteButton: {
        backgroundColor: '#FEE2E2',
    },
    searchResultsText: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
        fontStyle: 'italic',
    },
    // ✅ NOUVEAU: Styles pour le modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    modalBody: {
        padding: 16,
        maxHeight: 500,
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    modalButton: {
        flex: 1,
    },
});

export default LaboratoireFormScreen;

