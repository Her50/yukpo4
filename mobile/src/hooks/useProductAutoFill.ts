/**
 * \uD83C\uDFAF HOOK : Pré-remplissage automatique de produit
 * 
 * Ce hook analyse le nom d'un produit et pré-remplit automatiquement
 * les champs du formulaire (marque, modèle, caractéristiques, etc.)
 * 
 * UTILISATION dans vos formulaires existants :
 * 
 * ```typescript
 * const autoFilled = useProductAutoFill(newProduct.nom_produit, 'telephone');
 * 
 * useEffect(() => {
 *   if (autoFilled && !newProduct.marqueTelephone) {
 *     setNewProduct({ ...newProduct, ...autoFilled });
 *   }
 * }, [autoFilled]);
 * ```
 */

import { useEffect, useState } from 'react';
import { productAutoFillService } from '../services/productAutoFillService';
import { categoryAnalyzer } from '../utils/categoryAnalyzer';

export interface AutoFillResult {
    // Champs pré-remplis
    fields: Record<string, any>;

    // Niveau de confiance (0-100)
    confidence: number;

    // Source du pré-remplissage
    source: 'enriched_db' | 'name_extraction' | 'category_defaults' | 'none';

    // Suggestions pour champs non remplis
    suggestions?: Record<string, string[]>;
}

/**
 * Hook principal de pré-remplissage automatique
 */
export function useProductAutoFill(
    productName: string | undefined,
    category: string,
    options?: {
        enabled?: boolean;           // Activer/désactiver (défaut: true)
        minConfidence?: number;      // Confiance minimale pour appliquer (défaut: 50)
        autoApply?: boolean;         // Appliquer automatiquement (défaut: false)
    }
): AutoFillResult | null {
    const [result, setResult] = useState<AutoFillResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const enabled = options?.enabled !== false;
    const minConfidence = options?.minConfidence || 50;

    useEffect(() => {
        if (!enabled || !productName || productName.trim().length < 3) {
            setResult(null);
            return;
        }

        const fillProduct = async () => {
            setIsLoading(true);

            try {
                // Étape 1 : Essayer base enrichie
                const enrichedResult = await (productAutoFillService as any).getProductInfo?.(productName, category) || await productAutoFillService.autoFillProduct(productName, category);

                if (enrichedResult) {
                    setResult({
                        fields: enrichedResult.characteristics,
                        confidence: 95,
                        source: 'enriched_db',
                        suggestions: enrichedResult.suggested_fields
                    });
                    return;
                }

                // Étape 2 : Extraction depuis le nom
                const extracted = extractFromProductName(productName, category);

                if (Object.keys(extracted).length > 0) {
                    setResult({
                        fields: extracted,
                        confidence: 70,
                        source: 'name_extraction'
                    });
                    return;
                }

                // Étape 3 : Valeurs par défaut de la catégorie
                const analysis = categoryAnalyzer.analyzeCategory(category);

                if (Object.keys(analysis.fixed_fields).length > 0) {
                    setResult({
                        fields: analysis.fixed_fields,
                        confidence: 60,
                        source: 'category_defaults'
                    });
                    return;
                }

                // Aucun résultat
                setResult(null);

            } catch (error) {
                console.error('[useProductAutoFill] Erreur:', error);
                setResult(null);
            } finally {
                setIsLoading(false);
            }
        };

        // Debounce pour éviter trop d'appels
        const timeoutId = setTimeout(fillProduct, 300);

        return () => clearTimeout(timeoutId);
    }, [productName, category, enabled]);

    // Filtrer par confiance minimale
    if (result && result.confidence < minConfidence) {
        return null;
    }

    return result;
}

/**
 * Extraction intelligente depuis le nom du produit
 */
