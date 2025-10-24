# 🔧 GUIDE CONFIGURATION SERVEUR BACKEND

## ✅ **BONNE NOUVELLE : Votre code est bien configuré !**

Le système utilise **TOUJOURS les variables d'environnement en priorité** avec un fallback sur Render.com. C'est une excellente pratique !

---

## 📍 **OÙ RENDER.COM EST MENTIONNÉ**

### 1. **eas.json** (Configuration de build) ✅ NORMAL
**Fichier :** `mobile/eas.json`

```json
"preview": {
  "env": {
    "EXPO_PUBLIC_API_URL": "https://yukpomnang.onrender.com",
    "EXPO_PUBLIC_WS_URL": "wss://yukpomnang.onrender.com"
  }
}
```

**C'est ici qu'on DOIT changer** pour pointer vers un nouveau serveur !

### 2. **Fichiers de configuration** (Fallback uniquement) ✅ OK
Ces fichiers utilisent render.com **SEULEMENT** si la variable d'environnement n'est pas définie :

```typescript
// api.config.ts (ligne 17)
export const API_BASE_URL = EXPO_API_URL || 'https://yukpomnang.onrender.com';

// environment.ts (ligne 10)
API_URL: process.env.EXPO_PUBLIC_API_URL || 'https://yukpomnang.onrender.com'

// websocket.ts (lignes 11, 17, 23, 29)
const baseUrl = process.env.EXPO_PUBLIC_WS_URL || 'wss://yukpomnang.onrender.com'
```

**C'est parfait !** Le fallback assure que l'app fonctionne même sans variables d'environnement.

---

## 🔄 **COMMENT CHANGER DE SERVEUR BACKEND**

### Méthode 1: Via eas.json (RECOMMANDÉ)

**Pour changer vers votre nouveau serveur :**

1. **Modifier eas.json** :

```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://votre-nouveau-serveur.com",
        "EXPO_PUBLIC_WS_URL": "wss://votre-nouveau-serveur.com",
        // ... autres variables inchangées
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://votre-nouveau-serveur.com",
        "EXPO_PUBLIC_WS_URL": "wss://votre-nouveau-serveur.com",
        // ... autres variables inchangées
      }
    }
  }
}
```

2. **Rebuild l'application** :
```bash
npx eas build --platform android --profile preview
```

C'est tout ! Aucun autre fichier à modifier.

### Méthode 2: Via fichier .env (Développement local)

**Créer/Modifier `.env` :**

```bash
# .env
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_WS_URL=ws://localhost:3000
EXPO_PUBLIC_ENVIRONMENT=development
```

**Puis :**
```bash
npm start
# OU
expo start
```

### Méthode 3: Via EAS Environment Variables (Sur expo.dev)

**Pour gérer les variables sans modifier eas.json :**

1. Aller sur https://expo.dev
2. Sélectionner votre projet "yukpomnang-mobile"
3. Secrets → Add Secret
4. Ajouter :
   - `EXPO_PUBLIC_API_URL` = `https://votre-serveur.com`
   - `EXPO_PUBLIC_WS_URL` = `wss://votre-serveur.com`

**Avantage :** Changement sans modifier le code !

---

## 🌍 **ENVIRONNEMENTS MULTIPLES**

### Configuration actuelle dans eas.json :

```json
"development" → Render.com (dev/test)
"preview" → Render.com (production)
"production" → Render.com (production)
"debug" → Render.com (development)
```

### Configuration recommandée (multi-environnements) :

```json
{
  "build": {
    "development": {
      "env": {
        "EXPO_PUBLIC_API_URL": "http://localhost:3000",
        "EXPO_PUBLIC_ENVIRONMENT": "development"
      }
    },
    "preview": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://staging.votreserveur.com",
        "EXPO_PUBLIC_ENVIRONMENT": "staging"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.votreserveur.com",
        "EXPO_PUBLIC_ENVIRONMENT": "production"
      }
    }
  }
}
```

**Puis builder selon l'environnement :**
```bash
# Dev local
npx eas build --profile development

# Staging/Preview
npx eas build --profile preview

# Production
npx eas build --profile production
```

---

## 🎯 **MIGRATION VERS NOUVEAU SERVEUR - CHECKLIST**

### Étape 1: Préparer le nouveau serveur
- [ ] Déployer le code backend sur le nouveau serveur
- [ ] Configurer la base de données PostgreSQL
- [ ] Configurer Redis (si utilisé)
- [ ] Configurer les variables d'environnement backend
- [ ] Tester : `curl https://votre-serveur.com/api/health`

