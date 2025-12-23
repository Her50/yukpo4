# 🔍 Diagnostic Erreur 500 - Génération Vidéo

## Problèmes Identifiés

### 1. **Collecte des Médias**
- **Problème** : Les fichiers médias peuvent être introuvables sur le disque (fichiers supprimés, chemins incorrects, fichiers S3 non téléchargés)
- **Impact** : La fonction `gather_media_sources` retourne une liste vide, causant une erreur 500
- **Solution** : 
  - Ajout de logs détaillés pour chaque média collecté
  - Gestion des URLs distantes (S3/CDN) sans erreur
  - Validation que les fichiers ne sont pas vides

### 2. **Génération FFmpeg**
- **Problème** : FFmpeg peut échouer silencieusement ou avec des messages d'erreur peu clairs
- **Impact** : Les slides ne sont pas créés, causant une erreur 500
- **Solution** :
  - Validation préventive que le fichier source existe avant d'appeler FFmpeg
  - Logs détaillés de la commande FFmpeg exécutée
  - Messages d'erreur plus clairs avec le code de sortie et les détails

### 3. **Création Dossier Temporaire**
- **Problème** : Échec de création du dossier temporaire peut passer inaperçu
- **Impact** : Tous les fichiers temporaires ne peuvent pas être créés
- **Solution** : Logs détaillés avec le chemin complet et vérification des permissions

### 4. **Messages d'Erreur Génériques**
- **Problème** : Beaucoup d'erreurs retournent `AppError::Internal` avec des messages génériques
- **Impact** : Difficile de diagnostiquer la cause exacte de l'erreur 500
- **Solution** : Messages d'erreur détaillés avec contexte (service_id, product_index, chemins de fichiers, etc.)

## Corrections Appliquées

### ✅ Amélioration de `gather_media_sources`
- Logs détaillés avant et après la collecte
- Gestion d'erreur améliorée avec contexte

### ✅ Amélioration de `row_to_media_source`
- Support des URLs distantes (S3/CDN)
- Validation que les fichiers ne sont pas vides
- Logs détaillés pour chaque média vérifié

### ✅ Amélioration de la génération des slides
- Validation préventive que le fichier source existe
- Logs détaillés pour chaque slide généré
- Messages d'erreur FFmpeg améliorés avec la commande complète

### ✅ Amélioration de la création du dossier session
- Logs détaillés avec le chemin complet
- Messages d'erreur avec instructions pour résoudre les problèmes de permissions

## Points de Défaillance Restants à Surveiller

1. **FFmpeg non installé** : Vérifier que FFmpeg est dans le PATH
2. **Fichiers médias manquants** : Vérifier que les fichiers existent dans la médiathèque
3. **Permissions insuffisantes** : Vérifier les permissions d'écriture sur le répertoire de stockage
4. **Espace disque insuffisant** : Surveiller l'espace disque disponible
5. **Génération images IA** : Si activée, peut échouer si l'API IA n'est pas disponible

## Comment Diagnostiquer une Erreur 500

1. **Vérifier les logs backend** pour les messages `[VideoGeneration]`
2. **Chercher les messages d'erreur** avec `❌`
3. **Vérifier les chemins de fichiers** dans les logs
4. **Vérifier les commandes FFmpeg** exécutées
5. **Vérifier que FFmpeg est installé** : `ffmpeg -version`

## Prochaines Étapes Recommandées

1. Ajouter un endpoint de diagnostic pour vérifier les prérequis (FFmpeg, permissions, etc.)
2. Ajouter des métriques pour suivre les taux de succès/échec
3. Implémenter un système de retry pour les erreurs temporaires
4. Ajouter des tests unitaires pour les fonctions critiques


