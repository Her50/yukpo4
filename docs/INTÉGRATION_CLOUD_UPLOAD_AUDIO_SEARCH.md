# Intégration CloudUpload et AudioSearch dans les composants

## Date: 2025-01-21

## 📋 Résumé

Intégration des services `cloudUploadService` et `audioSearchService` dans trois composants clés du frontend web :
1. **MediaUploadManager** - Nouveau composant avec cloudUploadService
2. **ChatInputPanel** - Intégration audioSearchService pour recherche par audio
3. **ProductManager** - Intégration cloudUploadService pour upload préalable

## ✅ Intégrations réalisées

### 1. MediaUploadManager (Nouveau composant)

**Fichier**: `frontend/src/components/ui/MediaUploadManager.tsx`

**Fonctionnalités**:
- ✅ Upload images/vidéos vers CDN avec `cloudUploadService`
- ✅ Compression automatique des images avant upload
- ✅ Suivi progression upload en temps réel
- ✅ Gestion erreurs avec fallback base64
- ✅ Interface avec indicateurs de progression
- ✅ Support drag & drop (via ProductManager)

**Props**:
```typescript
interface MediaUploadManagerProps {
    images: string[]; // URLs CDN ou base64
    videos: string[]; // URLs CDN ou base64
    onImagesChange: (images: string[]) => void;
    onVideosChange: (videos: string[]) => void;
    readonly?: boolean;
    maxImages?: number;
    maxVideos?: number;
    uploadToCDN?: boolean; // Si true, upload vers CDN
    onUploadProgress?: (type: 'images' | 'videos', completed: number, total: number) => void;
}
```

**Usage**:
```typescript
<MediaUploadManager
    images={product.images}
    videos={product.videos}
    onImagesChange={(images) => setProduct({ ...product, images })}
    onVideosChange={(videos) => setProduct({ ...product, videos })}
    uploadToCDN={true}
    maxImages={10}
    maxVideos={3}
/>
```

### 2. ChatInputPanel - Recherche par audio

**Fichier**: `frontend/src/components/intelligence/ChatInputPanel.tsx`

**Modifications**:
- ✅ Ajout bouton recherche par audio (icône Mic indigo)
- ✅ Intégration `audioSearchService.searchByAudio()`
- ✅ Affichage transcription dans notification toast
- ✅ Redirection vers résultats avec état audioSearch
- ✅ Gestion loading state pendant recherche

**Code ajouté**:
```typescript
// Nouveau bouton recherche par audio
<Tooltip content="Rechercher par audio (transcription automatique)">
  <label className="cursor-pointer">
    {searchingAudio ? (
      <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
    ) : (
      <Mic className="w-6 h-6 text-indigo-600 hover:text-indigo-800" />
    )}
    <input
      type="file"
      accept="audio/*"
      hidden
      onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const result = await audioSearchService.searchByAudio({ audioFile: file });
        
        if (result.success) {
          // Afficher transcription
          toast.success(`🎤 Transcription: "${result.transcription.text}..."`);
          
          // Rediriger vers résultats
          navigate('/resultat-besoin', {
            state: {
              results: result.results,
              audioSearch: true,
              audioTranscription: result.transcription,
            }
          });
        }
      }}
    />
  </label>
</Tooltip>
```

### 3. ProductManager - Upload préalable vers CDN

**Fichier**: `frontend/src/components/ui/ProductManager.tsx`

**Modifications**:
- ✅ `handleFileUpload` modifié pour utiliser `cloudUploadService`
- ✅ Compression images avant upload
- ✅ Upload vers CDN avec fallback base64
- ✅ Gestion erreurs avec retry automatique
- ✅ Notifications toast pour feedback utilisateur

**Code modifié**:
```typescript
const handleFileUpload = async (files: FileList, type: 'images' | 'videos') => {
    // ... validation ...
    
    // Upload vers CDN avec cloudUploadService
    const { cloudUploadService } = await import('@/services/cloudUploadService');
    const { compressImage } = await import('@/utils/mediaCompression');
    
    for (const file of validFiles) {
        if (type === 'images') {
            // Compresser puis uploader
            const compressedBase64 = await compressImage(base64);
            const result = await cloudUploadService.uploadToCloud(
                compressedBase64, 'image', file.name
            );
            
            if (result.success && result.url) {
                uploadedUrls.push(result.url); // URL CDN
            } else {
                uploadedUrls.push(compressedBase64); // Fallback base64
            }
        } else {
            // Vidéos: upload direct
            const result = await cloudUploadService.uploadToCloud(
                file, 'video', file.name
            );
            // ... même logique
        }
    }
    
    // Mettre à jour le produit avec URLs CDN
    setEditingProduct(prev => ({
        ...prev!,
        [type]: [...(prev![type] || []), ...uploadedUrls]
    }));
};
```

## 📊 Flux de données

### Upload média (ProductManager)
```
Fichier sélectionné
  ↓
Compression (images uniquement)
  ↓
cloudUploadService.uploadToCloud()
  ↓
CDN (S3/Wasabi) → URL CDN
  ↓ (si erreur)
Fallback base64
  ↓
Product.images/videos = [URLs CDN ou base64]
```

### Recherche par audio (ChatInputPanel)
```
Fichier audio sélectionné
  ↓
audioSearchService.searchByAudio()
  ↓
Backend: Transcription Whisper API
  ↓
Backend: Recherche sémantique
  ↓
Résultats + Transcription
  ↓
Navigation vers /resultat-besoin
```

## 🎯 Avantages

1. **Performance**: URLs CDN au lieu de base64 volumineux
2. **UX**: Progression upload visible pour l'utilisateur
3. **Fiabilité**: Retry automatique et fallback base64
4. **Fonctionnalités**: Recherche par audio avec transcription
5. **Cohérence**: Même logique que le mobile

## 📝 Notes techniques

- **CDN**: S3/Wasabi via MediaStorageService backend
- **Compression**: Images compressées avant upload (max 2MB)
- **Fallback**: Base64 utilisé si upload CDN échoue
- **Transcription**: Whisper API (OpenAI) via backend
- **Retry**: Géré par cloudUploadService (3 tentatives)

## ✅ Tests recommandés

1. Upload image dans ProductManager → Vérifier URL CDN
2. Upload vidéo volumineuse → Vérifier progression
3. Recherche par audio dans ChatInputPanel → Vérifier transcription
4. Erreur réseau → Vérifier fallback base64
5. Limite fichiers → Vérifier validation




