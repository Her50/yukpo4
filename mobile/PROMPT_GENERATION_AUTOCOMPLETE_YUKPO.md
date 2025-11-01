# 🎯 PROMPT : Génération d'Autocomplete Intelligent Yukpomnang

## 📚 DOCUMENTS DE RÉFÉRENCE

**IMPORTANT** : Lis ces documents pour comprendre l'architecture complète :

1. **`ARCHITECTURE_FINALE_YUKPO_AUTOCOMPLETE.md`** ⭐⭐⭐
   - Architecture hybride (JSON embarqué + PostgreSQL)
   - Flux utilisateur complet (99% vs 1% des cas)
   - Formulaire UNIVERSEL vs Formulaires SPÉCIFIQUES
   - Structure code et implémentation
   - **À LIRE EN PRIORITÉ**

2. **`SYSTEME_DETECTION_CATEGORIE.md`** ⭐⭐
   - Comment détecter automatiquement la catégorie
   - Algorithme de scoring (mots-clés → catégorie)
   - Les 3 scénarios (claire, ambiguë, inconnue)
   - Dictionnaire mots-clés par catégorie

3. **`GUIDE_UTILISATION_PROMPT_AUTOCOMPLETE.md`** ⭐
   - Comment utiliser ce prompt
   - Ordre recommandé des catégories
   - Exemples pratiques
   - Structure fichiers finaux

4. **`STRATEGIE_ENRICHISSEMENT_FORMULAIRES.md`**
   - Pourquoi enrichir les formulaires existants
   - Hooks réutilisables
   - Approche hybride

**PRINCIPE CLÉ À RETENIR** :
```
┌──────────────────────────────────────────────────────┐
│ 99% des publications → Formulaire UNIVERSEL          │
│   → User tape "Toyota RAV4"                          │
│   → Sélectionne clé autocomplete                    │
│   → ✅ 15 champs auto-remplis                        │
│   → Complète 3-5 champs (prix, km, photos)          │
│                                                      │
│ 1% des publications → Création NOUVELLE clé         │
│   → User tape "Tesla Model 3"                       │
│   → ❌ Pas trouvé                                    │
│   → Détection auto catégorie (categoryDetector)    │
│   → Formulaire AUTO chargé                          │
│   → User complète champs → Clé créée               │
│   → ✅ Disponible pour TOUS                         │
└──────────────────────────────────────────────────────┘
```

Les clés que tu génères servent pour le **premier cas (99%)**.
Le système collaboratif enrichit progressivement pour le **second cas (1%)**.

## 📋 CONTEXTE

Tu es un expert en création de bases de données produits intelligentes. Ta mission est de construire un **système d'autocomplete universel** pour la plateforme Yukpomnang, qui permettra aux utilisateurs de saisir des produits en quelques secondes au lieu de remplir 15-20 champs.

## 🎯 OBJECTIF

Créer une **"Clé Produit Autocomplete Yukpo"** pour la catégorie **[NOM_CATEGORIE]** qui :

1. ✅ Combine TOUTES les caractéristiques en UN SEUL champ intelligent
2. ✅ Supporte la recherche progressive et contextuelle
3. ✅ Tolère les fautes de frappe et variations orthographiques
4. ✅ Est indépendante de l'ordre des mots
5. ✅ Gère les variantes (taille, poids, conditionnement, etc.)
6. ✅ Intègre la dimension géographique (pays, ville, quartier)
7. ✅ Va AU-DELÀ des modalités existantes en créant le maximum de combinaisons logiques du monde réel

## 📊 DONNÉES D'ENTRÉE

### 1. Catégorie cible
```
CATEGORIE: [automobile / telephone / agriculture / etc.]
CODE_CATEGORIE: [AUTO / TEL / AGRI / IMMO / etc.]  // Code court pour référencement
```

**⚠️ IMPORTANT : Si cette catégorie n'existe PAS encore dans `categoryDetector.ts`** :
1. ✅ Génère les mots-clés de détection pour cette catégorie
2. ✅ Fournis le code à ajouter dans `CATEGORY_KEYWORDS`
3. ✅ Assure-toi que la détection automatique fonctionnera

**Exemple** : Si tu génères pour "Bijoux" (code: BIJ) :
```typescript
// À ajouter dans categoryDetector.ts
BIJ: {
  category_name: 'bijoux',
  form_component: 'FormAutoBijoux',
  keywords: {
    brands: ['cartier', 'tiffany', 'pandora', ...],
    types: ['bijou', 'collier', 'bracelet', 'bague', 'boucles', 'montre'],
    materials: ['or', 'argent', 'diamant', 'perle', 'platine'],
    technical: ['18k', '24k', 'carats', 'sterling']
  }
}
```

### 2. Modalités existantes (productModalities.ts)
```typescript
[COLLER ICI LES MODALITÉS DE LA CATÉGORIE]
```

### 3. Configuration catégorie (si disponible)
```typescript
[COLLER ICI categoryConfig si existe]
```

### 4. Structure formulaire actuel
```
Champs du formulaire :
- [liste des champs actuels avec leurs types]
```

## 🎨 FORMAT DE SORTIE ATTENDU

### Structure JSON pour chaque produit

