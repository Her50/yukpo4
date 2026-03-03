/**
 * Composant LinearAutocompleteEditor
 * Autocomplete linéaire avec affichage horizontal des suggestions (style SelectorLocation)
 * Permet édition inline, ajout de modalités personnalisées, et cache des suggestions IA
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { autocompleteHistoryService } from '../services/autocompleteHistoryService';
import { placesService } from '../services/placesService';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import SubCharacteristicsTable, { SubCharacteristicRow } from './SubCharacteristicsTable';

interface LinearAutocompleteEditorProps {
    label: string;
    identifiantBase: string;
    sousCaracteristiques: Record<string, string[]>; // Ex: { style: ["Moderne"], matiere: ["Bois"] }
    separateur: string;
    value: string[]; // Modalités concaténées: ["Moderne,Bois,Table,6 places"]
    onChange: (values: string[], updatedSousCaracs?: Record<string, string[]>) => void;
    required?: boolean;
    placeholder?: string;
    allowCustomModality?: boolean;
    filtrable?: boolean;
    // Props optionnelles utilisées par les écrans
    contextValues?: string[];
    categoryValue?: string;
    productVector?: string[];
    productLabels?: string[];
}

interface ModalityChip {
    key: string; // Ex: "style"
    value: string; // Ex: "Moderne"
    index: number; // Position dans la modalité concaténée
}

export const LinearAutocompleteEditor: React.FC<LinearAutocompleteEditorProps> = ({
    label,
    identifiantBase,
    sousCaracteristiques,
    separateur,
    value,
    onChange,
    required = false,
    placeholder,
    allowCustomModality = true,
    filtrable = true,
    productLabels, // ✅ AJOUT: Pour garantir l'ordre correct des labels
}) => {
    const [selectedModalities, setSelectedModalities] = useState<string[]>(value || []);
    const [searchQuery, setSearchQuery] = useState('');
    const [iaSuggestions, setIaSuggestions] = useState<string[]>([]);
    const [dbSuggestions, setDbSuggestions] = useState<string[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingModalityIndex, setEditingModalityIndex] = useState<number | null>(null);
    const [customKey, setCustomKey] = useState('');
    const [customValue, setCustomValue] = useState('');
    const [showTable, setShowTable] = useState(false); // Afficher le tableau au lieu des chips
    const [tableRows, setTableRows] = useState<SubCharacteristicRow[]>([]);

    // ✅ NOUVEAU: Détecter si on doit afficher le tableau (si on a des sous-caractéristiques préférées de l'IA)
    useEffect(() => {
        const hasSubCharacteristics = sousCaracteristiques &&
            Object.keys(sousCaracteristiques).length > 0 &&
            Object.values(sousCaracteristiques).some(vals => Array.isArray(vals) && vals.length > 0);

        // Afficher le tableau si on a des sous-caractéristiques
        // Le tableau s'affiche en priorité pour permettre l'édition des sous-caractéristiques préférées de l'IA
        if (hasSubCharacteristics) {
            setShowTable(true);
        }
    }, [sousCaracteristiques]);

    // ✅ NOUVEAU: Convertir les modalités sélectionnées en lignes du tableau
    useEffect(() => {
        if (selectedModalities.length > 0 && !showTable) {
            // Si on a des modalités sélectionnées, les convertir en lignes
            const firstModality = selectedModalities[0];
            if (firstModality) {
                const chips = decomposeModality(firstModality);
                const rows: SubCharacteristicRow[] = chips.map(chip => ({
                    label: chip.key,
                    value: chip.value,
                }));
                setTableRows(rows);
            }
        }
    }, [selectedModalities, showTable]);

    // Extraire les suggestions de l'IA au montage (cache instantané)
    useEffect(() => {
        const iaCache: string[] = [];
        const subCharKeys = Object.keys(sousCaracteristiques);

        // Créer des modalités complètes à partir des suggestions IA
        if (subCharKeys.length > 0) {
            // Prendre les premières valeurs de chaque caractéristique pour créer des exemples
            const firstValues = subCharKeys.map(key => {
                const values = sousCaracteristiques[key];
                return Array.isArray(values) && values.length > 0 ? values[0] : '';
            });

            // Créer une modalité exemple avec toutes les caractéristiques
            if (firstValues.every(v => v)) {
                iaCache.push(firstValues.join(separateur));
            }

            // Créer des variantes avec différentes combinaisons
            subCharKeys.forEach((key, idx) => {
                const values = sousCaracteristiques[key];
                if (Array.isArray(values) && values.length > 1) {
                    // Pour chaque valeur supplémentaire, créer une variante
                    for (let i = 1; i < Math.min(values.length, 3); i++) {
                        const variant = [...firstValues];
                        variant[idx] = values[i];
                        if (variant.every(v => v)) {
                            iaCache.push(variant.join(separateur));
                        }
                    }
                }
            });
        }

        setIaSuggestions(iaCache);
    }, [sousCaracteristiques, separateur]);

    // ✅ AMÉLIORATION: Détecter si une caractéristique est de type localisation
    const isLocationCharacteristic = (key: string): boolean => {
        const locationKeys = ['localisation', 'ville', 'quartier', 'zone', 'lieu', 'city', 'location'];
        return locationKeys.includes(key.toLowerCase());
    };

    // Charger les suggestions DB quand on tape (avec support intelligent pour localisation)
    useEffect(() => {
        if (!searchQuery || searchQuery.length < 1) {
            setDbSuggestions([]);
            return;
        }

        const loadDbSuggestions = async () => {
            setIsLoadingSuggestions(true);
            try {
                const allSuggestions: string[] = [];
                const subCharKeys = Object.keys(sousCaracteristiques);

                for (const key of subCharKeys) {
                    // ✅ NOUVEAU: Si c'est une localisation, utiliser placesService
                    if (isLocationCharacteristic(key)) {
                        try {
                            const locationSuggestions = await placesService.autocomplete(searchQuery, 'city');

                            // Créer des modalités complètes avec ces lieux
                            locationSuggestions.slice(0, 5).forEach(lieu => {
                                const modalityParts = subCharKeys.map(k =>
                                    k === key ? lieu : (sousCaracteristiques[k][0] || '')
                                );
                                if (modalityParts.every(p => p)) {
                                    allSuggestions.push(modalityParts.join(separateur));
                                }
                            });
                        } catch (error) {
                            console.error('[LinearAutocompleteEditor] Erreur chargement lieux:', error);
                        }
                    } else {
                        // Utiliser autocompleteHistoryService pour les autres caractéristiques
                        const suggestions = await autocompleteHistoryService.getSuggestions(
                            identifiantBase,
                            key,
                            searchQuery,
                            5
                        );

                        // Créer des modalités complètes avec ces suggestions
                        suggestions.forEach(sugg => {
                            const modalityParts = subCharKeys.map(k =>
                                k === key ? sugg.valeur : (sousCaracteristiques[k][0] || '')
                            );
                            if (modalityParts.every(p => p)) {
                                allSuggestions.push(modalityParts.join(separateur));
                            }
                        });
                    }
                }

                setDbSuggestions(allSuggestions);
            } catch (error) {
                console.error('[LinearAutocompleteEditor] Erreur chargement suggestions:', error);
            } finally {
                setIsLoadingSuggestions(false);
            }
        };

        const timeoutId = setTimeout(loadDbSuggestions, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, identifiantBase, sousCaracteristiques, separateur]);

    // Décomposer une modalité en chips (ordre = getOrderedLabels pour alignement prestations)
    const decomposeModality = (modality: string): ModalityChip[] => {
        const parts = modality.split(separateur).map(p => p.trim());
        const orderedLabels = getOrderedLabels();

        // ✅ CORRECTION CRITIQUE: Matching intelligent valeur→dimension
        // L'IA peut générer une chaîne incohérente (ex: 5 valeurs pour 7 labels, ou valeurs mal ordonnées).
        // Au lieu de mapper bêtement par index, on cherche pour chaque valeur la dimension qui la contient.
        const usedLabels = new Set<string>();

        return parts.map((value, index) => {
            const valueLower = value.toLowerCase().trim();

            // PRIORITÉ 1: Vérifier si la valeur existe dans la dimension à la même position
            if (index < orderedLabels.length) {
                const positionalLabel = orderedLabels[index];
                const positionalValues = sousCaracteristiques[positionalLabel];
                if (Array.isArray(positionalValues) && positionalValues.some(v => v.toLowerCase().trim() === valueLower) && !usedLabels.has(positionalLabel)) {
                    usedLabels.add(positionalLabel);
                    return { key: positionalLabel, value: value, index: index };
                }
            }

            // PRIORITÉ 2: Chercher dans TOUTES les dimensions (non encore utilisées) laquelle contient cette valeur
            const matchingLabel = orderedLabels.find(label => {
                if (usedLabels.has(label)) return false;
                const values = sousCaracteristiques[label];
                return Array.isArray(values) && values.some(v => v.toLowerCase().trim() === valueLower);
            }) || Object.keys(sousCaracteristiques).find(key => {
                if (usedLabels.has(key)) return false;
                const values = sousCaracteristiques[key];
                return Array.isArray(values) && values.some(v => v.toLowerCase().trim() === valueLower);
            });

            if (matchingLabel) {
                usedLabels.add(matchingLabel);
                return { key: matchingLabel, value: value, index: index };
            }

            // PRIORITÉ 3: Fallback positionnel si aucun match trouvé
            let label = index < orderedLabels.length ? orderedLabels[index] : `caractéristique_${index + 1}`;

            return {
                key: label,
                value: value,
                index: index,
            };
        });
    };

    // Ajouter une modalité
    const addModality = useCallback((modality: string) => {
        if (!modality || selectedModalities.includes(modality)) return;

        const newModalities = [...selectedModalities, modality];
        setSelectedModalities(newModalities);
        onChange(newModalities);
        setSearchQuery('');

        // Historiser
        autocompleteHistoryService
            .historizeField(
                identifiantBase,
                [modality],
                separateur,
                sousCaracteristiques,
                'utilisateur'
            )
            .catch(console.error);
    }, [selectedModalities, onChange, identifiantBase, separateur, sousCaracteristiques]);

    // Supprimer une modalité
    const removeModality = useCallback((index: number) => {
        const newModalities = selectedModalities.filter((_, i) => i !== index);
        setSelectedModalities(newModalities);
        onChange(newModalities);
    }, [selectedModalities, onChange]);

    // Éditer une modalité
    const editModality = useCallback((index: number) => {
        setEditingModalityIndex(index);
        const modality = selectedModalities[index];
        const chips = decomposeModality(modality);
        // Pré-remplir le formulaire d'édition si besoin
    }, [selectedModalities]);

    // Ajouter une modalité personnalisée
    const addCustomModality = useCallback(() => {
        if (!customKey || !customValue) return;

        // Créer une modalité avec cette nouvelle caractéristique
        const subCharKeys = Object.keys(sousCaracteristiques);
        const modalityParts = subCharKeys.map(key => {
            if (key === customKey) return customValue;
            return sousCaracteristiques[key][0] || '';
        });

        // Si la clé n'existe pas, l'ajouter à la fin
        if (!subCharKeys.includes(customKey)) {
            modalityParts.push(customValue);
        }

        const newModality = modalityParts.filter(p => p).join(separateur);
        addModality(newModality);

        setShowAddModal(false);
        setCustomKey('');
        setCustomValue('');
    }, [customKey, customValue, sousCaracteristiques, separateur, addModality]);

    // ✅ NOUVEAU: Callback pour valider le tableau (maintenant async pour gérer les erreurs)
    // ✅ Même logique que SubCharacteristicsTable: associer productLabel → clé réelle (prestations)
    const normalizeForMatch = (s: string) =>
        s.trim().toLowerCase()
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .replace(/\s+/g, '_').replace(/-/g, '_');
    const findMatchingKey = (label: string): string | null => {
        const trimmed = label.trim();
        if (sousCaracteristiques.hasOwnProperty(trimmed)) return trimmed;
        const normalized = normalizeForMatch(trimmed);
        return Object.keys(sousCaracteristiques).find(k =>
            normalizeForMatch(k) === normalized || k.toLowerCase() === trimmed.toLowerCase()
            || (normalized.length >= 2 && normalizeForMatch(k).startsWith(normalized))
            || (normalized.length >= 2 && normalizeForMatch(k).includes(normalized))
        ) ?? null;
    };
    const getOrderedLabels = (): string[] => {
        if (productLabels && Array.isArray(productLabels) && productLabels.length > 0) {
            const seen = new Set<string>();
            const out: string[] = [];
            for (const label of productLabels) {
                if (!label || typeof label !== 'string') continue;
                const key = findMatchingKey(label);
                if (key && !seen.has(key)) { seen.add(key); out.push(key); }
            }
            if (out.length > 0) return out;
        }
        return Object.keys(sousCaracteristiques);
    };

    const handleTableValidate = useCallback(async (rows: SubCharacteristicRow[]) => {
        try {
            // ✅ CORRECTION CRITIQUE: Utiliser les lignes du tableau DIRECTEMENT (dans leur ordre actuel)
            // au lieu de chercher par label dans orderedLabels, car l'utilisateur peut avoir modifié les labels
            const validRows = rows.filter(row => row.label.trim().length > 0 && row.value.trim().length > 0);

            // Construire la modalité directement depuis les lignes du tableau (ordre = ordre des lignes)
            const modalityParts = validRows.map(row => row.value.trim());
            const modality = modalityParts.join(separateur);

            // Mettre à jour les modalités sélectionnées
            const newModalities = [modality];
            setSelectedModalities(newModalities);

            // Construire les sous-caractéristiques mises à jour depuis les lignes du tableau
            const updatedSousCaracs: Record<string, string[]> = {};
            validRows.forEach(row => {
                const label = row.label.trim();
                if (!updatedSousCaracs[label]) {
                    // Préserver les valeurs existantes de sousCaracteristiques si le label existe déjà
                    updatedSousCaracs[label] = sousCaracteristiques[label] ? [...sousCaracteristiques[label]] : [];
                }
                if (!updatedSousCaracs[label].includes(row.value.trim())) {
                    updatedSousCaracs[label].push(row.value.trim());
                }
            });

            // ✅ Mettre à jour productLabels avec les labels actuels du tableau (pour préserver l'ordre)
            const updatedProductLabels = validRows.map(row => row.label.trim());

            // ✅ CRITIQUE : Appeler onChange AVANT la sauvegarde DB pour mettre à jour le formulaire
            onChange(newModalities, updatedSousCaracs);

            // Masquer le tableau et afficher les chips
            setShowTable(false);

            // ✅ NOUVEAU : Sauvegarder dans la DB avec gestion d'erreur
            console.log('[LinearAutocompleteEditor] 💾 Sauvegarde sous-caractéristiques dans DB...', {
                modality,
                updatedProductLabels,
                nbSousCaracs: Object.keys(updatedSousCaracs).length
            });
            const savedIds = await autocompleteHistoryService.historizeField(
                identifiantBase,
                newModalities,
                separateur,
                updatedSousCaracs,
                'utilisateur'
            );

            if (savedIds.length > 0) {
                console.log('[LinearAutocompleteEditor] ✅ Sous-caractéristiques sauvegardées dans DB:', savedIds.length, 'caractéristique(s)');
            } else {
                console.warn('[LinearAutocompleteEditor] ⚠️ Aucune caractéristique sauvegardée (peut être normal si déjà existante)');
            }
        } catch (error) {
            console.error('[LinearAutocompleteEditor] ❌ Erreur sauvegarde sous-caractéristiques:', error);
            // ✅ Les modifications sont déjà dans le formulaire via onChange, donc on continue
            // La sauvegarde DB sera réessayée lors de la sauvegarde du produit/service
        }
    }, [separateur, onChange, identifiantBase, sousCaracteristiques, productLabels]); // ✅ AJOUT: Ajouter productLabels aux dépendances

    // Générer un texte d'aide dynamique
    const getHelperText = () => {
        const subCharKeys = Object.keys(sousCaracteristiques);
        if (subCharKeys.length === 0) return 'Tapez pour rechercher...';

        const examples = subCharKeys.slice(0, 3).map(key => {
            const values = sousCaracteristiques[key];
            return Array.isArray(values) && values.length > 0 ? values[0] : '';
        }).filter(Boolean);

        if (examples.length > 0) {
            return `Ex: ${examples.join(', ')}`;
        }
        return `Recherchez: ${subCharKeys.slice(0, 4).join(', ')}`;
    };

    // Combiner les suggestions (IA en premier pour effet instantané)
    const allSuggestions = [...iaSuggestions, ...dbSuggestions];
    const uniqueSuggestions = Array.from(new Set(allSuggestions))
        .filter(s => !selectedModalities.includes(s))
        .slice(0, 10);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.label}>
                    {label}
                    {required && <Text style={styles.required}> *</Text>}
                </Text>
                <Text style={styles.helperText}>
                    {getHelperText()}
                </Text>
            </View>

            {/* ✅ NOUVEAU: Tableau des sous-caractéristiques (affichage préféré) */}
            {showTable && (
                <>
                    {/* ✅ DEBUG: Logger les props passées au tableau */}
                    {console.log('[LinearAutocompleteEditor] 🔍 Props passées à SubCharacteristicsTable:', {
                        sousCaracteristiques: JSON.stringify(sousCaracteristiques, null, 2),
                        separateur,
                        hasInitialRows: tableRows.length > 0,
                        productLabels: productLabels,
                        productLabelsLength: productLabels?.length || 0,
                        sousCaracteristiquesKeys: Object.keys(sousCaracteristiques || {}),
                        sousCaracteristiquesKeysLength: Object.keys(sousCaracteristiques || {}).length
                    })}
                    <SubCharacteristicsTable
                        sousCaracteristiques={sousCaracteristiques}
                        separateur={separateur}
                        onValidate={handleTableValidate}
                        initialRows={tableRows.length > 0 ? tableRows : undefined}
                        valeur={value && value.length > 0 ? value[0] : undefined}
                        productLabels={productLabels}
                        onRowsChange={(rows) => {
                            // ✅ CORRECTION CRITIQUE: Utiliser les lignes du tableau directement
                            // au lieu de chercher par label dans orderedLabels (les labels peuvent avoir été modifiés)
                            const validRows = rows.filter(row =>
                                row.label.trim().length > 0 && row.value.trim().length > 0
                            );

                            if (validRows.length > 0) {
                                // Construire la modalité directement depuis les lignes (ordre = ordre du tableau)
                                const modalityParts = validRows.map(row => row.value.trim());
                                const modality = modalityParts.join(separateur);

                                // Construire les sous-caractéristiques depuis les lignes du tableau
                                const updatedSousCaracs: Record<string, string[]> = {};
                                validRows.forEach(row => {
                                    const label = row.label.trim();
                                    if (!updatedSousCaracs[label]) {
                                        updatedSousCaracs[label] = sousCaracteristiques[label] ? [...sousCaracteristiques[label]] : [];
                                    }
                                    if (!updatedSousCaracs[label].includes(row.value.trim())) {
                                        updatedSousCaracs[label].push(row.value.trim());
                                    }
                                });

                                onChange([modality], updatedSousCaracs);
                                console.log('[LinearAutocompleteEditor] 💾 Modifications sauvegardées automatiquement (lignes directes du tableau)');
                            }
                        }}
                    />
                </>
            )}

            {/* Barre de recherche (affichée seulement si le tableau n'est pas affiché) */}
            {!showTable && (
                <View style={styles.searchContainer}>
                    <SafeIcon name="search" size={18} color={modernColors.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder={placeholder || "Tapez pour rechercher..."}
                        placeholderTextColor="#9CA3AF"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {isLoadingSuggestions && (
                        <ActivityIndicator size="small" color={modernColors.primary} />
                    )}
                    {allowCustomModality && (
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => setShowAddModal(true)}
                        >
                            <SafeIcon name="plus-circle" size={20} color={modernColors.primary} />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Suggestions linéaires (affichage horizontal) - seulement si le tableau n'est pas affiché */}
            {!showTable && uniqueSuggestions.length > 0 && (
                <View style={styles.suggestionsSection}>
                    <Text style={styles.suggestionsTitle}>💡 Suggestions</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.suggestionsScroll}
                    >
                        {uniqueSuggestions.map((suggestion, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={styles.suggestionChip}
                                onPress={() => addModality(suggestion)}
                            >
                                <Text style={styles.suggestionText} numberOfLines={1}>
                                    {suggestion}
                                </Text>
                                <SafeIcon name="plus" size={14} color={modernColors.primary} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Modalités sélectionnées (chips éditables) - seulement si le tableau n'est pas affiché */}
            {!showTable && selectedModalities.length > 0 && (
                <View style={styles.selectedSection}>
                    <Text style={styles.selectedTitle}>
                        ✓ {selectedModalities.length} sélectionnée(s)
                    </Text>
                    <View style={styles.selectedChips}>
                        {selectedModalities.map((modality, index) => {
                            const chips = decomposeModality(modality);
                            return (
                                <View key={index} style={styles.selectedChipContainer}>
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={styles.chipScroll}
                                    >
                                        {chips.map((chip, chipIdx) => (
                                            <View key={chipIdx} style={styles.miniChip}>
                                                <Text style={styles.miniChipKey}>{chip.key}:</Text>
                                                <Text style={styles.miniChipValue}>{chip.value}</Text>
                                            </View>
                                        ))}
                                    </ScrollView>
                                    <View style={styles.chipActions}>
                                        <TouchableOpacity
                                            style={styles.chipEditButton}
                                            onPress={() => editModality(index)}
                                        >
                                            <SafeIcon name="edit" size={14} color={modernColors.primary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.chipDeleteButton}
                                            onPress={() => removeModality(index)}
                                        >
                                            <SafeIcon name="x" size={14} color={modernColors.error} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* Message vide - seulement si le tableau n'est pas affiché */}
            {!showTable && selectedModalities.length === 0 && uniqueSuggestions.length === 0 && !searchQuery && (
                <View style={styles.emptyState}>
                    <SafeIcon name="info" size={32} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>
                        Aucune caractéristique ajoutée
                    </Text>
                    <Text style={styles.emptySubtext}>
                        Tapez pour rechercher ou cliquez sur + pour ajouter
                    </Text>
                </View>
            )}

            {/* Modal d'ajout personnalisé - seulement si le tableau n'est pas affiché */}
            {!showTable && (
                <Modal
                    visible={showAddModal}
                    animationType="fade"
                    transparent={true}
                    onRequestClose={() => setShowAddModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <View style={styles.modalHeader}>
                                <SafeIcon name="plus-circle" size={24} color={modernColors.primary} />
                                <Text style={styles.modalTitle}>Ajouter une caractéristique</Text>
                                <TouchableOpacity
                                    style={styles.closeButton}
                                    onPress={() => {
                                        setShowAddModal(false);
                                        setCustomKey('');
                                        setCustomValue('');
                                    }}
                                >
                                    <SafeIcon name="x" size={20} color={modernColors.text} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalBody}>
                                <Text style={styles.modalDescription}>
                                    Ajoutez une nouvelle caractéristique personnalisée
                                </Text>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Nom de la caractéristique</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Ex: couleur, taille, matière..."
                                        placeholderTextColor="#9CA3AF"
                                        value={customKey}
                                        onChangeText={setCustomKey}
                                        autoCapitalize="none"
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Valeur</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Ex: Noir, XL, Coton..."
                                        placeholderTextColor="#9CA3AF"
                                        value={customValue}
                                        onChangeText={setCustomValue}
                                        autoCapitalize="none"
                                    />
                                </View>
                            </View>

                            <View style={styles.modalFooter}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => {
                                        setShowAddModal(false);
                                        setCustomKey('');
                                        setCustomValue('');
                                    }}
                                >
                                    <Text style={styles.cancelButtonText}>Annuler</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.saveButton,
                                        (!customKey || !customValue) && styles.saveButtonDisabled
                                    ]}
                                    onPress={addCustomModality}
                                    disabled={!customKey || !customValue}
                                >
                                    <SafeIcon name="check" size={18} color="#FFFFFF" />
                                    <Text style={styles.saveButtonText}>Ajouter</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    header: {
        marginBottom: 12,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    required: {
        color: modernColors.error,
    },
    helperText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
        padding: 0,
    },
    addButton: {
        padding: 4,
    },
    suggestionsSection: {
        marginTop: 12,
    },
    suggestionsTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.primary,
        marginBottom: 8,
    },
    suggestionsScroll: {
        gap: 8,
        paddingRight: 16,
    },
    suggestionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#E0E7FF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
        maxWidth: 200,
    },
    suggestionText: {
        fontSize: 13,
        color: modernColors.primary,
        fontWeight: '500',
    },
    selectedSection: {
        marginTop: 12,
    },
    selectedTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.success,
        marginBottom: 8,
    },
    selectedChips: {
        gap: 8,
    },
    selectedChipContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: modernColors.success,
        borderRadius: 8,
        padding: 8,
        gap: 8,
    },
    chipScroll: {
        flex: 1,
    },
    miniChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        marginRight: 4,
        gap: 4,
    },
    miniChipKey: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    miniChipValue: {
        fontSize: 11,
        color: modernColors.text,
    },
    chipActions: {
        flexDirection: 'row',
        gap: 4,
    },
    chipEditButton: {
        padding: 4,
    },
    chipDeleteButton: {
        padding: 4,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
        gap: 8,
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    emptySubtext: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        gap: 12,
    },
    modalTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    modalBody: {
        padding: 20,
        gap: 20,
    },
    modalDescription: {
        fontSize: 14,
        color: modernColors.textSecondary,
        lineHeight: 20,
    },
    inputContainer: {
        gap: 8,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    input: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 14,
        color: modernColors.text,
        backgroundColor: '#F9FAFB',
    },
    modalFooter: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    cancelButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    saveButton: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        gap: 6,
    },
    saveButtonDisabled: {
        backgroundColor: '#9CA3AF',
        opacity: 0.5,
    },
    saveButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default LinearAutocompleteEditor;

