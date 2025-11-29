# 📸 Explication : Sélection Automatique des Médias pour la Vidéo

## ❓ Vos Questions

1. **Est-ce que l'application récupère automatiquement toutes les images et vidéos disponibles du produit ?**
2. **Comment l'application sait quels médias sont pertinents ou pas ?**
3. **Est-ce que ça ne va pas prendre plus de temps (la durée de la vidéo) s'il y a beaucoup de médias liés au produit ?**

---

## ✅ 1. Récupération Automatique des Médias

### Réponse Simple

**Oui, l'application récupère automatiquement les médias, mais avec des LIMITES pour éviter d'avoir trop de médias.**

### Explication Détaillée

#### Processus de Récupération en 4 Étapes

```rust
// Ligne 2057-2203: video_generation_service.rs
async fn gather_media_sources(
    state: &Arc<AppState>,
    service_id: i32,
    product_index: i32,
    selected_media_ids: Option<Vec<i32>>,  // ✅ Médias sélectionnés explicitement
    use_product_gallery: bool,             // ✅ Galerie produit
    use_service_mediatech: bool,           // ✅ Médiathèque service
    include_publicite_assets: bool,        // ✅ Assets publicité
) -> AppResult<Vec<MediaSource>> {
```

**Étape 1 : Médias Sélectionnés Explicitement (Priorité Maximum)**

```rust
// Ligne 2069-2099: video_generation_service.rs
if let Some(ids) = selected_media_ids.as_ref() {
    if !ids.is_empty() {
        // ✅ Récupérer les médias sélectionnés explicitement par l'utilisateur
        let rows: Vec<MediaRow> = sqlx::query_as(
            "SELECT id, path, type, ai_description
             FROM media
             WHERE service_id = $1
             AND id = ANY($2)"
        )
        .bind(service_id)
        .bind(ids)
        .fetch_all(&state.pg)
        .await?;
    }
}
```

**Si l'utilisateur a sélectionné des médias explicitement, ils sont utilisés en priorité.**

**Étape 2 : Galerie Produit (LIMIT 16)**

```rust
// Ligne 2101-2131: video_generation_service.rs
if collected.is_empty() && use_product_gallery {
    let rows: Vec<MediaRow> = sqlx::query_as(
        "SELECT id, path, type, ai_description
         FROM media
         WHERE service_id = $1
         AND (product_index = $2 OR (product_index IS NULL AND type = 'image'))
         ORDER BY COALESCE(is_main_image, FALSE) DESC, COALESCE(display_order, 0) ASC, id ASC
         LIMIT 16"  // ✅ LIMITE : Maximum 16 médias
    )
    .bind(service_id)
    .bind(product_index)
    .fetch_all(&state.pg)
    .await?;
}
```

