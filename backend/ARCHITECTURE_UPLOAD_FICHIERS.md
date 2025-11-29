# Architecture Upload de Fichiers - Bonnes Pratiques

## Pourquoi Limiter la Taille des Requêtes HTTP ?

### 1. 🔒 **Sécurité - Protection DoS (Déni de Service)**

**Risque sans limite** :
- Un attaquant peut envoyer des requêtes de 10 GB+ pour saturer :
  - La mémoire du serveur
  - La bande passante
  - Les ressources CPU (parsing JSON, traitement)
- **Résultat** : Serveur indisponible pour les utilisateurs légitimes

**Avec limite** :
- L'attaque est bloquée rapidement (vérification du Content-Length)
- Le serveur reste disponible
- Les ressources sont préservées

### 2. ⚡ **Performance**

**Problèmes avec payloads volumineux** :
- **Parsing JSON** : Un JSON de 50 MB prend plusieurs secondes à parser
- **Mémoire** : 50 MB en mémoire × 100 requêtes simultanées = 5 GB RAM
- **Réseau** : Upload de 50 MB sur connexion lente = 10-30 secondes
- **Timeout** : Risque de timeout côté client/serveur

**Avec limite raisonnable** :
- Parsing rapide (< 100ms)
- Moins de mémoire utilisée
- Meilleure expérience utilisateur

### 3. 💰 **Coûts Infrastructure**

**Sans limite** :
- Plus de bande passante = coûts élevés
- Plus de mémoire = serveurs plus puissants
- Plus de CPU = facture cloud élevée

### 4. 🛡️ **Protection Ressources Serveur**

**Risques** :
- **Buffer overflow** : Données trop volumineuses peuvent causer des crashes
- **Timeouts** : Requêtes longues bloquent les connexions
- **Base de données** : Insertion de 50 MB en une fois = lock DB

---

## Problème Actuel : Base64 dans JSON

### Architecture Actuelle (❌ Non Optimal)

```rust
// ❌ PROBLÈME : Images en base64 dans le JSON
pub struct MultiModalInput {
    pub base64_image: Option<Vec<String>>, // Image de 1 MB devient 1.33 MB en base64
}
```

**Problèmes** :
1. **Base64 augmente la taille de ~33%** : Image 10 MB → 13.3 MB en base64
2. **Tout en une requête** : JSON + images = payload énorme
3. **Parsing lent** : Parseur JSON doit traiter tout le base64
4. **Pas de progression** : Impossible d'afficher la progression de l'upload
5. **Pas de retry intelligent** : Si échec, tout est perdu

**Exemple** :
- 3 images de 10 MB chacune = 30 MB
- En base64 = 40 MB
- + JSON texte = **42 MB total** (observé dans les logs)

---

## Solutions Recommandées (✅ Bonnes Pratiques)

### Option 1 : Upload Multipart/Form-Data (Recommandé)

**Avantages** :
- ✅ Pas de base64 (économise 33% de taille)
- ✅ Upload séparé des fichiers
- ✅ Progression visible
- ✅ Retry possible par fichier

**Architecture** :
```rust
// ✅ CORRECT : Upload séparé
POST /api/services/{id}/upload-image
Content-Type: multipart/form-data

// Puis création du service avec URLs
POST /api/services/create
{
  "titre": "...",
  "images": ["https://cdn.yukpo.com/img123.jpg", ...]
}
```

**Limite recommandée** : 10-20 MB par fichier (pas pour tout le payload)

---

### Option 2 : Upload Préalable vers Storage Cloud

**Architecture** :
1. Client upload vers `/api/upload` → retourne URL
2. Client crée service avec URLs des fichiers

**Avantages** :
- ✅ Pas de charge sur le serveur principal
- ✅ CDN pour livraison rapide
- ✅ Scalable (S3, Cloudflare R2, etc.)
- ✅ Compression automatique possible

**Code** :
```typescript
// 1. Upload fichiers
const uploadedUrls = await Promise.all(
  images.map(img => uploadToCloud(img))
);

// 2. Créer service avec URLs
await createService({
  titre: "...",
  imageUrls: uploadedUrls
});
```

---

### Option 3 : Streaming/Chunked Upload

**Pour très gros fichiers** :
- Découper en chunks
- Upload progressif
- Recomposition côté serveur

**Avantages** :
- ✅ Fichiers très volumineux (vidéos)
- ✅ Reprise sur erreur
- ✅ Moins de mémoire

---

## Recommandations Spécifiques pour Yukpomnang

### Limites Recommandées

| Type | Limite | Justification |
|------|--------|---------------|
| **JSON seul** | 1-2 MB | Données texte suffisantes |
| **Image (base64 temporaire)** | 10 MB | En attendant refactorisation |
| **Image upload séparé** | 20 MB | Bon compromis qualité/taille |
| **Vidéo upload** | 100 MB | Via endpoint dédié |
| **Total requête JSON** | 5 MB | Sécurité + performance |

### Plan de Migration

#### Phase 1 : Court Terme (✅ Fait)
- ✅ Limite 50 MB pour permettre fonctionnement actuel
- ✅ Logs pour monitorer les payloads

#### Phase 2 : Moyen Terme (🔨 À Faire)
1. **Endpoint upload dédié** :
   ```
   POST /api/upload/image
   POST /api/upload/video
   ```
2. **Retourner URLs** au lieu de stocker base64
3. **Limiter création service** à 2 MB (JSON uniquement)

#### Phase 3 : Long Terme (📋 Idéal)
1. **Storage cloud** (S3/R2)
2. **CDN** pour livraison
3. **Compression automatique** des images
4. **Upload progressif** avec retry

---

## Configuration Actuelle vs Recommandée

### Actuelle (Temporaire)
```rust
// ❌ Limite élevée pour contourner le problème
DefaultBodyLimit::max(50_000_000) // 50 MB
```

**Problème** : Accepte des payloads énormes = risques sécurité/performance

### Recommandée (Long Terme)
```rust
// ✅ Limite raisonnable pour JSON
DefaultBodyLimit::max(2_000_000) // 2 MB pour création service

// ✅ Limite spécifique pour upload
POST /api/upload/image
DefaultBodyLimit::max(20_000_000) // 20 MB par fichier
```

---

## Conclusion

**Les limites sont nécessaires** pour :
1. 🔒 Sécurité (protection DoS)
2. ⚡ Performance (parsing rapide)
3. 💰 Coûts (optimisation infrastructure)
4. 🛡️ Fiabilité (éviter timeouts/crashes)

**Mais** la vraie solution n'est pas d'augmenter la limite à l'infini, mais de :
1. ✅ Séparer upload de fichiers du JSON
2. ✅ Utiliser storage cloud
3. ✅ Compresser les images
4. ✅ Optimiser l'architecture

**Action immédiate** : 50 MB est acceptable temporairement, mais planifier la migration vers upload séparé.

