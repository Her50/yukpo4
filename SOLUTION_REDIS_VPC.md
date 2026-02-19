# 🔧 Solution Problème Redis VPC - 2026-02-19

## 🔍 Diagnostic Complet

### Configuration Actuelle

- ✅ **Instance Redis** : `yukpo-redis` (READY)
  - IP : `10.128.102.19`
  - Port : `6379`
  - Réseau : `default`
  - Mode : `DIRECT_PEERING`

- ✅ **VPC Connector** : `yukpo-connector` (READY)
  - Réseau : `default`
  - État : `READY`
  - Min instances : `2`
  - Max instances : `3`

- ✅ **Cloud Run** : `yukpo-backend`
  - VPC Connector : `yukpo-connector`
  - VPC Egress : `all-traffic`
  - REDIS_URL : `redis://10.128.102.19:6379/0`

- ✅ **Route VPC** : `peering-route-904a8af6f6655c1a`
  - Destination : `10.128.102.16/29`
  - Priorité : `0`

### Problème Identifié

**Erreur** : `failed to lookup address information: Name or service not known`

**Cause probable** : Le client Redis ou le système essaie de faire une résolution DNS inverse de l'IP `10.128.102.19`, mais cette résolution échoue car l'IP est privée et n'a pas d'entrée DNS.

---

## ✅ Solutions Proposées

### Solution 1 : Vérifier le VPC Egress (Recommandé)

Le VPC Connector est configuré avec `all-traffic`, mais il faut vérifier que le trafic vers Redis est bien routé via le VPC.

**Vérification** :
```powershell
gcloud run services describe yukpo-backend `
  --region=europe-west1 `
  --project=yukpo-project `
  --format="yaml(spec.template.metadata.annotations.'run.googleapis.com/vpc-access-egress')"
```

**Si nécessaire, forcer le trafic privé** :
```powershell
# Option 1: Utiliser private-ranges-only (recommandé pour Redis privé)
gcloud run services update yukpo-backend `
  --region=europe-west1 `
  --project=yukpo-project `
  --vpc-egress=private-ranges-only

# Option 2: Garder all-traffic mais vérifier les routes
```

### Solution 2 : Ajouter une Entrée DNS (Alternative)

Créer une entrée DNS pour l'IP Redis dans le VPC :

```powershell
# Vérifier si un DNS privé existe
gcloud dns managed-zones list --project=yukpo-project

# Si nécessaire, créer une zone DNS privée
gcloud dns managed-zones create redis-zone `
  --dns-name="redis.internal" `
  --description="Zone DNS privée pour Redis" `
  --visibility=private `
  --networks=default `
  --project=yukpo-project

# Ajouter un enregistrement A
gcloud dns record-sets create redis.yukpo.internal. `
  --zone=redis-zone `
  --rrdatas=10.128.102.19 `
  --type=A `
  --ttl=300 `
  --project=yukpo-project
```

Puis mettre à jour REDIS_URL :
```powershell
$REDIS_URL = "redis://redis.yukpo.internal:6379/0"
echo $REDIS_URL | gcloud secrets versions add redis-url --data-file=- --project=yukpo-project
```

### Solution 3 : Utiliser le Format IP Direct (Test)

Forcer l'utilisation de l'IP sans résolution DNS en utilisant le format IPv4 direct :

```powershell
# Vérifier que l'URL est correcte
$REDIS_URL = "redis://10.128.102.19:6379/0"

# Mettre à jour le secret
echo $REDIS_URL | gcloud secrets versions add redis-url --data-file=- --project=yukpo-project

# Redéployer Cloud Run
gcloud run services update yukpo-backend `
  --region=europe-west1 `
  --project=yukpo-project
```

### Solution 4 : Vérifier les Règles de Firewall

Vérifier que les règles de firewall permettent le trafic depuis le VPC Connector vers Redis :

```powershell
# Lister les règles de firewall
gcloud compute firewall-rules list `
  --filter="network=default AND (targetTags:redis OR sourceRanges:10.0.0.0/8)" `
  --project=yukpo-project `
  --format="table(name,direction,priority,sourceRanges,targetTags,allowed)"
```

**Si nécessaire, créer une règle** :
```powershell
gcloud compute firewall-rules create allow-redis-from-vpc-connector `
  --network=default `
  --action=ALLOW `
  --direction=INGRESS `
  --source-ranges=10.0.0.0/8 `
  --target-tags=redis `
  --rules=tcp:6379 `
  --project=yukpo-project
```

### Solution 5 : Utiliser un Service Redis Externe (Temporaire)

Si le problème persiste, utiliser un service Redis externe (Upstash) en attendant :

```powershell
# Créer un compte Upstash (gratuit jusqu'à 10K commandes/jour)
# Récupérer l'URL depuis https://console.upstash.com

$REDIS_URL = "rediss://default:PASSWORD@ENDPOINT.upstash.io:6379/0"

# Mettre à jour le secret
echo $REDIS_URL | gcloud secrets versions add redis-url --data-file=- --project=yukpo-project

# Redéployer Cloud Run
gcloud run services update yukpo-backend `
  --region=europe-west1 `
  --project=yukpo-project
```

---

## 🚀 Plan d'Action Recommandé

### Étape 1 : Vérifier VPC Egress (5 minutes)

```powershell
# Vérifier la configuration actuelle
gcloud run services describe yukpo-backend `
  --region=europe-west1 `
  --project=yukpo-project `
  --format="yaml(spec.template.metadata.annotations.'run.googleapis.com/vpc-access-egress')"

# Si all-traffic, essayer private-ranges-only
gcloud run services update yukpo-backend `
  --region=europe-west1 `
  --project=yukpo-project `
  --vpc-egress=private-ranges-only
```

### Étape 2 : Attendre et Vérifier (2-3 minutes)

Attendre que Cloud Run redémarre et vérifier les logs :

```powershell
# Attendre 2 minutes
Start-Sleep -Seconds 120

# Vérifier les logs
gcloud logging read 'resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend' `
  --limit=30 `
  --project=yukpo-project `
  --freshness=5m `
  --format='value(textPayload)' | Select-String -Pattern 'Redis|redis' | Select-Object -First 10
```

### Étape 3 : Si le Problème Persiste

Essayer la Solution 2 (DNS) ou la Solution 5 (Redis externe).

---

## 📊 Impact Actuel

- ⚠️ **Mode dégradé** : L'application fonctionne sans Redis
- ✅ **PostgreSQL** : Fonctionne correctement
- ⚠️ **Fonctionnalités affectées** :
  - Cache Redis désactivé
  - Rate limiting Redis désactivé
  - NotificationQueueWorker en erreur (mais avec retry automatique)
  - RedisScalingService en erreur

**Note** : Le backend a une logique de retry automatique pour Redis, donc les erreurs sont gérées gracieusement. L'application continue de fonctionner en mode dégradé.

---

## 🔗 Ressources

- [Documentation VPC Connector](https://cloud.google.com/vpc/docs/configure-serverless-vpc-access)
- [Documentation Memorystore Redis](https://cloud.google.com/memorystore/docs/redis)
- [Documentation Cloud Run VPC](https://cloud.google.com/run/docs/configuring/connecting-vpc)

---

**Date** : 2026-02-19  
**Statut** : Solutions proposées, en attente de test

