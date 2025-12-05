# PROMPT : Continuation Correction Erreurs Compilation Rust + Tests Redis

## Contexte du projet
- **Backend**: Rust avec Axum, SQLx, PostgreSQL, pgvector
- **Base de données**: PostgreSQL avec extensions pgvector et imgsmlr
- **Cache**: Redis (redis::Client et deadpool_redis::Pool)
- **État actuel**: 280 erreurs de compilation restantes

## État des corrections effectuées

### ✅ Corrections déjà faites
1. **Modules manquants** (E0432/E0433) : Ajout de `pub mod notification_queue;` dans `services/mod.rs`
2. **Redis avec deadpool_redis** : Remplacement de `AsyncCommands` par `redis_helper::get_with_retry`, `set_with_retry`, `del_with_retry` dans `specialized_services_controller.rs`
3. **PgRow.get manquant** : Ajout de `use sqlx::{PgPool, Row};` dans :
   - `specialized_reservation_service.rs`
   - `statistiques_emploi_service.rs`
   - `specialized_rating_service.rs`
   - `publicite_ab_testing_routes.rs`
   - `publicite_auto_optimization_routes.rs`
   - `publicite_geographic_service.rs`
   - `publicite_pixel_service.rs`
   - `publicite_reporting_service.rs`
4. **redis::Client vs Option<redis::Client]** : Correction dans `offres_emploi_controller.rs` - tous les services attendent `Option<redis::Client>`, donc utiliser `Some(state.redis_client.clone())`
5. **usize vs i32** : Correction dans `bus_return_trip_controller.rs` - `(idx + 1) as i32` pour `seat_number`
6. **PgRow sérialisation** : Correction dans `troc_livres_controller.rs` - utilisation de `query_as::<_, LivreScolaire>` au lieu de `query`
7. **u8 non supporté par sqlx** : Correction dans `publicite_audiences_routes.rs` - remplacement de `Option<u8>` par `Option<i16>` pour `similarity`
8. **chat_reactions dupliqué** : Suppression de la ligne dupliquée dans `lib.rs` ligne 350
9. **invalidate_user_statistics** : Suppression de l'appel redondant dans `specialized_services_optimizer.rs`
10. **try_get pour Value** : Correction dans `product_validation_service.rs` - utilisation de `try_get` au lieu de `get` pour `Value`

## Erreurs restantes à corriger (280 erreurs)

### Distribution des erreurs
- **E0308** (61 erreurs) : Types incompatibles
- **E0599** (55 + 40 + 13 = 108 erreurs) : Méthodes/fonctions manquantes
- **E0277** (15 + 5 = 20 erreurs) : Trait bounds non satisfaits
- **E0596** (7 erreurs) : Cannot borrow
- **E0107** (5 erreurs) : Méthode prend mauvais nombre d'arguments
- **E0382** (4 erreurs) : Utilisation de valeurs déplacées
- **E0593** (4 erreurs) : Closure prend mauvais nombre d'arguments
- **Autres** : ~65 erreurs diverses

### Fichiers avec erreurs identifiées

#### E0308 - Types incompatibles
- `bus_return_trip_controller.rs:87` : `?` operator incompatible types
- `orientation_scolaire_controller.rs` : Plusieurs erreurs (lignes 43, 64, 97, 123, 144, 166, 187, 220, 256)
  - Problème probable : `OrientationScolaireService::new(state.pg.clone(), state.clone())` - vérifier si le service attend `Arc<AppState>` ou autre chose

#### E0599 - Méthodes manquantes
- `captions_service.rs:95` : `no method named 'encode' found for struct 'GeneralPurpose'`
- Plusieurs fichiers avec `PgRow.get` manquant (vérifier tous les fichiers qui utilisent `row.get()`)

#### E0277 - Trait bounds
- `video_upload_controller.rs:94` : `?` couldn't convert the error to `http::StatusCode`
- `publicite_audiences_routes.rs` : Déjà corrigé (u8 → i16)
- Autres fichiers à identifier

