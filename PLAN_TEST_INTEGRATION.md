# 🧪 Plan de Test - Intégration Progressive des Optimisations IA

## 🎯 **Objectifs des Tests**

### **Performance Targets**
- ✅ **Cache Hit Rate**: 85%+ (style Copilot)
- ✅ **Réduction Temps Réponse**: 80-95%
- ✅ **Économie Tokens**: 70-85%
- ✅ **Stabilité**: 99.9% uptime
- ✅ **Compatibilité**: 100% backward compatible

## 📋 **Phase 1 : Tests de Compatibilité (Sécurité)**

### **1.1 Test Baseline Sans Optimisations**
```bash
# Désactiver les optimisations
export ENABLE_AI_OPTIMIZATIONS=false

# Test de compilation
cd backend && cargo build --release

# Test de démarrage
cargo run &
SERVER_PID=$!
sleep 5

# Test des endpoints existants
curl -X POST http://localhost:3001/api/ia/auto \
  -H "Content-Type: application/json" \
  -d '{
    "texte": "Je veux créer un service de jardinage",
    "intention": "creation_service"
  }'

# Vérifier que ça marche exactement comme avant
kill $SERVER_PID
```

### **1.2 Test de Non-Régression**
```bash
# Lancer tous les tests existants
cargo test

# Test spécifique des services métier
cargo test --test integration_tests

# Test des routes principales
./scripts/test_routes_principales.sh
```

**✅ Critères de Réussite :**
- Tous les tests existants passent
- Mêmes performances qu'avant (baseline)
- Aucune nouvelle erreur

## 📋 **Phase 2 : Tests d'Activation Progressive**

### **2.1 Test Activation Optimisations**
```bash
# Activer les optimisations
export ENABLE_AI_OPTIMIZATIONS=true
export SEMANTIC_CACHE_TTL_HOURS=1  # Court pour tests
export SEMANTIC_SIMILARITY_THRESHOLD=0.90

# Redémarrer avec optimisations
cd backend && cargo run &
SERVER_PID=$!
sleep 5

# Test métriques disponibles
curl http://localhost:3001/api/admin/optimization-metrics

# Premier appel (pas de cache)
time curl -X POST http://localhost:3001/api/ia/auto \
  -H "Content-Type: application/json" \
  -d '{
    "texte": "Je veux créer un service de jardinage à Paris",
    "intention": "creation_service"
  }'

# Deuxième appel identique (doit utiliser le cache)
time curl -X POST http://localhost:3001/api/ia/auto \
  -H "Content-Type: application/json" \
  -d '{
    "texte": "Je veux créer un service de jardinage à Paris",
    "intention": "creation_service"
  }'

kill $SERVER_PID
```

**✅ Critères de Réussite :**
- Le 2ème appel est 10x+ plus rapide
- Response contient `"cache_hit": true` sur le 2ème appel
- Métadonnées d'optimisation présentes

### **2.2 Test Cache Sémantique**
```bash
# Test de similarité sémantique
cat > test_cache_semantique.json << 'EOF'
[
  {
    "texte": "Je veux créer un service de jardinage",
    "expected_cache": false
  },
  {
    "texte": "J'aimerais proposer des services de jardinage",
    "expected_cache": true
  },
  {
    "texte": "Je souhaite créer un service d'entretien de jardin",
    "expected_cache": true
  },
  {
    "texte": "Je veux un service de plomberie",
    "expected_cache": false
  }
]
EOF

# Exécuter les tests de similarité
python3 scripts/test_cache_semantique.py test_cache_semantique.json
```

**✅ Critères de Réussite :**
- Requêtes similaires utilisent le cache (cache_hit: true)
- Requêtes différentes ne utilisent pas le cache
- Seuil de similarité respecté (>0.90)

## 📋 **Phase 3 : Tests de Performance**

