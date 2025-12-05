# 🔐 Analyse : URLs Pré-signées (Presigned URLs)

## Date : 2025-01-XX

## 📖 Qu'est-ce qu'une URL Pré-signée ?

Une **URL pré-signée** est une URL temporaire qui donne accès à un objet S3/Wasabi **sans nécessiter d'accès public** sur le bucket.

### Fonctionnement

```
1. Backend génère une URL signée avec :
   - Clé secrète Wasabi
   - Chemin de l'objet
   - Durée de validité (ex: 1 heure)
   
2. URL générée :
   https://yukpo-video-prod.s3.eu-central-1.wasabisys.com/uploads/product/123/video.mp4
   ?X-Amz-Algorithm=AWS4-HMAC-SHA256
   &X-Amz-Credential=...
   &X-Amz-Date=20250115T120000Z
   &X-Amz-Expires=3600
   &X-Amz-Signature=abc123...
   
3. URL valide pendant 1 heure
4. Après expiration, l'URL ne fonctionne plus
```

---

## ✅ Avantages des URLs Pré-signées

### 1. **Sécurité** 🔒
- ✅ Pas besoin d'accès public sur le bucket
- ✅ Contrôle d'accès granulaire
- ✅ Expiration automatique
- ✅ Impossible de partager l'URL après expiration

### 2. **Flexibilité** 🎯
- ✅ Durée d'accès configurable (1h, 24h, 7 jours, etc.)
- ✅ Peut être générée à la demande
- ✅ Différentes durées selon le contexte

### 3. **Conformité Wasabi** ✅
- ✅ Recommandé par Wasabi si accès public refusé
- ✅ Pas besoin d'approbation Wasabi
- ✅ Fonctionne immédiatement

### 4. **Contrôle Fin** 🎛️
- ✅ Peut être révoquée (changer les clés)
- ✅ Traçabilité (qui a accès à quoi)
- ✅ Limitation par utilisateur/rôle

---

## ❌ Limites des URLs Pré-signées

### 1. **Expiration** ⏱️
- ❌ URLs expirées ne fonctionnent plus
- ❌ Nécessite régénération si expiration
- ❌ Problème pour contenu long terme (ex: images produits)

### 2. **Complexité** 🔧
- ❌ Nécessite génération côté backend
- ❌ Requête API supplémentaire pour obtenir l'URL
- ❌ Gestion du cache des URLs

### 3. **Performance** ⚡
- ⚠️ Latence supplémentaire (génération URL)
- ⚠️ Charge backend (génération à la demande)
- ⚠️ Cache nécessaire pour optimiser

### 4. **CDN** 🌐
- ⚠️ Cloudflare CDN ne peut pas cacher les URLs pré-signées efficacement
- ⚠️ Chaque URL est unique (signature différente)
- ⚠️ Cache CDN moins efficace

### 5. **Longueur URL** 📏
- ⚠️ URLs très longues (paramètres de signature)
- ⚠️ Peut poser problème pour certains systèmes
- ⚠️ Moins lisible que URLs publiques

### 6. **Partage** 🔗
- ⚠️ URLs peuvent être partagées (mais expirent)
- ⚠️ Pas de contrôle sur qui utilise l'URL
- ⚠️ Si URL volée, accessible jusqu'à expiration

---

## 🔍 Analyse de Votre Code Actuel

### ✅ Ce qui est Déjà en Place

1. **Client S3/Wasabi configuré** ✅
   ```rust
   // backend/src/services/media_storage_service.rs
   use aws_sdk_s3::Client;
   // Client S3 déjà configuré pour Wasabi
   ```

2. **SignatureService existe** ✅
   ```rust
   // backend/src/services/signature_service.rs
   // Mais pour services partagés, pas pour S3
   ```

3. **MediaStorageService structuré** ✅
   ```rust
   // Structure prête pour ajouter presigned URLs
   ```

### ❌ Ce qui Manque

1. **Méthode presigned URL** ❌
   - Pas de `generate_presigned_url()` dans `MediaStorageService`

