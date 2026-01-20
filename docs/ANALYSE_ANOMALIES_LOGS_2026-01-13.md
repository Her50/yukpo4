# 📊 Analyse des Anomalies - Logs du 2026-01-13

## 🔍 Vue d'Ensemble

Analyse des logs backend et identification des anomalies liées aux recherches, à l'affichage ProductCard, au drapeau du pays et aux boutons UI.

---

## 1. ❌ Anomalies de Recherche

### Problème Identifié

Les logs montrent des incohérences dans les résultats de recherche :

1. **Recherche "Chaussures"** : Retourne 0 résultats
   ```
   [NativeSearch] keyword_search_with_gps: 0 résultats trouvés
   [NativeSearch] Fallback fulltext_search_with_gps (0 résultats trouvés)
   [NativeSearch] Fallback trigram_search_with_gps (0 résultats trouvés)
   ```

2. **Recherche "Chaussures Nike"** : Retourne 1 résultat
   ```
   [RECHERCHE_DIRECTE] ✅ Réponse construite avec 1 résultats
   [NativeSearch] Recherche native réussie avec 1 résultats
   ```

### Analyse

**Problèmes identifiés :**

- ❌ Les recherches à un seul mot ("chaussures") ne retournent pas de résultats
- ❌ Les recherches avec plusieurs mots ("chaussures nike") fonctionnent
- ⚠️ Le système de recherche semble avoir un problème avec les mots isolés

**Causes possibles :**

1. **Seuil de pertinence trop élevé** : `Seuil de pertinence adaptatif: 8 (recherche 2 mot(s))` vs `8 (recherche 4 mot(s))`
2. **Index full-text** : Les index GIN peuvent ne pas matcher correctement les mots isolés
3. **Normalisation des mots-clés** : La normalisation peut créer des variations qui ne matchent pas
   ```
   Mots-clés normalisés pour matching vectoriel: ["chaussures", "cchaaaauuuussuuuureeeees"]
   ```

**Recommandations :**

1. ✅ Vérifier les index PostgreSQL pour les recherches full-text
2. ✅ Ajuster le seuil de pertinence adaptatif pour les recherches à un seul mot
3. ✅ Vérifier la normalisation des mots-clés (éviter les variations excessives)

---

## 2. 🐛 Affichage "false" dans les Caractéristiques ProductCard

### Problème Identifié

Des valeurs "false" s'affichent dans les caractéristiques/catégories des ProductCard.

### Analyse du Code

**Code actuel** (`mobile/src/components/ProductCard.tsx`) :

```typescript
// Ligne 208-215 : Fonction de filtrage
const filterBooleanValue = (value: any, defaultValue: string = ''): string => {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'boolean') return defaultValue;
  if (value === 'false' || value === false) return defaultValue;
  if (typeof value === 'string' && value.trim() === '') return defaultValue;
  return String(value);
};

// Ligne 256-272 : Filtrage du productVector
const rawProductVector = Array.isArray(productData.product_vector)
  ? productData.product_vector
  : Array.isArray(productData.characteristic_vector)
    ? productData.characteristic_vector
    : typeof productData.product_vector === 'string'
      ? splitWithFallback(productData.product_vector, ',')
      : [];

const productVector = rawProductVector.filter((item: any) => {
  if (item === null || item === undefined) return false;
  if (typeof item === 'boolean') return false;
  if (item === 'false' || item === false) return false;
  if (typeof item === 'string' && item.trim() === '') return false;
  return true;
});

// Ligne 1132-1140 : Affichage avec filtrage
{productVector.map((carac: string, i: number) => {
  const displayValue = filterBooleanValue(carac, '');
  if (!displayValue) return null;
  return (
    <View key={i} style={styles.chip}>
      <Text style={styles.chipText}>{displayValue}</Text>
    </View>
  );
})}
```

**Problème identifié :**

- ✅ Le code filtre déjà les valeurs "false" dans `productVector`
- ⚠️ **MAIS** : Le problème peut venir de `productData.category` qui n'est pas filtré
- ⚠️ **OU** : Les données backend contiennent des valeurs "false" comme strings dans `product_vector`

**Recommandations :**

1. ✅ Vérifier les données backend pour s'assurer qu'elles ne contiennent pas "false" comme valeur
2. ✅ Ajouter un filtrage supplémentaire pour la catégorie si elle est affichée
3. ✅ Vérifier que `filterBooleanValue` est utilisé partout où des valeurs sont affichées

---

## 3. 🌍 Drapeau du Pays - Affichage du Globe au lieu du Drapeau

### Problème Identifié

Le drapeau du pays de l'utilisateur ne s'affiche pas correctement - c'est le symbole du globe (🌍) qui s'affiche au lieu du drapeau du pays.

### Analyse du Code

**Code actuel** (`mobile/src/components/ProductCard.tsx`) :

```typescript
// Ligne 158-189 : Fonction getCountryFlag locale
const getCountryFlag = (country?: string): string => {
  const countryMap: Record<string, string> = {
    'Cameroun': '🇨🇲',
    'Cameroon': '🇨🇲',
    // ... autres pays
  };

  if (!country) return '🌍';

  for (const [key, flag] of Object.entries(countryMap)) {
    if (country.toLowerCase().includes(key.toLowerCase())) {
      return flag;
    }
  }

  return '🌍';
};

// Ligne 566-570 : Extraction du pays
const pays = locationVector[locationVector.length - 1] ||
  productData.pays ||
  service?.data?.pays?.valeur;

const countryFlag = getCountryFlag(pays);
```

**Problème identifié :**

