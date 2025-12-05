# ⚠️ Fonctionnalités Manquantes - Wizard vs ProductVideoCreationModal

## ✅ Fonctionnalités Déjà Présentes

1. ✅ **Studio Sessions** - `ensureStudioSession()`
2. ✅ **Storyboard IA via Studio** - `handleGenerateStoryboard()`
3. ✅ **Short Preview** - `handleShortPreview()`
4. ✅ **CreatorStudioCard** - Intégré étape 1
5. ✅ **Chaînage vidéos** - `dependencies`, `selectedLinkedSessions`, `setDependencies()`
6. ✅ **Estimation coût** - `handleEstimateCost()`
7. ✅ **Sauvegarde brouillon** - `loadVideoDraft()`, `saveVideoDraft()`, `clearVideoDraft()`
8. ✅ **VideoProgressModal** - Présent (via `useVideoGenerationProgress`)

---

## ❌ Fonctionnalités Manquantes Identifiées

### 1. **Auto-Storyboard Toggle** ❌
**Wizard:**
```typescript
const [autoStoryboard, setAutoStoryboard] = useState(true);
// Switch dans UI étape 1
<Switch value={autoStoryboard} onValueChange={setAutoStoryboard} />
// Utilisé dans payload:
auto_storyboard: autoStoryboard,
```

**ProductVideoCreationModal:** ❌ Absent
- Pas de toggle pour auto-storyboard
- Le storyboard est généré manuellement via bouton

**Impact:** Moyen - Peut être ajouté comme option

---

### 2. **Mode Standard/Expert** ❌
**Wizard:**
```typescript
const [mode, setMode] = useState<ModePreset>('standard');
// Utilisé dans payload:
use_ai_templates: mode === 'expert',
use_service_mediatech: mode === 'expert',
include_publicite_assets: mode === 'expert',
```

**ProductVideoCreationModal:** ⚠️ Partiel
- `use_service_mediatech` existe mais pas de mode global
- Pas de toggle mode standard/expert
- Options avancées gérées individuellement

**Impact:** Faible - Déjà géré via toggles individuels

---

### 3. **Scene Assignments Explicites** ❌
**Wizard:**
```typescript
const [sceneAssignments, setSceneAssignments] = useState<Record<string, number | null>>({});
const assignMediaToScene = useCallback((sceneId: string, mediaId: number | null) => {
    setSceneAssignments(prev => ({ ...prev, [sceneId]: mediaId }));
}, []);
```

**ProductVideoCreationModal:** ❌ Absent
- Géré via timeline mais pas de mapping explicite scène → média
- Pas de fonction `assignMediaToScene`

**Impact:** Moyen - Peut être nécessaire pour compatibilité

---

### 4. **Scenes Draft avec Optional** ❌
**Wizard:**
```typescript
type SceneDraft = { id: string; optional: boolean; };
const [scenesDraft, setScenesDraft] = useState<SceneDraft[]>([]);
const toggleSceneOptional = useCallback((sceneId: string) => {
    setScenesDraft(prev => prev.map(scene =>
        scene.id === sceneId ? { ...scene, optional: !scene.optional } : scene
    ));
}, []);
```

**ProductVideoCreationModal:** ❌ Absent
- Timeline gère les scènes mais pas de flag `optional`
- Pas de fonction `toggleSceneOptional`

**Impact:** Faible - Peut être géré via timeline editor

---

### 5. **Navigation entre Scènes** ❌
**Wizard:**
```typescript
const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);
// Navigation entre scènes pour assigner médias
```

**ProductVideoCreationModal:** ❌ Absent
- Pas de navigation explicite entre scènes
- Géré via timeline editor

**Impact:** Faible - Déjà géré différemment

---

### 6. **Auto-Assign Médias aux Scènes** ❌
**Wizard:**
```typescript
// Auto-assign de médias par défaut aux scènes (réduction de gestes)
useEffect(() => {
    // Assignation automatique circulaire des médias aux scènes
    let mediaIndex = 0;
    for (const scene of scenesDraft) {
        const mediaId = uniqueMediaIds[mediaIndex % uniqueMediaIds.length];
        next[scene.id] = mediaId;
        mediaIndex += 1;
    }
}, [mediaItems, scenesDraft]);
```

