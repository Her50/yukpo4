# ✅ Correction Erreur 500 - Création de Service

**Date**: 29 Octobre 2025  
**Problème**: Erreur 500 avec message "Données non conformes au schéma" lors de la création de service

## 🐛 Problème identifié

Les logs backend montraient :
```
[creer_service] Erreur création service: BadRequest("Données non conformes au schéma")
```

### Cause racine

Le schéma backend (`service_schema.json`) exige **3 champs obligatoires** :
1. ✅ `titre_service` - Format objet `{type_donnee, valeur, origine_champs}`
2. ✅ `category` - Format objet `{type_donnee, valeur, origine_champs}`
3. ❌ **`is_tarissable`** - **MANQUANT** dans la validation mobile

Le code mobile vérifiait seulement `titre_service`, `description`, `category` mais **ignorait `is_tarissable`**.

## ✅ Solution appliquée

**Fichier modifié**: `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx` (lignes 1392-1459)

### Corrections

1. **Ajout de `is_tarissable` aux champs obligatoires**:
   - Le schéma backend l'exige (ligne 5 de `service_schema.json`)
   - Valeur par défaut : `false` si absent

2. **Normalisation automatique des champs**:
   - Fonction `normaliserChamp()` qui s'assure que tous les champs obligatoires sont au format :
     ```typescript
     {
       type_donnee: 'string' | 'number' | 'boolean',
       valeur: any,
       origine_champs: 'formulaire' | 'ia' | ...
     }
     ```

3. **Vérification du format**:
   - Si un champ existe mais n'est pas au bon format, il est automatiquement normalisé
   - Les champs manquants sont détectés et signalés clairement

### Code ajouté

```typescript
// ✅ VÉRIFICATION : S'assurer que les champs obligatoires sont présents ET au bon format
const champsObligatoires = ['titre_service', 'category', 'is_tarissable'];
const champsObligatoiresOptionnels = ['description']; // Optionnel mais recommandé

// Fonction helper pour normaliser un champ en format objet structuré
const normaliserChamp = (champName: string, valeurParDefaut?: any) => {
  // ... logique de normalisation ...
};

// Normaliser tous les champs obligatoires
for (const champ of champsObligatoires) {
  if (champ === 'is_tarissable') {
    // is_tarissable par défaut à false si absent
    if (!normaliserChamp(champ, false)) {
      champManquants.push(champ);
    }
  } else {
    if (!normaliserChamp(champ)) {
      champManquants.push(champ);
    }
  }
}
```

## 📋 Structure du payload attendu

Le backend attend un payload avec cette structure :

```json
{
  "user_id": 17,
  "data": {
    "titre_service": {
      "type_donnee": "string",
      "valeur": "Mon service",
      "origine_champs": "formulaire"
    },
    "category": {
      "type_donnee": "string",
      "valeur": "informatique",
      "origine_champs": "formulaire"
    },
    "is_tarissable": {
      "type_donnee": "boolean",
      "valeur": false,
      "origine_champs": "formulaire"
    },
    "description": {
      "type_donnee": "string",
      "valeur": "Description...",
      "origine_champs": "formulaire"
    },
    "tokens_ia_externe": 1234
  }
}
```

## 🧪 Tests à effectuer

Après redémarrage de l'app avec cache vidé :

1. ✅ Créer un nouveau service
2. ✅ Vérifier que tous les champs obligatoires sont présents
3. ✅ Vérifier que le payload est bien structuré (logs console)
4. ✅ Vérifier que l'erreur 500 n'apparaît plus

## 📝 Logs à surveiller

Dans la console mobile, chercher :
```
[FormulaireYukpoIntelligentScreen] ✅ Tous les champs obligatoires sont présents et normalisés
[FormulaireYukpoIntelligentScreen] ✅ is_tarissable ajouté avec valeur par défaut: false
[FormulaireYukpoIntelligentScreen] ✅ titre_service normalisé au format structuré
[FormulaireYukpoIntelligentScreen] ✅ category normalisé au format structuré
```

Dans les logs backend, l'erreur ne devrait plus apparaître :
```
✅ [valider_service_json] Schéma JSON validé avec succès
✅ [creer_service] Service créé avec succès
```

## ⚠️ Notes importantes

1. **`is_tarissable` est maintenant toujours présent** avec valeur par défaut `false` si non défini dans le formulaire
2. **Tous les champs obligatoires sont normalisés automatiquement** au format attendu par le backend
3. **Les champs optionnels** (comme `description`) sont aussi normalisés s'ils sont présents

## 🔄 Prochaines étapes

1. ✅ Redémarrer l'app mobile avec `npm start -- --clear`
2. ✅ Tester la création d'un service
3. ✅ Vérifier les logs backend pour confirmer que la validation passe
4. ⏳ Si l'erreur persiste, vérifier les logs backend pour d'autres détails d'erreur de validation

---

**Fichiers modifiés**:
- `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx` (lignes 1392-1459)

**Références**:
- Schéma backend: `backend/src/schemas/service_schema.json`
- Validation backend: `backend/src/services/creer_service.rs` (fonction `valider_service_json`)