```typescript
{
  // ═══════════════════════════════════════════════════════
  // IDENTITÉ UNIQUE DU PRODUIT
  // ═══════════════════════════════════════════════════════
  "product_id": "AUTO-TOYOTA-RAV4-2020-HYBRID-AWD",  // Format: CODE_CATEGORIE-COMPOSANTS
  "category_code": "AUTO",  // Code court catégorie
  
  // ═══════════════════════════════════════════════════════
  // CLÉ AUTOCOMPLETE PRINCIPALE (recherche multi-position)
  // ═══════════════════════════════════════════════════════
  "autocomplete_key": "Toyota RAV4 2020 Hybrid AWD 5 places Blanc",
  
  // ⚠️ NOUVEAU : Indication pour l'utilisateur
  "autocomplete_hint": "Tapez marque + modèle (ex: Toyota RAV4)",
  
  // Mots-clés essentiels (premiers mots à taper)
  "primary_keywords": ["Toyota", "RAV4"],  // Ces 2 mots suffisent pour trouver
  
  // ⚠️ NOUVEAU : Nom du produit (pour champ caché obligatoire)
  "product_name": "Toyota RAV4",  // Extrait automatique des 1-2 premiers mots-clés
  
  // Variations orthographiques et recherche intelligente
  "search_variants": [
    "Toyota RAV4 2020 Hybrid AWD",
    "RAV4 Toyota Hybrid 2020",
    "Toyota RAV 4 2020",
    "Tayota RAV4 2020",  // Faute courante
    "Toyata RAV4",       // Faute courante
    "RAV-4 Toyota",
    "RAV 4",
    "RAV4 Hybride",      // Français
    "Toyota RAV4 AWD",
    "RAV4 4x4",
    "RAV4 tout terrain"
  ],
  
  // ═══════════════════════════════════════════════════════
  // CARACTÉRISTIQUES FIXES (toujours identiques)
  // ═══════════════════════════════════════════════════════
  "fixed_characteristics": {
    "categorie": "Automobile",
    "marqueAutomobile": "Toyota",
    "modeleAutomobile": "RAV4",
    "typeVehicule": "SUV",
    "typeCarrosserie": "SUV",
    "nbPortes": "5 portes",
    "nbPlaces": "5 places",
    "transmission": "Automatique",
    "typeCarburant": "Hybride",
    "puissance": "218 CV",
    "cylindree": "2.5L",
    "unite": "unité"
  },
  
  // ═══════════════════════════════════════════════════════
  // CARACTÉRISTIQUES VARIABLES (choix utilisateur)
  // ═══════════════════════════════════════════════════════
  "variable_characteristics": [
    {
      "field": "annee",
      "label": "Année",
      "type": "select",
      "options": ["2018", "2019", "2020", "2021", "2022", "2023", "2024"],
      "required": true,
      "impact_on_price": true  // Impacte le prix
    },
    {
      "field": "couleurAutomobile",
      "label": "Couleur",
      "type": "select",
      "options": ["Blanc", "Noir", "Gris", "Rouge", "Bleu", "Argent"],
      "required": true,
      "impact_on_price": false
    },
    {
      "field": "kilometrage",
      "label": "Kilométrage",
      "type": "number",
      "placeholder": "Ex: 45000",
      "required": true,
      "impact_on_price": true
    },
    {
      "field": "etatVehicule",
      "label": "État",
      "type": "select",
      "options": ["Excellent état", "Très bon état", "Bon état", "État correct"],
      "required": true,
      "impact_on_price": true
    }
  ],
  
  // Devise (une seule fois pour toute la clé)
  "currency": "FCFA",  // ⚠️ IMPORTANT : Devise SÉPARÉE, jamais dans les champs prix
  
  // ═══════════════════════════════════════════════════════
  // VARIANTES PRÉDÉFINIES (avec prix indicatifs)
  // ═══════════════════════════════════════════════════════
  "variants": [
    {
      "variant_id": "var_1",
      "dimensions": {
        "annee": "2024",
        "couleurAutomobile": "Blanc",
        "etatVehicule": "Neuf"
      },
      "price_range": {
        "min": 28000000,  // ⚠️ NUMBER uniquement, PAS de devise ici
        "max": 32000000   // Devise définie au niveau clé (currency: "FCFA")
      },
      "availability": "En stock",
      "popular": true
    },
    {
      "variant_id": "var_2",
      "dimensions": {
        "annee": "2022",
        "couleurAutomobile": "Noir",
        "etatVehicule": "Excellent état"
      },
      "price_range": {
        "min": 22000000,
        "max": 25000000,
        "currency": "FCFA"
      },
      "availability": "Disponible",
      "popular": true
    }
  ],
  
  // ═══════════════════════════════════════════════════════
  // DIMENSION GÉOGRAPHIQUE (si applicable)
  // ═══════════════════════════════════════════════════════
  "geographic_scope": {
    "countries": ["Cameroun", "Gabon", "Congo", "RDC", "Tchad", "RCA"],  // Où ce produit est pertinent
    "regions": ["Afrique Centrale", "Afrique de l'Ouest"],
    "cities_popular": ["Douala", "Yaoundé", "Libreville", "Brazzaville"],
    "requires_location": false  // true pour immobilier, terrain, etc.
  },
  
  // ═══════════════════════════════════════════════════════
  // MÉTADONNÉES INTELLIGENTES
  // ═══════════════════════════════════════════════════════
  "metadata": {
    "category": "automobile",
    "subcategory": "suv",
    "brand_tier": "premium",        // premium, mid-range, budget
    "popularity_score": 95,         // 0-100
    "search_volume": "high",        // high, medium, low
    "seasonal": false,
    "target_audience": ["families", "professionals", "outdoor_enthusiasts"],
    "tags": ["hybrid", "economique", "fiable", "spacieux", "4x4", "familial"],
    "related_products": ["Toyota Highlander", "Honda CR-V", "Nissan X-Trail"]
  },
  
  // ═══════════════════════════════════════════════════════
  // INFORMATIONS COMPLÉMENTAIRES
  // ═══════════════════════════════════════════════════════
  "additional_info": {
    "description_template": "Toyota RAV4 {annee}, moteur Hybride 2.5L de 218 CV, transmission automatique, {couleurAutomobile}, {etatVehicule}",
    "common_accessories": ["Tapis de sol", "Cache-bagages", "Jantes alliage"],
    "common_issues": [],  // Problèmes connus (si occasion)
    "maintenance_cost": "medium",
    "fuel_efficiency": "5.5L/100km",
    "insurance_group": "medium"
  },
  
  // ═══════════════════════════════════════════════════════
  // CRÉATION COLLABORATIVE (crowdsourcing)
  // ═══════════════════════════════════════════════════════
  "collaborative": {
    "source": "ai_generated",  // 'ai_generated' | 'user_contributed' | 'admin_verified'
    "created_at": "2024-01-15T10:30:00Z",
    "created_by": "system",
    "verified": true,
    "verification_count": 0,  // Nombre d'utilisateurs ayant validé cette clé
    "usage_count": 0,         // Combien de fois utilisée
    "last_updated": "2024-01-15T10:30:00Z",
    
    // Champs manquants pour complétion collaborative
    "missing_fields": [],  // Si incomplète, liste des champs à compléter
    
    // Template pour création nouvelle clé similaire
    "template_for_new": {
      "required_fields": ["marqueAutomobile", "modeleAutomobile", "annee", "typeCarburant"],
      "optional_fields": ["couleurAutomobile", "transmission", "kilometrage"],
      "helps": {
        "marqueAutomobile": "Saisissez la marque du véhicule (ex: Tesla, BYD, Nio...)",
        "modeleAutomobile": "Saisissez le modèle exact (ex: Model 3, Tang, ET7...)",
        "annee": "Année de fabrication ou commercialisation"
      }
    }
  }
}
```

