# YukpoIA — résilience des appels OpenAI (implémenté + suite possible)

## Déjà en place (backend)

| Mécanisme | Détail |
|-----------|--------|
| **Client HTTP partagé** | `yukpo_openai_outbound::http_client()` — pool connexions, timeouts HTTP. |
| **Concurrence par instance** | `YUKPO_IA_OPENAI_MAX_CONCURRENT` — sémaphore Tokio (0 / absent = pas de limite **sur ce processus**). |
| **Retries 429 / 503** | `post_chat_completions` et `post_audio_transcriptions` — backoff + en-tête `Retry-After`. |
| **Multi-clés** | `OPENAI_API_KEYS=key1,key2,...` — une clé tirée au hasard par appel ; sinon `OPENAI_API_KEY`. |
| **Rate limit utilisateur** | Middleware Redis sur `/ai/chat` (voir `ia_rate_limit.rs`). |
| **Chat principal YukpoIA** | `app_ia_resilient_request` dans `app_ia.rs` appelle **une fois** `yukpo_openai_outbound` (sémaphore + retries) ; **pas** de second enchaînement inline (évite la duplication qu’on avait entre `chat_completion_*` et le helper). |

### Variables d’environnement

| Variable | Défaut | Rôle |
|----------|--------|------|
| `YUKPO_IA_OPENAI_MAX_CONCURRENT` | _(vide)_ | Entier > 0 : max d’appels OpenAI simultanés **par instance**. |
| `YUKPO_IA_OPENAI_MAX_RETRIES` | `4` | Tentatives pour 429/503 (chat + Whisper directs). |
| `YUKPO_IA_OPENAI_RETRY_BASE_MS` | `500` | Backoff exponentiel si pas de `Retry-After`. |
| `OPENAI_API_KEYS` | _(optionnel)_ | Liste séparée par virgules ; sinon `OPENAI_API_KEY`. |

## Compléments typiques (hors ce module)

1. **File (Redis Streams / SQS)** : traiter les requêtes longues ou pics via workers ; l’API renvoie un `job_id`.
2. **Autoscaling + load balancer** : plusieurs réplicas ; la limite `YUKPO_IA_OPENAI_MAX_CONCURRENT` est **par pod**.
3. **Quotas fournisseur** : plusieurs comptes (`OPENAI_API_KEYS`) + surveillance TPM/RPM côté observabilité.
4. **AppIA** : déjà branché (client = `http_client().clone()`, tout HTTP via `app_ia_resilient_request`).
