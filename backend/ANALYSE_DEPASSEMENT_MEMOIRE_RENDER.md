# 🚨 ANALYSE DU DÉPASSEMENT MÉMOIRE - RENDER

**Date**: 29 Novembre 2025  
**Service**: yukpomnang (Web Service sur Render)  
**Problème**: Dépassement de la limite mémoire → Redémarrage automatique

---

## 📧 RÉSUMÉ DE L'EMAIL RENDER

Render a détecté que votre service web **yukpomnang** a dépassé sa limite mémoire, ce qui a déclenché un redémarrage automatique. Pendant le redémarrage, l'instance était temporairement indisponible.

### Causes possibles identifiées par Render :
1. **Fuite mémoire (memory leak)** dans l'application
2. **Pic de trafic** (spike de requêtes)
3. **Type d'instance sous-dimensionné** pour votre cas d'usage

### Actions recommandées par Render :
- Vérifier les logs et métriques du service
- Corriger les fuites mémoire si détectées
- Mettre à l'échelle le service en cas de pic de trafic
- Upgrader le type d'instance pour plus de mémoire

---

## 🔍 ANALYSE TECHNIQUE DU CODE

### ⚠️ **PROBLÈMES CRITIQUES IDENTIFIÉS**

#### 1. **CACHES EN MÉMOIRE SANS LIMITE STRICTE**

**Fichier**: `backend/src/services/semantic_cache_pro.rs`

```78:89:backend/src/services/semantic_cache_pro.rs
    pub max_memory_entries: usize,      // 10000 entrées en mémoire
    pub ttl_hours: u64,                 // 24h par défaut
    pub precompute_enabled: bool,       // true pour prédictions
    pub quality_learning_enabled: bool, // true pour apprentissage
    pub embedding_dimensions: usize,    // 768 pour OpenAI embeddings
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            semantic_threshold: 0.92,
            max_memory_entries: 10000,
```

**Problèmes** :
- **10 000 entrées** en mémoire par défaut (peut monter à **50 000** dans certains cas)
- Chaque entrée contient des **embeddings de 768 dimensions** (données volumineuses)
- Pas de limite sur la **taille totale** des données, seulement le nombre d'entrées
- Les embeddings sont stockés dans `query_embeddings` **en plus** du cache principal

**Impact mémoire** :
- 10 000 entrées × 768 dimensions × 4 bytes (f32) = **~30 MB** pour les embeddings
- + Données de cache (réponses, métadonnées) = **~50-100 MB minimum**
- En cas de pic : jusqu'à **500 MB** pour 50 000 entrées

---

#### 2. **SEMAPHORE TROP ÉLEVÉ POUR REQUÊTES SIMULTANÉES**

**Fichier**: `backend/src/services/massive_load_handler.rs`

```72:72:backend/src/services/massive_load_handler.rs
        let request_semaphore = Arc::new(Semaphore::new(10000)); // 10k requêtes simultanées
```

**Problèmes** :
- **10 000 requêtes simultanées** autorisées
- Chaque requête peut charger des données en mémoire
- Pas de limite sur la taille des données par requête
- Le cache `request_cache` peut grandir indéfiniment

**Impact mémoire** :
- 10 000 requêtes × ~1 MB de données = **10 GB potentiels** (théorique)
- En pratique : **500 MB - 2 GB** selon le trafic

---

#### 3. **LOGS MOBILES TRÈS VERBEUX**

**Observation dans les logs** :
- Les logs mobiles sont **très fréquents** (toutes les 5-10 secondes)
- Chaque log contient des **métadonnées JSON volumineuses**
- Les logs sont stockés en mémoire avant traitement par batch

**Exemple de log** (ligne 600-620 du fichier logbackend3.md) :
- Logs répétitifs avec des données JSON complètes
- Headers d'autorisation complets (tokens JWT)
- Métadonnées de scroll, positions, etc.

