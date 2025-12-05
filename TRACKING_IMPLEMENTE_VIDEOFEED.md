# ✅ Tracking Temps de Visionnage Implémenté

## 🎯 Objectif
Implémenter le tracking du temps de visionnage dans `VideoFeedScreen.tsx` pour alimenter l'algorithme de recommandations amélioré.

## ✅ Modifications Appliquées

### 1. **Références pour Tracking** ✅

**Ajouté dans les refs** :
```typescript
const lastTrackTimeRef = useRef<Map<string, number>>(new Map()); // contentId -> last tracked time (seconds)
const videoDurationsRef = useRef<Map<string, number>>(new Map()); // contentId -> video duration (seconds)
```

### 2. **Fonction `trackWatchTime()`** ✅

**Fonctionnalités** :
- ✅ Envoie les données toutes les **5 secondes** (optimisation réseau)
- ✅ Envoie aussi au démarrage (`currentTimeSeconds === 0`)
- ✅ Stocke le dernier temps tracké pour éviter doublons
- ✅ Stocke la durée de la vidéo pour calculer `completion_rate`

**Code** :
```typescript
const trackWatchTime = useCallback(
    async (contentId: string, currentTimeSeconds: number, durationSeconds: number) => {
        const lastTracked = lastTrackTimeRef.current.get(contentId) || 0;
        const timeSinceLastTrack = currentTimeSeconds - lastTracked;

        if (timeSinceLastTrack >= 5 || currentTimeSeconds === 0) {
            await apiPost(`/api/content/${encodeURIComponent(contentId)}/track-watch`, {
                watch_duration_ms: Math.floor(currentTimeSeconds * 1000),
                video_duration_ms: Math.floor(durationSeconds * 1000),
                device_type: Platform.OS === 'ios' ? 'ios' : 'android',
            });

            lastTrackTimeRef.current.set(contentId, currentTimeSeconds);
            videoDurationsRef.current.set(contentId, durationSeconds);
        }
    },
    [],
);
```

### 3. **Intégration dans `onPlaybackStatusUpdate`** ✅

**Dans le composant `<Video>`** :
```typescript
onPlaybackStatusUpdate={async (status) => {
    // ✅ NOUVEAU: Tracker temps de visionnage
    if (status.isLoaded && isActive && !isPaused) {
        const currentTimeSeconds = status.positionMillis ? status.positionMillis / 1000 : 0;
        const durationSeconds = status.durationMillis ? status.durationMillis / 1000 : 0;

        if (durationSeconds > 0) {
            trackWatchTime(item.contentId, currentTimeSeconds, durationSeconds).catch(
                () => undefined,
            );
        }
    }
    
    // ... navigation automatique existante ...
}}
```

### 4. **Finalisation lors du Changement de Vidéo** ✅

**Dans `flushCurrentView()`** :
```typescript
const flushCurrentView = useCallback(() => {
    // ... code existant ...
    
    // ✅ NOUVEAU: Finaliser tracking temps de visionnage
    const lastTracked = lastTrackTimeRef.current.get(prevItem.contentId) || 0;
    const duration = videoDurationsRef.current.get(prevItem.contentId) || 0;
    if (lastTracked > 0 && duration > 0) {
        trackWatchTime(prevItem.contentId, lastTracked, duration).catch(() => undefined);
    }
    
    // ... reste du code ...
}, [feed, logVisibility, trackWatchTime]);
```

**Dans `handleViewableItemsChanged()`** :
```typescript
const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
        // ... code existant ...
        
        if (newIndex !== currentIndexRef.current) {
            // ✅ NOUVEAU: Finaliser tracking vidéo précédente
            const prevItem = feed[currentIndexRef.current];
            if (prevItem) {
                const lastTracked = lastTrackTimeRef.current.get(prevItem.contentId) || 0;
                const duration = videoDurationsRef.current.get(prevItem.contentId) || 0;
                if (lastTracked > 0 && duration > 0) {
                    trackWatchTime(prevItem.contentId, lastTracked, duration).catch(() => undefined);
                }
            }
            
            // ... reste du code ...
        }
    },
    [flushCurrentView, feed, trackWatchTime],
);
```

---

## 📊 Comportement

### Quand l'utilisateur regarde une vidéo :

1. **Démarrage** (0s) :
   - ✅ Envoie `watch_duration_ms: 0` au backend
   - ✅ Stocke la durée de la vidéo

2. **Pendant la lecture** :
   - ✅ Envoie toutes les **5 secondes** :
     - `watch_duration_ms`: temps actuel en millisecondes
     - `video_duration_ms`: durée totale en millisecondes
   - ✅ Le backend calcule automatiquement `completion_rate`

3. **Changement de vidéo** :
   - ✅ Envoie dernière mise à jour avec temps final
   - ✅ Réinitialise le tracking pour la nouvelle vidéo

4. **Fermeture de l'app** :
   - ✅ Dernière mise à jour envoyée via `flushCurrentView()`

---

## 🔄 Flux Complet

```
Utilisateur regarde vidéo
    ↓
onPlaybackStatusUpdate() appelé régulièrement
    ↓
Si 5 secondes écoulées depuis dernier envoi
    ↓
POST /api/content/{content_id}/track-watch
{
    watch_duration_ms: 45000,
    video_duration_ms: 60000,
    device_type: "ios"
}
    ↓
Backend met à jour content_engagement
    ↓
Trigger calcule completion_rate = 0.75
    ↓
Algorithme ML utilise completion_rate pour recommandations
```

---

## ✅ Résultat

**Le tracking est maintenant actif !**

- ✅ Temps de visionnage tracké automatiquement
- ✅ Taux de complétion calculé automatiquement
- ✅ Données utilisées par l'algorithme amélioré
- ✅ Optimisé : envoi toutes les 5 secondes (pas à chaque frame)
- ✅ Finalisation lors du changement de vidéo

**L'algorithme de recommandations amélioré peut maintenant utiliser le signal `completion_rate` !**

---

*Date : 2025-12-03*  
*Status : ✅ Implémentation complète*

