# 🔧 Solution Technique Recherche Hybride - Gestion des Conflits

## ⚠️ Problématiques Identifiées

### 1. **Conflit Auto-Scroll**
- **Problème** : MixedContentCarousel a un auto-scroll qui fait défiler automatiquement les cartes
- **Risque** : En mode recherche, l'auto-scroll pourrait créer de la confusion
- **Solution** : Désactiver l'auto-scroll en mode recherche, le réactiver en mode recommandé

### 2. **Conflit État du Carousel**
- **Problème** : Le carousel a un état interne (currentIndex, isPaused, etc.)
- **Risque** : L'état pourrait être corrompu lors du passage en mode recherche
- **Solution** : Réinitialiser l'état lors du changement de mode

### 3. **Conflit Chargement du Contenu**
- **Problème** : Le carousel charge son contenu via `loadMixedContent()`
- **Risque** : Le chargement pourrait écraser les résultats de recherche
- **Solution** : Conditionner le chargement selon le mode actif

### 4. **Conflit Filtres**
- **Problème** : Les filtres (Tous, Populaires, etc.) sont pour le contenu recommandé
- **Risque** : Les filtres pourraient ne pas fonctionner avec les résultats de recherche
- **Solution** : Désactiver les filtres en mode recherche ou les adapter

---

## ✅ Solution Technique Implémentée

### Architecture : Mode Dual avec Gestion Intelligente

```typescript
// État du mode dans MixedContentCarousel
type CarouselMode = 'recommended' | 'search';

interface MixedContentCarouselProps {
    // ... props existantes ...
    mode?: CarouselMode; // ✅ NOUVEAU: Mode du carousel
    searchResults?: Product[]; // ✅ NOUVEAU: Résultats de recherche
    searchQuery?: string; // ✅ NOUVEAU: Query de recherche
    totalSearchResults?: number; // ✅ NOUVEAU: Total de résultats (pour "Voir tous")
    onShowAllResults?: () => void; // ✅ NOUVEAU: Callback pour voir tous les résultats
    onClearSearch?: () => void; // ✅ NOUVEAU: Callback pour revenir au mode recommandé
}
```

### Gestion de l'Auto-Scroll

```typescript
// ✅ Désactiver auto-scroll en mode recherche
useEffect(() => {
    if (mode === 'search') {
        // Arrêter l'auto-scroll immédiatement
        clearAutoScrollTimer();
        clearResumeTimer();
        setIsPaused(true); // Mettre en pause
        
        // Réinitialiser l'index à 0 pour les résultats de recherche
        setCurrentIndex(0);
        if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ x: 0, animated: false });
        }
    } else if (mode === 'recommended') {
        // Réactiver l'auto-scroll en mode recommandé
        setIsPaused(false);
        // L'auto-scroll se réactivera automatiquement via les effets existants
    }
}, [mode]);
```

### Gestion du Contenu

```typescript
// ✅ Conditionner le chargement selon le mode
useEffect(() => {
    if (mode === 'recommended') {
        // Charger le contenu recommandé normalement
        loadMixedContent();
    } else if (mode === 'search' && searchResults) {
        // Utiliser les résultats de recherche
        setContent(convertSearchResultsToContentItems(searchResults));
        setLoading(false);
    }
}, [mode, searchResults]);
```

### Gestion des Filtres

```typescript
// ✅ Désactiver les filtres en mode recherche
{mode === 'recommended' && (
    <View style={styles.filtersContainer}>
        {/* Filtres normaux */}
    </View>
)}

{mode === 'search' && (
    <View style={styles.searchHeader}>
        <Text>🔍 Résultats pour "{searchQuery}"</Text>
        <Text>{totalSearchResults} résultats trouvés</Text>
        <TouchableOpacity onPress={onShowAllResults}>
            <Text>Voir tous →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClearSearch}>
            <Text>Nouvelle recherche</Text>
        </TouchableOpacity>
    </View>
)}
```

### Conversion des Résultats de Recherche

