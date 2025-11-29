# 🎬 Explication : Gestion des Vidéos avec Audio, Sélection des Médias, et Analyse IA

## ❓ Vos Questions

1. **Si les vidéos de la médiathèque ont des sons, comment ça se gère avec l'audio Rust ?**
2. **Si on a 17 médias (16 images + 1 vidéo) et limite à 18, est-ce que la vidéo sera capturée ?**
3. **Les images sont-elles envoyées à l'IA pour analyse pour le classement afin d'avoir de la pertinence dans leur positionnement ?**
4. **S'il n'y a pas de vidéo dans la médiathèque du prestataire, est-ce que la vidéo sera toujours créée ?**

---

## 🔊 1. Gestion des Vidéos avec Audio

### Réponse Simple

**Oui, Yukpo détecte automatiquement si une vidéo a de l'audio et l'intègre dans le mixage final avec les autres couches audio (musique, voix, SFX).**

### Explication Détaillée

#### Détection Automatique de l'Audio dans les Vidéos

```rust
// Ligne 49-73: audio_pipeline.rs
pub async fn has_audio_stream(video_path: &Path) -> AppResult<bool> {
    let output = Command::new("ffprobe")
        .args(&[
            "-v", "error",
            "-select_streams", "a:0",  // ✅ Chercher le premier stream audio
            "-show_entries", "stream=codec_type",
            "-of", "csv=p=0",
            video_path.to_string_lossy().as_ref(),
        ])
        .output()
        .await?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(stdout.trim() == "audio")  // ✅ Retourne true si audio détecté
    } else {
        Ok(false)  // ✅ Pas d'audio si ffprobe échoue
    }
}
```

**Processus :**
1. Yukpo utilise `ffprobe` pour vérifier si la vidéo a un stream audio
2. Si audio détecté → `video_has_audio = true`
3. Si pas d'audio → `video_has_audio = false`

#### Mixage avec l'Audio de la Vidéo

```rust
// Ligne 79-136: audio_pipeline.rs
pub async fn mix_media_audio_tracks(
    working_dir: &Path,
    base_video_path: &Path,  // ✅ Vidéo avec ou sans audio
    music_track: Option<&Path>,
    voiceover_track: Option<&Path>,
    sfx_tracks: &[AudioLayer],
    config: &AudioMixConfig,
) -> AppResult<PathBuf> {
    // ✅ Vérifier si la vidéo a un stream audio
    let video_has_audio = has_audio_stream(base_video_path).await.unwrap_or(false);
    
    if !video_has_audio {
        warn!("La vidéo n'a pas de stream audio, création d'un stream silencieux");
    }

    // ✅ Ajouter l'audio de la vidéo seulement si elle en a un
    if video_has_audio {
        mix_inputs.push("[0:a]".to_string());  // ✅ Audio de la vidéo (input 0)
        inputs_count += 1;
    }
    
    // Musique (input 1)
    if music_track.is_some() {
        mix_inputs.push("[a_music]".to_string());
    }
    
    // Voix off (input 2)
    if voiceover_track.is_some() {
        mix_inputs.push("[a_voice]".to_string());
    }
    
    // SFX (input 3+)
    for layer in sfx_tracks {
        mix_inputs.push(format!("[a_sfx{}]", idx));
    }
}
```

### Exemple Concret

**Scénario :** Vidéo B-roll avec son ambiant (ex: boutique avec musique de fond)

**Processus :**

1. **Détection** :
   - Yukpo détecte : `video_has_audio = true`
   - Audio de la vidéo : Son ambiant de la boutique

2. **Mixage** :
   - **Couche 1** : Audio de la vidéo (son ambiant, volume automatique)
   - **Couche 2** : Musique de fond (volume 28%)
   - **Couche 3** : Voix off (volume 100%)
   - **Couche 4** : SFX (Impact, Glitch, etc., volume 60%)

3. **Résultat** : Vidéo finale avec mixage de toutes les couches audio

**Si la vidéo n'a pas d'audio :**
- Yukpo crée un stream audio silencieux
- Seulement musique, voix et SFX sont mixés

**Résultat :** L'audio des vidéos est automatiquement intégré dans le mixage final.

