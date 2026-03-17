// ✅ Composant Smart Autocomplete pour la recherche de livres scolaires
// Charge dynamiquement les classes, matières et suggestions depuis le backend

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { bourseLivreV2Api } from '../services/bourseLivreV2Api';
import { modernColors } from '../theme/modernTheme';
import { hapticPress } from '../utils/hapticFeedback';
import SafeIcon from './SafeIcon';

// ============================================================================
// TYPES
// ============================================================================

interface MatiereSuggestion {
    matiere: string;
    count: number;
    troc: number;
    vente: number;
    don: number;
}

interface LivreSuggestion {
    id: number;
    titre: string;
    auteur?: string;
    matiere: string;
    classe_actuelle: string;
    etat_livre: string;
    mode_listing?: string;
    valeur_calculee?: number;
    est_au_programme?: boolean;
}

interface BookSmartAutocompleteProps {
    onClasseChange: (classe: string) => void;
    onMatiereChange: (matiere: string) => void;
    onBookSelect?: (livre: LivreSuggestion) => void;
    selectedClasse?: string;
    selectedMatiere?: string;
}

// ============================================================================
// COMPOSANT
// ============================================================================

const BookSmartAutocomplete: React.FC<BookSmartAutocompleteProps> = ({
    onClasseChange,
    onMatiereChange,
    onBookSelect,
    selectedClasse = '',
    selectedMatiere = '',
}) => {
    const { t } = useLanguageSafe();
    const [classesDisponibles, setClassesDisponibles] = useState<string[]>([]);
    const [matieresDisponibles, setMatieresDisponibles] = useState<MatiereSuggestion[]>([]);
    const [topLivres, setTopLivres] = useState<LivreSuggestion[]>([]);
    const [totalLivresClasse, setTotalLivresClasse] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

    // Charger les classes au montage
    useEffect(() => {
        (async () => {
            try {
                const data = await bourseLivreV2Api.getSmartSuggestions();
                setClassesDisponibles(data.classes_disponibles || []);
            } catch (e) {
                console.warn('[BookSmartAutocomplete] Erreur chargement classes:', e);
            }
        })();
    }, []);

    // Charger les matières quand une classe est sélectionnée
    useEffect(() => {
        if (!selectedClasse) {
            setMatieresDisponibles([]);
            setTopLivres([]);
            setTotalLivresClasse(0);
            return;
        }

        (async () => {
            try {
                setLoading(true);
                const data = await bourseLivreV2Api.getSmartSuggestions(selectedClasse, selectedMatiere || undefined);
                setMatieresDisponibles(data.matieres_disponibles || []);
                setTopLivres(data.top_livres || []);
                setTotalLivresClasse(data.total_livres_classe || 0);
            } catch (e) {
                console.warn('[BookSmartAutocomplete] Erreur suggestions:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, [selectedClasse, selectedMatiere]);

    // Recherche texte libre avec debounce
    const handleSearchChange = useCallback((text: string) => {
        setSearchQuery(text);
        if (debounceTimer) clearTimeout(debounceTimer);

        if (text.length < 2) {
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setLoading(true);
                const data = await bourseLivreV2Api.getSmartSuggestions(
                    selectedClasse || undefined,
                    selectedMatiere || undefined,
                    text,
                );
                setTopLivres(data.top_livres || []);
            } catch (e) {
                console.warn('[BookSmartAutocomplete] Erreur recherche:', e);
            } finally {
                setLoading(false);
            }
        }, 400);
        setDebounceTimer(timer);
    }, [selectedClasse, selectedMatiere, debounceTimer]);

    // Regrouper les classes par niveau
    const groupedClasses = useMemo(() => {
        const primaire = ['SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
        const college = ['6ème', '5ème', '4ème', '3ème'];
        const lycee = ['2nde', '1ère', 'Terminale'];

        const classify = (c: string) => {
            if (primaire.includes(c)) return t('bookSmartAutocomplete.primaire');
            if (college.includes(c)) return t('bookSmartAutocomplete.college');
            if (lycee.includes(c)) return t('bookSmartAutocomplete.lycee');
            return t('bookSmartAutocomplete.autre');
        };

        const groups: Record<string, string[]> = {};
        for (const c of classesDisponibles) {
            const group = classify(c);
            if (!groups[group]) groups[group] = [];
            groups[group].push(c);
        }
        return groups;
    }, [classesDisponibles]);

    // ============================
    // RENDERS
    // ============================

    return (
        <View style={styles.container}>
            {/* Section Classes */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                    <SafeIcon name="graduation-cap" size={14} color={modernColors.primary} /> {t('bookSmartAutocomplete.classeRequired')}
                </Text>
                {Object.entries(groupedClasses).map(([niveau, classes]) => (
                    <View key={niveau} style={styles.niveauGroup}>
                        <Text style={styles.niveauLabel}>{niveau}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.chipsRow}>
                                {classes.map(c => (
                                    <TouchableOpacity
                                        key={c}
                                        style={[styles.chip, selectedClasse === c && styles.chipActive]}
                                        onPress={() => {
                                            hapticPress();
                                            onClasseChange(selectedClasse === c ? '' : c);
                                        }}
                                    >
                                        <Text style={[styles.chipText, selectedClasse === c && styles.chipTextActive]}>
                                            {c}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                ))}

                {selectedClasse && totalLivresClasse > 0 && (
                    <View style={styles.classeBanner}>
                        <SafeIcon name="book-open" size={14} color="#059669" />
                        <Text style={styles.classeBannerText}>
                            {t('bookSmartAutocomplete.livresDisponiblesEn', { count: totalLivresClasse, classe: selectedClasse })}
                        </Text>
                    </View>
                )}
            </View>

            {/* Section Matières (dynamique) */}
            {selectedClasse && matieresDisponibles.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        <SafeIcon name="book" size={14} color={modernColors.primary} /> {t('bookSmartAutocomplete.matiere')}
                        {loading && <ActivityIndicator size="small" color={modernColors.primary} style={{ marginLeft: 8 }} />}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.chipsRow}>
                            {matieresDisponibles.map(m => (
                                <TouchableOpacity
                                    key={m.matiere}
                                    style={[styles.matiereChip, selectedMatiere === m.matiere && styles.chipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        onMatiereChange(selectedMatiere === m.matiere ? '' : m.matiere);
                                    }}
                                >
                                    <Text style={[styles.chipText, selectedMatiere === m.matiere && styles.chipTextActive]}>
                                        {m.matiere}
                                    </Text>
                                    <View style={[styles.countBadge, selectedMatiere === m.matiere && styles.countBadgeActive]}>
                                        <Text style={[styles.countText, selectedMatiere === m.matiere && styles.countTextActive]}>
                                            {m.count}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>

                    {/* Breakdown troc/vente/don pour la matière sélectionnée */}
                    {selectedMatiere && (() => {
                        const mat = matieresDisponibles.find(m => m.matiere === selectedMatiere);
                        if (!mat) return null;
                        return (
                            <View style={styles.breakdownRow}>
                                {mat.troc > 0 && (
                                    <View style={styles.breakdownChip}>
                                        <SafeIcon name="repeat" size={10} color="#3b82f6" />
                                        <Text style={styles.breakdownText}>{mat.troc} {t('bookSmartAutocomplete.troc')}</Text>
                                    </View>
                                )}
                                {mat.vente > 0 && (
                                    <View style={styles.breakdownChip}>
                                        <SafeIcon name="shopping-cart" size={10} color="#f59e0b" />
                                        <Text style={styles.breakdownText}>{mat.vente} vente</Text>
                                    </View>
                                )}
                                {mat.don > 0 && (
                                    <View style={styles.breakdownChip}>
                                        <SafeIcon name="gift" size={10} color="#22c55e" />
                                        <Text style={styles.breakdownText}>{mat.don} {t('bookSmartAutocomplete.don')}</Text>
                                    </View>
                                )}
                            </View>
                        );
                    })()}
                </View>
            )}

            {/* Recherche texte libre */}
            {selectedClasse && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        <SafeIcon name="search" size={14} color={modernColors.primary} /> {t('bookSmartAutocomplete.rechercheParTitre')}
                    </Text>
                    <TextInput
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={handleSearchChange}
                        placeholder={t('bookSmartAutocomplete.rechercheParTitrePlaceholder')}
                        placeholderTextColor="#9ca3af"
                    />
                </View>
            )}

            {/* Top livres suggestions */}
            {topLivres.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        <SafeIcon name="sparkles" size={14} color="#f59e0b" /> {t('bookSmartAutocomplete.suggestions')}
                        {loading && <ActivityIndicator size="small" color={modernColors.primary} style={{ marginLeft: 8 }} />}
                    </Text>
                    {topLivres.map(livre => (
                        <TouchableOpacity
                            key={livre.id}
                            style={styles.suggestionCard}
                            onPress={() => {
                                hapticPress();
                                onBookSelect?.(livre);
                            }}
                        >
                            <View style={styles.suggestionLeft}>
                                {livre.est_au_programme && (
                                    <View style={styles.programmeBadge}>
                                        <Text style={styles.programmeBadgeText}>{t('bookSmartAutocomplete.programme')}</Text>
                                    </View>
                                )}
                                <Text style={styles.suggestionTitle} numberOfLines={1}>{livre.titre}</Text>
                                {livre.auteur && (
                                    <Text style={styles.suggestionAuthor} numberOfLines={1}>{livre.auteur}</Text>
                                )}
                                <Text style={styles.suggestionMeta}>
                                    {livre.classe_actuelle} • {livre.matiere} • {livre.etat_livre}
                                </Text>
                            </View>
                            <View style={styles.suggestionRight}>
                                {livre.mode_listing === 'don' ? (
                                    <Text style={[styles.suggestionPrice, { color: '#22c55e' }]}>{t('bookSmartAutocomplete.don')}</Text>
                                ) : livre.mode_listing === 'troc' ? (
                                    <Text style={[styles.suggestionPrice, { color: '#3b82f6' }]}>{t('bookSmartAutocomplete.troc')}</Text>
                                ) : livre.valeur_calculee ? (
                                    <Text style={styles.suggestionPrice}>{Math.round(Number(livre.valeur_calculee))} XAF</Text>
                                ) : null}
                                <SafeIcon name="chevron-right" size={16} color="#d1d5db" />
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {},

    section: { marginBottom: 20 },
    sectionTitle: {
        fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 10,
        flexDirection: 'row', alignItems: 'center',
    },

    niveauGroup: { marginBottom: 8 },
    niveauLabel: { fontSize: 11, fontWeight: '600', color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' },

    chipsRow: { flexDirection: 'row', gap: 8, paddingRight: 16 },
    chip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: '#d1d5db',
    },
    chipActive: { backgroundColor: '#059669', borderColor: '#059669' },
    chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
    chipTextActive: { color: '#fff' },

    matiereChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#f3f4f6', borderWidth: 1.5, borderColor: '#d1d5db',
    },
    countBadge: {
        backgroundColor: '#e5e7eb', borderRadius: 10, minWidth: 20, height: 18,
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
    },
    countBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
    countText: { fontSize: 10, fontWeight: '700', color: '#6b7280' },
    countTextActive: { color: '#fff' },

    classeBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
        backgroundColor: '#ecfdf5', padding: 10, borderRadius: 8,
    },
    classeBannerText: { fontSize: 13, color: '#065f46', fontWeight: '500' },

    breakdownRow: {
        flexDirection: 'row', gap: 8, marginTop: 8,
    },
    breakdownChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#f9fafb', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
        borderWidth: 1, borderColor: '#e5e7eb',
    },
    breakdownText: { fontSize: 11, color: '#6b7280', fontWeight: '500' },

    searchInput: {
        borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 12,
        fontSize: 15, color: '#1f2937', backgroundColor: '#f9fafb',
    },

    suggestionCard: {
        flexDirection: 'row', alignItems: 'center', padding: 12,
        backgroundColor: '#fff', borderRadius: 10, marginBottom: 6,
        borderWidth: 1, borderColor: '#e5e7eb',
    },
    suggestionLeft: { flex: 1 },
    suggestionRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

    programmeBadge: {
        alignSelf: 'flex-start', backgroundColor: '#dbeafe', paddingHorizontal: 8,
        paddingVertical: 2, borderRadius: 6, marginBottom: 4,
    },
    programmeBadgeText: { fontSize: 10, fontWeight: '700', color: '#1d4ed8' },

    suggestionTitle: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
    suggestionAuthor: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    suggestionMeta: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
    suggestionPrice: { fontSize: 13, fontWeight: '700', color: '#1f2937' },
});

export default BookSmartAutocomplete;
