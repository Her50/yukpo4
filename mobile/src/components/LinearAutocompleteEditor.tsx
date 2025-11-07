/**
 * LinearAutocompleteEditor - Version 3.0 (2025-11-04)
 * Affiche et édite le vecteur autocomplete généré par l'IA
 * ✅ NOUVEAU : Suggestions populaires depuis autocomplete_combinations
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { apiGet, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface LinearAutocompleteEditorProps {
    label: string;
    identifiantBase: string;
    sousCaracteristiques: Record<string, string[]>; // { marque: ["Nike"], pointure: ["38", "39", "40"] }
    separateur: string;
    value: string[]; // ["Nike,Air Max,Noir,40"] - Position 0 affichée
    onChange: (values: string[], updatedSousCaracs?: Record<string, string[]>) => void; // ✅ NOUVEAU: passer aussi sous-caracs
    required?: boolean;
    readonly?: boolean;
    placeholder?: string; // ✅ AJOUT: Support pour placeholder personnalisé
    allowCustomModality?: boolean; // ✅ AJOUT: Support pour modalités personnalisées
    filtrable?: boolean; // ✅ AJOUT: Support pour champs filtrables
}

interface ChipData {
    key: string;      // "marque"
    value: string;    // "Nike"
    index: number;    // Position dans vecteur
}

interface PopularProduct {
    product_vector: string[];
    product_labels: string[];
    usage_count: number;
    prix_moyen?: number;
    has_variant: boolean;
    variant_dimension?: string;
    is_trending: boolean;  // ✅ Tendance (actif dans les 7 derniers jours)
}

interface CombinationSuggestion {
    id: number;
    productVector: string[];
    productLabels: string[];
    usageCount: number;
    prix?: number;
    devise?: string;
    isAIPreferred?: boolean;
}

const normalizeCombinationResponse = (response: any): any[] => {
    if (!response) {
        return [];
    }

    const payload = response.data ?? response;

    if (Array.isArray(payload)) {
        return payload;
    }

    if (Array.isArray(payload?.data)) {
        return payload.data;
    }

    if (Array.isArray(payload?.results)) {
        return payload.results;
    }

    if (Array.isArray(payload?.items)) {
        return payload.items;
    }

    if (Array.isArray(payload?.data?.data)) {
        return payload.data.data;
    }

    return [];
};

// ✅ 2025-11-06: Normaliser la réponse backend pour éviter les crashes (.map sur undefined)
const normalizePopularProductsResponse = (response: any): PopularProduct[] => {
    if (!response) {
        return [];
    }

    // Cas 1 : L'API mobile renvoie directement un tableau (ApiResponse<T[]>)
    if (Array.isArray(response)) {
        return response as PopularProduct[];
    }

    // Cas 2 : ApiResponse<{ data: PopularProduct[] }>
    if (Array.isArray(response.data)) {
        return response.data as PopularProduct[];
    }

    // Cas 3 : Backend Axum renvoie { success: true, data: [...] }
    if (response.data && Array.isArray(response.data.data)) {
        return response.data.data as PopularProduct[];
    }

    // Cas 4 : Backend renvoie { products: [...] }
    if (Array.isArray(response.products)) {
        return response.products as PopularProduct[];
    }

    // Cas 5 : ApiResponse enveloppée (ApiResponse<{ products: [...] }>)
    if (response.data && Array.isArray(response.data.products)) {
        return response.data.products as PopularProduct[];
    }

    console.warn('[LinearAutocompleteEditor] ⚠️ Impossible de normaliser la réponse popular products:', response);
    return [];
};

export const LinearAutocompleteEditor: React.FC<LinearAutocompleteEditorProps> = ({
    label,
    identifiantBase,
    sousCaracteristiques,
    separateur,
    value,
    onChange,
    required = false,
    readonly = false,
    placeholder,
    allowCustomModality = true,
    filtrable = true,
}) => {
    // ✅ PROTECTION CRITIQUE 2025-11-06: Valider TOUTES les props critiques au début
    try {
        if (!onChange || typeof onChange !== 'function') {
            console.error('[LinearAutocompleteEditor] ❌ onChange n\'est pas une fonction - rendu impossible');
            return (
                <View style={styles.container}>
                    <Text style={{ color: 'red' }}>Erreur: onChange manquant</Text>
                </View>
            );
        }

        if (!separateur || typeof separateur !== 'string') {
            console.error('[LinearAutocompleteEditor] ❌ separateur invalide:', separateur);
            return (
                <View style={styles.container}>
                    <Text style={{ color: 'red' }}>Erreur: separateur invalide</Text>
                </View>
            );
        }

        if (!sousCaracteristiques || typeof sousCaracteristiques !== 'object') {
            console.error('[LinearAutocompleteEditor] ❌ sousCaracteristiques invalide:', sousCaracteristiques);
            return (
                <View style={styles.container}>
                    <Text style={{ color: 'red' }}>Erreur: sousCaracteristiques invalide</Text>
                </View>
            );
        }
    } catch (error) {
        console.error('[LinearAutocompleteEditor] ❌ Erreur validation props:', error);
        return (
            <View style={styles.container}>
                <Text style={{ color: 'red' }}>Erreur de validation</Text>
            </View>
        );
    }

    // ✅ PROTECTION ULTIME 2025-11-06: S'assurer que displayValue est TOUJOURS une string
    const displayValue = (() => {
        if (!value || !Array.isArray(value) || value.length === 0) {
            return '';
        }

        const firstValue = value[0];

        // ✅ CRITIQUE: Vérifier que firstValue est une STRING
        if (typeof firstValue === 'string') {
            return firstValue;
        } else if (firstValue && typeof firstValue === 'object') {
            // Si c'est un objet, essayer de le stringifier
            console.warn('[LinearAutocompleteEditor] ⚠️ value[0] est un objet, conversion en string');
            return JSON.stringify(firstValue);
        } else if (firstValue !== null && firstValue !== undefined) {
            // Si c'est un nombre ou autre, le convertir
            console.warn('[LinearAutocompleteEditor] ⚠️ value[0] n\'est pas une string, conversion');
            return String(firstValue);
        }

        return '';
    })();

    const [showEditModal, setShowEditModal] = useState(false);
    const [editingChipIndex, setEditingChipIndex] = useState<number | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newCharKey, setNewCharKey] = useState('');
    const [newCharValue, setNewCharValue] = useState('');

    // ✅ NOUVEAU 2025-11-04 : Recherche progressive
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<PopularProduct[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [combinationSuggestions, setCombinationSuggestions] = useState<CombinationSuggestion[]>([]);
    const [loadingCombinationSuggestions, setLoadingCombinationSuggestions] = useState(false);
    const [combinationError, setCombinationError] = useState<string | null>(null);

    const iaCombinaisons = useMemo(() => {
        if (!value || !Array.isArray(value)) {
            return [];
        }

        const combos = value
            .filter((combo) => typeof combo === 'string' && combo.trim().length > 0)
            .map((combo) => combo.trim());

        return Array.from(new Set(combos));
    }, [value]);

    // Décomposer le vecteur en chips
    const parseVectorToChips = (vectorStr: string): ChipData[] => {
        // ✅ PROTECTION ULTIME: Vérifier que vectorStr est une STRING et separateur est défini
        if (!vectorStr || typeof vectorStr !== 'string') {
            console.warn('[LinearAutocompleteEditor] ⚠️ vectorStr n\'est pas une string:', typeof vectorStr);
            return [];
        }

        if (!separateur || typeof separateur !== 'string') {
            console.warn('[LinearAutocompleteEditor] ⚠️ separateur n\'est pas une string:', typeof separateur);
            return [];
        }

        const parts = vectorStr.split(separateur).map(p => p.trim()).filter(p => p);
        const subCharKeys = Object.keys(sousCaracteristiques || {});

        return parts.map((value, index) => ({
            key: subCharKeys[index] || `dimension_${index}`,
            value: value,
            index: index,
        }));
    };

    const chips = displayValue ? parseVectorToChips(displayValue) : [];

    // ✅ CORRECTION FINALE 2025-11-06 : Recherche progressive SANS useEffect
    // Le useEffect avec searchSuggestions cause des problèmes de closure
    // On va gérer la recherche directement dans onChangeText du TextInput

    // Sélectionner une suggestion
    const selectSuggestion = (product: PopularProduct) => {
        // ✅ PROTECTION: Vérifier que le produit a les données nécessaires
        if (!product?.product_vector || !Array.isArray(product.product_vector)) {
            console.warn('[LinearAutocompleteEditor] ⚠️ Produit sans product_vector valide');
            return;
        }

        const newVector = product.product_vector.join(separateur || ',');

        // Mettre à jour sousCaracteristiques avec les labels du produit sélectionné
        const updatedSousCaracs: Record<string, string[]> = {};
        const labels = product.product_labels || [];
        labels.forEach((label, index) => {
            if (!updatedSousCaracs[label]) {
                updatedSousCaracs[label] = [];
            }
            updatedSousCaracs[label].push(product.product_vector[index]);
        });

        onChange([newVector], updatedSousCaracs);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    const applyCombinationSuggestion = (suggestion: CombinationSuggestion) => {
        const vector = suggestion.productVector || [];
        if (vector.length === 0) {
            return;
        }

        const joined = vector.join(separateur || ',');
        const updatedSousCaracs: Record<string, string[]> = { ...(sousCaracteristiques || {}) };

        (suggestion.productLabels || []).forEach((label, index) => {
            const value = vector[index];
            if (!label || !value) {
                return;
            }
            if (!updatedSousCaracs[label]) {
                updatedSousCaracs[label] = [];
            }
            if (!updatedSousCaracs[label].includes(value)) {
                updatedSousCaracs[label].push(value);
            }
        });

        onChange([joined], updatedSousCaracs);
        setSearchQuery('');
        setShowSuggestions(false);
    };

    const formatPriceDisplay = (price?: number, devise?: string) => {
        if (price === undefined) {
            return null;
        }

        const formatter = new Intl.NumberFormat('fr-FR');
        return `${formatter.format(Math.round(price))} ${devise || 'XAF'}`;
    };

    useEffect(() => {
        if (searchQuery.trim().length > 0) {
            return;
        }

        if (combinationSuggestions.length > 0 || loadingCombinationSuggestions) {
            return;
        }

        if (iaCombinaisons.length === 0) {
            return;
        }

        const firstCombo = iaCombinaisons[0];
        if (!firstCombo || typeof firstCombo !== 'string') {
            return;
        }

        const parts = firstCombo.split(separateur || ',').map((part) => part.trim()).filter(Boolean);
        const seedQuery = parts[0];

        if (!seedQuery || seedQuery.length < 2) {
            return;
        }

        let cancelled = false;

        const loadInitialCombinations = async () => {
            try {
                setLoadingCombinationSuggestions(true);
                const response = await apiPost('/api/combinations/search', {
                    query: seedQuery,
                    limit: 8,
                });

                if (!cancelled && response?.success) {
                    const combos = normalizeCombinationResponse(response);

                    const iaKeys = new Set(iaCombinaisons.map((combo) => combo.toLowerCase()));
                    const normalizedCombos: CombinationSuggestion[] = combos
                        .map((item: any) => {
                            const combo = item?.combination ?? item;
                            if (!combo || !Array.isArray(combo.product_vector)) {
                                return null;
                            }

                            const rawVector = combo.product_vector.filter((part: any) => typeof part === 'string').map((part: string) => part.trim());
                            if (rawVector.length === 0) {
                                return null;
                            }

                            const joined = rawVector.join(separateur || ',');
                            if (!joined || iaKeys.has(joined.toLowerCase())) {
                                return null;
                            }

                            let prix: number | undefined;
                            if (combo.prix !== null && combo.prix !== undefined) {
                                const parsed = typeof combo.prix === 'number'
                                    ? combo.prix
                                    : parseFloat(combo.prix.toString());
                                prix = isNaN(parsed) ? undefined : parsed;
                            }

                            return {
                                id: combo.id,
                                productVector: rawVector,
                                productLabels: Array.isArray(combo.product_labels) ? combo.product_labels : [],
                                usageCount: typeof combo.usage_count === 'number' ? combo.usage_count : 0,
                                prix,
                                devise: combo.devise || undefined,
                                isAIPreferred: !!combo.is_ai_preferred,
                            } as CombinationSuggestion;
                        })
                        .filter((item: CombinationSuggestion | null): item is CombinationSuggestion => item !== null);

                    setCombinationSuggestions(normalizedCombos);
                    setCombinationError(null);
                }
            } catch (error) {
                if (!cancelled) {
                    console.warn('[LinearAutocompleteEditor] ⚠️ Impossible de précharger les combinaisons:', error);
                }
            } finally {
                if (!cancelled) {
                    setLoadingCombinationSuggestions(false);
                }
            }
        };

        loadInitialCombinations();

        return () => {
            cancelled = true;
        };
    }, [iaCombinaisons, separateur, searchQuery, combinationSuggestions.length, loadingCombinationSuggestions]);

    // Modifier une caractéristique
    const handleModifyChip = (chipIndex: number) => {
        setEditingChipIndex(chipIndex);
        setShowEditModal(true);
    };

    // Sauvegarder modification
    const saveChipModification = (newValue: string) => {
        if (!newValue.trim() || editingChipIndex === null) return;

        // ✅ PROTECTION ULTIME: Vérifier que displayValue EST UNE STRING
        if (!displayValue || typeof displayValue !== 'string') {
            console.warn('[LinearAutocompleteEditor] ⚠️ displayValue n\'est pas une string dans saveChipModification:', typeof displayValue);
            setShowEditModal(false);
            setEditingChipIndex(null);
            return;
        }

        if (!separateur || typeof separateur !== 'string') {
            console.warn('[LinearAutocompleteEditor] ⚠️ separateur n\'est pas une string dans saveChipModification');
            setShowEditModal(false);
            setEditingChipIndex(null);
            return;
        }

        const parts = displayValue.split(separateur).map(p => p.trim());
        parts[editingChipIndex] = newValue.trim();

        const newVector = parts.join(separateur);
        onChange([newVector]);

        setShowEditModal(false);
        setEditingChipIndex(null);
    };

    // Supprimer une caractéristique
    const handleDeleteChip = (chipIndex: number) => {
        Alert.alert(
            'Supprimer caractéristique',
            `Êtes-vous sûr de vouloir supprimer "${chips[chipIndex].value}" ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => {
                        // ✅ PROTECTION ULTIME: Vérifier que displayValue EST UNE STRING
                        if (!displayValue || typeof displayValue !== 'string') {
                            console.warn('[LinearAutocompleteEditor] ⚠️ displayValue n\'est pas une string dans handleDeleteChip:', typeof displayValue);
                            return;
                        }

                        if (!separateur || typeof separateur !== 'string') {
                            console.warn('[LinearAutocompleteEditor] ⚠️ separateur n\'est pas une string dans handleDeleteChip');
                            return;
                        }

                        const parts = displayValue.split(separateur).map(p => p.trim());
                        parts.splice(chipIndex, 1);

                        const newVector = parts.join(separateur);
                        onChange([newVector]);
                    }
                }
            ]
        );
    };

    // Ajouter nouvelle caractéristique
    const handleAddCharacteristic = () => {
        if (!newCharValue.trim()) {
            Alert.alert('Erreur', 'Veuillez remplir une valeur');
            return;
        }

        // ✅ PROTECTION ULTIME: Vérifier que separateur et displayValue sont des strings
        const safeSeparateur = (separateur && typeof separateur === 'string') ? separateur : ',';
        const parts = (displayValue && typeof displayValue === 'string')
            ? displayValue.split(safeSeparateur).map(p => p.trim())
            : [];
        parts.push(newCharValue.trim());

        const newVector = parts.join(safeSeparateur);

        // ✅ CORRECTION 2025-11-04: Mettre à jour sousCaracteristiques avec le nouveau label
        const updatedSousCaracs = { ...(sousCaracteristiques || {}) };
        if (newCharKey.trim()) {
            // Ajouter le label avec la valeur
            if (!updatedSousCaracs[newCharKey.trim()]) {
                updatedSousCaracs[newCharKey.trim()] = [];
            }
            if (!updatedSousCaracs[newCharKey.trim()].includes(newCharValue.trim())) {
                updatedSousCaracs[newCharKey.trim()].push(newCharValue.trim());
            }
        }

        // Passer le vecteur ET les sous-caractéristiques mises à jour
        onChange([newVector], updatedSousCaracs);

        setShowAddModal(false);
        setNewCharKey('');
        setNewCharValue('');
    };

    if (readonly) {
        return (
            <View style={styles.container}>
                <Text style={styles.label}>{label}</Text>
                <View style={styles.chipsContainer}>
                    {(chips || []).map((chip, index) => (
                        <View key={index} style={styles.chipReadonly}>
                            <Text style={styles.chipKey}>{chip.key}:</Text>
                            <Text style={styles.chipValue}>{chip.value}</Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    // ✅ NOUVEAU 2025-11-06: Placeholder dynamique COMPLET depuis la valeur IA (value[0])
    const generatePlaceholder = (): string => {
        // ✅ PRIORITÉ 1: Afficher la PREMIÈRE combinaison générée par l'IA (value[0])
        if (value && value.length > 0 && value[0] && separateur) {
            const firstValue = value[0];
            if (typeof firstValue === 'string' && typeof separateur === 'string') {
                // Afficher TOUTES les valeurs de la première combinaison (pas juste 4)
                const allValues = firstValue.split(separateur).map(v => v.trim()).filter(v => v);
                if (allValues.length > 6) {
                    // Si plus de 6 valeurs, afficher 5 + "..." 
                    return `🤖 Ex: ${allValues.slice(0, 5).join(' • ')}... (+${allValues.length - 5})`;
                } else if (allValues.length > 0) {
                    // Sinon afficher toutes
                    return `🤖 Ex: ${allValues.join(' • ')}`;
                }
            } else {
                console.warn('[LinearAutocompleteEditor] ⚠️ value[0] ou separateur pas string dans generatePlaceholder');
            }
        }

        // ✅ PRIORITÉ 2: Utiliser les autres combinaisons IA disponibles
        if ((!displayValue || displayValue.length === 0) && iaCombinaisons.length > 0) {
            const combo = iaCombinaisons[0];
            if (typeof combo === 'string') {
                const parts = combo.split(separateur || ',').map(v => v.trim()).filter(Boolean);
                if (parts.length > 0) {
                    return `✨ ${parts.slice(0, 6).join(' • ')}`;
                }
            }
        }

        // ✅ PRIORITÉ 3: Exemple générique basé sur les sous-caractéristiques IA (première valeur de chaque dimension)
        if (sousCaracteristiques && Object.keys(sousCaracteristiques).length > 0) {
            const exampleParts: string[] = [];

            Object.keys(sousCaracteristiques).slice(0, 5).forEach((key) => {
                const values = sousCaracteristiques[key];
                if (Array.isArray(values) && values.length > 0) {
                    exampleParts.push(values[0]);
                }
            });

            if (exampleParts.length > 0) {
                return `💡 Ex: ${exampleParts.join(' • ')}...`;
            }
        }

        // ✅ PRIORITÉ 4: Fallback générique
        return '🔍 Tapez pour rechercher ou voir suggestions IA...';
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.label}>
                    {label}
                    {required && <Text style={styles.required}> *</Text>}
                </Text>
                <Text style={styles.helperText}>
                    🤖 Généré par l'IA - Modifiable
                </Text>
            </View>

            {/* ✅ NOUVEAU : Champ de recherche */}
            <View style={styles.searchContainer}>
                <SafeIcon name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder={generatePlaceholder()}
                    placeholderTextColor="#9CA3AF"
                    value={searchQuery}
                    onChangeText={async (text) => {
                        setSearchQuery(text);

                        const trimmed = text.trim();

                        if (trimmed.length >= 2) {
                            setLoadingSuggestions(true);
                            setLoadingCombinationSuggestions(true);
                            setCombinationError(null);
                            setShowSuggestions(true);

                            try {
                                const [popularResult, combinationsResult] = await Promise.allSettled([
                                    apiGet(`/api/products/popular?search=${encodeURIComponent(trimmed)}&limit=8`),
                                    apiPost('/api/combinations/search', {
                                        query: trimmed,
                                        limit: 8,
                                    })
                                ]);

                                if (popularResult.status === 'fulfilled' && popularResult.value?.success) {
                                    const normalized = normalizePopularProductsResponse(
                                        popularResult.value?.data ?? popularResult.value
                                    );
                                    setSuggestions(normalized);
                                } else {
                                    setSuggestions([]);
                                }

                                if (combinationsResult.status === 'fulfilled' && combinationsResult.value?.success) {
                                    const combos = normalizeCombinationResponse(
                                        combinationsResult.value?.data ?? combinationsResult.value
                                    );

                                    const iaKeys = new Set(iaCombinaisons.map((combo) => combo.toLowerCase()));
                                    const normalizedCombos: CombinationSuggestion[] = combos
                                        .map((item: any) => {
                                            const combo = item?.combination ?? item;
                                            if (!combo || !Array.isArray(combo.product_vector)) {
                                                return null;
                                            }

                                            const rawVector = combo.product_vector.filter((part: any) => typeof part === 'string').map((part: string) => part.trim());
                                            if (rawVector.length === 0) {
                                                return null;
                                            }

                                            const joined = rawVector.join(separateur || ',');
                                            if (!joined || iaKeys.has(joined.toLowerCase())) {
                                                return null;
                                            }

                                            let prix: number | undefined;
                                            if (combo.prix !== null && combo.prix !== undefined) {
                                                const parsed = typeof combo.prix === 'number'
                                                    ? combo.prix
                                                    : parseFloat(combo.prix.toString());
                                                prix = isNaN(parsed) ? undefined : parsed;
                                            }

                                            const devise = combo.devise || undefined;

                                            return {
                                                id: combo.id,
                                                productVector: rawVector,
                                                productLabels: Array.isArray(combo.product_labels) ? combo.product_labels : [],
                                                usageCount: typeof combo.usage_count === 'number' ? combo.usage_count : 0,
                                                prix,
                                                devise,
                                                isAIPreferred: !!combo.is_ai_preferred,
                                            } as CombinationSuggestion;
                                        })
                                        .filter((item: CombinationSuggestion | null): item is CombinationSuggestion => item !== null);

                                    setCombinationSuggestions(normalizedCombos);
                                    setCombinationError(null);
                                } else {
                                    setCombinationSuggestions([]);
                                }
                            } catch (error) {
                                console.error('[LinearAutocompleteEditor] ❌ Erreur recherche:', error);
                                setSuggestions([]);
                                setCombinationSuggestions([]);
                                setCombinationError('Impossible de récupérer les combinaisons des prestataires.');
                            } finally {
                                setLoadingSuggestions(false);
                                setLoadingCombinationSuggestions(false);
                            }
                        } else {
                            setSuggestions([]);
                            setCombinationSuggestions([]);
                            setCombinationError(null);
                            setLoadingSuggestions(false);
                            setLoadingCombinationSuggestions(false);
                            setShowSuggestions(false);
                        }
                    }}
                    onFocus={() => setShowSuggestions(searchQuery.trim().length >= 2)}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => { setSearchQuery(''); setShowSuggestions(false); setSuggestions([]); }}>
                        <SafeIcon name="x" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                )}
            </View>

            {/* ✅ Suggestions progressives */}
            {showSuggestions && (
                <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>📦 Suggestions populaires</Text>
                    {loadingSuggestions && <ActivityIndicator size="small" color={modernColors.primary} style={{ marginVertical: 12 }} />}

                    {!loadingSuggestions && suggestions.length === 0 && searchQuery.trim().length >= 2 && (
                        <View style={styles.noSuggestionsContainer}>
                            <SafeIcon name="info" size={20} color="#9CA3AF" />
                            <Text style={styles.noSuggestionsText}>
                                Aucun produit populaire trouvé pour "{searchQuery}"
                            </Text>
                            <Text style={styles.noSuggestionsHint}>
                                💡 Essayez avec d'autres mots-clés ou créez votre propre combinaison
                            </Text>
                        </View>
                    )}

                    {(suggestions || []).map((product, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.suggestionItem}
                            onPress={() => selectSuggestion(product)}
                        >
                            <View style={styles.suggestionContent}>
                                <Text style={styles.suggestionVector} numberOfLines={1}>
                                    {(product?.product_vector || []).join(' • ')}
                                </Text>
                                <View style={styles.suggestionMeta}>
                                    {product.is_trending && (
                                        <View style={styles.trendingBadge}>
                                            <Text style={styles.trendingText}>📈 TENDANCE</Text>
                                        </View>
                                    )}
                                    <Text style={styles.suggestionCount}>
                                        👥 {product.usage_count} vendeur{product.usage_count > 1 ? 's' : ''}
                                    </Text>
                                    {product.prix_moyen && (
                                        <Text style={styles.suggestionPrice}>
                                            💰 {product.prix_moyen.toFixed(0)} XAF
                                        </Text>
                                    )}
                                </View>
                            </View>
                            <SafeIcon name="chevron-right" size={16} color="#9CA3AF" />
                        </TouchableOpacity>
                    ))}

                    {loadingCombinationSuggestions && (
                        <ActivityIndicator
                            size="small"
                            color={modernColors.primary}
                            style={{ marginVertical: 12 }}
                        />
                    )}

                    {combinationError && (
                        <Text style={styles.combinationError}>{combinationError}</Text>
                    )}

                    {!loadingCombinationSuggestions && combinationSuggestions.length > 0 && (
                        <View style={styles.combinationSuggestionsContainer}>
                            <Text style={styles.combinationSuggestionsTitle}>🔥 Combinaisons des prestataires</Text>
                            {combinationSuggestions.map((combo) => {
                                const parts = combo.productVector || [];
                                const priceDisplay = formatPriceDisplay(combo.prix, combo.devise);

                                return (
                                    <TouchableOpacity
                                        key={`combo-${combo.id}`}
                                        style={styles.combinationCard}
                                        onPress={() => applyCombinationSuggestion(combo)}
                                    >
                                        <View style={styles.combinationCardHeader}>
                                            <SafeIcon
                                                name={combo.isAIPreferred ? 'sparkles' : 'flame'}
                                                size={16}
                                                color={combo.isAIPreferred ? modernColors.primary : '#F97316'}
                                            />
                                            <Text style={styles.combinationCardTitle}>
                                                {combo.isAIPreferred ? 'Version IA' : 'Variante populaire'}
                                            </Text>
                                        </View>
                                        <View style={styles.combinationCardChips}>
                                            {parts.map((part, idx) => (
                                                <View key={`${combo.id}-${idx}`} style={styles.combinationCardChip}>
                                                    <Text style={styles.combinationCardChipText}>{part}</Text>
                                                </View>
                                            ))}
                                        </View>
                                        <View style={styles.combinationMeta}>
                                            <Text style={styles.combinationUsage}>
                                                👥 {combo.usageCount} prestataire{combo.usageCount > 1 ? 's' : ''}
                                            </Text>
                                            {priceDisplay && (
                                                <Text style={styles.combinationPrice}>💰 {priceDisplay}</Text>
                                            )}
                                        </View>
                                        <Text style={styles.combinationApply}>Appuyer pour utiliser cette combinaison</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>
            )}

            {/* ✅ Combinaisons IA initiales */}
            {iaCombinaisons.length > 0 && (
                <View style={styles.iaCombosContainer}>
                    <Text style={styles.iaCombosTitle}>✨ Combinaisons proposées par l'IA</Text>
                    {iaCombinaisons.map((combo, index) => {
                        const parts = (combo || '').split(separateur || ',').map(part => part.trim()).filter(Boolean);

                        return (
                            <TouchableOpacity
                                key={`${combo}-${index}`}
                                style={styles.iaComboCard}
                                onPress={() => {
                                    onChange([combo], sousCaracteristiques);
                                    setSearchQuery('');
                                    setShowSuggestions(false);
                                }}
                            >
                                <View style={styles.iaComboHeader}>
                                    <SafeIcon name="sparkles" size={16} color={modernColors.primary} />
                                    <Text style={styles.iaComboLabel}>Version {index + 1}</Text>
                                </View>
                                <View style={styles.iaComboChips}>
                                    {parts.map((part, chipIdx) => (
                                        <View key={`${part}-${chipIdx}`} style={styles.iaComboChip}>
                                            <Text style={styles.iaComboChipText}>{part}</Text>
                                        </View>
                                    ))}
                                </View>
                                <Text style={styles.iaComboApply}>Appuyer pour utiliser cette combinaison</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            {/* Vecteur affiché en chips */}
            {chips.length > 0 ? (
                <View style={styles.vectorContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipsScroll}
                    >
                        {(chips || []).map((chip, index) => (
                            <View key={index} style={styles.chip}>
                                <View style={styles.chipContent}>
                                    <Text style={styles.chipKey}>{chip.key}</Text>
                                    <Text style={styles.chipValue}>{chip.value}</Text>
                                </View>
                                <View style={styles.chipActions}>
                                    <TouchableOpacity
                                        style={styles.chipButton}
                                        onPress={() => handleModifyChip(index)}
                                    >
                                        <SafeIcon name="edit-2" size={14} color={modernColors.primary} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.chipButton}
                                        onPress={() => handleDeleteChip(index)}
                                    >
                                        <SafeIcon name="trash-2" size={14} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </ScrollView>

                    {/* ✅ NOUVEAU : Bouton édition quand vecteur sélectionné */}
                    <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => setShowAddModal(true)}
                    >
                        <SafeIcon name="edit-3" size={16} color={modernColors.primary} />
                        <Text style={styles.editButtonText}>Éditer</Text>
                    </TouchableOpacity>
                </View>
            ) : null}


            {/* Modal Édition */}
            <Modal
                visible={showEditModal && editingChipIndex !== null}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowEditModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Modifier {editingChipIndex !== null ? chips[editingChipIndex]?.key : ''}
                            </Text>
                            <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        {editingChipIndex !== null && (
                            <View style={styles.modalBody}>
                                <Text style={styles.modalLabel}>Valeur actuelle</Text>
                                <Text style={styles.currentValue}>{chips[editingChipIndex]?.value}</Text>

                                {/* Options disponibles si définies par l'IA */}
                                {sousCaracteristiques[chips[editingChipIndex]?.key] && (
                                    <View style={styles.optionsSection}>
                                        <Text style={styles.optionsTitle}>Options suggérées :</Text>
                                        <ScrollView style={styles.optionsList}>
                                            {(Array.isArray(sousCaracteristiques[chips[editingChipIndex]?.key])
                                                ? sousCaracteristiques[chips[editingChipIndex]?.key]
                                                : []
                                            ).map((option, idx) => (
                                                <TouchableOpacity
                                                    key={idx}
                                                    style={[
                                                        styles.optionItem,
                                                        option === chips[editingChipIndex]?.value && styles.optionItemSelected
                                                    ]}
                                                    onPress={() => saveChipModification(option)}
                                                >
                                                    <Text style={[
                                                        styles.optionText,
                                                        option === chips[editingChipIndex]?.value && styles.optionTextSelected
                                                    ]}>
                                                        {option}
                                                    </Text>
                                                    {option === chips[editingChipIndex]?.value && (
                                                        <SafeIcon name="check" size={16} color={modernColors.primary} />
                                                    )}
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => setShowEditModal(false)}
                                >
                                    <Text style={styles.cancelButtonText}>Annuler</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Modal Ajout */}
            <Modal
                visible={showAddModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowAddModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Ajouter une caractéristique</Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <SafeIcon name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalBody}>
                            <Text style={styles.modalLabel}>Type de caractéristique</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Ex: matière, couleur, taille..."
                                value={newCharKey}
                                onChangeText={setNewCharKey}
                            />

                            <Text style={styles.modalLabel}>Valeur</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Ex: Cuir, Rouge, XL..."
                                value={newCharValue}
                                onChangeText={setNewCharValue}
                            />

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => setShowAddModal(false)}
                                >
                                    <Text style={styles.cancelButtonText}>Annuler</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.saveButton}
                                    onPress={handleAddCharacteristic}
                                >
                                    <SafeIcon name="plus" size={16} color="#FFF" />
                                    <Text style={styles.saveButtonText}>Ajouter</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 12,
    },
    header: {
        gap: 4,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1F2937',
    },
    required: {
        color: '#EF4444',
    },
    helperText: {
        fontSize: 13,
        color: '#6B7280',
    },
    vectorContainer: {
        gap: 12,
    },
    chipsScroll: {
        gap: 8,
        paddingVertical: 8,
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    chipContent: {
        gap: 2,
    },
    chipKey: {
        fontSize: 11,
        color: '#6B7280',
        fontWeight: '500',
    },
    chipValue: {
        fontSize: 14,
        color: '#1F2937',
        fontWeight: '600',
    },
    chipActions: {
        flexDirection: 'row',
        gap: 8,
        marginLeft: 8,
        paddingLeft: 8,
        borderLeftWidth: 1,
        borderLeftColor: '#E5E7EB',
    },
    chipButton: {
        padding: 4,
    },
    chipReadonly: {
        flexDirection: 'row',
        gap: 4,
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    addChipButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderWidth: 2,
        borderColor: modernColors.primary,
        borderRadius: 12,
        borderStyle: 'dashed',
    },
    addChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 32,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    addFirstButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: modernColors.primary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
    },
    addFirstButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
    },
    modalBody: {
        padding: 20,
        gap: 16,
    },
    modalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 4,
    },
    currentValue: {
        fontSize: 16,
        color: '#6B7280',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    optionsSection: {
        gap: 8,
    },
    optionsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    optionsList: {
        maxHeight: 200,
    },
    optionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        marginBottom: 8,
    },
    optionItemSelected: {
        backgroundColor: modernColors.primaryLight || '#EEF2FF',
        borderWidth: 2,
        borderColor: modernColors.primary,
    },
    optionText: {
        fontSize: 15,
        color: '#1F2937',
    },
    optionTextSelected: {
        fontWeight: '600',
        color: modernColors.primary,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        color: '#1F2937',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#6B7280',
    },
    saveButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
    },
    saveButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFF',
    },
    // ✅ NOUVEAU : Styles produits populaires
    popularButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.primary,
        marginTop: 12,
    },
    popularButtonEmoji: {
        fontSize: 18,
    },
    popularButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
        flex: 1,
    },
    popularCountBadge: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        minWidth: 24,
        alignItems: 'center',
    },
    popularCountText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFF',
    },
    popularSection: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        marginTop: 8,
        maxHeight: 400,
    },
    loadingPopularContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 20,
    },
    loadingPopularText: {
        fontSize: 14,
        color: '#6B7280',
    },
    popularSectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 12,
    },
    popularList: {
        maxHeight: 350,
    },
    popularCard: {
        backgroundColor: '#FFF',
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        position: 'relative',
    },
    popularCardTrending: {
        borderColor: '#EF4444',
        borderWidth: 2,
        backgroundColor: '#FEF2F2',
    },
    trendingBadgeSmall: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#EF4444',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        zIndex: 10,
    },
    trendingBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFF',
    },
    popularCardContent: {
        gap: 10,
        marginBottom: 10,
    },
    popularChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    popularChip: {
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    popularChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    popularStats: {
        gap: 4,
    },
    popularUsage: {
        fontSize: 13,
        fontWeight: '700',
        color: '#EF4444',
    },
    popularPriceText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#059669',
    },
    popularVariantText: {
        fontSize: 12,
        color: '#6B7280',
    },
    popularSelectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: modernColors.primary,
        paddingVertical: 8,
        borderRadius: 8,
    },
    popularSelectText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFF',
    },
    noPopularContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    noPopularText: {
        fontSize: 14,
        color: '#9CA3AF',
    },
    // ✅ NOUVEAU 2025-11-04: Styles pour suggestions autocomplete
    suggestionsContainer: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 12,
        gap: 8,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    suggestionsTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 4,
    },
    iaCombosContainer: {
        marginTop: 12,
        gap: 12,
    },
    iaCombosTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    iaComboCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    iaComboHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    iaComboLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
    },
    iaComboChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    iaComboChip: {
        backgroundColor: '#EEF2FF',
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    iaComboChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    iaComboApply: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    suggestionContent: {
        flex: 1,
        gap: 6,
    },
    suggestionVector: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
    },
    suggestionMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    trendingBadge: {
        backgroundColor: '#EF4444',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    trendingText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFF',
    },
    suggestionCount: {
        fontSize: 11,
        color: '#6B7280',
    },
    suggestionPrice: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
    },
    noSuggestionsContainer: {
        alignItems: 'center',
        paddingVertical: 20,
        gap: 8,
    },
    noSuggestionsText: {
        fontSize: 13,
        color: '#6B7280',
        textAlign: 'center',
    },
    noSuggestionsHint: {
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    searchIcon: {
        marginRight: 4,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#1F2937',
        paddingVertical: 4,
    },
    combinationError: {
        fontSize: 13,
        color: '#EF4444',
        textAlign: 'center',
        marginTop: 12,
    },
    combinationSuggestionsContainer: {
        marginTop: 12,
        gap: 12,
    },
    combinationSuggestionsTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 4,
    },
    combinationCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    combinationCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    combinationCardTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1F2937',
    },
    combinationCardChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    combinationCardChip: {
        backgroundColor: '#EEF2FF',
        borderRadius: 16,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    combinationCardChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
    },
    combinationMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    combinationUsage: {
        fontSize: 11,
        color: '#6B7280',
    },
    combinationPrice: {
        fontSize: 11,
        fontWeight: '600',
        color: '#059669',
    },
    combinationApply: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
});

export default LinearAutocompleteEditor;
