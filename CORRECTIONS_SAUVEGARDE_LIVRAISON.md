# Corrections - Sauvegarde Configuration Livraison Produit

## 🔍 Problèmes identifiés

### 1. **Problème principal : `preparation_time_minutes` manquant**

**Symptôme** : Erreur de sauvegarde après création d'un produit - la configuration de livraison ne peut pas être sauvegardée.

**Cause** : 
- Le backend attend `preparation_time_minutes` dans `ProductDeliveryConfigInput` (ligne 564 de `delivery_model.rs`)
- Le backend vérifie que `preparation_time_minutes` est défini (>= 0) pour considérer la configuration comme complète (ligne 577-578 de `delivery_routes.rs`)
- Le frontend n'envoyait **PAS** ce champ dans la requête POST

**Impact** : 
- La configuration est toujours considérée comme incomplète (`is_configured = false`)
- Le produit ne peut pas être activé pour la livraison

### 2. **Problème secondaire : Requêtes répétées vers `saved-addresses`**

**Symptôme** : Logs montrent de nombreuses requêtes GET vers `/api/delivery/saved-addresses` en très peu de temps.

**Cause** : 
- Le hook `useSavedAddresses` dans `mobile/src/hooks/useSavedAddresses.ts` a un `useEffect` qui appelle `fetchAddresses()` 
- Le `useCallback` `fetchAddresses` dépend de `addressType`, ce qui peut causer des re-renders
- Le cache de 5 secondes peut ne pas être suffisant si le composant se re-render très souvent

**Impact** : 
- Charge inutile sur le serveur
- Latence accrue pour l'utilisateur

## ✅ Corrections apportées

### 1. Frontend - `ProductDeliveryConfigModal.tsx`

#### a) Ajout de `preparation_time_minutes` dans l'interface `DeliveryConfig`
```typescript
interface DeliveryConfig {
    // ... autres champs
    preparation_time_minutes?: number; // ✅ Temps de préparation en minutes
    // ...
}
```

#### b) Ajout du champ dans l'état initial
```typescript
const [config, setConfig] = useState<DeliveryConfig>({
    // ...
    preparation_time_minutes: undefined,
    // ...
});
```

#### c) Ajout du champ dans `loadExistingConfig`
```typescript
preparation_time_minutes: data.config.preparation_time_minutes || undefined,
```

#### d) Ajout de la validation côté frontend
```typescript
if (config.preparation_time_minutes === undefined || config.preparation_time_minutes < 0) {
    toast({
        title: "Erreur",
        description: "Le temps de préparation est obligatoire (0 pour instantané)",
    });
    return;
}
```

#### e) Ajout du champ dans les requêtes POST (mode transversal et normal)
```typescript
body: JSON.stringify({
    // ...
    preparation_time_minutes: config.preparation_time_minutes,
    // ...
})
```

#### f) Ajout du champ UI dans le formulaire
```tsx
<div>
    <Label>Temps de préparation (minutes) *</Label>
    <Input
        type="number"
        min="0"
        step="1"
        value={config.preparation_time_minutes ?? ''}
        onChange={(e) => setConfig(prev => ({ 
            ...prev, 
            preparation_time_minutes: e.target.value ? parseInt(e.target.value) : undefined 
        }))}
        placeholder="0 pour instantané, ou nombre de minutes"
    />
    <p className="text-xs text-gray-500 mt-1">
        Temps nécessaire pour préparer le produit avant la collecte (0 = disponible immédiatement)
    </p>
</div>
```

#### g) Amélioration de la gestion d'erreur
```typescript
} else {
    let errorMessage = "Erreur lors de la sauvegarde";
    try {
        const error = await response.json();
        errorMessage = error.message || error.error || errorMessage;
        console.error('[ProductDeliveryConfigModal] Erreur backend:', error);
    } catch (e) {
        console.error('[ProductDeliveryConfigModal] Erreur parsing réponse:', e);
        errorMessage = `Erreur ${response.status}: ${response.statusText}`;
    }
    toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive"
    });
}
```

## 📋 Vérifications à faire

1. ✅ Vérifier que le champ `preparation_time_minutes` est bien affiché dans le modal
2. ✅ Tester la sauvegarde d'une configuration après création d'un produit
3. ✅ Vérifier que `is_configured = true` après sauvegarde complète
4. ⚠️ Optimiser les appels répétés à `saved-addresses` (à faire)

## 🔧 Optimisations futures recommandées

### Pour `useSavedAddresses` :
1. Augmenter le cache à 10-15 secondes
2. Utiliser un `useRef` pour éviter les re-renders inutiles
3. Ajouter un debounce sur les appels
4. Utiliser React Query ou SWR pour la gestion du cache

### Pour le backend :
1. Ajouter un rate limiting sur `/api/delivery/saved-addresses`
2. Implémenter un cache Redis pour les adresses sauvegardées
3. Ajouter des logs de monitoring pour détecter les appels répétés

## 📝 Notes

- Le backend vérifie que `preparation_time_minutes >= 0` (0 est valide pour instantané)
- Le backend considère la configuration complète si :
  - `pickup_address` non vide
  - `required_vehicle_type_id > 0`
  - `pickup_availability_schedule` non vide
  - `preparation_time_minutes` défini (>= 0)

