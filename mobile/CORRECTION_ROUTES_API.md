# 🔧 Correction des Routes API Mobile

## ❌ Problème Identifié

Le mobile utilise des routes API qui **ne correspondent pas** à celles du frontend qui fonctionnent !

### Frontend (qui marche) ✅
```typescript
// MesServices
GET /api/prestataire/services

// Dashboard
GET /api/dashboard/prestataire?period=30d

// Balance
GET /api/users/balance
```

### Mobile (routes incorrectes) ❌
```typescript
// getUserServices
GET /api/services/user  // ← INCORRECT

// Dashboard  
GET /api/dashboard/prestataire  // ← CORRECT

// Balance
GET /api/users/balance  // ← CORRECT
```

## 🔧 Corrections à Apporter

### 1️⃣ Corriger `servicesApi.getUserServices`

**Fichier :** `mobile/src/services/api.ts`

**Avant :**
```typescript
getUserServices: async () => {
  return apiCall('/api/services/user');  // ❌ FAUX
}
```

**Après :**
```typescript
getUserServices: async () => {
  return apiCall('/api/prestataire/services');  // ✅ CORRECT
}
```

### 2️⃣ Vérifier `userApi.getDashboardPrestataire`

**Fichier :** `mobile/src/services/api.ts`

**Doit être :**
```typescript
getDashboardPrestataire: async (period: string = 'month') => {
  return apiCall(`/api/dashboard/prestataire?period=${period}`);  // ✅ CORRECT
}
```

### 3️⃣ Ajouter l'endpoint manquant

**Fichier :** `mobile/src/services/api.ts`

**Ajouter :**
```typescript
// Dans servicesApi
getPrestataireServices: async () => {
  return apiCall('/api/prestataire/services');
}
```

## 📋 Routes Backend Correctes (depuis Frontend)

| Fonctionnalité | Frontend Route | Mobile Route | Status |
|---|---|---|---|
| **Mes Services** | `/api/prestataire/services` | `/api/services/user` | ❌ À corriger |
| **Dashboard** | `/api/dashboard/prestataire` | `/api/dashboard/prestataire` | ✅ OK |
| **Balance Tokens** | `/api/users/balance` | `/api/users/balance` | ✅ OK |
| **Créer Service** | `/api/services/create` | `/api/services/create` | ✅ OK |
| **Recherche** | `/api/search/direct` | `/api/search/direct` | ✅ OK |
| **Service Detail** | `/api/services/{id}` | `/api/services/{id}` | ✅ OK |
| **Recharge** | `/api/users/recharge` | `/api/users/recharge` | ✅ OK |

## 🎯 Actions Nécessaires

1. ✅ Corriger `getUserServices` → utiliser `/api/prestataire/services`
2. ✅ Tester avec le token d'authentification
3. ✅ Vérifier que les écrans mobiles affichent les bonnes données

## 🧪 Comment Tester

### Test 1 : MesServices
```typescript
// Dans mobile, appeler :
const services = await servicesApi.getUserServices();
// Doit retourner les services du prestataire connecté
```

### Test 2 : Dashboard
```typescript
// Dans mobile, appeler :
const stats = await userApi.getDashboardPrestataire('30d');
// Doit retourner les stats du dashboard
```

---

**Je vais corriger ça maintenant ! 🔧**


