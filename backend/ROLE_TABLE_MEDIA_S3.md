# 📚 Rôle de la Table `media` avec S3/Wasabi

## 🎯 Architecture : Table `media` + S3/Wasabi

### **1. Rôle de la Table `media`**

La table `media` est un **index/métadonnées** des fichiers stockés, pas le stockage lui-même.

#### **Structure de la Table**

```sql
CREATE TABLE media (
    id SERIAL PRIMARY KEY,
    service_id INTEGER NOT NULL REFERENCES services(id),
    type TEXT NOT NULL,  -- 'image', 'video', 'audio'
    path TEXT NOT NULL,  -- Chemin/URL du fichier (S3/Wasabi ou local)
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- ... autres colonnes optionnelles
);
```

#### **Rôle Principal**

1. **Métadonnées** : Stocke les informations sur les fichiers (ID, type, date, service)
2. **Index** : Permet de rechercher rapidement les médias d'un service
3. **Référence** : Lien entre services/produits et leurs médias
4. **Historique** : Trace de tous les médias uploadés

### **2. Relation Table `media` ↔ S3/Wasabi**

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Table media   │         │   S3/Wasabi      │         │   Frontend   │
│                 │         │                  │         │              │
│ id: 123         │────────▶│ bucket/          │◀────────│ Affiche      │
│ service_id: 456 │         │ uploads/         │         │ l'image      │
│ type: "image"   │         │ services/456/    │         │              │
│ path: "uploads/ │         │ file.jpg         │         │              │
│  services/456/  │         │                  │         │              │
│  file.jpg"      │         │ URL: https://... │         │              │
└─────────────────┘         └──────────────────┘         └──────────────┘
     ↑                              ↑
     │                              │
     │                              │
     └─── Référence ───────────────┘
```

### **3. Flux Complet**

#### **Upload d'un Média**

1. **Utilisateur** : Upload fichier via frontend
2. **Backend** : `MediaStorageService.store_bytes()` → Upload vers S3/Wasabi
3. **S3/Wasabi** : Fichier stocké → URL publique générée
4. **Table `media`** : INSERT avec le `path` (URL S3/Wasabi ou chemin local)
5. **Frontend** : Affiche le média depuis l'URL S3/Wasabi

#### **Récupération d'un Média**

1. **Frontend** : Demande les médias d'un service
2. **Backend** : `SELECT * FROM media WHERE service_id = ?`
3. **Résultat** : Liste avec `path` (URLs S3/Wasabi)
4. **Frontend** : Affiche directement depuis les URLs

## 📊 Limites Fixées Localement

### **Limites dans le Code**

#### **1. Frontend (Mobile)**

```typescript
// mobile/src/services/cloudUpload.ts
const maxSizes: Record<string, number> = {
    image: 10 * 1024 * 1024,    // 10 MB
    video: Infinity,             // Pas de limite
    document: 10 * 1024 * 1024, // 10 MB
    audio: 10 * 1024 * 1024,    // 10 MB
    excel: 5 * 1024 * 1024,     // 5 MB
    logo: 5 * 1024 * 1024,       // 5 MB
    banner: 5 * 1024 * 1024      // 5 MB
};
```

#### **2. Frontend (Web)**

```typescript
// frontend/src/hooks/useFileUpload.ts
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const DEFAULT_MAX_FILES = 10;
```

#### **3. Backend**

```rust
// backend/src/middlewares/request_size_limit.rs
// Limite globale : 200 MB pour les requêtes multipart
DefaultBodyLimit::max(200_000_000) // 200 MB
```

#### **4. Service de Partage**

```rust
// backend/src/services/file_sharing.rs
max_file_size: u64, // Configurable
```

### **Pourquoi ces Limites ?**

1. **Performance** : Éviter les uploads trop longs
2. **Coûts** : Limiter la bande passante
3. **UX** : Éviter les timeouts
4. **Sécurité** : Limiter les attaques DoS

### **Limites S3/Wasabi**

- **S3/Wasabi** : Pas de limite de taille (théoriquement)
- **Pratique** : Recommandé < 5 GB par fichier
- **Vidéos** : Pas de limite dans notre code (Infinity)

## ⚡ Performance : Wasabi vs Local

### **Upload**

| Aspect | Local | Wasabi |
|--------|-------|--------|
| **Vitesse** | ⚡ Très rapide (disque local) | ⚠️ Dépend de la connexion |
| **Latence** | ~1-5ms | ~50-200ms (selon région) |
| **Throughput** | Limitée par disque | Limitée par bande passante |

### **Lecture/Serving**

| Aspect | Local | Wasabi |
|--------|-------|--------|
| **Vitesse** | ⚡ Rapide (serveur local) | ✅ Très rapide (CDN) |
| **Latence** | ~10-50ms | ~20-100ms (CDN proche) |
| **Scalabilité** | ❌ Limitée | ✅ Illimitée |
| **Bandwidth** | ❌ Limitée | ✅ Illimitée |

### **Conclusion Performance**

- **Upload** : Local légèrement plus rapide (mais négligeable)
- **Serving** : Wasabi plus rapide grâce au CDN global
- **Scalabilité** : Wasabi largement supérieur

## 🔒 Sécurité et Privacy

### **1. Les Données sont-elles Exposées ?**

#### **Configuration Actuelle**

```rust
// backend/src/services/media_storage_service.rs
fn build_public_url(&self, storage_path: &str) -> String {
    // Génère URL publique S3/Wasabi
    format!("{}/{}", base_url, storage_path)
}
```

#### **Options de Sécurité S3/Wasabi**

1. **Bucket Public** (actuel)
   - ✅ URLs publiques directes
   - ⚠️ Accessible à tous avec l'URL
   - ✅ Idéal pour médias publics (images produits)

2. **Bucket Private** (optionnel)
   - ✅ Fichiers privés
   - ✅ URLs signées temporaires (expirent)
   - ✅ Contrôle d'accès via IAM

3. **Bucket avec ACL** (recommandé)
   - ✅ Contrôle granulaire
   - ✅ Certains fichiers publics, d'autres privés
   - ✅ Permissions par utilisateur/service

### **2. Recommandations Sécurité**

#### **Pour Médias Publics (Images Produits)**
```rust
// ✅ Configuration actuelle OK
// URLs publiques directes
// Accessible à tous (comme Instagram, Amazon)
```

#### **Pour Médias Privés (Documents, Preuves)**
```rust
// ✅ À implémenter : URLs signées
let signed_url = s3_client
    .get_presigned_url()
    .expires_in(Duration::from_secs(3600)) // 1 heure
    .generate();
