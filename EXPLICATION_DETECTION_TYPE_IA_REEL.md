# 🔍 Comment la Détection de Type Fonctionne Réellement avec l'IA

## 🎯 Problème Identifié

Vous avez raison : **la logique basée sur `product->>'type'` prédéfini n'est plus applicable** car c'est l'IA qui détermine la catégorie de manière autonome lors de l'analyse d'image.

---

## 📊 Comment ça Fonctionne Vraiment

### 1. Analyse d'Image par l'IA

Quand un utilisateur upload une image, l'IA analyse et détecte automatiquement :

```rust
// backend/src/services/intelligent_image_analysis_service.rs
pub struct ImageAnalysis {
    pub description: String,
    pub tags: Vec<String>,
    pub category_detected: String,  // ✅ Détecté par l'IA !
    pub marque: Option<String>,
    pub couleurs: Vec<String>,
    // ...
}
```

**L'IA retourne** :
```json
{
  "category_detected": "pharmacie",  // ✅ Détecté automatiquement
  "description": "Pharmacie de garde avec panneau visible",
  "tags": ["pharmacie", "garde", "médicaments"]
}
```

### 2. Stockage dans la Base de Données

Les produits sont stockés en **JSONB flexible** sans structure fixe :

```json
{
  "produits": [
    {
      "nom": "Pharmacie Centrale",
      "description": "...",
      "categorie": "pharmacie",  // Peut être présent
      "type": "pharmacie",       // Peut être présent OU absent
      "joursGarde": "Lundi, Mercredi",
      "heuresOuverture": "08:00",
      // ... autres champs dynamiques
    }
  ]
}
```

**Problème** : Le champ `type` peut être :
- ✅ Présent si l'IA l'a ajouté
- ❌ Absent si l'IA ne l'a pas détecté
- ❌ Différent selon le contexte (ex: `categorie` au lieu de `type`)

---

## 🔄 Détection Actuelle dans le Code

### Dans `search_products_with_scheduling()` (SQL)

La fonction SQL utilise encore `product->>'type'` :

```sql
CASE 
    WHEN product->>'type' = 'pharmacie' THEN
        is_pharmacy_on_duty(product, search_time)
    WHEN product->>'type' = 'hopital_clinique' THEN
        is_medical_service_available(product, search_time, search_query)
    ELSE TRUE
END
```

**Problème** : Si `type` n'existe pas ou est différent, la détection échoue !

---

### Dans `native_search_service.rs` (Rust)

Le code Rust détecte l'intention de recherche via l'analyse de texte :

```rust
// backend/src/services/scheduling_search_service.rs
pub fn analyze_search_intent(&self, query: &str) -> SearchIntent {
    let query_lower = query.to_lowercase();

    // Détection de recherche de pharmacie de garde
    if query_lower.contains("pharmacie")
        && (query_lower.contains("garde")
            || query_lower.contains("urgent")
            || query_lower.contains("nuit")
            || query_lower.contains("24h"))
    {
        return SearchIntent::PharmacyOnDuty;
    }

    // Détection de recherche de service médical
    if (query_lower.contains("médecin")
        || query_lower.contains("docteur")
        || query_lower.contains("urgences")
        || query_lower.contains("hôpital")
        || query_lower.contains("clinique"))
        && (query_lower.contains("disponible")
            || query_lower.contains("ouvert")
            || query_lower.contains("maintenant")
            || query_lower.contains("urgent"))
    {
        return SearchIntent::MedicalServiceAvailable;
    }

    SearchIntent::General
}
```

**Cette détection se base sur le texte de recherche, pas sur le type de produit !**

---

## ⚠️ Problème Actuel

### Scénario 1 : Produit sans champ `type`

**Produit stocké** :
```json
{
  "nom": "Pharmacie Centrale",
  "categorie": "pharmacie",  // ✅ Présent
  "joursGarde": "Lundi, Mercredi"
  // ❌ Pas de champ "type"
}
```

**Dans `search_products_with_scheduling()`** :
```sql
WHEN product->>'type' = 'pharmacie' THEN  -- ❌ NULL, ne match pas !
```

