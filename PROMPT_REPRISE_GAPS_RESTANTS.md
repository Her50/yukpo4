# 🚀 PROMPT DE REPRISE - GAPS TECHNIQUES RESTANTS YUKPOMNANG

## 📋 CONTEXTE DU PROJET

**Yukpomnang** est une plateforme de services locaux avec :
- **Backend** : Rust + Axum + SQLx + PostgreSQL (Render)
- **Frontend** : React + TypeScript + TailwindCSS
- **Mobile** : Expo + React Native + TypeScript
- **Video Pipeline** : Remotion worker (GPU Hetzner) + S3/Wasabi
- **Monitoring** : Prometheus + Grafana (Docker Compose)
- **Infrastructure** : VM Hetzner (Ubuntu) + Docker Compose

---

## ✅ VÉRIFICATIONS PRÉALABLES OBLIGATOIRES

**⚠️ IMPORTANT : Vérifier systématiquement ces points AVANT toute intégration ou modification**

### 1. État des services Docker (VM Hetzner)

```bash
# Se connecter à la VM
ssh root@<IP_HETZNER>
cd /opt/yukpo

# Vérifier que tous les services sont UP
docker compose ps

# Vérifier les logs pour erreurs critiques
docker compose logs backend --tail=50 | grep -i error
docker compose logs frontend --tail=50 | grep -i error
docker compose logs prometheus --tail=20
docker compose logs grafana --tail=20

# Vérifier santé backend
curl http://localhost:3001/healthz
# Doit retourner: {"status":"ok"} ou 200 OK

# Vérifier métriques Prometheus
curl http://localhost:3001/metrics
# Doit retourner des métriques Prometheus (pas d'erreur 404/500)
```

