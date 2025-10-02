# 🚀 Build EAS avec Logs Visibles

## ✅ Modifications Appliquées

J'ai ajouté un composant **DevLogs** qui affichera les logs **directement dans votre APK** en bas de l'écran !

### Fichiers modifiés :
1. ✅ `mobile/src/components/DevLogs.tsx` - Nouveau composant créé
2. ✅ `mobile/App.tsx` - DevLogs ajouté à l'app

## 📱 À Quoi ça Ressemble

Quand vous ouvrirez votre app après le build, vous verrez :

```
┌─────────────────────────────────────────┐
│                                         │
│        Votre App Normale               │
│                                         │
├─────────────────────────────────────────┤
│ 📋 Dev Logs (15)    [ − ] [ 🗑️ ] [ ✕ ] │
├─────────────────────────────────────────┤
│ 10:30:45                               │
│ [AuthContext] user: false              │
│ ────────────────────────────────────── │
│ 10:30:46                               │
│ [LoginScreen] handleLogin appelé       │
│ ────────────────────────────────────── │
│ 10:30:47                               │
│ [AuthContext] Token reçu ✅            │
└─────────────────────────────────────────┘
```

**Fonctionnalités :**
- **[ − ]** = Minimiser les logs
- **[ 🗑️ ]** = Vider les logs
- **[ ✕ ]** = Cacher les logs (apparaît comme bouton flottant)

## 🔨 Étapes pour Builder

### 1️⃣ Vérifier les modifications

```bash
cd mobile

# Vérifier que DevLogs.tsx existe
dir src\components\DevLogs.tsx

# Vérifier que App.tsx importe DevLogs
findstr "DevLogs" App.tsx
```

Vous devriez voir :
```
import DevLogs from './src/components/DevLogs';
<DevLogs />
```

### 2️⃣ Builder avec EAS

```bash
npx eas build --platform android --profile preview --non-interactive
```

**Durée estimée :** 10-15 minutes

### 3️⃣ Télécharger et Installer l'APK

Une fois le build terminé :

1. **Récupérer le lien de téléchargement :**
```bash
npx eas build:list
```

2. **Sur votre téléphone :**
   - Cliquez sur le lien pour télécharger l'APK
   - Installez l'APK (autorisez les sources inconnues si demandé)

### 4️⃣ Tester la Connexion

1. Ouvrez l'app
2. **Vous devriez déjà voir les logs en bas** avec :
   ```
   [AuthContext] ═══ État actuel ═══
   [AuthContext] user: false
   [AuthContext] loading: true
   ```

3. Entrez vos credentials :
   - Email: `siaka@yahoo.fr`
   - Mot de passe: `Hernandez87`

4. Cliquez sur "Se connecter"

5. **Regardez les logs en bas de l'écran !** Vous verrez en temps réel :
   ```
   [LoginScreen] handleLogin appelé
   [AuthContext] Tentative de connexion pour: siaka@yahoo.fr
   [Mobile API] Making request to: https://yukpomnang.onrender.com/auth/login
   [AuthContext] Token reçu, décodage JWT...
   [AuthContext] ✅ setUser() appelé avec: { id: '17', ... }
   [AppNavigator] useEffect déclenché - user changed
   [AppNavigator] ✅ Changement d'utilisateur détecté !
   ```

## 📊 Que Chercher dans les Logs

### ✅ Si la connexion RÉUSSIT, vous verrez :

```
[AuthContext] Token reçu, décodage JWT...
[AuthContext] ✅ setUser() appelé
[AuthContext] ✅ forceRender incrémenté
[AppNavigator] ✅ Changement d'utilisateur détecté !
[AppNavigator] ✅ Utilisateur connecté, affichage MainStack
```

Et l'écran devrait changer pour afficher l'accueil ! 🎉

### ❌ Si la connexion ÉCHOUE, vous verrez :

**Scénario 1 : Erreur réseau**
```
[Mobile API] Erreur réseau: Failed to fetch
```
→ Problème : Votre téléphone n'accède pas à internet ou au backend

**Scénario 2 : Erreur d'authentification**
```
[AuthContext] ❌ Échec connexion: Mot de passe incorrect
```
→ Problème : Credentials incorrectes

**Scénario 3 : Token non reçu**
```
[AuthContext] Token reçu, décodage JWT...
Error: Invalid JWT format
```
→ Problème : Le backend a renvoyé un token invalide

**Scénario 4 : State non mis à jour**
```
[AuthContext] ✅ setUser() appelé
[AuthContext] ✅ forceRender incrémenté
(mais pas de log AppNavigator)
```
→ Problème : AppNavigator ne détecte pas le changement

## 📸 Ce que je veux voir

Une fois que vous avez testé, **prenez une capture d'écran des logs** et envoyez-la moi !

Ou copiez-collez le texte des logs que vous voyez.

## ⚡ Build Rapide (Profile Development)

Si vous voulez un build plus rapide pour tester :

```bash
# Build de développement (plus rapide, ~5 min)
npx eas build --platform android --profile development --non-interactive

# Ou utilisez Expo Go (instantané, pas de build)
npx expo start
```

## 🐛 Si les logs ne s'affichent pas

Si vous ne voyez pas le panneau de logs en bas :

1. Vérifiez que `DevLogs.tsx` existe dans `src/components/`
2. Vérifiez que `App.tsx` contient `<DevLogs />`
3. Rebuildez l'app

## 📋 Checklist avant de Builder

- [ ] `mobile/src/components/DevLogs.tsx` existe
- [ ] `mobile/App.tsx` importe DevLogs
- [ ] `mobile/App.tsx` contient `<DevLogs />`
- [ ] Les modifications dans AuthContext.tsx sont présentes (forceRender)
- [ ] Les modifications dans AppNavigator.tsx sont présentes (navigationKey)

## 🚀 Commande Finale

```bash
cd mobile
npx eas build --platform android --profile preview --non-interactive
```

**Puis une fois l'APK installé, testez la connexion et regardez les logs en bas de l'écran ! 📱**

---

**Questions ?**
- Combien de temps ça prend ? → 10-15 minutes
- Ça marche sur iOS aussi ? → Oui, remplacez `android` par `ios`
- Et si je veux pas les logs en production ? → Enlevez `<DevLogs />` de App.tsx

**Prêt à builder ? Lancez la commande et attendez que le build se termine ! ⏳**


