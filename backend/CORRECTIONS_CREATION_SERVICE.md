# Corrections - Problème de création de service (JSON trop volumineux)

**Date** : 2025-11-24
**Problème** : Erreur 500 lors de la création de service - "index row requires 3430168 bytes, maximum size is 8191"

## Analyse du problème

### Problème principal
- Le JSON contenait encore **3,429,667 bytes** après nettoyage
- La limite PostgreSQL pour les index est de **8,191 bytes**
- Des médias base64 n'étaient pas complètement supprimés du JSON

### Problèmes secondaires
1. Erreur Google Places API : champ `servesCuisine` invalide
2. Nettoyage insuffisant des médias base64 récursifs
3. Pas de validation de taille avant insertion

## Corrections apportées

### 1. Amélioration de la fonction `clean_media_recursive_final`

**Fichier** : `backend/src/services/creer_service.rs`

**Améliorations** :
- ✅ Ajout d'une fonction `is_base64_media()` pour détecter les strings base64 (commençant par `data:image/`, `data:video/`, `data:audio/`, etc.)
- ✅ Détection de tous les types de médias : `media`, `image`, `video`, `audio`, `document`, `file`, `excel`, `pdf`
- ✅ Nettoyage récursif amélioré dans tous les objets imbriqués
- ✅ Détection et suppression des strings base64 longues (>1000 caractères)
- ✅ Nettoyage des tableaux contenant du base64
- ✅ Suppression des objets médias complets au lieu de seulement les valeurs

**Changements clés** :
```rust
// Nouvelle détection des strings base64
fn is_base64_media(s: &str) -> bool {
    (s.starts_with("data:image/") || 
     s.starts_with("data:video/") || 
     s.starts_with("data:audio/") ||
     s.starts_with("data:application/")) && 
    s.len() > 1000
}

// Détection de tous les types de médias
matches!(s, "media" | "image" | "video" | "audio" | "document" | "file" | "excel" | "pdf")
```

### 2. Correction de l'erreur Google Places API

**Fichier** : `backend/src/services/google_places_service.rs`

**Correction** :
- ✅ Retiré le champ `servesCuisine` qui n'existe pas dans l'API Google Places
- ✅ Champ invalide causait une erreur HTTP 400

**Avant** :
```rust
"id,displayName,...,photos,servesCuisine"
```

**Après** :
```rust
"id,displayName,...,photos"
```

### 3. Validation de taille avant insertion

**Fichier** : `backend/src/services/creer_service.rs`

**Ajout** :
- ✅ Vérification de la taille du JSON après nettoyage
- ✅ Rejet explicite si le JSON dépasse 8000 bytes (limite PostgreSQL: 8191 bytes)
- ✅ Message d'erreur clair pour l'utilisateur

**Code ajouté** :
```rust
// ✅ CRITIQUE: Vérifier que le JSON n'est pas trop volumineux pour PostgreSQL
if json_size > 8000 {
    log::error!(
        "[creer_service] ❌ JSON trop volumineux après nettoyage ({} bytes). Limite PostgreSQL: 8191 bytes.",
        json_size
    );
    return Err(AppError::Internal(format!(
        "Les données du service sont trop volumineuses ({} bytes). Veuillez retirer certaines images ou fichiers volumineux et réessayer.",
        json_size
    )));
}
```

## Résultat attendu

### Avant
- ❌ JSON de 3,429,667 bytes
- ❌ Erreur PostgreSQL : "index row requires 3430168 bytes, maximum size is 8191"
- ❌ Erreur Google Places API (champ invalide)

### Après
- ✅ Médias base64 complètement supprimés du JSON
- ✅ JSON < 8000 bytes (sous la limite PostgreSQL)
- ✅ Erreur claire si le JSON est encore trop volumineux
- ✅ Google Places API fonctionne correctement

## Clés de champs nettoyées

Les clés suivantes sont maintenant supprimées :
- `base64_image`
- `audio_base64`
- `video_base64`
- `doc_base64`
- `excel_base64`
- `images_base64`
- `image_base64`
- `pdf_base64`

## Objets nettoyés

Les objets avec `type_donnee` égal à :
- `media`
- `image`
- `video`
- `audio`
- `document`
- `file`
- `excel`
- `pdf`

Sont complètement supprimés du JSON avant insertion.

## Notes importantes

1. Les médias sont supprimés du JSON mais doivent être sauvegardés séparément dans la table `media`
2. La limite de 8000 bytes laisse une marge de sécurité par rapport à la limite PostgreSQL (8191 bytes)
3. Le nettoyage est effectué récursivement dans tous les objets imbriqués
4. Les strings base64 sont détectées même si elles ne sont pas dans des objets médias

## Tests recommandés

1. Tester la création de service avec des images base64
2. Vérifier que les médias sont bien supprimés du JSON
3. Vérifier que le JSON final est < 8000 bytes
4. Tester avec différents types de médias (images, vidéos, documents)
5. Vérifier que l'erreur est claire si le JSON est encore trop volumineux

