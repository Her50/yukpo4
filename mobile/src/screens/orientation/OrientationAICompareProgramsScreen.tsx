// ✅ Écran Comparaison Programmes IA pour Orientation Scolaire (Mobile)

import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { orientationScolaireApi } from '../../services/orientationScolaireApi';
import { modernColors } from '../../theme/modernTheme';

const OrientationAICompareProgramsScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [comparison, setComparison] = useState<any>(null);

    // Formulaire
    const [etablissement1Id, setEtablissement1Id] = useState('');
    const [etablissement2Id, setEtablissement2Id] = useState('');
    const [filiere1, setFiliere1] = useState('');
    const [filiere2, setFiliere2] = useState('');

    const handleCompare = async () => {
        if (!etablissement1Id || !etablissement2Id || !filiere1 || !filiere2) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs');
            return;
        }

        if (!user) {
            Alert.alert('Erreur', 'Vous devez être connecté');
            return;
        }

        try {
            setLoading(true);
            const profile = await orientationScolaireApi.getMyProfile();
            if (!profile) {
                Alert.alert(
                    'Profil requis',
                    'Veuillez d\'abord compléter votre profil étudiant',
                    [
                        { text: 'Annuler', style: 'cancel' },
                        {
                            text: 'Créer profil',
                            onPress: () => navigation.navigate('ProfilEtudiant')
                        }
                    ]
                );
                return;
            }

            const response = await orientationScolaireApi.comparePrograms({
                student_profile_id: profile.id,
                etablissement_1_id: parseInt(etablissement1Id, 10),
                etablissement_2_id: parseInt(etablissement2Id, 10),
                filiere_1: filiere1,
                filiere_2: filiere2,
                specialite_1: undefined,
                specialite_2: undefined,
            });

            setComparison(response);
        } catch (error: any) {
            console.error('[OrientationAIComparePrograms] Erreur:', error);
            Alert.alert('Erreur', 'Impossible de comparer les programmes. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text style={styles.title}>Comparer Programmes IA</Text>
                <Text style={styles.subtitle}>
                    Mettez en balance plusieurs options pour prendre la meilleure décision
                </Text>
            </View>

            {!comparison ? (
                <NativeCard style={styles.card}>
                    <Text style={styles.sectionTitle}>Programme 1</Text>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>ID Établissement 1</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ex: 1"
                            value={etablissement1Id}
                            onChangeText={setEtablissement1Id}
                            keyboardType="numeric"
                            placeholderTextColor={modernColors.textSecondary}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Filière 1</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ex: Informatique"
                            value={filiere1}
                            onChangeText={setFiliere1}
                            placeholderTextColor={modernColors.textSecondary}
                        />
                    </View>

                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Programme 2</Text>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>ID Établissement 2</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ex: 2"
                            value={etablissement2Id}
                            onChangeText={setEtablissement2Id}
                            keyboardType="numeric"
                            placeholderTextColor={modernColors.textSecondary}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Filière 2</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ex: Génie Logiciel"
                            value={filiere2}
                            onChangeText={setFiliere2}
                            placeholderTextColor={modernColors.textSecondary}
                        />
                    </View>

                    <NativeButton
                        title={loading ? 'Comparaison en cours...' : 'Comparer les programmes'}
                        onPress={handleCompare}
                        variant="primary"
                        disabled={loading}
                        style={styles.button}
                    />
                </NativeCard>
            ) : (
                <View>
                    <NativeCard style={styles.comparisonCard}>
                        <Text style={styles.comparisonTitle}>Résultat de la comparaison</Text>
                        <View style={styles.scoresContainer}>
                            <View style={styles.scoreItem}>
                                <Text style={styles.scoreLabel}>Programme 1</Text>
                                <Text style={styles.scoreValue}>
                                    {comparison.score_etablissement_1?.toFixed(1) || 'N/A'}%
                                </Text>
                            </View>
                            <View style={styles.scoreItem}>
                                <Text style={styles.scoreLabel}>Programme 2</Text>
                                <Text style={styles.scoreValue}>
                                    {comparison.score_etablissement_2?.toFixed(1) || 'N/A'}%
                                </Text>
                            </View>
                        </View>
                        {comparison.winner_etablissement_id && (
                            <View style={styles.winnerBadge}>
                                <SafeIcon name="award" size={24} color={modernColors.primary} type="lucide" />
                                <Text style={styles.winnerText}>
                                    Programme {comparison.winner_etablissement_id === parseInt(etablissement1Id, 10) ? '1' : '2'} recommandé
                                </Text>
                            </View>
                        )}
                    </NativeCard>

                    {comparison.winner_reasoning && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>Raison du choix</Text>
                            <Text style={styles.reasoningText}>{comparison.winner_reasoning}</Text>
                        </NativeCard>
                    )}

                    {comparison.comparison_details && (
                        <NativeCard style={styles.card}>
                            <Text style={styles.sectionTitle}>Détails de la comparaison</Text>
                            {Object.entries(comparison.comparison_details).map(([key, value]: [string, any]) => (
                                <View key={key} style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>{key}:</Text>
                                    <Text style={styles.detailValue}>{String(value)}</Text>
                                </View>
                            ))}
                        </NativeCard>
                    )}

                    <View style={styles.actions}>
                        <NativeButton
                            title="Nouvelle comparaison"
                            onPress={() => {
                                setComparison(null);
                                setEtablissement1Id('');
                                setEtablissement2Id('');
                                setFiliere1('');
                                setFiliere2('');
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
                    <Text style={styles.loadingText}>Comparaison en cours...</Text>
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
    button: {
        marginTop: 8,
    },
    comparisonCard: {
        marginBottom: 16,
        padding: 20,
        backgroundColor: modernColors.primary + '10',
    },
    comparisonTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 20,
        textAlign: 'center',
    },
    scoresContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
    },
    scoreItem: {
        alignItems: 'center',
    },
    scoreLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    scoreValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: modernColors.primary,
    },
    winnerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.primary + '20',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    winnerText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.primary,
    },
    reasoningText: {
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 20,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    detailLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    detailValue: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
        textAlign: 'right',
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

export default OrientationAICompareProgramsScreen;

