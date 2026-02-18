# 🔍 Autres Problèmes Identifiés dans les Logs (18/02/2026)

## 📊 Résumé

En plus des problèmes de connexion déjà corrigés, j'ai identifié **5 autres problèmes critiques** dans les logs.

---

## 🚨 Problèmes Identifiés

### 1. **Service GPU - Erreurs Répétées** ⚠️

**Erreur** :
```
[GpuService] Impossible de récupérer métriques GPU, utilisation par défaut
```

**Fréquence** : Toutes les minutes (toutes les 60 secondes)

**Occurrences** :
- 07:49:28
- 07:50:28
- 07:51:28
- 07:52:29
- 07:53:28
- 07:54:28

**Impact** : **MOYEN** - Le service GPU ne peut pas récupérer ses métriques, mais utilise des valeurs par défaut. Cela peut affecter le scaling automatique des instances GPU.

**Cause probable** :
- L'endpoint GPU (`http://yukpo-gpu-workers:8080`) n'est pas accessible depuis Cloud Run
- Le service GPU n'est pas démarré ou n'est pas accessible sur le réseau interne
- Problème de configuration réseau entre Cloud Run et les instances GPU

**Solution recommandée** :
1. Vérifier que le service GPU est démarré et accessible
2. Vérifier la configuration réseau (VPC, firewall)
3. Ajouter un retry avec backoff exponentiel
4. Logger l'erreur exacte (actuellement on ne voit que le message générique)

---

### 2. **Requêtes SQL Lentes Multiples** ⚠️⚠️

#### 2.1. `delivery_matching_queue` (1.8s) - ✅ DÉJÀ CORRIGÉ
- **Status** : Migration créée avec nouveaux index

#### 2.2. `pg_catalog.pg_enum` (1.1s) - ⚠️ NOUVEAU
**Requête** :
```sql
SELECT enumlabel
FROM pg_catalog.pg_enum
WHERE enumtypid = $1
ORDER BY enumsortorder
```

**Problème** : Requête système PostgreSQL qui prend 1.1s (seuil: 1s)

**Impact** : **MOYEN** - Cette requête est probablement utilisée par SQLx pour charger les types enum. Si elle est lente, cela peut ralentir le démarrage de l'application.

**Solution recommandée** :
- Vérifier si cette requête est vraiment nécessaire au démarrage
- Mettre en cache les résultats si possible
- Vérifier les statistiques PostgreSQL (`ANALYZE`)

#### 2.3. `delivery_proximity_suggestions` (1.1s) - ⚠️ NOUVEAU
**Requête** :
```sql
SELECT delivery_id, suggested_status, created_at, auto_confirm_after_seconds
FROM delivery_proximity_suggestions
WHERE status = 'pending'
  AND auto_confirm_after_seconds IS NOT NULL
  AND created_at + (auto_confirm_after_seconds || ' seconds')::interval <= NOW()
LIMIT 50
```

**Problème** : Requête prend 1.1s (seuil: 1s)

**Impact** : **MOYEN** - Cette requête semble être exécutée périodiquement (probablement un cron job). Si elle est lente, elle bloque une connexion du pool pendant 1.1s.

**Solution recommandée** :
- Créer un index sur `(status, created_at, auto_confirm_after_seconds)`
- Utiliser un index partiel si possible
- Optimiser la condition `created_at + interval`

#### 2.4. `product_orders` (1.1s) - ⚠️ NOUVEAU
**Requête** :
```sql
SELECT id, service_id, product_index, client_user_id, provider_user_id
FROM product_orders
WHERE status = 'pending'
  AND validation_deadline IS NOT NULL
  AND validation_deadline <= $1
LIMIT 50
```

**Problème** : Requête prend 1.1s (seuil: 1s)

**Impact** : **MOYEN** - Cette requête semble être exécutée périodiquement pour vérifier les commandes expirées.

**Solution recommandée** :
- Créer un index sur `(status, validation_deadline)`
- Utiliser un index partiel `WHERE status = 'pending'`

#### 2.5. `SELECT 1` (1.2s) - ⚠️ CRITIQUE
**Requête** : `SELECT 1` (requête de test)

**Problème** : Une simple requête `SELECT 1` prend 1.2s !

**Impact** : **CRITIQUE** - Cela indique que le pool est saturé et que les requêtes attendent longtemps pour acquérir une connexion. C'est un symptôme du problème de pool (4 connexions au lieu de 20).

