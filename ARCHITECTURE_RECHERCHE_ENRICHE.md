# 🔍 Architecture de Recherche Enrichie (Sans Remplacer la Base)

## 🎯 Principe Fondamental

**La recherche actuelle dans `services` et `produits` reste la BASE de l'application.**

Les tables spécialisées sont un **ENRICHISSEMENT** qui améliore les résultats pour certains types de recherches, mais **ne remplacent jamais** la recherche normale.

---

## 📊 Architecture Actuelle (Base)

### Recherche Normale (TOUJOURS ACTIVE)

**Fonction principale** : `search_services_gps_final()`
- Recherche dans table `services`
- Recherche dans `data->produits` (JSONB)
- Utilise `search_services_gps_final()` pour GPS
- Utilise `fulltext_search_with_gps()` pour texte
- **C'est la recherche de base, toujours utilisée**

**Code actuel** :
```rust
// backend/src/services/native_search_service.rs
async fn fulltext_search_with_gps(...) -> AppResult<Vec<SearchResult>> {
    // 1. Vérifier planification (enrichissement)
    if intent.should_use_scheduling_search() {
        // Utilise search_products_with_scheduling() (enrichissement)
        return Ok(scheduling_results);
    }
    
    // 2. Recherche GPS optimisée (BASE)
    if let Some(gps_zone_val) = gps_zone {
        // Utilise search_services_gps_final() (BASE)
        return Ok(search_results);
    }
    
    // 3. Recherche fulltext normale (BASE)
    // Recherche dans services.data->produits
    return Ok(fulltext_results);
}
```

---

## 🔄 Architecture Enrichie (Proposée)

### Principe : Enrichissement, Pas Remplacement

```
Recherche Utilisateur
    ↓
Détection Type (pharmacie/hôpital/laboratoire/agence)
    ↓
┌─────────────────────────────────────────┐
│  RECHERCHE BASE (TOUJOURS)              │
│  - search_services_gps_final()          │
│  - Recherche dans services + produits   │
│  - Résultats génériques                │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  ENRICHISSEMENT (Si type détecté)      │
│  - Recherche dans table spécialisée    │
│  - Résultats enrichis                  │
│  - Fusion avec résultats base          │
└─────────────────────────────────────────┘
    ↓
Résultats Fusionnés (Base + Enrichis)
```

---

## 🔍 Logique de Recherche Enrichie

### Option 1 : Fusion des Résultats (Recommandée)

```rust
async fn fulltext_search_with_gps_enriched(
    &self,
    query: &str,
    gps_zone: Option<&str>,
    search_radius_km: Option<i32>,
) -> AppResult<Vec<SearchResult>> {
    // 1. RECHERCHE BASE (TOUJOURS)
    let base_results = self.fulltext_search_with_gps(
        query,
        None, // category_filter
        None, // location_filter
        gps_zone,
        search_radius_km,
    ).await?;
    
    // 2. DÉTECTION TYPE (Enrichissement)
    let search_type = detect_specialized_search_type(query);
    
    // 3. ENRICHISSEMENT (Si type détecté)
    let mut enriched_results = base_results;
    
    match search_type {
        SpecializedSearchType::Pharmacie => {
            // Recherche dans table pharmacies (ENRICHISSEMENT)
            let pharmacy_results = search_pharmacies_table(query, gps_zone).await?;
            
            // Fusionner avec résultats base
            enriched_results = merge_results(base_results, pharmacy_results);
        }
        SpecializedSearchType::Hopital => {
            let hospital_results = search_hospitals_table(query, gps_zone).await?;
            enriched_results = merge_results(base_results, hospital_results);
        }
        // ... autres types
        SpecializedSearchType::General => {
            // Pas d'enrichissement, retourner résultats base
        }
    }
    
    // 4. DÉDUPLIQUER (même service_id peut être dans base + spécialisé)
    enriched_results = deduplicate_results(enriched_results);
    
    // 5. TRIER (priorité aux résultats enrichis)
    enriched_results.sort_by(|a, b| {
        // Résultats enrichis en premier
        let a_enriched = a.search_method.contains("specialized");
        let b_enriched = b.search_method.contains("specialized");
        
        match (a_enriched, b_enriched) {
            (true, false) => std::cmp::Ordering::Less,  // a avant b
            (false, true) => std::cmp::Ordering::Greater, // b avant a
            _ => b.total_score.partial_cmp(&a.total_score).unwrap_or(std::cmp::Ordering::Equal),
        }
    });
    
    Ok(enriched_results)
}
```

