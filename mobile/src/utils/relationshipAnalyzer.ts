/**
 * 🔗 ANALYSEUR AUTOMATIQUE DE RELATIONS ENTRE CHAMPS
 * 
 * Scanne productModalities.ts pour détecter automatiquement TOUTES les dépendances :
 * - marque → modèles
 * - ville → quartiers
 * - type → sous-types
 * - pays → villes
 * - etc.
 * 
 * Objectif : Générer l'autocomplete pour TOUTES les combinaisons valides
 */

import { getAllCategories, getModalitiesByProductType, getFieldOptions } from '../data/productModalities';

/**
 * Type de relation entre champs
 */
export type RelationType = 
    | 'one_to_many'      // Un parent → plusieurs enfants (marque → modèles)
    | 'hierarchical'     // Hiérarchie (pays → ville → quartier)
    | 'conditional'      // Condition (si A alors B disponible)
    | 'combined';        // Combinaison (A + B = C)

/**
 * Relation détectée entre deux champs
 */
export interface FieldRelationship {
    category: string;
    parent_field: string;
    child_field: string;
    type: RelationType;
    
    // Mappings : valeur parent → valeurs enfants
    mappings: Record<string, string[]>;
    
    // Confiance dans la détection (0-100)
    confidence: number;
    
    // Exemples
    examples: Array<{
        parent_value: string;
        child_values: string[];
    }>;
}

/**
 * Classe principale d'analyse des relations
 */
class RelationshipAnalyzer {
    private relationships: Map<string, FieldRelationship[]> = new Map();
    private initialized = false;
    
    /**
     * Analyser toutes les catégories pour détecter les relations
     */
    async analyze() {
        if (this.initialized) return;
        
        console.log('🔗 [RelationshipAnalyzer] Analyse des relations...');
        
        const categories = getAllCategories();
        let totalRelations = 0;
        
        for (const category of categories) {
            const relations = this.analyzeCategory(category);
            
            if (relations.length > 0) {
                this.relationships.set(category, relations);
                totalRelations += relations.length;
                
                console.log(`  ✅ ${category}: ${relations.length} relations détectées`);
            }
        }
        
        this.initialized = true;
        console.log(`\n✅ [RelationshipAnalyzer] ${totalRelations} relations trouvées dans ${categories.length} catégories\n`);
        
        // Afficher exemples
        this.printSummary();
    }
    
    /**
     * Analyser UNE catégorie pour détecter ses relations
     */
    private analyzeCategory(category: string): FieldRelationship[] {
        const relations: FieldRelationship[] = [];
        const modalities = getModalitiesByProductType(category);
        const fields = Object.keys(modalities);
        
        // ═══════════════════════════════════════════════════════
        // DÉTECTION 1 : Relations explicites marque → modèle
        // ═══════════════════════════════════════════════════════
        
        if (fields.includes('marques') && 
            (fields.includes('modeles') || fields.includes('modeles_telephone') || fields.includes('modeles_automobile'))) {
            
            const relation = this.detectMarqueModeleRelation(category, modalities);
            if (relation) relations.push(relation);
        }
        
        // Variantes de noms
        if (fields.includes('marque') && fields.includes('modele')) {
            const relation = this.detectMarqueModeleRelation(category, modalities);
            if (relation) relations.push(relation);
        }
        
        // ═══════════════════════════════════════════════════════
        // DÉTECTION 2 : Relations géographiques
        // ═══════════════════════════════════════════════════════
        
        // pays → ville
        if (fields.includes('pays') && fields.includes('ville')) {
            const relation = this.detectGeographicRelation(category, 'pays', 'ville', modalities);
            if (relation) relations.push(relation);
        }
        
        // ville → quartier
        if (fields.includes('ville') && fields.includes('quartier')) {
            const relation = this.detectGeographicRelation(category, 'ville', 'quartier', modalities);
            if (relation) relations.push(relation);
        }
        
        // pays_depart → ville_depart
        if (fields.includes('pays_depart') && fields.includes('ville_depart')) {
            const relation = this.detectGeographicRelation(category, 'pays_depart', 'ville_depart', modalities);
            if (relation) relations.push(relation);
        }
        
        // ville_depart → ville_arrivee (covoiturage)
        if (fields.includes('ville_depart') && fields.includes('ville_arrivee')) {
            const relation = this.detectCityPairRelation(category, modalities);
            if (relation) relations.push(relation);
        }
        
        // ═══════════════════════════════════════════════════════
        // DÉTECTION 3 : Relations hiérarchiques
        // ═══════════════════════════════════════════════════════
        
        // type → sous_type
        if (fields.includes('type') && fields.includes('sous_type')) {
            const relation = this.detectHierarchicalRelation(category, 'type', 'sous_type', modalities);
            if (relation) relations.push(relation);
        }
        
        // categorie → type
        if (fields.includes('categorie') && fields.includes('type')) {
            const relation = this.detectHierarchicalRelation(category, 'categorie', 'type', modalities);
            if (relation) relations.push(relation);
        }
        
        // ═══════════════════════════════════════════════════════
        // DÉTECTION 4 : Relations éducation
        // ═══════════════════════════════════════════════════════
        
        // niveau_etude → classe
        if (fields.includes('niveau_etude') && fields.includes('classe')) {
            const relation = this.detectEducationRelation(category, 'niveau_etude', 'classe', modalities);
            if (relation) relations.push(relation);
        }
        
        // diplome → specialite
        if (fields.includes('diplome') && fields.includes('specialite')) {
            const relation = this.detectEducationRelation(category, 'diplome', 'specialite', modalities);
            if (relation) relations.push(relation);
        }
        
        // ═══════════════════════════════════════════════════════
        // DÉTECTION 5 : Relations métier/domaine spécifique
        // ═══════════════════════════════════════════════════════
        
        // Détecter automatiquement les patterns champ_X → champ_Y
        const autoDetected = this.autoDetectRelations(category, fields, modalities);
        relations.push(...autoDetected);
        
        return relations;
    }
    
