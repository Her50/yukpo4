# 🔍 Analyse Complète - Anomalies Extraction de Données et Affichage

## ⚠️ PROBLÈMES CRITIQUES IDENTIFIÉS

### ❌ PROBLÈME 1 : Extraction Directe Sans Normalisation dans VideoCreationWizardScreen

**Fichier** : `mobile/src/screens/video/VideoCreationWizardScreen.tsx` (lignes 424-443)

**Problème** :
- Les données sont extraites directement sans utiliser `getFieldValue()` de `productNormalizer.ts`
- Si les données sont des objets wrapper `{valeur: "...", type_donnee: "..."}`, elles s'affichent en JSON brut
- `serviceName` et `productName` peuvent contenir des objets JSON complets

**Code problématique** :
```tsx
// ❌ PROBLÈME: Extraction directe sans normalisation
setServiceName(service.titre || service.name || `Service #${serviceId}`);
const produits = service.data?.produits?.valeur || service.data?.produits || [];

if (typeof productIndex === 'number' && produits[productIndex]) {
    const p = produits[productIndex];
    setProductName(p.nom || p.name || p.title || t('videoWizard.defaultProduct')); // ❌ Peut être un objet
    const productDesc = p.description || p.desc; // ❌ Peut être un objet
    if (productDesc && !brief) {
        setBrief(productDesc); // ❌ Peut afficher du JSON brut
    }
}
```

**Impact** : 🔴 **CRITIQUE** - Affichage de JSON brut comme `[object Object]` ou `{"valeur":"...","type_donnee":"..."}`

**Correction nécessaire** :
```tsx
import { getFieldValue, normalizeServiceProducts } from '../../utils/productNormalizer';

// ✅ CORRECTION: Utiliser getFieldValue pour extraire les valeurs
setServiceName(
    getFieldValue(service.titre) || 
    getFieldValue(service.name) || 
    getFieldValue(service.data?.titre_service) ||
    `Service #${serviceId}`
);

// ✅ CORRECTION: Normaliser les produits
const produits = normalizeServiceProducts(service.data?.produits);

if (typeof productIndex === 'number' && produits[productIndex]) {
    const p = produits[productIndex]; // ✅ Déjà normalisé
    setProductName(
        getFieldValue(p.nom) || 
        getFieldValue(p.name) || 
        getFieldValue(p.title) || 
        t('videoWizard.defaultProduct')
    );
    const productDesc = getFieldValue(p.description) || getFieldValue(p.desc);
    if (productDesc && typeof productDesc === 'string' && !brief) {
        setBrief(productDesc);
    }
}
```

---

### ❌ PROBLÈME 2 : Affichage Direct des Noms Sans Vérification de Type

**Fichier** : `mobile/src/screens/video/VideoCreationWizardScreen.tsx` (lignes 1447-1448, 1932-1935)

**Problème** :
- `serviceName` et `productName` sont affichés directement dans le JSX
- Si ce sont des objets, React les convertira en `[object Object]` ou JSON string

**Code problématique** :
```tsx
<Text style={styles.summaryTitle}>{serviceName}</Text>
<Text style={styles.summarySubtitle}>{productName}</Text>
// ❌ Si serviceName ou productName est un objet, affichage JSON brut

<Text style={styles.summaryText}>
    {t('videoWizard.summary.service')} : {serviceName || `Service #${serviceId}`}
</Text>
<Text style={styles.summaryText}>
    {t('videoWizard.summary.product')} : {productName}
</Text>
```

**Impact** : 🔴 **CRITIQUE** - Affichage de `[object Object]` dans l'interface

**Correction nécessaire** :
```tsx
// ✅ CORRECTION: Fonction helper pour garantir une string
const safeDisplayValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && 'valeur' in value) {
        return String(value.valeur || '');
    }
    return String(value);
};

