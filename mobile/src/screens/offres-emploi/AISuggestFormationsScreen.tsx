// ✅ Écran Suggestions Formations IA pour Offres d'Emploi (Mobile)

import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
// apiGet remplacé par offreEmploiService
import { FormationSuggestion, offreEmploiService } from '../../services/offreEmploiService';
import { modernColors } from '../../theme/modernTheme';

const AISuggestFormationsScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [suggestions, setSuggestions] = useState<FormationSuggestion[]>([]);
    const [competencesManquantes, setCompetencesManquantes] = useState<string[]>([]);
    const [objectifCarriere, setObjectifCarriere] = useState('');
    const [hasProfile, setHasProfile] = useState(false);

    // ✅ NOUVEAU: Charger le profil pour récupérer les compétences manquantes
    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            setLoadingProfile(true);
            const response = await offreEmploiService.getProfil();

            const backendData = (response?.data as any);
            const profil = backendData?.data || backendData;
            if (response.success && profil) {
                setHasProfile(true);
                // Si le profil a des compétences manquantes identifiées, les utiliser
                if (profil.competences_manquantes && Array.isArray(profil.competences_manquantes)) {
                    setCompetencesManquantes(profil.competences_manquantes);
                }
                if (profil.objectif_carriere) {
                    setObjectifCarriere(profil.objectif_carriere);
                }
            } else {
                setHasProfile(false);
            }
        } catch (error: any) {
            console.error('[AISuggestFormationsScreen] Erreur chargement profil:', error);
            setHasProfile(false);
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleSuggest = async () => {
        if (competencesManquantes.length === 0 && !objectifCarriere.trim()) {
            Alert.alert(
                'Information requise',
                'Veuillez renseigner au moins des compétences manquantes ou un objectif de carrière.'
            );
            return;
        }

        try {
            setLoading(true);
            const response = await offreEmploiService.suggestFormations(
                user?.id || 0,
                [],
                competencesManquantes,
                objectifCarriere.trim() || undefined
            );
            const resData = (response?.data as any);
            const suggestionsResult = resData?.data?.suggestions || resData?.suggestions || (response as any)?.suggestions;

            if (response.success && suggestionsResult) {
                setSuggestions(suggestionsResult);
            } else {
                Alert.alert(
                    'Erreur',
                    response.message || 'Impossible de générer des suggestions. L\'IA n\'est peut-être pas encore opérationnelle.'
                );
            }
        } catch (error: any) {
            console.error('[AISuggestFormationsScreen] Erreur suggestions:', error);
            Alert.alert(
                'Erreur',
                'Impossible de générer des suggestions. L\'IA de suggestions de formation n\'est peut-être pas encore opérationnelle. Veuillez réessayer plus tard.'
            );
        } finally {
            setLoading(false);
        }
    };

    const addCompetenceManquante = () => {
        // Permettre à l'utilisateur d'ajouter manuellement des compétences manquantes
        Alert.prompt(
            'Compétence manquante',
            'Entrez une compétence que vous souhaitez acquérir:',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Ajouter',
                    onPress: (text) => {
                        if (text && text.trim() && !competencesManquantes.includes(text.trim())) {
                            setCompetencesManquantes([...competencesManquantes, text.trim()]);
                        }
                    },
                },
            ],
            'plain-text'
        );
    };

    const removeCompetenceManquante = (comp: string) => {
        setCompetencesManquantes(competencesManquantes.filter(c => c !== comp));
    };

    if (loadingProfile) {
        return (
            <View style={styles.container}>
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement du profil...</Text>
                </View>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Suggestions Formations IA</Text>
            </View>

            {suggestions.length === 0 ? (
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Paramètres de recherche</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Compétences manquantes</Text>
                        <View style={styles.tagsContainer}>
                            {competencesManquantes.map((comp, i) => (
                                <View key={i} style={styles.tag}>
                                    <Text style={styles.tagText}>{comp}</Text>
                                    <TouchableOpacity onPress={() => removeCompetenceManquante(comp)}>
                                        <SafeIcon name="x" size={14} color={modernColors.textSecondary} type="lucide" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={addCompetenceManquante}
                        >
                            <SafeIcon name="plus" size={16} color={modernColors.primary} type="lucide" />
                            <Text style={styles.addButtonText}>Ajouter une compétence</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Objectif de carrière (optionnel)</Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder="Ex: Devenir développeur Full Stack senior"
                            value={objectifCarriere}
                            onChangeText={setObjectifCarriere}
                            multiline
                            numberOfLines={3}
                            placeholderTextColor={modernColors.textSecondary}
                        />
                    </View>

                    {!hasProfile && (
                        <View style={styles.warningContainer}>
                            <SafeIcon name="info" size={20} color={modernColors.warning} type="lucide" />
                            <Text style={styles.warningText}>
                                Créez votre profil candidat pour recevoir des suggestions personnalisées basées sur votre CV.
                            </Text>
                        </View>
                    )}

                    <NativeButton
                        title={loading ? 'Génération en cours...' : 'Générer des suggestions'}
                        onPress={handleSuggest}
                        variant="primary"
                        disabled={loading || (competencesManquantes.length === 0 && !objectifCarriere.trim())}
                        style={styles.button}
                    />
                </NativeCard>
            ) : (
                <View>
                    <NativeCard style={styles.card}>
                        <Text style={styles.sectionTitle}>
                            {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''} de formation
                        </Text>
                    </NativeCard>

                    {suggestions.map((formation, i) => (
                        <NativeCard key={i} style={styles.formationCard}>
                            <View style={styles.formationHeader}>
                                <SafeIcon
                                    name="graduation-cap"
                                    size={24}
                                    color={modernColors.primary}
                                    type="lucide"
                                />
                                <View style={styles.formationHeaderText}>
                                    <Text style={styles.formationName}>{formation.formation}</Text>
                                    {formation.urgence && (
                                        <View style={[
                                            styles.urgenceBadge,
                                            formation.urgence === 'high' && styles.urgenceHigh,
                                            formation.urgence === 'medium' && styles.urgenceMedium,
                                            formation.urgence === 'low' && styles.urgenceLow,
                                        ]}>
                                            <Text style={styles.urgenceText}>
                                                {formation.urgence === 'high' ? 'Urgent' :
                                                    formation.urgence === 'medium' ? 'Moyen' : 'Faible'}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <Text style={styles.formationReason}>{formation.raison}</Text>
                            {formation.duree_estimee && (
                                <Text style={styles.formationDuree}>
                                    Durée estimée: {formation.duree_estimee}
                                </Text>
                            )}
                        </NativeCard>
                    ))}

                    <View style={styles.actions}>
                        <NativeButton
                            title="Nouvelles suggestions"
                            onPress={() => {
                                setSuggestions([]);
                                loadProfile();
                            }}
                            variant="outline"
                            style={styles.button}
                        />
                    </View>
                </View>
            )}

            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Génération en cours...</Text>
                </View>
            )}
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    card: {
        marginBottom: 16,
        padding: 20,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.error + '20',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 6,
    },
    tagText: {
        fontSize: 12,
        color: modernColors.error,
        fontWeight: '600',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: modernColors.primary,
        borderStyle: 'dashed',
        borderRadius: 8,
        padding: 12,
        gap: 8,
    },
    addButtonText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
    },
    textArea: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
        minHeight: 80,
        textAlignVertical: 'top',
    },
    warningContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: modernColors.warning + '20',
        borderRadius: 8,
        padding: 12,
        gap: 8,
        marginBottom: 16,
    },
    warningText: {
        flex: 1,
        fontSize: 12,
        color: modernColors.warning,
        lineHeight: 18,
    },
    button: {
        marginTop: 8,
    },
    formationCard: {
        marginBottom: 16,
        padding: 20,
    },
    formationHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        gap: 12,
    },
    formationHeaderText: {
        flex: 1,
    },
    formationName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 4,
    },
    urgenceBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    urgenceHigh: {
        backgroundColor: modernColors.error + '20',
    },
    urgenceMedium: {
        backgroundColor: modernColors.warning + '20',
    },
    urgenceLow: {
        backgroundColor: modernColors.success + '20',
    },
    urgenceText: {
        fontSize: 10,
        fontWeight: '600',
        color: modernColors.text,
    },
    formationReason: {
        fontSize: 14,
        color: modernColors.textSecondary,
        lineHeight: 20,
        marginBottom: 8,
    },
    formationDuree: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    actions: {
        marginTop: 24,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default AISuggestFormationsScreen;
