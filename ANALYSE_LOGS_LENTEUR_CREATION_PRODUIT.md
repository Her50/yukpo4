# Analyse des logs – Lenteur création produit

**Date** : 21 février 2026  
**Source** : `logs-creation-lente-6h.json` (6 h de logs GCP backend)

---

## 1. Synthèse

- **La création fonctionne** (réponses 200 sur creation-service et flux métier OK).
- **La lenteur perçue** vient surtout de l’étape **IA (creation-service)** : une requête a pris **12,4 s** (les autres succès sont vers 0,5–1 s).
- Des **503** sur creation-service (~1 s de latence) indiquent des échecs (cold start ou erreur OpenAI) ; le client peut réessayer ou voir un échec.
- Aucun **POST** vers `/api/services/.../products` (création produit) dans cette fenêtre ; les logs montrent surtout **creation-service** et des **GET /api/products/user/1** (liste produits, avec des timeouts côté mobile).

---

## 2. Requêtes creation-service (POST /api/ia/creation-service)

| Latence   | Status | Interprétation |
|-----------|--------|----------------|
| **12,42 s** | 200   | **Succès mais très lent** – explication principale de la lenteur perçue. |
| 1,03 s    | 503   | Échec (instance ou OpenAI). |
| 1,03 s    | 503   | Idem. |
| 1,03 s    | 503   | Idem. |
| 0,58 s    | 200   | Succès rapide. |
| 0,54 s    | 200   | Succès rapide. |
| 0,61 s    | 200   | Succès rapide. |

- **Requête à 12,4 s** (timestamp ~12:50:22 UTC) : log applicatif associé indique **`tokens_consumed: 6822`**, **`ia_model_used: openai-gpt4o`**. La durée vient donc du **temps de génération OpenAI** (réponse longue + modèle GPT-4o).
- Les **503** à ~1 s peuvent correspondre à un **cold start** (instance pas encore prête) ou à une erreur côté OpenAI ; le backend renvoie alors 503.

---

## 3. Autres constats dans les logs

- **GET /api/products/user/1** : timeouts côté mobile (retries 1/3, 2/3, 3/3) et erreurs "Tous les retries ont échoué (code: TIMEOUT)". Cela concerne la **liste des produits**, pas la création ; à traiter à part (timeout client, lenteur backend ou réseau).
- Aucune entrée **request** avec `requestUrl` contenant `/api/services/` et `products` en POST dans la fenêtre analysée : soit pas de création produit dans les 6 h, soit route différente / logs non capturés.

---

## 4. Causes probables de la lenteur

| Cause | Mécanisme | Impact |
|-------|-----------|--------|
| **Réponse OpenAI longue** | Prompt ou consignes qui poussent à des réponses longues (ex. 6822 tokens) → GPT-4o met 10–15 s. | **Principal** : 12,4 s sur une requête. |
| **Variabilité OpenAI** | Charge serveurs, modèle, longueur de sortie → parfois 0,5 s, parfois 10+ s. | Lenteur intermittente. |
| **Cold start** | Première requête après inactivité → instance Cloud Run à démarrer. | 503 à ~1 s, pas la latence 12 s. |

---

## 5. Pistes d’optimisation

### 5.1 Réduire le temps de l’appel IA (sans casser la création)

- **Limiter la taille de la réponse** : dans la config du modèle (ex. `max_tokens`) ou dans le prompt, demander une réponse **courte** (JSON concis, pas de paragraphes).
- **Prompt plus direct** : rappeler dans le prompt que le JSON doit être **minimal** (champs requis uniquement, pas de texte libre long).
- **Modèle plus rapide** : si un modèle plus léger (ex. gpt-4o-mini) est acceptable pour la création de service, l’utiliser en premier pour réduire la latence moyenne.

### 5.2 Fiabilité et ressenti

- **Timeout côté backend** : encapsuler l’appel à `predict` / `predict_multimodal` dans un `tokio::time::timeout` (ex. 30–45 s) pour ne pas laisser la requête pendre indéfiniment et renvoyer une erreur claire au client.
- **Min instances = 1** (Cloud Run) : réduire les cold starts et donc les 503 à ~1 s (coût supplémentaire à prendre en compte).
- **Côté mobile** : garder un timeout adapté (ex. 90 s pour creation-service) et un message du type « La création peut prendre jusqu’à 30 secondes » pour éviter l’impression de blocage.

### 5.3 Observabilité

- **Log de durée** : dans `handle_creation_service_direct`, logger la durée de l’appel `predict` / `predict_multimodal` (ex. avec `std::time::Instant`) pour confirmer que la latence est bien côté IA.
- **Métriques** : si vous avez des métriques (ex. latency par route), suivre le p95/p99 de `/api/ia/creation-service` pour voir l’évolution après optimisations.

---

## 6. Conclusion

- Les logs confirment que **la lenteur perçue** est liée à l’étape **creation-service** : une requête à **12,4 s** (200, **6822 tokens**, **openai-gpt4o**) explique le ressenti « ça prend du temps ».
- Les autres succès sont vers **0,5–1 s** ; le comportement est donc **variable** selon la charge et la longueur de la réponse IA.
- **Recommandations prioritaires** : limiter la taille de la réponse IA (prompt + `max_tokens`) et ajouter un **log de durée** sur l’appel IA ; en option, timeout backend et min instances pour la stabilité et le confort utilisateur.
