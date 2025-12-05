// ✅ Écran Prédiction Salaire IA pour Offres d'Emploi (Mobile)

import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
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
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const AISalaryPredictionScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(false);
    const [prediction, setPrediction] = useState<any>(null);

    // Formulaire
    const [titrePoste, setTitrePoste] = useState('');
    const [secteur, setSecteur] = useState('');
    const [ville, setVille] = useState('');
    const [experienceAnnees, setExperienceAnnees] = useState('');
    const [niveauEtude, setNiveauEtude] = useState('');
    const [competences, setCompetences] = useState('');

    const niveauxEtude = ['Bac', 'Bac+2', 'Bac+3', 'Bac+4', 'Bac+5', 'Doctorat'];
    const secteurs = ['Informatique', 'Finance', 'Marketing', 'Ressources Humaines', 'Commerce', 'Santé', 'Éducation', 'Autre'];

    const handlePredict = async () => {
        if (!titrePoste.trim()) {
            Alert.alert('Erreur', 'Le titre du poste est requis');
            return;
        }

        try {
            setLoading(true);
            const params: any = {
                titre_poste: titrePoste,
                secteur: secteur || undefined,
                ville: ville || undefined,
                experience_annees: experienceAnnees ? parseInt(experienceAnnees, 10) : undefined,
                niveau_etude: niveauEtude || undefined,
                competences: competences ? competences.split(',').map(c => c.trim()) : undefined,
            };

            const response = await apiGet('/api/offres-emploi/ai/salary-prediction', { params });
            if (response.success) {
                setPrediction(response.prediction || response.data?.prediction);
            } else {
                Alert.alert('Erreur', response.message || 'Impossible de prédire le salaire');
            }
        } catch (error: any) {
            console.error('[AISalaryPrediction] Erreur:', error);
            Alert.alert('Erreur', 'Impossible de prédire le salaire. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text style={styles.title}>Prédiction Salaire IA</Text>
                <Text style={styles.subtitle}>
                    Estimez votre valeur sur le marché du travail
                </Text>
            </View>

            {!prediction ? (
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Informations du poste</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Titre du poste *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ex: Développeur Full Stack"
                            value={titrePoste}
                            onChangeText={setTitrePoste}
                            placeholderTextColor={modernColors.textSecondary}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Secteur</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                            {secteurs.map(sec => (
                                <TouchableOpacity
                                    key={sec}
                                    style={[
                                        styles.chip,
                                        secteur === sec && styles.chipActive
                                    ]}
                                    onPress={() => setSecteur(sec)}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        secteur === sec && styles.chipTextActive
                                    ]}>
                                        {sec}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Ville</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ex: Douala"
                            value={ville}
                            onChangeText={setVille}
                            placeholderTextColor={modernColors.textSecondary}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, styles.halfWidth]}>
                            <Text style={styles.label}>Expérience (années)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ex: 3"
                                value={experienceAnnees}
                                onChangeText={setExperienceAnnees}
                                keyboardType="numeric"
                                placeholderTextColor={modernColors.textSecondary}
                            />
                        </View>

                        <View style={[styles.inputGroup, styles.halfWidth]}>
                            <Text style={styles.label}>Niveau d'étude</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipContainer}>
                                {niveauxEtude.map(niveau => (
                                    <TouchableOpacity
                                        key={niveau}
                                        style={[
                                            styles.chip,
                                            niveauEtude === niveau && styles.chipActive
                                        ]}
                                        onPress={() => setNiveauEtude(niveau)}
                                    >
                                        <Text style={[
                                            styles.chipText,
                                            niveauEtude === niveau && styles.chipTextActive
                                        ]}>
                                            {niveau}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Compétences (séparées par des virgules)</Text>
                        <TextInput
                            style={styles.textArea}
                            placeholder="Ex: React, Node.js, PostgreSQL"
                            value={competences}
                            onChangeText={setCompetences}
                            multiline
                            numberOfLines={3}
                            placeholderTextColor={modernColors.textSecondary}
                        />
                    </View>

                    <NativeButton
                        title={loading ? 'Prédiction en cours...' : 'Prédire le salaire'}
                        onPress={handlePredict}
                        variant="primary"
                        disabled={loading}
                        style={styles.button}
                    />
                </NativeCard>
            ) : (
                <View>
                    <NativeCard style={styles.predictionCard}>
                        <Text style={styles.predictionTitle}>Prédiction de salaire</Text>
                        <View style={styles.salaryRange}>
                            <View style={styles.salaryItem}>
                                <Text style={styles.salaryLabel}>Minimum</Text>
                                <Text style={styles.salaryValue}>
                                    {prediction.salaire_predicted_min?.toLocaleString() || 'N/A'} XAF
                                </Text>
                            </View>
                            <View style={styles.salaryItem}>
                                <Text style={styles.salaryLabel}>Médian</Text>
                                <Text style={[styles.salaryValue, styles.salaryMedian]}>
                                    {prediction.salaire_predicted_median?.toLocaleString() || 'N/A'} XAF
                                </Text>
                            </View>
                            <View style={styles.salaryItem}>
                                <Text style={styles.salaryLabel}>Maximum</Text>
                                <Text style={styles.salaryValue}>
                                    {prediction.salaire_predicted_max?.toLocaleString() || 'N/A'} XAF
                                </Text>
                            </View>
                        </View>
                    </NativeCard>

                    {prediction.facteurs_influence && prediction.facteurs_influence.length > 0 && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>Facteurs d'influence</Text>
                            {prediction.facteurs_influence.map((facteur: string, index: number) => (
                                <View key={index} style={styles.facteurItem}>
                                    <SafeIcon name="check-circle" size={16} color={modernColors.primary} />
                                    <Text style={styles.facteurText}>{facteur}</Text>
                                </View>
                            ))}
                        </NativeCard>
                    )}

                    {prediction.comparaison_marche && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>Comparaison marché</Text>
                            <Text style={styles.comparaisonText}>{prediction.comparaison_marche}</Text>
                        </NativeCard>
                    )}

                    <View style={styles.actions}>
                        <NativeButton
                            title="Nouvelle prédiction"
                            onPress={() => {
                                setPrediction(null);
                                setTitrePoste('');
                                setSecteur('');
                                setVille('');
                                setExperienceAnnees('');
                                setNiveauEtude('');
                                setCompetences('');
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
                    <Text style={styles.loadingText}>Prédiction en cours...</Text>
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
    input: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
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
        borderRadius: 20,
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
    button: {
        marginTop: 8,
    },
    predictionCard: {
        marginBottom: 16,
        padding: 20,
        backgroundColor: modernColors.primary + '10',
    },
    predictionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 20,
        textAlign: 'center',
    },
    salaryRange: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    salaryItem: {
        alignItems: 'center',
    },
    salaryLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    salaryValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: modernColors.text,
    },
    salaryMedian: {
        fontSize: 24,
        color: modernColors.primary,
    },
    facteurItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        gap: 8,
    },
    facteurText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 20,
    },
    comparaisonText: {
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 20,
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
    loadingText: {
        marginTop: 12,
        color: '#fff',
        fontSize: 16,
    },
});

export default AISalaryPredictionScreen;

