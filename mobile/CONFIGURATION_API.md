# 🔧 Configuration de l'URL de l'API pour le développement mobile

## 🚨 **PROBLÈME IDENTIFIÉ**

L'application mobile était configurée pour pointer vers le serveur de production (`https://yukpomnang.onrender.com`) au lieu du serveur de développement local.

## ✅ **CORRECTION APPLIQUÉE**

Le fichier `mobile/src/config/environment.ts` a été modifié pour détecter automatiquement l'environnement :

```typescript
API_URL: process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://10.0.2.2:8000' : 'https://yukpomnang.onrender.com')
```

## 📱 **URLs selon le type d'appareil**

### Android Emulator (Recommandé)
```
http://10.0.2.2:8000
```
- `10.0.2.2` est l'IP spéciale de l'émulateur Android pour accéder à `localhost` de la machine hôte

### iOS Simulator
```
http://localhost:8000
```

### Device physique (téléphone/tablette réel)
```
http://192.168.x.x:8000
```
Remplacer `192.168.x.x` par l'IP locale de votre machine sur le réseau

#### Comment trouver votre IP locale :

**Windows :**
```powershell
ipconfig
```
Chercher "Adresse IPv4" dans la section Wi-Fi ou Ethernet

**macOS/Linux :**
```bash
ifconfig | grep inet
```

**Exemple :** Si votre IP est `192.168.1.100`, utiliser :
```
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000
```

### Production (Render)
```
https://yukpomnang.onrender.com
```

## 🛠️ **Configuration via variables d'environnement**

### Méthode 1 : Fichier .env (Recommandé)

Créer un fichier `.env` à la racine du dossier `mobile/` :

```env
# Pour Android Emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000

# Pour iOS Simulator
# EXPO_PUBLIC_API_URL=http://localhost:8000

# Pour device physique
# EXPO_PUBLIC_API_URL=http://192.168.1.100:8000

# Environnement
EXPO_PUBLIC_ENVIRONMENT=development
```

### Méthode 2 : Ligne de commande

```bash
# Android Emulator
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000 npm start

# iOS Simulator
EXPO_PUBLIC_API_URL=http://localhost:8000 npm start

# Device physique
EXPO_PUBLIC_API_URL=http://192.168.1.100:8000 npm start
```

## 🧪 **Tester la connexion**

### 1. Vérifier que le backend Rust est en cours d'exécution

```bash
cd backend
cargo run
```

Le backend doit être accessible sur `http://localhost:8000`

### 2. Vérifier la connexion depuis le mobile

Ajouter ce code temporaire dans `HomeScreen.tsx` pour tester :

```typescript
useEffect(() => {
  const testConnection = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/test/ping`);
      const result = await response.json();
      console.log('✅ Connexion API réussie:', result);
    } catch (error) {
      console.error('❌ Erreur connexion API:', error);
      Alert.alert(
        'Erreur de connexion',
        `Impossible de se connecter au backend:\n${API_BASE_URL}\n\nErreur: ${error.message}`
      );
    }
  };
  testConnection();
}, []);
```

### 3. Vérifier les logs

Dans Metro Bundler, vous devriez voir :
```
✅ Connexion API réussie: { status: "ok", ... }
```

Si erreur :
```
❌ Erreur connexion API: Network request failed
```

## 🔍 **Diagnostic des problèmes**

### Erreur : "Network request failed"

**Causes possibles :**
1. Backend Rust non démarré → Lancer `cargo run` dans le dossier backend
2. Mauvaise URL configurée → Vérifier `API_BASE_URL`
3. Pare-feu bloque la connexion → Autoriser le port 8000

### Erreur : "Connection refused"

**Solution :** Le backend n'est pas accessible à cette adresse
- Vérifier que le backend écoute sur `0.0.0.0:8000` (pas seulement `127.0.0.1`)
- Modifier `backend/src/main.rs` si nécessaire :

```rust
let addr = SocketAddr::from(([0, 0, 0, 0], 8000)); // Écouter sur toutes les interfaces
```

### Erreur : "Timeout"

**Solution :** Augmenter le timeout dans `mobile/src/config/environment.ts` :

```typescript
API: {
    TIMEOUT: 60000, // 60 secondes au lieu de 30
    MAX_RETRIES: 5,
    RETRY_DELAY: 2000,
},
```

## 📊 **URLs complètes des endpoints**

Avec `API_BASE_URL = http://10.0.2.2:8000` :

- Recherche : `http://10.0.2.2:8000/api/search/direct`
- Création service : `http://10.0.2.2:8000/api/services/create`
- Auth login : `http://10.0.2.2:8000/auth/login`
- Service par ID : `http://10.0.2.2:8000/api/services/{id}`

## 🚀 **Après correction**

1. Relancer l'application mobile : `npm start` ou `npx expo start`
2. Effacer le cache si nécessaire : `npm start --reset-cache`
3. Tester une recherche : "restaurant", "plombier", etc.
4. Vérifier les logs dans Metro Bundler

## ✅ **Checklist de démarrage**

- [ ] Backend Rust démarré (`cargo run`)
- [ ] URL API configurée selon votre appareil
- [ ] Application mobile lancée (`npm start`)
- [ ] Test de connexion réussi
- [ ] Logs visibles dans Metro Bundler
- [ ] Recherche fonctionne et retourne des résultats

## 🔄 **Changement d'environnement**

Pour passer du développement à la production :

1. Modifier `.env` :
```env
EXPO_PUBLIC_API_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_ENVIRONMENT=production
```

2. Relancer l'app :
```bash
npm start --reset-cache
```

Ou laisser le code détecter automatiquement via `__DEV__`.




