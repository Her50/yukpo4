# 🚨 Analyse : Erreur 500 `/api/media/undefined/track-view`

## Log d'Erreur

```
[POST]500yukpomnang.onrender.com/api/media/undefined/track-view
clientIP="129.0.76.45" 
requestID="293b3f75-5693-4915" 
responseTimeMS=3 
responseBytes=601 
userAgent="Yukpomnang-Mobile/1.0.0"
```

## Problème Identifié

### Symptôme
- **URL** : `/api/media/undefined/track-view`
- **Code HTTP** : 500 (Internal Server Error)
- **Source** : Application mobile (`Yukpomnang-Mobile/1.0.0`)

### Cause Racine

Le problème vient du **frontend mobile** qui envoie `undefined` comme `media_id` dans l'URL.

**Code mobile** (`mobile/src/services/api.ts:1036-1037`) :
```typescript
trackMediaView: async (mediaId: number, payload: { ... }) => {
    return apiCall(`/api/media/${mediaId}/track-view`, {
        // ...
    });
}
```

**Appel** (`mobile/src/screens/MesProduitsScreen.tsx:700`) :
```typescript
await mediaApi.trackMediaView(result.media_id, { channel: 'studio_preview' });
```

**Problème** : Si `result.media_id` est `undefined` ou `null`, l'URL devient `/api/media/undefined/track-view`.

### Analyse du Backend

**Code backend** (`backend/src/controllers/media_analytics_controller.rs:43-92`) :

```rust
pub async fn track_view(
    State(state): State<Arc<AppState>>,
    Path(media_id): Path<String>,  // ← Reçoit "undefined" comme String
    Extension(user): Extension<Option<AuthenticatedUser>>,
    Json(payload): Json<EngagementPayload>,  // ← Peut échouer ici si JSON invalide
) -> AppResult<Json<serde_json::Value>> {
    // ✅ Validation existe (lignes 50-73)
    let media_id_trimmed = media_id.trim();
    
    if media_id_trimmed.is_empty() || media_id_trimmed == "undefined" || media_id_trimmed == "null" {
        return Err(AppError::BadRequest(...));  // ← Devrait retourner 400
    }
    // ...
}
```

**Problème** : La validation existe et devrait retourner `400 BadRequest`, mais le log montre `500 Internal Server Error`.

### Pourquoi une Erreur 500 ?

L'erreur 500 peut survenir dans plusieurs cas :

1. **Erreur de parsing JSON** : Si le payload JSON est invalide, Axum peut retourner 500 avant d'arriver à la validation
2. **Erreur dans le middleware** : JWT auth ou autre middleware peut échouer
3. **Erreur dans `record_engagement`** : Si le media_id passe la validation mais n'existe pas en base

**Hypothèse la plus probable** : Le parsing du JSON `Json(payload): Json<EngagementPayload>` échoue si le payload est malformé, causant une 500 avant d'arriver à la validation du `media_id`.

## Solution

### Option 1 : Validation côté Frontend (Recommandée)

**Fichier** : `mobile/src/services/api.ts`

```typescript
trackMediaView: async (mediaId: number | undefined | null, payload: { ... }) => {
    // ✅ Validation avant l'appel API
    if (!mediaId || mediaId === undefined || mediaId === null) {
        console.warn('[API] trackMediaView: mediaId invalide, skip tracking');
        return { success: false, error: 'mediaId invalide' };
    }
    
    return apiCall(`/api/media/${mediaId}/track-view`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}
```

**Fichier** : `mobile/src/screens/MesProduitsScreen.tsx`

```typescript
// ✅ Vérifier que media_id existe avant d'appeler
if (result.media_id) {
    await mediaApi.trackMediaView(result.media_id, { channel: 'studio_preview' });
} else {
    console.warn('[MesProduitsScreen] media_id manquant, skip tracking');
}
```

### Option 2 : Améliorer la gestion d'erreur côté Backend

**Fichier** : `backend/src/controllers/media_analytics_controller.rs`

```rust
pub async fn track_view(
    State(state): State<Arc<AppState>>,
    Path(media_id): Path<String>,
    Extension(user): Extension<Option<AuthenticatedUser>>,
    // ✅ Gérer le cas où le JSON est invalide
    payload: Result<Json<EngagementPayload>, axum::extract::JsonRejection>,
) -> AppResult<Json<serde_json::Value>> {
    // ✅ Validation media_id AVANT le parsing JSON
    let media_id_trimmed = media_id.trim();
    
    if media_id_trimmed.is_empty() || media_id_trimmed == "undefined" || media_id_trimmed == "null" {
        return Err(AppError::BadRequest(format!(
            "media_id invalide: '{}'. Le paramètre media_id est requis et doit être un entier valide.",
            media_id
        )));
    }
    
    // ✅ Gérer l'erreur de parsing JSON gracieusement
    let payload = payload.map_err(|e| {
        AppError::BadRequest(format!("Payload JSON invalide: {}", e))
    })?;
    
    // ... reste du code
}
```

### Option 3 : Middleware de validation (Solution robuste)

Créer un middleware qui valide les paramètres de chemin avant d'arriver au handler :

```rust
// Dans router_yukpo.rs
.route(
    "/api/media/{media_id}/track-view",
    post(media_analytics_controller::track_view)
        .layer(validate_media_id_param()),  // ← Middleware de validation
)
```

## Recommandation

**Solution hybride** :
1. ✅ **Frontend** : Valider `mediaId` avant l'appel API (Option 1)
2. ✅ **Backend** : Améliorer la gestion d'erreur pour retourner 400 au lieu de 500 (Option 2)

Cela garantit :
- Pas d'appels API inutiles depuis le frontend
- Messages d'erreur clairs (400 au lieu de 500)
- Meilleure expérience utilisateur

## Vérification

Après correction, vérifier que :
1. Les appels avec `mediaId` invalide ne sont plus envoyés depuis le mobile
2. Si un appel invalide arrive quand même, le backend retourne 400 (BadRequest) au lieu de 500
3. Les logs ne montrent plus d'erreurs 500 pour `/api/media/undefined/track-view`