---

### Option 2 : Recherche Parallèle (Alternative)

```rust
async fn fulltext_search_with_gps_parallel(
    &self,
    query: &str,
    gps_zone: Option<&str>,
) -> AppResult<Vec<SearchResult>> {
    // 1. Recherche BASE (toujours)
    let base_future = self.fulltext_search_with_gps(query, None, None, gps_zone, None);
    
    // 2. Détection type
    let search_type = detect_specialized_search_type(query);
    
    // 3. Recherche spécialisée (si type détecté)
    let specialized_future = match search_type {
        SpecializedSearchType::Pharmacie => {
            Some(search_pharmacies_table(query, gps_zone))
        }
        SpecializedSearchType::Hopital => {
            Some(search_hospitals_table(query, gps_zone))
        }
        // ...
        _ => None,
    };
    
    // 4. Exécuter en parallèle
    let (base_results, specialized_results) = tokio::join!(
        base_future,
        specialized_future.unwrap_or(async { Ok(Vec::new()) })
    );
    
    let base = base_results?;
    let specialized = specialized_results?;
    
    // 5. Fusionner et dédupliquer
    let mut all_results = base;
    all_results.extend(specialized);
    all_results = deduplicate_results(all_results);
    
    Ok(all_results)
}
```

---

## 📋 Fonction de Fusion

```rust
fn merge_results(
    base_results: Vec<SearchResult>,
    specialized_results: Vec<SearchResult>,
) -> Vec<SearchResult> {
    let mut merged = base_results;
    
    for specialized in specialized_results {
        // Vérifier si le service existe déjà dans base
        if let Some(existing) = merged.iter_mut().find(|r| r.service_id == specialized.service_id) {
            // Enrichir le résultat existant
            existing.search_method = format!("{}_enriched", existing.search_method);
            existing.total_score = (existing.total_score + specialized.total_score) / 2.0;
            existing.matched_fields.extend(specialized.matched_fields);
        } else {
            // Ajouter comme nouveau résultat
            merged.push(specialized);
        }
    }
    
    merged
}

fn deduplicate_results(results: Vec<SearchResult>) -> Vec<SearchResult> {
    let mut seen = std::collections::HashSet::new();
    let mut deduplicated = Vec::new();
    
    for result in results {
        if seen.insert(result.service_id) {
            deduplicated.push(result);
        }
    }
    
    deduplicated
}
```

---

## 🎯 Exemple Concret

### Scénario : Recherche "pharmacie de garde"

**1. Recherche BASE (toujours exécutée)** :
```sql
-- search_services_gps_final() ou fulltext_search
SELECT * FROM services 
WHERE data->'produits' @> '[{"type": "pharmacie"}]'
OR data::TEXT ILIKE '%pharmacie%'
```

**Résultats BASE** :
- Service 123 : "Pharmacie Centrale" (dans services.data)
- Service 456 : "Boutique médicaments" (dans services.data)

**2. Détection** : `SpecializedSearchType::Pharmacie`

**3. Recherche ENRICHISSEMENT** :
```sql
SELECT * FROM pharmacies 
WHERE nom ILIKE '%pharmacie%'
AND is_on_duty_now = TRUE
```

**Résultats ENRICHIS** :
- Pharmacie 123 : "Pharmacie Centrale" (dans table pharmacies, is_on_duty_now = TRUE)
- Pharmacie 789 : "Pharmacie de Garde 24h" (nouvelle, pas dans base)

