#!/bin/bash
# ✅ Script de gestion GPU pour scaling manuel et monitoring

set -e

PROJECT_ID="${GCP_PROJECT_ID:-yukpo-project}"
ZONE="${GPU_ZONE:-europe-west1-b}"
INSTANCE_GROUP="yukpo-gpu-workers"

# Fonctions utilitaires
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Scale up
scale_up() {
    log "⬆️ Scaling UP GPU workers..."
    gcloud compute instance-groups managed resize $INSTANCE_GROUP \
        --zone=$ZONE \
        --size=$1 \
        --project=$PROJECT_ID
    log "✅ Scaled to $1 instances"
}

# Scale down
scale_down() {
    log "⬇️ Scaling DOWN GPU workers..."
    gcloud compute instance-groups managed resize $INSTANCE_GROUP \
        --zone=$ZONE \
        --size=$1 \
        --project=$PROJECT_ID
    log "✅ Scaled to $1 instances"
}

# Vérifier l'utilisation GPU
check_utilization() {
    log "📊 Vérification utilisation GPU..."
    gcloud compute instances list \
        --filter="tags.items:gpu-worker" \
        --format="table(name,status,zone)" \
        --project=$PROJECT_ID
}

# Arrêter toutes les instances
stop_all() {
    log "🛑 Arrêt de toutes les instances GPU..."
    INSTANCES=$(gcloud compute instances list \
        --filter="tags.items:gpu-worker AND status:RUNNING" \
        --format="value(name)" \
        --project=$PROJECT_ID)
    
    for instance in $INSTANCES; do
        log "Arrêt de $instance..."
        gcloud compute instances stop $instance \
            --zone=$ZONE \
            --project=$PROJECT_ID
    done
    log "✅ Toutes les instances arrêtées"
}

# Démarrer toutes les instances
start_all() {
    log "▶️ Démarrage de toutes les instances GPU..."
    INSTANCES=$(gcloud compute instances list \
        --filter="tags.items:gpu-worker AND status:TERMINATED" \
        --format="value(name)" \
        --project=$PROJECT_ID)
    
    for instance in $INSTANCES; do
        log "Démarrage de $instance..."
        gcloud compute instances start $instance \
            --zone=$ZONE \
            --project=$PROJECT_ID
    done
    log "✅ Toutes les instances démarrées"
}

# Vérifier les coûts
check_costs() {
    log "💰 Vérification des coûts GPU..."
    gcloud billing projects describe $PROJECT_ID \
        --format="value(billingAccountName)" || true
}

# Menu principal
case "$1" in
    up)
        scale_up "${2:-1}"
        ;;
    down)
        scale_down "${2:-0}"
        ;;
    status)
        check_utilization
        ;;
    stop)
        stop_all
        ;;
    start)
        start_all
        ;;
    costs)
        check_costs
        ;;
    *)
        echo "Usage: $0 {up|down|status|stop|start|costs} [size]"
        echo "  up [size]     - Scale up to N instances (default: 1)"
        echo "  down [size]   - Scale down to N instances (default: 0)"
        echo "  status        - Check GPU utilization"
        echo "  stop          - Stop all GPU instances"
        echo "  start         - Start all GPU instances"
        echo "  costs         - Check GPU costs"
        exit 1
        ;;
esac