**Résultat** : La fonction `is_pharmacy_on_duty()` n'est **jamais appelée** !

---

### Scénario 2 : Produit avec `categorie` au lieu de `type`

**Produit stocké** :
```json
{
  "nom": "Hôpital Central",
  "categorie": "hopital_clinique",  // ✅ Présent
  "planningHebdomadaire": {...}
  // ❌ Pas de champ "type"
}
```

**Dans `search_products_with_scheduling()`** :
```sql
WHEN product->>'type' = 'hopital_clinique' THEN  -- ❌ NULL, ne match pas !
```

**Résultat** : La fonction `is_medical_service_available()` n'est **jamais appelée** !

---

## ✅ Solution : Détection Intelligente Multi-Champs

Il faut modifier `search_products_with_scheduling()` pour détecter le type de manière flexible :

```sql
CASE 
    -- Détection pharmacie : chercher dans plusieurs champs
    WHEN (
        product->>'type' = 'pharmacie' OR
        product->>'categorie' = 'pharmacie' OR
        product->>'category_detected' = 'pharmacie' OR
        (product->>'joursGarde' IS NOT NULL AND product->>'joursGarde' != '') OR
        product::TEXT ILIKE '%pharmacie%'
    ) THEN
        is_pharmacy_on_duty(product, search_time)
    
    -- Détection hôpital : chercher dans plusieurs champs
    WHEN (
        product->>'type' = 'hopital_clinique' OR
        product->>'categorie' = 'hopital_clinique' OR
        product->>'category_detected' = 'hopital_clinique' OR
        (product->>'planningHebdomadaire' IS NOT NULL) OR
        product::TEXT ILIKE '%hopital%' OR
        product::TEXT ILIKE '%clinique%'
    ) THEN
        is_medical_service_available(product, search_time, search_query)
    
    ELSE TRUE
END
```

---

## 🔍 Analyse du Code Réel

### 1. Comment l'IA Détermine la Catégorie

**Dans `intelligent_image_analysis_service.rs`** :

```rust
// L'IA analyse l'image et retourne category_detected
let category_detected = parsed["category_detected"]
    .as_str()
    .unwrap_or("autre")
    .to_string();
```

**L'IA peut détecter** :
- `"pharmacie"` si elle voit un panneau de pharmacie
- `"hopital_clinique"` si elle voit un hôpital/clinique
- `"vetement"`, `"automobile"`, etc.

**Mais** : Cette catégorie n'est pas toujours stockée dans `product->>'type'` !

---

### 2. Où est Stockée la Catégorie Détectée

**Dans `image_analyses` table** :
```sql
CREATE TABLE image_analyses (
    id SERIAL PRIMARY KEY,
    service_id INTEGER,
    media_id INTEGER,
    category_detected TEXT,  -- ✅ Ici !
    description TEXT,
    tags TEXT[],
    -- ...
);
```

**Dans `media` table** :
```sql
CREATE TABLE media (
    id SERIAL PRIMARY KEY,
    service_id INTEGER,
    ai_category TEXT,  -- ✅ Ici aussi !
    ai_description TEXT,
    ai_tags TEXT[],
    -- ...
);
```

**Dans `services.data` (JSONB)** :
```json
{
  "produits": [
    {
      "nom": "...",
      "categorie": "...",  // Peut être présent
      "type": "...",      // Peut être présent
      // category_detected n'est PAS directement dans le produit !
    }
  ]
}
```

---

### 3. Comment la Recherche Utilise la Catégorie

**Dans `native_search_service.rs`** :

```rust
// La recherche détecte l'intention via le texte de recherche
let intent = scheduling_service.analyze_search_intent(query);

if intent.should_use_scheduling_search() {
    // Utilise search_products_with_scheduling()
    // Qui cherche product->>'type' = 'pharmacie'
    // ❌ Mais si type n'existe pas, ça ne fonctionne pas !
}
```

**Dans `rechercher_besoin.rs`** :

```rust
// Cherche dans plusieurs champs
OR product->>'type' ILIKE $1
OR product->>'categorie' ILIKE $1
OR product->>'category' ILIKE $1
```

**Ici, la recherche est plus flexible !**

---

