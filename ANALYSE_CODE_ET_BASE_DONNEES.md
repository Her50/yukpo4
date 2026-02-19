# 🔍 Analyse Code et Base de Données - Problèmes Identifiés

**Date** : 2026-02-19  
**Projet** : yukpo-project

---

## 🚨 PROBLÈME CRITIQUE #1 : Pas de Debounce sur Autocomplete Google Places

### Fichier : `mobile/src/components/ModernGPSModal.tsx`

**Ligne 177** : `handleSearchQueryChange` est appelée **directement** à chaque frappe, **SANS debounce** !

```typescript
// ❌ PROBLÈME : Pas de debounce réel
const handleSearchQueryChange = async (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim() || query.length < 3) {
        return;
    }
    
    // ⚠️ APPEL DIRECT À L'API À CHAQUE FRAPPE !
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&location=${locationBias.lat},${locationBias.lng}&radius=50000&key=${GOOGLE_MAPS_API_KEY}&language=fr`;
    
    const response = await fetch(url); // ← APPEL IMMÉDIAT, PAS DE DÉLAI !
    // ...
};
```

**Ligne 612** : Utilisé directement dans `onChangeText` :
```typescript
<TextInput
    onChangeText={handleSearchQueryChange} // ← Appelé à chaque frappe !
    // ...
/>
```

### Impact

Si un utilisateur tape "Douala" (7 caractères) :
- **Sans debounce** : 7 appels API (un par caractère)
- **Avec debounce 500ms** : 1 appel API (après 500ms d'inactivité)

**Si une boucle infinie ou un bug fait que cette fonction est appelée en continu** :
- **29 appels/seconde** = 2,505,600 appels/jour
- **5 millions d'appels en 2 jours** = POSSIBLE !

---

## 🔧 SOLUTION #1 : Ajouter un Debounce

### Correction à Appliquer

**Fichier** : `mobile/src/components/ModernGPSModal.tsx`

```typescript
// ✅ AJOUTER : Hook useDebounce ou setTimeout
import { useRef } from 'react';

