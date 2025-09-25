# Scripts de Transformation et Build Mobile

Ce dossier contient des scripts pour automatiser la transformation du frontend vers mobile et le build de l'application.

## 🚀 Scripts Disponibles

### 1. `auto-transform.ps1`
**Transformation automatique Frontend → Mobile**

```powershell
# Transformer tous les fichiers
.\auto-transform.ps1

# Transformer avec force (écraser les fichiers existants)
.\auto-transform.ps1 -Force
```

**Fonctionnalités :**
- ✅ Lit les fichiers du frontend (NE LES MODIFIE JAMAIS)
- ✅ Transforme les composants React Web en React Native
- ✅ Convertit les routes frontend en navigation mobile
- ✅ Adapte les imports et hooks
- ✅ Génère les fichiers mobiles dans `mobile/src/`

### 2. `auto-build.ps1`
**Build automatique de l'application mobile**

```powershell
# Build complet avec transformation
.\auto-build.ps1 -Transform -Install -Build -Platform android

# Nettoyage + Build
.\auto-build.ps1 -Clean -Transform -Install -Build

# Installation des dépendances seulement
.\auto-build.ps1 -Install

# Build Android
.\auto-build.ps1 -Build -Platform android

# Build iOS
.\auto-build.ps1 -Build -Platform ios
```

**Paramètres :**
- `-Clean` : Nettoie les fichiers de build
- `-Transform` : Transforme le frontend vers mobile
- `-Install` : Installe les dépendances
- `-Build` : Build l'application
- `-Platform` : Plateforme cible (android/ios)

### 3. `start-app.ps1`
**Démarrage simple de l'application**

```powershell
# Démarrer l'application
.\start-app.ps1

# Avec transformation
.\start-app.ps1 -Transform

# Avec nettoyage
.\start-app.ps1 -Clean
```

## 🔄 Processus de Transformation

### Mappings Automatiques

| Frontend | Mobile |
|----------|--------|
| `useNavigate` | `useNavigation` |
| `navigate()` | `navigation.navigate()` |
| `div` | `View` |
| `button` | `TouchableOpacity` |
| `input` | `TextInput` |
| `className` | `style` |
| `toast.error()` | `Alert.alert()` |

### Routes Transformées

| Route Frontend | Screen Mobile |
|----------------|---------------|
| `/` | `Home` |
| `/login` | `Login` |
| `/register` | `Register` |
| `/dashboard` | `Dashboard` |
| `/mon-solde` | `SoldeDetail` |
| `/recharge-tokens` | `RechargeTokens` |

## 📱 Structure Générée

```
mobile/src/
├── screens/           # Pages transformées
│   ├── HomeScreen.tsx
│   ├── LoginScreen.tsx
│   └── ...
├── components/        # Composants transformés
│   ├── ChatInputPanel.tsx
│   └── ...
└── ...
```

## ⚠️ Important

1. **Le frontend n'est JAMAIS modifié** - Les scripts lisent seulement
2. **Les fichiers mobiles sont générés** dans `mobile/src/`
3. **Vérifiez toujours** les fichiers générés avant utilisation
4. **Adaptez manuellement** si nécessaire après transformation

## 🛠️ Utilisation Recommandée

1. **Développement quotidien :**
   ```powershell
   .\start-app.ps1
   ```

2. **Mise à jour depuis le frontend :**
   ```powershell
   .\start-app.ps1 -Transform
   ```

3. **Build de production :**
   ```powershell
   .\auto-build.ps1 -Clean -Transform -Install -Build -Platform android
   ```

## 🔧 Dépannage

### Erreurs de transformation
- Vérifiez que le frontend existe dans `../../frontend/src`
- Assurez-vous que les fichiers sont en UTF-8

### Erreurs de build
- Nettoyez avec `-Clean`
- Réinstallez les dépendances avec `-Install`
- Vérifiez la configuration Expo

### Problèmes de navigation
- Vérifiez que les routes sont correctement mappées
- Adaptez manuellement les navigations complexes

