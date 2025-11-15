## LiveKit – Variables d’environnement & Procédure clé

### 1. Rôle de LiveKit dans Yukpo
- **Rooms temps réel** : streaming interactif, masterclasses, ventes live.
- **Analytics** : le backend collecte statuts rooms/ingress, déclenche cleanup/alertes.
- **Stack actuelle** : VM Hetzner dédiée (peut migrer sur AWS EC2, Azure VM, GCP) exposée en HTTPS (`https://livekit.yukpo.live`).

### 2. Variables côté backend (`yukpomnang_backend`)
| Variable | Usage | Exemples | Où la définir |
|----------|-------|----------|---------------|
| `LIVEKIT_URL` | Endpoint API (HTTPS) | `https://livekit.yukpo.live` | Render service (backend) |
| `LIVEKIT_API_KEY` | Clé API LiveKit | `yk_admin` | Render Secrets |
| `LIVEKIT_API_SECRET` | Secret associé | `LK_SECRET_xxx` | Render Secrets |
| `LIVEKIT_TIMEOUT_SECS` *(optionnel)* | Timeout fetch API (default 10s) | `5` | Render Secrets |

Ces variables alimentent les tâches `livekit_cleanup` et `live_analytics`. Sans elles, tu obtiens les erreurs `401 Unauthorized` dans les logs Render.

### 3. Variables sur la VM LiveKit
| Variable | Usage | Exemple | Où la définir |
|----------|-------|---------|----------------|
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Permettent de générer des tokens JWT côté serveur | stocker dans `/etc/livekit.env` | VM Hetzner (systemd) |
| `LIVEKIT_WS_PORT`, `LIVEKIT_HTTP_PORT` | Ports WebRTC (TLS via Traefik/NGINX) | `7881`, `8080` | fichier de config LiveKit |
| `LIVEKIT_TLS_CERT`, `LIVEKIT_TLS_KEY` | Certificats si terminés par LiveKit | `/etc/letsencrypt/live/...` | VM |
| `REDIS_URL` *(si scaling)* | Stockage session distribué | `redis://10.0.0.5:6379` | VM |

### 4. Procédure pour générer les clés LiveKit
1. Se connecter sur la VM LiveKit (SSH).
2. Lancer `livekit-cli create-api-key <name>` ou éditer `livekit.yaml` pour ajouter un couple `api_key` / `secret`.
3. Copier ces valeurs dans Render (backend) et dans `/etc/livekit.env` (pour génération token).
4. Redémarrer LiveKit : `sudo systemctl restart livekit`.
5. Vérifier : `curl -s https://livekit.yukpo.live/status` → doit retourner JSON status `ok`.

### 5. Migration cloud (AWS/Azure/GCP)
- **Infra** : déployer LiveKit via Helm chart ou Terraform (`module livekit`). 
- **Secrets** : stocker dans `AWS Secrets Manager`, `Azure Key Vault`, `GCP Secret Manager`, puis injecter dans pods via env vars.
- **Networking** : 
  - AWS : ALB/NLB + ACM, open UDP 1024-65535 pour WebRTC.
  - Azure : Application Gateway + NSG.
- **DNS** : route `livekit.yukpo.live` vers la nouvelle IP/Load Balancer. Les variables `LIVEKIT_URL` restent à jour.

### 6. Automatisation & rotation
- Créer un script Ansible/Terraform qui :
  1. Génére la clé via API LiveKit.
  2. Met à jour Render Secrets.
  3. Redéploie backend (rollout) pour prendre en compte les nouvelles clés.
- Planifier rotation tous les 90 jours (alerting Prometheus → Slack).

### 7. Checklist « secrets LiveKit » pour la phase 2
1. Générer `LIVEKIT_API_KEY` & `LIVEKIT_API_SECRET` (VM Hetzner).
2. Remplir Render → *Environment* :
   ```
   LIVEKIT_URL=https://livekit.yukpo.live
   LIVEKIT_API_KEY=<clé>
   LIVEKIT_API_SECRET=<secret>
   ```
3. Redéployer le backend Render (ou `cargo run` localement) et vérifier absence de `401`.
4. Mettre à jour `/etc/livekit.env` sur la VM, redémarrer LiveKit.
5. Tester depuis le backend : 
   ```
   curl -H "Authorization: Bearer <jwt>" https://livekit.yukpo.live/twirp/livekit.RoomService/ListRooms
   ```
6. Capturer la doc dans `BACKEND_CONFIG_SUMMARY.md` pour la migration AWS/Azure.

---

Avec ces variables et process, tu peux basculer LiveKit vers n’importe quel cloud tout en gardant le backend modulable : seules les valeurs d’environnement changent, pas le code.