### Étape 2: Mettre à jour eas.json
```json
"preview": {
  "env": {
    "EXPO_PUBLIC_API_URL": "https://votre-serveur.com",
    "EXPO_PUBLIC_WS_URL": "wss://votre-serveur.com"
  }
}
```

### Étape 3: Rebuild l'application
```bash
npx eas build --platform android --profile preview
```

### Étape 4: Tester
- [ ] Login/Register
- [ ] Création de service
- [ ] Recherche
- [ ] WebSocket (chat)
- [ ] Notifications
- [ ] GPS

### Étape 5: Déployer
- [ ] Publier sur Google Play Store
- [ ] OU distribuer l'APK directement

---

## ⚠️ **POINTS D'ATTENTION**

### SSL/TLS (HTTPS)
- ✅ **Obligatoire** pour la production
- ✅ WebSocket doit être WSS:// (pas WS://)
- ✅ Certificat SSL valide requis

### CORS
Votre nouveau serveur doit autoriser les requêtes depuis l'app mobile :
```rust
// backend/src/middlewares/cors_middleware.rs
Access-Control-Allow-Origin: *
// OU spécifique à votre domaine
```

### Variables d'environnement backend
Assurez-vous que le nouveau serveur a :
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- etc.

---

## 📝 **EXEMPLE CONCRET - MIGRATION AWS**

### Scénario : Migrer de Render.com vers AWS EC2

**1. Déployer backend sur AWS EC2 :**
```bash
# IP publique : 54.123.45.67
# Domaine : api.yukpomnang.com (avec SSL)
```

**2. Modifier eas.json :**
```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api.yukpomnang.com",
        "EXPO_PUBLIC_WS_URL": "wss://api.yukpomnang.com",
        "EXPO_PUBLIC_ENVIRONMENT": "production"
      }
    }
  }
}
```

**3. Rebuild :**
```bash
npx eas build --platform android --profile production
```

**4. Tester et déployer !**

---

## 🔍 **VÉRIFICATION ACTUELLE**

### Votre configuration actuelle :

**Fichiers qui utilisent les variables d'environnement :**
```
✅ src/config/api.config.ts
   → EXPO_PUBLIC_API_URL en priorité
   → Fallback: render.com

✅ src/config/environment.ts
   → EXPO_PUBLIC_API_URL en priorité
   → Fallback: render.com

✅ src/config/websocket.ts
   → EXPO_PUBLIC_WS_URL en priorité
   → Fallback: render.com

✅ src/services/websocketService.ts
   → EXPO_PUBLIC_WS_URL en priorité
   → Fallback: render.com
```

**Fichier où changer l'URL :**
```
✅ mobile/eas.json (lignes 24-25, 46-47, etc.)
   → C'est LE fichier à modifier pour changer de serveur
```

### ✅ **CONCLUSION : Votre système est bien fait !**

Render.com est utilisé **UNIQUEMENT comme fallback**. Pour changer de serveur, il suffit de :

1. **Modifier eas.json** (1 fichier)
2. **Rebuild l'app** (1 commande)

**Aucun code à modifier !** 🎉

---

## 🎁 **BONUS : Script de migration**

Je vous crée un script pour faciliter les futures migrations :

**`mobile/scripts/change-backend-url.js` :**
```javascript
const fs = require('fs');
const path = require('path');

const NEW_API_URL = process.argv[2];
const NEW_WS_URL = process.argv[3];

if (!NEW_API_URL || !NEW_WS_URL) {
  console.log('Usage: node scripts/change-backend-url.js <API_URL> <WS_URL>');
  console.log('Example: node scripts/change-backend-url.js https://api.yukpo.com wss://api.yukpo.com');
  process.exit(1);
}

const easJsonPath = path.join(__dirname, '..', 'eas.json');
const easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));

// Mettre à jour tous les profils
Object.keys(easJson.build).forEach(profile => {
  if (easJson.build[profile].env) {
    easJson.build[profile].env.EXPO_PUBLIC_API_URL = NEW_API_URL;
    easJson.build[profile].env.EXPO_PUBLIC_WS_URL = NEW_WS_URL;
  }
});

fs.writeFileSync(easJsonPath, JSON.stringify(easJson, null, 2));

console.log('✅ URLs backend mises à jour dans eas.json');
console.log(`   API: ${NEW_API_URL}`);
console.log(`   WS: ${NEW_WS_URL}`);
console.log('\n🚀 Prochaine étape: npx eas build --platform android --profile preview');
```

**Usage :**
```bash
node scripts/change-backend-url.js https://api.monserveur.com wss://api.monserveur.com
```

---

**Votre système est flexible et prêt pour tout changement de serveur ! 🎉**

