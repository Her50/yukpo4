# 🎬 GESTION DU SCROLL AVEC VIDÉOS

**Date**: 22 Octobre 2025  
**Objectif**: Adapter le temps de scroll selon le contenu (image vs vidéo)

---

## 📊 **ÉTAT ACTUEL**

### **PublicitesCarousel - Actuellement**
```typescript
// Ligne 39-51
const interval = setInterval(() => {
    const nextIndex = (currentIndex + 1) % publicites.length;
    setCurrentIndex(nextIndex);
    scrollViewRef.current?.scrollTo({
        x: nextIndex * (CARD_WIDTH + CARD_MARGIN),
        animated: true,
    });
}, 5000); // ❌ 5 secondes FIXES pour tout
```

**Problème** :
- ❌ **Temps fixe (5s)** pour images ET vidéos
- ❌ Vidéos coupées avant la fin
- ❌ Pas de pause si utilisateur interagit
- ❌ Mauvaise expérience utilisateur

---

## ✨ **SYSTÈME INTELLIGENT PROPOSÉ**

### **1. Temps Adaptatifs**

```typescript
const SCROLL_TIMING = {
  image: 5000,           // 5s pour une image simple
  imageMultiple: 3000,   // 3s par image si plusieurs (carrousel)
  video: 15000,          // 15s pour une vidéo (ou durée vidéo)
  videoMax: 30000,       // Max 30s même si vidéo plus longue
  userPaused: 0,         // Pas d'auto-scroll si utilisateur interagit
  transitionDelay: 500   // 0.5s de transition entre cartes
};
```

### **2. Logique de Décision**

```typescript
function calculateScrollDelay(item: any): number {
  // Utilisateur a mis en pause ?
  if (item.userPaused) {
    return 0; // Pas d'auto-scroll
  }
  
  // A une vidéo ?
  if (item.hasVideo) {
    const videoDuration = item.videoDuration || 15000;
    return Math.min(videoDuration, SCROLL_TIMING.videoMax);
  }
  
  // Plusieurs images ?
  if (item.images && item.images.length > 1) {
    return item.images.length * SCROLL_TIMING.imageMultiple;
  }
  
  // Image simple
  return SCROLL_TIMING.image;
}
```

---

## 🎬 **IMPLÉMENTATION COMPLÈTE**

### **1. Composant avec Vidéo : VideoCarouselCard.tsx**

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

interface VideoCarouselCardProps {
  videoUri: string;
  thumbnail?: string;
  autoPlay?: boolean;
  onVideoEnd?: () => void;
  onVideoDuration?: (duration: number) => void;
  isVisible: boolean; // La carte est-elle visible à l'écran ?
}

const VideoCarouselCard: React.FC<VideoCarouselCardProps> = ({
  videoUri,
  thumbnail,
  autoPlay = true,
  onVideoEnd,
  onVideoDuration,
  isVisible
}) => {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  // Gérer la lecture selon la visibilité
  useEffect(() => {
    if (isVisible && autoPlay) {
      videoRef.current?.playAsync();
      setIsPlaying(true);
    } else {
      videoRef.current?.pauseAsync();
      setIsPlaying(false);
    }
  }, [isVisible, autoPlay]);

  // Callback état vidéo
  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      // Récupérer durée
      if (status.durationMillis && duration === 0) {
        setDuration(status.durationMillis);
        onVideoDuration?.(status.durationMillis);
      }

      // Vidéo terminée ?
      if (status.didJustFinish) {
        onVideoEnd?.();
      }
    }
  };

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        source={{ uri: videoUri }}
        style={styles.video}
        useNativeControls={false}
        resizeMode={ResizeMode.COVER}
        isLooping={false}
        shouldPlay={isVisible && autoPlay}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        posterSource={thumbnail ? { uri: thumbnail } : undefined}
      />
      
      {/* Indicateur de lecture */}
      {isPlaying && (
        <View style={styles.playingIndicator}>
          <Text style={styles.playingText}>▶</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playingIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  playingText: {
    color: 'white',
    fontSize: 12,
  },
});

