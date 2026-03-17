// ✅ Écran de recherche et affichage des concours d'entrée (Mobile)

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Linking,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { apiGet } from '../../services/api';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface Concours {
    id: number;
    etablissement_id: number;
    nom_etablissement?: string;
    nom_concours: string;
    date_concours: string;
    date_limite_inscription: string;
    filieres_concernées?: string[];
    url_documentation?: string;
    is_active: boolean;
    created_at: string;
}

const ConcoursEntreeScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { t } = useLanguageSafe();
    const route = useRoute();
    const etablissementId = (route.params as any)?.etablissement_id;
    const actifsOnly = (route.params as any)?.actifs === true;

    const [loading, setLoading] = useState(false);
    const [concours, setConcours] = useState<Concours[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    // Filtres
    const [filiere, setFiliere] = useState('');

    useEffect(() => {
        if (actifsOnly) {
            loadConcoursActifs();
        } else {
            searchConcours();
        }
    }, [etablissementId, filiere, page, actifsOnly]);

    const loadConcoursActifs = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            const response = await apiGet(`/api/orientation-scolaire/concours/actifs?${params}`);
            const data = (response?.data || response) as any;

            if (data?.success) {
                setConcours(data.data || []);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            console.error('[ConcoursEntree] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const searchConcours = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            if (etablissementId) params.append('etablissement_id', etablissementId.toString());
            if (filiere) params.append('filiere', filiere);

            const response = await apiGet(`/api/orientation-scolaire/concours/search?${params}`);
            const data = (response?.data || response) as any;

            if (data?.success) {
                setConcours(data.data || []);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            console.error('[ConcoursEntree] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (url: string) => {
        try {
            await Linking.openURL(url);
        } catch (error) {
            console.error('[ConcoursEntree] Erreur téléchargement:', error);
        }
    };

    const isDatePassed = (dateStr: string) => {
        return new Date(dateStr) < new Date();
    };

    const renderConcours = ({ item }: { item: Concours }) => {
        const isPassed = isDatePassed(item.date_limite_inscription);

        return (
            <View style={[styles.card, (!item.is_active || isPassed) && styles.cardInactive]}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.nom_concours}</Text>
                    {item.is_active && !isPassed && (
                        <View style={styles.activeBadge}>
                            <Text style={styles.activeText}>Actif</Text>
                        </View>
                    )}
                </View>
                <Text style={styles.cardSubtitle}>
                    📍 {item.nom_etablissement || t('concoursEntreeScreen.etablissement', { item_etablissement_id: item.etablissement_id })}
                </Text>
                <Text style={styles.cardSubtitle}>
                    📅 Concours: {new Date(item.date_concours).toLocaleDateString('fr-FR')}
                </Text>
                <Text style={styles.cardSubtitle}>
                    ⏰ Inscription jusqu'au:{' '}
                    {new Date(item.date_limite_inscription).toLocaleDateString('fr-FR')}
                </Text>
                {item.filieres_concernées && item.filieres_concernées.length > 0 && (
                    <Text style={styles.cardSubtitle}>
                        🎓 {item.filieres_concernées.join(', ')}
                    </Text>
                )}
                <View style={styles.actionsContainer}>
                    {item.url_documentation && (
                        <TouchableOpacity
                            style={styles.downloadButton}
                            onPress={() => handleDownload(item.url_documentation!)}
                        >
                            <Text style={styles.downloadButtonText}>📄 Documentation</Text>
                        </TouchableOpacity>
                    )}
                    {item.etablissement_id && (
                        <TouchableOpacity
                            style={styles.linkButton}
                            onPress={() => navigation.navigate('EtablissementDetails', { id: item.etablissement_id })}
                        >
                            <Text style={styles.linkButtonText}>{t('concoursEntree.voirEtablissement')}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Filtres */}
            {!actifsOnly && (
                <View style={styles.filtersContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder={t('concoursEntree.filiereExScientifique')}
                        value={filiere}
                        onChangeText={setFiliere}
                    />
                    <TouchableOpacity
                        style={styles.searchButton}
                        onPress={() => {
                            setPage(1);
                            searchConcours();
                        }}
                    >
                        <Text style={styles.searchButtonText}>{t('concoursEntree.rechercher')}</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Résultats */}
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>{t('concoursEntree.chargement')}</Text>
                </View>
            ) : concours.length > 0 ? (
                <>
                    <Text style={styles.resultsCount}>
                        {total} concours trouvé{total > 1 ? 's' : ''}
                    </Text>
                    <FlatList
                        data={concours}
                        renderItem={renderConcours}
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
                    <Text style={styles.emptyText}>{t('concoursEntree.aucunConcoursTrouve')}</Text>
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
    cardInactive: {
        opacity: 0.6,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        flex: 1,
    },
    activeBadge: {
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    activeText: {
        color: '#065F46',
        fontSize: 12,
        fontWeight: '500',
    },
    cardSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    actionsContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    downloadButton: {
        flex: 1,
        backgroundColor: '#3B82F6',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    downloadButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    linkButton: {
        flex: 1,
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

export default ConcoursEntreeScreen;

