# ✅ Vérification et correction sauvegarde Logo et Bannière

## 🔍 Problème détecté

Le logo et la bannière envoyés par `FormulaireYukpoIntelligentScreen` n'étaient **PAS sauvegardés** dans la table `media`.

### Cause

1. **Frontend** : Le logo et la bannière sont envoyés comme :
   ```json
   {
     "logo": {
       "type_donnee": "image",
       "valeur": "data:image/png;base64,..."
     },
     "banner": {
       "type_donnee": "image",
       "valeur": "data:image/jpg;base64,..."
     }
   }
   ```

2. **Backend** : La fonction `clean_media_recursive_final` supprime les objets avec `type_donnee: 'image'` (ligne 487), mais **aucun code ne les sauvegardait avant la suppression**.

---

## 🔧 Correction apportée

**Fichier** : `backend/src/services/creer_service.rs`  
**Lignes** : ~1635-1850

### Ajout de la sauvegarde du Logo

```rust
// ✅ NOUVEAU 2025-11-26: Sauvegarder le logo AVANT le nettoyage
if let Some(logo_value) = data_processed.get("logo") {
    let logo_data = if let Some(logo_obj) = logo_value.as_object() {
        logo_obj.get("valeur")  // Extraire depuis { type_donnee: "image", valeur: "base64..." }
    } else {
        Some(logo_value)  // Ou directement la valeur si c'est une string
    };
    
    // Traiter comme string ou array
    if let Some(logo_str) = logo_data.and_then(|v| v.as_str()) {
        // Sauvegarder sur disque
        persist_base64_media(..., "png").await
        
        // Insérer dans table media avec service_media_type = 'logo'
        INSERT INTO media (service_id, type, path, service_media_type, ...)
        VALUES (service_id, 'image', file_path, 'logo', ...)
    }
}
```

### Ajout de la sauvegarde de la Bannière

```rust
// ✅ NOUVEAU 2025-11-26: Sauvegarder la bannière AVANT le nettoyage
if let Some(banner_value) = data_processed.get("banner").or_else(|| data_processed.get("banniere")) {
    // Même logique que pour le logo
    // Insérer avec service_media_type = 'banniere'
}
```

---

## ✅ Fonctionnalités implémentées

### Logo
- [x] Extraction depuis `data_processed.logo.valeur` (format objet)
- [x] Extraction depuis `data_processed.logo` (format string direct)
- [x] Support array (prend le premier élément)
- [x] Sauvegarde sur disque dans `uploads/services/{service_id}/images/`
- [x] Insertion dans table `media` avec `service_media_type = 'logo'`
- [x] Génération signature d'image (si feature activée)
- [x] Hash MD5 pour détection doublons

### Bannière
- [x] Extraction depuis `data_processed.banner.valeur` ou `data_processed.banniere.valeur`
- [x] Support des deux noms (`banner` et `banniere`)
- [x] Support array (prend le premier élément)
- [x] Sauvegarde sur disque dans `uploads/services/{service_id}/images/`
- [x] Insertion dans table `media` avec `service_media_type = 'banniere'`
- [x] Génération signature d'image (si feature activée)
- [x] Hash MD5 pour détection doublons

---

## 📊 Structure de la table `media`

Après sauvegarde, les entrées dans `media` ont :

| Colonne | Logo | Bannière |
|---------|------|----------|
| `service_id` | ✅ ID du service | ✅ ID du service |
| `product_id` | `NULL` (média global) | `NULL` (média global) |
| `product_index` | `NULL` (média global) | `NULL` (média global) |
| `type` | `'image'` | `'image'` |
| `path` | Chemin fichier | Chemin fichier |
| `service_media_type` | `'logo'` | `'banniere'` |
| `image_signature` | Signature vectorielle | Signature vectorielle |
| `image_hash` | Hash MD5 | Hash MD5 |
| `image_metadata` | Métadonnées | Métadonnées |

---

## 🔍 Requêtes SQL utiles

### Récupérer le logo d'un service
```sql
SELECT path, image_hash, image_metadata
FROM media
WHERE service_id = $1
  AND service_media_type = 'logo'
LIMIT 1;
```

### Récupérer la bannière d'un service
```sql
SELECT path, image_hash, image_metadata
FROM media
WHERE service_id = $1
  AND service_media_type = 'banniere'
LIMIT 1;
```

### Vérifier si un service a un logo et une bannière
```sql
SELECT 
  service_id,
  COUNT(*) FILTER (WHERE service_media_type = 'logo') as has_logo,
  COUNT(*) FILTER (WHERE service_media_type = 'banniere') as has_banner
FROM media
WHERE service_id = $1
  AND service_media_type IN ('logo', 'banniere')
GROUP BY service_id;
```

---

## 🎯 Résultat

**Le logo et la bannière sont maintenant correctement sauvegardés** :

1. ✅ Extraits depuis `data_processed` avant le nettoyage
2. ✅ Sauvegardés sur le disque
3. ✅ Insérés dans la table `media` avec `service_media_type` approprié
4. ✅ Accessibles via requêtes SQL avec `service_media_type = 'logo'` ou `'banniere'`
5. ✅ Signatures d'image générées pour recherche par similarité

---

## 📝 Notes

- Le logo est sauvegardé avec extension `.png` par défaut
- La bannière est sauvegardée avec extension `.jpg` par défaut
- Si plusieurs logos/bannières sont envoyés (array), seul le premier est sauvegardé (comportement `takeFirst: true` du frontend)
- Les métadonnées d'image (dimensions, couleurs, etc.) sont générées si la feature `image_search` est activée

