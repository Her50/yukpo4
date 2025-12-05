// ✅ Écran Suggestions Formations IA pour Offres d'Emploi (Mobile)

import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { NativeBadge, NativeButton, NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const AISuggestFormationsScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);

    const handleGetSuggestions = async () => {
        if (!user) {
            Alert.alert('Erreur', 'Vous devez être connecté');
            return;
        }

        try {
            setLoading(true);
            const response = await apiPost('/api/offres-emploi/ai/suggest-formations', {
                candidat_id: user.id,
            });

            if (response.success) {
                setSuggestions(response.suggestions || response.data?.suggestions || []);
            } else {
                Alert.alert('Erreur', response.message || 'Impossible d\'obtenir les suggestions');
            }
        } catch (error: any) {
            console.error('[AISuggestFormations] Erreur:', error);
            Alert.alert('Erreur', 'Impossible d\'obtenir les suggestions. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <Text style={styles.title}>Suggestions Formations IA</Text>
                <Text style={styles.subtitle}>
                    Développez vos compétences avec des formations ciblées
                </Text>
            </View>

            {suggestions.length === 0 ? (
                <NativeCard style={styles.card}>
                    <SafeIcon name="award" size={48} color={modernColors.accent} type="lucide" />
                    <Text style={styles.cardTitle}>Obtenir des suggestions</Text>
                    <Text style={styles.cardDescription}>
                        L'IA analysera votre profil et vous proposera des formations adaptées
                    </Text>
                    <NativeButton
                        title={loading ? 'Génération en cours...' : 'Générer les suggestions'}
                        onPress={handleGetSuggestions}
                        variant="primary"
                        disabled={loading}
                        style={styles.button}
                    />
                </NativeCard>
            ) : (
                <View>
                    <Text style={styles.resultsTitle}>
                        {suggestions.length} formation{suggestions.length > 1 ? 's' : ''} suggérée{suggestions.length > 1 ? 's' : ''}
                    </Text>
                    {suggestions.map((suggestion, index) => (
                        <NativeCard key={index} style={styles.suggestionCard}>
                            <View style={styles.suggestionHeader}>
                                <View style={styles.priorityBadge}>
                                    <Text style={styles.priorityText}>
                                        {suggestion.priority || 'Moyenne'}
                                    </Text>
                                </View>
                                <View style={styles.suggestionInfo}>
                                    <Text style={styles.formationName}>
                                        {suggestion.formation_nom || 'Formation'}
                                    </Text>
                                    {suggestion.organisme && (
                                        <Text style={styles.organisme}>
                                            {suggestion.organisme}
                                        </Text>
                                    )}
                                </View>
                            </View>
                            {suggestion.description && (
                                <Text style={styles.description}>{suggestion.description}</Text>
                            )}
                            {suggestion.competences_ciblees && suggestion.competences_ciblees.length > 0 && (
                                <View style={styles.badgesContainer}>
                                    {suggestion.competences_ciblees.map((comp: string, idx: number) => (
                                        <NativeBadge
                                            key={idx}
                                            text={comp}
                                            variant="info"
                                            size="small"
                                        />
                                    ))}
                                </View>
                            )}
                            {suggestion.duree && (
                                <View style={styles.metaRow}>
                                    <SafeIcon name="clock" size={16} color={modernColors.textSecondary} />
                                    <Text style={styles.metaText}>{suggestion.duree}</Text>
                                </View>
                            )}
                            {suggestion.cout && (
                                <View style={styles.metaRow}>
                                    <SafeIcon name="dollar-sign" size={16} color={modernColors.textSecondary} />
                                    <Text style={styles.metaText}>{suggestion.cout}</Text>
                                </View>
                            )}
                        </NativeCard>
                    ))}
                    <NativeButton
                        title="Nouvelles suggestions"
                        onPress={() => {
                            setSuggestions([]);
                            handleGetSuggestions();
                        }}
                        variant="outline"
                        style={styles.button}
                    />
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
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    cardDescription: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    button: {
        marginTop: 8,
    },
    resultsTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 16,
    },
    suggestionCard: {
        marginBottom: 16,
        padding: 16,
    },
    suggestionHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        gap: 12,
    },
    priorityBadge: {
        backgroundColor: modernColors.accent,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    priorityText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    suggestionInfo: {
        flex: 1,
    },
    formationName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    organisme: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    description: {
        fontSize: 14,
        color: modernColors.text,
        lineHeight: 20,
        marginBottom: 12,
    },
    badgesContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    metaText: {
        fontSize: 14,
        color: modernColors.textSecondary,
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

export default AISuggestFormationsScreen;