    /**
     * Détecter relation marque → modèle
     */
    private detectMarqueModeleRelation(category: string, modalities: any): FieldRelationship | null {
        try {
            const { MODELES_PAR_MARQUE_TELEPHONE, MODELES_PAR_MARQUE_AUTO } = require('./parseExistingModalities');
            
            let mappings: Record<string, string[]> = {};
            let parentField = 'marque';
            let childField = 'modele';
            
            if (category === 'telephone') {
                mappings = MODELES_PAR_MARQUE_TELEPHONE;
                parentField = 'marqueTelephone';
                childField = 'modeleTelephone';
            } else if (category === 'automobile') {
                mappings = MODELES_PAR_MARQUE_AUTO;
                parentField = 'marqueAutomobile';
                childField = 'modeleAutomobile';
            }
            
            if (Object.keys(mappings).length === 0) return null;
            
            // Exemples
            const examples = Object.entries(mappings)
                .slice(0, 3)
                .map(([parent, children]) => ({
                    parent_value: parent,
                    child_values: children.slice(0, 5)
                }));
            
            return {
                category,
                parent_field: parentField,
                child_field: childField,
                type: 'one_to_many',
                mappings,
                confidence: 95,
                examples
            };
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Détecter relation géographique (pays → ville, ville → quartier)
     */
    private detectGeographicRelation(
        category: string,
        parentField: string,
        childField: string,
        modalities: any
    ): FieldRelationship | null {
        const parentOptions = getFieldOptions(category, parentField);
        const childOptions = getFieldOptions(category, childField);
        
        if (parentOptions.length === 0 || childOptions.length === 0) return null;
        
        // Pour la géographie, on peut avoir des mappings dans les données
        // Exemple : ville_cameroun → quartiers_douala
        const mappings: Record<string, string[]> = {};
        
        // Pattern detection : chercher des champs comme "quartiers_douala", "villes_cameroun"
        const allFields = Object.keys(modalities);
        
        for (const parent of parentOptions) {
            if (parent.includes('🆕')) continue;
            
            const parentKey = parent.toLowerCase().replace(/\s+/g, '_');
            
            // Chercher un champ correspondant
            const matchingField = allFields.find(f => 
                f.toLowerCase().includes(parentKey) && 
                f.toLowerCase().includes(childField)
            );
            
            if (matchingField) {
                const childValues = getFieldOptions(category, matchingField);
                mappings[parent] = childValues.filter(v => !v.includes('🆕'));
            }
        }
        
        if (Object.keys(mappings).length === 0) {
            // Pas de mapping explicite, relation existe quand même
            mappings['*'] = childOptions.filter(v => !v.includes('🆕'));
        }
        
        return {
            category,
            parent_field: parentField,
            child_field: childField,
            type: 'hierarchical',
            mappings,
            confidence: Object.keys(mappings).length > 1 ? 80 : 50,
            examples: Object.entries(mappings).slice(0, 2).map(([p, c]) => ({
                parent_value: p,
                child_values: c.slice(0, 5)
            }))
        };
    }
    
    /**
     * Détecter relation ville_depart → ville_arrivee
     */
    private detectCityPairRelation(category: string, modalities: any): FieldRelationship | null {
        const departures = getFieldOptions(category, 'ville_depart');
        const arrivals = getFieldOptions(category, 'ville_arrivee');
        
        if (departures.length === 0 || arrivals.length === 0) return null;
        
        // Toutes les combinaisons sont possibles
        const mappings: Record<string, string[]> = {};
        
        for (const dep of departures) {
            if (dep.includes('🆕')) continue;
            // Toutes les villes sauf la ville de départ
            mappings[dep] = arrivals.filter(arr => arr !== dep && !arr.includes('🆕'));
        }
        
        return {
            category,
            parent_field: 'ville_depart',
            child_field: 'ville_arrivee',
            type: 'conditional',
            mappings,
            confidence: 90,
            examples: Object.entries(mappings).slice(0, 2).map(([p, c]) => ({
                parent_value: p,
                child_values: c.slice(0, 5)
            }))
        };
    }
    
    /**
     * Détecter relation hiérarchique générique
     */
    private detectHierarchicalRelation(
        category: string,
        parentField: string,
        childField: string,
        modalities: any
    ): FieldRelationship | null {
        const parentOptions = getFieldOptions(category, parentField);
        const childOptions = getFieldOptions(category, childField);
        
        if (parentOptions.length === 0 || childOptions.length === 0) return null;
        
        // Essayer de détecter des patterns dans les noms
        const mappings: Record<string, string[]> = {};
        
        for (const parent of parentOptions) {
            if (parent.includes('🆕')) continue;
            
            const parentLower = parent.toLowerCase();
            
            // Chercher des enfants qui contiennent le nom du parent
            const matchingChildren = childOptions.filter(child => 
                !child.includes('🆕') && 
                (child.toLowerCase().includes(parentLower) || 
                 parentLower.includes(child.toLowerCase()))
            );
            
            if (matchingChildren.length > 0) {
                mappings[parent] = matchingChildren;
            }
        }
        
        if (Object.keys(mappings).length === 0) {
            // Pas de pattern détecté, relation générique
            mappings['*'] = childOptions.filter(v => !v.includes('🆕'));
        }
        
        return {
            category,
            parent_field: parentField,
            child_field: childField,
            type: 'hierarchical',
            mappings,
            confidence: Object.keys(mappings).length > 1 ? 70 : 40,
            examples: Object.entries(mappings).slice(0, 2).map(([p, c]) => ({
                parent_value: p,
                child_values: c.slice(0, 5)
            }))
        };
    }
    
    /**
     * Détecter relation éducation
     */
    private detectEducationRelation(
        category: string,
        parentField: string,
        childField: string,
        modalities: any
    ): FieldRelationship | null {
        return this.detectHierarchicalRelation(category, parentField, childField, modalities);
    }
    
    /**
     * Détecter automatiquement toutes les relations potentielles
     */
    private autoDetectRelations(
        category: string,
        fields: string[],
        modalities: any
    ): FieldRelationship[] {
        const relations: FieldRelationship[] = [];
        
        // Patterns à détecter
        const patterns = [
            { parent: /^type/, child: /^sous_type|subtype/ },
            { parent: /^categorie/, child: /^type|sous_categorie/ },
            { parent: /^secteur/, child: /^metier|specialite/ },
            { parent: /^niveau/, child: /^classe|annee/ },
            { parent: /^structure/, child: /^service|departement/ },
        ];
        
        for (const pattern of patterns) {
            const parentFields = fields.filter(f => pattern.parent.test(f));
            const childFields = fields.filter(f => pattern.child.test(f));
            
            for (const pf of parentFields) {
                for (const cf of childFields) {
                    const relation = this.detectHierarchicalRelation(category, pf, cf, modalities);
                    if (relation && relation.confidence > 50) {
                        relations.push(relation);
                    }
                }
            }
        }
        
        return relations;
    }
    
    /**
     * Obtenir les relations pour une catégorie
     */
    getRelationships(category: string): FieldRelationship[] {
        return this.relationships.get(category) || [];
    }
    
    /**
     * Obtenir les valeurs enfants pour une valeur parent
     */
    getChildValues(category: string, parentField: string, parentValue: string): string[] {
        const relations = this.getRelationships(category);
        
        const relation = relations.find(r => r.parent_field === parentField);
        if (!relation) return [];
        
        // Chercher mapping exact
        if (relation.mappings[parentValue]) {
            return relation.mappings[parentValue];
        }
        
        // Fallback sur '*' (toutes les valeurs)
        if (relation.mappings['*']) {
            return relation.mappings['*'];
        }
        
        return [];
    }
    
    /**
     * Afficher résumé des relations trouvées
     */
    private printSummary() {
        console.log('═══════════════════════════════════════════════════════');
        console.log('📊 RÉSUMÉ DES RELATIONS DÉTECTÉES');
        console.log('═══════════════════════════════════════════════════════\n');
        
        for (const [category, relations] of this.relationships.entries()) {
            console.log(`\n📦 ${category.toUpperCase()}:`);
            
            for (const rel of relations) {
                const mappingCount = Object.keys(rel.mappings).length;
                console.log(`  → ${rel.parent_field} → ${rel.child_field} (${mappingCount} mappings, ${rel.confidence}% confiance)`);
                
                if (rel.examples.length > 0) {
                    const ex = rel.examples[0];
                    console.log(`     Ex: "${ex.parent_value}" → [${ex.child_values.slice(0, 3).join(', ')}...]`);
                }
            }
        }
        
        console.log('\n═══════════════════════════════════════════════════════\n');
    }
    
    /**
     * Exporter toutes les relations en JSON
     */
    exportToJSON(): Record<string, FieldRelationship[]> {
        const result: Record<string, FieldRelationship[]> = {};
        
        for (const [category, relations] of this.relationships.entries()) {
            result[category] = relations;
        }
        
        return result;
    }
}

// Instance singleton
export const relationshipAnalyzer = new RelationshipAnalyzer();

/**
 * Initialiser l'analyseur au démarrage
 */
export async function initializeRelationships() {
    await relationshipAnalyzer.analyze();
}

