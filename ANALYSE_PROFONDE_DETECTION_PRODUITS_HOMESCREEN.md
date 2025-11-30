# 🔍 Analyse en Profondeur : Détection des Produits Existants dans HomeScreen

## 📋 Vue d'Ensemble

**Fichier** : `mobile/src/screens/HomeScreen.tsx`  
**Fonction** : `handleCreateService()` (lignes 481-710)  
**Objectif** : Détecter si l'utilisateur a déjà un service avec des produits pour décider quelle route prendre :
- ✅ **Si produit existe** → `AjouterProduitSimpleScreen` (formulaire simple)
- ❌ **Si produit n'existe pas** → `FormulaireYukpoIntelligentScreen` (formulaire complet)

---

## 🔄 Flux d'Exécution Complet

### Étape 1 : Initialisation (Lignes 519-523)

```typescript:519:523:mobile/src/screens/HomeScreen.tsx
// ✅ CORRECTION 2025-11-29: Vérifier si l'utilisateur a DÉJÀ un service AVEC PRODUITS
// ✅ CRITIQUE: Il faut vérifier qu'il y a au moins UN PRODUIT dans le service, pas juste un service
console.log('[HomeScreen] 🔍 Vérification si utilisateur a déjà un service avec produits...');
let hasExistingServiceWithProducts = false;
let firstServiceId: number | null = null;
```

**Variables d'état** :
- `hasExistingServiceWithProducts` : Booléen indiquant si un service avec produits a été trouvé
- `firstServiceId` : ID du premier service trouvé avec des produits

---

### Étape 2 : Fonction Helper `serviceHasProducts` (Lignes 526-562)

**Rôle** : Vérifier si un service donné contient des produits

```typescript:526:562:mobile/src/screens/HomeScreen.tsx
const serviceHasProducts = (service: any): boolean => {
    try {
        // ✅ AMÉLIORATION: Logs détaillés pour diagnostic
        const serviceId = service.id || service.service_id;
        console.log('[HomeScreen] 🔍 Analyse service:', {
            serviceId: serviceId,
            hasData: !!service.data,
            hasProduits: !!service.data?.produits,
            hasProduitsDirect: !!service.produits,
            produitsType: typeof (service.data?.produits || service.produits),
            produitsIsArray: Array.isArray(service.data?.produits || service.produits),
            produitsKeys: service.data?.produits && typeof service.data.produits === 'object'
                ? Object.keys(service.data.produits)
                : []
        });

        const produits = normalizeServiceProducts(service.data?.produits || service.produits);
        const hasProducts = Array.isArray(produits) && produits.length > 0;

        console.log('[HomeScreen] 🔍 Service ID', serviceId, '- Produits normalisés:', produits.length, '- Structure:', produits.length > 0 ? JSON.stringify(produits[0]).substring(0, 200) : 'aucun');

        if (!hasProducts && (service.data?.produits || service.produits)) {
            console.warn('[HomeScreen] ⚠️ Service a un champ produits mais normalizeServiceProducts retourne vide:', {
                rawProduits: JSON.stringify(service.data?.produits || service.produits).substring(0, 300)
            });
        }

        return hasProducts;
    } catch (error) {
        console.error('[HomeScreen] ⚠️ Erreur vérification produits service:', {
            error: error,
            serviceId: service.id || service.service_id,
            serviceDataKeys: service.data ? Object.keys(service.data) : []
        });
        return false;
    }
};
```

**Logique** :
1. **Extraction de l'ID** : `service.id || service.service_id`
2. **Logs de diagnostic** : Structure complète du service analysé
3. **Normalisation** : Appel à `normalizeServiceProducts()` pour extraire les produits
4. **Vérification** : `Array.isArray(produits) && produits.length > 0`
5. **Gestion d'erreur** : Retourne `false` en cas d'erreur

