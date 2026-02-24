# Analyse profonde : sauvegarde / soumission du formulaire de création

**Problème rapporté :** le bouton de création ne fait que tourner (spinner infini), pas de message de succès ni d’erreur claire.  
**Question :** la base de données est-elle inaccessible au moment de la sauvegarde ?

---

## 1. Parcours complet : du clic à la base de données

### 1.1 Côté mobile (FormulaireYukpoIntelligentScreen)

| Étape | Code / lieu | Ce qui peut bloquer ou échouer |
|-------|-------------|--------------------------------|
| 1. Clic « Créer le service » | `soumettreFormulaire()` (l. ~3700) | Double clic ignoré (loading/isSubmitting). |
| 2. Validation champs obligatoires | `validateRequiredFields()` | Si erreur → Alert + **return** sans appel API. **Loading déjà mis à true** → **le bouton reste bloqué** si l’Alert ne s’affiche pas ou si un autre return oublie de remettre loading à false. |
| 3. `setLoading(true)` / `setIsSubmitting(true)` | l. 3719-3720 | Le bouton passe en « tourne seulement ». |
| 4. Compression médias | `getCompressedMedia()` | Peut être lent ; en cas d’exception → catch global → `setLoading(false)`. D’après les logs, la compression se termine (0 B). |
| 5. Construction du payload | `finalServiceData`, `servicePayload` (l. 4782–5128) | Exception possible (référence circulaire, valeur non sérialisable). Si **avant** `apiPost` → catch → `setLoading(false)`. Si **dans** `JSON.stringify(data)` (dans `apiPost`) → idem. |
| 6. **Appel API** | `apiPost('/api/services/create', servicePayload)` (l. 5136) | C’est le seul `await` qui peut « ne jamais se terminer » côté client : requête envoyée mais **aucune réponse** (timeout, backend qui ne répond pas, connexion coupée sans erreur côté client). |
| 7. Réponse reçue | `response.success` / `response.data` | Si erreur → Alert + `setIsSubmitting(false)` / `setLoading(false)` (l. 5229-5310). Si succès → idem après succès. |

**Conclusion mobile :**  
Le seul cas où le bouton peut tourner « indéfiniment » est que **l’appel à `apiPost` ne se résout jamais** (ni succès ni erreur) **et** que le timeout de 180 s ne se déclenche pas ou n’est pas appliqué sur ce chemin. Sinon, après 180 s on doit avoir une erreur type « La création a pris trop de temps » et le catch doit remettre le bouton à l’état normal.

### 1.2 Côté API mobile (api.ts)

- **Timeout pour `/api/services/create` :** 180 000 ms (3 min), l. 341.
- **Comportement :** après 180 s, `AbortController` annule la requête → `AbortError` → catch dans `apiCallInternal` → retour `{ success: false, code: 'TIMEOUT', error: '...' }`.
- Donc **si le backend ne répond pas**, au plus tard après 3 min l’app reçoit une réponse (erreur) et peut faire `setLoading(false)`.

Si le bouton tourne **plus de 3 minutes**, soit :
- le timeout n’est pas appliqué sur ce chemin (bug ou autre branche d’appel),  
- soit l’utilisateur n’a pas attendu 3 min et l’impression est « ça tourne sans fin ».

### 1.3 Côté backend (GCP Cloud Run)

| Étape | Fichier / fonction | Base de données / blocage |
|-------|--------------------|---------------------------|
| Réception POST | `router_yukpo.rs` → `handle_creer_service` | Non. |
| Contrôleur | `service_controller::creer_service` | Non. |
| Service | `creer_service::creer_service` (creer_service.rs) | **Oui.** |
| Déballage `data` | `deballer_champ_data_a_racine` | Non. |
| Validation JSON | `valider_service_json` | Non. |
| **Premier accès DB** | `can_create_product_free(pool, user_id)` (l. 1876-1877) | **Oui.** Requête : `SELECT COALESCE(free_product_created, 0) FROM users WHERE id = $1`. Si la colonne `free_product_created` manque → erreur SQL ; ici l’erreur est avalée (`.unwrap_or(0)`), donc pas de crash. |
| **Deuxième accès DB** | `SELECT tokens_balance FROM users WHERE id = $1` (l. 1896) si pas gratuit | **Oui.** Si la base est injoignable ou timeout → **requête qui pend** jusqu’au timeout de la connexion (souvent 30 s ou plus). Pendant ce temps le backend ne renvoie rien → côté mobile on attend jusqu’au timeout 180 s. |
| Vérification solde, nettoyage payload, etc. | creer_service.rs | Plusieurs autres requêtes (INSERT service, produits, médias, etc.). Chacune peut **pendre** ou **échouer** si la base est lente ou inaccessible. |

**Conclusion backend :**  
- La **sauvegarde dépend entièrement de la base** : dès le début du traitement (après validation JSON), le backend fait des accès DB.  
- Si la base est **inaccessible ou très lente** : le backend peut **rester bloqué** sur une requête (ex. `tokens_balance`, INSERT, etc.) et ne jamais renvoyer de réponse → côté mobile, attente jusqu’au **timeout 180 s**, puis message d’erreur et normalement `setLoading(false)`.

Donc : **oui, au moment de la sauvegarde, si la base n’est pas accessible, la requête peut « rester en attente » côté backend** et le mobile ne reçoit rien jusqu’au timeout. Ce n’est pas que « la base refuse la sauvegarde » : c’est que **la connexion à la base peut ne pas répondre** (timeout, indisponibilité Cloud SQL, pool saturé, etc.).

---

## 2. Pourquoi le bouton « ne fait que tourner »