**Impact mémoire** :
- ~100 logs/minute × 2 KB/log = **200 KB/minute**
- Sur 1 heure : **~12 MB** (acceptable mais s'accumule)
- Si le traitement batch est lent : **accumulation en mémoire**

---

#### 4. **CONFIGURATION DE CACHE MULTIPLE**

**Fichier**: `backend/src/config/optimization.rs`

```127:128:backend/src/config/optimization.rs
            max_memory_size: 100 * 1024 * 1024, // 100MB
            max_entries: 10000,
```

**Problèmes** :
- Limite de **100 MB** pour le cache, mais **10 000 entrées**
- Si chaque entrée fait 50 KB → **500 MB** (5× la limite)
- La limite de taille n'est peut-être pas respectée partout

---

## 🎯 CAUSES PROBABLES DU DÉPASSEMENT

### **Cause #1 : Accumulation des caches en mémoire (70% de probabilité)**

**Scénario** :
1. L'application démarre avec des caches vides
2. Les requêtes remplissent les caches (`SemanticCachePro`, `MassiveLoadHandler`)
3. Les caches atteignent leurs limites (10k entrées)
4. L'éviction LRU fonctionne, mais les **embeddings ne sont pas nettoyés**
5. Après plusieurs heures : **500 MB - 1 GB** de caches
6. + Logs mobiles : **+50-100 MB**
7. + Données de requêtes en cours : **+200-500 MB**
8. **Total : 1-2 GB** → Dépassement de la limite Render

**Preuve** :
- Le code montre que `query_embeddings` est rempli mais jamais nettoyé explicitement
- L'éviction LRU ne nettoie que `memory_cache`, pas `query_embeddings`

---

### **Cause #2 : Pic de trafic (20% de probabilité)**

**Scénario** :
- Pic de trafic mobile (logs + requêtes API)
- 10 000 requêtes simultanées autorisées
- Chaque requête charge des données
- Mémoire saturée rapidement

**Preuve** :
- Les logs montrent beaucoup de requêtes mobiles
- Le semaphore de 10k est très élevé pour un service Render standard

---

### **Cause #3 : Instance sous-dimensionnée (10% de probabilité)**

**Scénario** :
- L'instance Render a une limite mémoire faible (512 MB - 1 GB)
- L'application nécessite naturellement plus de mémoire
- Même sans fuite, la limite est dépassée

---

## ✅ SOLUTIONS RECOMMANDÉES

### **Solution 1 : Limiter et nettoyer les caches (PRIORITÉ HAUTE)**

#### A. Réduire les limites de cache

```rust
// Dans semantic_cache_pro.rs
max_memory_entries: 5000,  // Au lieu de 10000
```

#### B. Nettoyer les embeddings lors de l'éviction

```rust
// Lors de l'éviction LRU, nettoyer aussi query_embeddings
async fn evict_lru_entries(&self, cache: &mut HashMap<String, SmartCachedResponse>) {
    // Éviction LRU du cache
    // ...
    
    // Nettoyer aussi les embeddings correspondants
    let mut embeddings = self.query_embeddings.write().await;
    for key in keys_to_remove {
        embeddings.remove(&key);
    }
}
```

#### C. Ajouter une limite de taille totale (pas seulement nombre d'entrées)

```rust
// Vérifier la taille totale avant d'ajouter
let estimated_size = cache.len() * AVERAGE_ENTRY_SIZE;
if estimated_size > MAX_CACHE_SIZE {
    self.evict_lru_entries(&mut cache).await;
}
```

---

### **Solution 2 : Réduire le semaphore de requêtes simultanées**

```rust
// Dans massive_load_handler.rs
let request_semaphore = Arc::new(Semaphore::new(1000)); // 1k au lieu de 10k
```

**Justification** :
- 1000 requêtes simultanées est déjà très élevé
- Render n'a probablement pas assez de ressources pour 10k
- Réduire réduit la charge mémoire

---

### **Solution 3 : Optimiser les logs mobiles**

#### A. Réduire la verbosité des logs

```rust
// Dans mobile_logs_controller.rs
// Ne logger que les erreurs et warnings, pas tous les diagnostics
if log_level == "error" || log_level == "warn" {
    // Logger
} else {
    // Ignorer les logs de diagnostic en production
}
```

#### B. Traiter les logs par batch plus fréquemment

```rust
// Réduire le délai de batch de 10 logs à 5 logs
// Ou réduire le timeout de batch
```

---

### **Solution 4 : Ajouter un monitoring mémoire**

```rust
// Ajouter un endpoint de monitoring
pub async fn memory_stats() -> Json<MemoryStats> {
    let cache_size = memory_cache.read().await.len();
    let embeddings_size = query_embeddings.read().await.len();
    
    Json(MemoryStats {
        cache_entries: cache_size,
        embeddings_count: embeddings_size,
        estimated_memory_mb: (cache_size * 50 + embeddings_size * 30) / 1024 / 1024,
    })
}
```

---

### **Solution 5 : Configurer des variables d'environnement**

Ajouter dans Render Dashboard :

```env
# Limites de cache
CACHE_MAX_ENTRIES=5000
CACHE_MAX_MEMORY_SIZE=52428800  # 50 MB au lieu de 100 MB

# Limites de requêtes
MAX_CONCURRENT_REQUESTS=1000

# Logs
MOBILE_LOGS_VERBOSE=false
MOBILE_LOGS_BATCH_SIZE=5
```

---

## 🚀 PLAN D'ACTION IMMÉDIAT

### **Étape 1 : Corrections urgentes (Aujourd'hui)**

1. ✅ Réduire `max_memory_entries` de 10000 à 5000
2. ✅ Réduire le semaphore de 10000 à 1000
3. ✅ Ajouter le nettoyage des embeddings lors de l'éviction
4. ✅ Réduire la verbosité des logs mobiles

### **Étape 2 : Monitoring (Cette semaine)**

1. ✅ Ajouter un endpoint de monitoring mémoire
2. ✅ Configurer des alertes Render sur l'utilisation mémoire
3. ✅ Analyser les logs pour identifier les pics

### **Étape 3 : Optimisations long terme (Semaine prochaine)**

1. ✅ Implémenter une limite de taille totale pour les caches
2. ✅ Migrer les caches vers Redis (au lieu de mémoire)
3. ✅ Optimiser les requêtes SQL pour réduire la charge

---

## 📊 MÉTRIQUES À SURVEILLER

- **Utilisation mémoire** : < 80% de la limite Render
- **Taille des caches** : < 100 MB total
- **Nombre de requêtes simultanées** : < 500 en moyenne
- **Fréquence des redémarrages** : 0 par jour

---

## 🔗 RESSOURCES

- [Documentation Render - Memory Limits](https://render.com/docs)
- [Rust Memory Management Best Practices](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html)
- Logs du service : `backend/logbackend3.md`

---

**Prochaine étape** : Implémenter les corrections de l'Étape 1 pour éviter les redémarrages futurs.

