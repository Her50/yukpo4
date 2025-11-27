# Plan de Correction Détaillé - Erreurs de Création de Produit

## Date de création
2025-11-27

## Vue d'ensemble
Plan d'action complet pour corriger toutes les erreurs et warnings identifiés lors de la création de produits.

---

## 🔴 PRIORITÉ 1 : Erreurs Critiques

### 1.1 MediaUploadManager - ImagePicker ou MediaType est undefined

**Statut :** ⚠️ Partiellement corrigé (vérifications ajoutées mais erreur persiste)

**Problème identifié :**
- Le code vérifie déjà `ImagePicker` et `ImagePicker.MediaType` (lignes 68-73, 140-145)
- L'erreur persiste, suggérant un problème d'import ou d'initialisation

**Actions correctives :**

#### Étape 1 : Vérifier l'import et l'installation
```typescript
// Vérifier que expo-image-picker est bien installé
// Dans mobile/package.json, doit avoir:
"expo-image-picker": "^14.x.x"
```

#### Étape 2 : Améliorer la vérification d'initialisation
```typescript
// Remplacer les vérifications actuelles par une vérification plus robuste
const checkImagePickerAvailable = (): boolean => {
  try {
    return !!(
      ImagePicker &&
      typeof ImagePicker.requestMediaLibraryPermissionsAsync === 'function' &&
      ImagePicker.MediaType &&
      ImagePicker.MediaType.Images &&
      ImagePicker.launchImageLibraryAsync
    );
  } catch (error) {
    console.error('[MediaUploadManager] Erreur vérification ImagePicker:', error);
    return false;
  }
};
```

#### Étape 3 : Ajouter un fallback avec message clair
```typescript
if (!checkImagePickerAvailable()) {
  console.error('[MediaUploadManager] ImagePicker non disponible');
  Alert.alert(
    'Fonctionnalité indisponible',
    'L\'accès à la galerie n\'est pas disponible sur cet appareil. Veuillez mettre à jour l\'application ou contacter le support.',
    [{ text: 'OK' }]
  );
  setUploading(false);
  return;
}
```

#### Étape 4 : Ajouter un log détaillé pour diagnostic
```typescript
console.log('[MediaUploadManager] ImagePicker check:', {
  ImagePicker: !!ImagePicker,
  MediaType: !!ImagePicker?.MediaType,
  Images: !!ImagePicker?.MediaType?.Images,
  requestPermissions: typeof ImagePicker?.requestMediaLibraryPermissionsAsync,
  launchLibrary: typeof ImagePicker?.launchImageLibraryAsync,
});
```

**Fichier à modifier :** `mobile/src/components/MediaUploadManager.tsx`

**Tests à effectuer :**
- [ ] Tester sur Android (appareil réel)
- [ ] Tester sur iOS (appareil réel)
- [ ] Vérifier les permissions dans app.json/app.config.js
- [ ] Vérifier que expo-image-picker est dans les dépendances natives

---

### 1.2 Produit créé sans images

**Statut :** 🔴 À corriger

**Problème identifié :**
- Le produit est créé avec succès mais sans images (`"images": Array []`)
- Conséquence de l'erreur MediaUploadManager

**Actions correctives :**

#### Étape 1 : Améliorer la validation côté backend
```rust
// Dans backend/src/controllers/product_addition_controller.rs
// Ajouter une validation optionnelle (non bloquante mais avec warning)
if saved_media_paths.images.is_none() || saved_media_paths.images.as_ref().map(|v| v.is_empty()).unwrap_or(true) {
    log_warn(&format!(
        "[add_product_to_service] ⚠️ Produit {} créé sans images - génération vidéo impossible",
        product_index
    ));
}
```

#### Étape 2 : Améliorer le message de réponse
```rust
// Ajouter un champ warning dans la réponse
Ok(Json(json!({
    "success": true,
    "service_id": service_id,
    "product_index": product_index,
    "cost": cout_ajout,
    "message": format!("Produit ajouté avec succès (coût: {} FCFA)", cout_ajout),
    "new_balance": new_balance,
    "warning": if saved_media_paths.images.is_none() {
        Some("Aucune image ajoutée. La génération de vidéo nécessite au moins une image.")
    } else {
        None
    }
})))
```

#### Étape 3 : Améliorer l'UX mobile
```typescript
// Dans le composant qui appelle add_product_to_service
// Afficher un message si aucune image n'a été ajoutée
if (response.data.warning) {
  Alert.alert(
    'Produit créé',
    response.data.message + '\n\n' + response.data.warning,
    [
      { text: 'Ajouter des images', onPress: () => navigateToMediaUpload() },
      { text: 'OK' }
    ]
  );
}
```