**Points critiques** :
- ✅ Cherche les produits dans `service.data?.produits` **OU** `service.produits`
- ✅ Utilise `normalizeServiceProducts()` pour gérer différents formats
- ⚠️ Si erreur → retourne `false` (peut masquer des produits existants)

---

### Étape 3 : Tentative 1 - `/api/prestataire/services` (Lignes 565-590)

**Priorité** : **1ère** (tentative principale)

```typescript:565:590:mobile/src/screens/HomeScreen.tsx
// ✅ CORRECTION: Essayer d'abord /api/prestataire/services (utilisé ailleurs dans le code)
const prestataireServicesResponse = await apiGet('/api/prestataire/services');
console.log('[HomeScreen] Réponse /api/prestataire/services:', {
    success: prestataireServicesResponse.success,
    hasData: !!prestataireServicesResponse.data,
    isArray: Array.isArray(prestataireServicesResponse.data),
    length: Array.isArray(prestataireServicesResponse.data) ? prestataireServicesResponse.data.length : 0
});

if (prestataireServicesResponse.success && Array.isArray(prestataireServicesResponse.data) && prestataireServicesResponse.data.length > 0) {
    // ✅ CORRECTION: Chercher le PREMIER service qui a des produits (pas juste un service)
    for (const service of prestataireServicesResponse.data) {
        const serviceId = service.id || service.service_id || null;
        if (serviceId && serviceHasProducts(service)) {
            hasExistingServiceWithProducts = true;
            firstServiceId = serviceId;
            console.log('[HomeScreen] ✅ Service avec produits trouvé via /api/prestataire/services (ID: ' + firstServiceId + ')');
            console.log('[HomeScreen] → Ouverture formulaire SIMPLE pour ajouter produit');
            break; // Arrêter dès qu'on trouve un service avec produits
        }
    }

    if (!hasExistingServiceWithProducts) {
        console.log('[HomeScreen] ℹ️ Services trouvés mais aucun n\'a de produits');
    }
}
```

**Logique** :
1. **Appel API** : `GET /api/prestataire/services`
2. **Vérification réponse** : `success && Array.isArray(data) && data.length > 0`
3. **Boucle** : Parcourt tous les services retournés
4. **Détection** : Pour chaque service, appelle `serviceHasProducts(service)`
5. **Arrêt** : Dès qu'un service avec produits est trouvé → `break`

**Points critiques** :
- ✅ **Première tentative** (priorité la plus haute)
- ✅ **Arrêt immédiat** si un service avec produits est trouvé
- ⚠️ Si l'API échoue ou retourne un tableau vide → passe au fallback suivant

---

### Étape 4 : Fallback 1 - `/api/services/last` (Lignes 592-618)

**Priorité** : **2ème** (fallback si tentative 1 échoue)

```typescript:592:618:mobile/src/screens/HomeScreen.tsx
// ✅ FALLBACK 1: Si /api/prestataire/services ne fonctionne pas, essayer /api/services/last
if (!hasExistingServiceWithProducts) {
    console.log('[HomeScreen] Tentative avec /api/services/last comme fallback...');
    const lastServiceResponse = await apiGet('/api/services/last');
    console.log('[HomeScreen] Réponse /api/services/last:', {
        success: lastServiceResponse.success,
        hasData: !!lastServiceResponse.data,
        dataType: typeof lastServiceResponse.data,
        dataKeys: lastServiceResponse.data ? Object.keys(lastServiceResponse.data) : []
    });

    if (lastServiceResponse.data) {
        const serviceData = (lastServiceResponse.data as any)?.data || lastServiceResponse.data;
        if (serviceData && (serviceData.id || serviceData.service_id)) {
            const serviceId = serviceData.id || serviceData.service_id;
            // ✅ CORRECTION: Vérifier que ce service a des produits
            if (serviceHasProducts(serviceData)) {
                hasExistingServiceWithProducts = true;
                firstServiceId = serviceId;
                console.log('[HomeScreen] ✅ Service avec produits trouvé via /api/services/last (ID: ' + firstServiceId + ')');
                console.log('[HomeScreen] → Ouverture formulaire SIMPLE pour ajouter produit');
            } else {
                console.log('[HomeScreen] ℹ️ Service trouvé via /api/services/last mais aucun produit détecté');
            }
        }
    }
}
```