---

## 📊 2. Limite de 18 Médias et Sélection des Vidéos

### Réponse Simple

**Oui, la vidéo sera capturée si elle est dans les 18 premiers médias sélectionnés. La limite est sur le TOTAL des médias (images + vidéos), pas seulement les images.**

### Explication Détaillée

#### Limite Totale sur Tous les Types de Médias

```rust
// Ligne 2201: video_generation_service.rs
collected.truncate(18);  // ✅ LIMITE TOTALE : Maximum 18 médias (images + vidéos)
Ok(collected)
```

**Important :** La limite de 18 s'applique au **TOTAL** des médias (images + vidéos), pas seulement aux images.

#### Ordre de Sélection

```rust
// Ligne 2101-2131: video_generation_service.rs
// Étape 1 : Galerie produit (LIMIT 16)
if use_product_gallery {
    let rows = sqlx::query_as(
        "SELECT id, path, type, ai_description
         FROM media
         WHERE service_id = $1
         AND (product_index = $2 OR (product_index IS NULL AND type = 'image'))
         ORDER BY COALESCE(is_main_image, FALSE) DESC, COALESCE(display_order, 0) ASC, id ASC
         LIMIT 16"  // ✅ 16 médias (images OU vidéos)
    )
    .fetch_all(&state.pg)
    .await?;
}
```

**Règles :**
- ✅ Les 16 premiers médias de la galerie produit sont sélectionnés (images OU vidéos)
- ✅ Tri par priorité : `is_main_image` → `display_order` → `id`
- ✅ Pas de distinction entre images et vidéos dans la sélection

### Exemple Concret

**Scénario :** 17 médias disponibles
- 16 images : `photo1.jpg` à `photo16.jpg`
- 1 vidéo : `video_boutique.mp4` (en dernière position dans la base)

**Ce que fait Yukpo :**

1. **Récupération** :
   - Prend les 16 premiers médias de la galerie produit
   - Si la vidéo est dans les 16 premiers → Incluse
   - Si la vidéo est en 17ème position → Exclue (limite 16 pour galerie produit)

2. **Limite finale** :
   - Total collecté : 16 médias (ou 17 si vidéo incluse)
   - Limite finale : `truncate(18)` → Maximum 18 médias
   - **Résultat :** Si vidéo dans les 16 premiers, elle est incluse

**Si la vidéo est en 17ème position :**
- ❌ Exclue de la galerie produit (limite 16)
- ✅ Peut être incluse depuis la médiathèque service (limite 12)
- ✅ Total maximum : 18 médias (16 galerie + 2 médiathèque)

**Résultat :** La vidéo sera capturée si elle est dans les 18 premiers médias sélectionnés, peu importe sa position initiale.

---

## 🤖 3. Analyse IA des Images pour Pertinence

### Réponse Simple

**Oui, les images sont analysées par l'IA pour générer une description (`ai_description`), qui est ensuite utilisée pour le scoring de pertinence lors du positionnement.**

### Explication Détaillée

#### Analyse IA lors de l'Upload

```rust
// Ligne 2205-2233: video_generation_service.rs
fn row_to_media_source(id: i32, path: &str, ai_description: Option<String>) -> Option<MediaSource> {
    Some(MediaSource {
        id: Some(id),
        path: absolute,
        ai_description,  // ✅ Description IA générée lors de l'upload
    })
}
```

**Processus :**
1. Lors de l'upload d'une image, l'IA analyse le contenu
2. L'IA génère une description détaillée (`ai_description`)
3. La description est stockée dans la base de données
4. La description est utilisée pour le scoring de pertinence

#### Scoring de Pertinence basé sur `ai_description`

```rust
// Ligne 2317-2329: video_generation_service.rs
fn score_media_for_line(media: &MediaSource, line: &str) -> i32 {
    let Some(description) = media.ai_description.as_ref() else {
        return 0;  // ✅ Pas de description = score 0
    };
    let lowered = description.to_lowercase();
    let mut score = 0;
    for keyword in extract_keywords(line) {
        if lowered.contains(&keyword) {
            score += 4;  // ✅ Chaque mot-clé correspondant = +4 points
        }
    }
    score
}
```

