# 🚀 TODO COMPLET - Refonte Système Yukpo

**Date** : 2025-11-02  
**Contexte** : Correction bugs + Architecture vectorielle autocomplete + Hiérarchie géographique  
**Utilisation** : Prompt pour implémentation dans un autre chat

---

## 📊 VUE D'ENSEMBLE

### Problèmes Identifiés : 25
### Fichiers à Modifier : 15
### Nouvelles Tables : 2
### Temps Estimé : 30-35 heures

---

## 🎯 OBJECTIFS PRINCIPAUX

1. ✅ Corriger bugs création/recherche service
2. ✅ Implémenter architecture autocomplete vectorielle (vision utilisateur)
3. ✅ Système géographique intelligent bidirectionnel (GeoNames)
4. ✅ Refonte UI (ResultatBesoinScreen, ProductCard)
5. ✅ Migrations automatiques (auto_migrate.rs)

---

## ⚙️ CONTEXTE TECHNIQUE IMPORTANT

### SQLx Offline Mode

**Le projet utilise SQLx en mode offline** : Les migrations doivent être gérées via `auto_migrate.rs`.

**IMPORTANT** :
- ❌ `sqlx migrate run` : Ne fonctionne PAS en production (offline mode)
- ✅ `auto_migrate.rs` : S'exécute automatiquement au démarrage
- ✅ Vérifie si table existe avant création (idempotent)

**Pour créer une table** :
1. Ajouter fonction `ensure_nom_table()` dans `auto_migrate.rs`
2. Appeler dans `run_auto_migrations()`
3. La table sera créée au prochain `cargo run`

**Voir exemple** : `ensure_publicites_table()` ligne 102-280

---

## 📋 PARTIE 1 : PROBLÈMES ET SOLUTIONS

### A. CRÉATION SERVICE (6 problèmes critiques)

#### ❌ A1. Transformation autocomplete → listeproduit manquante

**Fichier** : `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`  
**Ligne** : ~1900 (fonction `soumettreFormulaire`)

**Problème** :
```typescript
// Frontend envoie
"produits": {
  "type_donnee": "string",  // ❌ ERREUR
  "valeur": ["Noir,2024,Neuf,..."],
}

// Backend attend
"produits": {
  "type_donnee": "listeproduit",  // ✅ REQUIS
  "valeur": [{ nom: {...}, prix: {...} }]
}
```

**Solution** :
```typescript
// AVANT apiPost('/api/services/create', payload)
if (finalServiceData.produits?.type_donnee === 'autocomplete' || 
    finalServiceData.produits?.type_donnee === 'string') {
  
  finalServiceData.produits = {
    type_donnee: "listeproduit",
    valeur: [{
      nom: finalServiceData.nom_produit,
      prix: finalServiceData.prix_produit,
      categorie: finalServiceData.categorie_produit,
      description: finalServiceData.description_produit,
    }],
    origine_champs: "formulaire"
  };
  
  // Retirer champs individuels
  delete finalServiceData.nom_produit;
  delete finalServiceData.prix_produit;
  delete finalServiceData.categorie_produit;
  delete finalServiceData.description_produit;
}
```

---

#### ❌ A2. Débit tokens AVANT validation

**Fichier** : `backend/src/services/creer_service.rs`  
**Ligne** : ~410

**Problème** :
```rust
// ACTUELLEMENT (❌ MAUVAIS ORDRE)
let nouveau_solde = debiter_tokens(...)?;  // Ligne 410
...
valider_service_json(&data_obj)?;  // Ligne 420

// Si validation échoue → User perd argent !
```

**Solution** :
```rust
// ✅ INVERSER L'ORDRE
valider_service_json(&data_obj)?;  // VALIDER D'ABORD
...
let nouveau_solde = debiter_tokens(...)?;  // PUIS DÉBITER
```

---

#### ❌ A3-A6. Tables manquantes (migrations)

**Tables** :
- `token_usage_logs`
- `autocomplete_characteristics` 
- `image_analyses`
- Fonction `hybrid_image_search()`

