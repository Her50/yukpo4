# Vérification des migrations GCP – Connexion impossible

Si après déploiement du backend sur GCP **vous ne parvenez plus à vous connecter** à l’application, la cause peut venir de **migrations non appliquées** sur la base Cloud SQL : le login lit des colonnes qui n’existent pas encore.

---

## 1. Colonnes requises pour le login

Le `login_handler` (POST `/auth/login`) fait un `SELECT` sur la table `users` avec les colonnes :

- `id`, `email`, `password_hash`, `role`, `tokens_balance`, `nom_complet`
- **`partner_status`**, **`partner_type`**

Si **`partner_status`** ou **`partner_type`** n’existent pas en base, la requête échoue (erreur SQL) et le backend renvoie une 500 → l’app affiche une erreur de connexion.

---

## 2. Colonne requise pour la phase de lancement

- **`free_product_created`** (table `users`) : utilisée par `can_create_product_free` et l’endpoint GET `/api/users/product-add-cost`.  
  Si elle manque, les appels à cet endpoint peuvent échouer (500) après le login.

---

## 3. Vérifier l’état de la base GCP

Exécuter le script SQL de vérification sur la base Cloud SQL (connexion via Cloud SQL Proxy ou IP autorisée) :

```powershell
# Exemple : avec une connexion psql (remplacer par votre DATABASE_URL ou host)
psql "postgresql://USER:PASSWORD@/DB?host=/cloudsql/PROJECT:REGION:INSTANCE" -f scripts/verifier-migrations-users-gcp.sql
```

**Option 1 (sans accès DB) :** Une fois le backend déployé avec **GET /health/migrations-check**, lancer `.\scripts\verifier-migrations-gcp.ps1` (ou avec `-BackendUrl "https://..."`). L'endpoint renvoie OK/MANQUANTE pour chaque colonne et `login_ready`.

Ou en copiant le contenu de `scripts/verifier-migrations-users-gcp.sql` dans la console Cloud SQL (requêtes exécutées à la main).

**À vérifier dans le résultat :**

- `table_users_existe` = true
- Présence des lignes pour `partner_status` et `partner_type` dans la liste des colonnes
- `colonne_free_product_created_existe` = true  
Si une de ces colonnes est absente, il faut appliquer les migrations ci‑dessous.

---

## 4. Migrations à appliquer si des colonnes manquent

Sur GCP, les migrations SQLx **ne sont pas exécutées au démarrage** par défaut (`ENABLE_SQLX_MIGRATIONS` est faux). Il faut soit les lancer manuellement, soit activer leur exécution au déploiement.

### Option A : Exécuter les migrations manquantes à la main

Dans l’ordre, exécuter le SQL des fichiers suivants sur la base Cloud SQL :

1. **`backend/migrations/00000075_006_add_partner_columns_to_users.sql`**  
   → Ajoute `partner_type` et `partner_status` à `users` si elles n’existent pas.

2. **`backend/migrations/00000076_007_ensure_users_table_exists.sql`**  
   → S’assure que la table `users` et ces colonnes existent (idempotent).

3. **`backend/migrations/00001023_launch_phase_free_products.sql`**  
   → Ajoute `free_product_created` à `users` et crée les objets liés à la phase de lancement.

Vous pouvez ouvrir chaque fichier, copier son contenu et l’exécuter dans la console Cloud SQL (ou via `psql -f ...`).

### Option B : Lancer toutes les migrations SQLx au prochain déploiement

1. Dans la configuration Cloud Run du service backend, ajouter la variable d’environnement :  
   **`ENABLE_SQLX_MIGRATIONS=true`**
2. Redéployer le backend.  
   Au démarrage, le serveur exécutera `sqlx::migrate!()` (dont les migrations ci‑dessus).  
3. Après vérification que tout fonctionne (login, product-add-cost), vous pouvez remettre **`ENABLE_SQLX_MIGRATIONS=false`** pour les déploiements suivants si vous ne voulez plus exécuter les migrations à chaque déploiement.

---

## 5. Résumé

| Problème              | Cause probable                          | Action                                      |
|-----------------------|------------------------------------------|---------------------------------------------|
| Impossible de se connecter (login) | Colonnes `partner_status` / `partner_type` manquantes dans `users` | Appliquer 00000075 et 00000076 (ou activer ENABLE_SQLX_MIGRATIONS) |
| Erreur après login (ex. product-add-cost) | Colonne `free_product_created` manquante | Appliquer 00001023 (ou ENABLE_SQLX_MIGRATIONS) |

Après application des migrations, revérifier avec `scripts/verifier-migrations-users-gcp.sql` que toutes les colonnes sont bien présentes.
