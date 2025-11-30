# 🧪 Guide de Test : Détection des Produits Existants

## 📋 Informations du Compte de Test

**Email** : `lelehernandez02007@yahoo.fr`  
**Mot de passe** : `Hernandez87`  
**Statut** : Ce compte a déjà un produit

---

## 🎯 Objectif du Test

Analyser le workflow de détection des produits existants pour comprendre pourquoi `FormulaireYukpoIntelligentScreen` s'ouvre au lieu de `AjouterProduitSimpleScreen` alors que l'utilisateur a déjà un produit.

---

## 📱 Étapes du Test

### Étape 1 : Connexion

1. Ouvrir l'application mobile
2. Se connecter avec :
   - Email : `lelehernandez02007@yahoo.fr`
   - Mot de passe : `Hernandez87`
3. Vérifier que la connexion est réussie

### Étape 2 : Lancer le Test Automatique

1. Sur l'écran `HomeScreen`, **maintenir appuyé pendant 2 secondes** sur l'icône **🧪** (bouton de test) dans le header
2. Le test va :
   - Appeler toutes les API de détection
   - Analyser les réponses
   - Générer un rapport complet
3. Le résultat sera :
   - Affiché dans une alerte
   - Copié dans le presse-papier
   - Loggé dans la console

### Étape 3 : Test Manuel du Workflow

1. Sur `HomeScreen`, cocher la case **"Créer un service"**
2. Saisir un texte de test (ex: "Vente de frigos américains")
3. Cliquer sur **"Créer un service"**
4. **Observer** :
   - Quel écran s'ouvre : `AjouterProduitSimple` ou `FormulaireYukpoIntelligent` ?
   - Si c'est `FormulaireYukpoIntelligent`, noter l'étape affichée (mini formulaire ou formulaire complet)

### Étape 4 : Analyser les Logs

1. Ouvrir les logs de l'application (React Native Debugger, Metro, ou logs système)
2. Chercher les logs suivants :
   ```
   [HomeScreen] 🔍 Vérification si utilisateur a déjà un service avec produits...
   [HomeScreen] Réponse /api/prestataire/services: {...}
   [HomeScreen] 🔍 Analyse service: {...}
   [productNormalizer] ✅ Format {...} détecté: X produits
   [HomeScreen] 📊 Résumé vérification: {...}
   [HomeScreen] 🛍️ Navigation vers formulaire SIMPLE
   OU
   [HomeScreen] 📝 Navigation vers formulaire COMPLET
   ```

---

## 📊 Résultats Attendus

### Si la Détection Fonctionne ✅

**Logs** :
```
[HomeScreen] ✅ Service avec produits trouvé via /api/prestataire/services (ID: X)
[HomeScreen] → Ouverture formulaire SIMPLE pour ajouter produit
[HomeScreen] 🛍️ Navigation vers formulaire SIMPLE (AjouterProduitSimple)
```

**Comportement** :
- L'écran `AjouterProduitSimpleScreen` s'ouvre directement
- Le formulaire simple pour ajouter un produit s'affiche

### Si la Détection Échoue ❌

**Logs** :
```
[HomeScreen] ℹ️ Services trouvés mais aucun n'a de produits
OU
[HomeScreen] ℹ️ Aucun service avec produits détecté → Formulaire COMPLET
[HomeScreen] 📝 Navigation vers formulaire COMPLET (FormulaireYukpoIntelligent)
```

**Comportement** :
- L'écran `FormulaireYukpoIntelligentScreen` s'ouvre
- Le mini formulaire (étape 1) s'affiche avec les données à analyser

---

## 🔍 Points d'Analyse Critiques

### 1. Structure des Données Retournées

**Vérifier dans les logs** :
- `[HomeScreen] 🔍 Analyse service:` → Structure du service
- `produitsType` : Type du champ produits (`object`, `array`, etc.)
- `produitsKeys` : Clés de l'objet produits (`['valeur', 'type_donnee']`, etc.)
- `produitsIsArray` : Si `produits` est directement un array

**Exemple de structure attendue** :
```json
{
  "serviceId": 123,
  "hasData": true,
  "hasProduits": true,
  "produitsType": "object",
  "produitsKeys": ["valeur", "type_donnee", "origine_champs"],
  "produitsIsArray": false
}
```

### 2. Normalisation des Produits

**Vérifier dans les logs** :
- `[productNormalizer] ✅ Format {...} détecté: X produits`
- `[HomeScreen] 🔍 Service ID X - Produits normalisés: Y`

**Si `Y = 0` mais que des produits existent** :
- Vérifier `[productNormalizer] ⚠️ Structure produits non reconnue`
- Voir le `sample` dans les logs pour comprendre la structure réelle

### 3. Réponses des API

**Vérifier pour chaque tentative** :
- `success` : `true` ou `false`
- `hasData` : `true` ou `false`
- `isArray` : `true` ou `false`
- `length` : Nombre de services/produits retournés

**Exemple** :
```json
{
  "success": true,
  "hasData": true,
  "isArray": true,
  "length": 2
}
```

### 4. Erreurs Potentielles

