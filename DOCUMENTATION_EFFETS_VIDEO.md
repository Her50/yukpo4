# 🎨 Documentation - Système d'Effets Vidéo

**Date**: 2 Janvier 2026

---

## 🎯 **Comment ça fonctionne concrètement**

### **1. Liste d'Effets Disponibles (Backend)**

**Fichier**: `backend/src/services/effect_preview_service.rs`

Il existe une **liste fixe d'environ 53 effets** définis dans le code avec leurs paramètres FFmpeg correspondants :

```rust
fn get_effect_definitions() -> HashMap<&'static str, EffectDefinition> {
    // Exemples :
    "zoom" → { ffmpeg_filter: "zoompan=...", description: "..." }
    "glitch" → { ffmpeg_filter: "curves=...", description: "..." }
    "slow motion" → { ffmpeg_filter: "setpts=2.0*PTS", description: "..." }
    // ... ~50 autres effets
}
```

**Types d'effets disponibles** :
- Mouvements : `zoom`, `pan`, `ken burns`, `slide`
- Ralentis/Accélérés : `slow motion`, `speed ramp`
- Filtres couleur : `vintage`, `neon`, `warm`, `cool`, `cinematic`, `blackwhite`
- Effets visuels : `glitch`, `blur`, `sharpen`, `vignette`, `glow`
- Transitions : `fade`, `split screen`, `overlay`, `mirror`
- Et bien d'autres...

---

### **2. Génération IA des Suggestions d'Effets**

**Fichier**: `backend/src/services/app_ia.rs` → `generate_video_style()`

**Processus** :

1. **Prompt IA** : L'IA reçoit un prompt détaillé avec :
   - Le canal (TikTok, Instagram, etc.)
   - Le type de produit
   - Le ton (dynamique, cinématique, etc.)
   - Les points clés du produit
   - La langue

2. **Réponse IA** : L'IA génère un JSON avec **maximum 4 effets** suggérés :
   ```json
   {
     "effects": ["zoom", "glitch", "cinematic", "slow motion"],
     "transitions": ["fade", "split screen"],
     "color_palette": "#6366F1 / #0EA5E9",
     "overlay_tips": ["CTA animé", "Logo discret"],
     "music_hint": "Beat afro-pop énergique"
   }
   ```

3. **Contrainte importante** : L'IA ne peut suggérer que des effets qui existent dans la liste fixe (`get_effect_definitions()`). Elle choisit intelligemment parmi les 53 effets disponibles selon le contexte.

---

### **3. Normalisation des Noms d'Effets**

**Fichier**: `backend/src/services/effect_preview_service.rs` → `normalize_effect_name()`

**Problème** : L'IA peut générer des noms d'effets avec des variations :
- "effet glitch" → doit être mappé vers "glitch"
- "ralenti sur mouvement" → doit être mappé vers "slow motion"
- "cinéma" → doit être mappé vers "cinema"

**Solution** : Une fonction de normalisation avec un mapping de 34 alias vers les noms canoniques :

```rust
fn normalize_effect_name(effect_name: &str) -> String {
    let mapping = [
        ("effet glitch", "glitch"),
        ("ralenti sur mouvement", "slow motion"),
        ("cinéma", "cinema"),
        // ... 31 autres mappings
    ];
    // Retourne le nom canonique si trouvé, sinon le nom normalisé
}
```

---

### **4. Utilisation des Effets dans le Frontend**

**Fichier**: `mobile/src/components/ProductVideoCreationModal.tsx`

**Étape 3** : Style et effets

1. **Bouton "Effets IA"** : Appelle `handleGenerateStyleSuggestion()`
2. **Appel API** : `mediaApi.generateVideoStyle()` → backend `generate_video_style()`
3. **Affichage** : Les effets suggérés par l'IA sont affichés comme des chips cliquables
4. **Sélection** : L'utilisateur peut sélectionner/désélectionner les effets
5. **Prévisualisation** : `EffectPreviewCarousel` génère des previews pour chaque effet