Résumé des causes possibles :

1. **Requête jamais envoyée**  
   - Blocage ou exception **avant** `apiPost` (validation, construction du payload, ou autre) **sans** remise de `loading` à false (ex. return anticipé sans `setLoading(false)`).  
   - À vérifier : tous les `return` après `setLoading(true)` remettent bien `setLoading(false)` (et éventuellement `setIsSubmitting(false)`).

2. **Requête envoyée, backend ne répond pas**  
   - Base inaccessible ou très lente → backend bloqué sur une requête SQL → pas de réponse HTTP.  
   - Côté mobile : attente jusqu’au **timeout 180 s** puis erreur. Si le bouton tourne **plus de 3 min**, le timeout ne s’applique peut‑être pas (à vérifier).

3. **Réponse backend reçue mais non gérée**  
   - Réponse 500 ou body inattendu sans `response.success` ni `response.data` correctement gérés → code qui ne rentre ni dans le succès ni dans le bloc d’erreur affiché → possiblement loading jamais remis à false si une branche oublie de le faire.

4. **Fenêtre de logs**  
   - Dans les logs analysés, **aucun** `POST /api/services/create` n’apparaît. Soit la requête n’est jamais partie, soit elle est dans une autre plage horaire / autre instance. Ça renforce l’idée qu’il faut tracer **côté mobile** si on arrive bien jusqu’à l’envoi de la requête.

---

## 3. Base de données « pas accessible » : ce que ça donne

- **Colonne manquante** (ex. `free_product_created`, `partner_status`, etc.) : selon l’endroit, soit erreur SQL → 500 → mobile reçoit une réponse et peut remettre le bouton à l’état normal, soit erreur avalée (comme pour `can_create_product_free`) et le flux continue.  
- **Connexion DB timeout / indisponible** : une requête (ex. `tokens_balance`, INSERT) reste en attente → **backend ne renvoie rien** → mobile attend jusqu’au **timeout 180 s** puis reçoit une erreur (timeout).  
- **Cloud SQL arrêté, réseau, pool saturé** : même effet « pas de réponse » jusqu’au timeout client.

Donc : **la base peut être « pas accessible » au moment de la sauvegarde** ; dans ce cas le symptôme typique est **bouton qui tourne jusqu’au timeout (3 min)** puis message d’erreur, pas un spinner vraiment infini (sauf si le timeout n’est pas appliqué).

---

## 4. Correctifs recommandés

### 4.1 Toujours remettre le bouton à l’état normal (sécurité)

- **Bloc `try` principal :** s’assurer que **toutes** les branches (return après validation, erreur API, succès, exception) appellent `setIsSubmitting(false)` et `setLoading(false)`.  
- **Filet de sécurité :** un `useEffect` avec un timer (ex. 4 min) qui, si `isSubmitting` ou `loading` est encore true, force `setLoading(false)` et `setIsSubmitting(false)` et éventuellement un message « La création a pris trop de temps ». Ainsi même si un chemin oublie de les remettre, le bouton ne reste pas bloqué indéfiniment.

### 4.2 Tracer si on atteint bien l’envoi de la requête

- **Juste avant** `apiPost('/api/services/create', servicePayload)` : logger un message explicite (ex. « Envoi POST /api/services/create ») et l’envoyer vers `/api/mobile-logs` (ou équivalent) pour le retrouver dans les logs GCP.  
- En cas d’exception **avant** cet appel : logger « Erreur avant envoi : … » et remettre `setLoading(false)` / `setIsSubmitting(false)` dans le catch.  
Cela permet de distinguer :  
  - requête jamais envoyée (problème validation / construction payload / autre),  
  - requête envoyée mais pas de réponse (réseau / backend / DB).

### 4.3 Vérifier la base et les migrations

- Exécuter le script de vérification des migrations (colonnes `users` : `partner_status`, `partner_type`, `free_product_created`, etc.) ou appeler `GET /health/migrations-check` après déploiement.  
- S’assurer que Cloud SQL est bien joignable depuis Cloud Run (réseau, proxy, timeouts).  
Cela évite des 500 ou des blocages côté backend dus à une base mal migrée ou inaccessible.

### 4.4 Timeout côté mobile

- Vérifier que l’appel utilisé pour la création (ex. `apiPost` → `apiCall` → `apiCallInternal`) utilise bien le timeout de **180 s** pour l’endpoint `/api/services/create`.  
- Si un autre chemin (ex. autre client ou autre méthode) est utilisé pour ce formulaire, appliquer le même timeout ou plus long, et gérer l’erreur de timeout en remettant toujours le loading à false.

---

## 5. Synthèse

- **Sauvegarde = backend + base de données.** Dès que le backend traite la création, il a besoin de la DB. Si la base n’est pas accessible, la requête backend peut **rester en attente** et le mobile ne reçoit rien jusqu’au timeout 180 s.  
- **Bouton qui tourne « seulement »** = soit attente normale (jusqu’à 3 min en cas de problème backend/DB), soit **bug** : un chemin ne remet pas `loading`/`isSubmitting` à false, ou le timeout n’est pas appliqué.  
- **Pas de POST `/api/services/create` dans les logs** = soit la requête n’est jamais envoyée (à confirmer avec un log explicite juste avant `apiPost`), soit elle est hors fenêtre de logs.

En appliquant les correctifs ci‑dessus (sécurité loading, logs avant envoi, vérification DB/migrations, vérification timeout), on réduit le risque de spinner infini et on peut trancher si le problème est côté sauvegarde (DB/backend) ou côté soumission du formulaire (validation, envoi, gestion d’erreur).