## 🤝 SYSTÈME COLLABORATIF - Création de nouvelles clés

### Scenario : Nouvelle marque qui n'existe pas encore

**Exemple** : Tesla Model 3 vient de sortir en Afrique, pas encore dans la base.

#### FLUX UTILISATEUR :

```
┌─────────────────────────────────────────────────────────┐
│ 🚗 Quel véhicule vendez-vous ?                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Tesla Model 3____________]  🔍                        │
│                                                         │
│  ❌ Aucun résultat trouvé                               │
│                                                         │
│  💡 Voulez-vous ajouter "Tesla Model 3" à la base ?    │
│                                                         │
│  [✅ Oui, créer cette clé] [❌ Non merci]              │
└─────────────────────────────────────────────────────────┘
```

#### SI L'UTILISATEUR CLIQUE "Créer cette clé" :

```
┌─────────────────────────────────────────────────────────┐
│ ✨ Création d'une nouvelle clé automobile               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📝 Complétez les informations manquantes :             │
│                                                         │
│ ✅ Nom détecté: Tesla Model 3                          │
│                                                         │
│ Marque *          [Tesla________] (pré-rempli)         │
│ Modèle *          [Model 3______] (pré-rempli)         │
│ Type véhicule *   [Berline ▼]                          │
│ Carburant *       [Électrique ▼]                       │
│ Transmission *    [Automatique ▼]                      │
│ Année *           [2024________]                        │
│ Nb portes         [4 portes ▼]                         │
│ Nb places         [5 places ▼]                         │
│ Puissance         [283 CV_____]  (optionnel)           │
│ Autonomie         [602 km_____]  (optionnel)           │
│                                                         │
│ 💰 Prix indicatif [35000000___] FCFA                   │
│                                                         │
│ [✅ Créer et partager avec tous] [❌ Annuler]          │
└─────────────────────────────────────────────────────────┘
```

#### APRÈS CRÉATION :

```
✅ Nouvelle clé créée avec succès !

"Tesla Model 3 2024 Électrique" a été ajoutée à la base.
Cette clé sera visible par TOUS les utilisateurs Yukpomnang.

Merci de contribuer à enrichir la plateforme ! 🎉

📊 Statut : En attente de vérification (0/5 confirmations)

[Continuer ma publication]
```

### Structure de la nouvelle clé créée

```json
{
  "product_id": "AUTO-TESLA-MODEL3-2024-ELECTRIQUE",
  "category_code": "AUTO",
  "autocomplete_key": "Tesla Model 3 2024 Électrique",
  
  "search_variants": [
    "Tesla Model 3",
    "Model 3 Tesla",
    "Tesla Model Three",
    "Model 3 Électrique"
  ],
  
  "fixed_characteristics": {
    "marqueAutomobile": "Tesla",
    "modeleAutomobile": "Model 3",
    "typeVehicule": "Berline",
    "typeCarburant": "Électrique",
    "transmission": "Automatique",
    "nbPortes": "4 portes",
    "nbPlaces": "5 places",
    "puissance": "283 CV",
    "autonomie": "602 km"
  },
  
  "variable_characteristics": [
    {
      "field": "annee",
      "options": ["2024"]  // Élargi progressivement
    },
    {
      "field": "couleurAutomobile",
      "options": ["Blanc", "Noir", "Gris", "Rouge", "Bleu"]
    },
    {
      "field": "kilometrage",
      "type": "number"
    }
  ],
  
  "collaborative": {
    "source": "user_contributed",  // ← CLÉ CRÉÉE PAR UTILISATEUR
    "created_at": "2024-10-31T14:30:00Z",
    "created_by": "user_12345",
    "verified": false,  // Pas encore vérifiée
    "verification_count": 0,  // 0/5 confirmations
    "usage_count": 1,
    "needs_verification": true,
    
    "missing_fields": ["cylindree", "consommation"],  // Champs optionnels manquants
    
    // Template pour enrichissement progressif
    "enrichment_suggestions": {
      "cylindree": "Demander aux prochains utilisateurs",
      "consommation": "Demander aux prochains utilisateurs",
      "equipements_standard": "À compléter"
    }
  }
}
```

### Vérification collaborative (Crowdsourcing qualité)

Quand un autre utilisateur sélectionne "Tesla Model 3" :

```
┌─────────────────────────────────────────────────────────┐
│ ℹ️ Clé ajoutée récemment par la communauté              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Tesla Model 3 2024 Électrique                          │
│                                                         │
│ 📊 Vérifications : 2/5                                  │
│ 👤 Ajoutée par : user_12345                            │
│ 📅 Le : 31 oct 2024                                     │
│                                                         │
│ ❓ Ces informations sont-elles correctes ?             │
│                                                         │
│ ✅ Marque : Tesla                                       │
│ ✅ Modèle : Model 3                                     │
│ ✅ Type : Berline électrique                           │
│ ✅ Puissance : 283 CV                                   │
│                                                         │
│ [✅ Oui, c'est correct] [❌ Signaler erreur]           │
└─────────────────────────────────────────────────────────┘
```

### Mise à jour progressive automatique

