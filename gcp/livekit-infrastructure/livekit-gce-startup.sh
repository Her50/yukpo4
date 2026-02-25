#!/bin/bash
# ============================================================
# Yukpo LiveKit Server - Script de démarrage GCP Compute Engine
# Déploie LiveKit + SRS sur une VM GCE dans europe-west1
# ============================================================
set -uo pipefail

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

LOG_FILE="/var/log/yukpo-livekit.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "$(date) [LiveKit] Démarrage de la configuration GCP..."

# 1. Installation des dépendances
echo "$(date) [LiveKit] Installation des dépendances..."
apt-get update -y
apt-get install -y --no-install-recommends \
    curl jq docker.io docker-compose-plugin \
    nginx certbot python3-certbot-nginx \
    redis-tools

# 2. Activer et démarrer Docker
systemctl enable docker
systemctl start docker

# 3. Récupérer les métadonnées de l'instance
EXTERNAL_IP=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip 2>/dev/null || echo "")
INTERNAL_IP=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip 2>/dev/null || echo "")
ZONE=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/zone 2>/dev/null | awk -F'/' '{print $NF}')

echo "$(date) [LiveKit] External IP: $EXTERNAL_IP"
echo "$(date) [LiveKit] Internal IP: $INTERNAL_IP"
echo "$(date) [LiveKit] Zone: $ZONE"

# 4. Récupérer les secrets depuis GCP Secret Manager
PROJECT_ID=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/project/project-id)
echo "$(date) [LiveKit] Project: $PROJECT_ID"

# Récupérer la clé API et le secret LiveKit depuis Secret Manager
LIVEKIT_API_KEY=$(gcloud secrets versions access latest --secret="livekit-api-key" --project="$PROJECT_ID" 2>/dev/null || echo "APIPHE9xDv5RPaP")
LIVEKIT_API_SECRET=$(gcloud secrets versions access latest --secret="livekit-api-secret" --project="$PROJECT_ID" 2>/dev/null || echo "")

# Récupérer l'URL Redis depuis Secret Manager (Memorystore)
REDIS_URL=$(gcloud secrets versions access latest --secret="redis-url" --project="$PROJECT_ID" 2>/dev/null || echo "")

# Extraire l'hôte Redis pour la config LiveKit
REDIS_HOST=""
REDIS_PORT="6379"
REDIS_PASSWORD=""
if [[ -n "$REDIS_URL" ]]; then
    # Parser redis://[:password@]host:port ou rediss://...
    REDIS_HOST=$(echo "$REDIS_URL" | sed -E 's|rediss?://([^:@]+:)?([^@]+@)?([^:/]+).*|\3|')
    REDIS_PORT=$(echo "$REDIS_URL" | sed -E 's|.*:([0-9]+)/?.*|\1|' | grep -E '^[0-9]+$' || echo "6379")
    REDIS_PASSWORD=$(echo "$REDIS_URL" | sed -nE 's|rediss?://[^:]*:([^@]+)@.*|\1|p')
fi

echo "$(date) [LiveKit] Redis: $REDIS_HOST:$REDIS_PORT"

# 5. Créer la configuration LiveKit
mkdir -p /etc/livekit
cat > /etc/livekit/livekit.yaml << LKCONFIG
port: 7880

rtc:
  port_range_start: 50000
  port_range_end: 60000
  tcp_port: 7881
  use_external_ip: true

keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}

logging:
  level: info
  json: true

room:
  empty_timeout: 300
  departure_timeout: 20
  max_participants: 100

LKCONFIG

# Ajouter la config Redis si disponible
if [[ -n "$REDIS_HOST" ]]; then
    cat >> /etc/livekit/livekit.yaml << REDIS_BLOCK

redis:
  address: ${REDIS_HOST}:${REDIS_PORT}
REDIS_BLOCK

    if [[ -n "$REDIS_PASSWORD" ]]; then
        echo "  password: ${REDIS_PASSWORD}" >> /etc/livekit/livekit.yaml
    fi
fi

echo "$(date) [LiveKit] Configuration écrite dans /etc/livekit/livekit.yaml"

# 6. Créer le docker-compose pour LiveKit + SRS
mkdir -p /opt/yukpo-livekit
cat > /opt/yukpo-livekit/docker-compose.yml << 'COMPOSE'
version: "3.8"

