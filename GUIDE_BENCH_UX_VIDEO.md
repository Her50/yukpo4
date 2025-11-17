## Bench UX Yukpo Vidéo – Bloc 0

### 1. Objectif

- **But**: comparer Yukpo (web + mobile) à TikTok / CapCut / Canva sur des montages promos courts (3–5 scènes), et itérer jusqu’à ce que Yukpo soit **au moins aussi rapide** et **plus intelligent grâce aux données métier**.
- **Angle**: mesurer la **latence perçue**, le **nombre de gestes** et la **qualité de la preview courte** plutôt que les seules fonctionnalités.

### 2. Scénarios de test

- **Scénario A – Promo livraison 3 scènes**
  - Contexte: service avec option de livraison, SLA connu.
  - Structure cible:
    - S1: intro hero service.
    - S2: bénéfice livraison (rapidité / fiabilité).
    - S3: CTA avec sticker “livraison express”.

- **Scénario B – Témoignage client 5 scènes**
  - Contexte: service avec preuve sociale forte (reviews, métriques).
  - Structure:
    - S1: intro / contexte.
    - S2: problème.
    - S3: solution Yukpo.
    - S4: métrique / témoignage.
    - S5: CTA.

- **Scénario C – Promo prix barré 3–4 scènes**
  - Contexte: produit avec réduction temporaire.
  - Structure:
    - S1: produit / situation.
    - S2: bénéfice.
    - S3: prix barré / sticker promo.
    - S4 (facultative): CTA “Réserver / Commander”.

### 3. Plateformes à comparer

- TikTok (éditeur intégré, si possible via “promote” / creation ads simple).
- CapCut (mobile).
- Canva (web ou mobile).
- Yukpo:
  - **Web**: `ImmersiveVideoWizard`.
  - **Mobile**: `VideoCreationWizardScreen`.

### 4. Métriques à capturer

#### 4.1 Temps de tâche

Pour chaque scénario et plateforme:

- **T1 – Temps jusqu’à storyboard/timeline prête**
  - Temps entre “j’ouvre l’éditeur” et “j’ai une timeline cohérente avec 3–5 scènes”:
    - Sur Yukpo: ouverture wizard → storyboard IA généré et appliqué ou timeline manuelle prête.

- **T2 – Temps jusqu’à preview courte regardable**
  - Temps entre “timeline prête” et “je regarde une preview courte fluide une fois”.
  - Sur Yukpo:
    - Web: clic sur bouton “Prévisualisation rapide” → ouverture du player (URL short preview).
    - Mobile: tap sur bouton “Prévisualiser 3s” → ouverture de la vidéo (via `Linking.openURL`).

- **T3 – Temps total “de zéro à preview”**
  - T0: ouverture de l’éditeur (ou app).
  - Tfin: moment où tu as vu la preview courte complète une fois.

#### 4.2 Nombre de gestes

- **G1 – Construction de la timeline**
  - Nombre de taps/clics:
    - pour choisir un template ou équivalent.
    - pour ajouter/retirer des scènes.
    - pour assigner des médias à chaque scène.

- **G2 – Lancement de la preview courte**
  - Nombre de gestes à partir du moment où la timeline est jugée “OK”:
    - Yukpo web/mobile: idéalement un seul clic/tap depuis la step 3.

#### 4.3 Latence perçue et feedback

- **L1 – Latence prévisualisation courte**
  - Mesurée par:
    - Yukpo: événements `preview_short_click` → `preview_short_completed` (`durationMs` dans `uxMetrics`).
    - Autres plateformes: chronomètre manuel sur enregistrement vidéo.

- **L2 – Feedback visuel**
  - Nombre de fois où l’interface reste figée > 500 ms sans loader / animation / changement de state.
  - Noter les moments désagréables: “je ne sais pas si ça pense ou si c’est bloqué”.

#### 4.4 Friction et erreurs

- Nombre de retours en arrière, écrans confus, popups d’erreur, etc.
- Perception subjective notée immédiatement après chaque run:
  - “Très fluide”, “OK”, “hésitant”, “frustrant”.

### 5. Instrumentation Yukpo (web + mobile)

#### 5.1 Web – `ImmersiveVideoWizard`

- **Module**: `frontend/src/services/uxMetrics.ts`.
- **Événements clés**:
  - `wizard_open` (avec `serviceId`, `productIndex`, `step`).
  - `storyboard_generate_click` / `storyboard_generate_completed` / `storyboard_generate_failed`.
  - `storyboard_apply`.
  - `preview_short_click` / `preview_short_completed` / `preview_short_failed`.
  - `preview_short_prewarm_start` / `preview_short_prewarm_completed` / `preview_short_prewarm_failed`.
- **Utilisation pendant le bench**:
  - Dans la console: `window.__YUKPO_UX_DEBUG__ = true;` pour loguer tous les events.
  - À la fin d’un scénario: récupérer `getUxMetricsBuffer()` et l’exporter (JSON) pour analyse.

#### 5.2 Mobile – `VideoCreationWizardScreen`

- **Module**: `mobile/src/services/uxMetrics.ts`.
- **Événements clés**:
  - `wizard_open`.
  - `storyboard_generate_*`.
  - `scene_chip_tap`.
  - `media_assignment_change`.
  - `preview_short_click` / `preview_short_completed` / `preview_short_failed`.
- **Utilisation pendant le bench**:
  - Observer les logs `[UxMetrics/mobile]` dans la console Metro / Flipper.
  - Sauvegarder les logs pour comparaison (durées, nombre d’événements).

### 6. Protocole de bench

1. **Préparation**:
   - Choisir un service Yukpo réaliste avec promos et livraison pour les scénarios A/B/C.
   - Noter le device utilisé (mobile / desktop, OS, réseau).

2. **Pour chaque scénario**:
   - Rejouer le scénario complet sur chaque plateforme (TikTok, CapCut, Canva, Yukpo web, Yukpo mobile).
   - Enregistrer l’écran pour pouvoir recompter gestes et temps.
   - Sur Yukpo:
     - Récupérer les événements UX (`uxMetrics`) côté web et mobile.

3. **Analyse**:
   - Comparer:
     - T1/T2/T3 (temps en secondes).
     - G1/G2 (gestes).
     - L1 (latence preview courte).
   - Noter où Yukpo est déjà meilleur, et où TikTok/CapCut/Canva gagnent encore.

4. **Boucle d’amélioration**:
   - Pour chaque point où Yukpo est moins bon:
     - Se demander explicitement:
       - “Combien de taps ici sur TikTok/CapCut ?”
       - “Est-ce que je peux gagner 1 tap ou 1 seconde en utilisant storyboard IA, auto‑assignation ou stickers métier ?”
   - Implémenter les micro‑optimisations (local‑first, presets, animations) et **refaire le bench** sur les scénarios A/B/C.

### 7. Critères de succès

- **Temps**:
  - T3 Yukpo (web ou mobile) ≤ T3 CapCut/TikTok pour les scénarios A/B/C.

- **Gestes**:
  - G1+G2 Yukpo ≤ G1+G2 CapCut/Canva, idéalement 10–20 % de gestes en moins.

- **Preview courte**:
  - Latence moyenne `preview_short_*` < 2 s en mode préchauffé, < 3 s à froid, avec feedback instantané.

- **Intelligence métier**:
  - Les overlays/stickers promo/livraison/prix apparaissent automatiquement au bon moment, réduisant le besoin de micro‑édition manuelle par rapport aux concurrents.



