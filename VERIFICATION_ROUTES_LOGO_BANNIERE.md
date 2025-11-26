# ✅ Vérification routes Logo/Bannière dans ProductCard

## 🔍 Problème détecté

**ProductCard** utilisait directement les chemins relatifs (`uploads/services/123/images/...`) comme URIs pour les images, sans préfixer avec l'URL de l'API.

### Impact

- ❌ Les chemins relatifs ne fonctionnent pas directement dans `<Image source={{ uri: "uploads/..." }}>`
- ❌ Il faut préfixer avec `https://yukpomnang.onrender.com/uploads/...` pour que React Native puisse charger l'image

---

## 🔧 Correction apportée

**Fichier** : `mobile/src/components/ProductCard.tsx`  
**Lignes** : ~205-220

### Ajout de la fonction `buildMediaUrl`

```typescript
// ✅ NOUVEAU 2025-11-26: Helper pour construire l'URL complète d'un média
const buildMediaUrl = (path: string | undefined | null): string | undefined => {
  if (!path || typeof path !== 'string') return undefined;
  
  // Si c'est déjà une URL complète (http/https), la retourner telle quelle
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Si c'est un data URI (base64), le retourner tel quel
  if (path.startsWith('data:')) {
    return path;
  }
  
  // Si c'est un chemin relatif (uploads/...), préfixer avec l'URL de l'API
  if (path.startsWith('uploads/') || path.startsWith('/uploads/')) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${config.API_BASE_URL}${cleanPath}`;
  }
  
  // Sinon, essayer de construire l'URL complète
  return path.startsWith('/') ? `${config.API_BASE_URL}${path}` : `${config.API_BASE_URL}/${path}`;
};
```

### Utilisation dans ProductCard

**Logo** :
```typescript
const serviceLogoImage = buildMediaUrl(
  firstNonEmptyString(
    service?.data?.logo?.valeur,
    service?.data?.logo,
  )
);
```

**Bannière** :
```typescript
const serviceBannerImage = buildMediaUrl(
  firstNonEmptyString(
    service?.data?.banner?.valeur,
    service?.data?.banner,
    service?.data?.banniere?.valeur,
    service?.data?.banniere,
  )
);
```

**Toutes les images** (via `addImage`) :
```typescript
const addImage = (uri?: string | null) => {
  if (!uri) return;
  // ✅ Construire l'URL complète pour les chemins relatifs
  const fullUrl = buildMediaUrl(uri);
  if (!fullUrl) return;
  if (orderedImages.includes(fullUrl)) return;
  orderedImages.push(fullUrl);
};
```

---

## ✅ Résultat

### Avant correction
```typescript
// ❌ Ne fonctionne pas
const logoUrl = "uploads/services/123/images/logo_uuid.png";
<Image source={{ uri: logoUrl }} />  // Erreur : chemin relatif
```

### Après correction
```typescript
// ✅ Fonctionne
const logoUrl = buildMediaUrl("uploads/services/123/images/logo_uuid.png");
// Résultat : "https://yukpomnang.onrender.com/uploads/services/123/images/logo_uuid.png"
<Image source={{ uri: logoUrl }} />  // ✅ Charge correctement
```

---

## 📊 Formats supportés

La fonction `buildMediaUrl` gère tous les formats :

| Format | Exemple | Résultat |
|--------|---------|----------|
| **URL complète** | `https://example.com/image.jpg` | ✅ Retourné tel quel |
| **Data URI** | `data:image/png;base64,...` | ✅ Retourné tel quel |
| **Chemin relatif** | `uploads/services/123/images/logo.png` | ✅ Préfixé avec API_BASE_URL |
| **Chemin absolu** | `/uploads/services/123/images/logo.png` | ✅ Préfixé avec API_BASE_URL |

---

## 🔍 Backend - Route de service des fichiers

**Fichier** : `backend/src/lib.rs`  
**Ligne** : ~309

```rust
.nest_service("/uploads", uploads_service)
```

Le backend sert les fichiers statiques via `/uploads`, donc :
- Chemin sauvegardé : `uploads/services/123/images/logo.png`
- URL complète : `https://yukpomnang.onrender.com/uploads/services/123/images/logo.png`
- ✅ Accessible via HTTP GET

---

## ✅ Vérification complète

### Logo
- [x] Extrait depuis `service.data.logo.valeur`
- [x] URL construite avec `buildMediaUrl`
- [x] Préfixé avec `config.API_BASE_URL` si chemin relatif
- [x] Accessible via `/uploads/services/{id}/images/logo.png`

### Bannière
- [x] Extrait depuis `service.data.banner.valeur` ou `service.data.banniere.valeur`
- [x] URL construite avec `buildMediaUrl`
- [x] Préfixé avec `config.API_BASE_URL` si chemin relatif
- [x] Accessible via `/uploads/services/{id}/images/banner.png`

### Images produits
- [x] Extrait depuis `product.images` (array)
- [x] URLs construites avec `buildMediaUrl` via `addImage`
- [x] Préfixées avec `config.API_BASE_URL` si chemins relatifs

### Images service
- [x] Extrait depuis `service.images` (array)
- [x] URLs construites avec `buildMediaUrl` via `addImage`
- [x] Préfixées avec `config.API_BASE_URL` si chemins relatifs

---

## 🎯 Conclusion

**ProductCard utilise maintenant les bonnes routes pour accéder au logo et à la bannière** :

1. ✅ Les chemins relatifs sont automatiquement préfixés avec `config.API_BASE_URL`
2. ✅ Les URLs complètes sont conservées telles quelles
3. ✅ Les data URIs (base64) sont conservés tels quels
4. ✅ Toutes les images (logo, bannière, produits, service) utilisent la même logique
5. ✅ Compatible avec le service statique `/uploads` du backend

**Aucune action supplémentaire requise.**

