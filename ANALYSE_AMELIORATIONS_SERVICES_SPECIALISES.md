# Analyse et Améliorations des Services Spécialisés

## 1. Laboratoire vs Imagerie : Séparation ou Fusion ?

### État actuel
- **Table unique** : `laboratoires_imagerie` avec :
  - `type_laboratoire` : "Laboratoire", "Centre d'imagerie", "Les deux"
  - `analyses_disponibles` : Array TEXT[]
  - `imagerie_disponible` : Array TEXT[]
  - `planning_hebdomadaire` : JSONB

### Recommandation : **GARDER FUSIONNÉ** ✅

**Raisons :**
1. **Réalité du terrain** : Beaucoup d'établissements font les deux (analyses + imagerie)
2. **Recherche simplifiée** : Un seul point d'entrée pour "analyses" ou "scanner"
3. **Planification commune** : Même planning pour les deux services
4. **Interface utilisateur** : Plus simple de gérer un seul formulaire

**Améliorations suggérées :**
- Clarifier les champs dans le formulaire (sections distinctes mais dans même formulaire)
- Améliorer la détection de recherche : "scanner" → imagerie, "analyse sang" → laboratoire
- Badge visuel dans les résultats : "🔬 Laboratoire" ou "📷 Imagerie" ou "🔬📷 Les deux"

---

## 2. Tickets de Bus : Système Existant Très Évolué

### Système actuel découvert

#### Tables existantes :
1. **`bus_reservations`** : Réservations de places avec :
   - `seat_id`, `seat_number`, `status` (pending/confirmed/cancelled/expired)
   - `caution_amount`, `total_price`, `payment_status`
   - `expires_at` (30 min par défaut)
   - `ticket_pdf_url`

2. **`bus_ticket_payments`** : Paiements complets avec :
   - `ticket_price`, `number_of_tickets`, `subtotal`
   - `booking_fee` (500 FCFA fixe)
   - `total_amount`, `payment_status`

3. **`return_trip_requests`** : Demandes de retour avec matching automatique

4. **`prebooked_return_seats`** : Places pré-réservées pour retours

#### Colonnes dans `products` :
- `bus_configuration` : JSONB (rows, seatsPerRow, firstRowSeats)
- `seat_map` : JSONB (plan complet des sièges)
- `total_seats` : INTEGER
- `numero_bus` : VARCHAR(50)
- `logo_agence` : TEXT
- `conditions_voyage` : TEXT
- `caution_reservation` : INTEGER (500 par défaut)

#### Fonctions SQL :
- `expire_unconfirmed_reservations()` : Expire automatiquement les réservations
- `confirm_bus_reservation()` : Confirme après paiement complet
- `match_return_trip_requests()` : Match automatique des retours
- `prebook_return_seats()` : Pré-réserve les places retour

#### Frontend mobile :
- `busTicketPdfGenerator.ts` : Génération de tickets PDF avec QR Code

### Problème identifié

**La table `agences_voyage` actuelle est trop simple** et ne s'intègre pas avec le système existant !

### Solution : Intégration complète

#### A. Modifier `agences_voyage` pour référencer `products`
```sql
-- Ajouter colonne pour lier aux produits bus
ALTER TABLE agences_voyage ADD COLUMN IF NOT EXISTS bus_products_config JSONB;
-- Exemple : {"modeles_bus": [{"nom": "Luxury", "total_seats": 50, "classe": "VIP"}, ...]}
```

#### B. Créer une fonction de recherche qui utilise `products` + `bus_reservations`
```sql
CREATE OR REPLACE FUNCTION search_bus_tickets_with_availability(
    p_departure_city TEXT,
    p_arrival_city TEXT,
    p_departure_date DATE,
    p_user_lat DOUBLE PRECISION DEFAULT NULL,
    p_user_lng DOUBLE PRECISION DEFAULT NULL,
    p_radius_km DOUBLE PRECISION DEFAULT 50.0
)
RETURNS TABLE(...) AS $$
-- Recherche dans products avec type='ticket_voyage'
-- Jointure avec bus_reservations pour places disponibles
-- Calcul distance GPS si fourni
$$;
```

