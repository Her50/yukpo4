# Prompt de Continuation - Tickets Bus & Banque de Sang

## 🎯 Vue d'ensemble

Ce document contient le contexte complet et les étapes détaillées pour continuer l'intégration de :

### 📌 NOUVEAU - Paiement et Validation Tickets Bus (Priorité Critique)
- ✅ Système de paiement complet avec commission 5%
- ✅ Reversement automatique à l'agence
- ✅ Génération ticket PDF avec QR code
- ✅ Page "Mes tickets de voyage"
- ✅ Système de validation QR code lors de l'embarquement
- ✅ Vérification bon bus et gestion complétude passagers
- ✅ **Gestion manuelle des places non disponibles** (ventes hors application) ⚠️ NOUVEAU
1. **Tickets Bus avec Agences de Voyage** (Partie 1)
2. **Banque de Sang avec Gestion Stocks, Chat et Livraison** (Partie 2)

## 📋 CONTEXTE DU PROJET

### Application Yukpomnang
- **Backend**: Rust avec Axum, SQLx, PostgreSQL, pgvector
- **Frontend**: React avec TypeScript, TailwindCSS
- **Mobile**: React Native avec TypeScript
- **Base de données**: PostgreSQL avec extensions pgvector et imgsmlr
- **Fonctionnalités**: Géolocalisation, géocodage, IA, WebSocket, services spécialisés

### Architecture Services Spécialisés
Le projet implémente un système de services spécialisés avec tables dédiées :
- **Santé** : `pharmacies`, `hopitaux_cliniques`, `laboratoires_imagerie`, `banques_sang`
- **Transport** : `agences_voyage`, `covoiturages`, `taxis_ville`

Chaque service spécialisé a :
- Sa propre table avec champs spécifiques
- Des fonctions SQL de recherche avec intégration "moment" (NOW())
- Des contrôleurs Rust dédiés
- Des formulaires mobile/frontend
- Des composants d'affichage spécialisés

### ⚠️ CONTRAINTES IMPORTANTES - Migrations SQL

**TOUTES les migrations SQL doivent respecter** :
1. **SQLx Offline Mode** :
   - ❌ **JAMAIS** de `SELECT ... FROM` qui retourne des résultats dans une migration
   - ✅ Utiliser `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`
   - ✅ Utiliser `DO $$ ... END $$` pour vérifications conditionnelles
   - ✅ Utiliser `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (via DO block)

2. **Intégration auto_migrate.rs** :
   - Toute nouvelle fonction SQL doit être ajoutée dans `backend/src/migrations/auto_migrate.rs`
   - Créer une fonction `ensure_xxx()` qui lit le fichier SQL et l'exécute
   - Appeler cette fonction dans `run_auto_migrations()`

3. **Intégration 0000_create_all_tables.sql** :
   - Toute nouvelle table doit être ajoutée dans `backend/migrations/0000_create_all_tables.sql`
   - Toute nouvelle fonction SQL doit être ajoutée dans `0000_create_all_tables.sql`
   - Ce fichier sert de référence complète pour création initiale

**Exemple de migration correcte** :
```sql
-- ✅ CORRECT : Compatible SQLx offline
CREATE TABLE IF NOT EXISTS ma_table (
    id SERIAL PRIMARY KEY,
    ...
);
CREATE INDEX IF NOT EXISTS idx_ma_table_col ON ma_table(col);

-- ❌ INCORRECT : Retourne des résultats (incompatible SQLx offline)
SELECT * FROM ma_table WHERE ...
```

---

## 🎯 SITUATION ACTUELLE

### Partie 1 : Tickets Bus avec Agences de Voyage

### ✅ CE QUI EST COMPLÉTÉ

#### 1. Backend (100% complété)
- **Migration SQL** : `backend/migrations/20251127_integrate_bus_tickets_with_agences_voyage.sql`
  - Colonne `bus_products_config JSONB` ajoutée à `agences_voyage`
  - Fonction `search_bus_tickets_with_availability()` : Recherche tickets avec disponibilité en temps réel
  - Fonction `get_bus_seat_availability()` : Obtenir places disponibles d'un produit
  - Compatible SQLx offline mode
  - Intégré dans `auto_migrate.rs` via `ensure_bus_tickets_integration()`
  - Intégré dans `0000_create_all_tables.sql`

- **Contrôleur Rust** : `backend/src/controllers/bus_ticket_controller.rs`
  - `search_bus_tickets()` : Recherche publique
  - `get_seat_availability()` : Disponibilité en temps réel
  - `link_bus_product_to_agency()` : Lier produit à agence (protégé JWT)
  - Pas d'erreurs de lint

- **Routes API** : `backend/src/routes/specialized_services_routes.rs`
  - `GET /api/bus-tickets/search` : Recherche tickets
  - `GET /api/bus-tickets/:product_id/availability` : Disponibilité places
  - `POST /api/bus-tickets/link` : Lier produit à agence (protégé)

- **Module** : Ajouté dans `backend/src/controllers/mod.rs`

#### 2. Composants Mobile (Partiellement complété)
- **BusModelForm** : `mobile/src/components/bus/BusModelForm.tsx` ✅
  - Formulaire modal pour créer/modifier un modèle de bus
  - Champs : nom, classe, nombre de places, prix de base, équipements
  - Configuration sièges optionnelle (rows, seatsPerRow, firstRowSeats)
  - Calcul automatique du nombre total de places
  - Validation complète

- **BusTicketCard** : `mobile/src/components/bus/BusTicketCard.tsx` ✅
  - Affichage ticket bus avec disponibilité en temps réel
  - Trajet (départ → destination) avec date/heure
  - Barre de progression disponibilité (vert/orange/rouge)
  - Boutons "Voir places" et "Réserver"

- **AgenceVoyageFormScreen** : `mobile/src/screens/specialized/AgenceVoyageFormScreen.tsx` ✅ (partiel)
  - Section "Modèles de bus" ajoutée
  - Liste des modèles avec actions (éditer, supprimer)
  - Intégration `BusModelForm`
  - ⚠️ **MANQUE** : `handleSubmit` ne crée pas encore les `products` et ne les lie pas à l'agence

#### 3. Système Existant Utilisé
- **Tables** : `bus_reservations`, `bus_ticket_payments`, `return_trip_requests`
- **Colonnes dans `products`** : `bus_configuration`, `seat_map`, `total_seats`, `numero_bus`, etc.
- **Fonctions SQL** : `confirm_bus_reservation()`, `expire_unconfirmed_reservations()`, etc.
- **Utilitaires** : `mobile/src/utils/busTicketPdfGenerator.ts` pour génération PDF

---

## 📝 CE QUI RESTE À FAIRE

### 1. Compléter `handleSubmit` dans AgenceVoyageFormScreen ⚠️ PRIORITAIRE

**Fichier** : `mobile/src/screens/specialized/AgenceVoyageFormScreen.tsx`

**Objectif** : Après création de l'agence, créer les `products` de type `ticket_voyage` pour chaque modèle de bus et les lier à l'agence.

**Étapes détaillées** :

1. **Après création réussie de l'agence** (ligne ~127 après `response.success`) :
   ```typescript
   // Récupérer l'agence_id depuis la réponse
   const agencyId = response.data?.id;
   ```

2. **Pour chaque modèle dans `busModels`** :
   - Créer un `product` de type `ticket_voyage` via API existante
   - Format du payload :
     ```typescript
     {
       service_id: serviceId, // Le service_id de l'agence
       name: model.nom_modele,
       type: 'ticket_voyage',
       total_seats: model.total_seats,
       bus_configuration: {
         rows: model.rows || Math.ceil(model.total_seats / 4),
         seatsPerRow: model.seatsPerRow || 4,
         firstRowSeats: model.firstRowSeats || 2,
         allSeatsAvailable: true
       },
       seat_map: generateSeatMap(model), // Fonction à créer
       price: model.prix_base,
       currency: 'XAF'
     }
     ```

3. **Générer `seat_map` automatiquement** :
   - Créer fonction `generateSeatMap(model: BusModel)` qui génère un array de sièges
   - Format : `[{ row: 1, col: 1, seat_id: "1-1", seat_number: 1, type: "standard", available: true }, ...]`
   - Utiliser `bus_configuration` pour calculer les positions

4. **Appeler API pour créer le produit** :
   ```typescript
   const productResponse = await apiPost('/api/products', productPayload);
   const productId = productResponse.data?.id;
   ```

5. **Lier le produit à l'agence** :
   ```typescript
   await apiPost('/api/bus-tickets/link', {
     agency_id: agencyId,
     product_id: productId,
     nom_modele: model.nom_modele,
     classe: model.classe,
     equipements: model.equipements
   });
   ```

6. **Gérer les erreurs** :
   - Afficher progression si plusieurs modèles
   - Rollback si erreur (optionnel)
   - Afficher message de succès avec nombre de modèles créés

**Références** :
- API création produit : Vérifier `backend/src/controllers/product_addition_controller.rs` ou `service_controller.rs`
- API liaison : `POST /api/bus-tickets/link` (déjà créée)

---

### 2. Créer composant BusSeatSelector ⚠️ PRIORITAIRE

**Fichier** : `mobile/src/components/bus/BusSeatSelector.tsx`

**Objectif** : Modal interactif pour sélectionner visuellement les sièges d'un bus.

**Spécifications détaillées** :

#### Interface Props
```typescript
interface BusSeatSelectorProps {
    visible: boolean;
    onClose: () => void;
    productId: string;
    ticketPrice: number;
    currency?: string;
    onReserve: (selectedSeats: SelectedSeat[], totalPrice: number) => void;
}

interface SelectedSeat {
    seat_id: string;
    seat_number: number;
    row: number;
    col: number;
}
```

#### Fonctionnalités requises

1. **Récupérer disponibilité** :
   - Appeler `GET /api/bus-tickets/:product_id/availability` au montage
   - Stocker `seat_map`, `reserved_seats` et `blocked_seats` dans le state ⚠️ NOUVEAU
   - L'API retourne maintenant aussi `blocked_seats` (places bloquées manuellement par l'agence)

2. **Afficher plan des sièges** :
   - Layout visuel : rangées de sièges
   - Chaque siège = `TouchableOpacity` avec état visuel :
     - **Disponible** : Vert (#10B981), cliquable
     - **Réservé** : Gris (#9CA3AF), non cliquable
     - **Sélectionné** : Bleu (modernColors.primary), cliquable pour désélectionner
   - Afficher numéro de siège sur chaque place
   - Espacement entre rangées (couloir)

3. **Sélection multiple** :
   - Permettre sélection/désélection de plusieurs sièges
   - Stocker dans `selectedSeats: SelectedSeat[]`
   - Limiter sélection si nécessaire (ex: max 10 places)

4. **Afficher informations** :
   - Nombre de places sélectionnées
   - Prix unitaire
   - Prix total (prix × nombre de places)
   - Caution (500 FCFA fixe)

5. **Bouton "Réserver avec caution"** :
   - Désactivé si aucune place sélectionnée
   - Appeler `onReserve(selectedSeats, totalPrice)`
   - Afficher loading pendant réservation

6. **Légende** :
   - Disponible (vert)
   - Réservé (gris) - Réservé via application
   - Bloqué (rouge) - Non disponible (bloqué manuellement par l'agence) ⚠️ NOUVEAU
   - Sélectionné (bleu)

#### Structure visuelle suggérée
```
┌─────────────────────────────────┐
│  Plan des sièges                │
│                                 │
│  [1] [2]    [3] [4]  ← Rangée 1│
│  [5] [6]    [7] [8]  ← Rangée 2│
│  ...                            │
│                                 │
│  Légende:                       │
│  🟢 Disponible  ⚫ Réservé      │
│  🔴 Bloqué  🔵 Sélectionné     │
│                                 │
│  2 places sélectionnées         │
│  Prix total: 20 000 FCFA        │
│  Caution: 500 FCFA              │
│                                 │
│  [Réserver avec caution]        │
└─────────────────────────────────┘
```

#### Références
- API disponibilité : `GET /api/bus-tickets/:product_id/availability` (client)
- API disponibilité avec blocs : `GET /api/agency/bus-tickets/:product_id/seats/availability` (agence)
- Format `seat_map` : Array de `{ row, col, seat_id, seat_number, type, available }`
- Format `reserved_seats` : Array de `seat_id` strings (réservées via app)
- Format `blocked_seats` : Array de `seat_id` strings (bloquées manuellement) ⚠️ NOUVEAU

---

### 3. Améliorer AgenceVoyageResultCard

**Fichier** : `mobile/src/components/specialized/AgenceVoyageResultCard.tsx`

**Objectif** : Afficher les tickets bus disponibles si résultats de recherche contiennent des tickets.

**Étapes détaillées** :

1. **Modifier l'interface Props** :
   ```typescript
   interface AgenceVoyageResultCardProps {
       agency: {
           // ... champs existants
       };
       busTickets?: BusTicketData[]; // Nouveau : tickets disponibles
       onPress?: () => void;
       onViewSeats?: (ticket: BusTicketData) => void; // Nouveau
       onReserve?: (ticket: BusTicketData) => void; // Nouveau
   }
   ```

2. **Logique conditionnelle** :
   - Si `busTickets && busTickets.length > 0` :
     - Afficher informations agence (nom, adresse, téléphone)
     - Afficher `BusTicketCard` pour chaque ticket
   - Sinon :
     - Afficher affichage classique actuel

3. **Intégrer BusTicketCard** :
   ```typescript
   import BusTicketCard, { BusTicketData } from '../bus/BusTicketCard';
   
   // Dans le render
   {busTickets?.map((ticket, index) => (
       <BusTicketCard
           key={ticket.product_id || index}
           ticket={ticket}
           onViewSeats={onViewSeats}
           onReserve={onReserve}
       />
   ))}
   ```

4. **Gérer navigation** :
   - `onViewSeats` : Ouvrir `BusSeatSelector` modal
   - `onReserve` : Ouvrir écran de réservation ou `BusSeatSelector` directement

---

### 4. Système de Paiement Complet avec Commission 🎫 PRIORITÉ CRITIQUE

**Objectif** : Implémenter le flux complet de paiement avec commission 5%, reversement automatique et génération ticket PDF.

#### 4.1 Backend - Modifier Table bus_ticket_payments

**Migration** : `backend/migrations/20251127_add_commission_to_bus_payments.sql`

**⚠️ CONTRAINTES SQLx OFFLINE** :
- Utiliser `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (via DO block)
- Intégrer dans `auto_migrate.rs` et `0000_create_all_tables.sql`

