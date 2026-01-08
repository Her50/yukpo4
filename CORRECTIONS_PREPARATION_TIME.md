# ✅ Corrections - Temps de Préparation (preparation_time_minutes)

## 🔍 Problèmes identifiés et corrigés

### 1. Valeur par défaut manquante
**Avant** : `preparation_time_minutes: undefined`
**Après** : `preparation_time_minutes: 0` (instantané par défaut)

### 2. Envoi de undefined au backend
**Avant** : Si l'utilisateur ne saisit rien, `undefined` était envoyé
**Après** : Toujours envoyer au moins `0` même si l'utilisateur ne saisit rien

### 3. Validation trop stricte
**Avant** : Rejetait si `undefined`
**Après** : Accepte `0` comme valeur valide (instantané)

## ✅ Modifications apportées

### 1. État initial
```typescript
// Avant
preparation_time_minutes: undefined

// Après
preparation_time_minutes: 0 // ✅ Par défaut 0 (instantané) - toujours défini
```

### 2. Chargement depuis l'API
```typescript
// Avant
preparation_time_minutes: data.config.preparation_time_minutes || undefined

// Après
preparation_time_minutes: data.config.preparation_time_minutes ?? 0 // ✅ 0 par défaut si undefined
```

### 3. Validation
```typescript
// Avant
if (config.preparation_time_minutes === undefined || config.preparation_time_minutes < 0) {
    // Erreur
}

// Après
const preparationTime = config.preparation_time_minutes ?? 0; // ✅ Toujours 0 par défaut
if (preparationTime < 0) {
    // Erreur seulement si négatif
}
```

### 4. Champ UI
```typescript
// Avant
value={config.preparation_time_minutes ?? ''}
onChange={(e) => setConfig(prev => ({ 
    ...prev, 
    preparation_time_minutes: e.target.value ? parseInt(e.target.value) : undefined 
}))}

// Après
value={config.preparation_time_minutes ?? 0}
onChange={(e) => setConfig(prev => ({ 
    ...prev, 
    preparation_time_minutes: e.target.value ? parseInt(e.target.value) || 0 : 0 // ✅ Toujours 0 par défaut si vide
}))}
```

### 5. Envoi au backend
```typescript
// Avant
preparation_time_minutes: config.preparation_time_minutes

// Après
preparation_time_minutes: config.preparation_time_minutes ?? 0 // ✅ 0 par défaut si undefined
```

## 📋 Vérification - Pas de doublon

✅ **Confirmé** : Il n'y a qu'un seul champ "Temps de préparation" dans le fichier (lignes 465-481).
✅ **Pas de doublon** : Le champ n'existe qu'une seule fois dans l'interface utilisateur.

## 🎯 Comportement final

1. **Valeur par défaut** : `0` (instantané) dès l'ouverture du modal
2. **Si l'utilisateur ne saisit rien** : `0` est envoyé au backend
3. **Si l'utilisateur saisit une valeur** : Cette valeur est envoyée
4. **Si l'utilisateur efface la valeur** : Retour à `0` automatiquement
5. **Validation** : Accepte `0` et toute valeur positive, rejette seulement les valeurs négatives

## ✅ Résultat

- ✅ Pas de doublon
- ✅ Valeur par défaut `0` (instantané)
- ✅ Toujours une valeur envoyée (jamais `undefined`)
- ✅ Comportement cohérent dans tout le code

