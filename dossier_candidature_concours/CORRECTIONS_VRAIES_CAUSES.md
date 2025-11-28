# Corrections des Vraies Causes Racines (pas juste fallbacks)

## Problème Identifié

D'après les logs `logbackend2.md` ligne 142, l'IA OpenAI retourne du JSON dans un code block markdown :
```
```json
{
  "variants": [...]
}
```
```

Mais `extract_json_block()` ne gérait que la recherche simple de `{` et `}`, ce qui pouvait échouer ou extraire incorrectement le JSON.

## Corrections Apportées

### 1. **Amélioration de `extract_json_block()` pour gérer les code blocks markdown**

**Fichier : `backend/src/services/app_ia.rs`**

- ✅ Gère maintenant les code blocks markdown ```json et ```
- ✅ Extrait correctement le JSON même s'il est entouré de markdown
- ✅ Compte les accolades pour trouver la fin correcte du JSON (gère les JSON imbriqués)
- ✅ Retourne un `String` au lieu d'un `&str` pour plus de flexibilité

**Code ajouté :**
```rust
fn extract_json_block(response: &str) -> Option<String> {
    let trimmed = response.trim();
    
    // 1. Si la réponse est entourée de ```json ou ```, extraire le contenu
    if trimmed.starts_with("```json") || trimmed.starts_with("```") {
        // Extraction du contenu entre les marqueurs
        ...
    }
    
    // 2. Chercher un bloc JSON entre { et } avec comptage des accolades
    ...
}
```

### 2. **Amélioration du prompt pour forcer un JSON pur**

**Fichier : `backend/src/services/app_ia.rs` - fonction `generate_video_style()`**

- ✅ Prompt explicitement demande "SANS markdown, SANS code blocks"
- ✅ Insiste sur "Réponds SEULEMENT le JSON, rien d'autre"
- ✅ Format JSON clairement spécifié

**Ancien prompt :**
```
"propose une direction visuelle concise en JSON STRICT :\n{...}"
```

**Nouveau prompt :**
```
"IMPORTANT: Réponds UNIQUEMENT avec un JSON valide, SANS markdown, SANS code blocks, SANS texte avant ou après.

Format JSON attendu: {...}

Réponds SEULEMENT le JSON, rien d'autre."
```

### 3. **Amélioration du logging pour debugging**

**Fichier : `backend/src/services/app_ia.rs`**

- ✅ Logging détaillé de chaque étape d'extraction JSON
- ✅ Logging de la taille du JSON extrait
- ✅ Logging des erreurs avec extraits de la réponse pour debugging

## Résultat Attendu

1. **L'IA devrait maintenant retourner du JSON pur** grâce au prompt amélioré
2. **Si elle retourne quand même du markdown, `extract_json_block()` le gère correctement**
3. **Les erreurs sont mieux loggées** pour identifier rapidement les problèmes restants

## Tests Recommandés

1. Tester la génération de style vidéo et vérifier les logs
2. Vérifier que le JSON est correctement extrait même avec markdown
3. Confirmer que l'IA suit mieux les instructions du prompt

## Fichiers Modifiés

1. `backend/src/services/app_ia.rs`
   - Fonction `extract_json_block()` : Gestion des code blocks markdown
   - Fonction `generate_video_style()` : Prompt amélioré + logging

