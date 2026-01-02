# Analyse approfondie : Absence de médias dans les scènes

## Problème identifié

Les scènes générées dans le studio service n'ont pas de médias (`video_url`, `background_url`, `product_image_url` tous à `None`), alors que les médias existent en base de données.

## Flux de données analysé

### 1. Stockage des médias (✅ FONCTIONNE)
- Les médias sont correctement sauvegardés dans la table `media` avec :
  - `service_id` : ID du service
  - `product_index` : Index du produit (0-based)
  - `path` : Chemin du fichier (peut être local ou URL S3/CDN)
  - `type` : Type de média ('image' ou 'video')

### 2. Récupération des médias pour génération vidéo (✅ FONCTIONNE)
- La fonction `gather_media_sources` dans `video_generation_service.rs` :
  - Récupère correctement les médias depuis la DB avec `SELECT id, path, type, ai_description FROM media WHERE service_id = $1 AND product_index = $2`
  - Convertit les chemins en `MediaSource` avec `row_to_media_source`
  - **PROBLÈME POTENTIEL** : `row_to_media_source` vérifie si le fichier existe localement, mais si le path est une URL S3/CDN, elle accepte quand même le média

### 3. Génération de timeline immersive (❌ PROBLÈME ICI)
- La timeline immersive est générée par `ImmersiveOrchestrator::generate_timeline`
- Les `MediaSource` sont utilisés pour créer les slides FFmpeg, mais **ne sont pas convertis en URLs pour les assets des scènes**
- Les scènes `ImmersiveScene` ont des `assets` de type `ImmersiveSceneAssets` qui nécessitent des URLs (`video_url`, `background_url`, `product_image_url`)
- **PROBLÈME** : Les `MediaSource` contiennent des `PathBuf` (chemins locaux), pas des URLs accessibles

### 4. Conversion ImmersiveTimeline → VideoTimeline (❌ PROBLÈME ICI)
- La fonction `convert_immersive_to_video_timeline` dans `preview_generation_service.rs` :
  - Extrait `media_url` depuis `assets.video_url`, `assets.background_url`, ou `assets.product_image_url`
  - **PROBLÈME** : Si ces champs sont `None` (ce qui est le cas), la scène n'a pas de média

### 5. Sauvegarde dans studio_timeline_clips (❌ PROBLÈME ICI)
- Les clips sont sauvegardés avec un `payload` JSON contenant l'`ImmersiveScene`
- Si les assets n'ont pas d'URLs, le payload ne contient pas de médias
- Lors du parsing dans `build_preview_timeline`, si le parsing échoue, une scène par défaut est créée **sans médias**

## Causes racines identifiées

### Cause 1 : Médias non convertis en URLs lors de la génération de timeline
- Les `MediaSource` contiennent des `PathBuf` locaux, pas des URLs
- Lors de la génération de timeline immersive, les médias ne sont pas convertis en URLs accessibles
- Les scènes sont créées avec des assets vides

### Cause 2 : Chemins S3/CDN non résolus
- Si les médias sont stockés sur S3/CDN, le `path` dans la DB est une URL
- Mais lors de la conversion en `MediaSource`, si l'URL n'est pas accessible localement, elle est acceptée mais pas utilisée correctement
- Les scènes ne reçoivent pas ces URLs dans leurs assets

### Cause 3 : Conversion PathBuf → URL manquante
- Il n'y a pas de fonction qui convertit un `PathBuf` local en URL accessible (ex: `/api/media/files/...`)
- Les scènes nécessitent des URLs HTTP/HTTPS, pas des chemins locaux

## Solutions proposées

### Solution 1 : Convertir les MediaSource en URLs lors de la génération de timeline
- Créer une fonction `media_source_to_url` qui :
  - Si le path est une URL HTTP/HTTPS, la retourne telle quelle
  - Si le path est local, construit l'URL : `{API_BASE_URL}/api/media/files/{path_relatif}`
- Utiliser cette fonction lors de l'assignation des médias aux scènes

### Solution 2 : Enrichir les assets lors de la génération de timeline immersive
- Modifier `ImmersiveOrchestrator::generate_timeline` pour :
  - Prendre en paramètre les `MediaSource` récupérés
  - Convertir chaque `MediaSource` en URL
  - Assigner ces URLs aux `assets` des scènes générées

### Solution 3 : Améliorer la résolution des médias dans build_preview_timeline
- Déjà fait : extraction partielle des médias depuis le payload
- À améliorer : résolution des `media_id` en URLs depuis la DB
- À ajouter : résolution des chemins locaux en URLs

### Solution 4 : Validation et logs améliorés
- Ajouter des logs détaillés à chaque étape :
  - Nombre de médias récupérés depuis la DB
  - Nombre de médias convertis en URLs
  - Nombre de scènes avec médias assignés
- Valider que chaque scène a au moins un média avant de sauvegarder

## Plan d'action

1. ✅ **FAIT** : Améliorer `build_preview_timeline` pour extraire les médias depuis le payload
2. ✅ **FAIT** : Ajouter validation dans `save_timeline` pour vérifier les médias
3. ✅ **FAIT** : Ajouter validation finale dans `build_preview_timeline`
4. ⏳ **À FAIRE** : Créer fonction `media_source_to_url` pour convertir PathBuf en URL
5. ⏳ **À FAIRE** : Modifier `ImmersiveOrchestrator` pour assigner les URLs aux assets
6. ⏳ **À FAIRE** : Améliorer `gather_media_sources` pour retourner aussi les URLs
7. ⏳ **À FAIRE** : Ajouter logs détaillés à chaque étape

## Vérifications à faire

1. Vérifier que les médias sont bien enregistrés dans la table `media` avec le bon `service_id` et `product_index`
2. Vérifier que les chemins dans `media.path` sont corrects (URLs S3 ou chemins locaux)
3. Vérifier que `API_BASE_URL` ou `UPLOAD_BASE_URL` est configuré correctement
4. Vérifier que les routes `/api/media/files/{path}` sont accessibles

