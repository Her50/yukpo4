# Analyse du Problème de Génération Vidéo

## 🔍 Problème Identifié

Lors du clic sur le bouton de création vidéo à l'étape 6 :
- ✅ Toast de confirmation affiché
- ✅ Requête POST retourne 200 OK
- ✅ Job créé dans `video_generation_jobs` avec status 'queued' puis 'running'
- ❌ **La vidéo n'est pas créée**
- ❌ **Aucune vidéo visible dans "Mes vidéos"**
- ❌ **Aucune vidéo dans la médiathèque des produits**

## 📊 Analyse des Logs

### Logs Critiques

1. **Warning sur le snapshot produit :**
```
[VideoGeneration] Impossible de charger le snapshot produit 158:0 (❌ Not Found: Produit 158:0 introuvable)
```

2. **Requête SQL retourne 0 lignes :**
```sql
SELECT pl.id, pl.product_nom, pl.product_type, ...
FROM products_lifecycle pl
WHERE pl.service_id = 158 AND pl.product_index = 0
-- rows_affected=0, rows_returned=0
```

3. **Job créé et mis en "running" :**
```
INSERT INTO video_generation_jobs (user_id, service_id, product_index, status)
VALUES (18, 158, 0, 'queued')
-- Puis mis à jour en 'running'
```

### Problème Principal

**Le produit n'existe pas dans la table `products_lifecycle`** mais :
- Le produit existe probablement dans `services.data->produits[0]`
- Le code continue avec `product_snapshot = None`
- **Aucun log d'erreur après le warning** → La génération échoue probablement silencieusement

## 🔧 Causes Possibles

### 1. Produit non synchronisé dans `products_lifecycle`
- Le produit existe dans `services.data->produits` mais n'a jamais été synchronisé dans `products_lifecycle`
- Le trigger de synchronisation n'a peut-être pas fonctionné lors de la création du service

### 2. Génération échoue silencieusement
- Le code continue avec `product_snapshot = None`
- Plus tard dans le processus, quelque chose échoue mais l'erreur n'est pas loggée
- Le job reste en "running" au lieu d'être marqué "failed"

### 3. Vidéo générée mais non sauvegardée
- La vidéo est générée mais l'insertion dans `media` échoue
- L'erreur n'est pas propagée correctement

## 💡 Solutions Proposées

### Solution 1 : Créer le produit dans `products_lifecycle` avant génération (Recommandée)

**Fichier : `backend/src/services/video_generation_service.rs`**

Ajouter une fonction pour s'assurer que le produit existe dans `products_lifecycle` :

```rust
/// S'assure que le produit existe dans products_lifecycle
async fn ensure_product_in_lifecycle(
    pool: &PgPool,
    service_id: i32,
    product_index: i32,
    service_data: &Value,
) -> AppResult<()> {
    // Vérifier si le produit existe déjà
    let exists: Option<i32> = sqlx::query_scalar(
        "SELECT id FROM products_lifecycle WHERE service_id = $1 AND product_index = $2"
    )
    .bind(service_id)
    .bind(product_index)
    .fetch_optional(pool)
    .await?;

    if exists.is_some() {
        return Ok(()); // Déjà existant
    }

    // Extraire les infos du produit depuis service_data
    let produits = service_data
        .get("produits")
        .and_then(|p| {
            if p.is_array() {
                Some(p.as_array()?)
            } else {
                p.get("valeur")?.as_array()
            }
        })
        .ok_or_else(|| AppError::NotFound("Produits introuvables dans service_data".to_string()))?;

    let produit = produits
        .get(product_index as usize)
        .and_then(|p| p.as_object())
        .ok_or_else(|| AppError::NotFound(format!("Produit {} introuvable", product_index)))?;

    let product_nom = produit
        .get("nom")
        .or_else(|| produit.get("name"))
        .or_else(|| produit.get("titre"))
        .and_then(|v| v.as_str())
        .unwrap_or("Produit sans nom")
        .to_string();

    let product_type = produit
        .get("type")
        .or_else(|| produit.get("categorie"))
        .and_then(|v| v.as_str())
        .unwrap_or("autre")
        .to_string();

    // Créer l'entrée dans products_lifecycle
    sqlx::query(
        r#"
        INSERT INTO products_lifecycle (
            service_id, product_index, product_nom, product_type, is_active
        )
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (service_id, product_index) DO NOTHING
        "#
    )
    .bind(service_id)
    .bind(product_index)
    .bind(product_nom)
    .bind(product_type)
    .execute(pool)
    .await?;

    info!(
        "[VideoGeneration] ✅ Produit {}:{} créé dans products_lifecycle",
        service_id, product_index
    );

    Ok(())
}
```