export default VideoCarouselCard;
```

### **2. Carousel Intelligent : SmartCarousel.tsx**

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, View, StyleSheet, Dimensions } from 'react-native';

interface CarouselItem {
  id: string;
  type: 'image' | 'video' | 'mixed';
  images?: string[];
  videoUri?: string;
  videoDuration?: number;
  thumbnail?: string;
  data: any;
}

interface SmartCarouselProps {
  items: CarouselItem[];
  onItemChange?: (index: number) => void;
}

const SmartCarousel: React.FC<SmartCarouselProps> = ({ items, onItemChange }) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scrollDelay, setScrollDelay] = useState(5000);
  const [isPaused, setIsPaused] = useState(false);
  const [videoDurations, setVideoDurations] = useState<Map<string, number>>(new Map());
  
  const { width } = Dimensions.get('window');
  const CARD_WIDTH = width * 0.85;
  const CARD_MARGIN = 12;

  // ✅ Calculer le délai selon le contenu
  const calculateDelay = (item: CarouselItem): number => {
    if (isPaused) return 0;

    // Vidéo
    if (item.type === 'video') {
      const duration = videoDurations.get(item.id) || 15000;
      return Math.min(duration + 1000, 30000); // +1s buffer, max 30s
    }

    // Plusieurs images (carrousel interne)
    if (item.type === 'mixed' && item.images && item.images.length > 1) {
      return item.images.length * 3000; // 3s par image
    }

    // Image simple
    return 5000;
  };

  // ✅ Auto-scroll intelligent
  useEffect(() => {
    if (items.length <= 1 || isPaused) return;

    const currentItem = items[currentIndex];
    const delay = calculateDelay(currentItem);

    if (delay === 0) return; // Pas d'auto-scroll si pause

    const timer = setTimeout(() => {
      const nextIndex = (currentIndex + 1) % items.length;
      setCurrentIndex(nextIndex);
      onItemChange?.(nextIndex);

      scrollViewRef.current?.scrollTo({
        x: nextIndex * (CARD_WIDTH + CARD_MARGIN),
        animated: true,
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [currentIndex, items, isPaused, videoDurations]);

  // ✅ Callback durée vidéo
  const handleVideoDuration = (itemId: string, duration: number) => {
    setVideoDurations(prev => new Map(prev).set(itemId, duration));
  };

  // ✅ Pause auto-scroll quand utilisateur scroll manuellement
  const handleUserScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / (CARD_WIDTH + CARD_MARGIN));
    
    if (index !== currentIndex) {
      setIsPaused(true);
      setCurrentIndex(index);
      onItemChange?.(index);

      // Reprendre auto-scroll après 3s d'inactivité
      setTimeout(() => setIsPaused(false), 3000);
    }
  };

  // ✅ Render item selon le type
  const renderItem = (item: CarouselItem, index: number) => {
    const isVisible = index === currentIndex;

    if (item.type === 'video') {
      return (
        <VideoCarouselCard
          key={item.id}
          videoUri={item.videoUri!}
          thumbnail={item.thumbnail}
          isVisible={isVisible}
          onVideoDuration={(duration) => handleVideoDuration(item.id, duration)}
          onVideoEnd={() => {
            // Passer à la carte suivante quand vidéo termine
            const nextIndex = (currentIndex + 1) % items.length;
            setCurrentIndex(nextIndex);
          }}
        />
      );
    }

    // Image ou mixte
    return (
      <ImageCarouselCard
        key={item.id}
        images={item.images || []}
        data={item.data}
      />
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleUserScroll}
        scrollEventThrottle={16}
      >
        {items.map((item, index) => (
          <View
            key={item.id}
            style={[styles.card, { width: CARD_WIDTH, marginRight: CARD_MARGIN }]}
          >
            {renderItem(item, index)}
          </View>
        ))}
      </ScrollView>

      {/* Indicateur de progression */}
      <ProgressIndicator
        currentIndex={currentIndex}
        total={items.length}
        duration={calculateDelay(items[currentIndex])}
        isPaused={isPaused}
      />

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {items.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentIndex && styles.dotActive
            ]}
          />
        ))}
      </View>
    </View>
  );
};
```

