MODÈLE DE DONNÉES & MIGRATIONS – SERVICE LIVRAISON YUKPO
===========================================================

## 1. Vue d’ensemble
Objectif : définir le schéma relationnel nécessaire au service de livraison intelligent, compatible avec PostgreSQL + SQLx (mode offline), et préparer le plan de migrations (structure + seeds).

- Base existante : PostgreSQL avec extensions `pgvector`, `imgsmlr`. Pour la géolocalisation, nous utilisons `PostGIS` (vérifier activation).  
- Les nouvelles entités couvrent : livraisons, colis, coursiers, flotte (engins/équipements), suivi temps réel, pricing, ratings.
- Convention migrations :  
  - Fichiers `backend/migrations/000X_name.sql` pour schéma.  
  - Fichiers `backend/auto_migrate/00X_seed_name.sql` pour données initiales (SQL exécuté par script `auto_migration`).  
  - SQLx offline : après ajout requêtes, exécuter `cargo sqlx prepare -- --bin backend` ou selon doc interne (`CHOIX_SQLX_OFFLINE.md`).

## 2. Tables principales

### 2.1 `parcel_types`
- `id SERIAL PRIMARY KEY`
- `slug TEXT UNIQUE NOT NULL` (ex: `fragile`, `medical`, `volumineux`)
- `display_name TEXT NOT NULL`
- `description TEXT`
- `max_weight_kg NUMERIC(6,2)` (NULL = illimité)
- `max_volume_cm3 NUMERIC(12,2)`
- `requires_isothermal BOOLEAN DEFAULT FALSE`
- `requires_fragile_handling BOOLEAN DEFAULT FALSE`
- `requires_secure_box BOOLEAN DEFAULT FALSE`
- `requires_document_protection BOOLEAN DEFAULT FALSE`
- `metadata JSONB DEFAULT '{}'::jsonb` (ex: température idéale)
- `created_at TIMESTAMPTZ DEFAULT now()`

Index : `UNIQUE(slug)`

### 2.2 `courier_applications`
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id UUID UNIQUE NOT NULL REFERENCES users(id)`
- `status delivery_application_status NOT NULL` (enum : `draft`, `submitted`, `under_review`, `approved`, `rejected`)
- `submitted_at TIMESTAMPTZ`
- `reviewed_at TIMESTAMPTZ`
- `reviewer_id UUID REFERENCES users(id)`
- `rejection_reason TEXT`
- `profile_data JSONB DEFAULT '{}'::jsonb` (infos déclarées)
- `documents JSONB DEFAULT '[]'::jsonb`
- `notes JSONB DEFAULT '[]'::jsonb` (commentaires backoffice)
- `created_at TIMESTAMPTZ DEFAULT now()`
- `updated_at TIMESTAMPTZ DEFAULT now()`

Index : `UNIQUE(user_id)`

### 2.3 `couriers`
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id UUID UNIQUE NOT NULL` (référence table `users` existante)
- `application_id UUID UNIQUE REFERENCES courier_applications(id)`
- `status delivery_courier_status NOT NULL` (enum à créer : `pending_review`, `approved`, `rejected`, `suspended`)
- `rating_average NUMERIC(3,2) DEFAULT 0`
- `rating_count INTEGER DEFAULT 0`
- `bio TEXT`
- `hired_at TIMESTAMPTZ`
- `suspended_at TIMESTAMPTZ`
- `created_at TIMESTAMPTZ DEFAULT now()`
- `updated_at TIMESTAMPTZ DEFAULT now()`