**4. Fusion** :
```rust
[
    // Résultat enrichi (priorité)
    SearchResult {
        service_id: 123,
        search_method: "gps_optimized_enriched",
        // ... données enrichies de table pharmacies
        is_on_duty_now: true,  // ✅ Enrichi
        telephone_urgence: "+237...",  // ✅ Enrichi
    },
    // Résultat base (si pas dans table spécialisée)
    SearchResult {
        service_id: 456,
        search_method: "gps_optimized",
        // ... données de services.data
    },
    // Nouveau résultat spécialisé
    SearchResult {
        service_id: 789,
        search_method: "specialized_pharmacy",
        // ... données de table pharmacies
    },
]
```

---

## 🔄 Flux Complet

```
1. Utilisateur recherche "pharmacie de garde"
   ↓
2. Détection : SpecializedSearchType::Pharmacie
   ↓
3. Recherche BASE (toujours)
   ├─ search_services_gps_final()
   └─ Résultats : Services avec produits pharmacie
   ↓
4. Recherche ENRICHISSEMENT (si type détecté)
   ├─ SELECT * FROM pharmacies WHERE is_on_duty_now = TRUE
   └─ Résultats : Pharmacies de garde maintenant
   ↓
5. Fusion des résultats
   ├─ Dédupliquer (même service_id)
   ├─ Enrichir résultats existants
   └─ Ajouter nouveaux résultats spécialisés
   ↓
6. Tri intelligent
   ├─ Résultats enrichis en premier
   ├─ Puis résultats base
   └─ Score total décroissant
   ↓
7. Retour à l'utilisateur
   └─ Résultats fusionnés avec affichage spécialisé
```

---

## ⚠️ Points Critiques

### 1. La Recherche BASE Ne Doit JAMAIS Être Désactivée

```rust
// ❌ MAUVAIS
match search_type {
    SpecializedSearchType::Pharmacie => {
        return search_pharmacies_table(...);  // ❌ Remplace la recherche base
    }
    // ...
}

// ✅ BON
let base_results = search_base(...).await?;  // ✅ Toujours exécutée
let enriched = match search_type {
    SpecializedSearchType::Pharmacie => {
        search_pharmacies_table(...).await?  // ✅ Enrichissement
    }
    // ...
};
return merge_results(base_results, enriched);  // ✅ Fusion
```

### 2. Les Tables Spécialisées Sont un Complément

- **Table `pharmacies`** : Enrichit les résultats avec `is_on_duty_now`, `telephone_urgence`
- **Table `hopitaux_cliniques`** : Enrichit avec `is_available_now`, `prestations_medicales`
- **Mais** : Si un service n'est pas dans la table spécialisée, il apparaît quand même dans les résultats base

### 3. Synchronisation Bidirectionnelle

**Quand un service est créé** :
- Si `type = 'pharmacie'` → Créer entrée dans `pharmacies` (enrichissement)
- Le service reste dans `services` (base)

**Quand une pharmacie est créée** :
- Créer service dans `services` (base)
- Créer entrée dans `pharmacies` (enrichissement)

---

## 📊 Comparaison Avant/Après

### Avant (Actuel)

```
Recherche "pharmacie"
  ↓
search_services_gps_final()
  ↓
Résultats : Services avec produits pharmacie
  ↓
Affichage générique
```

### Après (Enrichi)

```
Recherche "pharmacie de garde"
  ↓
Détection : Pharmacie
  ↓
┌─────────────────────────────┐
│ Recherche BASE              │
│ search_services_gps_final() │
│ → Services génériques       │
└─────────────────────────────┘
  +
┌─────────────────────────────┐
│ Recherche ENRICHISSEMENT    │
│ SELECT * FROM pharmacies     │
│ WHERE is_on_duty_now = TRUE │
│ → Pharmacies de garde        │
└─────────────────────────────┘
  ↓
Fusion + Déduplication
  ↓
Résultats enrichis avec affichage spécialisé
```