## 🎯 Solution Recommandée

### Option 1 : Détection Multi-Champs dans SQL

Modifier `search_products_with_scheduling()` pour chercher dans plusieurs champs :

```sql
-- Détection intelligente du type
WITH product_type_detected AS (
    SELECT 
        product,
        CASE
            -- Pharmacie : chercher dans plusieurs champs
            WHEN product->>'type' = 'pharmacie' THEN 'pharmacie'
            WHEN product->>'categorie' = 'pharmacie' THEN 'pharmacie'
            WHEN product->>'category' = 'pharmacie' THEN 'pharmacie'
            WHEN product->>'category_detected' = 'pharmacie' THEN 'pharmacie'
            WHEN product->>'joursGarde' IS NOT NULL AND product->>'joursGarde' != '' THEN 'pharmacie'
            WHEN product::TEXT ILIKE '%pharmacie%' AND product::TEXT ILIKE '%garde%' THEN 'pharmacie'
            
            -- Hôpital : chercher dans plusieurs champs
            WHEN product->>'type' = 'hopital_clinique' THEN 'hopital_clinique'
            WHEN product->>'categorie' = 'hopital_clinique' THEN 'hopital_clinique'
            WHEN product->>'category' = 'hopital_clinique' THEN 'hopital_clinique'
            WHEN product->>'category_detected' = 'hopital_clinique' THEN 'hopital_clinique'
            WHEN product->>'planningHebdomadaire' IS NOT NULL THEN 'hopital_clinique'
            WHEN product::TEXT ILIKE '%hopital%' OR product::TEXT ILIKE '%clinique%' THEN 'hopital_clinique'
            
            ELSE 'autre'
        END as detected_type
    FROM jsonb_array_elements(...) AS product
)
SELECT 
    ...,
    CASE 
        WHEN ptd.detected_type = 'pharmacie' THEN
            is_pharmacy_on_duty(ptd.product, search_time)
        WHEN ptd.detected_type = 'hopital_clinique' THEN
            is_medical_service_available(ptd.product, search_time, search_query)
        ELSE TRUE
    END as is_available_now
FROM product_type_detected ptd
```

---

### Option 2 : Utiliser `image_analyses.category_detected`

Joindre avec la table `image_analyses` pour utiliser `category_detected` :

```sql
WITH products_with_category AS (
    SELECT 
        s.id as service_id,
        product,
        COALESCE(
            product->>'type',
            product->>'categorie',
            product->>'category',
            ia.category_detected,  -- ✅ Depuis image_analyses
            m.ai_category,          -- ✅ Depuis media
            'autre'
        ) as detected_category
    FROM services s,
    LATERAL jsonb_array_elements(...) AS product
    LEFT JOIN image_analyses ia ON ia.service_id = s.id
    LEFT JOIN media m ON m.service_id = s.id AND m.type = 'image'
    WHERE s.is_active = true
)
SELECT 
    ...,
    CASE 
        WHEN pwc.detected_category = 'pharmacie' THEN
            is_pharmacy_on_duty(pwc.product, search_time)
        WHEN pwc.detected_category = 'hopital_clinique' THEN
            is_medical_service_available(pwc.product, search_time, search_query)
        ELSE TRUE
    END as is_available_now
FROM products_with_category pwc
```

---

## 📝 Résumé

### Problème Actuel

1. ❌ `search_products_with_scheduling()` cherche uniquement `product->>'type'`
2. ❌ L'IA détermine `category_detected` mais ne le stocke pas toujours dans `product->>'type'`
3. ❌ Les produits peuvent avoir `categorie`, `category`, ou aucun champ de type
4. ❌ La détection échoue si `type` n'existe pas

### Solution

1. ✅ Détection multi-champs : chercher dans `type`, `categorie`, `category`, `category_detected`
2. ✅ Détection par contenu : chercher `joursGarde` pour pharmacie, `planningHebdomadaire` pour hôpital
3. ✅ Joindre avec `image_analyses` pour utiliser `category_detected`
4. ✅ Fallback sur recherche textuelle si aucun champ ne match

**La fonction SQL doit être modifiée pour être compatible avec la détection IA autonome !** 🔧

