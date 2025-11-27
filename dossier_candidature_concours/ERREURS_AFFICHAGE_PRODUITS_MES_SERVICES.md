# Analyse des Erreurs d'Affichage - Produits dans Mes Services

## Date d'analyse
2025-11-27

## Vue d'ensemble
Analyse approfondie des problèmes d'affichage des produits dans l'écran "Mes Services" basée sur la capture d'écran fournie et les logs.

---

## 🔴 PROBLÈMES IDENTIFIÉS DANS L'IMAGE

### 1. "Produit sans nom" - Nom du produit non affiché

**Problème visible :**
- Les produits affichent "Produit sans nom" au lieu du nom réel
- Tous les produits semblent avoir ce problème

**Cause identifiée :**
```typescript
// Ligne 302-304 dans MesProduitsScreen.tsx
if (!normalizedProduct.nom && !normalizedProduct.nom_produit) {
    normalizedProduct.nom = '';  // ❌ PROBLÈME: Chaîne vide au lieu de undefined
    normalizedProduct.nom_produit = '';
}

// Ligne 1518
{product.nom || product.nom_produit || 'Produit sans nom'}
// Si product.nom = '' (chaîne vide), le || ne fonctionne pas car '' est falsy mais existe
```

**Solution :**
```typescript
// Ne pas mettre chaîne vide, laisser undefined
if (!normalizedProduct.nom && !normalizedProduct.nom_produit) {
    // Ne pas définir du tout, laisser undefined
    // Le fallback dans l'affichage fonctionnera
}

// OU améliorer l'affichage
{product.nom?.trim() || product.nom_produit?.trim() || 'Produit sans nom'}
```

**Fichier à modifier :** `mobile/src/screens/MesProduitsScreen.tsx` (lignes 302-304, 1518)

---

### 2. Affichage JSON brut au lieu de description formatée

**Problème visible :**
- Affichage de `{"valeur": "Services de photographie professi...` au lieu de la description
- L'objet JSON est converti en string et affiché tel quel

**Cause identifiée :**
```typescript
// Ligne 243 dans MesProduitsScreen.tsx
const serviceTitre = service.data?.titre_service?.valeur || service.titre || 'Service sans titre';

// Ligne 1535 - Affichage
{product.serviceTitre || 'Service sans titre'}
```

**Problème :**
- Si `service.data.titre_service` est un objet `{valeur: "...", type_donnee: "string"}` au lieu d'une chaîne
- Et que `service.titre` contient aussi un objet JSON
- Alors `serviceTitre` peut être un objet qui sera converti en string `[object Object]` ou JSON

**Solution :**
```typescript
// Améliorer l'extraction du serviceTitre
const extractServiceTitre = (service: any): string => {
    // Essayer titre_service.valeur
    if (service.data?.titre_service?.valeur && typeof service.data.titre_service.valeur === 'string') {
        return service.data.titre_service.valeur;
    }
    // Essayer titre_service directement (string)
    if (service.data?.titre_service && typeof service.data.titre_service === 'string') {
        return service.data.titre_service;
    }
    // Essayer titre
    if (service.titre && typeof service.titre === 'string') {
        return service.titre;
    }
    // Essayer data.titre
    if (service.data?.titre && typeof service.data.titre === 'string') {
        return service.data.titre;
    }
    // Fallback
    return 'Service sans titre';
};

const serviceTitre = extractServiceTitre(service);
```

**Fichier à modifier :** `mobile/src/screens/MesProduitsScreen.tsx` (ligne 243, 1535)

---

### 3. Catégorie "Autre" par défaut

**Problème visible :**
- Tous les produits affichent la catégorie "Autre"
- Pas de catégorie spécifique affichée

**Cause identifiée :**
```typescript
// Ligne 32-40 dans MesProduitsScreen.tsx
const normalizeCategoryKey = (product: Record<string, any>): string => {
    const raw = product?.categorie_produit
        ?? product?.categorie
        ?? product?.category
        ?? product?.type
        ?? product?.serviceCategorie
        ?? 'autre';  // ❌ Fallback par défaut

    return String(raw).trim().toLowerCase();
};
```

