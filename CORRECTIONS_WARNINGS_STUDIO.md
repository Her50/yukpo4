# 🔧 Corrections des warnings et erreurs Studio

## 📋 Problèmes identifiés

### 1. Scène sans media_url dans preview
**Erreur** : `"Aucune scène valide dans la plage de preview (max_duration: 5.0s). Total scènes: 1, Scènes avec média: 1, Scènes dans plage: 0"`

**Cause** :
- La scène `scene_intro` n'a pas de media_url dans son payload
- Le payload contient `videoUrl: null`, `backgroundUrl: null`, `productImageUrl: null`
- La validation filtre les scènes sans média, puis vérifie si elles sont dans la plage de 5 secondes
- Si la scène commence après 5 secondes, elle est exclue

### 2. Requête preview très lente (79 secondes)
**Problème** : `POST /api/studio/sessions/.../preview/short` prend 79 secondes

**Causes possibles** :
- Génération FFmpeg lente
- Médias volumineux à télécharger
- Pas de cache pour les previews

### 3. Erreur 413 - Payload trop volumineux
**Erreur** : `Erreur 413` lors de l'attachement de média

**Cause** : Le payload dépasse la limite de body size configurée

### 4. Aucun média dans galerie produit
**Warning** : `"Aucun média trouvé dans galerie produit (service_id=191, product_index=5)"`

**Cause** : Le produit n'a pas de médias uploadés dans la table `media`

## ✅ Corrections effectuées

### 1. Amélioration de l'extraction des médias depuis payload

**Fichier** : `backend/src/services/studio_service.rs`

**Amélioration** : Ajout de la recherche dans les champs racine du payload :
- `videoUrl` / `video_url`
- `backgroundUrl` / `background_url`
- `productImageUrl` / `product_image_url`

**Avant** : Ne cherchait que dans `assets.videoUrl`, `assets.backgroundUrl`, etc.

**Après** : Cherche aussi au niveau racine du payload pour plus de flexibilité

### 2. Amélioration de la logique de preview

**Fichier** : `backend/src/services/preview_generation_service.rs`

**Amélioration** : 
- Si la première scène avec média est dans la plage, prendre toutes les scènes dans la plage
- Sinon, prendre au moins la première scène (même si elle dépasse 5 secondes)
- Message d'erreur plus clair

**Avant** :
```rust
let preview_scenes: Vec<_> = enriched_timeline
    .scenes
    .iter()
    .filter(|scene| scene.media_url.is_some())
    .take_while(|scene| scene.start_time + scene.duration <= max_duration)
    .collect();
```

**Après** :
```rust
// Prendre les scènes dans la plage, ou au moins la première scène
let preview_scenes: Vec<_> = if let Some(first_scene) = scenes_with_media.first() {
    if first_scene.start_time + first_scene.duration <= max_duration {
        scenes_with_media
            .iter()
            .take_while(|scene| scene.start_time + scene.duration <= max_duration)
            .collect()
    } else {
        // Prendre au moins la première scène (tronquée si nécessaire)
        vec![first_scene]
    }
} else {
    vec![]
};
```

### 3. Limites de body size

**Fichiers** : `backend/src/routes/studio_routes.rs`, `backend/src/routes/mobile_logs_routes.rs`

**Limites actuelles** :
- Studio previews : 200 MB
- Studio attach asset : 200 MB ✅ NOUVEAU
- Mobile logs : 10 MB
- Uploads : 200 MB - 1 GB selon le type

**Correction** : Ajout d'une limite de 200 MB pour l'endpoint `attach_asset` pour éviter les erreurs 413

## 🎯 Améliorations supplémentaires recommandées

### 1. Optimisation des previews
- **Cache** : Mettre en cache les previews générées pour éviter de régénérer
- **Compression** : Réduire la qualité des médias pour les previews
- **Timeout** : Ajouter un timeout pour éviter les requêtes qui traînent

### 2. Gestion des médias manquants
- **Fallback intelligent** : Utiliser les médias du service si le produit n'en a pas
- **Génération IA** : Générer des images placeholder si aucun média n'est disponible
- **Validation préventive** : Vérifier la disponibilité des médias avant de générer la preview

### 3. Monitoring des performances
- **Métriques** : Tracker le temps de génération des previews
- **Alertes** : Alerter si une preview prend plus de 30 secondes
- **Logs** : Logger les temps d'exécution pour identifier les goulots d'étranglement

## 📊 Impact attendu

- **Réduction des erreurs** : Moins d'erreurs "Aucune scène valide" grâce à la meilleure extraction des médias
- **Meilleure UX** : Les previews fonctionnent même si les scènes commencent après 5 secondes
- **Performance** : Identification des problèmes de performance pour optimisation future

## 🔍 Vérifications recommandées

1. **Vérifier les médias du produit** :
   ```sql
   SELECT * FROM media 
   WHERE service_id = 191 
   AND (product_index = 5 OR product_index IS NULL)
   AND media_type IN ('image', 'video');
   ```

2. **Vérifier la taille des payloads** : Logger la taille des payloads pour identifier ceux qui dépassent les limites

3. **Monitorer les temps de preview** : Ajouter des métriques pour tracker les performances

