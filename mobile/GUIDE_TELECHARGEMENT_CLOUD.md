# 📥 Guide d'utilisation du système de téléchargement cloud

## Vue d'ensemble

Le système de téléchargement cloud permet de récupérer des fichiers (images, vidéos, documents) depuis le cloud (Cloudinary, S3, CDN) et de les afficher dans l'application mobile.

## 🚀 Composants créés

### 1. **Service `cloudDownload.ts`**
Service principal pour télécharger des fichiers depuis le cloud.

### 2. **Hook `useCloudFiles.ts`**
Hook React personnalisé pour faciliter l'intégration.

### 3. **Composant `CloudImage.tsx`**
Composant réutilisable pour afficher des images cloud.

---

## 📖 Utilisation

### Option 1 : Utiliser le composant `CloudImage` (Le plus simple)

```tsx
import CloudImage from '../components/CloudImage';

// Dans votre composant
<CloudImage 
    cloudUrl="https://res.cloudinary.com/demo/image/upload/sample.jpg"
    style={{ width: 200, height: 200, borderRadius: 10 }}
    resizeMode="cover"
/>
```

**Props disponibles :**
- `cloudUrl`: URL du fichier dans le cloud
- `style`: Style du composant
- `resizeMode`: Mode de redimensionnement ('cover', 'contain', etc.)
- `showLoader`: Afficher un loader pendant le téléchargement (défaut: true)
- `showError`: Afficher un message d'erreur (défaut: true)
- `fallback`: Composant à afficher en cas d'erreur
- `loaderColor`: Couleur du loader

**Exemple avec fallback :**
```tsx
<CloudImage 
    cloudUrl={product.image}
    style={styles.productImage}
    fallback={
        <View style={styles.placeholder}>
            <Text>📦</Text>
        </View>
    }
/>
```

---

### Option 2 : Utiliser le hook `useCloudFile`

```tsx
import { useCloudFile } from '../hooks/useCloudFiles';
import { Image, ActivityIndicator } from 'react-native';

function MyComponent() {
    const { localUri, isDownloading, error, retry } = useCloudFile(
        'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        {
            autoDownload: true,
            asBase64: true,
            useCache: true
        }
    );

    if (isDownloading) {
        return <ActivityIndicator />;
    }

    if (error) {
        return <Text>Erreur: {error}</Text>;
    }

    return <Image source={{ uri: localUri }} style={styles.image} />;
}
```

---

### Option 3 : Télécharger plusieurs fichiers avec `useCloudFiles`

```tsx
import { useCloudFiles } from '../hooks/useCloudFiles';

function GalleryComponent({ imageUrls }) {
    const { localUris, isDownloading, progress, error } = useCloudFiles(
        imageUrls,
        {
            autoDownload: true,
            asBase64: true
        }
    );

    if (isDownloading) {
        return (
            <Text>
                Téléchargement {progress.completed}/{progress.total}...
            </Text>
        );
    }

    return (
        <ScrollView horizontal>
            {localUris.map((uri, index) => (
                <Image key={index} source={{ uri }} style={styles.thumbnail} />
            ))}
        </ScrollView>
    );
}
```

---

### Option 4 : Utiliser directement le service `downloadFromCloud`

```tsx
import { downloadFromCloud } from '../services/cloudDownload';

async function downloadImage() {
    const result = await downloadFromCloud(
        'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        {
            asBase64: true,
            fileName: 'my-image.jpg',
            onProgress: (progress) => {
                console.log(`Progression: ${progress.percentage}%`);
            }
        }
    );

    if (result.success) {
        console.log('Image téléchargée:', result.localUri);
        // Utiliser result.localUri ou result.base64
    } else {
        console.error('Erreur:', result.error);
    }
}
```

---

## 🎯 Cas d'usage dans votre application

### 1. **ChatInputMobile** - Afficher les médias envoyés

```tsx
// Dans ChatInputMobile.tsx
import CloudImage from './CloudImage';

// Afficher les images envoyées
{images.map((imageUrl, index) => (
    <CloudImage 
        key={index}
        cloudUrl={imageUrl}
        style={styles.thumbnailImage}
        resizeMode="cover"
    />
))}
```

### 2. **ProductManagerMobile** - Afficher les images de produits

```tsx
// Dans ProductManagerMobile.tsx
import CloudImage from './CloudImage';

{products.map((product) => (
    <View key={product.id} style={styles.productCard}>
        <CloudImage 
            cloudUrl={product.image}
            style={styles.productImage}
            fallback={
                <View style={styles.placeholder}>
                    <Text>📦</Text>
                </View>
            }
        />
        <Text>{product.nom}</Text>
    </View>
))}
```

### 3. **MediaManagerMobile** - Galerie de médias

```tsx
// Dans MediaManagerMobile.tsx
import { useCloudFiles } from '../hooks/useCloudFiles';

function MediaGallery({ mediaFiles }) {
    const { localUris, isDownloading } = useCloudFiles(
        mediaFiles.images,
        { autoDownload: true }
    );

    return (
        <ScrollView horizontal>
            {isDownloading ? (
                <ActivityIndicator />
            ) : (
                localUris.map((uri, index) => (
                    <Image key={index} source={{ uri }} style={styles.image} />
                ))
            )}
        </ScrollView>
    );
}
```

