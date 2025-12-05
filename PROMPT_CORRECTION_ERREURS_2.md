# 🔧 Prompt de Correction d'Erreurs Rust - Groupe 2

## 📋 Contexte
Ce prompt fait partie d'un ensemble de 3 prompts autonomes pour corriger toutes les erreurs de compilation Rust du projet Yukpomnang. **Ce prompt traite uniquement les fichiers listés ci-dessous - ne pas toucher aux autres fichiers.**

## ⚠️ Instructions Importantes
1. **Effectuer un maximum de corrections avant de compiler** - La compilation prend beaucoup de temps, donc corriger plusieurs erreurs d'un coup avant de vérifier
2. **Ne pas modifier les fichiers des autres groupes** - Ce prompt couvre uniquement les fichiers listés dans la section "Fichiers à corriger"
3. **Après toutes les corrections, tester Redis** - Voir section "Test final Redis"

## 🎯 Fichiers à Corriger (Groupe 2)

### Controllers Principaux
- `backend/src/controllers/service_controller.rs`
- `backend/src/controllers/product_comments_controller.rs`
- `backend/src/controllers/conversation_controller.rs`
- `backend/src/controllers/media_product_controller.rs`
- `backend/src/controllers/health_structure_controller.rs`
- `backend/src/controllers/vehicle_model_controller.rs`
- `backend/src/controllers/phone_model_controller.rs`
- `backend/src/controllers/appliance_model_controller.rs`

### Controllers Spécialisés
- `backend/src/controllers/specialized_services_unified_controller.rs`
- `backend/src/controllers/specialized_reservation_controller.rs`
- `backend/src/controllers/specialized_rating_controller.rs`
- `backend/src/controllers/specialized_payment_controller.rs`
- `backend/src/controllers/specialized_chat_controller.rs`
- `backend/src/controllers/agency_schedule_controller.rs`

### Routes
- `backend/src/routes/token_stats_routes.rs`
- `backend/src/routes/health_routes.rs`
- `backend/src/routes/comment_media_routes.rs`
- `backend/src/routes/delivery_routes.rs`

## 🔍 Types d'Erreurs à Corriger

### 1. E0308 - Mismatched Types

#### Conversions de types i64/i32
- `id: row.get::<i32, _>("id")` → `id: row.get::<i32, _>("id").to_string()` si le champ attend `String`
- `id: row.get::<i32, _>("id")` → `id: row.get::<i32, _>("id") as i64` si le champ attend `i64`

#### Conversions Arc/Pool
- `Service::new(Arc::new(state.pg.clone()))` au lieu de `Service::new(state.pg.clone())`
- `Service::new(Arc::new(state.pg.clone()))` au lieu de `Service::new(Arc::clone(&state.pg))`
- Vérifier les signatures : `fn new(pool: Arc<PgPool>)` nécessite `Arc::new()`

#### Conversions Option/Some
- `has_more: Some(next_cursor.is_some())` si le champ attend `Option<bool>` mais reçoit `bool`
- `response_source: Some(value)` si le champ attend `Option<String>` mais reçoit `String`

#### Conversions DateTime
- `DateTime<Utc>` → `NaiveDateTime` : utiliser `.naive_utc()`
- `Option<DateTime<Utc>>` → `DateTime<Utc>` : utiliser `.unwrap_or_else(|| chrono::Utc::now())`

#### Conversions Sender/Arc
- `(*status_tx).clone()` si `status_tx` est `Arc<Sender<T>>` mais la fonction attend `Sender<T>`

### 2. E0277 - Trait Bounds

#### Deserialize manquant
- Ajouter `Deserialize` aux derives : `#[derive(Debug, Serialize, Deserialize, Clone)]`
- Vérifier que `use serde::{Deserialize, Serialize};` est présent

#### Opérateur ? sur valeurs non-Result
- `row.get::<Type, _>("column")?` → `row.get::<Type, _>("column")` (enlever le `?`)
- `row.get()` retourne directement la valeur, pas un `Result`

#### Opérateur ? dans async blocks
- Si l'async block retourne un type non-Result, utiliser `.map_err()` et `.unwrap_or()` au lieu de `?`

### 3. E0599 - No Method Named

#### row.get() sans type explicite
- `row.get("column")` → `row.get::<Type, _>("column")`
- Vérifier que `use sqlx::Row;` est présent

### 4. E0119 - Conflicting Implementations
- Supprimer les derives en double
- Vérifier qu'il n'y a qu'un seul `#[derive(...)]` par struct

## 📝 Exemples de Corrections

### Exemple 1 : Conversion i32 → String
```rust
// ❌ Avant
id: row.get::<i32, _>("id"),

// ✅ Après (si le champ attend String)
id: row.get::<i32, _>("id").to_string(),
```

### Exemple 2 : Arc/Pool dans specialized controllers
```rust
// ❌ Avant
let service = SpecializedReservationService::new(Arc::clone(&state.pg));

// ✅ Après
let service = SpecializedReservationService::new(Arc::new(state.pg.clone()));
```

### Exemple 3 : Option<bool>
```rust
// ❌ Avant
has_more: next_cursor.is_some(),

// ✅ Après (si le champ attend Option<bool>)
has_more: Some(next_cursor.is_some()),
```

### Exemple 4 : DateTime → NaiveDateTime
```rust
// ❌ Avant
created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),

// ✅ Après (si le champ attend NaiveDateTime)
created_at: row.get::<chrono::DateTime<chrono::Utc>, _>("created_at").naive_utc(),
```

### Exemple 5 : Enlever ? sur row.get()
```rust
// ❌ Avant
"id": config.get::<i32, _>("id")?,
"service_id": config.get::<i32, _>("service_id")?,

// ✅ Après
"id": config.get::<i32, _>("id"),
"service_id": config.get::<i32, _>("service_id"),
```

## ✅ Checklist de Progression

- [ ] Corriger toutes les erreurs E0308 dans les fichiers du groupe 2
- [ ] Corriger toutes les erreurs E0277 dans les fichiers du groupe 2
- [ ] Corriger toutes les erreurs E0599 dans les fichiers du groupe 2
- [ ] Corriger toutes les erreurs E0119 dans les fichiers du groupe 2
- [ ] Vérifier qu'il n'y a plus d'erreurs dans ces fichiers avec `cargo build --bin test_redis 2>&1 | Select-String -Pattern "error\[E" | Select-String -Pattern "service_controller|product_comments|conversation|media_product|health_structure|vehicle_model|phone_model|appliance_model|specialized_services_unified|specialized_reservation|specialized_rating|specialized_payment|specialized_chat|agency_schedule|token_stats_routes|health_routes|comment_media_routes|delivery_routes"`
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
- **Ce prompt ne couvre QUE les fichiers listés** - Les autres fichiers sont traités dans les prompts 1 et 3
- **Si une erreur semble liée à un fichier d'un autre groupe, la noter mais ne pas la corriger ici**

