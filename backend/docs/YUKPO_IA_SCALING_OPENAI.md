# YukpoIA — résilience des appels OpenAI (implémenté + suite possible)

## Déjà en place (backend)

| Mécanisme | Détail |
|-----------|--------|
| **Client HTTP partagé** | `yukpo_openai_outbound::http_client()` — pool connexions, timeouts HTTP. |
| **Concurrence par instance** | `YUKPO_IA_OPENAI_MAX_CONCURRENT` — sémaphore Tokio (0 / absent = pas de limite **sur ce processus**). |
| **Retries 429 / 503** | `post_chat_completions` et `post_audio_transcriptions` — backoff + en-tête `Retry-After`. |
| **Multi-clés** | `OPENAI_API_KEYS=key1,key2,...` — une clé tirée au hasard par appel ; sinon `OPENAI_API_KEY`. |
| **Rate limit utilisateur** | Middleware Redis sur `/ai/chat` (voir `ia_rate_limit.rs`). |
| **Chat principal YukpoIA** | `AppIA::chat_completion_with_messages` → `chat_completion_for_provider` : **même client HTTP**, **`acquire_concurrency_permit`**, et **`send_request_with_retry`** pour OpenAI-compat, Anthropic et Gemini. |

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
4. **AppIA** : étendre `AppIA` pour réutiliser le même client / sémaphore / retries sur **chaque** provider si besoin.
