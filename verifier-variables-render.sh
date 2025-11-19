#!/bin/bash
# Script pour verifier les variables d'environnement sur Render

echo "=== VERIFICATION VARIABLES RENDER ==="
echo ""

echo "VARIABLES SLACK A CONFIGURER:"
echo "-----------------------------"

echo ""
echo "1. ALERTES SLA DELIVERY"
echo "   Variables deja configurees (d'apres votre liste):"
echo "   - SLA_LOOKBACK_MINUTES=60"
echo "   - SLA_THRESHOLD_RATIO=1.10"
echo "   - SLA_PROMISED_MINUTES=30"
echo "   - SLA_MONITOR_INTERVAL_SECONDS=300"
echo "   - SLA_ALERT_WEBHOOK=YOUR_SLA_ALERT_WEBHOOK_URL"
echo ""

echo "2. ALERTES PIPELINE VIDEO"
echo "   Variable MANQUANTE:"
echo "   - PIPELINE_ALERT_WEBHOOK (a creer)"
echo ""

echo "VARIABLES GPU A CONFIGURER:"
echo "---------------------------"
echo "   - GPU_AVAILABLE=true"
echo "   - GPU_TYPE=nvidia"
echo "   - GPU_MEMORY_GB=16"
echo ""

echo "ACTIONS A FAIRE:"
echo "----------------"
echo "1. Creer webhook Slack pour alertes pipeline"
echo "2. Configurer PIPELINE_ALERT_WEBHOOK sur Render"
echo "3. Configurer variables GPU sur Render"
echo "4. Redeployer le service"
echo ""