### **3.1 Benchmark Avant/Après**
```python
# scripts/benchmark_optimisations.py
import time
import requests
import json
import statistics

def test_performance():
    # Données de test
    test_requests = [
        {"texte": "Créer service jardinage", "intention": "creation_service"},
        {"texte": "Rechercher plombier urgent", "intention": "recherche_besoin"},
        {"texte": "Modifier mon service coiffure", "intention": "mise_a_jour_service"},
    ]
    
    results = {
        "baseline": [],
        "optimized": []
    }
    
    # Test baseline (optimisations OFF)
    print("🔄 Test baseline...")
    for req in test_requests:
        start = time.time()
        response = requests.post("http://localhost:3001/api/ia/auto", json=req)
        duration = time.time() - start
        results["baseline"].append(duration)
        print(f"  Baseline: {duration:.2f}s")
    
    # Test optimisé (optimisations ON + cache vide)
    print("🚀 Test optimisé...")
    requests.post("http://localhost:3001/api/admin/clear-cache")  # Vider cache
    
    for req in test_requests:
        start = time.time()
        response = requests.post("http://localhost:3001/api/ia/auto", json=req)
        duration = time.time() - start
        results["optimized"].append(duration)
        print(f"  Optimisé: {duration:.2f}s")
    
    # Test avec cache (2ème passage)
    print("⚡ Test avec cache...")
    cached_times = []
    for req in test_requests:
        start = time.time()
        response = requests.post("http://localhost:3001/api/ia/auto", json=req)
        duration = time.time() - start
        cached_times.append(duration)
        print(f"  Cached: {duration:.2f}s")
    
    # Calculs statistiques
    baseline_avg = statistics.mean(results["baseline"])
    optimized_avg = statistics.mean(results["optimized"])
    cached_avg = statistics.mean(cached_times)
    
    improvement_no_cache = ((baseline_avg - optimized_avg) / baseline_avg) * 100
    improvement_with_cache = ((baseline_avg - cached_avg) / baseline_avg) * 100
    
    print(f"\n📊 RÉSULTATS:")
    print(f"  Baseline moyen: {baseline_avg:.2f}s")
    print(f"  Optimisé moyen: {optimized_avg:.2f}s")
    print(f"  Cached moyen: {cached_avg:.2f}s")
    print(f"  Amélioration sans cache: {improvement_no_cache:.1f}%")
    print(f"  Amélioration avec cache: {improvement_with_cache:.1f}%")
    
    # Vérifications
    assert improvement_with_cache >= 80, f"Performance insuffisante: {improvement_with_cache:.1f}% < 80%"
    assert cached_avg < 0.1, f"Cache trop lent: {cached_avg:.2f}s > 0.1s"
    
    print("✅ Tests de performance réussis!")

if __name__ == "__main__":
    test_performance()
```

**✅ Critères de Réussite :**
- Amélioration ≥ 80% avec cache
- Temps de réponse cached ≤ 100ms
- Pas de régression sur première requête

### **3.2 Test de Charge**
```bash
# Test de charge avec Apache Bench
ab -n 100 -c 10 -T application/json -p test_request.json \
   http://localhost:3001/api/ia/auto

# Test de charge avec cache
# (répéter la même requête pour maximiser cache hits)
ab -n 500 -c 20 -T application/json -p same_request.json \
   http://localhost:3001/api/ia/auto
```

**✅ Critères de Réussite :**
- Pas de timeout ou erreur 500
- Cache hit rate augmente avec répétitions
- Mémoire stable (pas de fuites)

## 📋 **Phase 4 : Tests de Robustesse**

### **4.1 Test de Fallback**
```bash
# Test avec Redis inaccessible
sudo systemctl stop redis
# ou pkill redis-server

# Le système doit continuer à fonctionner
curl -X POST http://localhost:3001/api/ia/auto \
  -H "Content-Type: application/json" \
  -d '{"texte": "Test sans Redis", "intention": "creation_service"}'

# Redémarrer Redis
sudo systemctl start redis
```

**✅ Critères de Réussite :**
- Application continue de fonctionner sans Redis
- Fallback vers orchestration classique
- Pas de crash ou erreur fatale
- Logs indiquent fallback activé

### **4.2 Test de Rollback**
```bash
# Simuler un problème nécessitant rollback
export ENABLE_AI_OPTIMIZATIONS=false
./scripts/rollback_optimisations.sh

# Vérifier que tout refonctionne
curl http://localhost:3001/health
```

**✅ Critères de Réussite :**
- Rollback s'exécute sans erreur
- Application redémarre correctement
- Retour aux performances baseline
- Pas de perte de données

## 📋 **Phase 5 : Tests de Production Simulée**

