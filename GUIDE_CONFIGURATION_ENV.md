# 📘 GUIDE DE CONFIGURATION DES FICHIERS .env

## 🎯 Objectif

Ce guide explique comment configurer les fichiers `.env` pour **Mobile** et **Frontend** afin que l'application fonctionne correctement et puisse changer de cloud facilement.

---

## 📱 MOBILE (React Native / Expo)

### 1️⃣ Créer le fichier `.env`

Dans le dossier `mobile/`, créez un fichier `.env` :

```bash
cd mobile
# Copier le fichier exemple
cp .env.example .env
```

### 2️⃣ Contenu du fichier `mobile/.env`

```env
# API Backend
EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_WS_URL=wss://yukpomnang.onrender.com

# Environnement
EXPO_PUBLIC_ENVIRONMENT=production

# URL de partage
EXPO_PUBLIC_SHARE_URL=https://yukpomnang.com
```

### 3️⃣ Variables expliquées

| Variable | Description | Exemple |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_BASE_URL` | URL de l'API backend (HTTP/HTTPS) | `https://yukpomnang.onrender.com` |
| `EXPO_PUBLIC_WS_URL` | ✅ **NOUVEAU** - URL WebSocket pour chat temps réel | `wss://yukpomnang.onrender.com` |
| `EXPO_PUBLIC_ENVIRONMENT` | Environnement (dev/prod/staging) | `production` |
| `EXPO_PUBLIC_SHARE_URL` | ✅ **NOUVEAU** - URL publique pour partage | `https://yukpomnang.com` |

### 4️⃣ Pour le développement local

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_WS_URL=ws://localhost:3000
EXPO_PUBLIC_ENVIRONMENT=development
```

---

## 🌐 FRONTEND (React / Vite)

### 1️⃣ Créer le fichier `.env`

Dans le dossier `frontend/`, créez un fichier `.env` :

```bash
cd frontend
# Copier le fichier exemple
cp .env.example .env
```

### 2️⃣ Contenu du fichier `frontend/.env`

```env
# API Backend
VITE_API_BASE_URL=https://yukpomnang.onrender.com
VITE_WS_BASE_URL=wss://yukpomnang.onrender.com

# Environnement
VITE_ENVIRONMENT=production

# URL publique
VITE_PUBLIC_URL=https://yukpomnang.com
```

### 3️⃣ Variables expliquées

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | URL de l'API backend (HTTP/HTTPS) | `https://yukpomnang.onrender.com` |
| `VITE_WS_BASE_URL` | ✅ **NOUVEAU** - URL WebSocket pour notifications/chat | `wss://yukpomnang.onrender.com` |
| `VITE_ENVIRONMENT` | Environnement (dev/prod/staging) | `production` |
| `VITE_PUBLIC_URL` | ✅ **NOUVEAU** - URL publique du site | `https://yukpomnang.com` |

### 4️⃣ Pour le développement local

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_BASE_URL=ws://localhost:3000
VITE_ENVIRONMENT=development
```

### ⚠️ Pour déploiement Netlify

Si vous utilisez le proxy Netlify, laissez vide :

```env
VITE_API_BASE_URL=
VITE_WS_BASE_URL=wss://yukpomnang.onrender.com
```

---

## 🔄 CHANGEMENT DE CLOUD

### Scénario : Migrer de Render vers AWS

**AVANT (ancienne méthode)** : Modifier ~40+ fichiers ❌

**APRÈS (nouvelle méthode)** : Modifier 2 fichiers .env ✅

#### Mobile (`mobile/.env`)

```env
# Changer juste ces lignes:
EXPO_PUBLIC_API_BASE_URL=https://api.yukpo-aws.com
EXPO_PUBLIC_WS_URL=wss://api.yukpo-aws.com
```

#### Frontend (`frontend/.env`)

```env
# Changer juste ces lignes:
VITE_API_BASE_URL=https://api.yukpo-aws.com
VITE_WS_BASE_URL=wss://api.yukpo-aws.com
```

**C'est tout !** 🎉

---

## 🚀 COMMANDES POUR CRÉER LES FICHIERS

### Option 1: Copie manuelle

```bash
# Mobile
cd mobile
copy .env.example .env

# Frontend
cd frontend
copy .env.example .env
```

### Option 2: PowerShell

```powershell
# Depuis la racine du projet
Copy-Item "mobile\.env.example" -Destination "mobile\.env"
Copy-Item "frontend\.env.example" -Destination "frontend\.env"
```

### Option 3: Créer à la main

#### `mobile/.env`
```env
EXPO_PUBLIC_API_BASE_URL=https://yukpomnang.onrender.com
EXPO_PUBLIC_WS_URL=wss://yukpomnang.onrender.com
EXPO_PUBLIC_ENVIRONMENT=production
EXPO_PUBLIC_SHARE_URL=https://yukpomnang.com
```

#### `frontend/.env`
```env
VITE_API_BASE_URL=https://yukpomnang.onrender.com
VITE_WS_BASE_URL=wss://yukpomnang.onrender.com
VITE_ENVIRONMENT=production
VITE_PUBLIC_URL=https://yukpomnang.com
```

---

## ⚠️ IMPORTANT À SAVOIR

### Variables nouvelles ajoutées

| Variable | Type | Pourquoi nouveau ? |
|----------|------|-------------------|
| `EXPO_PUBLIC_WS_URL` | ✅ NOUVEAU | Avant, WebSocket était hardcodé. Maintenant configurable ! |
| `VITE_WS_BASE_URL` | ✅ NOUVEAU | Avant, WebSocket était hardcodé. Maintenant configurable ! |
| `EXPO_PUBLIC_SHARE_URL` | ✅ NOUVEAU | Pour les liens de partage de services |
| `VITE_PUBLIC_URL` | ✅ NOUVEAU | Pour les liens publics du site |

### Variables qui existaient déjà

| Variable | Commentaire |
|----------|------------|
| `EXPO_PUBLIC_API_BASE_URL` | ✅ Existait déjà (vous l'avez mentionné) |
| `VITE_API_BASE_URL` | ✅ Existait probablement déjà |

---

## 🔍 VÉRIFICATION

Pour vérifier si vos variables sont bien chargées:

### Mobile
```typescript
// Dans n'importe quel fichier TypeScript
console.log('API:', process.env.EXPO_PUBLIC_API_BASE_URL);
console.log('WS:', process.env.EXPO_PUBLIC_WS_URL);
```

### Frontend
```typescript
// Dans n'importe quel fichier TypeScript
console.log('API:', import.meta.env.VITE_API_BASE_URL);
console.log('WS:', import.meta.env.VITE_WS_BASE_URL);
```

---

## ✅ ACTIONS À FAIRE MAINTENANT

1. **Créer `mobile/.env`** avec les 4 variables
2. **Créer `frontend/.env`** avec les 4 variables
3. **Redémarrer l'app mobile** : `npm run dev` (dans mobile/)
4. **Rebuilder le frontend** : `npm run build` (dans frontend/)

Voulez-vous que je crée automatiquement ces fichiers pour vous?

