// ✅ Écran de recherche et téléchargement de fournitures scolaires (Mobile)

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

interface Fourniture {
    id: number;
    etablissement_id: number;
    nom_etablissement?: string;
    niveau: string;
    annee_scolaire: string;
    liste_fournitures: any;
    url_liste?: string;
    created_at: string;
}

const FournituresScolairesScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { t } = useLanguageSafe();
    const route = useRoute();
    const etablissementId = (route.params as any)?.etablissement_id;

    const [loading, setLoading] = useState(false);
    const [fournitures, setFournitures] = useState<Fourniture[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    // Filtres
    const [niveau, setNiveau] = useState('');
    const [annee, setAnnee] = useState('');

    useEffect(() => {
        searchFournitures();
    }, [etablissementId, niveau, annee, page]);

    const searchFournitures = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            if (etablissementId) params.append('etablissement_id', etablissementId.toString());
            if (niveau) params.append('niveau', niveau);
            if (annee) params.append('annee_scolaire', annee);

            const response = await apiGet(`/api/orientation-scolaire/fournitures/search?${params}`);
            const data = (response?.data || response) as any;

            if (data?.success) {
                setFournitures(data.data || []);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            console.error('[FournituresScolaires] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (url: string) => {
        try {
            await Linking.openURL(url);
        } catch (error) {
            console.error('[FournituresScolaires] Erreur téléchargement:', error);
        }
    };

    const renderFourniture = ({ item }: { item: Fourniture }) => (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>
                {item.nom_etablissement || t('fournituresScolairesScreen.etablissement', { item_etablissement_id: item.etablissement_id })}
            </Text>
            <Text style={styles.cardSubtitle}>📚 Niveau: {item.niveau}</Text>
            <Text style={styles.cardSubtitle}>📅 Année: {item.annee_scolaire}</Text>
            {item.liste_fournitures && typeof item.liste_fournitures === 'object' && (
                <Text style={styles.cardSubtitle}>
                    {Object.keys(item.liste_fournitures).length} catégorie(s)
                </Text>
            )}
            {item.url_liste ? (
                <TouchableOpacity
                    style={styles.downloadButton}
                    onPress={() => handleDownload(item.url_liste!)}
                >
                    <Text style={styles.downloadButtonText}>{t('fournituresScolaires.telechargerPdf')}</Text>
                </TouchableOpacity>
            ) : (
                <View style={styles.infoBox}>
                    <Text style={styles.infoText}>{t('fournituresScolaires.listeDisponibleEnLigne')}</Text>
                </View>
            )}
            {item.etablissement_id && (
                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => navigation.navigate('EtablissementDetails', { id: item.etablissement_id })}
                >
                    <Text style={styles.linkButtonText}>{t('fournituresScolaires.voirLetablissement')}</Text>
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
                    placeholder={t('fournituresScolaires.niveauEx6eme')}
                    value={niveau}
                    onChangeText={setNiveau}
                />
                <TextInput
                    style={styles.input}
                    placeholder={t('fournituresScolaires.anneeEx20242025')}
                    value={annee}
                    onChangeText={setAnnee}
                />
                <TouchableOpacity
                    style={styles.searchButton}
                    onPress={() => {
                        setPage(1);
                        searchFournitures();
                    }}
                >
                    <Text style={styles.searchButtonText}>{t('fournituresScolaires.rechercher')}</Text>
                </TouchableOpacity>
            </View>

            {/* Résultats */}
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>{t('fournituresScolaires.chargement')}</Text>
                </View>
            ) : fournitures.length > 0 ? (
                <>
                    <Text style={styles.resultsCount}>
                        {total} liste{total > 1 ? 's' : 't('fournituresScolairesScreen.trouveetotal1')s' : ''}
                    </Text>
                    <FlatList
                        data={fournitures}
                        renderItem={renderFourniture}
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
                    <Text style={styles.emptyText}>{t('fournituresScolaires.aucuneListeTrouvee')}</Text>
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
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 8,
    },
    cardSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    downloadButton: {
        backgroundColor: '#10B981',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        marginTop: 12,
    },
    downloadButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    infoBox: {
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        padding: 12,
        marginTop: 12,
    },
    infoText: {
        color: '#6B7280',
        fontSize: 14,
        textAlign: 'center',
    },
    linkButton: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
        marginTop: 8,
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

export default FournituresScolairesScreen;

