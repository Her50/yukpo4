/**
 * 🎯 SERVICE DE PRÉ-REMPLISSAGE AUTOMATIQUE DES PRODUITS
 * 
 * Ce service permet de RÉDUIRE DRASTIQUEMENT le nombre de saisies :
 * 
 * AVANT : 15 champs à remplir ❌
 * APRÈS : 3-4 champs seulement ✅
 * 
 * Comment ? En pré-remplissant automatiquement tous les champs connus
 * quand l'utilisateur sélectionne un produit enrichi.
 */

import { EnrichedProduct, searchEnrichedProduct } from '../data/enrichedProductDatabase';
import { apiPost } from './api';

export interface AutoFilledFormData {
    // Champs pré-remplis automatiquement
    auto_filled: Record<string, any>;
    
    // Champs que l'utilisateur DOIT remplir
    required_fields: {
        field: string;
        label: string;
        type: 'select' | 'number' | 'text';
        options?: string[];
        placeholder?: string;
    }[];
    
    // Champs optionnels
    optional_fields?: {
        field: string;
        label: string;
        type: 'select' | 'number' | 'text';
        options?: string[];
    }[];
    
    // Métadonnées
    product_found: boolean;
    fields_saved: number; // Nombre de champs économisés
    total_fields: number; // Total de champs dans le formulaire complet
}

class ProductAutoFillService {
    
    /**
     * 🎯 FONCTION PRINCIPALE : Pré-remplir le formulaire
     * 
     * @param productName - Le nom du produit sélectionné
     * @param userCountry - Code pays de l'utilisateur (pour localisation)
     * @returns Données pré-remplies + champs à demander
     */
    async autoFillProduct(
        productName: string,
        userCountry: string = 'CM'
    ): Promise<AutoFilledFormData> {
        
        // 1. Chercher le produit dans la base enrichie
        const enrichedProduct = searchEnrichedProduct(productName);
        
        if (!enrichedProduct) {
            // Produit inconnu : formulaire complet
            return this.getFullFormFallback(productName);
        }
        
        // 2. Extraire les caractéristiques fixes (à pré-remplir)
        const autoFilled = this.extractAutoFilledFields(enrichedProduct);
        
        // 3. Extraire les champs variables (à demander à l'utilisateur)
        const requiredFields = enrichedProduct.characteristics.caracteristiques_variables || [];
        
        // 4. Calculer l'économie de saisie
        const totalFields = Object.keys(autoFilled).length + requiredFields.length;
        const fieldsSaved = Object.keys(autoFilled).length;
        
        console.log(`✨ [AutoFill] ${fieldsSaved} champs pré-remplis automatiquement sur ${totalFields} !`);
        
        // 5. Enregistrer l'utilisation (statistiques)
        this.recordProductUsage(enrichedProduct.id, userCountry);
        
        return {
            auto_filled: autoFilled,
            required_fields: requiredFields.filter(f => f.required),
            optional_fields: requiredFields.filter(f => !f.required),
            product_found: true,
            fields_saved: fieldsSaved,
            total_fields: totalFields
        };
    }
    
    /**
     * Extraire les champs à pré-remplir automatiquement
     */
    private extractAutoFilledFields(product: EnrichedProduct): Record<string, any> {
        const autoFilled: Record<string, any> = {};
        
        const char = product.characteristics;
        
        // Champs système
        if (char.categorie) autoFilled.categorie = char.categorie;
        if (char.marque) autoFilled.marque = char.marque;
        if (char.type) autoFilled.type = char.type;
        if (char.unite) autoFilled.unite = char.unite;
        
        // Nom du produit
        autoFilled.nom_produit = product.nom;
        
        // Caractéristiques fixes
        if (char.caracteristiques_fixes) {
            Object.entries(char.caracteristiques_fixes).forEach(([key, value]) => {
                autoFilled[key] = value;
            });
        }
        
        return autoFilled;
    }
    
    /**
     * Fallback : Formulaire complet si produit inconnu
     */
    private getFullFormFallback(productName: string): AutoFilledFormData {
        return {
            auto_filled: {
                nom_produit: productName
            },
            required_fields: [
                { field: 'categorie', label: 'Catégorie', type: 'select', options: ['Téléphone', 'Automobile', 'Agriculture', 'Construction', 'Autre'] },
                { field: 'marque', label: 'Marque', type: 'text' },
                { field: 'type', label: 'Type', type: 'text' },
                { field: 'unite', label: 'Unité de vente', type: 'select', options: ['unité', 'kg', 'sac', 'litre', 'mètre'] },
                { field: 'etat', label: 'État', type: 'select', options: ['Neuf', 'Occasion', 'Très bon état'] },
                { field: 'prix', label: 'Prix (FCFA)', type: 'number' }
            ],
            product_found: false,
            fields_saved: 1, // Seulement le nom
            total_fields: 7
        };
    }
    