**✅ Checklist :**
- [ ] Tous les services sont `Up` (backend, frontend, prometheus, grafana)
- [ ] Backend répond sur `/healthz`
- [ ] Endpoint `/metrics` retourne des métriques (pas d'erreur)
- [ ] Aucune erreur critique dans les logs

---

### 2. Base de données PostgreSQL (Render)

```bash
# Tester connexion depuis VM
docker compose exec backend psql $DATABASE_URL -c "SELECT version();"

# Vérifier migrations appliquées
docker compose exec backend psql $DATABASE_URL -c "SELECT * FROM _sqlx_migrations ORDER BY installed_on DESC LIMIT 5;"

# Vérifier tables critiques
docker compose exec backend psql $DATABASE_URL -c "\dt" | grep -E "(services|media|video_generation_jobs|delivery_requests)"
```

**✅ Checklist :**
- [ ] Connexion DB fonctionne
- [ ] Migrations SQLx sont appliquées
- [ ] Tables critiques existent (services, media, video_generation_jobs, delivery_requests, etc.)

---

### 3. Variables d'environnement

```bash
# Vérifier variables backend dans docker-compose.yml
cd /opt/yukpo
grep -A 20 "backend:" docker-compose.yml | grep -E "(DATABASE_URL|JWT_SECRET|VIDEO_RENDERER|S3_)"

# Vérifier que DATABASE_URL pointe vers Render (pas localhost)
grep DATABASE_URL docker-compose.yml
# Doit contenir: your-render-db-host.render.com
```

**✅ Checklist :**
- [ ] `DATABASE_URL` pointe vers Render (pas `postgres:5432`)
- [ ] `JWT_SECRET` est défini et sécurisé (pas `your-secret-key`)
- [ ] Variables vidéo/GPU configurées si nécessaire (`VIDEO_RENDERER_*`, `S3_*`)

---

### 4. Build backend (SQLx offline)

```bash
# Vérifier que le Dockerfile backend génère le cache SQLx
cd /opt/yukpo/backend
grep -A 5 "sqlx prepare" Dockerfile
# Doit contenir: RUN SQLX_OFFLINE=false cargo sqlx prepare -- --lib

# Tester build backend (sans lancer)
docker compose build backend --no-cache 2>&1 | tail -30
# Vérifier qu'il n'y a pas d'erreurs SQLx "set DATABASE_URL to use query macros"
```

**✅ Checklist :**
- [ ] Dockerfile contient `cargo sqlx prepare` avant `cargo build`
- [ ] Build backend réussit sans erreurs SQLx (461 erreurs = problème)
- [ ] Cache `.sqlx` est généré (vérifier dans image Docker si nécessaire)

---

### 5. Frontend build

```bash
# Vérifier que date-fns est dans package.json
cd /opt/yukpo/frontend
grep "date-fns" package.json
# Doit retourner: "date-fns": "^2.30.0" ou similaire

# Tester build frontend (sans lancer)
docker compose build frontend --no-cache 2>&1 | tail -30
# Vérifier qu'il n'y a pas d'erreur "Rollup failed to resolve import date-fns"
```

**✅ Checklist :**
- [ ] `date-fns` est dans `frontend/package.json`
- [ ] Build frontend réussit sans erreur "failed to resolve import"

---

### 6. Git repository

```bash
# Vérifier état git
cd /opt/yukpo
git status
git log --oneline -5

# Vérifier que les dernières modifications sont pullées
git fetch origin
git status
# Doit indiquer "Your branch is up to date" ou "behind X commits"
```

**✅ Checklist :**
- [ ] Repository git est propre (pas de modifications non commitées critiques)
- [ ] Dernières modifications sont pullées (`git pull` si nécessaire)

---

### 7. Prometheus & Grafana

```bash
# Vérifier que Prometheus scrape le backend
curl http://localhost:9090/api/v1/targets
# Vérifier que "yukpo-backend" est "up"

# Vérifier que Grafana peut accéder à Prometheus
# Ouvrir http://<IP_HETZNER>:3002 dans navigateur
# Login: admin/admin
# Vérifier Data Sources → Prometheus est configuré et "Health: OK"
```

**✅ Checklist :**
- [ ] Prometheus scrape le backend (`targets` montre "up")
- [ ] Grafana est accessible (http://<IP_HETZNER>:3002)
- [ ] Data source Prometheus est configurée dans Grafana

---

### 8. Endpoints API critiques

```bash
# Vérifier endpoints métriques
curl http://localhost:3001/metrics | head -20
curl http://localhost:3001/internal/metrics/pipeline | head -20
curl http://localhost:3001/metrics/delivery | head -20

# Vérifier endpoints vidéo (si feature flag activé)
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/video/estimate-cost
# Doit retourner JSON ou erreur auth (pas 500)
```

**✅ Checklist :**
- [ ] `/metrics` retourne des métriques
- [ ] `/internal/metrics/pipeline` retourne métriques vidéo
- [ ] `/metrics/delivery` retourne métriques delivery
- [ ] Endpoints API répondent (pas d'erreur 500)

---

## 🚨 SI UNE VÉRIFICATION ÉCHOUE

**Ne pas procéder aux intégrations/modifications tant que :**

1. **Services Docker down** → Corriger avec `docker compose up -d` ou investiguer logs
2. **DB inaccessible** → Vérifier credentials Render, firewall, réseau
3. **Build échoue** → Corriger Dockerfile, dépendances, ou variables d'environnement
4. **Migrations manquantes** → Appliquer avec `sqlx migrate run` ou via backend
5. **Variables d'environnement incorrectes** → Mettre à jour `docker-compose.yml`

**Documenter toute correction dans ce prompt ou dans un fichier `FIXES_APPLIED.md`**

---

## 🔑 INFORMATIONS D'ACCÈS

### Base de données PostgreSQL (Render)

```bash
# URL complète
DATABASE_URL=postgresql://user:password@host:port/database

# Détails
Hostname: your-render-db-host.render.com
Database: yukpo_db
Username: yukpo_db_user
Password: YOUR_PASSWORD
Port: 5432 (par défaut)
```

### VM Hetzner (Production)

```bash
# SSH
ssh root@<IP_HETZNER>

# Répertoire projet
cd /opt/yukpo

# Docker Compose
docker compose ps          # Vérifier les services
docker compose logs backend  # Logs backend
docker compose logs frontend # Logs frontend
docker compose logs prometheus # Logs Prometheus
docker compose logs grafana    # Logs Grafana

# Services exposés
- Backend: http://<IP_HETZNER>:3001
- Frontend: http://<IP_HETZNER>:3000
- Prometheus: http://<IP_HETZNER>:9090
- Grafana: http://<IP_HETZNER>:3002 (admin/admin)
```

### JWT Secret (Production)

```bash
JWT_SECRET=c1daf37cdbc083d458dadf8510af6722929d17bd931e9dfda90ee4ed74d6f2b6
```

### GitHub Repository

```bash
# URL du repo (à confirmer)
git remote -v

# Workflow standard
git pull origin master
docker compose build backend
docker compose up -d
```

---

## ✅ ÉTAT ACTUEL - CE QUI EST FAIT

### Backend Rust
- ✅ Architecture Axum + SQLx + PostgreSQL
- ✅ Endpoints métriques Prometheus (`/metrics`, `/internal/metrics/pipeline`, `/metrics/delivery`)
- ✅ Métriques vidéo (latence totale, jobs queued/running/completed/failed)
- ✅ Métriques delivery (matching, WebSocket, wallet)
- ✅ Feature flags (`FeatureFlagService`)
- ✅ Video generation pipeline (backend orchestrateur)
- ✅ Delivery module (matching, tracking, WebSocket)

### Frontend React
- ✅ `ImmersiveVideoWizard` avec `media_scene_overrides` support
- ✅ Style packs (Pulse social, Story éditoriale, Corporate clair)
- ✅ Scene assignments (mapping média → scène)
- ✅ Feature flags context (`FeatureFlagProvider`)

### Mobile Expo
- ✅ `VideoCreationWizardScreen` avec `media_scene_overrides` support
- ✅ Style packs alignés avec le web
- ✅ Feature flags context mobile

### Infrastructure
- ✅ Docker Compose avec Prometheus + Grafana
- ✅ `prometheus.yml` configuré pour scraper backend
- ✅ `docker-compose.yml` avec services backend/frontend/prometheus/grafana
- ✅ Backend Dockerfile avec SQLx offline mode (génération cache au build)

### Documentation
- ✅ `docs/metrics_grafana_video_delivery.md` (Prometheus/Grafana setup)
- ✅ `docs/TODO_GLOBAL_VIDEO_DELIVERY.md` (TODO complet)
- ✅ `docs/video_editor_benchmark.md` (benchmark TikTok/Reels/CapCut/Canva)

---

## 🚨 GAPS TECHNIQUES RESTANTS

**⚠️ RAPPEL CRITIQUE : Avant de commencer à travailler sur un gap, vérifier que toutes les vérifications préalables (section ci-dessus) sont ✅ complétées.**

**Workflow recommandé :**
1. ✅ Compléter toutes les vérifications préalables
2. ✅ Corriger tout problème détecté
3. ✅ Documenter les corrections si nécessaire
4. 🚀 **Seulement ensuite** commencer l'intégration/modification du gap

---

### 🔴 BLOC 0 : Éditeur timeline temps réel (parité UX TikTok/Reels/CapCut/Canva)

**Priorité : HAUTE** - Objectif : surpasser TikTok en usage, fonctionnalités et rendu UX

#### 0.1 Vision & cible produit
- [ ] **0.1.1** Définir la "vision Yukpo Studio" (documenter dans `docs/video_editor_vision.md`)
- [ ] **0.1.2** Bench technique TikTok/Reels/CapCut/Canva (déjà créé `docs/video_editor_benchmark.md`, à compléter)

#### 0.2 Architecture UI timeline web (React)
- [x] **0.2.1** Modèle de données timeline front (déjà fait via `media_scene_overrides`)
- [x] **0.2.2** MVP "scene list" dans `ImmersiveVideoWizard` (déjà fait)
- [ ] **0.2.3** Timeline visuelle (rail horizontal)
  - Créer composant `TimelineRail` avec segments proportionnels
  - Drag & drop thumbnail média sur scène
  - Zoom timeline (10s / 30s / totalité)
  - Curseur de lecture

#### 0.3 UX temps réel & performances web
- [ ] **0.3.1** Prévisualisation rapide sans rendu complet GPU
  - Mode "aperçu rapide" (rendu partiel/basse résolution ou HTML/CSS/Canvas)
  - Bouton "Aperçu rapide" distinct du "Lancer le rendu final"
  - Documenter limitations dans `docs/video_pipeline_qa.md`
- [ ] **0.3.2** Réactivité de l'UI
  - Vérifier interactions non bloquantes (pas d'appel réseau synchrone)
  - Auto-sauvegarde storyboard/timeline
  - Profiler re-renders (React DevTools) + `useMemo/useCallback`

#### 0.4 Éditeur mobile (Expo) inspiré TikTok/Reels
- [ ] **0.4.1** Spécification UX mobile (`docs/mobile_video_editor_spec.md` à compléter)
  - Swipe gauche/droite pour changer de scène
  - Long-press sur scène pour changer média
  - Slider pour ajuster durée/volume
  - Bouton "prévisualiser"
- [x] **0.4.2** Wizard timeline dans `VideoCreationWizardScreen` (déjà fait)

#### 0.5 Fonctions avancées inspirées TikTok/CapCut/Canva
- [ ] **0.5.1** Auto-beat sync & auto-cut
  - Service analyse audio (détection beats, changements rythme)
  - Algorithme suggestion découpes scènes alignées musique
  - Option UI "Synchroniser sur la musique"
- [x] **0.5.2** Effets texte & transitions (déjà fait via style packs)
- [ ] **0.5.3** Sous-titres & stickers
  - Génération sous-titres auto (activation/désactivation, style)
  - Stickers simples (icônes/labels) positionnés par scène

#### 0.6 IA assistive au montage
- [ ] **0.6.1** Suggestions IA storyboard/scènes
  - Générer storyboard (liste scènes + messages clés)
  - Proposition auto médias par scène (basée assets service + métadonnées)
  - Afficher suggestions dans éditeur (point de départ modifiable)
- [ ] **0.6.2** Intégration profonde avec données Yukpo
  - Scènes CTA "Livraison express disponible", zone/cité, SLA, tarifs
  - Prix/promo dynamiques (mise à jour selon données service)
  - Variantes par segment (clients fidèles, zone, campagne globale)

#### 0.7 QA & benchmarks
- [ ] **0.7.1** Bench UX interne
  - Protocole test "temps de tâche" dans `docs/video_editor_benchmark.md`
  - Scénario : "Créer montage simple à partir service existant"
  - Mesurer clics/gestes et temps sur TikTok, CapCut, Canva, Yukpo
- [ ] **0.7.2** Tests automatisés web & mobile
  - Tests Playwright (création/modification timeline, aperçu rapide, lancement rendu)
  - Tests Detox mobile (navigation wizard vidéo, édition scènes, aperçu)
  - Coupler avec endpoints `/internal/metrics/pipeline` et `/metrics/delivery`

---

### 🟡 BLOC 1 : Monitoring & Observabilité (Prometheus/Grafana)

**Priorité : MOYENNE** - Partiellement fait, à finaliser

#### 1.1 Métriques vidéo détaillées par sous-étape
- [x] Latence totale vidéo (`VIDEO_LATENCY_TOTAL_MS`, `VIDEO_LATENCY_COUNT`)
- [ ] **1.1.1** Métriques par sous-étape :
  - `video_ia_storyboard_duration_ms` (IA storyboard)
  - `video_gpu_render_duration_ms` (rendu GPU/local)
  - `video_upload_duration_ms` (upload S3)
  - Exposer via `/internal/metrics/pipeline`

#### 1.2 Métriques delivery matching/WebSocket
- [x] Métriques matching (`DELIVERY_MATCHING_STARTED_TOTAL`, `DELIVERY_MATCHING_SUCCESS_TOTAL`, `DELIVERY_MATCHING_FAILED_TOTAL`)
- [x] Métriques WebSocket (`DELIVERY_WS_CONNECTIONS_CURRENT`, `DELIVERY_WS_MESSAGES_SENT_TOTAL`, `DELIVERY_WS_ERRORS_TOTAL`)
- [ ] **1.2.1** Métriques latence matching (`DELIVERY_MATCHING_LATENCY_TOTAL_MS`, `DELIVERY_MATCHING_LATENCY_COUNT`)
  - Déjà ajouté dans `delivery_service.rs`, à vérifier exposition Prometheus

#### 1.3 Configuration Grafana/Prometheus
- [x] `prometheus.yml` créé et configuré
- [x] `docker-compose.yml` avec services Prometheus + Grafana
- [ ] **1.3.1** Dashboards Grafana
  - Dashboard "Vidéo Pipeline" (jobs, latences, erreurs)
  - Dashboard "Delivery" (matching, WebSocket, wallet)
  - Dashboard "Système" (CPU, RAM, réseau)
- [ ] **1.3.2** SLO & Alertes
  - SLO : 95% des vidéos générées en < 5 minutes
  - Alerte : > 10% échecs vidéo sur 1h
  - Alerte : matching delivery > 30s en moyenne
  - Configurer dans Prometheus (`prometheus.yml` ou `alerts.yml`)

---

### 🟢 BLOC 2 : Variables d'environnement & Configuration

**Priorité : BASSE** - À documenter et vérifier

#### 2.1 Variables d'environnement manquantes
- [ ] **2.1.1** Backend
  - `VIDEO_RENDERER_ENABLE_GPU=true/false`
  - `VIDEO_RENDERER_HOST=...` (Hetzner GPU worker)
  - `S3_BUCKET=...`, `S3_ENDPOINT=...`, `S3_ACCESS_KEY=...`, `S3_SECRET_KEY=...`
  - `REDIS_URL=...` (si utilisé)
- [ ] **2.1.2** Frontend
  - `VITE_API_BASE_URL=...`
  - `VITE_APP_ENV=production/staging/development`
- [ ] **2.1.3** Mobile
  - Variables Expo (`.env` ou `app.config.js`)
- [ ] **2.1.4** GPU Worker (Hetzner)
  - Variables depuis `gpu_worker_config.json`

#### 2.2 Documentation variables d'environnement
- [ ] Créer `docs/env_variables_complete.md` avec toutes les variables nécessaires
- [ ] Créer `.env.example` pour chaque module (backend, frontend, mobile)

---

### 🔵 BLOC 3 : Delivery Module - Fonctionnalités manquantes

**Priorité : MOYENNE**

#### 3.1 WebSocket Events
- [x] `DeliveryWsEvent::Tracking` (déjà fait)
- [ ] **3.1.1** `DeliveryWsEvent::Matching`
  - Émettre événement quand matching démarre/réussit/échoue
  - Notifier client en temps réel du statut matching

#### 3.2 UI Delivery avancée
- [ ] **3.2.1** Dashboard delivery temps réel (frontend)
  - Liste commandes en cours
  - Carte géographique avec positions livreurs
  - Notifications WebSocket intégrées
- [ ] **3.2.2** Mobile delivery tracking
  - Écran suivi commande en temps réel
  - Notifications push pour statuts importants

---

## 🛠️ COMMANDES UTILES

### Sur la VM Hetzner

```bash
# Se connecter
ssh root@<IP_HETZNER>
cd /opt/yukpo

# Vérifier services
docker compose ps

# Logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f prometheus
docker compose logs -f grafana

# Rebuild backend (après modification code)
docker compose build backend
docker compose up -d backend

# Rebuild tout
docker compose build
docker compose up -d

# Arrêter tout
docker compose down

# Vérifier métriques Prometheus
curl http://localhost:9090/api/v1/query?query=video_jobs_queued

# Accéder Grafana
# http://<IP_HETZNER>:3002 (admin/admin)
```

### Sur machine locale (développement)

```bash
# Backend
cd backend
cargo build
cargo run
cargo test
cargo clippy

# Frontend
cd frontend
npm install
npm run dev
npm run build

# Mobile
cd mobile
npm install
npx expo start
npx expo start --clear

# SQLx (générer cache offline)
cd backend
export DATABASE_URL="postgresql://user:password@host:port/database"
cargo sqlx prepare -- --lib
```

---

## 📝 FICHIERS CLÉS À CONNAÎTRE

### Backend
- `backend/src/services/video_generation_service.rs` - Pipeline génération vidéo
- `backend/src/services/delivery_service.rs` - Service delivery
- `backend/src/routes/metrics_routes.rs` - Endpoints métriques
- `backend/src/routes/delivery_metrics_routes.rs` - Métriques delivery
- `backend/src/controllers/metrics_controller.rs` - Contrôleur métriques
- `backend/Dockerfile` - Build Docker avec SQLx offline

### Frontend
- `frontend/src/pages/video/ImmersiveVideoWizard.tsx` - Wizard vidéo web
- `frontend/src/hooks/useCreatorStudio.ts` - Hook preview studio
- `frontend/src/context/FeatureFlagProvider.tsx` - Feature flags

### Mobile
- `mobile/src/screens/video/VideoCreationWizardScreen.tsx` - Wizard vidéo mobile
- `mobile/src/contexts/FeatureFlagContext.tsx` - Feature flags mobile

### Infrastructure
- `docker-compose.yml` - Orchestration services
- `prometheus.yml` - Configuration Prometheus
- `backend/gpu_worker_config.json` - Config GPU worker Hetzner

### Documentation
- `docs/TODO_GLOBAL_VIDEO_DELIVERY.md` - TODO complet
- `docs/metrics_grafana_video_delivery.md` - Setup Prometheus/Grafana
- `docs/video_editor_benchmark.md` - Benchmark TikTok/Reels/CapCut/Canva

---

## 🎯 PROCHAINES ÉTAPES RECOMMANDÉES

**⚠️ AVANT DE COMMENCER : Compléter toutes les vérifications préalables (section "✅ VÉRIFICATIONS PRÉALABLES OBLIGATOIRES")**

1. **Finaliser Docker build backend** (en cours)
   - Vérifier que `docker compose build backend` fonctionne avec SQLx offline
   - Tester que tous les services démarrent (`docker compose up -d`)

2. **Configurer Grafana dashboards** (bloc 1.3.1)
   - Se connecter à Grafana (http://<IP_HETZNER>:3002)
   - Créer dashboard "Vidéo Pipeline"
   - Créer dashboard "Delivery"
   - Importer/ajouter panels depuis `docs/metrics_grafana_video_delivery.md`

3. **Implémenter timeline visuelle web** (bloc 0.2.3)
   - Créer composant `TimelineRail` dans `frontend/src/components/video/`
   - Intégrer dans `ImmersiveVideoWizard`
   - Tester drag & drop et zoom

4. **Ajouter métriques vidéo par sous-étape** (bloc 1.1.1)
   - Instrumenter `video_generation_service.rs` pour mesurer IA/render/upload
   - Exposer via `/internal/metrics/pipeline`

5. **Implémenter prévisualisation rapide** (bloc 0.3.1)
   - Mode "aperçu rapide" (rendu partiel ou simulation HTML/CSS)
   - Bouton distinct dans `ImmersiveVideoWizard`

---

## ⚠️ PROBLÈMES CONNUS

### Backend compilation SQLx
- **Problème** : 461 erreurs SQLx "set DATABASE_URL to use query macros online"
- **Solution** : Dockerfile modifié pour générer cache `.sqlx` au build avec `cargo sqlx prepare`
- **Status** : ✅ Corrigé (à tester sur VM)

### Frontend date-fns
- **Problème** : `Rollup failed to resolve import "date-fns"`
- **Solution** : Ajouter `date-fns` dans `frontend/package.json`
- **Status** : ✅ Corrigé (à tester sur VM)

### Docker Compose volumes/networks dupliqués
- **Problème** : `yaml: unmarshal errors: mapping key "volumes" already defined`
- **Solution** : Script Python pour supprimer blocs dupliqués
- **Status** : ✅ Corrigé

---

## 📞 SUPPORT & RESSOURCES

- **Documentation SQLx offline** : `backend/SQLX_OFFLINE_MODE.md`
- **Documentation métriques** : `docs/metrics_grafana_video_delivery.md`
- **TODO global** : `docs/TODO_GLOBAL_VIDEO_DELIVERY.md`
- **Benchmark vidéo** : `docs/video_editor_benchmark.md`

---

## 🚀 COMMANDES DE DÉMARRAGE RAPIDE

**⚠️ IMPORTANT : Exécuter d'abord toutes les vérifications préalables (section "✅ VÉRIFICATIONS PRÉALABLES OBLIGATOIRES") avant de continuer.**

```bash
# 0. VÉRIFICATIONS PRÉALABLES (OBLIGATOIRE)
# Voir section "✅ VÉRIFICATIONS PRÉALABLES OBLIGATOIRES" ci-dessus
# Ne pas passer à l'étape 1 tant que toutes les vérifications ne sont pas ✅

# 1. Se connecter à la VM
ssh root@<IP_HETZNER>
cd /opt/yukpo

# 2. Récupérer dernières modifications
git pull origin master

# 3. Rebuild backend (si modifications)
docker compose build backend

# 4. Démarrer tous les services
docker compose up -d

# 5. Vérifier que tout fonctionne
docker compose ps
curl http://localhost:3001/healthz
curl http://localhost:3001/metrics

# 6. Accéder aux interfaces
# Backend API: http://<IP_HETZNER>:3001
# Frontend: http://<IP_HETZNER>:3000
# Prometheus: http://<IP_HETZNER>:9090
# Grafana: http://<IP_HETZNER>:3002 (admin/admin)
```

---

**Dernière mise à jour** : 2025-01-XX  
**Version** : 1.0

