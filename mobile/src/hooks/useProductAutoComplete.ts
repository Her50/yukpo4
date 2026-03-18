/**
 * \uD83C\uDFAF HOOK : Auto-complétion et remplissage automatique massif
 * 
 * Exploite la base de 1000+ produits pour :
 * 1. Suggérer des noms de produits pendant la frappe
 * 2. Auto-remplir TOUS les champs liés quand un produit est sélectionné
 * 
 * UTILISATION dans vos formulaires :
 * 
 * ```typescript
 * const {
 *   suggestions,           // Liste des produits suggérés
 *   selectProduct,         // Fonction pour sélectionner un produit
 *   autoFilledFields       // Champs auto-remplis
 * } = useProductAutoComplete('telephone', newProduct.nom_produit);
 * 
 * // Quand l'utilisateur sélectionne un produit
 * <TouchableOpacity onPress={() => {
 *   selectProduct(suggestion);
 *   setNewProduct({ ...newProduct, ...autoFilledFields });
 * }}>
 *   <Text>{suggestion.name}</Text>
 * </TouchableOpacity>
 * ```
 */

import { useEffect, useState } from 'react';
import { ProductKnowledge, productKnowledgeBase } from '../utils/productKnowledgeBase';

export interface AutoCompleteState {
    // Suggestions de produits
    suggestions: ProductKnowledge[];

    // Produit sélectionné
    selectedProduct: ProductKnowledge | null;

    // Champs auto-remplis
    autoFilledFields: Record<string, any>;

    // État
    isLoading: boolean;

    // Actions
    selectProduct: (product: ProductKnowledge) => void;
    clearSelection: () => void;
}

/**
 * Hook principal d'auto-complétion
 */
export function useProductAutoComplete(
    category: string,
    productNameQuery?: string,
    options?: {
        enabled?: boolean;
        minQueryLength?: number;
        maxSuggestions?: number;
        autoApply?: boolean;  // Appliquer automatiquement le premier résultat si match exact
    }
): AutoCompleteState {
    const [suggestions, setSuggestions] = useState<ProductKnowledge[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<ProductKnowledge | null>(null);
    const [autoFilledFields, setAutoFilledFields] = useState<Record<string, any>>({});
    const [isLoading, setIsLoading] = useState(false);

    const enabled = options?.enabled !== false;
    const minQueryLength = options?.minQueryLength || 2;
    const maxSuggestions = options?.maxSuggestions || 10;
    const autoApply = options?.autoApply || false;

    // Rechercher des suggestions pendant la frappe
    useEffect(() => {
        if (!enabled || !productNameQuery || productNameQuery.length < minQueryLength) {
            setSuggestions([]);
            return;
        }

        const searchProducts = async () => {
            setIsLoading(true);

            try {
                // ✅ Récupérer le code pays de l'utilisateur (exemple)
                const userCountry = 'CM'; // TODO: Récupérer depuis le contexte utilisateur

                const results = await productKnowledgeBase.getSuggestions(
                    productNameQuery,
                    category,
                    maxSuggestions,
                    userCountry // ✅ Passer le code pays pour enrichir avec produits locaux
                );

                setSuggestions(results);

                // Auto-appliquer si match exact et option activée
                if (autoApply && results.length > 0) {
                    const exactMatch = results.find(
                        r => r.name.toLowerCase() === productNameQuery.toLowerCase()
                    );

                    if (exactMatch) {
                        selectProduct(exactMatch);
                    }
                }

            } catch (error) {
                console.error('[useProductAutoComplete] Erreur recherche:', error);
                setSuggestions([]);
            } finally {
                setIsLoading(false);
            }
        };

        // Debounce
        const timeoutId = setTimeout(searchProducts, 200);

        return () => clearTimeout(timeoutId);
    }, [productNameQuery, category, enabled]);

    // Sélectionner un produit et remplir les champs
    const selectProduct = (product: ProductKnowledge) => {
        setSelectedProduct(product);
        // ✅ Combiner caractéristiques fixes et catégorie
        const characteristics = {
            ...product.fixed_characteristics,
            category: product.category
        };
        setAutoFilledFields(characteristics);
        setSuggestions([]);  // Masquer les suggestions

        console.log(`✅ [AutoComplete] Produit sélectionné: ${product.name}`);
        console.log(`\uD83D\uDCCB [AutoComplete] ${Object.keys(characteristics).length} champs auto-remplis:`, characteristics);
    };

    // Effacer la sélection
    const clearSelection = () => {
        setSelectedProduct(null);
        setAutoFilledFields({});
    };

    return {
        suggestions,
        selectedProduct,
        autoFilledFields,
        isLoading,
        selectProduct,
        clearSelection
    };
}

/**
 * Hook simplifié pour juste obtenir les caractéristiques
 * (sans UI de suggestions)
 */
export function useProductCharacteristics(
    productName: string | undefined,
    category: string
): Record<string, any> | null {
    const [characteristics, setCharacteristics] = useState<Record<string, any> | null>(null);

    useEffect(() => {
        if (!productName || productName.length < 3) {
            setCharacteristics(null);
            return;
        }

        const fetchCharacteristics = async () => {
            const chars = await productKnowledgeBase.getCharacteristics(productName, category);
            setCharacteristics(chars);

            if (chars) {
                console.log(`✅ [ProductCharacteristics] ${Object.keys(chars).length} caractéristiques trouvées pour "${productName}"`);
            }
        };

        // Debounce
        const timeoutId = setTimeout(fetchCharacteristics, 300);

        return () => clearTimeout(timeoutId);
    }, [productName, category]);

    return characteristics;
}

/**
 * Hook pour gérer le remplissage automatique dans un formulaire
 * S'intègre directement avec useState du formulaire
 */
export function useFormAutoFill<T extends Record<string, any>>(
    category: string,
    formData: T,
    setFormData: (data: T) => void,
    productNameField: keyof T = 'nom_produit' as keyof T
) {
    const productName = formData[productNameField] as string | undefined;

    const {
        suggestions,
        selectedProduct,
        autoFilledFields,
        isLoading,
        selectProduct,
        clearSelection
    } = useProductAutoComplete(category, productName);

    // Fonction pour appliquer l'auto-remplissage
    const applyAutoFill = (product: ProductKnowledge) => {
        selectProduct(product);

        // Fusionner les champs auto-remplis avec le formulaire actuel
        setFormData({
            ...formData,
            ...product.characteristics,
            [productNameField]: product.name  // Mettre à jour le nom aussi
        });
    };

    return {
        suggestions,
        selectedProduct,
        isLoading,
        applyAutoFill,
        clearSelection,
        hasAutoFill: Object.keys(autoFilledFields).length > 0
    };
}

