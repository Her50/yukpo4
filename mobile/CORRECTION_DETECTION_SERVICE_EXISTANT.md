# 🔧 Correction - Détection de service existant et redirection

## 🐛 Problème identifié

Lors de la création d'un produit depuis `HomeScreen`, le système naviguait toujours vers `FormulaireYukpoIntelligentScreen` même si l'utilisateur avait déjà un service existant. Dans ce cas, il devrait plutôt rediriger vers `AjouterProduitSimpleScreen`.

## 🔍 Analyse

### Comportement attendu

1. **Utilisateur SANS service existant** :
   - Création → `FormulaireYukpoIntelligentScreen` (création service + produit)

2. **Utilisateur AVEC service existant** :
   - Création → `AjouterProduitSimpleScreen` (ajout produit au service existant)

### Comportement actuel (avant correction)

- ❌ Toujours `FormulaireYukpoIntelligentScreen`, même avec un service existant

## ✅ Corrections appliquées

### Fichier : `mobile/src/screens/HomeScreen.tsx`

**Ajout de la vérification de service existant** :

```typescript
// ✅ NOUVEAU: Vérifier d'abord si l'utilisateur a déjà un service existant
let foundServiceId: number | undefined;

try {
    const servicesResponse = await apiGet('/api/prestataire/services');
    
    if (servicesResponse?.success && servicesResponse?.data) {
        const responseData = servicesResponse.data as any;
        const servicesData = Array.isArray(responseData) 
            ? responseData 
            : (responseData?.data || responseData?.services || []);
        
        if (servicesData.length > 0) {
            const activeService = servicesData.find((s: any) => s.is_active !== false && s.actif !== false) || servicesData[0];
            
            if (activeService && activeService.id) {
                foundServiceId = typeof activeService.id === 'string' 
                    ? parseInt(activeService.id, 10) 
                    : activeService.id;
            }
        }
    }
} catch (serviceError) {
    // Continuer normalement si la vérification échoue
}
```

**Redirection conditionnelle** :

```typescript
// Si un service existe → AjouterProduitSimpleScreen
if (foundServiceId) {
    const result = await genererSuggestionsService(input);
    
    navigate('AjouterProduitSimple', {
        serviceId: foundServiceId,
        mode: 'create',
        suggestionIA: {
            data: suggestionData,
            session_id: result.data.session_id,
        },
        mediaData: { /* ... */ },
        gpsData: { /* ... */ },
    });
    return;
}

// Sinon → FormulaireYukpoIntelligentScreen
navigate('FormulaireYukpoIntelligent', {
    suggestion: { /* ... */ },
    type: 'creation_service',
    mode: 'create',
});
```

## 📊 Logique de détection

### Ordre de vérification

1. **Appel API** : `/api/prestataire/services`
2. **Recherche service actif** : Premier service avec `is_active !== false` ou `actif !== false`
3. **Fallback** : Premier service de la liste si aucun actif trouvé

### Gestion des erreurs

- Si la vérification échoue (erreur API), le système continue normalement vers `FormulaireYukpoIntelligentScreen`
- Cela évite de bloquer la création si l'API est temporairement indisponible

## 🔄 Flux de navigation

### Scénario 1 : Utilisateur SANS service
```
HomeScreen (création)
  ↓
Vérification services → Aucun service trouvé
  ↓
Génération suggestions IA
  ↓
FormulaireYukpoIntelligentScreen (création service + produit)
```

### Scénario 2 : Utilisateur AVEC service
```
HomeScreen (création)
  ↓
Vérification services → Service trouvé (ID: 123)
  ↓
Génération suggestions IA
  ↓
AjouterProduitSimpleScreen (ajout produit au service 123)
```

## 🧪 Tests à effectuer

1. **Test utilisateur sans service** :
   - Créer un compte nouveau
   - Essayer de créer un service depuis HomeScreen
   - ✅ Vérifier que `FormulaireYukpoIntelligentScreen` s'affiche

2. **Test utilisateur avec service** :
   - Utilisateur avec au moins 1 service existant
   - Essayer de créer un produit depuis HomeScreen
   - ✅ Vérifier que `AjouterProduitSimpleScreen` s'affiche
   - ✅ Vérifier que `serviceId` est correctement passé
   - ✅ Vérifier que les suggestions IA sont chargées

3. **Test avec service inactif** :
   - Utilisateur avec seulement des services inactifs
   - ✅ Vérifier que le premier service (même inactif) est utilisé

4. **Test avec erreur API** :
   - Simuler une erreur lors de la vérification
   - ✅ Vérifier que le système continue vers `FormulaireYukpoIntelligentScreen`

## 🔍 Points de vérification

### Dans HomeScreen.tsx
- ✅ Ligne 108 : Appel API `/api/prestataire/services`
- ✅ Ligne 116-126 : Détection du service actif
- ✅ Ligne 133-165 : Redirection vers `AjouterProduitSimpleScreen` si service existe
- ✅ Ligne 168-195 : Redirection vers `FormulaireYukpoIntelligentScreen` si aucun service

### Logs à vérifier
- `[HomeScreen] Vérification des services existants...`
- `[HomeScreen] ✅ Service existant trouvé: <id>`
- `[HomeScreen] 🎯 Service existant détecté, redirection vers AjouterProduitSimpleScreen`
- `[HomeScreen] 🆕 Aucun service existant, création nouveau service`

## 📝 Notes importantes

1. **Performance** : La vérification est faite AVANT la génération des suggestions IA pour éviter un appel inutile si un service existe

2. **Cohérence** : La logique est identique à celle de `MesServicesScreen.handleAddProduct` pour garantir la cohérence

3. **Fallback** : Si la vérification échoue, le système continue normalement (pas de blocage)

4. **Suggestions IA** : Les suggestions sont générées dans les deux cas pour pré-remplir le formulaire

## 🚀 Prochaines étapes

Si le problème persiste, vérifier :
1. Les logs de vérification des services
2. La structure de la réponse API `/api/prestataire/services`
3. Les erreurs éventuelles lors de la vérification
4. La navigation vers `AjouterProduitSimpleScreen` avec les bons paramètres