    /**
     * Enregistrer l'utilisation d'un produit (statistiques)
     */
    private async recordProductUsage(productId: string, country: string): Promise<void> {
        try {
            await apiPost('/api/products/record-usage', {
                product_id: productId,
                country,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            // Ne pas bloquer pour une erreur de statistiques
            console.warn('[AutoFill] Erreur enregistrement usage:', error);
        }
    }
    
    /**
     * 🌍 Suggérer l'unité appropriée selon le produit
     * (Logique africaine : sacs pour céréales, bidons pour huile, etc.)
     */
    detectAppropriateUnit(productName: string, category?: string): string {
        const name = productName.toLowerCase();
        
        // Règles par mots-clés
        if (/riz|maïs|mil|sorgho|blé|haricot/.test(name)) {
            return 'sac (50kg)';
        }
        if (/huile|essence|gasoil|eau/.test(name)) {
            return 'litre';
        }
        if (/ciment|sable|gravier/.test(name)) {
            return 'sac (50kg)';
        }
        if (/tomate|oignon|pomme|carotte|banane/.test(name)) {
            return 'kg';
        }
        if (/telephone|ordinateur|tablette|tv/.test(name)) {
            return 'unité';
        }
        if (/voiture|moto|velo/.test(name)) {
            return 'unité';
        }
        
        // Règles par catégorie
        if (category) {
            const cat = category.toLowerCase();
            if (cat.includes('telephone') || cat.includes('electronique')) {
                return 'unité';
            }
            if (cat.includes('automobile') || cat.includes('vehicule')) {
                return 'unité';
            }
            if (cat.includes('agricole') || cat.includes('cereale')) {
                return 'sac (50kg)';
            }
            if (cat.includes('liquide')) {
                return 'litre';
            }
        }
        
        // Défaut
        return 'unité';
    }
    
    /**
     * 🧠 Proposer un enrichissement pour un produit inconnu
     * (Crowdsourcing : les utilisateurs enrichissent la base)
     */
    async proposeEnrichment(
        productName: string,
        userFilledData: Record<string, any>,
        userId?: string
    ): Promise<void> {
        try {
            // Envoyer au backend pour validation
            await apiPost('/api/products/propose-enrichment', {
                product_name: productName,
                characteristics: userFilledData,
                proposed_by: userId || 'anonymous',
                country: userFilledData.country || 'CM',
                timestamp: new Date().toISOString()
            });
            
            console.log(`✅ [AutoFill] Enrichissement proposé pour: ${productName}`);
        } catch (error) {
            console.error('[AutoFill] Erreur proposition enrichissement:', error);
        }
    }
}

// Instance singleton
export const productAutoFillService = new ProductAutoFillService();

/**
 * ═══════════════════════════════════════════════════════════════
 * 📊 EXEMPLE D'UTILISATION
 * ═══════════════════════════════════════════════════════════════
 * 
 * SCÉNARIO 1 : Vente d'iPhone 15 Pro Max
 * ───────────────────────────────────────
 * 
 * const result = await productAutoFillService.autoFillProduct('iPhone 15 Pro Max');
 * 
 * console.log(result);
 * // {
 * //   auto_filled: {
 * //     nom_produit: 'iPhone 15 Pro Max',
 * //     categorie: 'Téléphone',
 * //     marque: 'Apple',
 * //     type: 'Smartphone',
 * //     unite: 'unité',
 * //     systeme_exploitation: 'iOS 17',
 * //     taille_ecran: '6.7 pouces',
 * //     camera_principale: '48MP Triple caméra',
 * //     processeur: 'A17 Pro',
 * //     ram: '8GB',
 * //     connectivite: '5G',
 * //     // ... 12 CHAMPS PRÉ-REMPLIS !
 * //   },
 * //   required_fields: [
 * //     { field: 'stockage', label: 'Capacité de stockage', type: 'select', options: ['256GB', '512GB', '1TB'] },
 * //     { field: 'couleur', label: 'Couleur', type: 'select', options: ['Titane naturel', 'Titane bleu', ...] },
 * //     { field: 'etat', label: 'État', type: 'select', options: ['Neuf', 'Très bon état', ...] },
 * //     // SEULEMENT 3-4 CHAMPS À REMPLIR !
 * //   ],
 * //   fields_saved: 12,
 * //   total_fields: 15
 * // }
 * 
 * ═══════════════════════════════════════════════════════════════
 * 
 * SCÉNARIO 2 : Vente de riz
 * ───────────────────────────
 * 
 * const result = await productAutoFillService.autoFillProduct('Riz parfumé long grain');
 * 
 * // {
 * //   auto_filled: {
 * //     nom_produit: 'Riz parfumé long grain',
 * //     categorie: 'Produit agricole',
 * //     type: 'Céréale',
 * //     unite: 'sac (50kg)',  // ← UNITÉ AFRICAINE AUTO !
 * //     type_produit: 'Riz',
 * //     variete: 'Long grain parfumé',
 * //     conditionnement_standard: 'Sac de 50kg',
 * //     // ... 8 CHAMPS PRÉ-REMPLIS
 * //   },
 * //   required_fields: [
 * //     { field: 'origine', label: 'Pays d\'origine', type: 'select', options: ['Vietnam', 'Thaïlande', ...] },
 * //     { field: 'qualite', label: 'Qualité', type: 'select', options: ['Premium', 'Standard', ...] },
 * //     { field: 'quantite_sacs', label: 'Nombre de sacs', type: 'number' },
 * //     // SEULEMENT 3 CHAMPS !
 * //   ],
 * //   fields_saved: 8,
 * //   total_fields: 11
 * // }
 * 
 * ═══════════════════════════════════════════════════════════════
 */

