# 🧪 Guide de test du Deep Linking

## 📱 Test du partage et du deep linking

### 1. Tester le partage depuis l'application

1. **Ouvrir un produit** dans l'application
2. **Cliquer sur le bouton de partage**
3. **Vérifier le message de partage** :
   - ✅ Doit contenir `📱 Ouvrir dans l'app:`
   - ✅ Doit contenir le deep link `yukpomnang://product/...`
   - ✅ Doit contenir `🔗 Voir en ligne:`
   - ✅ Doit contenir le lien web `https://yukpomnang.com/product/...`

### 2. Tester l'ouverture du deep link

#### Sur Android (via ADB)

```bash
# Format: yukpomnang://product/:productId?serviceId=:serviceId
adb shell am start -W -a android.intent.action.VIEW -d "yukpomnang://product/1_1?serviceId=1" com.yukpomnang.mobile
```

#### Sur iOS (via Simulator)

```bash
xcrun simctl openurl booted "yukpomnang://product/1_1?serviceId=1"
```

### 3. Tester depuis un autre appareil

1. **Partager un produit** depuis l'app sur un appareil
2. **Envoyer le message** à un autre appareil (WhatsApp, SMS, etc.)
3. **Cliquer sur le deep link** (`yukpomnang://product/...`)
4. **Vérifier** :
   - ✅ L'app s'ouvre automatiquement
   - ✅ L'écran ProductDetail s'affiche
   - ✅ Le produit correct est chargé

### 4. Tester le lien web (fallback)

1. **Ouvrir le lien web** dans un navigateur mobile : `https://yukpomnang.com/product/1_1?serviceId=1`
2. **Vérifier** :
   - ✅ Sur mobile : Le backend redirige vers le deep link
   - ✅ Sur desktop : Une page web s'affiche

## 🔍 Vérifications de debug

### Logs à vérifier

1. **Dans ProductDetailScreen** :
   ```
   [ProductDetailScreen] ✅ ProductId parsé: serviceId=X, productIndex=Y
   🔍 Chargement produit: ... du service: ...
   ✅ Produit chargé: ...
   ```

2. **Dans NavigationContainer** :
   ```
   [NavigationContainer] ✅ Navigation prête avec Deep Linking
   [NavigationContainer] 📍 Navigation changée
   ```

3. **Dans ProductCard/MesProduitsScreen** :
   ```
   ✅ Produit partagé: ...
   ```

### Problèmes courants

#### Le deep link ne s'ouvre pas

**Causes possibles** :
- L'app n'est pas installée
- Le scheme `yukpomnang://` n'est pas reconnu
- Les intentFilters ne sont pas correctement configurés

**Solutions** :
- Vérifier que l'app est installée
- Vérifier `app.config.js` : `scheme: "yukpomnang"`
- Rebuild l'app : `npx expo prebuild --clean && npx expo run:android`

#### Le produit ne se charge pas

**Causes possibles** :
- Le format du `productId` n'est pas correct
- Le `serviceId` n'est pas dans les query params
- Le produit n'existe pas dans la base de données

**Solutions** :
- Vérifier les logs dans ProductDetailScreen
- Vérifier le format : `yukpomnang://product/1_1?serviceId=1`
- Vérifier que le produit existe via l'API

#### Le lien web ne redirige pas

**Causes possibles** :
- Le backend n'a pas la route `/product/:product_id`
- Le User-Agent n'est pas détecté comme mobile

**Solutions** :
- Vérifier que la route existe dans `backend/src/routes/products_routes.rs`
- Vérifier les logs du backend pour la détection mobile

## ✅ Checklist de validation

- [ ] Le message de partage contient le deep link direct
- [ ] Le deep link s'ouvre dans l'app sur Android
- [ ] Le deep link s'ouvre dans l'app sur iOS
- [ ] ProductDetailScreen charge correctement le produit
- [ ] Le lien web redirige vers le deep link sur mobile
- [ ] Le lien web affiche une page sur desktop
- [ ] Les logs montrent le parsing correct du productId
- [ ] Le produit s'affiche avec toutes ses informations

