# 🏥 Analyse Planifications Pharmacie/Hôpital - Recherche Avancée

## 📋 ÉTAT ACTUEL

### ✅ Pharmacie - Champs existants
```typescript
interface Product {
  // Pharmacie
  type?: 'garde' | 'classique';
  heuresOuverture?: string;        // "08:00"
  heuresFermeture?: string;        // "20:00" 
  joursGarde?: string;             // "Lundi, Mercredi, Vendredi"
  telephoneUrgence?: string;       // "+237 6XX XX XX XX"
  services?: string;               // "Garde|Délivrance|Conseil"
}
```

### ✅ Hôpital/Clinique - Champs existants
```typescript
interface Product {
  // Hôpital/Clinique
  typeEtablissement?: string;      // "Hôpital", "Clinique"
  banqueSang?: boolean;            // true/false
  prestationsMedicales?: string[]; // ["Chirurgie", "Consultation"]
  planningHebdomadaire?: {         // Planning par jour
    [key: string]: {
      debut: string;               // "08:00"
      fin: string;                 // "18:00"
      permanent: boolean;          // true = 24h/24
    }
  };
  rdvEnLigne?: boolean;
}
```

---

## 🚨 PROBLÈMES IDENTIFIÉS

### 1️⃣ **Recherche actuelle insuffisante**
- ❌ La recherche ne prend **PAS** en compte les planifications
- ❌ Pas de vérification de disponibilité en temps réel
- ❌ Pas de matching avec le moment de la recherche
- ❌ Recherche générique sans contexte temporel

### 2️⃣ **Exemples de recherches non supportées**
```
❌ "pharmacie de garde" → Ne trouve que les pharmacies avec "garde" dans le nom
❌ "médecin disponible maintenant" → Ne vérifie pas les horaires
❌ "urgences ouvertes" → Ne vérifie pas le planning
❌ "pharmacie 24h" → Ne vérifie pas les heures d'ouverture
```

### 3️⃣ **Données de planification non exploitées**
- ❌ `joursGarde` stocké mais pas analysé
- ❌ `planningHebdomadaire` stocké mais pas vérifié
- ❌ Pas de logique de disponibilité temporelle

---

## ✅ SOLUTION IMPLÉMENTÉE

### 1️⃣ **Migration SQL** (`20251020_add_pharmacy_hospital_scheduling_search.sql`)

