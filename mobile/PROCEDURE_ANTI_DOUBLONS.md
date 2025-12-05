# 🔍 Procédure Anti-Doublons - Guide de Vérification

## ⚠️ RÈGLE D'OR
**TOUJOURS vérifier l'existence d'un fichier/composant AVANT de le créer**

---

## 📋 Checklist Obligatoire Avant Création

### 1. Recherche Globale de Fichiers
```bash
# Vérifier avec glob_file_search
glob_file_search **/NomFichier.tsx
glob_file_search **/NomFichier.ts
glob_file_search **/nomFichier.*
```

### 2. Recherche Sémantique dans le Code
```bash
# Chercher des fonctionnalités similaires
codebase_search query="fonctionnalité recherchée"
grep -r "nomFonction" mobile/src
grep -r "nomComposant" mobile/src
```

### 3. Vérifier les Dossiers Standards
- ✅ `mobile/src/components/`
- ✅ `mobile/src/services/`
- ✅ `mobile/src/hooks/`
- ✅ `mobile/src/utils/`
- ✅ `mobile/src/contexts/`

### 4. Vérifier les Fichiers Index
- ✅ `mobile/src/components/ux/index.ts`
- ✅ `mobile/src/components/index.ts` (si existe)
- ✅ Autres fichiers index.ts dans les dossiers

### 5. Vérifier les Imports Existants
```bash
# Chercher où le composant est déjà importé
grep -r "import.*NomComposant" mobile/src
grep -r "from.*NomComposant" mobile/src
```

---

## 🎯 Exemples de Vérifications Réussies

### ✅ Exemple 1: ScreenTransition
**Avant création**:
- ✅ Trouvé: `mobile/src/components/ScreenTransition.tsx` existe
- ✅ Action: Utiliser le fichier existant
- ✅ Résultat: Pas de doublon créé

### ✅ Exemple 2: ShareService
**Avant création**:
- ✅ Trouvé: `mobile/src/components/ShareServiceModal.tsx` existe
- ✅ Trouvé: Fonctionnalités de partage déjà implémentées
- ✅ Action: Utiliser les composants existants
- ✅ Résultat: Pas de doublon créé

### ❌ Exemple 3: shareService.ts (Corrigé)
**Avant création**:
- ❌ Non vérifié initialement
- ✅ Détecté après: `mobile/src/services/shareService.ts` existe
- ✅ Action: Fichier supprimé, utilisation de l'existant

---

## 📝 Template de Vérification

### Avant de créer `NouveauComposant.tsx`:

```markdown
## Vérification: NouveauComposant.tsx

1. **Recherche fichiers**:
   - [ ] glob_file_search **/NouveauComposant.tsx
   - [ ] glob_file_search **/nouveauComposant.tsx
   - [ ] glob_file_search **/NouveauComposant.*

2. **Recherche code**:
   - [ ] codebase_search "fonctionnalité similaire"
   - [ ] grep -r "NouveauComposant" mobile/src
   - [ ] grep -r "nouveauComposant" mobile/src

3. **Vérification dossiers**:
   - [ ] mobile/src/components/
   - [ ] mobile/src/services/
   - [ ] mobile/src/hooks/

4. **Vérification imports**:
   - [ ] grep -r "import.*NouveauComposant" mobile/src
   - [ ] Vérifier index.ts

5. **Résultat**:
   - [ ] ✅ N'existe pas → CRÉER
   - [ ] ✅ Existe → UTILISER/AMÉLIORER
```

---

## 🚨 Signaux d'Alerte

### Si vous voyez ces patterns, VÉRIFIER :

1. **Noms similaires**
   - `ShareService` vs `ShareServiceModal` vs `shareService`
   - `ScreenTransition` vs `ScreenTransitions` vs `Transition`

2. **Fonctionnalités similaires**
   - Partage social → Vérifier `ShareServiceModal`, `ExternalServiceShare`
   - Cache/Offline → Vérifier `offlineService`, `cacheService`
   - Notifications → Vérifier `pushNotificationService`, `NotificationManager`

3. **Emplacements multiples**
   - Composant dans `components/` ET `components/ux/`
   - Service dans `services/` ET `utils/`

---

## ✅ Actions Correctes

### Si le fichier EXISTE déjà :

1. **Lire le fichier existant**
   ```typescript
   read_file target_file="chemin/existant.tsx"
   ```

2. **Évaluer les fonctionnalités**
   - ✅ Déjà complet → Utiliser tel quel
   - ⚠️ Partiel → Améliorer le fichier existant
   - ❌ Incomplet → Étendre le fichier existant

3. **Mettre à jour les exports**
   ```typescript
   // Dans index.ts
   export { ComposantExistant } from './ComposantExistant';
   ```

4. **NE PAS créer de doublon**

### Si le fichier N'EXISTE PAS :

1. **Créer le fichier**
2. **Ajouter aux exports** (index.ts)
3. **Documenter dans le rapport**

---

## 📊 Statistiques de Vérification

### Fichiers Créés (Vérifiés - Pas de Doublons)
- ✅ `EmptyState.tsx` - Unique
- ✅ `RippleButton.tsx` - Unique
- ✅ `EnhancedSkeletonLoader.tsx` - Unique
- ✅ `SwipeableCard.tsx` - Unique
- ✅ `OfflineIndicator.tsx` - Unique
- ✅ `AnalyticsCard.tsx` - Unique
- ✅ `offlineService.ts` - Unique
- ✅ `imagePrefetchService.ts` - Unique
- ✅ `pushNotificationService.ts` - Unique
- ✅ `mlRecommendationService.ts` - Unique

### Fichiers Utilés (Existants)
- ✅ `ScreenTransition.tsx` - Existant, utilisé
- ✅ `ShareServiceModal.tsx` - Existant, utilisé

### Fichiers Supprimés (Doublons)
- ❌ `mobile/src/components/ux/ScreenTransition.tsx` - Doublon supprimé
- ❌ `mobile/src/services/shareService.ts` - Doublon supprimé

---

## 🎓 Leçons Apprises

1. **Toujours vérifier AVANT de créer**
2. **Utiliser glob_file_search systématiquement**
3. **Chercher les fonctionnalités similaires**
4. **Vérifier les imports existants**
5. **Documenter les décisions**

---

## 🔄 Processus Recommandé

```
1. IDÉE → Nouveau composant/service
2. VÉRIFICATION → glob_file_search + codebase_search
3. DÉCISION → Créer OU Utiliser existant
4. ACTION → Implémentation
5. VÉRIFICATION FINALE → Linter + Tests
6. DOCUMENTATION → Rapport
```

---

**Règle d'or**: **En cas de doute, VÉRIFIER plutôt que CRÉER** ✅