---

## ✅ Garanties

1. **Recherche BASE toujours active** : Même si détection échoue, recherche normale fonctionne
2. **Pas de perte de résultats** : Tous les services apparaissent (base + enrichis)
3. **Enrichissement optionnel** : Si table spécialisée vide, résultats base uniquement
4. **Rétrocompatibilité** : Code existant continue de fonctionner
5. **Performance** : Recherche parallèle pour ne pas ralentir

---

## 🔧 Implémentation Modifiée

### Modification de `native_search_service.rs`

```rust
pub async fn fulltext_search_with_gps(
    &self,
    query: &str,
    category_filter: Option<&str>,
    location_filter: Option<&str>,
    gps_zone: Option<&str>,
    search_radius_km: Option<i32>,
) -> AppResult<Vec<SearchResult>> {
    // ✅ ÉTAPE 1 : RECHERCHE BASE (TOUJOURS)
    let base_results = if let Some(gps_zone_val) = gps_zone {
        // Recherche GPS optimisée (BASE)
        self.search_with_gps_optimized(query, gps_zone_val, search_radius_km).await?
    } else {
        // Recherche fulltext normale (BASE)
        self.search_fulltext_normal(query, category_filter, location_filter).await?
    };
    
    // ✅ ÉTAPE 2 : DÉTECTION TYPE (Enrichissement)
    let search_type = detect_specialized_search_type(query);
    
    // ✅ ÉTAPE 3 : ENRICHISSEMENT (Optionnel)
    let enriched_results = match search_type {
        SpecializedSearchType::Pharmacie => {
            let pharmacy_results = self.search_pharmacies_enriched(query, gps_zone, search_radius_km).await?;
            merge_results(base_results, pharmacy_results)
        }
        SpecializedSearchType::Hopital => {
            let hospital_results = self.search_hospitals_enriched(query, gps_zone, search_radius_km).await?;
            merge_results(base_results, hospital_results)
        }
        SpecializedSearchType::Laboratoire => {
            let lab_results = self.search_laboratories_enriched(query, gps_zone, search_radius_km).await?;
            merge_results(base_results, lab_results)
        }
        SpecializedSearchType::AgenceVoyage => {
            let agency_results = self.search_agencies_enriched(query, gps_zone, search_radius_km).await?;
            merge_results(base_results, agency_results)
        }
        SpecializedSearchType::General => {
            // Pas d'enrichissement, retourner résultats base
            base_results
        }
    };
    
    // ✅ ÉTAPE 4 : DÉDUPLIQUER
    let final_results = deduplicate_results(enriched_results);
    
    // ✅ ÉTAPE 5 : TRIER (enrichis en premier)
    final_results.sort_by(|a, b| {
        let a_enriched = a.search_method.contains("specialized") || a.search_method.contains("enriched");
        let b_enriched = b.search_method.contains("specialized") || b.search_method.contains("enriched");
        
        match (a_enriched, b_enriched) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => b.total_score.partial_cmp(&a.total_score).unwrap_or(std::cmp::Ordering::Equal),
        }
    });
    
    Ok(final_results)
}
```

---

## 📝 Résumé

| Aspect | Recherche BASE | Recherche ENRICHISSEMENT |
|--------|----------------|--------------------------|
| **Source** | Table `services` + `data->produits` | Tables spécialisées (`pharmacies`, etc.) |
| **Toujours active** | ✅ OUI | ❌ Seulement si type détecté |
| **Résultats** | Tous les services | Services spécialisés uniquement |
| **Priorité** | Base de l'application | Complément/optimisation |
| **Si échec** | Recherche normale fonctionne | Retour aux résultats base |

**La recherche BASE reste le cœur de l'application. Les tables spécialisées enrichissent les résultats pour une meilleure expérience utilisateur !** ✅