services:
  livekit:
    image: livekit/livekit-server:latest
    container_name: yukpo-livekit
    restart: always
    network_mode: host
    volumes:
      - /etc/livekit/livekit.yaml:/etc/livekit.yaml
    command: ["--config", "/etc/livekit.yaml"]
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:7880"]
      interval: 30s
      timeout: 10s
      retries: 3

  livekit-ingress:
    image: livekit/ingress:latest
    container_name: yukpo-livekit-ingress
    restart: always
    network_mode: host
    environment:
      - LIVEKIT_URL=ws://localhost:7880
      - LIVEKIT_API_KEY=${LIVEKIT_API_KEY:-APIPHE9xDv5RPaP}
      - LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
    depends_on:
      livekit:
        condition: service_healthy

  srs:
    image: ossrs/srs:5
    container_name: yukpo-srs
    restart: always
    ports:
      - "1935:1935"
      - "8080:8080"
      - "8443:8443"
    volumes:
      - /etc/srs/srs.conf:/usr/local/srs/conf/srs.conf
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/v1/versions"]
      interval: 30s
      timeout: 10s
      retries: 3
COMPOSE

# 7. Créer la configuration SRS
mkdir -p /etc/srs
cat > /etc/srs/srs.conf << 'SRSCONF'
listen              1935;
max_connections     1000;
daemon              off;
srs_log_tank        console;

http_server {
    enabled         on;
    listen          8080;
    dir             ./objs/nginx/html;
    crossdomain     on;
}

http_api {
    enabled         on;
    listen          1985;
    crossdomain     on;
}

vhost __defaultVhost__ {
    hls {
        enabled         on;
        hls_path        ./objs/nginx/html;
        hls_fragment    3;
        hls_window      60;
    }
    http_remux {
        enabled         on;
        mount           [vhost]/[app]/[stream].flv;
    }
    dvr {
        enabled         off;
    }
}
SRSCONF

# 8. Créer le fichier d'environnement pour docker-compose
cat > /opt/yukpo-livekit/.env << ENVFILE
LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
ENVFILE

# 9. Démarrer les services
echo "$(date) [LiveKit] Démarrage des services LiveKit + SRS..."
cd /opt/yukpo-livekit
docker compose up -d

# 10. Attendre que les services soient opérationnels
echo "$(date) [LiveKit] Attente du démarrage des services..."
sleep 10

# Vérifier LiveKit
for i in {1..30}; do
    if curl -sf http://localhost:7880 > /dev/null 2>&1; then
        echo "$(date) [LiveKit] ✅ Serveur LiveKit opérationnel sur le port 7880"
        break
    fi
    echo "$(date) [LiveKit] Attente de LiveKit... ($i/30)"
    sleep 2
done

# Vérifier SRS
for i in {1..15}; do
    if curl -sf http://localhost:8080/api/v1/versions > /dev/null 2>&1; then
        echo "$(date) [LiveKit] ✅ Serveur SRS opérationnel sur le port 8080"
        break
    fi
    echo "$(date) [LiveKit] Attente de SRS... ($i/15)"
    sleep 2
done

# 11. Créer le endpoint de health check
cat > /opt/yukpo-livekit/healthcheck.sh << 'HEALTH'
#!/bin/bash
LK_STATUS=$(curl -sf http://localhost:7880 2>/dev/null && echo "ok" || echo "error")
SRS_STATUS=$(curl -sf http://localhost:8080/api/v1/versions 2>/dev/null && echo "ok" || echo "error")
echo "{\"livekit\": \"$LK_STATUS\", \"srs\": \"$SRS_STATUS\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
HEALTH
chmod +x /opt/yukpo-livekit/healthcheck.sh

# 12. Créer le service systemd pour redémarrage automatique
cat > /etc/systemd/system/yukpo-livekit.service << 'SYSTEMD'
[Unit]
Description=Yukpo LiveKit + SRS Services
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/yukpo-livekit
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable yukpo-livekit.service

echo "$(date) [LiveKit] ✅ Déploiement GCP LiveKit terminé !"
echo "$(date) [LiveKit] External IP: $EXTERNAL_IP"
echo "$(date) [LiveKit] LiveKit API: http://$EXTERNAL_IP:7880"
echo "$(date) [LiveKit] LiveKit WS:  ws://$EXTERNAL_IP:7880"
echo "$(date) [LiveKit] SRS RTMP:    rtmp://$EXTERNAL_IP:1935/live"
echo "$(date) [LiveKit] SRS HLS:     http://$EXTERNAL_IP:8080/live"