const ModernGPSModal: React.FC<ModernGPSModalProps> = ({ ... }) => {
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    
    // ✅ CORRIGÉ : Ajouter debounce de 500ms
    const handleSearchQueryChange = async (query: string) => {
        setSearchQuery(query);
        
        // ✅ ANNULER le timer précédent
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        
        if (!query.trim() || query.length < 3) {
            setPlaceSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        
        // ✅ ATTENDRE 500ms avant d'appeler l'API
        debounceTimerRef.current = setTimeout(async () => {
            try {
                const GOOGLE_MAPS_API_KEY = ENVIRONMENT.GOOGLE_MAPS_API_KEY;
                
                if (!GOOGLE_MAPS_API_KEY) {
                    return;
                }
                
                // ... reste du code ...
                const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?...`;
                const response = await fetch(url);
                // ...
            } catch (error) {
                console.error('[ModernGPSModal] Erreur autocomplete:', error);
            }
        }, 500); // ✅ DEBOUNCE 500ms
    };
    
    // ✅ NETTOYER le timer au démontage
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);
};
```

---

## 🔍 PROBLÈME #2 : LocationSelector.tsx - Debounce Incomplet

### Fichier : `mobile/src/components/LocationSelector.tsx`

**Ligne 548** : Utilise `useMemo` pour "debounce" mais ce n'est pas un vrai debounce :

```typescript
// ⚠️ PROBLÈME : useMemo n'est pas un debounce, c'est juste une mémorisation
const debouncedQuery = useMemo(() => query.trim(), [query]);

useEffect(() => {
    // ⚠️ S'exécute IMMÉDIATEMENT quand debouncedQuery change
    // Pas de délai réel !
    if (!debouncedQuery || debouncedQuery.length < 2) {
        return;
    }
    
    // Appel API immédiat
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?...`;
    // ...
}, [debouncedQuery, finalScope, cityContext, userLocation]);
```

### Solution

Utiliser un vrai debounce avec `setTimeout` ou un hook `useDebounce` :

```typescript
// ✅ CORRIGÉ : Vrai debounce
const [debouncedQuery, setDebouncedQuery] = useState('');

useEffect(() => {
    const timer = setTimeout(() => {
        setDebouncedQuery(query.trim());
    }, 500); // ✅ Délai de 500ms
    
    return () => clearTimeout(timer);
}, [query]);

useEffect(() => {
    // Maintenant s'exécute seulement après 500ms d'inactivité
    if (!debouncedQuery || debouncedQuery.length < 2) {
        return;
    }
    // ... appel API ...
}, [debouncedQuery]);
```

---

## 🗄️ PROBLÈME #3 : Base de Données PostgreSQL - Secret DATABASE_URL

### Fichiers Récents Analysés

1. **`CLARIFICATION_BASE_DONNEES_FINALE.md`** (2026-02-18)
   - ✅ Base à utiliser : `yukpo_db` (362 migrations, 263 tables)
   - ❌ Base à ne PAS utiliser : `yukpo_postgres` (vide, 0 migrations)

2. **`SOLUTION_DEFINITIVE_DATABASE_URL.md`** (2026-02-18)
   - 🔴 Problème : Conflit entre deux workflows
   - `docker-build-optimized.yml` utilise `GCP_DATABASE_URL` (GitHub Secret)
   - `gcp-deploy.yml` utilise `database-url:latest` (GCP Secret Manager)
   - **Solution** : Supprimer `DATABASE_URL` de `docker-build-optimized.yml`

3. **`PROBLEME_RECURRENT_AUTHENTIFICATION.md`** (2026-02-18)
   - 🔴 Cause : Désynchronisation entre GitHub Secrets et GCP Secret Manager
   - **Solution recommandée** : Utiliser UNIQUEMENT GCP Secret Manager

### État Actuel

**Base de données** : `yukpo_db` ✅ (confirmé dans `CLARIFICATION_BASE_DONNEES_FINALE.md`)

**Format DATABASE_URL** :
```
postgresql://yukpo_user:PASSWORD@/yukpo_db?host=/cloudsql/yukpo-project:europe-west1:yukpo-postgres
```

**Secret GCP** : `database-url` (dans Secret Manager)

**Problème récurrent** : Le secret peut être écrasé par `docker-build-optimized.yml` qui utilise `GCP_DATABASE_URL` (GitHub Secret)

---

## ✅ Actions à Effectuer

### 1. Corriger le Debounce dans ModernGPSModal.tsx (URGENT)

**Fichier** : `mobile/src/components/ModernGPSModal.tsx`

**Ligne 177** : Ajouter un vrai debounce de 500ms minimum

**Impact** : Réduira drastiquement les appels API Places

### 2. Corriger le Debounce dans LocationSelector.tsx

**Fichier** : `mobile/src/components/LocationSelector.tsx`

**Ligne 548** : Remplacer `useMemo` par un vrai debounce avec `setTimeout`

### 3. Vérifier les Autres Fichiers

**Fichiers à vérifier** :
- `mobile/src/services/hotelPlacesService.ts`
- `mobile/src/services/healthPlacesService.ts`
- `mobile/src/components/ChatInputMobile.tsx`

### 4. Résoudre le Problème DATABASE_URL

**Action** : Vérifier si `docker-build-optimized.yml` utilise encore `GCP_DATABASE_URL`

**Fichier** : `.github/workflows/docker-build-optimized.yml`

**Lignes 474, 497** : Supprimer `DATABASE_URL` de env-vars.json (selon `SOLUTION_DEFINITIVE_DATABASE_URL.md`)

---

## 🎯 Priorités

### 🔴 URGENT (Avant réponse aux techniciens Google)

1. ✅ **Corriger le debounce dans ModernGPSModal.tsx**
   - Impact direct sur les appels API
   - Peut expliquer les 5 millions d'appels

2. ✅ **Corriger le debounce dans LocationSelector.tsx**
   - Même problème

3. ✅ **Vérifier s'il y a des boucles infinies**
   - Chercher `while(true)`, `for(;;)`, `setInterval` sans limite

### 🟡 IMPORTANT (À faire rapidement)

4. ✅ **Résoudre le problème DATABASE_URL**
   - Vérifier les workflows GitHub Actions
   - S'assurer qu'un seul workflow gère DATABASE_URL

5. ✅ **Configurer des quotas Places API**
   - Limiter les requêtes/jour
   - Configurer des alertes

---

## 📊 Estimation de l'Impact

### Avant Correction

Si `handleSearchQueryChange` est appelée en boucle (bug) :
- **29 appels/seconde** = 2,505,600 appels/jour
- **5 millions d'appels en 2 jours** = POSSIBLE

### Après Correction (Debounce 500ms)

Même avec un bug de boucle :
- **Maximum 2 appels/seconde** (limité par le debounce)
- **172,800 appels/jour maximum**
- **345,600 appels en 2 jours maximum**

**Réduction** : **~93% de réduction** des appels possibles

---

## 🔍 Vérifications Supplémentaires

### Chercher des Boucles Infinies

```bash
# Chercher dans le code
grep -r "while.*true" mobile/src/
grep -r "for.*;;" mobile/src/
grep -r "setInterval" mobile/src/
grep -r "setTimeout.*0" mobile/src/
```

### Vérifier les useEffect Sans Dépendances

```bash
# Chercher useEffect sans tableau de dépendances
grep -r "useEffect.*()" mobile/src/
```

---

## 📝 Conclusion

**Problème principal identifié** : **Pas de debounce réel** dans `ModernGPSModal.tsx` et debounce incomplet dans `LocationSelector.tsx`.

**Impact** : Si une boucle infinie ou un bug fait que ces fonctions sont appelées en continu, cela peut expliquer les **5 millions d'appels en 2 jours**.

**Action immédiate** : Corriger le debounce dans les deux fichiers avant de répondre aux techniciens Google.

**Base de données** : Le problème DATABASE_URL est documenté dans les fichiers récents, mais nécessite une vérification des workflows GitHub Actions.

