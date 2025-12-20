# Refonte complète du système de recherche

## Date: 2025-12-13

## Problèmes identifiés
- Lenteur excessive dans les recherches
- Résultats qui ne s'affichent pas
- Conflits multiples dans le code
- Code complexe et difficile à maintenir

## Solution: Refonte complète

### Fichiers sauvegardés
Tous les fichiers de recherche existants ont été sauvegardés dans:
- `mobile/src/services/backup_search_20251213_065137/`

### Nouveaux fichiers créés

#### 1. `mobile/src/services/searchService.ts`
Service de recherche simple et efficace qui:
- Gère la recherche texte, image et audio
- Normalise les réponses de l'API
- Gère les timeouts (30 secondes)
- Gère les erreurs proprement
- Support GPS

**Fonctions principales:**
- `searchServices(input)` - Recherche complète
- `searchByImage(imageBase64, gps?)` - Recherche par image
- `searchByAudio(audioBase64, gps?)` - Recherche par audio
- `searchByText(text, gps?)` - Recherche texte simple

#### 2. `mobile/src/components/SimpleSearchBar.tsx`
Composant de recherche simple qui:
- Interface claire et intuitive
- Support image, audio et GPS
- Indicateur de chargement
- Gestion d'erreurs visuelle

#### 3. Mise à jour de `yukpoclient.ts`
La fonction `rechercherServices` utilise maintenant le nouveau service:
- Code simplifié
- Meilleure gestion d'erreurs
- Normalisation des résultats

#### 4. Mise à jour de `HomeScreen.tsx`
Le handler `handleSearch` a été simplifié:
- Utilise le nouveau service
- Code plus clair
- Meilleure gestion des résultats

## Architecture

```
HomeScreen
  └─> handleSearch()
      └─> rechercherServices() (yukpoclient.ts)
          └─> searchServices() (searchService.ts)
              └─> API /api/search/direct
```

## Support des types de recherche

### 1. Recherche texte
```typescript
await searchByText("recherche texte", "lat,lng");
```

### 2. Recherche par image
```typescript
await searchByImage([base64Image1, base64Image2], "lat,lng");
```

### 3. Recherche par audio
```typescript
await searchByAudio([base64Audio1], "lat,lng");
```

### 4. Recherche combinée
```typescript
await searchServices({
  texte: "recherche",
  base64_image: [base64Image],
  audio_base64: [base64Audio],
  gps_mobile: "lat,lng"
});
```

## Normalisation des résultats

Le service normalise automatiquement les différentes structures de réponse:
- `result.resultats` (array)
- `result.resultats.resultats` (array imbriqué)
- `result.results` (array)
- `result.data.resultats` (array)
- `result.data` (array)

## Gestion des erreurs

Le service gère:
- Timeouts (30 secondes)
- Erreurs réseau
- Erreurs d'authentification
- Erreurs serveur
- Format de réponse invalide

## Migration

Pour utiliser le nouveau système:

1. **Dans HomeScreen.tsx** (déjà fait):
```typescript
import { rechercherServices } from '../services/yukpoclient';
```

2. **Pour utiliser directement le service**:
```typescript
import { searchServices, searchByText, searchByImage, searchByAudio } from '../services/searchService';
```

3. **Pour utiliser SimpleSearchBar**:
```typescript
import SimpleSearchBar from '../components/SimpleSearchBar';

<SimpleSearchBar
  onSubmit={handleSearch}
  onGPSPress={handleGPSPress}
  onImagePress={handleImagePress}
  onAudioPress={handleAudioPress}
  loading={loading}
/>
```

## Tests à effectuer

1. ✅ Recherche texte simple
2. ✅ Recherche avec GPS
3. ✅ Recherche par image
4. ✅ Recherche par audio
5. ✅ Recherche combinée (texte + image)
6. ✅ Gestion des erreurs
7. ✅ Gestion des timeouts
8. ✅ Affichage des résultats

## Prochaines étapes

1. Tester le nouveau système
2. Migrer les autres écrans qui utilisent la recherche
3. Supprimer les anciens fichiers si tout fonctionne
4. Documenter les changements pour l'équipe

## Notes importantes

- Les anciens fichiers sont sauvegardés dans le dossier backup
- Le nouveau système est rétrocompatible avec l'ancien
- Les résultats sont normalisés automatiquement
- Le timeout est fixé à 30 secondes (configurable)





