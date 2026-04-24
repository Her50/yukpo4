/**
 * LinearAutocompleteEditor - Composant web pour l'autocomplete intelligent des caractéristiques produits
 * Adapté depuis mobile/src/components/LinearAutocompleteEditor.tsx
 * 
 * Fonctionnalités:
 * - Autocomplete intelligent avec suggestions IA et DB
 * - Gestion des sous_caracteristiques (dimensions multiples)
 * - Affichage tableau interactif des caractéristiques
 * - Support combinaisons préférées IA (product_vector/product_labels)
 * - Séparateur personnalisable (virgule par défaut)
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { autocompleteService } from '@/services/autocompleteService';
import { useAICombinations } from '@/hooks/useAICombinations';
import { Check, Info, Loader2, Plus, Search, Sparkles, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

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
    // Props optionnelles
    contextValues?: string[];
    categoryValue?: string;
    productVector?: string[];
    productLabels?: string[];
    sessionId?: string; // ✅ NOUVEAU: ID de session IA pour charger les combinaisons préférées
}

interface ModalityChip {
    key: string; // Ex: "style"
    value: string; // Ex: "Moderne"
    index: number; // Position dans la modalité concaténée
}

interface AutocompleteSuggestion {
    valeur: string;
    usage_count: number;
}

export const LinearAutocompleteEditor: React.FC<LinearAutocompleteEditorProps> = ({
    label,
    identifiantBase,
    sousCaracteristiques,
    separateur,
    value,
    onChange,
    required = false,
    placeholder = "Tapez pour rechercher...",
    allowCustomModality = true,
    filtrable = true,
    sessionId,
}) => {
    const { toast } = useToast();
    const [selectedModalities, setSelectedModalities] = useState<string[]>(value || []);
    const [searchQuery, setSearchQuery] = useState('');
    const [iaSuggestions, setIaSuggestions] = useState<string[]>([]);
    const [dbSuggestions, setDbSuggestions] = useState<string[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [customKey, setCustomKey] = useState('');
    const [customValue, setCustomValue] = useState('');

    // ✅ NOUVEAU: Charger les combinaisons préférées IA via useAICombinations
    const {
        combinations: aiCombinations,
        preferredCombination,
        preferredVector,
        loading: loadingAICombinations,
    } = useAICombinations(sessionId);

    // ✅ NOUVEAU: Charger les combinaisons préférées IA depuis useAICombinations
    useEffect(() => {
        const iaCache: string[] = [];

        // 1. Priorité: Utiliser les combinaisons préférées IA depuis sessionId
        if (aiCombinations.length > 0) {
            aiCombinations.forEach(combo => {
                if (combo.product_vector && combo.product_vector.length > 0) {
                    const modality = combo.product_vector.join(separateur);
                    if (!iaCache.includes(modality)) {
                        iaCache.push(modality);
                    }
                }
            });
            console.log('[LinearAutocompleteEditor] ✅ Combinaisons IA chargées:', iaCache.length);
        }

        // 2. Fallback: Utiliser les sous_caracteristiques fournies
        const subCharKeys = Object.keys(sousCaracteristiques);
        if (subCharKeys.length > 0 && iaCache.length === 0) {
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

        // 3. Pré-remplir avec la combinaison préférée si disponible et aucune valeur actuelle
        if (preferredVector && selectedModalities.length === 0 && value.length === 0) {
            const preferredModality = preferredVector.split(',').join(separateur);
            if (!iaCache.includes(preferredModality)) {
                iaCache.unshift(preferredModality); // Mettre en premier
            }
        }

        setIaSuggestions(iaCache);
    }, [aiCombinations, preferredVector, sousCaracteristiques, separateur, selectedModalities.length, value.length]);

    // ✅ AMÉLIORATION: Détecter si une caractéristique est de type localisation
    const isLocationCharacteristic = (key: string): boolean => {
        const locationKeys = ['localisation', 'ville', 'quartier', 'zone', 'lieu', 'city', 'location'];
        return locationKeys.includes(key.toLowerCase());
    };

    // Charger les suggestions DB quand on tape
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
                    // ✅ NOUVEAU: Si c'est une localisation, utiliser placesService (à implémenter)
                    if (isLocationCharacteristic(key)) {
                        // TODO: Implémenter placesService pour web
                        // Pour l'instant, on skip les localisations
                        continue;
                    } else {
                        // Utiliser autocompleteHistoryService pour les autres caractéristiques
                        try {
                            const suggestions = await autocompleteService.getSuggestions(
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
                        } catch (error) {
                            console.error('[LinearAutocompleteEditor] Erreur chargement suggestions:', error);
                        }
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
    const decomposeModality = (modality: string): ModalityChip[] => {
        const parts = modality.split(separateur).map(p => p.trim());
        const subCharKeys = Object.keys(sousCaracteristiques);

        return parts.map((value, index) => ({
            key: subCharKeys[index] || `item_${index}`,
            value: value,
            index: index,
        }));
    };

    // Ajouter une modalité
    const addModality = useCallback(async (modality: string) => {
        if (!modality || selectedModalities.includes(modality)) return;

        const newModalities = [...selectedModalities, modality];
        setSelectedModalities(newModalities);
        onChange(newModalities);
        setSearchQuery('');

        // Historiser
        try {
            await autocompleteService.historizeField(
                identifiantBase,
                newModalities,
                separateur,
                sousCaracteristiques,
                'utilisateur'
            );
        } catch (error) {
            console.error('[LinearAutocompleteEditor] Erreur historisation:', error);
        }
    }, [selectedModalities, onChange, identifiantBase, separateur, sousCaracteristiques]);

    // Supprimer une modalité
    const removeModality = useCallback((index: number) => {
        const newModalities = selectedModalities.filter((_, i) => i !== index);
        setSelectedModalities(newModalities);
        onChange(newModalities);
    }, [selectedModalities, onChange]);

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
        <div className="space-y-4">
            {/* Header */}
            <div>
                <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">
                        {label}
                        {required && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    {/* ✅ NOUVEAU: Badge combinaisons IA disponibles */}
                    {aiCombinations.length > 0 && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                            <Sparkles className="w-3 h-3 mr-1" />
                            {aiCombinations.length} suggestion{aiCombinations.length > 1 ? 's' : ''} IA
                        </Badge>
                    )}
                    {preferredCombination && (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Recommandé: {preferredVector}
                        </Badge>
                    )}
                </div>
                <p className="text-xs text-gray-500 mt-1 italic">
                    {preferredVector ? `💡 IA recommande: ${preferredVector}` : getHelperText()}
                </p>
            </div>

            {/* Barre de recherche */}
            <div className="relative flex items-center gap-2">
                <Search className="absolute left-3 w-4 h-4 text-gray-400" />
                <Input
                    type="text"
                    placeholder={placeholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10"
                />
                {isLoadingSuggestions && (
                    <Loader2 className="absolute right-3 w-4 h-4 text-blue-600 animate-spin" />
                )}
                {allowCustomModality && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddModal(true)}
                        className="shrink-0"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter
                    </Button>
                )}
            </div>

            {/* Suggestions linéaires (affichage horizontal) */}
            {uniqueSuggestions.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-blue-600">💡 Suggestions</p>
                    <div className="flex flex-wrap gap-2">
                        {uniqueSuggestions.map((suggestion, idx) => (
                            <Badge
                                key={idx}
                                variant="outline"
                                className="cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                onClick={() => addModality(suggestion)}
                            >
                                <span className="text-xs">{suggestion}</span>
                                <Plus className="w-3 h-3 ml-1" />
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {/* Modalités sélectionnées (chips éditables) */}
            {selectedModalities.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-green-600">
                        ✓ {selectedModalities.length} sélectionnée(s)
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {selectedModalities.map((modality, index) => {
                            const chips = decomposeModality(modality);
                            return (
                                <div
                                    key={index}
                                    className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-2"
                                >
                                    <div className="flex flex-wrap gap-1">
                                        {chips.map((chip, chipIdx) => (
                                            <Badge key={chipIdx} variant="secondary" className="text-xs">
                                                <span className="font-semibold">{chip.key}:</span>
                                                <span className="ml-1">{chip.value}</span>
                                            </Badge>
                                        ))}
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeModality(index)}
                                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <X className="w-3 h-3" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Message vide */}
            {selectedModalities.length === 0 && uniqueSuggestions.length === 0 && !searchQuery && (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-400">
                    <Info className="w-8 h-8" />
                    <p className="text-sm font-semibold">Aucune caractéristique ajoutée</p>
                    <p className="text-xs text-center">
                        Tapez pour rechercher ou cliquez sur + pour ajouter
                    </p>
                </div>
            )}

            {/* Modal d'ajout personnalisé */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Plus className="w-5 h-5 text-blue-600" />
                                <h3 className="text-lg font-semibold">Ajouter une caractéristique</h3>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setShowAddModal(false);
                                    setCustomKey('');
                                    setCustomValue('');
                                }}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Ajoutez une nouvelle caractéristique personnalisée
                            </p>

                            <div>
                                <Label className="text-sm font-semibold">Nom de la caractéristique</Label>
                                <Input
                                    type="text"
                                    placeholder="Ex: couleur, taille, matière..."
                                    value={customKey}
                                    onChange={(e) => setCustomKey(e.target.value)}
                                    className="mt-1"
                                />
                            </div>

                            <div>
                                <Label className="text-sm font-semibold">Valeur</Label>
                                <Input
                                    type="text"
                                    placeholder="Ex: Noir, XL, Coton..."
                                    value={customValue}
                                    onChange={(e) => setCustomValue(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                    setShowAddModal(false);
                                    setCustomKey('');
                                    setCustomValue('');
                                }}
                            >
                                Annuler
                            </Button>
                            <Button
                                type="button"
                                className="flex-1"
                                onClick={addCustomModality}
                                disabled={!customKey || !customValue}
                            >
                                <Check className="w-4 h-4 mr-1" />
                                Ajouter
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LinearAutocompleteEditor;

