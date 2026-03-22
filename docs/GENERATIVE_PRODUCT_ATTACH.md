# Attacher une vidéo « generative » (Runway / Pika / Sora) à un produit

## Contexte

- `POST /api/generative/generate` démarre un job (`generative_video_jobs`) et retourne `{ success, job_id, ... }`.
- Quand le job est **`completed`**, `result_payload` contient au minimum : `{ "video_url": "..." }` (voir `generative_video_service.rs`).
- L’enregistrement dans la médiathèque produit se fait via **`POST /api/media/product/{service_id}/{product_index}/attach-generative-video`** (JWT requis).

## Alternative déjà existante (sans wizard mobile séparé)

Le backend supporte aussi `VideoGenerationPayload` avec :

```json
{
  "creation_source": "ai_virtual",
  "ai_video_prompt": "…",
  "duration_seconds": 30
}
```

sur `POST /api/media/product/{service_id}/{product_index}/generate-video` — le worker exécute tout le pipeline generative **côté serveur** puis crée le média (voir `video_generation_service.rs`, branche `ai_virtual`).

## Schéma `attach-generative-video`

**Route** : `POST /api/media/product/{service_id}/{product_index}/attach-generative-video`  
**Auth** : `Authorization: Bearer <jwt>`

### Corps JSON (request)

| Champ | Type | Obligatoire | Description |
|--------|------|-------------|-------------|
| `generative_job_id` | `string` | oui | Valeur de `job_id` retournée par `POST /api/generative/generate`. |
| `final_video_url` | `string` | non | Si fourni, utilisé comme URL ; sinon lecture de `result_payload.video_url` sur le job **completed**. |

Exemple minimal :

```json
{
  "generative_job_id": "abc-123-job-uuid"
}
```

Avec URL explicite (ex. client qui a déjà l’URL finale) :

```json
{
  "generative_job_id": "abc-123-job-uuid",
  "final_video_url": "https://example.com/api/media/files/generative_videos/abc-123/generative_abc-123.mp4"
}
```

### Réponse 200 (succès)

Même enveloppe que les autres routes média utilisées par le mobile :

```json
{
  "success": true,
  "data": { /* VideoGenerationResult — champs alignés GeneratedVideoResponse côté app */ }
}
```

`data` contient notamment : `media_id`, `service_id`, `product_index`, `video_url`, `path`, `duration_seconds`, `progress_steps`, etc. (voir `VideoGenerationResult` dans `backend/src/services/video_generation_service.rs`).

### Erreurs courantes

- **404** : job introuvable.
- **401** : job ne correspond pas à l’utilisateur JWT.
- **400** : job pas en `completed`, ou aucune URL exploitable.
- **404** : produit introuvable / inactif pour ce service.

## Mobile

- `mediaApi.attachGenerativeVideoToProduct(serviceId, productIndex, body)`
- `GenerativeVideoWizard` dans `ProductVideoCreationModal` : à la fin du job, appel d’attache puis `onSuccess` + fermeture du modal.
