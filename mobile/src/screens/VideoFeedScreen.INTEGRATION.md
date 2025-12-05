# Guide d'intégration des améliorations dans VideoFeedScreen

## Modifications à apporter

### 1. Imports à ajouter (ligne ~1-36)

```typescript
// Ajouter ces imports
import { VideoGestureHandler } from '../components/video/VideoGestureHandler';
import { DoubleTapLike } from '../components/video/DoubleTapLike';
import { ImmersiveVideoPlayer } from '../components/video/ImmersiveVideoPlayer';
import { ProgressIndicator } from '../components/video/ProgressIndicator';
import { videoPreloadService } from '../services/videoPreloadService';
import { triggerHaptic } from '../utils/hapticFeedback';
```

### 2. États à ajouter (dans le composant, ~ligne 371)

```typescript
const [showDoubleTapLike, setShowDoubleTapLike] = useState(false);
const [controlsVisible, setControlsVisible] = useState(true);
```

### 3. Initialiser le service de préchargement (useEffect, après loadFeed)

```typescript
useEffect(() => {
    videoPreloadService.initialize();
}, []);

// Précharger après chargement du feed
useEffect(() => {
    if (feed.length > 0) {
        videoPreloadService.preloadNextVideos(
            feed.map(item => ({ id: item.id, videoUrl: item.videoUrl, thumbnail: item.thumbnail })),
            currentIndex
        );
    }
}, [feed, currentIndex]);
```

### 4. Handlers de gestes à ajouter

```typescript
const handleSwipeUp = useCallback(() => {
    if (currentIndex < feed.length - 1) {
        const nextIndex = currentIndex + 1;
        flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        setCurrentIndex(nextIndex);
    }
}, [currentIndex, feed.length]);

const handleSwipeDown = useCallback(() => {
    if (currentIndex > 0) {
        const prevIndex = currentIndex - 1;
        flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
        setCurrentIndex(prevIndex);
    }
}, [currentIndex]);

const handleDoubleTapLike = useCallback(() => {
    const currentItem = feed[currentIndex];
    if (currentItem) {
        setShowDoubleTapLike(true);
        handleLike(currentItem);
        triggerHaptic('medium');
    }
}, [currentIndex, feed, handleLike]);

const handleSwipeLeft = useCallback(() => {
    const currentItem = feed[currentIndex];
    if (currentItem) {
        handleLike(currentItem);
        triggerHaptic('light');
    }
}, [currentIndex, feed, handleLike]);

const handleSwipeRight = useCallback(() => {
    const currentItem = feed[currentIndex];
    if (currentItem) {
        handleSave(currentItem);
        triggerHaptic('light');
    }
}, [currentIndex, feed, handleSave]);
```

### 5. Modifier renderItem pour intégrer les composants (~ligne 1427)

Remplacer le contenu de `renderItem` pour utiliser `VideoGestureHandler` et les nouveaux composants :

```typescript
const renderItem = useCallback(
    ({ item, index }: { item: FeedItem; index: number }) => {
        const isActive = index === currentIndex;
        
        return (
            <VideoGestureHandler
                onSwipeUp={handleSwipeUp}
                onSwipeDown={handleSwipeDown}
                onSwipeLeft={handleSwipeLeft}
                onSwipeRight={handleSwipeRight}
                onDoubleTap={handleDoubleTapLike}
                enabled={isActive}
            >
                <View style={[styles.slide, { height: SCREEN_HEIGHT }]}>
                    <ImmersiveVideoPlayer
                        source={{ uri: item.videoUrl }}
                        isActive={isActive}
                        isPaused={isPaused}
                        onTogglePause={togglePause}
                        onLike={() => handleLike(item)}
                        onComment={() => setCommentTarget(item)}
                        onShare={() => handleShare(item)}
                        onSkip={handleSkip}
                        showControls={controlsVisible}
                    />
                    
                    <DoubleTapLike
                        visible={showDoubleTapLike && isActive}
                        onAnimationComplete={() => setShowDoubleTapLike(false)}
                    />
                    
                    <ProgressIndicator
                        currentIndex={currentIndex}
                        totalVideos={feed.length}
                        showRemainingCount={true}
                    />
                </View>
            </VideoGestureHandler>
        );
    },
    [currentIndex, isPaused, feed, handleLike, handleShare, handleSkip, togglePause, controlsVisible, showDoubleTapLike]
);
```

### 6. Utiliser le cache vidéo

Dans `loadFeed`, après avoir chargé les vidéos, vérifier le cache :

```typescript
// Après avoir chargé le feed
for (const item of feed) {
    const cachedPath = await videoPreloadService.getCachedPath(item.id);
    if (cachedPath) {
        item.videoUrl = cachedPath; // Utiliser la version en cache
    }
}
```

