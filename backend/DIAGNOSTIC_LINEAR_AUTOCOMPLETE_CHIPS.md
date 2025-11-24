# Diagnostic : Chips ne s'affichent pas dans LinearAutocompleteEditor

## Problème identifié

Les caractéristiques (chips) ne s'affichent pas dans `LinearAutocompleteEditor`, même quand les combinaisons sont bien chargées depuis l'IA.

## Cause racine

1. **Affichage conditionnel des chips** : Les chips ne s'affichent que si `chips.length > 0` (ligne 2163)
2. **Création des chips** : Les chips sont créés depuis `displayValue` via `parseVectorToChips(displayValue, labelOrder)` (ligne 964)
3. **Extraction de displayValue** : `displayValue` est extrait de `value[0]` (ligne 566)
4. **Problème** : Si `value` est vide, mal formaté, ou si `value[0]` n'est pas une string valide, alors `displayValue` sera vide, donc `chips` sera vide, donc rien ne s'affiche

## Corrections apportées

### 1. Ajout de logs de diagnostic
- Logs pour `displayValue` vide
- Logs pour `value[0]` invalide
- Logs pour `chips` créés

### 2. Vérification que `value` est bien un tableau de strings
- Dans `FormulaireYukpoIntelligentScreen`, `produitsValues` est extrait depuis `produitsField.valeur`
- Réorganisation selon `ai_preferred_index` pour mettre la combinaison préférée en premier

### 3. Vérification dans AjouterProduitSimpleScreen
- Même logique de réorganisation selon `ai_preferred_index`
- Même extraction des valeurs

## Prochaines étapes

1. Tester avec des données réelles pour voir les logs
2. Vérifier que `produitsValues` contient bien des strings (pas des objets)
3. Vérifier que `displayValue` est bien extrait
4. Vérifier que `chips` sont bien créés

## Fichiers modifiés

- `mobile/src/components/LinearAutocompleteEditor.tsx` : Ajout de logs de diagnostic
- `mobile/src/screens/FormulaireYukpoIntelligentScreen.tsx` : Réorganisation selon `ai_preferred_index`
- `mobile/src/screens/AjouterProduitSimpleScreen.tsx` : Vérification à faire

