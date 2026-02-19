# 🔍 Analyse Problème Login Bloqué 90 Secondes

**Date**: 2026-02-19  
**Problème**: Les tentatives de connexion tournent pendant des minutes sans succès

---

## 🎯 Résumé Exécutif

**Problème Principal Identifié**: ❌ **Middleware anti-bruteforce bloque les requêtes pendant 90 secondes** en attendant une connexion Redis qui n'arrive jamais

**Impact**: 🔴 **CRITIQUE** - Les utilisateurs ne peuvent pas se connecter, les requêtes timeout après 90 secondes

**Cause Racine**: Le middleware `anti_bruteforce` appelle `get_multiplexed_async_connection()` **sans timeout explicite**, ce qui peut bloquer indéfiniment si Redis n'est pas accessible

---

## 📊 Analyse des Logs

### 1. Requêtes de Login avec Latence de 90 Secondes

**Logs observés**:
```
Status: 501, 503
URL: /api/auth/login
Latency: 90.005786559s, 90.004256739s
```

**Problème**: Les requêtes de login prennent exactement **90 secondes** avant d'échouer avec des codes 501/503.

### 2. Erreurs Redis Massives

**Erreur répétée**:
```
Redis connection failed: Connexion Redis échouée: failed to lookup address information: Name or service not known
```

**Fréquence**: ❌ **Toutes les 2-3 secondes** (très élevée)

**Cause**: VPC Connector configuré mais Redis Memorystore toujours inaccessible (problème de résolution DNS)

---

## 🐛 Cause Racine Identifiée

### Problème dans `anti_bruteforce.rs` (ligne 51)

**Code actuel**:
```rust
let mut redis_conn = match state.redis_client.get_multiplexed_async_connection().await {
    Ok(conn) => conn,
    Err(e) => {
        warn!("[anti_bruteforce] Redis indisponible: {} - Protection désactivée", e);
        return Ok(next.run(req).await);
    }
};
```

**Problème**:
1. `get_multiplexed_async_connection()` **n'a pas de timeout explicite** dans ce contexte
2. Si Redis n'est pas accessible, la connexion peut bloquer pendant **plusieurs dizaines de secondes** (timeout par défaut du système)
3. Les logs montrent des latences de **exactement 90 secondes**, ce qui correspond probablement au timeout par défaut de Cloud Run ou du client Redis

**Impact**:
- Chaque requête de login est bloquée pendant 90 secondes
- L'utilisateur voit une "tentative de connexion" qui tourne indéfiniment
- Après 90 secondes, la requête échoue avec un code 501/503

---

## ✅ Solution Appliquée

### Modification du Middleware Anti-Bruteforce

**Fichier**: `backend/src/middlewares/anti_bruteforce.rs`

**Changement**:
1. Ajout d'un **timeout explicite de 2 secondes** pour la connexion Redis
2. Utilisation de `tokio::time::timeout()` pour limiter le temps d'attente
3. Fail-open immédiat si Redis timeout (pas d'attente de 90 secondes)

**Code corrigé**:
```rust
// ✅ CRITIQUE 2026-02-19: Ajouter un timeout explicite pour éviter les blocages de 90s
// Si Redis n'est pas accessible, le timeout par défaut peut être très long
// Timeout de 2 secondes maximum pour ne pas bloquer les requêtes de login
let mut redis_conn = match timeout(
    TokioDuration::from_secs(2),
    state.redis_client.get_multiplexed_async_connection(),
)
.await
{
    Ok(Ok(conn)) => conn,
    Ok(Err(e)) => {
        warn!("[anti_bruteforce] Redis indisponible: {} - Protection désactivée", e);
        return Ok(next.run(req).await);
    }
    Err(_) => {
        warn!("[anti_bruteforce] Redis timeout (2s) - Protection désactivée");
        return Ok(next.run(req).await);
    }
};
```

**Bénéfices**:
- ✅ Les requêtes de login ne sont plus bloquées pendant 90 secondes
- ✅ Si Redis est indisponible, fail-open après seulement 2 secondes
- ✅ L'authentification fonctionne même si Redis est down (protection désactivée)
- ✅ Expérience utilisateur améliorée (pas d'attente de 90 secondes)

---

## 🔧 Problèmes Secondaires Identifiés

### 1. Redis Toujours Inaccessible

**Problème**: Même avec le VPC Connector configuré (`yukpo-connector` avec `all-traffic`), Redis Memorystore n'est toujours pas accessible.

**Erreur**: `failed to lookup address information: Name or service not known`

**Actions nécessaires**:
1. Vérifier que le VPC Connector est correctement configuré et actif
2. Vérifier que Redis Memorystore est dans le même réseau VPC
3. Vérifier les règles de firewall et les routes VPC
4. Tester la connectivité depuis Cloud Run vers Redis

### 2. Codes 501/503 sur les Requêtes

**Problème**: Les requêtes retournent des codes 501 (Not Implemented) et 503 (Service Unavailable).

**Causes possibles**:
- Instance Cloud Run en cours de démarrage (cold start)
- Instance crashée ou non disponible
- Pool de connexions PostgreSQL saturé
- Timeout de requête dépassé

**Actions nécessaires**:
1. Vérifier l'état des instances Cloud Run
2. Vérifier les logs de démarrage du backend
3. Vérifier la configuration du pool PostgreSQL

---

## 📋 Prochaines Étapes

1. ✅ **Correction appliquée** - Middleware anti-bruteforce avec timeout de 2s
2. 🔄 **Déployer la correction** - Redéployer le backend avec la correction
3. 🔄 **Tester la connexion** - Vérifier que les requêtes de login ne bloquent plus
4. 🔄 **Résoudre le problème Redis** - Vérifier la configuration VPC Connector et Redis Memorystore
5. 🔄 **Surveiller les logs** - Vérifier que les latences sont réduites (< 5 secondes)

---

## 📝 Notes Techniques

### Timeout par Défaut Redis

Le client Redis Rust (`redis-rs`) utilise un timeout par défaut qui peut être très long (plusieurs dizaines de secondes) si le serveur n'est pas accessible. C'est pourquoi il est **critique** d'ajouter un timeout explicite dans les middlewares qui sont appelés à chaque requête.

### Fail-Open vs Fail-Closed

Le middleware anti-bruteforce utilise une stratégie **fail-open** : si Redis est indisponible, la protection est désactivée mais l'authentification continue de fonctionner. C'est la bonne approche pour éviter de bloquer tous les utilisateurs si Redis est down.

### Impact sur la Sécurité

Avec le timeout de 2 secondes, si Redis est indisponible, la protection anti-bruteforce est désactivée. Cela signifie que :
- Les utilisateurs peuvent toujours se connecter (bon pour la disponibilité)
- La protection contre les attaques brute-force est temporairement désactivée (risque de sécurité)

**Recommandation**: Résoudre le problème Redis rapidement pour réactiver la protection anti-bruteforce.

