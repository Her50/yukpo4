// ✅ Écran de recherche et affichage des expériences d'anciens étudiants (Mobile)

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { apiGet } from '../../services/api';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface Experience {
    id: number;
    etablissement_id: number;
    nom_etablissement?: string;
    nom_etudiant: string;
    filiere: string;
    annee_graduation?: string;
    experience_text: string;
    note_satisfaction?: number;
    is_modere: boolean;
    created_at: string;
}

const ExperiencesEtudiantsScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { t } = useLanguageSafe();
    const route = useRoute();
    const etablissementId = (route.params as any)?.etablissement_id;

    const [loading, setLoading] = useState(false);
    const [experiences, setExperiences] = useState<Experience[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    // Filtres
    const [filiere, setFiliere] = useState('');

    useEffect(() => {
        searchExperiences();
    }, [etablissementId, filiere, page]);

    const searchExperiences = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            if (etablissementId) params.append('etablissement_id', etablissementId.toString());
            if (filiere) params.append('filiere', filiere);

            const response = await apiGet(`/api/orientation-scolaire/experiences/search?${params}`);
            const data = (response?.data || response) as any;

            if (data?.success) {
                setExperiences(data.data || []);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            console.error('[ExperiencesEtudiants] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderExperience = ({ item }: { item: Experience }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.headerLeft}>
                    <Text style={styles.cardTitle}>{item.nom_etudiant}</Text>
                    <Text style={styles.cardSubtitle}>
                        📍 {item.nom_etablissement || t('experiencesEtudiantsScreen.etablissement', { item_etablissement_id: item.etablissement_id })}
                    </Text>
                </View>
                {item.is_modere && (
                    <View style={styles.verifiedBadge}>
                        <Text style={styles.verifiedText}>{t('experiencesEtudiants.modere')}</Text>
                    </View>
                )}
            </View>
            <Text style={styles.cardSubtitle}>🎓 Filière: {item.filiere}</Text>
            {item.annee_graduation && (
                <Text style={styles.cardSubtitle}>📅 {item.annee_graduation}</Text>
            )}
            {item.note_satisfaction && (
                <Text style={styles.cardSubtitle}>⭐ {item.note_satisfaction}/5</Text>
            )}
            <View style={styles.experienceBox}>
                <Text style={styles.experienceText}>{item.experience_text}</Text>
            </View>
            {item.etablissement_id && (
                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => navigation.navigate('EtablissementDetails', { id: item.etablissement_id })}
                >
                    <Text style={styles.linkButtonText}>{t('experiencesEtudiants.voirLetablissement')}</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Filtres */}
            <View style={styles.filtersContainer}>
                <TextInput
                    style={styles.input}
                    placeholder={t('experiencesEtudiants.filiereExScientifique')}
                    value={filiere}
                    onChangeText={setFiliere}
                />
                <TouchableOpacity
                    style={styles.searchButton}
                    onPress={() => {
                        setPage(1);
                        searchExperiences();
                    }}
                >
                    <Text style={styles.searchButtonText}>{t('experiencesEtudiants.rechercher')}</Text>
                </TouchableOpacity>
            </View>

            {/* Résultats */}
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>{t('experiencesEtudiants.chargement')}</Text>
                </View>
            ) : experiences.length > 0 ? (
                <>
                    <Text style={styles.resultsCount}>
                        {total} expérience{total > 1 ? 's' : 't('experiencesEtudiantsScreen.trouveetotal1')s' : ''}
                    </Text>
                    <FlatList
                        data={experiences}
                        renderItem={renderExperience}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={styles.list}
                        onEndReached={() => {
                            if (page * 20 < total) {
                                setPage((p) => p + 1);
                            }
                        }}
                        onEndReachedThreshold={0.5}
                    />
                </>
            ) : (
                <View style={styles.centerContainer}>
                    <Text style={styles.emptyText}>{t('experiencesEtudiants.aucuneExperienceTrouvee')}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    filtersContainer: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    searchButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 8,
        padding: 14,
        alignItems: 'center',
    },
    searchButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    resultsCount: {
        padding: 16,
        color: '#6B7280',
        fontSize: 14,
    },
    list: {
        padding: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    headerLeft: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    cardSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    verifiedBadge: {
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    verifiedText: {
        color: '#065F46',
        fontSize: 12,
        fontWeight: '500',
    },
    experienceBox: {
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        padding: 12,
        marginTop: 8,
        marginBottom: 12,
    },
    experienceText: {
        color: '#374151',
        fontSize: 14,
        lineHeight: 20,
    },
    linkButton: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    linkButtonText: {
        color: '#111827',
        fontSize: 14,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        color: '#6B7280',
    },
    emptyText: {
        color: '#6B7280',
        fontSize: 16,
    },
});

export default ExperiencesEtudiantsScreen;

