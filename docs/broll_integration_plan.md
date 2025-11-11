## Plan Intégration B-roll IA

### Objectif
Insérer automatiquement des séquences vidéo immersives (b-roll) dans les montages pour renforcer l’impact visuel au-delà des photos produit.

### 1. Sources B-roll
- **IA générative** (Runway, Pika, Sora quand disponible).  
- **Banque stock** (Pexels/Storyblocks) via API.  
- **Archive Yukpo** (clips génériques métiers).

### 2. Workflow
1. Analyse IA (script) → identifie segments (intro, démonstration, ambiance).  
2. Sélection/génération b-roll :  
   - IA texte → vidéo (prompt).  
   - Stock : requête cat + localisation.  
3. Téléchargement & normalisation (FFmpeg).  
4. Attribution timeline (scènes de remplacement ou overlay).  
5. Mix color grading + correspondance style.

### 3. Structure JSON
`timeline.scenes[i].broll = { source: "runway", url: "...", blend: "overlay", duration: 4.0 }`

### 4. Api calls
- Wrapper service pour Runway: POST /gen/video.  
- Stock API: GET /search?query=...  
- Limiter coût (limiter à 1–2 b-roll IA + fallback stock).

### 5. Étapes
P0 : intégrer API stock.  
P1 : intégration Runway (avec prompts).  
P2 : gestion fallback (stock si IA échoue).  
P3 : scoring qualité (b-roll vs conversions).

### 6. Checklist
- API keys stock/IA.  
- Stockage clips S3.  
- Cache (éviter régénération excessive).  
- Sélection via heuristique (catégorie, couleur).