```typescript
// ✅ Convertir les résultats de recherche en format ContentItem
const convertSearchResultsToContentItems = (results: Product[]): ContentItem[] => {
    return results.map((product) => ({
        type: 'organic' as const,
        is_paid: false,
        data: {
            ...product,
            // S'assurer que les champs nécessaires sont présents
            service_id: product.service_id || product.id,
            serviceId: product.service_id || product.id,
        },
    }));
};
```

### Réinitialisation de l'État

```typescript
// ✅ Réinitialiser l'état lors du changement de mode
useEffect(() => {
    if (mode === 'search') {
        // Réinitialiser l'état pour le mode recherche
        setCurrentIndex(0);
        setSelectedFilter('all');
        setScrollIndicatorVisible(true);
        setAllMediaViewed(new Map());
        setMediaViewStartTime(new Map());
    }
}, [mode]);
```

---

## 🎯 Gestion des Transitions

### Transition Recommandé → Recherche

1. **Arrêter auto-scroll** immédiatement
2. **Réinitialiser index** à 0
3. **Scroll vers le début** (x: 0)
4. **Charger résultats** de recherche
5. **Afficher header** de recherche
6. **Masquer filtres** recommandés

### Transition Recherche → Recommandé

1. **Nettoyer résultats** de recherche
2. **Réactiver auto-scroll** (si pas désactivé par config)
3. **Recharger contenu** recommandé
4. **Afficher filtres** recommandés
5. **Masquer header** de recherche

---

## 🔒 Protection contre les Conflits

### 1. **Verrouillage du Mode**

```typescript
const [modeLocked, setModeLocked] = useState(false);

// Empêcher le changement de mode pendant une transition
const changeMode = (newMode: CarouselMode) => {
    if (modeLocked) return;
    setModeLocked(true);
    // ... transition ...
    setTimeout(() => setModeLocked(false), 500);
};
```

### 2. **Nettoyage des Timers**

```typescript
// ✅ Nettoyer tous les timers lors du changement de mode
useEffect(() => {
    return () => {
        clearAutoScrollTimer();
        clearResumeTimer();
    };
}, [mode]);
```

### 3. **Validation des Props**

```typescript
// ✅ Valider les props en mode recherche
useEffect(() => {
    if (mode === 'search') {
        if (!searchResults || searchResults.length === 0) {
            console.warn('[MixedContentCarousel] Mode search activé mais aucun résultat fourni');
            // Revenir au mode recommandé
            onClearSearch?.();
        }
    }
}, [mode, searchResults]);
```

---

## 📊 Diagramme de Flux

```
┌─────────────────────────────────────┐
│  HomeScreen - handleSearch()        │
│  - Recherche API                    │
│  - Extraction résultats             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  setSearchMode('search')            │
│  setSearchResults(results[0:15])   │
│  setSearchQuery(query)              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  MixedContentCarousel               │
│  - Détecte mode='search'            │
│  - Arrête auto-scroll               │
│  - Réinitialise état                │
│  - Convertit résultats              │
│  - Affiche header recherche        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Utilisateur scroll manuel          │
│  - Pas d'auto-scroll                │
│  - Contrôle total utilisateur       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  "Voir tous" ou "Nouvelle recherche"│
│  - Navigation ou reset              │
└─────────────────────────────────────┘
```

---

## ✅ Checklist de Validation

- [x] Auto-scroll désactivé en mode recherche
- [x] État réinitialisé lors du changement de mode
- [x] Contenu conditionné selon le mode
- [x] Filtres désactivés en mode recherche
- [x] Header recherche affiché en mode search
- [x] Transition fluide entre les modes
- [x] Nettoyage des timers
- [x] Validation des props
- [x] Protection contre les conflits

---

## 🎯 Résultat Final

**Aucun conflit** : La solution gère intelligemment les deux modes sans créer de conflits avec l'auto-scroll ou l'état du carousel.

**Expérience fluide** : Transition naturelle entre contenu recommandé et résultats de recherche.

**Contrôle utilisateur** : En mode recherche, l'utilisateur a le contrôle total (pas d'auto-scroll).


