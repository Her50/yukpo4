# 🔧 Solutions - Diagnostic Médias et Matching Google Places

**Date**: 2025-11-27  
**Contexte**: Solutions pour les problèmes identifiés dans le diagnostic

---

## 📋 Table des matières

1. [Problème de Sauvegarde des Médias](#1-problème-de-sauvegarde-des-médias)
2. [Amélioration du Matching Google Places](#2-amélioration-du-matching-google-places)
3. [Solutions pour Autres Constats](#3-solutions-pour-autres-constats)

---

## 1. Problème de Sauvegarde des Médias

### 1.1 Analyse du Code de Sauvegarde

**Fichier**: `backend/src/services/creer_service.rs`

**Processus actuel**:

1. **Extraction des médias** (lignes 1470-1590):
   - Les médias sont extraits de `data_processed` (qui conserve les données base64)
   - Recherche dans plusieurs champs : `base64_image`, `images`, `images_base64`, `image_base64`
   - Pour les produits : `produits[].images`, `produits[].images_base64`

2. **Validation** (fonction `is_probable_base64`, ligne 86):
   ```rust
   fn is_probable_base64(data: &str) -> bool {
       if data.starts_with("data:") {
           return true;
       }
       if data.len() < 80 {
           return false;
       }
       data.chars()
           .all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '/' | '=' | '\n' | '\r'))
   }
   ```

3. **Sauvegarde** (fonction `persist_base64_media`, ligne 107):
   - Décodage base64
   - Création du répertoire `uploads/services/{service_id}/{subdir}`
   - Sauvegarde du fichier
   - Insertion dans la table `media`

### 1.2 Problèmes Identifiés

#### ❌ **Problème 1: Format des Médias Non Reconnu**

**Symptôme**: Les médias ne sont pas sauvegardés car `is_probable_base64` retourne `false`

**Causes possibles**:
- Les médias sont envoyés en format URL (commençant par `http://` ou `https://`)
- Les médias sont dans un format base64 non standard (sans préfixe `data:`)
- Les médias sont trop courts (< 80 caractères)

**Solution**:
```rust
// Améliorer la détection des formats
fn is_probable_base64(data: &str) -> bool {
    // 1. Format data: URI
    if data.starts_with("data:") {
        return true;
    }
    // 2. URL HTTP/HTTPS (à télécharger, pas base64)
    if data.starts_with("http://") || data.starts_with("https://") {
        return false; // Ce sont des URLs, pas du base64
    }
    // 3. Base64 pur (sans préfixe)
    if data.len() < 80 {
        return false;
    }
    // Vérifier que c'est bien du base64 valide
    data.chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '/' | '=' | '\n' | '\r'))
}
```

#### ❌ **Problème 2: Médias Non Présents dans `data_processed`**

**Symptôme**: Les logs montrent `⚠️ Aucun fichier média sauvegardé pour le service X`

**Causes possibles**:
- Le frontend n'envoie pas les médias dans le JSON
- Les médias sont dans un champ non reconnu
- Les médias sont nettoyés avant d'arriver à `data_processed`

**Solution**: Les logs détaillés ajoutés permettront de diagnostiquer précisément

#### ❌ **Problème 3: Erreur lors de la Sauvegarde**

**Symptôme**: Erreur dans `persist_base64_media` ou lors de l'insertion en DB

**Causes possibles**:
- Répertoire non créé (permissions)
- Base64 invalide
- Transaction DB échouée

**Solution**: Vérifier les logs d'erreur détaillés

### 1.3 Solutions Proposées

#### ✅ **Solution 1: Améliorer la Détection des Formats**

Modifier `is_probable_base64` pour mieux détecter les différents formats :

```rust
fn is_probable_base64(data: &str) -> bool {
    // Format data: URI (data:image/png;base64,...)
    if data.starts_with("data:") {
        return true;
    }
    // URL HTTP/HTTPS - ne pas traiter comme base64
    if data.starts_with("http://") || data.starts_with("https://") {
        return false;
    }
    // Base64 pur (minimum 80 caractères pour être valide)
    if data.len() < 80 {
        return false;
    }
    // Vérifier que tous les caractères sont valides pour base64
    let valid_chars = data.chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '/' | '=' | '\n' | '\r' | ' '));
    
    // Vérifier qu'il y a au moins quelques caractères base64 typiques
    let has_base64_chars = data.contains('+') || data.contains('/') || data.contains('=');
    
    valid_chars && has_base64_chars
}
```

#### ✅ **Solution 2: Gérer les URLs d'Images**

Si le frontend envoie des URLs au lieu de base64, ajouter une fonction pour télécharger et sauvegarder :

```rust
async fn download_and_save_image(
    storage_root: &Path,
    service_id: i32,
    image_url: &str,
) -> AppResult<StoredMedia> {
    // Télécharger l'image depuis l'URL
    let response = reqwest::get(image_url).await
        .map_err(|e| AppError::BadRequest(format!("Erreur téléchargement image: {}", e)))?;
    
    let bytes = response.bytes().await
        .map_err(|e| AppError::BadRequest(format!("Erreur lecture image: {}", e)))?;
    
    // Déterminer l'extension depuis le Content-Type ou l'URL
    let extension = infer_extension_from_url(image_url);
    
    // Sauvegarder comme un fichier normal
    let service_dir = storage_root
        .join("services")
        .join(service_id.to_string())
        .join("images");
    fs::create_dir_all(&service_dir).await?;
    
    let file_name = format!("image_{}.{}", Uuid::new_v4(), extension);
    let disk_path = service_dir.join(&file_name);
    fs::write(&disk_path, &bytes).await?;
    
    let relative_path = Path::new("uploads")
        .join("services")
        .join(service_id.to_string())
        .join("images")
        .join(&file_name);
    let path_str = relative_path.to_string_lossy().replace('\\', "/");
    
    Ok(StoredMedia {
        path: path_str,
        bytes: bytes.to_vec(),
    })
}
```

#### ✅ **Solution 3: Vérifier le Format des Données Envoyées par le Frontend**

Ajouter une validation au début de `creer_service` pour vérifier que les médias sont présents :

```rust
// Au début de creer_service, après avoir reçu data_processed
log::info!(
    "[creer_service] 🔍 VALIDATION MÉDIAS - Vérification présence médias dans data_processed"
);

let has_media = data_processed.get("base64_image").is_some()
    || data_processed.get("images_realisations").is_some()
    || data_processed.get("produits").is_some();

if !has_media {
    log::warn!(
        "[creer_service] ⚠️ ATTENTION: Aucun champ média détecté dans data_processed. Clés présentes: {:?}",
        data_processed.as_object().map(|o| o.keys().collect::<Vec<_>>())
    );
}
```

---

## 2. Amélioration du Matching Google Places

### 2.1 Réduction de la Distance à 1 km

**Modification appliquée**: Distance maximale réduite à **1 km** dans `creer_service.rs`

### 2.2 Gestion de Plusieurs Structures Similaires au Même Endroit

**Problème**: Si plusieurs structures de mêmes prestations sont concentrées au même endroit dans Google Maps, comment choisir le bon match ?

**Solution**: Améliorer l'algorithme de scoring pour prioriser :

1. **Correspondance exacte du nom** (poids élevé)
2. **Distance minimale** (dans le rayon de 1 km)
3. **Type de business** (correspondance avec la catégorie du service)
4. **Rating et nombre d'avis** (crédibilité)

**Algorithme amélioré**:

```rust
// Dans search_and_select_best_match, améliorer le scoring :

// 1. Distance (0-50 points) - Plus proche = meilleur
let distance_score = if distance_km <= 0.1 {
    50.0  // Très proche (< 100m)
} else if distance_km <= 0.5 {
    40.0  // Proche (< 500m)
} else {
    30.0  // Dans le rayon (< 1km)
};

// 2. Matching du nom (0-40 points)
let name_score = if display_name_lower == prestataire_lower {
    40.0  // Correspondance exacte
} else if display_name_lower.contains(&prestataire_lower) {
    35.0  // Contient le nom complet
} else {
    // Correspondance partielle (mots)
    let prestataire_words: Vec<&str> = prestataire_lower.split_whitespace().collect();
    let matching_words = prestataire_words.iter()
        .filter(|word| display_name_lower.contains(*word))
        .count();
    
    if matching_words > 0 {
        (matching_words as f64 / prestataire_words.len() as f64) * 30.0
    } else {
        0.0
    }
};

// 3. Type de business (0-20 points)
let type_score = if enriched.primary_type.is_some() {
    // Vérifier si le type correspond à la catégorie du service
    // (à implémenter selon les catégories Yukpo)
    10.0  // Bonus si type correspond
} else {
    0.0
};

// 4. Rating (0-15 points)
let rating_score = enriched.rating.map(|r| r * 3.0).unwrap_or(0.0);

// 5. Nombre d'avis (0-10 points)
let review_score = enriched.rating_count
    .map(|count| if count > 50 { 10.0 } else if count > 10 { 5.0 } else { 0.0 })
    .unwrap_or(0.0);

let total_score = distance_score + name_score + type_score + rating_score + review_score;
```

### 2.3 Gestion des Cas Multiples

**Scénario**: Plusieurs lieux Google Places avec le même nom ou très proches

**Solution**: 
1. **Grouper les lieux similaires** par nom et distance
2. **Sélectionner le meilleur** selon le score total
3. **Si égalité**, choisir celui avec le meilleur rating

**Code**:

```rust
// Au lieu de garder seulement le meilleur, garder les meilleurs candidats
let mut candidates: Vec<(GooglePlaceEnriched, f64)> = Vec::new();

for place in places_to_check {
    // ... calcul du score ...
    
    if score >= MIN_SCORE_THRESHOLD {
        candidates.push((enriched, score));
    }
}

// Trier par score décroissant
candidates.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

// Si plusieurs candidats avec le même score (ou très proche), choisir le plus proche
if candidates.len() > 1 {
    let best_score = candidates[0].1;
    let similar_candidates: Vec<_> = candidates.iter()
        .filter(|(_, score)| (score - best_score).abs() < 5.0)  // Score très proche
        .collect();
    
    if similar_candidates.len() > 1 {
        // Choisir le plus proche parmi les candidats similaires
        let best = similar_candidates.iter()
            .min_by(|a, b| {
                let dist_a = calculate_distance(...);
                let dist_b = calculate_distance(...);
                dist_a.partial_cmp(&dist_b).unwrap_or(std::cmp::Ordering::Equal)
            })
            .unwrap();
        
        Ok(Some(best.0.clone()))
    } else {
        Ok(Some(candidates[0].0.clone()))
    }
} else if let Some((enriched, _)) = candidates.first() {
    Ok(Some(enriched.clone()))
} else {
    Ok(None)
}
```

---

## 3. Solutions pour Autres Constats

### 3.1 Tables Manquantes (`token_consumption_logs`, `purchase_history`)

**✅ Solution**: Migration créée dans `backend/migrations/20251127_create_token_consumption_and_purchase_history.sql`

**Action**: Appliquer la migration avec `sqlx migrate run`

### 3.2 Google Translate API Bloquée

**Problème**: Code 403 - API bloquée

**Solutions**:
1. **Vérifier la clé API** dans Google Cloud Console
2. **Activer la facturation** si nécessaire
3. **Vérifier les quotas** et limites
4. **Alternative**: Utiliser un autre service de traduction ou désactiver temporairement

### 3.3 Génération Vidéo Impossible

**Problème**: Aucune image disponible pour générer la vidéo

**Solution**: 
- Corriger le problème de sauvegarde des médias (voir section 1)
- Une fois les médias sauvegardés, la génération vidéo fonctionnera

### 3.4 Performance - Requête SQL Lente

**Problème**: `INSERT INTO google_places_data` prend plus de 1 seconde

**Solutions**:
1. **Ajouter des index** sur les colonnes fréquemment utilisées
2. **Optimiser la requête** (éviter les sous-requêtes inutiles)
3. **Utiliser des transactions batch** pour plusieurs insertions

### 3.5 Pipeline Dégradé

**Problème**: Certains jobs ont échoué dans les dernières 24h

**Solutions**:
1. **Vérifier les logs détaillés** des jobs échoués
2. **Corriger les erreurs** identifiées
3. **Ajouter des retry logic** pour les jobs critiques
4. **Améliorer la gestion d'erreurs** pour éviter les échecs en cascade

---

## 📝 Plan d'Action Immédiat

### Priorité 1 (Urgent)

1. ✅ **Appliquer la migration** des tables manquantes
2. ✅ **Réduire la distance** à 1 km
3. 🔄 **Améliorer le matching** pour gérer plusieurs structures similaires
4. 🔄 **Améliorer la détection des formats** de médias

### Priorité 2 (Important)

1. 🔄 **Ajouter la gestion des URLs** d'images
2. 🔄 **Vérifier le format** des données envoyées par le frontend
3. 🔄 **Optimiser les requêtes SQL** lentes

### Priorité 3 (Améliorations)

1. 🔄 **Corriger Google Translate API**
2. 🔄 **Améliorer la gestion d'erreurs** du pipeline
3. 🔄 **Ajouter des tests** pour la sauvegarde des médias

---

**Document généré le**: 2025-11-27  
**Dernière mise à jour**: 2025-11-27