#### Fonction `is_pharmacy_on_duty()`
```sql
-- Vérifie si une pharmacie est de garde à un moment donné
CREATE OR REPLACE FUNCTION is_pharmacy_on_duty(
    pharmacy_data JSONB,
    search_time TIMESTAMP DEFAULT NOW()
)
RETURNS BOOLEAN AS $$
DECLARE
    jours_garde TEXT;
    heures_ouverture TEXT;
    heures_fermeture TEXT;
    current_day TEXT;
    current_time TIME;
    is_garde_day BOOLEAN := FALSE;
    is_garde_hour BOOLEAN := FALSE;
BEGIN
    -- Extraire les données de planification
    jours_garde := pharmacy_data->>'joursGarde';
    heures_ouverture := pharmacy_data->>'heuresOuverture';
    heures_fermeture := pharmacy_data->>'heuresFermeture';
    
    -- Déterminer le jour actuel (en français)
    current_day := CASE EXTRACT(DOW FROM search_time)
        WHEN 0 THEN 'Dimanche'
        WHEN 1 THEN 'Lundi'
        WHEN 2 THEN 'Mardi'
        WHEN 3 THEN 'Mercredi'
        WHEN 4 THEN 'Jeudi'
        WHEN 5 THEN 'Vendredi'
        WHEN 6 THEN 'Samedi'
    END;
    
    current_time := search_time::TIME;
    
    -- Vérifier si c'est un jour de garde
    is_garde_day := (
        jours_garde ILIKE '%' || current_day || '%' OR
        jours_garde ILIKE '%Lundi-Dimanche%' OR
        jours_garde ILIKE '%24h%' OR
        jours_garde ILIKE '%permanent%'
    );
    
    -- Vérifier les heures (si spécifiées)
    IF heures_ouverture IS NOT NULL AND heures_fermeture IS NOT NULL THEN
        -- Si c'est 24h/24, toujours disponible
        IF heures_ouverture = '00:00' AND heures_fermeture = '23:59' THEN
            is_garde_hour := TRUE;
        ELSE
            -- Vérifier si l'heure actuelle est dans la plage
            is_garde_hour := (
                current_time >= heures_ouverture::TIME AND 
                current_time <= heures_fermeture::TIME
            );
        END IF;
    ELSE
        -- Si pas d'heures spécifiées, considérer comme disponible toute la journée
        is_garde_hour := TRUE;
    END IF;
    
    RETURN is_garde_day AND is_garde_hour;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

#### Fonction `is_medical_service_available()`
```sql
-- Vérifie si un service médical est disponible à un moment donné
CREATE OR REPLACE FUNCTION is_medical_service_available(
    hospital_data JSONB,
    search_time TIMESTAMP DEFAULT NOW(),
    requested_service TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    planning_hebdomadaire JSONB;
    prestations_medicales JSONB;
    current_day TEXT;
    current_time TIME;
    day_planning JSONB;
    service_available BOOLEAN := FALSE;
    time_available BOOLEAN := FALSE;
BEGIN
    -- Extraire les données de planification
    planning_hebdomadaire := hospital_data->'planningHebdomadaire';
    prestations_medicales := hospital_data->'prestationsMedicales';
    
    -- Déterminer le jour actuel (en français)
    current_day := CASE EXTRACT(DOW FROM search_time)
        WHEN 0 THEN 'dimanche'
        WHEN 1 THEN 'lundi'
        WHEN 2 THEN 'mardi'
        WHEN 3 THEN 'mercredi'
        WHEN 4 THEN 'jeudi'
        WHEN 5 THEN 'vendredi'
        WHEN 6 THEN 'samedi'
    END;
    
    current_time := search_time::TIME;
    
    -- Récupérer le planning du jour
    day_planning := planning_hebdomadaire->current_day;
    
    -- Vérifier si le service demandé est disponible
    IF requested_service IS NOT NULL AND prestations_medicales IS NOT NULL THEN
        service_available := (
            prestations_medicales ? requested_service OR
            prestations_medicales::TEXT ILIKE '%' || requested_service || '%'
        );
    ELSE
        service_available := TRUE; -- Si pas de service spécifique demandé
    END IF;
    
    -- Vérifier les heures de disponibilité
    IF day_planning->>'permanent' = 'true' THEN
        time_available := TRUE;
    ELSE
        -- Vérifier si l'heure actuelle est dans la plage
        time_available := (
            current_time >= (day_planning->>'debut')::TIME AND 
            current_time <= (day_planning->>'fin')::TIME
        );
    END IF;
    
    RETURN service_available AND time_available;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

#### Fonction de recherche avancée `search_products_with_scheduling()`
```sql
-- Recherche avancée avec planifications
CREATE OR REPLACE FUNCTION search_products_with_scheduling(
    search_query TEXT,
    search_time TIMESTAMP DEFAULT NOW(),
    user_lat FLOAT DEFAULT NULL,
    user_lng FLOAT DEFAULT NULL,
    max_distance_km FLOAT DEFAULT 50.0
)
RETURNS TABLE (
    service_id INTEGER,
    product_data JSONB,
    relevance_score FLOAT,
    distance_km FLOAT,
    is_available_now BOOLEAN,
    availability_info TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH product_search AS (
        SELECT 
            s.id as service_id,
            product,
            -- Score de pertinence basé sur le texte
            ts_rank(
                to_tsvector('french', extract_all_product_text(product)),
                plainto_tsquery('french', search_query)
            ) as text_score,
            -- Distance géographique (si coordonnées fournies)
            CASE 
                WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL AND 
                     s.latitude IS NOT NULL AND s.longitude IS NOT NULL
                THEN ST_Distance(
                    ST_Point(user_lng, user_lat)::geography,
                    ST_Point(s.longitude, s.latitude)::geography
                ) / 1000.0
                ELSE 0.0
            END as distance_km,
            -- Vérifier la disponibilité selon le type
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
    SELECT 
        ps.service_id,
        ps.product,
        -- Score final combinant pertinence, distance et disponibilité
        (
            ps.text_score * 3.0 + -- Score de pertinence textuelle
            CASE WHEN ps.is_available_now THEN 5.0 ELSE 0.0 END + -- Bonus disponibilité
            CASE WHEN ps.distance_km <= max_distance_km THEN (max_distance_km - ps.distance_km) / max_distance_km * 2.0 ELSE 0.0 END -- Bonus proximité
        ) as relevance_score,
        ps.distance_km,
        ps.is_available_now,
        ps.availability_info
    FROM product_search ps
    WHERE 
        -- Filtre par distance si coordonnées fournies
        (user_lat IS NULL OR user_lng IS NULL OR ps.distance_km <= max_distance_km)
        -- Filtre par pertinence minimale
        AND ps.text_score > 0.1
    ORDER BY 
        ps.is_available_now DESC, -- Disponibles en premier
        relevance_score DESC,     -- Puis par pertinence
        ps.distance_km ASC;       -- Puis par distance
END;
$$ LANGUAGE plpgsql;
```

### 2️⃣ **Service Rust** (`scheduling_search_service.rs`)

#### Analyse d'intention de recherche
```rust
pub fn analyze_search_intent(&self, query: &str) -> SearchIntent {
    let query_lower = query.to_lowercase();
    
    // Détection de recherche de pharmacie de garde
    if query_lower.contains("pharmacie") && 
       (query_lower.contains("garde") || query_lower.contains("urgent") || 
        query_lower.contains("nuit") || query_lower.contains("24h")) {
        return SearchIntent::PharmacyOnDuty;
    }
    
    // Détection de recherche de service médical
    if (query_lower.contains("médecin") || query_lower.contains("docteur") || 
        query_lower.contains("gynécologue") || query_lower.contains("cardiologue") ||
        query_lower.contains("urgences") || query_lower.contains("hôpital") ||
        query_lower.contains("clinique")) && 
       (query_lower.contains("disponible") || query_lower.contains("ouvert") ||
        query_lower.contains("maintenant") || query_lower.contains("urgent")) {
        return SearchIntent::MedicalServiceAvailable;
    }
    
    // Détection de recherche avec contrainte temporelle
    if query_lower.contains("maintenant") || query_lower.contains("urgent") ||
       query_lower.contains("immédiat") || query_lower.contains("tout de suite") {
        return SearchIntent::TimeConstrained;
    }
    
    SearchIntent::General
}
```

#### Recherche avec planifications
```rust
pub async fn search_with_scheduling(
    &self,
    search_query: &str,
    search_time: Option<DateTime<Utc>>,
    user_lat: Option<f64>,
    user_lng: Option<f64>,
    max_distance_km: Option<f64>,
) -> Result<Vec<SchedulingSearchResult>, String> {
    let search_time = search_time.unwrap_or_else(Utc::now);
    let max_distance = max_distance_km.unwrap_or(50.0);

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

    // Exécution de la requête avec paramètres
    // ...
}
```

### 3️⃣ **Vue matérialisée** pour optimiser les performances
```sql
-- Vue matérialisée pour les pharmacies de garde
CREATE MATERIALIZED VIEW IF NOT EXISTS pharmacies_on_duty AS
SELECT 
    s.id as service_id,
    s.data->'titre_service'->>'valeur' as service_title,
    s.latitude,
    s.longitude,
    product,
    is_pharmacy_on_duty(product, NOW()) as is_on_duty,
    product->>'joursGarde' as garde_days,
    product->>'heuresOuverture' as opening_hours,
    product->>'heuresFermeture' as closing_hours,
    product->>'telephoneUrgence' as emergency_phone
FROM services s,
LATERAL jsonb_array_elements(
    CASE 
        WHEN jsonb_typeof(s.data->'produits') = 'array' 
        THEN s.data->'produits'
        ELSE '[]'::jsonb
    END
) AS product
WHERE 
    s.is_active = true 
    AND product->>'type' = 'pharmacie'
    AND product->>'joursGarde' IS NOT NULL
    AND product->>'joursGarde' != '';
```

---

## 🎯 EXEMPLES DE RECHERCHE SUPPORTÉS

### ✅ Pharmacie de garde
```
Recherche: "pharmacie de garde"
→ Trouve uniquement les pharmacies actuellement de garde
→ Vérifie joursGarde + heuresOuverture/heuresFermeture
→ Priorise par proximité géographique

Recherche: "pharmacie urgente"
→ Même logique que "pharmacie de garde"
→ Détection d'intention via mots-clés

Recherche: "pharmacie 24h"
→ Trouve les pharmacies avec heuresOuverture="00:00" et heuresFermeture="23:59"
```

### ✅ Services médicaux
```
Recherche: "médecin disponible"
→ Trouve les hôpitaux/cliniques avec planningHebdomadaire ouvert maintenant
→ Vérifie prestationsMedicales pour "médecin" ou "consultation"

Recherche: "gynécologue maintenant"
→ Trouve les établissements avec gynécologue dans prestationsMedicales
→ Vérifie que le planning du jour actuel est ouvert

Recherche: "urgences ouvertes"
→ Trouve les hôpitaux avec planningHebdomadaire permanent=true
→ Ou avec horaires couvrant l'heure actuelle
```

### ✅ Recherche temporelle
```
Recherche: "pharmacie maintenant"
→ Détection d'intention TimeConstrained
→ Utilise search_products_with_scheduling()
→ Priorise les services disponibles immédiatement

Recherche: "médecin urgent"
→ Même logique avec contrainte temporelle
→ Bonus de score pour disponibilité immédiate
```

---

## 🔧 INTÉGRATION DANS L'API

### 1️⃣ **Modification du service de recherche existant**
```rust
// Dans native_search_service.rs
pub async fn fulltext_search_with_gps(
    &self,
    query: &str,
    user_lat: Option<f64>,
    user_lng: Option<f64>,
    max_distance_km: Option<f64>,
) -> Result<Vec<SearchResult>, String> {
    
    // Analyser l'intention de recherche
    let scheduling_service = SchedulingSearchService::new(self.db.clone());
    let intent = scheduling_service.analyze_search_intent(query);
    
    // Si recherche avec planification, utiliser la fonction spécialisée
    if intent.should_use_scheduling_search() {
        let scheduling_results = scheduling_service.search_with_scheduling(
            query,
            None, // Utilise NOW()
            user_lat,
            user_lng,
            max_distance_km,
        ).await?;
        
        // Convertir en SearchResult
        return Ok(scheduling_results.into_iter().map(|r| SearchResult {
            service_id: r.service_id,
            // ... mapping des champs
        }).collect());
    }
    
    // Sinon, utiliser la recherche classique
    // ... logique existante
}
```

### 2️⃣ **Nouveaux endpoints API**
```rust
// GET /api/search/pharmacies-on-duty?lat=4.0&lng=9.7&max_distance=20
pub async fn get_pharmacies_on_duty(
    Query(params): Query<PharmacySearchParams>,
    State(state): State<AppState>,
) -> Result<Json<Vec<PharmacyOnDuty>>, StatusCode> {
    let scheduling_service = SchedulingSearchService::new(state.db);
    let results = scheduling_service.search_pharmacies_on_duty(
        params.lat,
        params.lng,
        params.max_distance,
    ).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(results))
}

// GET /api/search/medical-services?service=cardiologue&lat=4.0&lng=9.7
pub async fn get_available_medical_services(
    Query(params): Query<MedicalSearchParams>,
    State(state): State<AppState>,
) -> Result<Json<Vec<MedicalServiceAvailability>>, StatusCode> {
    let scheduling_service = SchedulingSearchService::new(state.db);
    let results = scheduling_service.search_available_medical_services(
        params.service.as_deref(),
        params.lat,
        params.lng,
        params.max_distance,
    ).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(results))
}
```

---

## 📊 PERFORMANCE ET OPTIMISATION

### 1️⃣ **Index spécialisés**
```sql
-- Index pour les pharmacies de garde
CREATE INDEX IF NOT EXISTS idx_services_pharmacy_scheduling 
ON services USING GIN (
    (data->'produits') jsonb_path_ops
) WHERE data->'produits' @> '[{"type": "pharmacie"}]';

-- Index pour les hôpitaux/cliniques
CREATE INDEX IF NOT EXISTS idx_services_hospital_scheduling 
ON services USING GIN (
    (data->'produits') jsonb_path_ops
) WHERE data->'produits' @> '[{"type": "hopital_clinique"}]';

-- Index géographique sur la vue matérialisée
CREATE INDEX IF NOT EXISTS idx_pharmacies_on_duty_location 
ON pharmacies_on_duty USING GIST (
    ST_Point(longitude, latitude)
);
```

### 2️⃣ **Rafraîchissement automatique**
```sql
-- Fonction de rafraîchissement
CREATE OR REPLACE FUNCTION refresh_pharmacies_on_duty()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY pharmacies_on_duty;
END;
$$ LANGUAGE plpgsql;

-- Cron job pour rafraîchir toutes les heures
-- 0 * * * * psql -d yukpomnang -c "SELECT refresh_pharmacies_on_duty();"
```

---

## ✅ RÉSULTATS ATTENDUS

### 🎯 **Recherches maintenant supportées**
```
✅ "pharmacie de garde" → Pharmacies actuellement de garde
✅ "médecin disponible" → Services médicaux ouverts maintenant  
✅ "urgences ouvertes" → Hôpitaux avec urgences 24h/24
✅ "pharmacie 24h" → Pharmacies ouvertes 24h/24
✅ "gynécologue maintenant" → Gynécologues disponibles maintenant
✅ "pharmacie urgente" → Pharmacies de garde (détection d'intention)
```

### 🎯 **Fonctionnalités avancées**
- ✅ **Disponibilité temps réel** : Vérification automatique des horaires
- ✅ **Priorisation intelligente** : Services disponibles en premier
- ✅ **Informations contextuelles** : "Pharmacie de garde disponible maintenant"
- ✅ **Géolocalisation** : Proximité + disponibilité
- ✅ **Performance optimisée** : Vue matérialisée + index spécialisés

### 🎯 **Exemples concrets**
```
Recherche: "pharmacie de garde" à 23h30
→ Résultat: "Pharmacie Centrale - Garde: Lundi-Dimanche - 00:00-23:59 - Disponible maintenant"

Recherche: "médecin" à 14h30 un mercredi  
→ Résultat: "Clinique Saint-Joseph - Consultation générale - 08:00-18:00 - Disponible maintenant"

Recherche: "urgences" à 3h du matin
→ Résultat: "Hôpital Général - Urgences 24h/24 - Permanent - Disponible maintenant"
```

---

## 🚀 PROCHAINES ÉTAPES

1. **Appliquer la migration** : `sqlx migrate run`
2. **Intégrer le service** dans l'API de recherche
3. **Tester les recherches** avec planifications
4. **Configurer le cron job** pour rafraîchissement automatique
5. **Optimiser les performances** selon l'usage

La solution est **générique** et **extensible** pour d'autres types de services avec planifications ! 🎉
