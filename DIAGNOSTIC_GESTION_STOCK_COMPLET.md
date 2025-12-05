# 🔍 Diagnostic Complet - Gestion du Stock dans Yukpomnang

**Date**: 2025-01-28

---

## 📊 ÉTAT DES LIEUX

### ✅ **1. Système de Désactivation Automatique Existant**

#### **Implémentation actuelle** :
- **Fichier** : `backend/src/tasks/product_deactivation.rs`
- **Fonction DB** : `deactivate_expired_products()` (dans `auto_migrate.rs`)
- **Table** : `products_lifecycle`
- **Critère** : Basé sur `auto_deactivate_at` (30 jours par défaut)
- **Colonnes** :
  - `is_active` (BOOLEAN)
  - `auto_deactivate_at` (TIMESTAMPTZ)
  - `deactivation_count` (INTEGER)
  - `reactivation_cost` (INTEGER, défaut: 1000)

#### **Problème identifié** :
- ❌ **Pas de vérification du stock** dans la désactivation automatique
- ❌ **Pas de distinction produit vs prestation** (s'applique à tous)
- ❌ **Pas de notification** au prestataire lors de la désactivation

---

### ✅ **2. Gestion du Stock dans ProductCard**

#### **Implémentation actuelle** :
- **Fichier** : `mobile/src/components/ProductCard.tsx`
- **Affichage** : Le stock est affiché pour les variantes (lignes 1979-1989)
- **Badges visuels** :
  - `stockOK` : stock > 5
  - `stockLow` : stock > 0 et <= 5
  - `stockOut` : stock = 0

#### **Problème identifié** :
- ❌ **Pas de décrémentation du stock** lors d'une commande
- ❌ **Pas de vérification du stock** avant de créer une commande
- ❌ **Pas de désactivation automatique** si stock = 0

---

### ✅ **3. Gestion du Stock dans les Commandes**

#### **Implémentation actuelle** :
- **Fichier** : `backend/src/services/order_preparation_service.rs`
- **Fonction** : `create_order()` (ligne 109)
- **Vérifications** : Aucune vérification du stock

#### **Problème identifié** :
- ❌ **Pas de vérification du stock** avant création de commande
- ❌ **Pas de décrémentation du stock** lors de la validation de commande
- ❌ **Pas de distinction produit vs prestation**

---

### ✅ **4. Gestion du Stock dans les Livraisons Automatiques**

#### **Implémentation actuelle** :
- **Fichier** : `backend/src/services/delivery_service.rs`
- **Fonction** : `create_delivery_request()` et fonctions associées
- **Vérifications** : Aucune vérification du stock

#### **Problème identifié** :
- ❌ **Pas de vérification du stock** lors du lancement automatique d'une livraison
- ❌ **Pas de décrémentation du stock** lors de la création d'une livraison

---

### ✅ **5. Gestion du Stock dans la Génération Vidéo Marketing**

#### **Implémentation actuelle** :
- **Fichier** : `backend/src/services/video_generation_service.rs`
- **Fonction** : `generate_video()` et fonctions associées
- **Paramètres** : `related_product_indices` (ligne 116)

#### **Problème identifié** :
- ❌ **Pas de vérification du stock** lors de la génération vidéo
- ❌ **Pas de prise en compte du stock** dans le style de vidéo marketing
- ❌ **Pas de distinction produit vs prestation**

---

## 🎯 PROBLÈMES IDENTIFIÉS

### **1. Désactivation Automatique**
- ❌ Ne vérifie pas le stock (uniquement basé sur les jours actifs)
- ❌ Ne distingue pas produit vs prestation
- ❌ Pas de notification au prestataire

### **2. Commandes (ProductCard)**
- ❌ Pas de vérification du stock avant commande
- ❌ Pas de décrémentation du stock lors de la commande
- ❌ Pas de désactivation automatique si stock = 0

### **3. Livraisons Automatiques**
- ❌ Pas de vérification du stock lors du lancement
- ❌ Pas de décrémentation du stock

### **4. Génération Vidéo Marketing**
- ❌ Pas de prise en compte du stock dans le style de vidéo
- ❌ Pas de vérification du stock des produits liés

---

## 💡 SOLUTIONS PROPOSÉES

### **1. Améliorer la Désactivation Automatique**

#### **A. Ajouter la vérification du stock**
```sql
-- Modifier la fonction deactivate_expired_products()
-- Pour inclure la vérification du stock = 0
CREATE OR REPLACE FUNCTION deactivate_expired_products()
RETURNS TABLE(...) AS $$
BEGIN
    RETURN QUERY
    UPDATE products_lifecycle pl
    SET 
        is_active = FALSE,
        updated_at = NOW(),
        deactivation_count = deactivation_count + 1
    FROM services s
    WHERE pl.service_id = s.id
        AND pl.is_active = TRUE
        AND (
            -- Critère 1: Délai expiré (existant)
            pl.auto_deactivate_at <= NOW()
            OR
            -- Critère 2: Stock = 0 (NOUVEAU)
            (
                s.is_tarissable = TRUE  -- Uniquement pour les produits
                AND EXISTS (
                    SELECT 1 FROM autocomplete_characteristics ac
                    WHERE ac.service_id = s.id
                        AND ac.stock IS NOT NULL
                        AND ac.stock <= 0
                )
            )
        )
    RETURNING ...;
END;
$$ LANGUAGE plpgsql;
```

#### **B. Ajouter la notification au prestataire**
```rust
// Dans product_deactivation.rs
// Après désactivation, envoyer notification push
if let Some(user_id) = deactivated_product.user_id {
    push_notification_service::send_notification(
        user_id,
        "Produit désactivé",
        format!("Le produit '{}' a été désactivé car le stock est épuisé", product_nom),
        "product_deactivated"
    ).await?;
}
```

---

### **2. Vérifier et Décrémenter le Stock lors des Commandes**

#### **A. Vérification avant création de commande**
```rust
// Dans order_preparation_service.rs
pub async fn create_order(&self, request: CreateOrderRequest) -> AppResult<ProductOrder> {
    // ✅ NOUVEAU: Vérifier le stock avant de créer la commande
    let service = sqlx::query_scalar::<_, bool>(
        "SELECT is_tarissable FROM services WHERE id = $1"
    )
    .bind(request.service_id)
    .fetch_one(&self.pool)
    .await?;
    
    // Uniquement pour les produits (is_tarissable = TRUE)
    if service {
        let available_stock: Option<i32> = sqlx::query_scalar(
            r#"
            SELECT stock
            FROM autocomplete_characteristics
            WHERE service_id = $1
                AND product_index = $2
            LIMIT 1
            "#
        )
        .bind(request.service_id)
        .bind(request.product_index)
        .fetch_optional(&self.pool)
        .await?;
        
        if let Some(stock) = available_stock {
            if stock <= 0 {
                return Err(AppError::BadRequest(
                    "Stock épuisé. Ce produit n'est plus disponible.".to_string()
                ));
            }
        }
    }
    
    // ... reste du code
}
```

#### **B. Décrémentation lors de la validation**
```rust
// Dans order_preparation_service.rs
pub async fn validate_order(...) -> AppResult<ProductOrder> {
    // ... validation existante ...
    
    // ✅ NOUVEAU: Décrémenter le stock après validation
    let service = sqlx::query_scalar::<_, bool>(
        "SELECT is_tarissable FROM services WHERE id = $1"
    )
    .bind(order.service_id)
    .fetch_one(&self.pool)
    .await?;
    
    if service {
        sqlx::query(
            r#"
            UPDATE autocomplete_characteristics
            SET stock = GREATEST(0, stock - 1)
            WHERE service_id = $1
                AND product_index = $2
                AND stock > 0
            "#
        )
        .bind(order.service_id)
        .bind(order.product_index)
        .execute(&self.pool)
        .await?;
        
        // ✅ NOUVEAU: Vérifier si stock = 0 après décrémentation
        let remaining_stock: Option<i32> = sqlx::query_scalar(
            r#"
            SELECT stock
            FROM autocomplete_characteristics
            WHERE service_id = $1
                AND product_index = $2
            LIMIT 1
            "#
        )
        .bind(order.service_id)
        .bind(order.product_index)
        .fetch_optional(&self.pool)
        .await?;
        
        if remaining_stock == Some(0) {
            // Désactiver automatiquement le produit
            self.deactivate_product_if_stock_zero(order.service_id, order.product_index).await?;
        }
    }
    
    // ... reste du code
}
```

---

### **3. Vérifier le Stock lors des Livraisons Automatiques**

```rust
// Dans delivery_service.rs
pub async fn create_delivery_request(...) -> AppResult<DeliverySummary> {
    // ✅ NOUVEAU: Vérifier le stock pour chaque produit dans shopping_items
    for item in &shopping_items {
        let service = sqlx::query_scalar::<_, bool>(
            "SELECT is_tarissable FROM services WHERE id = $1"
        )
        .bind(item.service_id)
        .fetch_one(&self.pool)
        .await?;
        
        if service {
            let available_stock: Option<i32> = sqlx::query_scalar(
                r#"
                SELECT stock
                FROM autocomplete_characteristics
                WHERE service_id = $1
                    AND product_index = $2
                LIMIT 1
                "#
            )
            .bind(item.service_id)
            .bind(item.product_index)
            .fetch_optional(&self.pool)
            .await?;
            
            if let Some(stock) = available_stock {
                if stock < item.quantity {
                    return Err(AppError::BadRequest(format!(
                        "Stock insuffisant pour le produit '{}'. Stock disponible: {}, Quantité demandée: {}",
                        item.product_name, stock, item.quantity
                    )));
                }
            }
        }
    }
    
    // ... reste du code
}
```

---

### **4. Prendre en Compte le Stock dans la Génération Vidéo Marketing**

```rust
// Dans video_generation_service.rs
pub async fn generate_video(...) -> AppResult<VideoGenerationResponse> {
    // ✅ NOUVEAU: Vérifier le stock des produits liés
    if let Some(product_indices) = &payload.related_product_indices {
        let mut stock_info: Vec<(i32, i32)> = Vec::new();
        
        for &product_index in product_indices {
            let stock: Option<i32> = sqlx::query_scalar(
                r#"
                SELECT ac.stock
                FROM autocomplete_characteristics ac
                JOIN services s ON s.id = ac.service_id
                WHERE ac.service_id = $1
                    AND ac.product_index = $2
                    AND s.is_tarissable = TRUE
                LIMIT 1
                "#
            )
            .bind(service_id)
            .bind(product_index)
            .fetch_optional(&self.pool)
            .await?;
            
            if let Some(stock_value) = stock {
                stock_info.push((product_index, stock_value));
            }
        }
        
        // ✅ NOUVEAU: Adapter le style de vidéo selon le stock
        let style_effects = if stock_info.iter().any(|(_, stock)| *stock <= 5) {
            // Stock faible → Style "urgence" ou "dernière chance"
            vec!["urgency".to_string(), "limited_stock".to_string()]
        } else if stock_info.iter().any(|(_, stock)| *stock == 0) {
            // Stock épuisé → Ne pas générer de vidéo marketing
            return Err(AppError::BadRequest(
                "Impossible de générer une vidéo marketing pour un produit en rupture de stock".to_string()
            ));
        } else {
            // Stock normal → Style standard
            payload.style_effects.clone().unwrap_or_default()
        };
        
        // Utiliser style_effects adapté dans la génération
    }
    
    // ... reste du code
}
```

---

## 📋 PLAN D'IMPLÉMENTATION

### **Phase 1 : Désactivation Automatique (Priorité Haute)**
1. ✅ Modifier la fonction `deactivate_expired_products()` pour inclure la vérification du stock
2. ✅ Ajouter la condition `is_tarissable = TRUE` (uniquement produits)
3. ✅ Ajouter la notification au prestataire
4. ✅ Tester avec des produits en stock = 0

### **Phase 2 : Commandes (Priorité Haute)**
1. ✅ Ajouter la vérification du stock avant création de commande
2. ✅ Ajouter la décrémentation du stock lors de la validation
3. ✅ Ajouter la désactivation automatique si stock = 0 après décrémentation
4. ✅ Tester le flux complet

### **Phase 3 : Livraisons Automatiques (Priorité Moyenne)**
1. ✅ Ajouter la vérification du stock pour chaque produit
2. ✅ Bloquer la création si stock insuffisant
3. ✅ Tester avec plusieurs produits

### **Phase 4 : Génération Vidéo Marketing (Priorité Moyenne)**
1. ✅ Ajouter la vérification du stock des produits liés
2. ✅ Adapter le style selon le stock
3. ✅ Bloquer la génération si stock = 0
4. ✅ Tester différents scénarios

---

## ⚠️ POINTS D'ATTENTION

1. **Conditionnalité Produit vs Prestation** :
   - ✅ Toujours vérifier `is_tarissable = TRUE` avant de gérer le stock
   - ✅ Ne jamais appliquer la gestion du stock aux prestations

2. **Performance** :
   - ✅ Utiliser des index sur `service_id`, `product_index`, `stock`
   - ✅ Mettre en cache le stock dans Redis pour les vérifications fréquentes

3. **Cohérence** :
   - ✅ Utiliser des transactions pour garantir la cohérence
   - ✅ Gérer les cas de race condition (plusieurs commandes simultanées)

4. **Notifications** :
   - ✅ Notifier le prestataire lors de la désactivation automatique
   - ✅ Notifier le client si stock insuffisant lors d'une commande

---

**Status** : Diagnostic complet ✅ - Solutions proposées ✅ - Prêt pour implémentation

