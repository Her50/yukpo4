// ✅ Formulaire de profil candidat (Mobile)
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { offreEmploiService } from '../../services/offreEmploiService';
import { modernColors } from '../../theme/modernTheme';

const ProfilCandidatScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { location } = useLocation();
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [formData, setFormData] = useState({
        nom: '',
        prenom: '',
        date_naissance: '',
        telephone: '',
        email: '',
        adresse: '',
        ville: '',
        gps: '',
        niveau_etude: '',
        experience_annees: '',
        competences: [] as string[],
        langues: [] as { langue: string; niveau: string }[],
        permis: [] as string[],
        cv_url: '',
        lettre_motivation_url: '',
        disponibilite: 'immediate',
        salaire_souhaite_min: '',
        salaire_souhaite_max: '',
        secteur_recherche: '',
        type_contrat_souhaite: [] as string[],
        remote_souhaite: false,
    });

    const [competenceInput, setCompetenceInput] = useState('');
    const [langueInput, setLangueInput] = useState({ langue: '', niveau: 'intermediaire' });
    const [permisInput, setPermisInput] = useState('');

    const niveauxEtude = ['Bac', 'Bac+2', 'Bac+3', 'Bac+5', 'Master', 'Doctorat'];
    const niveauxLangue = ['debutant', 'intermediaire', 'avance', 'bilingue'];
    const typesContrat = ['CDI', 'CDD', 'Stage', 'Freelance', 'Temps partiel', 'Alternance'];
    const secteurs = [
        'Informatique', 'Commerce', 'Santé', 'Éducation', 'Finance',
        'Marketing', 'Ressources Humaines', 'Ingénierie', 'Design', 'Autre'
    ];

    useFocusEffect(
        useCallback(() => {
            if (user) {
                loadProfil();
            }
        }, [user])
    );

    const loadProfil = async () => {
        try {
            setLoadingData(true);
            const response = await offreEmploiService.getProfil();
            const backendData = (response?.data as any);
            const profil = backendData?.data || backendData;
            if (response.success && profil) {
                setFormData({
                    nom: profil.nom || '',
                    prenom: profil.prenom || '',
                    date_naissance: profil.date_naissance || '',
                    telephone: profil.telephone || '',
                    email: profil.email || user?.email || '',
                    adresse: profil.adresse || '',
                    ville: profil.ville || '',
                    gps: profil.gps || '',
                    niveau_etude: profil.niveau_etude || '',
                    experience_annees: profil.experience_annees?.toString() || '',
                    competences: profil.competences || [],
                    langues: profil.langues || [],
                    permis: profil.permis || [],
                    cv_url: profil.cv_url || '',
                    lettre_motivation_url: profil.lettre_motivation_url || '',
                    disponibilite: profil.disponibilite || 'immediate',
                    salaire_souhaite_min: profil.salaire_souhaite_min?.toString() || '',
                    salaire_souhaite_max: profil.salaire_souhaite_max?.toString() || '',
                    secteur_recherche: profil.secteur_recherche || '',
                    type_contrat_souhaite: profil.type_contrat_souhaite || [],
                    remote_souhaite: profil.remote_souhaite || false,
                });
            }
        } catch (error) {
            console.error('[ProfilCandidatScreen] Erreur chargement:', error);
        } finally {
            setLoadingData(false);
        }
    };

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
        if (competenceInput.trim() && !formData.competences.includes(competenceInput.trim())) {
            setFormData({
                ...formData,
                competences: [...formData.competences, competenceInput.trim()],
            });
            setCompetenceInput('');
        }
    };

    const handleRemoveCompetence = (comp: string) => {
        setFormData({
            ...formData,
            competences: formData.competences.filter(c => c !== comp),
        });
    };

    const handleAddLangue = () => {
        if (langueInput.langue.trim() && !formData.langues.some(l => l.langue === langueInput.langue.trim())) {
            setFormData({
                ...formData,
                langues: [...formData.langues, { langue: langueInput.langue.trim(), niveau: langueInput.niveau }],
            });
            setLangueInput({ langue: '', niveau: 'intermediaire' });
        }
    };

    const handleRemoveLangue = (langue: string) => {
        setFormData({
            ...formData,
            langues: formData.langues.filter(l => l.langue !== langue),
        });
    };

    const handleAddPermis = () => {
        if (permisInput.trim() && !formData.permis.includes(permisInput.trim())) {
            setFormData({
                ...formData,
                permis: [...formData.permis, permisInput.trim()],
            });
            setPermisInput('');
        }
    };

    const toggleTypeContrat = (type: string) => {
        setFormData({
            ...formData,
            type_contrat_souhaite: formData.type_contrat_souhaite.includes(type)
                ? formData.type_contrat_souhaite.filter(t => t !== type)
                : [...formData.type_contrat_souhaite, type],
        });
    };

    const handleUseCurrentLocation = () => {
        if (location?.coords?.latitude && location?.coords?.longitude) {
            setFormData({
                ...formData,
                gps: `${location.coords.latitude},${location.coords.longitude}`,
            });
        } else {
            Alert.alert('Erreur', 'Position GPS non disponible');
        }
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const payload: any = {
                nom: formData.nom,
                prenom: formData.prenom,
                email: formData.email || user?.email,
                disponibilite: formData.disponibilite,
                remote_souhaite: formData.remote_souhaite,
            };

            if (formData.date_naissance) payload.date_naissance = formData.date_naissance;
            if (formData.telephone) payload.telephone = formData.telephone;
            if (formData.adresse) payload.adresse = formData.adresse;
            if (formData.ville) payload.ville = formData.ville;
            if (formData.gps) payload.gps = formData.gps;
            if (formData.niveau_etude) payload.niveau_etude = formData.niveau_etude;
            if (formData.experience_annees) payload.experience_annees = parseInt(formData.experience_annees);
            if (formData.competences.length > 0) payload.competences = formData.competences;
            if (formData.langues.length > 0) payload.langues = formData.langues;
            if (formData.permis.length > 0) payload.permis = formData.permis;
            if (formData.cv_url) payload.cv_url = formData.cv_url;
            if (formData.lettre_motivation_url) payload.lettre_motivation_url = formData.lettre_motivation_url;
            if (formData.salaire_souhaite_min) payload.salaire_souhaite_min = parseFloat(formData.salaire_souhaite_min);
            if (formData.salaire_souhaite_max) payload.salaire_souhaite_max = parseFloat(formData.salaire_souhaite_max);
            if (formData.secteur_recherche) payload.secteur_recherche = formData.secteur_recherche;
            if (formData.type_contrat_souhaite.length > 0) payload.type_contrat_souhaite = formData.type_contrat_souhaite;

            const response = await offreEmploiService.createOrUpdateProfil(payload);

            if (response.success) {
                Alert.alert('Succès', 'Profil mis à jour avec succès !', [
                    { text: 'OK', onPress: () => navigation.goBack() },
                ]);
            } else {
                Alert.alert('Erreur', response.message || 'Erreur lors de la mise à jour du profil');
            }
        } catch (error: any) {
            console.error('[ProfilCandidatScreen] Erreur:', error);
            Alert.alert('Erreur', 'Erreur lors de la mise à jour du profil');
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
                <Text style={styles.title}>Mon Profil Candidat</Text>
            </View>

            <NativeCard style={styles.card}>
                {/* Informations de base */}
                <View style={styles.row}>
                    <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>Nom *</Text>
                        <NativeInput
                            value={formData.nom}
                            onChangeText={(text) => setFormData({ ...formData, nom: text })}
                        />
                    </View>
                    <View style={[styles.field, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.label}>Prénom *</Text>
                        <NativeInput
                            value={formData.prenom}
                            onChangeText={(text) => setFormData({ ...formData, prenom: text })}
                        />
                    </View>
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Email *</Text>
                    <NativeInput
                        value={formData.email || user?.email || ''}
                        onChangeText={(text) => setFormData({ ...formData, email: text })}
                        keyboardType="email-address"
                    />
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Téléphone</Text>
                    <NativeInput
                        value={formData.telephone}
                        onChangeText={(text) => setFormData({ ...formData, telephone: text })}
                        keyboardType="phone-pad"
                    />
                </View>

                {/* Localisation */}
                <View style={styles.field}>
                    <Text style={styles.label}>Ville</Text>
                    <NativeInput
                        value={formData.ville}
                        onChangeText={(text) => setFormData({ ...formData, ville: text })}
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

                {/* Formation */}
                <View style={styles.field}>
                    <Text style={styles.label}>Niveau d'étude</Text>
                    <View style={styles.pickerContainer}>
                        {niveauxEtude.map((n) => (
                            <TouchableOpacity
                                key={n}
                                style={[
                                    styles.pickerOption,
                                    formData.niveau_etude === n && styles.pickerOptionSelected,
                                ]}
                                onPress={() => setFormData({ ...formData, niveau_etude: formData.niveau_etude === n ? '' : n })}
                            >
                                <Text
                                    style={[
                                        styles.pickerOptionText,
                                        formData.niveau_etude === n && styles.pickerOptionTextSelected,
                                    ]}
                                >
                                    {n}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Années d'expérience</Text>
                    <NativeInput
                        value={formData.experience_annees}
                        onChangeText={(text) => setFormData({ ...formData, experience_annees: text })}
                        keyboardType="numeric"
                    />
                </View>

                {/* Compétences */}
                <View style={styles.field}>
                    <Text style={styles.label}>Compétences</Text>
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
                        {formData.competences.map((comp, idx) => (
                            <View key={idx} style={styles.tag}>
                                <Text style={styles.tagText}>{comp}</Text>
                                <TouchableOpacity onPress={() => handleRemoveCompetence(comp)}>
                                    <SafeIcon name="x" size={14} color={modernColors.textSecondary} type="lucide" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Préférences */}
                <View style={styles.field}>
                    <Text style={styles.label}>Secteur recherché</Text>
                    <View style={styles.pickerContainer}>
                        {secteurs.map((s) => (
                            <TouchableOpacity
                                key={s}
                                style={[
                                    styles.pickerOption,
                                    formData.secteur_recherche === s && styles.pickerOptionSelected,
                                ]}
                                onPress={() => setFormData({ ...formData, secteur_recherche: formData.secteur_recherche === s ? '' : s })}
                            >
                                <Text
                                    style={[
                                        styles.pickerOptionText,
                                        formData.secteur_recherche === s && styles.pickerOptionTextSelected,
                                    ]}
                                >
                                    {s}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Type de contrat souhaité</Text>
                    <View style={styles.chipContainer}>
                        {typesContrat.map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    styles.chip,
                                    formData.type_contrat_souhaite.includes(type) && styles.chipSelected,
                                ]}
                                onPress={() => toggleTypeContrat(type)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        formData.type_contrat_souhaite.includes(type) && styles.chipTextSelected,
                                    ]}
                                >
                                    {type}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.switchRow}>
                    <Text style={styles.label}>Ouvert au télétravail</Text>
                    <Switch
                        value={formData.remote_souhaite}
                        onValueChange={(value) => setFormData({ ...formData, remote_souhaite: value })}
                        trackColor={{ false: '#767577', true: modernColors.primary }}
                    />
                </View>

                {/* Upload CV et Lettre de motivation */}
                <View style={styles.field}>
                    <Text style={styles.label}>CV (PDF, DOC, DOCX)</Text>
                    <TouchableOpacity
                        style={styles.uploadButton}
                        onPress={async () => {
                            try {
                                const result = await DocumentPicker.getDocumentAsync({
                                    type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                                    copyToCacheDirectory: true,
                                });

                                if (!result.canceled && result.assets[0]) {
                                    const file = result.assets[0];
                                    setLoading(true);

                                    // Lire le fichier en base64
                                    const base64 = await FileSystem.readAsStringAsync(file.uri, {
                                        encoding: FileSystem.EncodingType.Base64,
                                    });

                                    // Upload via API
                                    const formData = new FormData();
                                    formData.append('file', {
                                        uri: file.uri,
                                        type: file.mimeType || 'application/pdf',
                                        name: file.name,
                                    } as any);
                                    formData.append('type', 'cv');

                                    const token = await require('../../contexts/AuthContext').default?.user?.token || '';
                                    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/upload`, {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': `Bearer ${token}`,
                                        },
                                        body: formData,
                                    });

                                    const data = await response.json();
                                    if (data.success && data.data?.url) {
                                        setFormData({ ...formData, cv_url: data.data.url } as any);
                                        Alert.alert('Succès', 'CV téléchargé avec succès !');
                                    } else {
                                        Alert.alert('Erreur', 'Erreur lors du téléchargement du CV');
                                    }
                                }
                            } catch (error: any) {
                                console.error('[ProfilCandidatScreen] Erreur upload CV:', error);
                                Alert.alert('Erreur', 'Erreur lors du téléchargement du CV');
                            } finally {
                                setLoading(false);
                            }
                        }}
                    >
                        <SafeIcon name="upload" size={20} color={modernColors.primary} type="lucide" />
                        <Text style={styles.uploadButtonText}>
                            {formData.cv_url ? 'Remplacer le CV' : 'Télécharger un CV'}
                        </Text>
                    </TouchableOpacity>
                    {formData.cv_url && (
                        <Text style={styles.fileLink}>CV téléchargé ✓</Text>
                    )}
                </View>

                <View style={styles.field}>
                    <Text style={styles.label}>Lettre de motivation (PDF, DOC, DOCX)</Text>
                    <TouchableOpacity
                        style={styles.uploadButton}
                        onPress={async () => {
                            try {
                                const result = await DocumentPicker.getDocumentAsync({
                                    type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                                    copyToCacheDirectory: true,
                                });

                                if (!result.canceled && result.assets[0]) {
                                    const file = result.assets[0];
                                    setLoading(true);

                                    const formData = new FormData();
                                    formData.append('file', {
                                        uri: file.uri,
                                        type: file.mimeType || 'application/pdf',
                                        name: file.name,
                                    } as any);
                                    formData.append('type', 'lettre_motivation');

                                    const token = await require('../../contexts/AuthContext').default?.user?.token || '';
                                    const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/upload`, {
                                        method: 'POST',
                                        headers: {
                                            'Authorization': `Bearer ${token}`,
                                        },
                                        body: formData,
                                    });

                                    const data = await response.json();
                                    if (data.success && data.data?.url) {
                                        setFormData({ ...formData, lettre_motivation_url: data.data.url } as any);
                                        Alert.alert('Succès', 'Lettre de motivation téléchargée avec succès !');
                                    } else {
                                        Alert.alert('Erreur', 'Erreur lors du téléchargement de la lettre');
                                    }
                                }
                            } catch (error: any) {
                                console.error('[ProfilCandidatScreen] Erreur upload lettre:', error);
                                Alert.alert('Erreur', 'Erreur lors du téléchargement de la lettre');
                            } finally {
                                setLoading(false);
                            }
                        }}
                    >
                        <SafeIcon name="upload" size={20} color={modernColors.primary} type="lucide" />
                        <Text style={styles.uploadButtonText}>
                            {formData.lettre_motivation_url ? 'Remplacer la lettre' : 'Télécharger une lettre'}
                        </Text>
                    </TouchableOpacity>
                    {formData.lettre_motivation_url && (
                        <Text style={styles.fileLink}>Lettre téléchargée ✓</Text>
                    )}
                </View>

                {/* Bouton submit */}
                <NativeButton
                    title={loading ? 'Enregistrement...' : 'Enregistrer le profil'}
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
    row: {
        flexDirection: 'row',
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
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.primary + '20',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
        gap: 8,
    },
    uploadButtonText: {
        color: modernColors.primary,
        fontSize: 16,
        fontWeight: '600',
    },
    fileLink: {
        marginTop: 8,
        color: modernColors.primary,
        fontSize: 14,
    },
});

export default ProfilCandidatScreen;

