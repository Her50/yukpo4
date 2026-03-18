/**
 * \uD83C\uDFAF SERVICE GÉNÉRIQUE DE PRÉ-REMPLISSAGE AUTOMATIQUE
 * 
 * Ce service s'adapte automatiquement à N'IMPORTE QUELLE catégorie
 * parmi vos 60+ catégories, sans configuration manuelle !
 * 
 * CONTRAIREMENT à productAutoFillService.ts qui nécessite une base enrichie manuelle,
 * ce service GÉNÈRE automatiquement les règles de pré-remplissage en analysant
 * la structure de productModalities.ts
 */

import { getFieldOptions, getModalitiesByProductType } from '../data/productModalities';
import { CategoryFieldAnalysis, categoryAnalyzer } from '../utils/categoryAnalyzer';

export interface GenericAutoFillResult {
    // Champs pré-remplis automatiquement
    auto_filled: Record<string, any>;

    // Champs à demander (avec leurs options si disponibles)
    required_fields: Array<{
        field: string;
        label: string;
        type: 'select' | 'multiselect' | 'number' | 'text' | 'date';
        options?: string[];
        placeholder?: string;
    }>;

    // Champs optionnels
    optional_fields: Array<{
        field: string;
        label: string;
        type: string;
        options?: string[];
    }>;

    // Métadonnées
    category: string;
    product_name: string;
    fields_saved: number;
    total_fields: number;
    reduction_percentage: number;
    auto_fill_applied: boolean;
}

class GenericProductAutoFillService {

    // Cache des analyses de catégories
    private categoryCache = new Map<string, CategoryFieldAnalysis>();

    /**
     * \uD83C\uDFAF PRÉ-REMPLIR AUTOMATIQUEMENT pour N'IMPORTE QUELLE catégorie
     */
    async autoFillGeneric(
        productName: string,
        category: string,
        userCountry: string = 'CM'
    ): Promise<GenericAutoFillResult> {

        console.log(`\uD83C\uDFAF [GenericAutoFill] Pré-remplissage pour: ${productName} (${category})`);

        // 1. Analyser la catégorie si pas en cache
        let categoryAnalysis = this.categoryCache.get(category);
        if (!categoryAnalysis) {
            const modalities = getModalitiesByProductType(category);
            categoryAnalysis = await categoryAnalyzer.analyzeCategory(category);
            this.categoryCache.set(category, categoryAnalysis);
        }

        // 2. Pré-remplir les champs FIXES (toujours identiques pour cette catégorie)
        const auto_filled: Record<string, any> = {
            nom_produit: productName,
            ...categoryAnalysis.fixed_fields
        };

        // 3. Tenter d'extraire des informations du nom du produit
        const extracted = this.extractFromProductName(productName, category);
        Object.assign(auto_filled, extracted);

        // 4. Construire la liste des champs requis avec leurs options
        const required_fields = this.buildRequiredFields(
            categoryAnalysis.required_fields,
            category
        );

        // 5. Construire la liste des champs optionnels
        const optional_fields = this.buildOptionalFields(
            categoryAnalysis.optional_fields,
            category
        );

        // 6. Calculer les statistiques
        const fields_saved = Object.keys(auto_filled).length;
        const total_fields = fields_saved + required_fields.length + optional_fields.length;
        const reduction_percentage = Math.round((fields_saved / total_fields) * 100);

        console.log(`✨ [GenericAutoFill] ${fields_saved} champs pré-remplis (${reduction_percentage}%)`);

        return {
            auto_filled,
            required_fields,
            optional_fields,
            category,
            product_name: productName,
            fields_saved,
            total_fields,
            reduction_percentage,
            auto_fill_applied: fields_saved > 2
        };
    }

    /**
     * Extraire des informations du nom du produit
     */
    private extractFromProductName(productName: string, category: string): Record<string, any> {
        const extracted: Record<string, any> = {};
        const normalized = productName.toLowerCase();

        // TÉLÉPHONES : Extraire marque + modèle
        if (category === 'telephone') {
            // iPhone
            if (normalized.includes('iphone')) {
                extracted.marque = 'Apple';
                extracted.type = 'Smartphone';
                extracted.systeme_exploitation = 'iOS';

                // Extraire modèle
                if (normalized.match(/iphone\s*(\d+)/)) {
                    const version = normalized.match(/iphone\s*(\d+)/)?.[1];
                    extracted.modele = productName; // Garder nom complet
                }
            }
            // Samsung Galaxy
            else if (normalized.includes('galaxy') || normalized.includes('samsung')) {
                extracted.marque = 'Samsung';
                extracted.type = 'Smartphone';
                extracted.systeme_exploitation = 'Android';
            }
            // Tecno
            else if (normalized.startsWith('tecno')) {
                extracted.marque = 'Tecno';
                extracted.type = 'Smartphone';
                extracted.systeme_exploitation = 'Android';
            }
            // Infinix
            else if (normalized.startsWith('infinix')) {
                extracted.marque = 'Infinix';
                extracted.type = 'Smartphone';
                extracted.systeme_exploitation = 'Android';
            }
        }

        // AUTOMOBILES : Extraire marque
        else if (category === 'automobile') {
            if (normalized.startsWith('toyota')) {
                extracted.marque = 'Toyota';
            } else if (normalized.startsWith('mercedes')) {
                extracted.marque = 'Mercedes-Benz';
            } else if (normalized.startsWith('peugeot')) {
                extracted.marque = 'Peugeot';
            }
            // ... etc

            // Extraire année si présente
            const yearMatch = productName.match(/\b(19|20)\d{2}\b/);
            if (yearMatch) {
                extracted.annee = yearMatch[0];
            }
        }

        // AGRICULTURE : Détecter type de produit
        else if (category === 'agriculture' || category === 'agriculture_elevage') {
            if (normalized.includes('riz')) {
                extracted.type_produit = 'Riz';
                extracted.type = 'Céréale';
            } else if (normalized.includes('mais') || normalized.includes('maïs')) {
                extracted.type_produit = 'Maïs';
                extracted.type = 'Céréale';
            } else if (normalized.includes('huile')) {
                extracted.type_produit = 'Huile';
                extracted.type = 'Liquide alimentaire';
            }
        }

        // IMMOBILIER : Extraire type de bien si dans le nom
        else if (category === 'immobilier' || category === 'immobilier_batiment') {
            if (normalized.includes('villa')) {
                extracted.type_bien = 'Villa';
            } else if (normalized.includes('appartement')) {
                extracted.type_bien = 'Appartement';
            } else if (normalized.includes('studio')) {
                extracted.type_bien = 'Studio';
            }
        }

        return extracted;
    }