**Solution** : Ajouter dans `backend/src/migrations/auto_migrate.rs`

---

---

### B. HOMESCREEN (2 problèmes UI)

#### ❌ B1. Scroll horizontal auto produits/publicités ne fonctionne pas

**Fichier** : `mobile/src/screens/HomeScreen.tsx`  
**Composant** : `MixedContentCarousel` (ligne ~10)

**Problème** : Carousel horizontal ne scroll pas automatiquement

**Cause** : Logique auto-scroll manquante ou timer pas configuré

**Solution** : Vérifier/réécrire MixedContentCarousel avec :
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    if (scrollRef.current && products.length > 1) {
      scrollRef.current.scrollTo({
        x: (currentIndex + 1) * cardWidth,
        animated: true
      });
      setCurrentIndex((prev) => (prev + 1) % products.length);
    }
  }, 3000);  // Scroll toutes les 3s
  
  return () => clearInterval(interval);
}, [currentIndex, products]);
```

---

#### ❌ B2. Historique notifications non fonctionnel

**Fichier** : `mobile/src/components/NotificationHistoryModal.tsx`

**Problème** : Affichage incomplet ou crash

**Solution** : Revoir profondeur code pour gestion robuste des notifications

---

### C. FORMULAIRE (4 problèmes UX)

#### ❌ C1-C3. Champs produit pas chargés automatiquement

**Fichier** : `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`  
**Ligne** : ~150

**Problème** : `nom_produit`, `categorie_produit`, `description_produit` pas chargés depuis IA

**Solution** :
```typescript
useEffect(() => {
  if (suggestion?.data) {
    const initialValues: Record<string, any> = {};
    
    Object.entries(suggestion.data).forEach(([key, field]: [string, any]) => {
      if (field?.valeur !== undefined) {
        initialValues[key] = field.valeur;
      }
    });
    
    setValeursFormulaire(initialValues);
  }
}, [suggestion]);
```

---

#### ❌ C4. Autocomplete cherche au lieu d'afficher

**Fichier** : `mobile/src/components/LinearAutocompleteEditor.tsx`

**Problème** : Composant cherche dans BDD au lieu d'afficher vecteur IA

**Solution** : Réécriture complète pour afficher vecteur avec boutons Modifier/Ajouter/Supprimer

---

Voir fichier complet : `ALGORITHMES_DETAILLES.md` (généré séparément)

---

## 📋 PARTIE 2 : ARCHITECTURE VECTORIELLE

### Table autocomplete_combinations (NOUVELLE)

```sql
CREATE TABLE autocomplete_combinations (
    id SERIAL PRIMARY KEY,
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    
    -- Vecteurs séparés
    product_vector TEXT[] NOT NULL,
    location_vector TEXT[] NOT NULL,
    full_vector TEXT[] NOT NULL,  -- Concatenation product + location
    
    -- Lieu choisi (pour scoring)
    chosen_location VARCHAR(255),
    chosen_location_geoname_id BIGINT,
    
    -- Variations prix (si existe)
    has_variant BOOLEAN DEFAULT FALSE,
    variant_dimension VARCHAR(255),
    variant_value TEXT,
    prix NUMERIC,
    devise VARCHAR(10) DEFAULT 'XAF',
    stock INTEGER,
    
    -- Stats
    usage_count INTEGER DEFAULT 1,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(service_id, full_vector)
);