**Cause** : Le pool est saturé, donc même les requêtes de test doivent attendre >1s pour acquérir une connexion.

**Solution** : Déjà en cours de correction (logs pour diagnostiquer le pool)

---

### 3. **Latence Très Élevée (90-91 secondes)** ⚠️⚠️⚠️

**Requêtes affectées** :
- `POST /api/mobile-logs` - Latence: **91.007053351s** (Status: 502)
- `POST /api/mobile-logs` - Latence: **90.014360530s** (Status: 501)

**Impact** : **CRITIQUE** - Ces requêtes dépassent largement le timeout de Cloud Run (900s = 15min, mais 90s est déjà très long).

**Cause probable** :
- Le pool de connexions est saturé
- Les requêtes attendent indéfiniment pour acquérir une connexion
- Cloud Run timeout probablement la requête après 90s

**Solution** : Déjà en cours de correction (min-instances=1, logs pool)

---

### 4. **Multiple Instances Créées (AUTOSCALING)** ⚠️

**Observations** :
- Plusieurs instances créées en peu de temps :
  - 07:56:21 - Instance créée (AUTOSCALING)
  - 07:56:25 - Instance créée (AUTOSCALING)
  - 07:57:20 - Instance créée (AUTOSCALING)
  - 07:57:52 - Instance créée (AUTOSCALING)
  - 07:58:31 - Instance créée (AUTOSCALING)

**Impact** : **MOYEN** - Cloud Run crée beaucoup d'instances car les instances existantes ne peuvent pas gérer la charge (probablement à cause du pool saturé).

**Cause** : Les instances existantes sont bloquées par le pool saturé, donc Cloud Run pense qu'il faut plus d'instances.

**Solution** : Déjà en cours de correction (min-instances=1 devrait réduire le nombre d'instances créées)

---

### 5. **Requêtes SQL Répétées (delivery_matching_queue)** ⚠️

**Observations** :
- La requête `delivery_matching_queue` est exécutée très fréquemment :
  - 07:49:47 (1.8s)
  - 07:50:27 (1.8s)
  - 07:52:28 (1.8s)

**Impact** : **MOYEN** - Cette requête est probablement exécutée dans une boucle ou un cron job très fréquent. Si elle est lente, elle bloque le pool.

**Solution** : Déjà en cours de correction (nouveaux index créés)

---

## 📋 Actions Recommandées

### Priorité 1 (CRITIQUE)
1. ✅ **Pool PostgreSQL** - En cours de correction (logs ajoutés)
2. ✅ **Latence élevée** - En cours de correction (min-instances=1)
3. ⏳ **SELECT 1 lent** - Symptôme du pool saturé, sera résolu avec la correction du pool

### Priorité 2 (ÉLEVÉ)
4. ⏳ **Service GPU** - Vérifier l'accessibilité et ajouter retry
5. ⏳ **Requêtes SQL lentes** :
   - `delivery_proximity_suggestions` - Créer index
   - `product_orders` - Créer index
   - `pg_catalog.pg_enum` - Vérifier si nécessaire

### Priorité 3 (MOYEN)
6. ⏳ **Multiple instances** - Surveiller après correction du pool
7. ⏳ **Requêtes répétées** - Optimiser la fréquence d'exécution

---

## 🔗 Fichiers à Modifier

1. **Service GPU** : `backend/src/services/gpu_service.rs`
   - Ajouter retry avec backoff
   - Logger l'erreur exacte
   - Vérifier la configuration réseau

2. **Migrations SQL** :
   - `backend/migrations/20260218_optimize_delivery_proximity_suggestions.sql` (à créer)
   - `backend/migrations/20260218_optimize_product_orders.sql` (à créer)

3. **Configuration** :
   - Vérifier `GPU_ENDPOINT` dans les variables d'environnement
   - Vérifier la configuration réseau Cloud Run → GPU instances

---

## 📝 Notes

- La plupart des problèmes sont liés au pool PostgreSQL saturé (4 connexions au lieu de 20)
- Les corrections déjà appliquées devraient résoudre la majorité des problèmes
- Les requêtes SQL lentes peuvent être optimisées avec des index appropriés
- Le service GPU nécessite une investigation plus approfondie (configuration réseau)

