# 📦 Système de Désactivation/Réactivation des Produits

## 🎯 Changement Majeur

### Ancien Système ❌
```
Service tarissable → Désactivation automatique après X jours
├─ Vitesse rapide: 7 jours
├─ Vitesse moyenne: 14 jours
└─ Vitesse lente: 30 jours
```

### Nouveau Système ✅
```
Produit → Désactivation automatique après 30 jours
├─ TOUS les produits (pas de distinction de vitesse)
├─ Réactivation: 1000 FCFA par produit
└─ Service reste TOUJOURS actif
```

---

## 🏗️ Architecture

### Table `products_lifecycle`

```sql
CREATE TABLE products_lifecycle (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL,
    product_index INTEGER NOT NULL,          -- Position dans data->'produits'
    product_nom TEXT NOT NULL,
    product_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    auto_deactivate_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    last_reactivated_at TIMESTAMPTZ,
    reactivation_cost INTEGER DEFAULT 1000,  -- 1000 FCFA
    deactivation_count INTEGER DEFAULT 0,    -- Nombre de désactivations
    total_reactivation_paid INTEGER DEFAULT 0,
    
    UNIQUE(service_id, product_index)
);
```

### Synchronisation Automatique

**Trigger** : Chaque fois qu'un service est créé/modifié avec des produits :
```sql
CREATE TRIGGER trigger_sync_products
    AFTER INSERT OR UPDATE ON services
    FOR EACH ROW
    WHEN (jsonb_typeof(NEW.data->'produits') = 'array')
    EXECUTE FUNCTION sync_product_on_service_update();
```

---

## ⏰ Désactivation Automatique

### Processus

```
Jour 0:  Produit créé → auto_deactivate_at = J+30
Jour 30: Tâche cron désactive le produit
         └─ is_active = FALSE
         └─ Notification envoyée au prestataire
         └─ deactivation_count++

Prestataire réactive → Paie 1000 FCFA
         └─ is_active = TRUE
         └─ auto_deactivate_at = NOW() + 30 jours
         └─ total_reactivation_paid += 1000
```

### Tâche Cron (à configurer)

```bash
# Crontab : Chaque jour à 2h du matin
0 2 * * * cd /path/to/backend && cargo run --bin deactivate_products
```

**Fichier Rust** : `backend/src/tasks/product_deactivation.rs`

```rust
// Fonction principale
pub async fn deactivate_expired_products(pool: &PgPool) -> Result<usize, sqlx::Error>

// Retourne le nombre de produits désactivés
// Envoie automatiquement les notifications
```

---

## 💰 Système de Réactivation

### Coûts

| Nombre de Produits | Coût Unitaire | Coût Total |
|-------------------|---------------|------------|
| 1 produit | 1000 FCFA | **1,000 FCFA** |
| 5 produits | 1000 FCFA | **5,000 FCFA** |
| 10 produits | 1000 FCFA | **10,000 FCFA** |
| 50 produits | 1000 FCFA | **50,000 FCFA** |

### Vérification du Solde

```rust
// Fonction PostgreSQL
reactivate_product(service_id, product_index, user_id)
├─ Vérifier solde utilisateur
├─ Si solde < 1000 FCFA → Retourner erreur
├─ Si solde >= 1000 FCFA:
│  ├─ Débiter 1000 FCFA
│  ├─ Réactiver produit
│  ├─ auto_deactivate_at = NOW() + 30 jours
│  └─ Logger l'action
└─ Retourner nouveau solde
```

### Réactivation Multiple

```rust
// Fonction PostgreSQL
reactivate_multiple_products(service_id, product_indices[], user_id)
├─ Calculer coût total: 1000 × nombre de produits
├─ Vérifier solde >= coût total
├─ Si insuffisant → Retourner erreur détaillée
├─ Si suffisant:
│  ├─ Débiter coût total
│  ├─ Réactiver TOUS les produits sélectionnés
│  └─ Logger l'action
└─ Retourner: success, count, total_cost, new_balance
```

---

## 🔔 Notifications

### Notification de Désactivation

**Table** : `notifications`

```sql
INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    related_id
) VALUES (
    $user_id,
    'product_deactivated',
    'Produit désactivé: iPhone 14 Pro',
    'Votre produit "iPhone 14 Pro" a été automatiquement désactivé après 30 jours. Réactivez-le pour 1000 FCFA.',
    $service_id
);
```

### Notification Push (optionnel)