### 2.4 `courier_assets`
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE`
- `engine_type delivery_engine_type NOT NULL` (enum : `moto`, `voiture`, `camionnette`, `velo_cargo`, `scooter`, `pieton`, etc.)
- `is_primary BOOLEAN DEFAULT FALSE`
- `max_weight_kg NUMERIC(6,2)`
- `max_volume_cm3 NUMERIC(12,2)`
- `equipments JSONB DEFAULT '[]'::jsonb` (liste équipements : caisse_isotherme, sangles, coffre_secure…)
- `available BOOLEAN DEFAULT TRUE`
- `availability_schedule JSONB` (structure ex: { "monday": ["08:00-12:00", "14:00-18:00"] })
- `documents JSONB` (URLs justificatifs)
- `created_at TIMESTAMPTZ DEFAULT now()`
- `updated_at TIMESTAMPTZ DEFAULT now()`

Index : `courier_id`, `courier_id WHERE is_primary = TRUE`

### 2.5 `deliveries`
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `creator_id UUID NOT NULL REFERENCES users(id)`
- `courier_id UUID REFERENCES couriers(id)`
- `parcel_id UUID NOT NULL REFERENCES delivery_parcels(id)`
- `status delivery_status NOT NULL`
- `requested_at TIMESTAMPTZ DEFAULT now()`
- `confirmed_at TIMESTAMPTZ`
- `accepted_at TIMESTAMPTZ`
- `picked_up_at TIMESTAMPTZ`
- `delivered_at TIMESTAMPTZ`
- `completed_at TIMESTAMPTZ`
- `cancelled_at TIMESTAMPTZ`
- `cancel_reason delivery_cancel_reason`
- `pickup_location GEOGRAPHY(Point, 4326) NOT NULL`
- `dropoff_location GEOGRAPHY(Point, 4326) NOT NULL`
- `pickup_address TEXT`
- `dropoff_address TEXT`
- `distance_meters INTEGER` (trajet total)
- `estimated_duration_seconds INTEGER`
- `actual_duration_seconds INTEGER`
- `pricing_id UUID REFERENCES delivery_pricing(id)`
- `tracking_token UUID UNIQUE` (permalink suivi public)
- `metadata JSONB DEFAULT '{}'::jsonb`

Index : GIST sur `pickup_location`, `dropoff_location`; B-tree sur `(status, requested_at)`.

### 2.6 `delivery_status_events`
- `id BIGSERIAL PRIMARY KEY`
- `delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE`
- `status delivery_status NOT NULL`
- `occurred_at TIMESTAMPTZ NOT NULL`
- `payload JSONB DEFAULT '{}'::jsonb`
- `recorded_by UUID` (user ou système)

Index : `delivery_id`, `(delivery_id, occurred_at DESC)`

### 2.7 `delivery_parcels`
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `type_id INTEGER REFERENCES parcel_types(id)`
- `weight_kg NUMERIC(6,2)`
- `volume_cm3 NUMERIC(12,2)`
- `declared_value NUMERIC(10,2)`
- `notes TEXT`
- `photos JSONB DEFAULT '[]'::jsonb` (URLs)
- `constraints JSONB DEFAULT '{}'::jsonb`
- `created_at TIMESTAMPTZ DEFAULT now()`

### 2.8 `delivery_pricing`
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE`
- `base_price_cents INTEGER NOT NULL`
- `distance_price_cents INTEGER NOT NULL`
- `surcharge_cents INTEGER DEFAULT 0`
- `discount_cents INTEGER DEFAULT 0`
- `currency CHAR(3) DEFAULT 'XAF'`
- `calculated_at TIMESTAMPTZ DEFAULT now()`
- `details JSONB DEFAULT '{}'::jsonb` (breakdown : trafic, terrain, équipement)

### 2.9 `delivery_tracking_points`
- `id BIGSERIAL PRIMARY KEY`
- `delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE`
- `courier_id UUID NOT NULL REFERENCES couriers(id)`
- `captured_at TIMESTAMPTZ NOT NULL`
- `location GEOGRAPHY(Point, 4326) NOT NULL`
- `speed_kmh NUMERIC(5,2)`
- `bearing NUMERIC(6,2)`
- `accuracy_meters NUMERIC(6,2)`

Index : `delivery_id`, `courier_id`, `captured_at`; GIST sur `location`.

### 2.10 `courier_ratings`
- `id BIGSERIAL PRIMARY KEY`
- `delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE`
- `courier_id UUID NOT NULL REFERENCES couriers(id)`
- `rater_id UUID NOT NULL` (client)
- `score_small INT CHECK (score_small BETWEEN 1 AND 5)`
- `tags TEXT[]` (ex: `{"ponctuel","soin"}`)
- `comment TEXT`
- `created_at TIMESTAMPTZ DEFAULT now()`

### 2.11 `client_ratings`
- `id BIGSERIAL PRIMARY KEY`
- `delivery_id UUID UNIQUE NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE`
- `client_id UUID NOT NULL REFERENCES users(id)`
- `courier_id UUID NOT NULL REFERENCES couriers(id)`
- `score_small INT CHECK (score_small BETWEEN 1 AND 5)`
- `tags TEXT[]`
- `comment TEXT`
- `created_at TIMESTAMPTZ DEFAULT now()`

### 2.12 `traffic_snapshots`
- `id BIGSERIAL PRIMARY KEY`
- `captured_at TIMESTAMPTZ NOT NULL`
- `source TEXT` (API tiers)
- `bounding_box GEOGRAPHY(Polygon, 4326)`
- `payload JSONB NOT NULL`

### 2.13 `terrain_segments`
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `segment GEOGRAPHY(LineString, 4326) NOT NULL`
- `difficulty delivery_terrain_difficulty NOT NULL` (enum : `smooth`, `rough`, `blocked`)
- `notes TEXT`
- `metadata JSONB DEFAULT '{}'::jsonb`

