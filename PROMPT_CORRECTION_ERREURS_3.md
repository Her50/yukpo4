# 🔧 Prompt de Correction d'Erreurs Rust - Groupe 3

## 📋 Contexte
Ce prompt fait partie d'un ensemble de 3 prompts autonomes pour corriger toutes les erreurs de compilation Rust du projet Yukpomnang. **Ce prompt traite uniquement les fichiers listés ci-dessous - ne pas toucher aux autres fichiers.**

## ⚠️ Instructions Importantes
1. **Effectuer un maximum de corrections avant de compiler** - La compilation prend beaucoup de temps, donc corriger plusieurs erreurs d'un coup avant de vérifier
2. **Ne pas modifier les fichiers des autres groupes** - Ce prompt couvre uniquement les fichiers listés dans la section "Fichiers à corriger"
3. **Après toutes les corrections, tester Redis** - Voir section "Test final Redis"

## 🎯 Fichiers à Corriger (Groupe 3)

### Controllers Vidéo et Média
- `backend/src/controllers/video_ml_controller.rs`
- `backend/src/controllers/hashtag_controller.rs`
- `backend/src/controllers/duet_remix_controller.rs`
- `backend/src/controllers/media_controller.rs`
- `backend/src/controllers/publicite_controller.rs`
- `backend/src/controllers/bus_ticket_controller.rs`

### Controllers Autres
- `backend/src/controllers/pharmacy_product_controller.rs`
- `backend/src/controllers/blood_donation_matching_controller.rs`
- `backend/src/controllers/recommendation_controller.rs`
- `backend/src/controllers/async_upload_controller.rs`

### Services Vidéo et Live
- `backend/src/services/live_flash_sale_service.rs`
- `backend/src/services/async_upload_service.rs`
- `backend/src/services/video_analytics_service.rs`

### Services Autres
- `backend/src/services/native_search_service.rs`
- `backend/src/services/scheduling_search_service.rs`
- `backend/src/services/publicite_search_service.rs`
- `backend/src/services/publicite_versioning_service.rs`
- `backend/src/services/popular_products_service.rs`
- `backend/src/services/african_locations_service.rs`
- `backend/src/services/enrich_google_places.rs`
- `backend/src/services/notification_service.rs`
- `backend/src/services/db_optimizer.rs`

### Models
- `backend/src/models/global_promo_model.rs`
- `backend/src/models/live_model.rs`

### Middlewares et Utils
- `backend/src/middlewares/adaptive_rate_limit.rs`
- `backend/src/state.rs`
- `backend/src/test_utils.rs`

## 🔍 Types d'Erreurs à Corriger

### 1. E0308 - Mismatched Types

#### Conversions de types i64/i32
- `id: row.get::<i32, _>("id")` → `id: row.get::<i32, _>("id") as i64` si le champ attend `i64`
- Conversions `i64` → `i32` avec `as i32` quand nécessaire

#### Conversions Arc/Pool
- `Service::new(Arc::new(state.pg.clone()))` au lieu de `Service::new(state.pg.clone())`
- Vérifier les signatures des constructeurs

#### Conversions Option/Some
- `field.text().await.ok().and_then(|s| s.parse().ok())` au lieu de `field.text().await.and_then(...)`
- `Some(value)` si le champ attend `Option<T>` mais reçoit `T`

#### Conversions DateTime
- `DateTime<Utc>` → `NaiveDateTime` : utiliser `.naive_utc()`
- `Option<DateTime<Utc>>` → `DateTime<Utc>` : utiliser `.unwrap_or_else(|| chrono::Utc::now())`

#### Conversions Instant/SystemTime
- `Instant::now()` → timestamp `i64` : utiliser `SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64`

#### Conversions pool_cfg.max_size
- `pool_cfg.max_size = 8` au lieu de `pool_cfg.max_size = Some(8)` si le champ attend `usize`

#### Conversions cache.get()
- `cache.get().await.ok().flatten().unwrap_or(0)` au lieu de `cache.get().await.unwrap_or(0)`
- `cache.get()` retourne `AppResult<Option<T>>`, donc gérer le `Result` puis l'`Option`

#### Conversions Multipart
- `field.text().await.ok().and_then(...)` au lieu de `field.text().await.and_then(...)`
- `field.text().await` retourne `Result<String, MultipartError>`, pas `Option`

