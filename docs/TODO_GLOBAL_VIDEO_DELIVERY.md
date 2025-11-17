## 0. Éditeur timeline temps réel (parité UX avec TikTok / Reels / CapCut / Canva)

### 0.1 Vision & cible produit
- **0.1.1 Définir la “vision Yukpo Studio”**  
  - Clarifier l’objectif d’un éditeur vidéo interactif, mobile‑first, orienté créateurs locaux (services, commerces).  
  - Documenter dans ce fichier les axes clés : timeline multi‑scènes, modèles IA, assets produits/services, publication multi‑canaux.
- **0.1.2 Bench technique TikTok / Reels / CapCut / Canva**  
  - Créer `docs/video_editor_benchmark.md` avec :  
    - les interactions instantanées (scrub, cut, trim, zoom, effets, transitions, stickers, audio),  
    - les fonctions avancées (auto‑beat sync, auto‑subtitle, beautify, multi‑pistes),  
    - la liste des fonctionnalités que Yukpo vise en v1, v2, et celles laissées pour plus tard.

### 0.2 Architecture UI timeline web (React)
- **0.2.1 Modèle de données timeline front**  
  - Définir un type `TimelineScene` (index, start, end, type, mediaRef, voiceoverSegment, textOverlays, effects) et, si nécessaire, `TimelineTrack`.  
  - Aligner ce modèle avec `ImmersiveTimeline` côté backend et documenter le mapping dans `docs/video_pipeline_env.md`.  
  - Définir clairement la transformation `TimelineScene[]` → `media_scene_overrides` dans `VideoGenerationPayload`.
- **0.2.2 MVP “scene list” dans `ImmersiveVideoWizard`**  
  - Ajouter un step ou onglet “Timeline” listant les scènes (titre, durée estimée, type).  
  - Permettre pour chaque scène la sélection d’un média (liste `mediaItems`) ou “aucun média forcé”.  
  - Stocker un état `sceneAssignments` et le convertir en `media_scene_overrides` (filtrer les scènes sans média) dans `buildPayload`.  
  - Gérer les validations de base : empêcher l’envoi d’overrides sans `serviceId/productIndex`, fallback propre si liste vide.
- **0.2.3 Timeline visuelle (rail horizontal)**  
  - Créer un composant de “rail de timeline” : segments proportionnels à la durée, avec labels, état “sélectionné”, et curseur de lecture.  
  - Supporter drag & drop d’un thumbnail média sur une scène, sans requête réseau à chaque mouvement (mise à jour locale, envoi des overrides uniquement à la validation).  
  - Ajouter un zoom timeline simple (par ex. vue 10 s / 30 s / totalité) et une navigation fluide.

### 0.3 UX temps réel & performances web
- **0.3.1 Prévisualisation rapide sans rendu complet GPU**  
  - Définir un mode “aperçu rapide” :  
    - soit via un rendu partiel/basse résolution (s’appuyer sur le pipeline `PreviewMonitoring` existant si possible),  
    - soit via une prévisualisation HTML/CSS/Canvas simulant le timing des scènes et des overlays.  
  - Ajouter un bouton “Aperçu rapide” distinct du “Lancer le rendu final” dans `ImmersiveVideoWizard`.  
  - Documenter les limitations (approximation visuelle vs master final) dans `docs/video_pipeline_qa.md`.
- **0.3.2 Réactivité de l’UI**  
  - Vérifier que les interactions de timeline (drag, click, changement de média) sont non bloquantes (aucun appel réseau synchrone).  
  - Mettre en place un système d’auto‑sauvegarde (autosave du storyboard/timeline dans le state ou sur l’API) avec feedback discret.  
  - Profiler les re‑renders (React DevTools) et ajouter `useMemo/useCallback` si nécessaire sur les gros composants de timeline.

### 0.4 Éditeur mobile (Expo) inspiré TikTok / Reels
- **0.4.1 Spécification UX mobile**  
  - Rédiger `docs/mobile_video_editor_spec.md` décrivant les gestes minimum :  
    - swipe gauche/droite pour changer de scène,  
    - long‑press sur une scène pour changer le média,  
    - slider pour ajuster durée de la scène ou volume audio,  
    - bouton “prévisualiser” qui joue une version compressée ou une simulation.  
  - Décider si le rendu reste 100 % server‑side ou si un mini pipeline client (prévisualisation locale) est envisagé à moyen terme.
