# Analyse logs création produit – Fenêtre 5 min (03:10–03:14 UTC)

**Date** : 23 février 2026  
**Fichier** : `logs-creation-5min.json`  
**Période** : 2 min avant / 2 min après la tentative (5 min total).

---

## 1. Ce qui apparaît dans les logs

### Vers **03:10:59 UTC**
- **FormulaireYukpoIntelligentScreen** (via mobile_logs_controller) :
  - `[FormulaireYukpoIntelligentScreen] Réponse balance complète: { "success": true, "data": { "tokens_balance": 0 } }`
  - `[FormulaireYukpoIntelligentScreen] Solde actuel récupéré: 0`

### Vers **03:10:36 UTC**
- **GET /api/users/balance** (log `run.googleapis.com/requests`) :
  - `requestUrl`: `https://yukpo-backend-376093909298.europe-west1.run.app/api/users/balance`
  - `status`: **200**
  - `latency`: ~8 ms

### Aucune trace de
- POST vers `/api/services/.../products`
- GET vers `/api/users/product-add-cost`
- Log `[add_product_to_service]`
- Log `ProductCreationQueue` ou `process_product_creation`

---

## 2. Conclusion

1. L’app a bien appelé **GET /api/users/balance** et reçu **solde = 0**.
2. Elle n’a **pas** appelé **GET /api/users/product-add-cost** (absent des logs).
3. Elle n’a **jamais** envoyé de **POST /api/services/.../products** (aucune requête, aucun log handler).

Donc le flux s’arrête **côté mobile** après la récupération du solde : avec le code actuel (avant déploiement de la phase de lancement), quand `tokens_balance === 0`, le formulaire considère que le solde est insuffisant par rapport au coût fixe (ex. 3000 FCFA) et affiche **« Solde insuffisant »** sans envoyer la requête de création de produit.

---

## 3. Cause probable

- **Comportement actuel (ancien code)** :  
  `soldeActuel (0) < COUT_AJOUT_PRODUIT (2000 ou 3000)` → alerte « Solde insuffisant » → **return** → pas de confirmation, pas de POST.
- Aucun bug côté backend pour cette étape : la requête de création **n’est jamais envoyée**.

---

## 4. Que faire

1. **Déployer la version mobile** qui utilise **GET /api/users/product-add-cost** et le **coût effectif** (0 en phase de lancement).
2. **Déployer le backend** avec la route **GET /api/users/product-add-cost** et la logique **phase de lancement** dans **add_product_to_service** (coût 0 si `can_create_product_free`).

Après déploiement :
- L’app appellera `product-add-cost`, recevra `cost: 0, is_free: true`.
- Elle n’appliquera plus le blocage « solde insuffisant » pour la création produit.
- L’utilisateur pourra confirmer et le **POST /api/services/.../products** sera bien envoyé (et visible dans les logs à la prochaine tentative).

---

## 5. Autres constats dans la fenêtre

- **DB pool** : `[DB Monitor] Pool saturé: 100.0% utilisé (4/4)` vers 03:12:54.
- **Acquisition lente** : `sqlx::pool::acquire` > 2 s (3.4 s, 4.3 s) vers 03:11:56.
- Ces points peuvent affecter d’autres requêtes mais **ne sont pas la cause** de l’absence de POST création produit (la requête n’est pas envoyée).