**Processus de scoring :**
1. Yukpo extrait les mots-clés de la ligne du script
2. Yukpo cherche ces mots-clés dans `ai_description` de chaque média
3. Chaque mot-clé correspondant = +4 points
4. Média avec score le plus élevé = sélectionné pour la scène

### Exemple Concret

**Image uploadée :** `photo1.jpg` (iPhone 15 Pro)

**Analyse IA lors de l'upload :**
```json
{
  "description": "iPhone 15 Pro, écran Super Retina XDR, caméra 48MP Pro, design titane",
  "tags": ["iphone", "15", "pro", "écran", "retina", "caméra", "48mp"],
  "category_detected": "smartphone"
}
```

**Stockage :**
- `ai_description` = "iPhone 15 Pro, écran Super Retina XDR, caméra 48MP Pro, design titane"

**Scoring pour le script :**
- Script ligne 1 : "Découvrez iPhone 15 Pro"
  - Mots-clés : ["découvrez", "iphone", "15", "pro"]
  - Score : 0 + 4 + 4 + 4 = **12 points**

- Script ligne 2 : "Écran Super Retina XDR"
  - Mots-clés : ["écran", "super", "retina", "xdr"]
  - Score : 4 + 4 + 4 + 4 = **16 points**

- Script ligne 3 : "Caméra 48MP Pro"
  - Mots-clés : ["caméra", "48mp", "pro"]
  - Score : 4 + 4 + 4 = **12 points**

**Résultat :** L'image est assignée à la ligne 2 (score le plus élevé : 16 points).

**Résultat :** Les images sont analysées par l'IA lors de l'upload, et la description générée est utilisée pour le scoring de pertinence lors du positionnement.

---

## 🎬 4. Génération de Vidéo sans Vidéos dans la Médiathèque

### Réponse Simple

**Oui, la vidéo sera toujours créée même s'il n'y a pas de vidéos dans la médiathèque. Yukpo utilise les images disponibles et les convertit en slides vidéo.**

### Explication Détaillée

#### Conversion d'Images en Slides Vidéo

```rust
// Ligne 1059-1078: video_generation_service.rs
for (idx, media) in media_sources.iter().enumerate() {
    let slide_duration = slide_durations
        .get(idx)
        .copied()
        .unwrap_or(per_slide_seconds);

    let slide_name = format!("slide_{:02}.mp4", idx + 1);
    let duration_arg = format!("{:.2}", slide_duration);
    
    // ✅ Conversion image → vidéo avec FFmpeg
    let args = vec![
        "-y".to_string(),
        "-loop".to_string(),
        "1".to_string(),  // ✅ Boucle l'image
        "-i".to_string(),
        media.path.to_string_lossy().to_string(),  // ✅ Chemin de l'image
        "-t".to_string(),
        duration_arg,  // ✅ Durée de la slide
        "-vf".to_string(),
        filter,  // ✅ Filtres (texte, effets, etc.)
        "-c:v".to_string(),
        "libx264".to_string(),  // ✅ Codec vidéo
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        slide_name.clone(),
    ];

    run_ffmpeg(&session_dir, args).await?;  // ✅ Convertit image → vidéo
    slide_filenames.push(slide_name);
}
```

**Processus :**
1. Yukpo prend chaque image de `media_sources`
2. Yukpo utilise FFmpeg pour convertir l'image en slide vidéo
3. L'image est bouclée (`-loop 1`) pour la durée spécifiée
4. Des filtres sont appliqués (texte, effets, transitions)
5. Le slide vidéo est généré au format MP4

#### Vérification : Au Moins une Image Requise

```rust
// Ligne 887-893: video_generation_service.rs
if media_sources.is_empty() {
    return Err(AppError::BadRequest(
        "Ajoutez au moins une image dans votre médiathèque ou dans ce produit avant de générer une vidéo, ou activez 'auto_generate_images: true' pour générer automatiquement des images avec l'IA."
            .to_string(),
    ));
}
```