**Colonnes à ajouter** :
```sql
DO $$ 
BEGIN
    -- Commission Yukpo (5% du montant ticket)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='yukpo_commission') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN yukpo_commission INTEGER;
        RAISE NOTICE 'Colonne yukpo_commission ajoutée';
    END IF;
    
    -- Montant reversé à l'agence (subtotal - commission)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='agency_payout') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN agency_payout INTEGER;
        RAISE NOTICE 'Colonne agency_payout ajoutée';
    END IF;
    
    -- Statut reversement
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='payout_status') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN payout_status VARCHAR(20) DEFAULT 'pending';
        RAISE NOTICE 'Colonne payout_status ajoutée';
    END IF;
    
    -- Date reversement
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='payout_at') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN payout_at TIMESTAMPTZ;
        RAISE NOTICE 'Colonne payout_at ajoutée';
    END IF;
    
    -- URL ticket PDF généré
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='bus_ticket_payments' AND column_name='ticket_pdf_url') THEN
        ALTER TABLE bus_ticket_payments ADD COLUMN ticket_pdf_url TEXT;
        RAISE NOTICE 'Colonne ticket_pdf_url ajoutée';
    END IF;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_bus_payments_payout_status ON bus_ticket_payments(payout_status) WHERE payout_status = 'pending';
```

#### 4.2 Backend - Fonction SQL Calcul Commission et Reversement

**Fonction** : `process_bus_ticket_payment_with_commission`

```sql
CREATE OR REPLACE FUNCTION process_bus_ticket_payment_with_commission(
    p_payment_id TEXT,
    p_ticket_price INTEGER,
    p_number_of_tickets INTEGER,
    p_booking_fee INTEGER DEFAULT 500
)
RETURNS JSONB AS $$
DECLARE
    v_subtotal INTEGER;
    v_commission INTEGER;
    v_agency_payout INTEGER;
    v_total_amount INTEGER;
    v_payment RECORD;
BEGIN
    -- Calculer montants
    v_subtotal := p_ticket_price * p_number_of_tickets;
    v_commission := ROUND(v_subtotal * 0.05); -- 5% commission
    v_agency_payout := v_subtotal - v_commission;
    v_total_amount := v_subtotal + p_booking_fee;
    
    -- Mettre à jour le paiement
    UPDATE bus_ticket_payments
    SET 
        subtotal = v_subtotal,
        yukpo_commission = v_commission,
        agency_payout = v_agency_payout,
        total_amount = v_total_amount,
        booking_fee = p_booking_fee,
        payout_status = 'pending',
        updated_at = NOW()
    WHERE id = p_payment_id
    RETURNING * INTO v_payment;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Paiement non trouvé');
    END IF;
    
    -- Reverser automatiquement à l'agence
    UPDATE users
    SET tokens_balance = tokens_balance + v_agency_payout
    WHERE id = v_payment.agency_user_id;
    
    -- Marquer reversement comme complété
    UPDATE bus_ticket_payments
    SET 
        payout_status = 'completed',
        payout_at = NOW()
    WHERE id = p_payment_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'payment_id', p_payment_id,
        'subtotal', v_subtotal,
        'yukpo_commission', v_commission,
        'agency_payout', v_agency_payout,
        'total_amount', v_total_amount,
        'payout_status', 'completed'
    );
END;
$$ LANGUAGE plpgsql;
```

#### 4.3 Backend - Contrôleur Paiement Complet

**Fichier** : `backend/src/controllers/bus_ticket_payment_controller.rs` (nouveau)

**Fonctions à créer** :

1. **`process_ticket_payment`** :
   - Créer `bus_ticket_payment` avec réservations
   - Appeler fonction SQL `process_bus_ticket_payment_with_commission`
   - Générer ticket PDF via `busTicketPdfGenerator`
   - Sauvegarder URL PDF dans `ticket_pdf_url`
   - Retourner détails paiement avec commission affichée séparément

2. **`get_user_tickets`** :
   - Récupérer tous les tickets d'un utilisateur
   - Inclure statut, PDF URL, informations voyage

3. **`get_ticket_details`** :
   - Récupérer détails d'un ticket spécifique
   - Inclure QR code pour validation

**Routes API** :
- `POST /api/bus-tickets/payment` : Traiter paiement complet (protégé JWT)
- `GET /api/bus-tickets/my-tickets` : Liste tickets utilisateur (protégé JWT)
- `GET /api/bus-tickets/ticket/:payment_id` : Détails ticket (protégé JWT)

#### 4.4 Mobile - Affichage Commission Séparée

**Dans BusSeatSelector ou écran de paiement** :

```typescript
const calculatePaymentBreakdown = (ticketPrice: number, numberOfTickets: number) => {
    const subtotal = ticketPrice * numberOfTickets;
    const bookingFee = 500; // FCFA fixe
    const yukpoCommission = Math.round(subtotal * 0.05); // 5%
    const agencyPayout = subtotal - yukpoCommission;
    const totalAmount = subtotal + bookingFee;
    
    return {
        subtotal,
        bookingFee,
        yukpoCommission,
        agencyPayout,
        totalAmount,
    };
};

// Affichage dans UI
<View style={styles.paymentBreakdown}>
    <Text style={styles.breakdownTitle}>Détail du paiement</Text>
    
    <View style={styles.breakdownRow}>
        <Text>Prix tickets ({numberOfTickets}x)</Text>
        <Text>{subtotal.toLocaleString()} FCFA</Text>
    </View>
    
    <View style={styles.breakdownRow}>
        <Text>Frais de réservation</Text>
        <Text>{bookingFee.toLocaleString()} FCFA</Text>
    </View>
    
    <View style={[styles.breakdownRow, styles.commissionRow]}>
        <Text style={styles.commissionLabel}>
            Commission Yukpo (5%)
        </Text>
        <Text style={styles.commissionValue}>
            {yukpoCommission.toLocaleString()} FCFA
        </Text>
    </View>
    
    <View style={[styles.breakdownRow, styles.totalRow]}>
        <Text style={styles.totalLabel}>TOTAL À PAYER</Text>
        <Text style={styles.totalValue}>
            {totalAmount.toLocaleString()} FCFA
        </Text>
    </View>
    
    <Text style={styles.note}>
        Note: {agencyPayout.toLocaleString()} FCFA seront reversés à l'agence
    </Text>
</View>
```

#### 4.5 Mobile - Page Mes Tickets de Voyage

**Fichier** : `mobile/src/screens/MyBusTicketsScreen.tsx` (nouveau)

**Fonctionnalités** :
- Liste de tous les tickets de l'utilisateur
- Filtres : À venir, Passés, Annulés
- Pour chaque ticket :
  - Informations voyage (départ → destination, date, heure)
  - Numéro de place(s)
  - Statut (Confirmé, Utilisé, Annulé)
  - Bouton "Voir ticket PDF"
  - Bouton "Partager ticket"
  - QR code pour validation (si pas encore utilisé)

**Navigation** :
- Ajouter lien dans `ProfileScreen` : "Mes tickets de voyage"
- Ajouter bouton dans `HomeScreen` footer si utilisateur a des tickets

**API** :
- `GET /api/bus-tickets/my-tickets` : Liste tickets utilisateur

---

### 5. Système de Validation Tickets lors de l'Embarquement 🚌 PRIORITÉ CRITIQUE

**Objectif** : Permettre validation des tickets par QR code lors de l'embarquement, avec vérification du bon bus et gestion de la complétude.

#### 5.1 Analyse Technique de Faisabilité

**✅ FAISABLE** avec les technologies suivantes :

1. **Scan QR Code** :
   - Utiliser `expo-barcode-scanner` ou `react-native-vision-camera` avec module QR
   - Scanner le QR code du ticket PDF
   - Décoder les données JSON encodées

2. **Vérification Bon Bus** :
   - QR code contient : `product_id`, `bus_number`, `departure_date`, `departure_time`
   - Comparer avec informations du bus actuel (via GPS ou sélection manuelle)
   - Vérifier que `product_id` correspond au bus

3. **Gestion Complétude** :
   - Table `bus_boarding_status` pour tracker embarquement
   - Marquer chaque passager comme "embarqué" après validation
   - Compter passagers embarqués vs total réservations

4. **Position GPS Bus** :
   - Option 1 : Chauffeur/Agence sélectionne le bus manuellement
   - Option 2 : Utiliser GPS du téléphone du validateur (chauffeur)
   - Option 3 : Scanner QR code du bus (QR code fixe sur le bus)

#### 5.2 Backend - Table et Fonctions Validation

**Migration** : `backend/migrations/20251127_create_bus_ticket_validation_system.sql`

**⚠️ CONTRAINTES SQLx OFFLINE** :
- Compatible SQLx offline mode
- Intégrer dans `auto_migrate.rs` et `0000_create_all_tables.sql`

**Table `bus_boarding_status`** :
```sql
CREATE TABLE IF NOT EXISTS bus_boarding_status (
    id SERIAL PRIMARY KEY,
    payment_id TEXT NOT NULL REFERENCES bus_ticket_payments(id) ON DELETE CASCADE,
    reservation_id TEXT NOT NULL, -- ID de la réservation
    product_id TEXT NOT NULL, -- ID du produit (bus)
    bus_number VARCHAR(50) NOT NULL,
    
    -- Passager
    passenger_name VARCHAR(255),
    seat_id VARCHAR(50) NOT NULL,
    seat_number INTEGER NOT NULL,
    
    -- Validation
    validated_by_user_id INTEGER REFERENCES users(id), -- Chauffeur ou agent agence
    validated_at TIMESTAMPTZ,
    validation_method VARCHAR(20) DEFAULT 'qr_scan', -- 'qr_scan', 'manual', 'api'
    validation_location_gps VARCHAR(255), -- Position GPS au moment validation
    validation_location_lat DOUBLE PRECISION,
    validation_location_lng DOUBLE PRECISION,
    
    -- Statut
    boarding_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'boarded', 'no_show', 'cancelled'
    is_validated BOOLEAN DEFAULT FALSE,
    
    -- Vérifications
    bus_match_confirmed BOOLEAN DEFAULT FALSE, -- Vérifié que c'est le bon bus
    validation_notes TEXT, -- Notes si problème
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_reservation_boarding UNIQUE(reservation_id)
);

CREATE INDEX IF NOT EXISTS idx_boarding_payment ON bus_boarding_status(payment_id);
CREATE INDEX IF NOT EXISTS idx_boarding_product ON bus_boarding_status(product_id);
CREATE INDEX IF NOT EXISTS idx_boarding_status ON bus_boarding_status(boarding_status);
CREATE INDEX IF NOT EXISTS idx_boarding_validated ON bus_boarding_status(is_validated) WHERE is_validated = TRUE;
```

**Fonction `validate_bus_ticket`** :
```sql
CREATE OR REPLACE FUNCTION validate_bus_ticket(
    p_reservation_id TEXT,
    p_validator_user_id INTEGER,
    p_current_bus_number VARCHAR(50),
    p_current_product_id TEXT,
    p_validation_gps VARCHAR(255) DEFAULT NULL,
    p_validation_lat DOUBLE PRECISION DEFAULT NULL,
    p_validation_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_reservation RECORD;
    v_payment RECORD;
    v_product RECORD;
    v_bus_match BOOLEAN;
    v_validation_result JSONB;
BEGIN
    -- Récupérer réservation
    SELECT * INTO v_reservation
    FROM bus_reservations
    WHERE id = p_reservation_id
        AND status = 'confirmed';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Réservation non trouvée ou non confirmée'
        );
    END IF;
    
    -- Récupérer paiement
    SELECT * INTO v_payment
    FROM bus_ticket_payments
    WHERE id = ANY(
        SELECT payment_id FROM bus_ticket_payments 
        WHERE reservation_ids @> ARRAY[p_reservation_id]
    )
    LIMIT 1;
    
    -- Récupérer produit (bus)
    SELECT * INTO v_product
    FROM products
    WHERE id::text = p_current_product_id
        AND type = 'ticket_voyage';
    
    -- Vérifier que c'est le bon bus
    v_bus_match := (
        v_product.numero_bus = p_current_bus_number
        AND v_product.id::text = v_reservation.product_id
    );
    
    IF NOT v_bus_match THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Mauvais bus',
            'expected_bus', v_payment.bus_number,
            'current_bus', p_current_bus_number
        );
    END IF;
    
    -- Vérifier si déjà validé
    IF EXISTS (
        SELECT 1 FROM bus_boarding_status 
        WHERE reservation_id = p_reservation_id 
        AND is_validated = TRUE
    ) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Ticket déjà validé',
            'validated_at', (
                SELECT validated_at FROM bus_boarding_status 
                WHERE reservation_id = p_reservation_id
            )
        );
    END IF;
    
    -- Créer ou mettre à jour statut embarquement
    INSERT INTO bus_boarding_status (
        payment_id,
        reservation_id,
        product_id,
        bus_number,
        passenger_name,
        seat_id,
        seat_number,
        validated_by_user_id,
        validated_at,
        validation_location_gps,
        validation_location_lat,
        validation_location_lng,
        bus_match_confirmed,
        boarding_status,
        is_validated
    ) VALUES (
        v_payment.id,
        p_reservation_id,
        p_current_product_id,
        p_current_bus_number,
        v_reservation.passenger_name,
        v_reservation.seat_id,
        v_reservation.seat_number,
        p_validator_user_id,
        NOW(),
        p_validation_gps,
        p_validation_lat,
        p_validation_lng,
        v_bus_match,
        'boarded',
        TRUE
    )
    ON CONFLICT (reservation_id) 
    DO UPDATE SET
        validated_by_user_id = p_validator_user_id,
        validated_at = NOW(),
        validation_location_gps = p_validation_gps,
        validation_location_lat = p_validation_lat,
        validation_location_lng = p_validation_lng,
        bus_match_confirmed = v_bus_match,
        boarding_status = 'boarded',
        is_validated = TRUE,
        updated_at = NOW();
    
    -- Retourner résultat
    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Ticket validé avec succès',
        'passenger_name', v_reservation.passenger_name,
        'seat_number', v_reservation.seat_number,
        'bus_match', v_bus_match,
        'validated_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;
```

**Fonction `get_bus_boarding_summary`** :
```sql
CREATE OR REPLACE FUNCTION get_bus_boarding_summary(p_product_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_total_reservations INTEGER;
    v_boarded_passengers INTEGER;
    v_pending_passengers INTEGER;
    v_no_show_passengers INTEGER;
BEGIN
    -- Compter réservations confirmées
    SELECT COUNT(*) INTO v_total_reservations
    FROM bus_reservations
    WHERE product_id = p_product_id
        AND status = 'confirmed';
    
    -- Compter passagers embarqués
    SELECT COUNT(*) INTO v_boarded_passengers
    FROM bus_boarding_status
    WHERE product_id = p_product_id
        AND boarding_status = 'boarded'
        AND is_validated = TRUE;
    
    -- Compter en attente
    SELECT COUNT(*) INTO v_pending_passengers
    FROM bus_reservations br
    WHERE br.product_id = p_product_id
        AND br.status = 'confirmed'
        AND NOT EXISTS (
            SELECT 1 FROM bus_boarding_status bbs
            WHERE bbs.reservation_id = br.id
            AND bbs.is_validated = TRUE
        );
    
    -- Compter no-show (après heure départ + 15 min)
    SELECT COUNT(*) INTO v_no_show_passengers
    FROM bus_reservations br
    JOIN products p ON p.id::text = br.product_id
    WHERE br.product_id = p_product_id
        AND br.status = 'confirmed'
        AND (p.date_depart + INTERVAL '15 minutes') < NOW()
        AND NOT EXISTS (
            SELECT 1 FROM bus_boarding_status bbs
            WHERE bbs.reservation_id = br.id
            AND bbs.is_validated = TRUE
        );
    
    RETURN jsonb_build_object(
        'total_reservations', v_total_reservations,
        'boarded_passengers', v_boarded_passengers,
        'pending_passengers', v_pending_passengers,
        'no_show_passengers', v_no_show_passengers,
        'completion_percentage', CASE 
            WHEN v_total_reservations > 0 THEN 
                ROUND((v_boarded_passengers::FLOAT / v_total_reservations::FLOAT) * 100, 2)
            ELSE 0
        END,
        'is_complete', (v_boarded_passengers = v_total_reservations AND v_total_reservations > 0)
    );
END;
$$ LANGUAGE plpgsql;
```

