/**
 * \uD83D\uDD2C ANALYSEUR AUTOMATIQUE DE TOUTES VOS CATÉGORIES
 * 
 * Ce système scanne TOUTES vos 60+ catégories et génère automatiquement
 * les configurations de pré-remplissage pour chacune.
 * 
 * Plus besoin d'enrichir manuellement 1000 produits !
 */

import { getAllCategories, getModalitiesByProductType } from '../data/productModalities';

export interface CategoryFieldAnalysis {
    category: string;

    // Champs détectés automatiquement
    fixed_fields: Record<string, any>;      // Toujours identiques pour cette catégorie
    conditional_fields: string[];            // Dépendent du produit (marque, modèle, etc.)
    required_fields: string[];               // Toujours demandés à l'utilisateur
    optional_fields: string[];               // Optionnels

    // Métadonnées
    total_fields: number;
    estimated_autofill: number;             // Nombre de champs auto-remplissables
    estimated_manual: number;                // Nombre de champs à remplir manuellement
    reduction_percentage: number;            // % de saisies économisées

    // Unité détectée
    default_unit: string;
    alternative_units: string[];
}

class CategoryAnalyzer {

    /**
     * \uD83C\uDFAF FONCTION PRINCIPALE : Analyser TOUTES vos catégories
     */
    async analyzeAllCategories(): Promise<Record<string, CategoryFieldAnalysis>> {
        const categories = getAllCategories(); // Vos 60+ catégories
        const results: Record<string, CategoryFieldAnalysis> = {};

        console.log(`\uD83D\uDD2C [CategoryAnalyzer] Analyse de ${categories.length} catégories...`);

        for (const category of categories) {
            results[category] = this.analyzeCategory(category);
        }

        // Générer le rapport
        this.generateReport(results);

        return results;
    }

    /**
     * Analyser UNE catégorie spécifique
     */
    analyzeCategory(category: string): CategoryFieldAnalysis {
        const modalities = getModalitiesByProductType(category);
        const fields = Object.keys(modalities);

        // Détecter champs fixes
        const fixed_fields = this.detectFixedFields(category, modalities);

        // Détecter champs conditionnels
        const conditional_fields = this.detectConditionalFields(category, fields);

        // Détecter champs requis
        const required_fields = this.detectRequiredFields(category, fields);

        // Champs optionnels = tout sauf fixed, conditional et required
        const optional_fields = fields.filter(f =>
            !conditional_fields.includes(f) &&
            !required_fields.includes(f) &&
            !Object.keys(fixed_fields).includes(f)
        );

        // Détection unité
        const unitInfo = this.detectUnit(category, modalities);

        // Calculs
        const estimated_autofill = Object.keys(fixed_fields).length + conditional_fields.length;
        const estimated_manual = required_fields.length;
        const total_fields = fields.length;
        const reduction_percentage = total_fields > 0
            ? Math.round((estimated_autofill / total_fields) * 100)
            : 0;

        return {
            category,
            fixed_fields,
            conditional_fields,
            required_fields,
            optional_fields,
            total_fields,
            estimated_autofill,
            estimated_manual,
            reduction_percentage,
            default_unit: unitInfo.default,
            alternative_units: unitInfo.alternatives
        };
    }

