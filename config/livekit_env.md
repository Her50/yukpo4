## LiveKit – Variables d'environnement & Infrastructure GCP

### 1. Rôle de LiveKit dans Yukpo
- **Rooms temps réel** : streaming interactif, masterclasses, ventes live.
- **Analytics** : le backend collecte statuts rooms/ingress, déclenche cleanup/alertes.
- **Stack actuelle** : ✅ **GCP Compute Engine** (instance `yukpo-livekit-server`, zone `europe-west1-b`)

### 2. Architecture GCP (100% GCP)

| Service | Hébergement | Description |
|---------|-------------|-------------|
| **LiveKit Server** | GCE `yukpo-livekit-server` | Serveur LiveKit (port 7880) + WebRTC media (UDP 50000-60000) |
| **SRS Streaming** | GCE `yukpo-livekit-server` | RTMP ingest (1935) + HLS (8080) |
| **WebRTC Signaling** | Cloud Run `yukpo-backend` | Signaling WebSocket `/ws/webrtc` |
| **Chat WebSocket** | Cloud Run `yukpo-backend` | Chat temps réel `/ws/chat/{s}/{p}/{u}` |
| **Redis** | Upstash (serverless) | Pub/sub pour scaling horizontal |
| **Secrets** | GCP Secret Manager | API keys, secrets LiveKit |
| **Backend** | Cloud Run `yukpo-backend` | API REST + WebSocket |

### 3. Variables côté backend (Cloud Run)
| Variable | Usage | Valeur | Source |
|----------|-------|--------|--------|
| `LIVEKIT_API_URL` | Endpoint API LiveKit | `http://<GCE_IP>:7880` | Env var Cloud Run |
| `LIVEKIT_WS_URL` | WebSocket LiveKit | `ws://<GCE_IP>:7880` | Env var Cloud Run |
| `LIVEKIT_API_KEY` | Clé API LiveKit | `APIPHE9xDv5RPaP` | GCP Secret Manager |
| `LIVEKIT_API_SECRET` | Secret associé | `***` | GCP Secret Manager |
| `LIVEKIT_HLS_URL` | URL HLS streaming | `http://<GCE_IP>:8080/live` | Env var Cloud Run |
| `SRS_RTMP_URL` | URL RTMP ingest | `rtmp://<GCE_IP>:1935/live` | Env var Cloud Run |
| `SRS_HLS_URL` | URL HLS SRS | `http://<GCE_IP>:8080/live` | Env var Cloud Run |

### 4. Firewall GCP (tags: `livekit-server`)
| Règle | Ports | Protocole | Description |
|-------|-------|-----------|-------------|
| `allow-livekit-api` | 7880, 7881 | TCP | API LiveKit + TCP fallback |
| `allow-livekit-webrtc` | 50000-60000 | UDP | WebRTC media |
| `allow-srs-streaming` | 1935, 8080 | TCP | SRS RTMP + HLS |

### 5. Déploiement

```powershell
# Déployer LiveKit sur GCE (crée l'instance, configure firewall, met à jour Cloud Run)
.\gcp\livekit-infrastructure\deploy-livekit-gcp.ps1

# Synchroniser toutes les variables (auto-détecte l'IP LiveKit GCE)
.\scripts\sync-all-variables-to-gcp.ps1
```

### 6. Vérification

```bash
# Vérifier LiveKit
curl http://<GCE_IP>:7880

# Vérifier SRS
curl http://<GCE_IP>:8080/api/v1/versions

# Lister les rooms LiveKit
curl -H "Authorization: Bearer <jwt>" http://<GCE_IP>:7880/twirp/livekit.RoomService/ListRooms

# Logs instance
gcloud compute ssh yukpo-livekit-server --zone=europe-west1-b -- 'sudo cat /var/log/yukpo-livekit.log'
gcloud compute ssh yukpo-livekit-server --zone=europe-west1-b -- 'docker ps'
```

### 7. Rotation des clés
1. Générer une nouvelle clé via `livekit-cli` sur la VM GCE
2. Mettre à jour dans GCP Secret Manager : `gcloud secrets versions add livekit-api-key --data-file=...`
3. Redéployer Cloud Run : `gcloud run services update yukpo-backend --region=europe-west1`
4. Redémarrer LiveKit : `gcloud compute ssh yukpo-livekit-server -- 'sudo systemctl restart yukpo-livekit'`

---

**⚠️ Hetzner n'est plus utilisé.** Tout est sur GCP (europe-west1).