2. **Endpoint API** ❌
   - Pas d'endpoint pour générer URLs pré-signées

3. **Gestion expiration** ❌
   - Pas de système de cache/refresh des URLs

---

## 💡 Faisabilité d'Implémentation

### ✅ **OUI, C'est Faisable !**

**Raisons** :
1. ✅ Client S3 déjà configuré (`aws_sdk_s3::Client`)
2. ✅ SDK AWS supporte presigned URLs
3. ✅ Architecture modulaire (facile à ajouter)
4. ✅ Pas de changement majeur nécessaire

### 📋 Ce qu'il Faut Ajouter

1. **Méthode dans MediaStorageService**
   ```rust
   pub async fn generate_presigned_url(
       &self,
       storage_path: &str,
       expires_in_seconds: u64,
   ) -> AppResult<String>
   ```

2. **Endpoint API**
   ```rust
   // GET /api/media/presigned/{media_id}?expires=3600
   ```

3. **Cache côté client** (optionnel)
   ```typescript
   // Cache des URLs pré-signées pour éviter régénération
   ```

---

## 🎯 Cas d'Usage Appropriés

### ✅ **Bien Adapté Pour** :

1. **Médias Privés** 🔒
   - Preuves de livraison (coursier → client)
   - Documents confidentiels
   - Médias de chat privé

2. **Accès Temporaire** ⏱️
   - Partage temporaire de fichiers
   - Téléchargements uniques
   - Contenu avec expiration

3. **Sécurité Renforcée** 🛡️
   - Contenu sensible
   - Accès contrôlé par utilisateur
   - Traçabilité nécessaire

### ❌ **Moins Adapté Pour** :

1. **Contenu Public** 🌐
   - Images produits (devrait être public)
   - Vidéos publiques
   - Médias partagés

2. **Performance Critique** ⚡
   - Feed vidéo (nécessite URLs stables)
   - Images fréquemment accédées
   - Contenu CDN optimisé

3. **Long Terme** 📅
   - Médias archivés
   - Contenu permanent
   - URLs dans la base de données

---

## 🔄 Comparaison : URLs Publiques vs Pré-signées

| Critère | URLs Publiques | URLs Pré-signées |
|---------|----------------|------------------|
| **Sécurité** | ⭐⭐ Moyenne | ⭐⭐⭐ Élevée |
| **Performance** | ⭐⭐⭐ Optimale | ⭐⭐ Moyenne |
| **CDN Cache** | ⭐⭐⭐ Excellent | ⭐ Faible |
| **Simplicité** | ⭐⭐⭐ Simple | ⭐⭐ Moyenne |
| **Flexibilité** | ⭐ Faible | ⭐⭐⭐ Élevée |
| **Expiration** | ❌ Non | ✅ Oui |
| **Approbation** | ⚠️ Requise | ✅ Pas nécessaire |
| **Coût Backend** | 💰 Faible | 💰 Moyen |

---

## 🎯 Recommandation pour Votre Système

### **Approche Hybride (Meilleure Solution)**

#### **1. URLs Publiques (via CDN)** - Pour Contenu Public ✅

**Utiliser pour** :
- Images produits
- Vidéos produits publiques
- Médias de services publics
- Feed vidéo

**Avantages** :
- ✅ Performance optimale (CDN cache)
- ✅ URLs stables
- ✅ Pas de charge backend

#### **2. URLs Pré-signées** - Pour Contenu Privé ✅

**Utiliser pour** :
- Preuves de livraison (pickup/delivery)
- Documents confidentiels
- Médias de chat privé
- Contenu temporaire

**Avantages** :
- ✅ Sécurité renforcée
- ✅ Contrôle d'accès
- ✅ Expiration automatique

---

## 📝 Plan d'Implémentation

### Phase 1 : Ajouter Méthode Presigned URL