#### C. Améliorer le formulaire `AgenceVoyageForm`
- Section "Modèles de bus" : Permettre de créer plusieurs modèles
- Chaque modèle = un `product` de type `ticket_voyage`
- Configuration sièges : Interface visuelle pour `bus_configuration` et `seat_map`

#### D. Améliorer l'affichage des résultats
- Utiliser `AgenceVoyageResultCard` mais enrichir avec :
  - Places disponibles en temps réel (via `bus_reservations`)
  - Sélection de sièges interactive
  - Réservation avec caution
  - Génération PDF ticket

---

## 3. Planification Hôpitaux/Laboratoires

### État actuel
- `planning_hebdomadaire` : JSONB dans `hopitaux_cliniques` et `laboratoires_imagerie`
- Fonction `is_medical_service_available()` utilise ce planning

### Améliorations nécessaires

#### A. Standardiser le format JSONB
```json
{
  "lundi": {
    "ouvert": true,
    "debut": "08:00",
    "fin": "18:00",
    "permanent": false,
    "prestations": ["Urgences", "Consultation"]
  },
  "mardi": {...},
  ...
}
```

#### B. Créer un composant de planification réutilisable
- Interface visuelle pour définir horaires par jour
- Gestion des exceptions (jours fériés, fermetures exceptionnelles)
- Différenciation par prestation (ex: Urgences 24/7, Consultation 8h-18h)

#### C. Améliorer la fonction de recherche
- Prendre en compte les prestations spécifiques dans le planning
- Ex: "urgences maintenant" → vérifier si urgences ouvertes maintenant

---

## 4. Banque de Sang : Isoler Complètement ✅

### Recommandation : **TABLE DÉDIÉE** avec détection spécifique

### Raisons :
1. **Spécificité métier** : Gestion des groupes sanguins, stocks, compatibilités
2. **Recherche spécialisée** : "banque de sang O+", "don de sang", "groupe AB-"
3. **Réseau intelligent** : Matching donneur/receveur, alertes stock faible
4. **Séparation claire** : Un hôpital peut avoir une banque de sang, mais c'est un service distinct

### Structure proposée

#### Table `banques_sang`
```sql
CREATE TABLE IF NOT EXISTS banques_sang (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Lien avec établissement (optionnel, peut être indépendant)
    hopital_id INTEGER REFERENCES hopitaux_cliniques(id) ON DELETE SET NULL,
    
    -- Informations de base
    nom VARCHAR(255) NOT NULL,
    adresse TEXT,
    quartier VARCHAR(255),
    ville VARCHAR(255),
    gps VARCHAR(255),
    
    -- Groupes sanguins disponibles avec stocks
    stocks_groupes_sanguins JSONB NOT NULL DEFAULT '{}',
    -- Format: {"O+": {"quantite": 50, "unite": "poches", "derniere_maj": "2025-11-26T10:00:00Z"}, ...}
    
    -- Services
    accepte_dons BOOLEAN DEFAULT TRUE,
    accepte_demandes BOOLEAN DEFAULT TRUE,
    urgence_24h BOOLEAN DEFAULT FALSE,
    
    -- Planification
    planning_hebdomadaire JSONB,
    horaires_dons TIME[], -- ["08:00", "17:00"]
    
    -- Contact
    telephone VARCHAR(50),
    telephone_urgence VARCHAR(50),
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    
    -- Statut
    is_active BOOLEAN DEFAULT TRUE,
    is_available_now BOOLEAN DEFAULT FALSE, -- Calculé avec NOW()
    
    -- Métadonnées
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_banque_service UNIQUE(service_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_banques_sang_hopital ON banques_sang(hopital_id);
CREATE INDEX IF NOT EXISTS idx_banques_sang_stocks_gin ON banques_sang USING GIN(stocks_groupes_sanguins);
CREATE INDEX IF NOT EXISTS idx_banques_sang_available ON banques_sang(is_available_now) WHERE is_available_now = TRUE;
```