#### Conversions Iterator
- `for item in payload.items` au lieu de `for item in &payload.items` si `items` est déjà `&[T]`
- Vérifier le type de `payload.items` : si c'est `&'a [T]`, ne pas ajouter `&`

#### Conversions donor_user_id
- `*donor_user_id` au lieu de `donor_user_id` si c'est une référence `&i32` mais la fonction attend `i32`

### 2. E0277 - Trait Bounds

#### Deserialize manquant
- Ajouter `Deserialize` aux derives : `#[derive(Debug, Serialize, Deserialize, Clone)]`
- Vérifier que `use serde::{Deserialize, Serialize};` est présent

#### Opérateur ? sur valeurs non-Result
- `row.get::<Type, _>("column")?` → `row.get::<Type, _>("column")` (enlever le `?`)
- `row.get()` retourne directement la valeur, pas un `Result`

#### Opérateur ? dans async blocks
- Si l'async block retourne un type non-Result, utiliser `.map_err()` et `.unwrap_or()` au lieu de `?`

#### Serialize trait bound
- Si `T: Serialize` est requis, ajouter la contrainte au type générique

### 3. E0599 - No Method Named

#### row.get() sans type explicite
- `row.get("column")` → `row.get::<Type, _>("column")`
- Vérifier que `use sqlx::Row;` est présent

#### build_media_url_with_fallback
- `thumbnail_raw.as_ref().map(|t| build_media_url_with_fallback(state, t))` au lieu de `thumbnail_raw.map(|t| build_media_url_with_fallback(state, &t))`
- Utiliser `.as_ref()` pour convertir `Option<String>` en `Option<&str>`

### 4. E0061 - Wrong Number of Arguments
- Vérifier les signatures de fonctions et corriger le nombre d'arguments

## 📝 Exemples de Corrections

### Exemple 1 : build_media_url_with_fallback
```rust
// ❌ Avant
let thumbnail = thumbnail_raw.map(|t| build_media_url_with_fallback(&state, &t));

// ✅ Après
let thumbnail = thumbnail_raw.as_ref().map(|t| build_media_url_with_fallback(&state, t));
```

### Exemple 2 : cache.get() avec AppResult<Option<T>>
```rust
// ❌ Avant
let count: u32 = self.cache
    .get(&key)
    .await
    .unwrap_or(0);

// ✅ Après
let count: u32 = self.cache
    .get(&key)
    .await
    .ok()
    .flatten()
    .unwrap_or(0);
```

### Exemple 3 : pool_cfg.max_size
```rust
// ❌ Avant
pool_cfg.max_size = Some(8);

// ✅ Après (si le champ attend usize)
pool_cfg.max_size = 8;
```

### Exemple 4 : field.text() avec Multipart
```rust
// ❌ Avant
request_payload.service_id = field.text().await.and_then(|s| s.parse().ok());

// ✅ Après
request_payload.service_id = field.text().await.ok().and_then(|s| s.parse().ok());
```

### Exemple 5 : Iterator sur slice
```rust
// ❌ Avant
for item in &payload.items {  // si items est déjà &[T]

// ✅ Après
for item in payload.items {
```

### Exemple 6 : donor_user_id déréférencement
```rust
// ❌ Avant
send_push_notification(&state.pg, donor_user_id, ...)

// ✅ Après (si donor_user_id est &i32)
send_push_notification(&state.pg, *donor_user_id, ...)
```

## ✅ Checklist de Progression

- [ ] Corriger toutes les erreurs E0308 dans les fichiers du groupe 3
- [ ] Corriger toutes les erreurs E0277 dans les fichiers du groupe 3
- [ ] Corriger toutes les erreurs E0599 dans les fichiers du groupe 3
- [ ] Corriger toutes les erreurs E0061 dans les fichiers du groupe 3
- [ ] Vérifier qu'il n'y a plus d'erreurs dans ces fichiers avec `cargo build --bin test_redis 2>&1 | Select-String -Pattern "error\[E" | Select-String -Pattern "video_ml|hashtag|duet_remix|media_controller|publicite|bus_ticket|pharmacy_product|blood_donation|recommendation|async_upload|live_flash_sale|video_analytics|native_search|scheduling_search|publicite_search|publicite_versioning|popular_products|african_locations|enrich_google|notification|db_optimizer|global_promo|live_model|adaptive_rate_limit|state|test_utils"`
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
- **Ce prompt ne couvre QUE les fichiers listés** - Les autres fichiers sont traités dans les prompts 1 et 2
- **Si une erreur semble liée à un fichier d'un autre groupe, la noter mais ne pas la corriger ici**