**Logique** :
1. **Condition** : Seulement si `!hasExistingServiceWithProducts`
2. **Appel API** : `GET /api/services/last` (retourne le dernier service créé)
3. **Extraction données** : `response.data?.data || response.data` (gère structure imbriquée)
4. **Vérification** : `serviceHasProducts(serviceData)`

**Points critiques** :
- ⚠️ **Un seul service** retourné (le dernier)
- ⚠️ **Structure imbriquée** : Peut être `response.data.data` ou `response.data`
- ✅ Si ce service a des produits → succès, sinon → fallback suivant

---

### Étape 5 : Fallback 2 - `/api/services/my-services` (Lignes 620-648)

**Priorité** : **3ème** (fallback si tentatives 1 et 2 échouent)

```typescript:620:648:mobile/src/screens/HomeScreen.tsx
// ✅ FALLBACK 2: Si /api/services/last ne fonctionne pas, essayer /api/services/my-services
if (!hasExistingServiceWithProducts) {
    console.log('[HomeScreen] Tentative avec /api/services/my-services comme fallback...');
    const servicesResponse = await apiGet('/api/services/my-services');
    console.log('[HomeScreen] Réponse /api/services/my-services:', {
        success: servicesResponse.success,
        hasData: !!servicesResponse.data,
        isArray: Array.isArray(servicesResponse.data),
        length: Array.isArray(servicesResponse.data) ? servicesResponse.data.length : 0
    });

    if (servicesResponse.success && Array.isArray(servicesResponse.data) && servicesResponse.data.length > 0) {
        // ✅ CORRECTION: Chercher le PREMIER service qui a des produits (pas juste un service)
        for (const service of servicesResponse.data) {
            const serviceId = service.id || service.service_id || null;
            if (serviceId && serviceHasProducts(service)) {
                hasExistingServiceWithProducts = true;
                firstServiceId = serviceId;
                console.log('[HomeScreen] ✅ Service avec produits trouvé via /api/services/my-services (ID: ' + firstServiceId + ')');
                console.log('[HomeScreen] → Ouverture formulaire SIMPLE pour ajouter produit');
                break; // Arrêter dès qu'on trouve un service avec produits
        }
    }

    if (!hasExistingServiceWithProducts) {
        console.log('[HomeScreen] ℹ️ Services trouvés via /api/services/my-services mais aucun n\'a de produits');
    }
}
```

