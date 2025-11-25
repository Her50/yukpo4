# 📋 Explication des Fonctions de Planification

## 🎯 Vue d'Ensemble

Ces deux fonctions permettent de vérifier si une **pharmacie** ou un **service médical** est **disponible maintenant** en analysant leurs données de planification stockées en JSONB.

---

## 1️⃣ `is_pharmacy_on_duty()` - Pharmacie de Garde

### 📝 Signature

```sql
is_pharmacy_on_duty(
    pharmacy_data JSONB,        -- Données JSONB du produit pharmacie
    search_time TIMESTAMPTZ DEFAULT NOW()  -- Moment à vérifier (par défaut: maintenant)
)
RETURNS BOOLEAN  -- TRUE si la pharmacie est de garde, FALSE sinon
```

### 🔍 Comment ça fonctionne

#### Étape 1 : Extraction des données

La fonction extrait 3 champs du JSONB `pharmacy_data` :

```json
{
  "joursGarde": "Lundi, Mercredi, Vendredi",
  "heuresOuverture": "08:00",
  "heuresFermeture": "20:00"
}
```

```sql
jours_garde := pharmacy_data->>'joursGarde';        -- "Lundi, Mercredi, Vendredi"
heures_ouverture := pharmacy_data->>'heuresOuverture'; -- "08:00"
heures_fermeture := pharmacy_data->>'heuresFermeture'; -- "20:00"
```

#### Étape 2 : Vérification des données

Si `joursGarde` est vide ou NULL → **RETURN FALSE** (pas de garde)

#### Étape 3 : Détermination du jour actuel

Convertit le jour de la semaine en français :

```sql
current_day := CASE EXTRACT(DOW FROM search_time)
    WHEN 0 THEN 'Dimanche'
    WHEN 1 THEN 'Lundi'
    WHEN 2 THEN 'Mardi'
    WHEN 3 THEN 'Mercredi'
    WHEN 4 THEN 'Jeudi'
    WHEN 5 THEN 'Vendredi'
    WHEN 6 THEN 'Samedi'
END;
```

**Exemple** : Si `search_time = '2025-11-25 14:30:00'` (un mardi) → `current_day = 'Mardi'`

#### Étape 4 : Vérification du jour de garde

Vérifie si le jour actuel est dans les jours de garde :

```sql
is_garde_day := (
    jours_garde ILIKE '%' || current_day || '%' OR      -- Contient "Mardi"
    jours_garde ILIKE '%Lundi-Dimanche%' OR             -- Tous les jours
    jours_garde ILIKE '%24h%' OR                         -- 24h/24
    jours_garde ILIKE '%permanent%'                      -- Permanent
);
```

**Exemples** :
- `joursGarde = "Lundi, Mardi, Mercredi"` + `current_day = "Mardi"` → ✅ **TRUE**
- `joursGarde = "Lundi-Dimanche"` → ✅ **TRUE** (tous les jours)
- `joursGarde = "Samedi, Dimanche"` + `current_day = "Mardi"` → ❌ **FALSE**

Si `is_garde_day = FALSE` → **RETURN FALSE**

#### Étape 5 : Vérification des heures

Si les heures sont spécifiées :

```sql
IF heures_ouverture IS NOT NULL AND heures_fermeture IS NOT NULL THEN
    -- Cas spécial : 24h/24
    IF heures_ouverture = '00:00' AND heures_fermeture = '23:59' THEN
        is_garde_hour := TRUE;
    ELSE
        -- Vérifier si l'heure actuelle est dans la plage
        is_garde_hour := (
            v_current_time >= heures_ouverture::TIME AND 
            v_current_time <= heures_fermeture::TIME
        );
    END IF;
ELSE
    -- Pas d'heures spécifiées = disponible toute la journée
    is_garde_hour := TRUE;
END IF;
```

**Exemples** :
- `heuresOuverture = "08:00"`, `heuresFermeture = "20:00"`, `current_time = "14:30"` → ✅ **TRUE** (14:30 est entre 08:00 et 20:00)
- `heuresOuverture = "08:00"`, `heuresFermeture = "20:00"`, `current_time = "22:00"` → ❌ **FALSE** (22:00 est après 20:00)
- `heuresOuverture = "00:00"`, `heuresFermeture = "23:59"` → ✅ **TRUE** (24h/24)

#### Étape 6 : Résultat final

```sql
RETURN is_garde_day AND is_garde_hour;
```

**La pharmacie est de garde SI ET SEULEMENT SI** :
- ✅ C'est un jour de garde **ET**
- ✅ C'est dans les heures d'ouverture

---

### 📊 Exemple Complet

