# Configuration de l'API Backend

## 📋 Vue d'ensemble

L'application mobile Yukpomnang peut être configurée pour se connecter à différents serveurs backend selon l'environnement.

## 🔧 Configuration actuelle

### Fichier `.env`
```bash
# URL de l'API backend
EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com

# Environnement
EXPO_PUBLIC_ENVIRONMENT=production

# Clés API
EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY=AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ

# WebSocket URL
EXPO_PUBLIC_WS_URL=wss://yukpomnang.onrender.com

# URL de partage
EXPO_PUBLIC_SHARE_URL=https://yukpomnang.onrender.com
```

## 🌐 Environnements supportés

### 1. Production (Render) - Actuel
```bash
EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_ENVIRONMENT=production
```

### 2. Développement local
```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_ENVIRONMENT=development
```

### 3. Serveur de test/staging
```bash
EXPO_PUBLIC_API_BASE_URL=https://votre-serveur-test.com
EXPO_PUBLIC_ENVIRONMENT=staging
```

### 4. Serveur personnalisé
```bash
EXPO_PUBLIC_API_BASE_URL=https://votre-serveur.com
EXPO_PUBLIC_ENVIRONMENT=production
```

## 🔄 Comment changer l'URL de l'API

### Méthode 1: Modifier le fichier `.env`
1. Ouvrez le fichier `mobile/.env`
2. Modifiez la ligne `EXPO_PUBLIC_API_BASE_URL`
3. Redémarrez l'application

### Méthode 2: Variables d'environnement système
```bash
# Windows PowerShell
$env:EXPO_PUBLIC_API_BASE_URL="http://localhost:3000"
npx expo start

# Linux/Mac
export EXPO_PUBLIC_API_BASE_URL="http://localhost:3000"
npx expo start
```

### Méthode 3: Fichier `.env.local` (priorité)
Créez un fichier `mobile/.env.local` qui aura la priorité sur `.env`:
```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

## 🛠️ Configuration pour différents environnements

### Développement local
```bash
# .env pour développement
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_ENVIRONMENT=development
EXPO_PUBLIC_WS_URL=ws://localhost:3000
EXPO_PUBLIC_SHARE_URL=http://localhost:3000
```

### Production
```bash
# .env pour production
EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_ENVIRONMENT=production
EXPO_PUBLIC_WS_URL=wss://yukpomnang.onrender.com
EXPO_PUBLIC_SHARE_URL=https://yukpomnang.onrender.com
```

### Test/Staging
```bash
# .env pour test
EXPO_PUBLIC_API_BASE_URL=https://test.yukpomnang.com
EXPO_PUBLIC_ENVIRONMENT=staging
EXPO_PUBLIC_WS_URL=wss://test.yukpomnang.com
EXPO_PUBLIC_SHARE_URL=https://test.yukpomnang.com
```

## 🔍 Vérification de la configuration

### 1. Diagnostic réseau intégré
- Utilisez le bouton WiFi dans l'interface
- Teste automatiquement la connectivité à l'API configurée

### 2. Logs de l'application
```javascript
// Dans les logs, vous verrez:
[Mobile API] Making request to: https://votre-api.com/endpoint
```

### 3. Test manuel
```bash
# Test de connectivité
curl -I https://votre-api.com/api/health
```

## ⚠️ Points importants

### 1. Redémarrage requis
Après modification du fichier `.env`, redémarrez l'application:
```bash
npx expo start --clear
```

### 2. Variables EXPO_PUBLIC_
- Toutes les variables doivent commencer par `EXPO_PUBLIC_`
- Elles sont accessibles côté client (mobile)
- Ne pas mettre de données sensibles

### 3. HTTPS/WSS requis en production
- Production: `https://` et `wss://`
- Développement: `http://` et `ws://` acceptés

### 4. CORS et sécurité
- Le serveur backend doit autoriser les requêtes depuis l'app mobile
- Headers CORS appropriés requis

## 🚨 Dépannage

### Erreur "Network request failed"
1. Vérifiez l'URL dans `.env`
2. Testez la connectivité avec le diagnostic intégré
3. Vérifiez que le serveur backend est accessible

### Erreur CORS
1. Vérifiez la configuration CORS du serveur backend
2. Assurez-vous que l'origine mobile est autorisée

### Timeout de connexion
1. Vérifiez la connectivité réseau
2. Augmentez les timeouts si nécessaire
3. Vérifiez la charge du serveur backend

## 📝 Exemple de configuration complète

```bash
# .env complet pour développement
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_ENVIRONMENT=development
EXPO_PUBLIC_GOOGLE_TRANSLATE_API_KEY=AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyDFfWEq1Umm06SNTbR-cRhRQ5Sq_taEAWQ
EXPO_PUBLIC_WS_URL=ws://localhost:3000
EXPO_PUBLIC_SHARE_URL=http://localhost:3000
EXPO_PUBLIC_DEBUG_TRANSLATION=true
EXPO_PUBLIC_DEV_MODE=true
```

---

*Cette configuration est flexible et permet de basculer facilement entre différents environnements sans modifier le code.*