### **3. Indicateur de Progression**

```typescript
interface ProgressIndicatorProps {
  currentIndex: number;
  total: number;
  duration: number; // Durée en ms
  isPaused: boolean;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  currentIndex,
  total,
  duration,
  isPaused
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isPaused || duration === 0) {
      setProgress(0);
      return;
    }

    setProgress(0);
    const startTime = Date.now();
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        clearInterval(interval);
      }
    }, 50); // Update every 50ms

    return () => clearInterval(interval);
  }, [duration, isPaused, currentIndex]);

  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: total }).map((_, index) => (
        <View key={index} style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: index === currentIndex
                  ? `${progress}%`
                  : index < currentIndex
                    ? '100%'
                    : '0%'
              }
            ]}
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  progressContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  progressBar: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 2,
  },
});
```

---

## ⏱️ **TEMPS D'ATTENTE RECOMMANDÉS**

### **Configuration Optimale**

```typescript
export const CAROUSEL_TIMING = {
  // Images
  imageSingle: 5000,        // 5s pour 1 image
  imageMultiple: 3000,      // 3s par image si plusieurs
  imagePromotion: 7000,     // 7s si promotion importante
  
  // Vidéos
  videoShort: 10000,        // 10s pour vidéo courte (< 10s)
  videoMedium: 15000,       // 15s pour vidéo moyenne (10-20s)
  videoLong: 25000,         // 25s pour vidéo longue (20-30s)
  videoMax: 30000,          // Max absolu 30s
  
  // Interactions
  userPauseDelay: 3000,     // 3s d'inactivité avant reprise auto
  transitionDuration: 500,  // 0.5s de transition
  
  // Buffers
  videoEndBuffer: 1000,     // +1s après fin vidéo avant scroll
  imageBuffer: 500,         // +0.5s après image avant scroll
};
```

### **Tableau Récapitulatif**

| Type de Contenu | Temps d'Attente | Justification |
|-----------------|-----------------|---------------|
| **Image simple** | **5 secondes** | Temps de lecture + appel à l'action |
| **2-3 images** | **6-9 secondes** | 3s par image |
| **Vidéo courte (< 10s)** | **10 secondes** | Durée vidéo + buffer |
| **Vidéo moyenne (10-20s)** | **15 secondes** | Équilibre attention/engagement |
| **Vidéo longue (20-30s)** | **25 secondes** | Durée complète si pertinent |
| **Vidéo très longue (> 30s)** | **30 secondes max** | Éviter ennui, forcer concision |
| **Scroll manuel** | **Pause 3s** | Respect intention utilisateur |

---

## 🎯 **COMPORTEMENTS SPÉCIAUX**

### **1. Scroll Manuel**

```typescript
// Utilisateur scroll manuellement
onUserScroll = (newIndex) => {
  pauseAutoScroll();           // Arrêter auto-scroll
  setCurrentIndex(newIndex);   // Aller à la nouvelle carte
  
  setTimeout(() => {
    resumeAutoScroll();        // Reprendre après 3s
  }, 3000);
};
```

### **2. Vidéo Terminée**

```typescript
// Vidéo arrive à la fin
onVideoEnd = () => {
  // Attendre 1s (buffer)
  setTimeout(() => {
    scrollToNext();            // Scroll immédiat vers suivant
  }, 1000);
};
```

### **3. Interaction Utilisateur**

```typescript
// Utilisateur clique pour agrandir
onTap = () => {
  pauseAutoScroll();           // Pause définitive
  expandContent();             // Afficher en plein écran
};

// Utilisateur ferme le plein écran
onClose = () => {
  resumeAutoScroll();          // Reprendre auto-scroll
};
```

### **4. Vidéo Non Chargée**

