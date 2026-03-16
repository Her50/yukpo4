// ✅ Écran de recherche et téléchargement de programmes scolaires (Mobile)

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

interface Programme {
    id: number;
    etablissement_id: number;
    nom_etablissement?: string;
    niveau: string;
    annee_scolaire: string;
    filiere?: string;
    url_programme: string;
    created_at: string;
}

const ProgrammesScolairesScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { t } = useLanguageSafe();
    const route = useRoute();
    const etablissementId = (route.params as any)?.etablissement_id;

    const [loading, setLoading] = useState(false);
    const [programmes, setProgrammes] = useState<Programme[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    // Filtres
    const [niveau, setNiveau] = useState('');
    const [annee, setAnnee] = useState('');
    const [filiere, setFiliere] = useState('');

    useEffect(() => {
        searchProgrammes();
    }, [etablissementId, niveau, annee, filiere, page]);

    const searchProgrammes = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            if (etablissementId) params.append('etablissement_id', etablissementId.toString());
            if (niveau) params.append('niveau', niveau);
            if (annee) params.append('annee_scolaire', annee);
            if (filiere) params.append('filiere', filiere);

            const response = await apiGet(`/api/orientation-scolaire/programmes/search?${params}`);
            const data = (response?.data || response) as any;

            if (data?.success) {
                setProgrammes(data.data || []);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            console.error('[ProgrammesScolaires] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (url: string) => {
        try {
            await Linking.openURL(url);
        } catch (error) {
            console.error('[ProgrammesScolaires] Erreur téléchargement:', error);
        }
    };

    const renderProgramme = ({ item }: { item: Programme }) => (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>
                {item.nom_etablissement || `Établissement #${item.etablissement_id}`}
            </Text>
            <Text style={styles.cardSubtitle}>📚 Niveau: {item.niveau}</Text>
            <Text style={styles.cardSubtitle}>📅 Année: {item.annee_scolaire}</Text>
            {item.filiere && <Text style={styles.cardSubtitle}>🎓 Filière: {item.filiere}</Text>}
            <TouchableOpacity
                style={styles.downloadButton}
                onPress={() => handleDownload(item.url_programme)}
            >
                <Text style={styles.downloadButtonText}>{t('programmesScolaires.telecharger')}</Text>
            </TouchableOpacity>
            {item.etablissement_id && (
                <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => navigation.navigate('EtablissementDetails', { id: item.etablissement_id })}
                >
                    <Text style={styles.linkButtonText}>{t('programmesScolaires.voirLetablissement')}</Text>
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
                    placeholder={t('programmesScolaires.niveauEx6eme')}
                    value={niveau}
                    onChangeText={setNiveau}
                />
                <TextInput
                    style={styles.input}
                    placeholder={t('programmesScolaires.anneeEx20242025')}
                    value={annee}
                    onChangeText={setAnnee}
                />
                <TextInput
                    style={styles.input}
                    placeholder={t('programmesScolaires.filiereExScientifique')}
                    value={filiere}
                    onChangeText={setFiliere}
                />
                <TouchableOpacity
                    style={styles.searchButton}
                    onPress={() => {
                        setPage(1);
                        searchProgrammes();
                    }}
                >
                    <Text style={styles.searchButtonText}>{t('programmesScolaires.rechercher')}</Text>
                </TouchableOpacity>
            </View>

            {/* Résultats */}
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>{t('programmesScolaires.chargement')}</Text>
                </View>
            ) : programmes.length > 0 ? (
                <>
                    <Text style={styles.resultsCount}>
                        {total} programme{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
                    </Text>
                    <FlatList
                        data={programmes}
                        renderItem={renderProgramme}
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
                    <Text style={styles.emptyText}>{t('programmesScolaires.aucunProgrammeTrouve')}</Text>
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

export default ProgrammesScolairesScreen;