---

## 🔧 Fonctionnalités avancées

### Mise en cache automatique

Les fichiers sont automatiquement mis en cache pour un accès hors ligne :

```tsx
import { cacheCloudFile, clearCloudCache, getCloudCacheSize } from '../services/cloudDownload';

// Mettre en cache un fichier
const cachedUri = await cacheCloudFile(
    'https://example.com/image.jpg',
    'unique-cache-key'
);

// Obtenir la taille du cache
const cacheSize = await getCloudCacheSize();
console.log(`Taille du cache: ${cacheSize} bytes`);

// Nettoyer le cache
await clearCloudCache();
```

### Variants Cloudinary (miniatures)

```tsx
import { getCloudinaryVariants } from '../services/cloudDownload';

const variants = getCloudinaryVariants(
    'https://res.cloudinary.com/demo/image/upload/sample.jpg'
);

// Utiliser les différentes tailles
<CloudImage cloudUrl={variants.thumbnail} /> // 150x150
<CloudImage cloudUrl={variants.medium} />    // 500x500
<CloudImage cloudUrl={variants.large} />     // 1200x1200
<CloudImage cloudUrl={variants.original} />  // Original
```

### Métadonnées de fichier

```tsx
import { getCloudFileMetadata } from '../services/cloudDownload';

const metadata = await getCloudFileMetadata(
    'https://example.com/file.pdf'
);

console.log('Taille:', metadata.size);
console.log('Type:', metadata.type);
console.log('Dernière modification:', metadata.lastModified);
```

---

## ⚙️ Configuration

### Backend API

Le système s'attend à ce que votre backend expose un endpoint d'upload :

```
POST /api/upload
Content-Type: multipart/form-data

FormData:
  - file: le fichier à uploader
  - type: 'image' | 'video' | 'document' | etc.

Response:
{
  "success": true,
  "url": "https://cloudinary.com/...",
  "cloudinaryUrl": "https://cloudinary.com/..."
}
```

---

## 📱 Exemples complets

### Exemple 1 : Liste de produits avec images cloud

```tsx
import React from 'react';
import { View, Text, FlatList } from 'react-native';
import CloudImage from '../components/CloudImage';

function ProductList({ products }) {
    return (
        <FlatList
            data={products}
            renderItem={({ item }) => (
                <View style={styles.productCard}>
                    <CloudImage 
                        cloudUrl={item.imageUrl}
                        style={styles.productImage}
                        showLoader={true}
                        fallback={
                            <View style={styles.noImage}>
                                <Text>📦 Pas d'image</Text>
                            </View>
                        }
                    />
                    <Text style={styles.productName}>{item.name}</Text>
                    <Text style={styles.productPrice}>{item.price} XAF</Text>
                </View>
            )}
            keyExtractor={item => item.id}
        />
    );
}
```

### Exemple 2 : Galerie de photos avec chargement progressif

```tsx
import React, { useState } from 'react';
import { View, ScrollView, Text } from 'react-native';
import { useCloudFiles } from '../hooks/useCloudFiles';
import CloudImage from '../components/CloudImage';

function PhotoGallery({ photoUrls }) {
    const { localUris, isDownloading, progress } = useCloudFiles(photoUrls);

    return (
        <View>
            {isDownloading && (
                <Text>
                    Chargement {progress.completed}/{progress.total} photos...
                </Text>
            )}
            
            <ScrollView horizontal>
                {photoUrls.map((url, index) => (
                    <CloudImage
                        key={index}
                        cloudUrl={url}
                        style={styles.photo}
                        resizeMode="cover"
                    />
                ))}
            </ScrollView>
        </View>
    );
}
```

---

## 🐛 Gestion des erreurs

### Gérer les erreurs avec retry

```tsx
function ImageWithRetry({ cloudUrl }) {
    const { localUri, error, retry, isDownloading } = useCloudFile(cloudUrl);

    if (error) {
        return (
            <View>
                <Text>Erreur: {error}</Text>
                <TouchableOpacity onPress={retry}>
                    <Text>Réessayer</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return <Image source={{ uri: localUri }} />;
}
```

---

## 🎨 Styles recommandés

```tsx
const styles = StyleSheet.create({
    productImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    thumbnail: {
        width: 60,
        height: 60,
        borderRadius: 4,
        marginRight: 8,
    },
    placeholder: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
    },
});
```

---

## ✅ Résumé

1. **Pour afficher une image cloud** → Utiliser `<CloudImage cloudUrl="..." />`
2. **Pour plusieurs images** → Utiliser `useCloudFiles(urls)`
3. **Pour un contrôle total** → Utiliser `downloadFromCloud()`
4. **Cache automatique** → Activé par défaut avec `useCache: true`
5. **Support offline** → Les fichiers en cache restent disponibles

Le système est maintenant intégré et prêt à être utilisé dans `ChatInputMobile`, `MediaManagerMobile` et `ProductManagerMobile` ! 🎉

