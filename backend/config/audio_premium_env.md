## Configuration Audio Premium – Dolby.io & AudioShake

Ce guide documente toutes les variables d’environnement nécessaires pour activer le mastering audio premium dans Yukpomnang. L’objectif est de livrer un mix haute qualité pour les vidéos générées et, facultativement, d’extraire des stems (voix, instruments) avec AudioShake.

---

### 1. Vue d’ensemble

| Composant | Rôle | Plateforme recommandée |
|-----------|------|------------------------|
| **Dolby.io Media Enhance** | Mastering audio automatisé (EQ, loudness, réduction de bruit) | Dolby.io Production |
| **AudioShake** (optionnel) | Extraction stems (voix/instrument), analyse | AudioShake Enterprise |
| **Backend Axum** | Orchestration, stockage jobs, webhooks | Render (autoscale) |
| **Stockage Master** | Destination finale des masters | S3/Wasabi (même pipeline que vidéo) |

---

### 2. Variables Dolby.io

| Variable | Description | Exemple |
|----------|-------------|---------|
| `PREMIUM_AUDIO_PROVIDER` | `dolby`, `audioshake`, `dual` (priorité Dolby, fallback AudioShake) | `dolby` |
| `DOLBY_API_KEY` | Clé API Dolby.io | (secret) |
| `DOLBY_API_SECRET` | Secret Dolby.io | (secret) |
| `DOLBY_BASE_URL` | Endpoint API (prod: `https://api.dolby.com`) | `https://api.dolby.com` |
| `DOLBY_ENHANCE_PRESET` | (facultatif) preset Dolby (ex. `music`) | `music` |
| `DOLBY_WEBHOOK_SIGNATURE_SECRET` | Secret HMAC si l’on active signature | (secret) |

**Configuration Dolby**
1. Créer un projet sur [dashboard.dolby.io](https://dashboard.dolby.io).
2. Activer Media Enhance, générer clé/secret.
3. Définir un webhook `POST https://backend.yukpo.com/webhooks/audio-premium/dolby`.
4. Définir limites (concurrency, budgets) dans la console.

---

### 3. Variables AudioShake (optionnel)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `AUDIOSHAKE_API_KEY` | Clé API | (secret) |
| `AUDIOSHAKE_BASE_URL` | Endpoint (prod: `https://api.audioshake.ai`) | `https://api.audioshake.ai` |
| `AUDIOSHAKE_ENABLE_STEMS` | `true` pour extraire stems. | `false` |
| `AUDIOSHAKE_WEBHOOK_SECRET` | Secret pour vérifier la signature du webhook. | (secret) |
| `AUDIOSHAKE_STEMS` | Liste CSV de stems à générer (ex. `vocals,bass,drums`). | `vocals` |

**Configuration AudioShake**
1. Créer un compte Enterprise.
2. Configurer webhook `POST https://backend.yukpo.com/webhooks/audio-premium/audioshake`.
3. Définir les types de stems dans la console ou via paramètre `stem_types`.

---

### 4. Variables Auphonic (fallback)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `AUPHONIC_USERNAME` | Compte Auphonic (email ou username). | `studio@yukpo.com` |
| `AUPHONIC_API_KEY` | API key Auphonic (dashboard → API Keys). | (secret) |
| `AUPHONIC_BASE_URL` | Endpoint API (`https://api.auphonic.com`). | `https://api.auphonic.com` |
| `AUPHONIC_PRESET` | (Optionnel) preset personnalisé. | `yukpo-video` |
| `AUPHONIC_OUTPUT_FORMAT` | (Optionnel) format (`mp3`, `wav`, etc.). | `wav` |
| `AUPHONIC_POLL_INTERVAL_SECS` | Intervalle de polling lors du rendu synchronisé. | `5` |
| `AUPHONIC_WEBHOOK_SECRET` | Secret si webhooks Auphonic activés. | (secret) |

**Configuration Auphonic**
1. Créer un compte [https://auphonic.com](https://auphonic.com) → *API Keys* → générer clé.
2. Créer un preset (loudness, noise reduction) si nécessaire.
3. Définir un webhook (optionnel) `POST https://backend.yukpo.com/webhooks/audio-premium/auphonic`.

---

### 4. Variables communes & contrôle pipeline

| Variable | Description | Exemple |
|----------|-------------|---------|
| `PREMIUM_AUDIO_ENABLED` | Activer/désactiver le service premium. | `true` |
| `PREMIUM_AUDIO_TIMEOUT_SECS` | Timeout job (Dolby > 600s selon durée). | `900` |
| `PREMIUM_AUDIO_MAX_RETRIES` | Nombre de retries sur fallback. | `3` |
| `PREMIUM_AUDIO_WEBHOOK_SECRET` | Secret générique utilisé par le backend pour vérifier la requête (HMAC). | (secret) |
| `PREMIUM_AUDIO_WEBHOOK_URL` | URL publique du backend (pour logs). | `https://backend.yukpo.com/webhooks/audio-premium` |
| `PREMIUM_AUDIO_STORAGE_PREFIX` | Dossier S3 où stocker les masters. | `services/audio/masters` |
| `PREMIUM_AUDIO_KEEP_LOCAL_COPY` | Conserver fichier local (1ère passe). | `false` |

---

### 5. Orchestration

1. `audio_mastering_service` envoie le fichier à Dolby (ou AudioShake) et crée une entrée `premium_audio_jobs`.
2. Dolby/AudioShake appelle `POST /webhooks/audio-premium/{provider}` → le backend téléverse le master via `MediaStorageService`.
3. Mise à jour des jobs (`video_generation_jobs`, `premium_audio_jobs`), métriques Prometheus (`premium_audio_jobs_total`, `premium_audio_failures_total`).

---

### 6. Sécurité

- **Webhooks** : vérifier la signature (Dolby `x-dolby-signature`, AudioShake HMAC). Refuser toute requête non signée.
- **Secrets** : stocker dans Render Secrets / Hetzner `systemd`. Ne jamais commiter dans le code.
- **Budgeting** : utiliser `PREMIUM_AUDIO_MAX_RETRIES`, logs d’alertes (Slack via `PIPELINE_ALERT_WEBHOOK`).

---

### 7. Monitoring & Alerting

- Prometheus : exposer `premium_audio_jobs_total`, `premium_audio_inflight`, `premium_audio_duration_seconds`.
- Grafana : dashboard pipeline audio (latence, taux d’échec).
- Alertes : job > 10 minutes → Slack/PagerDuty (via `PIPELINE_ALERT_WEBHOOK`).

---

### 8. Checklist déploiement

1. **Staging**
   - Remplir variables Dolby/Audioshake (clés test).
   - Déployer backend (`PREMIUM_AUDIO_ENABLED=true`).
   - Configurer webhooks vers `https://staging-backend.yukpo.com/webhooks/audio-premium`.
   - Exécuter `scripts/run_video_pipeline_qa.sh --with-premium-audio`.

2. **Production**
   - Clés Dolby/Audioshake prod.
   - Activer surveillance budgets.
   - Mettre en place alerting (Slack + Grafana).
   - Valider : master rendu, master téléversé, vidéo publiée.

Avec cette configuration, Yukpomnang peut offrir un rendu audio de niveau professionnel, adapté aux plateformes courtes durées (TikTok/Reels/YouTube Shorts) et extensible aux besoins plus avancés (stems, remix, analyses).