    /**
     * Détecter les champs fixes par catégorie
     */
    private detectFixedFields(category: string, modalities: any): Record<string, any> {
        const fixed: Record<string, any> = {};

        // Catégorie toujours fixe
        fixed.categorie = this.formatCategoryName(category);

        // Type souvent fixe selon la catégorie
        const categoryLower = category.toLowerCase();

        if (categoryLower === 'telephone') {
            fixed.type = 'Smartphone';
        } else if (categoryLower === 'agriculture') {
            fixed.type = 'Produit agricole';
        } else if (categoryLower === 'electromenager') {
            fixed.type = 'Électroménager';
        } else if (categoryLower === 'automobile') {
            fixed.type = 'Véhicule';
        } else if (categoryLower === 'immobilier') {
            fixed.type = 'Bien immobilier';
        } else if (categoryLower === 'hotellerie') {
            fixed.type = 'Service hôtelier';
        } else if (categoryLower === 'voyage') {
            fixed.type = 'Service de voyage';
        } else if (categoryLower === 'prestation_service') {
            fixed.type = 'Prestation de service';
        } else if (categoryLower === 'formation') {
            fixed.type = 'Formation';
        } else if (categoryLower === 'evenementiel') {
            fixed.type = 'Événement';
        } else if (categoryLower === 'restauration') {
            fixed.type = 'Service de restauration';
        } else if (categoryLower === 'assurance') {
            fixed.type = 'Assurance';
        } else if (categoryLower === 'pharmacie') {
            fixed.type = 'Produit pharmaceutique';
        } else if (categoryLower === 'cosmetique_parfum') {
            fixed.type = 'Cosmétique';
        } else if (categoryLower === 'agroalimentaire') {
            fixed.type = 'Produit agroalimentaire';
        }

        // Unité souvent fixe
        const unitInfo = this.detectUnit(category, modalities);
        if (unitInfo.confidence > 80) {
            fixed.unite = unitInfo.default;
        }

        return fixed;
    }

    /**
     * Détecter les champs conditionnels
     */
    private detectConditionalFields(category: string, allFields: string[]): string[] {
        const conditionals: string[] = [];

        // Patterns communs pour tous les produits
        const commonPatterns = [
            'marque', 'modele', 'type', 'systeme', 'taille_ecran',
            'processeur', 'ram', 'capacite', 'puissance', 'taille',
            'dimension', 'poids', 'version', 'edition', 'generation'
        ];

        conditionals.push(...allFields.filter(f =>
            commonPatterns.some(p => f.toLowerCase().includes(p))
        ));

        // Patterns spécifiques par catégorie
        const categoryLower = category.toLowerCase();

        if (categoryLower === 'automobile') {
            conditionals.push(...allFields.filter(f =>
                ['marque', 'modele', 'annee', 'carburant', 'transmission'].some(p =>
                    f.toLowerCase().includes(p)
                )
            ));
        } else if (categoryLower === 'immobilier') {
            conditionals.push(...allFields.filter(f =>
                ['type_bien', 'quartier', 'ville'].some(p =>
                    f.toLowerCase().includes(p)
                )
            ));
        } else if (categoryLower === 'telephone' || categoryLower === 'ordinateur') {
            conditionals.push(...allFields.filter(f =>
                ['marque', 'modele', 'stockage', 'ram', 'processeur', 'systeme'].some(p =>
                    f.toLowerCase().includes(p)
                )
            ));
        } else if (categoryLower === 'agriculture' || categoryLower === 'agroalimentaire') {
            conditionals.push(...allFields.filter(f =>
                ['origine', 'qualite', 'type_produit', 'variete'].some(p =>
                    f.toLowerCase().includes(p)
                )
            ));
        }

        return [...new Set(conditionals)];
    }