<Text style={styles.summaryTitle}>{safeDisplayValue(serviceName)}</Text>
<Text style={styles.summarySubtitle}>{safeDisplayValue(productName)}</Text>
```

---

### ❌ PROBLÈME 3 : Pages Vides ou Avec Peu de Contenu

#### 3.1. Étape 2 du Wizard - Section Timeline Vide

**Fichier** : `mobile/src/screens/video/VideoCreationWizardScreen.tsx` (ligne 1705-1708)

**Problème** :
- Si `scenesDraft.length === 0`, seul un texte "Aucune scène définie" s'affiche
- Pas de bouton pour générer des scènes
- Pas d'explication ou d'aide
- L'utilisateur ne voit que les boutons navigation

**Code actuel** :
```tsx
{scenesDraft.length === 0 ? (
    <Text style={styles.summaryText}>
        {t('videoWizard.summary.noScenes') || 'Aucune scène définie.'}
    </Text>
) : (
    // Contenu complet...
)}
```

**Impact** : 🟠 **Moyenne-Haute** - Page vide, pas d'action possible

**Correction nécessaire** :
```tsx
{scenesDraft.length === 0 ? (
    <View style={styles.emptyScenesState}>
        <SafeIcon name="film" size={48} color={modernColors.textSecondary} />
        <Text style={styles.emptyScenesTitle}>Aucune scène définie</Text>
        <Text style={styles.emptyScenesText}>
            Génère un storyboard pour créer des scènes automatiquement, ou configure-les manuellement.
        </Text>
        <NativeButton
            title="Générer storyboard"
            variant="primary"
            size="small"
            onPress={handleGenerateStoryboard}
            disabled={storyboardLoading}
        />
        <Text style={styles.emptyScenesHint}>
            Les scènes seront créées automatiquement lors de la génération si le storyboard est activé.
        </Text>
    </View>
) : (
    // Contenu complet...
)}
```

#### 3.2. Étape 2 - Section Médias Vide

**Fichier** : `mobile/src/screens/video/VideoCreationWizardScreen.tsx` (ligne 1691-1698)

**Problème** :
- Si `mediaItems.length === 0`, seul un `FlatList` vide s'affiche
- Pas de message d'état vide
- Pas d'explication ou d'aide

**Code actuel** :
```tsx
<FlatList
    data={mediaItems}
    keyExtractor={(item) => item.id.toString()}
    renderItem={renderMediaItem}
    ItemSeparatorComponent={() => <View style={styles.mediaSeparator} />}
    scrollEnabled={false}
/>
// ❌ Si mediaItems est vide, rien ne s'affiche
```

**Impact** : 🟠 **Moyenne** - Section vide sans feedback

**Correction nécessaire** :
```tsx
{mediaItems.length === 0 ? (
    <View style={styles.emptyMediaState}>
        <SafeIcon name="image-off" size={32} color={modernColors.textSecondary} />
        <Text style={styles.emptyMediaTitle}>Aucun média disponible</Text>
        <Text style={styles.emptyMediaText}>
            Les médias seront automatiquement sélectionnés depuis votre service et produit.
        </Text>
        <Text style={styles.emptyMediaHint}>
            Vous pouvez aussi ajouter des médias dans la médiathèque de votre service.
        </Text>
    </View>
) : (
    <FlatList
        data={mediaItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMediaItem}
        ItemSeparatorComponent={() => <View style={styles.mediaSeparator} />}
        scrollEnabled={false}
    />
)}
```

---

### ❌ PROBLÈME 4 : CreatorStudioCard Affiche des Objets Potentiellement JSON

**Fichier** : `mobile/src/components/CreatorStudioCard.tsx` (ligne 402)

**Problème** :
- `serviceName` et `productName` sont affichés directement sans vérification
- Si ce sont des objets, affichage JSON brut

**Code problématique** :
```tsx
<Text style={styles.subtitle}>
    {serviceName ?? 'Service'} · {productName ?? 'Produit'}
