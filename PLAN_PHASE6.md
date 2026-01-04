# 📋 PLAN PHASE 6 - Migration finale auto_deactivate_expired_products

Date: 2026-01-03
Status: À faire

## 🎯 OBJECTIF

Migrer la fonction `auto_deactivate_expired_products` (job CRON) pour qu'elle utilise la table `service_products` au lieu de JSONB.

## 🔍 PROBLÈME IDENTIFIÉ

La fonction `auto_deactivate_expired_products` dans `backend/src/controllers/product_lifecycle_controller.rs` utilise encore JSONB :
- Lit depuis `services.data->'produits'->'valeur'`
- Écrit dans `services.data` avec `UPDATE services SET data = $1`

**Lignes concernées** : ~265-358

## ✅ SOLUTION PROPOSÉE

1. **Modifier `auto_deactivate_expired_products`** :
   - Utiliser `ProductsService.get_products_by_service()` pour récupérer les produits
   - Utiliser `ProductsService.set_product_active()` pour désactiver
   - Supprimer toutes les écritures JSONB

2. **Utiliser la table `service_products`** :
   - Récupérer les produits depuis `service_products` au lieu de JSONB
   - Utiliser `created_at` de `service_products` pour calculer l'âge
   - Désactiver via `ProductsService.set_product_active()`

## 📝 MODIFICATIONS À FAIRE

### Fichier : `backend/src/controllers/product_lifecycle_controller.rs`

**Fonction** : `auto_deactivate_expired_products()`

**Changements** :
- Supprimer : lecture depuis `services.data->'produits'`
- Supprimer : écriture dans `services.data`
- Ajouter : lecture depuis `ProductsService.get_products_by_service()`
- Ajouter : désactivation via `ProductsService.set_product_active()`

### Exemple de code cible :

```rust
pub async fn auto_deactivate_expired_products(
    pool: &sqlx::PgPool,
) -> Result<usize, String> {
    use crate::utils::log::log_info;
    
    log_info("[auto_deactivate] 🤖 Démarrage du job de désactivation automatique...");
    
    let products_service = crate::services::products_service::ProductsService::new(Arc::new(pool.clone()));
    let threshold_date = Utc::now() - chrono::Duration::days(30);
    let mut products_deactivated = 0;
    
    // Récupérer tous les services
    let services = sqlx::query("SELECT id, user_id FROM services WHERE is_active = true")
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Erreur récupération services: {}", e))?;
    
    for service_row in services {
        let service_id: i32 = service_row.get("id");
        let user_id: i32 = service_row.get("user_id");
        
        // Récupérer les produits depuis service_products
        let products = products_service
            .get_products_by_service(service_id)
            .await
            .map_err(|e| format!("Erreur récupération produits: {}", e))?;
        
        for product in products {
            // Vérifier si le produit est plus vieux que 30 jours
            if product.created_at < threshold_date && product.is_active {
                // Désactiver via ProductsService
                let deactivation_data = json!({
                    "deactivated_at": Utc::now().to_rfc3339(),
                    "deactivation_type": "auto",
                    "deactivation_reason": "Désactivation automatique après 30 jours d'inactivité"
                });
                
                products_service
                    .set_product_active(service_id, product.product_index, false, Some(deactivation_data))
                    .await
                    .map_err(|e| format!("Erreur désactivation produit: {}", e))?;
                
                products_deactivated += 1;
                
                // Notification...
            }
        }
    }
    
    Ok(products_deactivated)
}
```

## ✅ CHECKLIST

- [ ] Modifier `auto_deactivate_expired_products()` pour utiliser `ProductsService`
- [ ] Supprimer toutes les écritures JSONB
- [ ] Tester le job CRON (si possible)
- [ ] Vérifier que les notifications fonctionnent
- [ ] Nettoyer le code obsolète

## 🎯 RÉSULTAT ATTENDU

- ✅ Plus aucune écriture JSONB dans le code backend
- ✅ Le job CRON utilise uniquement `service_products`
- ✅ Migration 100% complète vers `service_products`

## 📊 STATUT ACTUEL

- ✅ Phase 1-5 : Complétées
- ⏳ Phase 6 : `auto_deactivate_expired_products` à migrer
- ✅ Script SQL : Exécuté (JSONB nettoyé dans la DB)