    /**
     * Détecter les champs requis
     */
    private detectRequiredFields(category: string, allFields: string[]): string[] {
        const required: string[] = [];

        // Universels (toujours requis)
        const universal = ['prix', 'etat', 'quantite'];
        required.push(...allFields.filter(f =>
            universal.some(u => f.toLowerCase().includes(u))
        ));

        // Spécifiques par catégorie
        const categoryLower = category.toLowerCase();

        switch (categoryLower) {
            case 'telephone':
            case 'ordinateur':
                required.push(...allFields.filter(f =>
                    ['stockage', 'ram', 'marque'].some(p => f.toLowerCase().includes(p))
                ));
                break;

            case 'automobile':
                required.push(...allFields.filter(f =>
                    ['annee', 'kilometrage', 'carburant', 'transmission', 'marque'].some(p =>
                        f.toLowerCase().includes(p)
                    )
                ));
                break;

            case 'immobilier':
                required.push(...allFields.filter(f =>
                    ['superficie', 'ville', 'quartier', 'type_bien'].some(p =>
                        f.toLowerCase().includes(p)
                    )
                ));
                break;

            case 'vetement':
                required.push(...allFields.filter(f =>
                    ['taille', 'matiere', 'couleur'].some(p => f.toLowerCase().includes(p))
                ));
                break;

            case 'chaussure':
                required.push(...allFields.filter(f =>
                    ['pointure', 'couleur'].some(p => f.toLowerCase().includes(p))
                ));
                break;

            case 'agriculture':
            case 'agroalimentaire':
                required.push(...allFields.filter(f =>
                    ['origine', 'qualite', 'type_produit'].some(p => f.toLowerCase().includes(p))
                ));
                break;

            case 'prestation_service':
            case 'formation':
            case 'evenementiel':
                required.push(...allFields.filter(f =>
                    ['duree', 'lieu', 'date'].some(p => f.toLowerCase().includes(p))
                ));
                break;

            case 'hotellerie':
            case 'voyage':
                required.push(...allFields.filter(f =>
                    ['date', 'duree', 'lieu'].some(p => f.toLowerCase().includes(p))
                ));
                break;

            case 'pharmacie':
                required.push(...allFields.filter(f =>
                    ['quantite', 'date_peremption'].some(p => f.toLowerCase().includes(p))
                ));
                break;

            case 'restauration':
                required.push(...allFields.filter(f =>
                    ['lieu', 'type_cuisine'].some(p => f.toLowerCase().includes(p))
                ));
                break;

            case 'animaux':
                required.push(...allFields.filter(f =>
                    ['espece', 'age', 'race'].some(p => f.toLowerCase().includes(p))
                ));
                break;
        }

        return [...new Set(required)];
    }

    /**
     * Détecter l'unité appropriée
     */
    private detectUnit(category: string, modalities: any): {
        default: string;
        alternatives: string[];
        confidence: number;
    } {
        // Si unités explicites dans les modalités
        if (modalities.unites && Array.isArray(modalities.unites)) {
            const valid = modalities.unites.filter((u: string) => !u.includes('\uD83C\uDD95'));
            if (valid.length > 0) {
                return { default: valid[0], alternatives: valid.slice(1), confidence: 95 };
            }
        }

        // Détection par catégorie
        const cat = category.toLowerCase();

        // Produits unitaires
        if (cat.includes('telephone') || cat.includes('ordinateur') ||
            cat.includes('automobile') || cat.includes('electromenager') ||
            cat.includes('image_son') || cat.includes('electronique') ||
            cat.includes('jouets_enfants') || cat.includes('bijoux') ||
            cat.includes('mobilier') || cat.includes('ustensiles_cuisine')) {
            return { default: 'unité', alternatives: ['pièce'], confidence: 90 };
        }

        // Vêtements et textiles
        if (cat.includes('vetement') || cat.includes('chaussure') ||
            cat.includes('textile') || cat.includes('cosmetique_parfum')) {
            return { default: 'unité', alternatives: ['pièce', 'lot'], confidence: 85 };
        }

        // Agriculture et agroalimentaire (poids)
        if (cat.includes('agriculture') || cat.includes('cereale') ||
            cat.includes('agroalimentaire')) {
            return { default: 'sac (50kg)', alternatives: ['kg', 'tonne', 'sacs'], confidence: 85 };
        }

        // Liquides
        if (cat.includes('liquide') || cat.includes('huile') ||
            cat.includes('pharmacie') || cat.includes('cosmetique_parfum')) {
            return { default: 'litre', alternatives: ['bidon (5L)', 'bidon (20L)', 'ml'], confidence: 85 };
        }

        // Construction et quincaillerie
        if (cat.includes('construction') || cat.includes('quincaillerie') ||
            cat.includes('plomberie') || cat.includes('electricite') ||
            cat.includes('menuiserie')) {
            return { default: 'unité', alternatives: ['kg', 'tonne', 'm³', 'm²'], confidence: 75 };
        }

        // Immobilier (superficie)
        if (cat.includes('immobilier')) {
            return { default: 'm²', alternatives: ['hectare', 'm²'], confidence: 90 };
        }

        // Services (heures/jours)
        if (cat.includes('prestation_service') || cat.includes('formation') ||
            cat.includes('evenementiel') || cat.includes('restauration') ||
            cat.includes('hotellerie') || cat.includes('voyage') ||
            cat.includes('demenagement') || cat.includes('coiffure_beaute') ||
            cat.includes('bien-etre') || cat.includes('assurance')) {
            return { default: 'heure', alternatives: ['jour', 'mois', 'forfait'], confidence: 80 };
        }

        // Animaux
        if (cat.includes('animaux')) {
            return { default: 'unité', alternatives: ['lot', 'paire'], confidence: 85 };
        }

        // Par défaut
        return { default: 'unité', alternatives: ['kg', 'litre', 'pièce'], confidence: 50 };
    }

