# 🔬 ANALYSE COMPLÈTE : Migrations SQL manquantes dans auto_migrate.rs

## 📊 MÉTHODOLOGIE

1. ✅ Lister toutes les migrations SQL (80 fichiers)
2. ✅ Identifier les tables créées dans chaque migration
3. ✅ Rechercher l'utilisation de ces tables dans le code Rust
4. ✅ Comparer avec les migrations auto existantes
5. ✅ Prioriser selon l'utilisation réelle

---

## 🔴 TABLES CRITIQUES UTILISÉES mais NON dans auto_migrate.rs

### 1. **search_history** - TRÈS CRITIQUE (8 requêtes SQL)
**Fichier**: `20251031_002_create_search_history.sql`  
**Usage**: `backend/src/services/search_history_service.rs`  
**Requêtes trouvées**: 8 SELECT/INSERT  
**Risque**: ❌ ERREUR si table manquante → Recherches ne sont pas historisées

```sql
CREATE TABLE IF NOT EXISTS search_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    search_type VARCHAR(50),
    results_count INTEGER,
    clicked_result_id INTEGER,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Action requise**: ✅ AJOUTER à auto_migrate.rs

---

### 2. **signalements + sanctions_historique** - CRITIQUE (3 requêtes)
**Fichier**: `20251020_add_signalement_system.sql`  
**Usage**: `backend/src/controllers/signalement_controller.rs`  
**Requêtes trouvées**: 3 SELECT/INSERT  
**Risque**: ❌ ERREUR si tables manquantes → Signalements ne fonctionnent pas

```sql
CREATE TABLE IF NOT EXISTS signalements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    service_id INTEGER,
    product_id TEXT,
    type_signalement VARCHAR(50) NOT NULL,
    statut VARCHAR(20) DEFAULT 'en_attente',
    ...
);

CREATE TABLE IF NOT EXISTS sanctions_historique (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL,
    type_sanction VARCHAR(50) NOT NULL,
    ...
);
```

**Action requise**: ✅ AJOUTER à auto_migrate.rs

---

### 3. **alerts** - CRITIQUE (2 requêtes)
**Fichier**: `20250601_create_alerts.sql`  
**Usage**: `backend/src/services/alert_service.rs`, `backend/src/core/alerts.rs`  
**Requêtes trouvées**: 2 SELECT/INSERT  
**Risque**: ❌ ERREUR si table manquante → Alertes ne fonctionnent pas

```sql
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    alert_type VARCHAR(32) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    ...
);
```

**Action requise**: ✅ AJOUTER à auto_migrate.rs

---

### 4. **private_conversations** - CRITIQUE (2 requêtes)
**Fichier**: `20251104_005_add_private_conversations.sql`  
**Usage**: `backend/src/controllers/conversation_controller.rs`  
**Requêtes trouvées**: 2 SELECT/INSERT  
**Risque**: ❌ ERREUR si table manquante → Conversations privées 1-to-1 ne marchent pas

```sql
CREATE TABLE IF NOT EXISTS private_conversations (
    id SERIAL PRIMARY KEY,
    user_1_id INTEGER NOT NULL,
    user_2_id INTEGER NOT NULL,
    context TEXT,
    last_message_at TIMESTAMPTZ,
    UNIQUE(user_1_id, user_2_id)
);
```

**Action requise**: ✅ AJOUTER à auto_migrate.rs

---

### 5. **bus_reservations** - CRITIQUE (si module bus actif)
**Fichier**: `20250125_create_bus_reservations.sql`  
**Usage**: `backend/src/routes/bus_reservations.rs`  
**Risque**: ❌ ERREUR si table manquante → Réservations bus plantent

**AUSSI** : Ajoute colonnes dans table `products` :
- `bus_configuration JSONB`
- `seat_map JSONB`
- `total_seats INTEGER`
- `numero_bus VARCHAR(50)`
- `logo_agence TEXT`
- `conditions_voyage TEXT`

**Action requise**: ✅ AJOUTER à auto_migrate.rs

---

## 🟡 TABLES MOYENNEMENT CRITIQUES

### 6. **service_embeddings** - IA/Recherche sémantique
**Fichier**: `20250610_create_service_embeddings.sql`  
**Usage**: Probablement utilisé pour recherche vectorielle  
**Action**: ⚠️ VÉRIFIER utilisation

### 7. **image_analyses** - IA/Analyse d'image
**Fichier**: `20251026_create_image_analyses_table.sql`  
**Usage**: Probablement utilisé pour détection produits dans images  
**Action**: ⚠️ VÉRIFIER utilisation

### 8. Tables de modèles (phone_models, vehicle_models, etc.)
**Fichiers**: 
- `20251025_create_phone_models.sql`
- `20251025_create_vehicle_models.sql`
- `20251025_create_appliance_models.sql`
- `20251025_create_health_structures.sql`

**Usage**: Controllers et routes existent  
**Risque**: Modéré - Catalogues de référence  
**Action**: ⚠️ VÉRIFIER utilisation

---

## 🟢 MIGRATIONS DE CORRECTION/OPTIMISATION (Probablement OK)

Ces migrations ajoutent des colonnes/index mais ne sont pas strictement nécessaires au démarrage :

- `20250830_001_add_native_search_indexes.sql` - Index uniquement
- `20250830_003_optimize_indexes.sql` - Optimisation
- `20251031_fix_index_size_limit.sql` - Fix d'index
- `20250901_add_unaccent_extension.sql` - Extension PostgreSQL
- `20251101_001_fix_visibility_functions.sql` - Fix de fonction
- etc.

**Action**: ⏳ Basse priorité

---

## 📋 PLAN D'ACTION

### Phase 1 : URGENT (Tables avec requêtes actives)
1. ✅ `search_history` (8 requêtes)
2. ✅ `signalements` + `sanctions_historique` (3 requêtes)
3. ✅ `alerts` (2 requêtes)
4. ✅ `private_conversations` (2 requêtes)
5. ✅ `bus_reservations` + colonnes products

### Phase 2 : IMPORTANT (Tables référencées mais usage à vérifier)
6. ⚠️ `service_embeddings`
7. ⚠️ `image_analyses`
8. ⚠️ Tables de modèles (phone, vehicle, appliance, health)

### Phase 3 : OPTIMISATION (Index, fonctions, extensions)
9. ⏳ Migrations d'index et optimisations
10. ⏳ Extensions PostgreSQL (unaccent, postgis)

---

## 🎯 PROCHAINES ÉTAPES

**EN COURS** : Ajout des 5 tables critiques à auto_migrate.rs...

