## Orchestrateur Vidéo Immersif

### Objet
Superviser toute la chaîne immersive : IA brief → timeline → rendu (templates + audio + b-roll) → analytics.

### 1. Fonctionnalités
- Sélection workflow (classique vs immersif).  
- Gestion séquences : intro, scène produit, b-roll, CTA.  
- Fallbacks (si b-roll IA échoue → stock, si voix premium échoue → fallback).  
- Monitorer coûts/durée.  
- Mise à jour analytics (score qualité, usage IA, coûts).

### 2. Architecture
```
request -> orchestrator.rs
    -> ia_service.generate_immersive_timeline()
    -> template_engine.render_scene(format, theme)
    -> audio_pipeline.mix()
    -> video_renderer.combine()
    -> analytics.log()
```

### 3. Étapes de dev
1. `orchestrator.rs` : struct `ImmersiveOrchestrator` + configuration.  
2. Définir `ImmersiveTimeline` (JSON struct).  
3. Implémenter appels vers modules :  
   - `ia_service` (prompt timeline)  
   - `broll_service` (IA/stock)  
   - `template_renderer` (Remotion/FFmpeg)  
   - `audio_pipeline`  
4. Gestion fallback + retours analytics.  

### 4. Tracking
- Stocker coût estimation (tokens GPT, IA vidéo).  
- Score qualité + event `immersive_video_generated`.  
- Rapports (weekly report).

### 5. Roadmap F5
- P0 orchestrateur struct + toggles.  
- P1 intégration IA timeline et template builder.  
- P2 fallback + analytics.  
- P3 tests end-to-end (script CLI).