---

### **5. Application des Effets lors du Montage**

Quand la timeline est générée (étape 4), les effets sélectionnés sont appliqués via FFmpeg :

1. **Récupération de la définition** : Chaque effet est mappé vers sa définition FFmpeg
2. **Application** : Les filtres FFmpeg sont appliqués aux scènes de la timeline
3. **Rendu final** : Remotion/FFmpeg génère la vidéo finale avec les effets

---

## ❓ **Réponses aux Questions**

### **Les effets sont-ils exhaustifs ?**

**Non**, pas au sens où l'IA peut créer n'importe quel effet. Le système fonctionne ainsi :

✅ **Ce qui est exhaustif** :
- Liste de **53 effets prédéfinis** couvrant la plupart des besoins courants
- Support de **variations linguistiques** (français/anglais) via normalisation
- **Mappings d'alias** pour gérer les variations de noms

❌ **Ce qui n'est pas exhaustif** :
- L'IA **ne peut pas inventer** de nouveaux effets
- Elle doit **choisir parmi les 53 effets disponibles**
- Si l'IA suggère un effet inexistant, il sera ignoré (ou normalisé si un alias existe)

### **Tous les effets sont-ils générés par l'IA ?**

**Oui et non** :

✅ **Générés par l'IA** :
- Le **choix des effets** selon le contexte (quel effet utiliser parmi les 53 disponibles)
- La **combinaison d'effets** (max 4 effets à la fois)
- L'**adaptation au produit** (zoom pour produits détaillés, cinematic pour produits premium, etc.)

❌ **Définis manuellement** :
- Les **53 effets eux-mêmes** sont codés en dur avec leurs paramètres FFmpeg
- Les **descriptions** et **filtres FFmpeg** sont statiques
- La **liste complète** est dans `get_effect_definitions()`

---

## 📊 **Résumé du Flux Complet**

```
1. Backend: Liste fixe de 53 effets (get_effect_definitions)
   ↓
2. Frontend: Utilisateur clique "Effets IA" (étape 3)
   ↓
3. Backend: generate_video_style() → IA choisit 4 effets parmi les 53
   ↓
4. Backend: normalize_effect_name() → Normalise les noms (alias → canonique)
   ↓
5. Frontend: Affiche les effets suggérés dans des chips cliquables
   ↓
6. Utilisateur: Sélectionne/désélectionne les effets
   ↓
7. Frontend: EffectPreviewCarousel génère des previews pour chaque effet
   ↓
8. Backend: Lors du montage, récupère les définitions FFmpeg des effets
   ↓
9. Backend: Applique les filtres FFmpeg aux scènes vidéo
   ↓
10. Backend: Génère la vidéo finale avec Remotion/FFmpeg
```

---

## 🔍 **Points Clés Techniques**

1. **Liste fixe mais intelligente** : 53 effets prédéfinis, mais l'IA choisit lesquels utiliser
2. **Normalisation robuste** : 34 mappings d'alias pour gérer les variations
3. **Limite raisonnable** : Maximum 4 effets par vidéo (évite la surcharge visuelle)
4. **Prévisualisation** : Chaque effet peut être prévisualisé avant application
5. **Fallback** : Si un effet suggéré n'existe pas, il est ignoré silencieusement

---

## 💡 **Pour Ajouter un Nouvel Effet**

1. **Ajouter la définition** dans `get_effect_definitions()` avec :
   - Nom canonique (ex: "my_effect")
   - Filtre FFmpeg correspondant
   - Description
2. **Ajouter les alias** dans `normalize_effect_name()` si nécessaire
3. **L'IA pourra ensuite le suggérer** automatiquement si approprié

---

**Conclusion** : Le système n'est pas "exhaustif" dans le sens création infinie, mais il est **intelligent** : l'IA choisit parmi une liste complète d'effets prédéfinis selon le contexte du produit, ce qui garantit la qualité et la cohérence des résultats.


