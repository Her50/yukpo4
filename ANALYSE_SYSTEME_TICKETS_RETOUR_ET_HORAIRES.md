# Analyse du système de tickets retour et horaires par ville

## 📋 État actuel du système

### ✅ Ce qui existe déjà

#### 1. Table `return_trip_requests` (déjà créée)
- ✅ `preferred_return_date` (VARCHAR(20)) - Date de retour souhaitée
- ✅ `preferred_return_time` (VARCHAR(10)) - **Heure de retour (OPTIONNEL, flexible)**
- ✅ `date_flexibility_days` (INTEGER) - Flexibilité en jours (±X jours acceptable)
- ✅ `return_from` / `return_to` - Route retour (inverse du voyage aller)

**Fichier** : `backend/migrations/20250126001_bus_return_trips_system.sql` (ligne 43-81)

#### 2. Table `bus_ticket_payments` (déjà créée)
- ✅ `departure_time` (VARCHAR(10)) - Heure de départ **ALLER uniquement**
- ✅ `departure_date` (VARCHAR(20)) - Date de départ aller
- ✅ `departure_city` / `arrival_city` - Villes aller

**Fichier** : `backend/migrations/20250126001_bus_return_trips_system.sql` (ligne 6-40)

#### 3. Fonction de matching `match_return_trip_requests`
- ✅ Match par route (inverse du voyage aller)
- ✅ Match par date (avec flexibilité `date_flexibility_days`)
- ❌ **NE MATCH PAS par heure de retour**

**Fichier** : `backend/migrations/20250126001_bus_return_trips_system.sql` (ligne 114-143)

#### 4. Système Google Places (déjà implémenté)
- ✅ Service `google_places_service.rs` pour recherche de lieux
- ✅ Contrôleur `places_controller.rs` pour API
- ✅ Composants frontend/mobile avec Google Maps intégré
- ✅ Gestion des villes avec géocodage automatique

**Fichiers** :
- `backend/src/services/google_places_service.rs`
- `backend/src/controllers/places_controller.rs`
- `frontend/src/components/ui/MapModal.tsx`
- `mobile/src/components/ModernGPSModal.tsx`

---

## ❌ Ce qui manque

### 1. **Heure de retour non stockée lors du paiement**

**Problème** : Lors du paiement d'un ticket aller-retour, seule l'heure de départ aller est stockée dans `bus_ticket_payments`. L'heure de retour n'est pas enregistrée.

**Fichier concerné** : `backend/src/controllers/bus_ticket_payment_controller.rs`
- Ligne 163-167 : Récupère uniquement `departure_time` (aller)
- Ligne 192 : Insère uniquement `departure_time` (aller)
- **Aucune gestion de `return_time`**

### 2. **Matching ne prend pas en compte l'heure de retour**

**Problème** : La fonction `match_return_trip_requests` ne filtre pas par heure de retour, même si `preferred_return_time` existe dans `return_trip_requests`.

**Fichier concerné** : `backend/migrations/20250126001_bus_return_trips_system.sql` (ligne 114-143)
- Match uniquement par route et date
- Pas de condition sur `preferred_return_time`

### 3. **Pas de table pour horaires de départ par ville/agence**

**Problème** : Aucune table n'existe pour stocker les horaires de départ prévus par chaque agence pour chaque ville/trajet.

