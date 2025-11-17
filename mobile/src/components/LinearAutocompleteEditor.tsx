/**
 * LinearAutocompleteEditor - Version 3.0 (2025-11-04)
 * Affiche et édite le vecteur autocomplete généré par l'IA
 * ✅ NOUVEAU : Suggestions populaires depuis autocomplete_combinations
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    contextValues?: string[]; // ✅ NOUVEAU 2025-11-08 : Textes contextuels (description, titre, etc.)
    categoryValue?: string; // ✅ NOUVEAU 2025-11-08 : Catégorie principale saisie par le prestataire
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
    occurrences?: number;
}

type SuggestionSource = 'popular' | 'combination' | 'ia';

interface SuggestionCandidate {
    key: string;
    source: SuggestionSource;
    rows: Array<{ label: string; value: string }>;
    score: number;
    title: string;
    subtitle?: string;
    sellerCount?: number;
    priceDisplay?: string | null;
    occurrences?: number;
    isTrending?: boolean;
    isPreferred?: boolean;
    product?: PopularProduct;
    combination?: CombinationSuggestion;
    iaValue?: string;
}

const normalizeSearchText = (input: string): string => {
    if (typeof input !== 'string') {
        return '';
    }

    try {
        return input
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .toLowerCase();
    } catch (error) {
        // Fallback si normalize n'est pas supporté
        return input.toLowerCase();
    }
};

const buildSearchTokens = (input: string): string[] => {
    if (!input || typeof input !== 'string') {
        return [];
    }

    return input
        .split(/[\s,;\-|/_]+/)
        .map(token => normalizeSearchText(token.trim()))
        .filter(Boolean);
};

const vectorMatchesTokens = (
    vector: string[] = [],
    tokens: string[] = [],
    labels: string[] = [],
): boolean => {
    if (tokens.length === 0) {
        return true;
    }

    const normalizedVector = vector
        .filter((item) => typeof item === 'string')
        .map((item) => normalizeSearchText(item));
    const normalizedLabels = labels
        .filter((item) => typeof item === 'string')
        .map((item) => normalizeSearchText(item));

    return tokens.every((token) =>
        normalizedVector.some((value) => value.includes(token)) ||
        normalizedLabels.some((label) => label.includes(token))
    );
};

const computeSuggestionScore = (
    vector: string[] = [],
    labels: string[] = [],
    usageCount: number = 0,
    isTrending: boolean = false,
    tokens: string[] = [],
    categoryTokens: string[] = [],
): number => {
    const normalizedVector = vector
        .filter((item) => typeof item === 'string')
        .map((item) => normalizeSearchText(item));
    const normalizedLabels = labels
        .filter((item) => typeof item === 'string')
        .map((item) => normalizeSearchText(item));

    let score = usageCount * 2;
    if (isTrending) {
        score += 15;
    }

    const uniqueTokens = Array.from(new Set(tokens));
    uniqueTokens.forEach((token) => {
        if (token.length === 0) {
            return;
        }
        if (normalizedVector.some((value) => value.includes(token))) {
            score += 6;
        } else if (normalizedLabels.some((value) => value.includes(token))) {
            score += 4;
        }
    });

    const normalizedCategoryTokens = Array.from(new Set(categoryTokens));
    normalizedCategoryTokens.forEach((token) => {
        if (token.length === 0) {
            return;
        }
        if (normalizedVector.some((value) => value.includes(token))) {
            score += 12;
        } else if (normalizedLabels.some((value) => value.includes(token))) {
            score += 8;
        }
    });

    return score;
};

const computeCombinationSuggestionScore = (
    combo: CombinationSuggestion,
    tokens: string[] = [],
    categoryTokens: string[] = [],
): number => {
    const vector = Array.isArray(combo?.productVector) ? combo.productVector : [];
    const labels = Array.isArray(combo?.productLabels) ? combo.productLabels : [];

    const normalizedVector = vector
        .filter((value) => typeof value === 'string')
        .map((value) => normalizeSearchText(value));
    const normalizedLabels = labels
        .filter((value) => typeof value === 'string')
        .map((value) => normalizeSearchText(value));

    let score = (combo?.occurrences ?? combo?.usageCount ?? 0) * 4;
    score += (combo?.usageCount ?? 0) * 2;
    if (combo?.isAIPreferred) {
        score += 18;
    }

    const uniqueTokens = Array.from(new Set(tokens));
    uniqueTokens.forEach((token) => {
        if (!token) {
            return;
        }
        if (normalizedVector.some((value) => value.includes(token))) {
            score += 6;
        } else if (normalizedLabels.some((value) => value.includes(token))) {
            score += 4;
        }
    });

    const uniqueCategoryTokens = Array.from(new Set(categoryTokens));
    uniqueCategoryTokens.forEach((token) => {
        if (!token) {
            return;
        }
        if (normalizedVector.some((value) => value.includes(token))) {
            score += 12;
        } else if (normalizedLabels.some((value) => value.includes(token))) {
            score += 8;
        }
    });

    return score;
};

const computeIaSuggestionScore = (
    parts: string[] = [],
    tokens: string[] = [],
    categoryTokens: string[] = [],
): number => {
    const normalizedParts = parts
        .filter((value) => typeof value === 'string')
        .map((value) => normalizeSearchText(value));

    let score = 10;

    const uniqueTokens = Array.from(new Set(tokens));
    uniqueTokens.forEach((token) => {
        if (!token) {
            return;
        }
        if (normalizedParts.some((value) => value.includes(token))) {
            score += 5;
        }
    });

    const uniqueCategoryTokens = Array.from(new Set(categoryTokens));
    uniqueCategoryTokens.forEach((token) => {
        if (!token) {
            return;
        }
        if (normalizedParts.some((value) => value.includes(token))) {
            score += 9;
        }
    });

    return score;
};

interface BuildPairsOptions {
    maxValuesPerLabel?: number;
    contextTokens?: string[];
    categoryTokens?: string[];
}

const selectTopValues = (
    rawValue: string,
    maxValues: number,
    contextTokens: string[],
    categoryTokens: string[],
): string[] => {
    if (typeof rawValue !== 'string') {
        return [];
    }

    const segments = smartSplit(rawValue, ',');
    if (segments.length <= 1) {
        return [rawValue.trim()].filter(Boolean);
    }

    const uniqueSegments = Array.from(
        new Set(
            segments
                .map((segment) => segment.trim())
                .filter((segment) => segment.length > 0)
        )
    );

    const scoredSegments = uniqueSegments.map((segment) => {
        const normalized = normalizeSearchText(segment);
        let score = 1;

        if (normalized.length >= 40) {
            score -= 2; // pénaliser les valeurs trop longues
        }

        if (categoryTokens.some((token) => token && normalized.includes(token))) {
            score += 12;
        }

        if (contextTokens.some((token) => token && normalized.includes(token))) {
            score += 6;
        }

        // Bonus si segment est court (plus lisible)
        if (segment.length <= 25) {
            score += 3;
        }

        return { segment, score };
    });

    scoredSegments.sort((a, b) => b.score - a.score);

    return scoredSegments
        .slice(0, Math.max(1, Math.min(maxValues, 2)))
        .map((item) => item.segment);
};

const buildLabeledPairs = (
    values: string[] = [],
    labels: string[] = [],
    fallbackLabels: string[] = [],
    options: BuildPairsOptions = {},
): Array<{ label: string; value: string }> => {
    const {
        maxValuesPerLabel = 1,
        contextTokens = [],
        categoryTokens = [],
    } = options;

    return values
        .filter((value) => typeof value === 'string' && value.trim().length > 0)
        .map((value, index) => {
            const rawLabel = labels[index] ?? fallbackLabels[index];
            const label = rawLabel && rawLabel.toString().trim().length > 0
                ? rawLabel
                : `Caractéristique ${index + 1}`;

            const selectedValues = selectTopValues(value, maxValuesPerLabel, contextTokens, categoryTokens);
            const formattedValue = selectedValues.join(' • ') || value.trim();

            return {
                label,
                value: formattedValue,
            };
        });
};

const sanitizeKey = (value: string): string =>
    normalizeSearchText(value || '').replace(/[^a-z0-9]+/g, '-');

const buildCombinationKey = (values: string[] = [], labels: string[] = []): string => {
    const pairs = buildLabeledPairs(values, labels);
    if (pairs.length === 0) {
        return '';
    }

    return pairs
        .map(({ label, value }) => {
            const normalizedLabel = normalizeSearchText(label || '');
            const normalizedValue = normalizeSearchText(value || '');
            return `${normalizedLabel}=${normalizedValue}`;
        })
        .join('|');
};

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

const smartSplit = (input: string, primarySeparator?: string): string[] => {
    if (!input || typeof input !== 'string') {
        return [];
    }

    const cleaned = input.trim();
    if (!cleaned) {
        return [];
    }

    const fallbackSeparators = [primarySeparator, ',', ';', '|', '•', ' - ', ' / ']
        .filter((sep): sep is string => !!sep && typeof sep === 'string')
        .filter((sep, index, array) => array.indexOf(sep) === index);

    for (const separator of fallbackSeparators) {
        const parts = cleaned
            .split(separator)
            .map((part) => part.trim())
            .filter((part) => part.length > 0);

        if (parts.length > 1) {
            return parts;
        }
    }

    return [cleaned];
};

const determineLabelOrder = (
    values: string[] = [],
    sousCaracs: Record<string, any> = {}
): string[] => {
    if (!Array.isArray(values) || values.length === 0) {
        return Object.keys(sousCaracs || {});
    }

    const normalizedEntries = Object.entries(sousCaracs || {}).map(([label, options]) => ({
        label,
        options: Array.isArray(options) ? options.map((opt) => normalizeSearchText(opt || '')) : [],
    }));

    const usedLabels = new Set<string>();
    const fallbackKeys = Object.keys(sousCaracs || {});

    return values.map((rawValue, index) => {
        const normalizedValue = normalizeSearchText(rawValue || '');

        let matchedLabel = normalizedEntries.find(({ label, options }) => {
            if (usedLabels.has(label)) {
                return false;
            }
            return options.some((option) => option === normalizedValue);
        })?.label;

        if (!matchedLabel) {
            matchedLabel = fallbackKeys.find((key) => !usedLabels.has(key));
        }

        if (!matchedLabel) {
            matchedLabel = `Caractéristique ${index + 1}`;
        }

        usedLabels.add(matchedLabel);
        return matchedLabel;
    });
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
    contextValues = [],
    categoryValue,
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

    const contextValuesArray = useMemo(
        () => (Array.isArray(contextValues) ? contextValues.filter((item) => typeof item === 'string' && item.trim().length > 0) : []),
        [contextValues]
    );

    const contextTokens = useMemo(() => {
        const tokens = new Set<string>();
        contextValuesArray.forEach((value) => {
            buildSearchTokens(value).forEach((token) => tokens.add(token));
        });
        return Array.from(tokens);
    }, [contextValuesArray]);

    const categoryTokens = useMemo(() => {
        if (typeof categoryValue !== 'string' || categoryValue.trim().length === 0) {
            return [];
        }
        return buildSearchTokens(categoryValue);
    }, [categoryValue]);

    const contextQueryText = useMemo(() => {
        if (contextValuesArray.length === 0) {
            return '';
        }

        const merged = contextValuesArray.join(' ').replace(/\s+/g, ' ').trim();
        return merged.length > 220 ? merged.slice(0, 220) : merged;
    }, [contextValuesArray]);

    const [showEditModal, setShowEditModal] = useState(false);
    const [editingChipIndex, setEditingChipIndex] = useState<number | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newCharKey, setNewCharKey] = useState('');
    const [newCharValue, setNewCharValue] = useState('');

    // ✅ NOUVEAU 2025-11-04 : Recherche progressive
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<PopularProduct[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [combinationSuggestions, setCombinationSuggestions] = useState<CombinationSuggestion[]>([]);
    const [loadingCombinationSuggestions, setLoadingCombinationSuggestions] = useState(false);
    const [combinationError, setCombinationError] = useState<string | null>(null);
    const [activeTokens, setActiveTokens] = useState<string[]>([]);
    const limitedPopularSuggestions = useMemo(
        () => suggestions.slice(0, 1),
        [suggestions]
    );
    const limitedCombinationSuggestions = useMemo(
        () => combinationSuggestions.slice(0, 1),
        [combinationSuggestions]
    );

    const iaCombinaisons = useMemo(() => {
        if (!value || !Array.isArray(value)) {
            return [];
        }

        const combos = value
            .filter((combo) => typeof combo === 'string' && combo.trim().length > 0)
            .map((combo) => combo.trim());

        return Array.from(new Set(combos));
    }, [value]);
    const limitedIaCombinaisons = useMemo(() => {
        const alreadyProvided = limitedPopularSuggestions.length + limitedCombinationSuggestions.length;
        if (alreadyProvided >= 2) {
            return [];
        }
        const remaining = 2 - alreadyProvided;
        return iaCombinaisons.slice(0, remaining);
    }, [iaCombinaisons, limitedPopularSuggestions.length, limitedCombinationSuggestions.length]);
    const [suggestionDrafts, setSuggestionDrafts] = useState<Record<string, Array<{ label: string; value: string }>>>({});
    const [suggestionEditor, setSuggestionEditor] = useState<{ key: string; index: number; label: string; value: string } | null>(null);
    const [suggestionEditorLabel, setSuggestionEditorLabel] = useState('');
    const [suggestionEditorValue, setSuggestionEditorValue] = useState('');
    const [suggestionAddTarget, setSuggestionAddTarget] = useState<string | null>(null);
    const [suggestionAddLabel, setSuggestionAddLabel] = useState('');
    const [suggestionAddValue, setSuggestionAddValue] = useState('');
    const lastContextSignatureRef = useRef<string>('');
    const fetchRequestSeqRef = useRef(0);
    const getPopularSuggestionKey = useCallback(
        (product: PopularProduct, index: number) =>
            `popular-${index}-${sanitizeKey((product?.product_vector || []).join('-') || `p-${index}`)}`,
        []
    );
    const getCombinationSuggestionKey = useCallback(
        (combo: CombinationSuggestion, index: number) =>
            `combo-${combo?.id ?? index}-${sanitizeKey((combo?.productVector || []).join('-') || `c-${index}`)}`,
        []
    );
    const getIaSuggestionKey = useCallback(
        (combo: string, index: number) =>
            `ia-${index}-${sanitizeKey(combo || `ia-${index}`)}`,
        []
    );
    const createVectorFromRows = useCallback(
        (rows: Array<{ label: string; value: string }>) => {
            const cleaned = rows
                .map((row) => ({
                    label: (row.label ?? '').trim() || 'Caractéristique',
                    value: (row.value ?? '').trim(),
                }))
                .filter((row) => row.value.length > 0);

            if (cleaned.length === 0) {
                return null;
            }

            const vector = cleaned.map((row) => row.value).join(separateur || ',');
            const sousCaracs: Record<string, string[]> = {};

            cleaned.forEach((row) => {
                if (!sousCaracs[row.label]) {
                    sousCaracs[row.label] = [];
                }
                if (!sousCaracs[row.label].includes(row.value)) {
                    sousCaracs[row.label].push(row.value);
                }
            });

            return { vector, sousCaracs };
        },
        [separateur]
    );
    const updateSuggestionDraft = useCallback(
        (key: string, updater: (rows: Array<{ label: string; value: string }>) => Array<{ label: string; value: string }>) => {
            setSuggestionDrafts((prev) => {
                const current = prev[key] || [];
                const updated = updater(current);
                return {
                    ...prev,
                    [key]: updated,
                };
            });
        },
        []
    );

    const openSuggestionEditorForRow = useCallback(
        (key: string, rowIndex: number) => {
            const rows = suggestionDrafts[key];
            if (!rows || !rows[rowIndex]) {
                return;
            }
            const target = rows[rowIndex];
            setSuggestionEditor({ key, index: rowIndex, label: target.label, value: target.value });
            setSuggestionEditorLabel(target.label);
            setSuggestionEditorValue(target.value);
        },
        [suggestionDrafts]
    );

    const handleSaveSuggestionEditor = useCallback(() => {
        if (!suggestionEditor) {
            return;
        }

        const label = suggestionEditorLabel.trim() || `Caractéristique ${suggestionEditor.index + 1}`;
        const value = suggestionEditorValue.trim();

        if (value.length === 0) {
            Alert.alert('Valeur manquante', 'Veuillez saisir une valeur pour cette modalité.');
            return;
        }

        updateSuggestionDraft(suggestionEditor.key, (rows) => {
            const next = [...rows];
            next[suggestionEditor.index] = { label, value };
            return next;
        });

        setSuggestionEditor(null);
        setSuggestionEditorLabel('');
        setSuggestionEditorValue('');
    }, [suggestionEditor, suggestionEditorLabel, suggestionEditorValue, updateSuggestionDraft]);

    const handleCancelSuggestionEditor = useCallback(() => {
        setSuggestionEditor(null);
        setSuggestionEditorLabel('');
        setSuggestionEditorValue('');
    }, []);

    const handleSuggestionRowDelete = useCallback(
        (key: string, rowIndex: number) => {
            updateSuggestionDraft(key, (rows) => rows.filter((_, index) => index !== rowIndex));
        },
        [updateSuggestionDraft]
    );

    const openSuggestionAddModal = useCallback((key: string) => {
        setSuggestionAddTarget(key);
        setSuggestionAddLabel('');
        setSuggestionAddValue('');
    }, []);

    const handleSaveSuggestionAdd = useCallback(() => {
        if (!suggestionAddTarget) {
            return;
        }

        const value = suggestionAddValue.trim();
        if (value.length === 0) {
            Alert.alert('Valeur manquante', 'Veuillez saisir une modalité à ajouter.');
            return;
        }

        const label = suggestionAddLabel.trim()
            || `Caractéristique ${(suggestionDrafts[suggestionAddTarget]?.length || 0) + 1}`;

        updateSuggestionDraft(suggestionAddTarget, (rows) => [
            ...rows,
            { label, value },
        ]);

        setSuggestionAddTarget(null);
        setSuggestionAddLabel('');
        setSuggestionAddValue('');
    }, [suggestionAddTarget, suggestionAddLabel, suggestionAddValue, suggestionDrafts, updateSuggestionDraft]);

    const handleCancelSuggestionAdd = useCallback(() => {
        setSuggestionAddTarget(null);
        setSuggestionAddLabel('');
        setSuggestionAddValue('');
    }, []);

    const applySuggestionDraft = useCallback(
        (key: string, fallbackRows: Array<{ label: string; value: string }>) => {
            const rows = suggestionDrafts[key] && suggestionDrafts[key].length > 0
                ? suggestionDrafts[key]
                : fallbackRows;
            const result = createVectorFromRows(rows);

            if (!result) {
                Alert.alert('Suggestion vide', 'Ajoutez au moins une modalité avant de valider.');
                return;
            }

            onChange([result.vector], result.sousCaracs);
            setSearchQuery('');
        },
        [createVectorFromRows, onChange, suggestionDrafts]
    );

    // Décomposer le vecteur en chips
    const parseVectorToChips = (vectorStr: string, labelHints: string[] = []): ChipData[] => {
        // ✅ PROTECTION ULTIME: Vérifier que vectorStr est une STRING et separateur est défini
        if (!vectorStr || typeof vectorStr !== 'string') {
            console.warn('[LinearAutocompleteEditor] ⚠️ vectorStr n\'est pas une string:', typeof vectorStr);
            return [];
        }

        if (!separateur || typeof separateur !== 'string') {
            console.warn('[LinearAutocompleteEditor] ⚠️ separateur n\'est pas une string:', typeof separateur);
        }

        const parts = smartSplit(vectorStr, separateur);
        const subCharKeys = Object.keys(sousCaracteristiques || {});

        if (parts.length === 0) {
            return [];
        }

        const normalizedOptionsMap: Record<string, string[]> = {};
        const normalizedLabelToOriginal: Record<string, string> = {};
        Object.entries(sousCaracteristiques || {}).forEach(([rawLabel, options]) => {
            const normalizedLabel = normalizeSearchText(rawLabel || '');
            normalizedLabelToOriginal[normalizedLabel] = rawLabel;
            normalizedOptionsMap[normalizedLabel] = Array.isArray(options)
                ? options
                    .map((option) => normalizeSearchText(option || ''))
                    .filter(Boolean)
                : [];
        });

        const normalizedParts = parts.map((raw) => normalizeSearchText(raw || ''));
        const assignedLabels: Array<string | null> = Array(parts.length).fill(null);
        const usedLabelKeys = new Set<string>();

        const tryAssignLabel = (label: string | undefined | null, partIndex: number): boolean => {
            if (!label || partIndex < 0 || partIndex >= parts.length) {
                return false;
            }

            const normalizedLabel = normalizeSearchText(label);
            if (usedLabelKeys.has(normalizedLabel)) {
                return false;
            }

            assignedLabels[partIndex] = label;
            usedLabelKeys.add(normalizedLabel);
            return true;
        };

        const findMatchingPartForLabel = (label: string | undefined | null): number => {
            if (!label) {
                return -1;
            }

            const normalizedLabel = normalizeSearchText(label);
            const options = normalizedOptionsMap[normalizedLabel] || [];

            const isPriceLabel = /prix|tarif|montant|cout|coût|budget|price|amount/.test(normalizedLabel);

            for (let i = 0; i < normalizedParts.length; i += 1) {
                if (assignedLabels[i]) {
                    continue;
                }

                const normalizedValue = normalizedParts[i];
                if (!normalizedValue) {
                    continue;
                }

                const exactMatch = options.some((option) => option && normalizedValue === option);
                const fuzzyMatch = options.some((option) => option && (normalizedValue.includes(option) || option.includes(normalizedValue)));
                const labelInValue = normalizedValue.includes(normalizedLabel);
                const numericMatch = isPriceLabel && /\d/.test(normalizedValue);

                if (exactMatch || fuzzyMatch || labelInValue || numericMatch) {
                    return i;
                }
            }

            return -1;
        };

        labelHints.forEach((hint) => {
            const matchIndex = findMatchingPartForLabel(hint);
            if (matchIndex !== -1) {
                tryAssignLabel(hint, matchIndex);
            }
        });

        parts.forEach((_, index) => {
            if (assignedLabels[index]) {
                return;
            }

            const hint = labelHints[index];
            if (tryAssignLabel(hint, index)) {
                return;
            }

            const fallbackKey = subCharKeys.find((key) => !usedLabelKeys.has(normalizeSearchText(key)));
            if (fallbackKey) {
                tryAssignLabel(fallbackKey, index);
                return;
            }

            assignedLabels[index] = `Caractéristique ${index + 1}`;
        });

        return parts.map((value, index) => ({
            key: assignedLabels[index] || `Caractéristique ${index + 1}`,
            value,
            index,
        }));
    };

    const vectorParts = useMemo(() => {
        if (!displayValue || typeof displayValue !== 'string') {
            return [] as string[];
        }
        return smartSplit(displayValue, separateur);
    }, [displayValue, separateur]);

    const labelOrder = useMemo(() => determineLabelOrder(vectorParts, sousCaracteristiques), [vectorParts, sousCaracteristiques]);

    // ✅ CORRECTION: Utiliser useMemo pour que chips se mette à jour quand value change
    const chips = useMemo(() => {
        if (!displayValue || typeof displayValue !== 'string') {
            return [];
        }
        return parseVectorToChips(displayValue, labelOrder);
    }, [displayValue, labelOrder]);

    const fetchSuggestionsForQuery = useCallback(
        async (
            input: string,
            options: { reason?: 'search' | 'context'; force?: boolean } = {},
        ) => {
            const raw = typeof input === 'string' ? input : '';
            const trimmed = raw.trim();
            const searchTokens = buildSearchTokens(trimmed);
            const chipTokens = (chips || [])
                .map((chip) => chip?.value)
                .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
                .flatMap((value) => buildSearchTokens(value));

            const tokensToMatchBase = searchTokens.length > 0
                ? searchTokens
                : [...chipTokens, ...contextTokens];
            const tokensToMatch = Array.from(new Set(tokensToMatchBase));
            setActiveTokens(tokensToMatch);

            const shouldForce = options.force === true;
            const hasMinimumQuery = trimmed.length >= 2;
            const effectiveQuery = hasMinimumQuery
                ? trimmed
                : tokensToMatch.slice(0, 6).join(' ');

            if (!shouldForce && !hasMinimumQuery) {
                return;
            }

            if (!effectiveQuery || effectiveQuery.trim().length === 0) {
                return;
            }

            const requestId = ++fetchRequestSeqRef.current;

            setLoadingSuggestions(true);
            setLoadingCombinationSuggestions(true);
            setCombinationError(null);

            try {
                const [popularResult, combinationsResult] = await Promise.allSettled([
                    apiGet(`/api/products/popular?search=${encodeURIComponent(effectiveQuery)}&limit=8`),
                    apiPost('/api/combinations/search', {
                        query: effectiveQuery,
                        limit: 8,
                    }),
                ]);

                if (fetchRequestSeqRef.current !== requestId) {
                    return;
                }

                if (popularResult.status === 'fulfilled' && popularResult.value?.success) {
                    const normalized = normalizePopularProductsResponse(
                        popularResult.value?.data ?? popularResult.value
                    );
                    const filtered = normalized.filter((product) =>
                        vectorMatchesTokens(
                            Array.isArray(product?.product_vector) ? product.product_vector : [],
                            tokensToMatch,
                            Array.isArray(product?.product_labels) ? product.product_labels : [],
                        )
                    );
                    const ranked = filtered
                        .map((product) => ({
                            product,
                            score: computeSuggestionScore(
                                Array.isArray(product?.product_vector) ? product.product_vector : [],
                                Array.isArray(product?.product_labels) ? product.product_labels : [],
                                product?.usage_count ?? 0,
                                !!product?.is_trending,
                                tokensToMatch,
                                categoryTokens
                            ),
                        }))
                        .sort((a, b) => b.score - a.score)
                        .map((entry) => entry.product);
                    setSuggestions(ranked.slice(0, 4));
                } else {
                    setSuggestions([]);
                }

                if (combinationsResult.status === 'fulfilled' && combinationsResult.value?.success) {
                    const combos = normalizeCombinationResponse(
                        combinationsResult.value?.data ?? combinationsResult.value
                    );

                    const iaKeys = new Set(
                        iaCombinaisons
                            .map((combo) => {
                                if (typeof combo !== 'string') {
                                    return '';
                                }
                                const vectorParts = smartSplit(combo, separateur || ',');
                                return buildCombinationKey(vectorParts, []);
                            })
                            .filter(Boolean)
                    );

                    const aggregated = new Map<string, CombinationSuggestion>();

                    combos.forEach((item: any) => {
                        const combo = item?.combination ?? item;
                        if (!combo || !Array.isArray(combo.product_vector)) {
                            return;
                        }

                        const rawVector = combo.product_vector
                            .filter((part: any) => typeof part === 'string')
                            .map((part: string) => part.trim())
                            .filter(Boolean);

                        if (rawVector.length === 0) {
                            return;
                        }

                        const labels = Array.isArray(combo.product_labels) ? combo.product_labels : [];
                        const comboKey = buildCombinationKey(rawVector, labels);

                        if (!comboKey || iaKeys.has(comboKey)) {
                            return;
                        }

                        if (tokensToMatch.length > 0 && !vectorMatchesTokens(rawVector, tokensToMatch, labels)) {
                            return;
                        }

                        let prix: number | undefined;
                        if (combo.prix !== null && combo.prix !== undefined) {
                            const parsed = typeof combo.prix === 'number'
                                ? combo.prix
                                : parseFloat(combo.prix.toString());
                            prix = Number.isNaN(parsed) ? undefined : parsed;
                        }

                        const usageCount = typeof combo.usage_count === 'number' ? combo.usage_count : 0;

                        const existing = aggregated.get(comboKey);
                        const incomingOccurrences = typeof combo.occurrences === 'number' && combo.occurrences > 0
                            ? combo.occurrences
                            : Math.max(usageCount || 0, 1);

                        if (existing) {
                            existing.occurrences = (existing.occurrences ?? 0) + incomingOccurrences;
                            if (usageCount > (existing.usageCount ?? 0)) {
                                existing.usageCount = usageCount;
                            }
                            if (prix !== undefined && existing.prix === undefined) {
                                existing.prix = prix;
                                existing.devise = combo.devise || existing.devise;
                            }
                            if (combo.is_ai_preferred) {
                                existing.isAIPreferred = true;
                            }
                            return;
                        }

                        aggregated.set(comboKey, {
                            id: combo.id,
                            productVector: rawVector,
                            productLabels: labels,
                            usageCount,
                            prix,
                            devise: combo.devise || undefined,
                            isAIPreferred: !!combo.is_ai_preferred,
                            occurrences: incomingOccurrences,
                        });
                    });

                    const aggregatedList = Array.from(aggregated.values()).sort((a, b) => {
                        const aScore = (a.occurrences ?? a.usageCount ?? 0);
                        const bScore = (b.occurrences ?? b.usageCount ?? 0);
                        return bScore - aScore;
                    });

                    setCombinationSuggestions(aggregatedList);
                    setCombinationError(
                        aggregatedList.length === 0
                            ? 'Aucune caractéristique pertinente trouvée.'
                            : null
                    );
                } else {
                    setCombinationSuggestions([]);
                }
            } catch (error) {
                if (fetchRequestSeqRef.current !== requestId) {
                    return;
                }
                console.error('[LinearAutocompleteEditor] ❌ Erreur recherche:', error);
                setSuggestions([]);
                setCombinationSuggestions([]);
                setCombinationError('Impossible de récupérer les caractéristiques recommandées.');
            } finally {
                if (fetchRequestSeqRef.current === requestId) {
                    setLoadingSuggestions(false);
                    setLoadingCombinationSuggestions(false);
                }
            }
        },
        [
            apiGet,
            apiPost,
            categoryTokens,
            chips,
            contextTokens,
            iaCombinaisons,
            separateur,
            setActiveTokens,
        ]
    );

    useEffect(() => {
        const signature = `${contextQueryText}::${categoryTokens.join('|')}`;

        if (!contextQueryText) {
            lastContextSignatureRef.current = signature;
            setActiveTokens(contextTokens);
            setSuggestions([]);
            setCombinationSuggestions([]);
            setCombinationError(null);
            return;
        }

        if (lastContextSignatureRef.current === signature) {
            return;
        }

        lastContextSignatureRef.current = signature;
        fetchSuggestionsForQuery(contextQueryText, { reason: 'context', force: true });
    }, [
        categoryTokens,
        contextQueryText,
        contextTokens,
        fetchSuggestionsForQuery,
    ]);

    const suggestedLabel = useMemo(() => {
        const usedKeys = new Set((chips || []).map((chip) => (chip.key || '').toLowerCase()));
        const orderedSuggestion = labelOrder.find((label) => label && !usedKeys.has(label.toLowerCase()));
        if (orderedSuggestion) {
            return orderedSuggestion;
        }

        const fallbackSuggestion = Object.keys(sousCaracteristiques || {}).find(
            (label) => label && !usedKeys.has(label.toLowerCase())
        );

        return fallbackSuggestion || `Caractéristique ${chips.length + 1}`;
    }, [chips, labelOrder, sousCaracteristiques]);

    useEffect(() => {
        if (showAddModal) {
            setNewCharKey((prev) => prev || suggestedLabel || '');
        } else {
            setNewCharKey('');
            setNewCharValue('');
        }
    }, [showAddModal, suggestedLabel]);

    useEffect(() => {
        const updates: Record<string, Array<{ label: string; value: string }>> = {};

        limitedPopularSuggestions.forEach((product, index) => {
            const key = getPopularSuggestionKey(product, index);
            const rows = buildLabeledPairs(
                Array.isArray(product?.product_vector) ? product.product_vector : [],
                Array.isArray(product?.product_labels) ? product.product_labels : [],
                labelOrder,
                {
                    maxValuesPerLabel: 2,
                    contextTokens,
                    categoryTokens,
                }
            );
            updates[key] = rows;
        });

        limitedCombinationSuggestions.forEach((combo, index) => {
            const key = getCombinationSuggestionKey(combo, index);
            const rows = buildLabeledPairs(
                combo.productVector || [],
                combo.productLabels || [],
                labelOrder,
                {
                    maxValuesPerLabel: 2,
                    contextTokens,
                    categoryTokens,
                }
            );
            updates[key] = rows;
        });

        limitedIaCombinaisons.forEach((combo, index) => {
            const key = getIaSuggestionKey(combo, index);
            const parts = smartSplit(combo || '', separateur || ',').map((part) => part.trim()).filter(Boolean);
            const rows = buildLabeledPairs(parts, labelOrder, labelOrder, {
                maxValuesPerLabel: 2,
                contextTokens,
                categoryTokens,
            });
            updates[key] = rows;
        });

        setSuggestionDrafts((prev) => {
            let changed = false;
            const next: Record<string, Array<{ label: string; value: string }>> = { ...prev };

            Object.keys(next).forEach((key) => {
                if (!(key in updates)) {
                    delete next[key];
                    changed = true;
                }
            });

            Object.entries(updates).forEach(([key, rows]) => {
                const existing = next[key];
                const rowsCopy = rows.map((row) => ({ ...row }));

                if (!existing) {
                    next[key] = rowsCopy;
                    changed = true;
                    return;
                }

                const lengthsDiffer = existing.length !== rowsCopy.length;
                const contentDiffer = lengthsDiffer
                    || existing.some((row, rowIndex) => {
                        const target = rowsCopy[rowIndex];
                        return !target || row.label !== target.label || row.value !== target.value;
                    });

                if (contentDiffer) {
                    next[key] = rowsCopy;
                    changed = true;
                }
            });

            return changed ? next : prev;
        });
    }, [
        limitedPopularSuggestions,
        limitedCombinationSuggestions,
        limitedIaCombinaisons,
        getPopularSuggestionKey,
        getCombinationSuggestionKey,
        getIaSuggestionKey,
        contextTokens,
        categoryTokens,
        labelOrder,
        separateur,
    ]);

    // ✅ CORRECTION FINALE 2025-11-06 : Recherche progressive SANS useEffect
    // Le useEffect avec searchSuggestions cause des problèmes de closure
    // On va gérer la recherche directement dans onChangeText du TextInput

    const applyPopularSuggestion = (product: PopularProduct, draftKey: string) => {
        if (!product?.product_vector || !Array.isArray(product.product_vector)) {
            console.warn('[LinearAutocompleteEditor] ⚠️ Produit sans product_vector valide');
            return;
        }

        const fallbackRows = buildLabeledPairs(
            product.product_vector,
            product.product_labels || [],
            labelOrder,
            {
                maxValuesPerLabel: 2,
                contextTokens,
                categoryTokens,
            }
        );

        applySuggestionDraft(draftKey, fallbackRows);
    };

    const applyCombinationSuggestion = (suggestion: CombinationSuggestion, draftKey: string) => {
        const vector = suggestion.productVector || [];
        if (vector.length === 0) {
            return;
        }

        const fallbackRows = buildLabeledPairs(
            vector,
            suggestion.productLabels || [],
            labelOrder,
            {
                maxValuesPerLabel: 2,
                contextTokens,
                categoryTokens,
            }
        );

        applySuggestionDraft(draftKey, fallbackRows);
    };

    const applyIaCombination = (combo: string, draftKey: string) => {
        const parts = smartSplit(combo || '', separateur || ',').map((part) => part.trim()).filter(Boolean);
        const fallbackRows = buildLabeledPairs(parts, labelOrder, labelOrder, {
            maxValuesPerLabel: 2,
            contextTokens,
            categoryTokens,
        });
        applySuggestionDraft(draftKey, fallbackRows);
    };

    const formatPriceDisplay = useCallback((price?: number, devise?: string) => {
        if (price === undefined) {
            return null;
        }

        const formatter = new Intl.NumberFormat('fr-FR');
        return `${formatter.format(Math.round(price))} ${devise || 'XAF'}`;
    }, []);

    const suggestionCandidates = useMemo(() => {
        const items: SuggestionCandidate[] = [];

        limitedPopularSuggestions.forEach((product, index) => {
            const draftKey = getPopularSuggestionKey(product, index);
            const fallbackRows = buildLabeledPairs(
                Array.isArray(product?.product_vector) ? product.product_vector : [],
                Array.isArray(product?.product_labels) ? product.product_labels : [],
                labelOrder,
                {
                    maxValuesPerLabel: 2,
                    contextTokens,
                    categoryTokens,
                }
            );
            const rows = suggestionDrafts[draftKey] && suggestionDrafts[draftKey].length > 0
                ? suggestionDrafts[draftKey]
                : fallbackRows;
            const sellerCount = Math.max(product?.usage_count ?? 0, 0);
            const score = computeSuggestionScore(
                Array.isArray(product?.product_vector) ? product.product_vector : [],
                Array.isArray(product?.product_labels) ? product.product_labels : [],
                product?.usage_count ?? 0,
                !!product?.is_trending,
                activeTokens,
                categoryTokens,
            ) + 12;

            items.push({
                key: draftKey,
                source: 'popular',
                rows,
                score,
                title: 'Produit populaire',
                sellerCount,
                priceDisplay: product?.prix_moyen ? `${product.prix_moyen.toFixed(0)} XAF` : null,
                isTrending: !!product?.is_trending,
                product,
            });
        });

        limitedCombinationSuggestions.forEach((combo, index) => {
            const draftKey = getCombinationSuggestionKey(combo, index);
            const fallbackRows = buildLabeledPairs(
                combo.productVector || [],
                combo.productLabels || [],
                labelOrder,
                {
                    maxValuesPerLabel: 2,
                    contextTokens,
                    categoryTokens,
                }
            );
            const rows = suggestionDrafts[draftKey] && suggestionDrafts[draftKey].length > 0
                ? suggestionDrafts[draftKey]
                : fallbackRows;
            const score = computeCombinationSuggestionScore(combo, activeTokens, categoryTokens) + 8;

            items.push({
                key: draftKey,
                source: 'combination',
                rows,
                score,
                title: combo.isAIPreferred ? 'Version IA des prestataires' : 'Combinaison des prestataires',
                sellerCount: combo.usageCount,
                occurrences: combo.occurrences,
                priceDisplay: formatPriceDisplay(combo.prix, combo.devise),
                isPreferred: combo.isAIPreferred,
                combination: combo,
            });
        });

        limitedIaCombinaisons.forEach((value, index) => {
            if (typeof value !== 'string' || value.trim().length === 0) {
                return;
            }

            const draftKey = getIaSuggestionKey(value, index);
            const parts = smartSplit(value || '', separateur || ',').map((part) => part.trim()).filter(Boolean);
            const fallbackRows = buildLabeledPairs(parts, labelOrder, labelOrder, {
                maxValuesPerLabel: 2,
                contextTokens,
                categoryTokens,
            });
            const rows = suggestionDrafts[draftKey] && suggestionDrafts[draftKey].length > 0
                ? suggestionDrafts[draftKey]
                : fallbackRows;
            const score = computeIaSuggestionScore(parts, activeTokens, categoryTokens) + 4;

            items.push({
                key: draftKey,
                source: 'ia',
                rows,
                score,
                title: `Suggestion IA ${index + 1}`,
                iaValue: value,
            });
        });

        return items.sort((a, b) => b.score - a.score);
    }, [
        activeTokens,
        categoryTokens,
        contextTokens,
        getCombinationSuggestionKey,
        getIaSuggestionKey,
        getPopularSuggestionKey,
        labelOrder,
        limitedCombinationSuggestions,
        limitedIaCombinaisons,
        limitedPopularSuggestions,
        separateur,
        suggestionDrafts,
        formatPriceDisplay,
    ]);

    const bestSuggestionCandidate = suggestionCandidates.length > 0 ? suggestionCandidates[0] : null;

    const handleApplySuggestion = useCallback(
        (candidate: SuggestionCandidate | null) => {
            if (!candidate) {
                return;
            }

            if (candidate.source === 'popular' && candidate.product) {
                applyPopularSuggestion(candidate.product, candidate.key);
                return;
            }

            if (candidate.source === 'combination' && candidate.combination) {
                applyCombinationSuggestion(candidate.combination, candidate.key);
                return;
            }

            if (candidate.source === 'ia' && candidate.iaValue) {
                applyIaCombination(candidate.iaValue, candidate.key);
            }
        },
        [applyCombinationSuggestion, applyIaCombination, applyPopularSuggestion]
    );

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

        const parts = smartSplit(firstCombo, separateur || ',').map(part => part.trim()).filter(Boolean);
        const seedQuery = parts[0];
        const contextTokens = buildSearchTokens(parts.join(' '));

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
                    const iaKeys = new Set(
                        iaCombinaisons
                            .map((combo) => {
                                if (typeof combo !== 'string') {
                                    return '';
                                }
                                const vectorParts = smartSplit(combo, separateur || ',');
                                return buildCombinationKey(vectorParts, []);
                            })
                            .filter(Boolean)
                    );

                    const aggregated = new Map<string, CombinationSuggestion>();

                    combos.forEach((item: any) => {
                        const combo = item?.combination ?? item;
                        if (!combo || !Array.isArray(combo.product_vector)) {
                            return;
                        }

                        const rawVector = combo.product_vector
                            .filter((part: any) => typeof part === 'string')
                            .map((part: string) => part.trim())
                            .filter(Boolean);

                        if (rawVector.length === 0) {
                            return;
                        }

                        const labels = Array.isArray(combo.product_labels) ? combo.product_labels : [];
                        const comboKey = buildCombinationKey(rawVector, labels);

                        if (!comboKey || iaKeys.has(comboKey)) {
                            return;
                        }

                        if (contextTokens.length > 0 && !vectorMatchesTokens(rawVector, contextTokens, labels)) {
                            return;
                        }

                        let prix: number | undefined;
                        if (combo.prix !== null && combo.prix !== undefined) {
                            const parsed = typeof combo.prix === 'number'
                                ? combo.prix
                                : parseFloat(combo.prix.toString());
                            prix = isNaN(parsed) ? undefined : parsed;
                        }

                        const usageCount = typeof combo.usage_count === 'number' ? combo.usage_count : 0;

                        const existing = aggregated.get(comboKey);
                        const incomingOccurrences = typeof combo.occurrences === 'number' && combo.occurrences > 0
                            ? combo.occurrences
                            : Math.max(usageCount || 0, 1);
                        if (existing) {
                            existing.occurrences = (existing.occurrences ?? 0) + incomingOccurrences;
                            if (usageCount > (existing.usageCount ?? 0)) {
                                existing.usageCount = usageCount;
                            }
                            if (prix !== undefined && existing.prix === undefined) {
                                existing.prix = prix;
                                existing.devise = combo.devise || existing.devise;
                            }
                            if (combo.is_ai_preferred) {
                                existing.isAIPreferred = true;
                            }
                            return;
                        }

                        aggregated.set(comboKey, {
                            id: combo.id,
                            productVector: rawVector,
                            productLabels: labels,
                            usageCount,
                            prix,
                            devise: combo.devise || undefined,
                            isAIPreferred: !!combo.is_ai_preferred,
                            occurrences: incomingOccurrences,
                        });
                    });

                    const aggregatedList = Array.from(aggregated.values()).sort((a, b) => {
                        const aScore = (a.occurrences ?? a.usageCount ?? 0);
                        const bScore = (b.occurrences ?? b.usageCount ?? 0);
                        return bScore - aScore;
                    });

                    setCombinationSuggestions(aggregatedList);
                    setCombinationError(
                        aggregatedList.length === 0
                            ? 'Aucune caractéristique pertinente trouvée.'
                            : null
                    );
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

        const parts = smartSplit(displayValue, separateur);
        parts[editingChipIndex] = newValue.trim();

        const newVector = parts.join(separateur);
        onChange([newVector]);

        setShowEditModal(false);
        setEditingChipIndex(null);
    };

    // Supprimer une caractéristique
    const handleDeleteChip = (chipIndex: number) => {
        Alert.alert(
            'Confirmation de suppression',
            `Confirmez-vous la suppression de "${chips[chipIndex].value}" ?`,
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

                        const parts = smartSplit(displayValue, separateur);
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
            ? smartSplit(displayValue, safeSeparateur)
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

    const generatePlaceholder = useCallback((): string => {
        if (value && value.length > 0 && value[0] && separateur) {
            const firstValue = value[0];
            if (typeof firstValue === 'string' && typeof separateur === 'string') {
                const allValues = smartSplit(firstValue, separateur);
                if (allValues.length > 6) {
                    return `🤖 Ex: ${allValues.slice(0, 5).join(' • ')}... (+${allValues.length - 5})`;
                } else if (allValues.length > 0) {
                    return `🤖 Ex: ${allValues.join(' • ')}`;
                }
            } else {
                console.warn('[LinearAutocompleteEditor] ⚠️ value[0] ou separateur pas string dans generatePlaceholder');
            }
        }

        if ((!displayValue || displayValue.length === 0) && iaCombinaisons.length > 0) {
            const combo = iaCombinaisons[0];
            if (typeof combo === 'string') {
                const parts = smartSplit(combo, separateur || ',').map(v => v.trim()).filter(Boolean);
                if (parts.length > 0) {
                    return `✨ ${parts.slice(0, 6).join(' • ')}`;
                }
            }
        }

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

        return '🔍 Tapez pour rechercher ou voir suggestions IA...';
    }, [value, separateur, displayValue, iaCombinaisons, sousCaracteristiques]);

    const searchPlaceholder = useMemo(() => generatePlaceholder(), [generatePlaceholder]);

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

            {/* ✅ Champ de recherche (toujours affiché, mais suggestions préchargées via description) */}
            <View style={styles.searchContainer}>
                <View style={styles.searchIconWrapper}>
                    <SafeIcon name="search" size={18} color="#9CA3AF" />
                </View>
                <TextInput
                    style={styles.searchInput}
                    placeholder={placeholder || searchPlaceholder}
                    placeholderTextColor="#9CA3AF"
                    value={searchQuery}
                    onChangeText={(text) => {
                        setSearchQuery(text);
                        fetchSuggestionsForQuery(text, { reason: 'search' });
                    }}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity
                        onPress={() => {
                            setSearchQuery('');
                            if (contextQueryText) {
                                fetchSuggestionsForQuery(contextQueryText, { reason: 'context', force: true });
                            } else {
                                setSuggestions([]);
                                setCombinationSuggestions([]);
                                setCombinationError(null);
                            }
                        }}
                    >
                        <SafeIcon name="x" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                )}
            </View>

            {(loadingSuggestions || loadingCombinationSuggestions || bestSuggestionCandidate || combinationError) && (
                <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>✨ Caractéristique recommandée</Text>

                    {(loadingSuggestions || loadingCombinationSuggestions) && (
                        <ActivityIndicator size="small" color={modernColors.primary} style={{ marginVertical: 12 }} />
                    )}

                    {!loadingSuggestions && !loadingCombinationSuggestions && bestSuggestionCandidate && (
                        <View key={bestSuggestionCandidate.key} style={styles.suggestionCard}>
                            <View style={styles.suggestionCardHeader}>
                                <View style={styles.suggestionCardHeaderLeft}>
                                    <SafeIcon
                                        name={
                                            bestSuggestionCandidate.source === 'popular'
                                                ? 'gift'
                                                : bestSuggestionCandidate.source === 'combination'
                                                    ? 'users'
                                                    : 'sparkles'
                                        }
                                        size={16}
                                        color={
                                            bestSuggestionCandidate.source === 'popular'
                                                ? modernColors.primary
                                                : bestSuggestionCandidate.source === 'combination'
                                                    ? '#F97316'
                                                    : modernColors.primary
                                        }
                                    />
                                    <Text style={styles.suggestionCardTitle}>{bestSuggestionCandidate.title}</Text>
                                </View>
                                {bestSuggestionCandidate.isTrending && (
                                    <View style={styles.trendingBadge}>
                                        <Text style={styles.trendingText}>📈 TENDANCE</Text>
                                    </View>
                                )}
                                {bestSuggestionCandidate.isPreferred && (
                                    <View style={styles.combinationBadge}>
                                        <SafeIcon name="sparkles" size={12} color={modernColors.primary} />
                                        <Text style={styles.combinationBadgeText}>IA</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.suggestionTable}>
                                {bestSuggestionCandidate.rows.length === 0 ? (
                                    <Text style={styles.suggestionEmptyRow}>
                                        Aucune modalité. Ajoutez-en pour personnaliser.
                                    </Text>
                                ) : (
                                    bestSuggestionCandidate.rows.map((row, rowIndex) => (
                                        <View
                                            key={`${bestSuggestionCandidate.key}-${row.label}-${rowIndex}`}
                                            style={[
                                                styles.suggestionRow,
                                                rowIndex === bestSuggestionCandidate.rows.length - 1 && styles.suggestionRowLast,
                                            ]}
                                        >
                                            <View style={styles.suggestionRowContent}>
                                                <Text style={styles.suggestionCellLabel}>{row.label}</Text>
                                                <TouchableOpacity
                                                    onPress={() => openSuggestionEditorForRow(bestSuggestionCandidate.key, rowIndex)}
                                                    style={styles.suggestionValueTouchable}
                                                >
                                                    <Text style={styles.suggestionCellValue}>{row.value}</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <View style={styles.suggestionRowActions}>
                                                <TouchableOpacity
                                                    style={styles.suggestionActionButton}
                                                    onPress={() => openSuggestionEditorForRow(bestSuggestionCandidate.key, rowIndex)}
                                                >
                                                    <SafeIcon name="edit-2" size={14} color={modernColors.primary} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.suggestionActionButton}
                                                    onPress={() => handleSuggestionRowDelete(bestSuggestionCandidate.key, rowIndex)}
                                                >
                                                    <SafeIcon name="trash-2" size={14} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>

                            {(bestSuggestionCandidate.sellerCount ||
                                bestSuggestionCandidate.occurrences ||
                                bestSuggestionCandidate.priceDisplay) && (
                                    <View style={styles.suggestionMeta}>
                                        <View style={styles.suggestionMetaLeft}>
                                            {typeof bestSuggestionCandidate.sellerCount === 'number' && bestSuggestionCandidate.sellerCount > 0 && (
                                                <Text style={styles.suggestionCount}>
                                                    👥 {bestSuggestionCandidate.sellerCount} prestataire
                                                    {bestSuggestionCandidate.sellerCount > 1 ? 's' : ''}
                                                </Text>
                                            )}
                                            {typeof bestSuggestionCandidate.occurrences === 'number' && bestSuggestionCandidate.occurrences > 0 && (
                                                <Text style={styles.combinationOccurrence}>
                                                    🔁 {bestSuggestionCandidate.occurrences} occurrence
                                                    {bestSuggestionCandidate.occurrences > 1 ? 's' : ''}
                                                </Text>
                                            )}
                                        </View>
                                        {bestSuggestionCandidate.priceDisplay && (
                                            <Text style={styles.suggestionPrice}>
                                                💰 {bestSuggestionCandidate.priceDisplay}
                                            </Text>
                                        )}
                                    </View>
                                )}

                            <View style={styles.suggestionFooter}>
                                <TouchableOpacity
                                    style={styles.suggestionAddButton}
                                    onPress={() => openSuggestionAddModal(bestSuggestionCandidate.key)}
                                >
                                    <SafeIcon name="plus-circle" size={16} color={modernColors.primary} />
                                    <Text style={styles.suggestionAddButtonText}>Ajouter une caractéristique</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.suggestionApplyButton}
                                    onPress={() => handleApplySuggestion(bestSuggestionCandidate)}
                                >
                                    <SafeIcon name="check-circle" size={16} color="#FFFFFF" />
                                    <Text style={styles.suggestionApplyText}>Valider</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {!loadingSuggestions &&
                        !loadingCombinationSuggestions &&
                        !bestSuggestionCandidate &&
                        !combinationError && (
                            <Text style={styles.noSuggestionsText}>
                                Aucune caractéristique pertinente trouvée.
                            </Text>
                        )}

                    {combinationError && (
                        <Text style={styles.combinationError}>{combinationError}</Text>
                    )}
                </View>
            )}

            {/* Vecteur affiché en chips */}
            {chips.length > 0 ? (
                <View style={[styles.vectorContainer, styles.vectorContainerActive]}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={[styles.chipsScroll, styles.chipsScrollActive]}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                    >
                        <TouchableOpacity
                            style={styles.addCharacteristicButton}
                            onPress={() => setShowAddModal(true)}
                        >
                            <SafeIcon name="plus-circle" size={16} color={modernColors.primary} />
                            <Text style={styles.addCharacteristicText}>Ajouter une caractéristique</Text>
                        </TouchableOpacity>

                        {(chips || []).map((chip, index) => {
                            const rawKey = typeof chip.key === 'string' ? chip.key.trim() : '';
                            const shouldHideKey = rawKey.length > 0 && /^caract[eé]ristique\s+\d+$/i.test(rawKey);

                            return (
                                <View key={index} style={styles.chip}>
                                    <View style={styles.chipContent}>
                                        {!shouldHideKey && rawKey.length > 0 ? (
                                            <Text style={styles.chipKey}>{rawKey}</Text>
                                        ) : null}
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
                            );
                        })}
                    </ScrollView>
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
                                        <ScrollView
                                            style={styles.optionsList}
                                            nestedScrollEnabled
                                            keyboardShouldPersistTaps="handled"
                                        >
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

            <Modal
                visible={!!suggestionEditor}
                animationType="fade"
                transparent
                onRequestClose={handleCancelSuggestionEditor}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Modifier la modalité</Text>
                            <TouchableOpacity onPress={handleCancelSuggestionEditor}>
                                <SafeIcon name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalBody}>
                            <Text style={styles.modalLabel}>Intitulé</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Ex: Couleur"
                                value={suggestionEditorLabel}
                                onChangeText={setSuggestionEditorLabel}
                            />
                            <Text style={styles.modalLabel}>Valeur</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Ex: Noir"
                                value={suggestionEditorValue}
                                onChangeText={setSuggestionEditorValue}
                            />
                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.cancelButton} onPress={handleCancelSuggestionEditor}>
                                    <Text style={styles.cancelButtonText}>Annuler</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.saveButton} onPress={handleSaveSuggestionEditor}>
                                    <Text style={styles.saveButtonText}>Enregistrer</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={suggestionAddTarget !== null}
                animationType="fade"
                transparent
                onRequestClose={handleCancelSuggestionAdd}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Ajouter une modalité</Text>
                            <TouchableOpacity onPress={handleCancelSuggestionAdd}>
                                <SafeIcon name="x" size={24} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.modalBody}>
                            <Text style={styles.modalLabel}>Intitulé</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Ex: Variante"
                                value={suggestionAddLabel}
                                onChangeText={setSuggestionAddLabel}
                            />
                            <Text style={styles.modalLabel}>Valeur</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Ex: Transmission automatique"
                                value={suggestionAddValue}
                                onChangeText={setSuggestionAddValue}
                            />
                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.cancelButton} onPress={handleCancelSuggestionAdd}>
                                    <Text style={styles.cancelButtonText}>Annuler</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.saveButton} onPress={handleSaveSuggestionAdd}>
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
        gap: 6,
    },
    label: {
        alignSelf: 'flex-start',
        fontSize: 12,
        fontWeight: '700',
        color: modernColors.primary,
        backgroundColor: 'rgba(99, 102, 241, 0.12)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
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
    vectorContainerActive: {
        backgroundColor: '#F9FAFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E0E7FF',
        paddingVertical: 12,
        paddingHorizontal: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
    },
    chipsScroll: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    chipsScrollActive: {
        paddingVertical: 4,
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
    addCharacteristicButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#C7D2FE',
        backgroundColor: '#EEF2FF',
    },
    addCharacteristicText: {
        fontSize: 12,
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
        backgroundColor: 'rgba(99, 102, 241, 0.14)',
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
    iaComboTable: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        overflow: 'hidden',
    },
    iaComboRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 12,
    },
    iaComboRowLast: {
        borderBottomWidth: 0,
    },
    iaComboCellLabel: {
        flex: 0.45,
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        textTransform: 'capitalize',
    },
    iaComboCellValue: {
        flex: 0.55,
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
        textAlign: 'right',
    },
    iaComboApply: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    suggestionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1,
    },
    suggestionCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    suggestionCardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 1,
    },
    suggestionCardTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
    },
    suggestionTable: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        overflow: 'hidden',
    },
    suggestionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 12,
    },
    suggestionRowLast: {
        borderBottomWidth: 0,
    },
    suggestionRowContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    suggestionCellLabel: {
        flex: 0.45,
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        textTransform: 'capitalize',
    },
    suggestionCellValue: {
        flex: 0.55,
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
        textAlign: 'right',
    },
    suggestionValueTouchable: {
        flex: 1,
        alignItems: 'flex-end',
    },
    suggestionRowActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    suggestionActionButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F9FAFB',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    suggestionMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    suggestionMetaLeft: {
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
    suggestionFooter: {
        marginTop: 12,
        gap: 10,
        alignItems: 'stretch',
    },
    suggestionAddButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#F8FAFC',
        alignSelf: 'stretch',
    },
    suggestionAddButtonText: {
        fontSize: 12,
        color: modernColors.primary,
        fontWeight: '600',
    },
    suggestionApplyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        justifyContent: 'center',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
        alignSelf: 'stretch',
    },
    suggestionApplyText: {
        fontSize: 13,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    suggestionEmptyRow: {
        padding: 12,
        fontSize: 12,
        color: '#9CA3AF',
        textAlign: 'center',
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
    searchIconWrapper: {
        marginRight: 8,
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
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    combinationCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    combinationCardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 1,
    },
    combinationCardTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1F2937',
    },
    combinationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: modernColors.primary + '1A',
    },
    combinationBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.primary,
    },
    combinationTable: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        overflow: 'hidden',
    },
    combinationRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 12,
    },
    combinationRowLast: {
        borderBottomWidth: 0,
    },
    combinationCellLabel: {
        flex: 0.45,
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
        textTransform: 'capitalize',
    },
    combinationCellValue: {
        flex: 0.55,
        fontSize: 14,
        fontWeight: '600',
        color: '#1F2937',
        textAlign: 'right',
    },
    combinationMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    combinationMetaLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    combinationUsage: {
        fontSize: 11,
        color: '#6B7280',
    },
    combinationOccurrence: {
        fontSize: 11,
        color: modernColors.primary,
        fontWeight: '600',
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
