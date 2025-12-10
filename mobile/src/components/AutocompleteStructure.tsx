// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import SafeStorage from '../../utils/safeStorage';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { apiGet, apiPost } from '../services/api';
import SafeIcon from './SafeIcon';

interface AutocompleteStructureProps {
    type: 'hopital_clinique' | 'pharmacie' | 'laboratoire';
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    label?: string;
    required?: boolean;
    autoLoadLastUsed?: boolean; // Charger automatiquement la dernière valeur utilisée
    userId?: string; // ID utilisateur pour personnaliser
}

const STORAGE_KEYS = {
    hopital_clinique: '@yukpomnang_structures_hopitaux',
    pharmacie: '@yukpomnang_structures_pharmacies',
    laboratoire: '@yukpomnang_structures_laboratoires',
};

// Clés pour mémoriser la dernière valeur utilisée par l'utilisateur
const LAST_USED_KEYS = {
    hopital_clinique: '@yukpomnang_last_used_hopital',
    pharmacie: '@yukpomnang_last_used_pharmacie',
    laboratoire: '@yukpomnang_last_used_laboratoire',
};

const AutocompleteStructure: React.FC<AutocompleteStructureProps> = ({
    type,
    value,
    onChangeText,
    placeholder = 'Nom de la structure',
    label,
    required = false,
    autoLoadLastUsed = true,
    userId,
}) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [allStructures, setAllStructures] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [lastUsedValue, setLastUsedValue] = useState<string>('');

    // Charger les structures existantes et la dernière valeur utilisée au montage
    useEffect(() => {
        loadStructures();
        if (autoLoadLastUsed) {
            loadLastUsedValue();
        }
    }, [type]);

    // Sauvegarder la structure quand on perd le focus
    useEffect(() => {
        if (!isFocused && value && value.trim().length > 2) {
            saveStructure(value.trim());
            saveLastUsedValue(value.trim()); // Mémoriser comme dernière valeur utilisée
        }
    }, [isFocused, value]);

    // Charger les structures depuis la BASE DE DONNÉES + cache local
    const loadStructures = async () => {
        try {
            const storageKey = STORAGE_KEYS[type];
            let structures: string[] = [];

            // 1. Charger depuis le cache local (rapide)
            const cached = await SafeStorage.getItem(storageKey);
            if (cached) {
                structures = JSON.parse(cached) as string[];
                setAllStructures(structures);
                console.log(`📋 [AutocompleteStructure] ${structures.length} structures chargées du cache`);
            }

            // 2. Charger depuis la base de données (source de vérité)
            try {
                const response = await apiGet(`/health-structures?type=${type}`);

                if (response.success && response.data && Array.isArray(response.data)) {
                    const dbStructures = response.data.map((s: any) => s.name).filter(Boolean);

                    // Fusionner DB + cache local (éliminer doublons)
                    const merged = [...new Set([...dbStructures, ...structures])];

                    // Mettre à jour le cache local
                    await SafeStorage.setItem(storageKey, JSON.stringify(merged));
                    setAllStructures(merged);

                    console.log(`🌐 [AutocompleteStructure] ${dbStructures.length} structures chargées de la DB, ${merged.length} au total`);
                }
            } catch (dbError) {
                // Si erreur DB, on utilise le cache local uniquement
                console.warn('[AutocompleteStructure] Impossible de charger depuis la DB, utilisation du cache local:', dbError);
            }
        } catch (error) {
            console.error('[AutocompleteStructure] Erreur chargement structures:', error);
        }
    };

    // Charger la dernière valeur utilisée par cet utilisateur
    const loadLastUsedValue = async () => {
        try {
            const lastUsedKey = LAST_USED_KEYS[type];
            const userKey = userId ? `${lastUsedKey}_${userId}` : lastUsedKey;
            const lastUsed = await SafeStorage.getItem(userKey);
            
            if (lastUsed) {
                setLastUsedValue(lastUsed);
                
                // Si le champ est vide et qu'on doit auto-charger, pré-remplir
                if (autoLoadLastUsed && !value) {
                    onChangeText(lastUsed);
                    console.log(`💡 [AutocompleteStructure] Dernière valeur chargée: ${lastUsed}`);
                }
            }
        } catch (error) {
            console.error('[AutocompleteStructure] Erreur chargement dernière valeur:', error);
        }
    };

    // Sauvegarder la dernière valeur utilisée
    const saveLastUsedValue = async (structureName: string) => {
        try {
            const lastUsedKey = LAST_USED_KEYS[type];
            const userKey = userId ? `${lastUsedKey}_${userId}` : lastUsedKey;
            await SafeStorage.setItem(userKey, structureName);
            setLastUsedValue(structureName);
            console.log(`✅ [AutocompleteStructure] Dernière valeur mémorisée: ${structureName}`);
        } catch (error) {
            console.error('[AutocompleteStructure] Erreur sauvegarde dernière valeur:', error);
        }
    };

    // Sauvegarder une nouvelle structure (LOCAL + BASE DE DONNÉES)
    const saveStructure = async (structureName: string) => {
        try {
            if (!structureName || structureName.trim().length < 3) return;

            const normalized = structureName.trim();

            // Vérifier si la structure existe déjà (insensible à la casse)
            const exists = allStructures.some(
                s => s.toLowerCase() === normalized.toLowerCase()
            );

            if (!exists) {
                // 1. Sauvegarder dans le cache local (immédiat)
                const updated = [...allStructures, normalized];
                const storageKey = STORAGE_KEYS[type];
                await SafeStorage.setItem(storageKey, JSON.stringify(updated));
                setAllStructures(updated);
                console.log(`✅ [AutocompleteStructure] Structure sauvegardée localement: ${normalized}`);

                // 2. Sauvegarder dans la base de données (asynchrone, non bloquant)
                try {
                    const response = await apiPost('/health-structures', {
                        type: type,
                        name: normalized
                    });

                    if (response.success) {
                        console.log(`🌐 [AutocompleteStructure] Structure sauvegardée en DB: ${normalized}`);
                    }
                } catch (dbError) {
                    // Erreur DB non bloquante - la structure reste dans le cache local
                    console.warn('[AutocompleteStructure] Erreur sauvegarde DB (non bloquant):', dbError);
                }
            }
        } catch (error) {
            console.error('[AutocompleteStructure] Erreur sauvegarde structure:', error);
        }
    };

    // Filtrer les suggestions en fonction de la saisie
    const updateSuggestions = (text: string) => {
        if (!text || text.trim().length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const filtered = allStructures.filter(structure =>
            structure.toLowerCase().includes(text.toLowerCase())
        );

        // Trier par pertinence intelligente :
        // 1. Dernière valeur utilisée en premier
        // 2. Ceux qui commencent par le texte
        // 3. Ordre alphabétique
        filtered.sort((a, b) => {
            // Priorité à la dernière valeur utilisée
            if (lastUsedValue) {
                const aIsLastUsed = a.toLowerCase() === lastUsedValue.toLowerCase();
                const bIsLastUsed = b.toLowerCase() === lastUsedValue.toLowerCase();
                if (aIsLastUsed && !bIsLastUsed) return -1;
                if (!aIsLastUsed && bIsLastUsed) return 1;
            }
            
            // Puis ceux qui commencent par le texte
            const aStarts = a.toLowerCase().startsWith(text.toLowerCase());
            const bStarts = b.toLowerCase().startsWith(text.toLowerCase());
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            
            // Enfin ordre alphabétique
            return a.localeCompare(b);
        });

        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
    };

    // Gérer le changement de texte
    const handleChangeText = (text: string) => {
        onChangeText(text);
        updateSuggestions(text);
    };

    // Sélectionner une suggestion
    const selectSuggestion = (structure: string) => {
        onChangeText(structure);
        setShowSuggestions(false);
        setSuggestions([]);
    };

    // Gérer le focus
    const handleFocus = () => {
        setIsFocused(true);
        if (value && value.length >= 2) {
            updateSuggestions(value);
        }
    };

    const handleBlur = () => {
        // Délai pour permettre la sélection d'une suggestion
        setTimeout(() => {
            setIsFocused(false);
            setShowSuggestions(false);
        }, 200);
    };

    const getTypeLabel = () => {
        switch (type) {
            case 'hopital_clinique':
                return 'Hôpital / Clinique';
            case 'pharmacie':
                return 'Pharmacie';
            case 'laboratoire':
                return 'Laboratoire / Centre d\'imagerie';
            default:
                return 'Structure';
        }
    };

    const getTypeIcon = () => {
        switch (type) {
            case 'hopital_clinique':
                return 'building';
            case 'pharmacie':
                return 'shield';
            case 'laboratoire':
                return 'flask';
            default:
                return 'home';
        }
    };

    return (
        <View style={styles.container}>
            {label && (
                <Text style={styles.label}>
                    {label}
                    {required && <Text style={styles.required}> *</Text>}
                </Text>
            )}

            <View style={styles.inputContainer}>
                <SafeIcon
                    name={getTypeIcon()}
                    size={20}
                    color="#6B7280"
                    style={styles.icon}
                />
                <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={handleChangeText}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder={placeholder || `Ex: ${getTypeLabel()} Central`}
                    placeholderTextColor="#9CA3AF"
                />
                {value.length > 0 && (
                    <TouchableOpacity
                        onPress={() => {
                            onChangeText('');
                            setSuggestions([]);
                            setShowSuggestions(false);
                        }}
                        style={styles.clearButton}
                    >
                        <SafeIcon name="x" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                )}
            </View>

            {/* Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                    <View style={styles.suggestionsHeader}>
                        <SafeIcon name="list" size={14} color="#6B7280" />
                        <Text style={styles.suggestionsTitle}>
                            Suggestions ({suggestions.length})
                        </Text>
                    </View>
                    <FlatList
                        data={suggestions}
                        keyExtractor={(item, index) => `${item}-${index}`}
                        renderItem={({ item }) => {
                            const isLastUsed = lastUsedValue && item.toLowerCase() === lastUsedValue.toLowerCase();
                            return (
                                <TouchableOpacity
                                    style={[styles.suggestionItem, isLastUsed && styles.suggestionItemLastUsed]}
                                    onPress={() => selectSuggestion(item)}
                                >
                                    <SafeIcon 
                                        name={isLastUsed ? "star" : "map-pin"} 
                                        size={14} 
                                        color={isLastUsed ? "#F59E0B" : "#3B82F6"} 
                                    />
                                    <Text style={[styles.suggestionText, isLastUsed && styles.suggestionTextLastUsed]}>
                                        {item}
                                    </Text>
                                    {isLastUsed && (
                                        <View style={styles.lastUsedBadge}>
                                            <Text style={styles.lastUsedBadgeText}>Récente</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        }}
                        style={styles.suggestionsList}
                        nestedScrollEnabled
                    />
                </View>
            )}

            {/* Hint */}
            {!showSuggestions && allStructures.length > 0 && (
                <Text style={styles.hint}>
                    💡 {allStructures.length} {getTypeLabel().toLowerCase()}(s) enregistré(s).
                    Tapez pour voir les suggestions.
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    required: {
        color: '#DC2626',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        paddingHorizontal: 12,
        height: 48,
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#111827',
        paddingVertical: 0,
    },
    clearButton: {
        padding: 4,
    },
    suggestionsContainer: {
        marginTop: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        maxHeight: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    suggestionsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        gap: 6,
    },
    suggestionsTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    suggestionsList: {
        maxHeight: 150,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 10,
    },
    suggestionText: {
        fontSize: 14,
        color: '#111827',
        flex: 1,
    },
    hint: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 6,
        fontStyle: 'italic',
    },
    suggestionItemLastUsed: {
        backgroundColor: '#FEF3C7',
        borderLeftWidth: 3,
        borderLeftColor: '#F59E0B',
    },
    suggestionTextLastUsed: {
        fontWeight: '600',
        color: '#92400E',
    },
    lastUsedBadge: {
        backgroundColor: '#F59E0B',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    lastUsedBadgeText: {
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: '600',
    },
});

export default AutocompleteStructure;

