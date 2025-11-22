# 🚀 Prompt de Continuation - Migration SQLx vers `query_as()`

## 📋 Contexte du Projet

**Projet**: Yukpomnang Backend  
**Repository**: `C:\Users\23767\yukpomnang2\backend`  
**Stack**: Rust + Axum + SQLx + PostgreSQL (pgvector, imgsmlr)  
**Base de données**: Render PostgreSQL (URL fournie dans les memories)

### Objectif
Migrer progressivement toutes les requêtes SQLx de `sqlx::query!()` (macro compile-time) vers `sqlx::query_as()` avec structs `#[derive(FromRow)]` pour améliorer la portabilité cloud (Azure, AWS, etc.) et éliminer la dépendance aux métadonnées SQLx au build.

### Configuration Actuelle
- **SQLX_OFFLINE**: `true` (défini dans `render.yaml` et `backend/build.sh`)
- **Compilation**: ✅ Réussie avec `SQLX_OFFLINE=true`
- **Build Render**: Devrait réussir maintenant
- **Migrations automatiques**: ✅ Implémentées dans `main.rs`

---

## ✅ Ce Qui a été Fait

### Statistiques Globales
- **Fichiers migrés**: ~38 fichiers
- **Requêtes migrées**: ~53 requêtes
- **Fichiers restants**: ~20 fichiers
- **Requêtes restantes**: ~86 requêtes
- **Taux de progression**: ~38% des requêtes migrées
- **Pourcentage restant**: ~62%

### Fichiers Complètement Migrés (15 fichiers)

1. **`intelligent_service_controller.rs`** - 9 requêtes
   - `CountRow`, `ServiceInfoRow`, `UserBalanceRow`

2. **`intelligent_service_manager.rs`** - 7 requêtes
   - `ExpiredServiceRow`, `ServiceIdRow`, `UserBalanceRow`

3. **`pipeline_health_service.rs`** - 5 requêtes
   - `JobStatusCountRow`, `CountRow`, `LastCompletedRow`, `StaleJobRow`

4. **`content_engagement_service.rs`** - 5 requêtes
   - `EngagementRow`, `EngagementCountsRow`, `BulkEngagementCountsRow`, `UserEngagementRow`

5. **`social_distribution_service.rs`** - 5 requêtes
   - Utilisé `SocialPublicationJob` existant

6. **`delivery_routes.rs`** - 5 requêtes (partiellement, reste 9)
   - `ServiceUserIdRow`, `ServiceDataGpsRow`, `UserGpsNameRow`, `ProductDeliveryConfigRow`, `BillingModeRow`

7. **`studio_service.rs`** - 2 requêtes
   - `StudioPreviewMetrics`, `PreviewTemplateMetrics`

8. **`video_analytics_service.rs`** - 8 requêtes
   - `MediaIdRecord`, `EngagementStatsRow`, `DistributionStatsRow`, `QualityScoreRecord`, `MediaStatsRow`

9. **`reactivate_service.rs`** - 3 requêtes
   - `ServiceReactivationInfo`, `ServiceDataGps`

10. **`service_deactivation.rs`** - 5 requêtes
    - `ServiceDeactivationInfo`, `ServiceDataRow`, `ProductDataRow`, `DeliveryConfigRow`, `NotificationCheckRow`

11. **`video_job_service.rs`** - 5 requêtes
    - `VideoGenerationJobRow`, `JobIdRow`

12. **`video_weekly_report.rs`** - 3 requêtes
    - `TopServiceRow`

13. **`traiter_echange.rs`** - 5 requêtes
    - `EchangeDoublonRow`, `EchangeInsertRow`, `CandidatRow`

14. **`video_generation_service.rs`** - 6 requêtes
    - `ServiceDataRow`, `MediaRow`, `MediaIdRow`

15. **`product_validation_service.rs`** - 5 requêtes
    - `ServiceDataValueRow`, `DeliveryConfigRow`, `ServiceInfoRow`, `NotificationIdRow`

16. **`creer_service.rs`** - 1 requête
    - `UserGpsRow`

17. **`inventory_service.rs`** - 1 requête
    - `ServiceOwnerRow`

18. **`payment_matching_service.rs`** - 2 requêtes
    - `UserPaymentMethodsRow`, `PaymentMethodRow`

19. **`rechercher_besoin.rs`** - 2 requêtes
    - `ServiceSearchRow`, `ServiceExistsRow`