**Données de la pharmacie** :
```json
{
  "type": "pharmacie",
  "nom": "Pharmacie Centrale",
  "joursGarde": "Lundi, Mercredi, Vendredi, Dimanche",
  "heuresOuverture": "08:00",
  "heuresFermeture": "22:00",
  "telephoneUrgence": "+237 6XX XXX XXX"
}
```

**Scénario 1** : Mardi 14:30
- `current_day = "Mardi"` → ❌ Pas dans `joursGarde` → **RETURN FALSE**

**Scénario 2** : Mercredi 14:30
- `current_day = "Mercredi"` → ✅ Dans `joursGarde`
- `14:30` entre `08:00` et `22:00` → ✅ Dans les heures
- **RETURN TRUE** ✅

**Scénario 3** : Mercredi 23:00
- `current_day = "Mercredi"` → ✅ Dans `joursGarde`
- `23:00` après `22:00` → ❌ Hors heures
- **RETURN FALSE** ❌

---

## 2️⃣ `is_medical_service_available()` - Service Médical

### 📝 Signature

```sql
is_medical_service_available(
    hospital_data JSONB,                    -- Données JSONB du produit hôpital/clinique
    search_time TIMESTAMPTZ DEFAULT NOW(),  -- Moment à vérifier
    requested_service TEXT DEFAULT NULL     -- Service médical demandé (optionnel)
)
RETURNS BOOLEAN  -- TRUE si le service est disponible, FALSE sinon
```

### 🔍 Comment ça fonctionne

#### Étape 1 : Extraction des données

La fonction extrait 2 champs du JSONB `hospital_data` :

```json
{
  "planningHebdomadaire": {
    "lundi": { "debut": "08:00", "fin": "18:00", "permanent": false },
    "mardi": { "debut": "08:00", "fin": "18:00", "permanent": false },
    "mercredi": { "permanent": true },
    "jeudi": { "debut": "08:00", "fin": "18:00", "permanent": false },
    "vendredi": { "debut": "08:00", "fin": "18:00", "permanent": false },
    "samedi": { "debut": "09:00", "fin": "13:00", "permanent": false },
    "dimanche": null
  },
  "prestationsMedicales": {
    "consultation_generale": true,
    "urgences": true,
    "radiologie": true,
    "laboratoire": true
  }
}
```

```sql
planning_hebdomadaire := hospital_data->'planningHebdomadaire';
prestations_medicales := hospital_data->'prestationsMedicales';
```

#### Étape 2 : Vérification du planning

Si `planningHebdomadaire` est NULL → **RETURN FALSE**

#### Étape 3 : Détermination du jour actuel

Convertit le jour en français (minuscules) :

```sql
current_day := CASE EXTRACT(DOW FROM search_time)
    WHEN 0 THEN 'dimanche'
    WHEN 1 THEN 'lundi'
    WHEN 2 THEN 'mardi'
    WHEN 3 THEN 'mercredi'
    WHEN 4 THEN 'jeudi'
    WHEN 5 THEN 'vendredi'
    WHEN 6 THEN 'samedi'
END;
```

**Exemple** : Si `search_time = '2025-11-25 14:30:00'` (un mardi) → `current_day = 'mardi'`

#### Étape 4 : Récupération du planning du jour

```sql
day_planning := planning_hebdomadaire->current_day;
```

**Exemple** : Si `current_day = 'mardi'` → `day_planning = {"debut": "08:00", "fin": "18:00", "permanent": false}`

Si `day_planning` est NULL → **RETURN FALSE** (pas de planning pour ce jour)

#### Étape 5 : Vérification du service demandé (optionnel)

Si un service spécifique est demandé :

```sql
IF requested_service IS NOT NULL AND prestations_medicales IS NOT NULL THEN
    service_available := (
        prestations_medicales ? requested_service OR              -- Clé existe
        prestations_medicales::TEXT ILIKE '%' || requested_service || '%'  -- Contient le texte
    );
ELSE
    service_available := TRUE;  -- Pas de service spécifique = tous disponibles
END IF;
```

**Exemples** :
- `requested_service = "urgences"` + `prestationsMedicales` contient `"urgences": true` → ✅ **TRUE**
- `requested_service = "chirurgie"` + `prestationsMedicales` ne contient pas `chirurgie` → ❌ **FALSE**
- `requested_service = NULL` → ✅ **TRUE** (tous les services)

#### Étape 6 : Vérification des heures

```sql
IF day_planning->>'permanent' = 'true' THEN
    time_available := TRUE;  -- 24h/24
ELSE
    -- Vérifier si l'heure actuelle est dans la plage
    time_available := (
        v_current_time >= (day_planning->>'debut')::TIME AND 
        v_current_time <= (day_planning->>'fin')::TIME
    );
END IF;
```