Si le prestataire a activé les notifications push, il reçoit :
- 📱 Notification mobile
- 📧 Email (optionnel)
- 🔔 Badge dans l'app

---

## 🌐 API Endpoints

### GET `/api/products/inactive`
**Description** : Récupère tous les produits désactivés du prestataire

**Response** :
```json
{
  "success": true,
  "products": [
    {
      "id": 123,
      "service_id": 456,
      "product_index": 0,
      "product_nom": "iPhone 14 Pro",
      "product_type": "electromenager",
      "auto_deactivate_at": "2025-01-19T10:00:00Z",
      "reactivation_cost": 1000,
      "deactivation_count": 2
    }
  ],
  "count": 1,
  "total_reactivation_cost": 1000
}
```

### GET `/api/products/:service_id/status`
**Description** : Statut de tous les produits d'un service

**Response** :
```json
{
  "success": true,
  "service_id": 456,
  "products": [
    {
      "product_index": 0,
      "product_nom": "iPhone 14 Pro",
      "is_active": false,
      "days_until_deactivation": 0,
      "reactivation_cost": 1000
    },
    {
      "product_index": 1,
      "product_nom": "Samsung Galaxy S24",
      "is_active": true,
      "days_until_deactivation": 15,
      "reactivation_cost": 1000
    }
  ],
  "total_products": 2,
  "active_products": 1,
  "inactive_products": 1
}
```

### POST `/api/products/reactivate`
**Description** : Réactive un seul produit

**Request** :
```json
{
  "service_id": 456,
  "product_index": 0
}
```

**Response Success** :
```json
{
  "success": true,
  "message": "Produit réactivé avec succès",
  "cost": 1000,
  "next_deactivation": "2025-02-18T10:00:00Z",
  "new_balance": 45000
}
```

**Response Error (Solde insuffisant)** :
```json
{
  "success": false,
  "error": "Solde insuffisant",
  "required": 1000,
  "balance": 500
}
```

### POST `/api/products/reactivate-multiple`
**Description** : Réactive plusieurs produits en une fois

**Request** :
```json
{
  "service_id": 456,
  "product_indices": [0, 1, 2, 3, 4]
}
```

**Response Success** :
```json
{
  "success": true,
  "message": "5 produit(s) réactivé(s) avec succès",
  "reactivated_count": 5,
  "total_cost": 5000,
  "cost_per_product": 1000,
  "next_deactivation": "2025-02-18T10:00:00Z",
  "new_balance": 40000
}
```

**Response Error** :
```json
{
  "success": false,
  "error": "Solde insuffisant",
  "required": 5000,
  "balance": 3000,
  "products_count": 5,
  "cost_per_product": 1000
}
```

### GET `/api/products/reactivation-cost?count=10`
**Description** : Calculer le coût de réactivation

**Response** :
```json
{
  "success": true,
  "cost_per_product": 1000,
  "product_count": 10,
  "total_cost": 10000,
  "currency": "FCFA"
}
```

---

## 📱 Interface Mobile

### Composant : `ProductReactivationModal.tsx`

#### Écran Principal
```
┌────────────────────────────────────────┐
│ × Produits Désactivés                  │
│   Réactivez pour 1000 FCFA chacun      │
├────────────────────────────────────────┤
│ 💰 Votre solde        45,000 FCFA      │
├────────────────────────────────────────┤
│ [✓ Tout sélectionner] [□ Désélectionner]│
│                                         │
│ ✓ 🏢 Maison 3 chambres        1000 FCFA │
│   🕐 Désactivé le 19/12/2024            │
│                                         │
│ ✓ 🚗 Toyota Corolla 2020      1000 FCFA │
│   🕐 Désactivé le 15/12/2024            │
│   (Désactivé 2 fois)                    │
│                                         │
│ □ 📱 iPhone 14 Pro           1000 FCFA │
│   🕐 Désactivé le 10/12/2024            │
├────────────────────────────────────────┤
│ 2 produits sélectionnés                │
│ Total : 2,000 FCFA                     │
│                                         │
│ [Réactiver pour 2,000 FCFA]           │
└────────────────────────────────────────┘
```

#### Après Réactivation
```
┌────────────────────────────────────────┐
│ ✅ Réactivation réussie !               │
│                                         │
│ 2 produits réactivés                   │
│ Coût total : 2,000 FCFA                │
│ Nouveau solde : 43,000 FCFA            │
│                                         │
│ Les produits seront actifs pendant     │
│ 30 jours (jusqu'au 18/02/2025)         │
│                                         │
│ [OK]                                   │
└────────────────────────────────────────┘
```