```json
{
  "collaborative": {
    "verification_count": 5,  // ✅ 5 utilisateurs ont confirmé
    "verified": true,         // ✅ Maintenant vérifiée !
    "source": "community_verified",  // Statut élevé
    "usage_count": 47,        // Utilisée 47 fois
    
    // Enrichissement progressif automatique
    "auto_enriched_fields": {
      "price_range_observed": {
        "min": 33000000,  // Prix min observé
        "max": 38000000,  // Prix max observé
        "avg": 35500000,  // Prix moyen
        "samples": 47     // Basé sur 47 utilisations
      },
      "popular_colors": ["Blanc (45%)", "Noir (30%)", "Gris (15%)"],
      "avg_kilometrage": 15000  // km moyen pour occasion
    }
  }
}
```

## 🧠 INTELLIGENCE REQUISE

### 1. Variantes orthographiques automatiques (Fuzzy Matching)

Pour chaque marque/modèle/terme, génère :
- ✅ **Fautes de frappe courantes** (Tayota, Toyata, Toyotta)
- ✅ **Variations linguistiques** (Hybride/Hybrid, Noir/Black, Essence/Gasoline)
- ✅ **Abréviations** (RAV4 = RAV 4 = RAV-4)
- ✅ **Mots manquants** (Toyota RAV4 = RAV4)
- ✅ **Ordre différent** (RAV4 Toyota = Toyota RAV4)
- ✅ **Sons similaires** (Metaphone : Corolla = Corola = Korolla)
- ✅ **Distance Levenshtein** (max 2 caractères différents)
- ✅ **Trigrams** (recherche par fragments : "rav" trouve "RAV4")

**Algorithmes à implémenter** :

```typescript
// 1. Levenshtein distance (distance d'édition)
function levenshteinDistance(a: string, b: string): number {
  // Retourne nombre de modifications nécessaires
  // Ex: "Tayota" → "Toyota" = 1 (remplacer y par o)
}

// 2. Trigram similarity (PostgreSQL pg_trgm)
// "toyota" → ["toy", "oyo", "yot", "ota"]
// Permet de trouver même si lettres manquantes

// 3. Metaphone (son phonétique)
// "Corolla" → "KRL"
// "Corola" → "KRL"  // Même code phonétique !

// 4. Scoring combiné
score = 
  + 50 (si match exact)
  + 40 (si Levenshtein ≤ 2)
  + 30 (si trigram similarity > 0.6)
  + 20 (si metaphone identique)
  + 10 (si contient tous les mots)
```

**Exemples concrets** :

```json
// Pour "Toyota RAV4 2024"
"search_variants": [
  // Exact
  "Toyota RAV4 2024",
  
  // Fautes frappe courantes
  "Tayota RAV4 2024",      // a→y
  "Toyata RAV4 2024",      // o→a  
  "Toyota RAV 4 2024",     // espace
  "Toyota RAV-4 2024",     // tiret
  
  // Variations orthographiques
  "Toyota Rav4 2024",      // minuscule
  "TOYOTA RAV4 2024",      // majuscule
  "toyota rav4 2024",      // tout minuscule
  
  // Ordre différent
  "RAV4 Toyota 2024",
  "2024 Toyota RAV4",
  "RAV4 2024 Toyota",
  
  // Mots partiels
  "Toyota RAV4",
  "RAV4 2024",
  "Toyota 2024",
  
  // Variations linguistiques
  "Toyota RAV4 vingt-quatre",  // Si pertinent
  
  // Synonymes
  "Toyota RAV 4",
  "Toyota RAV quatre"
]
```

### 2. Expansion intelligente AU-DELÀ des modalités

**Exemple pour AUTOMOBILE** :

Si modalités contiennent :
```
marques: [Toyota, Peugeot, ...]
modeles_toyota: [Corolla, Camry, ...]
```

Tu dois CRÉER en plus :
```typescript
// Pour CHAQUE modèle Toyota, génère les versions :
"Toyota RAV4" →
  - RAV4 2.0L Essence
  - RAV4 2.5L Hybrid
  - RAV4 2.5L Hybrid AWD
  - RAV4 2.5L Hybrid FWD
  - RAV4 Prime (Plug-in Hybrid)
  - RAV4 Adventure
  - RAV4 Limited
  - RAV4 TRD Off-Road
  
// Pour CHAQUE version, génère les années disponibles
"RAV4 Hybrid AWD" →
  - 2016-2024 (toutes les années)
  
// Pour CHAQUE combinaison, génère les couleurs
"RAV4 2024 Hybrid" →
  - Blanc
  - Noir
  - Gris
  - Rouge (disponible 2020+)
  - Bleu (disponible 2022+)
  - etc.
```

### 3. Gestion des variantes (CRUCIAL)

**Exemple AGRICULTURE - Riz** :

```typescript
{
  "autocomplete_key": "Riz Long Grain Vietnam Premium",
  
  "fixed_characteristics": {
    "typeProduit": "Riz",
    "variete": "Long Grain",
    "origine": "Vietnam",
    "qualite": "Premium"
  },
  
  "variable_characteristics": [
    {
      "field": "conditionnement",
      "label": "Conditionnement",
      "options": ["Sac 25kg", "Sac 50kg", "Sac 100kg", "Tonne"],
      "required": true,
      "impact_on_price": true
    }
  ],
  
  "variants": [
    {
      "dimensions": { "conditionnement": "Sac 25kg" },
      "price_range": { "min": 12500, "max": 15000 }
    },
    {
      "dimensions": { "conditionnement": "Sac 50kg" },
      "price_range": { "min": 24000, "max": 28000 }
    },
    {
      "dimensions": { "conditionnement": "Sac 100kg" },
      "price_range": { "min": 45000, "max": 52000 }
    }
  ]
}
```

**Présentation UX recommandée** :

