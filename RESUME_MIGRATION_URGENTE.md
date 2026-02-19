# 🚨 Résumé : Migration Urgente AWS → Render/Hetzner

**Date** : 2026-02-14  
**Situation** : Compte AWS fermé - Migration nécessaire immédiatement

---

## ✅ BONNE NOUVELLE

**Le projet est déjà configuré pour Render et Hetzner !** ✅

**Fichiers existants** :
- ✅ `render.yaml` - Configuration Render complète
- ✅ `docker-compose.hetzner.yml` - Configuration Hetzner complète
- ✅ `backend/Dockerfile` - Image Docker prête
- ✅ Monitoring déjà en place sur Hetzner

---

## 🎯 RECOMMANDATION : Render (Rapide - 5-10 minutes)

### Pourquoi Render ?

- ✅ **Déjà configuré** : `render.yaml` existe et est complet
- ✅ **Déploiement rapide** : 5-10 minutes
- ✅ **Simple** : Pas de gestion d'infrastructure
- ✅ **PostgreSQL géré** : Base de données incluse
- ✅ **Coût prévisible** : ~$7-25/mois

---

## ⚠️ ACTION URGENTE : Sauvegarder la Base de Données

**AVANT que le compte AWS soit complètement fermé** :

### Option 1 : Depuis un serveur accessible (si vous avez encore accès)

```bash
pg_dump -h yukpo-db.cp4oq80ogckg.eu-west-1.rds.amazonaws.com \
  -U postgres \
  -d yukpomnang \
  > backup_yukpomnang_$(date +%Y%m%d).sql
```

### Option 2 : Via AWS Console (si encore accessible)

1. RDS → Snapshots → Créer un snapshot
2. Exporter le snapshot vers S3
3. Télécharger depuis S3

### Option 3 : Depuis le backend ECS (si encore accessible)

```bash
# Se connecter au conteneur ECS
aws ecs execute-command \
  --cluster yukpo-cluster \
  --task [TASK_ID] \
  --container backend \
  --command "pg_dump $DATABASE_URL > /tmp/backup.sql" \
  --interactive
```

---

## 📋 PLAN DE MIGRATION RENDER (5-10 minutes)

### Étape 1 : Créer un Compte Render (2 min)

1. Aller sur https://render.com
2. Créer un compte (gratuit)
3. Connecter le repository GitHub

---

### Étape 2 : Créer la Base de Données PostgreSQL (1 min)

1. **New** → **PostgreSQL**
2. **Nom** : `yukpomnang-db`
3. **Région** : `Frankfurt`
4. **Plan** : `Starter` ($7/mois)
5. **Créer**

---

### Étape 3 : Restaurer la Base de Données (2 min)

```bash
# Obtenir DATABASE_URL depuis Render Dashboard
export DATABASE_URL="postgresql://user:pass@host:port/dbname"

# Restaurer
psql $DATABASE_URL < backup_yukpomnang.sql
```

---

### Étape 4 : Créer le Service Web (Backend) (2 min)

1. **New** → **Web Service**
2. **Connect Repository** → Sélectionner votre repository
3. **Configuration** :
   - **Name** : `yukpo-backend`
   - **Root Directory** : `backend`
   - **Environment** : `Docker`
   - **Dockerfile Path** : `backend/Dockerfile`
   - **Instance Type** : `Starter` ($7/mois)

4. **Environment Variables** :
   - `DATABASE_URL` : (automatiquement connecté)
   - `REDIS_URL` : (créer un service Redis si nécessaire)
   - `JWT_SECRET` : (copier depuis AWS)
   - `ALLOWED_ORIGINS` : `https://api.yukpomnang.com,https://yukpomnang.com`
   - Toutes les autres variables depuis AWS

5. **Health Check Path** : `/healthz`

6. **Créer**

**Note** : Render utilisera automatiquement `render.yaml` pour la configuration !

---

### Étape 5 : Mettre à Jour DNS Cloudflare (1 min)

1. Cloudflare Dashboard → `yukpomnang.com` → **DNS**
2. Modifier l'enregistrement `api` :
   - **Type** : `CNAME`
   - **Contenu** : `[votre-service].onrender.com` (URL fournie par Render)
   - **Proxy** : Activé (nuage orange) ✅

---

### Étape 6 : Tester (1 min)

```bash
curl https://api.yukpomnang.com/healthz
```

---

## 📊 ALTERNATIVE : Hetzner (Économique - 30-60 min)

**Si vous préférez Hetzner** (4-10€/mois) :
- Voir `GUIDE_MIGRATION_AWS_VERS_RENDER_HETZNER.md` pour les détails complets

---

## 📋 CHECKLIST URGENTE

### Avant la Migration
- [ ] ⚠️ **URGENT** : Sauvegarder la base de données AWS
- [ ] Lister toutes les variables d'environnement AWS
- [ ] Vérifier les secrets (JWT, API keys, etc.)

### Migration Render
- [ ] Créer compte Render
- [ ] Créer base de données PostgreSQL
- [ ] Restaurer la base de données
- [ ] Créer service Web (backend)
- [ ] Configurer variables d'environnement
- [ ] Mettre à jour DNS Cloudflare
- [ ] Tester le backend

---

## 🎯 ORDRE DES ACTIONS

1. **MAINTENANT** : Sauvegarder la base de données AWS ⚠️
2. **Ensuite** : Créer compte Render (2 min)
3. **Ensuite** : Créer base de données PostgreSQL (1 min)
4. **Ensuite** : Restaurer la base de données (2 min)
5. **Ensuite** : Créer service Web backend (2 min)
6. **Ensuite** : Mettre à jour DNS (1 min)
7. **Ensuite** : Tester (1 min)

**Total** : ~10 minutes pour un déploiement complet sur Render

---

## 📚 GUIDES COMPLETS

- `GUIDE_MIGRATION_AWS_VERS_RENDER_HETZNER.md` - Guide détaillé complet
- `PROBLEME_COMPTE_AWS_FERME.md` - Analyse du problème

---

**Date** : 2026-02-14  
**Statut** : Migration urgente - Guides créés - Prêt pour déploiement



