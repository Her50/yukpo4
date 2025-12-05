# 🔧 Prompt de Correction d'Erreurs Rust - Groupe 1

## 📋 Contexte
Ce prompt fait partie d'un ensemble de 3 prompts autonomes pour corriger toutes les erreurs de compilation Rust du projet Yukpomnang. **Ce prompt traite uniquement les fichiers listés ci-dessous - ne pas toucher aux autres fichiers.**

## ⚠️ Instructions Importantes
1. **Effectuer un maximum de corrections avant de compiler** - La compilation prend beaucoup de temps, donc corriger plusieurs erreurs d'un coup avant de vérifier
2. **Ne pas modifier les fichiers des autres groupes** - Ce prompt couvre uniquement les fichiers listés dans la section "Fichiers à corriger"
3. **Après toutes les corrections, tester Redis** - Voir section "Test final Redis"

## 🎯 Fichiers à Corriger (Groupe 1)

### Services Redis et Cache
- `backend/src/services/specialized_services_cache.rs`
- `backend/src/services/global_cache_service.rs`
- `backend/src/services/flash_sale_cache.rs`
- `backend/src/services/search_cache_service.rs`
- `backend/src/services/delivery_state_sharing.rs`

### Services Recherche et Matching
- `backend/src/services/rechercher_besoin.rs`
- `backend/src/services/geographic_matching_service.rs`
- `backend/src/services/autocomplete_search_service.rs`
- `backend/src/services/autocomplete_client_service.rs`
- `backend/src/services/autocomplete_history_service.rs`
- `backend/src/services/autocomplete_combinations_service.rs`

### Services Analytics et Metrics
- `backend/src/services/analytics_service.rs`
- `backend/src/services/video_analytics_service.rs`
- `backend/src/services/search_metrics.rs`

## 🔍 Types d'Erreurs à Corriger

### 1. E0308 - Mismatched Types

#### Conversions de types i64/i32
- `tokens_ia_consumed`, `tokens_cost_xaf`, `tokens_deducted` : convertir `i64` → `i32` avec `as i32`
- `processing_time_ms` : convertir `Option<i64>` → `Option<i32>` avec `.map(|v| v as i32)`

#### Conversions Arc/Pool
- `Service::new(Arc::new(state.pg.clone()))` au lieu de `Service::new(state.pg.clone())`
- `Arc::new(pool.clone())` au lieu de `Arc::clone(&pool)` quand pool n'est pas déjà un Arc

#### Conversions Option/Some
- `response_source: Some(value)` si le champ attend `Option<String>` mais reçoit `String`
- `has_more: Some(bool_value)` si le champ attend `Option<bool>` mais reçoit `bool`

#### Conversions DateTime
- `DateTime<Utc>` → `NaiveDateTime` : utiliser `.naive_utc()`
- `Option<DateTime<Utc>>` → `DateTime<Utc>` : utiliser `.unwrap_or_else(|| chrono::Utc::now())`

#### Conversions Instant/SystemTime
- `Instant::now()` → timestamp `i64` : utiliser `SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64`

#### Conversions Redis
- `ttl_seconds as u64` au lieu de `ttl_seconds as usize` pour `set_ex`
- Utiliser `AsyncCommands` avec `conn.get::<_, Option<String>>(&key).await` au lieu de `query_async`

### 2. E0277 - Trait Bounds

#### Deserialize manquant
- Ajouter `Deserialize` aux derives : `#[derive(Debug, Serialize, Deserialize, Clone)]`
- Vérifier que `use serde::{Deserialize, Serialize};` est présent

#### Opérateur ? sur valeurs non-Result
- `row.get::<Type, _>("column")?` → `row.get::<Type, _>("column")` (enlever le `?`)
- `row.get()` retourne directement la valeur, pas un `Result`

#### Opérateur ? dans async blocks
- Si l'async block retourne `HashMap` ou autre type non-Result, utiliser `.map_err()` et `.unwrap_or()` au lieu de `?`

#### Serialize trait bound
- Si `T: Serialize` est requis, ajouter la contrainte au type générique ou utiliser `serde_json::to_value` avec gestion d'erreur

### 3. E0061 - Wrong Number of Arguments
- Vérifier les signatures de fonctions et corriger le nombre d'arguments
- `query_async` prend 2 arguments (type et connection), pas 3

### 4. E0432/E0433 - Unresolved Imports
- Vérifier que les modules existent dans `backend/src/services/mod.rs`
- Ajouter les imports manquants : `use redis::AsyncCommands;`, `use sqlx::Row;`, etc.

## 📝 Exemples de Corrections

### Exemple 1 : Conversion i64 → i32
```rust
// ❌ Avant
tokens_ia_consumed: row.get::<i64, _>("tokens_ia_consumed"),

// ✅ Après
tokens_ia_consumed: row.get::<i64, _>("tokens_ia_consumed") as i32,
```

### Exemple 2 : Arc/Pool
```rust
// ❌ Avant
let service = Service::new(state.pg.clone());

// ✅ Après
let service = Service::new(Arc::new(state.pg.clone()));
```

### Exemple 3 : Deserialize manquant
```rust
// ❌ Avant
#[derive(Debug, Serialize, Clone)]
pub struct MyStruct { ... }

// ✅ Après
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MyStruct { ... }
```

### Exemple 4 : Opérateur ? sur row.get()
```rust
// ❌ Avant
let id = row.get::<i32, _>("id")?;

// ✅ Après
let id = row.get::<i32, _>("id");
```

### Exemple 5 : Redis AsyncCommands
```rust
// ❌ Avant
match redis::cmd("GET")
    .arg(&cache_key)
    .query_async::<_, Option<String>>(&mut *conn)
    .await

// ✅ Après (avec use redis::AsyncCommands;)
match conn.get::<_, Option<String>>(&cache_key).await
```

## ✅ Checklist de Progression

- [ ] Corriger toutes les erreurs E0308 dans les fichiers du groupe 1
- [ ] Corriger toutes les erreurs E0277 dans les fichiers du groupe 1
- [ ] Corriger toutes les erreurs E0061 dans les fichiers du groupe 1
- [ ] Corriger toutes les erreurs E0432/E0433 dans les fichiers du groupe 1
- [ ] Vérifier qu'il n'y a plus d'erreurs dans ces fichiers avec `cargo build --bin test_redis 2>&1 | Select-String -Pattern "error\[E" | Select-String -Pattern "specialized_services_cache|global_cache|flash_sale_cache|search_cache|delivery_state_sharing|rechercher_besoin|geographic_matching|autocomplete|analytics|video_analytics|search_metrics"`
- [ ] **Test final Redis** (voir section ci-dessous)

## 🧪 Test Final Redis

Après avoir terminé toutes les corrections, tester la connexion Redis :

```powershell
cd C:\Users\23767\yukpomnang2\backend
$env:SQLX_OFFLINE="true"
cargo build --bin test_redis
cargo run --bin test_redis
```

Le test doit se connecter à Upstash Redis et afficher un message de succès.

## 📌 Notes Importantes

- **Ne pas compiler après chaque correction** - Faire plusieurs corrections d'un coup
- **Ce prompt ne couvre QUE les fichiers listés** - Les autres fichiers sont traités dans les prompts 2 et 3
- **Si une erreur semble liée à un fichier d'un autre groupe, la noter mais ne pas la corriger ici**