1. ❌ **Extraction incorrecte du pays** : `locationVector[locationVector.length - 1]` peut ne pas contenir le pays
2. ❌ **Mapping incomplet** : La fonction `getCountryFlag` dans ProductCard diffère de celle dans `useLocationDisplay.ts`
3. ❌ **Pas d'extraction depuis la localisation** : Le code n'extrait pas le pays depuis `chosenLocation` ou les données de localisation complètes

**Comparaison avec `useLocationDisplay.ts` :**

```typescript
// useLocationDisplay.ts ligne 184-204 : Fonction getCountryFlag plus complète
const getCountryFlag = (country: string): string => {
  const countryLower = country.toLowerCase();
  
  if (countryLower.includes('cameroun') || countryLower.includes('cameroon')) return '🇨🇲';
  if (countryLower.includes('nigeria')) return '🇳🇬';
  // ... etc
  
  return '🌍';
};

// Ligne 206-235 : Fonction extractCountryFromLocation
const extractCountryFromLocation = (location: string): string => {
  const locationLower = location.toLowerCase();
  
  if (locationLower.includes('cameroun') || locationLower.includes('douala') || locationLower.includes('yaoundé')) {
    return 'Cameroun';
  }
  // ... etc
  
  return 'International';
};
```

**Recommandations :**

1. ✅ **Utiliser `useLocationDisplay` hook** : ProductCard devrait utiliser le hook `useLocationDisplay` au lieu de sa propre logique
2. ✅ **Extraire le pays depuis `chosenLocation`** : Utiliser `extractCountryFromLocation` depuis le hook
3. ✅ **Unifier les fonctions** : Utiliser la même fonction `getCountryFlag` partout
4. ✅ **Vérifier les données backend** : S'assurer que `service?.data?.pays?.valeur` contient le bon format

---

## 4. 🔘 Bouton après "Chat" dans ProductCard

### Problème Identifié

Il y a un bouton après le bouton "Chat" dans ProductCard. L'utilisateur demande de vérifier son rôle et de le supprimer s'il n'est pas utile.

### Analyse du Code

**Code actuel** (`mobile/src/components/ProductCard.tsx` ligne 1230-1284) :

```typescript
<View style={styles.actions}>
  {/* Bouton "Me livrer" */}
  {serviceId && isProduct && (
    <TouchableOpacity
      style={[styles.actionButtonDelivery, styles.actionButton, !deliveryEnabled && styles.actionButtonDeliveryDisabled]}
      onPress={() => setShowOrderModal(true)}
      disabled={!deliveryEnabled}
    >
      <SafeIcon name="truck" size={18} color={deliveryEnabled ? "#10B981" : "#9CA3AF"} />
      <Text style={[styles.actionButtonDeliveryText, !deliveryEnabled && styles.actionButtonDeliveryTextDisabled]}>
        Me livrer
      </Text>
    </TouchableOpacity>
  )}

  {/* Bouton Chat */}
  <NativeButton
    title="💬 Chat"
    variant="primary"
    onPress={handleChatPress}
    style={[styles.actionButton, !(serviceId && isProduct) && styles.actionButtonFullWidth]}
  />

  {/* Bouton de navigation (APRÈS Chat) */}
  {isProduct && (
    <TouchableOpacity
      style={styles.navButton}
      onPress={onPress || (() => navigation.navigate('ServiceDetail' as any, { serviceId: product.service_id || service?.id }))}
      activeOpacity={0.7}
    >
      <SafeIcon name="arrow-right" size={18} color={modernColors.primary} />
    </TouchableOpacity>
  )}
</View>
```

**Rôle du bouton :**

- 🔘 **Bouton de navigation** : Flèche droite (→) qui navigue vers le détail du service
- 🔘 **Condition** : S'affiche seulement si `isProduct` est vrai
- 🔘 **Action** : Appelle `onPress` ou navigue vers `ServiceDetail` avec le `serviceId`

**Analyse :**

1. ⚠️ **Utilité discutable** : Le bouton de navigation après "Chat" peut être redondant
2. ⚠️ **UX** : L'utilisateur peut déjà cliquer sur la carte entière pour voir les détails
3. ⚠️ **Visibilité** : Le bouton peut créer de la confusion (trop de boutons)

**Recommandations :**

1. ✅ **SUPPRIMER le bouton** : Le bouton de navigation après "Chat" est redondant car :
   - La carte entière est cliquable (`onPress` sur le `TouchableOpacity` parent)
   - Le bouton "Chat" est déjà suffisant pour les actions principales
   - Trop de boutons peuvent créer de la confusion UX

---

## 📋 Résumé des Corrections Recommandées

### Priorité Haute

1. ✅ **Corriger l'extraction du pays** dans ProductCard (utiliser `useLocationDisplay` hook)
2. ✅ **Supprimer le bouton de navigation** après "Chat" dans ProductCard
3. ✅ **Vérifier le filtrage des valeurs "false"** dans les caractéristiques

### Priorité Moyenne

4. ⚠️ **Corriger les recherches à un seul mot** (ajuster le seuil de pertinence)
5. ⚠️ **Unifier les fonctions `getCountryFlag`** entre ProductCard et useLocationDisplay

### Priorité Basse

6. 📝 **Documenter les corrections** dans le code
7. 📝 **Ajouter des tests** pour éviter les régressions

---

## 🔧 Corrections à Implémenter

Voir les fichiers de correction suivants :
- `mobile/src/components/ProductCard.tsx` : Corrections drapeau, bouton, filtrage
- `backend/src/services/search_service.rs` : Corrections recherches (si nécessaire)