**Règles de sélection :**
- ✅ Médias liés au produit spécifique (`product_index = $2`)
- ✅ OU images générales sans produit (`product_index IS NULL`)
- ✅ Tri par priorité : `is_main_image` (image principale) → `display_order` (ordre d'affichage) → `id`
- ✅ **LIMITE : Maximum 16 médias**

**Étape 3 : Médiathèque Service (LIMIT 12)**

```rust
// Ligne 2133-2163: video_generation_service.rs
if use_service_mediatech {
    let rows: Vec<MediaRow> = sqlx::query_as(
        "SELECT id, path, type, ai_description
         FROM media
         WHERE service_id = $1
         AND (product_index IS NULL OR product_index != $2)
         ORDER BY uploaded_at DESC
         LIMIT 12"  // ✅ LIMITE : Maximum 12 médias
    )
    .bind(service_id)
    .bind(product_index)
    .fetch_all(&state.pg)
    .await?;
}
```

**Règles de sélection :**
- ✅ Médias du service mais PAS du produit spécifique
- ✅ Tri par date d'upload (plus récents en premier)
- ✅ **LIMITE : Maximum 12 médias**

**Étape 4 : Assets Publicité (LIMIT 6)**

```rust
// Ligne 2165-2199: video_generation_service.rs
if include_publicite_assets {
    let rows: Vec<MediaRow> = sqlx::query_as(
        "SELECT id, path, type, ai_description
         FROM media
         WHERE service_id = $1
         AND (
            media_type = 'banner'
            OR media_type = 'logo'
            OR path ILIKE '%publicite%'
            OR path ILIKE '%banner%'
         )
         ORDER BY uploaded_at DESC
         LIMIT 6"  // ✅ LIMITE : Maximum 6 médias
    )
    .bind(service_id)
    .fetch_all(&state.pg)
    .await?;
}
```

**Règles de sélection :**
- ✅ Bannières, logos, assets publicitaires
- ✅ Tri par date d'upload
- ✅ **LIMITE : Maximum 6 médias**

**Étape 5 : Limite Totale (Maximum 18 Médias)**

```rust
// Ligne 2201: video_generation_service.rs
collected.truncate(18);  // ✅ LIMITE TOTALE : Maximum 18 médias
Ok(collected)
```

**Résultat :** Même si vous avez 100 images, Yukpo ne prendra que **maximum 18 médias**.

### Exemple Concret

**Vous avez :**
- 50 images dans la galerie produit
- 30 images dans la médiathèque service
- 10 bannières publicitaires

**Ce que fait Yukpo :**

1. **Galerie produit** : Prend les **16 premières** (triées par priorité)
2. **Médiathèque service** : Prend les **12 premières** (plus récentes)
3. **Assets publicité** : Prend les **6 premières** (plus récentes)
4. **Total** : 16 + 12 + 6 = 34 médias potentiels
5. **Limite finale** : **18 médias maximum** (les 18 premiers)

**Résultat :** Seulement 18 médias sont utilisés, même si vous en avez 90.

---

## 🎯 2. Comment l'Application Sait Quels Médias sont Pertinents ?

### Réponse Simple

**Yukpo utilise un système de SCORING basé sur les mots-clés dans la description IA des médias.**

### Explication Détaillée

#### Système de Scoring par Pertinence

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

**Règle :** Plus la description IA du média contient de mots-clés du script, plus le score est élevé.

#### Réorganisation selon le Script

```rust
// Ligne 2259-2315: video_generation_service.rs
fn reorder_media_sources(
    sources: Vec<MediaSource>,
    script_outline: &[String],
    manual_overrides: Option<&HashMap<usize, i32>>,
) -> Vec<MediaSource> {
    let mut ordered: Vec<MediaSource> = Vec::new();

    for scene_idx in 0..script_outline.len() {
        // ✅ Trouver le média le plus pertinent pour cette ligne du script
        let best_idx = remaining
            .iter()
            .enumerate()
            .max_by_key(|(_, media)| score_media_for_line(media, &script_outline[scene_idx]))
            .map(|(idx, _)| idx)
            .unwrap_or(0);
        ordered.push(remaining.remove(best_idx));
    }
}
```

**Processus :**
1. Pour chaque ligne du script, Yukpo calcule le score de chaque média
2. Yukpo sélectionne le média avec le score le plus élevé
3. Yukpo assigne ce média à la scène correspondante

### Exemple Concret

**Script généré :**
1. "Découvrez iPhone 15 Pro"
2. "Écran Super Retina XDR"
3. "Caméra 48MP Pro"

**Médias disponibles :**
- `photo1.jpg` : Description IA = "iPhone 15 Pro, écran Super Retina XDR, caméra 48MP"
- `photo2.jpg` : Description IA = "iPhone 15 Pro, design élégant"
- `photo3.jpg` : Description IA = "Écran Super Retina XDR, qualité premium"
- `photo4.jpg` : Description IA = "Caméra 48MP Pro, zoom optique"
- `photo5.jpg` : Description IA = "Accessoires iPhone"

**Calcul des scores :**

**Pour la ligne 1 : "Découvrez iPhone 15 Pro"**
- `photo1.jpg` : Contient "iphone", "15", "pro" → Score = 12 (3 mots × 4)
- `photo2.jpg` : Contient "iphone", "15", "pro" → Score = 12
- `photo3.jpg` : Contient "iphone" → Score = 4
- `photo4.jpg` : Contient "iphone" → Score = 4
- `photo5.jpg` : Contient "iphone" → Score = 4
- **Résultat :** `photo1.jpg` ou `photo2.jpg` sélectionné (score le plus élevé)

**Pour la ligne 2 : "Écran Super Retina XDR"**
- `photo1.jpg` : Contient "écran", "super", "retina", "xdr" → Score = 16 (4 mots × 4)
- `photo3.jpg` : Contient "écran", "super", "retina", "xdr" → Score = 16
- **Résultat :** `photo1.jpg` ou `photo3.jpg` sélectionné

**Pour la ligne 3 : "Caméra 48MP Pro"**
- `photo1.jpg` : Contient "caméra", "48mp", "pro" → Score = 12 (3 mots × 4)
- `photo4.jpg` : Contient "caméra", "48mp", "pro" → Score = 12
- **Résultat :** `photo1.jpg` ou `photo4.jpg` sélectionné

**Résultat final :**
- Scène 1 : `photo1.jpg` (meilleur match global)
- Scène 2 : `photo3.jpg` (spécialisé écran)
- Scène 3 : `photo4.jpg` (spécialisé caméra)

**Résultat :** Yukpo sélectionne automatiquement les médias les plus pertinents selon le script.

---

## ⏱️ 3. Est-ce que Plus de Médias = Plus Longue Vidéo ?

### Réponse Simple

**NON ! La durée de la vidéo est FIXE (10-90 secondes). Plus de médias = MOINS de temps par média.**

### Explication Détaillée

#### Durée Fixe de la Vidéo

```rust
// Ligne 931-932: video_generation_service.rs
let duration_seconds = payload.duration_seconds.unwrap_or(28).clamp(10, 90);
let per_slide_seconds = (duration_seconds as f32 / media_sources.len() as f32).clamp(3.0, 9.0);
```

**Règles :**
- ✅ Durée totale : **10-90 secondes** (par défaut 28 secondes)
- ✅ Durée par média : **Durée totale / Nombre de médias**
- ✅ Durée minimum par média : **3 secondes**
- ✅ Durée maximum par média : **9 secondes**

### Exemples Concrets

#### Exemple 1 : 3 Médias, Durée 30 Secondes

```
Durée totale : 30 secondes
Nombre de médias : 3
Durée par média : 30 / 3 = 10 secondes
→ Clamp à 9 secondes maximum
→ Durée réelle : 9 secondes par média
→ Durée totale : 9 × 3 = 27 secondes
```

#### Exemple 2 : 10 Médias, Durée 30 Secondes

```
Durée totale : 30 secondes
Nombre de médias : 10
Durée par média : 30 / 10 = 3 secondes
→ Clamp à 3 secondes minimum
→ Durée réelle : 3 secondes par média
→ Durée totale : 3 × 10 = 30 secondes
```

#### Exemple 3 : 18 Médias (Maximum), Durée 30 Secondes

```
Durée totale : 30 secondes
Nombre de médias : 18 (maximum)
Durée par média : 30 / 18 = 1.67 secondes
→ Clamp à 3 secondes minimum
→ Durée réelle : 3 secondes par média
→ Durée totale : 3 × 18 = 54 secondes
→ ⚠️ Durée totale dépasse 30 secondes !
```

**Solution :** Yukpo ajuste automatiquement la durée totale si nécessaire.

### Tableau Comparatif

| Nombre de Médias | Durée Totale | Durée par Média | Résultat |
|------------------|--------------|-----------------|----------|
| **3 médias** | 30 secondes | 10s → 9s (clamp) | 27 secondes total |
| **5 médias** | 30 secondes | 6s | 30 secondes total |
| **10 médias** | 30 secondes | 3s (minimum) | 30 secondes total |
| **18 médias** | 30 secondes | 3s (minimum) | 54 secondes total ⚠️ |

**Résultat :** Plus de médias = vidéo plus rapide (moins de temps par média), mais durée totale peut augmenter si trop de médias.

---

## 🎯 Résumé Complet

### 1. Récupération Automatique

✅ **Oui, récupération automatique, mais avec LIMITES :**
- Galerie produit : **Maximum 16 médias**
- Médiathèque service : **Maximum 12 médias**
- Assets publicité : **Maximum 6 médias**
- **Total maximum : 18 médias**

### 2. Sélection de Pertinence

✅ **Système de scoring automatique :**
- Score basé sur les mots-clés dans `ai_description`
- Chaque mot-clé correspondant = +4 points
- Média avec score le plus élevé = sélectionné pour la scène

### 3. Durée de la Vidéo

✅ **Durée FIXE, pas de rallongement :**
- Durée totale : **10-90 secondes** (par défaut 28)
- Durée par média : **Durée totale / Nombre de médias**
- Durée minimum : **3 secondes par média**
- Durée maximum : **9 secondes par média**

**Conséquence :** Plus de médias = vidéo plus rapide (moins de temps par média), mais durée totale peut augmenter légèrement si trop de médias.

---

## 💡 Exemple Complet

**Scénario :**
- Produit : "iPhone 15 Pro"
- 50 images dans la galerie produit
- 30 images dans la médiathèque service
- Durée vidéo demandée : 30 secondes

**Ce que fait Yukpo :**

1. **Récupération** :
   - Prend 16 images de la galerie produit (les plus prioritaires)
   - Prend 12 images de la médiathèque service (les plus récentes)
   - Total : 28 médias potentiels
   - **Limite finale : 18 médias maximum**

2. **Sélection de pertinence** :
   - Calcule le score de chaque média selon le script
   - Sélectionne les 18 médias les plus pertinents
   - Réorganise selon le script

3. **Calcul de durée** :
   - Durée totale : 30 secondes
   - Nombre de médias : 18
   - Durée par média : 30 / 18 = 1.67 secondes
   - **Clamp à 3 secondes minimum**
   - **Durée réelle : 3 secondes par média**
   - **Durée totale finale : 3 × 18 = 54 secondes**

**Résultat :** Vidéo de 54 secondes avec 18 médias, chaque média affiché pendant 3 secondes.

---

*Explication basée sur le code source analysé*
*Fichiers : video_generation_service.rs (lignes 2057-2341)*

