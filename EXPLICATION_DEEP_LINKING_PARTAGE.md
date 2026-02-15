# 🔗 Explication : Deep Linking et Partage de Produits

**Date** : 2026-02-14  
**Question** : Est-ce que le partage externe d'un produit va toujours s'ouvrir dans le web même si on est sur mobile ?

---

## 🎯 RÉPONSE

**NON, le lien ne s'ouvrira pas toujours dans le web sur mobile !**

**Le système est conçu pour ouvrir l'app si elle est installée, sinon ouvrir le web.**

---

## 📊 COMPORTEMENT DES LIENS DE PARTAGE

### ✅ Si l'App est Installée

**Lien partagé** : `https://yukpomnang.com/product/123?serviceId=456`

**Comportement** :
1. ✅ **Android** : Les `intentFilters` interceptent le lien HTTPS
2. ✅ **iOS** : Les `associatedDomains` interceptent le lien HTTPS
3. ✅ **L'app s'ouvre directement** avec l'écran `ProductDetail`
4. ❌ **Le navigateur web ne s'ouvre PAS**

---

### ⚠️ Si l'App n'est PAS Installée

**Lien partagé** : `https://yukpomnang.com/product/123?serviceId=456`

**Comportement** :
1. ⚠️ Le lien s'ouvre dans le **navigateur web**
2. ⚠️ Le frontend web affiche la page produit
3. ⚠️ L'utilisateur peut voir le produit sur le web

---

## 🔧 CONFIGURATION TECHNIQUE

### 1. ✅ Android - Intent Filters

**Fichier** : `mobile/app.config.js`

```javascript
android: {
    intentFilters: [
        {
            action: "VIEW",
            autoVerify: true,
            data: [
                {
                    scheme: "https",
                    host: "yukpomnang.com",
                    pathPrefix: "/product"
                },
                {
                    scheme: "https",
                    host: "www.yukpomnang.com",
                    pathPrefix: "/product"
                }
            ],
            category: ["BROWSABLE", "DEFAULT"]
        }
    ]
}
```

**Fonction** : Intercepte les liens `https://yukpomnang.com/product/*` et ouvre l'app directement.

---

### 2. ✅ iOS - Associated Domains

**Fichier** : `mobile/app.config.js`

```javascript
ios: {
    associatedDomains: [
        "applinks:yukpomnang.com",
        "applinks:www.yukpomnang.com"
    ]
}
```

**Fonction** : Intercepte les liens `https://yukpomnang.com/*` et ouvre l'app directement.

---

### 3. ✅ React Navigation - Linking Configuration

**Fichier** : `mobile/src/config/linking.ts`

```typescript
const linking: LinkingOptions<any> = {
  prefixes: ['yukpomnang://', 'https://yukpomnang.com'],
  config: {
    screens: {
      ProductDetail: {
        path: 'product/:productId',
        parse: {
          productId: (productId: string) => productId,
          serviceId: (serviceId: string | number | undefined) => {
            // Parse serviceId depuis query params
          },
        },
      },
    },
  },
};
```

**Fonction** : Configure React Navigation pour gérer les deep links et naviguer vers l'écran `ProductDetail`.

---

## 📋 FLUX COMPLET

### Scénario 1 : App Installée (Android)

```
1. Utilisateur clique sur : https://yukpomnang.com/product/123?serviceId=456
   ↓
2. Android détecte intentFilter (autoVerify: true)
   ↓
3. Android demande : "Ouvrir avec Yukpo App ?"
   ↓
4. Utilisateur choisit "Yukpo App"
   ↓
5. ✅ L'app s'ouvre directement sur ProductDetail (productId=123, serviceId=456)
   ❌ Le navigateur web ne s'ouvre PAS
```

---

### Scénario 2 : App Installée (iOS)

```
1. Utilisateur clique sur : https://yukpomnang.com/product/123?serviceId=456
   ↓
2. iOS détecte associatedDomain (applinks:yukpomnang.com)
   ↓
3. iOS vérifie le fichier .well-known/apple-app-site-association
   ↓
4. ✅ L'app s'ouvre directement sur ProductDetail (productId=123, serviceId=456)
   ❌ Safari ne s'ouvre PAS
```

---

### Scénario 3 : App NON Installée

```
1. Utilisateur clique sur : https://yukpomnang.com/product/123?serviceId=456
   ↓
2. Aucune app ne peut intercepter le lien
   ↓
3. ⚠️ Le navigateur web s'ouvre
   ↓
4. ⚠️ Le frontend web affiche la page produit
```

---

## 🔍 VÉRIFICATION

### Code de Partage

**Fichier** : `mobile/src/utils/productShareHelper.ts`

```typescript
export const generateSmartShareLink = (
  productId: string | number,
  serviceId: string | number
): string => {
  const baseUrl = process.env.EXPO_PUBLIC_SHARE_URL || 'https://yukpomnang.com';
  // ✅ Lien web intelligent qui sera intercepté par l'app si installée
  // Sinon, il ouvrira la page web
  return `${baseUrl}/product/${productId}?serviceId=${serviceId}`;
};
```

**Commentaire dans le code** :
```typescript
// ✅ IMPORTANT: Sur Android, les intentFilters dans app.config.js permettront à l'app d'intercepter
// directement ce lien HTTPS même si le backend ne répond pas
```

---

## 📊 TABLEAU RÉCAPITULATIF

| Situation | Lien Cliqué | Comportement | Résultat |
|-----------|-------------|--------------|----------|
| **App installée (Android)** | `https://yukpomnang.com/product/123` | IntentFilter intercepte | ✅ **App s'ouvre** |
| **App installée (iOS)** | `https://yukpomnang.com/product/123` | AssociatedDomain intercepte | ✅ **App s'ouvre** |
| **App NON installée** | `https://yukpomnang.com/product/123` | Aucune interception | ⚠️ **Web s'ouvre** |
| **Deep link direct** | `yukpomnang://product/123` | Scheme personnalisé | ✅ **App s'ouvre** (si installée) |

---

## ✅ AVANTAGES DE CE SYSTÈME

### 1. ✅ Expérience Utilisateur Optimale

- **Si app installée** : Ouverture directe dans l'app (meilleure UX)
- **Si app non installée** : Lien web fonctionne (pas de frustration)

### 2. ✅ Compatibilité Universelle

- **Un seul lien** : `https://yukpomnang.com/product/123`
- **Fonctionne partout** : App (si installée) ou Web (sinon)

### 3. ✅ Pas de Choix Utilisateur Nécessaire

- **Android** : Demande automatiquement "Ouvrir avec Yukpo App ?"
- **iOS** : Ouvre directement l'app (si configuré)

---

## ⚠️ CONFIGURATION REQUISE

### Pour que l'interception fonctionne :

1. ✅ **Android** : `intentFilters` configurés dans `app.config.js` ✅
2. ✅ **iOS** : `associatedDomains` configurés dans `app.config.js` ✅
3. ✅ **React Navigation** : `linking.ts` configuré ✅
4. ⚠️ **iOS** : Fichier `.well-known/apple-app-site-association` sur le serveur web (à vérifier)

---

## 🎯 RÉSUMÉ

**Réponse à votre question** :

❌ **NON, le lien ne s'ouvrira PAS toujours dans le web sur mobile.**

✅ **Si l'app est installée** : Le lien ouvrira l'app directement (meilleure UX)

⚠️ **Si l'app n'est pas installée** : Le lien ouvrira le navigateur web (fallback)

**C'est un système intelligent qui détecte automatiquement si l'app est installée !**

---

**Date** : 2026-02-14  
**Statut** : ✅ **SYSTÈME CONFIGURÉ**