```rust
// backend/src/services/media_storage_service.rs

use aws_sdk_s3::presigning::PresigningConfig;
use std::time::Duration;

impl MediaStorageService {
    /// Génère une URL pré-signée pour un objet Wasabi
    pub async fn generate_presigned_url(
        &self,
        storage_path: &str,
        expires_in_seconds: u64,
    ) -> AppResult<String> {
        let client = self.client.as_ref().ok_or_else(|| {
            AppError::Internal("Client S3 non configuré".to_string())
        })?;

        let bucket = self.bucket.as_ref().ok_or_else(|| {
            AppError::Internal("Bucket S3 non configuré".to_string())
        })?;

        let presigning_config = PresigningConfig::expires_in(
            Duration::from_secs(expires_in_seconds)
        ).map_err(|e| AppError::Internal(format!("Erreur config présignature: {}", e)))?;

        let presigned_request = client
            .get_object()
            .bucket(bucket)
            .key(storage_path)
            .presigned(presigning_config)
            .await
            .map_err(|e| AppError::Internal(format!("Erreur génération URL pré-signée: {}", e)))?;

        Ok(presigned_request.uri().to_string())
    }
}
```

### Phase 2 : Endpoint API

```rust
// backend/src/routes/media_routes.rs

/// GET /api/media/presigned/{media_id}?expires=3600
pub async fn get_presigned_media_url(
    Path(media_id): Path<i32>,
    Query(params): Query<HashMap<String, String>>,
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthenticatedUser>,
) -> AppResult<Json<serde_json::Value>> {
    // 1. Récupérer le média depuis la DB
    // 2. Vérifier les permissions
    // 3. Générer URL pré-signée
    // 4. Retourner l'URL
}
```

### Phase 3 : Utilisation Côté Client

```typescript
// mobile/src/services/mediaService.ts

async getPresignedUrl(mediaId: number, expiresInSeconds: number = 3600): Promise<string> {
    const response = await apiGet(
        `/api/media/presigned/${mediaId}?expires=${expiresInSeconds}`
    );
    return response.presigned_url;
}
```

---

## ⚠️ Limitations à Considérer

### 1. **CDN Cloudflare**
- ⚠️ URLs pré-signées = URLs uniques (signature différente)
- ⚠️ Cache CDN moins efficace
- ⚠️ Solution : Utiliser presigned pour privé, public pour CDN

### 2. **Performance**
- ⚠️ Génération URL = Requête backend
- ⚠️ Cache nécessaire pour optimiser
- ⚠️ Solution : Cache côté client (1h par défaut)

### 3. **Expiration**
- ⚠️ URLs expirées = Erreur
- ⚠️ Nécessite régénération
- ⚠️ Solution : Détection expiration + refresh automatique

### 4. **Complexité**
- ⚠️ Plus complexe que URLs publiques
- ⚠️ Gestion cache/expiration
- ⚠️ Solution : Utiliser seulement pour contenu privé

---

## 🎯 Recommandation Finale

### **Utiliser URLs Pré-signées UNIQUEMENT pour** :

1. ✅ **Preuves de livraison** (pickup/delivery)
   - Contenu privé
   - Accès temporaire
   - Sécurité importante

2. ✅ **Médias de chat privé**
   - Contenu confidentiel
   - Partage entre utilisateurs spécifiques

3. ✅ **Documents sensibles**
   - Contrôle d'accès nécessaire

### **Garder URLs Publiques (CDN) pour** :

1. ✅ **Images/Vidéos produits**
   - Contenu public
   - Performance critique
   - Cache CDN optimal

2. ✅ **Feed vidéo**
   - URLs stables nécessaires
   - Performance optimale

---

## 📊 Conclusion

### **URLs Pré-signées :**

✅ **Avantages** :
- Sécurité renforcée
- Contrôle d'accès
- Pas besoin d'approbation Wasabi

❌ **Limites** :
- Expiration (nécessite régénération)
- Performance (génération backend)
- Cache CDN moins efficace

### **Faisabilité** : ✅ **OUI, Implémentable**

### **Recommandation** : ✅ **Approche Hybride**
- URLs publiques (CDN) pour contenu public
- URLs pré-signées pour contenu privé

---

**Status** : 📋 **Analyse complétée - Prêt pour implémentation si nécessaire**