```
┌─────────────────────────────────────────────────┐
│ Produit sélectionné: Riz Long Grain Vietnam    │
│ Qualité: Premium                                │
├─────────────────────────────────────────────────┤
│ Choisissez le conditionnement:                  │
│                                                 │
│ ┌─────────┬──────────┬────────────┬──────────┐ │
│ │ 25 kg   │ 50 kg    │ 100 kg     │ Tonne    │ │
│ ├─────────┼──────────┼────────────┼──────────┤ │
│ │ 12.500  │ 24.000   │ 45.000     │ 900.000  │ │
│ │ -15.000 │ -28.000  │ -52.000    │ -1.1M    │ │
│ │ FCFA    │ FCFA     │ FCFA       │ FCFA     │ │
│ └─────────┴──────────┴────────────┴──────────┘ │
│                                                 │
│ [Sélectionner] ou [Ajouter plusieurs]          │
└─────────────────────────────────────────────────┘
```

### 4. Intégration géographique

Pour catégories nécessitant localisation (immobilier, terrain, agriculture, hôtel) :

```typescript
{
  "autocomplete_key": "Villa 4 chambres Bonapriso Douala",
  
  "fixed_characteristics": {
    "typeBien": "Villa",
    "nbChambres": "4",
    // ...
  },
  
  "geographic": {
    "pays": "Cameroun",
    "ville": "Douala",
    "quartier": "Bonapriso",
    
    // Coordonnées GPS approximatives du quartier
    "gps_area": {
      "center": { "lat": 4.0511, "lng": 9.7679 },
      "radius_km": 2
    },
    
    // Quartiers similaires (pour suggestions)
    "similar_areas": ["Bonanjo", "Akwa", "Bali"],
    
    // Utiliser Google Places Autocomplete pour affiner
    "use_google_places": true
  }
}
```

### 5. Recherche indépendante de l'ordre

Le système doit trouver le produit peu importe l'ordre :

```
✅ "Toyota RAV4 2020 Hybrid"
✅ "RAV4 Toyota Hybrid 2020"
✅ "2020 Hybrid RAV4 Toyota"
✅ "Hybrid Toyota 2020 RAV4"
✅ "RAV4 2020"  → suggère toutes les versions
✅ "Toyota Hybrid 2020" → suggère RAV4, Camry, Corolla Hybrid, etc.
```

**Algorithme de scoring** :

```typescript
score = 0
+ 50 si marque exacte
+ 40 si modèle exact
+ 30 si année exacte
+ 20 si type carburant exact
+ 10 si couleur exacte
+ bonus si tous les mots présents (même ordre différent)
- pénalité distance Levenshtein pour fautes
```

## 📝 INSTRUCTIONS ÉTAPE PAR ÉTAPE

### ÉTAPE 1 : Analyse des modalités

1. Liste TOUS les champs de la catégorie
2. Identifie les champs FIXES vs VARIABLES
3. Détecte les dépendances (marque → modèle, ville → quartier, etc.)
4. Identifie les champs à variantes (taille, poids, conditionnement, etc.)

### ÉTAPE 2 : Expansion intelligente

Pour CHAQUE combinaison logique :
1. Génère les variations réelles du marché mondial
2. Ajoute les versions/finitions populaires
3. Crée les variantes de taille/poids/conditionnement
4. Génère les années pertinentes (véhicules, électronique)

### ÉTAPE 3 : Recherche intelligente

Pour CHAQUE produit généré :
1. Crée la clé autocomplete principale
2. Génère 10-20 variations orthographiques
3. Ajoute synonymes et traductions
4. Crée les combinaisons d'ordre différent

### ÉTAPE 4 : Variantes et prix

Pour produits avec variantes :
1. Liste toutes les dimensions variables
2. Crée les combinaisons populaires
3. Associe des fourchettes de prix réalistes (marché africain)
4. Définis la présentation UX optimale

### ÉTAPE 5 : Géolocalisation

Si catégorie nécessite localisation :
1. Liste pays/villes/quartiers pertinents
2. Crée les mappings ville → quartiers
3. Intègre Google Places pour affinement
4. Génère coordonnées GPS approximatives

### ÉTAPE 6 : Métadonnées

Pour CHAQUE produit :
1. Score de popularité (basé sur demande marché)
2. Tags pertinents (recherche sémantique)
3. Produits similaires/alternatifs
4. Public cible

## 🌍 CONTEXTE AFRICAIN OBLIGATOIRE

- **Pays prioritaires** : Cameroun, Gabon, Congo, RDC, Tchad, Sénégal, Côte d'Ivoire, Bénin, Togo, Niger, Burkina Faso, Mali, Guinée
- **Monnaie** : FCFA pour zone franc, adapter pour autres pays
- **Prix réalistes** : Basés sur le marché africain, pas européen
- **Produits locaux** : Inclure produits africains spécifiques (attiéké, garri, ndolé, etc. pour agriculture)
- **Marques populaires Afrique** : Tecno, Infinix, Itel (téléphones), etc.

## 📊 QUANTITÉ ATTENDUE

Génère **AU MINIMUM** :

- **Catégorie simple** (ex: vêtement) : 200-500 produits
- **Catégorie moyenne** (ex: électroménager) : 500-1000 produits
- **Catégorie complexe** (ex: automobile, téléphone) : 1000-3000 produits
- **Catégorie service** (ex: formation) : 100-300 produits

## 📋 CODES CATÉGORIES (Référencement standard)

Utilise ces codes courts pour toutes les catégories :

