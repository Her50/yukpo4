# Corrections des problèmes d'authentification mobile

## Problèmes identifiés

### 1. Problème de navigation après connexion
- **Symptôme** : Après connexion/inscription, impossible d'accéder à la page d'accueil
- **Cause** : L'application mobile utilisait `authApi.verifyToken()` au lieu du décodage JWT direct comme le frontend
- **Impact** : Appels API inutiles et potentiels échecs de navigation

### 2. Plantage de l'application après redémarrage
- **Symptôme** : Après 3 secondes, la page d'accueil s'ouvre mais toute action fait planter l'app (écran blanc)
- **Cause** : Re-renders forcés dans l'AuthContext qui causaient des conflits d'état
- **Impact** : Application inutilisable après redémarrage

### 3. Interface utilisateur
- **Symptôme** : Bloc "Actions rapides" en bas de la page d'accueil
- **Demande** : Déplacer ces actions dans un menu déroulant dans la barre de navigation

## Solutions appliquées

### 1. Correction de l'authentification (`src/contexts/AuthContext.tsx`)

#### Avant :
```typescript
// Utilisait un appel API pour vérifier le token
const response = await authApi.verifyToken();
if (response.data) {
  setUser(response.data as User);
}
```

#### Après :
```typescript
// Décodage JWT direct comme dans le frontend
const decoded = jwtDecode<DecodedToken>(token);
if (decoded.exp * 1000 > Date.now()) {
  const userData: User = {
    id: String(decoded.sub),
    email: decoded.email,
    role: decoded.role,
    name: decoded.name || '',
    credits: decoded.tokens_balance ?? 0,
    phone: '',
    photo: '',
    token: token
  };
  setUser(userData);
}
```

### 2. Suppression des re-renders forcés

#### Avant :
```typescript
// Re-render forcé qui causait des plantages
setUser(null);
await new Promise(resolve => setTimeout(resolve, 50));
setUser(userData);
```

#### Après :
```typescript
// Simple définition de l'utilisateur
setUser(userData);
```

### 3. Amélioration de la gestion des timeouts

#### Nouveau fichier : `src/config/appConfig.ts`
```typescript
export const APP_CONFIG = {
  AUTH_TIMEOUT: 10000,
  API_TIMEOUT: 15000,
  LOADING_TIMEOUT: 5000,
  AUTH: {
    AUTH_CHECK_DELAY: 100,
    FORCE_LOADING_END_DELAY: 5000,
  },
  // ...
};
```

### 4. Interface utilisateur améliorée

#### Suppression du bloc actions rapides de `HomeScreen.tsx`
- Supprimé la section "Actions rapides" qui était en bas de la page
- Supprimé les styles associés (`quickActions`, `actionsGrid`, etc.)

#### Création du menu déroulant `QuickActionsMenu.tsx`
- Nouveau composant Modal avec les actions rapides
- Intégration dans la barre de navigation comme onglet "Menu"
- Actions disponibles : Mes Services, Mon Historique, Recharger Tokens, Dashboard, Paramètres
- Note : "Mon Profil" supprimé car déjà disponible dans le menu principal

#### Modification de `AppNavigator.tsx`
- Ajout d'un onglet "Menu" dans la barre de navigation
- Gestion de l'état du menu déroulant
- Prévention de la navigation vers une page vide pour l'onglet Menu

### 5. Amélioration des logs

#### Avant :
```typescript
console.log('[AuthContext] Message...');
```

#### Après :
```typescript
import { logAuth, logNavigation } from '../config/appConfig';
logAuth('Message...', data);
logNavigation('Message...', data);
```

## Fichiers modifiés

1. **`src/contexts/AuthContext.tsx`**
   - Remplacement de `verifyToken()` par décodage JWT direct
   - Suppression des re-renders forcés
   - Ajout de timeouts de sécurité
   - Amélioration des logs

2. **`src/navigation/AppNavigator.tsx`**
   - Ajout du menu déroulant QuickActionsMenu
   - Modification de la barre de navigation (4 onglets au lieu de 5)
   - Amélioration des logs

3. **`src/screens/HomeScreen.tsx`**
   - Suppression du bloc "Actions rapides"
   - Suppression des styles associés
   - Interface plus épurée

4. **`src/components/QuickActionsMenu.tsx`** (nouveau)
   - Composant Modal pour les actions rapides
   - Intégration avec la navigation
   - Design moderne et responsive

5. **`src/config/appConfig.ts`** (nouveau)
   - Configuration centralisée de l'application
   - Gestion des timeouts
   - Fonctions utilitaires pour les logs et retry

## Tests recommandés

1. **Test de connexion** :
   - Se connecter avec des identifiants valides
   - Vérifier que la navigation vers l'accueil fonctionne
   - Vérifier qu'aucun plantage ne se produit

2. **Test après redémarrage** :
   - Redémarrer l'application
   - Vérifier que l'utilisateur reste connecté
   - Tester les actions sur la page d'accueil

3. **Test du menu déroulant** :
   - Cliquer sur l'onglet "Menu" dans la barre de navigation
   - Vérifier que le menu s'ouvre correctement
   - Tester la navigation vers chaque action

4. **Test sur différents appareils** :
   - Tester sur plusieurs appareils Android
   - Vérifier que le problème est résolu sur tous les appareils

## Résultat attendu

- ✅ Connexion/inscription fonctionne sans problème
- ✅ Navigation vers la page d'accueil après authentification
- ✅ Aucun plantage après redémarrage de l'application
- ✅ Interface utilisateur améliorée avec menu déroulant
- ✅ Application stable sur tous les appareils de test

## Commandes utiles

```bash
# Tester les corrections
cd mobile
./scripts/test-auth-fixes.ps1

# Démarrer l'application
npm start

# Build pour Android
npm run android
```