**Chercher** :
- `[HomeScreen] ❌ Erreur vérification services:`
- `[HomeScreen] ⚠️ Erreur vérification produits service:`
- `[productNormalizer] ⚠️ Structure produits non reconnue:`

**Analyser** :
- Message d'erreur
- Stack trace
- Réponse de l'API (si disponible)

---

## 📋 Checklist de Diagnostic

### Avant le Test

- [ ] Compte connecté avec succès
- [ ] Vérifier que le compte a bien des produits (via `MesProduitsScreen`)
- [ ] Noter l'ID du service qui contient des produits

### Pendant le Test Automatique

- [ ] Test lancé avec succès (icône 🧪)
- [ ] Résultat affiché dans l'alerte
- [ ] Résultat copié dans le presse-papier
- [ ] Logs visibles dans la console

### Pendant le Test Manuel

- [ ] Case "Créer un service" cochée
- [ ] Texte saisi
- [ ] Bouton "Créer un service" cliqué
- [ ] Écran ouvert noté (`AjouterProduitSimple` ou `FormulaireYukpoIntelligent`)

### Analyse des Résultats

- [ ] Structure des services analysée
- [ ] Format des produits identifié
- [ ] Nombre de produits détecté
- [ ] Raison de l'échec identifiée (si applicable)
- [ ] Erreurs analysées (si présentes)

---

## 🐛 Scénarios de Défaillance Possibles

### Scénario 1 : API Retourne des Services Sans Produits

**Symptômes** :
```
[HomeScreen] ℹ️ Services trouvés mais aucun n'a de produits
```

**Cause possible** :
- Les produits ne sont pas dans `service.data.produits`
- Les produits sont dans un format non reconnu
- `normalizeServiceProducts` retourne `[]`

**Solution** :
- Vérifier la structure exacte dans les logs
- Adapter `normalizeServiceProducts` si nécessaire

### Scénario 2 : Structure de Produits Non Reconnue

**Symptômes** :
```
[productNormalizer] ⚠️ Structure produits non reconnue: {...}
[HomeScreen] ⚠️ Service a un champ produits mais normalizeServiceProducts retourne vide
```

**Cause possible** :
- Format de données différent de ceux supportés
- Produits dans un champ différent (`service.produits_list` au lieu de `service.data.produits`)

**Solution** :
- Analyser le `sample` dans les logs
- Ajouter le nouveau format dans `normalizeServiceProducts`

### Scénario 3 : Erreur API

**Symptômes** :
```
[HomeScreen] ❌ Erreur vérification services: {...}
```

**Cause possible** :
- Problème réseau
- API retourne une erreur
- Timeout

**Solution** :
- Vérifier la connexion
- Vérifier les logs d'erreur détaillés
- Tester les API individuellement

### Scénario 4 : service_id Manquant dans Fallback 3

**Symptômes** :
```
[HomeScreen] ✅ Produits trouvés via /api/products/my-products
[HomeScreen] ⚠️ Produits trouvés mais service_id manquant dans le premier produit
```

**Cause possible** :
- Les produits n'ont pas de `service_id`
- Le champ s'appelle différemment (`serviceId`, `service.id`, etc.)

**Solution** :
- Vérifier la structure des produits dans les logs
- Adapter l'extraction du `service_id`

---

## 📤 Rapport de Test

### Format du Rapport

Après le test, créer un rapport avec :

1. **Informations du compte** :
   - Email
   - ID utilisateur
   - Nombre de services
   - Nombre de produits

2. **Résultats des tentatives** :
   - Pour chaque API appelée :
     - Succès/Échec
     - Nombre de services/produits trouvés
     - Structure des données
     - Erreurs éventuelles

3. **Décision finale** :
   - `hasExistingServiceWithProducts` : `true` ou `false`
   - `firstServiceId` : ID ou `null`
   - Navigation choisie : `AjouterProduitSimple` ou `FormulaireYukpoIntelligent`
   - Raison de la décision

4. **Diagnostic** :
   - Structure des services
   - Structure des produits
   - Points de défaillance identifiés

5. **Comportement observé** :
   - Écran ouvert lors du test manuel
   - Correspondance avec la décision automatique

---

## 🔧 Utilisation du Script de Test

Le script `productDetectionTest.ts` peut être utilisé de deux façons :

### 1. Via le Bouton dans HomeScreen

- Maintenir appuyé 2 secondes sur l'icône 🧪 dans le header
- Le test s'exécute automatiquement
- Résultat affiché et copié dans le presse-papier

### 2. Via le Code (pour développement)

```typescript
import { runProductDetectionTest, formatTestResult } from '../utils/productDetectionTest';

const testResult = await runProductDetectionTest(userId, userEmail);
const formatted = formatTestResult(testResult);
console.log(formatted);
```

---

## 📝 Notes Importantes

1. **Le test automatique ne modifie pas les données** : Il ne fait que lire les API
2. **Les logs sont essentiels** : Toujours vérifier les logs pour comprendre les problèmes
3. **Le presse-papier** : Le résultat est copié automatiquement pour faciliter le partage
4. **Test manuel nécessaire** : Le test automatique ne remplace pas le test du workflow réel

---

*Guide créé le ${new Date().toISOString()}*

