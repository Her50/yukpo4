# ⚠️ PROBLÈME IDENTIFIÉ : Capacité Stockage Médias

## 🚨 Problème Principal

**Les médias uploadés lors de la création de services/produits NE passent PAS par S3/Wasabi !**

### Code Actuel (PROBLÉMATIQUE)

**Fichier** : `backend/src/controllers/media_controller.rs`

```rust
// ❌ PROBLÈME : Stockage LOCAL uniquement
pub async fn upload_media(...) {
    let storage_root = upload_storage_root(); // ← UPLOAD_STORAGE_PATH ou "uploads"
    let services_dir = storage_root.join("services");
    
    // ❌ Écriture DIRECTE sur disque local
    let mut file = File::create(&absolute_path).await?;
    file.write_all(&bytes).await?;
    
    // ❌ PAS d'utilisation de MediaStorageService
    // ❌ PAS d'upload vers S3/Wasabi
}
```

### Conséquences

1. **Problème de Capacité en Test** 💾
   - Tous les médias sont stockés **localement** sur le serveur
   - Le disque se remplit rapidement lors des tests
   - Pas de scalabilité

2. **Incohérence** 🔄
   - Commentaires → S3/Wasabi ✅
   - Vidéos générées → S3/Wasabi ✅
   - Images IA → S3/Wasabi ✅
   - **Services/Produits → Local ❌**

3. **Production** 🚨
   - Si S3/Wasabi configuré mais cette route ne l'utilise pas
   - Risque de remplir le disque serveur

## ✅ Solution : Migrer vers MediaStorageService

### Modification Nécessaire

**Fichier** : `backend/src/controllers/media_controller.rs`

**Avant** :
```rust
pub async fn upload_media(
    AxumPath(service_id): AxumPath<i32>,
    Extension(pool): Extension<PgPool>,
    Extension(user): Extension<AuthenticatedUser>,
    mut multipart: Multipart,
) -> AppResult<Json<Vec<UploadedMediaResponse>>> {
    // ❌ Stockage local
    let storage_root = upload_storage_root();
    let absolute_path = services_dir.join(&unique_name);
    let mut file = File::create(&absolute_path).await?;
    file.write_all(&bytes).await?;
}
```

**Après** :
```rust
pub async fn upload_media(
    AxumPath(service_id): AxumPath<i32>,
    State(state): State<Arc<AppState>>, // ✅ Ajouter AppState
    Extension(user): Extension<AuthenticatedUser>,
    mut multipart: Multipart,
) -> AppResult<Json<Vec<UploadedMediaResponse>>> {
    // ✅ Utiliser MediaStorageService (S3/Wasabi)
    let storage_key = format!("services/{}/{}", service_id, unique_name);
    match state.media_storage.store_bytes(&bytes, &storage_key, Some(&content_type)).await {
        Ok(location) => {
            // location.public_url = URL S3/Wasabi
            // location.storage_path = Chemin de stockage
        }
    }
}
```

## 📊 Comparaison

| Aspect | Actuel (Local) | Après (S3/Wasabi) |
|--------|----------------|-------------------|
| **Stockage** | Disque serveur | Cloud (S3/Wasabi) |
| **Capacité** | ❌ Limitée | ✅ Illimitée |
| **Tests** | ❌ Remplit disque | ✅ Pas de problème |
| **Production** | ❌ Risque | ✅ Scalable |
| **Cohérence** | ❌ Incohérent | ✅ Uniforme |

## 🎯 Actions Requises

1. ✅ Modifier `upload_media` pour utiliser `MediaStorageService`
2. ✅ Ajouter `State<Arc<AppState>>` à la signature
3. ✅ Remplacer écriture locale par `store_bytes()`
4. ✅ Mettre à jour la route pour passer `AppState`
5. ✅ Tester avec S3/Wasabi configuré
6. ✅ Tester sans S3/Wasabi (fallback local)

## 🔍 Vérification

**Route actuelle** : `/api/prestataire/upload/{service_id}`

**Utilisée par** :
- `CreationService.tsx` (frontend)
- `ServiceFormDynamic.tsx` (frontend)
- `FormulaireServicePreRempli.tsx` (frontend)
- Mobile apps

**Impact** : **CRITIQUE** - Tous les uploads de médias de services/produits