</Text>
```

**Impact** : 🔴 **Haute** - Affichage de `[object Object]` possible

---

### ❌ PROBLÈME 5 : VideoGenerationResultScreen - Affichage Direct Sans Validation

**Fichier** : `mobile/src/screens/video/VideoGenerationResultScreen.tsx` (lignes 88-89)

**Problème** :
- `result.video_url` affiché directement
- Si c'est un objet, affichage JSON brut

**Code actuel** :
```tsx
<Text style={styles.videoUrl} numberOfLines={2}>
    {result.video_url}
</Text>
```

**Impact** : 🟡 **Moyenne** - Possible affichage JSON

---

### ❌ PROBLÈME 6 : ProductVideoCreationModal - Extraction Déjà Corrigée Mais Pas Complète

**Fichier** : `mobile/src/components/ProductVideoCreationModal.tsx`

**État** : ✅ Utilise `getFieldValue()` mais peut être amélioré

**Problème potentiel** :
- Normalisation des produits fait dans le handler, mais pas au chargement initial
- Si `primaryProduct` est passé avec des wrappers, ils ne sont pas normalisés

**Code actuel** (ligne 1463-1475) :
```tsx
// ✅ Déjà corrigé dans onPress, mais pas au chargement initial
const normalizedProduct: ManagedProduct = {
    ...product,
    nom: getFieldValue(product.nom) || ...,
    // ...
};
```

**Correction nécessaire** :
- Normaliser `primaryProduct` au chargement initial dans un `useEffect`

---

### ❌ PROBLÈME 7 : Description Produit/Service Peut Être un Objet

**Fichier** : `mobile/src/screens/video/VideoCreationWizardScreen.tsx` (lignes 433-443)

**Problème** :
- `productDesc` et `service.description` peuvent être des objets wrapper
- Assignés directement à `brief` qui est ensuite affiché dans un TextInput

**Code problématique** :
```tsx
const productDesc = p.description || p.desc; // ❌ Peut être un objet
if (productDesc && !brief) {
    setBrief(productDesc); // ❌ Si objet, affichage JSON dans TextInput
}
setBrief(service.description); // ❌ Peut être un objet
```

**Impact** : 🔴 **Haute** - JSON affiché dans le champ de texte

---

### ❌ PROBLÈME 8 : VideoCreationIntroScreen - Extraction Non Normalisée

**Fichier** : `mobile/src/screens/video/VideoCreationIntroScreen.tsx` (lignes 200, 210)

**Problème** :
- Extraction du nom de service avec `service.data?.titre_service?.valeur || service.titre` mais pas de normalisation complète
- Extraction du nom produit directement sans `getFieldValue()` - ligne 210 peut afficher un objet

**Code problématique** :
```tsx
// ❌ PROBLÈME: Extraction partielle, pas de getFieldValue()
const serviceName = service.data?.titre_service?.valeur || service.titre || `Service #${serviceId}`;

