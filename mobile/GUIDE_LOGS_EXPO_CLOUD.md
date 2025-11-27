# 📱 Guide : Capturer les Logs Mobile avec Expo.dev dans le Cloud

## 🎯 Problème

Avec **Expo.dev dans le cloud** (pas en local), vous ne pouvez pas voir les logs directement dans votre terminal. Les logs sont perdus ou difficiles à accéder.

## ✅ Solution : Système de Logging Distant

J'ai créé un système complet qui envoie automatiquement tous les logs mobile au backend pour centralisation.

---

## 🚀 Installation et Configuration

### 1. **Service de Logging Distant** (Déjà créé)

Le service `remoteLoggingService.ts` intercepte automatiquement tous les `console.log()`, `console.error()`, etc. et les envoie au backend.

### 2. **Initialiser dans votre App**

Dans `mobile/App.tsx` ou votre point d'entrée :

```typescript
import { remoteLoggingService } from './src/services/remoteLoggingService';
import { useAuth } from './src/contexts/AuthContext';

// Dans votre composant App
const { user } = useAuth();

useEffect(() => {
    // Initialiser avec l'ID utilisateur
    remoteLoggingService.setUserId(user?.id?.toString());
    
    // Activer le logging distant
    remoteLoggingService.setEnabled(true);
    
    console.log('[App] ✅ Logging distant activé');
}, [user?.id]);
```

### 3. **Backend Endpoint** (Déjà créé)

L'endpoint `/api/mobile-logs` reçoit les logs et les affiche dans les logs backend.

---

## 📊 Méthodes pour Voir les Logs

### **Méthode 1 : Expo.dev Dashboard (Recommandé pour Cloud)**

