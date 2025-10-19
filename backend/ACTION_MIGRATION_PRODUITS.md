# ⚡ Action : Migration Désactivation Produits

## 🎯 Résumé des Changements

### Ce qui change
- ❌ **Services ne sont PLUS désactivés automatiquement**
- ✅ **Produits sont désactivés après 30 jours**
- ✅ **Réactivation : 1000 FCFA par produit**
- ✅ **Vérification automatique du solde**
- ✅ **Notifications au prestataire**

---

## 🚀 Application Rapide (10 min)

### Étape 1 : Appliquer la Migration SQL

```powershell
cd backend

# Appliquer la migration
sqlx migrate run

# Sortie attendue:
# Applied 20250119_002_product_lifecycle_management/product lifecycle management (XXXms)
```

### Étape 2 : Vérifier la Création

```powershell
psql -U postgres -d yukpomnang -c "
  -- Vérifier la table
  SELECT COUNT(*) FROM products_lifecycle;
  
  -- Vérifier les fonctions
  \df deactivate_expired_products
  \df reactivate_product
  \df reactivate_multiple_products
"
```

### Étape 3 : Synchroniser les Produits Existants

```sql
-- Lance la synchronisation
SELECT sync_products_to_lifecycle();

-- Vérifier combien de produits ont été synchronisés
SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as actifs,
    SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END) as inactifs
FROM products_lifecycle;
```

### Étape 4 : Ajouter les Routes dans le Router

**Fichier** : `backend/src/routers/router_yukpo.rs` (ou votre router principal)

```rust
// Ajouter l'import
mod routes::product_lifecycle_routes;

// Dans la fonction de configuration
pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg
        // ... routes existantes
        
        // Nouvelles routes produits
        .service(
            web::scope("/api")
                .configure(product_lifecycle_routes::configure_product_lifecycle_routes)
        );
}
```

### Étape 5 : Ajouter les Modules dans mod.rs

**Fichier** : `backend/src/tasks/mod.rs`

```rust
pub mod product_deactivation;
```

**Fichier** : `backend/src/controllers/mod.rs`

```rust
pub mod product_lifecycle_controller;
```

**Fichier** : `backend/src/routes/mod.rs`

```rust
pub mod product_lifecycle_routes;
```

### Étape 6 : Régénérer les Métadonnées

```powershell
# Régénérer les métadonnées offline
cargo sqlx prepare

# Compiler
$env:SQLX_OFFLINE="true"
cargo build
```

### Étape 7 : Lancer le Backend

```powershell
cargo run

# Tester les endpoints
curl http://localhost:3000/api/products/reactivation-cost?count=10
```

---

## 🧪 Tests Rapides

### Test 1 : Récupérer les Produits Inactifs

```bash
curl -X GET http://localhost:3000/api/products/inactive \
  -H "Authorization: Bearer YOUR_TOKEN"

# Devrait retourner:
# {
#   "success": true,
#   "products": [...],
#   "count": X,
#   "total_reactivation_cost": X000
# }
```

### Test 2 : Calculer le Coût

```bash
curl -X GET "http://localhost:3000/api/products/reactivation-cost?count=10"

# Devrait retourner:
# {
#   "cost_per_product": 1000,
#   "product_count": 10,
#   "total_cost": 10000
# }
```

### Test 3 : Réactiver un Produit

```bash
curl -X POST http://localhost:3000/api/products/reactivate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": 1,
    "product_index": 0
  }'

# Si solde suffisant:
# {
#   "success": true,
#   "cost": 1000,
#   "new_balance": 49000
# }

# Si solde insuffisant:
# {
#   "success": false,
#   "error": "Solde insuffisant",
#   "required": 1000,
#   "balance": 500
# }
```

### Test 4 : Désactivation Manuelle (pour tester)

```sql
-- Forcer un produit à expirer
UPDATE products_lifecycle
SET auto_deactivate_at = NOW() - INTERVAL '1 day'
WHERE service_id = 1 AND product_index = 0;

-- Lancer la désactivation
SELECT * FROM deactivate_expired_products();

-- Vérifier
SELECT is_active FROM products_lifecycle 
WHERE service_id = 1 AND product_index = 0;
-- Devrait être FALSE
```

---