**Exemples** :
- `day_planning = {"permanent": true}` → ✅ **TRUE** (24h/24)
- `day_planning = {"debut": "08:00", "fin": "18:00"}` + `current_time = "14:30"` → ✅ **TRUE**
- `day_planning = {"debut": "08:00", "fin": "18:00"}` + `current_time = "20:00"` → ❌ **FALSE**

#### Étape 7 : Résultat final

```sql
RETURN service_available AND time_available;
```

**Le service médical est disponible SI ET SEULEMENT SI** :
- ✅ Le service demandé existe (ou aucun service spécifique demandé) **ET**
- ✅ C'est dans les heures d'ouverture du jour

---

### 📊 Exemple Complet

**Données de l'hôpital** :
```json
{
  "type": "hopital_clinique",
  "nom": "Hôpital Central",
  "planningHebdomadaire": {
    "lundi": { "debut": "08:00", "fin": "18:00", "permanent": false },
    "mardi": { "debut": "08:00", "fin": "18:00", "permanent": false },
    "mercredi": { "permanent": true },
    "jeudi": { "debut": "08:00", "fin": "18:00", "permanent": false },
    "vendredi": { "debut": "08:00", "fin": "18:00", "permanent": false },
    "samedi": { "debut": "09:00", "fin": "13:00", "permanent": false },
    "dimanche": null
  },
  "prestationsMedicales": {
    "consultation_generale": true,
    "urgences": true,
    "radiologie": true
  }
}
```

**Scénario 1** : Mardi 14:30, service "urgences"
- `current_day = "mardi"` → `day_planning = {"debut": "08:00", "fin": "18:00"}`
- `service_available` : "urgences" existe → ✅ **TRUE**
- `time_available` : 14:30 entre 08:00 et 18:00 → ✅ **TRUE**
- **RETURN TRUE** ✅

**Scénario 2** : Mercredi 23:00, service "urgences"
- `current_day = "mercredi"` → `day_planning = {"permanent": true}`
- `service_available` : "urgences" existe → ✅ **TRUE**
- `time_available` : permanent = true → ✅ **TRUE**
- **RETURN TRUE** ✅ (24h/24)

**Scénario 3** : Dimanche 10:00, service "urgences"
- `current_day = "dimanche"` → `day_planning = null`
- **RETURN FALSE** ❌ (pas de planning pour dimanche)

**Scénario 4** : Mardi 20:00, service "urgences"
- `current_day = "mardi"` → `day_planning = {"debut": "08:00", "fin": "18:00"}`
- `service_available` : "urgences" existe → ✅ **TRUE**
- `time_available` : 20:00 après 18:00 → ❌ **FALSE**
- **RETURN FALSE** ❌

---

## 🔄 Utilisation dans le Code

### Dans `search_products_with_scheduling()`

Ces fonctions sont utilisées pour filtrer les résultats de recherche :

```sql
CASE 
    WHEN product->>'type' = 'pharmacie' THEN
        is_pharmacy_on_duty(product, search_time)
    WHEN product->>'type' = 'hopital_clinique' THEN
        is_medical_service_available(product, search_time, search_query)
    ELSE TRUE
END as is_available_now
```

**Résultat** : Seuls les services **disponibles maintenant** sont retournés avec `is_available_now = TRUE`.

### Dans `scheduling_search_service.rs`

```rust
// Recherche de pharmacies de garde
let results = scheduling_service
    .search_pharmacies_on_duty(user_lat, user_lng, max_distance)
    .await?;

// Recherche de services médicaux disponibles
let results = scheduling_service
    .search_medical_services_available(
        Some("urgences"),
        user_lat,
        user_lng,
        max_distance
    )
    .await?;
```

---

## ⚡ Performance

### Caractéristiques

- **`IMMUTABLE`** : Les fonctions sont marquées comme immutables, ce qui permet à PostgreSQL de les mettre en cache
- **Index GIN** : Des index GIN sont créés sur `data->'produits'` pour accélérer les recherches
- **Vue matérialisée** : `pharmacies_on_duty` est une vue matérialisée mise à jour périodiquement

### Optimisations

1. **Vue matérialisée** : Les pharmacies de garde sont pré-calculées dans `pharmacies_on_duty`
2. **Index partiels** : Index sur les produits de type `pharmacie` et `hopital_clinique`
3. **Cache** : Les résultats peuvent être mis en cache côté application

---

## 📝 Résumé

| Fonction | Vérifie | Basé sur | Retourne |
|----------|---------|----------|----------|
| `is_pharmacy_on_duty()` | Pharmacie de garde | `joursGarde` + `heuresOuverture/Fermeture` | TRUE si jour ET heure OK |
| `is_medical_service_available()` | Service médical disponible | `planningHebdomadaire` + `prestationsMedicales` | TRUE si service ET planning OK |

**Les deux fonctions garantissent que seuls les services réellement disponibles maintenant sont retournés dans les résultats de recherche !** ✅

