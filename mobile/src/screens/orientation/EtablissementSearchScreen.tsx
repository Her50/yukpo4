// ✅ Écran de recherche d'établissements (Mobile) - VERSION REFONDUE
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import { useLanguageSafe } from '../../contexts/LanguageContext';

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
    const navigation = useNavigation() as any;
    const { t } = useLanguageSafe();
    const route = useRoute();
    const typeParam = (route.params as any)?.type || '';

    const [loading, setLoading] = useState(false);
    const [etablissements, setEtablissements] = useState<Etablissement[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    // Filtres
    const [typeEtablissement, setTypeEtablissement] = useState(typeParam);
    const [ville, setVille] = useState<LocationObject | string>('');
    const [region, setRegion] = useState<LocationObject | string>('');
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
            const villeStr = typeof ville === 'string' ? ville : (ville as LocationObject)?.components?.ville || (ville as LocationObject)?.place_name || '';
            const regionStr = typeof region === 'string' ? region : (region as LocationObject)?.components?.region || (region as LocationObject)?.place_name || '';
            if (villeStr) params.append('ville', villeStr);
            if (regionStr) params.append('region', regionStr);
            if (filiere) params.append('filiere', filiere);

            const response = await apiGet(
                `/api/orientation-scolaire/etablissements/search?${params}`
            );
            const data = (response?.data || response) as any;

            if (data?.success) {
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
            onPress={() => {
                hapticPress();
                navigation.navigate('EtablissementDetails', { id: item.id });
            }}
            activeOpacity={0.7}
        >
            <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                    <View style={styles.cardIconContainer}>
                        <SafeIcon name="school" size={24} color="#3B82F6" type="lucide" />
                    </View>
                    <View style={styles.cardTitleContainer}>
                        <Text style={styles.cardTitle}>{item.nom_etablissement}</Text>
                        {item.is_verified && (
                            <View style={styles.verifiedBadge}>
                                <SafeIcon name="check-circle" size={12} color="#10B981" type="lucide" />
                                <Text style={styles.verifiedText}>{t('etablissementSearch.verifie')}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
            <View style={styles.cardContent}>
                <View style={styles.cardInfoRow}>
                    <SafeIcon name="map-pin" size={16} color="#6B7280" type="lucide" />
                    <Text style={styles.cardSubtitle}>
                        {item.ville}
                        {item.region && `, ${item.region}`}
                    </Text>
                </View>
                <View style={styles.cardInfoRow}>
                    <SafeIcon name="graduation-cap" size={16} color="#6B7280" type="lucide" />
                    <Text style={styles.cardSubtitle}>{item.type_etablissement}</Text>
                </View>
                {item.filieres && item.filieres.length > 0 && (
                    <View style={styles.cardInfoRow}>
                        <SafeIcon name="book" size={16} color="#6B7280" type="lucide" />
                        <Text style={styles.cardSubtitle}>{item.filieres.join(', ')}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    const typesEtablissements = ['Primaire', 'Secondaire', t('etablissementSearchScreen.superieur'), 'Formation professionnelle'];
    const filieres = ['Scientifique', t('etablissementSearchScreen.litteraire'), 'Technique', 'Commercial', 'Artistique'];

    // Recherches rapides spécifiques établissements
    const quickSearches = [
        {
            id: 'primaire',
            title: 'Primaire',
            icon: 'book-open',
            description: t('etablissementSearch.ecolesPrimaires'),
            action: () => {
                hapticPress();
                setTypeEtablissement('Primaire');
            }
        },
        {
            id: 'secondaire',
            title: 'Secondaire',
            icon: 'graduation-cap',
            description: t('etablissementSearch.collegesLycees'),
            action: () => {
                hapticPress();
                setTypeEtablissement('Secondaire');
            }
        },
        {
            id: 'superieur',
            title: t('etablissementSearch.superieur'),
            icon: 'university',
            description: t('etablissementSearch.universites'),
            action: () => {
                hapticPress();
                setTypeEtablissement('Supérieur');
            }
        },
    ];

    return (
        <SafeNativeView style={styles.container}>
            {/* Header avec gradient bleu (éducation) */}
            <LinearGradient
                colors={['#3B82F6', '#60A5FA']}
                style={styles.headerGradient}
            >
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => {
                            hapticPress();
                            navigation.goBack();
                        }}
                        style={styles.backButton}
                    >
                        <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <View style={styles.headerIconContainer}>
                            <SafeIcon name="school" size={32} color="#FFFFFF" type="lucide" />
                        </View>
                        <Text style={styles.headerTitle}>{t('etablissementSearch.rechercherUnEtablissement')}</Text>
                        <Text style={styles.headerSubtitle}>
                            Trouvez l'établissement idéal pour votre orientation
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Recherches rapides */}
                <View style={styles.quickSearchesSection}>
                    <Text style={styles.sectionTitle}>🔍 Recherches rapides</Text>
                    <View style={styles.quickSearchesGrid}>
                        {quickSearches.map((search) => (
                            <TouchableOpacity
                                key={search.id}
                                style={styles.quickSearchCard}
                                onPress={search.action}
                                activeOpacity={0.7}
                            >
                                <View style={styles.quickSearchIconContainer}>
                                    <SafeIcon
                                        name={search.icon}
                                        size={24}
                                        color="#3B82F6"
                                        type="lucide"
                                    />
                                </View>
                                <Text style={styles.quickSearchTitle}>{search.title}</Text>
                                <Text style={styles.quickSearchDescription}>{search.description}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Formulaire de recherche */}
                <View style={styles.searchFormCard}>
                    <Text style={styles.sectionTitle}>{t('etablissementSearch.localisation')}</Text>

                    {/* Ville */}
                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label={t('etablissementSearch.ville')}
                            value={ville}
                            onSelect={(location) => setVille(location)}
                            placeholder={t('etablissementSearch.rechercherUnLieuVilleQuartier')}
                            scope="all"
                            enrichWithBackend={true}
                        />
                    </View>

                    {/* Région */}
                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label={t('etablissementSearch.region')}
                            value={region}
                            onSelect={(location) => setRegion(location)}
                            placeholder={t('etablissementSearch.rechercherUneRegionOuUn')}
                            scope="all"
                            enrichWithBackend={true}
                        />
                    </View>

                    {/* Type établissement */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="building" size={14} color={modernColors.primary} type="lucide" />{t('etablissementSearchScreen.typeDetablissement')}
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            {typesEtablissements.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[styles.chip, typeEtablissement === type && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setTypeEtablissement(typeEtablissement === type ? '' : type);
                                    }}
                                >
                                    <Text style={[styles.chipText, typeEtablissement === type && styles.chipTextActive]}>
                                        {type}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Filière */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <SafeIcon name="book" size={14} color={modernColors.primary} type="lucide" />{t('etablissementSearchScreen.filiere')}
                        </Text>
                        <NativeInput
                            value={filiere}
                            onChangeText={setFiliere}
                            placeholder={t('etablissementSearch.exScientifiqueLitteraire')}
                        />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                            {filieres.map((f) => (
                                <TouchableOpacity
                                    key={f}
                                    style={[styles.chip, filiere === f && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setFiliere(filiere === f ? '' : f);
                                    }}
                                >
                                    <Text style={[styles.chipText, filiere === f && styles.chipTextActive]}>
                                        {f}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    {/* Bouton recherche */}
                    <NativeButton
                        onPress={handleSearch}
                        disabled={loading}
                        style={styles.searchButton}
                    >
                        <View style={styles.searchButtonContent}>
                            <SafeIcon name="search" size={20} color="#FFFFFF" type="lucide" />
                            <Text style={styles.searchButtonText}>
                                {loading ? 'Recherche en cours...' : 'Lancer la recherche'}
                            </Text>
                        </View>
                    </NativeButton>
                </View>

                {/* Résultats */}
                {loading ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color="#3B82F6" />
                        <Text style={styles.loadingText}>{t('etablissementSearch.chargement')}</Text>
                    </View>
                ) : etablissements.length > 0 ? (
                    <View style={styles.resultsSection}>
                        <Text style={styles.resultsCount}>
                            {total} établissement{total > 1 ? 's' : 't('etablissementSearchScreen.trouvetotal1')s' : ''}
                        </Text>
                        {etablissements.map((item) => renderEtablissement({ item }))}
                    </View>
                ) : (
                    <View style={styles.infoCard}>
                        <View style={styles.infoHeader}>
                            <SafeIcon name="info" size={20} color="#3B82F6" type="lucide" />
                            <Text style={styles.infoTitle}>{t('etablissementSearch.aucunResultat')}</Text>
                        </View>
                        <Text style={styles.infoText}>
                            Aucun établissement ne correspond à vos critères. Essayez de modifier vos filtres de recherche.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    headerGradient: {
        paddingTop: 20,
        paddingBottom: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
    },
    backButton: {
        marginRight: 12,
        marginTop: 4,
    },
    headerContent: {
        flex: 1,
        alignItems: 'center',
    },
    headerIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 6,
        textAlign: 'center',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        paddingHorizontal: 20,
        lineHeight: 20,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 32,
    },
    quickSearchesSection: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    quickSearchesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    quickSearchCard: {
        flex: 1,
        minWidth: '30%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    quickSearchIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#DBEAFE',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    quickSearchTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
        textAlign: 'center',
    },
    quickSearchDescription: {
        fontSize: 11,
        color: '#6B7280',
        textAlign: 'center',
    },
    searchFormCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    chipsContainer: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
    },
    chipActive: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
    },
    chipText: {
        fontSize: 14,
        color: '#374151',
        fontWeight: '600',
    },
    chipTextActive: {
        color: '#FFFFFF',
    },
    searchButton: {
        marginTop: 16,
        borderRadius: 12,
        overflow: 'hidden',
    },
    searchButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    searchButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    resultsSection: {
        marginTop: 8,
    },
    resultsCount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    cardHeader: {
        marginBottom: 12,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cardIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#DBEAFE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitleContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    verifiedText: {
        color: '#065F46',
        fontSize: 11,
        fontWeight: '600',
    },
    cardContent: {
        gap: 8,
    },
    cardInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cardSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        flex: 1,
    },
    centerContainer: {
        padding: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 16,
        color: '#6B7280',
        fontSize: 14,
    },
    infoCard: {
        backgroundColor: '#DBEAFE',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#93C5FD',
        marginTop: 16,
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E3A8A',
    },
    infoText: {
        fontSize: 13,
        color: '#1E3A8A',
        lineHeight: 20,
    },
});

export default EtablissementSearchScreen;