| Catégorie | Code | Exemple product_id |
|-----------|------|-------------------|
| **Véhicules & Transport** |
| Automobile | AUTO | AUTO-TOYOTA-COROLLA-2024 |
| Moto | MOTO | MOTO-YAMAHA-R15-2024 |
| Tricycle | TRIC | TRIC-BAJAJ-RE-2023 |
| Vélo | VELO | VELO-GIANT-ESCAPE-3 |
| **Électronique** |
| Téléphone | TEL | TEL-SAMSUNG-A54-128GB |
| Ordinateur | PC | PC-DELL-LATITUDE-5420 |
| Tablette | TAB | TAB-IPAD-AIR-64GB |
| Électroménager | ELEC | ELEC-LG-FRIGO-420L |
| **Mode & Beauté** |
| Vêtement | VET | VET-CHEMISE-HOMME-L |
| Chaussure | CHAUS | CHAUS-NIKE-AIR-42 |
| Bijoux | BIJ | BIJ-COLLIER-OR-18K |
| Cosmétique & Parfum | COSM | COSM-CHANEL-N5-100ML |
| **Maison & Jardin** |
| Meuble | MEUB | MEUB-CANAPE-3PLACES |
| Immobilier | IMMO | IMMO-VILLA-4CH-BONAPRISO |
| Immobilier Terrain | TERR | TERR-500M2-PK10 |
| Construction | CONST | CONST-CIMENT-SAC-50KG |
| **Agriculture & Alimentation** |
| Agriculture | AGRI | AGRI-RIZ-VIETNAM-SAC50KG |
| Élevage | ELEV | ELEV-POULET-CHAIR-KG |
| Pêche | PECHE | PECHE-POISSON-FRAIS-KG |
| **Services** |
| Emploi | EMPL | EMPL-DEVELOPPEUR-SENIOR |
| Formation | FORM | FORM-ANGLAIS-DEBUTANT |
| Stage | STAG | STAG-MARKETING-3MOIS |
| Santé | SANT | SANT-CONSULTATION-GENERALE |
| Éducation | EDU | EDU-COURS-MATHS-TERMINALE |
| **Hôtellerie & Restauration** |
| Hôtel | HOTEL | HOTEL-HILTON-CH-DOUBLE |
| Restaurant | REST | REST-NDOLE-PORTION |
| Bar | BAR | BAR-BIERE-33CL |
| **Services professionnels** |
| Transport | TRANS | TRANS-COLIS-DLA-YDE |
| Déménagement | DEMEN | DEMEN-MAISON-3CH |
| Nettoyage | NETT | NETT-BUREAU-50M2 |
| Réparation | REPAR | REPAR-SMARTPHONE-ECRAN |
| Menuiserie | MENU | MENU-PORTE-CUSTOM |
| Plomberie | PLOMB | PLOMB-INSTALL-WC |
| Électricité | ELECT | ELECT-INSTALL-TABLEAU |
| Peinture | PEINT | PEINT-PIECE-20M2 |
| Jardinage | JARD | JARD-TONTE-GAZON |
| Couture | COUT | COUT-ROBE-MESURE |
| Coiffure | COIFF | COIFF-TRESSE-COMPLETE |
| Esthétique | ESTH | ESTH-MANUCURE-PEDICURE |
| **Services créatifs** |
| Photographie | PHOTO | PHOTO-MARIAGE-FULL |
| Vidéographie | VIDEO | VIDEO-EVENT-4H |
| Graphisme | GRAPH | GRAPH-LOGO-COMPLET |
| Développement Web | WEB | WEB-SITE-ECOMMERCE |
| Marketing Digital | MARKE | MARKE-CAMPAGNE-FB |
| **Services financiers & juridiques** |
| Comptabilité | COMPT | COMPT-BILAN-ANNUEL |
| Juridique | JURID | JURID-CONTRAT-TRAVAIL |
| Traduction | TRAD | TRAD-DOC-FR-EN |
| Assurance | ASSUR | ASSUR-AUTO-ANNUELLE |
| Crédit | CREDI | CREDI-PERSO-5M |
| **Loisirs & Culture** |
| Cours particuliers | COURS | COURS-MATHS-1H |
| Musique | MUSIC | MUSIC-COURS-PIANO |
| Sport | SPORT | SPORT-COACH-PERSO |
| Événementiel | EVENT | EVENT-MARIAGE-200P |
| Voyage | VOYAG | VOYAG-PARIS-7J |
| Tourisme | TOUR | TOUR-SAFARI-WAZA-3J |
| Sécurité | SECUR | SECUR-GARDE-NUIT |

**Format product_id** : `CODE_CATEGORIE-ELEMENT1-ELEMENT2-ELEMENT3`

**Exemples** :
- `AUTO-TOYOTA-RAV4-2024-HYBRID`
- `TEL-IPHONE-14PRO-256GB`
- `AGRI-RIZ-VIETNAM-PREMIUM-50KG`
- `IMMO-VILLA-4CH-BONAPRISO-DOUALA`

## ⚠️ RÈGLES CRITIQUES OBLIGATOIRES

### 1. PRIX : Type numérique UNIQUEMENT

```json
// ✅ CORRECT
{
  "currency": "FCFA",  // Devise définie UNE SEULE FOIS au niveau clé
  "variable_characteristics": [
    {
      "field": "prix",
      "label": "Prix",
      "type": "number",  // ⚠️ TYPE NUMBER, pas string !
      "required": true
    }
  ],
  "variants": [
    {
      "price_range": {
        "min": 28000000,  // ⚠️ NUMBER pur, PAS de "28000000 FCFA"
        "max": 32000000   // PAS de devise ici
      }
    }
  ]
}

// ❌ INCORRECT
{
  "variable_characteristics": [
    {
      "field": "prix",
      "type": "string",  // ❌ MAUVAIS !
      "placeholder": "Prix en FCFA"  // ❌ Pas de devise dans placeholder
    }
  ],
  "variants": [
    {
      "price_range": {
        "min": "28M FCFA",  // ❌ String au lieu de number
        "max": "32M"
      }
    }
  ]
}
```

**RÈGLE** : 
- ✅ Tous les champs prix = `"type": "number"`
- ✅ Devise définie UNE FOIS : `"currency": "FCFA"` au niveau clé
- ❌ JAMAIS de devise dans les valeurs de prix
- ❌ JAMAIS de type "string" pour prix

### 2. NOM DU PRODUIT : Extraction automatique

```json
{
  "autocomplete_key": "Toyota RAV4 2024 Hybrid AWD",
  
  // ⚠️ OBLIGATOIRE : Nom du produit (1-2 premiers mots-clés)
  "product_name": "Toyota RAV4",  // Utilisé pour champ caché obligatoire
  
  // ⚠️ OBLIGATOIRE : Mots-clés primaires (ce que user doit taper)
  "primary_keywords": ["Toyota", "RAV4"],
  
  // ⚠️ OBLIGATOIRE : Indication pour guider utilisateur
  "autocomplete_hint": "Tapez marque + modèle (ex: Toyota RAV4)"
}
```