1. **Aller sur [expo.dev](https://expo.dev)**
2. **Se connecter** avec votre compte
3. **Sélectionner votre projet**
4. **Onglet "Logs"** ou "Development Build"
5. **Voir les logs en temps réel**

**Avantages** :
- ✅ Fonctionne avec Expo.dev cloud
- ✅ Logs en temps réel
- ✅ Pas besoin de configuration locale

### **Méthode 2 : Logs Backend (Centralisés)**

Tous les logs mobile sont maintenant envoyés au backend et apparaissent dans les logs backend :

```bash
# Voir les logs backend (Render.com, Railway, etc.)
# Les logs mobile apparaissent avec le préfixe [MobileLog]

# Exemple de log :
[MobileLog] [HomeScreen] Scroll automatique vers le carousel au démarrage
[MobileLog] [MixedContentCarousel] Auto scroll exécuté
[MobileLog] [console] ERROR: Erreur réseau
```

**Avantages** :
- ✅ Centralisation avec les logs backend
- ✅ Historique complet
- ✅ Recherche facile

### **Méthode 3 : Expo CLI (Si accès local)**

```bash
# Installer Expo CLI
npm install -g expo-cli

# Lancer avec logs
npx expo start --dev-client

# Voir les logs dans le terminal
```

### **Méthode 4 : Expo Go App (Sur téléphone)**

1. **Ouvrir Expo Go** sur votre téléphone
2. **Scanner le QR code** depuis expo.dev
3. **Secouer le téléphone** pour ouvrir le menu développeur
4. **Sélectionner "Show Logs"**

---

## 🔧 Configuration Avancée

### **Activer/Désactiver le Logging Distant**

```typescript
import { remoteLoggingService } from './src/services/remoteLoggingService';

// Désactiver (pour économiser la bande passante)
remoteLoggingService.setEnabled(false);

// Réactiver
remoteLoggingService.setEnabled(true);
```

### **Logger Manuellement**

```typescript
import { remoteLoggingService } from './src/services/remoteLoggingService';

// Logger un message
remoteLoggingService.log('Message info', 'HomeScreen', { data: 'extra' });

// Logger une erreur
remoteLoggingService.error('Erreur critique', 'HomeScreen', error, error.stack);

// Logger un warning
remoteLoggingService.warn('Attention', 'MixedContentCarousel', { index: 5 });

// Logger un debug
remoteLoggingService.debug('Debug info', 'Component', { state: 'loading' });
```

### **Flush Immédiat**

```typescript
// Forcer l'envoi immédiat des logs (sans attendre le batch)
await remoteLoggingService.flush();
```

---

## 📋 Format des Logs dans le Backend

Les logs apparaissent dans les logs backend avec ce format :

```
[MobileLog] [HomeScreen] Message du log
[MobileLog] [MixedContentCarousel] Auto scroll exécuté
[MobileLog] [console] ERROR: Erreur réseau
```

**Pour les erreurs** :
```
[MobileLog] [HomeScreen] Erreur critique: Network request failed
[MobileLog] Stack trace: Error: Network request failed
    at fetch (native)
    at apiGet (api.ts:123)
    ...
```

---

## 🎯 Exemple : Logger le Scroll Automatique

Pour logger spécifiquement le scroll automatique des produits :

```typescript
// Dans mobile/src/components/MixedContentCarousel.tsx

import { remoteLoggingService } from '../services/remoteLoggingService';

// Dans la fonction d'auto-scroll
const handleAutoScroll = () => {
    remoteLoggingService.log(
        'Auto scroll exécuté',
        'MixedContentCarousel',
        {
            currentIndex,
            totalItems: content.length,
            isPaused,
            scrollDelay
        }
    );
    
    // ... reste du code
};
```

---

## 🔍 Filtrer les Logs dans le Backend

### **Dans Render.com** :
1. Aller dans **Logs**
2. Utiliser le filtre : `[MobileLog]`
3. Voir uniquement les logs mobile

### **Dans les logs locaux** :
```bash
# Filtrer les logs mobile
tail -f backend.log | grep "\[MobileLog\]"

# Filtrer les erreurs mobile uniquement
tail -f backend.log | grep "\[MobileLog\].*ERROR"
```

---

## ⚙️ Configuration du Batch

Par défaut, les logs sont envoyés par batch de 10 logs ou toutes les 5 secondes.

Pour modifier :

```typescript
// Dans remoteLoggingService.ts
private batchSize: number = 10;        // Nombre de logs par batch
private flushInterval: number = 5000;  // Intervalle en ms
```

---

## 🚨 Logs d'Erreur Critiques

Les erreurs (`console.error`) sont **immédiatement** loggées dans le backend avec le niveau `ERROR`, même si le batch n'est pas plein.

---

## 📊 Dashboard de Logs (Optionnel - Futur)

Pour un dashboard plus avancé, vous pouvez :

1. **Créer une table `mobile_logs`** dans PostgreSQL
2. **Sauvegarder les logs** dans la base
3. **Créer une interface web** pour visualiser les logs

**Exemple de migration SQL** :
```sql
CREATE TABLE mobile_logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    component VARCHAR(100),
    data JSONB,
    user_id INTEGER REFERENCES users(id),
    device_info JSONB,
    stack TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mobile_logs_level ON mobile_logs(level);
CREATE INDEX idx_mobile_logs_user ON mobile_logs(user_id);
CREATE INDEX idx_mobile_logs_created ON mobile_logs(created_at);
```

---

## ✅ Checklist de Mise en Place

- [x] Service `remoteLoggingService.ts` créé
- [x] Endpoint backend `/api/mobile-logs` créé
- [ ] Route ajoutée dans `backend/src/lib.rs`
- [ ] Service initialisé dans `App.tsx`
- [ ] Tester l'envoi de logs
- [ ] Vérifier les logs dans le backend

---

## 🎯 Résultat Attendu

Après configuration, vous devriez voir dans les logs backend :

```
[MobileLog] Reçu 10 logs (batch: batch_1234567890_abc123)
[MobileLog] [HomeScreen] ✅ Logging distant activé
[MobileLog] [MixedContentCarousel] Auto scroll exécuté
[MobileLog] [console] ERROR: Erreur réseau
```

**Tous vos logs mobile sont maintenant centralisés dans le backend !** 🎉

