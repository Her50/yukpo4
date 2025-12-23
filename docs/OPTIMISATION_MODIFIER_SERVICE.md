# Optimisation modifier_service - FormulaireYukpoIntelligentScreen

## 🎯 Problème identifié

Le même problème de performance existe dans `modifier_service` utilisé par `FormulaireYukpoIntelligentScreen` :
- **UPDATE services SET data = $1** réécrit tout le JSON (5-7s)
- Utilisé lors de la modification de service depuis le formulaire mobile/web

---

## ✅ Correction apportée

**Fichier** : `backend/src/controllers/service_controller.rs`

### Optimisation intelligente

Détecte automatiquement si seulement les produits sont modifiés :
- **Si seulement `produits` modifié** → Utilise `jsonb_set` (mise à jour partielle, ~1-2s)
- **Si autres champs modifiés** → Mise à jour complète du JSON (comportement par défaut)

### Code optimisé

```rust
// Détecte si seulement produits modifié
let payload_keys: Vec<String> = payload.data.as_object()
    .map(|obj| obj.keys().cloned().collect())
    .unwrap_or_default();

if payload_keys.len() == 1 && payload_keys.contains(&"produits".to_string()) {
    // ✅ OPTIMISATION: jsonb_set (plus rapide)
    sqlx::query("UPDATE services SET data = jsonb_set(...)")
} else {
    // ✅ Mise à jour complète (comportement par défaut)
    sqlx::query("UPDATE services SET data = $1")
}
```

---

## 📊 Résultats attendus

### Avant
```
Modification service (FormulaireYukpoIntelligentScreen) :
- UPDATE services : 5-7s ❌
- Total : ~5-7s
```

### Après
```
Modification service (seulement produits) :
- UPDATE services : ~1-2s ✅ (jsonb_set)
- Total : ~1-2s

Modification service (autres champs) :
- UPDATE services : 5-7s (comportement par défaut)
- Total : ~5-7s
```

**Gain** : **~4-5 secondes** quand seulement les produits sont modifiés (cas fréquent)

---

## 🔍 Cas d'usage

### Cas optimisé (seulement produits)
```json
{
  "data": {
    "produits": [...]
  }
}
```
→ Utilise `jsonb_set` → **~1-2s** ✅

### Cas non optimisé (autres champs)
```json
{
  "data": {
    "titre_service": {...},
    "description": {...},
    "produits": [...]
  }
}
```
→ Mise à jour complète → **~5-7s** (normal)

---

## ✅ Checklist

- [x] Optimisation `modifier_service` appliquée
- [x] Détection intelligente produits uniquement
- [x] Fallback sur mise à jour complète si autres champs
- [ ] Tests de performance après déploiement

---

## 📝 Notes

- L'optimisation fonctionne automatiquement selon le contenu du payload
- Pas de changement nécessaire côté frontend/mobile
- Compatible avec tous les cas d'usage existants