**RÈGLES** :
- ✅ `product_name` = 1 ou 2 premiers mots-clés essentiels
- ✅ `primary_keywords` = Liste des mots essentiels pour trouver le produit
- ✅ `autocomplete_hint` = Guide l'utilisateur sur quoi taper

**Exemples** :

```json
// Automobile
"product_name": "Toyota RAV4",
"primary_keywords": ["Toyota", "RAV4"],
"autocomplete_hint": "Tapez marque + modèle (ex: Toyota RAV4)"

// Téléphone
"product_name": "iPhone 14 Pro",
"primary_keywords": ["iPhone", "14 Pro"],
"autocomplete_hint": "Tapez marque + modèle (ex: iPhone 14 Pro)"

// Agriculture
"product_name": "Riz Vietnam",
"primary_keywords": ["Riz", "Vietnam"],
"autocomplete_hint": "Tapez produit + origine (ex: Riz Vietnam)"

// Immobilier
"product_name": "Villa Bonapriso",
"primary_keywords": ["Villa", "Bonapriso"],
"autocomplete_hint": "Tapez type + quartier (ex: Villa Bonapriso)"
```

### 3. VARIANTES : Prix numériques aussi

Pour produits avec variantes (ex: Agriculture avec différents conditionnements) :

```json
{
  "currency": "FCFA",  // ⚠️ Devise unique
  
  "variants": [
    {
      "variant_id": "riz_vietnam_25kg",
      "dimensions": {
        "conditionnement": "Sac 25kg"
      },
      "price_range": {
        "min": 12500,  // ⚠️ NUMBER uniquement
        "max": 15000   // PAS "15000 FCFA"
      }
    },
    {
      "variant_id": "riz_vietnam_50kg",
      "dimensions": {
        "conditionnement": "Sac 50kg"
      },
      "price_range": {
        "min": 24000,  // ⚠️ NUMBER uniquement
        "max": 28000
      }
    }
  ]
}
```

## ✅ VALIDATION FINALE

Chaque produit doit :
1. ✅ Avoir une clé autocomplete unique
2. ✅ Au moins 5 variantes de recherche
3. ✅ Caractéristiques fixes complètes
4. ✅ Caractéristiques variables si applicable
5. ✅ Variantes avec prix si applicable
6. ✅ Métadonnées complètes
7. ✅ Être cherchable indépendamment de l'ordre des mots
8. ✅ **`product_name` défini (1-2 mots-clés)**
9. ✅ **`primary_keywords` listés**
10. ✅ **`autocomplete_hint` fourni**
11. ✅ **`currency` défini UNE FOIS**
12. ✅ **TOUS les prix en type `number`**

## 🎯 RÉVOLUTION ARCHITECTURE : UN SEUL FORMULAIRE UNIVERSEL

### 💡 Découverte clé

Avec ce système d'autocomplete intelligent, **on n'a plus besoin de 60 formulaires différents !**

```
AVANT (système classique) :
├─ Formulaire Automobile (20 champs)
├─ Formulaire Téléphone (15 champs)
├─ Formulaire Agriculture (12 champs)
├─ ... (60 formulaires distincts)
└─ Utilisateur remplit TOUS les champs à chaque fois

APRÈS (avec autocomplete intelligent) :
└─ UN SEUL formulaire universel
   ├─ 1 champ : Autocomplete intelligent
   ├─ → Sélectionne "Toyota RAV4 2024 Hybrid"
   ├─ → ✅ 15 champs auto-remplis instantanément !
   └─ Utilisateur complète seulement 2-3 champs (prix, km, photos)
```

### Architecture unifiée

```
┌─────────────────────────────────────────────────────────┐
│         FORMULAIRE UNIVERSEL DE PUBLICATION              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📦 Que vendez-vous ?                                    │
│                                                         │
│  [Toyota RAV4 2024 Hybrid AWD___________] 🔍          │
│  💬 Tapez marque + modèle (ex: Toyota RAV4)            │
│                                                         │
│  💡 Suggestions:                                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ✅ Toyota RAV4 2024 Hybrid AWD                  │   │
│  │    15 caractéristiques • AUTO                   │   │
│  │    ────────────────────────────────────────     │   │
│  │ ✅ Toyota RAV4 2023 Hybrid                      │   │
│  │    14 caractéristiques • AUTO                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Sélectionner] ou [Créer nouvelle clé]                │
└─────────────────────────────────────────────────────────┘

        ↓ Après sélection
        
┌─────────────────────────────────────────────────────────┐
│ ✅ Produit pré-rempli automatiquement                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🏷️ Nom du produit (masqué mais obligatoire) :         │
│   ✓ nom_produit: "Toyota RAV4" (extrait auto)         │
│                                                         │
│ 📋 Caractéristiques (auto-remplies) :                  │
│   ✓ Catégorie : Automobile                             │
│   ✓ Marque : Toyota                                    │
│   ✓ Modèle : RAV4                                      │
│   ✓ Type : SUV                                         │
│   ✓ Carburant : Hybride                                │
│   ✓ Transmission : Automatique                         │
│   ✓ Puissance : 218 CV                                 │
│   ✓ Places : 5                                         │
│   ✓ ... (15 champs total)                              │
│                                                         │
│ ────────────────────────────────────────────────────    │
│                                                         │
│ ✏️ Informations à compléter :                          │
│                                                         │
│   Année *           [2024 ▼]                           │
│   Kilométrage *     [45000_____] km                    │
│   Couleur *         [Blanc ▼]                          │
│   État *            [Excellent état ▼]                 │
│   Prix *            [22000000__] FCFA                  │
│                                                         │
│   📸 Photos         [Ajouter 3-8 photos]               │
│   📍 Localisation   [Douala, Bonapriso]                │
│   📝 Description    [Optionnel...]                     │
│                                                         │
│   [✅ Publier maintenant]                              │
└─────────────────────────────────────────────────────────┘

RÉSULTAT : 5 champs à remplir au lieu de 20 ! 
           Gain de temps : 75% 🚀
```

