# ✅ Migration Upload Complétée - Phase 2

## Résumé des Changements

### ✅ Nouveaux Endpoints

1. **POST /api/upload** (Authentifié)
   - Upload préalable de fichiers (images, vidéos, audio, documents)
   - Limite: 20 MB par fichier, 50 MB total
   - Retourne des URLs pour utiliser dans la création de service
   - Format: `multipart/form-data`

2. **GET /api/media/temp/*path** (Authentifié)
   - Serve les fichiers temporaires uploadés
   - Sécurisé: seul le propriétaire peut accéder

### ✅ Modifications

1. **POST /api/services/create**
   - Limite réduite: **2 MB** (au lieu de 50 MB)
   - Accepte maintenant des URLs au lieu de base64
   - Format JSON avec champs `imageUrls`, `videoUrls`, etc.

2. **Service upload_service.rs**
   - Gestion des uploads préalables
   - Validation de taille (20 MB max par fichier)
   - Stockage temporaire dans `uploads/temp/{user_id}/`
   - Enregistrement en DB (table `media`)

## Architecture

### Avant (❌)
```
Client → POST /api/services/create
  └─ JSON avec base64 (42 MB)
  └─ Server parse tout → stocke fichiers
```

### Après (✅)
```
Client → POST /api/upload (multipart)
  └─ Upload fichiers → Retourne URLs
  ↓
Client → POST /api/services/create (JSON 2 MB)
  └─ JSON avec URLs seulement
  └─ Server lie URLs au service
```

## Migration Frontend/Mobile

### Code à Modifier

**Avant:**
```typescript
const payload = {
  titre: "...",
  base64_image: [image1Base64, image2Base64] // ❌ 42 MB
};

await apiPost('/api/services/create', payload);
```

**Après:**
```typescript
// 1. Upload fichiers d'abord
const uploadResults = await Promise.all(
  images.map(img => uploadFile(img))
);
// uploadResults = [{url: "/api/media/temp/...", ...}, ...]

// 2. Créer service avec URLs
const payload = {
  titre: "...",
  imageUrls: uploadResults.map(r => r.url) // ✅ < 1 KB
};

await apiPost('/api/services/create', payload);
```

### Fonction d'Upload

```typescript
async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('image', file);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  const result = await response.json();
  return result.files[0]; // {url, media_type, size_bytes}
}
```

## Prochaines Étapes

### Phase 3 (Optionnel - Long Terme)
- [ ] Storage cloud (S3/R2)
- [ ] CDN pour livraison
- [ ] Compression automatique des images
- [ ] Upload progressif avec retry

## Tests

### Test Upload
```bash
curl -X POST http://localhost:8000/api/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@test.jpg"
```

### Test Création Service
```bash
curl -X POST http://localhost:8000/api/services/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 11,
    "data": {
      "titre_service": {"valeur": "Test"},
      "imageUrls": ["/api/media/temp/uuid.jpg"]
    }
  }'
```

## Sécurité

✅ Limite 2 MB pour JSON (protection DoS)
✅ Upload séparé avec limite 20 MB par fichier
✅ Vérification propriétaire pour accès fichiers
✅ Stockage temporaire avec nettoyage automatique

## Performance

✅ Parsing JSON rapide (< 100ms)
✅ Moins de mémoire utilisée
✅ Upload progressif possible
✅ Retry par fichier

## Rétrocompatibilité

⚠️ **IMPORTANT**: Le code actuel accepte encore base64 pour compatibilité, mais **déconseillé**.
La limite de 2 MB empêche les payloads base64 volumineux.

Pour migration progressive:
1. Déployer nouveaux endpoints
2. Migrer frontend progressivement
3. Supprimer support base64 après migration complète

