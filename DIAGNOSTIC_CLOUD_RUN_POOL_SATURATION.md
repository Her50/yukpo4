# ⚠️ Diagnostic : Pool PostgreSQL Saturé sur Cloud Run

**Date** : 2026-02-14  
**Service** : `yukpo-backend`  
**Problème** : Pool PostgreSQL saturé (100% utilisé)

---

## 🔍 Problème Identifié

### Symptômes dans les Logs

```
❌ [DB Monitor] ⚠️ Pool saturé: 100.0% utilisé (25/25)
❌ [DB Monitor] ⚠️ Pool test timeout (5s) - Size: 25, Active: 25, Idle: 0
❌ pool timed out while waiting for an open connection
❌ [MIGRATIONS SQLX Cloud Run] Erreur lors de l'application des migrations: 
   while executing migrations: pool timed out while waiting for an open connection
```

### Causes Probables

1. **Pool trop petit** : 25 connexions pour toutes les tâches en arrière-plan
2. **Migrations SQLx en arrière-plan** : Utilisent des connexions pendant longtemps
3. **Trop de tâches simultanées** : Toutes les tâches en arrière-plan tentent d'utiliser le pool en même temps
4. **Connexions non libérées** : Certaines connexions peuvent rester ouvertes

---

## ✅ Points Positifs

1. **Service Cloud Run actif** : ✅ Ready (True)
2. **Connexion PostgreSQL initiale réussie** : ✅ "Connexion PostgreSQL établie"
3. **Health check fonctionne** : ✅ HTTP 200
4. **Serveur HTTP démarré** : ✅ Le service répond

---

## 🔧 Solutions Proposées

### Solution 1 : Augmenter la Taille du Pool (Rapide)

**Modifier** : `backend/src/main.rs` - Configuration du pool PostgreSQL

```rust
// Actuellement : max=100, min=20
// Pour Cloud Run, augmenter à :
let pool = PgPoolOptions::new()
    .max_connections(50)  // Augmenter de 25 à 50
    .min_connections(10)  // Réduire min pour Cloud Run
    .acquire_timeout(Duration::from_secs(30))
    .connect_lazy(&database_url)?;
```

**Avantages** :
- ✅ Solution rapide
- ✅ Plus de connexions disponibles
- ✅ Les migrations peuvent s'exécuter sans bloquer

**Inconvénients** :
- ⚠️ Plus de connexions = plus de ressources utilisées
- ⚠️ Cloud SQL peut avoir des limites de connexions

---

### Solution 2 : Pool Séparé pour Migrations (Recommandé)

**Créer un pool séparé** pour les migrations SQLx en arrière-plan :

```rust
// Pool principal pour l'application
let pg_pool = PgPoolOptions::new()
    .max_connections(25)
    .min_connections(5)
    .connect_lazy(&database_url)?;

// Pool séparé pour migrations (Cloud Run uniquement)
if is_cloud_run {
    let pg_for_migrations = PgPoolOptions::new()
        .max_connections(10)  // Pool dédié pour migrations
        .min_connections(2)
        .connect_lazy(&database_url)?;
    
    tokio::spawn(async move {
        sqlx::migrate!("./migrations").run(&pg_for_migrations).await
    });
}
```

**Avantages** :
- ✅ Migrations n'impactent pas le pool principal
- ✅ Application reste réactive
- ✅ Meilleure isolation

---

### Solution 3 : Réduire le Nombre de Tâches en Arrière-Plan (Cloud Run)

**Désactiver certaines tâches non critiques** pour Cloud Run :

```rust
if !is_cloud_run {
    // Tâches lourdes uniquement pour autres environnements
    tasks::search_cache_refresh::start_search_cache_refresh_task(...);
    tasks::global_promo_scheduler::start_global_promo_scheduler(...);
    // etc.
}
```

**Avantages** :
- ✅ Moins de connexions utilisées
- ✅ Service plus léger
- ✅ Moins de timeouts

---

## 📊 État Actuel

### ✅ Fonctionnel
- Service Cloud Run : **ACTIF**
- Health check : **OK (HTTP 200)**
- Connexion PostgreSQL initiale : **RÉUSSIE**

### ⚠️ Problèmes
- Pool PostgreSQL : **SATURÉ (100%)**
- Migrations SQLx : **ÉCHOUENT** (timeout pool)
- Tâches en arrière-plan : **ÉCHOUENT** (timeout pool)
- Redis : **NON CONNECTÉ** (attendu, non critique)

---

## 🎯 Recommandation Immédiate

**Solution rapide** : Augmenter la taille du pool à 50 connexions pour Cloud Run.

**Solution à long terme** : Créer un pool séparé pour les migrations.

---

## 📝 Prochaines Actions

1. ✅ Vérifier que le service répond (déjà fait - OK)
2. ⚠️ Corriger le pool saturé (à faire)
3. ⏳ Vérifier que les migrations se terminent (après correction)

---

**Note** : Le service fonctionne mais les migrations et certaines tâches échouent à cause du pool saturé. C'est un problème de configuration, pas un problème critique de démarrage.