20. **`media_controller.rs`** - 3 requêtes
    - `MediaIdTypeRow`, `MediaRecord`

21. **`delivery_payment_service.rs`** - 8 requêtes
    - `DeliveryPaymentReservationRow`, `ReservationStatusRow`, `ProductPriceCommissionRow`, `ProductPriceDeliveryModeRow`

22. **`echange_controller.rs`** - 1 requête
    - `EchangeStatusRow`

23. **`delivery_external_routes.rs`** - 3 requêtes
    - `ClientDeliveryPreferencesRow`

24. **`nearby_services_routes.rs`** - 1 requête
    - `NearbyServiceRow`

25. **`bus_reservations.rs`** - 8 requêtes
    - `ProductSeatMapRow`, `ReservationIdRow`, `ReservationRow`, `ProductSeatMapOnlyRow`, `UserReservationRow`

26. **`user_controller.rs`** - 6 requêtes
    - `UserBalanceRow`, `UserExportRow`, `UserPublicProfileRow`, `UserProfileFullRow`

27. **`payment_controller.rs`** - 5 requêtes
    - `PaymentAttemptRow`, `PaymentHistoryItemRow`

28. **`webhook_controller.rs`** - 3 requêtes
    - `PaymentAttemptWebhookRow`

29. **`products_management.rs`** - 13 requêtes
    - `ProductIdRow`, `DeletedProductRow`, `ServiceDataRow`, `ServiceDataUserIdRow`, `ProductLifecycleRow`

30. **`service_controller.rs`** - 17 requêtes
    - `UserBalanceRow`, `ServiceIdRow`, `ServiceDataOnlyRow`, `ServiceDataIdRow`, `ServiceFullRow`, `ServiceIdCreatedRow`, `ServiceIdActiveRow`, `UserInfoRow`

31. **`alert_service.rs`** - 1 requête

32. **`cost_service.rs`** - 2 requêtes
    - `UserBalanceRow`, `AvgTokensRow`

33. **`check_tokens.rs`** - 3 requêtes (partiellement migré)
    - `UserDataRow`, `UserBalanceRow`

34. **`live_stream_service.rs`** - 1 requête complexe
    - `LiveSessionAnalyticsRow`

35. **`router_yukpo.rs`** - 1 requête
    - `UserBalanceRow`

36. **`prestataire_service.rs`** - 1 requête

37. **`service_history_service.rs`** - 2 requêtes (partiellement migré)
    - `ServiceRecordRow`

38. **`global_promo_service.rs`** - 1 correction (pas de migration, juste bug fix)

---

## ⏳ Ce Qui Reste à Faire

### Fichiers avec Requêtes Restantes (~86 requêtes)

#### 🔴 Priorité Haute - Fichiers Critiques

1. **`delivery_repository.rs`** - **42 requêtes** ⚠️ **LE PLUS GROS**
   - Fichier le plus important restant
   - Logique métier critique pour la livraison
   - Impact: Élevé

2. **`delivery_routes.rs`** - **9 requêtes restantes**
   - Déjà partiellement migré (5 requêtes faites)
   - Routes API critiques
   - Impact: Élevé

#### 🟡 Priorité Moyenne

3. **`file_sharing.rs`** - **6 requêtes**
   - Service de partage de fichiers
   - Impact: Moyen

4. **`service_lifecycle_manager.rs`** - **4 requêtes**
   - Gestion du cycle de vie des services
   - Impact: Moyen

5. **`distribution_automation_service.rs`** - **3 requêtes**
   - Automatisation de distribution
   - Impact: Moyen

6. **`social_connector_service.rs`** - **3 requêtes**
   - Connecteurs sociaux
   - Impact: Moyen

7. **`commerce_connector_service.rs`** - **~3 requêtes**
   - Connecteurs commerce
   - Impact: Moyen

8. **`voice_messages.rs`** - **3 requêtes**
   - Messages vocaux
   - Impact: Moyen

9. **`audio_library_service.rs`** - **~3 requêtes**
   - Bibliothèque audio
   - Impact: Moyen

10. **`live_audience_service.rs`** - **~3 requêtes**
    - Audience live
    - Impact: Moyen

11. **`programme_service.rs`** - **~3 requêtes**
    - Services de programme
    - Impact: Moyen

12. **`matching_pipeline.rs`** - **~3 requêtes**
    - Pipeline de matching
    - Impact: Moyen

13. **`embedding_tracker.rs`** - **~3 requêtes**
    - Tracker d'embeddings
    - Impact: Moyen