**Logique** :
1. **Condition** : Seulement si `!hasExistingServiceWithProducts`
2. **Appel API** : `GET /api/services/my-services` (retourne tous les services de l'utilisateur)
3. **Boucle** : Parcourt tous les services (comme tentative 1)
4. **Arrêt** : Dès qu'un service avec produits est trouvé → `break`

**Points critiques** :
- ✅ **Tous les services** retournés (plus complet que `/api/services/last`)
- ✅ **Même logique** que tentative 1 (boucle + break)

---

### Étape 6 : Fallback 3 - `/api/products/my-products` (Lignes 650-678)

**Priorité** : **4ème** (dernier fallback, vérification directe des produits)

```typescript:650:678:mobile/src/screens/HomeScreen.tsx
// ✅ FALLBACK 3: Si toutes les vérifications échouent, essayer /api/products/my-products
if (!hasExistingServiceWithProducts) {
    console.log('[HomeScreen] Tentative avec /api/products/my-products comme dernier fallback...');
    try {
        const productsResponse = await apiGet('/api/products/my-products');
        console.log('[HomeScreen] Réponse /api/products/my-products:', {
            success: productsResponse.success,
            hasData: !!productsResponse.data,
            isArray: Array.isArray(productsResponse.data),
            length: Array.isArray(productsResponse.data) ? productsResponse.data.length : 0
        });

        if (productsResponse.success && Array.isArray(productsResponse.data) && productsResponse.data.length > 0) {
            // Si l'utilisateur a des produits, trouver le service associé au premier produit
            const firstProduct = productsResponse.data[0];
            const serviceId = firstProduct.service_id || firstProduct.serviceId || firstProduct.service?.id;
            if (serviceId) {
                hasExistingServiceWithProducts = true;
                firstServiceId = serviceId;
                console.log('[HomeScreen] ✅ Service avec produits trouvé via /api/products/my-products (ID: ' + firstServiceId + ')');
                console.log('[HomeScreen] → Ouverture formulaire SIMPLE pour ajouter produit');
            } else {
                console.warn('[HomeScreen] ⚠️ Produits trouvés mais service_id manquant dans le premier produit');
            }
        }
    } catch (productsError) {
        console.warn('[HomeScreen] ⚠️ Erreur vérification produits:', productsError);
    }
}
```

**Logique** :
1. **Condition** : Seulement si `!hasExistingServiceWithProducts`
2. **Appel API** : `GET /api/products/my-products` (retourne tous les produits de l'utilisateur)
3. **Extraction service_id** : Prend le `service_id` du **premier produit** trouvé
4. **Vérification** : Si `service_id` existe → succès

**Points critiques** :
- ✅ **Approche inverse** : Vérifie directement les produits au lieu des services
- ⚠️ **Prend le premier produit** : Peut ne pas être le bon service si l'utilisateur a plusieurs services
- ⚠️ **service_id peut manquer** : Si le produit n'a pas de `service_id`, la détection échoue

---

### Étape 7 : Gestion d'Erreur Globale (Lignes 679-690)

```typescript:679:690:mobile/src/screens/HomeScreen.tsx
if (!hasExistingServiceWithProducts) {
    console.log('[HomeScreen] ℹ️ Aucun service avec produits détecté → Formulaire COMPLET');
    console.log('[HomeScreen] 📊 Résumé vérification:', {
        hasExistingServiceWithProducts,
        firstServiceId,
        prestataireServicesCount: prestataireServicesResponse?.data?.length || 0,
        lastServiceId: lastServiceResponse?.data?.id || null,
        myServicesCount: servicesResponse?.data?.length || 0
    });
}
} catch (error: any) {
    console.error('[HomeScreen] ❌ Erreur vérification services:', error);
    console.error('[HomeScreen] Détails erreur:', {
        message: error?.message,
        stack: error?.stack,
        response: error?.response?.data,
        status: error?.response?.status
    });
    // ✅ CORRECTION: En cas d'erreur, considérer qu'il n'y a pas de service avec produits et ouvrir le formulaire complet
    hasExistingServiceWithProducts = false;
    firstServiceId = null;
}
```

**Logique** :
1. **Résumé** : Log final avec statistiques de toutes les tentatives
2. **Catch global** : Capture toutes les erreurs des appels API
3. **Défaut** : En cas d'erreur → `hasExistingServiceWithProducts = false`

**Points critiques** :
- ⚠️ **Défaut vers false** : Si une erreur survient, assume qu'il n'y a pas de produits
- ✅ **Logs détaillés** : Permet de diagnostiquer les erreurs

---

### Étape 8 : Décision de Navigation (Lignes 692-710)

```typescript:692:710:mobile/src/screens/HomeScreen.tsx
// ✅ AMÉLIORATION UX: Si utilisateur a déjà un service AVEC PRODUITS → Formulaire SIMPLE produit seul
if (hasExistingServiceWithProducts && firstServiceId) {
    console.log('[HomeScreen] 🛍️ Navigation vers formulaire SIMPLE (AjouterProduitSimple)');
    console.log('[HomeScreen] ✅ Raison: Service ID', firstServiceId, 'a déjà des produits');
    (navigation as any).navigate('AjouterProduitSimple', {
        serviceId: firstServiceId,
        suggestionIA: result.data,
        mediaData: mediaData,
        gpsData: gpsData
    });
} else {
    // ✅ Pas de service avec produits → Formulaire COMPLET (création service + premier produit)
    console.log('[HomeScreen] 📝 Navigation vers formulaire COMPLET (FormulaireYukpoIntelligent)');
    console.log('[HomeScreen] ✅ Raison: Aucun service avec produits détecté → Création complète');
    (navigation as any).navigate('FormulaireYukpoIntelligent', {
        suggestion: {
            ...result.data,
            intention: 'creation_service',
            data: result.data.suggestions || result.data.data || result.data
        },
        type: 'creation_service',
        mode: 'create',
        mediaData: mediaData,
        gpsData: gpsData
    });
}
```

**Logique** :
1. **Condition** : `hasExistingServiceWithProducts && firstServiceId`
2. **Si vrai** → `AjouterProduitSimple` avec `serviceId`
3. **Si faux** → `FormulaireYukpoIntelligent` (formulaire complet)

---

## 🔧 Fonction `normalizeServiceProducts` (productNormalizer.ts)

**Rôle** : Extraire et normaliser les produits depuis différentes structures de données

```typescript:62:110:mobile/src/utils/productNormalizer.ts
export const normalizeServiceProducts = (produitsField: any): any[] => {
    if (!produitsField) {
        console.log('[productNormalizer] produitsField est null/undefined');
        return [];
    }

    let productsArray: any[] = [];

    // Cas 1: Array direct (cas rare, legacy)
    if (Array.isArray(produitsField)) {
        console.log('[productNormalizer] ✅ Format array direct détecté:', produitsField.length, 'produits');
        productsArray = produitsField;
    }
    // Cas 2: Objet avec valeur (structure backend standard: {valeur: [...], type_donnee: "listeproduit"})
    else if (produitsField.valeur && Array.isArray(produitsField.valeur)) {
        console.log('[productNormalizer] ✅ Format {valeur: [...]} détecté:', produitsField.valeur.length, 'produits');
        productsArray = produitsField.valeur;
    }
    // Cas 3: Objet avec data.produits (structure imbriquée alternative)
    else if (produitsField.data && Array.isArray(produitsField.data)) {
        console.log('[productNormalizer] ✅ Format {data: [...]} détecté:', produitsField.data.length, 'produits');
        productsArray = produitsField.data;
    }
    // Cas 4: Objet avec produits (structure alternative)
    else if (produitsField.produits && Array.isArray(produitsField.produits)) {
        console.log('[productNormalizer] ✅ Format {produits: [...]} détecté:', produitsField.produits.length, 'produits');
        productsArray = produitsField.produits;
    }
    // Cas 5: Objet avec type_donnee mais valeur non-array (peut être un seul produit)
    else if (produitsField.type_donnee && produitsField.valeur && !Array.isArray(produitsField.valeur)) {
        console.log('[productNormalizer] ✅ Format {valeur: object} détecté (produit unique), conversion en array');
        productsArray = [produitsField.valeur];
    }
    else {
        // Fallback pour structure invalide
        console.warn('[productNormalizer] ⚠️ Structure produits non reconnue:', {
            type: typeof produitsField,
            isArray: Array.isArray(produitsField),
            keys: typeof produitsField === 'object' && produitsField !== null ? Object.keys(produitsField) : [],
            sample: JSON.stringify(produitsField).substring(0, 300)
        });
        return [];
    }

    // Normaliser chaque produit pour extraire les valeurs des wrappers
    const normalized = productsArray.map(product => normalizeProduct(product));
    console.log('[productNormalizer] ✅ Produits normalisés:', normalized.length);
    return normalized;
};
```

**Formats supportés** :
1. ✅ **Array direct** : `[...produits]`
2. ✅ **Format standard** : `{valeur: [...], type_donnee: "listeproduit"}`
3. ✅ **Format imbriqué** : `{data: [...]}`
4. ✅ **Format alternatif** : `{produits: [...]}`
5. ✅ **Produit unique** : `{valeur: object, type_donnee: "..."}` → converti en `[object]`

**Normalisation** : Chaque produit est normalisé via `normalizeProduct()` pour extraire les valeurs des wrappers

---

## 📊 Diagramme de Flux

```
┌─────────────────────────────────────────────────────────────┐
│  handleCreateService() - Détection Produits Existants      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  Initialisation Variables         │
        │  hasExistingServiceWithProducts   │
        │  firstServiceId                   │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  TENTATIVE 1                      │
        │  GET /api/prestataire/services    │
        │  → Boucle services                │
        │  → serviceHasProducts()           │
        └───────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Produits     │
                    │  trouvés ?    │
                    └───────┬───────┘
                            │
            ┌───────────────┴───────────────┐
            │                                │
          OUI                              NON
            │                                │
            ▼                                ▼
    ┌───────────────┐          ┌──────────────────────────┐
    │  SUCCÈS       │          │  FALLBACK 1               │
    │  Break        │          │  GET /api/services/last   │
    └───────────────┘          │  → serviceHasProducts()  │
                               └──────────────┬───────────┘
                                              │
                                      ┌───────┴───────┐
                                      │  Produits     │
                                      │  trouvés ?    │
                                      └───────┬───────┘
                                              │
                              ┌───────────────┴───────────────┐
                              │                                │
                            OUI                              NON
                              │                                │
                              ▼                                ▼
                      ┌───────────────┐          ┌──────────────────────────┐
                      │  SUCCÈS       │          │  FALLBACK 2               │
                      │  Break        │          │  GET /api/services/my-     │
                      └───────────────┘          │  services                 │
                                                 │  → Boucle services        │
                                                 │  → serviceHasProducts()   │
                                                 └──────────────┬───────────┘
                                                                │
                                                        ┌───────┴───────┐
                                                        │  Produits     │
                                                        │  trouvés ?    │
                                                        └───────┬───────┘
                                                                │
                                                ┌───────────────┴───────────────┐
                                                │                                │
                                              OUI                              NON
                                                │                                │
                                                ▼                                ▼
                                        ┌───────────────┐          ┌──────────────────────────┐
                                        │  SUCCÈS       │          │  FALLBACK 3               │
                                        │  Break        │          │  GET /api/products/my-    │
                                        └───────────────┘          │  products                │
                                                                   │  → service_id du 1er      │
                                                                   └──────────────┬───────────┘
                                                                                  │
                                                                          ┌───────┴───────┐
                                                                          │  service_id   │
                                                                          │  trouvé ?     │
                                                                          └───────┬───────┘
                                                                                  │
                                                                  ┌───────────────┴───────────────┐
                                                                  │                                │
                                                                OUI                              NON
                                                                  │                                │
                                                                  ▼                                ▼
                                                          ┌───────────────┐          ┌──────────────────────────┐
                                                          │  SUCCÈS       │          │  ÉCHEC                    │
                                                          │  Break        │          │  hasExistingService =     │
                                                          └───────────────┘          │  false                    │
                                                                                     └──────────────┬───────────┘
                                                                                                   │
                                                                                                   ▼
                                                                                     ┌──────────────────────────┐
                                                                                     │  DÉCISION NAVIGATION     │
                                                                                     │                          │
                                                                                     │  if (hasExisting && id)  │
                                                                                     │    → AjouterProduitSimple│
                                                                                     │  else                    │
                                                                                     │    → FormulaireYukpo...  │
                                                                                     └──────────────────────────┘
```

---

## 🐛 Points de Défaillance Potentiels

### 1. **Erreur API Silencieuse**

**Problème** : Si toutes les API échouent, le code défaut vers `false`

**Impact** : L'utilisateur avec des produits existants sera redirigé vers le formulaire complet

**Solution** : Améliorer la gestion d'erreur et permettre un choix manuel

### 2. **Structure de Données Inattendue**

**Problème** : Si `service.data.produits` a une structure non supportée par `normalizeServiceProducts`

**Impact** : Les produits ne seront pas détectés même s'ils existent

**Solution** : Les logs détaillés permettent de voir la structure exacte et d'adapter le code

### 3. **Produits dans Format Non Standard**

**Problème** : Si les produits sont stockés dans un format non géré (ex: `service.produits_list` au lieu de `service.data.produits`)

**Impact** : `normalizeServiceProducts` retournera `[]`

**Solution** : Ajouter plus de formats dans `normalizeServiceProducts`

### 4. **service_id Manquant dans Fallback 3**

**Problème** : Si `/api/products/my-products` retourne des produits sans `service_id`

**Impact** : La détection échouera même si des produits existent

**Solution** : Vérifier d'autres champs possibles (`serviceId`, `service.id`)

### 5. **Race Condition / Timing**

**Problème** : Si les appels API prennent trop de temps, l'utilisateur peut voir un écran de chargement

**Impact** : Mauvaise expérience utilisateur

**Solution** : Ajouter un timeout et un indicateur de chargement

---

## ✅ Recommandations d'Amélioration

### 1. **Cache Local**

Stocker les services avec produits dans AsyncStorage pour éviter les appels API à chaque fois

### 2. **Timeout sur Appels API**

Ajouter un timeout (ex: 5 secondes) pour éviter d'attendre indéfiniment

### 3. **Choix Manuel**

Si la détection automatique échoue, permettre à l'utilisateur de choisir :
- "Ajouter un produit" → `AjouterProduitSimple`
- "Créer un service" → `FormulaireYukpoIntelligent`

### 4. **Vérification Multiple service_id**

Dans Fallback 3, vérifier plusieurs champs possibles :
```typescript
const serviceId = firstProduct.service_id 
    || firstProduct.serviceId 
    || firstProduct.service?.id
    || firstProduct.service_id_from_product
    || firstProduct.parent_service_id;
```

### 5. **Logs Structurés**

Créer un objet de diagnostic complet à la fin :
```typescript
const diagnostic = {
    attempts: [
        { endpoint: '/api/prestataire/services', success: true, servicesFound: 3, productsFound: 1 },
        { endpoint: '/api/services/last', success: false, error: '...' },
        // ...
    ],
    finalDecision: hasExistingServiceWithProducts ? 'AjouterProduitSimple' : 'FormulaireYukpoIntelligent',
    reason: '...'
};
```

---

## 📋 Checklist de Diagnostic

Pour identifier pourquoi la détection échoue, vérifier dans les logs :

- [ ] **Tentative 1** : `/api/prestataire/services` retourne-t-il des données ?
- [ ] **Tentative 1** : Les services retournés ont-ils `data.produits` ou `produits` ?
- [ ] **Tentative 1** : `normalizeServiceProducts` détecte-t-il les produits ?
- [ ] **Fallback 1** : `/api/services/last` retourne-t-il un service ?
- [ ] **Fallback 1** : Ce service a-t-il des produits ?
- [ ] **Fallback 2** : `/api/services/my-services` retourne-t-il des services ?
- [ ] **Fallback 2** : Aucun de ces services n'a de produits ?
- [ ] **Fallback 3** : `/api/products/my-products` retourne-t-il des produits ?
- [ ] **Fallback 3** : Les produits ont-ils un `service_id` ?
- [ ] **Erreurs** : Y a-t-il des erreurs dans le `catch` global ?

---

*Analyse générée le ${new Date().toISOString()}*

