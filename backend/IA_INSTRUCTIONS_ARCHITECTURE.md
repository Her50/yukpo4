# 🧠 Architecture des Instructions IA - Yukpo

## 📋 **Fichier Principal (SEUL UTILISÉ)**

### `ia_intentions_instructions.md` ✅
- **Utilisé par** : `orchestration_ia.rs` (ligne 88)
- **Contient** : Toutes les instructions pour toutes les intentions
- **Format** : Markdown avec exemples JSON
- **Localisation** : `backend/ia_intentions_instructions.md`

## 🗂️ **Fichiers Supprimés (CONFUSION)**

### ❌ `backend/ia_instructions/` (SUPPRIMÉ)
- `creation_service.md` ❌
- `universal_adaptive_prompt.md` ❌
- `recherche_besoin.md` ❌
- `assistance_generale.md` ❌
- `programme_scolaire.md` ❌
- `echange.md` ❌
- `update_programme_scolaire.md` ❌
- `base_intention_detection.md` ❌

**Raison** : Ces fichiers créaient de la confusion car ils n'étaient PAS utilisés par le code.

## 🔧 **Comment Modifier les Instructions**

### Pour modifier les instructions IA :
1. **Éditer uniquement** : `backend/ia_intentions_instructions.md`
2. **Redémarrer le backend** : `cargo run`
3. **Tester** : Utiliser le script de test

### Structure du fichier principal :
```markdown
# SYNTHÈSE – Instructions IA Yukpo

## 🎯 TYPES DE DONNÉES SUPPORTÉS

### creation_service
- Instructions spécifiques...
- Exemples JSON...

### recherche_besoin
- Instructions spécifiques...
- Exemples JSON...

### assistance_generale
- Instructions spécifiques...
- Exemples JSON...

### echange
- Instructions spécifiques...
- Exemples JSON...

### programme_scolaire
- Instructions spécifiques...
- Exemples JSON...
```

## 🚨 **Règles Importantes**

1. **UN SEUL FICHIER** : `ia_intentions_instructions.md`
2. **PAS DE DUPLICATION** : Ne pas créer de fichiers séparés
3. **COHÉRENCE** : Toutes les intentions dans le même fichier
4. **EXEMPLES** : Toujours inclure des exemples JSON conformes

## 🔍 **Vérification**

Pour vérifier que les instructions sont correctes :
```bash
cd backend
python test_service_creation.py
```

## 📝 **Historique**

- **Avant** : 8+ fichiers d'instructions créant de la confusion
- **Après** : 1 seul fichier centralisé et utilisé
- **Résultat** : Plus de confusion, maintenance simplifiée 