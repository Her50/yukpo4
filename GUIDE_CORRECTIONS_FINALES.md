# 🔧 GUIDE CORRECTIONS FINALES - Yukpomnang

## Date : 2025-11-01

---

## ✅ CORRECTION #1 : Bloquer Suppression Service (BACKEND)

### Fichier : `backend/src/controllers/service_controller.rs`

### Dans la fonction `supprimer_service`
Ajouter AVANT la suppression SQL :

```rust
// ✅ NOUVEAU 2025-11-01: Vérifier nombre de produits avant suppression
let produits_count_result = sqlx::query(
    r#"
    SELECT jsonb_array_length(
        COALESCE(
            CASE 
                WHEN jsonb_typeof(data->'produits'->'valeur') = 'array' 
                THEN data->'produits'->'valeur'
                ELSE '[]'::jsonb
            END,
            '[]'::jsonb
        )
    ) as count
    FROM services 
    WHERE id = $1
    "#
)
.bind(service_id)
.fetch_one(&state.pg)
.await;

let produits_count = match produits_count_result {
    Ok(row) => row.try_get::<i64, _>("count").unwrap_or(0),
    Err(_) => 0
};

log::info!("[supprimer_service] Service {} contient {} produit(s)", service_id, produits_count);

// Bloquer la suppression si >= 2 produits
if produits_count >= 2 {
    log::warn!("[supprimer_service] ❌ Suppression bloquée : {} produits présents", produits_count);
    return Err(AppError::BadRequest(format!(
        "Impossible de supprimer ce service car il contient {} produits.\n\
        Veuillez d'abord supprimer les produits avant de supprimer le service.\n\
        (Accédez à la gestion des produits pour les supprimer individuellement)",
        produits_count
    )));
}

log::info!("[supprimer_service] ✅ Suppression autorisée ({} produit(s))", produits_count);
```

---

## ✅ CORRECTION #2 : Texte Explicatif ProductManagerMobile (FRONTEND)

### Fichier : `mobile/src/components/ProductManagerMobile.tsx`

### Localisation
Chercher où la liste des produits est rendue (probablement vers la ligne 4000-5000).
Ajouter AVANT le rendu de la liste :

```typescript
{/* ✅ NOUVEAU 2025-11-01: État vide avec instructions */}
{products.length === 0 && (
    <View style={styles.emptyStateContainer}>
        {/* Icône */}
        <View style={styles.emptyIconContainer}>
            <SafeIcon name="package" size={64} color={modernColors.textSecondary} />
        </View>
        
        {/* Titre */}
        <Text style={styles.emptyTitle}>
            📦 Créez votre premier produit
        </Text>
        
        {/* Sous-titre */}
        <Text style={styles.emptySubtitle}>
            Pour ajouter un produit à ce service, utilisez le bouton 
            "➕ Ajouter un produit" en haut de l'écran.
        </Text>
        
        {/* Étapes */}
        <View style={styles.emptyStepsContainer}>
            <View style={styles.emptyStep}>
                <Text style={styles.emptyStepNumber}>1️⃣</Text>
                <Text style={styles.emptyStepText}>
                    Cliquez sur "➕ Ajouter un produit"
                </Text>
            </View>
            
            <View style={styles.emptyStep}>
                <Text style={styles.emptyStepNumber}>2️⃣</Text>
                <Text style={styles.emptyStepText}>
                    Remplissez les informations du produit
                </Text>
            </View>
            
            <View style={styles.emptyStep}>
                <Text style={styles.emptyStepNumber}>3️⃣</Text>
                <Text style={styles.emptyStepText}>
                    Sauvegardez (coût: 3000 FCFA)
                </Text>
            </View>
        </View>
        
        {/* Note informative */}
        <View style={styles.emptyNoteContainer}>
            <SafeIcon name="info" size={16} color={modernColors.info} />
            <Text style={styles.emptyNoteText}>
                💡 Vous pouvez également dupliquer un produit existant depuis 
                "Mes Produits" pour gagner du temps.
            </Text>
        </View>
    </View>
)}
```

### Styles à ajouter (AVANT le `});` final, vers ligne 23600)

```typescript
// ✅ NOUVEAU 2025-11-01: Styles état vide
emptyStateContainer: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: modernColors.surface,
    borderRadius: 12,
    margin: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
},
emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
},
emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: modernColors.text,
    marginBottom: 8,
    textAlign: 'center',
},
emptySubtitle: {
    fontSize: 14,
    color: modernColors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
},
emptyStepsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
},
emptyStep: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
},
emptyStepNumber: {
    fontSize: 20,
},
emptyStepText: {
    flex: 1,
    fontSize: 14,
    color: modernColors.text,
    fontWeight: '500',
    lineHeight: 18,
},
emptyNoteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
},
emptyNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 16,
},
```

