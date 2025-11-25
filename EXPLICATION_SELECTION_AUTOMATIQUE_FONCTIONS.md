# 🔄 Comment le Code Rust Sait Quelle Fonction Utiliser Automatiquement

## 🎯 Vue d'Ensemble

La sélection automatique se fait **dans PostgreSQL**, pas dans Rust ! Le code Rust appelle une fonction SQL qui détecte automatiquement le type de produit et appelle la bonne fonction.

---

## 📊 Flux Complet

```
1. Utilisateur fait une recherche
   ↓
2. Code Rust appelle search_products_with_scheduling()
   ↓
3. PostgreSQL exécute la fonction SQL
   ↓
4. PostgreSQL détecte le type de produit (pharmacie/hôpital)
   ↓
5. PostgreSQL appelle automatiquement la bonne fonction
   ├─ Si type = 'pharmacie' → is_pharmacy_on_duty()
   └─ Si type = 'hopital_clinique' → is_medical_service_available()
   ↓
6. Résultats retournés au code Rust
```

---

## 🔍 Détail Technique

### 1. Code Rust : Appel Simple

Le code Rust appelle simplement la fonction SQL sans se soucier du type :

```rust
// backend/src/services/scheduling_search_service.rs
pub async fn search_with_scheduling(
    &self,
    search_query: &str,
    search_time: Option<DateTime<Utc>>,
    user_lat: Option<f64>,
    user_lng: Option<f64>,
    max_distance_km: Option<f64>,
) -> Result<Vec<SchedulingSearchResult>, String> {
    let query = r#"
        SELECT 
            service_id,
            product_data,
            relevance_score,
            distance_km,
            is_available_now,
            availability_info
        FROM search_products_with_scheduling($1, $2, $3, $4, $5)
        ORDER BY is_available_now DESC, relevance_score DESC, distance_km ASC
        LIMIT 50
    "#;

    sqlx::query(query)
        .bind(search_query)
        .bind(search_time)
        .bind(user_lat)
        .bind(user_lng)
        .bind(max_distance)
        .fetch_all(&self.pool)
        .await
}
```

**Le code Rust ne sait pas quel type de produit sera retourné !** Il appelle juste `search_products_with_scheduling()`.

---

### 2. Fonction SQL : Détection Automatique

C'est dans la fonction SQL `search_products_with_scheduling()` que la magie opère :

```sql
-- backend/migrations/20251020003_add_pharmacy_hospital_scheduling_search.sql
CREATE OR REPLACE FUNCTION search_products_with_scheduling(...)
RETURNS TABLE (...) AS $$
BEGIN
    RETURN QUERY
    WITH product_search AS (
        SELECT 
            s.id as service_id,
            product,
            -- ... autres champs ...
            
            -- ✅ ICI : Détection automatique du type et appel de la bonne fonction
            CASE 
                WHEN product->>'type' = 'pharmacie' THEN
                    is_pharmacy_on_duty(product, search_time)
                WHEN product->>'type' = 'hopital_clinique' THEN
                    is_medical_service_available(product, search_time, search_query)
                ELSE TRUE
            END as is_available_now,
            
            -- Informations de disponibilité
            CASE 
                WHEN product->>'type' = 'pharmacie' AND is_pharmacy_on_duty(product, search_time) THEN
                    'Pharmacie de garde disponible maintenant'
                WHEN product->>'type' = 'hopital_clinique' AND is_medical_service_available(product, search_time, search_query) THEN
                    'Service médical disponible maintenant'
                WHEN product->>'type' = 'pharmacie' THEN
                    'Pharmacie fermée - Garde: ' || COALESCE(product->>'joursGarde', 'Non spécifié')
                WHEN product->>'type' = 'hopital_clinique' THEN
                    'Service médical fermé - Planning: ' || COALESCE(product->>'planningHebdomadaire', 'Non spécifié')
                ELSE 'Disponible'
            END as availability_info
        FROM services s,
        LATERAL jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(s.data->'produits') = 'array' 
                THEN s.data->'produits'
                ELSE '[]'::jsonb
            END
        ) AS product
        WHERE s.is_active = true
    )
    SELECT * FROM product_search
    WHERE ...
    ORDER BY ...
END;
```

