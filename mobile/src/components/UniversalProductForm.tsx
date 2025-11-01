/**
 * 🌍 FORMULAIRE UNIVERSEL DE PRODUIT
 * 
 * Ce composant s'adapte AUTOMATIQUEMENT à N'IMPORTE QUELLE catégorie
 * parmi vos 60+ catégories, sans configuration spécifique !
 * 
 * Il utilise le système d'analyse automatique pour :
 * 1. Détecter les champs fixes de la catégorie (pré-remplir)
 * 2. Détecter les champs variables (demander à l'utilisateur)
 * 3. Proposer les bonnes options depuis productModalities.ts
 * 4. S'adapter au contexte (pays, historique utilisateur)
 */

import React, { useEffect, useState } from 'react';
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
import { genericProductAutoFillService, GenericAutoFillResult } from '../services/genericProductAutoFill';
import { getProductSuggestions } from '../data/enrichedProductDatabase';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface UniversalProductFormProps {
    category: string;                          // Ex: 'telephone', 'agriculture', 'vetement', etc.
    onSubmit: (productData: Record<string, any>) => void;
    userCountry?: string;
    userId?: string;
    initialProductName?: string;
}

export const UniversalProductForm: React.FC<UniversalProductFormProps> = ({
    category,
    onSubmit,
    userCountry = 'CM',
    userId,
    initialProductName = ''
}) => {
    // États
    const [productQuery, setProductQuery] = useState(initialProductName);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    const [autoFillResult, setAutoFillResult] = useState<GenericAutoFillResult | null>(null);
    const [userInputs, setUserInputs] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    
    // Charger les suggestions initiales si nom fourni
    useEffect(() => {
        if (initialProductName) {
            handleProductSelect(initialProductName);
        }
    }, [initialProductName, category]);
    
    /**
     * Recherche de produits (autocomplete)
     */
    const handleProductSearch = (query: string) => {
        setProductQuery(query);
        
        if (query.length >= 2) {
            // Suggestions depuis enrichedProductDatabase
            const enrichedSuggestions = getProductSuggestions(query, 5);
            
            // TODO: Ajouter suggestions depuis productModalities pour cette catégorie
            // const categorySuggestions = getCategorySuggestions(category, query);
            
            setSuggestions(enrichedSuggestions);
            setShowSuggestions(enrichedSuggestions.length > 0);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };
    
    /**
     * 🎯 Sélection du produit → Pré-remplissage automatique
     */
    const handleProductSelect = async (productName: string) => {
        setProductQuery(productName);
        setShowSuggestions(false);
        setLoading(true);
        
        try {
            // Appeler le service générique de pré-remplissage
            const result = await genericProductAutoFillService.autoFillGeneric(
                productName,
                category,
                userCountry
            );
            
            setAutoFillResult(result);
            setUserInputs({});
            
            // Notification si pré-remplissage significatif
            if (result.fields_saved > 2) {
                Alert.alert(
                    '✨ Génial !',
                    `${result.fields_saved} champs pré-remplis automatiquement (${result.reduction_percentage}%).\n\nVous n'avez plus que ${result.required_fields.length} champs à remplir !`,
                    [{ text: 'OK' }]
                );
            }
            
        } catch (error) {
            console.error('[UniversalProductForm] Erreur auto-fill:', error);
            Alert.alert('Erreur', 'Impossible de charger les informations du produit');
        } finally {
            setLoading(false);
        }
    };
    
    /**
     * Mise à jour d'un champ utilisateur
     */
    const handleUserInput = (field: string, value: any) => {
        setUserInputs(prev => ({
            ...prev,
            [field]: value
        }));
    };
    
    /**
     * Soumission du formulaire
     */
    const handleSubmit = () => {
        if (!autoFillResult) {
            Alert.alert('Erreur', 'Veuillez sélectionner un produit d\'abord');
            return;
        }
        
        // Valider champs requis
        const missingFields = autoFillResult.required_fields.filter(f => !userInputs[f.field]);
        
        if (missingFields.length > 0) {
            Alert.alert(
                'Champs manquants',
                `Veuillez remplir : ${missingFields.map(f => f.label).join(', ')}`,
                [{ text: 'OK' }]
            );
            return;
        }
        
        // Combiner auto-filled + user inputs
        const finalData = {
            ...autoFillResult.auto_filled,
            ...userInputs,
            _category: category,
            _autofill_stats: {
                fields_saved: autoFillResult.fields_saved,
                reduction: autoFillResult.reduction_percentage
            }
        };
        
        onSubmit(finalData);
    };
    
    /**
     * Rendre un champ dynamiquement selon son type
     */
    const renderField = (field: GenericAutoFillResult['required_fields'][0]) => {
        const value = userInputs[field.field];
        
        switch (field.type) {
            case 'select':
                return (
                    <View key={field.field} style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>{field.label} *</Text>
                        <View style={styles.selectContainer}>
                            {field.options?.slice(0, 8).map(option => (
                                <TouchableOpacity
                                    key={option}
                                    style={[
                                        styles.optionButton,
                                        value === option && styles.optionButtonActive
                                    ]}
                                    onPress={() => handleUserInput(field.field, option)}
                                >
                                    <Text style={[
                                        styles.optionText,
                                        value === option && styles.optionTextActive
                                    ]}>
                                        {option}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );
            
            case 'number':
                return (
                    <View key={field.field} style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>{field.label} *</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            placeholder={field.placeholder}
                            value={value?.toString() || ''}
                            onChangeText={(text) => handleUserInput(field.field, parseFloat(text) || 0)}
                        />
                    </View>
                );
            
            case 'text':
            default:
                return (
                    <View key={field.field} style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>{field.label} *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder={field.placeholder}
                            value={value || ''}
                            onChangeText={(text) => handleUserInput(field.field, text)}
                        />
                    </View>
                );
        }
    };
    
    return (
        <ScrollView style={styles.container}>
            {/* ═══════════════════════════════════════════════ */}
            {/* RECHERCHE DU PRODUIT */}
            {/* ═══════════════════════════════════════════════ */}
            
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                    Quel produit vendez-vous ?
                </Text>
                <Text style={styles.sectionSubtitle}>
                    Catégorie : {category}
                </Text>
                
                <View style={styles.searchContainer}>
                    <SafeIcon name="search" size={20} color={modernColors.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Rechercher un produit..."
                        value={productQuery}
                        onChangeText={handleProductSearch}
                    />
                </View>
                
                {showSuggestions && (
                    <View style={styles.suggestionsContainer}>
                        {suggestions.map((suggestion, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.suggestionItem}
                                onPress={() => handleProductSelect(suggestion)}
                            >
                                <SafeIcon name="package" size={16} color={modernColors.primary} />
                                <Text style={styles.suggestionText}>{suggestion}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>
            
            {/* ═══════════════════════════════════════════════ */}
            {/* CHAMPS PRÉ-REMPLIS */}
            {/* ═══════════════════════════════════════════════ */}
            
            {autoFillResult && autoFillResult.fields_saved > 0 && (
                <View style={styles.section}>
                    <View style={styles.autoFilledHeader}>
                        <SafeIcon name="check-circle" size={20} color={modernColors.success} />
                        <Text style={styles.autoFilledTitle}>
                            ✨ {autoFillResult.fields_saved} champs pré-remplis ({autoFillResult.reduction_percentage}%)
                        </Text>
                    </View>
                    
                    <View style={styles.autoFilledCard}>
                        {Object.entries(autoFillResult.auto_filled).map(([key, value]) => (
                            <View key={key} style={styles.autoFilledRow}>
                                <Text style={styles.autoFilledLabel}>{formatLabel(key)}:</Text>
                                <Text style={styles.autoFilledValue}>
                                    {Array.isArray(value) ? value.join(', ') : String(value)}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
            
            {/* ═══════════════════════════════════════════════ */}
            {/* CHAMPS REQUIS */}
            {/* ═══════════════════════════════════════════════ */}
            
            {autoFillResult && autoFillResult.required_fields.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        Complétez ces {autoFillResult.required_fields.length} informations
                    </Text>
                    
                    {autoFillResult.required_fields.map(field => renderField(field))}
                </View>
            )}
            
            {/* ═══════════════════════════════════════════════ */}
            {/* BOUTON SOUMISSION */}
            {/* ═══════════════════════════════════════════════ */}
            
            {autoFillResult && (
                <View style={styles.submitContainer}>
                    <TouchableOpacity
                        style={styles.submitButton}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        <SafeIcon name="check" size={20} color="#FFFFFF" />
                        <Text style={styles.submitButtonText}>Publier le produit</Text>
                    </TouchableOpacity>
                    
                    {autoFillResult.fields_saved > 0 && (
                        <Text style={styles.footerText}>
                            💪 Vous avez économisé {autoFillResult.fields_saved} saisies ({autoFillResult.reduction_percentage}%) !
                        </Text>
                    )}
                </View>
            )}
            
            {loading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Analyse en cours...</Text>
                </View>
            )}
        </ScrollView>
    );
};

function formatLabel(fieldName: string): string {
    return fieldName
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    section: {
        padding: 16,
        marginBottom: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    sectionSubtitle: {
        fontSize: 13,
        fontWeight: '500',
        color: modernColors.textSecondary,
        marginBottom: 12,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: modernColors.text,
    },
    suggestionsContainer: {
        marginTop: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
        overflow: 'hidden',
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
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '500',
    },
    autoFilledHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    autoFilledTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.success,
    },
    autoFilledCard: {
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    autoFilledRow: {
        flexDirection: 'row',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#D1FAE5',
    },
    autoFilledLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#166534',
        minWidth: 120,
    },
    autoFilledValue: {
        flex: 1,
        fontSize: 13,
        color: '#15803D',
    },
    fieldContainer: {
        marginBottom: 16,
    },
    fieldLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    selectContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    optionButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: modernColors.border,
        backgroundColor: '#FFFFFF',
    },
    optionButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    optionText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
    },
    optionTextActive: {
        color: '#FFFFFF',
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 14,
        color: modernColors.text,
    },
    submitContainer: {
        padding: 16,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        paddingVertical: 16,
        gap: 8,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    footerText: {
        fontSize: 12,
        color: modernColors.success,
        textAlign: 'center',
        marginTop: 12,
        fontWeight: '600',
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
});

/**
 * ═══════════════════════════════════════════════════════════════
 * 📚 EXEMPLE D'UTILISATION POUR N'IMPORTE QUELLE CATÉGORIE
 * ═══════════════════════════════════════════════════════════════
 * 
 * // Pour TÉLÉPHONE
 * <UniversalProductForm
 *   category="telephone"
 *   onSubmit={(data) => console.log(data)}
 * />
 * 
 * // Pour VÊTEMENT (même structure, s'adapte auto !)
 * <UniversalProductForm
 *   category="vetement"
 *   onSubmit={(data) => console.log(data)}
 * />
 * 
 * // Pour QUINCAILLERIE (même structure, s'adapte auto !)
 * <UniversalProductForm
 *   category="quincaillerie"
 *   onSubmit={(data) => console.log(data)}
 * />
 * 
 * LE MÊME COMPOSANT FONCTIONNE POUR LES 60+ CATÉGORIES !
 * 
 * ═══════════════════════════════════════════════════════════════
 */

