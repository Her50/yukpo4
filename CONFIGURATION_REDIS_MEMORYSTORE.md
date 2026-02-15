# ✅ Configuration Redis Memorystore (GCP)

**Date**: 2026-02-15  
**Statut**: ✅ Instance Redis créée, configuration en cours

---

## ✅ Instance Memorystore Redis Créée

- **Nom** : `yukpo-redis`
- **Région** : `europe-west1`
- **Tier** : `BASIC`
- **Mémoire** : `1GB`
- **Version** : `redis_7_0`
- **Host** : `10.128.102.19` (IP privée)
- **Port** : `6379`
- **REDIS_URL** : `redis://10.128.102.19:6379/0`

---

## ⚠️ Important : Connexion depuis Cloud Run

Memorystore Redis utilise une **IP privée** (`10.128.102.19`). Pour que Cloud Run puisse s'y connecter, il faut :

### Option 1: VPC Connector (Recommandé)

Si vous avez déjà un VPC Connector (ex: `yukpo-connector`), Cloud Run peut s'y connecter via le VPC.

**Vérifier le VPC Connector** :
```bash
gcloud compute networks vpc-access connectors describe yukpo-connector \
  --region=europe-west1 \
  --project=yukpo-project
```

**Si le VPC Connector existe** :
- Cloud Run peut accéder à Memorystore Redis via le VPC
- La connexion devrait fonctionner automatiquement

### Option 2: Autoriser le Réseau dans Memorystore

Memorystore Redis doit autoriser le réseau VPC de Cloud Run :

```bash
# Vérifier le réseau autorisé
gcloud redis instances describe yukpo-redis \
  --region=europe-west1 \
  --format="get(authorizedNetwork)" \
  --project=yukpo-project
```

**Si nécessaire, mettre à jour** :
```bash
gcloud redis instances update yukpo-redis \
  --region=europe-west1 \
  --authorized-network=default \
  --project=yukpo-project
```

---

## 🔧 Configuration Cloud Run

### Mettre à Jour REDIS_URL

```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-env-vars="REDIS_URL=redis://10.128.102.19:6379/0" \
  --project=yukpo-project
```

### OU Mettre à Jour le Secret GitHub

**Secret** : `REDIS_URL`  
**Valeur** : `redis://10.128.102.19:6379/0`

---

## 🔍 Vérification

### Tester la Connexion Redis

Après le déploiement, vérifier les logs :

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND textPayload=~'Redis\|redis'" --limit=20 --project=yukpo-project
```

**Logs attendus** :
```
✅ Redis: Connexion établie
✅ Redis pool créé
```

### Tester depuis Cloud Run

Si vous avez accès à un shell Cloud Run, tester :

```bash
redis-cli -h 10.128.102.19 -p 6379 ping
```

**Réponse attendue** : `PONG`

---

## 📋 Checklist

- [x] **API Memorystore Redis** : Activée
- [x] **Instance Redis** : Créée (`yukpo-redis`)
- [x] **Host et Port** : Récupérés
- [ ] **REDIS_URL mise à jour** : Dans Cloud Run ou secret GitHub
- [ ] **VPC Connector vérifié** : Pour accès IP privée
- [ ] **Réseau autorisé** : Dans Memorystore Redis
- [ ] **Connexion testée** : Logs Cloud Run

---

## 💡 Notes Importantes

1. **IP Privée** : Memorystore Redis utilise une IP privée (10.128.102.19)
   - Cloud Run doit être dans le même VPC ou utiliser VPC Connector
   - Pas d'accès depuis Internet public

2. **Sécurité** :
   - Redis n'est accessible que depuis le VPC GCP
   - Pas d'exposition publique
   - Plus sécurisé que Redis public

3. **Performance** :
   - Latence minimale (même réseau GCP)
   - Pas de trafic Internet
   - Coûts réduits (pas de trafic sortant)

---

**✅ Instance Redis Memorystore créée avec succès !**

**🔴 PROCHAINE ÉTAPE** : Vérifier le VPC Connector et mettre à jour REDIS_URL dans Cloud Run.

