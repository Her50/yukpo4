# 📊 Guide d'Intégration Tracking Métriques - Frontend

## 🎯 Routes de Tracking Disponibles

### 1. Carrousel Produits

**Endpoint** : `POST /api/metrics/track/product-carousel`

**Payload** :
```typescript
{
  carousel_id: string;
  action: "scroll" | "auto_scroll" | "view" | "click" | "pause" | "resume";
  item_id?: string;
}
```

**Exemple** :
```typescript
await fetch(`${API_BASE_URL}/api/metrics/track/product-carousel`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    carousel_id: 'homepage-featured',
    action: 'view',
    item_id: 'product-123'
  })
});
```

---

### 2. Carrousel Vidéos

**Endpoint** : `POST /api/metrics/track/video-carousel`

**Payload** :
```typescript
{
  carousel_id: string;
  action: "scroll" | "auto_scroll" | "view" | "play" | "pause" | "engagement";
  video_id?: string;
  engagement_type?: "like" | "share" | "comment";
}
```

**Exemple** :
```typescript
await fetch(`${API_BASE_URL}/api/metrics/track/video-carousel`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    carousel_id: 'trending-videos',
    action: 'play',
    video_id: 'video-456'
  })
});
```

---

### 3. Navigation ResultaBesoinScreen

**Endpoint** : `POST /api/metrics/track/navigation`

**Payload** :
```typescript
{
  action: "view" | "search" | "filter" | "click" | "geolocation_search" | "map_interaction";
  query_type?: "keyword" | "category" | "location";
  filter_type?: "price" | "category" | "location" | "rating";
  item_type?: "service" | "product";
  item_id?: string;
  results_count?: number;
  has_results?: boolean;
  map_action?: "zoom" | "pan" | "marker_click";
}
```

**Exemple** :
```typescript
await fetch(`${API_BASE_URL}/api/metrics/track/navigation`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'search',
    query_type: 'keyword',
    results_count: 15,
    has_results: true
  })
});
```

---

### 4. Promotions Globales

**Endpoint** : `POST /api/metrics/track/global-promo-entry`

**Payload** :
```typescript
{
  action: "view" | "click" | "catalog_page_view" | "catalog_search";
  entry_id?: string;
}
```

**Exemple** :
```typescript
await fetch(`${API_BASE_URL}/api/metrics/track/global-promo-entry`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'view',
    entry_id: 'entry-789'
  })
});
```

---

## 🔧 Helper Function (Recommandé)

**Créer un helper** : `frontend/src/utils/metricsTracking.ts`

```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://yukpomnang.onrender.com';

export const trackProductCarousel = async (
  carouselId: string,
  action: string,
  itemId?: string
) => {
  try {
    await fetch(`${API_BASE_URL}/api/metrics/track/product-carousel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carousel_id: carouselId, action, item_id: itemId })
    });
  } catch (error) {
    console.error('Erreur tracking carousel:', error);
  }
};

export const trackVideoCarousel = async (
  carouselId: string,
  action: string,
  videoId?: string
) => {
  try {
    await fetch(`${API_BASE_URL}/api/metrics/track/video-carousel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carousel_id: carouselId, action, video_id: videoId })
    });
  } catch (error) {
    console.error('Erreur tracking vidéo:', error);
  }
};

export const trackNavigation = async (action: string, data?: any) => {
  try {
    await fetch(`${API_BASE_URL}/api/metrics/track/navigation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data })
    });
  } catch (error) {
    console.error('Erreur tracking navigation:', error);
  }
};

export const trackGlobalPromo = async (action: string, entryId?: string) => {
  try {
    await fetch(`${API_BASE_URL}/api/metrics/track/global-promo-entry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, entry_id: entryId })
    });
  } catch (error) {
    console.error('Erreur tracking promo:', error);
  }
};
```

---

## 📝 Points d'Intégration Frontend

### 1. PublicitesCarousel.tsx

**À ajouter** :
- `trackProductCarousel('homepage', 'view', productId)` - Quand un produit est visible
- `trackProductCarousel('homepage', 'click', productId)` - Quand un produit est cliqué
- `trackProductCarousel('homepage', 'pause')` - Quand le scroll automatique est mis en pause
- `trackProductCarousel('homepage', 'resume')` - Quand le scroll automatique reprend

### 2. Composants Vidéo

**À ajouter** :
- `trackVideoCarousel('trending', 'view', videoId)` - Quand une vidéo est visible
- `trackVideoCarousel('trending', 'play', videoId)` - Quand une vidéo est jouée
- `trackVideoCarousel('trending', 'pause', videoId)` - Quand une vidéo est mise en pause
- `trackVideoCarousel('trending', 'engagement', videoId, 'like')` - Quand un utilisateur like

### 3. ResultaBesoinScreen.tsx

**À ajouter** :
- `trackNavigation('view')` - Quand l'écran est affiché
- `trackNavigation('search', { query_type: 'keyword', results_count: 10, has_results: true })` - Quand une recherche est effectuée
- `trackNavigation('filter', { filter_type: 'price' })` - Quand un filtre est appliqué
- `trackNavigation('click', { item_type: 'service', item_id: '123' })` - Quand un item est cliqué

---

**Les routes sont prêtes ! Il reste à intégrer les appels dans le frontend.** ✅

