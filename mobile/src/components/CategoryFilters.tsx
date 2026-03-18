// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import React, { useEffect, useState } from 'react';
import {
    Animated,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { CategoryFilter, getCategoryFilters, getCategoryStyle, getCategoryTerminology } from '../config/categoryConfig';
import { modalityService } from '../services/modalityService'; // ✅ NOUVEAU: Service de modalités dynamiques
import { trackFilterSuggestion } from '../utils/analytics'; // ✅ OPTIMISATION 6
import SafeStorage from '../utils/safeStorage';
import { SmartFilterSuggestion } from '../utils/smartFilterSuggestions';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

const { width } = Dimensions.get('window');

interface CategoryFiltersProps {
    category: string;
    visible: boolean;
    onClose: () => void;
    onApply: (filters: Record<string, any>) => void;
    initialFilters?: Record<string, any>;
    smartSuggestions?: SmartFilterSuggestion[];  // ✅ NOUVEAU: Suggestions intelligentes
    filterHistory?: any[];                        // ✅ NOUVEAU: Historique des filtres
}

const CategoryFilters: React.FC<CategoryFiltersProps> = ({
    category,
    visible,
    onClose,
    onApply,
    initialFilters = {},
    smartSuggestions = [],
    filterHistory = [],
}) => {
    const categoryFilters = getCategoryFilters(category);
    const categoryStyle = getCategoryStyle(category);
    const terminology = getCategoryTerminology(category);

        const { t } = useLanguageSafe();
const [filters, setFilters] = useState<Record<string, any>>(initialFilters);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [fadeAnim] = useState(new Animated.Value(0));
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        'essentials': true, // Section essentielle toujours ouverte par défaut
        'specs': false,
        'features': false,
        'other': false
    });
    const [enrichedFilters, setEnrichedFilters] = useState<CategoryFilter[]>(categoryFilters); // ✅ NOUVEAU: Filtres enrichis dynamiquement
    const [loadingDynamicOptions, setLoadingDynamicOptions] = useState(false);

    // ✅ NOUVEAU: Charger les modalités dynamiques et enrichir les filtres
    useEffect(() => {
        const loadDynamicFilters = async () => {
            try {
                setLoadingDynamicOptions(true);
                console.log(`[CategoryFilters] \uD83D\uDD04 Chargement modalités dynamiques pour ${category}...`);

                // Charger toutes les modalités personnalisées
                await modalityService.loadCustomModalities();

                // Enrichir chaque filtre avec les modalités dynamiques
                const enriched: CategoryFilter[] = [];

                for (const filter of categoryFilters) {
                    if (filter.type === 'select' || filter.type === 'multiselect') {
                        // Charger les modalités dynamiques pour ce champ
                        const dynamicModalities = await modalityService.getModalitiesForField(
                            category,
                            filter.id
                        );

                        if (dynamicModalities.length > 0) {
                            console.log(`[CategoryFilters] ✅ ${dynamicModalities.length} modalités dynamiques pour ${filter.id}`);

                            // Combiner options statiques + dynamiques (sans doublons)
                            const staticOptions = filter.options || [];
                            const staticValues = new Set(staticOptions.map(o => o.value));

                            const dynamicOptions = dynamicModalities
                                .filter(m => !staticValues.has(m)) // Éviter doublons
                                .map(m => ({ value: m, label: m }));

                            enriched.push({
                                ...filter,
                                options: [...staticOptions, ...dynamicOptions] // Statiques en premier
                            });
                        } else {
                            // Pas de modalités dynamiques, garder le filtre original
                            enriched.push(filter);
                        }
                    } else {
                        // Autres types de filtres (range, toggle, etc.) restent inchangés
                        enriched.push(filter);
                    }
                }

                setEnrichedFilters(enriched);
                console.log(`[CategoryFilters] ✅ Filtres enrichis pour ${category}:`, enriched.length);
            } catch (error) {
                console.error('[CategoryFilters] ❌ Erreur chargement modalités dynamiques:', error);
                setEnrichedFilters(categoryFilters); // Fallback vers filtres statiques
            } finally {
                setLoadingDynamicOptions(false);
            }
        };

        if (visible && category) {
            loadDynamicFilters();
        }
    }, [category, visible]);

    // ✅ OPTIMISATION 4: Charger les filtres depuis le cache au montage
    useEffect(() => {
        const loadCachedFilters = async () => {
            try {
                const cacheKey = `filters_cache_${category}`;
                const cached = await SafeStorage.getItem(cacheKey);

                if (cached) {
                    const cachedFilters = JSON.parse(cached);
                    console.log(`[CategoryFilters] Cache trouvé pour ${category}:`, Object.keys(cachedFilters));

                    // Fusionner avec initialFilters (initialFilters prioritaire)
                    setFilters({ ...cachedFilters, ...initialFilters });
                }
            } catch (error) {
                console.error('[CategoryFilters] Erreur chargement cache:', error);
            }
        };

        if (visible && category) {
            loadCachedFilters();
        }
    }, [category, visible]);

    // Animation d'entrée
    useEffect(() => {
        if (visible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            fadeAnim.setValue(0);
        }
    }, [visible]);

    const handleApply = async () => {
        // ✅ OPTIMISATION 4: Sauvegarder les filtres dans le cache
        try {
            const cacheKey = `filters_cache_${category}`;
            await SafeStorage.setItem(cacheKey, JSON.stringify(filters));
            console.log(`[CategoryFilters] Filtres sauvegardés en cache pour ${category}`);
        } catch (error) {
            console.error('[CategoryFilters] Erreur sauvegarde cache:', error);
        }

        onApply(filters);
        onClose();
    };

    const handleReset = () => {
        setFilters({});
    };

    // ✅ NOUVEAU: Appliquer une suggestion intelligente
    const applySuggestion = (suggestion: SmartFilterSuggestion) => {
        const newFilters = { ...filters };

        if (suggestion.type === 'range') {
            newFilters[`${suggestion.id}_min`] = suggestion.min;
            newFilters[`${suggestion.id}_max`] = suggestion.max;
            console.log(`\uD83D\uDCA1 Suggestion appliquée (range): ${suggestion.label} - ${suggestion.min} à ${suggestion.max}`);
        } else if (suggestion.type === 'select' || suggestion.type === 'multiselect') {
            newFilters[suggestion.id] = suggestion.options?.[0]?.value || null;
            console.log(`\uD83D\uDCA1 Suggestion appliquée (select): ${suggestion.label} = ${suggestion.options?.[0]?.value}`);
        } else {
            newFilters[suggestion.id] = suggestion.options?.[0]?.value || null;
            console.log(`\uD83D\uDCA1 Suggestion appliquée: ${suggestion.label}`);
        }

        setFilters(newFilters);

        // ✅ FEEDBACK VISUEL: Faire défiler vers la section concernée
        const sectionKey = getSectionKeyForFilter(suggestion.id);
        if (sectionKey && !expandedSections[sectionKey]) {
            setExpandedSections(prev => ({ ...prev, [sectionKey]: true }));
        }

        // ✅ OPTIMISATION 6: Track l'application de la suggestion
        trackFilterSuggestion(category, suggestion.id, suggestion.label);

        // ✅ Masquer les suggestions après application
        setShowSuggestions(false);
    };

    // ✅ Déterminer dans quelle section se trouve un filtre
    const getSectionKeyForFilter = (filterId: string): string | null => {
        if (filterId.includes('prix') || filterId.includes('date') || filterId.includes('disponibilit') ||
            filterId.includes('stock') || filterId.includes('promotion')) {
            return 'essentials';
        }
        if (filterId.includes('taille') || filterId.includes('poids') || filterId.includes('capacite') ||
            filterId.includes('puissance') || filterId.includes('ram') || filterId.includes('stockage')) {
            return 'specs';
        }
        if (filterId.includes('avec') || filterId.includes('sans')) {
            return 'features';
        }
        return 'other';
    };

    // ✅ NOUVEAU: Appliquer un filtre de l'historique
    const applyHistoryFilter = (historyItem: any) => {
        setFilters(historyItem.filters);
        console.log(`\uD83D\uDCDC Historique appliqué: ${Object.keys(historyItem.filters).length} filtres`);
    };

    const renderFilter = (filter: CategoryFilter) => {
        switch (filter.type) {
            case 'range':
                return (
                    <View key={filter.id} style={styles.filterContainer}>
                        <Text style={styles.filterLabel}>{filter.label}</Text>
                        <View style={styles.rangeContainer}>
                            <View style={styles.rangeInputContainer}>
                                <Text style={styles.rangeInputLabel}>Min</Text>
                                <TextInput
                                    style={styles.rangeInput}
                                    value={filters[`${filter.id}_min`]?.toString() || ''}
                                    onChangeText={(text) => setFilters({
                                        ...filters,
                                        [`${filter.id}_min`]: text ? parseFloat(text) : null,
                                    })}
                                    placeholder={filter.min?.toString()}
                                    keyboardType="numeric"
                                />
                                {filter.unit && (
                                    <Text style={styles.rangeUnit}>{filter.unit}</Text>
                                )}
                            </View>
                            <Text style={styles.rangeSeparator}>-</Text>
                            <View style={styles.rangeInputContainer}>
                                <Text style={styles.rangeInputLabel}>Max</Text>
                                <TextInput
                                    style={styles.rangeInput}
                                    value={filters[`${filter.id}_max`]?.toString() || ''}
                                    onChangeText={(text) => setFilters({
                                        ...filters,
                                        [`${filter.id}_max`]: text ? parseFloat(text) : null,
                                    })}
                                    placeholder={filter.max?.toString()}
                                    keyboardType="numeric"
                                />
                                {filter.unit && (
                                    <Text style={styles.rangeUnit}>{filter.unit}</Text>
                                )}
                            </View>
                        </View>
                    </View>
                );

            case 'select':
                return (
                    <View key={filter.id} style={styles.filterContainer}>
                        <Text style={styles.filterLabel}>{filter.label}</Text>
                        {/* ✅ NOUVEAU: Grille compacte 3 colonnes pour select */}
                        <View style={styles.selectGridContainer}>
                            {filter.options?.map((option, idx) => {
                                // ✅ Détecter si c'est une option dynamique (ajoutée après les options statiques de base)
                                const baseFilter = categoryFilters.find(f => f.id === filter.id);
                                const baseOptionsCount = baseFilter?.options?.length || 0;
                                const isDynamic = idx >= baseOptionsCount;

                                return (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[
                                            styles.selectGridOption,
                                            filters[filter.id] === option.value && {
                                                backgroundColor: categoryStyle.primaryColor,
                                                borderColor: categoryStyle.primaryColor,
                                            },
                                            isDynamic && styles.dynamicOption, // ✅ Style pour options dynamiques
                                        ]}
                                        onPress={() => setFilters({
                                            ...filters,
                                            [filter.id]: filters[filter.id] === option.value ? null : option.value,
                                        })}
                                    >
                                        <Text
                                            style={[
                                                styles.selectGridText,
                                                filters[filter.id] === option.value && styles.selectGridTextActive,
                                            ]}
                                            numberOfLines={2}
                                        >
                                            {option.label}
                                        </Text>
                                        {/* ✅ Badge "Nouveau" pour options dynamiques */}
                                        {isDynamic && filters[filter.id] !== option.value && (
                                            <View style={styles.newBadge}>
                                                <Text style={styles.newBadgeText}>✨</Text>
                                            </View>
                                        )}
                                        {filters[filter.id] === option.value && (
                                            <SafeIcon name="check" size={12} color="#FFFFFF" style={styles.checkIconSelect} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                );

            case 'multiselect':
                return (
                    <View key={filter.id} style={styles.filterContainer}>
                        <Text style={styles.filterLabel}>{filter.label}</Text>
                        {/* ✅ NOUVEAU: Grille compacte 2 colonnes au lieu d'une liste */}
                        <View style={styles.multiselectGridContainer}>
                            {filter.options?.map((option, idx) => {
                                const isSelected = Array.isArray(filters[filter.id]) &&
                                    filters[filter.id].includes(option.value);

                                // ✅ Détecter si c'est une option dynamique
                                const baseFilter = categoryFilters.find(f => f.id === filter.id);
                                const baseOptionsCount = baseFilter?.options?.length || 0;
                                const isDynamic = idx >= baseOptionsCount;

                                return (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[
                                            styles.multiselectGridOption,
                                            isSelected && {
                                                backgroundColor: categoryStyle.badgeColor,
                                                borderColor: categoryStyle.primaryColor,
                                                borderWidth: 2,
                                            },
                                            isDynamic && styles.dynamicOption, // ✅ Style pour options dynamiques
                                        ]}
                                        onPress={() => {
                                            const currentValues = filters[filter.id] || [];
                                            const newValues = isSelected
                                                ? currentValues.filter((v: string) => v !== option.value)
                                                : [...currentValues, option.value];
                                            setFilters({
                                                ...filters,
                                                [filter.id]: newValues.length > 0 ? newValues : null,
                                            });
                                        }}
                                    >
                                        {isSelected && (
                                            <SafeIcon name="check-circle" size={16} color={categoryStyle.primaryColor} style={styles.checkIconGrid} />
                                        )}
                                        <Text
                                            style={[
                                                styles.multiselectGridText,
                                                isSelected && { color: categoryStyle.primaryColor, fontWeight: '700' },
                                            ]}
                                            numberOfLines={2}
                                            ellipsizeMode="tail"
                                        >
                                            {option.label}
                                        </Text>
                                        {/* ✅ Badge "Nouveau" pour options dynamiques */}
                                        {isDynamic && !isSelected && (
                                            <View style={styles.newBadge}>
                                                <Text style={styles.newBadgeText}>✨</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                );

            case 'toggle':
                return (
                    <View key={filter.id} style={styles.filterContainer}>
                        <View style={styles.toggleContainer}>
                            <Text style={styles.filterLabel}>{filter.label}</Text>
                            <Switch
                                value={filters[filter.id] || false}
                                onValueChange={(value) => setFilters({
                                    ...filters,
                                    [filter.id]: value || null,
                                })}
                                trackColor={{ false: '#D1D5DB', true: categoryStyle.primaryColor }}
                                thumbColor="#FFFFFF"
                            />
                        </View>
                    </View>
                );

            case 'text':
                return (
                    <View key={filter.id} style={styles.filterContainer}>
                        <Text style={styles.filterLabel}>{filter.label}</Text>
                        <TextInput
                            style={styles.textInput}
                            value={filters[filter.id] || ''}
                            onChangeText={(text) => setFilters({
                                ...filters,
                                [filter.id]: text || null,
                            })}
                            placeholder={filter.placeholder || 'Saisir...'}
                        />
                    </View>
                );

            case 'date':
                return (
                    <View key={filter.id} style={styles.filterContainer}>
                        <Text style={styles.filterLabel}>{filter.label}</Text>
                        <TextInput
                            style={styles.textInput}
                            value={filters[filter.id] || ''}
                            onChangeText={(text) => setFilters({
                                ...filters,
                                [filter.id]: text || null,
                            })}
                            placeholder="JJ/MM/AAAA"
                        />
                    </View>
                );

            case 'time':
                return (
                    <View key={filter.id} style={styles.filterContainer}>
                        <Text style={styles.filterLabel}>{filter.label}</Text>
                        <TextInput
                            style={styles.textInput}
                            value={filters[filter.id] || ''}
                            onChangeText={(text) => setFilters({
                                ...filters,
                                [filter.id]: text || null,
                            })}
                            placeholder="HH:MM"
                        />
                    </View>
                );

            default:
                return null;
        }
    };

    // Compter le nombre de filtres actifs
    const activeFiltersCount = Object.keys(filters).filter((key) => {
        const value = filters[key];
        return value !== null && value !== undefined && value !== '';
    }).length;

    // ✅ NOUVEAU: Grouper les filtres par sections logiques
    const groupFiltersBySection = (): Record<string, CategoryFilter[]> => {
        const sections: Record<string, CategoryFilter[]> = {
            essentials: [],  // Prix, disponibilité, etc.
            specs: [],       // Caractéristiques techniques
            features: [],    // Fonctionnalités optionnelles
            other: []        // Autres filtres
        };

        // ✅ UTILISER enrichedFilters au lieu de categoryFilters (options dynamiques)
        enrichedFilters.forEach(filter => {
            // Filtres essentiels (prix, dates, etc.)
            if (filter.id.includes('prix') || filter.id.includes('date') || filter.id.includes('disponibilit') ||
                filter.id.includes('stock') || filter.id.includes('promotion')) {
                sections.essentials.push(filter);
            }
            // Spécifications techniques (taille, poids, capacité, etc.)
            else if (filter.id.includes('taille') || filter.id.includes('poids') || filter.id.includes('capacite') ||
                filter.id.includes('puissance') || filter.id.includes('ram') || filter.id.includes('stockage') ||
                filter.id.includes('processeur') || filter.id.includes('cylindree') || filter.id.includes('annee')) {
                sections.specs.push(filter);
            }
            // Fonctionnalités optionnelles (toggle généralement)
            else if (filter.type === 'toggle' || filter.id.includes('avec') || filter.id.includes('sans')) {
                sections.features.push(filter);
            }
            // Autres filtres
            else {
                sections.other.push(filter);
            }
        });

        // Supprimer les sections vides
        Object.keys(sections).forEach(key => {
            if (sections[key].length === 0) {
                delete sections[key];
            }
        });

        return sections;
    };

    const toggleSection = (sectionKey: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionKey]: !prev[sectionKey]
        }));
    };

    const getSectionTitle = (sectionKey: string): string => {
        switch (sectionKey) {
            case 'essentials': return '⭐ Filtres Essentiels';
            case 'specs': return t('categoryFilters.specificationsTechniques');
            case 'features': return t('categoryFilters.fonctionnalites');
            case 'other': return t('categoryFilters.autresCriteres');
            default: return 'Filtres';
        }
    };

    const getSectionIcon = (sectionKey: string): string => {
        switch (sectionKey) {
            case 'essentials': return 'star';
            case 'specs': return 'cpu';
            case 'features': return 'zap';
            case 'other': return 'list';
            default: return 'filter';
        }
    };

    // ✅ NOUVEAU: Formater le temps écoulé
    const formatTimeAgo = (timestamp: number): string => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 60) return 'Il y a quelques secondes';
        if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
        if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)}h`;
        return `Il y a ${Math.floor(seconds / 86400)}j`;
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <View style={styles.modalTitleContainer}>
                            <Text style={styles.modalTitle}>Filtrer les {terminology.productsLabel.toLowerCase()}</Text>
                            {activeFiltersCount > 0 && (
                                <View style={[styles.filterBadge, { backgroundColor: categoryStyle.primaryColor }]}>
                                    <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
                                </View>
                            )}
                            {/* ✅ NOUVEAU: Indicateur de chargement des options dynamiques */}
                            {loadingDynamicOptions && (
                                <View style={styles.dynamicLoadingBadge}>
                                    <Text style={styles.dynamicLoadingText}>{t('categoryFilters.chargement')}</Text>
                                </View>
                            )}
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#1F2937" />
                        </TouchableOpacity>
                    </View>

                    {/* ✅ NOUVEAU: Suggestions Intelligentes */}
                    {smartSuggestions.length > 0 && (
                        <View style={styles.suggestionsSection}>
                            <TouchableOpacity
                                style={styles.sectionToggle}
                                onPress={() => setShowSuggestions(!showSuggestions)}
                            >
                                <View style={styles.sectionTitleContainer}>
                                    <SafeIcon name="lightbulb" size={20} color={categoryStyle.primaryColor} />
                                    <Text style={styles.sectionTitle}>
                                        Suggestions intelligentes ({smartSuggestions.length})
                                    </Text>
                                </View>
                                <SafeIcon
                                    name={showSuggestions ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color="#6B7280"
                                />
                            </TouchableOpacity>

                            {showSuggestions && (
                                <Animated.View style={{ opacity: fadeAnim }}>
                                    {/* ✅ NOUVEAU: Indication pour l'utilisateur */}
                                    <Text style={styles.suggestionHint}>
                                        \uD83D\uDC46 Cliquez pour appliquer un filtre recommandé
                                    </Text>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.suggestionsScroll}
                                    >
                                        {smartSuggestions.slice(0, 5).map((suggestion, index) => (
                                            <TouchableOpacity
                                                key={index}
                                                style={[
                                                    styles.suggestionCard,
                                                    { borderColor: categoryStyle.primaryColor }
                                                ]}
                                                onPress={() => applySuggestion(suggestion)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.suggestionHeader}>
                                                    <View style={[
                                                        styles.priorityBadge,
                                                        { backgroundColor: categoryStyle.badgeColor }
                                                    ]}>
                                                        <Text style={[
                                                            styles.priorityText,
                                                            { color: categoryStyle.primaryColor }
                                                        ]}>
                                                            {suggestion.priority}/10
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.suggestionCount}>
                                                        {suggestion.applicableCount}+
                                                    </Text>
                                                </View>
                                                <Text style={styles.suggestionLabel}>
                                                    {suggestion.label}
                                                </Text>
                                                <Text style={styles.suggestionReason}>
                                                    {suggestion.reason}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </Animated.View>
                            )}
                        </View>
                    )}

                    {/* ✅ NOUVEAU: Historique des filtres */}
                    {filterHistory.length > 0 && (
                        <View style={styles.historySection}>
                            <TouchableOpacity
                                style={styles.sectionToggle}
                                onPress={() => setShowHistory(!showHistory)}
                            >
                                <View style={styles.sectionTitleContainer}>
                                    <SafeIcon name="clock" size={20} color="#F59E0B" />
                                    <Text style={styles.sectionTitle}>
                                        Historique ({filterHistory.length})
                                    </Text>
                                </View>
                                <SafeIcon
                                    name={showHistory ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color="#6B7280"
                                />
                            </TouchableOpacity>

                            {showHistory && (
                                <View style={styles.historyList}>
                                    {filterHistory.slice(0, 3).map((item, index) => {
                                        const filterCount = Object.keys(item.filters).length;
                                        const timeAgo = formatTimeAgo(item.timestamp);

                                        return (
                                            <TouchableOpacity
                                                key={index}
                                                style={styles.historyItem}
                                                onPress={() => applyHistoryFilter(item)}
                                            >
                                                <View style={styles.historyInfo}>
                                                    <Text style={styles.historyFilterCount}>
                                                        {filterCount} filtre{filterCount > 1 ? 's' : ''}
                                                    </Text>
                                                    <Text style={styles.historyTime}>{timeAgo}</Text>
                                                </View>
                                                <View style={styles.historyResults}>
                                                    <Text style={styles.historyResultsText}>
                                                        {item.resultCount} résultat{item.resultCount > 1 ? 's' : ''}
                                                    </Text>
                                                    <SafeIcon name="arrow-right" size={16} color={categoryStyle.primaryColor} />
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    )}

                    {/* ✅ NOUVEAU: Filtres organisés en sections accordéon */}
                    <ScrollView style={styles.filtersContent} showsVerticalScrollIndicator={false}>
                        {(() => {
                            const sections = groupFiltersBySection();
                            return Object.entries(sections).map(([sectionKey, sectionFilters]) => (
                                <View key={sectionKey} style={styles.accordionSection}>
                                    {/* Header de section cliquable */}
                                    <TouchableOpacity
                                        style={[
                                            styles.accordionHeader,
                                            expandedSections[sectionKey] && styles.accordionHeaderExpanded
                                        ]}
                                        onPress={() => toggleSection(sectionKey)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.accordionTitleContainer}>
                                            <SafeIcon
                                                name={getSectionIcon(sectionKey)}
                                                size={20}
                                                color={expandedSections[sectionKey] ? categoryStyle.primaryColor : '#6B7280'}
                                            />
                                            <Text style={[
                                                styles.accordionTitle,
                                                expandedSections[sectionKey] && { color: categoryStyle.primaryColor }
                                            ]}>
                                                {getSectionTitle(sectionKey)}
                                            </Text>
                                            <View style={[styles.accordionBadge, { backgroundColor: categoryStyle.badgeColor }]}>
                                                <Text style={styles.accordionBadgeText}>{sectionFilters.length}</Text>
                                            </View>
                                        </View>
                                        <SafeIcon
                                            name={expandedSections[sectionKey] ? "chevron-up" : "chevron-down"}
                                            size={20}
                                            color={expandedSections[sectionKey] ? categoryStyle.primaryColor : '#6B7280'}
                                        />
                                    </TouchableOpacity>

                                    {/* Contenu de la section (collapsible) */}
                                    {expandedSections[sectionKey] && (
                                        <View style={styles.accordionContent}>
                                            {sectionFilters.map((filter) => renderFilter(filter))}
                                        </View>
                                    )}
                                </View>
                            ));
                        })()}
                    </ScrollView>

                    {/* Actions */}
                    <View style={styles.modalActions}>
                        <TouchableOpacity
                            style={styles.resetButton}
                            onPress={handleReset}
                        >
                            <SafeIcon name="refresh-cw" size={18} color="#6B7280" />
                            <Text style={styles.resetButtonText}>{t('categoryFilters.reinitialiser')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.applyButton, { backgroundColor: categoryStyle.primaryColor }]}
                            onPress={handleApply}
                        >
                            <SafeIcon name="check" size={18} color="#FFFFFF" />
                            <Text style={styles.applyButtonText}>Appliquer</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '90%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    modalTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2937',
    },
    filterBadge: {
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 2,
        minWidth: 24,
        alignItems: 'center',
    },
    filterBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    closeButton: {
        padding: 4,
    },
    filtersContent: {
        padding: 16, // ✅ Réduit de 20 à 16 pour compacité
    },
    filterContainer: {
        marginBottom: 16, // ✅ Réduit de 24 à 16 pour compacité
    },
    filterLabel: {
        fontSize: 14, // ✅ Réduit de 15 à 14 pour compacité
        fontWeight: '600',
        color: '#1F2937',
        marginBottom: 8, // ✅ Réduit de 12 à 8 pour compacité
    },
    rangeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rangeInputContainer: {
        flex: 1,
        gap: 6,
    },
    rangeInputLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: '#6B7280',
    },
    rangeInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: '#1F2937',
        backgroundColor: '#F9FAFB',
    },
    rangeUnit: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    rangeSeparator: {
        fontSize: 18,
        fontWeight: '600',
        color: '#9CA3AF',
        marginTop: 20,
    },
    selectContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    selectOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    selectOptionText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#4B5563',
    },
    selectOptionTextActive: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    multiselectContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    multiselectOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    multiselectOptionText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#4B5563',
    },
    toggleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 14,
        color: '#1F2937',
        backgroundColor: '#F9FAFB',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    resetButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
    },
    resetButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#6B7280',
    },
    applyButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    applyButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    // ✅ NOUVEAU: Styles pour les sections accordéon
    accordionSection: {
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    accordionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderBottomWidth: 0,
    },
    accordionHeaderExpanded: {
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    accordionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    accordionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#374151',
        flex: 1,
    },
    accordionBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        minWidth: 24,
        alignItems: 'center',
    },
    accordionBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    accordionContent: {
        padding: 16,
        paddingTop: 12,
        backgroundColor: '#FFFFFF',
    },
    // ✅ NOUVEAU: Grille pour multiselect (2 colonnes)
    multiselectGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    multiselectGridOption: {
        width: '48%', // 2 colonnes avec gap
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
        minHeight: 48,
    },
    multiselectGridText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#4B5563',
        flex: 1,
    },
    checkIconGrid: {
        marginRight: 2,
    },
    // ✅ NOUVEAU: Grille pour select (3 colonnes)
    selectGridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
    },
    selectGridOption: {
        width: '31%', // 3 colonnes avec gap
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
        minHeight: 48,
        position: 'relative',
    },
    selectGridText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#4B5563',
        textAlign: 'center',
    },
    selectGridTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    checkIconSelect: {
        position: 'absolute',
        top: 4,
        right: 4,
    },
    // ✅ NOUVEAU: Styles pour options dynamiques
    dynamicOption: {
        borderColor: '#10B981', // Vert pour "nouveau"
        borderWidth: 2,
        backgroundColor: '#F0FDF4', // Fond vert très clair
    },
    newBadge: {
        position: 'absolute',
        top: 2,
        left: 2,
        backgroundColor: 'transparent',
    },
    newBadgeText: {
        fontSize: 14,
    },
    // ✅ NOUVEAU: Badge de chargement dynamique
    dynamicLoadingBadge: {
        marginTop: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        backgroundColor: '#FEF3C7',
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    dynamicLoadingText: {
        fontSize: 11,
        color: '#92400E',
        fontWeight: '600',
    },
    // ✅ NOUVEAUX STYLES: Suggestions & Historique
    suggestionsSection: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    suggestionHint: {
        fontSize: 12,
        color: '#6B7280',
        fontStyle: 'italic',
        marginBottom: 12,
        textAlign: 'center',
    },
    historySection: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        backgroundColor: '#FFFBEB',
    },
    sectionToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
    },
    suggestionsScroll: {
        paddingTop: 12,
        paddingRight: 20,
        gap: 12,
    },
    suggestionCard: {
        width: width * 0.7,
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    suggestionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    priorityBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    priorityText: {
        fontSize: 12,
        fontWeight: '800',
    },
    suggestionCount: {
        fontSize: 16,
        fontWeight: '700',
        color: '#10B981',
    },
    suggestionLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 6,
    },
    suggestionReason: {
        fontSize: 12,
        color: '#6B7280',
        fontStyle: 'italic',
    },
    historyList: {
        marginTop: 12,
        gap: 10,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#FDE68A',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    historyInfo: {
        flex: 1,
    },
    historyFilterCount: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 4,
    },
    historyTime: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    historyResults: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    historyResultsText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#F59E0B',
    },
});

export default CategoryFilters;