- **0.4.2 Wizard timeline dans `VideoCreationWizardScreen`**  
  - Introduire une représentation `TimelineScene[]` côté mobile, cohérente avec le web.  
  - Implémenter une vue “une scène par écran” : nom de scène, texte principal, choix de média, éventuellement type de scène.  
  - Construire `media_scene_overrides` à partir des choix mobile et l’envoyer dans le payload de génération vidéo.  
  - Gérer un fallback propre si `gpu_worker` est désactivé côté feature flags mobile.

### 0.5 Fonctions avancées inspirées TikTok / CapCut / Canva
- **0.5.1 Auto‑beat sync & auto‑cut**  
  - Ajouter un service d’analyse audio détectant les beats et changements de rythme (backend ou worker Node).  
  - Définir un algorithme pour suggérer des découpes de scènes alignées sur la musique (distribution des scènes sur les beats).  
  - Exposer côté UI une option “Synchroniser sur la musique” qui ajuste automatiquement la durée et l’ordre des scènes, avec possibilité de retouche manuelle.
- **0.5.2 Effets texte & transitions**  
  - Définir un petit catalogue d’effets texte (fade, slide, zoom, glitch…) et de transitions supportés par Remotion (back).  
  - Ajouter côté front un sélecteur de “pack de styles” (ex. Pulse / Story / Corporate) plutôt qu’un réglage trop granulaire.  
  - Mapper ces choix vers `style_effects`, `style_transitions`, `style_color_palette` dans `VideoGenerationPayload`.
- **0.5.3 Sous‑titres & stickers**  
  - Étendre la génération de sous‑titres auto pour permettre :  
    - l’activation/désactivation par projet,  
    - le choix de style (police, fond, taille) côté front.  
  - Ajouter une première couche de “stickers” simples (icônes/labels) positionnés par scène, stockés dans la timeline et rendus via Remotion.

### 0.6 IA assistive au montage (force Yukpo vs concurrents)
- **0.6.1 Suggestions IA storyboard / scènes**  
  - Utiliser les services IA existants pour générer :  
    - un storyboard (liste de scènes + messages clés),  
    - une proposition auto de médias par scène, basée sur les assets du service et leurs métadonnées.  
  - Afficher ces suggestions dans l’éditeur comme point de départ modifiable (montrer clairement ce qui est “suggéré par l’IA”).
- **0.6.2 Intégration profonde avec les données Yukpo**  
  - Exploiter les métadonnées des services, de la livraison et des promos :  
    - scènes CTA montrant “Livraison express disponible”, zone/cité, SLA, tarifs,  
    - prix/promo dynamiques (mise à jour en fonction des données du service),  
    - variantes possibles par segment (clients fidèles, zone, campagne globale).  
  - Documenter ces règles métiers dans `docs/video_pipeline_env.md` et `docs/delivery_real_time.md` afin de garder le montage aligné avec la réalité terrain.

### 0.7 QA & benchmarks
- **0.7.1 Bench UX interne**  
  - Définir un protocole de test “temps de tâche” dans `docs/video_editor_benchmark.md` :  
    - scénario : “Créer un montage simple à partir d’un service existant”,  
    - mesurer nombre de clics/gestes et temps nécessaire sur TikTok, CapCut, Canva et Yukpo (web + mobile).  
  - Répéter ces tests régulièrement pour suivre l’amélioration de Yukpo par rapport aux références.
- **0.7.2 Tests automatisés web & mobile**  
  - Ajouter des tests Playwright ciblés :  
    - création/modification de timeline, aperçu rapide, lancement d’un rendu, vérification des overrides envoyés.  
  - Ajouter des tests Detox côté mobile :  
    - navigation dans le wizard vidéo, édition de scènes, lancement d’un aperçu.  
  - Coupleur ces tests avec les endpoints `/internal/metrics/pipeline` et `/metrics/delivery` pour vérifier les métriques clés (latence preview/rendu, erreurs).