---

## 🔑 Point Clé : Détection par `product->>'type'`

La sélection automatique se base sur le champ `type` dans le JSONB du produit :

### Exemple 1 : Produit Pharmacie

```json
{
  "type": "pharmacie",
  "nom": "Pharmacie Centrale",
  "joursGarde": "Lundi, Mercredi, Vendredi",
  "heuresOuverture": "08:00",
  "heuresFermeture": "22:00"
}
```

**PostgreSQL détecte** : `product->>'type' = 'pharmacie'`
**PostgreSQL appelle** : `is_pharmacy_on_duty(product, search_time)`

---

### Exemple 2 : Produit Hôpital

```json
{
  "type": "hopital_clinique",
  "nom": "Hôpital Central",
  "planningHebdomadaire": {
    "lundi": { "debut": "08:00", "fin": "18:00" },
    "mardi": { "debut": "08:00", "fin": "18:00" }
  },
  "prestationsMedicales": {
    "urgences": true,
    "radiologie": true
  }
}
```

**PostgreSQL détecte** : `product->>'type' = 'hopital_clinique'`
**PostgreSQL appelle** : `is_medical_service_available(product, search_time, search_query)`

---

### Exemple 3 : Autre Type de Produit

```json
{
  "type": "automobile",
  "nom": "Toyota Corolla",
  "marque": "Toyota",
  "modele": "Corolla"
}
```

**PostgreSQL détecte** : `product->>'type' = 'automobile'` (pas 'pharmacie' ni 'hopital_clinique')
**PostgreSQL appelle** : Aucune fonction spéciale → `is_available_now = TRUE` (toujours disponible)

---

## 📋 Structure du CASE Statement

```sql
CASE 
    WHEN product->>'type' = 'pharmacie' THEN
        -- ✅ Appel automatique de is_pharmacy_on_duty()
        is_pharmacy_on_duty(product, search_time)
        
    WHEN product->>'type' = 'hopital_clinique' THEN
        -- ✅ Appel automatique de is_medical_service_available()
        is_medical_service_available(product, search_time, search_query)
        
    ELSE 
        -- ✅ Autres types : toujours disponible
        TRUE
END as is_available_now
```

**PostgreSQL évalue le CASE pour chaque produit** et appelle automatiquement la bonne fonction !

---

## 🔄 Exemple Complet de Flux

### Scénario : Recherche "pharmacie de garde"

**1. Utilisateur fait une recherche** :
```
GET /api/search/scheduling?query=pharmacie%20de%20garde
```

**2. Code Rust reçoit la requête** :
```rust
// backend/src/controllers/scheduling_search_controller.rs
pub async fn search_with_scheduling(
    Query(params): Query<SchedulingSearchParams>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<SchedulingSearchResponse>, StatusCode> {
    let scheduling_service = SchedulingSearchService::new(state.pg.clone());
    
    // Appel simple, pas de détection de type ici !
    let results = scheduling_service
        .search_with_scheduling(
            &params.query,  // "pharmacie de garde"
            None,
            params.lat,
            params.lng,
            params.max_distance,
        )
        .await?;
}
```

**3. Service Rust appelle PostgreSQL** :
```rust
// backend/src/services/scheduling_search_service.rs
let query = r#"
    SELECT * FROM search_products_with_scheduling($1, $2, $3, $4, $5)
"#;

sqlx::query(query)
    .bind("pharmacie de garde")  // search_query
    .bind(NOW())                 // search_time
    .bind(4.05)                  // user_lat
    .bind(9.71)                  // user_lng
    .bind(50.0)                  // max_distance
    .fetch_all(&self.pool)
    .await
```

**4. PostgreSQL exécute `search_products_with_scheduling()`** :

Pour chaque produit dans la base de données :

```sql
-- Produit 1 : Pharmacie
{
  "type": "pharmacie",
  "nom": "Pharmacie Centrale",
  "joursGarde": "Lundi, Mercredi, Vendredi"
}

-- PostgreSQL détecte : type = 'pharmacie'
-- PostgreSQL appelle : is_pharmacy_on_duty(product, NOW())
-- Résultat : TRUE (si c'est un jour de garde)
```