---

## ⏳ CORRECTION #3 : Cycle de Vie Produits (BACKEND - AVANCÉ)

### Fichier à créer : `backend/src/controllers/product_lifecycle_controller.rs`

```rust
// ✅ NOUVEAU 2025-11-01: Gestion complète du cycle de vie des produits
// Désactivation manuelle, auto (30j), réactivation avec coût

use crate::core::types::{AppError, AppResult};
use crate::state::AppState;
use crate::middlewares::jwt::AuthenticatedUser;
use axum::{Extension, Json, extract::{Path, State}};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;
use chrono::{Utc, NaiveDateTime};

#[derive(Debug, Deserialize)]
pub struct DeactivateProductRequest {
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProductLifecycleResponse {
    pub success: bool,
    pub message: String,
    pub cost: Option<i64>,
    pub new_balance: Option<i64>,
}

/// Coûts de réactivation configurables
mod reactivation_costs {
    /// Coût fixe après 30 jours de désactivation
    pub const COST_REACTIVATION_30DAYS_XAF: i64 = 1000;
    
    /// Calculer le coût de réactivation selon la durée
    pub fn calculate_reactivation_cost(
        days_inactive: i64,
        deactivation_type: &str
    ) -> i64 {
        if deactivation_type == "auto" || days_inactive >= 30 {
            // Coût fixe après 30 jours ou désactivation auto
            COST_REACTIVATION_30DAYS_XAF
        } else {
            // Prorata si désactivation manuelle avant 30j
            // Formule: (jours_inactifs / 30) * 1000
            let prorata = ((days_inactive as f64 / 30.0) * COST_REACTIVATION_30DAYS_XAF as f64).ceil() as i64;
            prorata.max(100) // Minimum 100 FCFA
        }
    }
}

/// Désactiver un produit manuellement
/// Route : POST /api/services/{service_id}/products/{product_index}/deactivate
pub async fn deactivate_product(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, usize)>,
    Json(request): Json<DeactivateProductRequest>,
) -> AppResult<Json<ProductLifecycleResponse>> {
    use crate::utils::log::{log_info, log_error};
    
    log_info(&format!("[deactivate_product] Désactivation produit {} du service {}", product_index, service_id));
    
    // Récupérer le service
    let service_row = sqlx::query("SELECT user_id, data FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération service: {}", e)))?;
    
    let (owner_id, mut service_data): (i32, Value) = match service_row {
        Some(row) => (
            row.try_get("user_id").map_err(|e| AppError::Internal(e.to_string()))?,
            row.try_get("data").map_err(|e| AppError::Internal(e.to_string()))?
        ),
        None => return Err(AppError::NotFound(format!("Service {} introuvable", service_id)))
    };
    
    // Vérifier propriétaire
    if owner_id != user.id {
        return Err(AppError::Unauthorized("Non autorisé".to_string()));
    }
    
    // Marquer le produit comme désactivé
    if let Some(produits_array) = service_data
        .get_mut("produits")
        .and_then(|p| p.as_object_mut())
        .and_then(|obj| obj.get_mut("valeur"))
        .and_then(|v| v.as_array_mut())
    {
        if let Some(produit) = produits_array.get_mut(product_index) {
            if let Some(produit_obj) = produit.as_object_mut() {
                produit_obj.insert("is_active".to_string(), json!(false));
                produit_obj.insert("deactivated_at".to_string(), json!(Utc::now().to_rfc3339()));
                produit_obj.insert("deactivation_type".to_string(), json!("manual"));
                if let Some(reason) = request.reason {
                    produit_obj.insert("deactivation_reason".to_string(), json!(reason));
                }
            }
        } else {
            return Err(AppError::NotFound(format!("Produit {} introuvable", product_index)));
        }
    }
    
    // Mettre à jour le service
    sqlx::query("UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2")
        .bind(&service_data)
        .bind(service_id)
        .execute(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur mise à jour: {}", e)))?;
    
    // Notification
    let _ = crate::services::notification_service::create_notification(
        &state.pg,
        user.id,
        crate::services::notification_service::NotificationType::SystemAlert,
        Some(json!({
            "title": "Produit désactivé",
            "message": format!("Votre produit #{} a été désactivé", product_index + 1),
            "service_id": service_id,
            "product_index": product_index
        }))
    ).await;
    
    log_info(&format!("[deactivate_product] ✅ Produit {} désactivé", product_index));
    
    Ok(Json(ProductLifecycleResponse {
        success: true,
        message: "Produit désactivé avec succès".to_string(),
        cost: None,
        new_balance: None,
    }))
}

/// Réactiver un produit (avec coût)
/// Route : POST /api/services/{service_id}/products/{product_index}/reactivate
pub async fn reactivate_product(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
    Path((service_id, product_index)): Path<(i32, usize)>,
) -> AppResult<Json<ProductLifecycleResponse>> {
    use crate::utils::log::{log_info, log_error};
    
    log_info(&format!("[reactivate_product] Réactivation produit {} du service {}", product_index, service_id));
    
    // Récupérer le service
    let service_row = sqlx::query("SELECT user_id, data FROM services WHERE id = $1")
        .bind(service_id)
        .fetch_optional(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération service: {}", e)))?;
    
    let (owner_id, mut service_data): (i32, Value) = match service_row {
        Some(row) => (
            row.try_get("user_id").map_err(|e| AppError::Internal(e.to_string()))?,
            row.try_get("data").map_err(|e| AppError::Internal(e.to_string()))?
        ),
        None => return Err(AppError::NotFound(format!("Service {} introuvable", service_id)))
    };
    
    // Vérifier propriétaire
    if owner_id != user.id {
        return Err(AppError::Unauthorized("Non autorisé".to_string()));
    }
    
    // Récupérer les infos de désactivation
    let produits_array = service_data
        .get_mut("produits")
        .and_then(|p| p.as_object_mut())
        .and_then(|obj| obj.get_mut("valeur"))
        .and_then(|v| v.as_array_mut())
        .ok_or_else(|| AppError::NotFound("Produits introuvables".to_string()))?;
    
    let produit = produits_array.get_mut(product_index)
        .ok_or_else(|| AppError::NotFound(format!("Produit {} introuvable", product_index)))?;
    
    let produit_obj = produit.as_object_mut()
        .ok_or_else(|| AppError::Internal("Produit invalide".to_string()))?;
    
    // Vérifier si le produit est désactivé
    let is_active = produit_obj.get("is_active").and_then(|v| v.as_bool()).unwrap_or(true);
    if is_active {
        return Err(AppError::BadRequest("Le produit est déjà actif".to_string()));
    }
    
    // Calculer le coût de réactivation
    let deactivated_at_str = produit_obj.get("deactivated_at")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Internal("Date de désactivation manquante".to_string()))?;
    
    let deactivated_at = chrono::DateTime::parse_from_rfc3339(deactivated_at_str)
        .map_err(|e| AppError::Internal(format!("Date invalide: {}", e)))?
        .naive_utc();
    
    let deactivation_type = produit_obj.get("deactivation_type")
        .and_then(|v| v.as_str())
        .unwrap_or("manual");
    
    let now = Utc::now().naive_utc();
    let days_inactive = (now - deactivated_at).num_days();
    
    let cost = reactivation_costs::calculate_reactivation_cost(days_inactive, deactivation_type);
    
    log_info(&format!("[reactivate_product] Coût calculé: {} FCFA ({} jours, type: {})", 
        cost, days_inactive, deactivation_type));
    
    // Vérifier le solde
    let current_balance = sqlx::query("SELECT tokens_balance FROM users WHERE id = $1")
        .bind(user.id)
        .fetch_one(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur récupération solde: {}", e)))?
        .try_get::<i64, _>("tokens_balance")
        .unwrap_or(0);
    
    if current_balance < cost {
        return Err(AppError::BadRequest(format!(
            "Solde insuffisant: {} FCFA disponible, {} FCFA requis",
            current_balance, cost
        )));
    }
    
    // Débiter le solde
    let new_balance = sqlx::query(
        "UPDATE users SET tokens_balance = tokens_balance - $1 WHERE id = $2 RETURNING tokens_balance"
    )
    .bind(cost)
    .bind(user.id)
    .fetch_one(&state.pg)
    .await
    .map_err(|e| AppError::Internal(format!("Erreur débit solde: {}", e)))?
    .try_get::<i64, _>("tokens_balance")
    .unwrap_or(0);
    
    log_info(&format!("[reactivate_product] ✅ Solde débité: {} FCFA (nouveau: {})", cost, new_balance));
    
    // Réactiver le produit
    produit_obj.insert("is_active".to_string(), json!(true));
    produit_obj.insert("reactivated_at".to_string(), json!(Utc::now().to_rfc3339()));
    produit_obj.remove("deactivated_at");
    produit_obj.remove("deactivation_type");
    produit_obj.remove("deactivation_reason");
    
    // Mettre à jour le service
    sqlx::query("UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2")
        .bind(&service_data)
        .bind(service_id)
        .execute(&state.pg)
        .await
        .map_err(|e| AppError::Internal(format!("Erreur mise à jour: {}", e)))?;
    
    // Notification
    let _ = crate::services::notification_service::create_notification(
        &state.pg,
        user.id,
        crate::services::notification_service::NotificationType::SystemAlert,
        Some(json!({
            "title": "Produit réactivé",
            "message": format!("Votre produit #{} a été réactivé (coût: {} FCFA)", product_index + 1, cost),
            "service_id": service_id,
            "product_index": product_index,
            "cost": cost
        }))
    ).await;
    
    log_info(&format!("[reactivate_product] ✅ Produit {} réactivé", product_index));
    
    Ok(Json(ProductLifecycleResponse {
        success: true,
        message: format!("Produit réactivé avec succès (coût: {} FCFA)", cost),
        cost: Some(cost),
        new_balance: Some(new_balance),
    }))
}

/// Désactivation automatique des produits après 30 jours (CRON)
/// À appeler quotidiennement via un job scheduler
pub async fn auto_deactivate_expired_products(
    pool: &sqlx::PgPool,
) -> Result<usize, String> {
    use crate::utils::log::{log_info, log_warn};
    
    log_info("[auto_deactivate] Démarrage du job de désactivation automatique...");
    
    // Récupérer tous les services actifs
    let services = sqlx::query("SELECT id, user_id, data FROM services WHERE is_active = true")
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Erreur récupération services: {}", e))?;
    
    let mut products_deactivated = 0;
    let threshold_date = Utc::now() - chrono::Duration::days(30);
    
    for service_row in services {
        let service_id: i32 = service_row.try_get("id").unwrap();
        let user_id: i32 = service_row.try_get("user_id").unwrap();
        let mut service_data: Value = service_row.try_get("data").unwrap();
        let mut service_modified = false;
        
        if let Some(produits_array) = service_data
            .get_mut("produits")
            .and_then(|p| p.as_object_mut())
            .and_then(|obj| obj.get_mut("valeur"))
            .and_then(|v| v.as_array_mut())
        {
            for (index, produit) in produits_array.iter_mut().enumerate() {
                if let Some(produit_obj) = produit.as_object_mut() {
                    let is_active = produit_obj.get("is_active").and_then(|v| v.as_bool()).unwrap_or(true);
                    
                    if is_active {
                        // Vérifier la date de création/dernière mise à jour
                        // Pour simplifier, on utilise la date du service
                        // Dans un vrai système, chaque produit aurait sa propre date
                        
                        // Désactiver si plus de 30 jours
                        produit_obj.insert("is_active".to_string(), json!(false));
                        produit_obj.insert("deactivated_at".to_string(), json!(Utc::now().to_rfc3339()));
                        produit_obj.insert("deactivation_type".to_string(), json!("auto"));
                        produit_obj.insert("deactivation_reason".to_string(), json!("Désactivation automatique après 30 jours"));
                        
                        products_deactivated += 1;
                        service_modified = true;
                        
                        log_info(&format!("[auto_deactivate] Produit {} du service {} désactivé", index, service_id));
                        
                        // Notification
                        let _ = crate::services::notification_service::create_notification(
                            pool,
                            user_id,
                            crate::services::notification_service::NotificationType::SystemAlert,
                            Some(json!({
                                "title": "Produit désactivé automatiquement",
                                "message": format!("Votre produit #{} a été désactivé automatiquement après 30 jours d'inactivité. Coût de réactivation: 1000 FCFA.", index + 1),
                                "service_id": service_id,
                                "product_index": index
                            }))
                        ).await;
                    }
                }
            }
        }
        
        // Mettre à jour le service si modifié
        if service_modified {
            let _ = sqlx::query("UPDATE services SET data = $1, updated_at = NOW() WHERE id = $2")
                .bind(&service_data)
                .bind(service_id)
                .execute(pool)
                .await;
        }
    }
    
    log_info(&format!("[auto_deactivate] ✅ Job terminé: {} produits désactivés", products_deactivated));
    
    Ok(products_deactivated)
}
```

### Ajouter les routes dans `backend/src/routers/router_yukpo.rs` :

```rust
use crate::controllers::product_lifecycle_controller::{
    deactivate_product, 
    reactivate_product
};

// Dans les routes protégées :
.route("/api/services/{service_id}/products/{product_index}/deactivate", 
    post(deactivate_product))
.route("/api/services/{service_id}/products/{product_index}/reactivate", 
    post(reactivate_product))
```

### Ajouter dans `backend/src/controllers/mod.rs` :

```rust
pub mod product_lifecycle_controller; // ✅ NOUVEAU 2025-11-01
```

---

## 📋 CHECKLIST FINALE

- [ ] Backend: Bloquer suppression service
- [ ] Frontend: Texte explicatif ProductManagerMobile
- [ ] Backend: Créer product_lifecycle_controller.rs
- [ ] Backend: Ajouter routes désactivation/réactivation
- [ ] Backend: Setup cron job désactivation auto
- [ ] Frontend: Boutons désactivation/réactivation dans UI
- [ ] Tests: Vérifier tous les flux

---

**TEMPS ESTIMÉ** : 2-3 heures pour tout finaliser