### Solution 2 : Améliorer la gestion d'erreur

**Fichier : `backend/src/services/video_generation_service.rs`**

S'assurer que toutes les erreurs sont loggées et que le job est marqué comme "failed" :

```rust
// Dans generate_product_video, après le chargement du snapshot
let product_snapshot: Option<ProductConnectorSnapshot> = match state
    .commerce_connector
    .snapshot_by_index(service_id, product_index)
    .await
{
    Ok(snapshot) => Some(snapshot),
    Err(err) => {
        warn!(
            "[VideoGeneration] Impossible de charger le snapshot produit {}:{} ({err})",
            service_id, product_index
        );
        
        // ✅ NOUVEAU: Essayer de créer le produit dans products_lifecycle
        if let Ok(service_data) = get_service_data(&state.pg, service_id).await {
            if let Err(create_err) = ensure_product_in_lifecycle(
                &state.pg,
                service_id,
                product_index,
                &service_data,
            ).await {
                error!(
                    "[VideoGeneration] ❌ Impossible de créer produit dans lifecycle: {}",
                    create_err
                );
                // Continuer quand même, mais avec un warning plus fort
            } else {
                // Réessayer de charger le snapshot
                match state
                    .commerce_connector
                    .snapshot_by_index(service_id, product_index)
                    .await
                {
                    Ok(snapshot) => Some(snapshot),
                    Err(retry_err) => {
                        warn!(
                            "[VideoGeneration] ⚠️ Snapshot toujours introuvable après création lifecycle: {}",
                            retry_err
                        );
                        None
                    }
                }
            }
        }
        
        None
    }
};
```

### Solution 3 : Vérifier le statut du job

**Fichier : `backend/src/controllers/product_video_controller.rs`**

Ajouter un endpoint pour vérifier les jobs en "running" depuis trop longtemps :

```rust
/// Vérifier et nettoyer les jobs bloqués
pub async fn cleanup_stuck_jobs(
    State(state): State<Arc<AppState>>,
) -> AppResult<Json<Value>> {
    // Trouver les jobs en "running" depuis plus de 1 heure
    let stuck_jobs = sqlx::query(
        r#"
        SELECT job_id, user_id, service_id, product_index, created_at
        FROM video_generation_jobs
        WHERE status = 'running'
        AND created_at < NOW() - INTERVAL '1 hour'
        "#
    )
    .fetch_all(&state.pg)
    .await?;

    // Marquer comme failed
    for job in stuck_jobs {
        // ...
    }

    Ok(Json(json!({"cleaned": stuck_jobs.len()})))
}
```

## 🎯 Plan d'Action Immédiat

1. ✅ **Créer la fonction `ensure_product_in_lifecycle`**
2. ✅ **Appeler cette fonction avant la génération de vidéo**
3. ✅ **Améliorer les logs d'erreur pour tracer les échecs**
4. ✅ **Vérifier que le job est bien marqué "failed" en cas d'erreur**

## 📝 Notes Techniques

- Le produit existe dans `services.data->produits[0]` (nom: "Cours de soutien en mathématiques")
- Le produit n'existe pas dans `products_lifecycle`
- Le trigger de synchronisation devrait créer automatiquement l'entrée, mais il semble ne pas avoir fonctionné
- La génération de vidéo nécessite le snapshot du produit pour certaines fonctionnalités, mais peut continuer sans