**Problème :**
- Si aucun champ de catégorie n'est trouvé, retourne 'autre'
- La normalisation peut ne pas extraire correctement la catégorie depuis les objets structurés

**Solution :**
```typescript
// Améliorer l'extraction de catégorie
const normalizeCategoryKey = (product: Record<string, any>): string => {
    // Extraire depuis objets structurés
    const extractValue = (field: any): string | null => {
        if (!field) return null;
        if (typeof field === 'string') return field.trim();
        if (typeof field === 'object' && 'valeur' in field) {
            const val = field.valeur;
            return typeof val === 'string' ? val.trim() : null;
        }
        return null;
    };

    const raw = extractValue(product?.categorie_produit)
        ?? extractValue(product?.categorie)
        ?? extractValue(product?.category)
        ?? extractValue(product?.type)
        ?? extractValue(product?.serviceCategorie);

    if (raw && raw.length > 0) {
        return raw.toLowerCase();
    }

    // Ne pas utiliser 'autre' par défaut, utiliser null et gérer dans l'affichage
    return null;
};

// Dans l'affichage
{categoryLabel || 'Non catégorisé'}  // Au lieu de toujours afficher quelque chose
```

**Fichier à modifier :** `mobile/src/screens/MesProduitsScreen.tsx` (lignes 32-40, 1542)

---

### 4. Description affichée comme JSON brut

**Problème visible :**
- La description du service affiche `{"valeur": "Services de photographie professi...`
- Au lieu d'afficher juste "Services de photographie professionnelle..."

**Cause identifiée :**
```typescript
// Ligne 1535 - Affichage serviceTitre
{product.serviceTitre || 'Service sans titre'}

// Si serviceTitre contient un objet JSON, il sera converti en string
// Résultat: "[object Object]" ou JSON.stringify implicite
```

**Solution :**
```typescript
// Créer une fonction helper pour extraire les valeurs
const extractStringValue = (value: any): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
        // Si c'est un objet structuré {valeur: "...", type_donnee: "..."}
        if ('valeur' in value && typeof value.valeur === 'string') {
            return value.valeur;
        }
        // Si c'est un objet JSON, ne pas l'afficher
        return '';
    }
    return String(value);
};

// Utiliser dans l'affichage
<Text style={styles.productServiceName} numberOfLines={1}>
    {extractStringValue(product.serviceTitre) || 'Service sans titre'}
</Text>
```

**Fichier à modifier :** `mobile/src/screens/MesProduitsScreen.tsx` (ligne 1535)

---

### 5. Métriques à 0 (Views, Shares, Likes)

**Problème visible :**
- Toutes les métriques affichent 0
- Views: 0, Shares: 0, Likes: 0

**Cause identifiée :**
```typescript
// Lignes 430-448 dans MesProduitsScreen.tsx
const views = Number(
    normalizedProduct.views
    ?? normalizedProduct.stats?.views
    ?? normalizedProduct.analytics?.views
    ?? 0
);
```

**Problème :**
- Les métriques ne sont probablement pas stockées dans les produits
- Elles doivent être récupérées depuis une table séparée (products_lifecycle ou analytics)

**Solution :**
```typescript
// Récupérer les métriques depuis products_lifecycle ou analytics
// Modifier le backend pour inclure les métriques dans la réponse
// OU faire une requête séparée pour charger les métriques
```

**Fichier à modifier :**
- Backend : `backend/src/controllers/service_controller.rs` - Inclure métriques dans réponse
- Mobile : `mobile/src/screens/MesProduitsScreen.tsx` - Charger métriques séparément si nécessaire

---

## 📋 CHECKLIST DES CORRECTIONS

### Corrections Critiques
- [ ] **1.1** Corriger normalisation nom produit (ne pas mettre chaîne vide)
- [ ] **1.2** Améliorer extraction nom produit depuis objets structurés
- [ ] **1.3** Améliorer affichage nom avec trim() et vérification
- [ ] **2.1** Créer fonction extractServiceTitre robuste
- [ ] **2.2** Corriger affichage serviceTitre (éviter JSON brut)
- [ ] **3.1** Améliorer extraction catégorie depuis objets structurés
- [ ] **3.2** Ne pas utiliser 'autre' par défaut, utiliser null
- [ ] **4.1** Créer fonction extractStringValue pour éviter JSON brut
- [ ] **4.2** Appliquer extractStringValue partout où nécessaire
- [ ] **5.1** Inclure métriques dans réponse backend
- [ ] **5.2** Charger métriques si nécessaire côté mobile

