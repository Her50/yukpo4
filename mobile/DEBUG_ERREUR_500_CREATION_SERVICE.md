# 🐛 Guide de débogage - Erreur 500 lors de la création de service

## 📋 Contexte

**Erreur observée** :
```
{
  "timestamp": "2025-10-24T06:27:56.348Z",
  "status": "ERROR",
  "phase": "Service Creation",
  "errorMessage": "Erreur création service: Erreur 500"
}
```

## ✅ Vérifications déjà effectuées

### 1. Limite de taille des médias (Backend)

✅ **Backend configuré pour 10MB** :
```rust
// backend/src/lib.rs ligne 194
.layer(DefaultBodyLimit::max(10 * 1024 * 1024))  // 10MB
```

✅ **Compression côté mobile activée** :
```typescript
// FormulaireYukpoIntelligentScreen.tsx ligne 1074-1082
const compressedMedia = await compressAllMedia(mediaFiles);
```

## 🔍 Causes possibles de l'erreur 500

### 1. **Timeout de traitement IA**
L'appel à l'IA externe (OpenRouter/Mistral) peut prendre trop de temps avec beaucoup de médias.

**Solution** : Vérifier les logs backend pour voir si le timeout est atteint.

```bash
# Chercher dans les logs Render
grep "timeout" /var/log/yukpomnang.log
grep "IA.*error" /var/log/yukpomnang.log
```

### 2. **Erreur de traitement des images par l'IA**
L'IA peut échouer à analyser certaines images (format, taille, corruption).

**Vérification côté mobile** :
- Le mobile compresse déjà les images (max 1920px, 85% qualité)
- Les vidéos sont compressées avant envoi

**Vérification côté backend** :
```bash
# Vérifier les logs d'erreur IA
tail -f /var/log/yukpomnang.log | grep "ImageAnalysis\|IA.*500"
```

### 3. **Structure de données invalide**
Le payload envoyé peut contenir des champs mal formatés.

**Validation à ajouter côté mobile** (ligne 1096+) :
```typescript
// Valider que tous les base64 sont bien formatés
const validateBase64 = (str: string) => {
  try {
    return str.startsWith('data:') && str.includes('base64,');
  } catch {
    return false;
  }
};
```

### 4. **Erreur de base de données**
La création du service dans PostgreSQL peut échouer (contraintes, types, etc.).

**Vérification** :
```sql
-- Vérifier les dernières erreurs PostgreSQL
SELECT * FROM pg_stat_activity 
WHERE state = 'idle in transaction (aborted)' 
ORDER BY backend_start DESC LIMIT 10;
```

## 🛠️ Actions de débogage recommandées

### Étape 1 : Activer les logs détaillés (Mobile)

Ajouter avant l'appel IA (ligne 1096) :
```typescript
console.log('[DEBUG] Payload size:', JSON.stringify(iaPayload).length);
console.log('[DEBUG] Images count:', compressedMedia.images.length);
console.log('[DEBUG] Videos count:', compressedMedia.videos.length);
console.log('[DEBUG] Total compressed size MB:', 
  (compressedMedia.totalSizeAfter / (1024 * 1024)).toFixed(2)
);
```

### Étape 2 : Vérifier les logs backend

```bash
# Render Dashboard > Logs
# Chercher les lignes avec "ERROR" ou "500" autour du timestamp
# 2025-10-24T06:27:56.348Z
```

### Étape 3 : Test avec service minimal

Créer un service **SANS médias** pour isoler le problème :
1. Saisir seulement titre + description
2. Ne PAS ajouter d'images/vidéos
3. Si ça fonctionne → problème lié aux médias
4. Si ça échoue → problème de traitement IA ou BD

### Étape 4 : Augmenter le timeout IA (Backend)

Si l'IA prend trop de temps, augmenter le timeout dans `backend/src/services/app_ia.rs` :

```rust
// Passer de 60s à 120s pour les grosses requêtes
let timeout = Duration::from_secs(120);
```

## 📊 Métriques à surveiller

1. **Taille du payload** : Ne doit pas dépasser 10MB après compression
2. **Nombre d'images** : Recommandé max 5 images par service
3. **Durée de traitement IA** : Doit rester < 60 secondes
4. **Mémoire backend** : Vérifier qu'il ne manque pas de RAM

## ✅ Correctifs déjà appliqués (commit 503f068)

1. ✅ Intégration `ProductFieldSelector` pour toutes catégories
2. ✅ `KeyboardAvoidingView` pour meilleure UX clavier
3. ✅ Compression médias avant envoi
4. ✅ Limite backend 10MB

## 🔄 Prochaines étapes

1. [ ] Collecter les logs backend du timestamp exact (06:27:56)
2. [ ] Tester création service sans médias
3. [ ] Si problème persiste, augmenter timeout IA
4. [ ] Ajouter retry automatique avec backoff exponentiel

## 📝 Notes

- L'erreur 500 est côté serveur, pas côté mobile
- Le mobile fait déjà tout ce qu'il peut (compression, validation)
- Il faut accéder aux logs Render pour diagnostiquer précisément

