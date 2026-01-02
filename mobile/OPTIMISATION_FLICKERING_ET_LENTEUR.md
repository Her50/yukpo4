# Optimisation Flickering et Lenteur - ResultatBesoinScreen

## Problèmes identifiés

1. **N+1 Queries** : `UltraModernServiceCard` chargeait les reviews et stats individuellement pour chaque service
2. **Re-renders inutiles** : La Map `prestataires` changeait de référence même sans changements réels
3. **LocationContext** : Mise à jour de la location toutes les 5 secondes causant des re-renders dans tous les composants
4. **Flickering** : Les cartes produits tremblaient lors du chargement et de l'affichage

## Solutions implémentées

### 1. Chargement batch des reviews et stats

**Fichier modifié** : `mobile/src/screens/ResultatBesoinScreen.tsx`

- Utilisation du hook `useServicesBatchData` pour charger les reviews et stats de tous les services en une seule requête
- Passage des données en props à `UltraModernServiceCard` au lieu de les charger individuellement
- Réduction drastique du nombre de requêtes API (de N requêtes à 2 requêtes batch)

```typescript
// Chargement batch pour tous les services
const { data: batchData, loading: batchLoading } = useServicesBatchData(serviceIdsForBatch, serviceCreatedAtsMap);

// Passage en props
<UltraModernServiceCard
    reviews={serviceBatchData?.reviews.reviews || []}
    reviewsStats={serviceBatchData?.reviews.stats || null}
    serviceStats={serviceBatchData?.stats.stats || null}
    // ...
/>
```

### 2. Mémorisation de la Map prestataires

**Fichier modifié** : `mobile/src/screens/ResultatBesoinScreen.tsx`

- Utilisation d'un `useRef` pour mémoriser la Map `prestataires`
- Mise à jour uniquement si les données ont réellement changé
- Réduction des re-renders causés par les changements de référence

```typescript
const prestatairesRef = useRef<Map<string, Prestataire>>(new Map());

// Vérifier les changements avant de mettre à jour
if (hasPrestatairesChanges) {
    prestatairesRef.current = newPrestataires;
    setPrestataires(newPrestataires);
}
```

### 3. Optimisation LocationContext

**Fichier modifié** : `mobile/src/contexts/LocationContext.tsx`

- Augmentation de l'intervalle de mise à jour de 5s à 30s
- Augmentation de la distance minimale de 10m à 50m
- Mise à jour uniquement si la distance a changé significativement (> 50m)
- Réduction des re-renders dans tous les composants utilisant `useLocation`

```typescript
timeInterval: 30000, // 30 secondes au lieu de 5
distanceInterval: 50, // 50 mètres au lieu de 10

// Ne mettre à jour que si la distance a changé de plus de 50 mètres
if (distanceM < 50) {
    return; // Ignorer cette mise à jour
}
```

### 4. Modification UltraModernServiceCard

**Fichier modifié** : `mobile/src/components/UltraModernServiceCard.tsx`

- Ajout de props optionnelles pour les reviews et stats (batch)
- Utilisation des props si disponibles, sinon fallback sur les hooks individuels
- Mise à jour de `React.memo` pour inclure les nouvelles props dans la comparaison

```typescript
interface UltraModernServiceCardProps {
    reviews?: Review[];
    reviewsStats?: ServiceReviewsStats | null;
    serviceStats?: ServiceStats | null;
    // ...
}
```

## Résultats attendus

1. **Réduction des requêtes API** : De N requêtes (reviews + stats) à 2 requêtes batch
2. **Réduction des re-renders** : 
   - Map prestataires : Réduction de ~90% des re-renders inutiles
   - LocationContext : Réduction de ~83% des mises à jour (de 5s à 30s)
3. **Élimination du flickering** : Les cartes ne tremblent plus grâce à la mémorisation et au chargement batch
4. **Amélioration des performances** : Temps de chargement réduit grâce au batch loading

## Tests recommandés

1. Vérifier que les reviews et stats sont bien chargées en batch
2. Vérifier que le flickering a disparu sur `ResultatBesoinScreen`
3. Vérifier que les re-renders sont réduits (utiliser React DevTools Profiler)
4. Vérifier que la location ne se met à jour que toutes les 30s ou si la distance change de > 50m