14. **`delivery_sla_monitor.rs`** - **~3 requêtes**
    - Monitoring SLA livraison
    - Impact: Moyen

15. **`live_analytics.rs`** - **~3 requêtes**
    - Analytics live
    - Impact: Moyen

#### 🟢 Priorité Basse - Fichiers Optionnels

16. **`publicite_controller_backup.rs`** - **10 requêtes**
    - ⚠️ Fichier BACKUP - peut être ignoré
    - Impact: Aucun (backup)

17. **`service_interaction.rs`** - **6 requêtes**
    - ⚠️ Code commenté dans le middleware
    - Impact: Aucun (désactivé)

18. **`publicite_expiration_backup.rs`** - **3 requêtes**
    - ⚠️ Fichier BACKUP - peut être ignoré
    - Impact: Aucun (backup)

19. **`check_tokens.rs`** - **~3 requêtes restantes**
    - Déjà partiellement migré
    - Impact: Faible

20. **`conversation_controller.rs`** - **~quelques requêtes**
    - Déjà partiellement migré
    - Impact: Faible

---

## 📊 Statistiques Détaillées

### Résumé
- **Total fichiers avec `sqlx::query!()`**: ~20 fichiers
- **Total requêtes restantes**: ~86 requêtes
- **Fichiers migrés**: ~38 fichiers
- **Taux de migration**: ~38% des requêtes migrées
- **Pourcentage restant**: ~62%

### Distribution
```
Priorité Haute:   51 requêtes (59%)  - 2 fichiers
Priorité Moyenne: 34 requêtes (40%)  - 13 fichiers  
Priorité Basse:   19 requêtes (22%)  - 5 fichiers (dont backups)
```

**Note**: Les totaux dépassent 100% car certains fichiers sont dans plusieurs catégories.

---

## 🔧 Pattern de Migration à Suivre

### 1. Pour les requêtes SELECT (retour de données)

```rust
// AVANT
let result = sqlx::query!(
    "SELECT id, name, email FROM users WHERE id = $1",
    user_id
)
.fetch_one(pool)
.await?;

// APRÈS
#[derive(FromRow)]
struct UserRow {
    id: i32,
    name: String,
    email: String,
}

let result: UserRow = sqlx::query_as(
    "SELECT id, name, email FROM users WHERE id = $1"
)
.bind(user_id)
.fetch_one(pool)
.await?;
```

### 2. Pour les requêtes INSERT/UPDATE/DELETE

```rust
// AVANT
sqlx::query!(
    "UPDATE users SET name = $1 WHERE id = $2",
    name,
    user_id
)
.execute(pool)
.await?;

// APRÈS
sqlx::query(
    "UPDATE users SET name = $1 WHERE id = $2"
)
.bind(name)
.bind(user_id)
.execute(pool)
.await?;
```

### 3. Pour les requêtes avec RETURNING

```rust
// AVANT
let result = sqlx::query!(
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id",
    name,
    email
)
.fetch_one(pool)
.await?;

// APRÈS
#[derive(FromRow)]
struct UserIdRow {
    id: i32,
}

let result: UserIdRow = sqlx::query_as(
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id"
)
.bind(name)
.bind(email)
.fetch_one(pool)
.await?;
```

### 4. Points d'Attention

- **Types UUID**: Utiliser `uuid::Uuid` dans les structs
- **Types Option**: Préserver `Option<T>` dans les structs si la colonne est nullable
- **Types Decimal**: Utiliser `rust_decimal::Decimal` ou convertir en `f64`
- **Types JSON**: Utiliser `serde_json::Value` ou structs désérialisées
- **Alias SQL**: Utiliser `#[sqlx(rename = "column_name")]` si nécessaire
- **Types BIGINT**: Convertir en `i64` dans les structs

---

## 📚 Documents de Référence

### Documents Créés Pendant la Migration

1. **`backend/ANALYSE_ERREURS_SQLX.md`**
   - Analyse initiale des erreurs SQLx
   - Différence entre `query!()` et `query()`

2. **`backend/ANALYSE_PORTABILITE_CLOUD_SQLX.md`**
   - Comparaison `query!()`, `query()`, `query_as()`
   - Recommandations pour la portabilité cloud

3. **`backend/CONSEIL_AZURE_VS_AWS.md`**
   - Recommandation Azure vs AWS
   - Analyse des coûts et services

