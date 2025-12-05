# 🔍 Vérification Préalable : Watermark & IA Générative

**Date** : 2025-01-27  
**Objectif** : Documenter l'existant avant d'implémenter les fonctionnalités de la Phase 1

---

## 📋 Résumé Exécutif

| Fonctionnalité | État | Action Requise |
|---------------|------|----------------|
| **Watermark/Signature Vidéo** | ❌ N'existe pas | ✅ À implémenter |
| **IA Générative (Text-to-Video)** | ⚠️ Partiel | ⚠️ Extension nécessaire |

---

## 1. 🔍 Watermark/Signature Vidéo

### 1.1 Recherche Effectuée

**Fichiers recherchés** :
- `watermark_service.rs` ❌ **N'existe pas**
- `signature_service.rs` ✅ **Existe** (mais usage différent)

**Patterns recherchés** :
- `watermark`, `Watermark`, `WATERMARK` → Seulement dans documentation
- `ffmpeg.*overlay`, `logo.*video`, `branding.*video` → Aucun résultat

### 1.2 Analyse de l'Existant

#### ✅ `backend/src/services/signature_service.rs`
- **Fonction** : Génération de signatures HMAC pour URLs partagées (sécurité)
- **Usage** : Liens sécurisés pour services partagés avec expiration
- **Conclusion** : ❌ **PAS un watermark vidéo** - Usage différent

#### ✅ `backend/src/services/remotion_renderer_service.rs`
- **Fonction** : Service de rendu vidéo via Remotion
- **Méthode** : Utilise Node.js + Remotion CLI pour générer des vidéos
- **Watermark** : ❌ **Aucune mention de watermark** dans le code
- **Extension possible** : ✅ Peut être étendu pour ajouter watermark

#### ✅ Infrastructure de Rendu
- **Service principal** : `video_generation_service.rs` (4080 lignes)
- **Rendu** : Via Remotion (backend)
- **Pistes FFmpeg** : Aucune utilisation directe de FFmpeg pour watermark visible

### 1.3 Conclusion Watermark

**STATUT** : ❌ **Aucun système de watermark vidéo n'existe**

**Actions requises** :
1. ✅ Créer `backend/src/services/watermark_service.rs`
2. ✅ Intégrer dans le pipeline de rendu Remotion
3. ✅ Ajouter option dans `ExportSettings`
4. ✅ Créer/assets logo Yukpo (PNG transparent)

---

## 2. 🤖 IA Générative (Text-to-Video)

### 2.1 Recherche Effectuée

**Fichiers recherchés** :
- `generative_video_service.rs` ❌ **N'existe pas**
- `video_generation_service.rs` ✅ **Existe** (mais usage différent)
- `broll_service.rs` ✅ **Existe** (support IA partiel)

**Patterns recherchés** :
- `text.*to.*video`, `generate.*video`, `runway`, `pika`, `sora`
- Résultats : Infrastructure partielle trouvée

### 2.2 Analyse de l'Existant

#### ⚠️ `backend/src/services/broll_service.rs` (531 lignes)

**Fonctionnalités existantes** :
- ✅ Support pour **Runway**, **Pika**, **Sora** configuré
- ✅ Enum `BrollSource` avec variantes :
  ```rust
  pub enum BrollSource {
      YukpoLibrary,
      ExternalStock,
      GenerativeAIRunway,    // ✅ Existe
      GenerativeAIPika,      // ✅ Existe
      GenerativeAISora,      // ✅ Existe
  }
  ```
- ✅ Méthode `request_generative_clip()` pour générer des clips b-roll
- ✅ Configuration dans `backend/src/config/broll_config.rs`

**Limitations** :
- ⚠️ **Uniquement pour b-rolls** (clips courts, 3-5 secondes)
- ❌ **PAS pour génération vidéo complète** text-to-video
- ❌ Pas d'endpoint dédié pour text-to-video complet

#### ⚠️ `backend/src/services/video_generation_service.rs`

**Fonctionnalités** :
- ✅ Génération vidéo depuis produits/services (`generate_product_video`)
- ✅ Génération brief/style/timeline avec IA
- ❌ **PAS de génération vidéo pure text-to-video**

#### ⚠️ Configuration IA

**Variables d'environnement configurées** :
- ✅ `RUNWAY_API_URL`
- ✅ `RUNWAY_API_KEY`
- ✅ `PIKA_API_URL` (mentionné dans docs)
- ✅ `PIKA_API_KEY` (mentionné dans docs)

