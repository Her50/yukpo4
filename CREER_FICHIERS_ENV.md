# 🚀 CRÉER LES FICHIERS .env - GUIDE RAPIDE

## ⚠️ VARIABLES MANQUANTES DÉTECTÉES

Vous avez raison ! Les variables WebSocket (`EXPO_PUBLIC_WS_URL` et `VITE_WS_BASE_URL`) sont **NOUVELLES** et doivent être ajoutées à vos fichiers `.env`.

---

## 📱 MOBILE - Créer/Modifier `mobile/.env`

### Ouvrez ou créez le fichier `mobile/.env` et ajoutez:

```env
# ============================================
# MOBILE - Configuration Yukpomnang
# ============================================

# URL API Backend (Vous aviez déjà celle-ci)
EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com

# ✅ NOUVEAU - URL WebSocket (AJOUTEZ CETTE LIGNE)
EXPO_PUBLIC_WS_URL=wss://yukpomnang.onrender.com

# Environnement
EXPO_PUBLIC_ENVIRONMENT=production

# ✅ NOUVEAU - URL de partage (AJOUTEZ CETTE LIGNE)
EXPO_PUBLIC_SHARE_URL=https://yukpomnang.com
```

---

## 🌐 FRONTEND - Créer/Modifier `frontend/.env`

### Ouvrez ou créez le fichier `frontend/.env` et ajoutez:

```env
# ============================================
# FRONTEND - Configuration Yukpomnang
# ============================================

# URL API Backend (Vous aviez probablement déjà celle-ci)
VITE_API_BASE_URL=https://yukpomnang.onrender.com

# ✅ NOUVEAU - URL WebSocket (AJOUTEZ CETTE LIGNE)
VITE_WS_BASE_URL=wss://yukpomnang.onrender.com

# Environnement
VITE_ENVIRONMENT=production

# ✅ NOUVEAU - URL publique (AJOUTEZ CETTE LIGNE)
VITE_PUBLIC_URL=https://yukpomnang.com
```

---

## 🔧 COMMANDES POWERSHELL POUR CRÉER LES FICHIERS

### Si vous n'avez PAS de fichiers .env:

```powershell
# Créer mobile/.env
@"
EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_WS_URL=wss://yukpomnang.onrender.com
EXPO_PUBLIC_ENVIRONMENT=production
EXPO_PUBLIC_SHARE_URL=https://yukpomnang.com
"@ | Out-File -FilePath "mobile\.env" -Encoding UTF8

# Créer frontend/.env
@"
VITE_API_BASE_URL=https://yukpomnang.onrender.com
VITE_WS_BASE_URL=wss://yukpomnang.onrender.com
VITE_ENVIRONMENT=production
VITE_PUBLIC_URL=https://yukpomnang.com
"@ | Out-File -FilePath "frontend\.env" -Encoding UTF8

Write-Host "✅ Fichiers .env créés avec succès!"
```

### Si vous AVEZ déjà des fichiers .env:

**Ouvrez-les manuellement** et ajoutez seulement les **2 nouvelles lignes** :

#### Dans `mobile/.env`, ajoutez:
```env
EXPO_PUBLIC_WS_URL=wss://yukpomnang.onrender.com
EXPO_PUBLIC_SHARE_URL=https://yukpomnang.com
```

#### Dans `frontend/.env`, ajoutez:
```env
VITE_WS_BASE_URL=wss://yukpomnang.onrender.com
VITE_PUBLIC_URL=https://yukpomnang.com
```

---

## 📋 RÉSUMÉ DES NOUVELLES VARIABLES

### ✅ Ces 4 variables sont NOUVELLES (ajoutées aujourd'hui):

1. **`EXPO_PUBLIC_WS_URL`** (Mobile)
   - **Pourquoi**: WebSocket pour chat/notifications temps réel
   - **Avant**: Était hardcodé dans le code ❌
   - **Après**: Configurable via .env ✅

2. **`EXPO_PUBLIC_SHARE_URL`** (Mobile)
   - **Pourquoi**: URL pour partager des services
   - **Avant**: Était hardcodé `https://yukpomnang.com` ❌
   - **Après**: Configurable via .env ✅

3. **`VITE_WS_BASE_URL`** (Frontend)
   - **Pourquoi**: WebSocket pour notifications/chat temps réel
   - **Avant**: Était hardcodé dans le code ❌
   - **Après**: Configurable via .env ✅

4. **`VITE_PUBLIC_URL`** (Frontend)
   - **Pourquoi**: URL publique du site
   - **Avant**: Était hardcodé ❌
   - **Après**: Configurable via .env ✅

---

## ⚡ APRÈS AVOIR CRÉÉ/MODIFIÉ LES .env

### Redémarrer les applications:

```bash
# Mobile (Expo)
cd mobile
npm run dev

# Frontend (Vite)
cd frontend
npm run dev
```

---

## 🎯 AVANTAGES

✅ **Changement de cloud** : 2 minutes au lieu de 2 heures  
✅ **Multi-environnement** : dev/staging/prod facile  
✅ **Sécurité** : Pas de secrets dans le code  
✅ **Flexibilité** : Tester différents backends facilement  

---

## ❓ BESOIN D'AIDE ?

Si vous avez des questions sur la configuration, vérifiez:
1. Le fichier existe bien (`.env` pas `.env.example`)
2. Pas de guillemets autour des valeurs
3. Pas d'espaces avant/après le `=`
4. Fichier encodé en UTF-8

Exemple CORRECT:
```env
EXPO_PUBLIC_WS_URL=wss://yukpomnang.onrender.com
```

Exemple INCORRECT:
```env
EXPO_PUBLIC_WS_URL = "wss://yukpomnang.onrender.com"  ❌ (espaces et guillemets)
```

