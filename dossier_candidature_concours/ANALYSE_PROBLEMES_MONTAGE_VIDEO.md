# Analyse des Problèmes de Montage Vidéo - Logs Backend

## Date d'analyse : 2025-11-28

### Résumé exécutif

L'analyse des logs backend révèle plusieurs problèmes critiques dans le processus de montage vidéo, principalement liés à l'absence de médias/images et à des échecs de validation.

---

## Problèmes identifiés

### 1. 🚨 PROBLÈME CRITIQUE : Absence d'images pour la génération vidéo

**Localisation** : Service ID 156, Product Index 0, User ID 17

**Symptômes** :
- Validation préventive échouée
- Aucune image trouvée dans aucune source vérifiée
- Erreur HTTP 400 renvoyée au client mobile

**Logs pertinents** (lignes 452, 465) :
```
[VideoGeneration] ❌ Validation échouée pour service_id=156, product_index=0: 
Impossible de générer la vidéo : Aucune image trouvée.

Sources vérifiées : 
  • galerie produit (0 trouvées)
  • médiathèque service (0 trouvées)
  • assets publicité (0 trouvés)

Solutions possibles :
  • Ajouter des images dans la médiathèque du service
  • Ajouter des images au produit spécifique (index 0)
  • Activer 'auto_generate_images: true' pour générer automatiquement des images avec l'IA
```

**Requêtes SQL vérifiées** :
```sql
-- Vérification images produit
SELECT COUNT(*) FROM media 
WHERE service_id = 156 
AND (product_index = 0 OR (product_index IS NULL AND type = 'image'))
-- Résultat : 0

-- Vérification médiathèque service
SELECT COUNT(*) FROM media 
WHERE service_id = 156 
AND (product_index IS NULL OR product_index != 0)
-- Résultat : 0

-- Vérification assets publicité
SELECT COUNT(*) FROM media 
WHERE service_id = 156 
AND (
  media_type = 'banner' OR 
  media_type = 'logo' OR 
  path ILIKE '%publicite%' OR 
  path ILIKE '%banner%'
)
-- Résultat : 0
```

---

### 2. ⚠️ ERREUR 500 : Génération de style IA échouée

**Localisation** : Ligne 399-401

**Symptômes** :
- Erreur 500 lors de l'appel à l'API de génération de style vidéo
- Coach IA incapable de générer un style après 3 tentatives
- Erreur non catchée côté backend

**Logs pertinents** :
```
📱[MOBILE] [ERROR] ProductVideoCreationModal | User:17 | Device:android/34 
[ProductVideoCreationModal] Style IA impossible: {}

📱[MOBILE] [WARN] ProductVideoCreationModal | User:17 | Device:android/34 
[ProductVideoCreationModal] Coach IA: style indisponible après 3 tentatives
```

**Stack trace** :
```
Error: Erreur 500
at ?anon_0_ (address at index.android.bundle:1:5025694)
at next (native)
at asyncGeneratorStep (address at index.android.bundle:1:282386)
...
```

---

### 3. ⚠️ ERREUR 400 : Génération vidéo échouée

**Localisation** : Lignes 476-477, 565-566

**Symptômes** :
- Erreur 400 lors de la tentative de génération vidéo
- Plusieurs tentatives échouées

**Logs pertinents** :
```
📱[MOBILE] [ERROR] ProductVideoCreationModal | User:17 | Device:android/34 
[ProductVideoCreationModal] Erreur génération vidéo: {}
Data: {"message":"Erreur 400","name":"Error"}
```

---

### 4. ⚠️ Échecs répétés du Coach IA

**Localisation** : Lignes 396, 473, 998

**Symptômes** :
- Coach IA échoue après 3 tentatives pour :
  - Génération de brief vidéo (lignes 242, 998)
  - Génération de style vidéo (ligne 396)
  - Génération de plan de distribution (ligne 473)

**Logs pertinents** :
```
📱[MOBILE] [WARN] ProductVideoCreationModal | User:17 | Device:android/34 
[ProductVideoCreationModal] Coach IA: brief indisponible après 3 tentatives

📱[MOBILE] [WARN] ProductVideoCreationModal | User:17 | Device:android/34 
[ProductVideoCreationModal] Coach IA: style indisponible après 3 tentatives

📱[MOBILE] [WARN] ProductVideoCreationModal | User:17 | Device:android/34 
[ProductVideoCreationModal] Coach IA: plan indisponible après 3 tentatives
```