## 📱 Intégration Mobile/Frontend

### Mobile

**Fichier** : `mobile/src/screens/MesServicesScreen.tsx` (ou Dashboard)

```typescript
import ProductReactivationModal from '../components/ProductReactivationModal';

const [showReactivation, setShowReactivation] = useState(false);
const [inactiveCount, setInactiveCount] = useState(0);

// Charger le nombre de produits inactifs
useEffect(() => {
    const loadInactiveCount = async () => {
        const response = await apiGet('/api/products/inactive');
        if (response.success) {
            setInactiveCount(response.data.products.length);
        }
    };
    loadInactiveCount();
}, []);

// Afficher un badge si produits inactifs
{inactiveCount > 0 && (
    <TouchableOpacity 
        style={styles.warningCard}
        onPress={() => setShowReactivation(true)}
    >
        <SafeIcon name="alert-triangle" size={24} color="#EF4444" />
        <View>
            <Text style={styles.warningTitle}>
                {inactiveCount} produit(s) désactivé(s)
            </Text>
            <Text style={styles.warningText}>
                Réactivez-les pour les rendre visibles
            </Text>
        </View>
    </TouchableOpacity>
)}

// Modal
<ProductReactivationModal
    visible={showReactivation}
    onClose={() => setShowReactivation(false)}
    onSuccess={() => {
        setShowReactivation(false);
        loadInactiveCount();
    }}
    userId={user.id}
/>
```

### Frontend

**Fichier** : `frontend/src/pages/dashboard/MesServices.tsx`

```typescript
import ProductReactivationModal from '@/components/products/ProductReactivationModal';

// Même logique que mobile
```

---

## 🔔 Configuration des Notifications

### Créer la Table Notifications (si pas encore fait)

```sql
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_id INTEGER, -- service_id
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
```

---

## 📊 Monitoring & Alertes

### Dashboard Admin

```sql
-- Produits désactivés aujourd'hui
SELECT COUNT(*) FROM products_lifecycle
WHERE is_active = FALSE 
AND DATE(updated_at) = CURRENT_DATE;

-- Revenus des réactivations cette semaine
SELECT SUM(reactivation_cost) 
FROM products_lifecycle
WHERE last_reactivated_at >= NOW() - INTERVAL '7 days';

-- Prestataires avec produits inactifs
SELECT 
    u.id,
    u.name,
    COUNT(*) as inactive_products_count,
    SUM(pl.reactivation_cost) as potential_revenue
FROM products_lifecycle pl
JOIN services s ON s.id = pl.service_id
JOIN users u ON u.id = s.user_id
WHERE pl.is_active = FALSE
GROUP BY u.id, u.name
ORDER BY inactive_products_count DESC;
```

---

## ✅ Checklist Finale

### Backend
- [ ] Migration `20250119_002_product_lifecycle_management.sql` appliquée
- [ ] Table `products_lifecycle` créée
- [ ] 6 fonctions SQL créées
- [ ] Trigger de sync actif
- [ ] Produits synchronisés
- [ ] Module `product_deactivation.rs` créé
- [ ] Controller `product_lifecycle_controller.rs` créé
- [ ] Routes `product_lifecycle_routes.rs` créées
- [ ] Routes ajoutées au router principal
- [ ] Modules exposés dans mod.rs
- [ ] Tests passent
- [ ] Backend compile
- [ ] Tâche cron configurée

### Mobile
- [ ] Composant `ProductReactivationModal.tsx` créé
- [ ] Intégré dans le dashboard prestataire
- [ ] Badge notification produits inactifs
- [ ] Tests manuels effectués

### Frontend
- [ ] Composant `ProductReactivationModal.tsx` créé
- [ ] Intégré dans le dashboard prestataire
- [ ] Badge notification produits inactifs
- [ ] Tests manuels effectués

---

## 🎯 Prochaines Étapes

1. **Immédiat** : Appliquer la migration (`sqlx migrate run`)
2. **Court terme** : Configurer la tâche cron
3. **Moyen terme** : Ajouter analytics des réactivations
4. **Long terme** : Système de rappels automatiques avant désactivation

---

**Questions ?** Consultez `SYSTEME_DESACTIVATION_PRODUITS.md` pour la documentation complète.

