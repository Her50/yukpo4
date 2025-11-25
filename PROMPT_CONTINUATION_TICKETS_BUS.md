# Prompt de Continuation - Tickets Bus & Banque de Sang

## 🎯 Vue d'ensemble

Ce document contient le contexte complet et les étapes détaillées pour continuer l'intégration de :
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
   - Stocker `seat_map` et `reserved_seats` dans le state

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
   - Réservé (gris)
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
│  🔵 Sélectionné                 │
│                                 │
│  2 places sélectionnées         │
│  Prix total: 20 000 FCFA        │
│  Caution: 500 FCFA              │
│                                 │
│  [Réserver avec caution]        │
└─────────────────────────────────┘
```

#### Références
- API disponibilité : `GET /api/bus-tickets/:product_id/availability`
- Format `seat_map` : Array de `{ row, col, seat_id, seat_number, type, available }`
- Format `reserved_seats` : Array de `seat_id` strings

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

### 4. Intégrer BusSeatSelector dans ResultatBesoinScreen

**Fichier** : `mobile/src/screens/ResultatBesoinScreen.tsx`

**Objectif** : Afficher `AgenceVoyageResultCard` avec tickets bus quand recherche spécialisée agence de voyage.

**Étapes détaillées** :

1. **Vérifier si résultat contient tickets bus** :
   - Détecter `search_method === "specialized_travel_agency"` ou similaire
   - Vérifier si `item.data` contient `bus_tickets` ou structure équivalente

2. **Extraire tickets bus** :
   - Parser les données pour extraire les tickets disponibles
   - Formater en `BusTicketData[]`

3. **Afficher AgenceVoyageResultCard avec tickets** :
   ```typescript
   <AgenceVoyageResultCard
       agency={agencyData}
       busTickets={busTickets}
       onViewSeats={(ticket) => {
           setSelectedTicket(ticket);
           setShowSeatSelector(true);
       }}
       onReserve={(ticket) => {
           setSelectedTicket(ticket);
           setShowSeatSelector(true);
       }}
   />
   ```

4. **Ajouter BusSeatSelector modal** :
   ```typescript
   <BusSeatSelector
       visible={showSeatSelector}
       onClose={() => setShowSeatSelector(false)}
       productId={selectedTicket?.product_id}
       ticketPrice={selectedTicket?.ticket_price || 0}
       currency={selectedTicket?.currency}
       onReserve={handleReserveSeats}
   />
   ```

5. **Créer fonction `handleReserveSeats`** :
   - Appeler API existante pour créer réservation
   - Vérifier API : `POST /api/bus-reservations` (système existant)
   - Gérer paiement caution (500 FCFA)
   - Afficher succès/erreur

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

### Phase 1 : Tickets Bus (2-3h)
1. Compléter `handleSubmit` dans AgenceVoyageFormScreen (30 min)
2. Créer `BusSeatSelector` (1-2h)
3. Améliorer `AgenceVoyageResultCard` (30 min)
4. Intégrer dans `ResultatBesoinScreen` (30 min)

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
- **Tickets Bus** : Backend complété ✅, Mobile partiellement complété (BusSeatSelector manquant)
- **Banque de Sang - Base** : Backend complété ✅, Mobile nécessite améliorations (stocks, chat, livraison)
- **Banque de Sang - Système Intelligent** : À créer complètement 🚨 (matching, alertes, GPS temps réel)