---

## 🌐 Interface Frontend

### Composant : `ProductReactivationModal.tsx`

Interface identique au mobile, adaptée pour web avec TailwindCSS.

---

## 🔄 Migration et Déploiement

### Étape 1 : Appliquer la Migration

```bash
cd backend
sqlx migrate run

# Vérifier que la table est créée
psql -U postgres -d yukpomnang -c "
  SELECT * FROM products_lifecycle LIMIT 5;
"

# Vérifier les fonctions
psql -U postgres -d yukpomnang -c "
  \df deactivate_expired_products
  \df reactivate_product
  \df reactivate_multiple_products
"
```

### Étape 2 : Synchroniser les Produits Existants

```sql
-- Synchroniser tous les produits existants
SELECT sync_products_to_lifecycle();

-- Vérifier le résultat
SELECT COUNT(*) FROM products_lifecycle;
```

### Étape 3 : Configurer la Tâche Cron

#### Option A : Cron Linux/Mac
```bash
crontab -e

# Ajouter la ligne (chaque jour à 2h)
0 2 * * * cd /path/to/backend && /path/to/cargo run --bin deactivate_products >> /var/log/product_deactivation.log 2>&1
```

#### Option B : Scheduler Windows
```powershell
# Créer une tâche planifiée
schtasks /create /tn "DeactivateProducts" /tr "C:\path\to\deactivate_products.bat" /sc daily /st 02:00
```

**Fichier `deactivate_products.bat`** :
```batch
@echo off
cd C:\Users\23767\yukpomnang\backend
cargo run --bin deactivate_products
```

#### Option C : Intégré au Backend (Recommandé)

Utiliser un scheduler Rust comme `tokio-cron-scheduler` :

```rust
// Dans main.rs
use tokio_cron_scheduler::{JobScheduler, Job};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // ...
    
    // Créer le scheduler
    let scheduler = JobScheduler::new().await.unwrap();
    
    // Tâche: Désactiver produits expirés (chaque jour à 2h)
    let deactivation_job = Job::new_async("0 0 2 * * *", |_uuid, _l| {
        Box::pin(async move {
            let pool = get_db_pool().await;
            match product_deactivation::deactivate_expired_products(&pool).await {
                Ok(count) => println!("✅ {} produits désactivés", count),
                Err(e) => eprintln!("❌ Erreur désactivation: {}", e),
            }
        })
    }).unwrap();
    
    scheduler.add(deactivation_job).await.unwrap();
    scheduler.start().await.unwrap();
    
    // ...
}
```

---

## 📊 Statistiques & Monitoring

### Vue des Produits Inactifs

```sql
SELECT * FROM inactive_products_view;

-- Colonnes:
-- - product_nom, product_type
-- - auto_deactivate_at (date de désactivation)
-- - reactivation_cost
-- - user_name, user_email
-- - user_balance (solde actuel)
```

### Statistiques Globales

```sql
SELECT 
    COUNT(*) as total_products,
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END) as inactive,
    SUM(CASE WHEN is_active AND auto_deactivate_at < NOW() + INTERVAL '7 days' THEN 1 ELSE 0 END) as expiring_soon
FROM products_lifecycle;
```

### Revenus par Réactivations

```sql
SELECT 
    SUM(total_reactivation_paid) as total_revenue,
    AVG(deactivation_count) as avg_deactivations_per_product,
    COUNT(DISTINCT service_id) as services_with_reactivations
FROM products_lifecycle
WHERE total_reactivation_paid > 0;
```

---

## 🧪 Tests

### Test 1 : Désactivation Automatique

```sql
-- Créer un produit avec désactivation immédiate (test)
INSERT INTO products_lifecycle (
    service_id, product_index, product_nom, product_type, 
    auto_deactivate_at
) VALUES (
    1, 0, 'Test Product', 'autre',
    NOW() - INTERVAL '1 day' -- Déjà expiré
);

-- Lancer la désactivation
SELECT * FROM deactivate_expired_products();

-- Vérifier le résultat
SELECT is_active FROM products_lifecycle WHERE product_nom = 'Test Product';
-- Devrait retourner: FALSE
```

### Test 2 : Réactivation avec Solde Suffisant

```sql
-- Vérifier le solde
SELECT tokens_balance FROM users WHERE id = 1;
-- Exemple: 50000 FCFA

-- Réactiver un produit
SELECT reactivate_product(1, 0, 1);

-- Résultat attendu:
-- {
--   "success": true,
--   "cost": 1000,
--   "new_balance": 49000
-- }
```