#### 5.3 Backend - Contrôleur Validation

**Fichier** : `backend/src/controllers/bus_ticket_validation_controller.rs` (nouveau)

**Fonctions** :

1. **`validate_ticket_qr`** :
   - Décoder QR code (JSON)
   - Extraire `reservation_id`, `product_id`, `bus_number`
   - Appeler fonction SQL `validate_bus_ticket`
   - Vérifier que validateur est chauffeur/agent de l'agence
   - Retourner résultat validation

2. **`get_boarding_summary`** :
   - Appeler fonction SQL `get_bus_boarding_summary`
   - Retourner statistiques embarquement

3. **`get_bus_passengers_list`** :
   - Liste tous les passagers d'un bus
   - Statut embarquement pour chacun
   - Permet validation manuelle si QR code ne fonctionne pas

**Routes API** :
- `POST /api/bus-tickets/validate` : Valider ticket QR code (protégé JWT)
- `GET /api/bus-tickets/boarding/:product_id/summary` : Résumé embarquement (protégé JWT)
- `GET /api/bus-tickets/boarding/:product_id/passengers` : Liste passagers (protégé JWT)

#### 5.4 Mobile - Écran Validation Tickets (Chauffeur/Agence)

**Fichier** : `mobile/src/screens/BusTicketValidationScreen.tsx` (nouveau)

**Fonctionnalités** :

1. **Sélection Bus** :
   - Liste des bus de l'agence pour aujourd'hui
   - Ou scanner QR code du bus (si QR code fixe sur bus)
   - Afficher informations bus (numéro, trajet, heure départ)

2. **Scanner QR Code Ticket** :
   - Utiliser `expo-barcode-scanner` ou `react-native-vision-camera`
   - Scanner QR code du ticket
   - Décoder JSON
   - Appeler API validation
   - Afficher résultat (succès/erreur)

3. **Résumé Embarquement** :
   - Afficher : `X / Y passagers embarqués`
   - Barre de progression
   - Liste passagers avec statut :
     - ✅ Embarqué
     - ⏳ En attente
     - ❌ No-show

4. **Validation Manuelle** :
   - Si QR code ne fonctionne pas
   - Rechercher passager par nom
   - Valider manuellement

5. **Vérification Bon Bus** :
   - Afficher alerte si ticket scanné ne correspond pas au bus sélectionné
   - Demander confirmation si doute

**Code exemple scanner** :
```typescript
import { BarCodeScanner } from 'expo-barcode-scanner';
// ou
import { Camera } from 'expo-camera';
// ou
import { useCameraDevice, useCodeScanner } from 'react-native-vision-camera';

const handleQRCodeScanned = async (data: string) => {
    try {
        // Décoder JSON du QR code
        const qrData = JSON.parse(data);
        
        // Vérifier format
        if (qrData.type !== 'BUS_TICKET_YUKPOMNANG') {
            Alert.alert('Erreur', 'QR code invalide');
            return;
        }
        
        // Récupérer position GPS actuelle (pour vérification)
        const location = await Location.getCurrentPositionAsync();
        
        // Appeler API validation
        const response = await apiPost('/api/bus-tickets/validate', {
            reservation_id: qrData.id,
            current_bus_number: selectedBus.bus_number,
            current_product_id: selectedBus.product_id,
            validation_gps: `${location.coords.latitude},${location.coords.longitude}`,
            validation_lat: location.coords.latitude,
            validation_lng: location.coords.longitude,
        });
        
        if (response.success) {
            // Afficher succès
            Alert.alert('✅ Validé', `Passager: ${response.data.passenger_name}\nPlace: ${response.data.seat_number}`);
            // Actualiser résumé embarquement
            refreshBoardingSummary();
        } else {
            Alert.alert('Erreur', response.error || 'Validation échouée');
        }
    } catch (error) {
        Alert.alert('Erreur', 'QR code invalide ou corrompu');
    }
};
```

#### 5.5 Mobile - Vérification Position GPS

**Stratégies possibles** :

1. **QR Code Fixe sur Bus** (Recommandé) :
   - Chaque bus a un QR code unique collé dessus
   - QR code contient : `{ type: "BUS_IDENTIFIER", bus_number: "BUS-001", product_id: "uuid" }`
   - Chauffeur scanne d'abord le QR code du bus
   - Puis scanne les tickets des passagers
   - Système vérifie automatiquement que `product_id` du ticket = `product_id` du bus

2. **Sélection Manuelle** :
   - Chauffeur sélectionne le bus dans une liste
   - Système vérifie que `product_id` du ticket = bus sélectionné

3. **GPS du Validateur** :
   - Capturer position GPS du validateur
   - Comparer avec position GPS de l'agence (si disponible)
   - Vérifier que validateur est proche du point de départ

**Recommandation** : Combiner QR code bus + sélection manuelle (fallback)

#### 5.6 Sécurité et Vérifications

**Vérifications à implémenter** :