### Utilisation des 60 formulaires spécifiques

Les formulaires détaillés servent **UNIQUEMENT** pour créer de nouvelles clés :

```
┌─────────────────────────────────────────────────────────┐
│ ❌ "Tesla Model 3" non trouvé                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 💡 Créer cette nouvelle clé ?                          │
│                                                         │
│ [✅ Oui, créer]  →  Ouvre formulaire AUTO spécifique  │
└─────────────────────────────────────────────────────────┘

        ↓
        
┌─────────────────────────────────────────────────────────┐
│ 🚗 FORMULAIRE CRÉATION CLÉ - AUTOMOBILE                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Le système a détecté la catégorie : Automobile         │
│ Formulaire spécialisé chargé automatiquement           │
│                                                         │
│ ✅ Détecté automatiquement :                           │
│    Nom : Tesla Model 3                                 │
│    Marque : Tesla                                      │
│    Modèle : Model 3                                    │
│                                                         │
│ 📝 Complétez les champs automobile :                   │
│                                                         │
│    Type véhicule *    [Berline ▼]                      │
│    Carburant *        [Électrique ▼]                   │
│    Transmission *     [Automatique ▼]                  │
│    Nb portes          [4 portes ▼]                     │
│    Nb places          [5 places ▼]                     │
│    Puissance          [283____] CV                     │
│    Autonomie          [602____] km                     │
│    ... (champs spécifiques AUTO)                       │
│                                                         │
│    [✅ Créer et partager cette clé]                    │
└─────────────────────────────────────────────────────────┘
```

### Détection intelligente du formulaire

```typescript
// Système détecte automatiquement la catégorie

function detectCategoryFromQuery(query: string): string {
  // Mots-clés automobiles
  if (/toyota|peugeot|mercedes|voiture|suv|berline/i.test(query)) {
    return 'AUTO';  // → Charge formulaire automobile
  }
  
  // Mots-clés téléphones
  if (/iphone|samsung|tecno|smartphone|telephone/i.test(query)) {
    return 'TEL';   // → Charge formulaire téléphone
  }
  
  // Mots-clés agriculture
  if (/riz|mais|manioc|sac|tonne|kg|agriculture/i.test(query)) {
    return 'AGRI';  // → Charge formulaire agriculture
  }
  
  // etc. pour 60 catégories
}

// Exemple
detectCategoryFromQuery("Tesla Model 3")
  → "AUTO" 
  → Charge FormAutoAutomobile.tsx

detectCategoryFromQuery("Riz Vietnam Premium")
  → "AGRI"
  → Charge FormAutoAgriculture.tsx
```

### Avantages de cette architecture

**Pour l'utilisateur** :
- ✅ Publication en 30 secondes au lieu de 5 minutes
- ✅ Moins d'erreurs (données pré-remplies correctes)
- ✅ Interface ultra-simple
- ✅ Suggestions intelligentes

**Pour le développement** :
- ✅ UN seul formulaire à maintenir (interface)
- ✅ 60 formulaires spécifiques = templates de création de clés
- ✅ Réutilisation maximale du code
- ✅ Évolutif (ajouter catégorie = ajouter template)

**Pour la qualité des données** :
- ✅ Données normalisées (pas de "Tayota" dans la base)
- ✅ Cohérence garantie
- ✅ Enrichissement collaboratif
- ✅ Vérification communautaire

### Structure code recommandée

```typescript
// Formulaire UNIVERSEL (interface principale)
<UniversalProductForm>
  <AutocompleteField 
    onSelect={handleProductSelect}
    onNotFound={handleCreateNewKey}
  />
  
  {selectedProduct && (
    <>
      <PreFilledFields data={selectedProduct.fixed_characteristics} />
      <UserInputFields fields={selectedProduct.variable_characteristics} />
      <PhotoUpload />
      <LocationPicker />
      <PublishButton />
    </>
  )}
</UniversalProductForm>

// Formulaires SPÉCIFIQUES (création clés uniquement)
<FormAutoAutomobile />     // Pour créer clés AUTO
<FormAutoTelephone />      // Pour créer clés TEL
<FormAutoAgriculture />    // Pour créer clés AGRI
// ... 60 formulaires
```

### Template dans chaque clé pour création

Chaque clé contient son propre template de création :

```json
{
  "product_id": "AUTO-TOYOTA-RAV4-2024",
  
  "collaborative": {
    // Template pour créer variante similaire
    "template_for_new": {
      "category_code": "AUTO",
      "form_component": "FormAutoAutomobile",  // Quel formulaire charger
      
      "required_fields": [
        "marqueAutomobile",
        "modeleAutomobile", 
        "annee",
        "typeCarburant"
      ],
      
      "optional_fields": [
        "couleurAutomobile",
        "transmission",
        "puissance"
      ],
      
      // Aide contextuelle
      "helps": {
        "marqueAutomobile": "Ex: Tesla, BYD, Nio, Rivian",
        "modeleAutomobile": "Ex: Model 3, Tang, ET7, R1T"
      },
      
      // Valeurs par défaut intelligentes
      "smart_defaults": {
        "typeVehicule": "Berline",  // Si "Model 3" détecté
        "transmission": "Automatique",  // Toujours auto pour électrique
        "nbPlaces": "5 places"
      }
    }
  }
}
```

## 🎯 EXEMPLE COMPLET : Génère pour catégorie [AUTOMOBILE]

```
CATEGORIE: automobile
CODE_CATEGORIE: AUTO

MODALITES:
[coller modalités from productModalities.ts]

ATTENTE:
- 2000-3000 combinaisons véhicules
- Toutes marques × modèles × versions × années
- Variantes couleur/km/état
- Prix réalistes marché africain
- Recherche intelligente typo-tolerant + fuzzy matching
- Chaque clé avec template pour création variantes
```

---

**🚀 COMMENCE LA GÉNÉRATION !**