---

## 🔧 CODE DE CORRECTION DÉTAILLÉ

### Correction 1 : Normalisation nom produit

```typescript
// AVANT (lignes 294-305)
const nomNormalized = normalizeProductField(product.nom);
const nomProduitNormalized = normalizeProductField(product.nom_produit);
if (nomNormalized !== undefined) normalizedProduct.nom = nomNormalized;
if (nomProduitNormalized !== undefined) normalizedProduct.nom_produit = nomProduitNormalized;
if (!normalizedProduct.nom && normalizedProduct.nom_produit) {
    normalizedProduct.nom = normalizedProduct.nom_produit;
}
if (!normalizedProduct.nom && !normalizedProduct.nom_produit) {
    normalizedProduct.nom = '';  // ❌ PROBLÈME
    normalizedProduct.nom_produit = '';
}

// APRÈS
const nomNormalized = normalizeProductField(product.nom);
const nomProduitNormalized = normalizeProductField(product.nom_produit);
if (nomNormalized !== undefined && nomNormalized !== null && String(nomNormalized).trim()) {
    normalizedProduct.nom = String(nomNormalized).trim();
}
if (nomProduitNormalized !== undefined && nomProduitNormalized !== null && String(nomProduitNormalized).trim()) {
    normalizedProduct.nom_produit = String(nomProduitNormalized).trim();
}
// ✅ CORRIGÉ: Utiliser nom_produit comme fallback pour nom
if ((!normalizedProduct.nom || !normalizedProduct.nom.trim()) && normalizedProduct.nom_produit?.trim()) {
    normalizedProduct.nom = normalizedProduct.nom_produit.trim();
}
// ✅ CORRIGÉ: Ne pas définir si vide, laisser undefined pour que le fallback fonctionne
// Ne pas faire: normalizedProduct.nom = '';
```

### Correction 2 : Extraction serviceTitre

```typescript
// AVANT (ligne 243)
const serviceTitre = service.data?.titre_service?.valeur || service.titre || 'Service sans titre';

// APRÈS
const extractServiceTitre = (service: any): string => {
    // Essayer titre_service.valeur (format structuré)
    if (service.data?.titre_service?.valeur) {
        const val = service.data.titre_service.valeur;
        if (typeof val === 'string' && val.trim()) {
            return val.trim();
        }
    }
    // Essayer titre_service directement (string)
    if (service.data?.titre_service) {
        const val = service.data.titre_service;
        if (typeof val === 'string' && val.trim()) {
            return val.trim();
        }
    }
    // Essayer titre
    if (service.titre) {
        const val = service.titre;
        if (typeof val === 'string' && val.trim()) {
            return val.trim();
        }
    }
    // Essayer data.titre
    if (service.data?.titre) {
        const val = service.data.titre;
        if (typeof val === 'string' && val.trim()) {
            return val.trim();
        }
    }
    return 'Service sans titre';
};

const serviceTitre = extractServiceTitre(service);
```

### Correction 3 : Extraction catégorie

```typescript
// AVANT (lignes 32-40)
const normalizeCategoryKey = (product: Record<string, any>): string => {
    const raw = product?.categorie_produit
        ?? product?.categorie
        ?? product?.category
        ?? product?.type
        ?? product?.serviceCategorie
        ?? 'autre';
    return String(raw).trim().toLowerCase();
};

// APRÈS
const normalizeCategoryKey = (product: Record<string, any>): string | null => {
    const extractValue = (field: any): string | null => {
        if (!field) return null;
        if (typeof field === 'string') {
            const trimmed = field.trim();
            return trimmed.length > 0 ? trimmed : null;
        }
        if (typeof field === 'object' && field !== null) {
            // Format structuré {valeur: "...", type_donnee: "..."}
            if ('valeur' in field) {
                const val = field.valeur;
                if (typeof val === 'string') {
                    const trimmed = val.trim();
                    return trimmed.length > 0 ? trimmed : null;
                }
            }
        }
        return null;
    };

    const raw = extractValue(product?.categorie_produit)
        ?? extractValue(product?.categorie)
        ?? extractValue(product?.category)
        ?? extractValue(product?.type)
        ?? extractValue(product?.serviceCategorie);

    return raw ? raw.toLowerCase() : null;
};
```