**Nécessaire** : Table `agency_departure_schedules` avec :
- `agency_user_id` (référence à l'agence)
- `departure_city` (ville de départ)
- `arrival_city` (ville d'arrivée)
- `departure_times` (ARRAY[TIME] - liste des horaires disponibles)
- `day_of_week` (optionnel - pour horaires différents selon jour)
- `is_active` (booléen)

### 4. **Pas de sélection d'heure de retour lors du paiement**

**Problème** : Lors du paiement d'un ticket aller-retour, l'utilisateur ne peut pas choisir l'heure de retour souhaitée parmi les horaires disponibles de l'agence.

**Fichiers concernés** :
- `backend/src/controllers/bus_ticket_payment_controller.rs` - Pas de champ `return_time` dans la requête
- Frontend/Mobile - Pas d'interface pour sélectionner l'heure de retour

---

## 🔧 Améliorations nécessaires

### 1. Ajouter colonne `return_time` dans `bus_ticket_payments`

```sql
ALTER TABLE bus_ticket_payments 
ADD COLUMN return_date VARCHAR(20),
ADD COLUMN return_time VARCHAR(10);
```

### 2. Créer table `agency_departure_schedules`

```sql
CREATE TABLE IF NOT EXISTS agency_departure_schedules (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agency_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    departure_city TEXT NOT NULL,
    arrival_city TEXT NOT NULL,
    departure_times TIME[] NOT NULL, -- ["08:00", "14:00", "20:00"]
    day_of_week INTEGER, -- 0=Dimanche, 1=Lundi, ..., 6=Samedi (NULL = tous les jours)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(agency_user_id, departure_city, arrival_city, day_of_week)
);

CREATE INDEX idx_agency_schedules_route ON agency_departure_schedules(departure_city, arrival_city);
CREATE INDEX idx_agency_schedules_agency ON agency_departure_schedules(agency_user_id);
```

### 3. Modifier fonction de matching pour inclure l'heure

```sql
CREATE OR REPLACE FUNCTION match_return_trip_requests(p_product_id TEXT)
RETURNS TABLE(...) AS $$
BEGIN
    RETURN QUERY
    SELECT ...
    FROM return_trip_requests rtr
    JOIN products p ON p.id::text = p_product_id
    WHERE rtr.status = 'pending'
        -- Match route (inverse)
        AND rtr.return_from = p.depart
        AND rtr.return_to = p.destination
        -- Match date (avec flexibilité)
        AND p.date_depart BETWEEN ...
        -- ✅ NOUVEAU: Match heure (si spécifiée, avec tolérance ±1h)
        AND (
            rtr.preferred_return_time IS NULL 
            OR p.metadata->>'departure_time' IS NULL
            OR ABS(
                EXTRACT(EPOCH FROM (p.metadata->>'departure_time')::TIME - rtr.preferred_return_time::TIME)
            ) / 3600 <= 1  -- Tolérance 1 heure
        );
END;
$$ LANGUAGE plpgsql;
```

### 4. Modifier contrôleur de paiement pour accepter `return_time`

**Fichier** : `backend/src/controllers/bus_ticket_payment_controller.rs`

```rust
#[derive(Debug, Deserialize)]
pub struct ProcessTicketPaymentRequest {
    // ... champs existants ...
    pub return_date: Option<String>,      // ✅ NOUVEAU
    pub return_time: Option<String>,      // ✅ NOUVEAU
    pub is_round_trip: Option<bool>,      // ✅ NOUVEAU
}
```

### 5. API pour récupérer horaires disponibles par ville/agence

**Nouvelle route** : `GET /api/bus-tickets/agencies/{agency_id}/schedules?from={city}&to={city}`

Retourne les horaires disponibles pour un trajet spécifique d'une agence.

### 6. Utiliser système Google Places pour sélection ville

**Déjà disponible** :
- `GET /api/places/search?query={ville}` - Recherche de villes
- `GET /api/places/autocomplete?input={ville}` - Autocomplétion

**À intégrer** dans le formulaire de paiement aller-retour pour :
- Sélectionner ville de départ retour (avec Google Places)
- Afficher horaires disponibles selon la ville sélectionnée
- Valider que l'heure choisie existe dans les horaires de l'agence

---

## 📝 Plan d'implémentation

### Phase 1 : Base de données
1. ✅ Créer table `agency_departure_schedules`
2. ✅ Ajouter colonnes `return_date` et `return_time` à `bus_ticket_payments`
3. ✅ Modifier fonction `match_return_trip_requests` pour inclure heure

### Phase 2 : Backend
1. ✅ Modifier `ProcessTicketPaymentRequest` pour accepter `return_time`
2. ✅ Créer API pour gérer les horaires d'agence (CRUD)
3. ✅ Créer API pour récupérer horaires disponibles par trajet
4. ✅ Modifier contrôleur paiement pour stocker `return_time`

### Phase 3 : Frontend/Mobile
1. ✅ Ajouter sélection heure retour dans formulaire paiement
2. ✅ Intégrer Google Places pour sélection ville
3. ✅ Afficher horaires disponibles selon ville/trajet sélectionné
4. ✅ Valider heure choisie contre horaires disponibles

### Phase 4 : Matching amélioré
1. ✅ Tester matching avec heure de retour
2. ✅ Ajuster tolérance heure si nécessaire
3. ✅ Notifications utilisateurs avec heure exacte

---

## 🔍 Fichiers à modifier

### Backend
- `backend/migrations/20250126001_bus_return_trips_system.sql` - Modifier fonction matching
- `backend/src/controllers/bus_ticket_payment_controller.rs` - Ajouter `return_time`
- `backend/src/routes/specialized_services_routes.rs` - Nouvelle route horaires
- `backend/src/controllers/bus_ticket_controller.rs` - Gestion horaires agence

### Frontend/Mobile
- Formulaire de paiement ticket (à identifier)
- Composant sélection heure retour
- Intégration Google Places pour villes

---

## ✅ Conclusion

**État actuel** :
- ✅ Date de retour : Gérée
- ⚠️ Heure de retour : Existe dans `return_trip_requests` mais **non utilisée** dans le matching
- ❌ Horaires par ville/agence : **N'existe pas**
- ❌ Sélection heure retour lors paiement : **N'existe pas**

**Recommandation** : Implémenter les phases 1-4 pour un système complet de gestion des horaires et tickets retour.