```

### **3. Est-ce que les Géants Utilisent ce Système ?**

#### **OUI, TOUS les Géants Utilisent le Cloud Storage !**

| Plateforme | Service Cloud | Usage |
|------------|---------------|-------|
| **Instagram** | AWS S3 + CloudFront | Toutes les images/vidéos |
| **Facebook** | Facebook CDN (S3-like) | Tous les médias |
| **Amazon** | AWS S3 | Images produits, avis |
| **TikTok** | Cloudflare R2 / S3 | Toutes les vidéos |
| **YouTube** | Google Cloud Storage | Toutes les vidéos |
| **Netflix** | AWS S3 | Tous les contenus |
| **Spotify** | Google Cloud Storage | Tous les fichiers audio |
| **Dropbox** | AWS S3 | Tous les fichiers |
| **Airbnb** | AWS S3 | Toutes les photos |

### **4. Pourquoi les Géants Utilisent le Cloud ?**

1. **Scalabilité** : Millions de fichiers
2. **Performance** : CDN global
3. **Coûts** : Moins cher que serveurs dédiés
4. **Fiabilité** : 99.99% uptime
5. **Sécurité** : Meilleure que serveurs locaux

### **5. Privacy et Conformité**

#### **RGPD / Protection des Données**

- ✅ **S3/Wasabi** : Conforme RGPD
- ✅ **Chiffrement** : HTTPS obligatoire
- ✅ **Localisation** : Choix de la région (EU, US, etc.)
- ✅ **Contrôle** : Vous contrôlez les données

#### **Comparaison**

| Aspect | Stockage Local | S3/Wasabi |
|--------|----------------|-----------|
| **Contrôle** | ✅ Total | ✅ Total (via IAM) |
| **Chiffrement** | ⚠️ Manuel | ✅ Automatique (HTTPS) |
| **Backup** | ❌ Manuel | ✅ Automatique |
| **Conformité** | ⚠️ Votre responsabilité | ✅ Certifié RGPD |

## 🎯 Recommandations

### **1. Configuration Actuelle (OK pour Médias Publics)**

```rust
// ✅ URLs publiques pour images produits
// ✅ Accessible à tous (comme Amazon, Instagram)
// ✅ Performance optimale (CDN)
```

### **2. Améliorations Possibles**

#### **Pour Médias Privés**
```rust
// ✅ Implémenter URLs signées pour documents sensibles
// ✅ Expiration automatique (1h, 24h, etc.)
// ✅ Contrôle d'accès par utilisateur
```

#### **Pour Sécurité Renforcée**
```rust
// ✅ Bucket privé avec IAM policies
// ✅ Chiffrement au repos (S3 SSE)
// ✅ Logs d'accès (CloudTrail)
```

## ✅ Conclusion

### **Rôle de la Table `media`**
- ✅ **Index/Métadonnées** : Référence vers fichiers S3/Wasabi
- ✅ **Recherche** : Permet de trouver rapidement les médias
- ✅ **Historique** : Trace de tous les uploads

### **Limites**
- ✅ **Frontend** : 10-50 MB selon type
- ✅ **Backend** : 200 MB max par requête
- ✅ **S3/Wasabi** : Pas de limite pratique

### **Performance**
- ✅ **Upload** : Local légèrement plus rapide
- ✅ **Serving** : Wasabi plus rapide (CDN)
- ✅ **Scalabilité** : Wasabi largement supérieur

### **Sécurité**
- ✅ **Médias Publics** : Configuration actuelle OK
- ✅ **Médias Privés** : URLs signées recommandées
- ✅ **Conformité** : S3/Wasabi conforme RGPD

### **Géants**
- ✅ **TOUS** utilisent le cloud storage (S3, GCS, etc.)
- ✅ **Standard industriel** : C'est la norme
- ✅ **Sécurisé** : Plus sécurisé que stockage local

**Votre architecture est alignée avec les meilleures pratiques des géants !** 🎉

