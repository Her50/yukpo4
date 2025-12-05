// ✅ Écran de recherche d'établissements (Mobile)

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { apiGet } from '../../services/apiService';

interface Etablissement {
    id: number;
    nom_etablissement: string;
    type_etablissement: string;
    ville: string;
    region?: string;
    filieres?: string[];
    is_verified: boolean;
}

const EtablissementSearchScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const route = useRoute();
    const typeParam = (route.params as any)?.type || '';

    const [loading, setLoading] = useState(false);
    const [etablissements, setEtablissements] = useState<Etablissement[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    // Filtres
    const [typeEtablissement, setTypeEtablissement] = useState(typeParam);
    const [ville, setVille] = useState('');
    const [region, setRegion] = useState('');
    const [filiere, setFiliere] = useState('');

    useEffect(() => {
        if (typeEtablissement) {
            searchEtablissements();
        }
    }, [typeEtablissement, ville, region, filiere, page]);

    const searchEtablissements = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            if (typeEtablissement) params.append('type_etablissement', typeEtablissement);
            if (ville) params.append('ville', ville);
            if (region) params.append('region', region);
            if (filiere) params.append('filiere', filiere);

            const response = await apiGet(
                `/api/orientation-scolaire/etablissements/search?${params}`
            );
            const data = await response.json();

            if (data.success) {
                setEtablissements(data.data || []);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            console.error('[EtablissementSearch] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        setPage(1);
        searchEtablissements();
    };

    const renderEtablissement = ({ item }: { item: Etablissement }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('EtablissementDetails', { id: item.id })}
        >
            <Text style={styles.cardTitle}>{item.nom_etablissement}</Text>
            <Text style={styles.cardSubtitle}>
                📍 {item.ville}
                {item.region && `, ${item.region}`}
            </Text>
            <Text style={styles.cardSubtitle}>🎓 {item.type_etablissement}</Text>
            {item.filieres && item.filieres.length > 0 && (
                <Text style={styles.cardSubtitle}>📚 {item.filieres.join(', ')}</Text>
            )}
            {item.is_verified && (
                <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedText}>✓ Vérifié</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            {/* Filtres */}
            <View style={styles.filtersContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Ville (ex: Douala)"
                    value={ville}
                    onChangeText={setVille}
                />
                <TextInput
                    style={styles.input}
                    placeholder="Région (ex: Littoral)"
                    value={region}
                    onChangeText={setRegion}
                />
                <TextInput
                    style={styles.input}
                    placeholder="Filière (ex: Scientifique)"
                    value={filiere}
                    onChangeText={setFiliere}
                />
                <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                    <Text style={styles.searchButtonText}>Rechercher</Text>
                </TouchableOpacity>
            </View>

            {/* Résultats */}
            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            ) : etablissements.length > 0 ? (
                <>
                    <Text style={styles.resultsCount}>
                        {total} établissement{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
                    </Text>
                    <FlatList
                        data={etablissements}
                        renderItem={renderEtablissement}
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
                    <Text style={styles.emptyText}>Aucun établissement trouvé</Text>
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
    verifiedBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        marginTop: 8,
    },
    verifiedText: {
        color: '#065F46',
        fontSize: 12,
        fontWeight: '500',
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

export default EtablissementSearchScreen;

