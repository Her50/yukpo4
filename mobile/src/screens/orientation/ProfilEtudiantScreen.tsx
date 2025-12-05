// ✅ Écran Profil Étudiant pour Orientation Scolaire (Mobile)

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeButton, NativeCard, NativeInput } from '../../components/NativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { CreateOrUpdateStudentProfileRequest, orientationScolaireApi } from '../../services/orientationScolaireApi';
import { modernColors, modernStyles } from '../../theme/modernTheme';

const ProfilEtudiantScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<any>(null);

    // État du formulaire
    const [nomComplet, setNomComplet] = useState('');
    const [dateNaissance, setDateNaissance] = useState('');
    const [ville, setVille] = useState('');
    const [region, setRegion] = useState('');
    const [niveauActuel, setNiveauActuel] = useState('');
    const [classeActuelle, setClasseActuelle] = useState('');
    const [etablissementActuel, setEtablissementActuel] = useState('');
    const [moyenneGenerale, setMoyenneGenerale] = useState('');
    const [classement, setClassement] = useState('');
    const [effectifClasse, setEffectifClasse] = useState('');
    const [matieresPreferees, setMatieresPreferees] = useState<string[]>([]);
    const [objectifsCarriere, setObjectifsCarriere] = useState<string[]>([]);
    const [budgetMax, setBudgetMax] = useState('');

    const niveaux = ['Primaire', 'Collège', 'Lycée', 'Supérieur'];
    const classes = ['6ème', '5ème', '4ème', '3ème', 'Seconde', 'Première', 'Terminale', 'Bac+1', 'Bac+2', 'Bac+3', 'Bac+4', 'Bac+5'];
    const matieres = ['Mathématiques', 'Français', 'Anglais', 'Physique', 'Chimie', 'SVT', 'Histoire', 'Géographie', 'Philosophie', 'Économie'];

    useFocusEffect(
        useCallback(() => {
            loadProfile();
        }, [])
    );

    const loadProfile = async () => {
        try {
            setLoading(true);
            const existingProfile = await orientationScolaireApi.getMyProfile();
            if (existingProfile) {
                setProfile(existingProfile);
                setNomComplet(existingProfile.nom_complet);
                setDateNaissance(existingProfile.date_naissance || '');
                setVille(existingProfile.ville || '');
                setRegion(existingProfile.region || '');
                setNiveauActuel(existingProfile.niveau_actuel || '');
                setClasseActuelle(existingProfile.classe_actuelle || '');
                setEtablissementActuel(existingProfile.etablissement_actuel || '');
                setMoyenneGenerale(existingProfile.moyenne_generale?.toString() || '');
                setClassement(existingProfile.classement?.toString() || '');
                setEffectifClasse(existingProfile.effectif_classe?.toString() || '');
                setMatieresPreferees(existingProfile.matieres_preferees || []);
                setObjectifsCarriere(existingProfile.objectifs_carriere || []);
                setBudgetMax(existingProfile.budget_max?.toString() || '');
            }
        } catch (error: any) {
            console.error('[ProfilEtudiant] Erreur chargement profil:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!nomComplet.trim()) {
            Alert.alert('Erreur', 'Le nom complet est requis');
            return;
        }

        try {
            setSaving(true);
            const request: CreateOrUpdateStudentProfileRequest = {
                nom_complet: nomComplet,
                date_naissance: dateNaissance || undefined,
                ville: ville || undefined,
                region: region || undefined,
                niveau_actuel: niveauActuel || undefined,
                classe_actuelle: classeActuelle || undefined,
                etablissement_actuel: etablissementActuel || undefined,
                moyenne_generale: moyenneGenerale ? parseFloat(moyenneGenerale) : undefined,
                classement: classement ? parseInt(classement, 10) : undefined,
                effectif_classe: effectifClasse ? parseInt(effectifClasse, 10) : undefined,
                matieres_preferees: matieresPreferees.length > 0 ? matieresPreferees : undefined,
                objectifs_carriere: objectifsCarriere.length > 0 ? objectifsCarriere : undefined,
                budget_max: budgetMax ? parseFloat(budgetMax) : undefined,
            };

            await orientationScolaireApi.createOrUpdateProfile(request);
            Alert.alert('Succès', 'Profil enregistré avec succès', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error: any) {
            console.error('[ProfilEtudiant] Erreur sauvegarde:', error);
            Alert.alert('Erreur', 'Impossible d\'enregistrer le profil');
        } finally {
            setSaving(false);
        }
    };

    const toggleMatiere = (matiere: string) => {
        setMatieresPreferees(prev => {
            if (prev.includes(matiere)) {
                return prev.filter(m => m !== matiere);
            } else {
                return [...prev, matiere];
            }
        });
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text style={styles.title}>Mon Profil Étudiant</Text>
                <Text style={styles.subtitle}>
                    Complétez votre profil pour obtenir des recommandations personnalisées
                </Text>
            </View>

            <NativeCard style={styles.card}>
                <Text style={styles.sectionTitle}>Informations personnelles</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nom complet *</Text>
                    <NativeInput
                        placeholder="Votre nom complet"
                        value={nomComplet}
                        onChangeText={setNomComplet}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Date de naissance</Text>
                    <NativeInput
                        placeholder="YYYY-MM-DD"
                        value={dateNaissance}
                        onChangeText={setDateNaissance}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Ville</Text>
                    <NativeInput
                        placeholder="Votre ville"
                        value={ville}
                        onChangeText={setVille}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Région</Text>
                    <NativeInput
                        placeholder="Votre région"
                        value={region}
                        onChangeText={setRegion}
                    />
                </View>
            </NativeCard>

            <NativeCard style={styles.card}>
                <Text style={styles.sectionTitle}>Informations académiques</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Niveau actuel</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                        {niveaux.map(niveau => (
                            <TouchableOpacity
                                key={niveau}
                                style={[
                                    styles.chip,
                                    niveauActuel === niveau && styles.chipActive
                                ]}
                                onPress={() => setNiveauActuel(niveau)}
                            >
                                <Text style={[
                                    styles.chipText,
                                    niveauActuel === niveau && styles.chipTextActive
                                ]}>
                                    {niveau}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Classe actuelle</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                        {classes.map(classe => (
                            <TouchableOpacity
                                key={classe}
                                style={[
                                    styles.chip,
                                    classeActuelle === classe && styles.chipActive
                                ]}
                                onPress={() => setClasseActuelle(classe)}
                            >
                                <Text style={[
                                    styles.chipText,
                                    classeActuelle === classe && styles.chipTextActive
                                ]}>
                                    {classe}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Établissement actuel</Text>
                    <NativeInput
                        placeholder="Nom de votre établissement"
                        value={etablissementActuel}
                        onChangeText={setEtablissementActuel}
                    />
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputGroup, styles.halfWidth]}>
                        <Text style={styles.label}>Moyenne générale</Text>
                        <NativeInput
                            placeholder="Ex: 15.5"
                            value={moyenneGenerale}
                            onChangeText={setMoyenneGenerale}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={[styles.inputGroup, styles.halfWidth]}>
                        <Text style={styles.label}>Classement</Text>
                        <NativeInput
                            placeholder="Ex: 5"
                            value={classement}
                            onChangeText={setClassement}
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Effectif de la classe</Text>
                    <NativeInput
                        placeholder="Ex: 40"
                        value={effectifClasse}
                        onChangeText={setEffectifClasse}
                        keyboardType="numeric"
                    />
                </View>
            </NativeCard>

            <NativeCard style={styles.card}>
                <Text style={styles.sectionTitle}>Matières préférées</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                    {matieres.map(matiere => (
                        <TouchableOpacity
                            key={matiere}
                            style={[
                                styles.chip,
                                matieresPreferees.includes(matiere) && styles.chipActive
                            ]}
                            onPress={() => toggleMatiere(matiere)}
                        >
                            <Text style={[
                                styles.chipText,
                                matieresPreferees.includes(matiere) && styles.chipTextActive
                            ]}>
                                {matiere}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </NativeCard>

            <NativeCard style={styles.card}>
                <Text style={styles.sectionTitle}>Budget maximum (XAF)</Text>
                <NativeInput
                    placeholder="Ex: 500000"
                    value={budgetMax}
                    onChangeText={setBudgetMax}
                    keyboardType="numeric"
                />
            </NativeCard>

            <View style={styles.actions}>
                <NativeButton
                    title={saving ? 'Enregistrement...' : 'Enregistrer le profil'}
                    onPress={handleSave}
                    variant="primary"
                    disabled={saving}
                    style={styles.saveButton}
                />
            </View>
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
    },
    loadingText: {
        marginTop: 12,
        color: modernColors.textSecondary,
    },
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    card: {
        marginBottom: 16,
        padding: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    halfWidth: {
        flex: 1,
    },
    chipContainer: {
        marginTop: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: modernStyles.borderRadius.full,
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
        marginRight: 8,
    },
    chipActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    chipText: {
        fontSize: 14,
        color: modernColors.text,
    },
    chipTextActive: {
        color: '#fff',
    },
    actions: {
        marginTop: 24,
        marginBottom: 32,
    },
    saveButton: {
        marginBottom: 16,
    },
});

export default ProfilEtudiantScreen;

