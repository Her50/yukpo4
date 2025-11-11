## Bibliothèque de Templates Vidéo Immersifs

### Vue d’ensemble
Objectif : disposer d’une collection de scènes animées (intro, contenu, CTA) capables de rivaliser avec TikTok/Reels tout en exploitant les données produits Yukpo.

### 1. Types de scènes
| Scène         | Objectif                         | Contenu                                          |
|---------------|----------------------------------|--------------------------------------------------|
| Intro punchy  | Capturer l’attention             | Logo, accroche, animation rapide                 |
| Slide produit | Montrer l’offre (multi-produit)  | Images/b-roll + texte dynamique + prix           |
| Highlight AR  | Mettre en avant un point clé     | Sticker 3D/AR, effet glow                        |
| Transition FX | Fluidifier                       | Effets (slide, zoom, warp, glitch)               |
| CTA final     | Conclure + pousser à l’action    | Bouton animée, QR, code promo                    |

### 2. Stack technique envisagée
- **Remotion (React + Chrome headless)** pour générer des animations complexes côté backend (FFmpeg en sortie).
- **Lottie** pour certaines animations (icônes, éléments AR) réutilisables sur mobile/web.
- **Q libs** :
  - `remotion` (Node)
  - `remotion/three` ou `remotion/shapes` pour effets 3D simples.
  - `ffmpeg` pour combinar tout en pipeline « existante ».

### 3. Paramètres dynamiques
Chaque template doit accepter des props :
- `headline`, `subheadline`, `ctaText`
- `price`, `promo`, `icons`
- `primaryMedia` (image/b-roll), `overlayMedia` (stickers/AR)
- `theme` (couleurs, typographies)

### 4. Fichiers à créer
```
frontend/
  src/video-templates/
    intro/IntroPulse.tsx
    product/ProductShowcase.tsx
    highlight/ARHighlight.tsx
    transition/ZoomWarp.tsx
    cta/GlowCTA.tsx
backend/
  src/services/video_templates/
    renderer.rs (appel Remotion/FFmpeg)
    config.rs
```

### 5. Roadmap F2
1. `IntroPulse` (Remotion) : intro acclérative (headline + dynamique audio).
2. `ProductShowcase` (Remotion) : slide multi-produits, Ken Burns ciblé, badges promo.
3. `ARHighlight` (Remotion + Lottie) : overlay AR (sticker 3D, effet glow).
4. `GlowCTA` (Remotion) : CTA pulsé, gradient animé, icône.
5. Pipeline rendu backend (script Node `npx remotion render`) + tests visuels vs TikTok.

### 6. Dependencies à ajouter
- Node 18+, npm install remotion remotion-three remotion/lottie.
- Tools build : `npx remotion render`.
- Pipeline backend : orchestrateur (Rust) -> script Node (Remotion) -> FFmpeg.

