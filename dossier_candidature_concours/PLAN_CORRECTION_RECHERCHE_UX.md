# 📋 Plan de Correction - Recherche et UX ProductCard

## 🔍 PROBLÈME 1: Performance de recherche très lente

### Diagnostic
- Les requêtes SQL utilisent `ILIKE '%terme%'` sur des champs JSONB → **très lent** (scans complets)
- La requête dans `rechercher_besoin.rs` utilise `CROSS JOIN` et `LEFT JOIN LATERAL` → coûteux
- Pas de LIMIT dans certaines requêtes → retourne trop de résultats
- Les index GIN existent mais ne sont pas utilisés efficacement

### Solution
1. **Remplacer ILIKE par recherche full-text PostgreSQL (tsvector)**
   - Utiliser `to_tsvector('french', ...)` et `@@ plainto_tsquery('french', ...)`
   - Créer index GIN sur tsvector
   - Prioriser correspondances exactes avec `ts_rank`

2. **Optimiser la requête CTE dans `rechercher_besoin.rs`**
   - Ajouter LIMIT dès le début
   - Utiliser index GIN pour JSONB au lieu de scans
   - Éviter CROSS JOIN, utiliser EXISTS à la place

3. **Ajouter LIMIT et pagination**
   - Limiter à 50 résultats par défaut
   - Pagination côté serveur

---

## 🎯 PROBLÈME 2: Résultats de recherche non pertinents

### Diagnostic
- Recherche "électricien" retourne d'autres produits
- Le scoring ne priorise pas les correspondances exactes
- Les termes de recherche sont trop larges (patterns `%terme%`)

### Solution
1. **Améliorer le scoring**
   - Bonus élevé pour correspondance exacte dans `titre_service`
   - Bonus moyen pour correspondance dans `category`
   - Bonus faible pour correspondance dans `description`
   - Pénalité pour correspondances partielles

2. **Filtrage par catégorie intelligent**
   - Détecter les catégories dans la requête ("électricien" → catégorie "électricité")
   - Filtrer par catégorie en priorité

3. **Améliorer l'extraction de termes**
   - Nettoyer les stop words ("un", "le", "de", etc.)
   - Extraire les mots-clés pertinents

---

## 📱 PROBLÈME 3: ProductCard trop grande (UX)

### Diagnostic
- Beaucoup d'espace vide vertical
- Paddings/marges trop grands
- Tailles de police trop grandes
- Hauteur de carte non optimisée

### Solution
1. **Réduire les paddings/marges**
   - `paddingHorizontal`: 16 → 12
   - `paddingVertical`: 14 → 10
   - `gap`: 10 → 6
   - `marginBottom`: 12 → 8

2. **Réduire les tailles de police**
   - `productName`: 16 → 15
   - `sectionTitle`: 15 → 14
   - `price`: 20 → 18
   - `actionButtonText`: 14 → 13

3. **Réduire les hauteurs**
   - `imageContainer`: 160 → 140
   - `avatar`: 30 → 26
   - `topStatPillCompact`: padding 6/3 → 5/2

4. **Optimiser l'espacement**
   - Réduire gaps entre sections
   - Compacter les badges et chips
   - Réduire espacement dans les rows

---

## 🔄 PROBLÈME 4: MixedContentCarousel dans HomeScreen

### Diagnostic
- MixedContentCarousel utilise bien ProductCard
- Tous les props sont passés correctement
- ✅ Pas de problème identifié

### Solution
- Vérifier que tous les boutons/fonctionnalités s'affichent
- S'assurer que le scroll horizontal fonctionne bien

---

## 📊 PROBLÈME 5: Autres problèmes dans les logs

### Diagnostic
- Requêtes SQL lentes (51ms, 100ms pour certaines)
- Pas de logs de recherche dans logbackend2.md (peut-être pas de recherche testée)
- WebSocket timeout (85126ms = 85s) - ligne 124

### Solution
1. **Optimiser les requêtes lentes**
   - Ajouter index manquants
   - Optimiser les JOINs

2. **Corriger timeout WebSocket**
   - Ajouter timeout plus court
   - Gérer reconnexion automatique

---

## 🚀 PLAN D'IMPLÉMENTATION

### Phase 1: Optimisation recherche (Priorité HAUTE)
1. Créer migration SQL pour index tsvector
2. Modifier `rechercher_besoin.rs` pour utiliser tsvector
3. Modifier `native_search_service.rs` pour améliorer scoring
4. Ajouter LIMIT et pagination

### Phase 2: Miniaturisation ProductCard (Priorité HAUTE)
1. Réduire tous les paddings/marges
2. Réduire tailles de police
3. Réduire hauteurs
4. Tester visuellement

### Phase 3: Amélioration pertinence (Priorité MOYENNE)
1. Améliorer scoring
2. Ajouter filtrage catégorie intelligent
3. Améliorer extraction termes

### Phase 4: Corrections autres problèmes (Priorité BASSE)
1. Optimiser requêtes lentes
2. Corriger timeout WebSocket

---

## ✅ VALIDATION

### Tests à effectuer
1. **Performance recherche**
   - Recherche "électricien" doit être < 500ms
   - Résultats pertinents en premier

2. **UX ProductCard**
   - Hauteur réduite de ~30%
   - Tous les boutons/infos visibles
   - Design professionnel et compact

3. **MixedContentCarousel**
   - Scroll horizontal fonctionne
   - Toutes fonctionnalités ProductCard disponibles

