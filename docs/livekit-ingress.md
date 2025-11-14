# LiveKit Ingress Runbook

This document captures the production workflow for operating LiveKit ingress on the Hetzner edge VM.

## 1. Environment bootstrap

1. Copy `.env.livekit.example` to `.env.livekit` and fill in the sensitive values:
   ```
   LIVEKIT_HOST=46.224.14.85
   LIVEKIT_HTTP=http://46.224.14.85:7880
   LIVEKIT_WS=ws://46.224.14.85:7880
   LIVEKIT_API_KEY=...
   LIVEKIT_API_SECRET=...
   LIVEKIT_INGRESS_NAME=prod-ingress-1
   LIVEKIT_INGRESS_ROOM=live-events
   ```
2. Install tooling (Ubuntu / WSL):
   ```
   sudo apt update
   sudo apt install -y python3-pip jq gettext-base curl ffmpeg
   pip install -r scripts/requirements.txt
   chmod +x scripts/*.py scripts/ingress/*.sh
   ```

## 2. Deploy / update ingress stack

```
source .env.livekit
ansible-playbook \
  -i infra/livekit/ansible/inventory.ini \
  infra/livekit/ansible/playbook_ingress.yml \
  -e "livekit_api_url=$LIVEKIT_HTTP" \
  -e "livekit_ws_url=$LIVEKIT_WS" \
  -e "livekit_api_key=$LIVEKIT_API_KEY" \
  -e "livekit_api_secret=$LIVEKIT_API_SECRET" \
  -e "livekit_ingress_cpu_cost_rtmp=2.5" \
  -e "livekit_ingress_cpu_cost_whip=2.0" \
  -e "livekit_ingress_cpu_cost_whip_bypass=0.2" \
  -e "livekit_ingress_cpu_cost_url=2.0" \
  -e "livekit_ingress_cpu_min_idle=0.20"
```

Health check:
```
./scripts/ingress/check_ingress.sh
```

## 3. Provision an ingress endpoint

```
./scripts/ingress/create_ingress.sh
```

Output (`create_ingress_response.json`) contains `rtmp.url`, `rtmp.stream_key`, `whip.url`, `whip.stream_key`, `ingress_id`.

## 4. Push RTMP test stream

```
ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 \
  -f lavfi -i sine=frequency=1000 \
  -c:v libx264 -preset veryfast -b:v 2500k \
  -c:a aac -b:a 128k -ar 48000 \
  -f flv "rtmp://$LIVEKIT_HOST:1935/live/<stream_key>"
```

Monitor ingress logs for `ingress started` and throughput stats.

## 5. Maintenance

- **Buffer tuning**: ensure `net.core.rmem_max=5000000` (via Ansible playbook or manual `sysctl`).
- **Monitoring**: integrate Docker logs + Prometheus metrics on `:9090`.
- **Ingress rotation**: create new ingress, update clients, then delete old ingress via:
  ```
  TOKEN=$(./scripts/livekit_jwt.py --ttl 60)
  curl -sS -X DELETE "$LIVEKIT_HTTP/v1/ingress/$INGRESS_ID" \
    -H "Authorization: Bearer $TOKEN"
  ```

## 6. Security notes

- Keep `.env.livekit` out of version control.
- Tokens from `livekit_jwt.py` expire quickly; regenerate for each operation.
- Restrict SSH access to `46.224.14.85` and rotate API keys periodically.

