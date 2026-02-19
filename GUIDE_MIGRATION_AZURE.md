# 🚀 Guide : Migration vers Azure (Performance + Maîtrise Coûts)

**Date** : 2026-02-14  
**Objectif** : Migrer vers Azure avec maîtrise totale des coûts

---

## ✅ AVANTAGES AZURE

### Gratuité

- ✅ **$200 de crédit gratuit** pendant 30 jours
- ✅ **Services gratuits permanents** :
  - App Service F1 : Gratuit (60 minutes/jour)
  - PostgreSQL Basic : Gratuit avec crédit $200
  - Storage : 5GB gratuit/mois
  - CDN : 5GB gratuit/mois

### Maîtrise des Coûts

- ✅ **Budgets et alertes** : Contrôle total des dépenses
- ✅ **Cost Management** : Dashboard détaillé des coûts
- ✅ **Tags** : Organisation et suivi des coûts par ressource
- ✅ **Reservations** : Réductions jusqu'à 72%

### Performance

- ✅ **Infrastructure mondiale** : Datacenters partout
- ✅ **Auto-scaling** : Mise à l'échelle automatique
- ✅ **Load balancing** : Intégré
- ✅ **CDN** : Intégré

---

## 📋 PLAN DE MIGRATION

### Étape 1 : Créer un Compte Azure (5 min)

1. Aller sur https://azure.microsoft.com/free
2. Cliquer sur **"Start free"**
3. Créer un compte Microsoft (ou utiliser un compte existant)
4. Vérifier l'identité (carte de crédit requise, mais pas de frais)
5. **Résultat** : $200 de crédit gratuit pendant 30 jours ✅

---

### Étape 2 : Sauvegarder la Base de Données AWS (URGENT)

**⚠️ IMPORTANT** : Avant que le compte AWS soit fermé

```bash
pg_dump -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
  -U postgres \
  -d yukpomnang \
  > backup_yukpomnang_$(date +%Y%m%d).sql
```

---

### Étape 3 : Créer la Base de Données PostgreSQL (5 min)

1. Azure Portal → **Create a resource** → **Azure Database for PostgreSQL**
2. Cliquer sur **"Create"**
3. Sélectionner **"Flexible Server"** (recommandé)
4. **Configuration** :
   - **Subscription** : Votre abonnement
   - **Resource group** : Créer nouveau → `yukpomnang-rg`
   - **Server name** : `yukpomnang-db`
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
   - **Public access** : `Yes` (pour restaurer la base de données)
   - **Firewall rules** : Ajouter votre IP actuelle
7. **Review + create** → **Create**

**Temps d'attente** : ~5 minutes

---

### Étape 4 : Restaurer la Base de Données (5 min)

**Option A : Via psql (local)**

```bash
# Obtenir la connexion depuis Azure Portal
# PostgreSQL → Connection strings → Copy "psql" connection string

# Exemple :
psql "host=yukpomnang-db.postgres.database.azure.com \
  port=5432 \
  dbname=postgres \
  user=yukpo_admin \
  password=VOTRE_MOT_DE_PASSE \
  sslmode=require" < backup_yukpomnang.sql
```

**Option B : Via Azure Cloud Shell**

1. Azure Portal → **Cloud Shell** (icône `>_` en haut)
2. Uploader le fichier backup :
   ```bash
   # Dans Cloud Shell
   upload backup_yukpomnang.sql
   ```
3. Restaurer :
   ```bash
   psql "host=yukpomnang-db.postgres.database.azure.com \
     port=5432 \
     dbname=postgres \
     user=yukpo_admin \
     password=VOTRE_MOT_DE_PASSE \
     sslmode=require" < backup_yukpomnang.sql
   ```

---

### Étape 5 : Créer App Service (Backend) (10 min)

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
     - `DATABASE_URL` : `postgresql://yukpo_admin:password@yukpomnang-db.postgres.database.azure.com:5432/postgres?sslmode=require`
     - `JWT_SECRET` : (copier depuis AWS)
     - `ALLOWED_ORIGINS` : `https://api.yukpomnang.com,https://yukpomnang.com`
     - `RUST_LOG` : `info`
     - `ENVIRONMENT` : `production`
     - Toutes les autres variables depuis AWS
   - **Save**

5. **Health Check** :
   - App Service → **Health check**
   - **Enable** : `Yes`
   - **Path** : `/healthz`
   - **Save**

---

### Étape 6 : Configurer le Budget et les Alertes (5 min)

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

### Étape 7 : Mettre à Jour DNS Cloudflare (2 min)

1. Cloudflare Dashboard → `yukpomnang.com` → **DNS**
2. Modifier l'enregistrement `api` :
   - **Type** : `CNAME`
   - **Name** : `api`
   - **Target** : `yukpo-backend.azurewebsites.net`
   - **Proxy status** : `Proxied` (nuage orange) ✅
   - **Save**

**Note** : Azure fournit automatiquement HTTPS via `*.azurewebsites.net`

---

### Étape 8 : Tester (2 min)

```bash
# Health check
curl https://api.yukpomnang.com/healthz

# Test API
curl https://api.yukpomnang.com/api/health
```

---

## 💰 STRATÉGIE DE MAÎTRISE DES COÛTS

### 1. Utiliser les Services Gratuits

- ✅ **App Service F1** : Gratuit (60 minutes/jour)
- ✅ **PostgreSQL Basic** : Gratuit avec crédit $200
- ✅ **Storage** : 5GB gratuit/mois
- ✅ **CDN** : 5GB gratuit/mois

### 2. Configurer des Budgets

- ✅ **Budget mensuel** : Définir une limite (ex: $50/mois)
- ✅ **Alertes** : Recevoir des emails à 50%, 90%, 100%
- ✅ **Actions automatiques** : Arrêter les ressources si budget dépassé

### 3. Utiliser des Tags

- ✅ **Organiser les ressources** : Par projet, environnement, etc.
- ✅ **Suivre les coûts** : Par tag dans Cost Management

### 4. Optimiser les Ressources

- ✅ **Right-sizing** : Ajuster la taille des ressources selon l'utilisation
- ✅ **Auto-shutdown** : Arrêter les ressources non utilisées
- ✅ **Reservations** : Réductions jusqu'à 72% avec réservations (après 1 an)

---

## 📊 ESTIMATION DES COÛTS

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

## ✅ CHECKLIST DE MIGRATION

### Avant la Migration
- [ ] ⚠️ **URGENT** : Sauvegarder la base de données AWS
- [ ] Lister toutes les variables d'environnement AWS
- [ ] Vérifier les secrets (JWT, API keys, etc.)

### Migration Azure
- [ ] Créer compte Azure (crédit $200)
- [ ] Créer base de données PostgreSQL
- [ ] Restaurer la base de données
- [ ] Créer App Service (backend)
- [ ] Configurer variables d'environnement
- [ ] Configurer budget et alertes
- [ ] Mettre à jour DNS Cloudflare
- [ ] Tester le backend

---

## 🎯 PROCHAINES ÉTAPES

1. **MAINTENANT** : Sauvegarder la base de données AWS ⚠️
2. **Ensuite** : Créer compte Azure (5 min)
3. **Ensuite** : Suivre le plan de migration (30-40 min)

---

**Date** : 2026-02-14  
**Statut** : Guide de migration Azure créé - Prêt pour déploiement