#### Fonction de recherche spécialisée
```sql
CREATE OR REPLACE FUNCTION search_banques_sang_with_moment(
    p_query TEXT DEFAULT NULL,
    p_groupe_sanguin TEXT DEFAULT NULL, -- "O+", "AB-", etc.
    p_urgence BOOLEAN DEFAULT FALSE,
    p_user_lat DOUBLE PRECISION DEFAULT NULL,
    p_user_lng DOUBLE PRECISION DEFAULT NULL,
    p_radius_km DOUBLE PRECISION DEFAULT 50.0
)
RETURNS TABLE(...) AS $$
-- Recherche avec filtrage par groupe sanguin disponible
-- Priorité si urgence
-- Distance GPS si fourni
$$;
```

#### Détection intelligente
Dans `scheduling_search_service.rs` :
```rust
// Détection banque de sang
if query_lower.contains("banque de sang")
    || query_lower.contains("don de sang")
    || query_lower.contains("groupe sanguin")
    || (query_lower.contains("sang") && (
        query_lower.contains("o+") || query_lower.contains("o-")
        || query_lower.contains("a+") || query_lower.contains("a-")
        || query_lower.contains("b+") || query_lower.contains("b-")
        || query_lower.contains("ab+") || query_lower.contains("ab-")
    ))
{
    return SearchIntent::SpecializedBloodBank;
}
```

#### Modifications nécessaires

1. **Supprimer `banque_sang` de `hopitaux_cliniques`**
   ```sql
   ALTER TABLE hopitaux_cliniques DROP COLUMN IF EXISTS banque_sang;
   ```

2. **Créer migration pour `banques_sang`**
   - Ajouter à `auto_migrate.rs`
   - Ajouter à `0000_create_all_tables.sql`

3. **Créer contrôleur Rust** : `blood_bank_controller.rs`
   - `create_blood_bank`
   - `update_stocks` (mise à jour stocks groupes sanguins)
   - `search_blood_banks`
   - `get_blood_bank`

4. **Créer formulaire mobile/frontend** : `BanqueSangForm`
   - Interface pour gérer stocks par groupe sanguin
   - Planification horaires dons
   - Lien optionnel avec hôpital

5. **Créer `BloodBankResultCard`**
   - Afficher groupes disponibles avec stocks
   - Badge "URGENCE 24H" si applicable
   - Distance et contact

---

## Plan d'Action Priorisé

### Phase 1 : Banque de Sang (Priorité Haute)
1. ✅ Créer table `banques_sang`
2. ✅ Supprimer `banque_sang` de `hopitaux_cliniques`
3. ✅ Créer fonction `search_banques_sang_with_moment`
4. ✅ Ajouter détection dans `scheduling_search_service.rs`
5. ✅ Créer contrôleur Rust
6. ✅ Créer formulaire mobile/frontend
7. ✅ Créer `BloodBankResultCard`

### Phase 2 : Intégration Tickets Bus (Priorité Haute)
1. ✅ Modifier `agences_voyage` pour référencer `products`
2. ✅ Créer fonction `search_bus_tickets_with_availability`
3. ✅ Améliorer `AgenceVoyageForm` avec modèles de bus
4. ✅ Enrichir `AgenceVoyageResultCard` avec réservation

### Phase 3 : Amélioration Planification (Priorité Moyenne)
1. ✅ Standardiser format `planning_hebdomadaire`
2. ✅ Créer composant planification réutilisable
3. ✅ Améliorer fonctions de recherche avec prestations

### Phase 4 : Laboratoire/Imagerie (Priorité Basse - Déjà OK)
1. ✅ Améliorer détection de recherche
2. ✅ Améliorer affichage avec badges

---

## Décisions Finales

| Question | Décision | Justification |
|----------|----------|---------------|
| Laboratoire/Imagerie séparés ? | **NON** - Garder fusionné | Réalité terrain, simplicité |
| Banque de sang isolée ? | **OUI** - Table dédiée | Spécificité métier, recherche spécialisée |
| Tickets bus dans agences ? | **OUI** - Intégrer avec `products` | Système existant très évolué |

