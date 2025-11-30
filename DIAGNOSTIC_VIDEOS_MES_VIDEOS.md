# Diagnostic : Vidéos non affichées dans "Mes vidéos"

## Problème identifié

Les vidéos générées ne s'affichent pas dans "Mes vidéos" (accessible depuis "Mon compte" → "Mes Vidéos").

## Analyse de la logique de sauvegarde

### ✅ Sauvegarde dans la table `media`

**Fichier** : `backend/src/services/video_generation_service.rs` (lignes 1957-1999)

La vidéo est **correctement sauvegardée** dans la table `media` avec :
- `type = 'video_generated'`
- `media_type = 'video'`
- `service_id` (correctement associé)
- `product_index` (correctement associé)
- `path` (chemin de la vidéo)
- `ai_description`, `ai_tags`, `ai_metadata` (métadonnées complètes)

**Code de sauvegarde** :
```rust
let inserted: MediaIdRow = sqlx::query_as(
    r#"
    INSERT INTO media (
        service_id,
        product_id,
        product_index,
        type,
        media_type,
        path,
        file_size,
        file_format,
        ai_description,
        ai_tags,
        ai_metadata,
        ai_analyzed_at,
        ai_model_used,
        ai_confidence
    )
    VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12, $13
    )
    RETURNING id
    "#
)
.bind(service_id)
.bind(product_identifier)
.bind(product_index)
.bind("video_generated")  // ✅ Type correct
.bind("video")            // ✅ Media type correct
.bind(normalized_relative.clone())
.bind(file_size)
.bind("mp4")
.bind(ai_description)
.bind(&ai_tags)
.bind(ai_metadata)
.bind("video_generation_pipeline_v1")
.bind(quality_score as f64)
.fetch_one(&state.pg)
.await?;
```

### ✅ Ajout au service_data

**Fichier** : `backend/src/services/video_generation_service.rs` (ligne 1760)

La vidéo est également ajoutée au `service_data` via `append_video_to_service_data` :
```rust
append_video_to_service_data(
    &state,
    service_id,
    product_index,
    &mut service_data,
    public_url.clone(),
    subtitle_public_url.clone(),
    &[],
)
.await?;
```

## Analyse de la logique de récupération

### ❌ Problème potentiel : Récupération des vidéos

**Fichier frontend** : `mobile/src/screens/VideoFeedScreen.tsx`

Le `VideoFeedScreen` récupère les vidéos depuis :
1. Les produits des services (via `extractManagedProductsFromServices`)
2. Les vidéos dans `item?.data?.videos?.[0]` ou `item?.data?.media?.videos?.[0]`

**Problème identifié** :
- Les vidéos sont sauvegardées dans la table `media` avec `type = 'video_generated'` et `media_type = 'video'`
- Mais elles ne sont peut-être **pas incluses** dans le `service_data.videos` ou `service_data.media.videos`
- L'endpoint `/api/services/search?include_videos=true` n'existe peut-être pas ou ne filtre pas correctement

### ✅ Solution recommandée

#### 1. Vérifier que les vidéos sont incluses dans `service_data`

Vérifier la fonction `append_video_to_service_data` pour s'assurer qu'elle ajoute bien la vidéo dans :
- `service_data.videos[]` ou
- `service_data.media.videos[]` ou
- `service_data.listeproduit[product_index].videos[]`

#### 2. Créer/modifier l'endpoint de récupération des vidéos

**Option A** : Modifier l'endpoint existant pour inclure les vidéos depuis la table `media`

**Option B** : Créer un nouvel endpoint `/api/videos/my-videos` qui récupère directement depuis la table `media` :

```rust
// Nouvel endpoint recommandé
pub async fn get_my_videos(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> axum::response::Response {
    let videos = sqlx::query_as::<_, VideoRow>(
        r#"
        SELECT 
            m.id,
            m.service_id,
            m.product_index,
            m.path,
            m.ai_description,
            m.ai_metadata,
            m.created_at,
            s.data->>'titre' as service_title
        FROM media m
        INNER JOIN services s ON s.id = m.service_id
        WHERE m.service_id IN (
            SELECT id FROM services WHERE user_id = $1
        )
        AND m.type = 'video_generated'
        AND m.media_type = 'video'
        ORDER BY m.created_at DESC
        "#
    )
    .bind(user.id)
    .fetch_all(&state.pg)
    .await;
    
    // Retourner les vidéos formatées
}
```

#### 3. Modifier `VideoFeedScreen` pour utiliser le nouvel endpoint

**Fichier** : `mobile/src/screens/VideoFeedScreen.tsx`

Remplacer la logique de récupération actuelle par un appel direct à `/api/videos/my-videos`.

## Actions immédiates recommandées

1. **Vérifier `append_video_to_service_data`** : S'assurer qu'elle ajoute bien la vidéo dans `service_data.videos[]`
2. **Créer l'endpoint `/api/videos/my-videos`** : Récupération directe depuis la table `media`
3. **Modifier `VideoFeedScreen`** : Utiliser le nouvel endpoint pour récupérer les vidéos
4. **Tester** : Vérifier que les vidéos générées apparaissent bien dans "Mes vidéos"

## Fichiers à modifier

1. `backend/src/services/video_generation_service.rs` - Vérifier `append_video_to_service_data`
2. `backend/src/controllers/` - Créer `video_controller.rs` ou modifier `media_controller.rs`
3. `backend/src/routes/` - Ajouter la route `/api/videos/my-videos`
4. `mobile/src/screens/VideoFeedScreen.tsx` - Modifier la récupération des vidéos