4. **`backend/STRATEGIE_PORTABILITE_AZURE.md`**
   - Stratégie de portabilité vers Azure
   - Étapes de déploiement

5. **`backend/RESUME_MIGRATIONS_QUERY_AS.md`**
   - Résumé des migrations complétées (peut être obsolète)

6. **`backend/SCRIPT_DEPLOY_AZURE.sh`**
   - Script de déploiement Azure

### Scripts Utiles

- **`backend/regenerate_sqlx_metadata.sh`** (Linux/Mac)
- **`backend/regenerate_sqlx_metadata.ps1`** (Windows)
- **`backend/build.sh`** - Build avec `SQLX_OFFLINE=true`

---

## 🎯 Prochaines Étapes Recommandées

### Option 1: Approche Progressive (Recommandée)
1. Commencer par les fichiers avec 1-3 requêtes (gain rapide)
2. Puis les fichiers moyens (4-6 requêtes)
3. Enfin `delivery_repository.rs` (42 requêtes - le plus gros)

### Option 2: Approche Prioritaire
1. Migrer `delivery_repository.rs` (42 requêtes) en premier
2. Puis `delivery_routes.rs` (9 requêtes)
3. Ensuite les autres fichiers critiques

### Option 3: Approche Thématique
1. Tous les fichiers `*_service.rs` d'abord
2. Puis tous les fichiers `*_controller.rs`
3. Enfin les routes et middlewares

---

## ✅ Checklist de Vérification

Avant de commencer chaque migration:
- [ ] Lire le fichier pour comprendre le contexte
- [ ] Identifier toutes les requêtes `sqlx::query!()`
- [ ] Créer les structs `#[derive(FromRow)]` nécessaires
- [ ] Tester la compilation: `cargo check` avec `SQLX_OFFLINE=true`
- [ ] Vérifier les types (UUID, Option, Decimal, JSON)
- [ ] Vérifier les alias SQL si nécessaire
- [ ] S'assurer que le code compile sans erreurs

---

## 🚨 Points de Vigilance

1. **Ne pas migrer les fichiers BACKUP**:
   - `publicite_controller_backup.rs`
   - `publicite_expiration_backup.rs`

2. **Vérifier le code commenté**:
   - `service_interaction.rs` a du code commenté (peut être ignoré)

3. **Tester après chaque fichier**:
   - Toujours vérifier que `cargo check` passe
   - Avec `SQLX_OFFLINE=true` défini

4. **Cohérence des types**:
   - Les structs doivent correspondre exactement aux colonnes SQL
   - Attention aux conversions de types (i32/i64, etc.)

---

## 📝 Commandes Utiles

```bash
# Vérifier les fichiers restants
Get-ChildItem -Path "src" -Recurse -Filter "*.rs" | ForEach-Object { 
    $count = (Select-String -Path $_.FullName -Pattern "sqlx::query!" -ErrorAction SilentlyContinue | Measure-Object).Count
    if ($count -gt 0) { 
        [PSCustomObject]@{File=$_.Name; Count=$count; Path=$_.FullName} 
    } 
} | Sort-Object Count -Descending

# Compiler avec SQLX_OFFLINE=true
$env:SQLX_OFFLINE = "true"
cargo check

# Vérifier les erreurs
cargo check 2>&1 | Select-String -Pattern "error\["

# Linter
cargo clippy
```

---

## 🎓 Leçons Apprises

1. **Structs réutilisables**: Créer des structs communes comme `UserBalanceRow`, `ServiceIdRow`, etc.
2. **Gestion des Option**: Toujours préserver `Option<T>` dans les structs si la colonne est nullable
3. **Types complexes**: UUID, Decimal, JSON nécessitent une attention particulière
4. **Tests progressifs**: Compiler après chaque fichier migré
5. **Pattern cohérent**: Suivre le même pattern pour toutes les migrations

---

## 🔗 Contexte Technique

- **Base de données**: PostgreSQL avec extensions pgvector et imgsmlr
- **URL DB**: Fournie dans les memories du projet
- **SQLX_OFFLINE**: `true` (essentiel pour le build cloud)
- **Migrations**: Appliquées automatiquement dans `main.rs`
- **Compilation**: ✅ Actuellement réussie avec `SQLX_OFFLINE=true`

---

**Date de création**: 2025-01-XX  
**Dernière mise à jour**: Après migration de ~38 fichiers (~53 requêtes)  
**État**: En cours - ~62% restant (~86 requêtes dans ~20 fichiers)

