# 🔍 Vérification Configuration Backend Mobile

## ✅ Résultat de l'Analyse

### Configuration dans `eas.json` ✅ CORRECTE

Les builds **production** et **preview** sont correctement configurés pour pointer vers AWS :

```json
{
  "preview": {
    "env": {
      "EXPO_PUBLIC_API_URL": "https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com",
      "EXPO_PUBLIC_WS_URL": "wss://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com"
    }
  },
  "production": {
    "env": {
      "EXPO_PUBLIC_API_URL": "https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com",
      "EXPO_PUBLIC_WS_URL": "wss://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com"
    }
  }
}
```

### ⚠️ Problème Identifié : Mode Développement

**En mode développement** (`expo start`), les variables d'environnement de `eas.json` **ne sont PAS chargées automatiquement**.

Les fichiers de configuration utilisent des fallbacks vers Render :
- `api.config.ts` : `'https://yukpomnang.onrender.com'`
- `environment.ts` : `'https://yukpomnang.onrender.com'`

## 📋 Fichiers de Configuration

### 1. `mobile/src/config/api.config.ts`
```typescript
const EXPO_API_URL = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL;
export const API_BASE_URL = EXPO_API_URL || 'https://yukpomnang.onrender.com'; // ⚠️ Fallback Render
```

### 2. `mobile/src/config/environment.ts`
```typescript
API_URL: process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://yukpomnang.onrender.com', // ⚠️ Fallback Render
```

### 3. `mobile/eas.json`
```json
{
  "preview": {
    "env": {
      "EXPO_PUBLIC_API_URL": "https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com" // ✅ AWS
    }
  },
  "production": {
    "env": {
      "EXPO_PUBLIC_API_URL": "https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com" // ✅ AWS
    }
  }
}
```

## 🔧 Solutions

### Solution 1 : Créer un fichier `.env` pour le développement (Recommandé)

Créer `mobile/.env` :

```env
EXPO_PUBLIC_API_URL=https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com
EXPO_PUBLIC_WS_URL=wss://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com
EXPO_PUBLIC_ENVIRONMENT=production
```

**Avantages** :
- ✅ Fonctionne en développement local
- ✅ Pas besoin de rebuild
- ✅ Facile à modifier

**Inconvénients** :
- ⚠️ Ne pas commiter `.env` dans Git (ajouter à `.gitignore`)

### Solution 2 : Modifier les fallbacks dans le code

Modifier les fallbacks pour pointer vers AWS par défaut :

```typescript
// api.config.ts
export const API_BASE_URL = EXPO_API_URL || 'https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com';

// environment.ts
API_URL: process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com',
```

**Avantages** :
- ✅ Fonctionne partout par défaut
- ✅ Pas besoin de fichier `.env`

**Inconvénients** :
- ⚠️ Hardcodé dans le code
- ⚠️ Difficile à changer pour différents environnements

## 🎯 Recommandation

**Utiliser Solution 1** (fichier `.env`) car :
1. Plus flexible pour différents environnements
2. Pas de hardcoding dans le code
3. Standard dans les projets Expo/React Native

## 📝 Actions Requises

### 1. Créer le fichier `.env` (Recommandé)

```bash
cd mobile
cat > .env << 'EOF'
EXPO_PUBLIC_API_URL=https://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com
EXPO_PUBLIC_WS_URL=wss://yukpomnang-backend-alb-2043939972.us-east-1.elb.amazonaws.com
EXPO_PUBLIC_ENVIRONMENT=production
EOF
```

### 2. Vérifier `.gitignore`

S'assurer que `.env` est dans `.gitignore` :

```bash
echo ".env" >> mobile/.gitignore
```

### 3. Vérifier la Configuration en Runtime

Ajouter un log pour vérifier l'URL utilisée :

```typescript
// Dans api.config.ts ou au démarrage de l'app
if (__DEV__) {
    console.log('📡 [API Config] API_BASE_URL:', API_BASE_URL);
    console.log('📡 [API Config] EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL);
}
```

## ✅ Checklist

- [x] `eas.json` configuré pour AWS (production/preview)
- [ ] Fichier `.env` créé pour le développement
- [ ] `.env` ajouté à `.gitignore`
- [ ] Fallbacks mis à jour (optionnel, si Solution 2)
- [ ] Test en développement (`expo start`)
- [ ] Test en build preview (`eas build --profile preview`)
- [ ] Test en build production (`eas build --profile production`)

## 🔍 Vérification

### En Développement
```bash
cd mobile
expo start
# Vérifier dans les logs : "📡 [API Config] API_BASE_URL: https://yukpomnang-backend-alb-..."
```

### En Build Preview/Production
Les variables de `eas.json` sont automatiquement injectées lors du build.

## 📊 Résumé

| Mode | Source Variables | URL Backend | Status |
|------|------------------|-------------|--------|
| **Développement** (`expo start`) | `.env` ou fallback | Render (fallback) | ⚠️ À corriger |
| **Preview Build** | `eas.json` (preview) | AWS ✅ | ✅ Correct |
| **Production Build** | `eas.json` (production) | AWS ✅ | ✅ Correct |

## 💡 Note Importante

Les builds EAS (preview/production) utilisent **automatiquement** les variables de `eas.json`, donc ils pointent déjà vers AWS ✅.

Le problème concerne uniquement le **mode développement local** qui nécessite un fichier `.env` pour utiliser AWS au lieu du fallback Render.