**Fichiers à modifier :**
- `backend/src/controllers/product_addition_controller.rs`
- Composant mobile qui appelle l'API (à identifier)

---

### 1.3 Erreur génération vidéo - Aucune image trouvée

**Statut :** ⚠️ Partiellement géré (message d'erreur clair mais pas de solution automatique)

**Problème identifié :**
- Le service de génération de vidéo retourne un message d'erreur clair
- Mais l'utilisateur ne peut pas facilement ajouter des images après création

**Actions correctives :**

#### Étape 1 : Améliorer le message d'erreur avec action
```rust
// Dans backend/src/services/video_generation_service.rs
// Le message existe déjà mais améliorer la réponse HTTP
return Err(AppError::BadRequest(format!(
    "Impossible de générer la vidéo : Aucune image trouvée.\n\n\
    Sources vérifiées : galerie produit ({} trouvées), médiathèque service ({} trouvées), assets publicité ({} trouvés)\n\n\
    Solutions possibles :\n\
    • Ajouter des images dans la médiathèque du service\n\
    • Ajouter des images au produit spécifique (index {})\n\
    • Activer 'auto_generate_images: true' pour générer automatiquement des images avec l'IA",
    product_images_count, service_images_count, ad_assets_count, product_index
)));
```

#### Étape 2 : Implémenter la génération automatique d'images si activée
```rust
// Vérifier si auto_generate_images est activé
if let Some(auto_gen) = service_data.get("auto_generate_images")
    .and_then(|v| v.as_bool())
    .filter(|&b| b)
{
    log_info("[VideoGeneration] 🎨 Génération automatique d'images activée");
    // Appeler le service de génération d'images IA
    match generate_product_images_with_ai(service_id, product_index, &product_data).await {
        Ok(generated_images) => {
            log_info(&format!("[VideoGeneration] ✅ {} images générées automatiquement", generated_images.len()));
            // Continuer avec la génération de vidéo
        }
        Err(e) => {
            log_error(&format!("[VideoGeneration] ❌ Erreur génération images: {}", e));
            // Retourner l'erreur originale
        }
    }
}
```

#### Étape 3 : Ajouter un endpoint pour upload d'images après création
```rust
// Nouveau endpoint: POST /api/services/{service_id}/products/{product_index}/media
// Permet d'ajouter des images à un produit existant
```

**Fichiers à modifier :**
- `backend/src/services/video_generation_service.rs`
- `backend/src/controllers/product_addition_controller.rs` (nouveau endpoint)

---

## ⚠️ PRIORITÉ 2 : Warnings (Non bloquants mais à corriger)

### 2.1 Coach IA indisponible (brief, style, plan)

**Statut :** ⚠️ À investiguer et corriger

**Problème identifié :**
- Les endpoints `/api/ia/video-brief`, `/api/ia/video-style`, `/api/ia/video-plan` retournent des erreurs
- Le composant mobile affiche "indisponible" mais continue

**Actions correctives :**

#### Étape 1 : Vérifier que les routes existent
```rust
// Dans backend/src/routers/router_yukpo.rs
// Vérifier que ces routes sont bien définies:
.route("/api/ia/video-brief", ...)
.route("/api/ia/video-style", ...)
.route("/api/ia/video-plan", ...)
```

#### Étape 2 : Vérifier les handlers
```rust
// Chercher les fonctions handlers pour ces routes
// Vérifier qu'elles gèrent correctement les erreurs
```

#### Étape 3 : Améliorer la gestion d'erreur côté mobile
```typescript
// Dans ProductVideoCreationModal.tsx
// Ajouter un retry avec exponential backoff
const fetchCoachData = async (type: 'brief' | 'style' | 'plan') => {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const response = await api.post(`/api/ia/video-${type}`, {
        service_id: serviceId,
        product_index: productIndex,
        // ... autres paramètres
      });
      
      if (response.data && response.data.success) {
        return response.data;
      }
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries) {
        console.warn(`[ProductVideoCreationModal] Coach IA: ${type} indisponible après ${maxRetries} tentatives`);
        // Retourner des valeurs par défaut
        return getDefaultCoachData(type);
      }
      // Attendre avant de réessayer (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
    }
  }
};
```

#### Étape 4 : Ajouter des valeurs par défaut
```typescript
const getDefaultCoachData = (type: 'brief' | 'style' | 'plan'): any => {
  switch (type) {
    case 'brief':
      return {
        headline: normalizeProductName(primaryProduct),
        call_to_action: 'Découvrez maintenant',
        storyboard: [
          'Introduction du produit',
          'Présentation des caractéristiques',
          'Appel à l\'action'
        ]
      };
    case 'style':
      return {
        preset: 'story',
        transitions: 'smooth',
        text_style: 'modern'
      };
    case 'plan':
      return {
        distribution: ['product', 'chat'],
        duration: 15,
        format: 'vertical'
      };
    default:
      return {};
  }
};
```

**Fichiers à modifier :**
- `mobile/src/components/ProductVideoCreationModal.tsx`
- `backend/src/routers/router_yukpo.rs` (vérifier les routes)
- Handlers backend pour video-brief, video-style, video-plan

---

### 2.2 Aucune combinaison préférée trouvée

**Statut :** ℹ️ Informatif (non bloquant)

**Problème identifié :**
- Le système IA ne trouve pas de combinaison préférée pour pré-remplir le formulaire
- C'est normal pour les nouveaux produits mais génère un warning

**Actions correctives :**

#### Étape 1 : Réduire le niveau de log
```typescript
// Dans le composant mobile qui génère ce warning
// Changer de WARN à DEBUG ou INFO
console.debug('[AjouterProduitSimple] Aucune combinaison préférée trouvée, utilisation objet vide');
```

#### Étape 2 : Améliorer l'algorithme de recherche
```rust
// Dans backend/src/services/creer_service.rs
// Améliorer la recherche de combinaisons préférées
// Utiliser des combinaisons par défaut basées sur la catégorie
```

#### Étape 3 : Utiliser des valeurs par défaut intelligentes
```typescript
// Dans le composant mobile
// Si aucune combinaison préférée, utiliser des valeurs par défaut basées sur:
// - La catégorie du service
// - Les produits similaires de l'utilisateur
// - Les tendances du marché
```

**Fichiers à modifier :**
- Composant mobile `AjouterProduitSimple` (à identifier)
- `backend/src/services/creer_service.rs`

---

## 📋 Checklist d'Implémentation

### Phase 1 : Corrections Critiques (Priorité 1)
- [ ] **1.1** Corriger MediaUploadManager - Vérifications améliorées
- [ ] **1.1** Tester sur Android et iOS
- [ ] **1.2** Ajouter validation et warning pour produits sans images
- [ ] **1.2** Améliorer UX mobile avec message d'avertissement
- [ ] **1.3** Améliorer message d'erreur génération vidéo
- [ ] **1.3** Implémenter génération automatique d'images si activée
- [ ] **1.3** Créer endpoint pour upload d'images après création

### Phase 2 : Corrections Warnings (Priorité 2)
- [ ] **2.1** Vérifier et corriger routes Coach IA
- [ ] **2.1** Ajouter retry avec exponential backoff
- [ ] **2.1** Implémenter valeurs par défaut
- [ ] **2.2** Réduire niveau de log combinaisons préférées
- [ ] **2.2** Améliorer algorithme de recherche
- [ ] **2.2** Utiliser valeurs par défaut intelligentes

### Phase 3 : Tests et Validation
- [ ] Tests unitaires pour MediaUploadManager
- [ ] Tests d'intégration pour création produit avec images
- [ ] Tests pour génération vidéo avec images
- [ ] Tests pour Coach IA avec retry
- [ ] Tests end-to-end complets

---

## 🔍 Fichiers à Modifier

### Backend
1. `backend/src/controllers/product_addition_controller.rs`
2. `backend/src/services/video_generation_service.rs`
3. `backend/src/routers/router_yukpo.rs` (vérifier routes Coach IA)
4. `backend/src/services/creer_service.rs` (combinaisons préférées)

### Mobile
1. `mobile/src/components/MediaUploadManager.tsx`
2. `mobile/src/components/ProductVideoCreationModal.tsx`
3. Composant `AjouterProduitSimple` (à identifier)
4. `mobile/package.json` (vérifier dépendances)

---

## 📊 Métriques de Succès

- **Taux de succès upload images :** > 95%
- **Taux de produits créés avec images :** > 80%
- **Taux de succès génération vidéo :** > 70%
- **Disponibilité Coach IA :** > 90%
- **Réduction warnings combinaisons :** > 50%

---

## 🚀 Prochaines Étapes

1. Commencer par les corrections Priorité 1
2. Tester chaque correction individuellement
3. Valider avec les utilisateurs
4. Déployer progressivement
5. Monitorer les métriques

---

## 📝 Notes Techniques

### Dépendances requises
- `expo-image-picker`: ^14.x.x
- Permissions configurées dans app.json/app.config.js

### Configuration requise
- Permissions galerie (Android: READ_EXTERNAL_STORAGE, iOS: NSPhotoLibraryUsageDescription)
- Configuration upload storage path

### Points d'attention
- Les vidéos en base64 peuvent être très volumineuses
- Limiter la taille des images uploadées
- Implémenter compression avant upload

