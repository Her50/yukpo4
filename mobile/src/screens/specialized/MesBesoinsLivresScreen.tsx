// ✅ Écran "Mes Besoins" multi-classe — Déclarer les besoins de livres pour plusieurs enfants/classes
// Permet à un parent de créer une liste de besoins regroupés par enfant/classe

import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { useToaster } from '../../components/ToasterProvider';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { bourseLivreV2Api } from '../../services/bourseLivreV2Api';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

// ============================================================================
// TYPES
// ============================================================================

interface BesoinLivre {
    id: string;
    classe: string;
    matiere: string;
    titre_specifique?: string;
    priorite: 'haute' | 'moyenne' | 'basse';
}

interface EnfantBesoins {
    id: string;
    nom: string;
    classe: string;
    niveau: string;
    besoins: BesoinLivre[];
}

interface SearchResultItem {
    livre_id: number;
    titre: string;
    matiere: string;
    classe_actuelle: string;
    etat_livre: string;
    valeur_calculee: number;
    mode_listing: string;
    ville?: string;
    distance_km?: number;
}

// ============================================================================
// CONSTANTES
// ============================================================================

const CLASSES_PRIMAIRE = ['SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
const CLASSES_COLLEGE = ['6ème', '5ème', '4ème', '3ème'];
const CLASSES_LYCEE = ['2nde', '1ère', 'Terminale'];
const ALL_CLASSES = [...CLASSES_PRIMAIRE, ...CLASSES_COLLEGE, ...CLASSES_LYCEE];

const NIVEAUX = [
    { key: 'primaire', labelKey: 'mesBesoinsLivres.primaire', classes: CLASSES_PRIMAIRE },
    { key: 'college', labelKey: 'mesBesoinsLivres.college', classes: CLASSES_COLLEGE },
    { key: 'lycee', labelKey: 'mesBesoinsLivres.lycee', classes: CLASSES_LYCEE },
];

const MATIERES_PAR_NIVEAU: Record<string, string[]> = {
    primaire: ['Français', 'Mathématiques', 'Anglais', 'Sciences', 'Histoire-Géo', 'Éducation civique'],
    college: ['Français', 'Mathématiques', 'Anglais', 'SVT', 'Physique-Chimie', 'Histoire-Géo', 'Espagnol', 'Allemand', 'Technologie'],
    lycee: ['Français', 'Mathématiques', 'Anglais', 'SVT', 'Physique-Chimie', 'Histoire-Géo', 'Philosophie', 'Espagnol', 'Allemand', 'Économie'],
};

const PRIORITE_CONFIG_KEYS = {
    haute: { color: '#ef4444', icon: 'alert-circle', labelKey: 'mesBesoinsLivres.urgent' },
    moyenne: { color: '#f59e0b', icon: 'clock', labelKey: 'mesBesoinsLivres.normal' },
    basse: { color: '#22c55e', icon: 'check-circle', labelKey: 'mesBesoinsLivres.pasPress' },
};

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

const MesBesoinsLivresScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const toaster = useToaster();
    const { t } = useLanguageSafe();

    // State principal
    const [enfants, setEnfants] = useState<EnfantBesoins[]>([]);
    const [activeEnfantId, setActiveEnfantId] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<Record<string, SearchResultItem[]>>({});
    const [searching, setSearching] = useState(false);
    const [searchedBesoins, setSearchedBesoins] = useState<Set<string>>(new Set());

    // State ajout enfant
    const [showAddEnfant, setShowAddEnfant] = useState(enfants.length === 0);
    const [newNom, setNewNom] = useState('');
    const [newNiveau, setNewNiveau] = useState('');
    const [newClasse, setNewClasse] = useState('');

    // State ajout besoin
    const [showAddBesoin, setShowAddBesoin] = useState(false);
    const [newMatiere, setNewMatiere] = useState('');
    const [newTitre, setNewTitre] = useState('');
    const [newPriorite, setNewPriorite] = useState<'haute' | 'moyenne' | 'basse'>('moyenne');

    // ============================
    // COMPUTED
    // ============================

    const activeEnfant = useMemo(
        () => enfants.find(e => e.id === activeEnfantId) || null,
        [enfants, activeEnfantId]
    );

    const totalBesoins = useMemo(
        () => enfants.reduce((sum, e) => sum + e.besoins.length, 0),
        [enfants]
    );

    const totalResultats = useMemo(
        () => Object.values(searchResults).reduce((sum, r) => sum + r.length, 0),
        [searchResults]
    );

    const classesForNiveau = useMemo(() => {
        const niveauData = NIVEAUX.find(n => n.key === newNiveau);
        return niveauData?.classes || [];
    }, [newNiveau]);

    const matieresForActiveEnfant = useMemo(() => {
        if (!activeEnfant) return [];
        return MATIERES_PAR_NIVEAU[activeEnfant.niveau] || MATIERES_PAR_NIVEAU['college'];
    }, [activeEnfant]);

    // ============================
    // ACTIONS
    // ============================

    const handleAddEnfant = useCallback(() => {
        if (!newNom.trim()) {
            Alert.alert('Error', t('mesBesoinsLivres.erreurNom'));
            return;
        }
        if (!newNiveau || !newClasse) {
            Alert.alert('Error', t('mesBesoinsLivres.erreurNiveauClasse'));
            return;
        }

        const enfant: EnfantBesoins = {
            id: `enfant_${Date.now()}`,
            nom: newNom.trim(),
            classe: newClasse,
            niveau: newNiveau,
            besoins: [],
        };

        setEnfants(prev => [...prev, enfant]);
        setActiveEnfantId(enfant.id);
        setShowAddEnfant(false);
        setNewNom('');
        setNewNiveau('');
        setNewClasse('');
        toaster.show(t('mesBesoinsLivres.ajouteAvecClasse', { nom: enfant.nom, classe: enfant.classe }), 'success');
    }, [newNom, newNiveau, newClasse, toaster, t]);

    const handleRemoveEnfant = useCallback((enfantId: string) => {
        const enfant = enfants.find(e => e.id === enfantId);
        Alert.alert(
            t('mesBesoinsLivres.supprimer'),
            t('mesBesoinsLivres.retirerEnfant', { nom: enfant?.nom }),
            [
                { text: t('mesBesoinsLivres.annuler'), style: 'cancel' },
                {
                    text: t('mesBesoinsLivres.supprimer'),
                    style: 'destructive',
                    onPress: () => {
                        setEnfants(prev => prev.filter(e => e.id !== enfantId));
                        if (activeEnfantId === enfantId) {
                            setActiveEnfantId(enfants.find(e => e.id !== enfantId)?.id || null);
                        }
                    },
                },
            ]
        );
    }, [enfants, activeEnfantId]);

    const handleAddBesoin = useCallback(() => {
        if (!activeEnfantId || !newMatiere) {
            Alert.alert('Error', t('mesBesoinsLivres.erreurMatiere'));
            return;
        }

        const besoin: BesoinLivre = {
            id: `besoin_${Date.now()}`,
            classe: activeEnfant!.classe,
            matiere: newMatiere,
            titre_specifique: newTitre.trim() || undefined,
            priorite: newPriorite,
        };

        setEnfants(prev =>
            prev.map(e =>
                e.id === activeEnfantId
                    ? { ...e, besoins: [...e.besoins, besoin] }
                    : e
            )
        );

        setShowAddBesoin(false);
        setNewMatiere('');
        setNewTitre('');
        setNewPriorite('moyenne');
        toaster.show(t('mesBesoinsLivres.besoinAjoute', { matiere: newMatiere }), 'success');
    }, [activeEnfantId, activeEnfant, newMatiere, newTitre, newPriorite, toaster, t]);

    const handleRemoveBesoin = useCallback((enfantId: string, besoinId: string) => {
        setEnfants(prev =>
            prev.map(e =>
                e.id === enfantId
                    ? { ...e, besoins: e.besoins.filter(b => b.id !== besoinId) }
                    : e
            )
        );
    }, []);

    const handleSearchAllBesoins = useCallback(async () => {
        if (totalBesoins === 0) {
            Alert.alert(t('mesBesoinsLivres.aucunBesoin'), t('mesBesoinsLivres.ajoutezAuMoinsUnBesoin'));
            return;
        }

        setSearching(true);
        const results: Record<string, SearchResultItem[]> = {};
        const searched = new Set<string>();

        try {
            for (const enfant of enfants) {
                for (const besoin of enfant.besoins) {
                    const key = `${enfant.id}_${besoin.id}`;
                    try {
                        const response = await bourseLivreV2Api.browseByClass(
                            besoin.classe,
                            besoin.matiere,
                        );
                        results[key] = response || [];
                        searched.add(key);
                    } catch {
                        results[key] = [];
                        searched.add(key);
                    }
                }
            }

            setSearchResults(results);
            setSearchedBesoins(searched);

            const totalFound = Object.values(results).reduce((s, r) => s + r.length, 0);
            toaster.show(
                t('mesBesoinsLivres.livresTrouves', { found: totalFound, total: totalBesoins }),
                totalFound > 0 ? 'success' : 'info'
            );
        } catch (error) {
            console.error('[MesBesoins] Erreur recherche:', error);
            Alert.alert('Error', t('mesBesoinsLivres.erreurRecherche'));
        } finally {
            setSearching(false);
        }
    }, [enfants, totalBesoins, toaster]);

    const handleViewBook = useCallback((livreId: number) => {
        hapticPress();
        navigation.navigate('LivreScolaireDetails', { livreId });
    }, [navigation]);

    // ============================
    // RENDERS
    // ============================

    const renderEnfantTabs = () => (
        <View style={styles.tabsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                {enfants.map(enfant => (
                    <TouchableOpacity
                        key={enfant.id}
                        style={[styles.enfantTab, activeEnfantId === enfant.id && styles.enfantTabActive]}
                        onPress={() => { hapticPress(); setActiveEnfantId(enfant.id); setShowAddBesoin(false); }}
                        onLongPress={() => handleRemoveEnfant(enfant.id)}
                    >
                        <SafeIcon
                            name="user"
                            size={14}
                            color={activeEnfantId === enfant.id ? '#fff' : '#6b7280'}
                        />
                        <Text style={[styles.enfantTabText, activeEnfantId === enfant.id && styles.enfantTabTextActive]}>
                            {enfant.nom}
                        </Text>
                        <View style={[styles.enfantTabBadge, activeEnfantId === enfant.id && styles.enfantTabBadgeActive]}>
                            <Text style={[styles.enfantTabBadgeText, activeEnfantId === enfant.id && styles.enfantTabBadgeTextActive]}>
                                {enfant.besoins.length}
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity
                    style={styles.addEnfantTab}
                    onPress={() => { hapticPress(); setShowAddEnfant(true); }}
                >
                    <SafeIcon name="plus" size={16} color={modernColors.primary} />
                    <Text style={styles.addEnfantTabText}>{t('mesBesoinsLivres.enfant')}</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );

    const renderAddEnfantForm = () => (
        <View style={styles.formCard}>
            <Text style={styles.formTitle}>{t('mesBesoinsLivres.ajouterEnfant')}</Text>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('mesBesoinsLivres.nomPrenom')}</Text>
                <TextInput
                    style={styles.textInput}
                    value={newNom}
                    onChangeText={setNewNom}
                    placeholder={t('mesBesoinsLivres.nomPrenomPlaceholder')}
                    placeholderTextColor="#9ca3af"
                />
            </View>

            <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('mesBesoinsLivres.niveauScolaire')}</Text>
                <View style={styles.chipsRow}>
                    {NIVEAUX.map(n => (
                        <TouchableOpacity
                            key={n.key}
                            style={[styles.chip, newNiveau === n.key && styles.chipActive]}
                            onPress={() => { hapticPress(); setNewNiveau(n.key); setNewClasse(''); }}
                        >
                            <Text style={[styles.chipText, newNiveau === n.key && styles.chipTextActive]}>
                                {t(n.labelKey)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {newNiveau ? (
                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('mesBesoinsLivres.classe')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.chipsRow}>
                            {classesForNiveau.map(c => (
                                <TouchableOpacity
                                    key={c}
                                    style={[styles.chip, newClasse === c && styles.chipActive]}
                                    onPress={() => { hapticPress(); setNewClasse(c); }}
                                >
                                    <Text style={[styles.chipText, newClasse === c && styles.chipTextActive]}>
                                        {c}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            ) : null}

            <View style={styles.formActions}>
                {enfants.length > 0 && (
                    <NativeButton
                        title={t('mesBesoinsLivres.annuler')}
                        onPress={() => setShowAddEnfant(false)}
                        style={[styles.formBtn, { backgroundColor: '#6b7280' }]}
                    />
                )}
                <NativeButton
                    title={t('mesBesoinsLivres.ajouter')}
                    onPress={handleAddEnfant}
                    style={[styles.formBtn, { backgroundColor: modernColors.primary }]}
                />
            </View>
        </View>
    );

    const renderAddBesoinForm = () => {
        if (!activeEnfant) return null;

        return (
            <View style={styles.formCard}>
                <Text style={styles.formTitle}>
                    {t('mesBesoinsLivres.besoinPour', { nom: activeEnfant.nom, classe: activeEnfant.classe })}
                </Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('mesBesoinsLivres.matiere')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.chipsRow}>
                            {matieresForActiveEnfant.map(m => (
                                <TouchableOpacity
                                    key={m}
                                    style={[styles.chip, newMatiere === m && styles.chipActive]}
                                    onPress={() => { hapticPress(); setNewMatiere(m); }}
                                >
                                    <Text style={[styles.chipText, newMatiere === m && styles.chipTextActive]}>
                                        {m}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('mesBesoinsLivres.titreSpecifique')}</Text>
                    <TextInput
                        style={styles.textInput}
                        value={newTitre}
                        onChangeText={setNewTitre}
                        placeholder={t('mesBesoinsLivres.titreSpecifiquePlaceholder')}
                        placeholderTextColor="#9ca3af"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('mesBesoinsLivres.priorite')}</Text>
                    <View style={styles.chipsRow}>
                        {(['haute', 'moyenne', 'basse'] as const).map(p => {
                            const cfg = PRIORITE_CONFIG_KEYS[p];
                            return (
                                <TouchableOpacity
                                    key={p}
                                    style={[
                                        styles.chip,
                                        newPriorite === p && { backgroundColor: cfg.color, borderColor: cfg.color },
                                    ]}
                                    onPress={() => { hapticPress(); setNewPriorite(p); }}
                                >
                                    <SafeIcon name={cfg.icon} size={12} color={newPriorite === p ? '#fff' : cfg.color} />
                                    <Text style={[styles.chipText, newPriorite === p && styles.chipTextActive]}>
                                        {t(cfg.labelKey)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <View style={styles.formActions}>
                    <NativeButton
                        title={t('mesBesoinsLivres.annuler')}
                        onPress={() => setShowAddBesoin(false)}
                        style={[styles.formBtn, { backgroundColor: '#6b7280' }]}
                    />
                    <NativeButton
                        title={t('mesBesoinsLivres.ajouterCeBesoin')}
                        onPress={handleAddBesoin}
                        style={[styles.formBtn, { backgroundColor: modernColors.primary }]}
                    />
                </View>
            </View>
        );
    };

    const renderBesoinItem = (enfant: EnfantBesoins, besoin: BesoinLivre) => {
        const cfg = PRIORITE_CONFIG_KEYS[besoin.priorite];
        const key = `${enfant.id}_${besoin.id}`;
        const results = searchResults[key] || [];
        const hasSearched = searchedBesoins.has(key);

        return (
            <View key={besoin.id} style={styles.besoinCard}>
                <View style={styles.besoinHeader}>
                    <View style={[styles.prioriteDot, { backgroundColor: cfg.color }]} />
                    <View style={styles.besoinInfo}>
                        <Text style={styles.besoinMatiere}>{besoin.matiere}</Text>
                        {besoin.titre_specifique && (
                            <Text style={styles.besoinTitre}>{besoin.titre_specifique}</Text>
                        )}
                    </View>
                    <TouchableOpacity
                        onPress={() => handleRemoveBesoin(enfant.id, besoin.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <SafeIcon name="x" size={16} color="#9ca3af" />
                    </TouchableOpacity>
                </View>

                {hasSearched && (
                    <View style={styles.besoinResults}>
                        {results.length > 0 ? (
                            <>
                                <Text style={styles.besoinResultsCount}>
                                    {t('mesBesoinsLivres.livresDisponibles', { count: results.length })}
                                </Text>
                                {results.slice(0, 3).map((livre, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={styles.miniLivreCard}
                                        onPress={() => handleViewBook(livre.livre_id)}
                                    >
                                        <View style={styles.miniLivreInfo}>
                                            <Text style={styles.miniLivreTitre} numberOfLines={1}>{livre.titre}</Text>
                                            <Text style={styles.miniLivreMeta}>
                                                {livre.etat_livre} • {livre.mode_listing === 'troc' ? t('mesBesoinsLivres.troc') : livre.mode_listing === 'don' ? t('mesBesoinsLivres.don') : `${Math.round(livre.valeur_calculee)} XAF`}
                                                {livre.distance_km != null ? ` • ${livre.distance_km.toFixed(1)}km` : ''}
                                            </Text>
                                        </View>
                                        <SafeIcon name="chevron-right" size={14} color="#9ca3af" />
                                    </TouchableOpacity>
                                ))}
                                {results.length > 3 && (
                                    <TouchableOpacity
                                        style={styles.voirPlusBtn}
                                        onPress={() => {
                                            hapticPress();
                                            navigation.navigate('LivreScolaireList', {
                                                filters: { classe_actuelle: besoin.classe, matiere: besoin.matiere },
                                            });
                                        }}
                                    >
                                        <Text style={styles.voirPlusText}>
                                            {t('mesBesoinsLivres.voirLesResultats', { count: results.length })}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        ) : (
                            <Text style={styles.besoinNoResults}>
                                {t('mesBesoinsLivres.aucunLivreDisponible')}
                            </Text>
                        )}
                    </View>
                )}
            </View>
        );
    };

    const renderActiveEnfantBesoins = () => {
        if (!activeEnfant) return null;

        return (
            <View style={styles.besoinsSection}>
                <View style={styles.besoinsSectionHeader}>
                    <View>
                        <Text style={styles.besoinsSectionTitle}>
                            {activeEnfant.nom} — {activeEnfant.classe}
                        </Text>
                        <Text style={styles.besoinsSectionSubtitle}>
                            {t('mesBesoinsLivres.besoinsDeclares', { count: activeEnfant.besoins.length })}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.addBesoinBtn}
                        onPress={() => { hapticPress(); setShowAddBesoin(true); }}
                    >
                        <SafeIcon name="plus" size={16} color="#fff" />
                        <Text style={styles.addBesoinBtnText}>{t('mesBesoinsLivres.besoin')}</Text>
                    </TouchableOpacity>
                </View>

                {activeEnfant.besoins.length === 0 ? (
                    <View style={styles.emptyBesoins}>
                        <SafeIcon name="book-open" size={40} color="#d1d5db" />
                        <Text style={styles.emptyBesoinsText}>
                            {t('mesBesoinsLivres.aucunBesoinPour', { nom: activeEnfant.nom })}
                        </Text>
                        <NativeButton
                            title={t('mesBesoinsLivres.ajouterUnBesoin')}
                            onPress={() => { hapticPress(); setShowAddBesoin(true); }}
                            style={{ backgroundColor: modernColors.primary, marginTop: 12 }}
                        />
                    </View>
                ) : (
                    activeEnfant.besoins.map(besoin => renderBesoinItem(activeEnfant, besoin))
                )}
            </View>
        );
    };

    const renderSummary = () => {
        if (enfants.length === 0) return null;

        return (
            <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                    <View style={styles.summaryStat}>
                        <Text style={styles.summaryValue}>{enfants.length}</Text>
                        <Text style={styles.summaryLabel}>{enfants.length > 1 ? t('mesBesoinsLivres.enfants') : t('mesBesoinsLivres.enfant')}</Text>
                    </View>
                    <View style={styles.summaryStat}>
                        <Text style={styles.summaryValue}>{totalBesoins}</Text>
                        <Text style={styles.summaryLabel}>{totalBesoins > 1 ? t('mesBesoinsLivres.besoins') : t('mesBesoinsLivres.besoin')}</Text>
                    </View>
                    <View style={styles.summaryStat}>
                        <Text style={[styles.summaryValue, { color: modernColors.primary }]}>{totalResultats}</Text>
                        <Text style={styles.summaryLabel}>{t('mesBesoinsLivres.trouves')}</Text>
                    </View>
                </View>
            </View>
        );
    };

    // ============================
    // MAIN RENDER
    // ============================

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <SafeIcon name="arrow-left" size={22} color="#1f2937" />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.headerTitle}>{t('mesBesoinsLivres.title')}</Text>
                    <Text style={styles.headerSubtitle}>{t('mesBesoinsLivres.subtitle')}</Text>
                </View>
            </View>

            {renderSummary()}

            {enfants.length > 0 && renderEnfantTabs()}

            <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
                {showAddEnfant && renderAddEnfantForm()}
                {showAddBesoin && renderAddBesoinForm()}
                {!showAddEnfant && !showAddBesoin && renderActiveEnfantBesoins()}
            </ScrollView>

            {/* Bottom action: Rechercher tous les besoins */}
            {totalBesoins > 0 && (
                <View style={styles.bottomBar}>
                    <NativeButton
                        title={searching
                            ? t('mesBesoinsLivres.rechercheEnCours')
                            : t('mesBesoinsLivres.rechercherBesoins', { count: totalBesoins })
                        }
                        onPress={handleSearchAllBesoins}
                        disabled={searching}
                        style={[styles.searchAllBtn, { backgroundColor: modernColors.primary }]}
                    />
                </View>
            )}

            {searching && (
                <View style={styles.searchingOverlay}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.searchingText}>{t('mesBesoinsLivres.rechercheEnCoursPour', { count: totalBesoins })}</Text>
                </View>
            )}
        </View>
    );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },

    header: {
        flexDirection: 'row', alignItems: 'center', padding: 16,
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    },
    backBtn: { marginRight: 12 },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937' },
    headerSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },

    summaryCard: {
        backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12,
        borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb',
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
    summaryStat: { alignItems: 'center' },
    summaryValue: { fontSize: 24, fontWeight: '700', color: '#1f2937' },
    summaryLabel: { fontSize: 12, color: '#6b7280', marginTop: 2 },

    tabsContainer: {
        backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
        paddingVertical: 8,
    },
    tabsScroll: { paddingHorizontal: 12, gap: 8 },
    enfantTab: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb',
    },
    enfantTabActive: { backgroundColor: modernColors.primary, borderColor: modernColors.primary },
    enfantTabText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
    enfantTabTextActive: { color: '#fff' },
    enfantTabBadge: {
        backgroundColor: '#e5e7eb', borderRadius: 10, minWidth: 20, height: 20,
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6,
    },
    enfantTabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
    enfantTabBadgeText: { fontSize: 11, fontWeight: '700', color: '#6b7280' },
    enfantTabBadgeTextActive: { color: '#fff' },
    addEnfantTab: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        borderWidth: 1.5, borderColor: modernColors.primary, borderStyle: 'dashed',
    },
    addEnfantTabText: { fontSize: 13, fontWeight: '600', color: modernColors.primary },

    content: { flex: 1 },
    contentInner: { padding: 16, paddingBottom: 100 },

    formCard: {
        backgroundColor: '#fff', borderRadius: 12, padding: 16,
        borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 16,
    },
    formTitle: { fontSize: 17, fontWeight: '700', color: '#1f2937', marginBottom: 16 },
    inputGroup: { marginBottom: 16 },
    inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
    textInput: {
        borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12,
        fontSize: 15, color: '#1f2937', backgroundColor: '#f9fafb',
    },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: '#d1d5db',
    },
    chipActive: { backgroundColor: modernColors.primary, borderColor: modernColors.primary },
    chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
    chipTextActive: { color: '#fff' },
    formActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    formBtn: { flex: 1, paddingVertical: 12 },

    besoinsSection: { marginBottom: 16 },
    besoinsSectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12,
    },
    besoinsSectionTitle: { fontSize: 17, fontWeight: '700', color: '#1f2937' },
    besoinsSectionSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    addBesoinBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: modernColors.primary, borderRadius: 20,
        paddingHorizontal: 14, paddingVertical: 8,
    },
    addBesoinBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

    emptyBesoins: { alignItems: 'center', padding: 32 },
    emptyBesoinsText: { fontSize: 14, color: '#9ca3af', marginTop: 12, textAlign: 'center' },

    besoinCard: {
        backgroundColor: '#fff', borderRadius: 12, padding: 12,
        marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb',
    },
    besoinHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    prioriteDot: { width: 8, height: 8, borderRadius: 4 },
    besoinInfo: { flex: 1 },
    besoinMatiere: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
    besoinTitre: { fontSize: 12, color: '#6b7280', marginTop: 2 },

    besoinResults: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
    besoinResultsCount: { fontSize: 12, fontWeight: '600', color: '#059669', marginBottom: 8 },
    besoinNoResults: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic' },

    miniLivreCard: {
        flexDirection: 'row', alignItems: 'center', padding: 8,
        backgroundColor: '#f9fafb', borderRadius: 8, marginBottom: 6,
    },
    miniLivreInfo: { flex: 1 },
    miniLivreTitre: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
    miniLivreMeta: { fontSize: 11, color: '#6b7280', marginTop: 2 },
    voirPlusBtn: { alignItems: 'center', paddingVertical: 8 },
    voirPlusText: { fontSize: 13, fontWeight: '600', color: modernColors.primary },

    bottomBar: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#fff', padding: 16,
        borderTopWidth: 1, borderTopColor: '#e5e7eb',
        shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1, shadowRadius: 4, elevation: 5,
    },
    searchAllBtn: { paddingVertical: 16 },

    searchingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.85)',
        justifyContent: 'center', alignItems: 'center',
    },
    searchingText: { fontSize: 15, color: '#374151', fontWeight: '600', marginTop: 16 },
});

export default MesBesoinsLivresScreen;