### Test 3 : Réactivation avec Solde Insuffisant

```sql
-- Mettre un solde faible
UPDATE users SET tokens_balance = 500 WHERE id = 1;

-- Tenter réactivation
SELECT reactivate_product(1, 0, 1);

-- Résultat attendu:
-- {
--   "success": false,
--   "error": "Solde insuffisant",
--   "required": 1000,
--   "balance": 500
-- }
```

### Test 4 : Réactivation Multiple (10 produits)

```sql
-- Solde: 15000 FCFA
-- Réactiver 10 produits
SELECT reactivate_multiple_products(1, ARRAY[0,1,2,3,4,5,6,7,8,9], 1);

-- Résultat attendu:
-- {
--   "success": true,
--   "reactivated_count": 10,
--   "total_cost": 10000,
--   "new_balance": 5000
-- }
```

---

## 🎨 Intégration dans l'Interface

### Mobile - Menu Prestataire

```typescript
// Dans le dashboard prestataire
import ProductReactivationModal from '../components/ProductReactivationModal';

const [showReactivation, setShowReactivation] = useState(false);
const [inactiveCount, setInactiveCount] = useState(0);

// Badge notification
{inactiveCount > 0 && (
    <Badge>{inactiveCount} produits à réactiver</Badge>
)}

// Bouton d'accès
<Button onPress={() => setShowReactivation(true)}>
    Gérer mes produits désactivés
</Button>

// Modal
<ProductReactivationModal
    visible={showReactivation}
    onClose={() => setShowReactivation(false)}
    onSuccess={() => loadServices()}
    userId={user.id}
/>
```

### Frontend - Dashboard

```typescript
import ProductReactivationModal from '@/components/products/ProductReactivationModal';

// Même structure que mobile
```

---

## ⚠️ Points Importants

### Différences avec l'Ancien Système

| Aspect | Ancien (Services) | Nouveau (Produits) |
|--------|-------------------|-------------------|
| Cible | Service entier | Produit individuel |
| Durée avant désactivation | 7/14/30 jours (variable) | **30 jours** (fixe) |
| Coût réactivation | 1000 FCFA (service) | **1000 FCFA par produit** |
| Service actif | Peut être désactivé | **Toujours actif** ✅ |
| Granularité | Tout ou rien | **Produit par produit** |

### Avantages du Nouveau Système

✅ **Granularité fine** : Réactiver seulement les produits nécessaires  
✅ **Services toujours visibles** : Le prestataire reste trouvable  
✅ **Transparence** : Le prestataire voit exactement quels produits sont désactivés  
✅ **Flexibilité** : Peut choisir de ne pas réactiver certains produits  
✅ **Monétisation** : Revenus plus élevés (1000 × nombre de produits)  

---

## 📋 Checklist de Déploiement

- [ ] Migration SQL appliquée (`20250119_002_product_lifecycle_management.sql`)
- [ ] Table `products_lifecycle` créée
- [ ] Fonctions SQL créées (3)
- [ ] Trigger de synchronisation actif
- [ ] Produits existants synchronisés
- [ ] Tâche cron configurée (désactivation automatique)
- [ ] Routes API ajoutées au router
- [ ] Composant mobile créé (`ProductReactivationModal.tsx`)
- [ ] Composant frontend créé (`ProductReactivationModal.tsx`)
- [ ] Tests effectués (4 scénarios)
- [ ] Notifications fonctionnelles
- [ ] Documentation à jour

---

## 🚨 Rollback (si nécessaire)

Pour revenir à l'ancien système :

```sql
-- 1. Supprimer la table
DROP TABLE products_lifecycle CASCADE;

-- 2. Supprimer les fonctions
DROP FUNCTION IF EXISTS deactivate_expired_products();
DROP FUNCTION IF EXISTS reactivate_product(INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS reactivate_multiple_products(INTEGER, INTEGER[], INTEGER);
DROP FUNCTION IF EXISTS sync_product_on_service_update();
DROP FUNCTION IF EXISTS sync_products_to_lifecycle();

-- 3. Réactiver la logique service
-- (Décommenter dans service_deactivation.rs)
```

---

**Date** : 19 janvier 2025  
**Version** : 5.0 - Gestion Cycle de Vie Produits  
**Impact** : ⭐⭐⭐⭐⭐ Transformation complète du système de désactivation