```sql
-- Produit 2 : Hôpital
{
  "type": "hopital_clinique",
  "nom": "Hôpital Central",
  "planningHebdomadaire": {...}
}

-- PostgreSQL détecte : type = 'hopital_clinique'
-- PostgreSQL appelle : is_medical_service_available(product, NOW(), search_query)
-- Résultat : TRUE (si le service est disponible)
```

```sql
-- Produit 3 : Automobile
{
  "type": "automobile",
  "nom": "Toyota Corolla"
}

-- PostgreSQL détecte : type = 'automobile' (pas pharmacie ni hôpital)
-- PostgreSQL n'appelle aucune fonction spéciale
-- Résultat : TRUE (toujours disponible)
```

**5. PostgreSQL retourne les résultats** :
```json
[
  {
    "service_id": 123,
    "product_data": {...},
    "is_available_now": true,
    "availability_info": "Pharmacie de garde disponible maintenant"
  },
  {
    "service_id": 456,
    "product_data": {...},
    "is_available_now": false,
    "availability_info": "Pharmacie fermée - Garde: Lundi, Mercredi"
  }
]
```

**6. Code Rust reçoit les résultats** :
```rust
// Le code Rust reçoit simplement les résultats, sans savoir quelle fonction a été appelée !
let results: Vec<SchedulingSearchResult> = rows
    .into_iter()
    .map(|row| SchedulingSearchResult {
        service_id: row.get("service_id"),
        is_available_now: row.get("is_available_now"),  // Déjà calculé par PostgreSQL !
        availability_info: row.get("availability_info"),  // Déjà calculé par PostgreSQL !
        ...
    })
    .collect();
```

---

## 🎯 Avantages de Cette Approche

### 1. **Séparation des Responsabilités**

- **Rust** : Gère la logique métier, les routes, l'API
- **PostgreSQL** : Gère la détection de type et l'appel de la bonne fonction

### 2. **Performance**

- La détection se fait **dans la base de données**, pas dans le code Rust
- Pas besoin de récupérer tous les produits puis filtrer en Rust
- PostgreSQL optimise automatiquement les requêtes

### 3. **Maintenabilité**

- Si on ajoute un nouveau type (ex: `veterinaire`), on ajoute juste une ligne dans le CASE
- Pas besoin de modifier le code Rust

### 4. **Flexibilité**

- Le même endpoint peut gérer plusieurs types de produits
- Le code Rust reste simple et générique

---

## 📝 Résumé

| Étape | Qui fait quoi | Où |
|-------|---------------|-----|
| **Détection du type** | PostgreSQL | Dans `search_products_with_scheduling()` |
| **Appel de la fonction** | PostgreSQL | CASE statement avec `product->>'type'` |
| **Calcul de disponibilité** | PostgreSQL | `is_pharmacy_on_duty()` ou `is_medical_service_available()` |
| **Récupération des résultats** | Rust | `sqlx::query()` |
| **Retour à l'utilisateur** | Rust | Via l'API REST |

**Le code Rust ne sait jamais quelle fonction a été appelée !** Il reçoit juste les résultats avec `is_available_now` déjà calculé. ✅

---

## 🔧 Pour Ajouter un Nouveau Type

Si vous voulez ajouter un nouveau type (ex: `veterinaire`), il suffit de :

1. **Créer la fonction** :
```sql
CREATE OR REPLACE FUNCTION is_veterinary_available(...)
RETURNS BOOLEAN AS $$ ... $$;
```

2. **Ajouter dans le CASE** :
```sql
CASE 
    WHEN product->>'type' = 'pharmacie' THEN
        is_pharmacy_on_duty(product, search_time)
    WHEN product->>'type' = 'hopital_clinique' THEN
        is_medical_service_available(product, search_time, search_query)
    WHEN product->>'type' = 'veterinaire' THEN  -- ✅ NOUVEAU
        is_veterinary_available(product, search_time)
    ELSE TRUE
END
```

**Aucune modification du code Rust nécessaire !** 🎉

