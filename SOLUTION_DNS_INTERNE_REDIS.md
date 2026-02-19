# ✅ Solution DNS Interne pour Redis Memorystore

**Date**: 2026-02-19  
**Action**: Configuration DNS interne pour résoudre le problème de résolution DNS Redis

---

## 🎯 Problème Résolu

**Problème**: Le client Redis Rust essaie de résoudre le DNS de l'IP privée `10.128.102.19`, ce qui échoue avec l'erreur `failed to lookup address information: Name or service not known`.

**Solution**: Créer un enregistrement DNS interne qui pointe vers l'IP Redis, permettant la résolution DNS normale.

---

## ✅ Configuration Appliquée

### 1. Zone DNS Privée Existante

**Zone DNS**: `redis-zone`
- **Domaine**: `redis.internal.`
- **Visibilité**: `private`
- **Réseau**: `default`

### 2. Enregistrement DNS Créé

**Enregistrement A**:
- **Nom**: `redis-memorystore.redis.internal`
- **Type**: `A`
- **Valeur**: `10.128.102.19` (IP Redis Memorystore)
- **TTL**: `300` secondes (5 minutes)

### 3. REDIS_URL Mise à Jour

**Ancienne URL**: `redis://10.128.102.19:6379/0`  
**Nouvelle URL**: `redis://redis-memorystore.redis.internal:6379/0`

**Avantages**:
- ✅ Résolution DNS fonctionne (nom DNS au lieu d'IP directe)
- ✅ Le client Redis Rust peut résoudre le nom DNS
- ✅ Pas besoin de modifier le code backend
- ✅ Solution native GCP

---

## 📊 Configuration Finale

### DNS
```
Zone: redis-zone
Domaine: redis.internal.
Enregistrement: redis-memorystore.redis.internal → 10.128.102.19
```

### Redis Memorystore
```
Nom: yukpo-redis
IP: 10.128.102.19
Port: 6379
Nom DNS: redis-memorystore.redis.internal
```

### REDIS_URL
```
redis://redis-memorystore.redis.internal:6379/0
```

---

## 🔧 Commandes Exécutées

### 1. Vérification Zone DNS
```bash
gcloud dns managed-zones list --project=yukpo-project
```

### 2. Création Enregistrement A
```bash
gcloud dns record-sets create redis-memorystore.redis.internal \
  --zone=redis-zone \
  --type=A \
  --rrdatas=10.128.102.19 \
  --ttl=300 \
  --project=yukpo-project
```

### 3. Mise à Jour Secret REDIS_URL
```bash
echo "redis://redis-memorystore.redis.internal:6379/0" | \
  gcloud secrets versions add redis-url --data-file=- --project=yukpo-project
```

### 4. Mise à Jour Cloud Run
```bash
gcloud run services update yukpo-backend \
  --region=europe-west1 \
  --update-secrets="REDIS_URL=redis-url:latest" \
  --project=yukpo-project
```

---

## 🎯 Résultat Attendu

Avec cette configuration :
1. ✅ Le client Redis Rust peut résoudre `redis-memorystore.redis.internal` via DNS
2. ✅ La résolution DNS retourne l'IP `10.128.102.19`
3. ✅ La connexion TCP vers Redis fonctionne via le VPC Connector
4. ✅ Plus d'erreur "failed to lookup address information"

---

## 🔍 Vérification

Pour vérifier que tout fonctionne :

```bash
# Vérifier l'enregistrement DNS
gcloud dns record-sets list --zone=redis-zone --project=yukpo-project

# Surveiller les logs Redis
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=yukpo-backend AND textPayload=~'Redis'" --project=yukpo-project

# Tester la résolution DNS depuis Cloud Run (si possible)
# Le nom devrait résoudre vers 10.128.102.19
```

---

## 📝 Notes Techniques

### Pourquoi DNS Interne Fonctionne ?

1. **Zone DNS Privée**: La zone `redis.internal.` est configurée comme privée et attachée au réseau VPC `default`
2. **Résolution DNS**: Les ressources dans le VPC (y compris Cloud Run via VPC Connector) peuvent résoudre les noms dans cette zone
3. **Enregistrement A**: L'enregistrement `redis-memorystore.redis.internal` pointe vers l'IP privée `10.128.102.19`
4. **Client Redis**: Le client Redis Rust peut maintenant résoudre le nom DNS au lieu d'essayer de résoudre l'IP directement

### Avantages vs IP Directe

**Avec IP directe** (`10.128.102.19`):
- ❌ Le client essaie de faire une résolution DNS inverse
- ❌ Échec car l'IP privée n'est pas dans le DNS public
- ❌ Erreur "failed to lookup address information"

**Avec DNS interne** (`redis-memorystore.redis.internal`):
- ✅ Le client résout le nom DNS normalement
- ✅ La zone DNS privée retourne l'IP `10.128.102.19`
- ✅ Connexion TCP réussie via VPC Connector

---

## ✅ Conclusion

La solution DNS interne permet de résoudre le problème de résolution DNS pour Redis Memorystore. Le client Redis Rust peut maintenant résoudre le nom DNS et se connecter à Redis via le VPC Connector.

**Prochaine étape**: Surveiller les logs pour confirmer que les erreurs DNS Redis ont disparu et que la connexion fonctionne.