### Correction 4 : Fonction helper extractStringValue

```typescript
// Ajouter au début du fichier
const extractStringValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        // Éviter d'afficher des objets JSON stringifiés
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (typeof parsed === 'object' && parsed !== null) {
                    // Si c'est un objet structuré, extraire la valeur
                    if ('valeur' in parsed && typeof parsed.valeur === 'string') {
                        return parsed.valeur.trim();
                    }
                    // Sinon, ne pas afficher l'objet
                    return '';
                }
            } catch {
                // Ce n'est pas du JSON, retourner tel quel
            }
        }
        return trimmed;
    }
    if (typeof value === 'object' && value !== null) {
        // Format structuré {valeur: "...", type_donnee: "..."}
        if ('valeur' in value && typeof value.valeur === 'string') {
            return value.valeur.trim();
        }
        // Éviter d'afficher [object Object]
        return '';
    }
    return String(value);
};

// Utiliser dans l'affichage
<Text style={styles.productServiceName} numberOfLines={1}>
    {extractStringValue(product.serviceTitre) || 'Service sans titre'}
</Text>
```

---

## 📊 PROBLÈMES IDENTIFIÉS DANS LES LOGS

### Logs pertinents trouvés

1. **Normalisation produits :** Les logs montrent que les produits sont normalisés mais il peut y avoir des problèmes d'extraction
2. **Format produits :** Les logs montrent différents formats (listeproduit, array direct, valeur)
3. **Pas de logs spécifiques** pour "Produit sans nom" ou JSON brut, mais les problèmes sont visibles dans le code

---

## 🎯 PLAN D'ACTION

### Phase 1 : Corrections Immédiates (Priorité 1)
1. **Corriger normalisation nom produit** - Ne pas mettre chaîne vide
2. **Créer extractServiceTitre** - Éviter JSON brut
3. **Créer extractStringValue** - Helper pour tous les champs
4. **Améliorer extraction catégorie** - Ne pas utiliser 'autre' par défaut

### Phase 2 : Améliorations (Priorité 2)
5. **Inclure métriques dans backend** - Views, shares, saves
6. **Améliorer normalisation globale** - Tous les champs produits
7. **Ajouter validation** - Vérifier que les données sont correctes avant affichage

### Phase 3 : Tests (Priorité 3)
8. **Tester avec différents formats** - listeproduit, array, valeur
9. **Tester avec produits vides** - Nom vide, description vide
10. **Tester affichage** - Vérifier que tout s'affiche correctement

---

## 📝 FICHIERS À MODIFIER

### Mobile
1. `mobile/src/screens/MesProduitsScreen.tsx`
   - Lignes 32-40 : `normalizeCategoryKey`
   - Lignes 243 : Extraction `serviceTitre`
   - Lignes 294-305 : Normalisation nom produit
   - Ligne 1518 : Affichage nom produit
   - Ligne 1535 : Affichage serviceTitre
   - Ligne 1542 : Affichage catégorie

---

## 🔍 VÉRIFICATIONS À EFFECTUER

1. **Vérifier format données backend** - Comment les données sont envoyées
2. **Vérifier normalisation** - Tous les champs sont-ils correctement normalisés ?
3. **Vérifier affichage** - Tous les champs s'affichent-ils correctement ?
4. **Tester avec données réelles** - Produits créés via différents écrans

---

## 📚 RÉFÉRENCES

- Code analysé : `mobile/src/screens/MesProduitsScreen.tsx`
- Backend : `backend/src/controllers/service_controller.rs`
- Image fournie : Capture d'écran Mes Services