1. **Validateur autorisé** :
   - Vérifier que `validator_user_id` est propriétaire de l'agence
   - Ou est un employé autorisé (si système d'employés existe)

2. **Ticket valide** :
   - Vérifier que réservation est `confirmed`
   - Vérifier que date/heure correspond (pas de validation trop tôt/tard)
   - Vérifier que ticket n'est pas déjà validé

3. **Bon bus** :
   - Vérifier `product_id` du ticket = `product_id` du bus
   - Vérifier `bus_number` du ticket = `bus_number` du bus
   - Afficher alerte si mismatch

4. **Heure validation** :
   - Permettre validation 30 min avant départ
   - Jusqu'à 15 min après heure départ (no-show après)

---

### 6. Accès aux Réservations et Tickets

**Fichier** : `mobile/src/screens/MyBusTicketsScreen.tsx`

**Fonctionnalités** :
- Liste tous les tickets de l'utilisateur
- Filtres : À venir, Passés, Annulés
- Pour chaque ticket :
  - Informations voyage
  - Places réservées
  - Statut paiement
  - **Bouton "Voir ticket PDF"** → Ouvrir PDF
  - **Bouton "Partager ticket"** → Partager PDF
  - **QR code** pour validation (si pas encore utilisé)
  - **Bouton "Annuler"** (si conditions remplies)

**Navigation** :
- Ajouter dans `ProfileScreen` : "Mes tickets de voyage"
- Ajouter dans `HomeScreen` footer : Badge avec nombre de tickets à venir

**API** :
- `GET /api/bus-tickets/my-tickets` : Liste tickets
- `GET /api/bus-tickets/ticket/:payment_id` : Détails ticket
- `GET /api/bus-tickets/ticket/:payment_id/pdf` : Télécharger PDF

---

## 🔧 DÉTAILS TECHNIQUES - Paiement et Validation

### Format QR Code Ticket
```json
{
  "type": "BUS_TICKET_YUKPOMNANG",
  "id": "reservation_id",
  "payment_id": "payment_id",
  "product_id": "product_uuid",
  "bus_number": "BUS-001",
  "passenger": "Nom Passager",
  "seat": 12,
  "route": "Douala-Yaoundé",
  "departure": "2025-11-27 08:00",
  "validated": false,
  "timestamp": "2025-11-27T08:00:00Z"
}
```

### Calcul Commission
- **Commission Yukpo** : 5% du `subtotal` (prix ticket × nombre)
- **Reversement Agence** : `subtotal - commission`
- **Total Client** : `subtotal + booking_fee` (commission incluse dans subtotal)

### Bibliothèques Scanner QR Code
- **Option 1** : `expo-barcode-scanner` (simple, mais déprécié)
- **Option 2** : `react-native-vision-camera` avec module QR (recommandé)
- **Option 3** : `expo-camera` avec détection QR

---

## 📋 CHECKLIST - Paiement et Validation

### Backend
- [ ] Migration `20251127_add_commission_to_bus_payments.sql`
- [ ] Fonction `process_bus_ticket_payment_with_commission`
- [ ] Migration `20251127_create_bus_ticket_validation_system.sql`
- [ ] Fonction `validate_bus_ticket`
- [ ] Fonction `get_bus_boarding_summary`
- [ ] **Migration `20251127_create_bus_manual_seat_blocks.sql`** ⚠️ NOUVEAU
- [ ] **Fonction `block_bus_seat_manually`** ⚠️ NOUVEAU
- [ ] **Fonction `unblock_bus_seat_manually`** ⚠️ NOUVEAU
- [ ] **Fonction `get_bus_seat_availability_with_blocks`** ⚠️ NOUVEAU
- [ ] Contrôleur `bus_ticket_payment_controller.rs`
- [ ] Contrôleur `bus_ticket_validation_controller.rs`
- [ ] Contrôleur `agency_boarding_controller.rs`
- [ ] **Contrôleur `agency_seat_management_controller.rs`** ⚠️ NOUVEAU
- [ ] Routes API paiement et validation
- [ ] Routes API gestion embarquement agence
- [ ] **Routes API gestion places manuelles** ⚠️ NOUVEAU
- [ ] Intégration auto_migrate.rs
- [ ] Intégration 0000_create_all_tables.sql

### Mobile
- [ ] Affichage commission séparée dans UI paiement
- [ ] Écran `MyBusTicketsScreen.tsx` (client)
- [ ] Navigation vers "Mes tickets" (ProfileScreen, HomeScreen)
- [ ] Écran `AgencyTicketManagementScreen.tsx` (agence)
- [ ] Écran `BusBoardingManagementScreen.tsx` (agence)
- [ ] **Écran `ManageBusSeatsScreen.tsx` (agence)** ⚠️ NOUVEAU
- [ ] Scanner QR code tickets (expo-barcode-scanner ou react-native-vision-camera)
- [ ] Affichage résumé embarquement
- [ ] Liste passagers avec statuts
- [ ] Validation manuelle (fallback)
- [ ] Navigation depuis page gestion tickets agence
- [ ] **Plan des sièges avec blocage manuel** ⚠️ NOUVEAU
- [ ] **Sélection multiple places à bloquer/débloquer** ⚠️ NOUVEAU
- [ ] **Modal raison de blocage** ⚠️ NOUVEAU

### Frontend
- [ ] Page `AgencyTicketManagementPage.tsx` (agence)
- [ ] Page `BusBoardingManagementPage.tsx` (agence)
- [ ] **Page `ManageBusSeatsPage.tsx` (agence)** ⚠️ NOUVEAU
- [ ] Scanner QR code webcam (html5-qrcode)
- [ ] Affichage résumé embarquement
- [ ] Tableau passagers avec validation
- [ ] Validation manuelle (fallback)
- [ ] Navigation depuis page gestion tickets agence
- [ ] **Plan des sièges interactif avec blocage manuel** ⚠️ NOUVEAU
- [ ] **Sélection multiple places (clic + Ctrl/Cmd)** ⚠️ NOUVEAU
- [ ] Routes dans App.tsx

---

### 6. Page de Gestion d'Embarquement pour Agences de Voyage 🚌 PRIORITÉ CRITIQUE

**Objectif** : Créer une page dédiée pour les agences de voyage permettant de gérer facilement l'embarquement des passagers avec validation des tickets.

#### 6.1 Architecture et Navigation

**Emplacement** : Cette page doit être accessible depuis la **page de gestion des tickets de voyage de l'agence**.

**Structure Navigation** :
```
Page Gestion Tickets Agence (AgencyTicketManagementPage)
├── En-tête avec lien "Gestion Embarquement" → BusBoardingManagementPage
└── Liste des tickets/voyages
```

**Accès** :
- **Mobile** : `mobile/src/screens/agency/AgencyTicketManagementScreen.tsx` → Lien dans header → `BusBoardingManagementScreen.tsx`
- **Frontend** : `frontend/src/pages/agency/AgencyTicketManagementPage.tsx` → Lien dans header → `BusBoardingManagementPage.tsx`

**Vérification Permissions** :
- Seuls les utilisateurs propriétaires d'une agence de voyage peuvent accéder
- Vérifier que `user_id` possède une entrée dans `agences_voyage`

#### 6.2 Backend - Routes API pour Gestion Embarquement

**Fichier** : `backend/src/routes/specialized_services_routes.rs` (ajouter routes)

**Routes à ajouter** :
```rust
// Routes pour gestion embarquement (protégées JWT + vérification agence)
router = router
    .route("/api/agency/bus-tickets", get(get_agency_bus_tickets)) // Liste tickets agence
    .route("/api/agency/bus-tickets/:product_id/boarding", get(get_bus_boarding_details)) // Détails embarquement
    .route("/api/agency/bus-tickets/validate", post(validate_ticket_for_boarding)) // Valider ticket
    .route("/api/agency/bus-tickets/:product_id/boarding/summary", get(get_boarding_summary)) // Résumé embarquement
    .route("/api/agency/bus-tickets/:product_id/passengers", get(get_bus_passengers_list)); // Liste passagers
```

**Contrôleur** : `backend/src/controllers/agency_boarding_controller.rs` (nouveau)

**Fonctions** :

1. **`get_agency_bus_tickets`** :
   - Récupérer tous les tickets/voyages de l'agence
   - Filtrer par date (aujourd'hui, à venir, passés)
   - Inclure nombre de passagers, statut embarquement

2. **`get_bus_boarding_details`** :
   - Détails complets d'embarquement pour un bus spécifique
   - Liste tous les passagers avec statut
   - Résumé (embarqués / total)

3. **`validate_ticket_for_boarding`** :
   - Valider un ticket (QR code ou manuel)
   - Appeler fonction SQL `validate_bus_ticket`
   - Retourner résultat

4. **`get_boarding_summary`** :
   - Appeler fonction SQL `get_bus_boarding_summary`
   - Retourner statistiques

5. **`get_bus_passengers_list`** :
   - Liste détaillée de tous les passagers d'un bus
   - Statut embarquement pour chacun
   - Permet validation manuelle

#### 6.3 Mobile - Page Gestion Tickets Agence

**Fichier** : `mobile/src/screens/agency/AgencyTicketManagementScreen.tsx` (nouveau)

**Fonctionnalités** :
- Liste des voyages/tickets de l'agence
- Filtres : Aujourd'hui, À venir, Passés
- Pour chaque voyage :
  - Informations (trajet, date, heure)
  - Nombre de passagers
  - Statut embarquement (X/Y embarqués)
  - Bouton "Gérer embarquement" → Navigue vers `BusBoardingManagementScreen`

**En-tête avec lien** :
```typescript
<View style={styles.header}>
    <Text style={styles.title}>Mes Tickets de Voyage</Text>
    {selectedTrip && (
        <TouchableOpacity
            style={styles.boardingButton}
            onPress={() => navigation.navigate('BusBoardingManagement', {
                productId: selectedTrip.product_id,
                busNumber: selectedTrip.bus_number,
            })}
        >
            <SafeIcon name="users" size={18} color={modernColors.primary} />
            <Text style={styles.boardingButtonText}>Gestion Embarquement</Text>
        </TouchableOpacity>
    )}
</View>
```

#### 6.4 Mobile - Page Gestion Embarquement

**Fichier** : `mobile/src/screens/agency/BusBoardingManagementScreen.tsx` (nouveau)

**Fonctionnalités complètes** :

1. **Sélection Bus** (si plusieurs bus aujourd'hui) :
   - Dropdown ou liste des bus de l'agence pour aujourd'hui
   - Afficher informations bus (numéro, trajet, heure départ)

2. **Résumé Embarquement** (en haut) :
   ```typescript
   <View style={styles.summaryCard}>
       <Text style={styles.summaryTitle}>Résumé Embarquement</Text>
       <View style={styles.summaryStats}>
           <View style={styles.statItem}>
               <Text style={styles.statValue}>{boardedCount}</Text>
               <Text style={styles.statLabel}>Embarqués</Text>
           </View>
           <View style={styles.statItem}>
               <Text style={styles.statValue}>{totalPassengers}</Text>
               <Text style={styles.statLabel}>Total</Text>
           </View>
           <View style={styles.statItem}>
               <Text style={styles.statValue}>{pendingCount}</Text>
               <Text style={styles.statLabel}>En attente</Text>
           </View>
       </View>
       <View style={styles.progressBar}>
           <View style={[styles.progressFill, { width: `${completionPercentage}%` }]} />
       </View>
       <Text style={styles.progressText}>{completionPercentage}% complété</Text>
   </View>
   ```

3. **Scanner QR Code** :
   - Bouton "Scanner ticket" → Ouvre scanner
   - Utiliser `expo-barcode-scanner` ou `react-native-vision-camera`
   - Décoder QR code et valider automatiquement
   - Afficher résultat (succès/erreur)

4. **Liste Passagers** :
   - Liste scrollable de tous les passagers
   - Pour chaque passager :
     - Nom
     - Place (numéro)
     - Statut :
       - ✅ **Embarqué** (vert) - avec heure validation
       - ⏳ **En attente** (orange)
       - ❌ **No-show** (rouge) - si après heure départ + 15 min
     - Bouton "Valider" si pas encore embarqué

5. **Validation Manuelle** :
   - Si QR code ne fonctionne pas
   - Rechercher passager par nom
   - Bouton "Valider manuellement"
   - Confirmation avant validation

6. **Vérification Bon Bus** :
   - Afficher alerte si ticket scanné ne correspond pas au bus
   - Message : "⚠️ Ce ticket n'est pas pour ce bus. Vérifier le numéro de bus."

7. **Filtres Liste** :
   - Tous
   - Embarqués uniquement
   - En attente uniquement
   - No-show uniquement

**Code Scanner QR Code** :
```typescript
import { BarCodeScanner } from 'expo-barcode-scanner';
// ou
import { Camera, useCameraDevice, useCodeScanner } from 'react-native-vision-camera';

const [hasPermission, setHasPermission] = useState<boolean | null>(null);
const [scanned, setScanned] = useState(false);
const [showScanner, setShowScanner] = useState(false);

useEffect(() => {
    (async () => {
        const { status } = await BarCodeScanner.requestPermissionsAsync();
        setHasPermission(status === 'granted');
    })();
}, []);

const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned) return;
    
    setScanned(true);
    
    try {
        // Décoder JSON du QR code
        const qrData = JSON.parse(data);
        
        // Vérifier format
        if (qrData.type !== 'BUS_TICKET_YUKPOMNANG') {
            Alert.alert('Erreur', 'QR code invalide');
            setScanned(false);
            return;
        }
        
        // Récupérer position GPS actuelle
        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
        });
        
        // Appeler API validation
        const response = await apiPost('/api/agency/bus-tickets/validate', {
            reservation_id: qrData.id,
            current_bus_number: selectedBus.bus_number,
            current_product_id: selectedBus.product_id,
            validation_gps: `${location.coords.latitude},${location.coords.longitude}`,
            validation_lat: location.coords.latitude,
            validation_lng: location.coords.longitude,
        });
        
        if (response.success) {
            Alert.alert(
                '✅ Ticket validé',
                `Passager: ${response.data.passenger_name}\nPlace: ${response.data.seat_number}`,
                [{ text: 'OK', onPress: () => {
                    setShowScanner(false);
                    refreshBoardingData();
                }}]
            );
        } else {
            Alert.alert('Erreur', response.error || 'Validation échouée');
            setScanned(false);
        }
    } catch (error) {
        Alert.alert('Erreur', 'QR code invalide ou corrompu');
        setScanned(false);
    }
};

// Dans le render
{showScanner && hasPermission && (
    <Modal visible={showScanner} animationType="slide">
        <View style={styles.scannerContainer}>
            <BarCodeScanner
                onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
                style={StyleSheet.absoluteFillObject}
            />
            <TouchableOpacity
                style={styles.closeScannerButton}
                onPress={() => {
                    setShowScanner(false);
                    setScanned(false);
                }}
            >
                <Text style={styles.closeScannerText}>Fermer</Text>
            </TouchableOpacity>
        </View>
    </Modal>
)}
```

#### 6.5 Frontend - Page Gestion Tickets Agence

**Fichier** : `frontend/src/pages/agency/AgencyTicketManagementPage.tsx` (nouveau)

**Fonctionnalités** :
- Même structure que version mobile
- Tableau des voyages avec colonnes :
  - Trajet
  - Date/Heure
  - Nombre passagers
  - Statut embarquement
  - Actions (bouton "Gérer embarquement")

**En-tête avec lien** :
```tsx
<div className="flex justify-between items-center mb-6">
    <h1 className="text-2xl font-bold">Mes Tickets de Voyage</h1>
    {selectedTrip && (
        <Link
            to={`/agency/bus-boarding/${selectedTrip.product_id}`}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
            <Users className="w-5 h-5" />
            Gestion Embarquement
        </Link>
    )}
</div>
```

#### 6.6 Frontend - Page Gestion Embarquement

**Fichier** : `frontend/src/pages/agency/BusBoardingManagementPage.tsx` (nouveau)

**Fonctionnalités** :
- Même structure que version mobile
- Interface web adaptée :
  - Résumé en carte en haut
  - Scanner QR code via webcam (si navigateur supporte)
  - Tableau des passagers avec colonnes :
    - Nom
    - Place
    - Statut
    - Actions (bouton "Valider")
  - Filtres en sidebar ou dropdown

**Scanner QR Code Web** :
```tsx
import { Html5Qrcode } from 'html5-qrcode';

const [scannerActive, setScannerActive] = useState(false);
const html5QrCode = useRef<Html5Qrcode | null>(null);

const startScanner = async () => {
    try {
        html5QrCode.current = new Html5Qrcode("reader");
        await html5QrCode.current.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 }
            },
            (decodedText) => {
                handleQRCodeScanned(decodedText);
            },
            (errorMessage) => {
                // Ignorer erreurs
            }
        );
        setScannerActive(true);
    } catch (err) {
        console.error('Erreur scanner:', err);
    }
};

const stopScanner = () => {
    if (html5QrCode.current) {
        html5QrCode.current.stop().then(() => {
            setScannerActive(false);
        });
    }
};
```

#### 6.7 Navigation et Routes

**Mobile - AppNavigator.tsx** :
```typescript
// Ajouter dans SecondaryStack ou créer AgencyStack
<Stack.Screen
    name="AgencyTicketManagement"
    component={AgencyTicketManagementScreenWithSafeArea}
    options={{ title: 'Mes Tickets' }}
/>
<Stack.Screen
    name="BusBoardingManagement"
    component={BusBoardingManagementScreenWithSafeArea}
    options={{ title: 'Gestion Embarquement' }}
/>
```

**Frontend - Routes** :
```tsx
// Dans App.tsx ou router
<Route path="/agency/tickets" element={<AgencyTicketManagementPage />} />
<Route path="/agency/bus-boarding/:productId" element={<BusBoardingManagementPage />} />
```

**Accès depuis Profile** :
- Si utilisateur est propriétaire d'une agence de voyage
- Ajouter lien "Mes Tickets de Voyage" dans ProfileScreen/ProfilePage
- Navigue vers `AgencyTicketManagementScreen/Page`

#### 6.7 Gestion Manuelle des Places Non Disponibles 🚫 PRIORITÉ IMPORTANTE

**Objectif** : Permettre à l'agence de marquer manuellement des places comme non disponibles pour gérer les ventes hors application (vente physique, autres canaux, maintenance, etc.).

#### 6.7.1 Backend - Table et Fonctions SQL

**Migration** : `backend/migrations/20251127_create_bus_manual_seat_blocks.sql`

**⚠️ CONTRAINTES SQLx OFFLINE** :
- Compatible SQLx offline mode
- Intégrer dans `auto_migrate.rs` et `0000_create_all_tables.sql`

**Table `bus_manual_seat_blocks`** :
```sql
CREATE TABLE IF NOT EXISTS bus_manual_seat_blocks (
    id SERIAL PRIMARY KEY,
    product_id TEXT NOT NULL, -- ID du produit (bus)
    agency_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seat_id VARCHAR(50) NOT NULL, -- Format: "row-col"
    seat_number INTEGER NOT NULL,
    
    -- Raison du blocage
    block_reason VARCHAR(100) DEFAULT 'sold_outside_app', -- 'sold_outside_app', 'maintenance', 'reserved', 'other'
    block_notes TEXT, -- Notes optionnelles
    
    -- Gestion
    blocked_by_user_id INTEGER NOT NULL REFERENCES users(id), -- Qui a bloqué
    blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unblocked_at TIMESTAMPTZ, -- Si débloqué
    is_active BOOLEAN DEFAULT TRUE, -- Si toujours actif
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT unique_active_block UNIQUE(product_id, seat_id) WHERE is_active = TRUE
);

CREATE INDEX IF NOT EXISTS idx_manual_blocks_product ON bus_manual_seat_blocks(product_id);
CREATE INDEX IF NOT EXISTS idx_manual_blocks_agency ON bus_manual_seat_blocks(agency_user_id);
CREATE INDEX IF NOT EXISTS idx_manual_blocks_active ON bus_manual_seat_blocks(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_manual_blocks_seat ON bus_manual_seat_blocks(seat_id);
```

**Fonction `block_bus_seat_manually`** :
```sql
CREATE OR REPLACE FUNCTION block_bus_seat_manually(
    p_product_id TEXT,
    p_agency_user_id INTEGER,
    p_seat_id VARCHAR(50),
    p_seat_number INTEGER,
    p_block_reason VARCHAR(100) DEFAULT 'sold_outside_app',
    p_block_notes TEXT DEFAULT NULL,
    p_blocked_by_user_id INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_product RECORD;
    v_agency RECORD;
    v_existing_reservation RECORD;
    v_block_id INTEGER;
BEGIN
    -- Vérifier que le produit existe et est un ticket de voyage
    SELECT * INTO v_product
    FROM products
    WHERE id::text = p_product_id
        AND type = 'ticket_voyage';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Produit non trouvé ou n''est pas un ticket de voyage'
        );
    END IF;
    
    -- Vérifier que l'utilisateur est propriétaire de l'agence
    SELECT * INTO v_agency
    FROM agences_voyage
    WHERE user_id = p_agency_user_id
        AND is_active = TRUE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Vous n''êtes pas propriétaire d''une agence de voyage'
        );
    END IF;
    
    -- Vérifier que la place n'est pas déjà réservée (via app)
    SELECT * INTO v_existing_reservation
    FROM bus_reservations
    WHERE product_id = p_product_id
        AND seat_id = p_seat_id
        AND status IN ('pending', 'confirmed');
    
    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Cette place est déjà réservée via l''application',
            'reservation_id', v_existing_reservation.id
        );
    END IF;
    
    -- Vérifier si déjà bloquée
    IF EXISTS (
        SELECT 1 FROM bus_manual_seat_blocks
        WHERE product_id = p_product_id
        AND seat_id = p_seat_id
        AND is_active = TRUE
    ) THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Cette place est déjà bloquée manuellement'
        );
    END IF;
    
    -- Créer le blocage
    INSERT INTO bus_manual_seat_blocks (
        product_id,
        agency_user_id,
        seat_id,
        seat_number,
        block_reason,
        block_notes,
        blocked_by_user_id,
        is_active
    ) VALUES (
        p_product_id,
        p_agency_user_id,
        p_seat_id,
        p_seat_number,
        p_block_reason,
        p_block_notes,
        p_blocked_by_user_id,
        TRUE
    )
    RETURNING id INTO v_block_id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Place bloquée avec succès',
        'block_id', v_block_id,
        'seat_id', p_seat_id,
        'seat_number', p_seat_number
    );
END;
$$ LANGUAGE plpgsql;
```

**Fonction `unblock_bus_seat_manually`** :
```sql
CREATE OR REPLACE FUNCTION unblock_bus_seat_manually(
    p_product_id TEXT,
    p_seat_id VARCHAR(50),
    p_agency_user_id INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_block RECORD;
BEGIN
    -- Vérifier que le blocage existe et appartient à l'agence
    SELECT * INTO v_block
    FROM bus_manual_seat_blocks
    WHERE product_id = p_product_id
        AND seat_id = p_seat_id
        AND agency_user_id = p_agency_user_id
        AND is_active = TRUE;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'Blocage non trouvé ou déjà débloqué'
        );
    END IF;
    
    -- Débloquer
    UPDATE bus_manual_seat_blocks
    SET 
        is_active = FALSE,
        unblocked_at = NOW(),
        updated_at = NOW()
    WHERE id = v_block.id;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Place débloquée avec succès',
        'seat_id', p_seat_id
    );
END;
$$ LANGUAGE plpgsql;
```

**Fonction `get_bus_seat_availability_with_blocks`** :
```sql
CREATE OR REPLACE FUNCTION get_bus_seat_availability_with_blocks(p_product_id TEXT)
RETURNS JSONB AS $$
DECLARE
    v_product RECORD;
    v_seat_map JSONB;
    v_reserved_seats TEXT[];
    v_blocked_seats TEXT[];
    v_available_seats JSONB;
    v_result JSONB;
BEGIN
    -- Récupérer produit
    SELECT * INTO v_product
    FROM products
    WHERE id::text = p_product_id
        AND type = 'ticket_voyage';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', FALSE, 'error', 'Produit non trouvé');
    END IF;
    
    -- Récupérer plan des sièges
    v_seat_map := v_product.seat_map;
    
    -- Récupérer places réservées (via app)
    SELECT ARRAY_AGG(seat_id) INTO v_reserved_seats
    FROM bus_reservations
    WHERE product_id = p_product_id
        AND status IN ('pending', 'confirmed');
    
    -- Récupérer places bloquées manuellement
    SELECT ARRAY_AGG(seat_id) INTO v_blocked_seats
    FROM bus_manual_seat_blocks
    WHERE product_id = p_product_id
        AND is_active = TRUE;
    
    -- Construire résultat avec statuts
    v_available_seats := jsonb_build_object(
        'seat_map', v_seat_map,
        'reserved_seats', COALESCE(v_reserved_seats, ARRAY[]::TEXT[]),
        'blocked_seats', COALESCE(v_blocked_seats, ARRAY[]::TEXT[]),
        'total_seats', v_product.total_seats,
        'available_count', (
            v_product.total_seats 
            - COALESCE(array_length(v_reserved_seats, 1), 0)
            - COALESCE(array_length(v_blocked_seats, 1), 0)
        )
    );
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'data', v_available_seats
    );
END;
$$ LANGUAGE plpgsql;
```

#### 6.7.2 Backend - Contrôleur

**Fichier** : `backend/src/controllers/agency_seat_management_controller.rs` (nouveau)

**Fonctions** :

1. **`block_seat`** :
   - Appeler fonction SQL `block_bus_seat_manually`
   - Vérifier permissions agence
   - Retourner résultat

2. **`unblock_seat`** :
   - Appeler fonction SQL `unblock_bus_seat_manually`
   - Vérifier permissions agence
   - Retourner résultat

3. **`block_multiple_seats`** :
   - Bloquer plusieurs places en une fois
   - Appeler `block_bus_seat_manually` pour chaque place
   - Retourner résultats

4. **`get_seat_availability_with_blocks`** :
   - Appeler fonction SQL `get_bus_seat_availability_with_blocks`
   - Retourner disponibilité avec distinction réservé/bloqué

**Routes API** :
```rust
router = router
    .route("/api/agency/bus-tickets/:product_id/seats/block", post(block_seat))
    .route("/api/agency/bus-tickets/:product_id/seats/unblock", post(unblock_seat))
    .route("/api/agency/bus-tickets/:product_id/seats/block-multiple", post(block_multiple_seats))
    .route("/api/agency/bus-tickets/:product_id/seats/availability", get(get_seat_availability_with_blocks));
```

#### 6.7.3 Mobile - Interface Gestion Places

**Fichier** : `mobile/src/screens/agency/ManageBusSeatsScreen.tsx` (nouveau)

**Fonctionnalités** :

1. **Plan des sièges interactif** :
   - Afficher tous les sièges avec statuts visuels :
     - 🟢 **Disponible** : Vert clair, cliquable
     - 🔵 **Réservé (via app)** : Bleu, non cliquable, avec badge "Réservé"
     - 🔴 **Bloqué manuellement** : Rouge, cliquable pour débloquer, avec badge "Bloqué"
     - ⚫ **Occupé** : Gris foncé (réservé + bloqué, ne devrait pas arriver)

2. **Sélection multiple** :
   - Mode "Bloquer" : Sélectionner plusieurs places → Bouton "Bloquer sélection"
   - Mode "Débloquer" : Sélectionner places bloquées → Bouton "Débloquer sélection"

3. **Raison de blocage** :
   - Modal pour sélectionner raison :
     - "Vendu hors application"
     - "Maintenance"
     - "Réservé (autre canal)"
     - "Autre" (avec champ notes)

4. **Statistiques** :
   - Total places
   - Disponibles
   - Réservées (via app)
   - Bloquées manuellement

**Code exemple** :
```typescript
const [seatMap, setSeatMap] = useState<any[]>([]);
const [reservedSeats, setReservedSeats] = useState<string[]>([]);
const [blockedSeats, setBlockedSeats] = useState<string[]>([]);
const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
const [mode, setMode] = useState<'view' | 'block' | 'unblock'>('view');

const loadSeatAvailability = async () => {
    const response = await apiGet(`/api/agency/bus-tickets/${productId}/seats/availability`);
    if (response.success) {
        setSeatMap(response.data.seat_map);
        setReservedSeats(response.data.reserved_seats || []);
        setBlockedSeats(response.data.blocked_seats || []);
    }
};

const getSeatStatus = (seatId: string) => {
    if (reservedSeats.includes(seatId)) {
        return 'reserved'; // Réservé via app
    }
    if (blockedSeats.includes(seatId)) {
        return 'blocked'; // Bloqué manuellement
    }
    return 'available'; // Disponible
};

const handleSeatPress = (seatId: string) => {
    const status = getSeatStatus(seatId);
    
    if (status === 'reserved') {
        Alert.alert('Place réservée', 'Cette place est réservée via l\'application');
        return;
    }
    
    if (mode === 'block' && status === 'available') {
        // Ajouter à sélection pour blocage
        setSelectedSeats([...selectedSeats, seatId]);
    } else if (mode === 'unblock' && status === 'blocked') {
        // Ajouter à sélection pour déblocage
        setSelectedSeats([...selectedSeats, seatId]);
    }
};

const handleBlockSeats = async () => {
    if (selectedSeats.length === 0) return;
    
    // Afficher modal pour raison
    setShowReasonModal(true);
};

const confirmBlockSeats = async (reason: string, notes?: string) => {
    const response = await apiPost(`/api/agency/bus-tickets/${productId}/seats/block-multiple`, {
        seats: selectedSeats.map(seatId => ({
            seat_id: seatId,
            seat_number: getSeatNumber(seatId),
        })),
        block_reason: reason,
        block_notes: notes,
    });
    
    if (response.success) {
        Alert.alert('Succès', `${selectedSeats.length} place(s) bloquée(s)`);
        setSelectedSeats([]);
        setMode('view');
        loadSeatAvailability();
    }
};
```

#### 6.7.4 Frontend - Interface Gestion Places

**Fichier** : `frontend/src/pages/agency/ManageBusSeatsPage.tsx` (nouveau)

**Fonctionnalités** :
- Même structure que version mobile
- Plan des sièges en grille interactive
- Sélection multiple avec clic + Ctrl/Cmd
- Modal pour raison de blocage
- Statistiques en sidebar

**Navigation** :
- Accessible depuis `AgencyTicketManagementPage`
- Bouton "Gérer places" sur chaque voyage
- Ou depuis `BusBoardingManagementPage` (onglet "Places")

#### 6.7.5 Intégration dans Pages Existantes

**Dans `AgencyTicketManagementScreen.tsx`** :
- Ajouter bouton "Gérer places" sur chaque voyage
- Navigue vers `ManageBusSeatsScreen`

**Dans `BusBoardingManagementScreen.tsx`** :
- Ajouter onglet "Places" à côté de "Embarquement"
- Afficher plan des sièges avec statuts
- Permet blocage/déblocage rapide

**Dans `BusSeatSelector.tsx` (client)** :
- Utiliser `get_bus_seat_availability_with_blocks` au lieu de `get_bus_seat_availability`
- Afficher places bloquées comme non disponibles (rouge, non cliquables)
- Message : "Cette place n'est pas disponible"

---

#### 6.8 Vérification Permissions

**Backend - Middleware** :
```rust
// Dans agency_boarding_controller.rs
async fn verify_agency_ownership(
    user_id: i32,
    pool: &PgPool,
) -> Result<i32, AppError> {
    let agency = sqlx::query_as!(
        Agency,
        "SELECT * FROM agences_voyage WHERE user_id = $1 AND is_active = TRUE",
        user_id
    )
    .fetch_optional(pool)
    .await?;
    
    if agency.is_none() {
        return Err(AppError::Forbidden("Vous n'êtes pas propriétaire d'une agence de voyage"));
    }
    
    Ok(agency.unwrap().id)
}
```

**Mobile/Frontend - Vérification** :
```typescript
// Vérifier au montage de la page
useEffect(() => {
    const checkAgencyOwnership = async () => {
        const response = await apiGet('/api/agences-voyage/my-agency');
        if (!response.success || !response.data) {
            // Rediriger vers page d'erreur ou profil
            navigation.navigate('Profile');
            Alert.alert('Erreur', 'Vous devez être propriétaire d\'une agence de voyage');
        } else {
            setAgencyData(response.data);
        }
    };
    checkAgencyOwnership();
}, []);
```

---

## 🎯 ORDRE DE PRIORITÉ - Paiement et Validation

1. **Paiement avec commission** (2h)
   - Migration SQL
   - Fonction calcul commission
   - Contrôleur paiement
   - Affichage commission dans UI

2. **Page Mes Tickets (Client)** (1h)
   - Écran liste tickets
   - Navigation
   - Affichage QR code

3. **Page Gestion Tickets Agence** (1-2h)
   - Mobile : `AgencyTicketManagementScreen.tsx`
   - Frontend : `AgencyTicketManagementPage.tsx`
   - Liste tickets agence
   - Lien vers gestion embarquement

4. **Système validation** (3-4h)
   - Migration SQL
   - Fonctions validation
   - Contrôleur validation
   - **Page gestion embarquement (Mobile + Frontend)** ⚠️
   - Scanner QR code
   - Tests complets

---

### 5. Améliorer formulaire frontend

**Fichier** : `frontend/src/pages/specialized/AgenceVoyageForm.tsx`

**Objectif** : Même structure que mobile avec composants React.

**Étapes** :
- Répliquer la logique de `AgenceVoyageFormScreen.tsx`
- Utiliser composants React équivalents
- Adapter styles avec TailwindCSS
- Créer composant `BusModelForm` frontend si nécessaire

---

## 🔧 DÉTAILS TECHNIQUES IMPORTANTS

### Format `bus_products_config` dans `agences_voyage`
```json
{
  "modeles_bus": [
    {
      "product_id": "uuid-du-product",
      "nom_modele": "Luxury VIP",
      "total_seats": 50,
      "classe": "VIP",
      "prix_base": 15000,
      "equipements": ["WiFi", "Climatisation", "Toilettes"]
    }
  ]
}
```

### Format `seat_map` dans `products`
```json
[
  {
    "row": 1,
    "col": 1,
    "seat_id": "1-1",
    "seat_number": 1,
    "type": "standard",
    "available": true
  },
  {
    "row": 1,
    "col": 2,
    "seat_id": "1-2",
    "seat_number": 2,
    "type": "standard",
    "available": false
  }
]
```

### Format `bus_configuration` dans `products`
```json
{
  "rows": 10,
  "seatsPerRow": 4,
  "firstRowSeats": 2,
  "allSeatsAvailable": true
}
```

### API Endpoints disponibles
- `GET /api/bus-tickets/search` : Recherche tickets avec filtres
- `GET /api/bus-tickets/:product_id/availability` : Disponibilité places
- `POST /api/bus-tickets/link` : Lier produit à agence (JWT requis)
- `POST /api/bus-reservations` : Créer réservation (système existant)
- `POST /api/products` : Créer produit (vérifier endpoint exact)

### Calcul disponibilité
- Places disponibles = `total_seats` - `COUNT(bus_reservations WHERE status IN ('pending', 'confirmed') AND expires_at > NOW())`
- Les réservations expirées sont automatiquement libérées

---

## 📚 FICHIERS DE RÉFÉRENCE

### Backend
- `backend/migrations/20251127_integrate_bus_tickets_with_agences_voyage.sql`
- `backend/src/controllers/bus_ticket_controller.rs`
- `backend/src/routes/specialized_services_routes.rs`
- `backend/migrations/20250125_create_bus_reservations.sql` (système existant)

### Mobile
- `mobile/src/components/bus/BusModelForm.tsx` ✅
- `mobile/src/components/bus/BusTicketCard.tsx` ✅
- `mobile/src/screens/specialized/AgenceVoyageFormScreen.tsx` (à compléter)
- `mobile/src/components/specialized/AgenceVoyageResultCard.tsx` (à améliorer)
- `mobile/src/screens/ResultatBesoinScreen.tsx` (à intégrer)
- `mobile/src/utils/busTicketPdfGenerator.ts` (système existant)

### Documentation
- `RESUME_INTEGRATION_TICKETS_BUS.md`
- `RESUME_INTEGRATION_TICKETS_BUS_COMPLETE.md`
- `RESUME_FORMULAIRES_ET_AFFICHAGE_TICKETS_BUS.md`
- `RESUME_FINAL_FORMULAIRES_AFFICHAGE.md`

---

## 🎯 ORDRE DE PRIORITÉ RECOMMANDÉ

1. **Compléter `handleSubmit` dans AgenceVoyageFormScreen** (30 min)
   - Créer produits après création agence
   - Lier produits à agence
   - Tester création complète

2. **Créer BusSeatSelector** (1-2h)
   - Composant modal interactif
   - Récupération disponibilité
   - Sélection visuelle
   - Intégration réservation

3. **Améliorer AgenceVoyageResultCard** (30 min)
   - Intégrer BusTicketCard
   - Gérer navigation

4. **Intégrer dans ResultatBesoinScreen** (30 min)
   - Détection tickets bus
   - Affichage avec BusSeatSelector

5. **Améliorer formulaire frontend** (1h)
   - Répliquer logique mobile

---

## ✅ CHECKLIST FINALE

### Tickets Bus - Backend
- [x] Migration SQL
- [x] Fonctions SQL
- [x] Contrôleur Rust
- [x] Routes API
- [x] Intégration auto_migrate

### Tickets Bus - Mobile Composants
- [x] BusModelForm
- [x] BusTicketCard
- [ ] BusSeatSelector ⚠️
- [ ] Amélioration AgenceVoyageResultCard ⚠️

### Tickets Bus - Mobile Formulaires
- [x] AgenceVoyageFormScreen (section modèles)
- [ ] handleSubmit complet (création produits + liaison) ⚠️

### Tickets Bus - Mobile Intégration
- [ ] Navigation vers sélection sièges
- [ ] Réservation avec système existant
- [ ] Intégration dans ResultatBesoinScreen ⚠️

### Tickets Bus - Frontend
- [ ] AgenceVoyageForm amélioré

---

### Banque de Sang - Backend
- [x] Migration SQL (compatible SQLx offline)
- [x] Fonctions SQL (search_banques_sang_with_moment)
- [x] Contrôleur Rust (blood_bank_controller.rs)
- [x] Routes API (search, get, create, update_stocks)
- [x] Intégration auto_migrate.rs
- [x] Intégration 0000_create_all_tables.sql

### Banque de Sang - Mobile Composants
- [x] BloodBankResultCard (basique)
- [ ] **Amélioration BloodBankResultCard** ⚠️ PRIORITAIRE :
  - [ ] Gestion stocks détaillée avec indicateurs visuels
  - [ ] Intégration ChatModalMobile (comme ProductCard)
  - [ ] **Intégration OrderDeliveryModal (livraison intelligente Yukpo)** ⚠️
  - [ ] Bouton "Voir détails stocks"
  - [ ] Affichage date dernière mise à jour

### Pharmacies - Mobile Composants
- [x] PharmacieResultCard (basique)
- [ ] **Amélioration PharmacieResultCard** ⚠️ PRIORITAIRE :
  - [ ] **Intégration OrderDeliveryModal (livraison intelligente Yukpo)** ⚠️
  - [ ] Intégration ChatModalMobile (optionnel)
  - [ ] Améliorations UI si nécessaire

**⚠️ IMPORTANT** : Les deux composants (`BloodBankResultCard` et `PharmacieResultCard`) doivent avoir le même bouton "Livraison" que `ProductCard` pour utiliser le système de livraison intelligent de Yukpo.

- [ ] BloodBankStocksModal (nouveau composant) ⚠️

### Banque de Sang - Mobile Formulaires
- [x] BanqueSangFormScreen (basique)
- [ ] **Amélioration BanqueSangFormScreen** ⚠️ :
  - [ ] Interface avancée gestion stocks
  - [ ] Mise à jour en temps réel
  - [ ] Validation stocks

### Banque de Sang - Intégration
- [ ] Connexion chat modal avec service_id
- [ ] Connexion livraison automatique
- [ ] Mise à jour stocks après livraison
- [ ] Tests flux complet (recherche → chat → commande → livraison → mise à jour stocks)

---

## 🚀 COMMANDES UTILES

```bash
# Backend
cargo check
cargo build
cargo test
cargo clippy

# Mobile
npm run android
npm run ios

# Frontend
npm run dev
npm run build
```

---

## 🩸 PARTIE 2 : BANQUE DE SANG - AMÉLIORATIONS CRITIQUES

### ✅ CE QUI EST COMPLÉTÉ

#### 1. Backend (100% complété)
- **Table** : `banques_sang` avec colonne `stocks_groupes_sanguins JSONB`
- **Migration** : `backend/migrations/20251127_create_banques_sang_table.sql`
  - Compatible SQLx offline mode ✅
  - Intégré dans `auto_migrate.rs` via `ensure_banques_sang_table()` ✅
  - Intégré dans `0000_create_all_tables.sql` ✅
- **Contrôleur** : `backend/src/controllers/blood_bank_controller.rs`
  - `create_blood_bank()` : Création banque de sang
  - `search_blood_banks()` : Recherche avec filtres (groupe sanguin, urgence)
  - `get_blood_bank()` : Récupération par ID
  - `update_blood_bank_stocks()` : **Mise à jour stocks avec timestamp automatique** ✅
- **Fonction SQL** : `search_banques_sang_with_moment()` dans `20251126_search_specialized_services_with_moment.sql`
- **Routes API** : `backend/src/routes/specialized_services_routes.rs`
  - `GET /api/banques-sang/search` : Recherche publique
  - `GET /api/banques-sang/:id` : Récupération par ID
  - `POST /api/banques-sang` : Création (protégé JWT)
  - `POST /api/banques-sang/:id/stocks` : Mise à jour stocks (protégé JWT)

#### 2. Composants Mobile (Partiellement complété)
- **BloodBankResultCard** : `mobile/src/components/specialized/BloodBankResultCard.tsx` ✅
  - Affichage nom, adresse, disponibilité
  - Affichage groupes sanguins disponibles avec quantités
  - Badges "Accepte dons" / "Accepte demandes" / "URGENCE 24H"
  - Boutons contact (téléphone, urgence, WhatsApp)
  - ⚠️ **MANQUE** : Chat modal, livraison automatique, gestion stocks détaillée

- **BanqueSangFormScreen** : `mobile/src/screens/specialized/BanqueSangFormScreen.tsx` ✅
  - Formulaire création/édition banque de sang
  - Champs stocks par groupe sanguin
  - ⚠️ **MANQUE** : Interface avancée pour gestion stocks en temps réel

---

### 📋 CE QUI RESTE À FAIRE - Banque de Sang

### 1. Améliorer BloodBankResultCard avec Gestion Stocks ⚠️ PRIORITAIRE

**Fichier** : `mobile/src/components/specialized/BloodBankResultCard.tsx`

**Objectif** : Intégrer gestion complète des stocks, chat modal, et livraison automatique.

#### 1.1 Gestion des Stocks (Hyper Important) 🩸

**Fonctionnalités requises** :

1. **Affichage détaillé des stocks** :
   - Afficher tous les groupes sanguins (O+, O-, A+, A-, B+, B-, AB+, AB-)
   - Pour chaque groupe :
     - Quantité disponible (poches)
     - Unité (poches, litres, etc.)
     - Date dernière mise à jour (`derniere_maj`)
     - Indicateur visuel :
       - 🟢 Vert : Stock suffisant (> 10 poches)
       - 🟡 Orange : Stock moyen (5-10 poches)
       - 🔴 Rouge : Stock critique (< 5 poches)
       - ⚫ Gris : Stock épuisé (0)

2. **Section "Stocks en temps réel"** :
   ```typescript
   <View style={styles.stocksDetailSection}>
       <Text style={styles.stocksTitle}>Stocks disponibles</Text>
       {Object.entries(stocks_groupes_sanguins).map(([groupe, stock]) => (
           <View key={groupe} style={styles.stockRow}>
               <Text style={styles.groupeLabel}>{groupe}</Text>
               <View style={styles.stockInfo}>
                   <Text style={styles.stockQuantite}>
                       {stock.quantite} {stock.unite || 'poches'}
                   </Text>
                   <Text style={styles.stockDate}>
                       MAJ: {formatDate(stock.derniere_maj)}
                   </Text>
               </View>
               <View style={[
                   styles.stockIndicator,
                   getStockColor(stock.quantite)
               ]} />
           </View>
       ))}
   </View>
   ```

3. **Bouton "Voir détails stocks"** :
   - Ouvrir modal avec vue complète
   - Historique des mises à jour (si disponible)
   - Graphique d'évolution (optionnel)

#### 1.2 Intégration Chat Modal (Comme ProductCard) 💬

**Référence** : `mobile/src/components/ProductCard.tsx` (lignes 258, 920-951, 1656-1673)

**Étapes détaillées** :

1. **Importer ChatModalMobile** :
   ```typescript
   import ChatModalMobile from '../ChatModalMobile';
   ```

2. **Ajouter state pour chat** :
   ```typescript
   const [showChatModal, setShowChatModal] = useState(false);
   ```

3. **Créer fonction handleChatPress** :
   ```typescript
   const handleChatPress = () => {
       // Récupérer service_id depuis banque
       const serviceId = banque.service_id;
       
       // Récupérer user_id du prestataire (propriétaire de la banque)
       // Via API ou depuis les données de la banque
       
       setShowChatModal(true);
   };
   ```

4. **Ajouter bouton Chat dans le footer** :
   ```typescript
   <TouchableOpacity
       style={styles.chatButton}
       onPress={handleChatPress}
   >
       <SafeIcon name="message-circle" size={16} color={modernColors.primary} />
       <Text style={styles.chatButtonText}>Chat</Text>
   </TouchableOpacity>
   ```

5. **Ajouter ChatModalMobile** :
   ```typescript
   <ChatModalMobile
       visible={showChatModal}
       onClose={() => setShowChatModal(false)}
       service={{
           id: banque.service_id,
           data: { titre_service: { valeur: banque.nom } },
           user_id: banque.user_id, // Récupérer depuis API si nécessaire
       }}
       product={null}
       user={null} // Sera récupéré depuis AuthContext
   />
   ```

6. **Récupérer user_id du prestataire** :
   - Option 1 : Ajouter `user_id` dans les résultats de recherche
   - Option 2 : Appeler `GET /api/banques-sang/:id` pour récupérer toutes les infos
   - Option 3 : Passer `user_id` depuis `ResultatBesoinScreen` si disponible

**Références API** :
- `GET /api/banques-sang/:id` : Retourne `user_id` dans la réponse
- Chat modal utilise `service.user_id` pour identifier le prestataire

#### 1.3 Livraison Intelligente Yukpo 🚚 (Comme ProductCard)

**Référence** : `mobile/src/components/ProductCard.tsx` (ligne 27, 259, OrderDeliveryModal)

**⚠️ IMPORTANT** : Les services spécialisés (pharmacie et banque de sang) doivent pouvoir utiliser le système de livraison intelligent de Yukpo, exactement comme dans ProductCard.

**Fonctionnalités requises** :

1. **Bouton "Livraison intelligente"** :
   - Afficher dans le footer de `BloodBankResultCard` et `PharmacieResultCard`
   - Style identique au bouton dans ProductCard
   - Icône : `truck` ou `package`
   - Texte : "Livraison" ou "Commander avec livraison"

2. **Intégrer OrderDeliveryModal** :
   ```typescript
   import OrderDeliveryModal from '../delivery/OrderDeliveryModal';
   
   const [showDeliveryModal, setShowDeliveryModal] = useState(false);
   
   const handleDeliveryPress = () => {
       // Récupérer service complet depuis API si nécessaire
       setShowDeliveryModal(true);
   };
   ```

3. **Créer objet service/produit pour livraison** :
   - Le système de livraison nécessite un `service` ou `product`
   - Pour banque de sang :
     ```typescript
     const deliveryService = {
         id: banque.service_id,
         data: {
             titre_service: { valeur: banque.nom },
             type: 'banque_sang',
             // Autres champs nécessaires
         },
         user_id: banque.user_id, // Prestataire
     };
     ```
   - Pour pharmacie :
     ```typescript
     const deliveryService = {
         id: pharmacie.service_id,
         data: {
             titre_service: { valeur: pharmacie.nom },
             type: 'pharmacie',
             // Autres champs nécessaires
         },
         user_id: pharmacie.user_id,
     };
     ```

4. **Passer données à OrderDeliveryModal** :
   ```typescript
   <OrderDeliveryModal
       visible={showDeliveryModal}
       onClose={() => setShowDeliveryModal(false)}
       service={deliveryService}
       product={null} // Ou créer produit virtuel si nécessaire
       prestataire={prestataireData} // Récupérer depuis API si nécessaire
   />
   ```

5. **Récupérer données prestataire** :
   - Option 1 : Appeler `GET /api/banques-sang/:id` ou `GET /api/pharmacies/:id` pour récupérer `user_id`
   - Option 2 : Appeler `GET /api/services/:id` pour récupérer toutes les infos
   - Option 3 : Passer `user_id` depuis `ResultatBesoinScreen` si disponible

6. **Gérer commande après livraison** :
   - Pour banque de sang : Mettre à jour stock automatiquement après livraison confirmée
   - Appeler `POST /api/banques-sang/:id/stocks` pour décrémenter
   - Pour pharmacie : Gérer stock produits si applicable

**Références** :
- `mobile/src/components/ProductCard.tsx` : Lignes 259, 1675-1690 (OrderDeliveryModal)
- `mobile/src/components/delivery/OrderDeliveryModal.tsx` : Composant livraison
- Routes API : `POST /api/delivery/orders` (système existant)

**Code exemple complet pour BloodBankResultCard** :
```typescript
import React, { useState } from 'react';
import OrderDeliveryModal from '../delivery/OrderDeliveryModal';

const BloodBankResultCard: React.FC<BloodBankResultCardProps> = ({ banque }) => {
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);

    const handleDeliveryPress = () => {
        // Pas besoin de récupérer service, OrderDeliveryModal le fait automatiquement
        setShowDeliveryModal(true);
    };

    return (
        <>
            {/* ... reste du composant ... */}
            
            <View style={styles.footer}>
                {/* ... distance, contacts ... */}
                
                {/* Bouton livraison */}
                <TouchableOpacity
                    style={styles.deliveryButton}
                    onPress={handleDeliveryPress}
                >
                    <SafeIcon name="truck" size={16} color={modernColors.primary} />
                    <Text style={styles.deliveryButtonText}>Livraison</Text>
                </TouchableOpacity>
            </View>

            {/* Modal livraison */}
            <OrderDeliveryModal
                visible={showDeliveryModal}
                onClose={() => setShowDeliveryModal(false)}
                serviceId={banque.service_id}
                productIndex={undefined}
                productName={banque.nom}
                onSuccess={(deliveryId) => {
                    console.log('Commande livraison créée:', deliveryId);
                    // Optionnel : Mettre à jour stock après livraison confirmée
                    // Appeler POST /api/banques-sang/:id/stocks pour décrémenter
                }}
            />
        </>
    );
};
```

**Code exemple pour PharmacieResultCard** :
```typescript
import React, { useState } from 'react';
import OrderDeliveryModal from '../delivery/OrderDeliveryModal';

const PharmacieResultCard: React.FC<PharmacieResultCardProps> = ({ pharmacy }) => {
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);

    const handleDeliveryPress = () => {
        setShowDeliveryModal(true);
    };

    return (
        <>
            {/* ... reste du composant ... */}
            
            <View style={styles.footer}>
                {/* ... distance, contacts ... */}
                
                {/* Bouton livraison */}
                <TouchableOpacity
                    style={styles.deliveryButton}
                    onPress={handleDeliveryPress}
                >
                    <SafeIcon name="truck" size={16} color={modernColors.primary} />
                    <Text style={styles.deliveryButtonText}>Livraison</Text>
                </TouchableOpacity>
            </View>

            {/* Modal livraison */}
            <OrderDeliveryModal
                visible={showDeliveryModal}
                onClose={() => setShowDeliveryModal(false)}
                serviceId={pharmacy.service_id}
                productIndex={undefined}
                productName={pharmacy.nom}
                onSuccess={(deliveryId) => {
                    console.log('Commande livraison créée:', deliveryId);
                }}
            />
        </>
    );
};
```

**Styles à ajouter** :
```typescript
deliveryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: modernColors.primary,
    gap: 6,
},
deliveryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: modernColors.primary,
},
```

**⚠️ IMPORTANT - Interface OrderDeliveryModal** :
D'après `mobile/src/components/delivery/OrderDeliveryModal.tsx` (lignes 21-31), l'interface exacte est :
```typescript
interface OrderDeliveryModalProps {
    visible: boolean;
    onClose: () => void;
    serviceId: number; // ✅ OBLIGATOIRE
    productIndex?: number; // ✅ OPTIONNEL (null pour services spécialisés)
    productName?: string; // ✅ OPTIONNEL (nom du service)
    onSuccess?: (deliveryId: string) => void; // ✅ OPTIONNEL
    conversationId?: number; // ✅ OPTIONNEL (pour prix négociés)
    clientUserId?: number; // ✅ OPTIONNEL
}
```

**Utilisation pour services spécialisés** :
- `serviceId` : Utiliser `banque.service_id` ou `pharmacie.service_id`
- `productIndex` : `null` ou `undefined` (pas de produit spécifique)
- `productName` : Nom de la banque/pharmacie (pour affichage)
- `onSuccess` : Callback après création commande (optionnel)

**Exemple d'utilisation correcte** :
```typescript
<OrderDeliveryModal
    visible={showDeliveryModal}
    onClose={() => setShowDeliveryModal(false)}
    serviceId={banque.service_id} // ✅ OBLIGATOIRE
    productIndex={undefined} // ✅ Pas de produit
    productName={banque.nom} // ✅ Pour affichage
    onSuccess={(deliveryId) => {
        console.log('Livraison créée:', deliveryId);
        // Mettre à jour stock si nécessaire
    }}
/>
```

#### 1.4 Améliorer Affichage Stocks

**Interface suggérée** :
```
┌─────────────────────────────────┐
│  Stocks disponibles             │
├─────────────────────────────────┤
│  O+    🟢 25 poches  MAJ: Aujourd'hui│
│  O-    🟡 8 poches   MAJ: Hier      │
│  A+    🟢 30 poches  MAJ: Aujourd'hui│
│  A-    🔴 3 poches   MAJ: Il y a 2j │
│  B+    🟢 15 poches  MAJ: Aujourd'hui│
│  B-    ⚫ 0 poches   Épuisé         │
│  AB+   🟡 6 poches   MAJ: Hier      │
│  AB-   🔴 2 poches   MAJ: Il y a 3j │
├─────────────────────────────────┤
│  [Voir détails] [Actualiser]    │
└─────────────────────────────────┘
```

---

### 2. Améliorer BanqueSangFormScreen pour Gestion Stocks

**Fichier** : `mobile/src/screens/specialized/BanqueSangFormScreen.tsx`

**Objectif** : Interface avancée pour gestion des stocks en temps réel.

**Fonctionnalités** :

1. **Section "Gestion des stocks"** :
   - Liste de tous les groupes sanguins (8 groupes)
   - Pour chaque groupe :
     - Input quantité (nombre)
     - Select unité (poches, litres)
     - Bouton "Mettre à jour"
     - Affichage dernière mise à jour

2. **Mise à jour en temps réel** :
   - Appeler `POST /api/banques-sang/:id/stocks` après chaque modification
   - Afficher confirmation
   - Actualiser l'affichage

3. **Validation** :
   - Quantité >= 0
   - Unité obligatoire
   - Gérer erreurs API

---

### 3. Créer Modal Détails Stocks

**Fichier** : `mobile/src/components/specialized/BloodBankStocksModal.tsx` (nouveau)

**Objectif** : Modal détaillé pour visualiser et gérer les stocks.

**Fonctionnalités** :
- Vue complète de tous les groupes
- Graphiques d'évolution (optionnel)
- Historique des mises à jour
- Possibilité de mettre à jour depuis le modal

---

### 4. Système Intelligent de Matching Dons de Sang 🚨 PRIORITÉ CRITIQUE

**Objectif** : Système automatique d'alerte et de matching pour dons de sang d'urgence quand aucune structure n'a le groupe disponible.

#### 4.1 Architecture du Système

**Fonctionnement** :
1. **Détection urgence** : Quand recherche banque de sang retourne 0 résultats pour un groupe spécifique
2. **Géolocalisation temps réel** : Capturer position GPS de l'utilisateur demandeur
3. **Recherche donneurs potentiels** : Chercher utilisateurs Yukpo dans rayon 5km avec groupe compatible
4. **Alerte sonore automatique** : Envoyer notification push avec son aux donneurs potentiels
5. **Matching direct** : Permettre contact direct entre demandeur et donneur

#### 4.2 Backend - Créer Table et Fonctions SQL

**Migration** : `backend/migrations/20251127_create_blood_donation_matching_system.sql`

**⚠️ CONTRAINTES SQLx OFFLINE** :
- Utiliser `CREATE TABLE IF NOT EXISTS`
- Utiliser `CREATE OR REPLACE FUNCTION`
- Pas de `SELECT` retournant résultats dans la migration
- Intégrer dans `auto_migrate.rs` et `0000_create_all_tables.sql`

**Tables à créer** :

1. **`blood_donation_requests`** :
```sql
CREATE TABLE IF NOT EXISTS blood_donation_requests (
    id SERIAL PRIMARY KEY,
    requester_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    groupe_sanguin_requis VARCHAR(10) NOT NULL, -- "O+", "AB-", etc.
    urgence_level VARCHAR(20) NOT NULL DEFAULT 'high', -- 'low', 'medium', 'high', 'critical'
    requester_gps VARCHAR(255) NOT NULL, -- Format: "lat,lng" position au moment de la demande
    requester_lat DOUBLE PRECISION NOT NULL,
    requester_lng DOUBLE PRECISION NOT NULL,
    search_radius_km INTEGER DEFAULT 5,
    message TEXT, -- Message personnalisé du demandeur
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'matched', 'fulfilled', 'cancelled', 'expired'
    matched_donor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    matched_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_groupe_sanguin CHECK (groupe_sanguin_requis IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'))
);

CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON blood_donation_requests(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_blood_requests_gps ON blood_donation_requests USING GIST(
    ST_SetSRID(ST_MakePoint(requester_lng, requester_lat), 4326)::geography
);
CREATE INDEX IF NOT EXISTS idx_blood_requests_groupe ON blood_donation_requests(groupe_sanguin_requis) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_blood_requests_expires ON blood_donation_requests(expires_at) WHERE status = 'active';
```

2. **`user_blood_groups`** (table pour stocker groupes sanguins des utilisateurs) :
```sql
CREATE TABLE IF NOT EXISTS user_blood_groups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    groupe_sanguin VARCHAR(10) NOT NULL,
    is_available_for_donation BOOLEAN DEFAULT TRUE,
    last_donation_date DATE, -- Pour respecter délai entre dons (minimum 8 semaines)
    notification_enabled BOOLEAN DEFAULT TRUE, -- Accepter notifications d'urgence
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_groupe UNIQUE(user_id, groupe_sanguin),
    CONSTRAINT valid_groupe CHECK (groupe_sanguin IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'))
);

CREATE INDEX IF NOT EXISTS idx_user_blood_groups_user ON user_blood_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_user_blood_groups_groupe ON user_blood_groups(groupe_sanguin) WHERE is_available_for_donation = TRUE AND notification_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_blood_groups_available ON user_blood_groups(is_available_for_donation, notification_enabled) WHERE is_available_for_donation = TRUE AND notification_enabled = TRUE;
```

3. **`blood_donation_matches`** (historique des matchings) :
```sql
CREATE TABLE IF NOT EXISTS blood_donation_matches (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES blood_donation_requests(id) ON DELETE CASCADE,
    donor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'completed', 'cancelled'
    donor_response_at TIMESTAMPTZ,
    contact_established_at TIMESTAMPTZ,
    donation_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_request_donor UNIQUE(request_id, donor_user_id)
);

CREATE INDEX IF NOT EXISTS idx_blood_matches_request ON blood_donation_matches(request_id);
CREATE INDEX IF NOT EXISTS idx_blood_matches_donor ON blood_donation_matches(donor_user_id);
CREATE INDEX IF NOT EXISTS idx_blood_matches_status ON blood_donation_matches(match_status) WHERE match_status IN ('pending', 'accepted');
```

**Fonctions SQL à créer** :

1. **`find_potential_blood_donors`** :
```sql
CREATE OR REPLACE FUNCTION find_potential_blood_donors(
    p_requester_lat DOUBLE PRECISION,
    p_requester_lng DOUBLE PRECISION,
    p_groupe_requis VARCHAR(10),
    p_radius_km INTEGER DEFAULT 5
)
RETURNS TABLE (
    user_id INTEGER,
    groupe_sanguin VARCHAR(10),
    distance_km DOUBLE PRECISION,
    last_donation_days INTEGER,
    can_donate BOOLEAN
) AS $$
BEGIN
    -- Groupes sanguins compatibles
    -- O+ peut recevoir de : O+, O-
    -- O- peut recevoir de : O-
    -- A+ peut recevoir de : O+, O-, A+, A-
    -- A- peut recevoir de : O-, A-
    -- B+ peut recevoir de : O+, O-, B+, B-
    -- B- peut recevoir de : O-, B-
    -- AB+ peut recevoir de : tous
    -- AB- peut recevoir de : O-, A-, B-, AB-
    
    RETURN QUERY
    SELECT 
        ubg.user_id,
        ubg.groupe_sanguin,
        calculate_distance_km(
            p_requester_lat,
            p_requester_lng,
            u.current_lat,
            u.current_lng
        ) AS distance_km,
        CASE 
            WHEN ubg.last_donation_date IS NULL THEN 999
            ELSE EXTRACT(DAY FROM NOW() - ubg.last_donation_date)::INTEGER
        END AS last_donation_days,
        CASE
            WHEN ubg.last_donation_date IS NULL THEN TRUE
            WHEN EXTRACT(DAY FROM NOW() - ubg.last_donation_date) >= 56 THEN TRUE -- 8 semaines minimum
            ELSE FALSE
        END AS can_donate
    FROM user_blood_groups ubg
    JOIN users u ON u.id = ubg.user_id
    WHERE ubg.is_available_for_donation = TRUE
        AND ubg.notification_enabled = TRUE
        AND u.current_lat IS NOT NULL
        AND u.current_lng IS NOT NULL
        AND (
            -- Compatibilité groupes sanguins
            (p_groupe_requis = 'O+' AND ubg.groupe_sanguin IN ('O+', 'O-')) OR
            (p_groupe_requis = 'O-' AND ubg.groupe_sanguin = 'O-') OR
            (p_groupe_requis = 'A+' AND ubg.groupe_sanguin IN ('O+', 'O-', 'A+', 'A-')) OR
            (p_groupe_requis = 'A-' AND ubg.groupe_sanguin IN ('O-', 'A-')) OR
            (p_groupe_requis = 'B+' AND ubg.groupe_sanguin IN ('O+', 'O-', 'B+', 'B-')) OR
            (p_groupe_requis = 'B-' AND ubg.groupe_sanguin IN ('O-', 'B-')) OR
            (p_groupe_requis = 'AB+' AND TRUE) OR -- AB+ peut recevoir de tous
            (p_groupe_requis = 'AB-' AND ubg.groupe_sanguin IN ('O-', 'A-', 'B-', 'AB-'))
        )
        AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(p_requester_lng, p_requester_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(u.current_lng, u.current_lat), 4326)::geography,
            p_radius_km * 1000
        )
    ORDER BY distance_km ASC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;
```

2. **`create_blood_donation_request`** :
```sql
CREATE OR REPLACE FUNCTION create_blood_donation_request(
    p_requester_user_id INTEGER,
    p_groupe_sanguin_requis VARCHAR(10),
    p_requester_lat DOUBLE PRECISION,
    p_requester_lng DOUBLE PRECISION,
    p_search_radius_km INTEGER DEFAULT 5,
    p_message TEXT DEFAULT NULL,
    p_urgence_level VARCHAR(20) DEFAULT 'high'
)
RETURNS JSONB AS $$
DECLARE
    v_request_id INTEGER;
    v_donors_count INTEGER;
    v_donors RECORD;
BEGIN
    -- Créer la demande
    INSERT INTO blood_donation_requests (
        requester_user_id,
        groupe_sanguin_requis,
        requester_gps,
        requester_lat,
        requester_lng,
        search_radius_km,
        message,
        urgence_level
    ) VALUES (
        p_requester_user_id,
        p_groupe_sanguin_requis,
        p_requester_lat || ',' || p_requester_lng,
        p_requester_lat,
        p_requester_lng,
        p_search_radius_km,
        p_message,
        p_urgence_level
    ) RETURNING id INTO v_request_id;
    
    -- Trouver donneurs potentiels
    SELECT COUNT(*) INTO v_donors_count
    FROM find_potential_blood_donors(
        p_requester_lat,
        p_requester_lng,
        p_groupe_sanguin_requis,
        p_search_radius_km
    ) WHERE can_donate = TRUE;
    
    -- Créer les matchings
    FOR v_donors IN 
        SELECT * FROM find_potential_blood_donors(
            p_requester_lat,
            p_requester_lng,
            p_groupe_sanguin_requis,
            p_search_radius_km
        ) WHERE can_donate = TRUE
    LOOP
        INSERT INTO blood_donation_matches (request_id, donor_user_id)
        VALUES (v_request_id, v_donors.user_id)
        ON CONFLICT (request_id, donor_user_id) DO NOTHING;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', TRUE,
        'request_id', v_request_id,
        'donors_found', v_donors_count,
        'message', 'Demande créée et donneurs potentiels identifiés'
    );
END;
$$ LANGUAGE plpgsql;
```

#### 4.3 Backend - Contrôleur Rust

**Fichier** : `backend/src/controllers/blood_donation_matching_controller.rs` (nouveau)

**Fonctions à créer** :

1. **`create_blood_donation_request`** :
   - Récupérer position GPS temps réel de l'utilisateur
   - Appeler fonction SQL `create_blood_donation_request`
   - Déclencher envoi notifications push aux donneurs trouvés
   - Retourner `request_id` et nombre de donneurs trouvés

2. **`get_potential_donors`** :
   - Appeler fonction SQL `find_potential_blood_donors`
   - Retourner liste donneurs avec distances

3. **`respond_to_donation_request`** :
   - Donneur accepte/decline la demande
   - Mettre à jour `blood_donation_matches`
   - Notifier le demandeur si accepté

4. **`establish_contact`** :
   - Créer conversation privée entre demandeur et donneur
   - Utiliser système de chat existant
   - Retourner `conversation_id`

**Routes API** :
- `POST /api/blood-donation/request` : Créer demande (protégé JWT)
- `GET /api/blood-donation/request/:id/donors` : Liste donneurs potentiels
- `POST /api/blood-donation/request/:id/respond` : Répondre à demande (protégé JWT)
- `POST /api/blood-donation/request/:id/contact` : Établir contact (protégé JWT)

#### 4.4 Backend - Service Notifications Push

**Intégration** : Utiliser système de notifications push existant

**Fonctionnalités** :
- Notification avec son (alerte sonore)
- Titre : "🚨 URGENCE : Don de sang requis"
- Message : "Groupe [X] recherché dans votre zone. Pouvez-vous aider ?"
- Action : Ouvrir modal de réponse
- Données : `request_id`, `groupe_sanguin`, `distance_km`

#### 4.5 Mobile - Capturer Position GPS Temps Réel

**Fichier** : `mobile/src/screens/ResultatBesoinScreen.tsx` ou composant dédié

**Fonctionnalités** :
- Quand recherche banque de sang retourne 0 résultats
- Afficher bouton "Demander aide d'urgence"
- Capturer position GPS actuelle avec `useLocation` ou `expo-location`
- Envoyer demande avec position

**Code exemple** :
```typescript
import * as Location from 'expo-location';

const handleEmergencyBloodRequest = async (groupeSanguin: string) => {
    // Demander permission GPS
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert('Erreur', 'Permission GPS requise pour cette fonctionnalité');
        return;
    }
    
    // Capturer position temps réel
    const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
    });
    
    const { latitude, longitude } = location.coords;
    
    // Créer demande
    const response = await apiPost('/api/blood-donation/request', {
        groupe_sanguin_requis: groupeSanguin,
        requester_lat: latitude,
        requester_lng: longitude,
        search_radius_km: 5,
        urgence_level: 'critical',
        message: `Besoin urgent de ${groupeSanguin}`
    });
    
    if (response.success) {
        Alert.alert(
            'Demande envoyée',
            `${response.data.donors_found} donneurs potentiels ont été notifiés dans un rayon de 5km`
        );
    }
};
```

#### 4.6 Mobile - Composant Réponse à Alerte

**Fichier** : `mobile/src/components/specialized/BloodDonationAlertModal.tsx` (nouveau)

**Fonctionnalités** :
- Modal affiché quand notification reçue
- Afficher :
  - Groupe sanguin recherché
  - Distance du demandeur
  - Message du demandeur (si disponible)
  - Dernière date de don (si applicable)
- Boutons :
  - "Je peux aider" → Accepte et ouvre chat
  - "Je ne peux pas" → Decline
  - "Plus tard" → Ferme modal

#### 4.7 Mobile - Établir Contact Direct

**Fonctionnalités** :
- Après acceptation donneur, créer conversation privée
- Utiliser `ChatModalMobile` existant
- Permettre échange direct pour coordonner don
- Afficher instructions (lieu, horaire, préparation)

#### 4.8 Mobile - Gérer Groupe Sanguin Utilisateur

**Fichier** : `mobile/src/screens/ProfileScreen.tsx` ou nouveau écran

**Fonctionnalités** :
- Section "Mon groupe sanguin"
- Permettre utilisateur d'enregistrer son groupe
- Toggle "Accepter notifications d'urgence"
- Toggle "Disponible pour dons"
- Enregistrer dernière date de don

**API** :
- `POST /api/user/blood-group` : Enregistrer groupe sanguin
- `PUT /api/user/blood-group` : Mettre à jour préférences

---

## 🔧 DÉTAILS TECHNIQUES - Système Intelligent Banque de Sang

### Compatibilité Groupes Sanguins
```
O+ peut recevoir de : O+, O-
O- peut recevoir de : O-
A+ peut recevoir de : O+, O-, A+, A-
A- peut recevoir de : O-, A-
B+ peut recevoir de : O+, O-, B+, B-
B- peut recevoir de : O-, B-
AB+ peut recevoir de : Tous (donneur universel)
AB- peut recevoir de : O-, A-, B-, AB-
```

### Délai Minimum Entre Dons
- **8 semaines (56 jours)** minimum entre deux dons de sang
- Vérifier `last_donation_date` avant de proposer un donneur

### Rayon de Recherche
- **Par défaut** : 5 km
- **Configurable** : Peut être augmenté si aucun donneur trouvé
- Utiliser `ST_DWithin` avec géographie pour calcul précis

### Notifications Push
- **Son d'alerte** : Utiliser notification sonore spéciale
- **Priorité** : Haute (notification critique)
- **Données** : `request_id`, `groupe_sanguin`, `distance_km`, `urgence_level`

### Position GPS Temps Réel
- Utiliser `expo-location` pour capturer position actuelle
- Demander permission `FOREGROUND_LOCATION`
- Utiliser `getCurrentPositionAsync` avec `Accuracy.High`
- **Important** : Position doit être capturée au moment de la demande, pas stockée
- Si colonnes `users.current_lat` et `users.current_lng` existent, les mettre à jour
- Sinon, passer directement dans la requête API

**Code exemple complet** :
```typescript
import * as Location from 'expo-location';
import { Alert } from 'react-native';

const requestEmergencyBloodDonation = async (groupeSanguin: string) => {
    try {
        // 1. Vérifier permissions
        const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
        let finalStatus = existingStatus;
        
        if (existingStatus !== 'granted') {
            const { status } = await Location.requestForegroundPermissionsAsync();
            finalStatus = status;
        }
        
        if (finalStatus !== 'granted') {
            Alert.alert(
                'Permission requise',
                'La localisation GPS est nécessaire pour trouver des donneurs près de vous'
            );
            return;
        }
        
        // 2. Capturer position temps réel
        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            timeInterval: 0,
            distanceInterval: 0,
        });
        
        const { latitude, longitude } = location.coords;
        
        // 3. Créer demande via API
        const response = await apiPost('/api/blood-donation/request', {
            groupe_sanguin_requis: groupeSanguin,
            requester_lat: latitude,
            requester_lng: longitude,
            search_radius_km: 5,
            urgence_level: 'critical',
            message: `Besoin urgent de sang de groupe ${groupeSanguin}`
        });
        
        if (response.success) {
            Alert.alert(
                '✅ Demande envoyée',
                `${response.data.donors_found} donneur(s) potentiel(s) dans un rayon de 5km ont été notifiés.\n\nVous serez contacté si quelqu'un peut vous aider.`,
                [{ text: 'OK' }]
            );
        }
    } catch (error) {
        console.error('Erreur demande don sang:', error);
        Alert.alert('Erreur', 'Impossible de créer la demande. Veuillez réessayer.');
    }
};
```

### Notifications Push avec Son
- **Type** : Notification critique avec son d'alerte
- **Titre** : "🚨 URGENCE : Don de sang requis"
- **Message** : "Groupe [X] recherché à [Y] km de vous. Pouvez-vous aider ?"
- **Son** : Utiliser son d'alerte système (ex: `default` ou son personnalisé)
- **Action** : Ouvrir `BloodDonationAlertModal` avec `request_id`
- **Priorité** : `high` ou `max` pour notification critique
- **Badge** : Incrémenter badge app

**Format données notification** :
```json
{
  "type": "blood_donation_request",
  "request_id": 123,
  "groupe_sanguin": "O+",
  "distance_km": 2.5,
  "urgence_level": "critical",
  "message": "Besoin urgent de sang de groupe O+"
}
```

---

## 📋 CHECKLIST - Système Intelligent Banque de Sang

### Backend
- [ ] Migration SQL `20251127_create_blood_donation_matching_system.sql`
  - [ ] Table `blood_donation_requests`
  - [ ] Table `user_blood_groups`
  - [ ] Table `blood_donation_matches`
  - [ ] Fonction `find_potential_blood_donors`
  - [ ] Fonction `create_blood_donation_request`
  - [ ] Compatible SQLx offline ✅
  - [ ] Intégré dans `auto_migrate.rs`
  - [ ] Intégré dans `0000_create_all_tables.sql`
- [ ] Contrôleur `blood_donation_matching_controller.rs`
- [ ] Routes API dans `specialized_services_routes.rs`
- [ ] Service notifications push avec son

### Mobile
- [ ] Composant `BloodDonationAlertModal.tsx`
- [ ] Intégration dans `ResultatBesoinScreen` (bouton urgence)
- [ ] Capturer position GPS temps réel
- [ ] Gestion groupe sanguin utilisateur (ProfileScreen)
- [ ] Établir contact direct (ChatModalMobile)
- [ ] Tests notifications push avec son

---

## 🔧 DÉTAILS TECHNIQUES - Banque de Sang

### Format `stocks_groupes_sanguins` JSONB
```json
{
  "O+": {
    "quantite": 25,
    "unite": "poches",
    "derniere_maj": "2025-11-27T10:00:00Z"
  },
  "O-": {
    "quantite": 8,
    "unite": "poches",
    "derniere_maj": "2025-11-26T15:30:00Z"
  },
  "A+": { ... },
  "A-": { ... },
  "B+": { ... },
  "B-": { ... },
  "AB+": { ... },
  "AB-": { ... }
}
```

### API Endpoints disponibles
- `GET /api/banques-sang/search` : Recherche avec filtres ✅
- `GET /api/banques-sang/:id` : Récupération complète ✅
- `POST /api/banques-sang` : Création ✅
- `POST /api/banques-sang/:id/stocks` : Mise à jour stocks ✅
- `POST /api/delivery/orders` : Créer commande livraison (système existant) ✅
- Chat : Utilise système existant via `ChatModalMobile` ✅

### Composants de référence
- `mobile/src/components/ProductCard.tsx` : Exemple chat modal et livraison
- `mobile/src/components/ChatModalMobile.tsx` : Composant chat
- `mobile/src/components/delivery/OrderDeliveryModal.tsx` : Modal livraison

---

## 📝 NOTES IMPORTANTES

### Tickets Bus
- Tous les endpoints API backend sont déjà créés et fonctionnels
- Le système de réservation existant (`bus_reservations`) est déjà en place
- Les composants `BusModelForm` et `BusTicketCard` sont prêts à être utilisés
- La génération PDF des tickets est déjà implémentée dans `busTicketPdfGenerator.ts`
- Compatibilité SQLx offline mode respectée pour toutes les migrations

### Banque de Sang
- **Gestion des stocks est CRITIQUE** : C'est la fonctionnalité principale
- Toutes les routes API sont disponibles, il faut juste les connecter
- Le chat modal et la livraison utilisent des systèmes existants (juste à intégrer)
- Les stocks doivent être mis à jour automatiquement après livraison
- Format JSONB `stocks_groupes_sanguins` avec timestamp automatique

### Migrations SQL
- ⚠️ **TOUJOURS** respecter SQLx offline mode (pas de SELECT retournant résultats)
- ⚠️ **TOUJOURS** intégrer dans `auto_migrate.rs` et `0000_create_all_tables.sql`
- Utiliser `CREATE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`
- Utiliser `DO $$ ... END $$` pour vérifications conditionnelles

---

---

## 🎯 ORDRE DE PRIORITÉ RECOMMANDÉ - Vue d'ensemble

### Phase 1 : Tickets Bus - Base (2-3h)
1. Compléter `handleSubmit` dans AgenceVoyageFormScreen (30 min)
2. Créer `BusSeatSelector` (1-2h)
3. Améliorer `AgenceVoyageResultCard` (30 min)
4. Intégrer dans `ResultatBesoinScreen` (30 min)

### Phase 1.5 : Tickets Bus - Paiement et Validation (7-8h) 🚨 PRIORITÉ CRITIQUE
1. **Backend** : Migration commission et reversement (1h)
   - Migration `20251127_add_commission_to_bus_payments.sql`
   - Fonction `process_bus_ticket_payment_with_commission`
   - ⚠️ Respecter SQLx offline, auto_migrate, 0000_create_all_tables
2. **Backend** : Contrôleur paiement complet (1h)
   - `bus_ticket_payment_controller.rs`
   - Génération PDF avec QR code
   - Routes API
3. **Mobile** : Affichage commission séparée (30 min)
4. **Mobile** : Page "Mes tickets de voyage" (Client) (1h)
   - `MyBusTicketsScreen.tsx`
   - Navigation ProfileScreen/HomeScreen
5. **Backend** : Système validation tickets (1h)
   - Migration `20251127_create_bus_ticket_validation_system.sql`
   - Fonctions `validate_bus_ticket`, `get_bus_boarding_summary`
   - Contrôleur `bus_ticket_validation_controller.rs`
   - Contrôleur `agency_boarding_controller.rs` (nouveau)
6. **Mobile + Frontend** : Page gestion tickets agence (1h)
   - Mobile : `AgencyTicketManagementScreen.tsx`
   - Frontend : `AgencyTicketManagementPage.tsx`
   - Liste tickets agence avec lien "Gestion Embarquement"
7. **Mobile + Frontend** : Page gestion embarquement (2h) ⚠️
   - Mobile : `BusBoardingManagementScreen.tsx`
   - Frontend : `BusBoardingManagementPage.tsx`
   - Scanner QR code (mobile : expo-barcode-scanner, frontend : html5-qrcode)
   - Résumé embarquement
   - Liste passagers avec validation
   - Validation manuelle (fallback)

8. **Backend + Mobile + Frontend** : Gestion manuelle places non disponibles (2-3h) ⚠️ NOUVEAU
   - Migration `20251127_create_bus_manual_seat_blocks.sql`
   - Fonctions SQL blocage/déblocage
   - Contrôleur `agency_seat_management_controller.rs`
   - Mobile : `ManageBusSeatsScreen.tsx`
   - Frontend : `ManageBusSeatsPage.tsx`
   - Plan des sièges avec statuts (disponible/réservé/bloqué)
   - Sélection multiple et modal raison
   - Intégration dans `BusSeatSelector` (client)

### Phase 2 : Banque de Sang - Améliorations de Base (2-3h)
1. Améliorer `BloodBankResultCard` avec gestion stocks détaillée (1h)
2. Intégrer ChatModalMobile dans `BloodBankResultCard` (30 min)
3. **Intégrer OrderDeliveryModal dans `BloodBankResultCard`** (30 min) ⚠️
4. **Intégrer OrderDeliveryModal dans `PharmacieResultCard`** (30 min) ⚠️
5. Améliorer `BanqueSangFormScreen` pour gestion stocks (1h)

### Phase 3 : Système Intelligent Banque de Sang (4-6h) 🚨 PRIORITÉ CRITIQUE
1. **Backend** : Migration SQL système matching (1h)
   - Tables `blood_donation_requests`, `user_blood_groups`, `blood_donation_matches`
   - Fonctions `find_potential_blood_donors`, `create_blood_donation_request`
   - ⚠️ Respecter SQLx offline, auto_migrate, 0000_create_all_tables
2. **Backend** : Contrôleur `blood_donation_matching_controller.rs` (1h)
3. **Backend** : Service notifications push avec son (1h)
4. **Mobile** : Composant `BloodDonationAlertModal` (1h)
5. **Mobile** : Intégration dans `ResultatBesoinScreen` (1h)
6. **Mobile** : Gestion groupe sanguin utilisateur (1h)
7. **Tests** : Flux complet (1h)

---

## 📝 RÉSUMÉ DES CONTRAINTES IMPORTANTES

### Migrations SQL
- ⚠️ **TOUJOURS** compatible SQLx offline mode
- ⚠️ **JAMAIS** de `SELECT ... FROM` retournant résultats
- ⚠️ **TOUJOURS** utiliser `CREATE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`
- ⚠️ **TOUJOURS** intégrer dans `auto_migrate.rs` via fonction `ensure_xxx()`
- ⚠️ **TOUJOURS** intégrer dans `0000_create_all_tables.sql`

### Position GPS Temps Réel
- ⚠️ **CRITIQUE** : Capturer position au moment de la demande, pas stockée
- Utiliser `expo-location` avec `getCurrentPositionAsync`
- Demander permission `FOREGROUND_LOCATION`
- Utiliser `Accuracy.High` pour précision

### Notifications Push
- ⚠️ **CRITIQUE** : Son d'alerte obligatoire pour urgences sang
- Priorité `high` ou `max`
- Données complètes : `request_id`, `groupe_sanguin`, `distance_km`

### Compatibilité Groupes Sanguins
- ⚠️ **CRITIQUE** : Respecter règles de compatibilité strictes
- Vérifier délai minimum 8 semaines entre dons
- Filtrer donneurs non disponibles

---

**Date de création** : 2025-11-27
**Dernière mise à jour** : 2025-11-27
**Statut** : 
- **Tickets Bus - Backend** : Complété ✅ (recherche, disponibilité, liaison agence)
- **Tickets Bus - Mobile** : Partiellement complété ⚠️ (BusSeatSelector manquant, formulaires à améliorer)
- **Tickets Bus - Paiement** : À créer complètement 🚨 (commission 5%, reversement, PDF)
- **Tickets Bus - Validation** : À créer complètement 🚨 (QR code, vérification bus, complétude)
- **Banque de Sang - Base** : Backend complété ✅, Mobile nécessite améliorations (stocks, chat, livraison)
- **Banque de Sang - Système Intelligent** : À créer complètement 🚨 (matching, alertes, GPS temps réel)

