# 🧪 Tests Covoiturage - Guide Complet

## 📋 Vue d'ensemble

Ce dossier contient les tests pour le module covoiturage :
- **Tests unitaires** : `covoiturage_endpoints_test.rs`
- **Tests de charge** : `covoiturage_load_tests.rs`

## 🚀 Configuration

### Variables d'environnement

Créer un fichier `.env.test` ou définir :

```bash
# Base de données de test (séparée de la production)
TEST_DATABASE_URL=postgresql://test:test@localhost:5432/yukpomnang_test

# Redis de test (base 1 pour isolation)
TEST_REDIS_URL=redis://localhost:6379/1
```

### Prérequis

1. **PostgreSQL** : Base de données `yukpomnang_test` créée
2. **Redis** : Serveur Redis en cours d'exécution
3. **Migrations** : Tables créées (via `auto_migrate` ou manuellement)

## 🧪 Exécution des Tests

### Tests Unitaires

```bash
# Tous les tests (ignorés par défaut)
cargo test --test covoiturage_endpoints_test -- --ignored

# Test spécifique
cargo test --test covoiturage_endpoints_test test_search_covoiturages_nearby -- --ignored

# Avec output détaillé
cargo test --test covoiturage_endpoints_test -- --ignored --nocapture
```

### Tests de Charge

```bash
# Mode release (optimisé)
cargo test --test covoiturage_load_tests --release -- --ignored

# Avec output
cargo test --test covoiturage_load_tests --release -- --ignored --nocapture
```

### Script Automatique

**Linux/Mac :**
```bash
chmod +x scripts/run_load_tests.sh
./scripts/run_load_tests.sh
```

**Windows (PowerShell) :**
```powershell
.\scripts\run_load_tests.ps1
```

## 📊 Tests Disponibles

### Tests Unitaires

1. **test_search_covoiturages_nearby**
   - Recherche GPS avec lat/lng
   - Filtre rayon
   - Calcul distance Haversine
   - Performance (< 500ms)

2. **test_get_covoiturage_reviews**
   - Récupération avis
   - Note moyenne
   - Pagination

3. **test_verify_covoiturage_driver**
   - Soumission document KYC
   - Validation type document
   - Intégration service KYC
   - Mise à jour flag is_verified

4. **test_get_covoiturage_details_with_prestataire**
   - Informations prestataire enrichies
   - Note moyenne
   - Nombre trajets
   - Badge vérifié

### Tests de Charge

1. **test_load_search_performance**
   - 100 utilisateurs concurrents
   - 10 requêtes par utilisateur
   - Total : 1000 requêtes
   - Vérifie : RPS >= 800, P95 < 500ms, taux succès >= 99%

2. **test_stress_reservations**
   - 20 tentatives concurrentes
   - 10 places disponibles
   - Test race condition
   - Vérifie : Exactement 10 réussies, 10 échouées

3. **test_cache_performance**
   - 1000 SET/GET Redis
   - Mesure performance cache
   - Vérifie : < 5s pour 1000 opérations

## 📈 Métriques Attendues

### Performance Recherche
- **Latence moyenne** : < 200ms
- **P95** : < 500ms
- **P99** : < 1000ms
- **RPS** : >= 800 requêtes/seconde

### Réservations Concurrentes
- **Taux de succès** : 100% (pas de race condition)
- **Intégrité données** : Places disponibles correctes

### Cache Redis
- **SET** : < 5ms par opération
- **GET** : < 2ms par opération
- **Throughput** : > 10,000 ops/s

## 🔧 Dépannage

### Erreur : "Failed to connect to test database"
- Vérifier que PostgreSQL est démarré
- Vérifier que la base `yukpomnang_test` existe
- Vérifier `TEST_DATABASE_URL`

### Erreur : "Failed to create Redis client"
- Vérifier que Redis est démarré
- Vérifier `TEST_REDIS_URL`
- Tester : `redis-cli ping`

### Tests échouent avec "Table does not exist"
- Exécuter migrations : `cargo run` (auto_migrate)
- Ou manuellement : `psql -d yukpomnang_test -f migrations/0000_create_all_tables.sql`

### Tests lents
- Utiliser `--release` pour tests de charge
- Vérifier index base de données
- Vérifier connexion Redis

## 📝 Ajout de Nouveaux Tests

### Structure d'un test

```rust
#[tokio::test]
#[ignore] // Ignorer par défaut
async fn test_ma_fonctionnalite() {
    let state = setup_test_state().await;
    let pool = &state.pg;
    
    // Setup
    cleanup_test_data(pool).await;
    let user_id = create_test_user(pool, "test@example.com").await;
    
    // Test
    // ... votre code de test ...
    
    // Assertions
    assert!(condition, "Message d'erreur");
    
    // Cleanup
    cleanup_test_data(pool).await;
}
```

### Bonnes Pratiques

1. **Isolation** : Chaque test doit être indépendant
2. **Cleanup** : Toujours nettoyer après test
3. **Données de test** : Utiliser préfixe `test_` pour emails
4. **Assertions claires** : Messages d'erreur explicites
5. **Performance** : Mesurer et vérifier latence

## 🎯 Prochaines Étapes

1. ✅ Tests unitaires implémentés
2. ✅ Tests de charge créés
3. ⏳ Tests E2E (à créer)
4. ⏳ Tests intégration CI/CD
5. ⏳ Monitoring production