#### E0382 - Use of moved value
- `lib.rs:350` : `use of moved value: chat_reactions` - déjà corrigé mais vérifier s'il reste des problèmes

## Tâches à effectuer

### 1. Correction des erreurs de compilation

#### Priorité 1 : E0308 (Types incompatibles)
```bash
# Identifier toutes les erreurs E0308
cargo build 2>&1 | Select-String -Pattern "error\[E0308\]" -Context 2,2

# Fichiers à corriger en priorité :
- bus_return_trip_controller.rs:87
- orientation_scolaire_controller.rs (toutes les occurrences)
```

**Actions pour orientation_scolaire_controller.rs** :
- Vérifier la signature de `OrientationScolaireService::new()`
- Si le service attend `Arc<PgPool>` et `Arc<AppState>`, utiliser `Arc::new(state.pg.clone())` et `state.clone()`
- Si le service attend `PgPool` et `Arc<AppState>`, utiliser `state.pg.clone()` et `state.clone()`

#### Priorité 2 : E0599 (Méthodes manquantes)
```bash
# Identifier toutes les erreurs E0599
cargo build 2>&1 | Select-String -Pattern "error\[E0599\]" -Context 1,1

# Fichiers à corriger :
- captions_service.rs:95 (GeneralPurpose::encode)
- Tous les fichiers avec PgRow.get manquant
```

**Actions** :
- Pour `captions_service.rs` : Vérifier l'API de `base64::engine::GeneralPurpose` - peut-être utiliser `encode()` sur le résultat de `general_purpose()` ou une autre méthode
- Pour `PgRow.get` : Ajouter `use sqlx::Row;` dans tous les fichiers concernés

#### Priorité 3 : E0277 (Trait bounds)
```bash
# Identifier toutes les erreurs E0277
cargo build 2>&1 | Select-String -Pattern "error\[E0277\]" -Context 1,1

# Fichiers à corriger :
- video_upload_controller.rs:94
```

**Actions** :
- Pour `video_upload_controller.rs:94` : Vérifier le type d'erreur retourné et ajouter un `map_err` pour convertir en `StatusCode` ou `AppError`