**ProductVideoCreationModal:** ❌ Absent
- Pas d'assignation automatique
- Médias sélectionnés manuellement

**Impact:** Faible - UX différente mais fonctionnelle

---

### 7. **Tracking UX (trackUxEvent)** ❌
**Wizard:**
```typescript
import { trackUxEvent } from '../../services/uxMetrics';
trackUxEvent('wizard_open', { device: 'mobile', serviceId, productIndex, step });
trackUxEvent('storyboard_generate_click', { ... });
trackUxEvent('preview_short_click', { ... });
```

**ProductVideoCreationModal:** ❌ Absent
- Pas de tracking UX
- Pas d'analytics

**Impact:** Moyen - Important pour analytics mais pas bloquant

---

### 8. **Completed Steps Tracking** ❌
**Wizard:**
```typescript
const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
const markStepCompleted = useCallback((stepNum: WizardStep) => {
    setCompletedSteps(prev => new Set([...prev, stepNum]));
}, []);
```

**ProductVideoCreationModal:** ❌ Absent
- Pas de tracking des étapes complétées
- Indicateur d'étapes visuel mais pas de state

**Impact:** Faible - Nice to have

---

### 9. **Prewarmed Short Preview** ❌
**Wizard:**
```typescript
const [prewarmedShortPreviewUrl, setPrewarmedShortPreviewUrl] = useState<string | undefined>();
// Si prewarmed existe, l'utiliser directement
if (prewarmedShortPreviewUrl) {
    Linking.openURL(prewarmedShortPreviewUrl);
    setShortPreviewStarted(true);
    return;
}
```

**ProductVideoCreationModal:** ❌ Absent
- Pas de prewarming
- Génération à la demande

**Impact:** Faible - Optimisation, pas critique

---

### 10. **Templates Narratifs Serveur** ⚠️
**Wizard:**
```typescript
const [storyTemplates, setStoryTemplates] = useState<StoryTemplateSpec[]>([]);
// Chargement depuis serveur
const templates = await studioService.listTemplates();
setStoryTemplates(templates);
```

**ProductVideoCreationModal:** ⚠️ Partiel
- Templates locaux seulement
- Pas de chargement depuis serveur via `studioService.listTemplates()`

**Impact:** Moyen - Peut être ajouté

---

## 📊 Résumé

### Fonctionnalités Critiques Manquantes 🔴
- **Aucune** - Toutes les fonctionnalités critiques sont présentes

### Fonctionnalités Importantes Manquantes 🟡
1. **Auto-Storyboard Toggle** - Impact moyen
2. **Scene Assignments Explicites** - Impact moyen (mais géré différemment)
3. **Tracking UX** - Impact moyen (analytics)
4. **Templates Narratifs Serveur** - Impact moyen

### Fonctionnalités Non-Critiques Manquantes 🟢
5. **Mode Standard/Expert** - Déjà géré via toggles
6. **Scenes Draft avec Optional** - Géré via timeline
7. **Navigation entre Scènes** - Géré via timeline editor
8. **Auto-Assign Médias** - UX différente mais fonctionnelle
9. **Completed Steps Tracking** - Nice to have
10. **Prewarmed Short Preview** - Optimisation

---

## ✅ Conclusion

**ProductVideoCreationModal contient TOUTES les fonctionnalités critiques du Wizard.**

Les fonctionnalités manquantes sont soit :
- Déjà gérées différemment (timeline vs scenes draft)
- Non-critiques (tracking, optimisations)
- Peuvent être ajoutées facilement (auto-storyboard toggle, templates serveur)

**Recommandation:** ✅ ProductVideoCreationModal est complet pour l'usage principal. Les fonctionnalités manquantes peuvent être ajoutées progressivement si nécessaire.

---

**Date:** 2025-01-27  
**Statut:** ✅ Vérification complète - Aucune fonctionnalité critique manquante


