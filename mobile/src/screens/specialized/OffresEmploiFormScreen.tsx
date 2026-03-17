// ✅ NOUVEAU: Écran de création/édition d'offres d'emploi pour les recruteurs

import DateTimePicker from '@react-native-community/datetimepicker';
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
import FormConfirmationModal, { ConfirmationSection } from '../../components/FormConfirmationModal';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import PartnerHeader from '../../components/PartnerHeader';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import SimplePrestationSelector from '../../components/SimplePrestationSelector';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { clearSavedFormData, loadSavedFormData, useFormAutoSave } from '../../hooks/useFormAutoSave';
import { useFormValidation } from '../../hooks/useFormValidation';
import { usePartnerData } from '../../hooks/usePartnerData';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';

const STORAGE_KEY = '@offres_emploi_form';

const OffresEmploiFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
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
    const [showConfirmation, setShowConfirmation] = useState(false);

    const { partnerData } = usePartnerData(user?.role);
    const { errors, validateField, validateForm, setError } = useFormValidation({
        titre_poste: { required: true, minLength: 3 },
        description: { required: true, minLength: 10 },
        secteur: { required: true },
        salaire_min: {
            custom: (value) => {
                if (value && formData.salaire_max) {
                    const min = parseFloat(value);
                    const max = parseFloat(formData.salaire_max);
                    if (!isNaN(min) && !isNaN(max) && min > max) {
                        return t('offresEmploiFormScreen.leSalaireMinNePeutPas');
                    }
                }
                return null;
            }
        },
    });

    useEffect(() => {
        const loadSaved = async () => {
            const saved = await loadSavedFormData<typeof formData>(STORAGE_KEY);
            if (saved) {
                setFormData(saved);
                setSelectedCompetences(saved.competences_requises || []);
                setSelectedLangues(saved.langues_requises || []);
                setSelectedPermis(saved.permis_requis || []);
                setSelectedTags(saved.tags || []);
                Alert.alert(t('offresEmploiForm.dataRestored'), t('offresEmploiForm.dataRestoredMsg'));
            }
        };
        loadSaved();
    }, []);

    useFormAutoSave(STORAGE_KEY, formData, true, 1000);

    const typesContrat = ['CDI', 'CDD', 'Stage', 'Freelance', 'Temps partiel', 'Alternance'];
    const niveauxEtude = ['Bac', 'Bac+2', 'Bac+3', 'Bac+5', 'Master', 'Doctorat'];
    const secteurs = [
        'Informatique', 'Commerce', t('offresEmploiFormScreen.sante'), t('offresEmploiFormScreen.education'), 'Finance', 'Marketing',
        'Ressources Humaines', t('offresEmploiFormScreen.ingenierie'), 'Juridique', 'Communication', 'Autre'
    ];
    const competencesOptions = [
        'Gestion de projet', 'Communication', 'Leadership', 'Analyse', t('offresEmploiFormScreen.creativite'),
        t('offresEmploiFormScreen.travailEnEquipe'), 'Autonome', t('offresEmploiFormScreen.organise'), 'Polyvalent', 'Rigoureux'
    ];
    const languesOptions = [t('offresEmploiFormScreen.francais'), 'Anglais', 'Espagnol', 'Allemand', 'Arabe', 'Autre'];
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
                    const resData = (response?.data || response) as any;

                    if (resData?.success && resData?.data) {
                        const data = resData.data;
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

    const handleFieldChange = (field: string, value: any) => {
        setFormData({ ...formData, [field]: value });
        const error = validateField(field, value);
        if (error) {
            setError(field, error);
        }
    };

    const confirmationSections: ConfirmationSection[] = [
        {
            title: t('offresEmploiForm.informationsGenerales'),
            icon: 'briefcase',
            fields: [
                { label: 'Titre du poste', value: formData.titre_poste },
                { label: t('offresEmploiForm.typeDeContrat'), value: formData.type_contrat },
                { label: 'Secteur', value: formData.secteur },
                { label: 'Domaine', value: formData.domaine },
            ],
        },
        {
            title: t('offresEmploiForm.localisation'),
            icon: 'map-pin',
            fields: [
                { label: t('offresEmploiForm.lieuDeTravail'), value: formData.lieu_travail?.place_name || t('offresEmploiForm.teletravail') },
                { label: t('offresEmploiForm.teletravail'), value: formData.remote, type: 'boolean' as const },
                { label: t('offresEmploiForm.teletravailPartiel'), value: formData.remote_partiel, type: 'boolean' as const },
            ],
        },
        {
            title: t('offresEmploiForm.remuneration'),
            icon: 'dollar-sign',
            fields: [
                { label: 'Salaire min', value: formData.salaire_min ? `${formData.salaire_min} ${formData.devise}` : t('offresEmploiFormScreen.nonRenseigne') },
                { label: 'Salaire max', value: formData.salaire_max ? `${formData.salaire_max} ${formData.devise}` : t('offresEmploiFormScreen.nonRenseigne') },
                { label: t('offresEmploiForm.negociable'), value: formData.salaire_negociable, type: 'boolean' as const },
            ],
        },
        {
            title: t('offresEmploiForm.profilRecherche'),
            icon: 'user',
            fields: [
                { label: 'Niveau d\t('offresEmploiFormScreen.etudes'), value: formData.niveau_etude },
                { label: t('offresEmploiForm.experienceMin'), value: formData.experience_min ? `${formData.experience_min} ans` : t('offresEmploiFormScreen.nonRenseigne') },
                { label: t('offresEmploiForm.competences'), value: selectedCompetences.join(', ') },
                { label: 'Langues', value: selectedLangues.join(', ') },
            ],
        },
    ];

    const handleSubmit = () => {
        if (!validateForm(formData)) {
            Alert.alert(t('message.error'), t('offresEmploiForm.fixFormErrors'));
            return;
        }

        if (!formData.lieu_travail && !formData.remote) {
            Alert.alert(t('message.error'), t('offresEmploiForm.workLocationRequired'));
            return;
        }

        if (formData.date_limite_candidature) {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            const dateLimite = new Date(formData.date_limite_candidature);
            dateLimite.setHours(0, 0, 0, 0);
            if (dateLimite < now) {
                Alert.alert(t('offresEmploiForm.validation'), t('offresEmploiForm.deadlineInPast'));
                return;
            }
        }

        setShowConfirmation(true);
    };

    const handleFinalSubmit = async () => {

        try {
            setLoading(true);

            const payload: any = {
                titre_poste: formData.titre_poste.trim(),
                description: formData.description.trim(),
                type_contrat: formData.type_contrat,
                duree_contrat: formData.duree_contrat ? parseInt(formData.duree_contrat) : null,
                lieu_travail: formData.lieu_travail?.raw || formData.lieu_travail?.place_name || (formData.remote ? t('offresEmploiFormScreen.teletravail') : ''),
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

            const resData = (response?.data || response) as any;
            if (resData?.success) {
                await clearSavedFormData(STORAGE_KEY);
                Alert.alert(
                    t('message.success'),
                    mode === 'edit' ? t('offresEmploiForm.offerEdited') : t('offresEmploiForm.offerCreated'),
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert(t('message.error'), resData?.message || resData?.error || t('offresEmploiForm.cannotSaveOffer'));
            }
        } catch (error: any) {
            console.error('Erreur création offre:', error);
            Alert.alert(t('message.error'), error.message || t('offresEmploiForm.errorOccurred'));
        } finally {
            setLoading(false);
            setShowConfirmation(false);
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
                        {mode === 'edit' ? 'Modifier l\'offre' : t('offresEmploiFormScreen.creerUneOffreDemploi')}
                    </Text>
                </View>

                <View style={styles.form}>
                    {user?.role === 'partenaire' && (
                        <PartnerHeader
                            partnerName={partnerData?.name}
                            logoUrl={partnerData?.logo_url}
                            subtitle="Espace recruteur"
                        />
                    )}

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Titre du poste *</Text>
                        <NativeInput
                            value={formData.titre_poste}
                            onChangeText={(text) => handleFieldChange('titre_poste', text)}
                            placeholder={t('offresEmploiForm.exDeveloppeurFullStack')}
                            error={errors.titre_poste}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Description *</Text>
                        <NativeInput
                            value={formData.description}
                            onChangeText={(text) => handleFieldChange('description', text)}
                            placeholder={t('offresEmploiForm.descriptionDetailleeDuPoste')}
                            multiline
                            style={styles.textArea}
                            error={errors.description}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('offresEmploiForm.typeDeContrat')}</Text>
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
                            <Text style={styles.label}>{t('offresEmploiForm.dureeDuContratMois')}</Text>
                            <NativeInput
                                value={formData.duree_contrat}
                                onChangeText={(text) => setFormData({ ...formData, duree_contrat: text })}
                                placeholder="Ex: 6"
                                keyboardType="numeric"
                            />
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('offresEmploiForm.lieuDeTravail')}</Text>
                        <LocationSelector
                            label=""
                            value={formData.lieu_travail ? (typeof formData.lieu_travail === 'string' ? { raw: formData.lieu_travail, place_name: formData.lieu_travail } : formData.lieu_travail) : ''}
                            onSelect={(location: LocationObject) => {
                                setFormData({ ...formData, lieu_travail: location });
                            }}
                            placeholder={t('offresEmploiForm.rechercherUnLieuVilleQuartier')}
                            scope="all"
                            enrichWithBackend={true}
                        />
                        <View style={styles.switchGroup}>
                            <Text style={styles.label}>{t('offresEmploiForm.teletravailComplet')}</Text>
                            <Switch
                                value={formData.remote}
                                onValueChange={(value) => setFormData({ ...formData, remote: value })}
                                trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                            />
                        </View>
                        {!formData.remote && (
                            <View style={styles.switchGroup}>
                                <Text style={styles.label}>{t('offresEmploiForm.teletravailPartiel')}</Text>
                                <Switch
                                    value={formData.remote_partiel}
                                    onValueChange={(value) => setFormData({ ...formData, remote_partiel: value })}
                                    trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                                />
                            </View>
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('offresEmploiForm.adresseComplete')}</Text>
                        <NativeInput
                            value={formData.adresse}
                            onChangeText={(text) => setFormData({ ...formData, adresse: text })}
                            placeholder={t('offresEmploiForm.adresseCompleteDuLieuDe')}
                            multiline
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('offresEmploiForm.localisationGps')}</Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => setShowGPSModal(true)}
                        >
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <Text style={styles.gpsButtonText}>
                                {selectedGPS ? t('offresEmploiFormScreen.localisationSelectionnee') : t('offresEmploiFormScreen.selectionnerSurLaCarte')}
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
                        <Text style={styles.label}>{t('offresEmploiForm.salaireNegociable')}</Text>
                        <Switch
                            value={formData.salaire_negociable}
                            onValueChange={(value) => setFormData({ ...formData, salaire_negociable: value })}
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('offresEmploiForm.niveauDetudesRequis')}</Text>
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
                        <Text style={styles.label}>{t('offresEmploiForm.experienceMinimaleAnnees')}</Text>
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
                                    onPress={() => handleFieldChange('secteur', secteur)}
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
                        {errors.secteur && <Text style={styles.errorText}>{errors.secteur}</Text>}
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
                            label={t('offresEmploiForm.competencesRequises')}
                            options={competencesOptions}
                            selected={selectedCompetences}
                            onSelectionChange={setSelectedCompetences}
                            allowCustom={true}
                            placeholder={t('offresEmploiForm.ajouterUneCompetence')}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <SimplePrestationSelector
                            label="Langues requises"
                            options={languesOptions}
                            selected={selectedLangues}
                            onSelectionChange={setSelectedLangues}
                            allowCustom={true}
                            placeholder={t('offresEmploiForm.ajouterUneLangue')}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <SimplePrestationSelector
                            label="Permis requis"
                            options={permisOptions}
                            selected={selectedPermis}
                            onSelectionChange={setSelectedPermis}
                            allowCustom={false}
                            placeholder={t('offresEmploiForm.selectionnerUnPermis')}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <SimplePrestationSelector
                            label="Tags"
                            options={[]}
                            selected={selectedTags}
                            onSelectionChange={setSelectedTags}
                            allowCustom={true}
                            placeholder={t('offresEmploiForm.ajouterUnTagExUrgent')}
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
                                    : t('offresEmploiFormScreen.selectionnerUneDate')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('offresEmploiForm.dateDeDebutDuPoste')}</Text>
                        <TouchableOpacity
                            style={styles.dateButton}
                            onPress={() => setShowDateDebutPicker(true)}
                        >
                            <SafeIcon name="calendar" size={18} color={modernColors.primary} />
                            <Text style={styles.dateButtonText}>
                                {formData.date_debut_poste
                                    ? formData.date_debut_poste.toLocaleDateString('fr-FR')
                                    : t('offresEmploiFormScreen.selectionnerUneDate')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <NativeButton
                        title={loading ? 'Enregistrement...' : mode === 'edit' ? 'Modifier l\'offre' : t('offresEmploiFormScreen.creerLoffre')}
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
                title={t('offresEmploiForm.selectionnerLaLocalisation')}
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

            <FormConfirmationModal
                visible={showConfirmation}
                title={t('offresEmploiForm.confirmerLaCreationDeL')}offre"
                sections={confirmationSections}
                onConfirm={handleFinalSubmit}
                onCancel={() => setShowConfirmation(false)}
                loading={loading}
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
    errorText: {
        fontSize: 12,
        color: '#EF4444',
        marginTop: 4,
    },
});

export default OffresEmploiFormScreen;