    /**
     * Construire la liste des champs requis avec options
     */
    private buildRequiredFields(
        fieldNames: string[],
        category: string
    ): GenericAutoFillResult['required_fields'] {
        return fieldNames.map(fieldName => {
            const options = getFieldOptions(category, fieldName);
            const fieldType = this.detectFieldType(fieldName, options) as 'text' | 'number' | 'select' | 'date' | 'multiselect';

            return {
                field: fieldName,
                label: this.formatFieldLabel(fieldName),
                type: fieldType,
                options: options.length > 0 ? options.filter(o => !o.includes('\uD83C\uDD95')) : undefined,
                placeholder: `Entrer ${this.formatFieldLabel(fieldName).toLowerCase()}`
            };
        });
    }

    /**
     * Construire la liste des champs optionnels
     */
    private buildOptionalFields(
        fieldNames: string[],
        category: string
    ): GenericAutoFillResult['optional_fields'] {
        return fieldNames.map(fieldName => {
            const options = getFieldOptions(category, fieldName);
            const fieldType = this.detectFieldType(fieldName, options);

            return {
                field: fieldName,
                label: this.formatFieldLabel(fieldName),
                type: fieldType,
                options: options.length > 0 ? options.filter(o => !o.includes('\uD83C\uDD95')) : undefined
            };
        });
    }

    /**
     * Détecter le type de champ
     */
    private detectFieldType(fieldName: string, options: string[]): string {
        // Multi-select si pluriel ou certains mots-clés
        const multiSelectPatterns = /couleurs|tailles|options|services|langues|certifications|equipements|accessoires/i;
        if (multiSelectPatterns.test(fieldName)) {
            return 'multiselect';
        }

        // Select si options disponibles
        if (options.length > 0) {
            return 'select';
        }

        // Number si contient prix, quantite, annee, etc.
        const numberPatterns = /prix|quantite|annee|age|nombre|nb|superficie|surface|kilometrage|km|distance/i;
        if (numberPatterns.test(fieldName)) {
            return 'number';
        }

        // Date si contient date
        if (fieldName.toLowerCase().includes('date')) {
            return 'date';
        }

        // Text par défaut
        return 'text';
    }

    /**
     * Formater le label d'un champ
     */
    private formatFieldLabel(fieldName: string): string {
        return fieldName
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
}

// Instance singleton
export const genericProductAutoFillService = new GenericProductAutoFillService();

/**
 * ═══════════════════════════════════════════════════════════════
 * \uD83D\uDCCA EXEMPLE D'UTILISATION POUR N'IMPORTE QUELLE CATÉGORIE
 * ═══════════════════════════════════════════════════════════════
 * 
 * // Pour TÉLÉPHONE
 * const result1 = await genericProductAutoFillService.autoFillGeneric(
 *   'Samsung Galaxy A54',
 *   'telephone'
 * );
 * // auto_filled: { categorie, marque, type, systeme, unite, ... }
 * // required_fields: [stockage, couleur, etat, prix]
 * 
 * // Pour VÊTEMENT (même pas d'exemple enrichi !)
 * const result2 = await genericProductAutoFillService.autoFillGeneric(
 *   'Chemise en coton',
 *   'vetement'
 * );
 * // auto_filled: { categorie, type, unite, ... }
 * // required_fields: [taille, couleur, matiere, etat, prix]
 * 
 * // Pour QUINCAILLERIE (même pas d'exemple enrichi !)
 * const result3 = await genericProductAutoFillService.autoFillGeneric(
 *   'Marteau 500g',
 *   'quincaillerie'
 * );
 * // auto_filled: { categorie, unite, ... }
 * // required_fields: [type_outil, matiere, etat, prix]
 * 
 * ═══════════════════════════════════════════════════════════════
 * 
 * LE SYSTÈME S'ADAPTE AUTOMATIQUEMENT À TOUTES VOS 60+ CATÉGORIES !
 */