    /**
     * Formater nom catégorie
     */
    private formatCategoryName(category: string): string {
        return category
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Générer rapport détaillé
     */
    private generateReport(results: Record<string, CategoryFieldAnalysis>): void {
        const categories = Object.values(results);
        const totalCategories = categories.length;

        if (totalCategories === 0) return;

        const avgReduction = categories.reduce((s, c) => s + c.reduction_percentage, 0) / totalCategories;
        const avgFields = categories.reduce((s, c) => s + c.total_fields, 0) / totalCategories;
        const avgAutofill = categories.reduce((s, c) => s + c.estimated_autofill, 0) / totalCategories;
        const avgManual = categories.reduce((s, c) => s + c.estimated_manual, 0) / totalCategories;

        // Top 5 catégories avec meilleure réduction
        const topCategories = categories
            .sort((a, b) => b.reduction_percentage - a.reduction_percentage)
            .slice(0, 5);

        console.log(`\n╔═══════════════════════════════════════════════════════════╗`);
        console.log(`║     \uD83D\uDCCA RAPPORT D'ANALYSE DES CATÉGORIES                  ║`);
        console.log(`╚═══════════════════════════════════════════════════════════╝`);
        console.log(`\n\uD83D\uDCE6 Total de catégories analysées: ${totalCategories}`);
        console.log(`\uD83D\uDCC8 Réduction moyenne de saisie: ${avgReduction.toFixed(0)}%`);
        console.log(`\uD83D\uDCDD Champs moyens par catégorie: ${avgFields.toFixed(1)}`);
        console.log(`✨ Champs auto-remplis moyens: ${avgAutofill.toFixed(1)}`);
        console.log(`✍️  Champs manuels moyens: ${avgManual.toFixed(1)}`);

        console.log(`\n\uD83C\uDFC6 Top 5 catégories avec meilleure réduction:`);
        topCategories.forEach((cat, index) => {
            console.log(`   ${index + 1}. ${cat.category}: ${cat.reduction_percentage}% (${cat.estimated_autofill}/${cat.total_fields} champs)`);
        });

        // Catégories nécessitant attention (réduction < 30%)
        const lowReduction = categories.filter(c => c.reduction_percentage < 30);
        if (lowReduction.length > 0) {
            console.log(`\n⚠️  Catégories nécessitant enrichissement (réduction < 30%):`);
            lowReduction.forEach(cat => {
                console.log(`   - ${cat.category}: ${cat.reduction_percentage}%`);
            });
        }

        console.log(`\n`);
    }
}

// Instance singleton
export const categoryAnalyzer = new CategoryAnalyzer();

/**
 * \uD83C\uDFAF FONCTION HELPER : Obtenir la configuration pour une catégorie
 */
export async function getCategoryConfiguration(category: string): Promise<CategoryFieldAnalysis | null> {
    try {
        return categoryAnalyzer.analyzeCategory(category);
    } catch (error) {
        console.error(`[CategoryAnalyzer] Erreur analyse ${category}:`, error);
        return null;
    }
}
