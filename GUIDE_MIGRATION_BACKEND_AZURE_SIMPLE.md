# 🚀 Guide : Migration Backend vers Azure (Base de Données Vide)

**Date** : 2026-02-14  
**Objectif** : Migrer uniquement le backend vers Azure (pas de migration de données)

---

## ✅ SITUATION

- ✅ **Base de données vide** : Pas besoin de migration de données
- ✅ **Compte Azure créé** : Vous avez déjà accès au portail Azure
- ✅ **Objectif** : Migrer uniquement le backend

---

## 📋 PLAN DE MIGRATION SIMPLIFIÉ

### Étape 1 : Créer la Base de Données PostgreSQL (5 min)

1. Azure Portal → **Create a resource** → **Azure Database for PostgreSQL**
2. Cliquer sur **"Create"**
3. Sélectionner **"Flexible Server"** (recommandé)
4. **Configuration** :
   - **Subscription** : Votre abonnement
   - **Resource group** : Créer nouveau → `yukpomnang-rg`
   - **Server name** : `yukpomnang-db` (doit être unique)
   - **Region** : `West Europe` (Frankfurt)
   - **PostgreSQL version** : `15`
   - **Compute + storage** :
     - **Compute tier** : `Burstable`
     - **Compute size** : `Standard_B1ms` (1 vCore, 2GB RAM) - Gratuit avec crédit $200
     - **Storage** : `32 GB` (gratuit)
   - **High availability** : `Disabled` (pour économiser)
   - **Backup** : `7 days` (gratuit)
5. **Authentication** :
   - **Admin username** : `yukpo_admin`
   - **Password** : (générer un mot de passe fort)
6. **Networking** :
   - **Public access** : `Yes` (pour permettre la connexion)
   - **Firewall rules** : Ajouter votre IP actuelle
7. **Review + create** → **Create**

**Temps d'attente** : ~5 minutes

**Note** : La base de données sera vide, les migrations s'exécuteront automatiquement au démarrage du backend.

---

### Étape 2 : Installer les Extensions PostgreSQL (2 min)

**Une fois la base de données créée** :

1. Azure Portal → **Azure Database for PostgreSQL** → `yukpomnang-db`
2. **Query editor** (ou utiliser Azure Cloud Shell)
3. Exécuter :

```sql
-- Installer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS imgsmlr;
```

**Alternative : Via Azure Cloud Shell**

```bash
# Se connecter à la base de données
psql "host=yukpomnang-db.postgres.database.azure.com \
  port=5432 \
  dbname=postgres \
  user=yukpo_admin \
  password=VOTRE_MOT_DE_PASSE \
  sslmode=require" <<EOF
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS imgsmlr;
EOF
```

---

### Étape 3 : Créer App Service (Backend) (10 min)

1. Azure Portal → **Create a resource** → **Web App**
2. **Configuration** :
   - **Subscription** : Votre abonnement
   - **Resource group** : `yukpomnang-rg` (créé précédemment)
   - **Name** : `yukpo-backend` (doit être unique)
   - **Publish** : `Docker Container`
   - **Operating System** : `Linux`
   - **Region** : `West Europe` (Frankfurt)
   - **App Service Plan** :
     - Cliquer sur **"Create new"**
     - **Name** : `yukpo-backend-plan`
     - **Operating System** : `Linux`
     - **Region** : `West Europe`
     - **Pricing tier** : `Free F1` (gratuit) ou `Basic B1` (~$13/mois)
     - **Créer**
   - **Créer**

3. **Configuration Container** :
   - App Service → **Deployment Center**
   - **Source** : `Docker Hub` ou `GitHub Container Registry`
   - **Image and tag** : `ghcr.io/Her50/yukpo4/yukpomnang-backend-optimized:latest`
   - **Save**

4. **Environment Variables** :
   - App Service → **Configuration** → **Application settings**
   - Ajouter :
     - `DATABASE_URL` : `postgresql://yukpo_admin:VOTRE_MOT_DE_PASSE@yukpomnang-db.postgres.database.azure.com:5432/postgres?sslmode=require`
     - `JWT_SECRET` : (générer un secret fort)
     - `ALLOWED_ORIGINS` : `https://api.yukpomnang.com,https://yukpomnang.com`
     - `RUST_LOG` : `info`
     - `ENVIRONMENT` : `production`
     - `ENABLE_AUTO_MIGRATIONS` : `true` (pour créer les tables automatiquement)
     - `SQLX_OFFLINE` : `true`
     - Toutes les autres variables d'environnement nécessaires
   - **Save**

5. **Health Check** :
   - App Service → **Health check**
   - **Enable** : `Yes`
   - **Path** : `/healthz`
   - **Save**

---

### Étape 4 : Configurer le Budget et les Alertes (5 min)

