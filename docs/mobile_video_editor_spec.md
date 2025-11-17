## Spécification – Éditeur vidéo mobile Yukpo (inspiré TikTok / Reels)

### 1. Objectif
Fournir un wizard de montage vidéo **mobile‑first** dans l’app Expo Yukpo, inspiré des interactions de TikTok/Reels, mais adapté aux besoins métier (services, produits, delivery, promos).

### 2. Scénario utilisateur cible
- Un prestataire ouvre Yukpo mobile, sélectionne un service/produit, puis :  
  1. décrit rapidement son message (brief texte/voix),  
  2. choisit quelques médias (photos du service, du lieu, du produit),  
  3. ajuste une timeline de 3–7 scènes,  
  4. prévisualise un montage court,  
  5. publie vers chat, carte produit, shorts (et éventuellement réseaux sociaux).

### 3. Gestes et interactions minimum

#### 3.1 Navigation entre scènes
- Swipe **gauche/droite** pour passer d’une scène à l’autre (S1, S2, S3…).  
- Indicateur visuel en haut (petits segments ou cercles) montrant la scène active.

#### 3.2 Choix du média par scène
- Tap sur une zone “média” pour :  
  - choisir une image de la médiathèque de service,  
  - prendre une photo/vidéo,  
  - ou laisser “Choix automatique Yukpo”.  
- Le choix est stocké dans une structure `TimelineScene[]` et converti en `media_scene_overrides` côté payload backend.

#### 3.3 Ajustement simple de la durée / focus
- Slider ou boutons “+ / –” pour augmenter/diminuer la durée approximative de la scène (par pas de 1–2 secondes).  
- Option simple “Mettre en avant” (focus) qui peut influencer la durée ou les effets pour une scène donnée.

#### 3.4 Prévisualisation
- Bouton “Prévisualiser” :  
  - lance un rendu léger (ou une simulation) de 5–10 secondes,  
  - affiche la vidéo dans un player intégré (plein écran ou modal).  
- Le rendu peut s’appuyer sur le pipeline de preview existant (`/api/studio/.../preview`) ou un endpoint dédié aux produits.

### 4. Modèle de données côté mobile

- `TimelineScene` (frontend) :  
  - `index: number` – index de scène,  
  - `mediaId?: number` – identifiant du média choisi (optionnel),  
  - `durationSeconds?: number` – durée souhaitée (optionnelle, hint pour backend),  
  - `kind?: 'intro' | 'product' | 'testimonial' | 'cta'` – type de scène,  
  - `headline?: string` – texte principal,  
  - `body?: string` – texte secondaire.

- Transformations :  
  - `TimelineScene[]` → `media_scene_overrides` (pour lier scènes ↔ médias).  
  - `TimelineScene[]` → hints pour le backend (`storyboard`, éventuels `style_effects`/`transitions`).

### 5. Intégration backend

- L’éditeur mobile ne modifie pas le pipeline : il **enrichit les payloads** `VideoGenerationPayload` envoyés au backend :  
  - `media_scene_overrides` pour assigner les médias,  
  - éventuellement un `storyboard` texte simple,  
  - flags sur la durée totale souhaitée (15s, 30s, etc.).
- Le backend conserve la responsabilité de :  
  - adapter la durée exacte,  
  - gérer les cas où certaines scènes n’ont pas de média,  
  - choisir les effets/transitions compatibles.

### 6. UX de fallback

- Si `gpu_worker` est désactivé ou que le pipeline vidéo n’est pas disponible :  
  - masquer la timeline avancée,  
  - afficher un message explicite (“Montage vidéo immersif non disponible sur cet environnement”) avec un lien vers l’interface web.

### 7. Roadmap d’implémentation (mobile)

1. Créer un hook `useMobileTimelineEditor` qui gère `TimelineScene[]` + synchronisation avec le service/produit courant.  
2. Intégrer ce hook dans `VideoCreationWizardScreen` avec une UX minimale (scènes en carrousel, choix de média).  
3. Ajouter un bouton “Prévisualiser” qui appelle l’endpoint de preview (ou un endpoint vidéo dédié) et joue le résultat.  
4. Affiner ensuite avec : types de scène, effets, durées plus fines, et intégration avec analytics (temps de tâche utilisateur, taux d’utilisation de l’éditeur).