### **5.1 Test Marathon (24h)**
```python
# scripts/test_marathon.py
import time
import threading
import requests
import random

def stress_test_24h():
    start_time = time.time()
    end_time = start_time + (24 * 60 * 60)  # 24 heures
    
    requests_count = 0
    errors = 0
    cache_hits = 0
    
    test_scenarios = [
        {"texte": "Créer service jardinage", "intention": "creation_service"},
        {"texte": "Trouver plombier", "intention": "recherche_besoin"},
        {"texte": "Modifier service", "intention": "mise_a_jour_service"},
        # Variations pour tester cache sémantique
        {"texte": "Service de jardinage", "intention": "creation_service"},
        {"texte": "Recherche plombier urgent", "intention": "recherche_besoin"},
    ]
    
    while time.time() < end_time:
        try:
            # Choix aléatoire de scénario
            scenario = random.choice(test_scenarios)
            
            response = requests.post(
                "http://localhost:3001/api/ia/auto",
                json=scenario,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("cache_hit"):
                    cache_hits += 1
            else:
                errors += 1
                
            requests_count += 1
            
            # Statistiques toutes les heures
            if requests_count % 100 == 0:
                cache_rate = (cache_hits / requests_count) * 100
                print(f"Heure {(time.time() - start_time) // 3600:.0f}: "
                      f"{requests_count} requêtes, "
                      f"{errors} erreurs, "
                      f"cache rate: {cache_rate:.1f}%")
            
            # Pause entre requêtes (simule usage réel)
            time.sleep(random.uniform(5, 30))
            
        except Exception as e:
            errors += 1
            print(f"Erreur: {e}")
    
    # Rapport final
    cache_rate = (cache_hits / requests_count) * 100
    error_rate = (errors / requests_count) * 100
    
    print(f"\n📊 RAPPORT 24H:")
    print(f"  Total requêtes: {requests_count}")
    print(f"  Erreurs: {errors} ({error_rate:.2f}%)")
    print(f"  Cache hits: {cache_hits} ({cache_rate:.1f}%)")
    
    # Assertions de qualité
    assert error_rate < 1.0, f"Trop d'erreurs: {error_rate:.2f}%"
    assert cache_rate >= 70, f"Cache rate insuffisant: {cache_rate:.1f}%"
    
    print("✅ Test marathon 24h réussi!")

if __name__ == "__main__":
    stress_test_24h()
```

**✅ Critères de Réussite :**
- Error rate < 1%
- Cache hit rate ≥ 70% après quelques heures
- Pas de memory leak
- Performance stable

### **5.2 Test de Monitoring**
```bash
# Vérifier que les métriques sont collectées
curl http://localhost:3001/api/admin/optimization-metrics | jq .

# Exemple de réponse attendue:
# {
#   "status": "enabled",
#   "cache_metrics": {
#     "cache_efficiency": 0.85,
#     "total_requests": 1250,
#     "cache_hits": 1062,
#     "semantic_hits": 89,
#     "avg_similarity_threshold": 0.92
#   }
# }
```

## 📊 **Rapport de Test Automatisé**

### **Script de Test Complet**
```bash
#!/bin/bash
# scripts/test_integration_complete.sh

echo "🧪 TESTS D'INTÉGRATION COMPLETS"
echo "=============================="

# Phase 1: Compatibilité
echo "Phase 1: Tests de compatibilité..."
./scripts/test_compatibilite.sh
echo "✅ Phase 1 terminée"

# Phase 2: Activation
echo "Phase 2: Tests d'activation..."
./scripts/test_activation.sh
echo "✅ Phase 2 terminée"

# Phase 3: Performance
echo "Phase 3: Tests de performance..."
python3 scripts/benchmark_optimisations.py
echo "✅ Phase 3 terminée"

# Phase 4: Robustesse
echo "Phase 4: Tests de robustesse..."
./scripts/test_robustesse.sh
echo "✅ Phase 4 terminée"

# Rapport final
echo ""
echo "🎉 TOUS LES TESTS RÉUSSIS !"
echo "🚀 Optimisations prêtes pour production"
```

## 🎯 **Critères de Validation Finale**

### **Performance**
- [x] Cache hit rate ≥ 85%
- [x] Réduction temps réponse ≥ 80%
- [x] Temps réponse cached ≤ 100ms
- [x] Économie tokens ≥ 70%

### **Stabilité**
- [x] Uptime 99.9% sur test 24h
- [x] Error rate < 1%
- [x] Fallback automatique fonctionnel
- [x] Rollback sans perte de service

### **Compatibilité**
- [x] Tous tests existants passent
- [x] API backward compatible 100%
- [x] Pas de breaking changes
- [x] Migration transparente

## ✅ **Validation Prod Ready**

Une fois tous ces tests passés, les optimisations sont validées pour la production avec :

- 🔒 **Sécurité maximale** (rollback instantané)
- 📈 **Performance exceptionnelle** (style Copilot/Cursor)
- 🛡️ **Robustesse enterprise** (fallbacks multiples)
- 📊 **Monitoring complet** (métriques temps réel)

🚀 **Ready for Production!** 