1. Azure Portal → **Cost Management + Billing**
2. **Budgets** → **Add**
3. **Configuration** :
   - **Scope** : `Subscription` → Sélectionner votre abonnement
   - **Budget name** : `yukpomnang-monthly-budget`
   - **Reset period** : `Monthly`
   - **Budget amount** : `$50` (ou votre limite)
   - **Alert conditions** :
     - `50%` : Email alert
     - `90%` : Email alert
     - `100%` : Email alert + Action group (arrêter les ressources)
   - **Email recipients** : Votre email
   - **Create**

**Résultat** : Vous recevrez des alertes si vous dépassez votre budget ! ✅

---

### Étape 5 : Mettre à Jour DNS Cloudflare (2 min)

1. Cloudflare Dashboard → `yukpomnang.com` → **DNS**
2. Modifier l'enregistrement `api` :
   - **Type** : `CNAME`
   - **Name** : `api`
   - **Target** : `yukpo-backend.azurewebsites.net`
   - **Proxy status** : `Proxied` (nuage orange) ✅
   - **Save**

**Note** : Azure fournit automatiquement HTTPS via `*.azurewebsites.net`

---

### Étape 6 : Tester (2 min)

**Attendre 2-3 minutes** pour que le backend démarre et exécute les migrations automatiques.

```bash
# Health check
curl https://api.yukpomnang.com/healthz

# Test API
curl https://api.yukpomnang.com/api/health
```

**Résultat attendu** :
- Status: 200 OK
- Les migrations ont été exécutées automatiquement
- La base de données est prête

---

## ✅ CHECKLIST SIMPLIFIÉE

### Migration Backend Azure
- [ ] Créer compte Azure (déjà fait ✅)
- [ ] Créer base de données PostgreSQL
- [ ] Installer extensions PostgreSQL (vector, imgsmlr)
- [ ] Créer App Service (backend)
- [ ] Configurer variables d'environnement
- [ ] Configurer budget et alertes
- [ ] Mettre à jour DNS Cloudflare
- [ ] Tester le backend

---

## 💰 COÛTS ESTIMÉS

### Mois 1 (Avec crédit $200)

- App Service F1 : **Gratuit** ✅
- PostgreSQL Basic : **Gratuit** (avec crédit) ✅
- Storage : **Gratuit** (5GB) ✅
- **Total** : **$0** ✅

### Mois 2+ (Sans crédit)

**Option Économique** :
- App Service B1 : ~$13/mois
- PostgreSQL Basic : ~$25/mois
- Storage : ~$2/mois
- **Total** : ~$40/mois

**Avec budgets et alertes** : Vous maîtrisez totalement les coûts ! ✅

---

## 🎯 VARIABLES D'ENVIRONNEMENT IMPORTANTES

### Variables Requises

```bash
# Base de données
DATABASE_URL=postgresql://yukpo_admin:password@yukpomnang-db.postgres.database.azure.com:5432/postgres?sslmode=require

# Migrations automatiques
ENABLE_AUTO_MIGRATIONS=true
SQLX_OFFLINE=true

# Sécurité
JWT_SECRET=votre_secret_jwt_fort
ALLOWED_ORIGINS=https://api.yukpomnang.com,https://yukpomnang.com

# Logging
RUST_LOG=info
ENVIRONMENT=production
```

### Variables Optionnelles (selon votre configuration)

```bash
# Redis (si utilisé)
REDIS_URL=redis://...

# Autres services
MONGODB_URL=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

---

## 🔧 UTILISER LE SCRIPT EXISTANT (Optionnel)

**Si vous préférez utiliser le script automatique** :

```bash
# Le script backend/SCRIPT_DEPLOY_AZURE.sh existe
# Mais il est conçu pour Container Instances
# Pour App Service, suivez le guide manuel ci-dessus
```

**Note** : Le script `SCRIPT_DEPLOY_AZURE.sh` utilise Azure Container Instances, mais App Service est recommandé pour plus de simplicité.

---

## 📊 RÉSUMÉ

| Étape | Temps | Description |
|-------|------|-------------|
| **1. Créer PostgreSQL** | 5 min | Base de données vide |
| **2. Installer extensions** | 2 min | vector, imgsmlr |
| **3. Créer App Service** | 10 min | Backend avec Docker |
| **4. Configurer budget** | 5 min | Alertes de coûts |
| **5. Mettre à jour DNS** | 2 min | Cloudflare |
| **6. Tester** | 2 min | Vérifier que ça fonctionne |
| **TOTAL** | **~26 min** | Migration complète |

---

## 🎯 PROCHAINES ÉTAPES

1. **Créer la base de données PostgreSQL** (Étape 1)
2. **Créer App Service** (Étape 3)
3. **Configurer les variables d'environnement**
4. **Mettre à jour DNS**
5. **Tester**

**Les migrations s'exécuteront automatiquement** grâce à `ENABLE_AUTO_MIGRATIONS=true` ! ✅

---

**Date** : 2026-02-14  
**Statut** : Guide simplifié créé - Prêt pour migration backend uniquement