// ❌ PROBLÈME: Si product est un objet wrapper, productName peut être un objet
productName = product.nom || product.name || product.title || product.valeur || `Produit ${index + 1}`;
```

**Impact** : 🔴 **Haute** - Possibilité d'afficher des objets JSON dans la liste de produits

---

### ❌ PROBLÈME 9 : Pas de Vérification de Type Avant Affichage

**Problème général** :
- Aucune fonction utilitaire pour garantir qu'une valeur affichée est une string
- React convertit automatiquement les objets en `[object Object]` ou JSON string
- Pas de fallback gracieux

**Solution** :
- Créer une fonction utilitaire `safeStringDisplay()` utilisée partout
- Vérifier le type avant chaque affichage

---

## 📊 RÉSUMÉ DES ANOMALIES PAR PRIORITÉ

### 🔴 Priorité 1 - Critique (Affichage JSON Brut)
1. ✅ Extraction serviceName sans `getFieldValue()` → Objet JSON affiché
2. ✅ Extraction productName sans `getFieldValue()` → Objet JSON affiché
3. ✅ Extraction description produit/service sans normalisation → JSON dans TextInput
4. ✅ CreatorStudioCard affiche serviceName/productName sans vérification
5. ✅ Tous les affichages directs sans `safeStringDisplay()`

### 🟠 Priorité 2 - Moyenne-Haute (Pages Vides)
6. ✅ Étape 2 - Section Timeline vide sans action possible
7. ✅ Étape 2 - Section Médias vide sans message d'état
8. ✅ Pas d'états vides informatifs

### 🟡 Priorité 3 - Moyenne (Améliorations)
9. ✅ VideoGenerationResultScreen - Validation des URLs
10. ✅ ProductVideoCreationModal - Normalisation au chargement initial

---

## 🔧 CORRECTIONS À IMPLÉMENTER

### Correction 1 : Utilitaire de Normalisation pour Affichage

Créer `mobile/src/utils/displayHelpers.ts` :
```typescript
import { getFieldValue } from './productNormalizer';

/**
 * Garantit qu'une valeur affichée est toujours une string valide
 * Gère les objets wrapper, null, undefined, etc.
 */
export const safeStringDisplay = (value: any, fallback: string = ''): string => {
    if (value === null || value === undefined) {
        return fallback;
    }
    
    // Si c'est déjà une string, la retourner
    if (typeof value === 'string') {
        return value.trim() || fallback;
    }
    
    // Si c'est un nombre, le convertir
    if (typeof value === 'number') {
        return String(value);
    }
    
    // Si c'est un objet wrapper, extraire la valeur
    const extracted = getFieldValue(value);
    if (extracted !== null && extracted !== undefined) {
        if (typeof extracted === 'string') {
            return extracted.trim() || fallback;
        }
        if (typeof extracted === 'number') {
            return String(extracted);
        }
        // Si c'est encore un objet, utiliser JSON.stringify avec limite
        if (typeof extracted === 'object') {
            try {
                const jsonStr = JSON.stringify(extracted);
                // Limiter la longueur pour éviter d'afficher des JSON énormes
                return jsonStr.length > 100 ? jsonStr.substring(0, 100) + '...' : jsonStr;
            } catch {
                return fallback;
            }
        }
    }
    
    // Si c'est un objet brut, essayer de l'afficher proprement
    if (typeof value === 'object') {
        try {
            const jsonStr = JSON.stringify(value);
            return jsonStr.length > 100 ? jsonStr.substring(0, 100) + '...' : jsonStr;
        } catch {
            return fallback;
        }
    }
    
    return fallback;
};

/**
 * Extrait et normalise le nom d'un service
 */
export const extractServiceName = (service: any, fallback: string = 'Service'): string => {
    if (!service) return fallback;
    
    return safeStringDisplay(
        getFieldValue(service.titre) || 
        getFieldValue(service.name) || 
        getFieldValue(service.data?.titre_service) ||
        getFieldValue(service.data?.titre) ||
        service.titre ||
        service.name,
        fallback
    );
};

/**
 * Extrait et normalise le nom d'un produit
 */
export const extractProductName = (product: any, fallback: string = 'Produit'): string => {
    if (!product) return fallback;
    
    return safeStringDisplay(
        getFieldValue(product.nom) || 
        getFieldValue(product.name) || 
        getFieldValue(product.title) ||
        getFieldValue(product.nom_produit) ||
        product.nom ||
        product.name,
        fallback
    );
};

/**
 * Extrait et normalise une description
 */
export const extractDescription = (value: any, fallback: string = ''): string => {
    const extracted = getFieldValue(value);
    return safeStringDisplay(extracted || value, fallback);
};
```

---

### Correction 2 : Modifier VideoCreationWizardScreen

```tsx
// ✅ AJOUTER import
import { getFieldValue, normalizeServiceProducts } from '../../utils/productNormalizer';
import { extractServiceName, extractProductName, extractDescription, safeStringDisplay } from '../../utils/displayHelpers';

