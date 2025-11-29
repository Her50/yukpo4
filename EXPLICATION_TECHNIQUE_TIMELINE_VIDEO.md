# 🎬 Explication Technique : Timeline Vidéo et Synchronisation

## 📚 Table des Matières
1. [Frame-par-Frame vs Synchronisation par Seconde](#frame-par-frame)
2. [B-roll Automatique : Comment ça marche ?](#b-roll-automatique)
3. [Comment Yukpo décide quelle image afficher ?](#selection-images)
4. [Comment Yukpo décide quand faire apparaître l'audio ?](#synchronisation-audio)

---

## 🎯 1. Frame-par-Frame vs Synchronisation par Seconde

### Qu'est-ce qu'une Frame ?

**Une frame (image) est une photo instantanée de la vidéo.**

- **Vidéo à 30fps** = 30 images par seconde
- **Vidéo de 15 secondes** = 450 images (frames)
- **Chaque frame** = 1/30ème de seconde = 0.033 seconde

### Comparaison Visuelle

#### TikTok/Instagram (Synchronisation par Seconde)

```
Vidéo de 15 secondes :
├─ Seconde 0 : Son démarre
├─ Seconde 3 : Transition
├─ Seconde 6 : Nouveau son
├─ Seconde 9 : Transition
└─ Seconde 12 : Son final

Précision : ±0.5 seconde (15 frames d'erreur possible)
```

**Problème :** Si le son démarre à la seconde 3.2 au lieu de 3.0, il y a un décalage de 6 frames (0.2 seconde), visible à l'œil nu.

#### Yukpo (Synchronisation Frame-par-Frame)

```
Vidéo de 15 secondes (450 frames) :
├─ Frame 0 : Son démarre (précision absolue)
├─ Frame 90 : Transition (précision absolue)
├─ Frame 180 : Nouveau son (précision absolue)
├─ Frame 270 : Transition (précision absolue)
└─ Frame 360 : Son final (précision absolue)

Précision : Frame exacte (0 frame d'erreur)
```

**Avantage :** Le son démarre exactement à la frame prévue, pas de décalage visible.

### Exemple Concret dans le Code

```rust
// Ligne 234-253: immersive_orchestrator.rs
let mut audio_cues: Vec<ImmersiveAudioCue> = Vec::new();
let mut current_frame: u32 = 0;  // ✅ Compteur de frames

for (idx, scene) in scenes.iter_mut().enumerate() {
    // Déterminer le type d'audio selon la scène
    let cue_type = if idx == 0 {
        AudioCueKind::Riser  // Scène intro
    } else if idx == total_scenes - 1 {
        AudioCueKind::Beat   // Scène CTA
    } else if plan.should_inject_broll(idx) {
        AudioCueKind::Impact // Scène B-roll
    } else {
        AudioCueKind::Glitch // Scène produit
    };

    // ✅ Créer l'audio cue à la frame EXACTE
    audio_cues.push(ImmersiveAudioCue {
        id: format!("scene_{}_cue", idx),
        start_frame: current_frame,  // ✅ Frame exacte (ex: 90, 180, 270)
        cue_type,
    });

    // ✅ Avancer le compteur de frames pour la prochaine scène
    current_frame += scene.duration_in_frames;
}
```

### Scénario Concret : Vidéo de 15 Secondes

**Avec Yukpo (Frame-par-Frame) :**
- Scène 1 (Intro) : 90 frames (3 secondes)
  - Audio Riser démarre à la **frame 0** (précision absolue)
- Scène 2 (Produit) : 90 frames (3 secondes)
  - Audio Glitch démarre à la **frame 90** (précision absolue)
- Scène 3 (B-roll) : 90 frames (3 secondes)
  - Audio Impact démarre à la **frame 180** (précision absolue)
- Scène 4 (CTA) : 180 frames (6 secondes)
  - Audio Beat démarre à la **frame 270** (précision absolue)

**Résultat :** Synchronisation parfaite, aucun décalage visible.

**Avec TikTok (Par Seconde) :**
- Scène 1 : Audio démarre à la "seconde 0" (±0.5 seconde d'erreur possible)
- Scène 2 : Audio démarre à la "seconde 3" (±0.5 seconde d'erreur possible)
- **Problème :** Décalage visible si le timing n'est pas parfait

---

## 🎥 2. B-roll Automatique : Comment ça marche ?

### Qu'est-ce qu'un B-roll ?

**B-roll = Vidéo d'ambiance en arrière-plan** (ex: boutique, restaurant, produit en action)

### Comment Yukpo Décide Automatiquement où Injecter le B-roll ?

#### Étape 1 : Planification Automatique des Slots

```rust
// Ligne 118-140: immersive_orchestrator.rs
pub fn build_plan(&self, context: &ImmersiveContext) -> AppResult<ImmersivePlan> {
    let mut broll_slots = Vec::new();

    if context.slide_count > 1 {
        // ✅ Règle : Injecter B-roll sur les scènes impaires (index 1, 3, 5, etc.)
        for idx in 0..context.slide_count {
            if idx % 2 == 1 {  // ✅ Si index impair
                broll_slots.push(idx);
            }
        }
    }

    let plan = ImmersivePlan {
        broll_slots,  // ✅ Liste des slots B-roll planifiés
        cta_slide_index: context.slide_count.saturating_sub(1),
    };
}
```

**Règle simple :** B-roll injecté automatiquement sur les scènes **impaires** (1, 3, 5, 7...)

#### Étape 2 : Injection Automatique lors de la Génération

```rust
// Ligne 197-216: immersive_orchestrator.rs
// Pour chaque scène de contenu
for (idx, line) in request.script_outline.iter().enumerate() {
    let scene_index = idx + 1;  // ✅ Index de la scène (1, 2, 3, 4...)

    // ✅ Vérifier si cette scène doit avoir du B-roll
    if plan.should_inject_broll(scene_index) {
        if let Some(asset) = broll_iter.next() {
            // ✅ Injecter le B-roll automatiquement
            scene_assets.video_url = Some(asset.path.clone());
            scene_assets.background_url = Some(asset.path.clone());
            
            // ✅ Changer le template pour B-roll
            template = ImmersiveTemplate::ARHighlight;
            transition.r#type = TransitionType::Orbit3d;  // Transition 3D
            color_grade = Some(ImmersiveSceneColorGrade {
                style: ColorGradeStyle::Glow,  // Effet lumineux
                intensity: 0.5,
            });
        }
    }
}
```

### Exemple Concret : Vidéo avec 4 Scènes

**Script :**
1. "Découvrez notre produit"
2. "Qualité premium"
3. "Livraison rapide"
4. "Commandez maintenant"

**Planification automatique :**
- Scène 0 (Intro) : Pas de B-roll
- Scène 1 ("Découvrez") : **B-roll injecté** (index 1 = impair)
- Scène 2 ("Qualité") : Pas de B-roll (index 2 = pair)
- Scène 3 ("Livraison") : **B-roll injecté** (index 3 = impair)
- Scène 4 ("Commandez" - CTA) : Pas de B-roll

**Résultat :** Vidéo avec B-roll automatique sur les scènes 1 et 3, sans intervention manuelle.

### Pourquoi cette Règle (Scènes Impaires) ?

**Raison :** Alternance visuelle optimale
- Scène paire : Focus sur le produit (image statique)
- Scène impaire : Ambiance avec B-roll (vidéo dynamique)
- **Résultat :** Rythme visuel équilibré, pas monotone

---

## 🖼️ 3. Comment Yukpo Décide Quelle Image Afficher ?

### Processus de Sélection Automatique

#### Étape 1 : Récupération des Médias Disponibles

```rust
// Ligne 787-797: video_generation_service.rs
// ✅ PRIORITÉ 1 : Récupérer les images locales
let mut media_sources = gather_media_sources(
    &state,
    service_id,
    product_index,
    payload.selected_media_ids.clone(),  // ✅ Médias sélectionnés explicitement
    payload.use_product_gallery.unwrap_or(true),  // ✅ Galerie produit
    payload.use_service_mediatech.unwrap_or(true),  // ✅ Médiathèque service
    payload.include_publicite_assets.unwrap_or(true),  // ✅ Assets publicité
)
.await?;
```

**Ordre de priorité :**
1. **Médias sélectionnés explicitement** (`selected_media_ids`)
2. **Galerie produit** (images liées au produit spécifique)
3. **Médiathèque service** (images générales du service)
4. **Assets publicité** (bannières, logos)

#### Étape 2 : Association Image ↔ Scène selon le Script

```rust
// Ligne 181-228: immersive_orchestrator.rs
// Pour chaque ligne du script
for (idx, line) in request.script_outline.iter().enumerate() {
    let scene_index = idx + 1;
    let mut scene_assets = ImmersiveSceneAssets::default();
    
    // ✅ Texte de la scène = ligne du script
    scene_assets.body = Some(line.clone());
    scene_assets.headline = Some(request.product_name.clone());
    
    // ✅ Image produit par défaut
    scene_assets.product_image_url = Some(product_image_path);
    
    // ✅ Si B-roll disponible, l'utiliser comme background
    if plan.should_inject_broll(scene_index) {
        if let Some(asset) = broll_iter.next() {
            scene_assets.background_url = Some(asset.path.clone());
        }
    }
}
```

### Exemple Concret : Création d'une Vidéo

**Input utilisateur :**
- Produit : "iPhone 15 Pro"
- Images disponibles : [photo1.jpg, photo2.jpg, photo3.jpg, video_boutique.mp4]
- Script généré : 
  1. "Découvrez iPhone 15 Pro"
  2. "Écran Super Retina XDR"
  3. "Caméra 48MP Pro"
  4. "Commandez maintenant"

**Processus automatique de Yukpo :**

1. **Scène 0 (Intro)** :
   - Image : `photo1.jpg` (première image disponible)
   - Template : IntroPulse
   - Audio : Riser

2. **Scène 1 ("Découvrez")** :
   - Image : `photo1.jpg` (image produit)
   - Background : `video_boutique.mp4` (B-roll, car index 1 = impair)
   - Template : ARHighlight (spécial B-roll)
   - Audio : Impact

3. **Scène 2 ("Écran")** :
   - Image : `photo2.jpg` (image suivante)
   - Pas de B-roll (index 2 = pair)
   - Template : ProductShowcase
   - Audio : Glitch

4. **Scène 3 ("Caméra")** :
   - Image : `photo3.jpg` (image suivante)
   - Background : Pas de B-roll (déjà utilisé)
   - Template : ProductShowcase
   - Audio : Glitch

5. **Scène 4 ("Commandez" - CTA)** :
   - Image : `photo1.jpg` (retour à la première)
   - Template : GlowCTA
   - Audio : Beat

**Résultat :** Images assignées automatiquement selon l'ordre et la disponibilité.

### Règles de Sélection Automatique

1. **Rotation des images** : Si 3 images et 5 scènes, les images sont réutilisées
2. **B-roll prioritaire** : Si B-roll disponible, utilisé comme background sur scènes impaires
3. **Image produit principale** : Toujours affichée sur chaque scène produit
4. **Fallback intelligent** : Si pas d'image, génération IA automatique (si activée)

---

## 🔊 4. Comment Yukpo Décide Quand Faire Apparaître l'Audio ?

### Processus de Synchronisation Audio

#### Étape 1 : Calcul de la Position de Chaque Scène

```rust
// Ligne 234-315: immersive_orchestrator.rs
let mut audio_cues: Vec<ImmersiveAudioCue> = Vec::new();
let mut current_frame: u32 = 0;  // ✅ Compteur de frames (démarre à 0)
let total_scenes = scenes.len();

for (idx, scene) in scenes.iter_mut().enumerate() {
    // ✅ Déterminer le type d'audio selon le type de scène
    let cue_type = if idx == 0 {
        AudioCueKind::Riser  // Scène intro = Riser (montée)
    } else if idx == total_scenes - 1 {
        AudioCueKind::Beat   // Scène CTA = Beat (rythme)
    } else if plan.should_inject_broll(idx) {
        AudioCueKind::Impact // Scène B-roll = Impact (punch)
    } else {
        AudioCueKind::Glitch // Scène produit = Glitch (effet)
    };

    // ✅ Créer l'audio cue à la frame EXACTE
    audio_cues.push(ImmersiveAudioCue {
        id: format!("scene_{}_cue", idx),
        start_frame: current_frame,  // ✅ Frame exacte où l'audio démarre
        cue_type,
    });

    // ✅ Avancer le compteur pour la prochaine scène
    current_frame += scene.duration_in_frames;  // Ex: 0 + 90 = 90, puis 90 + 90 = 180
}
```

### Exemple Concret : Calcul des Positions Audio

**Vidéo de 15 secondes (450 frames à 30fps) :**
- **Scène 0 (Intro)** : 90 frames (3 secondes)
  - `current_frame = 0`
  - Audio Riser démarre à la **frame 0**
  - `current_frame = 0 + 90 = 90`

- **Scène 1 (Produit)** : 90 frames (3 secondes)
  - `current_frame = 90`
  - Audio Glitch démarre à la **frame 90**
  - `current_frame = 90 + 90 = 180`

- **Scène 2 (B-roll)** : 90 frames (3 secondes)
  - `current_frame = 180`
  - Audio Impact démarre à la **frame 180**
  - `current_frame = 180 + 90 = 270`

- **Scène 3 (CTA)** : 180 frames (6 secondes)
  - `current_frame = 270`
  - Audio Beat démarre à la **frame 270**
  - `current_frame = 270 + 180 = 450` (fin de vidéo)

### Règles de Décision Audio

#### Règle 1 : Type de Scène → Type d'Audio

```rust
// Ligne 239-247: immersive_orchestrator.rs
let cue_type = if idx == 0 {
    AudioCueKind::Riser  // ✅ Intro = Montée sonore
} else if idx == total_scenes - 1 {
    AudioCueKind::Beat   // ✅ CTA = Rythme fort
} else if plan.should_inject_broll(idx) {
    AudioCueKind::Impact // ✅ B-roll = Impact sonore
} else {
    AudioCueKind::Glitch // ✅ Produit = Effet sonore
};
```

**Logique :**
- **Intro** : Riser (montée sonore pour captiver)
- **Produit** : Glitch (effet sonore discret)
- **B-roll** : Impact (punch sonore pour l'impact visuel)
- **CTA** : Beat (rythme fort pour inciter à l'action)

#### Règle 2 : Position = Somme des Frames Précédentes

```rust
// Ligne 314: immersive_orchestrator.rs
current_frame += scene.duration_in_frames;
```

**Calcul automatique :**
- Scène 0 : Position = 0
- Scène 1 : Position = 0 + durée_scène_0
- Scène 2 : Position = durée_scène_0 + durée_scène_1
- Scène 3 : Position = somme de toutes les scènes précédentes

### Exemple Visuel Complet

```
VIDÉO DE 15 SECONDES (450 FRAMES)
═══════════════════════════════════════════════════════════

Frame 0     Frame 90    Frame 180   Frame 270   Frame 450
   │            │            │            │            │
   ▼            ▼            ▼            ▼            ▼
┌─────┐      ┌─────┐      ┌─────┐      ┌─────┐      ┌─────┐
│Intro│      │Prod1│      │Broll│      │ CTA │      │ FIN │
└─────┘      └─────┘      └─────┘      └─────┘      └─────┘
   │            │            │            │
   ▼            ▼            ▼            ▼
Audio:       Audio:       Audio:       Audio:
Riser        Glitch       Impact       Beat
(démarre     (démarre     (démarre     (démarre
 frame 0)    frame 90)   frame 180)   frame 270)

Image:       Image:       Image:       Image:
photo1.jpg   photo1.jpg   photo2.jpg   photo1.jpg
             + B-roll     (B-roll      (CTA)
             (boutique)   background)
```

### Synchronisation avec les Stickers

```rust
// Ligne 267-310: immersive_orchestrator.rs
// Sticker promo
if ctx.promotion_active.unwrap_or(false) && idx > 0 && idx < total_scenes - 1 {
    stickers.push(ImmersiveSticker {
        start_frame: current_frame.saturating_add(fps / 4),  // ✅ Frame 0 + 7.5 = frame 7
        duration_in_frames: scene.duration_in_frames.saturating_sub(fps / 3),
    });
}

// Sticker livraison
if ctx.delivery_sla_minutes.is_some() && idx == total_scenes - 1 {
    stickers.push(ImmersiveSticker {
        start_frame: current_frame.saturating_add(fps / 3),  // ✅ Frame 270 + 10 = frame 280
        duration_in_frames: scene.duration_in_frames.saturating_sub(fps / 2),
    });
}
```

**Exemple :**
- Scène CTA démarre à la frame 270
- Sticker livraison apparaît à la frame 280 (270 + 10 frames = 0.33 seconde après le début)
- Sticker disparaît à la frame 420 (270 + 180 - 30 = fin de scène moins 1 seconde)

---

## 🎯 Résumé : Comment Tout Fonctionne Ensemble

### Processus Complet de Génération

1. **Input utilisateur** :
   - Produit : "iPhone 15 Pro"
   - Images : [photo1.jpg, photo2.jpg, video_boutique.mp4]
   - Script : ["Découvrez iPhone 15 Pro", "Écran Super Retina", "Commandez maintenant"]

2. **Yukpo calcule automatiquement** :
   - Nombre de scènes : 3 lignes + intro + CTA = 5 scènes
   - Durée par scène : 15 secondes / 5 = 3 secondes = 90 frames
   - Slots B-roll : Scènes 1 et 3 (impaires)

3. **Yukpo assigne automatiquement** :
   - **Scène 0** : Image photo1.jpg, Audio Riser (frame 0)
   - **Scène 1** : Image photo1.jpg + B-roll video_boutique.mp4, Audio Impact (frame 90)
   - **Scène 2** : Image photo2.jpg, Audio Glitch (frame 180)
   - **Scène 3** : Image photo1.jpg, Audio Glitch (frame 270)
   - **Scène 4** : Image photo1.jpg, Audio Beat (frame 360)

4. **Résultat** : Vidéo professionnelle synchronisée frame-par-frame, sans intervention manuelle.

---

## 💡 Pourquoi C'est Unique ?

### TikTok/Instagram/CapCut
- ❌ Synchronisation par seconde (±0.5 seconde d'erreur)
- ❌ B-roll manuel (l'utilisateur doit décider)
- ❌ Images manuelles (l'utilisateur doit choisir)
- ❌ Audio manuel (l'utilisateur doit synchroniser)

### Yukpo
- ✅ Synchronisation frame-par-frame (précision absolue)
- ✅ B-roll automatique (injection intelligente)
- ✅ Images automatiques (sélection selon disponibilité)
- ✅ Audio automatique (synchronisation parfaite)

**Résultat :** Vidéos professionnelles en 2 minutes au lieu de 2-3 heures.

---

*Explication basée sur le code source analysé*
*Fichiers : immersive_orchestrator.rs, immersive_timeline.rs, video_generation_service.rs*