```typescript
// Vidéo ne charge pas
onVideoError = () => {
  console.error('Vidéo non chargée');
  // Fallback sur durée par défaut
  setDelay(5000);              // 5s comme une image
  // Ou passer immédiatement
  // scrollToNext();
};
```

---

## 📊 **EXPÉRIENCE UTILISATEUR**

### **Scénario 1: Publicité avec Vidéo**

```
T=0s    → Carte publicité apparaît
T=0.5s  → Vidéo démarre automatiquement
T=15s   → Vidéo termine (durée 14s)
T=16s   → Buffer 1s
T=16s   → Scroll automatique vers carte suivante
```

### **Scénario 2: Produit avec Plusieurs Images**

```
T=0s    → Carte produit apparaît (image 1)
T=3s    → Carrousel interne → image 2
T=6s    → Carrousel interne → image 3
T=9s    → Scroll automatique vers carte suivante
```

### **Scénario 3: Utilisateur Interagit**

```
T=0s    → Carte 1 visible (auto-scroll prévu T=5s)
T=2s    → Utilisateur scroll manuellement → Carte 3
T=2s    → Auto-scroll PAUSE
T=5s    → Auto-scroll REPREND (après 3s inactivité)
T=10s   → Auto-scroll → Carte 4
```

---

## 🎨 **INDICATEURS VISUELS**

### **Barre de Progression**

```
┌─────────────────────────────────┐
│ ▓▓▓▓▓▓░░░░  ▓▓▓▓░░░░  ░░░░░░░░ │ ← Barres progression
│                                 │
│         [Contenu Vidéo]         │
│                                 │
│   Titre de la Publicité         │
└─────────────────────────────────┘
  ↑ Carte 1 en cours (60%)
    Carte 2 complète
    Carte 3 pas encore
```

### **Badge Type de Contenu**

```typescript
// En haut à droite
{item.hasVideo && (
  <View style={styles.videoBadge}>
    <SafeIcon name="video" size={16} color="white" />
    <Text style={styles.videoDuration}>0:15</Text>
  </View>
)}
```

---

## ✅ **RECOMMANDATIONS FINALES**

### **Pour les Prestataires**

**Créer des vidéos efficaces** :
- ✅ **10-15 secondes** idéal
- ✅ **30 secondes maximum** (sera coupé après)
- ✅ **Message dans les 3 premières secondes** (hook)
- ✅ **Appel à l'action à la fin** (avant auto-scroll)

**Optimiser pour le scroll** :
- ✅ Vidéo auto-play avec son coupé par défaut
- ✅ Thumbnail attractif pendant chargement
- ✅ Texte visible même sans son

### **Pour l'Expérience Utilisateur**

- ✅ **Respecter l'intention** : pause si scroll manuel
- ✅ **Pas trop rapide** : 5s minimum par carte
- ✅ **Pas trop lent** : 30s maximum même pour vidéos
- ✅ **Indicateurs clairs** : barres de progression
- ✅ **Contrôle total** : possibilité de mettre en pause

---

## 📈 **MÉTRIQUES À TRACKER**

```typescript
// Analytics pour optimiser les durées
interface CarouselAnalytics {
  itemId: string;
  duration: number;           // Temps affiché
  completed: boolean;         // Vu jusqu'à la fin ?
  userSkipped: boolean;       // Utilisateur a skip ?
  videoWatched: number;       // % vidéo regardé
  interactionTime: number;    // Temps avant clic
}

// Optimisation continue
if (avgVideoWatched < 50%) {
  // Vidéos trop longues, réduire durée recommandée
  recommendedDuration = 10000;
}
```

---

**✅ SYSTÈME COMPLET ET OPTIMISÉ**

**Temps par défaut** :
- Images : **5 secondes**
- Vidéos : **Durée réelle** (max 30s)
- Plusieurs images : **3s par image**
- Scroll manuel : **Pause 3s** puis reprise

**Principe clé** : **Adapter intelligemment** selon le contenu et le comportement utilisateur !