// ✅ CORRIGER fetchServiceDetails
const fetchServiceDetails = useCallback(async () => {
    // ...
    if (response.success && response.data) {
        const service = response.data;
        
        // ✅ CORRECTION: Utiliser extractServiceName
        setServiceName(extractServiceName(service, `Service #${serviceId}`));
        
        // ✅ CORRECTION: Normaliser les produits
        const produits = normalizeServiceProducts(service.data?.produits);

        if (typeof productIndex === 'number' && produits[productIndex]) {
            const p = produits[productIndex];
            
            // ✅ CORRECTION: Utiliser extractProductName
            setProductName(extractProductName(p, t('videoWizard.defaultProduct')));

            // ✅ CORRECTION: Utiliser extractDescription
            const productDesc = extractDescription(p.description || p.desc, '');
            if (productDesc && !brief) {
                setBrief(productDesc);
            } else {
                const serviceDesc = extractDescription(service.description, '');
                if (produits.length <= 2 && serviceDesc && !brief) {
                    setBrief(serviceDesc);
                }
            }
        } else {
            const serviceDesc = extractDescription(service.description, '');
            if (serviceDesc && !brief) {
                setBrief(serviceDesc);
            }
        }
    }
}, [serviceId, productIndex, brief, t]);
```

---

### Correction 3 : Ajouter États Vides Informatifs

```tsx
// ✅ AJOUTER dans les styles
emptyScenesState: {
    alignItems: 'center',
    padding: 32,
    gap: 12,
},
emptyScenesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: modernColors.text,
},
emptyScenesText: {
    fontSize: 14,
    color: modernColors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
},
emptyScenesHint: {
    fontSize: 12,
    color: modernColors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
},
emptyMediaState: {
    alignItems: 'center',
    padding: 24,
    gap: 8,
},
emptyMediaTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: modernColors.text,
},
emptyMediaText: {
    fontSize: 13,
    color: modernColors.textSecondary,
    textAlign: 'center',
},
emptyMediaHint: {
    fontSize: 12,
    color: modernColors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
},
```

---

### Correction 4 : Utiliser safeStringDisplay Partout

```tsx
// ✅ Remplacer tous les affichages directs
<Text style={styles.summaryTitle}>{safeStringDisplay(serviceName, `Service #${serviceId}`)}</Text>
<Text style={styles.summarySubtitle}>{safeStringDisplay(productName, t('videoWizard.defaultProduct'))}</Text>
```

---

## 📝 PLAN D'IMPLÉMENTATION

### Phase 1 - Urgent (Affichage JSON)
1. ✅ Créer `displayHelpers.ts` avec les fonctions utilitaires
2. ✅ Modifier `fetchServiceDetails` pour utiliser `extractServiceName`, `extractProductName`, `extractDescription`
3. ✅ Remplacer tous les affichages directs par `safeStringDisplay()`
4. ✅ Modifier `CreatorStudioCard` pour utiliser `safeStringDisplay()`

### Phase 2 - Important (Pages Vides)
5. ✅ Ajouter états vides informatifs pour Timeline
6. ✅ Ajouter états vides informatifs pour Médias
7. ✅ Ajouter états vides partout où nécessaire

### Phase 3 - Améliorations
8. ✅ Normaliser `primaryProduct` au chargement dans `ProductVideoCreationModal`
9. ✅ Valider les URLs dans `VideoGenerationResultScreen`
10. ✅ Ajouter des tests pour vérifier qu'aucun JSON ne s'affiche

---

## 🎯 IMPACT

- ✅ **Aucun JSON brut ne sera affiché**
- ✅ **Toutes les valeurs seront des strings valides**
- ✅ **Pages vides auront des messages informatifs**
- ✅ **Meilleure expérience utilisateur globale**