#### Priorité 4 : Autres erreurs
- E0596 (Cannot borrow) : Identifier les emprunts multiples
- E0107 (Mauvais nombre d'arguments) : Vérifier les signatures de méthodes
- E0382 (Use of moved value) : Cloner ou référencer au lieu de déplacer
- E0593 (Closure arguments) : Vérifier les signatures de closures

### 2. Intégration des tests Redis

#### Structure des tests à créer

**Fichier** : `backend/tests/redis_tests.rs`

```rust
#[cfg(test)]
mod redis_tests {
    use super::*;
    use crate::services::redis_helper;
    use redis::Client;
    use std::time::Duration;
    use tokio::time::sleep;

    // Test de base : GET/SET
    #[tokio::test]
    async fn test_redis_get_set() {
        // TODO: Initialiser connexion Redis de test
        // TODO: Tester get_with_retry et set_with_retry
    }

    // Test de retry en cas d'échec
    #[tokio::test]
    async fn test_redis_retry_mechanism() {
        // TODO: Tester le mécanisme de retry
    }

    // Test avec deadpool_redis::Pool
    #[tokio::test]
    async fn test_redis_pool() {
        // TODO: Tester avec deadpool_redis::Pool
    }

    // Test de cache spécialisé
    #[tokio::test]
    async fn test_specialized_services_cache() {
        // TODO: Tester SpecializedServicesCache
    }
}
```

#### Tests à implémenter

1. **Tests unitaires pour redis_helper** :
   - `get_with_retry` : Test récupération valeur
   - `set_with_retry` : Test stockage valeur avec TTL
   - `del_with_retry` : Test suppression
   - `execute_with_retry` : Test exécution commande générique

2. **Tests d'intégration pour SpecializedServicesCache** :
   - Test `get_services_list` avec cache hit
   - Test `get_services_list` avec cache miss
   - Test `set_services_list` avec TTL
   - Test `invalidate_user_cache`

3. **Tests de performance** :
   - Test de charge avec multiples requêtes simultanées
   - Test de timeout et retry

#### Configuration des tests

**Fichier** : `backend/tests/common/mod.rs`

```rust
pub mod redis_test_utils {
    use redis::Client;
    use std::env;

    pub fn get_test_redis_client() -> Option<Client> {
        let redis_url = env::var("REDIS_URL")
            .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
        Client::open(redis_url).ok()
    }

    pub async fn cleanup_test_keys(client: &Client, pattern: &str) {
        // Nettoyer les clés de test après chaque test
    }
}
```

#### Commandes pour exécuter les tests

```bash
# Tous les tests
cargo test

# Tests Redis uniquement
cargo test redis_tests

# Tests avec output détaillé
cargo test -- --nocapture

# Tests d'intégration
cargo test --test integration_tests
```

### 3. Vérifications finales

#### Checklist de validation
- [ ] `cargo build` compile sans erreurs
- [ ] `cargo test` passe tous les tests
- [ ] `cargo clippy` sans warnings critiques
- [ ] `cargo fmt` appliqué sur tous les fichiers
- [ ] Tests Redis fonctionnent avec Redis local
- [ ] Documentation mise à jour si nécessaire

#### Commandes de vérification

```bash
# Compilation
cargo build

# Tests
cargo test

# Linting
cargo clippy -- -D warnings

# Formatage
cargo fmt --check

# Vérification des erreurs restantes
cargo build 2>&1 | Select-String -Pattern "error\[E" | Measure-Object -Line
cargo build 2>&1 | Select-String -Pattern "error\[E" | Group-Object | Select-Object Count, Name | Sort-Object Count -Descending
```

## Fichiers modifiés récemment (à vérifier)

- `backend/src/services/specialized_services_cache.rs`
- `backend/src/services/specialized_services_optimizer.rs`
- `backend/src/controllers/offres_emploi_controller.rs`
- `backend/src/controllers/bus_return_trip_controller.rs`
- `backend/src/controllers/troc_livres_controller.rs`
- `backend/src/routes/publicite_audiences_routes.rs`
- `backend/src/lib.rs`
- `backend/src/services/product_validation_service.rs`
- Tous les fichiers avec `use sqlx::{PgPool, Row};` ajouté

## Notes importantes

1. **Redis** : Le projet utilise à la fois `redis::Client` et `deadpool_redis::Pool`. Utiliser `redis_helper` pour les opérations avec retry.

2. **SQLx** : Toujours importer `Row` quand on utilise `row.get()` ou `row.try_get()`.

3. **Types PostgreSQL** : `u8` n'est pas supporté par sqlx. Utiliser `i16` ou `i32` à la place.

4. **AppState** : `state.redis_client` est de type `redis::Client`, mais la plupart des services attendent `Option<redis::Client>`. Utiliser `Some(state.redis_client.clone())`.

5. **Tests Redis** : Configurer une instance Redis locale pour les tests (Docker recommandé : `docker run -d -p 6379:6379 redis:alpine`).

## Commandes utiles

```bash
# Compilation avec erreurs détaillées
cargo build 2>&1 | Select-String -Pattern "error\[E" | Group-Object | Select-Object Count, Name | Sort-Object Count -Descending

# Recherche d'erreurs dans un fichier spécifique
cargo build 2>&1 | Select-String -Pattern "error\[E.*fichier.rs" -Context 2,2

# Compter les erreurs restantes
cargo build 2>&1 | Select-String -Pattern "error\[E" | Measure-Object -Line

# Lister les fichiers avec erreurs
cargo build 2>&1 | Select-String -Pattern "error\[E" | ForEach-Object { $_ -match 'src\\([^:]+):' | Out-Null; $matches[1] } | Sort-Object -Unique
```

## Objectif final

- ✅ 0 erreur de compilation
- ✅ Tous les tests passent (y compris tests Redis)
- ✅ Code formaté et linté
- ✅ Documentation à jour

**Continuer la correction des erreurs en suivant les priorités ci-dessus, puis intégrer les tests Redis une fois la compilation réussie.**

