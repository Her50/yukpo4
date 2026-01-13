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

    // Décomposer une modalité en chips
    // ✅ CORRECTION CRITIQUE: Utiliser productLabels pour garantir l'ordre correct des labels
    const decomposeModality = (modality: string): ModalityChip[] => {
        const parts = modality.split(separateur).map(p => p.trim());
        
        // ✅ PRIORITÉ 1: Utiliser productLabels si disponible (ordre garanti depuis l'IA)
        // ✅ PRIORITÉ 2: Utiliser l'ordre des clés dans sousCaracteristiques
        // ✅ CORRECTION CRITIQUE: Filtrer productLabels pour ne garder que les labels qui existent dans sousCaracteristiques
        // Cela garantit que chaque label correspond à une clé valide dans sousCaracteristiques
        const orderedLabels = (productLabels && Array.isArray(productLabels) && productLabels.length > 0)
            ? productLabels
                .filter(label => label && typeof label === 'string' && label.trim().length > 0)
                .filter(label => sousCaracteristiques.hasOwnProperty(label)) // ✅ CRITIQUE: Ne garder que les labels qui existent dans sousCaracteristiques
            : Object.keys(sousCaracteristiques);
        
        return parts.map((value, index) => {
            // ✅ CORRECTION: Utiliser le label à la même position que la valeur (alignement garanti)
            let label = index < orderedLabels.length ? orderedLabels[index] : undefined;
            
            // ✅ Si pas de label disponible, essayer de trouver un label dans sousCaracteristiques
            if (!label && index < orderedLabels.length) {
                label = orderedLabels[index];
            }
            
            // ✅ Si toujours pas de label, utiliser un label générique mais informatif
            if (!label) {
                // Essayer de trouver un label dans sousCaracteristiques qui correspond à cette valeur
                const matchingLabel = Object.keys(sousCaracteristiques).find(key => {
                    const values = sousCaracteristiques[key];
                    return Array.isArray(values) && values.includes(value);
                });
                
                if (matchingLabel) {
                    label = matchingLabel;
                } else {
                    // Dernier recours: utiliser un label générique mais descriptif
                    label = `caractéristique_${index + 1}`;
                }
            }
            
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
    const handleTableValidate = useCallback(async (rows: SubCharacteristicRow[]) => {
        try {
            // ✅ CORRECTION CRITIQUE: Construire la modalité en respectant l'ordre correct des labels
            // Priorité 1: Utiliser productLabels si disponible (ordre garanti)
            // Priorité 2: Utiliser l'ordre des clés de sousCaracteristiques (ordre d'insertion préservé en JS moderne)
            // ✅ NOUVEAU: Filtrer productLabels pour ne garder que les labels qui existent dans sousCaracteristiques
            const orderedLabels = (productLabels && Array.isArray(productLabels) && productLabels.length > 0)
                ? productLabels
                    .filter(label => label && typeof label === 'string')
                    .filter(label => sousCaracteristiques.hasOwnProperty(label)) // ✅ CRITIQUE: Ne garder que les labels qui existent dans sousCaracteristiques
                : Object.keys(sousCaracteristiques);
            
            const modalityParts: string[] = [];
            
            // Parcourir les labels dans l'ordre garanti
            orderedLabels.forEach(label => {
                // Trouver la ligne correspondante dans le tableau
                const matchingRow = rows.find(row => row.label === label);
                if (matchingRow && matchingRow.value) {
                    modalityParts.push(matchingRow.value);
                } else {
                    // Si pas de ligne correspondante, utiliser la première valeur de sousCaracteristiques
                    const defaultValue = Array.isArray(sousCaracteristiques[label]) && sousCaracteristiques[label].length > 0
                        ? sousCaracteristiques[label][0]
                        : '';
                    if (defaultValue) {
                        modalityParts.push(defaultValue);
                    }
                }
            });
            
            // Construire la modalité concaténée dans l'ordre correct
            const modality = modalityParts.join(separateur);
            
            // Mettre à jour les modalités sélectionnées
            const newModalities = [modality];
            setSelectedModalities(newModalities);
            
            // Construire les sous-caractéristiques mises à jour
            const updatedSousCaracs: Record<string, string[]> = {};
            rows.forEach(row => {
                if (!updatedSousCaracs[row.label]) {
                    updatedSousCaracs[row.label] = [];
                }
                if (!updatedSousCaracs[row.label].includes(row.value)) {
                    updatedSousCaracs[row.label].push(row.value);
                }
            });
            
            // ✅ CRITIQUE : Appeler onChange AVANT la sauvegarde DB pour mettre à jour le formulaire
            // Cela garantit que les modifications sont dans le formulaire même si la sauvegarde DB échoue
            onChange(newModalities, updatedSousCaracs);
            
            // Masquer le tableau et afficher les chips
            setShowTable(false);
            
            // ✅ NOUVEAU : Sauvegarder dans la DB avec gestion d'erreur
            console.log('[LinearAutocompleteEditor] 💾 Sauvegarde sous-caractéristiques dans DB...');
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
                        hasInitialRows: tableRows.length > 0
                    })}
                    <SubCharacteristicsTable
                        sousCaracteristiques={sousCaracteristiques}
                        separateur={separateur}
                        onValidate={handleTableValidate}
                        initialRows={tableRows.length > 0 ? tableRows : undefined}
                        valeur={value && value.length > 0 ? value[0] : undefined} // ✅ NOUVEAU : Passer la valeur parsée
                        productLabels={productLabels} // ✅ NOUVEAU : Passer l'ordre garanti des labels
                        onRowsChange={(rows) => {
                            // ✅ NOUVEAU : Sauvegarder automatiquement les modifications dans le formulaire (sans DB)
                            // Cela garantit que les modifications sont sauvegardées même si l'utilisateur ne clique pas "validé"
                            const validRows = rows.filter(row => 
                                row.label.trim().length > 0 && row.value.trim().length > 0
                            );
                            
                            if (validRows.length > 0) {
                                const modality = validRows.map(row => row.value).join(separateur);
                                const updatedSousCaracs: Record<string, string[]> = {};
                                validRows.forEach(row => {
                                    if (!updatedSousCaracs[row.label]) {
                                        updatedSousCaracs[row.label] = [];
                                    }
                                    if (!updatedSousCaracs[row.label].includes(row.value)) {
                                        updatedSousCaracs[row.label].push(row.value);
                                    }
                                });
                                
                                // ✅ Sauvegarder dans le formulaire (sans sauvegarde DB immédiate)
                                onChange([modality], updatedSousCaracs);
                                console.log('[LinearAutocompleteEditor] 💾 Modifications sauvegardées automatiquement dans le formulaire');
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

