# Prompt pour la prochaine session - Correction erreurs et test Redis

> ⚠️ **MISE À JOUR** : Voir le fichier `PROMPT_CORRECTION_ERREURS_REDIS.md` pour l'état actuel complet et détaillé.

## Contexte
Je travaille sur un projet Rust (backend Axum) avec PostgreSQL et Redis (Upstash). J'ai déjà corrigé de nombreuses erreurs de compilation, mais il reste environ **517 erreurs** à corriger avant de pouvoir tester Redis.

## État actuel

### ✅ Corrections déjà effectuées :
1. **deadpool-redis Config** - Corrigé (initialisation de `cfg.pool`)
2. **AppResult manquant** - Corrigé dans `image_compression_service.rs`
3. **try_get dans sqlx** - Remplacé par `get` dans `video_ml_controller.rs` et `native_search_service.rs`
4. **Modules manquants** - Ajouté `chat_reactions_routes`, `comment_media_routes`
5. **chat_media_routes** - Corrigé `jwt_auth` middleware et `field.bytes()`
6. **video_ml_controller** - Corrigé les appels avec `state` manquant
7. **publicite_controller.rs** - Corrigé les variables manquantes (`targeting_value`, `ab_testing_value`, etc.)
8. **Imports en double** - Supprimés dans `chat_media_routes.rs`
9. **CommentsPayload** - Ajouté `Deserialize`

### ⚠️ Erreurs restantes (~517) :
- **E0599** (~306 erreurs) : no method named...
- **E0308** (~46 erreurs) : mismatched types
- **E0277** (~87 erreurs) : trait bound issues
- **E0107** (~14 erreurs) : method takes wrong number of arguments
- **E0596/E0382** (~11 erreurs) : borrow checker issues
- D'autres erreurs dans différents fichiers

> 📄 **Voir `PROMPT_CORRECTION_ERREURS_REDIS.md` pour la liste complète des corrections effectuées et l'état détaillé.**

## Configuration Redis
- **REDIS_URL**: `rediss://default:AR5SAAImcDI1MzFkNWU5NWMwNzE0ZTVlOWUyNWNmNWFlNjlmZjU3ZnAyNzc2Mg@superb-sole-7762.upstash.io:6379`
- **Binaire de test**: `backend/src/bin/test_redis.rs` (déjà créé et partiellement corrigé)

## Tâches à effectuer

### Phase 1 : Corriger les erreurs restantes
1. Identifier les types d'erreurs les plus fréquents avec `cargo check 2>&1 | Select-String -Pattern "error\[E" | Group-Object | Sort-Object Count -Descending`
2. Corriger systématiquement :
   - Les erreurs `await` dans fonctions non-async → rendre les fonctions `async`
   - Les erreurs de type mismatch → corriger les types
   - Les erreurs `try_get` restantes → remplacer par `get` avec la syntaxe correcte
3. Vérifier le nombre d'erreurs après chaque correction : `cargo check 2>&1 | Select-String -Pattern "error\[E" | Measure-Object | Select-Object -ExpandProperty Count`

### Phase 2 : Compiler le binaire test_redis
1. Vérifier que le binaire compile : `cargo build --bin test_redis`
2. Si des erreurs persistent, les corriger spécifiquement pour le binaire

### Phase 3 : Tester Redis
1. Définir la variable d'environnement :
   ```powershell
   $env:REDIS_URL="rediss://default:AR5SAAImcDI1MzFkNWU5NWMwNzE0ZTVlOWUyNWNmNWFlNjlmZjU3ZnAyNzc2Mg@superb-sole-7762.upstash.io:6379"
   ```
2. Exécuter le test :
   ```powershell
   cargo run --bin test_redis
   ```
3. Analyser les résultats et vérifier la connectivité Redis

## Commandes utiles

```powershell
# Compter les erreurs
cargo check 2>&1 | Select-String -Pattern "error\[E" | Measure-Object | Select-Object -ExpandProperty Count

# Voir les premières erreurs
cargo check 2>&1 | Select-String -Pattern "error\[E" | Select-Object -First 10

# Voir les erreurs d'un type spécifique
cargo check 2>&1 | Select-String -Pattern "error\[E0728\]" | Select-Object -First 5

# Compiler le binaire test_redis
cargo build --bin test_redis

# Exécuter le test Redis
$env:REDIS_URL="rediss://default:AR5SAAImcDI1MzFkNWU5NWMwNzE0ZTVlOWUyNWNmNWFlNjlmZjU3ZnAyNzc2Mg@superb-sole-7762.upstash.io:6379"
cargo run --bin test_redis
```

## Notes importantes
- Le répertoire de travail est `C:\Users\23767\yukpomnang2\backend`
- Utiliser `get` au lieu de `try_get` pour sqlx (syntaxe : `row.get::<Type, _>("column_name")`)
- Pour les valeurs optionnelles : `row.get::<Option<Type>, _>("column_name")`
- Les fonctions qui utilisent `await` doivent être marquées `async`
- Le fichier `test_redis.rs` teste 5 scénarios Redis différents

## Prompt à utiliser

```
Je continue la correction des erreurs de compilation dans mon projet Rust backend. 

📄 Référence complète : Voir le fichier PROMPT_CORRECTION_ERREURS_REDIS.md pour tous les détails

Contexte :
- Environ 517 erreurs restantes à corriger
- Types d'erreurs : E0308 (mismatched types), E0277 (trait bounds), E0599 (method not found), E0382/E0596 (borrow checker)
- Objectif : compiler le binaire test_redis et tester la connexion Redis

Tâches :
1. Identifier les types d'erreurs les plus fréquents
2. Corriger systématiquement les erreurs (commencer par E0308, puis E0277, puis E0599, enfin E0382/E0596)
3. Compiler le binaire test_redis : cargo build --bin test_redis
4. Lancer les tests Redis avec la configuration Upstash

Configuration Redis :
REDIS_URL=rediss://default:AR5SAAImcDI1MzFkNWU5NWMwNzE0ZTVlOWUyNWNmNWFlNjlmZjU3ZnAyNzc2Mg@superb-sole-7762.upstash.io:6379

Notes :
- Répertoire de travail : C:\Users\23767\yukpomnang2\backend
- Utiliser SQLX_OFFLINE=true pour compiler
- Vérifier le nombre d'erreurs après chaque correction

Commence par identifier les types d'erreurs les plus fréquents et corrige-les une par une.
```

