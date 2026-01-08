// ✅ NOUVEAU: Écran de création/édition d'offres d'emploi pour les recruteurs

import { useNavigation, useRoute } from '@react-navigation/native';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import SimplePrestationSelector from '../../components/SimplePrestationSelector';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiGet, apiPost, apiPut, servicesApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';

const OffresEmploiFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);
    const offreId = (route.params as any)?.offreId as number | undefined;
    const mode = (route.params as any)?.mode as string | undefined;

    const [formData, setFormData] = useState({
        titre_poste: '',
        description: '',
        type_contrat: 'CDI',
        duree_contrat: '',
        lieu_travail: null as LocationObject | null,
        adresse: '',
        remote: false,
        remote_partiel: false,
        salaire_min: '',
        salaire_max: '',
        devise: 'XAF',
        salaire_negociable: false,
        niveau_etude: '',
        experience_min: '',
        competences_requises: [] as string[],
        langues_requises: [] as string[],
        permis_requis: [] as string[],
        secteur: '',
        domaine: '',
        tags: [] as string[],
        date_limite_candidature: null as Date | null,
        date_debut_poste: null as Date | null,
    });

    const [loading, setLoading] = useState(false);
    const [selectedCompetences, setSelectedCompetences] = useState<string[]>([]);
    const [selectedLangues, setSelectedLangues] = useState<string[]>([]);
    const [selectedPermis, setSelectedPermis] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [selectedGPS, setSelectedGPS] = useState<string | null>(null);
    const [showDateLimitePicker, setShowDateLimitePicker] = useState(false);
    const [showDateDebutPicker, setShowDateDebutPicker] = useState(false);

    const typesContrat = ['CDI', 'CDD', 'Stage', 'Freelance', 'Temps partiel', 'Alternance'];
    const niveauxEtude = ['Bac', 'Bac+2', 'Bac+3', 'Bac+5', 'Master', 'Doctorat'];
    const secteurs = [
        'Informatique', 'Commerce', 'Santé', 'Éducation', 'Finance', 'Marketing',
        'Ressources Humaines', 'Ingénierie', 'Juridique', 'Communication', 'Autre'
    ];
    const competencesOptions = [
        'Gestion de projet', 'Communication', 'Leadership', 'Analyse', 'Créativité',
        'Travail en équipe', 'Autonome', 'Organisé', 'Polyvalent', 'Rigoureux'
    ];
    const languesOptions = ['Français', 'Anglais', 'Espagnol', 'Allemand', 'Arabe', 'Autre'];
    const permisOptions = ['Permis B', 'Permis A', 'Permis C', 'Permis D', 'Aucun'];

    // ✅ Récupération automatique de la devise depuis lieu_travail (avec GPS comme fallback)
    useEffect(() => {
        if (formData.lieu_travail) {
            const currency = getCurrencyIntelligently(
                formData.lieu_travail,
                location?.coords ? {
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                } : null
            );
            if (currency) {
                setFormData(prev => ({ ...prev, devise: currency }));
            }
        } else if (location?.coords) {
            // Si pas de lieu_travail mais GPS disponible, utiliser la devise depuis GPS
            // Pour l'instant, fallback XAF (sera amélioré avec reverse geocoding)
            setFormData(prev => ({ ...prev, devise: 'XAF' }));
        }
    }, [formData.lieu_travail, location]);

    // ✅ Charger les données existantes si mode='edit'
    useEffect(() => {
        const loadExistingData = async () => {
            if (mode === 'edit' && offreId) {
                try {
                    setLoading(true);
                    const response = await apiGet(`/api/offres-emploi/${offreId}`);

                    if (response.success && response.data) {
                        const data = response.data;
                        setFormData({
                            titre_poste: data.titre_poste || '',
                            description: data.description || '',
                            type_contrat: data.type_contrat || 'CDI',
                            duree_contrat: data.duree_contrat?.toString() || '',
                            lieu_travail: data.lieu_travail ? { raw: data.lieu_travail, place_name: data.lieu_travail } : null,
                            adresse: data.adresse || '',
                            remote: data.remote || false,
                            remote_partiel: data.remote_partiel || false,
                            salaire_min: data.salaire_min?.toString() || '',
                            salaire_max: data.salaire_max?.toString() || '',
                            devise: data.devise || 'XAF',
                            salaire_negociable: data.salaire_negociable || false,
                            niveau_etude: data.niveau_etude || '',
                            experience_min: data.experience_min?.toString() || '',
                            competences_requises: data.competences_requises || [],
                            langues_requises: data.langues_requises || [],
                            permis_requis: data.permis_requis || [],
                            secteur: data.secteur || '',
                            domaine: data.domaine || '',
                            tags: data.tags || [],
                            date_limite_candidature: data.date_limite_candidature ? new Date(data.date_limite_candidature) : null,
                            date_debut_poste: data.date_debut_poste ? new Date(data.date_debut_poste) : null,
                        });

                        setSelectedCompetences(data.competences_requises || []);
                        setSelectedLangues(data.langues_requises || []);
                        setSelectedPermis(data.permis_requis || []);
                        setSelectedTags(data.tags || []);
                        if (data.gps) {
                            setSelectedGPS(data.gps);
                        }
                    }
                } catch (error: any) {
                    console.error('[OffresEmploiFormScreen] Erreur chargement données:', error);
                } finally {
                    setLoading(false);
                }
            }
        };

        loadExistingData();
    }, [mode, offreId]);

    const handleGPSSelect = (coordinates: string) => {
        setSelectedGPS(coordinates);
        setShowGPSModal(false);
    };

    const handleSubmit = async () => {
        if (!formData.titre_poste.trim()) {
            Alert.alert('Erreur', 'Le titre du poste est obligatoire');
            return;
        }

        if (!formData.description.trim()) {
            Alert.alert('Erreur', 'La description est obligatoire');
            return;
        }

        if (!formData.lieu_travail && !formData.remote) {
            Alert.alert('Erreur', 'Le lieu de travail est obligatoire (ou cochez "Télétravail")');
            return;
        }

        if (!formData.secteur.trim()) {
            Alert.alert('Erreur', 'Le secteur est obligatoire');
            return;
        }

        try {
            setLoading(true);

            const payload: any = {
                titre_poste: formData.titre_poste.trim(),
                description: formData.description.trim(),
                type_contrat: formData.type_contrat,
                duree_contrat: formData.duree_contrat ? parseInt(formData.duree_contrat) : null,
                lieu_travail: formData.lieu_travail?.raw || formData.lieu_travail?.place_name || (formData.remote ? 'Télétravail' : ''),
                adresse: formData.adresse.trim() || null,
                gps: selectedGPS || (location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null),
                remote: formData.remote,
                remote_partiel: formData.remote_partiel,
                salaire_min: formData.salaire_min ? parseFloat(formData.salaire_min) : null,
                salaire_max: formData.salaire_max ? parseFloat(formData.salaire_max) : null,
                devise: formData.devise,
                salaire_negociable: formData.salaire_negociable,
                niveau_etude: formData.niveau_etude || null,
                experience_min: formData.experience_min ? parseInt(formData.experience_min) : null,
                competences_requises: selectedCompetences.length > 0 ? selectedCompetences : null,
                langues_requises: selectedLangues.length > 0 ? selectedLangues : null,
                permis_requis: selectedPermis.length > 0 ? selectedPermis : null,
                secteur: formData.secteur,
                domaine: formData.domaine.trim() || null,
                tags: selectedTags.length > 0 ? selectedTags : null,
                date_limite_candidature: formData.date_limite_candidature
                    ? formData.date_limite_candidature.toISOString().split('T')[0]
                    : null,
                date_debut_poste: formData.date_debut_poste
                    ? formData.date_debut_poste.toISOString().split('T')[0]
                    : null,
            };

            let response;
            if (mode === 'edit' && offreId) {
                // TODO: Vérifier si endpoint PUT existe
                response = await apiPost(`/api/offres-emploi/${offreId}`, payload);
            } else {
                response = await apiPost('/api/offres-emploi', payload);
            }

            if (response.success) {
                Alert.alert(
                    'Succès',
                    mode === 'edit' ? 'Offre d\'emploi modifiée avec succès !' : 'Offre d\'emploi créée avec succès !',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer l\'offre');
            }
        } catch (error: any) {
            console.error('Erreur création offre:', error);
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
                        {mode === 'edit' ? 'Modifier l\'offre' : 'Créer une offre d\'emploi'}
                    </Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Titre du poste *</Text>
                        <NativeInput
                            value={formData.titre_poste}
                            onChangeText={(text) => setFormData({ ...formData, titre_poste: text })}
                            placeholder="Ex: Développeur Full Stack"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Description *</Text>
                        <NativeInput
                            value={formData.description}
                            onChangeText={(text) => setFormData({ ...formData, description: text })}
                            placeholder="Description détaillée du poste..."
                            multiline
                            style={styles.textArea}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Type de contrat *</Text>
                        <View style={styles.chipsContainer}>
                            {typesContrat.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.chip,
                                        formData.type_contrat === type && styles.chipSelected,
                                    ]}
                                    onPress={() => setFormData({ ...formData, type_contrat: type })}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            formData.type_contrat === type && styles.chipTextSelected,
                                        ]}
                                    >
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {formData.type_contrat === 'CDD' && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Durée du contrat (mois)</Text>
                            <NativeInput
                                value={formData.duree_contrat}
                                onChangeText={(text) => setFormData({ ...formData, duree_contrat: text })}
                                placeholder="Ex: 6"
                                keyboardType="numeric"
                            />
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Lieu de travail *</Text>
                        <LocationSelector
                            label=""
                            value={formData.lieu_travail ? (typeof formData.lieu_travail === 'string' ? { raw: formData.lieu_travail, place_name: formData.lieu_travail } : formData.lieu_travail) : ''}
                            onSelect={(location: LocationObject) => {
                                setFormData({ ...formData, lieu_travail: location });
                            }}
                            placeholder="Rechercher une ville..."
                            scope="city"
                            enrichWithBackend={true}
                        />
                        <View style={styles.switchGroup}>
                            <Text style={styles.label}>Télétravail complet</Text>
                            <Switch
                                value={formData.remote}
                                onValueChange={(value) => setFormData({ ...formData, remote: value })}
                                trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                            />
                        </View>
                        {!formData.remote && (
                            <View style={styles.switchGroup}>
                                <Text style={styles.label}>Télétravail partiel</Text>
                                <Switch
                                    value={formData.remote_partiel}
                                    onValueChange={(value) => setFormData({ ...formData, remote_partiel: value })}
                                    trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                                />
                            </View>
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Adresse complète</Text>
                        <NativeInput
                            value={formData.adresse}
                            onChangeText={(text) => setFormData({ ...formData, adresse: text })}
                            placeholder="Adresse complète du lieu de travail"
                            multiline
                        />
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
                            <Text style={styles.label}>Salaire min ({formData.devise})</Text>
                            <NativeInput
                                value={formData.salaire_min}
                                onChangeText={(text) => setFormData({ ...formData, salaire_min: text })}
                                placeholder="0"
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                            <Text style={styles.label}>Salaire max ({formData.devise})</Text>
                            <NativeInput
                                value={formData.salaire_max}
                                onChangeText={(text) => setFormData({ ...formData, salaire_max: text })}
                                placeholder="0"
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    <View style={styles.switchGroup}>
                        <Text style={styles.label}>Salaire négociable</Text>
                        <Switch
                            value={formData.salaire_negociable}
                            onValueChange={(value) => setFormData({ ...formData, salaire_negociable: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Niveau d'études requis</Text>
                        <View style={styles.chipsContainer}>
                            {niveauxEtude.map((niveau) => (
                                <TouchableOpacity
                                    key={niveau}
                                    style={[
                                        styles.chip,
                                        formData.niveau_etude === niveau && styles.chipSelected,
                                    ]}
                                    onPress={() => setFormData({ ...formData, niveau_etude: niveau })}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            formData.niveau_etude === niveau && styles.chipTextSelected,
                                        ]}
                                    >
                                        {niveau}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Expérience minimale (années)</Text>
                        <NativeInput
                            value={formData.experience_min}
                            onChangeText={(text) => setFormData({ ...formData, experience_min: text })}
                            placeholder="Ex: 2"
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Secteur *</Text>
                        <View style={styles.chipsContainer}>
                            {secteurs.map((secteur) => (
                                <TouchableOpacity
                                    key={secteur}
                                    style={[
                                        styles.chip,
                                        formData.secteur === secteur && styles.chipSelected,
                                    ]}
                                    onPress={() => setFormData({ ...formData, secteur })}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            formData.secteur === secteur && styles.chipTextSelected,
                                        ]}
                                    >
                                        {secteur}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Domaine</Text>
                        <NativeInput
                            value={formData.domaine}
                            onChangeText={(text) => setFormData({ ...formData, domaine: text })}
                            placeholder="Ex: E-commerce, Fintech..."
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <SimplePrestationSelector
                            label="Compétences requises"
                            options={competencesOptions}
                            selected={selectedCompetences}
                            onSelectionChange={setSelectedCompetences}
                            allowCustom={true}
                            placeholder="Ajouter une compétence"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <SimplePrestationSelector
                            label="Langues requises"
                            options={languesOptions}
                            selected={selectedLangues}
                            onSelectionChange={setSelectedLangues}
                            allowCustom={true}
                            placeholder="Ajouter une langue"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <SimplePrestationSelector
                            label="Permis requis"
                            options={permisOptions}
                            selected={selectedPermis}
                            onSelectionChange={setSelectedPermis}
                            allowCustom={false}
                            placeholder="Sélectionner un permis"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <SimplePrestationSelector
                            label="Tags"
                            options={[]}
                            selected={selectedTags}
                            onSelectionChange={setSelectedTags}
                            allowCustom={true}
                            placeholder="Ajouter un tag (ex: urgent, junior, senior...)"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Date limite de candidature</Text>
                        <TouchableOpacity
                            style={styles.dateButton}
                            onPress={() => setShowDateLimitePicker(true)}
                        >
                            <SafeIcon name="calendar" size={18} color={modernColors.primary} />
                            <Text style={styles.dateButtonText}>
                                {formData.date_limite_candidature
                                    ? formData.date_limite_candidature.toLocaleDateString('fr-FR')
                                    : 'Sélectionner une date'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Date de début du poste</Text>
                        <TouchableOpacity
                            style={styles.dateButton}
                            onPress={() => setShowDateDebutPicker(true)}
                        >
                            <SafeIcon name="calendar" size={18} color={modernColors.primary} />
                            <Text style={styles.dateButtonText}>
                                {formData.date_debut_poste
                                    ? formData.date_debut_poste.toLocaleDateString('fr-FR')
                                    : 'Sélectionner une date'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <NativeButton
                        title={loading ? 'Enregistrement...' : mode === 'edit' ? 'Modifier l\'offre' : 'Créer l\'offre'}
                        onPress={handleSubmit}
                        disabled={loading || !formData.titre_poste.trim() || !formData.description.trim() || !formData.secteur.trim()}
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

            {showDateLimitePicker && (
                <DateTimePicker
                    value={formData.date_limite_candidature || new Date()}
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={(event, date) => {
                        setShowDateLimitePicker(false);
                        if (date) {
                            setFormData({ ...formData, date_limite_candidature: date });
                        }
                    }}
                />
            )}

            {showDateDebutPicker && (
                <DateTimePicker
                    value={formData.date_debut_poste || new Date()}
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={(event, date) => {
                        setShowDateDebutPicker(false);
                        if (date) {
                            setFormData({ ...formData, date_debut_poste: date });
                        }
                    }}
                />
            )}
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
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
    },
    dateButtonText: {
        fontSize: 14,
        color: '#111827',
    },
    submitButton: {
        marginTop: 24,
    },
});

export default OffresEmploiFormScreen;