**Note** : Les appels à `/api/media/generate-video-brief` semblent réussir côté backend (lignes 143, 189, 230) mais échouent côté mobile après timeout ou erreur de parsing.

---

### 5. ⚠️ Absence de médias dans la médiathèque

**Localisation** : Lignes 114-115, 674, 831-832, 839-840

**Symptômes** :
- Aucun média trouvé pour le service 156
- Requêtes SQL retournent 0 résultats

**Requêtes vérifiées** :
```sql
-- Récupération médias produit
SELECT id, service_id, product_id, product_index, type as media_type, path, ...
FROM media
WHERE service_id = 156 AND product_index = 0
-- Résultat : 0 médias trouvés

-- Récupération médias service
SELECT id, service_id, media.type, path, uploaded_at 
FROM media 
WHERE service_id = 156 
ORDER BY uploaded_at DESC NULLS LAST
-- Résultat : 0 médias trouvés
```

---

### 6. ℹ️ Requêtes API réussies mais avec problèmes

**Observation** : Les appels à `/api/media/generate-video-brief` réussissent côté backend :
- Ligne 143 : Succès avec 797 tokens
- Ligne 189 : Succès avec 799 tokens  
- Ligne 230 : Succès avec 756 tokens
- Ligne 897 : Succès avec 784 tokens
- Ligne 919 : Succès avec 836 tokens
- Ligne 981 : Succès avec 860 tokens

**Mais** : Le client mobile signale des échecs après 3 tentatives, suggérant :
- Problème de timeout côté mobile
- Problème de parsing de la réponse
- Problème de format de réponse

---

## Plan de correction

### Phase 1 : Corrections critiques (Priorité HAUTE)

#### 1.1 Gestion de l'absence d'images

**Problème** : Aucune validation préalable ou message clair pour l'utilisateur

**Actions** :
1. ✅ **Améliorer la validation préventive** (`video_generation_service.rs`)
   - Vérifier l'existence d'images AVANT de permettre la génération
   - Retourner un message d'erreur clair et actionnable

2. ✅ **Implémenter la génération automatique d'images** 
   - Activer `auto_generate_images: true` par défaut pour les nouveaux produits
   - Créer un endpoint pour déclencher la génération d'images IA

3. ✅ **Améliorer le feedback utilisateur**
   - Message d'erreur plus explicite côté mobile
   - Bouton "Générer des images" directement dans l'interface

**Fichiers à modifier** :
- `backend/src/services/video_generation_service.rs` (lignes 366-501)
- `mobile/src/components/ProductVideoCreationModal.tsx`

---

#### 1.2 Correction de l'erreur 500 lors de la génération de style

**Problème** : Erreur 500 non catchée dans l'endpoint de génération de style

**Actions** :
1. ✅ **Identifier la cause exacte de l'erreur 500**
   - Vérifier les logs backend complets pour cet endpoint
   - Ajouter un logging plus détaillé

2. ✅ **Ajouter une gestion d'erreur robuste**
   - Try-catch autour de l'appel IA
   - Fallback vers un style par défaut si l'IA échoue

3. ✅ **Retourner des erreurs structurées**
   - Format JSON cohérent pour toutes les erreurs
   - Codes d'erreur spécifiques

**Fichiers à modifier** :
- `backend/src/controllers/media_controller.rs` (endpoint generate-video-style)
- Vérifier `backend/src/services/app_ia.rs` pour les erreurs de parsing

---

#### 1.3 Amélioration de la gestion des erreurs 400

**Problème** : Erreur 400 générique sans contexte

**Actions** :
1. ✅ **Améliorer les messages d'erreur**
   - Inclure le code d'erreur spécifique
   - Ajouter des détails sur la cause de l'échec

2. ✅ **Valider les données d'entrée plus tôt**
   - Validation côté client avant l'appel API
   - Validation côté serveur avec messages clairs

**Fichiers à modifier** :
- `backend/src/controllers/product_video_controller.rs` (endpoint generate-video)
- `mobile/src/components/ProductVideoCreationModal.tsx`

---

### Phase 2 : Améliorations (Priorité MOYENNE)

#### 2.1 Amélioration du système de retry du Coach IA

**Problème** : 3 tentatives qui échouent systématiquement

**Actions** :
1. ✅ **Analyser pourquoi les retries échouent**
   - Vérifier si c'est un problème de timeout
   - Vérifier si c'est un problème de parsing de réponse

2. ✅ **Implémenter un système de retry intelligent**
   - Exponential backoff
   - Détection du type d'erreur avant retry
   - Limite de retries plus claire