function extractFromProductName(name: string, category: string): Record<string, any> {
    const extracted: Record<string, any> = {};
    const nameLower = name.toLowerCase();

    // ═══ TÉLÉPHONE ═══
    if (category === 'telephone') {
        // Marques courantes
        const brands = ['samsung', 'iphone', 'apple', 'huawei', 'xiaomi', 'oppo', 'tecno', 'infinix', 'itel'];
        for (const brand of brands) {
            if (nameLower.includes(brand)) {
                extracted.marqueTelephone = brand === 'iphone' ? 'Apple' : capitalizeFirst(brand);
                break;
            }
        }

        // Modèle (texte après marque)
        if (extracted.marqueTelephone) {
            const parts = name.split(new RegExp(extracted.marqueTelephone, 'i'));
            if (parts.length > 1) {
                extracted.modeleTelephone = parts[1].trim().split(/[,\-\(]/)[0].trim();
            }
        }

        // Stockage
        const storageMatch = name.match(/(\d+)\s*GB/i);
        if (storageMatch) {
            extracted.stockage = `${storageMatch[1]}GB`;
        }

        // RAM
        const ramMatch = name.match(/(\d+)\s*GB.*RAM/i);
        if (ramMatch) {
            extracted.ram = `${ramMatch[1]}GB`;
        }

        // État
        if (nameLower.includes('neuf') || nameLower.includes('new')) {
            extracted.etatTelephone = 'Neuf';
        } else if (nameLower.includes('occasion') || nameLower.includes('used')) {
            extracted.etatTelephone = 'Occasion';
        }
    }

    // ═══ AUTOMOBILE ═══
    else if (category === 'automobile') {
        // Marques courantes
        const autoBrands = ['toyota', 'honda', 'nissan', 'mercedes', 'bmw', 'peugeot', 'renault', 'hyundai', 'kia'];
        for (const brand of autoBrands) {
            if (nameLower.includes(brand)) {
                extracted.marqueAutomobile = capitalizeFirst(brand);
                break;
            }
        }

        // Année
        const yearMatch = name.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
            extracted.annee = yearMatch[0];
        }

        // Kilométrage
        const kmMatch = name.match(/(\d+)\s*(km|kilometre)/i);
        if (kmMatch) {
            extracted.kilometrage = kmMatch[1];
        }

        // Carburant
        if (nameLower.includes('diesel')) extracted.typeCarburant = 'Diesel';
        else if (nameLower.includes('essence')) extracted.typeCarburant = 'Essence';
        else if (nameLower.includes('hybrid')) extracted.typeCarburant = 'Hybride';
    }

    // ═══ VÊTEMENT ═══
    else if (category === 'vetement') {
        // Taille
        const sizeMatch = name.match(/\b(XS|S|M|L|XL|XXL|XXXL)\b/i);
        if (sizeMatch) {
            extracted.taille = sizeMatch[0].toUpperCase();
        }

        // Couleur
        const colors = ['noir', 'blanc', 'rouge', 'bleu', 'vert', 'jaune', 'rose', 'violet', 'gris'];
        for (const color of colors) {
            if (nameLower.includes(color)) {
                extracted.couleur = capitalizeFirst(color);
                break;
            }
        }

        // Matière
        if (nameLower.includes('coton')) extracted.matiere = 'Coton';
        else if (nameLower.includes('polyester')) extracted.matiere = 'Polyester';
        else if (nameLower.includes('soie')) extracted.matiere = 'Soie';
    }

    // ═══ AGRICULTURE ═══
    else if (category === 'agriculture') {
        // Origine
        const countries = ['vietnam', 'cameroun', 'nigeria', 'senegal', 'mali', 'burkina'];
        for (const country of countries) {
            if (nameLower.includes(country)) {
                extracted.origine = capitalizeFirst(country);
                break;
            }
        }

        // Qualité
        if (nameLower.includes('premium') || nameLower.includes('qualité supérieure')) {
            extracted.qualite = 'Premium';
        } else if (nameLower.includes('standard')) {
            extracted.qualite = 'Standard';
        }

        // Unité par défaut
        extracted.unite = 'sac (50kg)';
    }

    return extracted;
}

/**
 * Capitaliser la première lettre
 */
function capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Hook pour obtenir uniquement les suggestions (sans auto-fill)
 */
export function useProductSuggestions(
    category: string,
    currentFields: Record<string, any>
): Record<string, string[]> {
    const [suggestions, setSuggestions] = useState<Record<string, string[]>>({});

    useEffect(() => {
        // Générer suggestions basées sur les champs actuels
        const generateSuggestions = async () => {
            try {
                // Exemple : si marque est remplie, suggérer modèles
                if (category === 'telephone' && currentFields.marqueTelephone) {
                    const { getModelesByMarque } = await import('../utils/parseExistingModalities');
                    const modeles = getModelesByMarque(currentFields.marqueTelephone, 'telephone');
                    setSuggestions({ modeleTelephone: modeles });
                }

                if (category === 'automobile' && currentFields.marqueAutomobile) {
                    const { getModelesByMarque } = await import('../utils/parseExistingModalities');
                    const modeles = getModelesByMarque(currentFields.marqueAutomobile, 'automobile');
                    setSuggestions({ modeleAutomobile: modeles });
                }
            } catch (error) {
                console.error('[useProductSuggestions] Erreur:', error);
            }
        };

        generateSuggestions();
    }, [category, JSON.stringify(currentFields)]);

    return suggestions;
}