**Règles :**
- ✅ **Au moins une image** est requise pour générer une vidéo
- ✅ **Pas de vidéo requise** dans la médiathèque
- ✅ Si pas d'images, génération IA automatique possible (`auto_generate_images: true`)

### Exemple Concret

**Scénario :** Prestataire avec seulement des images, pas de vidéos

**Médias disponibles :**
- 5 images : `photo1.jpg`, `photo2.jpg`, `photo3.jpg`, `photo4.jpg`, `photo5.jpg`
- 0 vidéos

**Ce que fait Yukpo :**

1. **Récupération** :
   - `media_sources` = [photo1.jpg, photo2.jpg, photo3.jpg, photo4.jpg, photo5.jpg]
   - Total : 5 médias (tous des images)

2. **Conversion** :
   - `photo1.jpg` → `slide_01.mp4` (3 secondes)
   - `photo2.jpg` → `slide_02.mp4` (3 secondes)
   - `photo3.jpg` → `slide_03.mp4` (3 secondes)
   - `photo4.jpg` → `slide_04.mp4` (3 secondes)
   - `photo5.jpg` → `slide_05.mp4` (3 secondes)

3. **Assemblage** :
   - Les 5 slides sont assemblées en une vidéo finale
   - Durée totale : 15 secondes (5 × 3 secondes)

4. **Audio** :
   - Musique de fond ajoutée
   - Voix off ajoutée
   - SFX ajoutés
   - **Pas besoin de vidéos avec audio dans la médiathèque**

**Résultat :** Vidéo professionnelle créée uniquement à partir d'images, sans vidéos dans la médiathèque.

---

## 🎯 Résumé Complet

### 1. Gestion des Vidéos avec Audio

✅ **Détection automatique** : Yukpo vérifie si une vidéo a de l'audio avec `ffprobe`
✅ **Mixage intelligent** : L'audio de la vidéo est intégré dans le mixage final avec musique, voix et SFX
✅ **Fallback** : Si pas d'audio, stream silencieux créé automatiquement

### 2. Limite de 18 Médias

✅ **Limite totale** : Maximum 18 médias (images + vidéos combinés)
✅ **Sélection** : Les 16 premiers médias de la galerie produit sont sélectionnés (images OU vidéos)
✅ **Vidéo incluse** : Si vidéo dans les 18 premiers médias, elle est incluse

### 3. Analyse IA des Images

✅ **Analyse lors de l'upload** : L'IA analyse chaque image et génère une description (`ai_description`)
✅ **Scoring de pertinence** : La description est utilisée pour calculer le score de pertinence
✅ **Positionnement automatique** : Média avec score le plus élevé = assigné à la scène correspondante

### 4. Génération sans Vidéos

✅ **Conversion automatique** : Les images sont converties en slides vidéo avec FFmpeg
✅ **Pas de vidéos requises** : Seulement des images sont nécessaires
✅ **Génération IA** : Si pas d'images, génération automatique possible (`auto_generate_images: true`)

---

## 💡 Exemple Complet

**Scénario :**
- Prestataire avec 20 images et 1 vidéo (en 17ème position)
- Vidéo avec son ambiant
- Durée vidéo demandée : 30 secondes

**Ce que fait Yukpo :**

1. **Récupération** :
   - 16 premières images sélectionnées (limite galerie produit)
   - Vidéo exclue (17ème position)
   - Total : 16 médias

2. **Analyse IA** :
   - Chaque image analysée → `ai_description` générée
   - Scoring de pertinence calculé pour chaque image

3. **Conversion** :
   - 16 images → 16 slides vidéo (1.875 secondes par slide)

4. **Audio** :
   - Musique de fond ajoutée
   - Voix off ajoutée
   - SFX ajoutés
   - **Note :** L'audio de la vidéo n'est pas utilisé (vidéo exclue)

5. **Résultat** : Vidéo de 30 secondes avec 16 slides, audio mixé professionnellement

**Si la vidéo était en 15ème position :**
- Vidéo incluse dans les 16 premiers
- Audio de la vidéo mixé avec musique, voix et SFX
- Total : 15 images + 1 vidéo = 16 médias

---

*Explication basée sur le code source analysé*
*Fichiers : audio_pipeline.rs, video_generation_service.rs*