**Fichier** : `backend/src/config/broll_config.rs`
```rust
pub struct BrollAIConfig {
    pub runway_endpoint: Option<String>,
    pub runway_api_key: Option<String>,
    pub pika_endpoint: Option<String>,
    pub pika_api_key: Option<String>,
    pub sora_endpoint: Option<String>,
    pub sora_api_key: Option<String>,
}
```

### 2.3 Endpoints Existants

**Endpoints IA vidéo existants** :
- ✅ `POST /api/media/generate-video-brief` → Génère brief avec IA
- ✅ `POST /api/media/generate-video-style` → Génère style avec IA
- ✅ `POST /api/media/generate-video-timeline` → Génère timeline avec IA
- ✅ `POST /api/media/product/{service_id}/{product_index}/generate-video` → Génère vidéo depuis produit

**Endpoints manquants** :
- ❌ `POST /api/ia/generate-video` → **N'existe pas** (text-to-video complet)
- ❌ `POST /api/generative/video` → **N'existe pas**

### 2.4 Conclusion IA Générative

**STATUT** : ⚠️ **Infrastructure partielle existe, mais incomplète**

**Ce qui existe** :
- ✅ Infrastructure pour Runway/Pika/Sora (b-rolls uniquement)
- ✅ Configuration et variables d'environnement
- ✅ Service `broll_service.rs` pour clips courts

**Ce qui manque** :
- ❌ Service dédié `generative_video_service.rs` pour text-to-video complet
- ❌ Endpoint dédié pour génération vidéo complète à partir de texte
- ❌ Intégration dans le workflow principal de création vidéo
- ❌ UI `GenerativeVideoWizard.tsx` pour input texte

**Actions requises** :
1. ⚠️ **Réutiliser** l'infrastructure existante (Runway/Pika config)
2. ✅ **Étendre** `broll_service.rs` ou créer `generative_video_service.rs`
3. ✅ Créer endpoint dédié pour text-to-video complet
4. ✅ Intégrer dans workflow de création vidéo

---

## 3. 📊 Comparaison avec Prompt Leadership

| Exigence Prompt | État Actuel | Action |
|-----------------|-------------|--------|
| **Watermark automatique** | ❌ Absent | ✅ Implémenter (Phase 1.0) |
| **IA Générative text-to-video** | ⚠️ Partiel (b-rolls) | ⚠️ Étendre (Phase 3.1) |

---

## 4. 🎯 Plan d'Action Phase 1

### 4.1 Priorité 1 : Watermark (Semaine 0)

**Fichiers à créer** :
1. `backend/src/services/watermark_service.rs`
2. `backend/assets/logo/yukpo_logo.png` (à créer)
3. `mobile/src/types/ExportSettings.ts` (ajouter option)
4. `mobile/src/components/ExportSettingsPanel.tsx` (toggle)

**Fichiers à modifier** :
1. `backend/src/services/remotion_renderer_service.rs` (intégrer watermark)
2. `backend/src/services/video_generation_service.rs` (appeler watermark service)
3. `backend/src/routes/video_routes.rs` (si nécessaire)

### 4.2 Priorité 2 : IA Générative (Phase 3, après vérification)

**Note** : L'infrastructure existe partiellement. Avant d'implémenter Phase 3.1 :
- ✅ Vérifier fonctionnement actuel de Runway/Pika dans `broll_service.rs`
- ✅ Tester génération b-roll avec API réelle
- ✅ Documenter limitations actuelles
- ⏳ **Puis** étendre pour text-to-video complet

---

## 5. ✅ Validation

- [x] Recherche watermark effectuée
- [x] Recherche IA générative effectuée
- [x] Analyse code existant complétée
- [x] Documentation créée
- [ ] **Prochaine étape** : Implémenter Phase 1.0 (Watermark)

---

## 📝 Notes

- Le `signature_service.rs` est pour la sécurité, pas pour watermark vidéo
- L'infrastructure IA existe mais est limitée aux b-rolls
- Le rendu se fait via Remotion, pas FFmpeg direct
- Intégration watermark devra se faire dans le pipeline Remotion ou post-rendu

**Date de vérification** : 2025-01-27  
**Prochaine révision** : Après implémentation Phase 1.0


