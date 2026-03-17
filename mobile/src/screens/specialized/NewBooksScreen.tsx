// ✅ Écran Catalogue Livres Neufs — Browse, Compare, Acheter
// Permet aux utilisateurs de parcourir les livres neufs par classe/matière,
// comparer les prix neuf vs occasion, et acheter directement

import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { useLocation } from '../../contexts/LocationContext';
import { useToaster } from '../../components/ToasterProvider';
import { bourseLivreV2Api, NewBookListing, PriceComparison } from '../../services/bourseLivreV2Api';
import { hapticPress } from '../../utils/hapticFeedback';

// Niveaux scolaires
const NIVEAUX = [
    { key: 'all', labelKey: 'livresNeufs.tous' },
    { key: 'Primaire', labelKey: 'livresNeufs.primaire' },
    { key: 'Collège', labelKey: 'livresNeufs.college' },
    { key: 'Lycée', labelKey: 'livresNeufs.lycee' },
];

const NewBooksScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { t } = useLanguageSafe();
    const { location } = useLocation();
    const toaster = useToaster();

    // États
    const [livres, setLivres] = useState<NewBookListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNiveau, setSelectedNiveau] = useState('all');
    const [selectedClasse, setSelectedClasse] = useState<string | undefined>();
    const [total, setTotal] = useState(0);

    // Comparaison de prix
    const [showComparison, setShowComparison] = useState(false);
    const [comparison, setComparison] = useState<PriceComparison | null>(null);
    const [loadingComparison, setLoadingComparison] = useState(false);

    // Charger les livres neufs
    const loadNewBooks = useCallback(async (refresh = false) => {
        try {
            if (refresh) setRefreshing(true);
            else setLoading(true);

            const result = await bourseLivreV2Api.browseNewBooks({
                niveau: selectedNiveau === 'all' ? undefined : selectedNiveau,
                classe: selectedClasse,
                search: searchQuery || undefined,
                limit: 50,
            });

            setLivres(result.livres);
            setTotal(result.total);
        } catch (err) {
            console.error('[NewBooksScreen] Erreur:', err);
            toaster.show(t('livresNeufs.erreurChargement'), 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedNiveau, selectedClasse, searchQuery, t]);

    useEffect(() => {
        loadNewBooks();
    }, [selectedNiveau, selectedClasse]);

    // Chercher avec debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.length >= 2 || searchQuery.length === 0) {
                loadNewBooks();
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Comparer les prix pour une classe
    const handleCompare = useCallback(async (classe: string, matiere?: string) => {
        try {
            setLoadingComparison(true);
            setShowComparison(true);
            const result = await bourseLivreV2Api.comparePrices(classe, matiere);
            setComparison(result);
        } catch (err) {
            console.error('[NewBooksScreen] Erreur comparaison:', err);
            toaster.show(t('livresNeufs.erreurComparaison'), 'error');
        } finally {
            setLoadingComparison(false);
        }
    }, [t]);

    // Acheter un livre neuf (réutilise le flow purchase existant)
    const handleBuyNew = useCallback(async (livre: NewBookListing) => {
        hapticPress();
        Alert.alert(
            t('livresNeufs.acheterNeuf'),
            t('livresNeufs.confirmerAchat', { titre: livre.titre, prix: livre.prix_neuf }),
            [
                { text: t('livresNeufs.annuler'), style: 'cancel' },
                {
                    text: t('livresNeufs.confirmer'),
                    onPress: async () => {
                        try {
                            const gps = location?.coords
                                ? `${location.coords.latitude},${location.coords.longitude}`
                                : undefined;
                            await bourseLivreV2Api.createPurchase({
                                livre_id: livre.id,
                                gps_livraison: gps,
                                paiement_methode: 'wallet',
                            });
                            toaster.show(t('livresNeufs.achatReussi'), 'success');
                        } catch (err: any) {
                            const msg = err?.response?.data?.message || err?.message || '';
                            toaster.show(t('livresNeufs.erreurAchat') + (msg ? `: ${msg}` : ''), 'error');
                        }
                    },
                },
            ]
        );
    }, [location, t]);

    // Classes disponibles depuis les livres chargés
    const classesDisponibles = useMemo(() => {
        const classSet = new Set<string>();
        livres.forEach(l => { if (l.classe) classSet.add(l.classe); });
        return Array.from(classSet).sort();
    }, [livres]);

    // Render un livre neuf
    const renderNewBook = useCallback(({ item }: { item: NewBookListing }) => (
        <View style={styles.bookCard}>
            <View style={styles.bookHeader}>
                <View style={styles.badgeNeuf}>
                    <Text style={styles.badgeNeufText}>{t('livresNeufs.neuf')}</Text>
                </View>
                {item.est_au_programme && (
                    <View style={styles.badgeProgramme}>
                        <SafeIcon name="check-circle" size={12} color="#059669" />
                        <Text style={styles.badgeProgrammeText}>{t('livresNeufs.auProgramme')}</Text>
                    </View>
                )}
            </View>
            <Text style={styles.bookTitle} numberOfLines={2}>{item.titre}</Text>
            {item.auteur && <Text style={styles.bookAuthor}>{item.auteur}</Text>}
            <View style={styles.bookMeta}>
                <Text style={styles.bookMetaText}>{item.classe} • {item.matiere}</Text>
                {item.editeur && <Text style={styles.bookMetaText}>{item.editeur}</Text>}
            </View>
            <View style={styles.bookFooter}>
                <Text style={styles.bookPrice}>
                    {item.prix_neuf?.toLocaleString()} {item.devise || 'XAF'}
                </Text>
                <View style={styles.bookActions}>
                    <TouchableOpacity
                        style={styles.compareBtn}
                        onPress={() => handleCompare(item.classe, item.matiere)}
                    >
                        <SafeIcon name="bar-chart-2" size={16} color="#6366f1" />
                        <Text style={styles.compareBtnText}>{t('livresNeufs.comparer')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.buyBtn}
                        onPress={() => handleBuyNew(item)}
                    >
                        <SafeIcon name="shopping-cart" size={16} color="#fff" />
                        <Text style={styles.buyBtnText}>{t('livresNeufs.acheter')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
            {item.libraire_nom && (
                <Text style={styles.libraireName}>
                    <SafeIcon name="store" size={12} color="#6b7280" /> {item.libraire_nom}
                    {item.ville ? ` • ${item.ville}` : ''}
                </Text>
            )}
        </View>
    ), [t, handleCompare, handleBuyNew]);

    // Render comparaison prix
    const renderComparison = () => {
        if (!showComparison) return null;
        return (
            <View style={styles.comparisonOverlay}>
                <View style={styles.comparisonModal}>
                    <View style={styles.comparisonHeader}>
                        <Text style={styles.comparisonTitle}>{t('livresNeufs.comparaisonPrix')}</Text>
                        <TouchableOpacity onPress={() => setShowComparison(false)}>
                            <SafeIcon name="x" size={24} color="#6b7280" />
                        </TouchableOpacity>
                    </View>
                    {loadingComparison ? (
                        <ActivityIndicator size="large" color="#6366f1" style={{ marginVertical: 30 }} />
                    ) : comparison ? (
                        <ScrollView style={styles.comparisonBody}>
                            <Text style={styles.comparisonSubtitle}>
                                {comparison.classe}{comparison.matiere ? ` • ${comparison.matiere}` : ''}
                            </Text>

                            {/* Programme officiel */}
                            {comparison.programme_officiel.length > 0 && (
                                <View style={styles.compSection}>
                                    <Text style={styles.compSectionTitle}>
                                        <SafeIcon name="book-open" size={14} color="#0ea5e9" /> {t('livresNeufs.programmeOfficiel')} ({comparison.programme_officiel.length})
                                    </Text>
                                    {comparison.programme_officiel.map((p, i) => (
                                        <View key={i} style={styles.compItem}>
                                            <Text style={styles.compItemTitle} numberOfLines={1}>{p.titre}</Text>
                                            <Text style={styles.compItemPrice}>
                                                {p.prix_officiel ? `${p.prix_officiel.toLocaleString()} XAF` : '-'}
                                                {p.est_obligatoire ? ' ★' : ''}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Livres neufs */}
                            {comparison.neufs.length > 0 && (
                                <View style={styles.compSection}>
                                    <Text style={[styles.compSectionTitle, { color: '#059669' }]}>
                                        <SafeIcon name="package" size={14} color="#059669" /> {t('livresNeufs.neufsDisponibles')} ({comparison.neufs.length})
                                    </Text>
                                    {comparison.neufs.map((n, i) => (
                                        <View key={i} style={styles.compItem}>
                                            <Text style={styles.compItemTitle} numberOfLines={1}>{n.titre}</Text>
                                            <Text style={[styles.compItemPrice, { color: '#059669' }]}>
                                                {n.prix?.toLocaleString()} XAF
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Occasion */}
                            {comparison.occasions.length > 0 && (
                                <View style={styles.compSection}>
                                    <Text style={[styles.compSectionTitle, { color: '#d97706' }]}>
                                        <SafeIcon name="refresh-cw" size={14} color="#d97706" /> {t('livresNeufs.occasionDisponibles')} ({comparison.occasions.length})
                                    </Text>
                                    {comparison.occasions.map((o, i) => (
                                        <View key={i} style={styles.compItem}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.compItemTitle} numberOfLines={1}>{o.titre}</Text>
                                                <Text style={styles.compItemMeta}>{o.etat} • {o.source}</Text>
                                            </View>
                                            <Text style={[styles.compItemPrice, { color: '#d97706' }]}>
                                                {o.prix?.toLocaleString()} XAF
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {comparison.neufs.length === 0 && comparison.occasions.length === 0 && (
                                <Text style={styles.emptyComp}>{t('livresNeufs.aucuneComparaison')}</Text>
                            )}
                        </ScrollView>
                    ) : null}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <SafeIcon name="arrow-left" size={22} color="#1f2937" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{t('livresNeufs.title')}</Text>
                    <Text style={styles.headerSubtitle}>
                        {total > 0 ? t('livresNeufs.totalDisponibles', { count: total }) : t('livresNeufs.subtitle')}
                    </Text>
                </View>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                    <SafeIcon name="search" size={18} color="#9ca3af" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={t('livresNeufs.rechercherPlaceholder')}
                        placeholderTextColor="#9ca3af"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <SafeIcon name="x" size={16} color="#9ca3af" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Filtres niveau */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
                {NIVEAUX.map(n => (
                    <TouchableOpacity
                        key={n.key}
                        style={[styles.filterChip, selectedNiveau === n.key && styles.filterChipActive]}
                        onPress={() => {
                            hapticPress();
                            setSelectedNiveau(n.key);
                            setSelectedClasse(undefined);
                        }}
                    >
                        <Text style={[styles.filterChipText, selectedNiveau === n.key && styles.filterChipTextActive]}>
                            {t(n.labelKey)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Filtres classe */}
            {classesDisponibles.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classesRow} contentContainerStyle={{ paddingHorizontal: 16 }}>
                    <TouchableOpacity
                        style={[styles.classeChip, !selectedClasse && styles.classeChipActive]}
                        onPress={() => { hapticPress(); setSelectedClasse(undefined); }}
                    >
                        <Text style={[styles.classeChipText, !selectedClasse && styles.classeChipTextActive]}>
                            {t('livresNeufs.toutesClasses')}
                        </Text>
                    </TouchableOpacity>
                    {classesDisponibles.map(c => (
                        <TouchableOpacity
                            key={c}
                            style={[styles.classeChip, selectedClasse === c && styles.classeChipActive]}
                            onPress={() => { hapticPress(); setSelectedClasse(c); }}
                        >
                            <Text style={[styles.classeChipText, selectedClasse === c && styles.classeChipTextActive]}>
                                {c}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            )}

            {/* Liste des livres */}
            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#6366f1" />
                    <Text style={styles.loadingText}>{t('livresNeufs.chargement')}</Text>
                </View>
            ) : livres.length === 0 ? (
                <View style={styles.center}>
                    <SafeIcon name="book" size={48} color="#d1d5db" />
                    <Text style={styles.emptyText}>{t('livresNeufs.aucunLivre')}</Text>
                    <Text style={styles.emptySubText}>{t('livresNeufs.aucunLivreDesc')}</Text>
                </View>
            ) : (
                <FlatList
                    data={livres}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderNewBook}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => loadNewBooks(true)} />
                    }
                />
            )}

            {/* Modal comparaison */}
            {renderComparison()}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f9fafb' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    backBtn: { padding: 8 },
    headerCenter: { flex: 1, marginLeft: 8 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
    headerSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },

    searchRow: { paddingHorizontal: 16, paddingBottom: 8 },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#e5e7eb' },
    searchInput: { flex: 1, fontSize: 15, color: '#1f2937', marginLeft: 8, padding: 0 },

    filtersRow: { maxHeight: 44, marginBottom: 4 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f3f4f6', marginRight: 8 },
    filterChipActive: { backgroundColor: '#6366f1' },
    filterChipText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
    filterChipTextActive: { color: '#fff' },

    classesRow: { maxHeight: 38, marginBottom: 8 },
    classeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#e0e7ff', marginRight: 6 },
    classeChipActive: { backgroundColor: '#4f46e5' },
    classeChipText: { fontSize: 12, fontWeight: '600', color: '#4f46e5' },
    classeChipTextActive: { color: '#fff' },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    loadingText: { marginTop: 12, fontSize: 14, color: '#6b7280' },
    emptyText: { marginTop: 16, fontSize: 16, fontWeight: '600', color: '#6b7280' },
    emptySubText: { marginTop: 4, fontSize: 13, color: '#9ca3af', textAlign: 'center' },

    bookCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
    bookHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
    badgeNeuf: { backgroundColor: '#059669', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
    badgeNeufText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
    badgeProgramme: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, gap: 4 },
    badgeProgrammeText: { color: '#059669', fontSize: 11, fontWeight: '600' },
    bookTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 4 },
    bookAuthor: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
    bookMeta: { marginBottom: 8 },
    bookMetaText: { fontSize: 12, color: '#9ca3af' },
    bookFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    bookPrice: { fontSize: 18, fontWeight: '800', color: '#059669' },
    bookActions: { flexDirection: 'row', gap: 8 },
    compareBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#eef2ff', gap: 4 },
    compareBtnText: { fontSize: 12, fontWeight: '600', color: '#6366f1' },
    buyBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#059669', gap: 4 },
    buyBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
    libraireName: { marginTop: 8, fontSize: 12, color: '#6b7280' },

    // Comparaison modal
    comparisonOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    comparisonModal: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 30 },
    comparisonHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
    comparisonTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
    comparisonBody: { padding: 16 },
    comparisonSubtitle: { fontSize: 14, fontWeight: '600', color: '#6b7280', marginBottom: 16 },
    compSection: { marginBottom: 20 },
    compSectionTitle: { fontSize: 14, fontWeight: '700', color: '#0ea5e9', marginBottom: 10 },
    compItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
    compItemTitle: { flex: 1, fontSize: 13, color: '#374151', marginRight: 8 },
    compItemPrice: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
    compItemMeta: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
    emptyComp: { textAlign: 'center', fontSize: 14, color: '#9ca3af', marginVertical: 20 },
});

export default NewBooksScreen;
