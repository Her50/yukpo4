Backend - Course Supermarché & Livraison
=======================================

## 1. Objectifs
- Étendre le service livraison pour prendre en charge des commandes « course supermarché ».
- Gérer estimation panier, validation solde, achat par coursier et intégration au suivi livraison.
- Maintenir séparation coûts : `shopping_cost` vs `delivery_cost`.

## 2. Modèle de données (proposition SQLx)

### 2.1 Table `shopping_orders`
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK | Identifiant commande supermarché |
| `delivery_id` | UUID FK (`deliveries.id`) UNIQUE | Couplage livraison |
| `status` | ENUM `shopping_status` | `pending`, `awaiting_purchase`, `shopping_in_progress`, `shopping_completed`, `checkout_submitted`, `cancelled` |
| `estimated_total_cents` | INT | Estimation panier |
| `actual_total_cents` | INT NULL | Montant final renseigné par coursier |
| `currency` | CHAR(3) | Devise (par défaut `XAF`) |
| `store_name` | TEXT | Nom supermarché |
| `store_location` | GEOGRAPHY(Point,4326) | Position magasin |
| `notes` | TEXT | Instructions client |
| `requires_balance_top_up` | BOOL DEFAULT FALSE | Indicateur solde insuffisant |
| `payload` | JSONB | Détails additionnels |
| `created_at`, `updated_at` | TIMESTAMPTZ | Suivi temporel |

### 2.2 Table `shopping_order_items`
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID PK |
| `shopping_order_id` | UUID FK |
| `product_id` | UUID NULL | Référence catalogue Yukpo (si existante) |
| `product_name` | TEXT | Nom produit |
| `characteristics` | JSONB | Caractéristiques (format `autocomplete_characteristic`) |
| `quantity` | NUMERIC(10,2) |
| `unit` | TEXT | Ex: `kg`, `unité` |
| `estimated_price_cents` | INT |
| `actual_price_cents` | INT NULL |
| `status` | ENUM `shopping_item_status` (`pending`, `purchased`, `missing`, `replaced`) |

### 2.3 Enum PostgreSQL
- `shopping_status` : `pending`, `awaiting_purchase`, `shopping_in_progress`, `shopping_completed`, `checkout_submitted`, `cancelled`.
- `shopping_item_status` : `pending`, `purchased`, `missing`, `replaced`.

### 2.4 Colonnes additionnelles
- `deliveries` : ajouter `shopping_required BOOLEAN DEFAULT FALSE`.
- `delivery_pricing` : champs `shopping_cost_cents`, `shopping_discount_cents`.
- `delivery_status_events` : accepter payload `shopping_update`.

## 3. Endpoints REST / GraphQL

### 3.1 Estimation panier
`POST /api/shopping/orders/estimate`
- Auth client.
- Payload : `{ items: [{ product_id?, name?, characteristics?, quantity, unit }], store: { name?, latitude, longitude } }`
- Réponse : `estimated_total_cents`, `items` (prix estimés), `confidence`, `estimated_shopping_time_minutes`.
- Logique : utiliser tarifs catalogue + heuristique fallback (prix moyen par catégorie). Appel combiné `autocomplete_characteristic` pour enrichir.

### 3.2 Création commande
`POST /api/shopping/orders`
- Crée `shopping_orders` + `deliveries` couplés.
- Valide solde: `wallet_balance >= estimated_total + margin + delivery_cost`.
- Déclenche matching (coursiers déclarant `can_shop = true`).
- Retourne résumé livraison + panier.

### 3.3 Mise à jour coursier
- `POST /api/shopping/orders/{id}/items/{item_id}` body `{ status, actual_price_cents?, replacement? }`.
- `POST /api/shopping/orders/{id}/checkout` body `{ actual_total_cents, receipt_photo_url?, notes? }`.
- `POST /api/shopping/orders/{id}/status` (ex: `shopping_in_progress`, `shopping_completed`).

### 3.4 Wallet
- Endpoint existant ou à créer : `GET /api/wallet/balance`.
- `POST /api/wallet/hold` lors création (réserver montant).
- `POST /api/wallet/release` / `capture` selon checkout réel.

## 4. Matching coursier
- Étendre `DeliveryService::match_delivery` :
  - Filtrer coursiers `courier_assets` + flag `can_shop`.
  - Score = (distance magasin, distance dropoff, rating, historique courses supermarché).
  - Ajouter temps marché estimé dans ETA globale.
- Statut initial : `awaiting_purchase`.
- WebSocket `status` diffuse nouveaux états (ex. `shopping_in_progress`).

## 5. WebSocket
- `DeliveryWsEvent::Status` : nouveaux statuts.
- `DeliveryWsEvent::Pricing` : inclure `shopping_cost`.
- Option future `shopping_update` : progression item par item (ex. pour timeline client).

## 6. Services internes
- `ShoppingEstimatorService` : calcul prix/temps (cache + heuristiques).
- `WalletService` : hold/release fonds (sécurité double écriture).
- `ShoppingNotificationService` : push client/coursier (statuts).

## 7. Flow coursier
1. Notification `Nouvelle course supermarché`.
2. Acceptation → état `shopping_in_progress`.
3. Checklist items (API `update_item`).
4. Checkout : saisie total réel + upload ticket.
5. Livraison (statuts livraison standard).

## 8. Sécurité / validations
- Vérifier solde + marge (ex: 15%) avant création.
- Limiter montant `actual_total` par rapport estimation (ex: > +20% → confirmation manual).
- Audit log pour modifications prix.
- Validation `receipt_photo_url` (stockage S3 signé).

## 9. Tests
- Tests unitaires : estimation, matching shopping, validation solde.
- Tests intégration : `POST /api/shopping/orders` + WebSocket status.
- Tests e2e : flow complet (commande, achat, livraison).

## 10. Roadmap backend
1. Migrations + enums.
2. Implémentation `ShoppingEstimatorService`.
3. Endpoints estimate/create.
4. Intégration matching + WS.
5. Checkout & wallet.
6. Tests automatisés & monitoring.