CREATE INDEX idx_full_vector_gin ON autocomplete_combinations USING GIN(full_vector);
CREATE INDEX idx_product_vector_gin ON autocomplete_combinations USING GIN(product_vector);
CREATE INDEX idx_location_vector_gin ON autocomplete_combinations USING GIN(location_vector);
CREATE INDEX idx_chosen_location ON autocomplete_combinations(chosen_location);
```

### Table geo_hierarchy (NOUVELLE)

```sql
CREATE TABLE geo_hierarchy (
    geoname_id BIGINT PRIMARY KEY,
    place_name VARCHAR(255) NOT NULL,
    display_name TEXT NOT NULL,  -- "Douala, Littoral, Cameroun"
    
    -- Type
    feature_code VARCHAR(10) NOT NULL,
    admin_level INTEGER NOT NULL,
    is_leaf BOOLEAN DEFAULT FALSE,
    
    -- Contexte (homonymes)
    parent_country VARCHAR(255) NOT NULL,
    parent_country_code CHAR(2),
    
    -- Vecteur bidirectionnel
    location_vector TEXT[] NOT NULL,
    
    -- Coordonnées
    lat NUMERIC(10, 7) NOT NULL,
    lng NUMERIC(10, 7) NOT NULL,
    bounds JSONB,
    
    -- Métadonnées
    population INTEGER,
    timezone VARCHAR(50),
    
    -- Tracking
    times_used INTEGER DEFAULT 0,
    last_enriched_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE (place_name, parent_country, lat, lng)
);