3. ✅ **Ajouter un fallback**
   - Valeurs par défaut si l'IA échoue
   - Cache des dernières réponses réussies

**Fichiers à modifier** :
- `mobile/src/components/ProductVideoCreationModal.tsx` (logique de retry)

---

#### 2.2 Amélioration de la gestion des timeouts

**Problème** : Timeouts possibles lors des appels IA (8-13 secondes observés)

**Actions** :
1. ✅ **Ajuster les timeouts**
   - Augmenter le timeout côté client pour les appels IA longs
   - Implémenter un timeout progressif

2. ✅ **Ajouter un indicateur de progression**
   - Loading state clair pour l'utilisateur
   - Message "Génération en cours, veuillez patienter..."

**Fichiers à modifier** :
- `mobile/src/components/ProductVideoCreationModal.tsx`
- Configuration des timeouts dans les appels API

---

#### 2.3 Amélioration du système de médiathèque

**Problème** : Absence de médias, pas de guide pour l'utilisateur

**Actions** :
1. ✅ **Créer un workflow d'upload simplifié**
   - Guide pas à pas pour ajouter des images
   - Drag & drop d'images

2. ✅ **Implémenter la génération d'images IA**
   - Endpoint pour générer des images depuis la description du produit
   - Intégration dans le flow de création vidéo

**Fichiers à créer/modifier** :
- `backend/src/services/image_generation_service.rs` (nouveau)
- `mobile/src/components/ImageUploadWizard.tsx` (nouveau)
- `mobile/src/components/ProductVideoCreationModal.tsx` (intégration)

---

### Phase 3 : Optimisations (Priorité BASSE)

#### 3.1 Optimisation des requêtes SQL

**Problème** : Requêtes répétées pour vérifier l'existence de médias

**Actions** :
1. ✅ **Cache des résultats de vérification**
   - Cache Redis pour les états de médiathèque
   - Invalidation lors de l'upload de nouveaux médias

**Fichiers à modifier** :
- `backend/src/services/video_generation_service.rs`
- `backend/src/utils/cache_service.rs`

---

#### 3.2 Amélioration du logging

**Problème** : Logs parfois incomplets pour le debugging

**Actions** :
1. ✅ **Logging structuré**
   - Contexte complet dans chaque log
   - Correlation IDs pour tracer les requêtes

**Fichiers à modifier** :
- Tous les fichiers de service et contrôleurs concernés

---

## Métriques et monitoring

### Indicateurs à surveiller

1. **Taux de succès génération vidéo**
   - Cible : > 80%
   - Actuel : 0% (aucune génération réussie dans les logs analysés)

2. **Taux d'échec validation prérequis**
   - Cible : < 10%
   - Actuel : 100% (toutes les tentatives échouent faute d'images)

3. **Temps de réponse API IA**
   - Cible : < 5s (p95)
   - Actuel : 8-13s observés

4. **Taux d'échec Coach IA**
   - Cible : < 5% après 3 tentatives
   - Actuel : 100% dans les logs analysés

---

## Prochaines étapes immédiates

1. **URGENT** : Créer un message d'erreur clair pour guider l'utilisateur vers l'upload d'images
2. **URGENT** : Corriger l'erreur 500 dans l'endpoint de génération de style
3. **IMPORTANT** : Implémenter la génération automatique d'images IA
4. **IMPORTANT** : Améliorer la gestion des timeouts côté mobile
5. **MOYEN** : Optimiser le système de retry du Coach IA

---

## Notes techniques

### Architecture observée

- **Backend** : Rust/Axum avec services IA (OpenAI GPT-4)
- **Frontend Mobile** : React Native
- **Base de données** : PostgreSQL avec table `media` pour stocker les médias
- **Workflow** : 
  1. Sélection produit → 2. Génération brief → 3. Génération style → 4. Génération plan → 5. Génération vidéo

### Points d'attention

- Les requêtes IA prennent 8-13 secondes (normal pour GPT-4)
- Le système vérifie 3 sources pour les images (produit, service, publicité)
- La validation préventive bloque la génération si aucune image n'est trouvée
- Les erreurs ne sont pas toujours propagées correctement au client mobile

---

## Conclusion

Les problèmes principaux sont :
1. **Absence d'images** : Blocage systématique de la génération vidéo
2. **Erreurs 500** : Problèmes non catchés dans la génération de style
3. **Timeouts/Retries** : Coach IA qui échoue après plusieurs tentatives

La correction de ces problèmes devrait considérablement améliorer le taux de succès de la génération vidéo.

