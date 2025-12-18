// ✅ Formulaire de création d'offre d'emploi (Mobile)
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const CreateOffreScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { location } = useLocation();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        titre_poste: '',
        description: '',
        type_contrat: 'CDI',
        duree_contrat: '',
        lieu_travail: '',
        adresse: '',
        gps: '',
        remote: false,
        remote_partiel: false,
        salaire_min: '',
        salaire_max: '',
        salaire_negociable: false,
        niveau_etude: '',
        experience_min: '',
        competences_requises: [] as string[],
        secteur: '',
        domaine: '',
        tags: [] as string[],
        date_limite_candidature: '',
        date_debut_poste: '',
    });

    const [competenceInput, setCompetenceInput] = useState('');
    const [tagInput, setTagInput] = useState('');

    const typesContrat = ['CDI', 'CDD', 'Stage', 'Freelance', 'Temps partiel', 'Alternance'];
    const secteurs = [
        'Informatique', 'Commerce', 'Santé', 'Éducation', 'Finance',
        'Marketing', 'Ressources Humaines', 'Ingénierie', 'Design', 'Autre'
    ];

    if (!user) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Connexion requise</Text>
                <TouchableOpacity
                    style={styles.button}
                    onPress={() => (navigation as any).navigate('Login')}
                >
                    <Text style={styles.buttonText}>Se connecter</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleAddCompetence = () => {
        if (competenceInput.trim() && !formData.competences_requises.includes(competenceInput.trim())) {
            setFormData({
                ...formData,
                competences_requises: [...formData.competences_requises, competenceInput.trim()],
            });
            setCompetenceInput('');
        }
    };

    const handleRemoveCompetence = (comp: string) => {
        setFormData({
            ...formData,
            competences_requises: formData.competences_requises.filter(c => c !== comp),
        });
    };

    const handleAddTag = () => {
        if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
            setFormData({
                ...formData,
                tags: [...formData.tags, tagInput.trim()],
            });
            setTagInput('');
        }
    };

    const handleRemoveTag = (tag: string) => {
        setFormData({
            ...formData,
            tags: formData.tags.filter(t => t !== tag),
        });
    };

    const handleUseCurrentLocation = () => {
        if (location?.latitude && location?.longitude) {
            setFormData({
                ...formData,
                gps: `${location.latitude},${location.longitude}`,
            });
        } else {
            Alert.alert('Erreur', 'Position GPS non disponible');
        }
    };

    const handleSubmit = async () => {
        if (!formData.titre_poste || !formData.description || !formData.secteur || !formData.lieu_travail) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
            return;
        }

        try {
            setLoading(true);
            const payload: any = {
                titre_poste: formData.titre_poste,
                description: formData.description,
                type_contrat: formData.type_contrat,
                lieu_travail: formData.lieu_travail,
                secteur: formData.secteur,
                remote: formData.remote,
                remote_partiel: formData.remote_partiel,
                salaire_negociable: formData.salaire_negociable,
            };

            if (formData.duree_contrat) payload.duree_contrat = parseInt(formData.duree_contrat);
            if (formData.adresse) payload.adresse = formData.adresse;
            if (formData.gps) payload.gps = formData.gps;
            if (formData.salaire_min) payload.salaire_min = parseFloat(formData.salaire_min);
            if (formData.salaire_max) payload.salaire_max = parseFloat(formData.salaire_max);
            if (formData.niveau_etude) payload.niveau_etude = formData.niveau_etude;
            if (formData.experience_min) payload.experience_min = parseInt(formData.experience_min);
            if (formData.competences_requises.length > 0) payload.competences_requises = formData.competences_requises;
            if (formData.domaine) payload.domaine = formData.domaine;
            if (formData.tags.length > 0) payload.tags = formData.tags;
            if (formData.date_limite_candidature) payload.date_limite_candidature = formData.date_limite_candidature;
            if (formData.date_debut_poste) payload.date_debut_poste = formData.date_debut_poste;

            const response = await apiPost('/api/offres-emploi', payload);

            if (response.success) {
                Alert.alert('Succès', 'Offre créée avec succès !', [
                    { text: 'OK', onPress: () => (navigation as any).navigate('MesOffres') },
                ]);
            } else {
                Alert.alert('Erreur', response.message || 'Erreur lors de la création de l\'offre');
            }
        } catch (error: any) {
            console.error('[CreateOffreScreen] Erreur:', error);
            Alert.alert('Erreur', 'Erreur lors de la création de l\'offre');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Publier une offre</Text>
            </View>

            <NativeCard style={styles.card}>
                {/* Titre */}
                <View style={styles.field}>
                    <Text style={styles.label}>Titre du poste *</Text>
                    <NativeInput
                        value={formData.titre_poste}
                        onChangeText={(text) => setFormData({ ...formData, titre_poste: text })}
                        placeholder="Ex: Développeur Full Stack"
                    />
                </View>

                {/* Description */}
                <View style={styles.field}>
                    <Text style={styles.label}>Description *</Text>
                    <TextInput
                        style={styles.textArea}
                        value={formData.description}
                        onChangeText={(text) => setFormData({ ...formData, description: text })}
                        placeholder="Décrivez le poste..."
                        multiline
                        numberOfLines={6}
                    />
                </View>

                {/* Secteur */}
                <View style={styles.field}>
                    <Text style={styles.label}>Secteur d'activité *</Text>
                    <View style={styles.pickerContainer}>
                        {secteurs.map((s) => (
                            <TouchableOpacity
                                key={s}
                                style={[
                                    styles.pickerOption,
                                    formData.secteur === s && styles.pickerOptionSelected,
                                ]}
                                onPress={() => setFormData({ ...formData, secteur: formData.secteur === s ? '' : s })}
                            >
                                <Text
                                    style={[
                                        styles.pickerOptionText,
                                        formData.secteur === s && styles.pickerOptionTextSelected,
                                    ]}
                                >
                                    {s}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Type de contrat */}
                <View style={styles.field}>
                    <Text style={styles.label}>Type de contrat *</Text>
                    <View style={styles.chipContainer}>
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

                {/* Durée (si CDD) */}
                {formData.type_contrat === 'CDD' && (
                    <View style={styles.field}>
                        <Text style={styles.label}>Durée (mois)</Text>
                        <NativeInput
                            value={formData.duree_contrat}
                            onChangeText={(text) => setFormData({ ...formData, duree_contrat: text })}
                            keyboardType="numeric"
                            placeholder="12"
                        />
                    </View>
                )}

                {/* Localisation */}
                <View style={styles.field}>
                    <Text style={styles.label}>Lieu de travail *</Text>
                    <NativeInput
                        value={formData.lieu_travail}
                        onChangeText={(text) => setFormData({ ...formData, lieu_travail: text })}
                        placeholder="Ex: Douala, Yaoundé"
                    />
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Adresse</Text>
                    <NativeInput
                        value={formData.adresse}
                        onChangeText={(text) => setFormData({ ...formData, adresse: text })}
                        placeholder="Adresse complète"
                    />
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>GPS</Text>
                    <View style={styles.gpsRow}>
                        <NativeInput
                            value={formData.gps}
                            onChangeText={(text) => setFormData({ ...formData, gps: text })}
                            placeholder="lat,lng"
                            style={styles.gpsInput}
                        />
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={handleUseCurrentLocation}
                        >
                            <SafeIcon name="map-pin" size={16} color="#FFFFFF" type="lucide" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Remote */}
                <View style={styles.switchRow}>
                    <Text style={styles.label}>Télétravail possible</Text>
                    <Switch
                        value={formData.remote}
                        onValueChange={(value) => setFormData({ ...formData, remote: value })}
                        trackColor={{ false: '#767577', true: modernColors.primary }}
                    />
                </View>

                {/* Salaire */}
                <View style={styles.row}>
                    <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>Salaire min (XAF)</Text>
                        <NativeInput
                            value={formData.salaire_min}
                            onChangeText={(text) => setFormData({ ...formData, salaire_min: text })}
                            keyboardType="numeric"
                            placeholder="100000"
                        />
                    </View>
                    <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.label}>Salaire max (XAF)</Text>
                        <NativeInput
                            value={formData.salaire_max}
                            onChangeText={(text) => setFormData({ ...formData, salaire_max: text })}
                            keyboardType="numeric"
                            placeholder="200000"
                        />
                    </View>
                </View>

                <View style={styles.switchRow}>
                    <Text style={styles.label}>Salaire négociable</Text>
                    <Switch
                        value={formData.salaire_negociable}
                        onValueChange={(value) => setFormData({ ...formData, salaire_negociable: value })}
                        trackColor={{ false: '#767577', true: modernColors.primary }}
                    />
                </View>

                {/* Compétences */}
                <View style={styles.field}>
                    <Text style={styles.label}>Compétences requises</Text>
                    <View style={styles.addRow}>
                        <NativeInput
                            value={competenceInput}
                            onChangeText={setCompetenceInput}
                            placeholder="Ajouter une compétence"
                            style={styles.addInput}
                        />
                        <TouchableOpacity style={styles.addButton} onPress={handleAddCompetence}>
                            <Text style={styles.addButtonText}>+</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.tagsContainer}>
                        {formData.competences_requises.map((comp, idx) => (
                            <View key={idx} style={styles.tag}>
                                <Text style={styles.tagText}>{comp}</Text>
                                <TouchableOpacity onPress={() => handleRemoveCompetence(comp)}>
                                    <SafeIcon name="x" size={14} color={modernColors.textSecondary} type="lucide" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Bouton submit */}
                <NativeButton
                    title={loading ? 'Création...' : 'Publier l\'offre'}
                    onPress={handleSubmit}
                    disabled={loading}
                    style={styles.submitButton}
                />
            </NativeCard>
        </ScrollView>
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
    errorText: {
        fontSize: 18,
        color: modernColors.text,
        marginBottom: 16,
    },
    button: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
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
        minHeight: 120,
        textAlignVertical: 'top',
    },
    pickerContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    pickerOption: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    pickerOptionSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    pickerOptionText: {
        color: modernColors.text,
        fontSize: 14,
    },
    pickerOptionTextSelected: {
        color: '#FFFFFF',
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
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
    submitButton: {
        marginTop: 8,
    },
});

export default CreateOffreScreen;

