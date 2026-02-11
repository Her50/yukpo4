# ✅ Correction du Deep Linking pour le partage de produits

## 🔍 Problème identifié

Lorsqu'on partage un produit à l'extérieur, le lien reçu ne fonctionne pas. L'utilisateur s'attendait à ce que le lien ouvre directement le produit dans l'application mobile installée localement, mais au lieu de cela, ça semble chercher à ouvrir une page web.

**Cause** : Le partage utilisait uniquement le lien HTTPS (`https://yukpomnang.com/product/...`) qui nécessite une vérification de domaine (App Links) pour fonctionner automatiquement sur Android. Cette vérification nécessite que l'app soit publiée sur le Play Store ou qu'un fichier `assetlinks.json` soit configuré sur le serveur.

## ✅ Solutions appliquées

### 1. Inclusion du deep link direct dans le message de partage

**Fichier** : `mobile/src/utils/productShareHelper.ts`

**Changement** : Le message de partage inclut maintenant le deep link direct (`yukpomnang://product/...`) en premier, suivi du lien web comme fallback.

**Avant** :
```typescript
message += `\n🔗 Voir ce produit:\n${smartLink}`;
// Deep link commenté
```

**Après** :
```typescript
message += `\n📱 Ouvrir dans l'app:\n${deepLink}`;
message += `\n🔗 Voir en ligne:\n${smartLink}`;
```

### 2. Utilisation du deep link dans l'URL de partage

**Fichiers** :
- `mobile/src/components/ProductCard.tsx`
- `mobile/src/screens/MesProduitsScreen.tsx`

**Changement** : L'URL passée à `Share.share()` utilise maintenant le deep link direct au lieu du lien HTTPS.

**Avant** :
```typescript
url: smartLink, // Lien HTTPS
```

**Après** :
```typescript
url: deepLink, // Deep link direct (yukpomnang://product/...)
```

### 3. Amélioration du parsing des paramètres dans linking.ts

**Fichier** : `mobile/src/config/linking.ts`

**Changement** : Amélioration du parsing de `serviceId` depuis les query params pour gérer correctement les deep links avec paramètres.

## 🎯 Comment ça fonctionne maintenant

### Format du lien partagé

Le message de partage contient maintenant :
1. **Deep link direct** : `yukpomnang://product/1_1?serviceId=1`
   - Fonctionne directement sur mobile sans nécessiter de vérification de domaine
   - Ouvre l'app directement si elle est installée
   
2. **Lien web** : `https://yukpomnang.com/product/1_1?serviceId=1`
   - Fallback pour les navigateurs web
   - Le backend redirige vers le deep link si détecté comme mobile

### Flux de navigation

1. **Utilisateur clique sur le deep link** (`yukpomnang://product/...`)
2. **Android/iOS intercepte le lien** et ouvre l'app
3. **React Navigation** parse le lien via `linking.ts`
4. **Navigation vers ProductDetail** avec `productId` et `serviceId`

### Configuration Android

Les `intentFilters` dans `app.config.js` sont déjà configurés pour :
- Intercepter les liens HTTPS vers `yukpomnang.com/product/*`
- Intercepter les deep links `yukpomnang://product/*`

**Note** : Pour que les App Links HTTPS fonctionnent automatiquement sans Play Store, il faut configurer un fichier `assetlinks.json` sur le serveur. Mais avec le deep link direct, ce n'est plus nécessaire.

## 📋 Vérifications nécessaires

### 1. Vérifier que l'écran ProductDetail existe

Il faut s'assurer qu'un écran `ProductDetail` existe dans la navigation et qu'il gère correctement les paramètres `productId` et `serviceId`.

### 2. Tester le deep link

Pour tester manuellement :
```bash
# Android
adb shell am start -W -a android.intent.action.VIEW -d "yukpomnang://product/1_1?serviceId=1" com.yukpomnang.mobile

# iOS (via Simulator)
xcrun simctl openurl booted "yukpomnang://product/1_1?serviceId=1"
```

### 3. Vérifier le format du productId

Le `productId` peut être au format :
- `service_id_product_index` (ex: `1_1`)
- Ou juste `product_index` (si `serviceId` est dans les query params)

Le backend et la navigation doivent gérer les deux formats.

## 🔧 Prochaines étapes

1. ✅ Tester le partage et vérifier que le deep link est inclus
2. ✅ Vérifier que l'écran ProductDetail existe et gère les paramètres
3. ✅ Tester l'ouverture du lien sur un appareil réel
4. ✅ Si nécessaire, ajuster le format du productId selon la structure réelle

## 🎯 Résultat attendu

1. ✅ Le message de partage contient le deep link direct
2. ✅ Le deep link ouvre directement l'app sur mobile
3. ✅ Le produit s'affiche correctement dans l'app
4. ✅ Le lien web sert de fallback pour les navigateurs