## 3. Enums PostgreSQL
- `delivery_status` : `requested`, `awaiting_courier_confirmation`, `accepted`, `en_route_pickup`, `arrival_pickup`, `picked_up`, `en_route_delivery`, `arrival_destination`, `delivered`, `completed`, `cancelled`.
- `delivery_cancel_reason` : `client_cancelled`, `courier_cancelled`, `no_courier_available`, `parcel_issue`, `system_failure`.
- `delivery_engine_type` : `moto`, `scooter`, `voiture`, `camionnette`, `velo_cargo`, `pieton`, `camion_leger`, `autre`.
- `delivery_courier_status` : `pending_review`, `approved`, `rejected`, `suspended`.
- `delivery_terrain_difficulty` : `smooth`, `moderate`, `rough`, `blocked`.
- `delivery_application_status` : `draft`, `submitted`, `under_review`, `approved`, `rejected`.

## 4. Relations clés
- `courier_applications` 1 - 1 `couriers` (après validation)
- `couriers` 1 - N `courier_assets`
- `deliveries` 1 - 1 `delivery_pricing`
- `deliveries` N - 1 `couriers` (nullable tant que non assigné)
- `deliveries` 1 - 1 `delivery_parcels`
- `deliveries` 1 - N `delivery_status_events`
- `deliveries` 1 - N `delivery_tracking_points`
- `couriers` 1 - N `courier_ratings`
- `users` 1 - N `client_ratings`

## 5. Plan de migrations

### 5.1 Ordre recommandé
1. `0001_create_delivery_enums.sql`
   - Créer enums `delivery_status`, `delivery_cancel_reason`, `delivery_engine_type`, `delivery_courier_status`, `delivery_terrain_difficulty`, `delivery_application_status`.
2. `0002_create_parcel_types.sql`
   - Table `parcel_types`.
3. `0003_create_courier_applications.sql`
   - Table `courier_applications`.
4. `0004_create_couriers_and_assets.sql`
   - Tables `couriers`, `courier_assets`.
5. `0005_create_delivery_core.sql`
   - Tables `delivery_parcels`, `deliveries`, `delivery_status_events`.
6. `0006_create_pricing_tracking_ratings.sql`
   - Tables `delivery_pricing`, `delivery_tracking_points`, `courier_ratings`, `client_ratings`.
7. `0007_create_support_tables.sql`
   - Tables `traffic_snapshots`, `terrain_segments`.

Mettre à jour scripts `auto_migration.ps1` si nécessaire pour inclure nouveaux seeds.

### 5.2 Seeds (`auto_migrate`)
- `001_seed_parcel_types.sql` : insérer types de colis de base.  
  ```
  INSERT INTO parcel_types (slug, display_name, description, max_weight_kg, requires_fragile_handling)
  VALUES
    ('standard', 'Colis standard', 'Poids et dimensions classiques', 30, FALSE),
    ('fragile', 'Fragile', 'Verre, électronique, nécessite manutention douce', 20, TRUE),
    ('volumineux', 'Volumineux', 'Mobilier, gros colis', 80, FALSE),
    ('medical', 'Médical', 'Colis médicaux sensibles', 10, TRUE),
    ('document', 'Document', 'Documents importants ou confidentiels', 5, TRUE);
  ```
- `002_seed_engine_types.sql` : si nécessaire, table de référence ou simple documentation (enum déjà présent).  
- `003_seed_terrain_segments.sql` : segments initiaux (optionnel, sinon inséré via backoffice).  
- `004_seed_pricing_rules.sql` : si table additionnelle pour configuration pricing (à créer si besoin).

### 5.3 Scripts SQLx offline
- Après création migrations :
  - Lancer `sqlx migrate build` ou script équivalent pour générer `sqlx-data.json`.
  - Mettre à jour documentation `CHOIX_SQLX_OFFLINE.md` avec commande exécutée.
  - Vérifier que CI tourne en mode offline (pas de connexion DB requise).

## 6. Intégration avec code Rust
- Créer modules `backend/src/models/delivery.rs`, `parcel.rs`, `courier.rs` avec structs dérivant `sqlx::FromRow`.
- Préparer requêtes typées (ex : `sqlx::query!`) lors de l’implémentation (tâche suivante).
- Encapsuler enums Rust correspondant (utiliser `#[sqlx(type_name = "delivery_status")]`).

## 7. Maintenabilité & évolutions
- Prévoir futures colonnes : assurance colis, multi-colis, livraisons groupées.
- S’assurer que `metadata` JSONB reste léger (indexation via GIN si requêtes fréquentes).
- Gérer archivage des `delivery_tracking_points` (partitionnement par mois si volume élevé).

## 8. Prochaines étapes
- Valider ce modèle avec l’équipe backend.  
- Écrire migrations SQL concrètes selon plan (tâche future).  
- Synchroniser seeds avec scripts `auto_migration`.  
- Commencer implémentation des requêtes (nécessaire pour tâche `task-3`).

