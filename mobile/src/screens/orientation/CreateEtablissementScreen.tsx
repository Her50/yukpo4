// ✅ Écran de création/modification d'établissement scolaire
// Permet aux établissements (primaire, secondaire, universitaire, écoles de formation) 
// de charger leurs informations, filières, statistiques, performances, etc.

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiGet, apiPost, apiPut } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface EtablissementFormData {
    nom_etablissement: string;
    type_etablissement: 'primaire' | 'secondaire' | 'superieur' | 'formation';
    adresse: string;
    ville: string;
    region: string;
    quartier: string;
    telephone: string;
    email: string;
    site_web: string;
    gps_lat: string;
    gps_lon: string;
    description: string;
    filieres: string[];
    nombre_eleves: string;
    nombre_professeurs: string;
    annee_creation: string;
    directeur: string;
    is_public: boolean;
    // Statistiques et performances
    taux_reussite_bac?: string;
    taux_reussite_examens?: string;
    classement_national?: string;
    statistiques_examens?: any;
}

const CreateEtablissementScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const { location } = useLocation();
    const params = route.params as any;
    const etablissementId = params?.etablissementId;

    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(!!etablissementId);
    const [formData, setFormData] = useState<EtablissementFormData>({
        nom_etablissement: '',
        type_etablissement: 'primaire',
        adresse: '',
        ville: '',
        region: '',
        quartier: '',
        telephone: '',
        email: '',
        site_web: '',
        gps_lat: '',
        gps_lon: '',
        description: '',
        filieres: [],
        nombre_eleves: '',
        nombre_professeurs: '',
        annee_creation: '',
        directeur: '',
        is_public: false,
    });

    const [filiereInput, setFiliereInput] = useState('');
    const [showStatsSection, setShowStatsSection] = useState(false);

    const typesEtablissement = [
        { value: 'primaire', label: 'Primaire' },
        { value: 'secondaire', label: 'Secondaire' },
        { value: 'superieur', label: 'Universitaire' },
        { value: 'formation', label: 'École de Formation' },
    ];

    useEffect(() => {
        if (etablissementId) {
            loadEtablissement();
        }
    }, [etablissementId]);

    const loadEtablissement = async () => {
        try {
            setLoadingData(true);
            const response = await apiGet(`/api/orientation-scolaire/etablissements/${etablissementId}`);
            if (response.success && response.data) {
                const data = response.data as any;
                setFormData({
                    nom_etablissement: data.nom_etablissement || '',
                    type_etablissement: data.type_etablissement || 'primaire',
                    adresse: data.adresse || '',
                    ville: data.ville || '',
                    region: data.region || '',
                    quartier: data.quartier || '',
                    telephone: data.telephone || '',
                    email: data.email || '',
                    site_web: data.site_web || '',
                    gps_lat: data.gps_lat?.toString() || '',
                    gps_lon: data.gps_lon?.toString() || '',
                    description: data.description || '',
                    filieres: data.filieres || [],
                    nombre_eleves: data.nombre_eleves?.toString() || '',
                    nombre_professeurs: data.nombre_professeurs?.toString() || '',
                    annee_creation: data.annee_creation?.toString() || '',
                    directeur: data.directeur || '',
                    is_public: data.is_public || false,
                    taux_reussite_bac: data.taux_reussite_bac?.toString() || '',
                    taux_reussite_examens: data.taux_reussite_examens?.toString() || '',
                    classement_national: data.classement_national?.toString() || '',
                });
            }
        } catch (error: any) {
            console.error('[CreateEtablissementScreen] Erreur:', error);
            Alert.alert(t('message.error'), t('createEtablissement.cannotLoad'));
        } finally {
            setLoadingData(false);
        }
    };

    const handleUseCurrentLocation = () => {
        if (location?.coords) {
            setFormData({
                ...formData,
                gps_lat: location.coords.latitude.toString(),
                gps_lon: location.coords.longitude.toString(),
            });
        } else {
            Alert.alert(t('message.error'), t('createEtablissement.gpsUnavailable'));
        }
    };

    const handleAddFiliere = () => {
        if (filiereInput.trim() && !formData.filieres.includes(filiereInput.trim())) {
            setFormData({
                ...formData,
                filieres: [...formData.filieres, filiereInput.trim()],
            });
            setFiliereInput('');
        }
    };

    const handleRemoveFiliere = (filiere: string) => {
        setFormData({
            ...formData,
            filieres: formData.filieres.filter(f => f !== filiere),
        });
    };

    const handleSubmit = async () => {
        if (!formData.nom_etablissement || !formData.ville || !formData.type_etablissement) {
            Alert.alert(t('message.error'), t('createEtablissement.fillRequired'));
            return;
        }

        try {
            setLoading(true);
            const payload: any = {
                nom_etablissement: formData.nom_etablissement,
                type_etablissement: formData.type_etablissement,
                adresse: formData.adresse,
                ville: formData.ville,
                region: formData.region,
                quartier: formData.quartier,
                telephone: formData.telephone,
                email: formData.email,
                site_web: formData.site_web,
                description: formData.description,
                filieres: formData.filieres,
                is_public: formData.is_public,
            };

            if (formData.gps_lat && formData.gps_lon) {
                payload.gps = `${formData.gps_lat},${formData.gps_lon}`;
            }
            if (formData.nombre_eleves) payload.nombre_eleves = parseInt(formData.nombre_eleves);
            if (formData.nombre_professeurs) payload.nombre_professeurs = parseInt(formData.nombre_professeurs);
            if (formData.annee_creation) payload.annee_creation = parseInt(formData.annee_creation);
            if (formData.directeur) payload.directeur = formData.directeur;

            let response;
            if (etablissementId) {
                response = await apiPut(`/api/orientation-scolaire/etablissements/${etablissementId}`, payload);
            } else {
                response = await apiPost('/api/orientation-scolaire/etablissements', payload);
            }

            if (response.success) {
                Alert.alert(t('message.success'), etablissementId ? t('createEtablissement.updated') : t('createEtablissement.created'), [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            } else {
                Alert.alert(t('message.error'), response.message || t('createEtablissement.saveError'));
            }
        } catch (error: any) {
            console.error('[CreateEtablissementScreen] Erreur:', error);
            Alert.alert(t('message.error'), t('createEtablissement.saveError'));
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStats = async () => {
        if (!etablissementId) {
            Alert.alert(t('message.error'), t('createEtablissement.createFirst'));
            return;
        }

        try {
            setLoading(true);
            const payload: any = {};
            if (formData.taux_reussite_bac) payload.taux_reussite_bac = parseFloat(formData.taux_reussite_bac);
            if (formData.taux_reussite_examens) payload.taux_reussite_examens = parseFloat(formData.taux_reussite_examens);
            if (formData.classement_national) payload.classement_national = parseInt(formData.classement_national);

            const response = await apiPut(`/api/orientation-scolaire/etablissements/${etablissementId}/statistiques`, payload);
            if (response.success) {
                Alert.alert(t('message.success'), t('createEtablissement.statsUpdated'));
            } else {
                Alert.alert(t('message.error'), response.message || t('createEtablissement.updateError'));
            }
        } catch (error: any) {
            console.error('[CreateEtablissementScreen] Erreur stats:', error);
            Alert.alert(t('message.error'), t('createEtablissement.updateError'));
        } finally {
            setLoading(false);
        }
    };

    if (loadingData) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    return (
        <KeyboardAwareScreen style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>
                    {etablissementId ? 'Modifier l\'établissement' : 'Créer un établissement'}
                </Text>
            </View>

            <NativeCard style={styles.card}>
                {/* Type d'établissement */}
                <View style={styles.field}>
                    <Text style={styles.label}>Type d'établissement *</Text>
                    <View style={styles.chipContainer}>
                        {typesEtablissement.map((type) => (
                            <TouchableOpacity
                                key={type.value}
                                style={[
                                    styles.chip,
                                    formData.type_etablissement === type.value && styles.chipSelected,
                                ]}
                                onPress={() => setFormData({ ...formData, type_etablissement: type.value as any })}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        formData.type_etablissement === type.value && styles.chipTextSelected,
                                    ]}
                                >
                                    {type.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Nom */}
                <View style={styles.field}>
                    <Text style={styles.label}>Nom de l'établissement *</Text>
                    <NativeInput
                        value={formData.nom_etablissement}
                        onChangeText={(text) => setFormData({ ...formData, nom_etablissement: text })}
                        placeholder="Ex: Lycée Bilingue de Douala"
                    />
                </View>

                {/* Description */}
                <View style={styles.field}>
                    <Text style={styles.label}>Description</Text>
                    <TextInput
                        style={styles.textArea}
                        value={formData.description}
                        onChangeText={(text) => setFormData({ ...formData, description: text })}
                        placeholder="Décrivez votre établissement..."
                        multiline
                        numberOfLines={4}
                    />
                </View>

                {/* Localisation */}
                <View style={styles.sectionTitle}>
                    <Text style={styles.sectionTitleText}>Localisation</Text>
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Ville *</Text>
                    <NativeInput
                        value={formData.ville}
                        onChangeText={(text) => setFormData({ ...formData, ville: text })}
                        placeholder="Ex: Douala"
                    />
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Région</Text>
                    <NativeInput
                        value={formData.region}
                        onChangeText={(text) => setFormData({ ...formData, region: text })}
                        placeholder="Ex: Littoral"
                    />
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Quartier</Text>
                    <NativeInput
                        value={formData.quartier}
                        onChangeText={(text) => setFormData({ ...formData, quartier: text })}
                        placeholder="Ex: Akwa"
                    />
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Adresse complète</Text>
                    <NativeInput
                        value={formData.adresse}
                        onChangeText={(text) => setFormData({ ...formData, adresse: text })}
                        placeholder="Adresse complète"
                    />
                </View>

                {/* GPS */}
                <View style={styles.field}>
                    <Text style={styles.label}>Coordonnées GPS</Text>
                    <View style={styles.gpsRow}>
                        <NativeInput
                            value={formData.gps_lat}
                            onChangeText={(text) => setFormData({ ...formData, gps_lat: text })}
                            placeholder="Latitude"
                            style={styles.gpsInput}
                            keyboardType="numeric"
                        />
                        <NativeInput
                            value={formData.gps_lon}
                            onChangeText={(text) => setFormData({ ...formData, gps_lon: text })}
                            placeholder="Longitude"
                            style={styles.gpsInput}
                            keyboardType="numeric"
                        />
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={handleUseCurrentLocation}
                        >
                            <SafeIcon name="map-pin" size={16} color="#FFFFFF" type="lucide" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Contact */}
                <View style={styles.sectionTitle}>
                    <Text style={styles.sectionTitleText}>Contact</Text>
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Téléphone</Text>
                    <NativeInput
                        value={formData.telephone}
                        onChangeText={(text) => setFormData({ ...formData, telephone: text })}
                        placeholder="+237 6XX XXX XXX"
                        keyboardType="phone-pad"
                    />
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Email</Text>
                    <NativeInput
                        value={formData.email}
                        onChangeText={(text) => setFormData({ ...formData, email: text })}
                        placeholder="contact@etablissement.cm"
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Site web</Text>
                    <NativeInput
                        value={formData.site_web}
                        onChangeText={(text) => setFormData({ ...formData, site_web: text })}
                        placeholder="https://www.etablissement.cm"
                        autoCapitalize="none"
                    />
                </View>

                {/* Informations complémentaires */}
                <View style={styles.sectionTitle}>
                    <Text style={styles.sectionTitleText}>Informations complémentaires</Text>
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Directeur/Responsable</Text>
                    <NativeInput
                        value={formData.directeur}
                        onChangeText={(text) => setFormData({ ...formData, directeur: text })}
                        placeholder="Nom du directeur"
                    />
                </View>

                <View style={styles.row}>
                    <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>Nombre d'élèves</Text>
                        <NativeInput
                            value={formData.nombre_eleves}
                            onChangeText={(text) => setFormData({ ...formData, nombre_eleves: text })}
                            keyboardType="numeric"
                            placeholder="0"
                        />
                    </View>
                    <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.label}>Nombre de professeurs</Text>
                        <NativeInput
                            value={formData.nombre_professeurs}
                            onChangeText={(text) => setFormData({ ...formData, nombre_professeurs: text })}
                            keyboardType="numeric"
                            placeholder="0"
                        />
                    </View>
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Année de création</Text>
                    <NativeInput
                        value={formData.annee_creation}
                        onChangeText={(text) => setFormData({ ...formData, annee_creation: text })}
                        keyboardType="numeric"
                        placeholder="1990"
                    />
                </View>

                {/* Filières */}
                <View style={styles.field}>
                    <Text style={styles.label}>Filières</Text>
                    <View style={styles.addRow}>
                        <NativeInput
                            value={filiereInput}
                            onChangeText={setFiliereInput}
                            placeholder="Ajouter une filière"
                            style={styles.addInput}
                        />
                        <TouchableOpacity style={styles.addButton} onPress={handleAddFiliere}>
                            <Text style={styles.addButtonText}>+</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.tagsContainer}>
                        {formData.filieres.map((filiere, idx) => (
                            <View key={idx} style={styles.tag}>
                                <Text style={styles.tagText}>{filiere}</Text>
                                <TouchableOpacity onPress={() => handleRemoveFiliere(filiere)}>
                                    <SafeIcon name="x" size={14} color={modernColors.textSecondary} type="lucide" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Public/Privé */}
                <View style={styles.switchRow}>
                    <Text style={styles.label}>Établissement public</Text>
                    <Switch
                        value={formData.is_public}
                        onValueChange={(value) => setFormData({ ...formData, is_public: value })}
                        trackColor={{ false: '#767577', true: modernColors.primary }}
                    />
                </View>

                {/* Statistiques et performances (si établissement existe) */}
                {etablissementId && (
                    <>
                        <View style={styles.sectionTitle}>
                            <Text style={styles.sectionTitleText}>Statistiques et Performances</Text>
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Taux de réussite au Bac (%)</Text>
                            <NativeInput
                                value={formData.taux_reussite_bac || ''}
                                onChangeText={(text) => setFormData({ ...formData, taux_reussite_bac: text })}
                                keyboardType="numeric"
                                placeholder="0"
                            />
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Taux de réussite aux examens (%)</Text>
                            <NativeInput
                                value={formData.taux_reussite_examens || ''}
                                onChangeText={(text) => setFormData({ ...formData, taux_reussite_examens: text })}
                                keyboardType="numeric"
                                placeholder="0"
                            />
                        </View>

                        <View style={styles.field}>
                            <Text style={styles.label}>Classement national</Text>
                            <NativeInput
                                value={formData.classement_national || ''}
                                onChangeText={(text) => setFormData({ ...formData, classement_national: text })}
                                keyboardType="numeric"
                                placeholder="0"
                            />
                        </View>

                        <NativeButton
                            title="Mettre à jour les statistiques"
                            onPress={handleUpdateStats}
                            disabled={loading}
                            style={styles.statsButton}
                        />
                    </>
                )}

                {/* Bouton submit */}
                <NativeButton
                    title={loading ? 'Enregistrement...' : etablissementId ? 'Mettre à jour' : 'Créer l\'établissement'}
                    onPress={handleSubmit}
                    disabled={loading}
                    style={styles.submitButton}
                />
            </NativeCard>
        </KeyboardAwareScreen>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    scrollContent: {
        padding: 16,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 12,
        color: modernColors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    card: {
        padding: 16,
    },
    field: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    textArea: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
        minHeight: 100,
        textAlignVertical: 'top',
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
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    chipSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    chipText: {
        color: modernColors.text,
        fontSize: 14,
    },
    chipTextSelected: {
        color: '#FFFFFF',
    },
    sectionTitle: {
        marginTop: 24,
        marginBottom: 16,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    sectionTitleText: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    row: {
        flexDirection: 'row',
    },
    gpsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    gpsInput: {
        flex: 1,
    },
    gpsButton: {
        backgroundColor: modernColors.primary,
        padding: 12,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    addRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    addInput: {
        flex: 1,
    },
    addButton: {
        backgroundColor: modernColors.primary,
        width: 44,
        height: 44,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.primary + '20',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    tagText: {
        color: modernColors.primary,
        fontSize: 14,
    },
    statsButton: {
        marginTop: 8,
        marginBottom: 16,
    },
    submitButton: {
        marginTop: 8,
    },
});

export default CreateEtablissementScreen;