CREATE INDEX idx_geo_name_country ON geo_hierarchy(place_name, parent_country);
CREATE INDEX idx_geo_vector_gin ON geo_hierarchy USING GIN(location_vector);
```

---

## 📋 PARTIE 3 : FICHIERS À MODIFIER

### Backend (10 fichiers)

1. **`backend/src/migrations/auto_migrate.rs`** ⭐⭐⭐
   - Ajouter `ensure_token_usage_logs_table()`
   - Ajouter `ensure_autocomplete_combinations_table()`
   - Ajouter `ensure_geo_hierarchy_table()`
   - Ajouter `ensure_image_analyses_table()`
   - Ajouter `ensure_hybrid_image_search_function()`
   - Modifier `run_auto_migrations()` pour appeler tout

2. **`backend/src/services/creer_service.rs`** ⭐⭐⭐
   - Ligne ~410 : Inverser débit/validation
   - Ajouter `save_autocomplete_combination()`
   - Ajouter `build_location_vector()`

3. **`backend/src/services/geonames_service.rs`** (NOUVEAU) ⭐⭐
   - `search_geoname()`
   - `get_hierarchy()`
   - `get_children()`
   - `enrich_location_bidirectional()`

4. **`backend/src/controllers/autocomplete_controller.rs`** (NOUVEAU) ⭐⭐
   - Endpoint `POST /api/autocomplete/search-combinations`
   - Recherche multi-filtres progressive

5. **`backend/src/controllers/places_controller.rs`** (AMÉLIORER) ⭐
   - Endpoint `GET /api/places/enrich` 
   - Retourner hiérarchie complète avec GeoNames

6. **`backend/ia_prompts/creation_service_prompt.md`** ⭐⭐
   - Intégrer variation_prix DANS autocomplete
   - Règle position "last" pour dimension variable
   - Règle dimension lieu en fin de vecteur
   - Exemples chaussure, hôtel, canapé avec variations

7. **`backend/src/controllers/mod.rs`**
   - Exporter nouveaux contrôleurs

8. **`backend/src/services/mod.rs`**
   - Exporter geonames_service

9. **`backend/src/routes/autocomplete_routes.rs`** (NOUVEAU)
   - Routes autocomplete

10. **`backend/src/routes/mod.rs`**
    - Inclure autocomplete_routes

---

### Frontend (5 fichiers)

11. **`mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx`** ⭐⭐⭐
    - Ligne ~150 : Charger valeurs IA automatiquement
    - Ligne ~300 : Ajouter dimension lieu automatique
    - Ligne ~1900 : Transformer autocomplete → listeproduit
    - Retirer `tokens_ia_externe` de data

12. **`mobile/src/components/LinearAutocompleteEditor.tsx`** ⭐⭐⭐ (RÉÉCRITURE)
    - Afficher vecteur IA (pas chercher)
    - Boutons Modifier/Ajouter/Supprimer modalités
    - UI chips moderne

13. **`mobile/src/components/LocationSelector.tsx`** ⭐⭐ (AMÉLIORER)
    - Retourner objet complet (pas juste string)
    - Parser `address_components` de Google
    - Tous niveaux (quartier → pays)

14. **`mobile/src/screens/ResultatBesoinScreen.tsx`** ⭐⭐⭐ (RÉÉCRITURE COMPLÈTE)
    - Barre recherche progressive
    - Suggestions vecteurs autocomplete
    - Filtrage multi-critères
    - Intégration ProductCard refonte

15. **`mobile/src/components/ProductCard.tsx`** ⭐⭐⭐ (REFONTE COMPLÈTE)
    - Affichage vecteur caractéristiques
    - Tableau variations prix
    - Localisation avec proximité
    - Intégration ChatModalMobile
    - Nom prestataire cliquable

---

## 📋 PARTIE 4 : ALGORITHMES DÉTAILLÉS

Voir fichier : `ALGORITHMES_IMPLEMENTATION.md` (généré ensuite)

---

## 📋 PARTIE 5 : CHECKLIST IMPLÉMENTATION

### Phase 1 : Migrations Auto (2h) - P0

- [ ] Créer `ensure_token_usage_logs_table()` dans auto_migrate.rs
- [ ] Créer `ensure_autocomplete_combinations_table()`
- [ ] Créer `ensure_geo_hierarchy_table()`  
- [ ] Créer `ensure_image_analyses_table()`
- [ ] Créer `ensure_hybrid_image_search_function()`
- [ ] Modifier `run_auto_migrations()` pour tout appeler
- [ ] Tester : `cargo run` → Vérifier logs migrations

### Phase 2 : Service GeoNames (3h) - P0

- [ ] Créer `backend/src/services/geonames_service.rs`
- [ ] Implémenter `search_geoname(place_name, country_context)`
- [ ] Implémenter `get_hierarchy(geoname_id)` 
- [ ] Implémenter `get_children(geoname_id, max_depth=7)`
- [ ] Implémenter `enrich_location_bidirectional()`
- [ ] Implémenter `build_location_vector()`
- [ ] Ajouter dans mod.rs

### Phase 3 : Backend Sauvegarde (4h) - P0

- [ ] Modifier `creer_service.rs` : inverser débit/validation
- [ ] Créer `save_autocomplete_combination(service_id, data)`
- [ ] Intégrer appel `build_location_vector()` 
- [ ] Sauvegarder vecteurs dans autocomplete_combinations
- [ ] Gérer variations prix (loop modalités)
- [ ] Tests unitaires

### Phase 4 : Frontend Formulaire (4h) - P1

- [ ] FormulaireYukpoIntelligentScreen : Charger valeurs IA
- [ ] Ajouter dimension lieu automatiquement
- [ ] Transformer autocomplete→listeproduit avant sauvegarde
- [ ] Retirer tokens_ia_externe de data
- [ ] Tests création service

### Phase 5 : Autocomplete Affichage (3h) - P1

- [ ] Réécrire LinearAutocompleteEditor
- [ ] Afficher vecteur en chips modernes
- [ ] Bouton Modifier modalité (picker)
- [ ] Bouton Supprimer modalité
- [ ] Bouton Ajouter modalité
- [ ] Tests UX

### Phase 6 : LocationSelector Enrichi (2h) - P1

- [ ] Modifier retour : objet complet au lieu de string
- [ ] Parser address_components Google Places
- [ ] Extraire hiérarchie (ville, région, pays)
- [ ] Appeler `/api/places/enrich` backend
- [ ] Tests tous niveaux

### Phase 7 : Contrôleur Places (2h) - P1

- [ ] Créer endpoint `/api/places/enrich`
- [ ] Intégrer geonames_service
- [ ] Chercher cache geo_hierarchy
- [ ] Si absent : enrichir avec GeoNames
- [ ] Sauvegarder cache
- [ ] Retourner hiérarchie complète

### Phase 8 : Recherche Vectorielle (4h) - P1

- [ ] Créer `autocomplete_controller.rs`
- [ ] Endpoint `POST /api/autocomplete/search-combinations`
- [ ] Recherche multi-filtres progressifs
- [ ] Scoring position (exact > enfant > parent)
- [ ] Intégration hiérarchie géographique
- [ ] Tests recherche

### Phase 9 : Refonte ResultatBesoinScreen (6h) - P2

- [ ] Réécriture COMPLÈTE from scratch
- [ ] Barre recherche progressive
- [ ] Appel `/api/autocomplete/search-combinations`
- [ ] Affichage suggestions vecteurs
- [ ] Sélection vecteur → Recherche finale
- [ ] Filtrage intelligent
- [ ] Intégration ProductCard refonte

### Phase 10 : Refonte ProductCard (4h) - P2

- [ ] Réécriture COMPLÈTE
- [ ] Affichage vecteur caractéristiques (chips)
- [ ] Tableau variations prix (si has_variant)
- [ ] Localisation + distance
- [ ] Nom prestataire + avatar
- [ ] Bouton chat (ChatModalMobile)
- [ ] Design moderne UX

### Phase 11 : Prompt IA (2h) - P1

- [ ] Intégrer variation_prix DANS autocomplete (ligne ~115)
- [ ] Règle position "last" dimension variable (ligne ~145)
- [ ] Règle dimension lieu en fin automatique (ligne ~280)
- [ ] Multi-combinaisons si variations (ligne ~160)
- [ ] Exemples chaussure/hôtel/canapé complets (ligne ~300)
- [ ] Normalisation labels standards (ligne ~50)
- [ ] Génération vecteur avec variation + lieu

### Phase 12 : HomeScreen Scroll Auto (1h) - P2

- [ ] Corriger MixedContentCarousel
- [ ] Implémenter auto-scroll produits/pubs
- [ ] Timer 3-5 secondes configurable
- [ ] Gestion pause au touch
- [ ] Tests carousel

### Phase 13 : Notifications Historique (2h) - P2

- [ ] Revoir NotificationHistoryModal en profondeur
- [ ] Gestion erreurs robuste
- [ ] Affichage complet contenu
- [ ] Tests avec différents types notifications

---

## 📋 PARTIE 6 : APIs EXTERNES (GeoNames)

### Configuration GeoNames

**API** : http://api.geonames.org/  
**Gratuit** : 30 000 requêtes/jour  
**Inscription** : http://www.geonames.org/login

**Endpoints utilisés** :

1. **Search** : Trouver geoname_id
   ```
   GET http://api.geonames.org/searchJSON?
       name=Douala&
       country=CM&
       maxRows=1&
       username=YOUR_USERNAME
   ```

2. **Hierarchy** : Parents (ascendant)
   ```
   GET http://api.geonames.org/hierarchyJSON?
       geonameId=2232593&
       username=YOUR_USERNAME
   
   Retourne : [Earth, Africa, Cameroon, Littoral, Wouri, Douala]
   ```

3. **Children** : Enfants (descendant)
   ```
   GET http://api.geonames.org/childrenJSON?
       geonameId=2232593&
       username=YOUR_USERNAME
   
   Retourne : [Akwa, Bonamoussadi, Bonapriso, Bépanda, ...]
   ```

**Profondeur maximale** : GeoNames descend jusqu'à **niveau 7 (quartier)**

**Gestion extrêmes** :
- Si `children` retourne `[]` → `is_leaf = true`
- Quartier = généralement extrême (pas de sous-quartiers)
- Ville peut avoir 10-50 quartiers

**Rate limiting** : Cache local pour 95% requêtes après 1 mois d'usage

---

## 📋 PARTIE 7 : PRIORITÉS

**P0 - BLOQUANT** (10h) :
- Migrations auto
- Débit après validation
- Transformation autocomplete
- Service GeoNames
- Backend sauvegarde

**P1 - IMPORTANT** (13h) :
- Formulaire charger valeurs
- LocationSelector enrichi
- Recherche vectorielle
- Autocomplete affichage
- Prompt IA

**P2 - UX** (10h) :
- ResultatBesoinScreen refonte
- ProductCard refonte

---

SUITE DANS : `ALGORITHMES_IMPLEMENTATION.md`

